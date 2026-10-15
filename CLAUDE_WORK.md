# Claude's Work on SmartCheckAI

This document records every change Claude (an AI coding assistant) made to SmartCheckAI during one working session on **15 October 2026**, so anyone picking up the project knows what changed, why, and what is left.

The work was done on a fresh clone of `main` at commit `c485476`. **None of it is committed yet.** It exists only in the working copy on the laptop where it was done.

---

## Contents

1. [Summary](#1-summary)
2. [Local setup](#2-local-setup)
3. [Audit of the original progress report](#3-audit-of-the-original-progress-report)
4. [The new product flow](#4-the-new-product-flow)
5. [Backend changes](#5-backend-changes)
6. [The grading algorithm in detail](#6-the-grading-algorithm-in-detail)
7. [Gemini usage, quotas and models](#7-gemini-usage-quotas-and-models)
8. [Frontend changes](#8-frontend-changes)
9. [Database changes and data formats](#9-database-changes-and-data-formats)
10. [Bugs found and fixed](#10-bugs-found-and-fixed)
11. [Testing performed](#11-testing-performed)
12. [Docs, graph and tooling](#12-docs-graph-and-tooling)
13. [File-by-file change list](#13-file-by-file-change-list)
14. [Known limits and open items](#14-known-limits-and-open-items)
15. [How to run and verify](#15-how-to-run-and-verify)

---

## 1. Summary

At the start of the session the app could read question papers, rubrics and answer sheets with OCR. The three AI agents (concept, evaluation, feedback) were 5-line placeholder files, and the three API endpoints for them returned `"... placeholder"`. Uploaded answer sheets and OCR results lived only in browser memory and were lost on refresh.

By the end of the session:

- **Faculty exam setup is a 4-step wizard:** exam details → questions and rubric (rubric rows become marking criteria with marks) → **faculty's typed answer key** → **knowledge base review**. The answer key is split per question and turned into a knowledge base that every student answer is graded against.
- **Student papers are evaluated in bulk** on a new *Evaluate Papers* page: one file per student, name and roll number, live progress.
- **Grading is hybrid and criterion-wise:**
  - Local models (sentence-transformers, KeyBERT fallback) grade every rubric criterion and give a reason for each mark gained or lost.
  - Gemini, when available, gives a second opinion in one call per sheet, and the two are averaged.
  - Disagreement or low confidence sends the answer to a review queue.
- **Results:**
  - A per-student *Evaluation Report*, question by question.
  - A *Review Queue* listing only the uncertain answers.
  - A *Class Analysis* per question.
  - Printable PDF reports for each student.
  - Working CSV/JSON/PDF gradebook export.
  - A persistent audit trail.
- **Everything is saved to Supabase** and reloads after refresh. This was tested end to end against the live project.
- **4 SQL migrations were added; Arnav ran them**, and they were verified.
- ESLint was added and the codebase lints cleanly. Several real bugs were found and fixed (see §10).
- `PROJECT_PROGRESS_REPORT.md` was rewritten and the graphify graph rebuilt.

---

## 2. Local setup

Done on macOS (Apple Silicon), Node 24, system Python 3.9.6:

- Cloned the repo into `~/Desktop/arnav project/SmartCheckAI` and ran `npm install`.
- Created the backend venv with **Python 3.11** via `uv` at `backend/venv`, because system Python 3.9 is too old for some dependencies. Command: `uv venv --python 3.11 backend/venv && VIRTUAL_ENV=backend/venv uv pip install -r backend/requirements.txt`.
- Created `backend/.env` (`SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`) and `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_URL`). Both are git-ignored; the user filled in the keys.
- The Supabase project had been **paused** (its address didn't resolve, NXDOMAIN). Arnav restored it.
- Note: `src/lib/supabaseClient.js` contains a hardcoded fallback Supabase URL and anon key, used when `.env.local` is empty.
- `npm install` warns that it blocked the `fsevents` install script. This is harmless; run `npm approve-scripts fsevents` if file watching misbehaves.

---

## 3. Audit of the original progress report

Before building anything, the October 8 report was checked against the code and the running app. Findings:

| Report claim | Reality |
| :--- | :--- |
| Concept / evaluation / feedback agents at 15% | The files were 5-line docstrings; the endpoints returned placeholders. Effectively 0%. |
| "0 lint warnings" | ESLint wasn't installed; `npm run lint` failed with `eslint: command not found`. |
| `/ocr/process` saves transcripts to Supabase | The frontend never sent `answer_sheet_id`, so nothing was saved. Sheets and OCR text were in-memory only. |
| `google-generativeai` dependency | Not used; Gemini is called over REST with `urllib`. |
| OCR confidence | Hardcoded to `0.985` whenever Gemini was used. |
| `answer_keys.rubric_criteria` column exists | It did not exist (now added by migration 004). |
| Exam "average score" | `fetchTeacherExams` set `avgScore` to the exam's `total_marks`. |
| Results score-distribution bar | Hardcoded widths (30/35/20/15%). |
| Export | Fake: a 2-second timer, then "success"; no file was produced. |

---

## 4. The new product flow

This is the flow the user (on behalf of the faculty) asked for: *"faculty will only upload the required docs like question paper, rubrics and sample answer sheet, and this platform will accept student papers and evaluate them"*, with a report per student explaining, question by question, why marks were gained or lost. User decisions:
- Faculty upload papers in bulk.
- One file per student.
- The answer key is typed; student sheets are handwritten.
- Gemini is kept as a second option, not the main grader.

```
FACULTY SETUP (once per exam)                    EVALUATION (bulk)                    RESULTS
1 Exam details                                   Evaluate Papers page:                Evaluation Report (per student)
2 Question paper ─AI→ questions + marks           files + name + roll no.             Review Queue (uncertain answers)
  Rubric        ─AI→ criteria per question       for each file:                      Class Analysis (per question)
3 Typed answer key ─split by label→ model answers  upload → OCR (handwriting)          PDF reports, CSV/JSON/PDF export
4 Review knowledge base (edit model answers,       → save answers → grade per          Audit trail
  criteria, marks, key points) → Create Exam        criterion → save grades
```

---

## 5. Backend changes

### 5.1 New and rewritten agents

| File | Status | What it does |
| :--- | :--- | :--- |
| `agents/concept_agent/answer_key.py` | **New** | `read_typed_document()` reads text from `.pdf` (PyMuPDF), `.docx` (python-docx) or plain text. `split_by_questions()` splits it into `{label: model answer}` with a rule-based parser (see below). `gemini_split()` is a fallback used only when the rules find fewer than half the labels. `split_answer_key()` combines the two. |
| `agents/concept_agent/knowledge_builder.py` | **New** | `build_knowledge(question_text, model_answer, criteria, max_marks)` returns `{model_answer, concepts, criteria:[{criterion, description, marks, concepts}]}`. It normalises criteria (default single criterion "Content and accuracy"; marks scaled to add up to the question's marks) and attaches each key point to the criterion it matches. |
| `agents/concept_agent/concept_extractor.py` | Rewritten | `extract_key_points()` (primary) splits the model answer into sentences, bullets and `;` clauses, which read naturally for faculty. `extract_concepts()` is the fallback: KeyBERT (MMR, 1–3-word phrases, on the shared MiniLM model), then keyword frequency. `concept_label()` gives a short name for a point: the term before `:`, or its first 6 words. |
| `agents/concept_agent/knowledge_base.py` | Rewritten | Small synonym dictionary (e.g. `hdfs` ↔ "hadoop distributed file system") used in lexical matching. |
| `agents/evaluation_agent/semantic_matcher.py` | Rewritten | Lazily loads one shared `SentenceTransformer("all-MiniLM-L6-v2", device="cpu")`. `similarity()` is whole-answer cosine; `best_chunk_similarity()` gives the best match against any 1–2-sentence stretch of the answer. |
| `agents/evaluation_agent/concept_matcher.py` | Rewritten | `match_concepts()` labels each key point **covered** (similarity ≥ 0.60, or a literal/stem/synonym match), **partial** (≥ 0.45, half credit) or **missing**, and returns a coverage fraction. |
| `agents/evaluation_agent/confidence.py` | Rewritten | `combine(ocr_confidence, signals)` returns overall confidence `0.4·OCR + 0.6·agreement` and a needs-review flag (confidence < 0.75, or any two signals differ by more than 0.3). |
| `agents/evaluation_agent/scorer.py` | Rewritten | The hybrid criterion-wise grader (§6). Also `ensure_criteria()`, `gemini_grade_batch()` (one Gemini call per sheet) and the "why this score" summary text. |
| `agents/feedback_agent/feedback_generator.py` | Rewritten | `template_feedback()`: student-facing text built from covered and missing points. Gemini's wording replaces it when the second opinion ran. |
| `agents/ocr_agent/gemini_ocr.py` | Modified | Model names configurable; per-model quota cooldown; per-answer OCR confidence; the exam's question labels passed into the handwriting prompt (§7). |

**Answer-key splitting rules** (`split_by_questions`):
- A line starts a new answer if it begins with a marker such as `Q1(a)`, `Q.1 a)`, `Ans 2(b):`, `1(a)`, `(b)` or `b)`. A bare `(b)` belongs to the last question number seen.
- A bare number (`3 types of data…`) counts as a marker only with a `Q`/`Ans` prefix or punctuation after it (`3.`, `3)`, `3:`).
- Answers must appear in question order: a marker for an earlier or already-seen question is treated as answer text. This stops list items like `a)` inside an answer from starting a new section.

**Criterion assignment rule** (`knowledge_builder._assign_concepts`):
- A key point is placed under a single criterion only if it clearly matches it (similarity ≥ 0.35). Criteria within 0.08 of the best match share the point.
- If no criterion matches clearly, the point counts toward **every** criterion. This was needed because generic rubric wording such as "Identifies the Vs" scored 0.01–0.30 similarity against every key point; the previous behaviour assigned points almost at random.
- Faculty can narrow the assignments in the review step.

### 5.2 API routes

| Route | Status | Request → Response |
| :--- | :--- | :--- |
| `POST /knowledge/build` | **New** (`backend/routes/knowledge_routes.py`) | multipart: `questions` (JSON list of `{label, text, max_marks, criteria}`), plus `file` (answer key) or `answer_key_text` → `{status, split_engine, knowledge: {label: {model_answer, concepts, criteria}}, missing: [labels]}` |
| `POST /knowledge/rebuild` | **New** | JSON `{label, text, max_marks, criteria, model_answer}` → `{knowledge}`. Used when faculty edit a model answer. |
| `POST /evaluation/evaluate` | Rewritten | JSON `{answers:[{question_id, question_text, model_answer, student_answer, max_marks, ocr_confidence, criteria}], use_gemini}` → `{results:[{question_id, marks_awarded, max_marks, confidence, needs_review, rationale, feedback, criteria:[{criterion, marks, marks_awarded, status, reason, concepts_covered, concepts_partial, concepts_missed, local_check?}], concepts_covered, concepts_missed, similarity, engine}]}`. Gemini is called **once per request** (per sheet); local grading runs in a 4-thread pool. |
| `POST /concepts/extract` | Rewritten | `{model_answer, max_concepts}` → `{concepts, engine}` |
| `POST /feedback/generate` | Rewritten | `{marks_awarded, max_marks, concepts_covered, concepts_missed}` → `{feedback}` |
| `POST /ocr/process` | Modified | New optional form field `question_labels` (JSON list). Response adds `answer_confidences: {label: 0–1}`; `ocr_confidence` is now their mean (no hardcoded 0.985). |
| `backend/main.py` | Modified | Registers the knowledge router. |
| `backend/requirements.txt` | Modified | Added `python-docx`. |

The backend's own Supabase save path in `/ocr/process` (used only when `answer_sheet_id` is sent) now matches answers by **full label** using `questions.label`, and skips answers it can't match. Previously it took the first number of the label, so `Q1(b)` was saved under `Q1(a)`. The app itself saves from the browser and doesn't use this path.

---

## 6. The grading algorithm in detail

For one answer, with criteria from the knowledge base (`scorer.grade_answer`):

1. **No answer key** → 0 marks, needs review ("could not be graded").
2. **Empty student answer** → 0 marks, every criterion "missed", confidence 0.95, no review needed.
3. **For each criterion (local):**
   - `coverage` = (covered + 0.5 × partial) / number of key points.
   - `sim` = `best_chunk_similarity(criterion + description + key points, answer)`, rescaled from the MiniLM band [0.20, 0.85] to [0, 1].
   - `fraction` = 0.6 × coverage + 0.4 × sim (only sim if the criterion has no key points).
   - Marks = round to 0.5 × criterion marks. Status: met if fraction ≥ 0.8, partial if ≥ 0.3, else missed.
   - Reason, e.g. `"Covered: Volume. Only partly explained: Value. Missing: Veracity."`
4. **Gemini second opinion** (if available): marks and a one-sentence reason per criterion for every answer of the sheet in one call. Each criterion's mark is `round_half((local + gemini) / 2)`. Gemini's reason becomes the shown reason, and the local reason is kept as `local_check`.
5. **Confidence:**
   - Signals are the local total fraction, the whole-answer similarity (rescaled) and Gemini's total fraction.
   - Confidence = `0.4 × OCR + 0.6 × (1 − spread of signals)`, with agreement capped at 0.6 if only one signal exists.
   - The answer needs review if confidence < 0.75 or the spread is > 0.3.
6. **Summary:** e.g. `"Scored 2/5. Lost marks on: Identifies the Vs (-1: …); Relates to e-commerce (-2: …). Strong on: …"`

**Calibration so far:**
- The thresholds were tuned on hand-made Big Data answers. Key points: correct explanations scored 0.60–0.72, vague mentions 0.45–0.60, wrong < 0.45, off-topic ≈ 0.
- **They have not been checked against real faculty-marked papers.** That is the main open item.

**Performance:**
- MiniLM runs on **CPU deliberately.** On Apple Silicon the default MPS (GPU) backend hangs when the model is first used from a worker thread, which froze the server (see §10).
- About 9 s to grade 4 answers locally on the M-series Mac.
- The model downloads once (~90 MB, from Hugging Face) on first use.

---

## 7. Gemini usage, quotas and models

- **Free tier:** 20 requests per day **per model**. Testing exhausted `gemini-2.5-flash` (*"Quota exceeded … limit: 20 … retry in 8h15m"*).
- `gemini-2.5-flash-lite` is **retired for new API keys** (404, "use gemini-3.5-flash-lite").
- **Models now used** (both configurable through env vars in `backend/.env`):
  - `GEMINI_MODEL`, default **`gemini-3.5-flash`**: reading question papers, rubrics and handwriting.
  - `GEMINI_TEXT_MODEL`, default **`gemini-flash-lite-latest`**: text-only tasks (grading second opinion, answer-key split fallback).
- **Quota cooldown:** on HTTP 429, `_call_gemini_vision` reads Google's `retryDelay` (default 10 min) and marks that model unavailable until then; `is_gemini_available(model)` returns `False` meanwhile. Everything falls back to local models automatically.
- **Calls per paper:** 1 to read the sheet plus 1 to grade the whole sheet (batched). 200 papers ≈ 400 calls, so **a paid key is needed for real use.**
- **Handwriting:** Gemini is the main reader because local RapidOCR is built for printed text. The prompt now asks for a per-answer `confidence` (legibility) and is given the exam's question labels, so `1 a`, `Ans 1(a)` and `1.a` all map to `Q1(a)`.

---

## 8. Frontend changes

### 8.1 New files

| File | Purpose |
| :--- | :--- |
| `src/lib/pipeline.js` | `processAnswerSheet(exam, fileItem, {isDemo, onStage})`: upload to storage and `answer_sheets` → OCR with question labels → match answers to exam questions by normalised label (unmatched labels reported) → save `student_answers` → grade → save AI `evaluations`. Returns the submission and warnings. |
| `src/lib/grading.js` | `gradeAnswers()` calls the backend and maps results onto answers (`aiScore`, `aiConfidence`, `aiRationale`, `aiFeedback`, `aiCriteria`, `needsReview`…). Also `summarizeSubmission()` (totals and status), `examStats()` (exam averages from real submissions), `needsFacultyReview()` (review-queue rule), `pointLabel()`, and `encodeEvaluation()` / `decodeEvaluation()` (§9). |
| `src/lib/exportResults.js` | Gradebook builder (columns follow the include options), CSV with proper escaping, JSON export, file download, printable class report, and `openStudentReports()` (one page per student, "Save as PDF" from the print dialog). |
| `src/components/CriteriaEditor.jsx` | Editable criteria list (name, marks, description). With `showPoints`, also edits each criterion's key points. Warns when criteria marks don't add up to the question's marks. |
| `src/components/AnswerKeyStep.jsx` | Wizard step 3: upload a typed `.pdf/.docx/.txt` or paste text → `/knowledge/build`; shows which questions had no model answer. |
| `src/components/KnowledgeReviewStep.jsx` | Wizard step 4: per question, model answer textarea, "Rebuild key points" (`/knowledge/rebuild`) and the criteria editor with key points. |
| `src/components/EvaluatePapersView.jsx` | Bulk evaluation page (route `upload-sheets`): drag-and-drop, name and roll number per file, sequential processing with live stage text and a progress bar, per-paper score, status and "Report" link. Blocks evaluation if any question has no answer key. |
| `src/components/ReviewQueueView.jsx` | Route `review-queue`: every answer needing review across the exam, with "AI unsure" / "Hard to read" badges, student answer, model answer, per-criterion marks, and "Accept" or "Save new mark". |
| `src/components/ClassAnalysisView.jsx` | Route `class-analysis`: per question, class average, score bands, not-attempted count, most-missed key points (% of students) and % of marks earned per criterion. |
| `.eslintrc.cjs` | ESLint 8 config (recommended, react, react-hooks, react-refresh). |

### 8.2 Modified files

- **`CreateExamWizard.jsx`:** rebuilt into 4 setup steps; sheet upload moved out to Evaluate Papers. Each rubric row from `/ocr/extract-rubric` becomes a criterion of the question with the same label (unmatched rows reported); the old version kept only the first row as text. "Create Exam" stays disabled until every question has a model answer. After creating, it goes to the exam page.
- **`ReviewApproveView.jsx`:**
  - Renamed "Evaluation Report".
  - Each question shows the student answer (with a "Hard to read" badge when OCR confidence < 0.8), a collapsible faculty model answer, a "Marks by criterion" list with met/partly met/missed icons and reasons, a "Why this score" summary, and feedback (with missed points) in the explanation modal.
  - Adds a "View original sheet" link and a **PDF** button; half marks work in overrides.
  - Fixed: hooks were called after an early `return` (see §10).
- **`ExamDetailView.jsx`:** "Evaluate Papers", "Review Queue (n)", "Class Analysis" and "All Student Reports" buttons; average score shown as %; the "OCR Review" button was opening `submissions[1]` (now gone).
- **`AppContext.jsx`:**
  - Loads saved submissions and audit events on login and refresh.
  - `overrideScore` saves a teacher evaluation row and logs to the audit trail.
  - `approveSubmission` saves the approval.
  - `updateOcrText` updates the existing row (no duplicate inserts) and **re-grades** the corrected answer.
  - `logAudit()` keeps events in state and in Supabase.
  - Exam stats are derived from real submissions; `activeExam` and `activeSubmission` are re-resolved from state so open screens see updates.
- **`api.js`:**
  - Exams load with questions and answer keys (`modelAnswer`, `criteria`, `concepts`, `label`).
  - `fetchTeacherSubmissions()` rebuilds submissions from `answer_sheets → student_answers → evaluations`.
  - `createExamInDB()` saves the label and knowledge base.
  - `uploadAnswerSheetDB()` saves name, roll number and the original file name in the storage path.
  - `saveStudentAnswerOCR()` updates by id or inserts.
  - New: `approveAnswerSheetDB()`, `fetchAuditEvents()`, `saveAuditEvent()`.
  - Every new column has a fallback for when its migration hasn't been run (PostgREST error `PGRST204`).
- **`backendApi.js`:** `buildKnowledge()`, `rebuildKnowledge()`, and `processAnswerSheetOCR(file, sheetId, questionLabels)`.
- **`ExportView.jsx`:** real CSV/JSON download and PDF via print. The non-working "Excel" option was removed (CSV opens in Excel) and the LMS buttons are marked "coming soon".
- **`ResultsView.jsx`:** the score distribution is computed from real submissions.
- **`ExamsView.jsx`, `ExportView.jsx`:** use real submissions instead of mock data.
- **`App.jsx`:** routes `upload-sheets` → EvaluatePapersView, plus `review-queue` and `class-analysis`.
- Lint cleanups in `DashboardView`, `ProfileView`, `Toast`, `TopBar` and `OCRReviewView` (unused imports; a fake "low-confidence word" highlighter that was never used was removed).

---

## 9. Database changes and data formats

### 9.1 Migrations (`backend/migrations/`): run by Arnav and verified

| File | Change |
| :--- | :--- |
| `001_add_question_label.sql` | `questions.label text`: the printed label `Q1(b)`; `question_number` is only the position |
| `002_add_answer_sheet_student_fields.sql` | `answer_sheets.student_name text`, `answer_sheets.roll_number text` |
| `003_create_audit_events.sql` | `audit_events` table with RLS: a teacher can read and insert only rows where `teacher_id = auth.uid()` |
| `004_add_answer_key_knowledge.sql` | `answer_keys.rubric_criteria jsonb`: the reviewed knowledge base |

All are additive (`if not exists`). A read-only check after Arnav ran them passed for all four. The `audit_events` RLS policies haven't been exercised yet; creating an exam and refreshing the Audit Trail will confirm them.

### 9.2 Data formats to know about

- **`answer_keys`:** `model_answer` = faculty model answer; `rubric_criteria` = `{"criteria": [{criterion, description, marks, concepts: [key points]}], "concepts": [all key points]}`.
- **`evaluations.feedback`** holds a **JSON envelope**, because the table has a single text column:
  - AI row: `{"source":"ai","rationale":…,"feedback":…,"conceptsMissed":[…],"criteria":[…]}`
  - Teacher row: `{"source":"teacher","note":…}`
  - On load, the newest AI row is the AI grade and the newest teacher row is the override. Older plain-text rows are read as teacher notes.
  - `confidence_score` is stored as a percentage (0–100); `marks_awarded` can be a half mark.
- **Approval** is stored as `answer_sheets.upload_status = 'approved'` (otherwise `'uploaded'`).
- **Storage path:** `answer-sheets/<examId>/<timestamp>_<original file name>`.
- **`student_answers.ocr_confidence`** is 0–1 per answer.
- **`exams.status`** is still saved as `'draft'`; the displayed status is derived from submissions ("Needs Review" / "Completed").
- **All saving happens in the browser as the logged-in teacher.** The backend only has the `anon` key, which RLS would likely block for writes.

---

## 10. Bugs found and fixed

1. **Answers saved under the wrong question:** `Q1(b)` was mapped to question 1 (`Q1(a)`). Now matched by full label everywhere.
2. **Sheets and OCR text never saved; edits and overrides silently failed:** they used temporary IDs like `q1` / `sub-…` that don't exist in the database.
3. **OCR text edits inserted duplicate rows** (an `upsert` without an id is an insert). Now updates by id.
4. **Server hang during grading:** sentence-transformers on Apple's MPS backend deadlocks when first used from a thread. Fixed by forcing `device="cpu"`.
5. **React hooks after an early `return`** in `OCRReviewView` and `ReviewApproveView`, which could crash when switching submissions. Split into a wrapper plus a content component, keyed by submission id.
6. **"Upload Answer Sheets" on an exam opened the create-exam wizard,** which would create a duplicate exam. Now opens Evaluate Papers for that exam.
7. **Half marks truncated** (`parseInt`) in overrides. Now `parseFloat` with `step=0.5`.
8. **Exam average showed total marks; Results chart, export and confidence were fake.** Replaced with real values (see §3).
9. **Live exams with no submissions showed mock students** in some screens (`ExamsView`, `ExportView` used mock data directly).

---

## 11. Testing performed

**End to end against live Supabase:** a throwaway teacher account, real OCR and grading, then cleanup.

```
PASS signup, question extraction (Q1(a), Q1(b), Q2(a))
PASS questions + rubrics saved
PASS answer sheet uploaded to storage and saved
PASS OCR per-answer confidence
PASS answers saved under matching questions
PASS AI grades saved (hybrid)
PASS approval saved
PASS reload restores exam, questions, rubrics, answers, AI grades, override, approval
PASS cleanup (test exam, files, rows deleted)
```

Run before the migrations; the label and student columns used their fallbacks and the audit table didn't exist yet. A second test confirmed the knowledge-base save path.

**Grading on sample answers** (5-mark Big Data question, criteria "Identifies the Vs" 3 + "Relates to e-commerce" 2):

| Answer | Local only | Hybrid |
| :--- | :--- | :--- |
| Full, with examples | 4/5 | 5/5 |
| Names 3 Vs, no examples | 2.5/5 | 2/5 (1.5/5 batched) |
| "Big data is a lot of data" | 1/5 | 0.5/5, flagged for review |
| Off-topic / blank | 0 | 0 |

**Other checks:**
- Answer-key splitting on mixed label styles and on list items inside answers.
- CSV export escaping.
- All API endpoints through the running server.
- `npm run lint` (0 errors, 0 warnings) and `npm run build` pass.

**Not yet tested:**
- The newest screens (answer-key steps, Evaluate Papers, Review Queue, Class Analysis, PDF reports) clicked through in a browser.
- Grading accuracy against faculty marks on real handwritten papers.

---

## 12. Docs, graph and tooling

- **`PROJECT_PROGRESS_REPORT.md`:** fully rewritten for 15 Oct (status, flow, algorithm, testing, migrations, risks, remaining work).
- **graphify graph:** rebuilt with `uvx --from graphifyy==0.9.73 graphify update .`.
  - Pinned to an older release, run in a throwaway environment, and not added to the project's dependencies.
  - It now has 430 nodes and 905 edges (was 271 and 433); the previous graph is archived in `graphify-out/2026-10-15/`.
  - It is a **code-only** update: the progress-report nodes still reflect the 8 Oct document, because refreshing documents needs an AI service (`graphify extract`).
  - The SQL migrations aren't in the graph (graphify's SQL extra isn't installed).
- **ESLint 8.57.1** + `eslint-plugin-react`, `react-hooks`, `react-refresh` added as dev dependencies (`package.json` / `package-lock.json`).
- **This file**, `CLAUDE_WORK.md`.

---

## 13. File-by-file change list

**New:**
- `.eslintrc.cjs`, `CLAUDE_WORK.md`
- `agents/concept_agent/answer_key.py`, `agents/concept_agent/knowledge_builder.py`
- `backend/routes/knowledge_routes.py`, `backend/migrations/001…004*.sql`
- `src/lib/pipeline.js`, `src/lib/grading.js`, `src/lib/exportResults.js`
- `src/components/AnswerKeyStep.jsx`, `KnowledgeReviewStep.jsx`, `CriteriaEditor.jsx`, `EvaluatePapersView.jsx`, `ReviewQueueView.jsx`, `ClassAnalysisView.jsx`
- `graphify-out/2026-10-15/` (archive of the previous graph)

**Modified:**
- `agents/concept_agent/concept_extractor.py`, `knowledge_base.py`
- `agents/evaluation_agent/scorer.py`, `concept_matcher.py`, `semantic_matcher.py`, `confidence.py`
- `agents/feedback_agent/feedback_generator.py`, `agents/ocr_agent/gemini_ocr.py`
- `backend/main.py`, `backend/requirements.txt`
- `backend/routes/ocr_routes.py`, `evaluation_routes.py`, `concept_routes.py`, `feedback_routes.py`
- `src/App.jsx`, `src/context/AppContext.jsx`, `src/lib/api.js`, `src/lib/backendApi.js`
- `src/components/CreateExamWizard.jsx`, `ReviewApproveView.jsx`, `ExamDetailView.jsx`, `ExamsView.jsx`, `ExportView.jsx`, `ResultsView.jsx`, `OCRReviewView.jsx`, `DashboardView.jsx`, `ProfileView.jsx`, `Toast.jsx`, `TopBar.jsx`
- `package.json`, `package-lock.json`, `PROJECT_PROGRESS_REPORT.md`
- `graphify-out/*` (rebuilt graph)
- `.DS_Store` (macOS metadata; it shouldn't be committed)

**Untouched:** OCR preprocessing and segmentation, `ocr.py`, auth, `Sidebar`, `AuthView`, `AuditTrailView` (it now just receives persisted events), `start.sh` / `stop.sh`, Tailwind config.

---

## 14. Known limits and open items

1. **Calibrate grading on 10–20 real faculty-marked papers.** Tune the thresholds in `concept_matcher.py` (0.60 / 0.45), `scorer.py` (60/40 weighting, met/partial cut-offs) and `confidence.py` (review at < 0.75, disagreement > 0.3).
2. **Paid Gemini key** before grading at scale (§7). Without Gemini, handwriting OCR falls back to RapidOCR, which reads handwriting poorly.
3. **Browser walkthrough** of the new screens; expect small UI fixes.
4. **Delete the test logins** in Supabase → Authentication: `smartcheck.e2e.1792072683@gmail.com` and `smartcheck.kb.1792079300@gmail.com`.
5. **Commit:** all work is uncommitted. Suggested: a new branch and a PR; leave out `.DS_Store`.
6. **Knowledge base can't be edited after an exam is created.** Faculty must get it right in step 4. Exams created before today have no answer key and can't be evaluated.
7. **Rubric wording matters:** generic criteria share all key points; faculty narrow them in step 4.
8. **Not built:** LMS integrations (marked "coming soon"); student-facing portal (faculty upload only, by design).
9. **Security:** the Supabase anon key and URL are hardcoded as a fallback in `src/lib/supabaseClient.js`. They are public by design, but the fallback ties every install to one project.

---

## 15. How to run and verify

```bash
./start.sh          # frontend http://localhost:5173, backend http://localhost:8000 (docs at /docs)
./stop.sh
npm run lint        # 0 errors, 0 warnings
npm run build
```

To check the whole flow manually:
1. Sign up.
2. **New Exam**: upload the question paper and rubric, upload a typed answer key, review the knowledge base, then **Create Exam**.
3. On the exam page, **Evaluate Papers**: add handwritten sheets with names and roll numbers, then evaluate.
4. Open a **Report** for a student, then check the **Review Queue** and **Class Analysis**, and download **All Student Reports**.
5. Refresh the page: everything, including the audit trail, should still be there.
