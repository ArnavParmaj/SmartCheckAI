# SmartCheckAI — Project Progress Report

**Updated:** October 15, 2026  
**Project:** SmartCheckAI — Agentic AI system for automated evaluation of handwritten answer sheets  
**Contributors:** Arnav Parmaj (`arnavparmaj9@gmail.com`), Grishma Vipat (`grishmarvipat@gmail.com`)  
**Git State:** Committed and pushed to `origin/main` (`commit 4c2a305`). Repository: `https://github.com/ArnavParmaj/SmartCheckAI.git`  
**Deployment / Local State:** Operational on local macOS (Python 3.11.15 via `uv` in `backend/venv`, Vite 5 + Node v24). Services running via `./start.sh`.

---

## 1. Executive Summary

SmartCheckAI automates the laborious evaluation of handwritten student answer sheets for faculty and schools. Teachers set up an exam once by uploading the **question paper**, **marking rubric**, and typed **answer key**. The platform parses the key, maps rubric criteria to conceptual key points, and allows teacher verification. 

Student answer sheets are then uploaded in bulk, transcribed using a **Gemini Vision + RapidOCR** hybrid engine, evaluated **criterion-by-criterion** via local embeddings (`sentence-transformers/all-MiniLM-L6-v2`) and Gemini AI second-opinion scoring, and scored with confidence metrics. Low-confidence or discrepant answers are automatically routed to a teacher **Review Queue**.

**Overall Project Completion: ~98%**  
- All planned frontend screens, backend endpoints, and multi-agent pipelines are implemented.
- All 4 database migrations are verified live on the Supabase PostgreSQL cluster.
- Full local developer environment (Node.js + Python 3.11 virtualenv with 123 packages) is verified and operational.

| Area | Status | Completion | Details |
| :--- | :---: | :---: | :--- |
| **Frontend Screens** | ✅ Active | 98% | Exam setup wizard, Answer Key & Knowledge review, Evaluate Papers, Evaluation Report, Review Queue, Class Analysis, Gradebook Export. |
| **OCR Pipeline** | ✅ Active | 95% | Gemini Vision with RapidOCR fallback; sub-question bifurcation; per-answer confidence scoring. |
| **Answer Key & Knowledge Base** | ✅ Active | 95% | PDF/DOCX/TXT extraction, regex/rule-based question splitter, rubric criterion mapping, teacher review/edit. |
| **Evaluation Agent** | ✅ Active | 90% | Hybrid criterion-wise scorer (local embeddings 60% coverage + 40% similarity; Gemini second-opinion; confidence thresholds). |
| **Concept Agent** | ✅ Active | 95% | Key points extraction from model answers; KeyBERT fallback. |
| **Feedback Agent** | ✅ Active | 90% | Criterion-wise justification generator ("Covered X, Missing Y") and student-facing actionable advice. |
| **Database & Storage** | ✅ Live | 100% | Supabase Postgres + Storage bucket (`answer-sheets`); all 4 schema migrations executed and confirmed live. |

---

## 2. Architecture & Workflow

### 2.1 Exam Setup (Faculty, Once per Exam)
1. **Exam Details:** Title, subject, grade level, total marks.
2. **Questions & Rubric:** Question papers parsed into questions and sub-questions (`Q1(a)`, `Q1(b)`...) with individual marks; rubric rows mapped as marking criteria.
3. **Answer Key Ingestion:** Accepts typed PDF, Word (`.docx`), plain text (`.txt`), or direct text. Rule-based question splitter isolates per-question model answers (Gemini fallback for ambiguous formats).
4. **Knowledge Base Review:** Interactive visual editor where faculty review model answers, criteria weights, and extracted key points. Edits persist to `answer_keys.rubric_criteria` (jsonb).

### 2.2 Paper Evaluation Pipeline
1. **Bulk Upload:** Batch ingestion of multi-page student answer sheets (PDF/JPG/PNG).
2. **OCR Transcription:** Gemini Vision extracts handwritten text labeled by question identifiers, backed by RapidOCR fallback.
3. **Hybrid Grading:**
   - **Local Concept Coverage:** `sentence-transformers/all-MiniLM-L6-v2` compares answer key points against student sentences (≥0.60 covered, ≥0.45 partially covered).
   - **Semantic Similarity:** Evaluates alignment between student sentences and rubric criteria.
   - **Local Baseline:** 60% concept coverage + 40% semantic similarity.
   - **Gemini Second Opinion (Optional/Cloud):** Batched sheet-level call generates independent criterion grades. Final mark is averaged between local and Gemini.
   - **Confidence Scoring:** Combines OCR confidence with local-Gemini agreement. Flagged for review if confidence < 0.75 or mark discrepancy > 30%.
4. **Automated Feedback:** Generates explicit reasons for marks gained or deducted per rubric item.

