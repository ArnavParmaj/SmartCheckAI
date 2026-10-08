# SmartCheckAI — Project Progress Report

**Generated Date:** October 8, 2026  
**Project:** SmartCheckAI — Agentic AI System for Automated Handwritten Answer Evaluation  
**Repository Path:** `/Users/arnavparmaj/Projects/SmartCheck AI`  
**Primary Author / Contributor:** Arnav Parmaj (`arnavparmaj9@gmail.com`)  
**Git Branch:** `main` (Latest commit: `768b53b` pushed to `origin/main`)

---

## 1. Project Overview

- **One-Line Project Summary:** SmartCheckAI is an agentic AI-assisted exam evaluation platform that digitizes handwritten student answer sheets using hybrid OCR (Gemini 2.5 Flash + RapidOCR/PaddleOCR), performs rubric- and concept-driven semantic grading, and provides a teacher-in-the-loop verification and override workflow.
- **Current Development Phase:** **Phase 2 Complete / Entering Phase 3: Semantic Evaluation & Concept Matching** (OCR ingestion pipeline, question paper parsing, rubric extraction, frontend-backend REST bridge, exam management, and error boundary are fully operational).
- **Overall Completion Percentage:** **~68%** (Weighted across modules: Frontend UI ~95%, OCR Agent ~95%, Frontend-Backend Integration ~80%, Database & Storage ~70%, Concept Agent ~15%, Evaluation/Scoring Agent ~15%, Feedback Agent ~15%).

### Subsystem Progress Gauges
| Subsystem | Completion % | Current State |
| :--- | :--- | :--- |
| **Frontend & UI Views** | 95% | 11 comprehensive views implemented, dual-mode (Mock Demo vs Live Supabase), ErrorBoundary added, Exam Deletion added |
| **OCR Agent Engine** | 95% | Hybrid pipeline active: Gemini 2.5 Flash Vision + RapidOCR/PaddleOCR, sub-question bifurcation (`Q1(a)`, `Q1(b)`), preprocessing & deskewing |
| **Frontend-Backend Integration** | 80% | `src/lib/backendApi.js` connected to FastAPI (`:8000`), endpoints for question extraction, rubric parsing, and answer sheet OCR fully wired to UI |
| **Database & Cloud Storage** | 70% | Supabase credentials active in `backend/.env`, cascade deletion implemented, `answer-sheets` storage bucket configured |
| **Knowledge & Concept Agent** | 15% | Architecture and routing stubs established; next in line for KeyBERT + spaCy implementation |
| **Evaluation & Scoring Agent** | 15% | Architecture and routing stubs established; next in line for sentence-transformers similarity & rubric scorer |
| **Feedback Agent** | 15% | Module files and docstring stubs created; `/feedback/generate` placeholder |

---

## 2. Module Status

### 2.1 OCR Agent (`agents/ocr_agent/`, `backend/routes/ocr_routes.py`)
- **Status:** ✅ **Operational / Hybrid Active**
- **Responsible Owner:** Arnav Parmaj
- **Implemented:**
  - ✅ **Gemini Vision Hybrid OCR (`gemini_ocr.py`):** Multimodal OCR leveraging Google Generative AI (`gemini-2.5-flash`) with structured JSON schema output, auto-prompting for question paper ingestion, rubric extraction, and student answer sheet transcription with handwriting resilience.
  - ✅ **Sub-Question Bifurcation & Labeling (`segmentation.py`):** Automatically extracts and categorizes nested sub-questions (e.g., `Q1(a)`, `Q1(b)`, `1(i)`, `1.2`), marks allocation, and conditional branch badges (`[OR]`, `[AND]`).
  - ✅ **Local OCR Engine & Fallback (`ocr.py`):** RapidOCR (ONNX runtime) and PaddleOCR fallback for offline/CPU processing, confidence score aggregation, line-level bounding box and text extraction.
  - ✅ **Image Preprocessing Pipeline (`preprocessing.py`):** Adaptive deskewing via Otsu binarization and `cv2.minAreaRect`, denoising via `cv2.fastNlMeansDenoising`, contrast enhancement via CLAHE, and dynamic aspect-ratio resizing.
  - ✅ **Multi-Format Ingestion:** PyMuPDF (`fitz`) rasterization of multi-page PDFs at 200 DPI into memory buffers, plus direct JPEG/PNG processing.
  - ✅ **Backend Routes (`backend/routes/ocr_routes.py`):**
    - `POST /ocr/extract-questions`: Ingests Question Paper image/PDF, returns structured list of questions with sub-question tags and marks.
    - `POST /ocr/extract-rubric`: Ingests Marking Scheme / Rubric, returns structured criteria and mark distributions.
    - `POST /ocr/process`: Processes student answer sheets with OCR confidence scoring and upsert into Supabase `student_answers`.
  - ✅ **Live Verification (`backend/test_ocr.py`, `backend/test_exam_paper.jpg`):** Validated on real exam papers with high extraction fidelity.

