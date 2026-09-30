import { supabase } from './supabaseClient';
import { mockExams } from '../data/mockData';

// Fetch exams for current teacher from Supabase DB
export async function fetchTeacherExams(teacherId, isDemo = false) {
  if (isDemo) return mockExams;
  if (!teacherId) return [];

  try {
    const { data: dbExams, error } = await supabase
      .from('exams')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching exams from Supabase:', error.message);
      return [];
    }

    if (!dbExams || dbExams.length === 0) {
      return []; // Real user with 0 exams yet
    }

    // Map DB fields to frontend format
    return dbExams.map(e => ({
      id: e.id,
      title: e.title,
      subject: e.subject || 'General',
      grade: e.grade || 'Grade 10',
      dateCreated: e.exam_date || (e.created_at ? e.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
      status: e.status ? (e.status.charAt(0).toUpperCase() + e.status.slice(1)) : 'Draft',
      totalStudents: e.total_students || 0,
      submissionsEvaluated: 0,
      pendingReview: 0,
      avgScore: e.total_marks ? Number(e.total_marks) : null,
      maxScore: e.total_marks || 100,
      avgConfidence: null,
      questions: []
    }));
  } catch (err) {
    console.error('Error in fetchTeacherExams:', err);
    return [];
  }
}

// Create a new exam in Supabase DB
export async function createExamInDB(examData, teacherId) {
  const newExamId = crypto.randomUUID();
  try {
    const { data: examRow, error: examError } = await supabase
      .from('exams')
      .insert({
        id: newExamId,
        teacher_id: teacherId,
        title: examData.title,
        subject: examData.subject,
        total_marks: Number(examData.maxScore) || 100,
        exam_date: examData.dateCreated || new Date().toISOString().split('T')[0],
        status: 'draft'
      })
      .select()
      .single();

    if (examError) {
      console.error('DB Insert Exam Error:', examError.message);
      throw examError;
    }

    // Insert questions & answer_keys if present
    if (examData.questions && examData.questions.length > 0) {
      for (let i = 0; i < examData.questions.length; i++) {
        const q = examData.questions[i];
        const questionId = crypto.randomUUID();

        const { error: qErr } = await supabase.from('questions').insert({
          id: questionId,
          exam_id: newExamId,
          question_number: i + 1,
          question_text: q.text,
          max_marks: Number(q.maxMarks) || 10
        });

        if (!qErr && q.rubric) {
          await supabase.from('answer_keys').insert({
            question_id: questionId,
            model_answer: q.rubric
          });
        }
      }
    }

    return {
      id: newExamId,
      ...examData,
      status: 'Draft',
      submissionsEvaluated: 0,
      pendingReview: 0,
      avgScore: null,
      avgConfidence: null,
    };
  } catch (err) {
    console.error('Error creating exam in DB:', err);
    return {
      id: newExamId,
      ...examData,
      status: 'Draft',
      submissionsEvaluated: 0,
      pendingReview: 0,
      avgScore: null,
      avgConfidence: null,
    };
  }
}

// Upload answer sheet to Supabase Storage & insert record
export async function uploadAnswerSheetDB(examId, file, studentId = null) {
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${examId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('answer-sheets')
      .upload(filePath, file);

    let fileUrl = '';
    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage
        .from('answer-sheets')
        .getPublicUrl(filePath);
      fileUrl = publicUrlData?.publicUrl || '';
    }

    const sheetId = crypto.randomUUID();
    const { data: sheetRow, error: sheetError } = await supabase
      .from('answer_sheets')
      .insert({
        id: sheetId,
        exam_id: examId,
        student_id: studentId,
        file_url: fileUrl,
        upload_status: 'uploaded'
      })
      .select()
      .single();

    return { sheetId, fileUrl, error: sheetError };
  } catch (err) {
    console.error('Error uploading answer sheet:', err);
    return { sheetId: null, fileUrl: null, error: err };
  }
}

// Save or update OCR text for student answers
export async function saveStudentAnswerOCR(answerSheetId, questionId, ocrText, ocrConfidence = 95) {
  try {
    const { data, error } = await supabase
      .from('student_answers')
      .upsert({
        answer_sheet_id: answerSheetId,
        question_id: questionId,
        ocr_text: ocrText,
        ocr_confidence: ocrConfidence
      })
      .select();

    return { data, error };
  } catch (err) {
    console.error('Error saving OCR text:', err);
    return { data: null, error: err };
  }
}

// Save evaluation results (marks & feedback)
export async function saveEvaluationDB(studentAnswerId, marksAwarded, confidenceScore, feedback, needsReview = false) {
  try {
    const { data, error } = await supabase
      .from('evaluations')
      .insert({
        student_answer_id: studentAnswerId,
        marks_awarded: marksAwarded,
        confidence_score: confidenceScore,
        feedback: feedback,
        needs_review: needsReview
      })
      .select();

    return { data, error };
  } catch (err) {
    console.error('Error saving evaluation:', err);
    return { data: null, error: err };
  }
}

// Update teacher profile in Supabase DB
export async function updateTeacherProfile(teacherId, profileData) {
  try {
    const { data, error } = await supabase
      .from('teachers')
      .update(profileData)
      .eq('id', teacherId)
      .select()
      .single();

    return { data, error };
  } catch (err) {
    console.error('Error updating profile:', err);
    return { data: null, error: err };
  }
}
