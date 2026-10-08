/**
 * backendApi.js
 * Centralized API client for communicating with the SmartCheck AI FastAPI backend (port 8000).
 */

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/**
 * Check if the FastAPI backend service is alive and healthy.
 * @returns {Promise<{status: string}>}
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error('Backend health check error:', err);
    throw err;
  }
}

/**
 * Send an uploaded answer sheet file (PDF or Image) to the OCR processing pipeline.
 * @param {File} file - The uploaded image or PDF file.
 * @param {string} [answerSheetId] - Optional Supabase answer_sheet UUID.
 * @returns {Promise<{status: string, ocr_confidence?: number, answers?: Record<string, string>, message?: string}>}
 */
export async function processAnswerSheetOCR(file, answerSheetId = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (answerSheetId) {
    formData.append('answer_sheet_id', answerSheetId);
  }

  const res = await fetch(`${BACKEND_BASE_URL}/ocr/process`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OCR processing failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Extract structured questions and marks from a Question Paper file.
 * @param {File} file - The uploaded image or PDF file.
 * @returns {Promise<{status: string, engine: string, questions: Array<{id: string, text: string, marks: number, condition?: string}>}>}
 */
export async function extractQuestionsFromFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BACKEND_BASE_URL}/ocr/extract-questions`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Question extraction failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Extract structured grading criteria from a Marking Rubric file.
 * @param {File} file - The uploaded image or PDF file.
 * @returns {Promise<{status: string, engine: string, rubrics: Array<{question_id: string, criterion: string, max_marks: number, description: string}>}>}
 */
export async function extractRubricFromFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BACKEND_BASE_URL}/ocr/extract-rubric`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Rubric extraction failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Extract key concepts and entities from question rubrics or model answers.
 * @param {Object} payload - { question_text, rubric_text, model_answer }
 * @returns {Promise<any>}
 */
export async function extractConcepts(payload) {
  const res = await fetch(`${BACKEND_BASE_URL}/concepts/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Concept extraction failed: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Evaluate student answers against answer keys and scoring rubrics.
 * @param {Object} payload - { answers, answer_keys, exam_id }
 * @returns {Promise<any>}
 */
export async function evaluateAnswers(payload) {
  const res = await fetch(`${BACKEND_BASE_URL}/evaluation/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Evaluation failed: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Generate targeted feedback for student answers based on evaluation scores.
 * @param {Object} payload - { evaluation_id, student_answer_id }
 * @returns {Promise<any>}
 */
export async function generateFeedback(payload) {
  const res = await fetch(`${BACKEND_BASE_URL}/feedback/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Feedback generation failed: ${res.statusText}`);
  }
  return await res.json();
}

export default {
  checkBackendHealth,
  processAnswerSheetOCR,
  extractConcepts,
  evaluateAnswers,
  generateFeedback,
};
