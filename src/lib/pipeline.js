import { processAnswerSheetOCR } from './backendApi';
import { uploadAnswerSheetDB, saveStudentAnswerOCR, saveEvaluationDB } from './api';
import { gradeAnswers, summarizeSubmission, encodeEvaluation } from './grading';

const normaliseLabel = (label) => String(label || '').replace(/\s+/g, '').toUpperCase();

// Upload -> OCR -> save answers -> grade -> save grades, for one student's answer sheet.
// onStage(text) reports progress. Returns the finished submission.
export async function processAnswerSheet(exam, fileItem, { isDemo, onStage = () => {} }) {
  const examQuestions = exam.questions || [];
  const studentName = fileItem.studentName?.trim() || fileItem.name.replace(/\.[^/.]+$/, '');
  const rollNumber = fileItem.rollNumber?.trim() || '';
  const warnings = [];

  let sheetId = null;
  if (!isDemo) {
    onStage('Uploading');
    const uploadRes = await uploadAnswerSheetDB(exam.id, fileItem.file, { studentName, rollNumber });
    if (uploadRes.error) warnings.push('Not saved to the database');
    else sheetId = uploadRes.sheetId;
  }

  onStage('Reading handwriting');
  let ocrRes = null;
  try {
    ocrRes = await processAnswerSheetOCR(fileItem.file, null, examQuestions.map(q => q.label));
  } catch (err) {
    warnings.push(`OCR failed: ${err.message}`);
  }
  const rawAnswers = ocrRes?.answers || {};
  const answerConfidences = ocrRes?.answer_confidences || {};
  const overallOcr = ocrRes?.ocr_confidence ?? null;

  // One answer per exam question, matched by label; questions the student skipped stay empty
  const byLabel = Object.fromEntries(Object.entries(rawAnswers).map(([k, v]) => [normaliseLabel(k), [k, v]]));
  let answers = examQuestions.map((q, idx) => {
    const [ocrLabel, text] = byLabel[normaliseLabel(q.label)] || [null, ''];
    return {
      questionId: q.id,
      questionNum: idx + 1,
      questionLabel: q.label || `Q${idx + 1}`,
      questionText: q.text,
      maxMarks: Number(q.maxMarks) || 5,
      ocrText: text,
      ocrConfidence: ocrLabel ? (answerConfidences[ocrLabel] ?? overallOcr) : null,
      aiConfidence: 0,
      aiScore: null,
      teacherScore: null,
    };
  });
  const unmatched = Object.keys(rawAnswers).filter(k => !examQuestions.some(q => normaliseLabel(q.label) === normaliseLabel(k)));
  if (unmatched.length) warnings.push(`Answers not matched to any question: ${unmatched.join(', ')}`);

  if (sheetId) {
    onStage('Saving answers');
    for (const ans of answers) {
      const { data } = await saveStudentAnswerOCR(sheetId, ans.questionId, ans.ocrText, ans.ocrConfidence);
      if (data) ans.studentAnswerId = data.id;
    }
  }

  onStage('Grading');
  try {
    answers = await gradeAnswers(answers, examQuestions);
    if (sheetId) {
      for (const ans of answers) {
        if (!ans.studentAnswerId || ans.aiScore === null) continue;
        await saveEvaluationDB(ans.studentAnswerId, ans.aiScore, ans.aiConfidence, encodeEvaluation('ai', {
          rationale: ans.aiRationale,
          feedback: ans.aiFeedback,
          conceptsMissed: ans.conceptsMissed,
          criteria: ans.aiCriteria,
        }), ans.needsReview);
      }
    }
  } catch (err) {
    warnings.push(`Grading failed: ${err.message}`);
  }

  return {
    submission: summarizeSubmission({
      id: sheetId || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      answerSheetId: sheetId,
      examId: exam.id,
      studentName,
      rollNumber: rollNumber || '—',
      submittedAt: new Date().toISOString(),
      ocrAccuracy: overallOcr !== null ? Math.round(overallOcr * 100) : 0,
      teacherApproved: false,
      fileUrl: fileItem.preview,
      imagePreview: fileItem.preview,
      answers,
    }),
    warnings,
  };
}