### 2.3 Post-Evaluation & Review
- **Evaluation Report:** Student-by-student report cards showing handwritten transcription alongside model answers, criterion breakdown, feedback, and original image viewer.
- **Review Queue:** Isolated queue containing only low-confidence or high-discrepancy answers for rapid human-in-the-loop sign-off.
- **Class Analysis:** Aggregate statistics, score distribution, and frequently missed key points (e.g., *"64% of students missed Veracity"*).
- **Export & Audit:** CSV/PDF gradebook download; persistent audit log of all teacher score overrides and approvals (`audit_events` table).

---

## 3. Implementation Status by Component

### AI Agents (`agents/`)
- `agents/ocr_agent/`: Gemini Vision (`gemini-3.5-flash`), preprocessing, RapidOCR ONNX fallback, sub-question segmentation.
- `agents/concept_agent/`: `answer_key.py` (multi-format document parser), `knowledge_builder.py` (rubric criteria matcher), `concept_extractor.py` (KeyBERT).
- `agents/evaluation_agent/`: `scorer.py` (hybrid engine), `concept_matcher.py` (cosine embedding similarity), `semantic_matcher.py`, `confidence.py`.
- `agents/feedback_agent/`: `feedback_generator.py` (template and LLM-assisted feedback synthesis).

### FastAPI Backend (`backend/`)
- `main.py`: CORS-enabled FastAPI server with Uvicorn worker.
- `routes/ocr_routes.py`: Endpoints for single/multi-page image & PDF OCR.
- `routes/knowledge_routes.py`: `/knowledge/build` and `/knowledge/rebuild` endpoints.
- `routes/evaluation_routes.py`: Sheet-level `/evaluation/evaluate` endpoint.
- `routes/concept_routes.py` & `routes/feedback_routes.py`: Specialized micro-endpoints.

### Frontend Application (`src/`)
- **New Views:** `AnswerKeyStep.jsx`, `KnowledgeReviewStep.jsx`, `EvaluatePapersView.jsx`, `ReviewQueueView.jsx`, `ClassAnalysisView.jsx`, `CriteriaEditor.jsx`.
- **Shared Helpers:** `src/lib/pipeline.js` (orchestrated end-to-end evaluation flow), `src/lib/grading.js` (local grading calculations and formatting), `src/lib/exportResults.js` (CSV and print report formatting).
- **State & Context:** `AppContext.jsx` managing live Supabase mode vs. in-memory demo fixtures, persistent dark mode, and audit logging.

---

## 4. Database Migrations Status

All 4 migrations located in [`backend/migrations/`](file:///Users/arnavparmaj/Desktop/arnav%20project/SmartCheckAI/backend/migrations/) have been executed in Supabase and verified programmatically via direct client queries:

| Migration | Target | Description | Verification |
| :--- | :--- | :--- | :---: |
| `001_add_question_label.sql` | `public.questions` | Adds `label text` for sub-questions (`Q1(a)`, `Q1(b)`) | ✅ Verified |
| `002_add_answer_sheet_student_fields.sql` | `public.answer_sheets` | Adds `student_name text` and `roll_number text` | ✅ Verified |
| `003_create_audit_events.sql` | `public.audit_events` | Creates audit trail table with Row-Level Security (RLS) | ✅ Verified |
| `004_add_answer_key_knowledge.sql` | `public.answer_keys` | Adds `rubric_criteria jsonb` for reviewed knowledge bases | ✅ Verified |

---

## 5. Local Setup & Operational State

The development environment is configured and running on macOS (Apple Silicon arm64):
- **Python:** Python 3.11.15 managed by `uv` at `backend/venv`.
- **Backend Dependencies:** 123 packages installed (`fastapi`, `uvicorn`, `sentence-transformers`, `torch`, `rapidocr-onnxruntime`, `paddleocr`, `keybert`, `spacy`, `pymupdf`, `python-docx`, etc.).
- **Node.js:** v24.19.0, npm v11.17.0. `node_modules` approved (`esbuild`, `fsevents`) and verified.
- **Service Orchestration:**
  - `./start.sh` launches FastAPI on `http://127.0.0.1:8000` and Vite on `http://localhost:5173`.
  - `./stop.sh` cleanly terminates background processes.
- **Git:** All work committed and pushed to GitHub `origin/main` (`commit 4c2a305`).

---

## 6. Next Steps & Recommendations

1. **Model Calibration on Real Handwritten Papers:**
   - Test 15–20 real graded papers against human evaluator scores to fine-tune similarity thresholds (currently 0.60 / 0.45) and concept weightings.
2. **Gemini API Key Allocation:**
   - Free tier quotas (20 requests/day) limit evaluation at scale. A standard paid Gemini API key is recommended for grading full classroom sets (approx. 2 calls per student paper).
3. **End-to-End Browser Walkthrough:**
   - Complete an exam creation cycle in the browser UI, upload answer sheets, verify review queue items, and export final grade reports.
