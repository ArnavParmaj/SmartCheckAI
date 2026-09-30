# Graph Report - SmartCheck AI  (2026-09-09)

## Corpus Check
- 49 files · ~18,016 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 204 nodes · 318 edges · 25 communities (9 shown, 14 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `589f1b4c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.jsx
- package.json
- main.py
- mockData.js
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
- SmartCheck AI — Project Structure & Architectural Reference
- routes/__init__.py
- start.sh
- stop.sh

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 32 edges
2. `react` - 13 edges
3. `Application Views (`src/components/`)` - 12 edges
4. `AppProvider()` - 9 edges
5. `getConfidenceClass()` - 9 edges
6. `SmartCheck AI — Project Structure & Architectural Reference` - 9 edges
7. `process_ocr()` - 8 edges
8. `getStatusColor()` - 7 edges
9. `run_ocr()` - 6 edges
10. `ExamsView()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `process_ocr()` --calls--> `run_ocr()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/ocr.py
- `process_ocr()` --calls--> `preprocess_image()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/preprocessing.py
- `process_ocr()` --calls--> `segment_answers()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/segmentation.py
- `AppShell()` --calls--> `useApp()`  [EXTRACTED]
  src/App.jsx → src/context/AppContext.jsx
- `DashboardView()` --calls--> `getStatusColor()`  [EXTRACTED]
  src/components/DashboardView.jsx → src/data/mockData.js

## Import Cycles
- None detected.

## Communities (25 total, 14 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.13
Nodes (21): react, App(), AppShell(), ACTOR_CONFIG, AuditTrailView(), SEVERITY_CONFIG, AuthView(), CreateExamWizard() (+13 more)

### Community 1 - "package.json"
Cohesion: 0.08
Nodes (24): dependencies, lucide-react, react, react-dom, @supabase/supabase-js, name, private, scripts (+16 more)

### Community 2 - "main.py"
Cohesion: 0.10
Nodes (16): health(), SmartCheck AI Backend Application FastAPI server serving AI agent capabilities…, Health check endpoint to verify backend status., extract_concepts(), post, Concept Extraction Routes Handles endpoints for extracting key concepts, domain…, Placeholder endpoint for concept extraction. Will handle receiving answer key…, evaluate_answers() (+8 more)

### Community 3 - "mockData.js"
Cohesion: 0.24
Nodes (12): ExamDetailView(), ExamsView(), ExportModal(), OCRReviewView(), ReviewApproveView(), examQuestions, getConfidenceClass(), getConfidenceLabel() (+4 more)

### Community 4 - "AppContext.jsx"
Cohesion: 0.30
Nodes (11): AppContext, AppProvider(), initSession(), mockExams, createExamInDB(), fetchTeacherExams(), saveEvaluationDB(), saveStudentAnswerOCR() (+3 more)

### Community 5 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, autoprefixer, postcss, tailwindcss, @types/react, @types/react-dom, vite, @vitejs/plugin-react

### Community 17 - "ocr_routes.py"
Cohesion: 0.10
Nodes (22): get_ocr_engine(), Any, OCR Module Executes optical character recognition on preprocessed answer sheets…, Lazily initialize and cache the PaddleOCR engine. Configured for local…, Run PaddleOCR on the preprocessed image to extract text and confidence. Args:…, run_ocr(), deskew_image(), preprocess_image() (+14 more)

### Community 18 - "Application Views (`src/components/`)"
Cohesion: 0.14
Nodes (14): 10. `ExportView.jsx`, 11. `ProfileView.jsx`, 1. `AuthView.jsx`, 2. `DashboardView.jsx`, 3. Detailed Component Breakdown, 3. `ExamsView.jsx`, 4. `ExamDetailView.jsx`, 5. `CreateExamWizard.jsx` (+6 more)

### Community 19 - "SmartCheck AI — Project Structure & Architectural Reference"
Cohesion: 0.15
Nodes (12): 1. High-Level Overview, 2. Directory Tree Map, 4. State Management Architecture (`src/context/AppContext.jsx`), 5. API Layer & Database Schema (`src/lib/api.js`), 6. Styling & Theme Tokens, 7. Development & Operational Scripts, 8. Guidance for LLMs Modifying this Codebase, Core Stack (+4 more)

## Knowledge Gaps
- **58 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+53 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 117 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.jsx` to `package.json`, `mockData.js`, `AppContext.jsx`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `useApp()` connect `App.jsx` to `mockData.js`, `AppContext.jsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _58 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1310483870967742 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `main.py` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._