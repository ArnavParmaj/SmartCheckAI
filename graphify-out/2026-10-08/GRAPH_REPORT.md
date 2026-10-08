# Graph Report - SmartCheck AI  (2026-10-08)

## Corpus Check
- 54 files · ~33,944 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 277 nodes · 432 edges · 26 communities (8 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `768b53ba`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useApp
- package.json
- main.py
- SmartCheckAI — Project Progress Report
- AppContext.jsx
- ErrorBoundary
- concept_extractor.py
- concept_agent/__init__.py
- knowledge_base.py
- concept_matcher.py
- confidence.py
- evaluation_agent/__init__.py
- scorer.py
- semantic_matcher.py
- feedback_generator.py
- feedback_agent/__init__.py
- ocr_agent/__init__.py
- ocr_routes.py
- Application Views (`src/components/`)
- CreateExamWizard.jsx
- post
- routes/__init__.py
- start.sh
- stop.sh

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 32 edges
2. `react` - 15 edges
3. `Application Views (`src/components/`)` - 12 edges
4. `extract_questions_endpoint()` - 11 edges
5. `SmartCheckAI — Project Progress Report` - 11 edges
6. `extract_rubric_endpoint()` - 10 edges
7. `process_ocr()` - 10 edges
8. `AppProvider()` - 10 edges
9. `run_ocr()` - 9 edges
10. `segment_answers()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `extract_questions_endpoint()` --calls--> `is_gemini_available()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/gemini_ocr.py
- `extract_rubric_endpoint()` --calls--> `is_gemini_available()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/gemini_ocr.py
- `process_ocr()` --calls--> `is_gemini_available()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/gemini_ocr.py
- `extract_questions_endpoint()` --calls--> `gemini_extract_questions()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/gemini_ocr.py
- `extract_rubric_endpoint()` --calls--> `gemini_extract_rubric()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/gemini_ocr.py

## Import Cycles
- None detected.

## Communities (26 total, 16 thin omitted)

### Community 0 - "useApp"
Cohesion: 0.12
Nodes (26): react, App(), AppShell(), ACTOR_CONFIG, AuditTrailView(), SEVERITY_CONFIG, AuthView(), DashboardView() (+18 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (32): dependencies, lucide-react, react, react-dom, @supabase/supabase-js, devDependencies, autoprefixer, postcss (+24 more)

### Community 2 - "main.py"
Cohesion: 0.10
Nodes (16): health(), SmartCheck AI Backend Application FastAPI server serving AI agent capabilities…, Health check endpoint to verify backend status., extract_concepts(), post, Concept Extraction Routes Handles endpoints for extracting key concepts, domain…, Placeholder endpoint for concept extraction. Will handle receiving answer key…, evaluate_answers() (+8 more)

### Community 3 - "SmartCheckAI — Project Progress Report"
Cohesion: 0.06
Nodes (31): 10.1 Repository Metadata, 10.2 Commit History, 10.3 Working Tree Status, 10. Git Activity Summary, 1. Project Overview, 2.1 OCR Agent (`agents/ocr_agent/`, `backend/routes/ocr_routes.py`), 2.2 Knowledge & Concept Agent (`agents/concept_agent/`, `backend/routes/concept_routes.py`), 2.3 Evaluation & Scoring Agent (`agents/evaluation_agent/`, `agents/feedback_agent/`, `backend/routes/`) (+23 more)

### Community 4 - "AppContext.jsx"
Cohesion: 0.26
Nodes (14): AppContext, AppProvider(), initSession(), mockAuditEvents, mockExams, mockUser, createExamInDB(), deleteExamFromDB() (+6 more)

### Community 17 - "ocr_routes.py"
Cohesion: 0.07
Nodes (45): _call_gemini_vision(), gemini_extract_questions(), gemini_extract_rubric(), gemini_extract_student_answers(), is_gemini_available(), Any, Gemini OCR & Multimodal Vision Module Provides AI-assisted document parsing…, Extract structured questions and sub-questions from question paper images.… (+37 more)

### Community 18 - "Application Views (`src/components/`)"
Cohesion: 0.07
Nodes (26): 10. `ExportView.jsx`, 11. `ProfileView.jsx`, 1. `AuthView.jsx`, 1. High-Level Overview, 2. `DashboardView.jsx`, 2. Directory Tree Map, 3. Detailed Component Breakdown, 3. `ExamsView.jsx` (+18 more)

### Community 19 - "CreateExamWizard.jsx"
Cohesion: 0.21
Nodes (9): CreateExamWizard(), GRADES, STEPS, SUBJECTS, TopBar(), checkBackendHealth(), extractQuestionsFromFile(), extractRubricFromFile() (+1 more)

## Knowledge Gaps
- **79 isolated node(s):** `STEPS`, `SUBJECTS`, `GRADES`, `STATUSES`, `navItems` (+74 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 155 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `useApp` to `package.json`, `CreateExamWizard.jsx`, `AppContext.jsx`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `useApp()` connect `useApp` to `CreateExamWizard.jsx`, `AppContext.jsx`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `STEPS`, `SUBJECTS`, `GRADES` to the rest of the system?**
  _79 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useApp` be split into smaller, more focused modules?**
  _Cohesion score 0.12403100775193798 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `main.py` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `SmartCheckAI — Project Progress Report` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._