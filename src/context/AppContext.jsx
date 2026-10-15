import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchTeacherExams, fetchTeacherSubmissions, createExamInDB, deleteExamFromDB, uploadAnswerSheetDB, saveStudentAnswerOCR, saveEvaluationDB, approveAnswerSheetDB, updateTeacherProfile, fetchAuditEvents, saveAuditEvent } from '../lib/api';
import { gradeAnswers, summarizeSubmission, examStats, encodeEvaluation } from '../lib/grading';
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

  // Notification system
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => setNotification(null), 3000);
  }, []);

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
          // Load exams and their graded sheets together so screens never show an exam without its sheets
          const liveExams = await fetchTeacherExams(u.id, false);
          const liveSubmissions = await fetchTeacherSubmissions(liveExams);
          setExams(liveExams);
          setSubmissions(liveSubmissions);
          setAuditEvents(await fetchAuditEvents(u.id));
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
        // Load exams and their graded sheets together so screens never show an exam without its sheets
        const liveExams = await fetchTeacherExams(u.id, false);
        const liveSubmissions = await fetchTeacherSubmissions(liveExams);
        setExams(liveExams);
        setSubmissions(liveSubmissions);
        setAuditEvents(await fetchAuditEvents(u.id));
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

      // Load exams and their graded sheets together so screens never show an exam without its sheets
      const liveExams = await fetchTeacherExams(u.id, false);
      const liveSubmissions = await fetchTeacherSubmissions(liveExams);
      setExams(liveExams);
      setSubmissions(liveSubmissions);
      setAuditEvents(await fetchAuditEvents(u.id));
      showNotification('Signed in with Supabase Auth!', 'success');
      return { success: true };
    }
    return { error: 'Unknown authentication error' };
  }, [showNotification]);

  // Demo Login (explicit demo button only)
  const demoLogin = useCallback(() => {
    setUser(mockUser);
    setIsAuthenticated(true);
    setIsDemo(true);
    setExams(mockExams);
    setSubmissions(mockStudentSubmissions);
    setAuditEvents(mockAuditEvents);
    showNotification('Loaded Demo Mode with sample data', 'info');
  }, [showNotification]);

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
  }, [showNotification]);

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
  }, [isDemo, showNotification]);

  // Navigation
  const navigate = useCallback((view, payload = {}) => {
    setCurrentView(view);
    if (payload.exam) setActiveExam(payload.exam);
    if (payload.submission) setActiveSubmission(payload.submission);
  }, []);

  // Record an action in the audit trail (kept in Supabase when signed in)
  const logAudit = useCallback((event) => {
    const full = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      actor: user?.name || 'Teacher',
      actorType: 'teacher',
      severity: 'info',
      ...event,
    };
    setAuditEvents(prev => [full, ...prev]);
    if (!isDemo && user?.id) saveAuditEvent(user.id, full);
  }, [user, isDemo]);

  // Override AI score
  const overrideScore = useCallback(async (submissionId, questionId, newScore, teacherNote) => {
    setSubmissions(prev => prev.map(sub => {
      if (sub.id !== submissionId) return sub;
      const updatedAnswers = sub.answers.map(ans => {
        if (ans.questionId !== questionId) return ans;
        return { ...ans, teacherScore: newScore, teacherNote, isOverridden: true };
      });
      return summarizeSubmission({ ...sub, answers: updatedAnswers });
    }));

    const sub = submissions.find(s => s.id === submissionId);
    const studentAnswerId = sub?.answers.find(a => a.questionId === questionId)?.studentAnswerId;
    if (!isDemo && studentAnswerId) {
      await saveEvaluationDB(studentAnswerId, newScore, 100, encodeEvaluation('teacher', { note: teacherNote }), false);
    }

    const ans = sub?.answers.find(a => a.questionId === questionId);
    logAudit({
      event: 'Teacher Score Override',
      examTitle: exams.find(e => e.id === sub?.examId)?.title || 'Unknown Exam',
      detail: `${sub?.studentName} ${ans?.questionLabel || ''}: AI ${ans?.aiScore ?? '-'} → ${newScore}/${ans?.maxMarks}.${teacherNote ? ` Note: ${teacherNote}` : ''}`,
      examId: sub?.examId,
      severity: 'warning',
    });
    showNotification(isDemo ? 'Score updated' : 'Score updated in Supabase!', 'success');
  }, [submissions, exams, isDemo, showNotification, logAudit]);

  // Approve submission
  const approveSubmission = useCallback(async (submissionId) => {
    setSubmissions(prev => prev.map(sub => {
      if (sub.id !== submissionId) return sub;
      const finalAnswers = sub.answers.map(ans => ({
        ...ans,
        teacherScore: ans.teacherScore !== null && ans.teacherScore !== undefined ? ans.teacherScore : ans.aiScore,
      }));
      return summarizeSubmission({ ...sub, teacherApproved: true, answers: finalAnswers });
    }));

    const sub = submissions.find(s => s.id === submissionId);
    if (!isDemo && sub?.answerSheetId) {
      const { error } = await approveAnswerSheetDB(sub.answerSheetId);
      if (error) showNotification('Approved here, but could not save approval to Supabase', 'warning');
    }
    logAudit({
      event: 'Evaluation Approved',
      examTitle: exams.find(e => e.id === sub?.examId)?.title || 'Unknown Exam',
      detail: `Approved evaluation for ${sub?.studentName}.`,
      examId: sub?.examId,
      severity: 'success',
    });
    showNotification('Evaluation approved and finalized!', 'success');
  }, [submissions, exams, isDemo, showNotification, logAudit]);

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

    const sub = submissions.find(s => s.id === submissionId);
    const ans = sub?.answers.find(a => a.questionId === questionId);
    if (!isDemo && sub?.answerSheetId && ans?.studentAnswerId) {
      await saveStudentAnswerOCR(sub.answerSheetId, questionId, newText, null, ans.studentAnswerId);
    }
    showNotification(isDemo ? 'OCR text updated' : 'OCR text updated in Supabase!', 'success');
    logAudit({
      event: 'OCR Text Corrected',
      examTitle: exams.find(e => e.id === sub?.examId)?.title || 'Unknown Exam',
      detail: `${sub?.studentName} ${ans?.questionLabel || ''}: transcription edited; answer re-graded.`,
      examId: sub?.examId,
    });

    // The corrected text changes the grade, so re-grade this answer
    if (!ans) return;
    try {
      const examQuestions = exams.find(e => e.id === sub.examId)?.questions || [];
      const [regraded] = await gradeAnswers([{ ...ans, ocrText: newText }], examQuestions);
      setSubmissions(prev => prev.map(s => {
        if (s.id !== submissionId) return s;
        return summarizeSubmission({
          ...s,
          answers: s.answers.map(a => (a.questionId === questionId ? { ...regraded, teacherScore: a.teacherScore, teacherNote: a.teacherNote } : a)),
        });
      }));
      if (!isDemo && ans.studentAnswerId && regraded.aiScore !== null) {
        await saveEvaluationDB(ans.studentAnswerId, regraded.aiScore, regraded.aiConfidence, encodeEvaluation('ai', {
          rationale: regraded.aiRationale, feedback: regraded.aiFeedback, conceptsMissed: regraded.conceptsMissed,
        }), regraded.needsReview);
      }
    } catch (err) {
      console.error('Re-grading failed:', err);
      showNotification('Could not re-grade this answer (is the backend running?)', 'warning');
    }
  }, [isDemo, submissions, exams, showNotification, logAudit]);

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
      logAudit({ event: 'Exam Created', examId: created.id, examTitle: created.title, detail: `${created.questions?.length || 0} question(s).` });
      if (created.knowledgeNotSaved) {
        showNotification('Model answers saved, but your criteria edits need database migration 004 to be kept after a refresh.', 'warning');
      }
      showNotification('Exam created & saved in Supabase!', 'success');
      return created;
    }
  }, [user, isDemo, showNotification, logAudit]);

  // Delete exam
  const deleteExam = useCallback(async (examId) => {
    try {
      if (!isDemo) {
        await deleteExamFromDB(examId);
      }
      logAudit({ event: 'Exam Deleted', examTitle: exams.find(e => e.id === examId)?.title, detail: 'Exam and all its answer sheets and grades were deleted.', severity: 'error' });
      setExams(prev => prev.filter(e => e.id !== examId));
      setSubmissions(prev => prev.filter(s => s.examId !== examId));
      if (activeExam?.id === examId) {
        setActiveExam(null);
      }
      showNotification('Exam deleted successfully.', 'success');
      navigate('exams');
      return { success: true };
    } catch (err) {
      console.error('Delete exam error:', err);
      showNotification('Failed to delete exam: ' + err.message, 'error');
      return { error: err.message };
    }
  }, [isDemo, activeExam, navigate, showNotification, exams, logAudit]);

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
    
    const { error } = await updateTeacherProfile(user.id, dbData);
    if (error) {
      showNotification('Failed to update profile', 'error');
      return { error };
    }
    
    setUser(prev => ({ ...prev, ...profileData }));
    showNotification('Profile updated successfully!', 'success');
    return { success: true };
  }, [user, isDemo, showNotification]);

  // Add new submission
  const addSubmission = useCallback((newSubmission) => {
    setSubmissions(prev => [newSubmission, ...prev]);
  }, []);

  // Exam stats come from the real submissions; active objects are re-resolved so
  // views see updates (re-grades, overrides) made after they were opened
  const examsWithStats = useMemo(
    () => (isDemo ? exams : exams.map(e => examStats(e, submissions))),
    [exams, submissions, isDemo]
  );
  const liveActiveExam = examsWithStats.find(e => e.id === activeExam?.id) || activeExam;
  const liveActiveSubmission = submissions.find(s => s.id === activeSubmission?.id) || activeSubmission;

  const value = {
    isAuthenticated, user, isDemo, loading, login, demoLogin, signup, logout,
    currentView, navigate, activeExam: liveActiveExam, setActiveExam, activeSubmission: liveActiveSubmission, setActiveSubmission,
    exams: examsWithStats, submissions, auditEvents,
    overrideScore, approveSubmission, updateOcrText, createExam, deleteExam, uploadAnswerSheetDB, addSubmission,
    getSubmissionsForExam, updateUserProfile, logAudit,
    isDark, toggleDark,
    notification, showNotification,
    sidebarOpen, setSidebarOpen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook belongs with its provider
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
