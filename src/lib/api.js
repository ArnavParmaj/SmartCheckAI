import { supabase } from './supabaseClient';
import { mockExams } from '../data/mockData';
import { decodeEvaluation, summarizeSubmission } from './grading';

// Fetch exams for current teacher from Supabase DB
export async function fetchTeacherExams(teacherId, isDemo = false) {
  if (isDemo) return mockExams;
  if (!teacherId) return [];

  try {
    const { data: dbExams, error } = await supabase
      .from('exams')
      .select('*, questions(*, answer_keys(*))')
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
      avgScore: null,
      maxScore: e.total_marks || 100,
      avgConfidence: null,
      questions: (e.questions || [])
        .sort((a, b) => a.question_number - b.question_number)
        .map(q => ({
          id: q.id,
          // label column comes from backend/migrations/001_add_question_label.sql
          label: q.label || `Q${q.question_number}`,
          text: q.question_text,
          maxMarks: q.max_marks,
          modelAnswer: q.answer_keys?.[0]?.model_answer || '',
          criteria: q.answer_keys?.[0]?.rubric_criteria?.criteria || [],
          concepts: q.answer_keys?.[0]?.rubric_criteria?.concepts || [],
        }))
    }));
  } catch (err) {
    console.error('Error in fetchTeacherExams:', err);
    return [];
  }
}

// Fetch saved answer sheets (with OCR text and latest evaluation) for the given exams
export async function fetchTeacherSubmissions(exams) {
  if (!exams || exams.length === 0) return [];

  try {
    const { data: sheets, error } = await supabase
      .from('answer_sheets')
      .select('*, student_answers(*, evaluations(*))')
      .in('exam_id', exams.map(e => e.id))
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching answer sheets:', error.message);
      return [];
    }

    return (sheets || []).map((sheet, idx) => {
      const exam = exams.find(e => e.id === sheet.exam_id);
      const examQuestions = exam?.questions || [];

      const answers = (sheet.student_answers || [])
        .map(sa => {
          const q = examQuestions.find(eq => eq.id === sa.question_id);
          // Newest first; the latest AI row is the grade, the latest teacher row an override
          const evals = (sa.evaluations || [])
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map(row => ({ row, ...decodeEvaluation(row) }));
          const aiEval = evals.find(e => e.source === 'ai');
          const teacherEval = evals.find(e => e.source === 'teacher');
          return {
            questionId: sa.question_id,
            studentAnswerId: sa.id,
            questionNum: examQuestions.indexOf(q) + 1,
            questionLabel: q?.label || 'Q?',
            questionText: q?.text || '',
            maxMarks: Number(q?.maxMarks) || 5,
            ocrText: sa.ocr_text || '',
            ocrConfidence: sa.ocr_confidence ?? null,
            aiScore: aiEval ? Number(aiEval.row.marks_awarded) : null,
            aiConfidence: aiEval ? Number(aiEval.row.confidence_score) : 0,
            aiRationale: aiEval?.rationale || '',
            aiFeedback: aiEval?.feedback || '',
            conceptsMissed: aiEval?.conceptsMissed || [],
            aiCriteria: aiEval?.criteria || [],
            needsReview: aiEval ? Boolean(aiEval.row.needs_review) : false,
            teacherScore: teacherEval ? Number(teacherEval.row.marks_awarded) : null,
            teacherNote: teacherEval?.note || '',
            isOverridden: Boolean(teacherEval),
          };
        })
        .sort((a, b) => a.questionNum - b.questionNum);

      const ocrScores = answers.filter(a => a.ocrConfidence !== null).map(a => a.ocrConfidence);
      const ocrAccuracy = ocrScores.length
        ? Math.round((ocrScores.reduce((sum, c) => sum + c, 0) / ocrScores.length) * 100)
        : 0;
      // Older sheets have no student_name column value; the storage path is
      // "<examId>/<timestamp>_<original name>", so recover the name from it
      const fileName = decodeURIComponent(sheet.file_url?.split('/').pop() || '');
      const nameFromFile = fileName.replace(/^\d+_/, '').replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

      return summarizeSubmission({
        id: sheet.id,
        answerSheetId: sheet.id,
        examId: sheet.exam_id,
        studentName: sheet.student_name || nameFromFile || `Student ${idx + 1}`,
        rollNumber: sheet.roll_number || `ROLL-${101 + idx}`,
        submittedAt: sheet.created_at,
        ocrAccuracy,
        teacherApproved: sheet.upload_status === 'approved',
        fileUrl: sheet.file_url,
        imagePreview: sheet.file_url,
        answers,
      });
    });
  } catch (err) {
    console.error('Error in fetchTeacherSubmissions:', err);
    return [];
  }
}

