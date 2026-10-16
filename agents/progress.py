"""
Live Progress
In-memory status of long requests (reading an answer sheet, grading it), keyed by a job id
the frontend sends with the request and polls at GET /progress/{job_id}, plus a short log
of recent backend requests for the /monitor page.
"""

import threading
import time
from collections import deque
from typing import Any, Dict, List, Optional

MAX_JOBS = 200  # oldest entries are dropped beyond this
ACTIVE_SECONDS = 15 * 60  # a job not updated for this long is no longer shown as running

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


def jobs(limit: int = 30) -> List[Dict[str, Any]]:
    """Most recently updated jobs first, each with its id."""
    with _lock:
        items = [{"id": k, **v} for k, v in _jobs.items()]
    items.sort(key=lambda j: j["updated"], reverse=True)
    now = time.time()
    for j in items:
        j["active"] = j.get("stage") != "done" and now - j["updated"] < ACTIVE_SECONDS
    return items[:limit]


_activity: deque = deque(maxlen=200)


def log_request(entry: Dict[str, Any]) -> None:
    _activity.appendleft(entry)


def activity(limit: int = 50) -> List[Dict[str, Any]]:
    return list(_activity)[:limit]
