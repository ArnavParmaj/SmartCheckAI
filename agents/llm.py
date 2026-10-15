"""
LLM Provider Chain
One entry point, call_llm(), for every cloud-AI task, trying free providers in order:
Groq first (fast; ~1,000 requests/day but only ~8,000 tokens/minute on the free tier),
then Gemini Flash-Lite. When a provider hits its limit it is skipped until it resets;
short per-minute limits are waited out once. If every provider is unavailable, callers
fall back to local models.

Tasks:
  "vision": read images (question papers, rubrics, handwritten answer sheets)
  "text":   text-only reasoning (grading second opinion, answer-key splitting)

Configure in backend/.env:
  LLM_PROVIDERS=groq,gemini          order to try
  GROQ_API_KEY, GROQ_VISION_MODEL, GROQ_TEXT_MODEL
  GEMINI_API_KEY, GEMINI_MODEL (vision), GEMINI_TEXT_MODEL
"""

import base64
import io
import json
import logging
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv

backend_env = Path(__file__).resolve().parent.parent / "backend" / ".env"
load_dotenv(backend_env if backend_env.exists() else None)

logger = logging.getLogger("llm")
logger.setLevel(logging.INFO)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

MODELS = {
    "groq": {
        "vision": os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.8-27b"),
        "text": os.getenv("GROQ_TEXT_MODEL", "openai/gpt-oss-120b"),
    },
    "gemini": {
        "vision": os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        "text": os.getenv("GEMINI_TEXT_MODEL", "gemini-flash-lite-latest"),
    },
}
KEYS = {"groq": "GROQ_API_KEY", "gemini": "GEMINI_API_KEY"}

MAX_WAIT_SECONDS = 45  # wait out a per-minute limit up to this long; longer limits skip the provider
DEFAULT_COOLDOWN_SECONDS = 600
MAX_IMAGE_SIDE = 1600  # pixels; keeps one page within Groq's per-minute token budget

_blocked_until: Dict[str, float] = {}


def _providers() -> List[str]:
    order = [p.strip() for p in os.getenv("LLM_PROVIDERS", "groq,gemini").split(",") if p.strip()]
    return [p for p in order if p in MODELS and os.getenv(KEYS[p], "").strip()]


def llm_available(task: str = "text") -> bool:
    now = time.time()
    return any(now >= _blocked_until.get(f"{p}:{MODELS[p][task]}", 0) for p in _providers())


def _encode_image(path: str) -> Tuple[str, str]:
    """JPEG, longest side <= MAX_IMAGE_SIDE, base64."""
    from PIL import Image
    img = Image.open(path).convert("RGB")
    img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return "image/jpeg", base64.b64encode(buf.getvalue()).decode()


def _clean_json(text: str) -> str:
    """Strip reasoning tags and ```json fences some models add around JSON."""
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.DOTALL).strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, flags=re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=0)
    return text[start:]


def _retry_after(provider: str, err: urllib.error.HTTPError, body: str) -> float:
    header = err.headers.get("retry-after") if err.headers else None
    if header:
        try:
            return float(header)
        except ValueError:
            pass
    m = re.search(r'"retryDelay":\s*"(\d+(?:\.\d+)?)s"', body) or re.search(r"try again in (\d+(?:\.\d+)?)s", body)
    return float(m.group(1)) if m else DEFAULT_COOLDOWN_SECONDS


def _post(url: str, payload: dict, headers: dict, timeout: int) -> dict:
    req = urllib.request.Request(url, json.dumps(payload).encode(), {"Content-Type": "application/json", "User-Agent": "smartcheck-ai/1.0", **headers})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _call_groq(model: str, prompt: str, images: List[Tuple[str, str]], timeout: int) -> str:
    content = [{"type": "text", "text": prompt}] + [
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{data}"}} for mime, data in images
    ]
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content if images else prompt}],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }
    data = _post(GROQ_URL, payload, {"Authorization": f"Bearer {os.getenv('GROQ_API_KEY', '').strip()}"}, timeout)
    return data["choices"][0]["message"]["content"]


def _call_gemini(model: str, prompt: str, images: List[Tuple[str, str]], timeout: int) -> str:
    parts = [{"text": prompt}] + [{"inline_data": {"mime_type": mime, "data": data}} for mime, data in images]
    payload = {"contents": [{"parts": parts}], "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}}
    url = f"{GEMINI_URL.format(model=model)}?key={os.getenv('GEMINI_API_KEY', '').strip()}"
    data = _post(url, payload, {}, timeout)
    return data["candidates"][0]["content"]["parts"][0]["text"]


CALLERS = {"groq": _call_groq, "gemini": _call_gemini}


def call_llm(prompt: str, image_paths: Optional[List[str]] = None, task: str = "text", timeout: int = 90) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (JSON text, "provider:model") from the first provider that answers,
    or (None, None) if none could. The prompt should ask for JSON only.
    """
    images = [_encode_image(p) for p in (image_paths or []) if os.path.exists(p)]
    for provider in _providers():
        model = MODELS[provider][task]
        slot = f"{provider}:{model}"
        for attempt in range(2):
            if time.time() < _blocked_until.get(slot, 0):
                break
            try:
                return _clean_json(CALLERS[provider](model, prompt, images, timeout)), slot
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", errors="ignore")
                if e.code == 429:
                    wait = _retry_after(provider, e, body)
                    if attempt == 0 and wait <= MAX_WAIT_SECONDS:
                        logger.info(f"{slot} per-minute limit; waiting {wait:.0f}s")
                        time.sleep(wait + 1)
                        continue
                    _blocked_until[slot] = time.time() + max(wait, 60)
                    logger.warning(f"{slot} out of quota; skipping it for {max(wait, 60) / 60:.0f} min")
                else:
                    logger.error(f"{slot} HTTP {e.code}: {body[:300]}")
                break
            except Exception as e:
                logger.error(f"{slot} failed: {e}")
                break
    return None, None
