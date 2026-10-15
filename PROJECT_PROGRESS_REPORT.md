# SmartCheckAI — Project Progress Report

**Updated:** October 15, 2026 (previous report: October 8, 2026)
**Project:** SmartCheckAI — Agentic AI system for automated evaluation of handwritten answer sheets
**Contributors:** Arnav Parmaj (`arnavparmaj9@gmail.com`); this update's changes by `grishmarvipat@gmail.com`
**Git state:** last commit `c485476` on `main`. The work described in this update is **not committed yet**.

---

## 1. Summary

SmartCheckAI takes checking work off faculty. For each exam, faculty upload the **question paper**, the **marking rubric** and their **typed answer key** once, then check and approve the knowledge base built from them. After that they upload student answer sheets in bulk (one file per student). The system reads the handwriting, grades every answer **criterion by criterion** against the answer key, explains every mark gained or lost, and sends only the answers it is unsure about to a **review queue**.

**Overall completion: ~95% of planned scope.** Every planned feature is built. What remains:
- 4 database migrations for the project owner to run.
- Tuning grading accuracy on real marked papers.
- Confirming the newest screens in a browser.
- Committing the work.

| Area | Oct 8 report | Now | State |
| :--- | :--- | :--- | :--- |
| Frontend screens | 95% | ~95% | 4-step exam setup, Evaluate Papers, Evaluation Report, Review Queue, Class Analysis, Export |
| OCR (reading sheets) | 95% | ~95% | Gemini reads handwriting; local RapidOCR fallback; per-answer confidence |
| Answer key & knowledge base | — | ~90% | New. Typed answer key split per question, key points mapped to rubric criteria, faculty review |
| Grading agent | 15% (stub) | ~85% | Hybrid criterion-wise grader; needs tuning on real marked papers |
| Concept agent | 15% (stub) | ~90% | Key points from the answer key; KeyBERT fallback |
| Feedback agent | 15% (stub) | ~90% | Reasons per criterion + student feedback |
| Database & storage | 70% | ~85% | Save/reload tested end to end; 4 migrations pending |

The Oct 8 report rated the three AI agents at 15%, but they were 5-line placeholder files (effectively 0%). The new figures are based on code that was run and tested.

---

## 2. How it works

### 2.1 Exam setup (faculty, once per exam)
1. **Exam details**: title, subject, date.
2. **Questions & rubric**: question paper is read by AI into questions and sub-questions (`Q1(a)`, `Q1(b)`…) with marks; each rubric row becomes a marking criterion with its marks.
3. **Answer key**: typed PDF, Word (.docx) or text file, or pasted text. Read directly (no OCR) and split by question label. Rules first; Gemini is used only if the rules find fewer than half the questions.
4. **Review knowledge base**: per question, faculty see the model answer, the marks per criterion and the answer-key points that earn each criterion's marks. They can edit everything and rebuild key points. The exam can't be created until every question has a model answer.

### 2.2 Evaluation (bulk)
**Evaluate Papers** takes one file per student (images or PDF), with student name and roll number. Each sheet goes through: upload to storage → handwriting read into answers per question label → saved → graded → grades saved. Progress is shown per paper.

### 2.3 Grading (hybrid: local first, Gemini as second opinion)
For each rubric criterion of each question:
- **Concept coverage (local).** The criterion's key points from the answer key are matched in the student answer by meaning, using sentence-transformers `all-MiniLM-L6-v2`. A point counts as covered (similarity ≥ 0.60), partly covered (≥ 0.45, half credit) or missing.
- **Semantic similarity (local).** The criterion is compared with the closest one or two sentences of the answer.
- **Local criterion mark.** 60% coverage + 40% similarity, rounded to 0.5 marks, with a reason, e.g. *"Covered: Volume. Missing: Veracity, Value."*
- **Gemini second opinion (optional).** One call grades the whole sheet criterion by criterion; each criterion's final mark is the average of local and Gemini. If Gemini is unavailable or out of quota, grading continues locally.
- **Confidence.** OCR confidence plus agreement between the signals. The answer is flagged for review when confidence < 0.75 or the signals disagree by more than 30% of the marks.

### 2.4 Results
- **Evaluation Report (per student):** for each question, the student's answer (flagged when hard to read) next to the faculty model answer, then marks per criterion with met / partly met / missed and the reason, a "why this score" summary, feedback, the original sheet, teacher override, approval and a PDF download.
- **Review Queue:** only the answers that need checking (AI unsure, or handwriting hard to read). Faculty accept or change each mark.
- **Class Analysis (per question):** class average, score spread, answer-key points most often missed (e.g. "68% of students missed Veracity"), and marks earned per criterion.
- **Export:** gradebook as CSV, JSON or printable PDF, and all student reports as one PDF.
- **Audit trail:** grading runs, overrides, approvals, OCR corrections, exports and deletions.

---

## 3. Module status

| Module | Files | Status |
| :--- | :--- | :--- |
| OCR agent | `agents/ocr_agent/` | ✅ Gemini reads question papers, rubrics and handwriting; it is given the exam's question labels so answers map to `Q1(a)` etc. Local RapidOCR fallback (weak on handwriting). Per-answer confidence. |
| Answer key reader | `agents/concept_agent/answer_key.py` | ✅ PDF/DOCX/TXT text, rule-based split by label (handles `Q1(a)`, `(b)`, `Ans 2(a):`, `2 b)`), Gemini fallback |
| Knowledge builder | `agents/concept_agent/knowledge_builder.py` | ✅ Key points from the model answer, attached to rubric criteria; generic criteria share points |
| Grading agent | `agents/evaluation_agent/` | ✅ Criterion-wise hybrid scorer, concept matcher, semantic matcher, confidence |
| Feedback agent | `agents/feedback_agent/` | ✅ Template feedback from covered/missed points; Gemini wording when available |
| API | `backend/routes/` | ✅ `/ocr/*`, `/knowledge/build`, `/knowledge/rebuild`, `/evaluation/evaluate` (one Gemini call per sheet), `/concepts/extract`, `/feedback/generate` |
| Frontend | `src/components/`, `src/lib/` | ✅ See §2; shared pipeline in `src/lib/pipeline.js`, grading helpers in `src/lib/grading.js` |

