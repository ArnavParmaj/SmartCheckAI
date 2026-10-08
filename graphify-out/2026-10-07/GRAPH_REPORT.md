# Graph Report - SmartCheck AI  (2026-10-07)

## Corpus Check
- 52 files · ~31,594 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 248 nodes · 374 edges · 25 communities (9 shown, 14 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8dff5ab9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.jsx
- package.json
- main.py
- SmartCheckAI — Project Progress Report
- AppContext.jsx
- devDependencies
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
- routes/__init__.py
- start.sh
- stop.sh

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 32 edges
2. `react` - 13 edges
3. `Application Views (`src/components/`)` - 12 edges
4. `SmartCheckAI — Project Progress Report` - 11 edges
5. `AppProvider()` - 9 edges
6. `getConfidenceClass()` - 9 edges
7. `SmartCheck AI — Project Structure & Architectural Reference` - 9 edges
8. `segment_answers()` - 8 edges
9. `process_ocr()` - 8 edges
10. `run_ocr()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `process_ocr()` --calls--> `run_ocr()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/ocr.py
- `process_ocr()` --calls--> `preprocess_image()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/preprocessing.py
- `process_ocr()` --calls--> `segment_answers()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/segmentation.py
- `AppShell()` --calls--> `useApp()`  [EXTRACTED]
  src/App.jsx → src/context/AppContext.jsx
- `CreateExamWizard()` --calls--> `processAnswerSheetOCR()`  [EXTRACTED]
  src/components/CreateExamWizard.jsx → src/lib/backendApi.js

## Import Cycles
- None detected.

## Communities (25 total, 14 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.12
Nodes (29): react, App(), AppShell(), ACTOR_CONFIG, AuditTrailView(), SEVERITY_CONFIG, AuthView(), CreateExamWizard() (+21 more)

### Community 1 - "package.json"
Cohesion: 0.08
Nodes (24): dependencies, lucide-react, react, react-dom, @supabase/supabase-js, name, private, scripts (+16 more)

### Community 2 - "main.py"
Cohesion: 0.10
Nodes (16): health(), SmartCheck AI Backend Application FastAPI server serving AI agent capabilities…, Health check endpoint to verify backend status., extract_concepts(), post, Concept Extraction Routes Handles endpoints for extracting key concepts, domain…, Placeholder endpoint for concept extraction. Will handle receiving answer key…, evaluate_answers() (+8 more)

### Community 3 - "SmartCheckAI — Project Progress Report"
Cohesion: 0.06
Nodes (31): 10.1 Repository Metadata, 10.2 Commit History, 10.3 Working Tree Status, 10. Git Activity Summary, 1. Project Overview, 2.1 OCR Agent (`agents/ocr_agent/`, `backend/routes/ocr_routes.py`), 2.2 Knowledge & Concept Agent (`agents/concept_agent/`, `backend/routes/concept_routes.py`), 2.3 Evaluation & Scoring Agent (`agents/evaluation_agent/`, `agents/feedback_agent/`, `backend/routes/`) (+23 more)

### Community 4 - "AppContext.jsx"
Cohesion: 0.33
Nodes (11): AppContext, AppProvider(), initSession(), mockExams, createExamInDB(), fetchTeacherExams(), saveEvaluationDB(), saveStudentAnswerOCR() (+3 more)

### Community 5 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, autoprefixer, postcss, tailwindcss, @types/react, @types/react-dom, vite, @vitejs/plugin-react

### Community 17 - "ocr_routes.py"
Cohesion: 0.09
Nodes (27): get_ocr_engine(), Any, OCR Module Executes optical character recognition on preprocessed answer sheets…, Lazily initialize and cache the OCR engine. Prefers RapidOCR (PP-OCR models via…, Run OCR on the preprocessed image to extract text, confidence, and line boxes.…, run_ocr(), deskew_image(), preprocess_image() (+19 more)

### Community 18 - "Application Views (`src/components/`)"
Cohesion: 0.07
Nodes (26): 10. `ExportView.jsx`, 11. `ProfileView.jsx`, 1. `AuthView.jsx`, 1. High-Level Overview, 2. `DashboardView.jsx`, 2. Directory Tree Map, 3. Detailed Component Breakdown, 3. `ExamsView.jsx` (+18 more)

### Community 19 - "CreateExamWizard.jsx"
Cohesion: 0.21
Nodes (6): GRADES, STEPS, SUBJECTS, TopBar(), checkBackendHealth(), processAnswerSheetOCR()

## Knowledge Gaps
- **79 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+74 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 144 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.jsx` to `package.json`, `CreateExamWizard.jsx`, `AppContext.jsx`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `useApp()` connect `App.jsx` to `CreateExamWizard.jsx`, `AppContext.jsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _79 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1202020202020202 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `main.py` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._