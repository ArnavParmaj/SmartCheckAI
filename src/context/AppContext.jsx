import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchTeacherExams, createExamInDB, uploadAnswerSheetDB, saveStudentAnswerOCR, saveEvaluationDB, updateTeacherProfile } from '../lib/api';
import { mockExams, mockStudentSubmissions, mockAuditEvents, mockUser } from '../data/mockData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [activeExam, setActiveExam] = useState(null);
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [isDark, setIsDark] = useState(false);
  const [notification, setNotification] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Initialize Auth Session from Supabase
  useEffect(() => {
    async function initSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const u = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email.split('@')[0],
            role: 'Teacher',
            school: 'School / Institution',
            academicYear: '2025-26',
          };
          setUser(u);
          setIsAuthenticated(true);
          setIsDemo(false);

          // Fetch exams from real Supabase DB
          const liveExams = await fetchTeacherExams(u.id, false);
          setExams(liveExams);
          setSubmissions([]);
          setAuditEvents([]);
        }
      } catch (err) {
        console.error('Supabase session init error:', err);
      } finally {
        setLoading(false);
      }
    }

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user) {
        const u = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email.split('@')[0],
          role: 'Teacher',
          school: 'School / Institution',
          academicYear: '2025-26',
        };
        setUser(u);
        setIsAuthenticated(true);
        setIsDemo(false);
        const liveExams = await fetchTeacherExams(u.id, false);
        setExams(liveExams);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setUser(null);
        setIsDemo(false);
        setExams([]);
        setSubmissions([]);
        setAuditEvents([]);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Strict Supabase Auth Login
  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }

    if (data?.user) {
      const u = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || data.user.email.split('@')[0],
        role: 'Teacher',
        school: 'School / Institution',
        academicYear: '2025-26',
      };
      setUser(u);
      setIsAuthenticated(true);
      setIsDemo(false);

      const liveExams = await fetchTeacherExams(u.id, false);
      setExams(liveExams);
      setSubmissions([]);
      setAuditEvents([]);
      showNotification('Signed in with Supabase Auth!', 'success');
      return { success: true };
    }
    return { error: 'Unknown authentication error' };
  }, []);

  // Demo Login (explicit demo button only)
  const demoLogin = useCallback(() => {
    setUser(mockUser);
    setIsAuthenticated(true);
    setIsDemo(true);
    setExams(mockExams);
    setSubmissions(mockStudentSubmissions);
    setAuditEvents(mockAuditEvents);
    showNotification('Loaded Demo Mode with sample data', 'info');
  }, []);

  // Strict Supabase Auth SignUp
  const signup = useCallback(async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.user) {
      // Insert teacher record in DB
      await supabase.from('teachers').insert({
        id: data.user.id,
        name: name,
        email: email,
        institution: 'Greenwood Academy'
      });

      const u = {
        id: data.user.id,
        email: data.user.email,
        name: name,
        role: 'Teacher',
        school: 'Greenwood Academy',
        academicYear: '2025-26',
      };
      setUser(u);
      setIsAuthenticated(true);
      setIsDemo(false);
      setExams([]);
      setSubmissions([]);
      setAuditEvents([]);
      showNotification('Account created in Supabase Auth!', 'success');
      return { success: true };
    }

    return { error: 'Account creation failed' };
  }, []);

  // Logout
  const logout = useCallback(async () => {
    if (!isDemo) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('SignOut error:', err);
      }
    }
    setIsAuthenticated(false);
    setUser(null);
    setIsDemo(false);
    setExams([]);
    setSubmissions([]);
    setAuditEvents([]);
    setCurrentView('dashboard');
    showNotification('Signed out successfully.', 'info');
  }, [isDemo]);

  // Navigation
  const navigate = useCallback((view, payload = {}) => {
    setCurrentView(view);
    if (payload.exam) setActiveExam(payload.exam);
    if (payload.submission) setActiveSubmission(payload.submission);
  }, []);

  // Override AI score
  const overrideScore = useCallback(async (submissionId, questionId, newScore, teacherNote) => {
    setSubmissions(prev => prev.map(sub => {
      if (sub.id !== submissionId) return sub;
      const updatedAnswers = sub.answers.map(ans => {
        if (ans.questionId !== questionId) return ans;
        return { ...ans, teacherScore: newScore, teacherNote, isOverridden: true };
      });
      const totalScore = updatedAnswers.reduce((sum, ans) => sum + (ans.teacherScore !== null ? ans.teacherScore : ans.aiScore), 0);
      return { ...sub, answers: updatedAnswers, totalScore };
    }));

    if (!isDemo) {
      await saveEvaluationDB(questionId, newScore, 95, teacherNote, false);
    }

    const sub = submissions.find(s => s.id === submissionId);
    const newEvent = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      event: 'Teacher Score Override',
      actor: user?.name || 'Teacher',
      actorType: 'teacher',
      examTitle: exams.find(e => e.id === sub?.examId)?.title || 'Unknown Exam',
      detail: `Modified score for question. Note: ${teacherNote}`,
      examId: sub?.examId,
      severity: 'warning',
    };
    setAuditEvents(prev => [newEvent, ...prev]);
    showNotification(isDemo ? 'Score updated' : 'Score updated in Supabase!', 'success');
  }, [submissions, user, exams, isDemo]);

  // Approve submission
  const approveSubmission = useCallback((submissionId) => {
    setSubmissions(prev => prev.map(sub => {
      if (sub.id !== submissionId) return sub;
      const finalAnswers = sub.answers.map(ans => ({
        ...ans,
        teacherScore: ans.teacherScore !== null ? ans.teacherScore : ans.aiScore,
      }));
      const totalScore = finalAnswers.reduce((sum, ans) => sum + ans.teacherScore, 0);
      return { ...sub, status: 'Approved', teacherApproved: true, answers: finalAnswers, totalScore };
    }));

    const sub = submissions.find(s => s.id === submissionId);
    const newEvent = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      event: 'Evaluation Approved',
      actor: user?.name || 'Teacher',
      actorType: 'teacher',
      examTitle: exams.find(e => e.id === sub?.examId)?.title || 'Unknown Exam',
      detail: `Approved evaluation for ${sub?.studentName}.`,
      examId: sub?.examId,
      severity: 'success',
    };
    setAuditEvents(prev => [newEvent, ...prev]);
    showNotification('Evaluation approved and finalized!', 'success');
  }, [submissions, user, exams]);

  // Update OCR text
  const updateOcrText = useCallback(async (submissionId, questionId, newText) => {
    setSubmissions(prev => prev.map(sub => {
      if (sub.id !== submissionId) return sub;
      return {
        ...sub,
        answers: sub.answers.map(ans => {
          if (ans.questionId !== questionId) return ans;
          return { ...ans, ocrText: newText };
        })
      };
    }));

    if (!isDemo) {
      await saveStudentAnswerOCR(submissionId, questionId, newText);
    }

    showNotification(isDemo ? 'OCR text updated' : 'OCR text updated in Supabase!', 'success');
  }, [isDemo]);

  // Create exam
  const createExam = useCallback(async (examData) => {
    if (isDemo) {
      const newExam = {
        id: `exam-${Date.now()}`,
        ...examData,
        status: 'Draft',
        submissionsEvaluated: 0,
        pendingReview: 0,
        avgScore: null,
        avgConfidence: null,
      };
      setExams(prev => [newExam, ...prev]);
      showNotification('Exam created (Demo Mode)!', 'success');
      return newExam;
    } else {
      const created = await createExamInDB(examData, user?.id);
      setExams(prev => [created, ...prev]);
      showNotification('Exam created & saved in Supabase!', 'success');
      return created;
    }
  }, [user, isDemo]);

  // Toggle dark mode
  const toggleDark = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  // Notification system
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Get submissions for an exam
  const getSubmissionsForExam = useCallback((examId) => {
    return submissions.filter(s => s.examId === examId);
  }, [submissions]);

  // Update user profile
  const updateUserProfile = useCallback(async (profileData) => {
    if (isDemo) {
      setUser(prev => ({ ...prev, ...profileData }));
      showNotification('Profile updated (Demo Mode)', 'success');
      return { success: true };
    }
    
    // Convert to DB keys
    const dbData = {};
    if (profileData.name) dbData.name = profileData.name;
    if (profileData.email) dbData.email = profileData.email;
    if (profileData.school) dbData.institution = profileData.school;
    
    const { data, error } = await updateTeacherProfile(user.id, dbData);
    if (error) {
      showNotification('Failed to update profile', 'error');
      return { error };
    }
    
    setUser(prev => ({ ...prev, ...profileData }));
    showNotification('Profile updated successfully!', 'success');
    return { success: true };
  }, [user, isDemo, showNotification]);

  const value = {
    isAuthenticated, user, isDemo, loading, login, demoLogin, signup, logout,
    currentView, navigate, activeExam, setActiveExam, activeSubmission, setActiveSubmission,
    exams, submissions, auditEvents,
    overrideScore, approveSubmission, updateOcrText, createExam, uploadAnswerSheetDB,
    getSubmissionsForExam, updateUserProfile,
    isDark, toggleDark,
    notification, showNotification,
    sidebarOpen, setSidebarOpen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
