import { evaluateAnswers } from './backendApi';

// The evaluations table has a single free-text `feedback` column, so each row stores a
// small JSON envelope that records whether the AI or the teacher wrote it.
export function encodeEvaluation(source, fields) {
  return JSON.stringify({ source, ...fields });
}

export function decodeEvaluation(row) {
  try {
    const parsed = JSON.parse(row.feedback);
    if (parsed && parsed.source) return parsed;
  } catch {
    // Rows saved before this format are plain teacher notes
  }
  return { source: 'teacher', note: row.feedback || '' };
}

// Grade every answer of a submission on the backend (local models + optional Gemini).
// Returns a new answers array with AI results filled in.
export async function gradeAnswers(answers, examQuestions) {
  const payload = {
    answers: answers.map(ans => {
      const q = examQuestions.find(eq => eq.id === ans.questionId);
      return {
        question_id: ans.questionId,
        question_text: ans.questionText || q?.text || '',
        model_answer: q?.modelAnswer || q?.rubric || '',
        criteria: q?.criteria || [],
        rules: (q?.rules || []).filter(r => r.trim()),
        student_answer: ans.ocrText || '',
        max_marks: Number(ans.maxMarks) || 5,
        ocr_confidence: ans.ocrConfidence ?? null,
      };
    }),
  };

  const res = await evaluateAnswers(payload);
  const byId = Object.fromEntries((res?.results || []).map(r => [r.question_id, r]));

  return answers.map(ans => {
    const r = byId[ans.questionId];
    if (!r) return ans;
    return {
      ...ans,
      aiScore: r.marks_awarded,
      aiConfidence: Math.round(r.confidence * 100),
      aiRationale: r.rationale,
      aiFeedback: r.feedback,
      conceptsMissed: r.concepts_missed || [],
      aiCriteria: r.criteria || [],
      deduction: r.deduction || 0,
      deductionReason: r.deduction_reason || '',
      needsReview: r.needs_review,
      gradingEngine: r.engine,
    };
  });
}

// OCR confidence below this marks an answer as hard to read
export const LOW_OCR_CONFIDENCE = 0.8;

// An answer goes to the review queue when the grader was unsure or the handwriting
// was hard to read, until faculty set or accept its mark
export function needsFacultyReview(ans) {
  if (ans.aiScore === null || ans.aiScore === undefined) return false;
  if (ans.teacherScore !== null && ans.teacherScore !== undefined) return false;
  const hardToRead = ans.ocrConfidence !== null && ans.ocrConfidence !== undefined && ans.ocrConfidence < LOW_OCR_CONFIDENCE;
  return Boolean(ans.needsReview) || (hardToRead && Boolean(ans.ocrText?.trim()));
}

// Short name for an answer-key point: the term before ':' if there is one, else its first words
// (mirrors concept_label in agents/concept_agent/concept_extractor.py)
export function pointLabel(point) {
  const text = String(point).trim().replace(/^(and|or|also|the)\s+/i, '');
  const m = text.match(/^(.{2,60}?)\s*(?::|\u2014|\u2013|\s-\s)/);
  if (m && m[1].trim().split(/\s+/).length <= 5) return m[1].trim();
  const words = text.split(/\s+/);
  return words.slice(0, 6).join(' ') + (words.length > 6 ? '…' : '');
}

// Recompute a submission's totals and status from its answers
export function summarizeSubmission(sub) {
  const answers = sub.answers || [];
  const graded = answers.filter(a => a.aiScore !== null && a.aiScore !== undefined);
  const maxScore = answers.reduce((sum, a) => sum + (Number(a.maxMarks) || 0), 0);
  const aiTotal = graded.reduce((sum, a) => sum + a.aiScore, 0);
  const finalTotal = answers.reduce(
    (sum, a) => sum + (a.teacherScore !== null && a.teacherScore !== undefined ? a.teacherScore : (a.aiScore || 0)),
    0
  );
  const aiConfidence = graded.length
    ? Math.round(graded.reduce((sum, a) => sum + (a.aiConfidence || 0), 0) / graded.length)
    : 0;

  let status = 'OCR Completed';
  if (sub.teacherApproved) status = 'Approved';
  else if (graded.some(needsFacultyReview)) status = 'Needs Review';
  else if (graded.length) status = 'Evaluated';

  return {
    ...sub,
    aiScore: graded.length ? aiTotal : null,
    totalScore: finalTotal,
    maxScore,
    percentage: maxScore ? Math.round((finalTotal / maxScore) * 100) : 0,
    aiConfidence,
    status,
  };
}

// Exam-level stats derived from its submissions
export function examStats(exam, submissions) {
  const subs = submissions.filter(s => s.examId === exam.id);
  const graded = subs.filter(s => s.aiScore !== null && s.aiScore !== undefined);
  if (graded.length === 0) {
    return { ...exam, submissionsEvaluated: 0, pendingReview: 0, avgScore: null, avgConfidence: null };
  }
  const allApproved = subs.length > 0 && subs.every(s => s.teacherApproved);
  return {
    ...exam,
    totalStudents: Math.max(Number(exam.totalStudents) || 0, subs.length),
    submissionsEvaluated: graded.length,
    pendingReview: subs.filter(s => !s.teacherApproved).length,
    avgScore: Math.round(graded.reduce((sum, s) => sum + s.percentage, 0) / graded.length),
    avgConfidence: Math.round(graded.reduce((sum, s) => sum + s.aiConfidence, 0) / graded.length),
    status: allApproved ? 'Completed' : 'Needs Review',
  };
}
