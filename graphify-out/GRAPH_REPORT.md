# Graph Report - SmartCheckAI  (2026-10-15)

## Corpus Check
- 71 files · ~44,372 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 3, .example 1, .css 1)

## Summary
- 430 nodes · 905 edges · 26 communities (16 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c485476e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useApp
- package.json
- main.py
- SmartCheckAI — Project Progress Report
- AppContext.jsx
- answer_key.py
- concept_extractor.py
- concept_matcher.py
- exportResults.js
- typing
- scorer.py
- evaluation_routes.py
- _call_gemini_vision
- ocr_routes.py
- Application Views (`src/components/`)
- react
- start.sh
- stop.sh

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 41 edges
2. `react` - 19 edges
3. `AppShell()` - 19 edges
4. `AppProvider()` - 18 edges
5. `grade_answer()` - 15 edges
6. `get_model()` - 14 edges
7. `is_gemini_available()` - 12 edges
8. `_call_gemini_vision()` - 12 edges
9. `Application Views (`src/components/`)` - 12 edges
10. `extract_questions_endpoint()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `3. `ExamsView.jsx`` --references--> `ExamDetailView()`  [INFERRED]
  PROJECT_STRUCTURE.md → src/components/ExamDetailView.jsx
- `11. `ProfileView.jsx`` --references--> `updateTeacherProfile()`  [INFERRED]
  PROJECT_STRUCTURE.md → src/lib/api.js
- `Core & Layout Components` --references--> `AppShell()`  [INFERRED]
  PROJECT_STRUCTURE.md → src/App.jsx
- `Core & Layout Components` --references--> `AuthView()`  [INFERRED]
  PROJECT_STRUCTURE.md → src/components/AuthView.jsx
- `Core & Layout Components` --references--> `useApp()`  [INFERRED]
  PROJECT_STRUCTURE.md → src/context/AppContext.jsx

## Import Cycles
- None detected.

## Communities (26 total, 10 thin omitted)

### Community 0 - "useApp"
Cohesion: 0.10
Nodes (41): Core & Layout Components, App(), AppShell(), ACTOR_CONFIG, AuditTrailView(), SEVERITY_CONFIG, AuthView(), analyseQuestion() (+33 more)

### Community 1 - "package.json"
Cohesion: 0.05
Nodes (39): dependencies, lucide-react, react, react-dom, @supabase/supabase-js, devDependencies, autoprefixer, eslint (+31 more)

### Community 2 - "main.py"
Cohesion: 0.18
Nodes (3): health(), ConceptRequest, extract()

### Community 3 - "SmartCheckAI — Project Progress Report"
Cohesion: 0.14
Nodes (13): 1. Summary, 2.1 Exam setup (faculty, once per exam), 2.2 Evaluation (bulk), 2.3 Grading (hybrid: local first, Gemini as second opinion), 2.4 Results, 2. How it works, 3. Module status, 4. Testing done (+5 more)

### Community 4 - "AppContext.jsx"
Cohesion: 0.17
Nodes (28): STATUS_COLOR, STATUS_ICON, AppContext, AppProvider(), initSession(), mockExams, approveAnswerSheetDB(), createExamInDB() (+20 more)

### Community 5 - "answer_key.py"
Cohesion: 0.10
Nodes (12): _marker(), parse_label(), read_typed_document(), split_answer_key(), split_by_questions(), _assign_concepts(), build_knowledge(), _normalise_criteria() (+4 more)

### Community 6 - "concept_extractor.py"
Cohesion: 0.20
Nodes (4): extract_concepts(), extract_key_points(), _keybert_concepts(), _keyword_concepts()

### Community 8 - "concept_matcher.py"
Cohesion: 0.21
Nodes (5): variants(), _lexically_covered(), match_concepts(), _semantic_scores(), _stem()

### Community 9 - "exportResults.js"
Cohesion: 0.31
Nodes (13): ExportModal(), buildGradebook(), csvCell(), downloadFile(), escapeHtml(), finalScore(), openPrintReport(), openStudentReports() (+5 more)

### Community 10 - "typing"
Cohesion: 0.20
Nodes (4): concept_label(), template_feedback(), FeedbackRequest, generate()

### Community 12 - "scorer.py"
Cohesion: 0.17
Nodes (13): combine(), ensure_criteria(), _gemini_grade(), grade_answer(), _grade_criterion_locally(), _local_reason(), _parse_criteria_grades(), _round_half() (+5 more)

### Community 13 - "evaluation_routes.py"
Cohesion: 0.22
Nodes (4): AnswerToGrade, evaluate_answers(), run(), EvaluateRequest

### Community 14 - "_call_gemini_vision"
Cohesion: 0.32
Nodes (4): gemini_split(), gemini_grade_batch(), _call_gemini_vision(), is_gemini_available()

### Community 17 - "ocr_routes.py"
Cohesion: 0.05
Nodes (15): gemini_extract_questions(), gemini_extract_rubric(), gemini_extract_student_answers(), _retry_delay_seconds(), get_ocr_engine(), run_ocr(), deskew_image(), preprocess_image() (+7 more)

### Community 18 - "Application Views (`src/components/`)"
Cohesion: 0.08
Nodes (25): 10. `ExportView.jsx`, 11. `ProfileView.jsx`, 1. `AuthView.jsx`, 1. High-Level Overview, 2. `DashboardView.jsx`, 2. Directory Tree Map, 3. Detailed Component Breakdown, 3. `ExamsView.jsx` (+17 more)

### Community 19 - "react"
Cohesion: 0.13
Nodes (14): react, react-dom, AnswerKeyStep(), CreateExamWizard(), GRADES, STEPS, SUBJECTS, CriteriaEditor() (+6 more)

## Knowledge Gaps
- **77 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+72 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 192 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `useApp`, `package.json`, `AppContext.jsx`, `exportResults.js`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `useApp()` connect `useApp` to `exportResults.js`, `react`, `AppContext.jsx`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `3. Detailed Component Breakdown` connect `Application Views (`src/components/`)` to `useApp`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _77 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useApp` be split into smaller, more focused modules?**
  _Cohesion score 0.09774436090225563 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `SmartCheckAI — Project Progress Report` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._