---

### 2.2 Knowledge & Concept Agent (`agents/concept_agent/`, `backend/routes/concept_routes.py`)
- **Status:** ⏳ **Next Milestone (Phase 3)**
- **Responsible Owner:** Arnav Parmaj
- **Implemented:**
  - ⏳ Skeleton file `agents/concept_agent/concept_extractor.py` (KeyBERT and spaCy concept extraction pipeline designed).
  - ⏳ Skeleton file `agents/concept_agent/knowledge_base.py` (Concept graph and prerequisite relations).
  - ⏳ Skeleton route `backend/routes/concept_routes.py` with `POST /concepts/extract`.
- **Planned Work:**
  - Build atomic concept extractor parsing model answers into required keyphrases and definitions.
  - Define concept graph linking questions to prerequisite knowledge domains.

---

### 2.3 Evaluation & Scoring Agent (`agents/evaluation_agent/`, `agents/feedback_agent/`, `backend/routes/`)
- **Status:** ⏳ **Phase 3 Milestone**
- **Responsible Owner:** Arnav Parmaj
- **Implemented:**
  - ⏳ `agents/evaluation_agent/semantic_matcher.py`: Planned `sentence-transformers` similarity scoring against model answers.
  - ⏳ `agents/evaluation_agent/concept_matcher.py`: Planned concept coverage depth analysis.
  - ⏳ `agents/evaluation_agent/confidence.py`: Multimodal confidence score calculator (OCR quality + semantic certainty).
  - ⏳ `agents/evaluation_agent/scorer.py`: Rubric marks allocation algorithm.
  - ⏳ `agents/feedback_agent/feedback_generator.py`: Constructive student feedback generation.
- **Planned Work:**
  - Implement vector embedding comparison between student OCR transcripts and model answer criteria.
  - Wire `/evaluation/evaluate` to compute partial credit based on rubric breakdown.

---

### 2.4 Frontend & Integration (`src/`, `backend/main.py`)
- **Status:** ✅ **Operational & Connected**
- **Responsible Owner:** Arnav Parmaj
- **Implemented:**
  - ✅ **API Integration Bridge (`src/lib/backendApi.js`):** Client layer communicating with FastAPI on port 8000 (`checkBackendHealth`, `processAnswerSheetOCR`, `extractQuestionsFromFile`, `extractRubricFromFile`).
  - ✅ **Dual-Card Create Exam Wizard (`CreateExamWizard.jsx`):**
    - Step 1: Basic exam details (title, subject, total marks, date).
    - Step 2: Dual upload cards for Question Paper and Rubric with live AI extraction, auto-populating sub-question pills (`Q1(a)`, `Q1(b)`), condition tags, and manual edit capabilities.
    - Step 3: Answer sheets batch upload with real-time OCR backend processing and progress tracking.
  - ✅ **Exam Deletion & Cascade Clean-up (`src/lib/api.js`, `ExamDetailView.jsx`, `ExamsView.jsx`):** Complete deletion modal with safety confirmation, cascading across Supabase tables (`questions`, `answer_keys`, `answer_sheets`, `student_answers`, `evaluations`, `exams`) and local state.
  - ✅ **Crash Resilience & Error Boundaries (`ErrorBoundary.jsx`, `App.jsx`):** React Error Boundary protecting against unhandled component errors; comprehensive null-checks across all dashboard and catalog views.
  - ✅ **Process Orchestration (`start.sh`, `stop.sh`):** Dual daemon runner managing both Uvicorn (FastAPI) and Vite dev servers with persistent PID tracking.
  - ✅ **11 Fully Developed Views:** `AuthView`, `DashboardView`, `ExamsView`, `ExamDetailView`, `CreateExamWizard`, `OCRReviewView`, `ReviewApproveView`, `ResultsView`, `AuditTrailView`, `ExportView`, `ProfileView`.

