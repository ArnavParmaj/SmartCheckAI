# SmartCheckAI — Project Progress Report

**Generated Date:** September 23, 2026  
**Project:** SmartCheckAI — Agentic AI System for Automated Handwritten Answer Evaluation  
**Repository Path:** `/Users/arnavparmaj/Projects/SmartCheck AI`  
**Primary Author / Contributor:** Arnav Parmaj (`arnavparmaj9@gmail.com`)  
**Git Branch:** `main` (Working Tree: Uncommitted local modifications + untracked modules)

---

## 1. Project Overview

- **One-Line Project Summary:** SmartCheckAI is an agentic AI-assisted exam evaluation platform that digitizes handwritten student answer sheets using local OCR, performs rubric- and concept-driven semantic grading, and provides a teacher-in-the-loop verification and override workflow.
- **Current Development Phase:** **Phase 2: Core Agent Implementation & Backend Integration** (Transitioning from an in-memory UI prototype with Supabase scaffolding to a connected multi-agent processing pipeline).
- **Overall Completion Percentage:** **~40%** (Weighted across modules: Frontend UI ~85%, OCR Agent ~80%, Concept Agent ~10%, Evaluation/Scoring Agent ~10%, Feedback Agent ~10%, Backend Integration ~15%, Database/Migrations ~25%).

### Subsystem Progress Gauges
| Subsystem | Completion % | Current State |
| :--- | :--- | :--- |
| **Frontend & UI Views** | 85% | 11 comprehensive views implemented, dual-mode (Mock Demo vs Live Supabase) |
| **OCR Agent Engine** | 80% | Preprocessing, PaddleOCR inference, and question segmentation fully implemented |
| **Knowledge & Concept Agent** | 10% | Module directory and docstring stubs created; endpoint is a placeholder |
| **Evaluation & Scoring Agent** | 10% | Module files and docstrings created; `/evaluation/evaluate` is a placeholder |
| **Feedback Agent** | 10% | Module files and docstrings created; `/feedback/generate` is a placeholder |
| **Frontend-Backend Integration** | 15% | FastAPI server created; frontend currently has **zero** HTTP calls to FastAPI |
| **Database & Schema Versioning** | 25% | Tables referenced in client code; **no SQL migration files** in repo |

---

## 2. Module Status

### 2.1 OCR Agent (`agents/ocr_agent/`, `backend/routes/ocr_routes.py`)
- **Status:** 🔄 **In Progress** (Core Python engine functional; unwired to frontend)
- **Responsible Owner:** Arnav Parmaj
- **Implemented:**
  - ✅ **Image Preprocessing (`preprocessing.py`):** Grayscale conversion, adaptive deskewing via Otsu binarization and `cv2.minAreaRect`, denoising via `cv2.fastNlMeansDenoising`, contrast enhancement via CLAHE (Contrast Limited Adaptive Histogram Equalization), and dynamic resizing to minimum 1200px width.
  - ✅ **OCR Inference (`ocr.py`):** Lazy-loaded PaddleOCR engine with CPU inference caching, multi-version compatibility fallback (PaddleOCR 3.x and 2.x), line-level text extraction, and average confidence score computation.
  - ✅ **Segmentation Engine (`segmentation.py`):** Regex-based question marker detection (`QUESTION_MARKER_REGEX`) supporting patterns such as `Q1`, `Question 1`, `Ans 1`, `1.`, `(1)`, and per-question text splitting with multi-page answer continuation.
  - ✅ **Backend Processing Route (`backend/routes/ocr_routes.py`):** `POST /ocr/process` handling both multi-page PDFs (rasterized at 200 DPI via `PyMuPDF`) and raw images, temporary file cleanup in `finally` blocks, and Supabase upsert logic into `student_answers`.
  - ✅ **Local Test Script (`backend/test_ocr.py`):** Standalone verification script testing the 3-step pipeline against `backend/test_sample.jpg`.
- **In Progress:**
  - 🔄 Tuning segmentation boundaries for complex handwritten numbering (e.g., sub-parts `1(a)`, `1(b)`).
- **Blocked:**
  - ❌ Backend Supabase persistence is blocked because `backend/.env` contains placeholder credentials (`SUPABASE_URL=your-url`).
  - ❌ End-to-end execution from the UI is blocked because the frontend does not dispatch network requests to this endpoint.

