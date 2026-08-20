SmartCheckAI Frontend Cleanup

Pages:
login.html
dashboard.html
upload.html
rubric.html
results.html
review.html
settings.html

Shared:
styles.css
app.js

Frontend only. Navigation works between pages. Added lightweight interactions:
file selection/drag-drop, rubric accordions, add-question, range values, result filters,
review tabs, score adjustment, notifications, toasts, and logout.

The project context describes the intended backend workflow as:
OCR Agent -> Answer Segmentation Agent -> Concept Extraction Agent ->
Evaluation Agent -> Marking Agent -> Feedback Agent.
No backend, database, OCR or AI service is connected yet.
