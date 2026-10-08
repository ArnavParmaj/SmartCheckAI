# Graph Report - SmartCheck AI  (2026-09-09)

## Corpus Check
- 50 files · ~21,021 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 205 nodes · 324 edges · 26 communities (10 shown, 14 thin omitted)
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
- CreateExamWizard.jsx
- AppContext.jsx
- AuditTrailView.jsx
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
- Sidebar.jsx
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
8. `run_ocr()` - 7 edges
9. `getStatusColor()` - 7 edges
10. `preprocess_image()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `process_ocr()` --calls--> `run_ocr()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/ocr.py
- `process_ocr()` --calls--> `preprocess_image()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/preprocessing.py
- `process_ocr()` --calls--> `segment_answers()`  [EXTRACTED]
  backend/routes/ocr_routes.py → agents/ocr_agent/segmentation.py
- `AppShell()` --calls--> `useApp()`  [EXTRACTED]
  src/App.jsx → src/context/AppContext.jsx
- `AuditTrailView()` --calls--> `useApp()`  [EXTRACTED]
  src/components/AuditTrailView.jsx → src/context/AppContext.jsx

## Import Cycles
- None detected.

## Communities (26 total, 14 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.17
Nodes (21): react, App(), AppShell(), AuthView(), DashboardView(), STATUSES, ExamDetailView(), ExamsView() (+13 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (32): dependencies, lucide-react, react, react-dom, @supabase/supabase-js, devDependencies, autoprefixer, postcss (+24 more)

### Community 2 - "main.py"
Cohesion: 0.10
Nodes (16): health(), SmartCheck AI Backend Application FastAPI server serving AI agent capabilities…, Health check endpoint to verify backend status., extract_concepts(), post, Concept Extraction Routes Handles endpoints for extracting key concepts, domain…, Placeholder endpoint for concept extraction. Will handle receiving answer key…, evaluate_answers() (+8 more)

### Community 3 - "CreateExamWizard.jsx"
Cohesion: 0.40
Nodes (4): CreateExamWizard(), GRADES, STEPS, SUBJECTS

### Community 4 - "AppContext.jsx"
Cohesion: 0.25
Nodes (13): AppContext, AppProvider(), initSession(), mockAuditEvents, mockExams, mockUser, createExamInDB(), fetchTeacherExams() (+5 more)

### Community 5 - "AuditTrailView.jsx"
Cohesion: 0.50
Nodes (3): ACTOR_CONFIG, AuditTrailView(), SEVERITY_CONFIG

### Community 17 - "ocr_routes.py"
Cohesion: 0.11
Nodes (22): get_ocr_engine(), Any, OCR Module Executes optical character recognition on preprocessed answer sheets…, Lazily initialize and cache the PaddleOCR engine. Configured for local…, Run PaddleOCR on the preprocessed image to extract text and confidence. Args:…, run_ocr(), deskew_image(), preprocess_image() (+14 more)

### Community 18 - "Application Views (`src/components/`)"
Cohesion: 0.14
Nodes (14): 10. `ExportView.jsx`, 11. `ProfileView.jsx`, 1. `AuthView.jsx`, 2. `DashboardView.jsx`, 3. Detailed Component Breakdown, 3. `ExamsView.jsx`, 4. `ExamDetailView.jsx`, 5. `CreateExamWizard.jsx` (+6 more)

### Community 19 - "SmartCheck AI — Project Structure & Architectural Reference"
Cohesion: 0.15
Nodes (12): 1. High-Level Overview, 2. Directory Tree Map, 4. State Management Architecture (`src/context/AppContext.jsx`), 5. API Layer & Database Schema (`src/lib/api.js`), 6. Styling & Theme Tokens, 7. Development & Operational Scripts, 8. Guidance for LLMs Modifying this Codebase, Core Stack (+4 more)

### Community 20 - "Sidebar.jsx"
Cohesion: 0.50
Nodes (3): bottomItems, navItems, Sidebar()

## Knowledge Gaps
- **58 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+53 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 117 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.jsx` to `package.json`, `CreateExamWizard.jsx`, `AppContext.jsx`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `useApp()` connect `App.jsx` to `AppContext.jsx`, `CreateExamWizard.jsx`, `Sidebar.jsx`, `AuditTrailView.jsx`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _58 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `main.py` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `ocr_routes.py` be split into smaller, more focused modules?**
  _Cohesion score 0.10582010582010581 - nodes in this community are weakly interconnected._
- **Should `Application Views (`src/components/`)` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._