---

### 2.2 Knowledge & Concept Agent (`agents/concept_agent/`, `backend/routes/concept_routes.py`)
- **Status:** ⏳ **Not Started / Stubs Only**
- **Responsible Owner:** Arnav Parmaj
- **Implemented:**
  - ⏳ Skeleton file `agents/concept_agent/concept_extractor.py` (docstring only; planned KeyBERT and spaCy extraction).
  - ⏳ Skeleton file `agents/concept_agent/knowledge_base.py` (docstring only; planned ontology and concept graphs).
  - ⏳ Skeleton route `backend/routes/concept_routes.py` with `POST /concepts/extract` returning `{"message": "Concept extraction placeholder"}`.
- **In Progress:**
  - None.
- **Blocked:**
  - ❌ Blocked pending implementation of KeyBERT/spaCy NLP pipelines.
  - ❌ Planned endpoint `GET /knowledge/{id}` is completely missing from the routing layer.

---

### 2.3 Evaluation & Scoring Agent (`agents/evaluation_agent/`, `agents/feedback_agent/`, `backend/routes/`)
- **Status:** ⏳ **Not Started / Stubs Only**
- **Responsible Owner:** Arnav Parmaj
- **Implemented:**
  - ⏳ Skeleton file `agents/evaluation_agent/semantic_matcher.py` (docstring only; planned sentence-transformers similarity).
  - ⏳ Skeleton file `agents/evaluation_agent/concept_matcher.py` (docstring only; planned concept coverage depth analysis).
  - ⏳ Skeleton file `agents/evaluation_agent/confidence.py` (docstring only; planned multimodal confidence scoring).
  - ⏳ Skeleton file `agents/evaluation_agent/scorer.py` (docstring only; planned rubric marks calculation).
  - ⏳ Skeleton file `agents/feedback_agent/feedback_generator.py` (docstring only; planned pedagogical feedback generation).
  - ⏳ Skeleton route `backend/routes/evaluation_routes.py` with `POST /evaluation/evaluate` returning `{"message": "Evaluation placeholder"}`.
  - ⏳ Skeleton route `backend/routes/feedback_routes.py` with `POST /feedback/generate` returning `{"message": "Feedback generation placeholder"}`.
- **In Progress:**
  - None.
- **Blocked:**
  - ❌ Blocked on Concept Agent output and embedding generation pipeline.
  - ❌ Planned endpoint `GET /feedback/{id}` is not implemented.

---

### 2.4 Frontend & Integration (`src/`, `backend/main.py`)
- **Status:** 🔄 **In Progress**
- **Responsible Owner:** Arnav Parmaj
- **Implemented:**
  - ✅ **UI Architecture:** React 18 SPA configured with Vite 5, Tailwind CSS 3.4, and Lucide icons.
  - ✅ **Navigation & Views (11 distinct views):**
    1. `AuthView.jsx`: Supabase email/password sign-in/up + one-click Demo Mode.
    2. `DashboardView.jsx`: Summary KPI cards, quick actions, recent exams table.
    3. `ExamsView.jsx`: Searchable, filterable catalog of all exams.
    4. `ExamDetailView.jsx`: Questions, rubrics, and student submission tracking.
    5. `CreateExamWizard.jsx`: 3-step wizard (Details -> Questions & Rubrics -> Answer Sheets Upload).
    6. `OCRReviewView.jsx`: Split-view with image viewer, transcript editor, and question-level confidence indicators.
    7. `ReviewApproveView.jsx`: AI grading breakdown, rubric comparison, teacher score override, and approval flow.
    8. `ResultsView.jsx`: Grade distribution charts, question-level difficulty statistics, class averages.
    9. `AuditTrailView.jsx`: Audit event log recording overrides, approvals, and logins.
    10. `ExportView.jsx`: Grade report generation preview for CSV, PDF, and Excel export.
    11. `ProfileView.jsx`: Teacher settings, institutional details, and AI confidence threshold toggles.
  - ✅ **Dual-Mode State Management (`AppContext.jsx`):** Reactive context supporting seamless switching between in-memory mock data fixtures (`mockData.js`) and live Supabase queries (`src/lib/api.js`).
  - ✅ **Supabase Client Layer (`src/lib/api.js`):** Client-side CRUD methods for `teachers`, `exams`, `questions`, `answer_keys`, `answer_sheets`, `student_answers`, and `evaluations`.
