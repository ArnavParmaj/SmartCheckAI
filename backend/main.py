"""
SmartCheck AI Backend Application
FastAPI server serving AI agent capabilities for OCR processing, concept extraction,
semantic evaluation, and feedback generation.
"""

import sys
import time
from pathlib import Path
from fastapi import Depends, FastAPI, Request
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
from routes.knowledge_routes import router as knowledge_router
from routes.monitor_routes import router as monitor_router
from auth import require_user
from agents import progress
from agents.llm import local_engine_status

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

# API routes need a signed-in app user (see backend/auth.py); /health and /monitor don't
signed_in = [Depends(require_user)]
app.include_router(ocr_router, dependencies=signed_in)
app.include_router(concept_router, dependencies=signed_in)
app.include_router(evaluation_router, dependencies=signed_in)
app.include_router(feedback_router, dependencies=signed_in)
app.include_router(knowledge_router, dependencies=signed_in)
app.include_router(monitor_router)

# Polling endpoints, left out of the activity log so they don't drown out real work
QUIET_PATHS = ("/health", "/progress/", "/engine-status", "/monitor", "/docs", "/openapi.json")


@app.middleware("http")
async def log_activity(request: Request, call_next):
    started = time.time()
    response = await call_next(request)
    path = request.url.path
    if request.method != "OPTIONS" and not path.startswith(QUIET_PATHS):
        user = getattr(request.state, "user", None) or {}
        progress.log_request({
            "time": started, "method": request.method, "path": path, "status": response.status_code,
            "seconds": round(time.time() - started, 2), "user": user.get("email"),
        })
    return response


@app.get("/health")
async def health():
    """Health check endpoint to verify backend status."""
    return {"status": "ok"}


@app.get("/progress/{job_id}", dependencies=signed_in)
def job_progress(job_id: str):
    """What a running OCR or grading request is doing right now."""
    return progress.get(job_id) or {"detail": "Waiting to start", "stage": "queued"}


@app.get("/engine-status", dependencies=signed_in)
def engine_status():
    """The local AI engine (Ollama): reachable, which model is loaded, GPU memory and load."""
    return local_engine_status()
