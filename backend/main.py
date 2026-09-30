"""
SmartCheck AI Backend Application
FastAPI server serving AI agent capabilities for OCR processing, concept extraction,
semantic evaluation, and feedback generation.
"""

import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure both backend directory and project root are in Python module search path
backend_dir = Path(__file__).resolve().parent
project_root = backend_dir.parent
for path_entry in [str(project_root), str(backend_dir)]:
    if path_entry not in sys.path:
        sys.path.insert(0, path_entry)

from routes.ocr_routes import router as ocr_router
from routes.concept_routes import router as concept_router
from routes.evaluation_routes import router as evaluation_router
from routes.feedback_routes import router as feedback_router

app = FastAPI(
    title="SmartCheck AI Backend",
    description="Python AI agent backend service for SmartCheck AI evaluation engine",
    version="1.0.0",
)

# Enable CORS for localhost:5173 (the React frontend)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all route modules
app.include_router(ocr_router)
app.include_router(concept_router)
app.include_router(evaluation_router)
app.include_router(feedback_router)


@app.get("/health")
async def health():
    """Health check endpoint to verify backend status."""
    return {"status": "ok"}