- **In Progress:**
  - 🔄 Uncommitted working tree improvements to `ProfileView.jsx`, `Sidebar.jsx`, `TopBar.jsx`, and `AppContext.jsx`.
- **Blocked:**
  - ❌ **Primary Integration Gap:** Frontend has **no HTTP integration** with the FastAPI backend. In `CreateExamWizard.jsx`, uploads run a synthetic timer (`setTimeout(1500)`) instead of invoking `POST /ocr/process`.
  - ❌ `start.sh` only launches `npm run dev`, leaving the FastAPI backend offline unless run manually.

---

## 3. Tech Stack Snapshot

### 3.1 Detected Dependencies & Frameworks

#### Frontend (`package.json`)
- `react`: `^18.2.0`
- `react-dom`: `^18.2.0`
- `@supabase/supabase-js`: `^2.112.3`
- `lucide-react`: `^0.344.0`
- `vite`: `^5.1.6` (Build tool & dev server)
- `@vitejs/plugin-react`: `^4.2.1`
- `tailwindcss`: `^3.4.1`
- `postcss`: `^8.4.35`
- `autoprefixer`: `^10.4.18`

#### Backend & AI Agents (`backend/requirements.txt` & `backend/venv`)
- `fastapi`: API gateway and agent endpoints
- `uvicorn`: ASGI server
- `python-dotenv`: Environment configuration
- `supabase`: Supabase Python client
- `paddleocr` / `paddlepaddle`: Optical character recognition engine
- `sentence-transformers`: Semantic text embeddings
- `keybert`: Keyphrase and concept extraction
- `spacy`: NLP pipeline and entity extraction
- `opencv-python` (`cv2`): Image processing and deskewing
- `Pillow`: Image manipulation
- `pymupdf` (`fitz`): Multi-page PDF page extraction and rasterization
- `python-multipart`: Multi-part form/file upload support
- `numpy`: Numerical operations on image matrices

---

### 3.2 Stack Variance: Planned vs. Actual

| Component | Originally Planned Stack | Actual Detected Stack | Status / Impact |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Next.js | **Vite 5 + React 18 SPA** | ⚠️ **Deviation:** Switched to a pure Single Page Application. Routing is managed via React Context state (`currentView`) rather than Next.js file-based or server routes. |
| **OCR Model** | TrOCR (Hugging Face) | **PaddleOCR (Baidu / PaddlePaddle)** | ⚠️ **Deviation:** Code uses PaddleOCR CPU inference rather than Hugging Face TrOCR. Better suited for quick CPU extraction, but diverges from initial spec. |
| **Vector Database** | Supabase with `pgvector` | **Not Installed / Not Configured** | ❌ **Missing:** No `pgvector` extension enabled in repo, no embedding vector columns defined in any table, and no embedding generation code written. |
| **PDF Extraction** | Unspecified | **PyMuPDF (`pymupdf`/`fitz`)** | ➕ **Added:** Added to rasterize uploaded answer sheet PDFs into PNGs at 200 DPI for OCR. |
| **Concept Extraction** | Unspecified | **KeyBERT + spaCy** | ➕ **Added:** Included in `requirements.txt` for keyword and entity parsing (implementations pending). |

---

## 4. API Contract Status

### 4.1 Implemented Endpoints in Codebase

| HTTP Method | Route | File Location | Request Schema | Response Schema | Implementation Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | `backend/main.py` | None | `{"status": "ok"}` | ✅ **Done** |
| `POST` | `/ocr/process` | `backend/routes/ocr_routes.py` | `multipart/form-data`<br>• `file`: `UploadFile` (Required)<br>• `answer_sheet_id`: `str` (Optional) | `{"status": "success", "ocr_confidence": float, "answers": {"Q1": str, ...}}`<br>Or `{"status": "error", "message": str}` | ✅ **Done** (Backend only; unwired to UI) |
| `POST` | `/concepts/extract` | `backend/routes/concept_routes.py` | Empty / Untyped | `{"message": "Concept extraction placeholder"}` | ⏳ **Stub / Incomplete** |
| `POST` | `/evaluation/evaluate` | `backend/routes/evaluation_routes.py` | Empty / Untyped | `{"message": "Evaluation placeholder"}` | ⏳ **Stub / Incomplete** |
| `POST` | `/feedback/generate` | `backend/routes/feedback_routes.py` | Empty / Untyped | `{"message": "Feedback generation placeholder"}` | ⏳ **Stub / Incomplete** |

