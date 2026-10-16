"""
Backend Authentication
Every API route requires the Supabase login the app already uses: the frontend sends the
user's access token as "Authorization: Bearer <token>", and the backend asks Supabase who
it belongs to (answers cached for a few minutes). Scripts such as eval/run_eval.py can send
"X-Service-Token: <BACKEND_SERVICE_TOKEN>" instead.

Configure in backend/.env:
  BACKEND_AUTH=on                 "off" disables the check (local development only)
  BACKEND_SERVICE_TOKEN=...       optional shared secret for scripts; empty = not accepted
  MONITOR_ADMINS=a@x.com,b@y.com  who may open /monitor; empty = any signed-in user
"""

import hashlib
import hmac
import os
import threading
import time
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException, Request

from config.supabase_client import SUPABASE_KEY, SUPABASE_URL

AUTH_ON = os.getenv("BACKEND_AUTH", "on").strip().lower() != "off"
SERVICE_TOKEN = os.getenv("BACKEND_SERVICE_TOKEN", "").strip()
MONITOR_ADMINS = {e.strip().lower() for e in os.getenv("MONITOR_ADMINS", "").split(",") if e.strip()}

CACHE_SECONDS = 300
_cache: Dict[str, Tuple[Optional[Dict[str, Any]], float]] = {}
_lock = threading.Lock()


def _auth_client():
    # A fresh client per call, so signing in never changes the session of the shared
    # client the routes use for database writes
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_KEY).auth


def user_from_token(token: str) -> Optional[Dict[str, Any]]:
    """{"id", "email"} of the Supabase user a token belongs to, or None if it is invalid/expired."""
    if not token:
        return None
    key = hashlib.sha256(token.encode()).hexdigest()
    now = time.time()
    with _lock:
        hit = _cache.get(key)
        if hit and hit[1] > now:
            return hit[0]
    try:
        res = _auth_client().get_user(token)
        user = {"id": res.user.id, "email": (res.user.email or "").lower()} if res and res.user else None
    except Exception:
        user = None
    with _lock:
        # Remember failures briefly too, so a bad token can't make us hammer Supabase
        _cache[key] = (user, now + (CACHE_SECONDS if user else 30))
        if len(_cache) > 1000:
            for k in [k for k, (_, exp) in _cache.items() if exp <= now]:
                _cache.pop(k, None)
    return user


def sign_in(email: str, password: str) -> Tuple[Optional[str], int, Optional[str]]:
    """(access token, seconds valid, error) for an app account's email and password."""
    try:
        res = _auth_client().sign_in_with_password({"email": email, "password": password})
        session = res.session
        return session.access_token, int(session.expires_in or 3600), None
    except Exception as e:
        return None, 0, str(e) or "Sign-in failed"


def require_user(request: Request) -> Dict[str, Any]:
    """FastAPI dependency for API routes: the signed-in user, or 401."""
    if not AUTH_ON:
        user = {"id": None, "email": "auth-off"}
    elif SERVICE_TOKEN and hmac.compare_digest(request.headers.get("x-service-token", ""), SERVICE_TOKEN):
        user = {"id": None, "email": "service-token"}
    else:
        header = request.headers.get("authorization", "")
        token = header[7:].strip() if header.lower().startswith("bearer ") else ""
        user = user_from_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Sign in to SmartCheck AI to use the backend.")
    request.state.user = user
    return user


def is_monitor_admin(user: Optional[Dict[str, Any]]) -> bool:
    return bool(user) and (not MONITOR_ADMINS or user.get("email", "") in MONITOR_ADMINS)