---

## 4. Testing done

- **End-to-end against the live Supabase project**, with a throwaway account, cleaned up afterwards: sign-up → questions → answer sheet upload → OCR → answers saved under the right questions → AI grades saved → teacher override → approval → reload restores everything. All passed except the audit table, which needs migration 003.
- **Grading, local only** (sample Big Data answer, 5 marks): full answer 4/5, generic 2.5/5, weak 1/5, off-topic 0, blank 0.
- **Grading, hybrid, criterion-wise:** partial answer 1.5/5 (*"named volume, velocity and variety but missed veracity and value"*; *"no e-commerce examples"*); correct Hadoop answer 5/5; unanswered 0.
- **Answer-key splitting:** checked on mixed label styles and on list items such as `a)` inside an answer.
- **Lint and build:** `npm run lint` passes with 0 errors and 0 warnings (eslint was added in this update; it found and fixed a React hooks bug in two screens). `npm run build` passes.
- **Not yet verified:**
  - The newest screens (answer-key steps, Evaluate Papers, Review Queue, Class Analysis) haven't been clicked through in a browser.
  - Grading accuracy on real handwritten papers compared with faculty marks.

---

## 5. Database

Tables in use: `teachers`, `exams`, `questions`, `answer_keys`, `answer_sheets`, `student_answers`, `evaluations`, and the `answer-sheets` storage bucket.

**Migrations to run in the Supabase SQL editor** (`backend/migrations/`, in order). The app works before they are run, with the limits shown:

| File | Adds | Until it is run |
| :--- | :--- | :--- |
| `001_add_question_label.sql` | `questions.label` | Sub-question labels show as `Q1, Q2…` after reload |
| `002_add_answer_sheet_student_fields.sql` | `answer_sheets.student_name`, `roll_number` | Names come from the file name; roll numbers aren't kept |
| `003_create_audit_events.sql` | `audit_events` table + RLS | Audit trail is lost on reload |
| `004_add_answer_key_knowledge.sql` | `answer_keys.rubric_criteria` (jsonb) | Faculty edits to criteria and key points are lost on reload; they are rebuilt from the model answer at grading time |

Correction to the Oct 8 report: `answer_keys.rubric_criteria` and the `evaluations` columns listed there were not all present. `rubric_criteria` did not exist, hence migration 004. Evaluation rows store AI and teacher results in the `feedback` column as JSON tagged `source: "ai"` / `"teacher"`. Approval is stored as `answer_sheets.upload_status = 'approved'`.

---

## 6. Risks and limits

1. **Gemini free tier is far too small for real use.** It allows 20 requests per day per model. Reading a sheet takes 1 call and grading it takes 1 more (batched per sheet), so 200 papers need about 400 calls. **A paid Gemini key is needed for production.** Without Gemini, grading still works locally, but local OCR reads handwriting poorly.
   - Models used: `gemini-3.5-flash` for reading documents and handwriting, `gemini-flash-lite-latest` for text tasks. `gemini-2.5-flash-lite` has been retired for new keys.
   - Both can be changed with the `GEMINI_MODEL` / `GEMINI_TEXT_MODEL` env vars. When a model's quota runs out, it is skipped until Google's retry time.
2. **Grading accuracy is unproven on real papers.** The thresholds (0.60 / 0.45 coverage, 60/40 weighting, review at < 0.75) were tuned on a few sample answers. They need comparing with faculty marks on 10–20 real marked sheets.
3. **Rubric wording affects grading.** Generic criteria (e.g. "Identifies the Vs") can't be matched to answer-key points automatically, so those points count toward every criterion. Faculty can refine this in the review step.
4. **Security:** the backend uses the Supabase `anon` key; all saving is done by the logged-in teacher in the browser.

---

## 7. Remaining work

1. Run migrations 001–004 (project owner, ~5 min).
2. Delete the two test logins created during testing (`smartcheck.e2e.1792072683@gmail.com`, `smartcheck.kb.1792079300@gmail.com`) in Supabase → Authentication.
3. Browser walkthrough of the new screens with a real exam.
4. Calibrate grading on 10–20 real marked papers.
5. Commit this work and open a PR.
6. Get a paid Gemini key before grading at scale.
7. Not in scope: LMS integrations (Google Classroom, Canvas, Moodle) — shown as "coming soon".

---

## 8. Tech stack

- **Frontend:** React 18 + Vite 5 + Tailwind, Supabase JS client, ESLint 8.
- **Backend:** FastAPI + Uvicorn (Python 3.11 venv in `backend/venv`).
- **Local AI:** sentence-transformers `all-MiniLM-L6-v2` (CPU), KeyBERT, RapidOCR.
- **Document reading:** PyMuPDF, python-docx.
- **Cloud AI (optional):** Google Gemini via REST.
- **Database, auth and file storage:** Supabase (PostgreSQL + Auth + Storage).
- **Run:** `./start.sh` (frontend :5173, backend :8000, API docs at `/docs`); `./stop.sh` to stop.