---

### 4.2 Planned vs. Actual Endpoint Discrepancies

| Planned Endpoint | Actual Endpoint in Repo | Status | Gap Analysis |
| :--- | :--- | :--- | :--- |
| `/ocr/process` | `POST /ocr/process` | ✅ **Present** | Backend logic complete. Missing frontend client dispatch. |
| `/knowledge/{id}` | *None* | ❌ **Missing** | No route exists in `concept_routes.py` or `main.py` to retrieve knowledge base or concept graphs by ID. |
| `/evaluate` | `POST /evaluation/evaluate` | 🔄 **Partial / Stub** | Mounted under prefix `/evaluation/evaluate` instead of `/evaluate`. Handler returns only a static placeholder. |
| `/feedback/{id}` | `POST /feedback/generate` | ❌ **Missing** | Planned parameter `/feedback/{id}` not implemented; only a static POST placeholder `/feedback/generate` exists. |

---

## 5. Database Schema Status

> **Important Observation:** There are **zero SQL migration scripts** in the repository (no `supabase/migrations/` directory or `.sql` files). The database schema is defined implicitly through the architectural reference document (`PROJECT_STRUCTURE.md`), the frontend Supabase client (`src/lib/api.js`), and the backend route queries (`backend/routes/ocr_routes.py`).

### 5.1 Planned Schema vs. Codebase Implementation

| Planned Table | Codebase Table | Defined Columns in Codebase / Docs | Status | Alignment & Discrepancies |
| :--- | :--- | :--- | :--- | :--- |
| `users` | `teachers` + `auth.users` | `id` (uuid), `name` (text), `email` (text), `institution` (text) | 🔄 In Progress | App uses Supabase Auth for auth credentials and a `teachers` table for profiles. No generic `users` or `students` table. |
| `exams` | `exams` | `id` (uuid), `teacher_id` (uuid FK), `title` (text), `subject` (text), `grade` (text), `total_marks` (numeric), `exam_date` (date), `status` (text) | ✅ Done | Matches planned schema. Used in `api.js` and `ocr_routes.py`. |
| `questions` | `questions` | `id` (uuid), `exam_id` (uuid FK), `question_number` (int), `question_text` (text), `max_marks` (numeric) | ✅ Done | Matches planned schema. |
| `model_answers` | `answer_keys` | `id` (uuid), `question_id` (uuid FK), `model_answer` (text), `rubric_criteria` (jsonb) | 🔄 In Progress | Implemented under table name `answer_keys` containing `model_answer`. |
| `concepts` | *None* | *None* | ⏳ Not Started | **Missing.** No table exists to store concept nodes, ontology entities, or prerequisites. |
| `rubrics` | Embedded in `answer_keys` | `rubric_criteria` column (jsonb) | 🔄 In Progress | Stored as JSONB inside `answer_keys` instead of a dedicated normalized `rubrics` table. |
| `students` | *None* | *None* | ⏳ Not Started | Referenced as foreign key `student_id` in `answer_sheets`, but table is undefined in repo. |
| `answer_sheets` | `answer_sheets` | `id` (uuid), `exam_id` (uuid FK), `student_id` (uuid FK), `file_url` (text), `upload_status` (text) | ✅ Done | Matches planned schema. Storage linked to bucket `answer-sheets`. |
| `student_answers` | `student_answers` | `id` (uuid), `answer_sheet_id` (uuid FK), `question_id` (uuid FK), `ocr_text` (text), `ocr_confidence` (numeric) | ✅ Done | Used by both `src/lib/api.js` and `backend/routes/ocr_routes.py`. |
| `evaluations` | `evaluations` | `id` (uuid), `student_answer_id` (uuid FK), `marks_awarded` (numeric), `confidence_score` (numeric), `feedback` (text), `needs_review` (bool) | ✅ Done | Matches planned schema. |
| `feedback` | Embedded in `evaluations` | `feedback` column (text) | 🔄 In Progress | Stored as a column inside `evaluations` rather than a dedicated table. |
| *(pgvector)* | *None* | *None* | ⏳ Not Started | **Missing.** No vector extension or embedding columns defined. |

