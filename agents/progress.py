"""
Live Progress
In-memory status of long requests (reading an answer sheet, grading it), keyed by a job id
the frontend sends with the request and polls at GET /progress/{job_id}.
"""

import threading
import time
from typing import Any, Dict, Optional

MAX_JOBS = 200  # oldest entries are dropped beyond this

_jobs: Dict[str, Dict[str, Any]] = {}
_lock = threading.Lock()


def update(job_id: Optional[str], detail: str, **fields: Any) -> None:
    """Record what a job is doing now, e.g. update(job, "Reading page 2 of 3", page=2, pages=3)."""
    if not job_id:
        return
    with _lock:
        job = _jobs.setdefault(job_id, {"started": time.time()})
        job.update(fields, detail=detail, updated=time.time())
        if len(_jobs) > MAX_JOBS:
            oldest = min(_jobs, key=lambda k: _jobs[k]["updated"])
            _jobs.pop(oldest, None)


def get(job_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None