---

## 3. Tech Stack Snapshot

### 3.1 Detected Dependencies & Frameworks

#### Frontend (`package.json`)
- `react`: `^18.2.0`
- `react-dom`: `^18.2.0`
- `@supabase/supabase-js`: `^2.112.3`
- `lucide-react`: `^0.344.0`
- `vite`: `^5.1.6`
- `tailwindcss`: `^3.4.1`
- `postcss`: `^8.4.35`
- `autoprefixer`: `^10.4.18`

#### Backend & AI Agents (`backend/requirements.txt` & `backend/venv`)
- `fastapi`: API gateway and agent endpoints
- `uvicorn`: ASGI server
- `google-generativeai`: Google Gemini API client (`gemini-2.5-flash`)
- `rapidocr-onnxruntime` / `paddleocr`: Local optical character recognition engines
- `python-dotenv`: Environment variable configuration
- `supabase`: Supabase Python client
- `sentence-transformers`: Semantic text embeddings
- `keybert`: Keyphrase and concept extraction
- `spacy`: NLP pipeline and entity extraction
- `opencv-python` (`cv2`): Image processing and deskewing
- `Pillow`: Image manipulation
- `pymupdf` (`fitz`): Multi-page PDF page extraction and rasterization
- `python-multipart`: Multi-part form/file upload support
- `numpy`: Numerical operations on image matrices

---

### 3.2 Stack Architecture

| Component | Architecture & Selection | Rationale / Benefits |
| :--- | :--- | :--- |
| **Frontend Framework** | **Vite 5 + React 18 SPA** | Ultra-fast HMR, lightweight SPA state management, frictionless component modularity. |
| **Primary OCR & Vision** | **Google Gemini 2.5 Flash** | Multimodal reasoning capable of understanding complex question numbering, handwriting, and layout hierarchy. |
| **Fallback OCR** | **RapidOCR (ONNX) / PaddleOCR** | High-speed local CPU inference when offline or fallback is needed. |
| **Backend Framework** | **FastAPI + Uvicorn** | Asynchronous request handling, native multi-part file uploads, automatic OpenAPI documentation. |
| **Database & Auth** | **Supabase (PostgreSQL + Auth + Storage)** | Relational data integrity, secure JWT auth, S3-compatible file storage for student answer sheets. |
| **PDF Extraction** | **PyMuPDF (`pymupdf`/`fitz`)** | Fast 200 DPI rasterization of uploaded multi-page PDFs into memory buffers. |

---

## 4. API Contract Status

### 4.1 Implemented Endpoints in Codebase

| HTTP Method | Route | File Location | Purpose & Payload | Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | `backend/main.py` | Healthcheck verification | ✅ **Operational** |
| `POST` | `/ocr/extract-questions` | `backend/routes/ocr_routes.py` | Uploads question paper; extracts questions & sub-questions (`Q1(a)`) with marks | ✅ **Operational & Wired** |
| `POST` | `/ocr/extract-rubric` | `backend/routes/ocr_routes.py` | Uploads marking scheme; parses grading criteria & weightings | ✅ **Operational & Wired** |
| `POST` | `/ocr/process` | `backend/routes/ocr_routes.py` | Uploads student answer sheets; performs OCR & saves transcript to Supabase | ✅ **Operational & Wired** |
| `POST` | `/concepts/extract` | `backend/routes/concept_routes.py` | Atomic concept extraction from reference answers | ⏳ **Stub / Next Phase** |
| `POST` | `/evaluation/evaluate` | `backend/routes/evaluation_routes.py` | Semantic grading against rubric criteria | ⏳ **Stub / Next Phase** |
| `POST` | `/feedback/generate` | `backend/routes/feedback_routes.py` | Pedagogical feedback generation | ⏳ **Stub / Next Phase** |

---

## 5. Database Schema & Storage Status

### 5.1 Tables & Schema Mapping