---

## 6. Testing & Validation Progress

- **Automated Test Coverage:** **0%**  
  - No automated test runners configured (no `pytest` or `unittest` configuration in backend; no `vitest` or `jest` configuration in frontend).
  - `package.json` contains only `vite`, `vite build`, `eslint`, and `vite preview`.
- **Test Datasets Detected:**
  - `backend/test_sample.jpg`: Single handwritten answer sample image used by `backend/test_ocr.py`.
  - `src/data/mockData.js`: Synthetic fixtures containing 3 sample exams, 3 detailed student submissions with line-item rubrics, and 4 audit events.
- **Evaluation Metrics Found in Repo:**
  - **No machine learning benchmark metrics** (MAE, RMSE, F1-Score, BLEU, ROUGE, CER, or WER) are present in the repository.
  - The only metrics present are:
    - **OCR Line Confidence:** Computed dynamically in `agents/ocr_agent/ocr.py` as the arithmetic mean of PaddleOCR's line prediction confidences.
    - **Hardcoded Mock Accuracy:** Display metrics hardcoded in mock data (`ocrAccuracy: 98`, `aiScore: 9`).

---

## 7. Known Issues & Technical Debt

### 7.1 Source Code Issues & TODOs

1. **`backend/.env` Placeholder Credentials:**
   ```env
   SUPABASE_URL=your-url
   SUPABASE_KEY=your-key
   ```
   *Impact:* The backend Supabase client fails to initialize, preventing `ocr_routes.py` from persisting OCR results to `student_answers`.

2. **Silent Failure in Question ID Mapping (`backend/routes/ocr_routes.py:168`):**
   ```python
   except Exception as q_err:
       print(f"Note: Could not look up question IDs: {q_err}")
   ```
   *Impact:* If `exam_id` lookup fails or questions do not exist, `question_id` is set to `None`, resulting in orphaned answers in `student_answers`.

3. **Frontend Simulated Upload (`src/components/CreateExamWizard.jsx:75`):**
   ```javascript
   await new Promise(r => setTimeout(r, 1500)); // Simulate upload
   ```
   *Impact:* Teacher uploads in the UI do not invoke the Python OCR backend or upload files to Supabase Storage.

4. **Incomplete Route Stubs (`backend/routes/`):**
   - `concept_routes.py:12`: Commented placeholder returning static message.
   - `evaluation_routes.py:12`: Commented placeholder returning static message.
   - `feedback_routes.py:12`: Commented placeholder returning static message.

5. **`start.sh` Missing Backend Process (`start.sh:6`):**
   - `start.sh` only boots `npm run dev`. It does not boot FastAPI (`uvicorn main:app`), requiring developers to manually start the backend in a separate terminal.

---

## 8. Risks & Blockers

1. ❌ **Critical Blocker — Complete Frontend-Backend Decoupling:**  
   The React frontend and FastAPI backend are entirely disconnected. The frontend has zero API fetch calls to port `8000`. Until an API bridge (`src/lib/backendApi.js` or similar) is implemented, none of the Python agent capabilities can be utilized from the UI.
2. ❌ **Architecture Risk — Missing SQL Migrations:**  
   Without declarative SQL migration files in `supabase/migrations/`, any new environment setup or database recreation requires reverse-engineering tables from `api.js`.
3. ⚠️ **AI Pipeline Blocker — Unimplemented Evaluation Stack:**  
   Evaluation & Scoring depends on Concept Extraction and Semantic Embeddings. Since `concept_agent` and `evaluation_agent` are currently docstrings, automated grading cannot function.
4. ⚠️ **Data Dependency Risk — Missing Student Data Model:**  
   `answer_sheets` has a foreign key to `student_id`, but no `students` table exists. Student names are currently hardcoded in frontend mock data.

---

## 9. Next Steps (Concrete Task Plan)

