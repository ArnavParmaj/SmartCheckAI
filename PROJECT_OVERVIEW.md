# SmartCheckAI — Project Overview

A complete guide to what SmartCheckAI is, how it works from top to bottom, what it is built with, and how to run it. It is written for anyone opening the project for the first time: developers, reviewers, faculty and examiners.

*Last updated: 16 October 2026.*

---

## Contents

1. [What SmartCheckAI is](#1-what-smartcheckai-is)
2. [The problem it solves](#2-the-problem-it-solves)
3. [Who uses it and how](#3-who-uses-it-and-how)
4. [System architecture](#4-system-architecture)
5. [Technology stack](#5-technology-stack)
6. [End-to-end workflow](#6-end-to-end-workflow)
7. [How documents are read](#7-how-documents-are-read)
8. [The knowledge base](#8-the-knowledge-base)
9. [How grading works](#9-how-grading-works)
10. [Confidence and the review queue](#10-confidence-and-the-review-queue)
11. [The cloud AI provider chain](#11-the-cloud-ai-provider-chain)
12. [Frontend screens](#12-frontend-screens)
13. [Backend API reference](#13-backend-api-reference)
14. [Database and storage](#14-database-and-storage)
15. [Repository layout](#15-repository-layout)
16. [Setup and running](#16-setup-and-running)
17. [Configuration reference](#17-configuration-reference)
18. [Testing and accuracy evaluation](#18-testing-and-accuracy-evaluation)
19. [Security model](#19-security-model)
20. [Limitations and known issues](#20-limitations-and-known-issues)
21. [Roadmap](#21-roadmap)
22. [Glossary](#22-glossary)

---

## 1. What SmartCheckAI is

SmartCheckAI is a web platform that **evaluates handwritten university exam answer sheets automatically**.

- **Faculty provide, once per exam:**
  - the question paper
  - the marking rubric
  - their typed answer key
- **The system then evaluates each student's handwritten sheet:**
  - reads the handwriting
  - marks every answer criterion by criterion against the faculty's answer key
  - explains every mark gained or lost
- **Faculty check only what needs checking.** Answers the system is unsure about go to a review queue.

**Current scope:** the subject *Big Data Analytics (BDA)*, B.E. Computer Engineering, Semester VII (University of Mumbai–style papers). Other engineering subjects are planned and appear in the app as "coming soon".

**Design principle: hybrid AI.**
- **Local models do the grading on the laptop/server itself.** They are free, unlimited and work offline.
- **Free cloud models (Groq, then Google Gemini) are a second opinion,** and the main reader of handwriting.
- If every cloud provider is unavailable, the system still grades using local models.

---

## 2. The problem it solves

- A faculty member checking 100–200 answer sheets spends days reading similar answers against the same marking scheme.
- Marks drift as fatigue sets in.
- Students rarely get written reasons for their marks.

SmartCheckAI aims to:
- **Cut checking time.** Faculty review only the flagged answers (typically a minority) instead of every answer.
- **Make marking consistent.** Every sheet is marked against the same knowledge base and rubric.
- **Explain marks.** Each answer gets a criterion-wise breakdown ("Covered: Volume, Velocity. Missing: Veracity") and student feedback.
- **Show class-level gaps.** Class Analysis lists what most students missed, so faculty know what to re-teach.

---

## 3. Who uses it and how

**One role today: Faculty / Teacher.** There is no student login; faculty upload student sheets in bulk.

What faculty do, in order:

| # | Faculty action | Where | What the system does |
|---|---|---|---|
| 1 | Sign up / log in | Login screen | Supabase authentication |
| 2 | Enter exam details (title, subject = BDA, semester, date) | Create Exam, step 1 | — |
| 3 | Upload question paper and rubric | Create Exam, step 2 | Extracts questions, marks, marking criteria, deductions and guidelines |
| 4 | Upload typed answer key | Create Exam, step 3 | Splits it per question and builds the knowledge base |
| 5 | Review and correct the knowledge base | Create Exam, step 4 | Saves the exam with its knowledge base |
| 6 | Upload all student sheets (one file per student) | Evaluate Papers | Reads handwriting, grades, saves |
| 7 | Check flagged answers | Review Queue | Accept or change the AI mark |
| 8 | Read per-student reports and approve | Evaluation Report | Approval and overrides are saved |
| 9 | See class results and export | Class Analysis, Export | CSV/JSON/PDF gradebook and PDF report cards |

---

## 4. System architecture

```
┌──────────────────────────── Browser (faculty) ─────────────────────────────┐
│  React 18 single-page app (Vite, Tailwind)                                  │
│  - screens (src/components)        - state: AppContext (src/context)        │
│  - grading pipeline orchestration (src/lib/pipeline.js)                     │
│  - talks to Supabase directly as the logged-in teacher (src/lib/api.js)     │
│  - talks to the AI backend over REST (src/lib/backendApi.js)                │
└───────────────┬───────────────────────────────────────────┬────────────────┘
                │ HTTPS (supabase-js, user JWT)             │ HTTP JSON / multipart
                ▼                                           ▼
┌──────────── Supabase (cloud) ────────────┐   ┌──────── AI backend (FastAPI, :8000) ───────────┐
│ Auth (email/password)                     │   │ routes: /ocr  /knowledge  /evaluation           │
│ PostgreSQL: teachers, exams, questions,   │   │         /concepts  /feedback  /health           │
│   answer_keys, answer_sheets,             │   │ agents (Python):                                │
│   student_answers, evaluations,           │   │  ocr_agent        reads documents & handwriting │
│   audit_events (RLS)                      │   │  concept_agent    answer key -> knowledge base  │
│ Storage bucket: answer-sheets             │   │  evaluation_agent criterion-wise hybrid grader  │
└───────────────────────────────────────────┘   │  feedback_agent   student feedback              │
                                                │  llm.py           free cloud provider chain     │
                                                │ local models: MiniLM (sentence-transformers),   │
                                                │   KeyBERT, RapidOCR (CPU)                        │
                                                └──────────────┬──────────────────────────────────┘
                                                               │ HTTPS (optional)
                                                ┌──────────────▼──────────────┐
                                                │ Groq API  →  Gemini API     │
                                                │ (free tiers, in that order) │
                                                └─────────────────────────────┘
```

**Key architectural decisions:**
- **The browser orchestrates the pipeline and saves data as the logged-in teacher.** Supabase row-level security applies to the teacher, and the backend needs no database credentials beyond the public anon key.
- **The backend is stateless.** It reads files, builds knowledge and grades, but stores nothing. All persistence is in Supabase.
- **Local first, cloud optional.** Every cloud call is behind `agents/llm.py`, which falls back provider by provider; if all fail, local models continue.
- **One sheet at a time, one cloud call per page.** This keeps each request inside free-tier per-minute token limits.

---

## 5. Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3, Material Symbols icons | Single-page app |
| Frontend data | `@supabase/supabase-js` 2 | Auth, database, file storage |
| Linting | ESLint 8 (react, react-hooks, react-refresh plugins) | `npm run lint` (0 warnings allowed) |
| Backend | Python 3.11, FastAPI, Uvicorn | REST API for AI tasks |
| Document reading | PyMuPDF (PDF text and page images), python-docx (Word) | Typed documents read directly |
| Local OCR (fallback) | RapidOCR (ONNX Runtime), OpenCV preprocessing; PaddleOCR optional | Reads printed text offline (weak on handwriting) |
| Local NLP | sentence-transformers `all-MiniLM-L6-v2` (CPU), KeyBERT | Meaning-based matching, similarity, keyphrases |
| Cloud AI (free, optional) | Groq: `qwen/qwen3.8-27b` (vision), `openai/gpt-oss-120b` (text); Google Gemini: `gemini-3.5-flash-lite` (vision), `gemini-flash-lite-latest` (text) | Handwriting reading, document parsing, grading second opinion |
| Database, auth, files | Supabase (PostgreSQL + Auth + Storage) | Persistence |
| Tooling | `uv` (Python env), npm, Playwright (UI testing, not a project dependency), graphify (code graph) | Development |

Python dependencies are in `backend/requirements.txt`: fastapi, uvicorn, python-dotenv, supabase, rapidocr-onnxruntime, onnxruntime, paddleocr, paddlepaddle, sentence-transformers, keybert, spacy, opencv-python, Pillow, pymupdf, python-multipart, numpy, python-docx.

---

## 6. End-to-end workflow

### 6.1 Exam setup (once per exam)

```
Step 1  Exam details ── title, subject (BDA), semester (default VII), date
   │
Step 2  Question paper (PDF/image) ──► POST /ocr/extract-questions ──► [{id:"Q1(a)", text, marks}]
        Rubric (PDF/image) ─────────► POST /ocr/extract-rubric ────► rows of 3 types:
                                         criterion  → marking criteria per question (name, marks, description)
                                         deduction  → misconception rules per question
                                         guideline  → general rules applied to every question
   │
Step 3  Typed answer key (.pdf/.docx/.txt or pasted) ──► POST /knowledge/build
        → split into one model answer per question label
        → per question: key points + criteria with the points that earn them + rules
   │
Step 4  Faculty review: edit model answers, criteria/marks, key points, deductions; "Rebuild key points"
        ──► Create Exam: rows saved to exams, questions, answer_keys (Supabase)
```

### 6.2 Evaluating student papers (bulk)

For each uploaded file (one per student), `src/lib/pipeline.js` runs:

```
1. Read handwriting   POST /ocr/process (file + exam's question labels)
                      → per-question answer text, per-answer OCR confidence,
                        student name + roll number from the booklet header
2. Identify student   typed by faculty  >  read from booklet  >  guessed from file name
3. Save sheet         file → Storage answer-sheets/<examId>/<time>_<name>; row → answer_sheets
4. Save answers       one student_answers row per exam question (matched by label)
5. Grade              POST /evaluation/evaluate (all answers of the sheet + knowledge base)
6. Save grades        one evaluations row per answer (AI grade, JSON envelope)
7. Show result        score, status (Evaluated / Needs Review), link to the report
```

Sheets are processed one after another, with a live progress list. Measured on the BDA test set: about 10–55 seconds per sheet depending on pages and provider.

### 6.3 After grading

- **Review Queue:** only answers flagged as uncertain or hard to read. Faculty accept the AI mark or set a new one. Either way, a teacher evaluation row is saved and the answer leaves the queue.
- **Evaluation Report (per student):** question by question, with the student's answer, the model answer, marks per criterion with reasons, deductions, feedback, an override control, approval and a PDF download.
- **Class Analysis:** class averages, score bands, most-missed key points, and marks earned per criterion.
- **Export:** CSV / JSON / printable PDF gradebook, and printable report cards for all students.
- **Audit Trail:** every grading run, override, approval, OCR correction, export and deletion, stored in `audit_events`.
- **OCR correction:** editing a transcription saves it and **re-grades** that answer automatically.

---

## 7. How documents are read

| Document | Typical form | How it is read |
|---|---|---|
| Question paper | Typed PDF | Text extracted with PyMuPDF and sent to a cloud **text** model to structure into questions (labels like `Q1(a)`, marks). Scans/images go to a **vision** model instead. Fallback: RapidOCR + rule-based segmentation. |
| Rubric | Typed PDF (tables) | Same as above. The model returns rows typed `criterion` / `deduction` / `guideline`. |
| Answer key | Typed PDF / DOCX / TXT / pasted text | Read directly, with no AI needed (`agents/concept_agent/answer_key.py`). Split by rules; a cloud text model is used only if the rules find fewer than half the questions. |
| Student answer sheet | Scanned handwriting (PDF/images) | PDF rendered to page images (200 DPI), each page sent separately to a cloud **vision** model with the exam's question labels; pages merged. Fallback: RapidOCR. |

**Handwriting reading details** (`agents/ocr_agent/gemini_ocr.py`):
- The model is told the exact question labels, so `1 a`, `Q1. a)` and `Ans 1(a)` all map to `Q1(a)`.
- Text at the top of a page that continues the previous page's answer is returned under `_continued` and appended to that answer.
- Each answer gets a **confidence** (0–1). The model is asked to lower it for messy, faint, crossed-out or guessed words. An answer spanning pages keeps its lowest confidence.
- The first page also returns the student's **name and roll number** from the booklet header.
- Images are resized to at most 1600 px and sent as JPEG, to fit free-tier token limits.

**Answer-key splitting rules** (`split_by_questions`):
- A new answer starts at a line beginning with a marker: `Q1(a)`, `Q.1 a)`, `Ans 2(b):`, `1(a)`, `(b)`, `b)`. A bare `(b)` belongs to the last question number seen.
- A bare number like `3 types of data…` counts only with a `Q`/`Ans` prefix or punctuation (`3.`, `3)`, `3:`).
- Answers must appear in question order. A marker for an earlier or already-seen question is treated as answer text, which protects list items like `a)` inside an answer.
- **Cleanup** (`_clean_answer`):
  - The repeated question text before a `[5 Marks]` tag is removed.
  - Lines the PDF hard-wrapped mid-sentence are re-joined, keeping bullets and paragraphs.

---

## 8. The knowledge base

Built per question by `agents/concept_agent/knowledge_builder.py`. Stored in `answer_keys.model_answer` and `answer_keys.rubric_criteria`.

```json
{
  "model_answer": "Big Data refers to datasets ... Volume—the amount of data ...",
  "concepts": ["Volume—the amount of data, such as billions of social-media posts", "..."],
  "criteria": [
    { "criterion": "Volume + example", "description": "amount/size; TB/PB; 0.5 meaning + 0.5 example",
      "marks": 1.0, "concepts": ["Volume—the amount of data, such as ..."] }
  ],
  "rules": ["A point only named earns at most half ...", "Replacing a V with Visualization: 0 for that V"]
}
```

**How it is built:**
1. **Key points** (`extract_key_points`) are the model answer's sentences, bullet lines and `;` clauses, so faculty can read them. If the answer is a single long sentence, KeyBERT keyphrases are used instead, then keyword frequency.
2. **Criteria normalisation:**
   - With no rubric criteria, there is one criterion, "Content and accuracy", worth the full marks.
   - If the rubric marks don't add up to the question's marks, they are scaled to fit (rounded to 0.25).
3. **Key points are attached to criteria** by meaning (MiniLM similarity):
   - A point goes to the single criterion it clearly matches (similarity ≥ 0.35).
   - Criteria within 0.08 of the best match share it.
   - If no criterion matches clearly (generic rubric wording such as "Identifies the Vs"), the point counts toward **every** criterion.
   - Every criterion is guaranteed at least one point when possible.
4. **Rules** are the rubric's general guidelines plus that question's deduction rules.

**Faculty can edit everything in wizard step 4:** model answers, criteria and their marks, key points per criterion, and rules. "Rebuild key points from model answer" re-runs steps 1–3 for one question.

---

## 9. How grading works

Implemented in `agents/evaluation_agent/scorer.py`, called through `POST /evaluation/evaluate` once per answer sheet.

### 9.1 Local grading (always runs, no internet needed)

For **each criterion** of a question:

1. **Concept coverage** (`concept_matcher.py`). Each of the criterion's key points is checked against the student answer, split into phrases:
   - **covered:** meaning similarity ≥ **0.60**, or a literal / stem / synonym match (`knowledge_base.py`)
   - **partial:** similarity ≥ **0.45**, worth half credit
   - **missing:** otherwise
   - `coverage = (covered + 0.5 × partial) / number of points`
2. **Similarity** (`semantic_matcher.best_chunk_similarity`):
   - The criterion (name + description + its points) is compared with the closest one or two consecutive sentences of the answer.
   - MiniLM cosine similarity is rescaled from the band **[0.20, 0.85]** to [0, 1].
3. **Criterion mark** = `round_to_0.25( (0.6 × coverage + 0.4 × similarity) × criterion marks )`.
4. **Status:** **met** if ≥ 80% of the criterion's marks, **partial** if ≥ 30%, otherwise **missed**.
5. **Reason**, e.g. *"Covered: Volume, Velocity. Only partly explained: Value. Missing: Veracity."*

**Special cases:**
- Empty answer: 0 marks, all criteria "missed", confidence 0.95.
- No answer key: 0 marks, flagged for review.

### 9.2 Cloud second opinion (when a provider is available)

- **One cloud call per sheet** grades all its answers criterion by criterion, in **0.25-mark steps**. The prompt includes:
  - question
  - model answer
  - each criterion's partial-credit rule
  - the question's rules and deductions
  - the student answer
  - the instruction to judge meaning, not spelling
- The model returns marks and a one-sentence reason per criterion, a **deduction** (for misconceptions listed in the rules, capped at 2 marks) and student feedback.
- **Final criterion mark** = `round_to_0.25( 0.5 × local + 0.5 × cloud )` (`LLM_WEIGHT = 0.5`).
  - The cloud reason becomes the displayed reason; the local reason is kept as `local_check`.
- **Question total** = sum of criterion marks, capped at the question's marks, minus the deduction (never below 0).
- If the cloud reply is malformed for an answer, that answer keeps its local grade.

### 9.3 Output per answer

```
marks_awarded, max_marks, confidence, needs_review, engine ("local" | "hybrid"),
criteria[ {criterion, marks, marks_awarded, status, reason, local_check?,
           concepts_covered, concepts_partial, concepts_missed} ],
deduction, deduction_reason,
rationale  ("Scored 2/5. Lost marks on: … Strong on: … Deducted 0.5: …"),
feedback   (to the student), similarity
```

---

## 10. Confidence and the review queue

`agents/evaluation_agent/confidence.py` combines the grading signals into one confidence:

- **Signals** (each a fraction of full marks):
  - the local total
  - whole-answer similarity to the model answer
  - the cloud total (if it ran)
- `agreement = 1 − (max signal − min signal)`, capped at 0.6 if only one signal exists
- `confidence = 0.4 × OCR confidence + 0.6 × agreement`
- **Needs review** if confidence < **0.75**, or any two signals differ by more than **0.3** of full marks.

The frontend (`src/lib/grading.js → needsFacultyReview`) puts an answer in the **Review Queue** when:
- it is flagged **needs review**, or
- its handwriting confidence is below **0.8** (the "Hard to read" badge).

It leaves the queue once faculty accept or set a mark.

---

## 11. The cloud AI provider chain

`agents/llm.py` is the only module that calls cloud AI.

- **Entry point:** `call_llm(prompt, image_paths, task="vision"|"text") → (json_text, "provider:model")`.
- **Order:** `LLM_PROVIDERS` (default `groq,gemini`). Providers without an API key are skipped.
- **Rate limits:**
  - A per-minute limit (HTTP 429 with a short retry time, ≤ 45 s) is waited out once.
  - A longer limit (daily quota) blocks that provider/model until Google's or Groq's retry time, or for 10 minutes, and the next provider is tried.
  - When everything is blocked, callers fall back to local models.
- **Output handling:** JSON mode is requested; reasoning tags and ```json fences are stripped.
- **Free-tier figures observed during development** (they change; check each provider's console):

| Provider | Model (task) | Observed free limits |
|---|---|---|
| Groq | `qwen/qwen3.8-27b` (vision), `openai/gpt-oss-120b` (text) | 1,000 requests/day, **8,000 tokens/minute** |
| Gemini | `gemini-3.5-flash-lite` (vision), `gemini-flash-lite-latest` (text) | ~500 requests/day (third-party figure); `gemini-3.5-flash` only ~20/day |

- **Calls per evaluated sheet:** one per page (reading) + one (grading) ≈ 2–4.
- **Calls per exam setup:** about 2 (question paper + rubric), plus 1 only if the answer key needs AI splitting.
- `gemini-2.5-flash-lite` is retired for new keys; `gemini-2.5-flash` free quota is ~20/day.

---

## 12. Frontend screens

Navigation is a single view switch in `src/App.jsx` (`currentView`); there is no URL router.

| View key | Component | Purpose |
|---|---|---|
| (logged out) | `AuthView` | Sign in / sign up; "Try Demo Mode" (sample data, school-themed and outdated) |
| `dashboard` | `DashboardView` | Totals, pending review, average confidence and score, recent exams (subject, semester, status) |
| `create-exam` | `CreateExamWizard` + `AnswerKeyStep`, `KnowledgeReviewStep`, `CriteriaEditor` | 4-step exam setup |
| `exam-detail` | `ExamDetailView` | Exam stats; buttons for Evaluate Papers, Review Queue (count), Class Analysis, All Student Reports; submissions table |
| `upload-sheets` | `EvaluatePapersView` | Bulk upload with name and roll number per file, live progress, per-paper score and report link |
| `review-approve` | `ReviewApproveView` | Evaluation Report: per-question answer vs model answer, marks by criterion, why this score, feedback, override, approve, PDF |
| `review-queue` | `ReviewQueueView` | Flagged answers across the exam; accept or change the mark |
| `class-analysis` | `ClassAnalysisView` | Per-question average, score bands, most-missed points, % earned per criterion |
| `ocr-review` | `OCRReviewView` | Edit transcriptions (triggers re-grading) |
| `results` | `ResultsView` | Exam-level averages and score distribution |
| `audit` | `AuditTrailView` | Audit events |
| `export` | `ExportView` | CSV / JSON / PDF gradebook (LMS integrations shown as "coming soon") |
| `settings` | `ProfileView` | Teacher profile |

**Frontend modules (`src/lib`):**

| File | Role |
|---|---|
| `supabaseClient.js` | Supabase client (from `.env.local`, with a hardcoded fallback project) |
| `api.js` | All Supabase reads and writes. Every newer column has a fallback for when its migration is missing (PostgREST `PGRST204`). |
| `backendApi.js` | Calls to the FastAPI backend |
| `pipeline.js` | `processAnswerSheet()`: the per-sheet OCR → save → grade → save pipeline |
| `grading.js` | Grade mapping, submission totals and status, exam stats, review-queue rule, evaluation JSON envelope, point labels |
| `exportResults.js` | Gradebook building, CSV/JSON download, printable class report and student report cards |
| `academics.js` | Program, subjects (BDA available; others "coming soon"), semesters (default VII) |

**State (`src/context/AppContext.jsx`):**
- Holds the user, exams, submissions and audit events.
- Loads exams and submissions **together** on login so screens never show an exam without its sheets.
- Derives exam statistics from real submissions, and re-resolves the active exam and submission so open screens see updates.
- Provides actions: override, approve, OCR edit (+ re-grade), create/delete exam, and `logAudit`.

---

## 13. Backend API reference

Base URL `http://localhost:8000`. Interactive docs: `/docs`. CORS allows `http://localhost:5173`.

| Method & path | Input | Output |
|---|---|---|
| `GET /health` | — | `{status: "ok"}` |
| `POST /ocr/extract-questions` | multipart `file` (PDF/image) | `{status, engine, questions:[{id, text, marks, choice_group, condition}]}` |
| `POST /ocr/extract-rubric` | multipart `file` | `{status, engine, rubrics:[{type, question_id, criterion, max_marks, description}]}` |
| `POST /ocr/process` | multipart `file`, optional `question_labels` (JSON list), optional `answer_sheet_id` | `{status, engine, ocr_confidence, answers:{label:text}, answer_confidences:{label:0–1}, student:{name, roll_number}}` |
| `POST /knowledge/build` | multipart `questions` (JSON `[{label, text, max_marks, criteria, rules}]`) + `file` or `answer_key_text` | `{status, split_engine, knowledge:{label:{model_answer, concepts, criteria, rules}}, missing:[labels]}` |
| `POST /knowledge/rebuild` | JSON `{label, text, max_marks, criteria, rules, model_answer}` | `{status, knowledge}` |
| `POST /evaluation/evaluate` | JSON `{answers:[{question_id, question_text, model_answer, student_answer, max_marks, ocr_confidence, criteria, rules}], use_gemini}` | `{status, results:[per-answer output, see §9.3]}` |
| `POST /concepts/extract` | JSON `{model_answer, max_concepts}` | `{status, concepts, engine}` |
| `POST /feedback/generate` | JSON `{marks_awarded, max_marks, concepts_covered, concepts_missed}` | `{status, feedback}` |

`use_gemini` turns the cloud second opinion on or off; the name is historical, and it covers every provider in the chain.

**Backend layout:**
- `backend/main.py` creates the app, adds CORS and includes the routers.
- `backend/config/supabase_client.py` is used only by the optional server-side save in `/ocr/process`.
- The MiniLM model loads once, lazily, on **CPU**. On Apple Silicon the MPS backend deadlocks in worker threads.
- Local grading runs in a 4-thread pool.

---

## 14. Database and storage

**Supabase project:** PostgreSQL with Auth and Storage. All writes come from the browser as the logged-in teacher.

| Table | Key columns | Notes |
|---|---|---|
| `teachers` | `id` (= auth user id), `name`, `email`, `institution` | Created at sign-up |
| `exams` | `id`, `teacher_id`, `title`, `subject`, `semester`, `total_marks`, `exam_date`, `status` | `status` is stored as `draft`; the displayed status is derived from submissions |
| `questions` | `id`, `exam_id`, `question_number` (position), `label` (`Q1(a)`), `question_text`, `max_marks` | |
| `answer_keys` | `question_id`, `model_answer`, `rubric_criteria` (jsonb: `{criteria, concepts, rules}`) | The knowledge base |
| `answer_sheets` | `id`, `exam_id`, `file_url`, `upload_status` (`uploaded` / `approved`), `student_name`, `roll_number` | Approval is stored in `upload_status` |
| `student_answers` | `id`, `answer_sheet_id`, `question_id`, `ocr_text`, `ocr_confidence` (0–1) | One row per question per sheet |
| `evaluations` | `id`, `student_answer_id`, `marks_awarded`, `confidence_score` (0–100), `needs_review`, `feedback`, `created_at` | `feedback` holds a JSON envelope (below) |
| `audit_events` | `id`, `teacher_id`, `exam_id`, `exam_title`, `event`, `detail`, `actor`, `actor_type`, `severity`, `created_at` | Row-level security: teachers read and insert only their own rows |

**Evaluation envelope** (`evaluations.feedback`):
- **AI rows:** `{"source":"ai","rationale":…,"feedback":…,"conceptsMissed":[…],"criteria":[…]}`
- **Teacher rows:** `{"source":"teacher","note":…}`
- **On load:** the newest AI row is the grade and the newest teacher row is the override. Older plain-text rows are read as teacher notes.

**Storage:** bucket `answer-sheets`, path `<examId>/<timestamp>_<original file name>`; the public URL is saved in `answer_sheets.file_url`.

**Migrations** (`backend/migrations`, run in the Supabase SQL editor). All have been applied to the current project:

| File | Adds |
|---|---|
| `001_add_question_label.sql` | `questions.label` |
| `002_add_answer_sheet_student_fields.sql` | `answer_sheets.student_name`, `roll_number` |
| `003_create_audit_events.sql` | `audit_events` table + RLS policies |
| `004_add_answer_key_knowledge.sql` | `answer_keys.rubric_criteria` (jsonb) |
| `005_add_exam_semester.sql` | `exams.semester` |

**Deleting an exam** cascades in code: evaluations → student answers → answer sheets → answer keys → questions → exam.

---

## 15. Repository layout

```
SmartCheckAI/
├── index.html, vite.config.js, tailwind.config.js, postcss.config.js, .eslintrc.cjs, package.json
├── start.sh / stop.sh                 start/stop frontend (:5173) and backend (:8000) in the background
├── PROJECT_OVERVIEW.md                this document
├── PROJECT_PROGRESS_REPORT.md         progress, status, risks
├── PROJECT_STRUCTURE.md               file-level structure notes
├── CLAUDE_WORK.md                     change log of the AI-assisted development session
├── src/
│   ├── main.jsx, App.jsx, index.css
│   ├── context/AppContext.jsx         global state and actions
│   ├── components/                    screens (see §12)
│   ├── lib/                           api, backendApi, pipeline, grading, exportResults, academics, supabaseClient
│   └── data/mockData.js               demo-mode sample data
├── backend/
│   ├── main.py                        FastAPI app
│   ├── routes/                        ocr_routes, knowledge_routes, evaluation_routes, concept_routes, feedback_routes
│   ├── config/supabase_client.py
│   ├── migrations/001…005*.sql
│   ├── requirements.txt, .env.example
│   └── test_ocr.py, test_exam_paper.jpg, test_sample.jpg
├── agents/
│   ├── llm.py                         free cloud provider chain (Groq → Gemini)
│   ├── ocr_agent/                     gemini_ocr.py (vision reading via llm.py), ocr.py (RapidOCR/PaddleOCR),
│   │                                  preprocessing.py (deskew, denoise, CLAHE), segmentation.py (local label splitting)
│   ├── concept_agent/                 answer_key.py, knowledge_builder.py, concept_extractor.py, knowledge_base.py
│   ├── evaluation_agent/              scorer.py, concept_matcher.py, semantic_matcher.py, confidence.py
│   └── feedback_agent/                feedback_generator.py
├── eval/
│   ├── run_eval.py                    accuracy evaluation runner
│   ├── bda_reference_marks.csv        reference marks for the BDA test set
│   └── results_*/                     run outputs (log, raw JSON, comparison CSV)
└── graphify-out/                      code knowledge graph (graph.json, graph.html, GRAPH_REPORT.md)
```

---

## 16. Setup and running

### 16.1 Requirements
- macOS / Linux / Windows with **Node.js 18+** and **Python 3.11** (3.9 is too old for some dependencies).
- [`uv`](https://github.com/astral-sh/uv) is recommended for the Python environment.
- A **Supabase** project (URL + anon key) with migrations 001–005 applied.
- Optional, free: a **Groq** API key and/or a **Gemini** API key.
- About 1.5 GB of disk for Python packages. The MiniLM model (~90 MB) downloads from Hugging Face on first use.

### 16.2 Install
```bash
git clone https://github.com/ArnavParmaj/SmartCheckAI.git
cd SmartCheckAI
npm install
uv venv --python 3.11 backend/venv
VIRTUAL_ENV=backend/venv uv pip install -r backend/requirements.txt
cp backend/.env.example backend/.env      # fill in the keys
```
Create `.env.local` in the project root:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_BACKEND_URL=http://localhost:8000
```

### 16.3 Run
```bash
./start.sh      # frontend http://localhost:5173, backend http://localhost:8000 (docs: /docs)
./stop.sh
```
Logs go to `frontend.log` and `backend.log`. Both servers reload automatically on code changes.

### 16.4 Checks
```bash
npm run lint    # ESLint, 0 warnings allowed
npm run build   # production build
backend/venv/bin/python eval/run_eval.py /path/to/BDA_Test_Files --sets 2,3,4 --out eval/results_new
```

---

## 17. Configuration reference

**`backend/.env`** (git-ignored):

| Variable | Default | Meaning |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_KEY` | — | Supabase project URL and anon key (backend's optional server-side save) |
| `LLM_PROVIDERS` | `groq,gemini` | Cloud providers to try, in order |
| `GROQ_API_KEY` | — | Enables Groq |
| `GROQ_VISION_MODEL` | `qwen/qwen3.8-27b` | Groq model for images |
| `GROQ_TEXT_MODEL` | `openai/gpt-oss-120b` | Groq model for text |
| `GEMINI_API_KEY` | — | Enables Gemini |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Gemini model for images |
| `GEMINI_TEXT_MODEL` | `gemini-flash-lite-latest` | Gemini model for text |

**`.env.local`** (git-ignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_URL`.

**Grading constants** (in code; change them only with an accuracy re-run):

| Constant | File | Value |
|---|---|---|
| `COVERED_THRESHOLD` / `PARTIAL_THRESHOLD` | `evaluation_agent/concept_matcher.py` | 0.60 / 0.45 |
| `SIM_FLOOR`, `SIM_CEIL` | `evaluation_agent/scorer.py` | 0.20, 0.85 |
| `COVERAGE_WEIGHT` | `scorer.py` | 0.6 |
| `MET`, `PARTIAL` | `scorer.py` | 0.8, 0.3 |
| `MARK_STEP` | `scorer.py` | 0.25 |
| `LLM_WEIGHT` | `scorer.py` | 0.5 |
| `REVIEW_THRESHOLD`, `DISAGREEMENT_LIMIT` | `evaluation_agent/confidence.py` | 0.75, 0.3 |
| `CLEAR_MATCH`, `MARGIN` | `concept_agent/knowledge_builder.py` | 0.35, 0.08 |
| `LOW_OCR_CONFIDENCE` | `src/lib/grading.js` | 0.8 |
| `MAX_WAIT_SECONDS`, `DEFAULT_COOLDOWN_SECONDS`, `MAX_IMAGE_SIDE` | `agents/llm.py` | 45, 600, 1600 |

---

## 18. Testing and accuracy evaluation

### 18.1 Test data
`BDA_Test_Files` (kept outside the repo) contains:
- **3 sets (2, 3, 4)**, each with a question paper (4 × 5 marks), a detailed rubric (sub-marks, partial credit, deductions, 0.25 steps) and a typed answer key
- **5 handwritten answer sheets per set**, ranging from full answers to one-line answers with misconceptions

### 18.2 Reference marks
- `eval/bda_reference_marks.csv` holds marks for all 15 sheets, given **by the AI assistant** by reading each sheet against the rubric, before seeing the system's output.
- **They are not faculty marks.** Faculty-marked papers are still needed for a real calibration.

### 18.3 Running an evaluation
`eval/run_eval.py` runs each set through the real backend endpoints and writes `log.txt`, `raw.json` (OCR text, criteria, grades) and `comparison.csv` (AI vs reference per answer). The order is:

1. question paper
2. rubric
3. answer key
4. OCR of every sheet
5. grading

### 18.4 Results so far (60 answers, 3 sets)

| Run | Mean abs. error (of 5) | Within ±0.5 | Within ±1 | Bias | Errors > 1 mark (flagged) |
|---|---|---|---|---|---|
| Baseline | 0.58 | 65% | 82% | +0.46 | 11 (10) |
| After answer-key cleanup, deductions, 0.25 steps | **0.47** | 65% | **88%** | +0.40 | 7 (6) |

- Students are ranked in the same order as the reference marks in every set.
- The system is still **generous on weak answers**. Tuning was deliberately deferred.

### 18.5 UI testing
- A Playwright script (kept outside the repo) drove the full flow in a real browser with Set 2:
  - sign-up
  - 4-step setup
  - evaluating 5 sheets
  - report
  - review queue (accept)
  - class analysis
  - log out and back in (data persisted)
- It finished with 0 browser or server errors.
- An earlier end-to-end test against Supabase confirmed save and reload of every table.

---

## 19. Security model

- **Authentication:** Supabase email/password. The browser holds the user's session (JWT).
- **Authorisation:** writes come from the browser as the teacher, so Supabase RLS policies apply.
  - `audit_events` has explicit policies.
  - The RLS policies of the original tables have **not been audited**. This is a known gap.
- **Secrets:** `.env` / `.env.local` are git-ignored. The Supabase anon key is public by design. `src/lib/supabaseClient.js` contains a hardcoded fallback URL and key, which should be removed before production.
- **The backend has no authentication.** Anyone who can reach port 8000 can use the AI endpoints (and the cloud quota). It is intended to run locally for now.
- **Data sent to cloud AI:** question papers, rubrics, answer keys and student answer images and text are sent to Groq/Gemini when keys are set. Free tiers may use prompts to improve the providers' products. Consider this for student data (consent, India's DPDP Act).

---

## 20. Limitations and known issues

1. **Accuracy is calibrated only on 15 synthetic sheets** marked by the AI assistant. It needs faculty-marked real papers. It currently over-marks weak answers by ~0.4 marks per question on average.
2. **Free-tier limits.**
   - Groq: 8,000 tokens/minute (about 2 pages per minute).
   - Gemini Flash-Lite: ~500/day.
   - Large batches will slow down or fall back to local models, and local OCR reads handwriting poorly.
3. **Grading runs in the browser tab.** Closing the tab stops a batch. A server-side job queue is needed for scale.
4. **The knowledge base can't be edited after an exam is created**, and there is no "re-grade whole exam".
5. **Misconception deductions** are applied only by the cloud second opinion; local models can't detect them.
6. **Demo mode** uses outdated, school-themed sample data.
7. **No automated test suite** (unit, integration, end-to-end in CI) yet.
8. **Only one subject (BDA)**; other subjects are UI placeholders.
9. **Accessibility and mobile layout** have not been audited.

---

## 21. Roadmap

**Presentation-ready (short term):**
- Calibrate on faculty-marked papers.
- Edit the knowledge base after creation and re-grade.
- Refresh demo data with BDA content.
- Clearer error states.

**Industry-ready (later):**
- Backend authentication and rate limiting; RLS audit; remove hardcoded keys.
- Server-side job queue with retries and parallelism.
- Deployment (hosted frontend, containerised backend), monitoring and cost tracking.
- Automated tests and CI.
- Roles (admin / head of department / multiple faculty), releasing results to students, LMS integrations.
- More engineering subjects, and handling of math, diagrams and code answers.
- Privacy compliance (DPDP Act): consent, retention, local-only mode (e.g. Ollama vision models).

---

## 22. Glossary

| Term | Meaning |
|---|---|
| **Knowledge base** | Per question: model answer, key points, rubric criteria with the points that earn them, and marking rules |
| **Key point** | One sentence or clause of the faculty model answer, used as a unit of meaning to look for in student answers |
| **Criterion** | A rubric line with its own marks (e.g. "Volume + example, 1 mark") |
| **Rule / deduction** | A rubric instruction applied while marking (e.g. "Calling HDFS a database: deduct 0.5") |
| **Coverage** | Share of a criterion's key points the student covered (partly covered = half) |
| **Hybrid grading** | Local-model mark averaged with a cloud model's mark per criterion |
| **Confidence** | How sure the system is about a grade (OCR quality × agreement between signals) |
| **Review Queue** | Answers needing faculty attention: AI unsure or handwriting hard to read |
| **OCR** | Optical character recognition: reading text (here, handwriting) from images |
| **MiniLM** | `all-MiniLM-L6-v2`, the small local sentence-embedding model used for meaning comparison |
| **RLS** | Row-level security in Supabase/PostgreSQL |
| **PGRST204** | PostgREST error for an unknown column; the app uses it to fall back when a migration is missing |