| Table Name | Defined Columns in Codebase / Docs | Status | Details |
| :--- | :--- | :--- | :--- |
| `teachers` | `id`, `name`, `email`, `institution` | ✅ Done | Teacher profile linked with Supabase Auth |
| `exams` | `id`, `teacher_id`, `title`, `subject`, `grade`, `total_marks`, `exam_date`, `status` | ✅ Done | Core exam entity; supports cascade deletion |
| `questions` | `id`, `exam_id`, `question_number`, `question_text`, `max_marks` | ✅ Done | Includes sub-question identifiers |
| `answer_keys` | `id`, `question_id`, `model_answer`, `rubric_criteria` (jsonb) | ✅ Done | Stores model answer & rubric breakdown |
| `answer_sheets` | `id`, `exam_id`, `student_id`, `file_url`, `upload_status` | ✅ Done | Files stored in Supabase `answer-sheets` bucket |
| `student_answers` | `id`, `answer_sheet_id`, `question_id`, `ocr_text`, `ocr_confidence` | ✅ Done | Populated by OCR processing pipeline |
| `evaluations` | `id`, `student_answer_id`, `marks_awarded`, `confidence_score`, `feedback`, `needs_review` | ✅ Done | AI grading & teacher overrides |

### 5.2 Storage Bucket
- **Bucket Name:** `answer-sheets` (Supabase Storage)
- **Permissions:** Authenticated upload, public/signed URL read
- **Persistence:** Direct integration via `src/lib/api.js` (`uploadAnswerSheetDB`)

---

## 6. Testing & Validation Progress

- **Frontend Build Validation:** `npm run build` passes cleanly with **0 errors and 0 lint warnings**.
- **Live OCR Pipeline Test:** Verified using real-world exam image `backend/test_exam_paper.jpg` with `gemini-2.5-flash`.
- **Sub-Question Parsing:** Verified automatic bifurcation of complex question hierarchies into `Q1(a)`, `Q1(b)` with assigned marks and condition tags.
- **Cascade Deletion Test:** Verified clean purge across related relational tables without leaving orphaned foreign keys.
- **Synthetic Test Fixtures:** `src/data/mockData.js` provides offline fallback containing 3 complete exams and student submissions.

---

## 7. Resolved Items & Current Priorities

### 7.1 Recently Resolved Items
1. ✅ **Gemini Vision Hybrid OCR:** Integrated Google Gemini 2.5 Flash for multimodal handwriting recognition with RapidOCR fallback.
2. ✅ **Sub-Question Bifurcation:** Automatically extracts `Q1(a)`, `Q1(b)` structure from question paper uploads.
3. ✅ **Frontend-Backend Bridge:** Created `backendApi.js` connecting React to FastAPI endpoints.
4. ✅ **Dual-Card Wizard:** Added dedicated upload cards for Question Paper and Rubric in `CreateExamWizard.jsx`.
5. ✅ **Exam Deletion:** Implemented full cascade delete from UI and database.
6. ✅ **Stability & Error Boundary:** Fixed Temporal Dead Zone in `AppContext.jsx` and added `ErrorBoundary.jsx`.
7. ✅ **Dual Daemon Scripts:** Upgraded `start.sh` and `stop.sh` for simultaneous frontend and backend management.

### 7.2 Current Priority Tasks (Phase 3)
1. **Concept Agent Implementation (`agents/concept_agent/`):**
   - Implement `concept_extractor.py` using `KeyBERT` and `spaCy` to extract atomic concept requirements from model answers.
2. **Evaluation & Scoring Agent Implementation (`agents/evaluation_agent/`):**
   - Implement `semantic_matcher.py` using `sentence-transformers` (`all-MiniLM-L6-v2`) to compare student OCR text with rubric criteria.
   - Implement `confidence.py` to weight OCR certainty and semantic distance.
   - Wire `POST /evaluation/evaluate` to return itemized scores per sub-question.
3. **Feedback Agent (`agents/feedback_agent/`):**
   - Generate student-specific learning feedback highlighting missed concepts.

---

## 8. Git Activity Summary

### 8.1 Repository Metadata
- **Current Branch:** `main`
- **Tracking Branch:** `origin/main` (Up to date)
- **Contributors:** Arnav Parmaj (`arnavparmaj9@gmail.com`)
- **Remote:** `https://github.com/ArnavParmaj/SmartCheckAI.git`

### 8.2 Recent Commit History
```
768b53b - feat: Add Gemini Vision hybrid OCR, sub-question bifurcation, exam deletion, and error boundary
8dff5ab - feat: implement multi-agent evaluation pipeline, FastAPI backend, and Profile UI
589f1b4 - Initial commit of SmartCheckAI with Supabase Integration
f1b825b - first commit
```

---
*Report compiled and verified on October 8, 2026 for SmartCheckAI.*