### 9.1 OCR Agent
1. **Frontend Hookup:** Update `CreateExamWizard.jsx` to send uploaded answer sheets directly to `POST /ocr/process`.
2. **Bounding Box Data:** Extend `ocr.py` to return bounding boxes alongside text so `OCRReviewView.jsx` can highlight text locations on the scanned sheet.
3. **Advanced Segmentation:** Expand `segment_answers` regex to recognize multi-level questions (e.g., `1. (a)`, `Q2.b`).
4. **Automated Evaluation Benchmark:** Create a test harness measuring Character Error Rate (CER) and Word Error Rate (WER) using a dataset of diverse handwriting samples.

### 9.2 Knowledge & Concept Agent
1. **Keyphrase Extraction Pipeline:** Implement `concept_extractor.py` using `KeyBERT` and `spaCy` to parse model answers into atomic concept units.
2. **Concept Data Model:** Design and deploy the `concepts` database table to persist key terms and weights per question.
3. **API Implementation:** Implement `POST /concepts/extract` to accept question text + rubric and return structured concept lists.
4. **Knowledge Retrieval:** Implement `GET /knowledge/{id}` to query pre-computed concepts for an exam.

### 9.3 Evaluation & Scoring Agent
1. **Semantic Similarity Engine:** Implement `semantic_matcher.py` using `sentence-transformers` (`all-MiniLM-L6-v2`) to score student answers against reference rubrics.
2. **Concept Coverage Checker:** Implement `concept_matcher.py` to verify whether mandatory concepts extracted by the Concept Agent are present in student answers.
3. **Holistic Scorer:** Implement `scorer.py` combining semantic similarity, concept presence, and question maximum marks into a suggested score.
4. **Confidence Evaluator:** Implement `confidence.py` factoring in OCR quality and semantic ambiguity into an automated confidence percentage.
5. **Implement `/evaluation/evaluate`:** Replace the placeholder route with a fully functional handler that evaluates answers and persists records to `evaluations`.

### 9.4 Frontend & Integration
1. **FastAPI Client Layer:** Create `src/lib/backendApi.js` providing typed `fetch` methods pointing to `http://localhost:8000`.
2. **Wired Upload Wizard:** Replace `setTimeout(1500)` in `CreateExamWizard.jsx` with actual calls to `uploadAnswerSheetDB` and `POST /ocr/process`.
3. **Unified Startup Script:** Update `start.sh` and `stop.sh` to manage both Vite (frontend) and Uvicorn (backend) in parallel.
4. **Database Migrations:** Author initial Supabase SQL migration files covering all 8 active tables and apply them to version control.
5. **Commit Working Tree Changes:** Review, stage, and commit untracked agent modules and frontend profile updates.

---

## 10. Git Activity Summary

### 10.1 Repository Metadata
- **Current Branch:** `main`
- **Tracking Branch:** `origin/main` (Up to date)
- **Contributors:** 1 (Arnav Parmaj `<arnavparmaj9@gmail.com>`)
- **Open / Merged Pull Requests:** None (Direct trunk-based commit history)

### 10.2 Commit History
```
589f1b4 - Arnav Parmaj <arnavparmaj9@gmail.com> - Thu Aug 20 23:58:56 2026 +0530
          Initial commit of SmartCheckAI with Supabase Integration
          (41 files changed, 6344 insertions, 214 deletions)

f1b825b - Arnav Parmaj <arnavparmaj9@gmail.com> - Thu Aug 20 11:58:24 2026 +0530
          first commit
          (13 files changed, 219 insertions)
```

### 10.3 Working Tree Status
```
Changes not staged for commit:
  modified:   src/App.jsx
  modified:   src/components/Sidebar.jsx
  modified:   src/components/TopBar.jsx
  modified:   src/context/AppContext.jsx
  modified:   src/lib/api.js
  modified:   tailwind.config.js

Untracked files:
  .gitattributes
  PROJECT_STRUCTURE.md
  agents/
  backend/
  graphify-out/
  src/components/ProfileView.jsx
  src/components/generated_profile.html
```
*Note: All core Python agents (`agents/`) and backend services (`backend/`) are currently untracked in Git and have not yet been committed to version control.*

---
*Report compiled based on static analysis and codebase inspection of `SmartCheckAI`.*