// Create a new exam in Supabase DB
export async function createExamInDB(examData, teacherId) {
  const newExamId = crypto.randomUUID();
  try {
    const { error: examError } = await supabase
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

    // Insert questions & answer_keys if present.
    // Saved questions carry their DB id so answers can reference them;
    // the label (e.g. "Q1(b)") is kept in memory since the table has no label column.
    const savedQuestions = [];
    let knowledgeNotSaved = false;
    if (examData.questions && examData.questions.length > 0) {
      for (let i = 0; i < examData.questions.length; i++) {
        const q = examData.questions[i];
        const questionId = crypto.randomUUID();

        const questionRow = {
          id: questionId,
          exam_id: newExamId,
          question_number: i + 1,
          question_text: q.text,
          max_marks: Number(q.maxMarks) || 10
        };

        let { error: qErr } = await supabase.from('questions').insert({ ...questionRow, label: q.label });
        // PGRST204: label column missing (migration 001 not applied yet) - save without it
        if (qErr?.code === 'PGRST204') {
          ({ error: qErr } = await supabase.from('questions').insert(questionRow));
        }

        if (qErr) {
          console.error('DB Insert Question Error:', qErr.message);
          savedQuestions.push(q);
          continue;
        }
        savedQuestions.push({ ...q, id: questionId });

        // Knowledge base: faculty model answer + rubric criteria with their key points
        if (q.modelAnswer || q.criteria?.length) {
          const keyRow = { question_id: questionId, model_answer: q.modelAnswer || '' };
          let { error: keyErr } = await supabase.from('answer_keys').insert({
            ...keyRow,
            rubric_criteria: { criteria: q.criteria || [], concepts: q.concepts || [] }
          });
          // PGRST204: rubric_criteria column missing (migration 004 not applied yet);
          // keep the model answer, criteria are rebuilt from it at grading time
          if (keyErr?.code === 'PGRST204') {
            knowledgeNotSaved = true;
            ({ error: keyErr } = await supabase.from('answer_keys').insert(keyRow));
          }
          if (keyErr) console.error('DB Insert Answer Key Error:', keyErr.message);
        }
      }
    }

    return {
      id: newExamId,
      ...examData,
      questions: savedQuestions,
      knowledgeNotSaved,
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
export async function uploadAnswerSheetDB(examId, file, { studentName = null, rollNumber = null } = {}) {
  try {
    // Keep the original file name in the path so the student name survives a reload
    const safeName = file.name.replace(/[^\w.-]+/g, '_');
    const filePath = `${examId}/${Date.now()}_${safeName}`;

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
    const sheetRow = {
      id: sheetId,
      exam_id: examId,
      file_url: fileUrl,
      upload_status: 'uploaded'
    };

    let { error: sheetError } = await supabase
      .from('answer_sheets')
      .insert({ ...sheetRow, student_name: studentName, roll_number: rollNumber });
    // PGRST204: student_name / roll_number columns missing (migration 002 not applied yet)
    if (sheetError?.code === 'PGRST204') {
      ({ error: sheetError } = await supabase.from('answer_sheets').insert(sheetRow));
    }

    return { sheetId, fileUrl, error: sheetError };
  } catch (err) {
    console.error('Error uploading answer sheet:', err);
    return { sheetId: null, fileUrl: null, error: err };
  }
}

// Mark an answer sheet as approved by the teacher (stored in upload_status)
export async function approveAnswerSheetDB(answerSheetId) {
  const { error } = await supabase
    .from('answer_sheets')
    .update({ upload_status: 'approved' })
    .eq('id', answerSheetId);
  if (error) console.error('DB Approve Answer Sheet Error:', error.message);
  return { error };
}

// Save OCR text for a student answer: updates the existing row when
// studentAnswerId is given, otherwise inserts a new one
export async function saveStudentAnswerOCR(answerSheetId, questionId, ocrText, ocrConfidence = null, studentAnswerId = null) {
  try {
    const query = studentAnswerId
      ? supabase
          .from('student_answers')
          .update({ ocr_text: ocrText })
          .eq('id', studentAnswerId)
      : supabase
          .from('student_answers')
          .insert({
            answer_sheet_id: answerSheetId,
            question_id: questionId,
            ocr_text: ocrText,
            ocr_confidence: ocrConfidence
          });

    const { data, error } = await query.select().single();
    if (error) console.error('DB Save Student Answer Error:', error.message);

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

// Delete exam and all cascaded questions, answer sheets, answers and evaluations
export async function deleteExamFromDB(examId) {
  try {
    // 1. Find all question IDs for this exam
    const { data: qRows } = await supabase
      .from('questions')
      .select('id')
      .eq('exam_id', examId);

    const questionIds = (qRows || []).map(q => q.id);

    // Delete answer_keys for these questions
    if (questionIds.length > 0) {
      await supabase
        .from('answer_keys')
        .delete()
        .in('question_id', questionIds);
    }

    // 2. Find all answer_sheets for this exam
    const { data: sheetRows } = await supabase
      .from('answer_sheets')
      .select('id')
      .eq('exam_id', examId);

    const sheetIds = (sheetRows || []).map(s => s.id);

    if (sheetIds.length > 0) {
      // Delete student_answers
      await supabase
        .from('student_answers')
        .delete()
        .in('answer_sheet_id', sheetIds);

      // Delete evaluations
      await supabase
        .from('evaluations')
        .delete()
        .in('answer_sheet_id', sheetIds);

      // Delete answer_sheets
      await supabase
        .from('answer_sheets')
        .delete()
        .eq('exam_id', examId);
    }

    // 3. Delete questions
    await supabase
      .from('questions')
      .delete()
      .eq('exam_id', examId);

    // 4. Delete exam
    const { error: examDelErr } = await supabase
      .from('exams')
      .delete()
      .eq('id', examId);

    if (examDelErr) {
      console.error('Error deleting exam:', examDelErr);
      throw examDelErr;
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to delete exam from DB:', err);
    throw err;
  }
}

// Audit trail (table from backend/migrations/003_create_audit_events.sql).
// If the table doesn't exist yet, events still show for the session but aren't kept.
export async function fetchAuditEvents(teacherId) {
  const { data, error } = await supabase
    .from('audit_events')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('Audit events not loaded:', error.message);
    return [];
  }
  return data.map(row => ({
    id: row.id,
    timestamp: row.created_at,
    event: row.event,
    actor: row.actor,
    actorType: row.actor_type,
    examId: row.exam_id,
    examTitle: row.exam_title,
    detail: row.detail,
    severity: row.severity,
  }));
}

export async function saveAuditEvent(teacherId, event) {
  const { error } = await supabase.from('audit_events').insert({
    teacher_id: teacherId,
    exam_id: event.examId || null,
    exam_title: event.examTitle || null,
    event: event.event,
    detail: event.detail || null,
    actor: event.actor || null,
    actor_type: event.actorType || 'teacher',
    severity: event.severity || 'info',
  });
  if (error) console.warn('Audit event not saved:', error.message);
}
