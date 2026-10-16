/**
 * backendApi.js
 * Centralized API client for communicating with the SmartCheck AI FastAPI backend (port 8000).
 */

import { supabase } from './supabaseClient';

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// The backend accepts requests only from a signed-in user: send the Supabase access token
async function authHeaders(extra = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

// fetch() to the backend with the login token attached
async function backendFetch(path, options = {}) {
  return fetch(`${BACKEND_BASE_URL}${path}`, { ...options, headers: await authHeaders(options.headers) });
}

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
export async function processAnswerSheetOCR(file, answerSheetId = null, questionLabels = null, jobId = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (jobId) formData.append('job_id', jobId);
  if (questionLabels?.length) {
    formData.append('question_labels', JSON.stringify(questionLabels));
  }
  if (answerSheetId) {
    formData.append('answer_sheet_id', answerSheetId);
  }

  const res = await backendFetch(`/ocr/process`, {
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
 * What a running OCR or grading request (sent with this job id) is doing right now.
 * @returns {Promise<{detail: string, stage: string, page?: number, pages?: number}>}
 */
export async function getJobProgress(jobId) {
  const res = await backendFetch(`/progress/${encodeURIComponent(jobId)}`);
  if (!res.ok) throw new Error(`Progress check failed (${res.status})`);
  return await res.json();
}

/**
 * The local AI engine: whether Ollama is reachable and the model is loaded.
 * @returns {Promise<{ollama: boolean, loaded: boolean, model: string, providers: string[]}>}
 */
export async function getEngineStatus() {
  const res = await backendFetch(`/engine-status`);
  if (!res.ok) throw new Error(`Engine status failed (${res.status})`);
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

  const res = await backendFetch(`/ocr/extract-questions`, {
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

  const res = await backendFetch(`/ocr/extract-rubric`, {
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
  const res = await backendFetch(`/concepts/extract`, {
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
  const res = await backendFetch(`/evaluation/evaluate`, {
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
  const res = await backendFetch(`/feedback/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Feedback generation failed: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Build the per-question knowledge base from the faculty answer key.
 * @param {Array} questions - [{ label, text, max_marks, criteria }]
 * @param {{ file?: File, text?: string }} answerKey - typed file (.pdf/.docx/.txt) or pasted text
 */
export async function buildKnowledge(questions, { file = null, text = '' } = {}) {
  const formData = new FormData();
  formData.append('questions', JSON.stringify(questions));
  if (file) formData.append('file', file);
  if (text) formData.append('answer_key_text', text);

  const res = await backendFetch(`/knowledge/build`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Answer key processing failed (${res.status})`);
  return await res.json();
}

/**
 * Rebuild one question's knowledge after the faculty edits it.
 * @param {Object} question - { label, text, max_marks, criteria, model_answer }
 */
export async function rebuildKnowledge(question) {
  const res = await backendFetch(`/knowledge/rebuild`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(question),
  });
  if (!res.ok) throw new Error(`Rebuilding knowledge failed (${res.status})`);
  return await res.json();
}

export default {
  checkBackendHealth,
  processAnswerSheetOCR,
  extractConcepts,
  evaluateAnswers,
  generateFeedback,
  buildKnowledge,
  rebuildKnowledge,
};
