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
from routes.knowledge_routes import router as knowledge_router

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
app.include_router(knowledge_router)


@app.get("/health")
async def health():
    """Health check endpoint to verify backend status."""
    return {"status": "ok"}


@app.get("/progress/{job_id}")
def job_progress(job_id: str):
    """What a running OCR or grading request is doing right now."""
    from agents import progress
    return progress.get(job_id) or {"detail": "Waiting to start", "stage": "queued"}


@app.get("/engine-status")
def engine_status():
    """The local AI engine (Ollama): reachable, which model is loaded and how much GPU memory it holds."""
    import json
    import urllib.request
    from agents.llm import MODELS, OLLAMA_URL, _providers
    base = OLLAMA_URL.rsplit("/api/", 1)[0]
    status = {"providers": _providers(), "model": MODELS["ollama"]["vision"], "ollama": False, "loaded": False, "gpu_gb": 0.0}
    try:
        with urllib.request.urlopen(f"{base}/api/ps", timeout=2) as resp:
            running = json.loads(resp.read().decode()).get("models", [])
        status["ollama"] = True
        for m in running:
            if m.get("name") == status["model"]:
                status["loaded"] = True
                status["gpu_gb"] = round(m.get("size_vram", 0) / 1e9, 1)
    except Exception:
        pass
    return status
