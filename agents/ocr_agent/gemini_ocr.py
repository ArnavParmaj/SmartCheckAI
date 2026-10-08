"""
Gemini OCR & Multimodal Vision Module
Provides AI-assisted document parsing using Google Gemini 2.5 Flash.
Supports multimodal extraction for Question Papers, Marking Rubrics, and Student Answer Sheets
with seamless fallback to local RapidOCR + Layout Segmentation when offline or unconfigured.
"""

import base64
import json
import logging
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

# Search for backend/.env or root .env
backend_env = Path(__file__).resolve().parent.parent.parent / "backend" / ".env"
if backend_env.exists():
    load_dotenv(backend_env)
else:
    load_dotenv()

logger = logging.getLogger("gemini_ocr")
logger.setLevel(logging.INFO)

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)


def is_gemini_available() -> bool:
    """Check if a Gemini API key is configured."""
    key = os.getenv("GEMINI_API_KEY", "").strip()
    return bool(key)


def _call_gemini_vision(
    image_paths: List[str],
    prompt: str,
    response_mime_type: str = "application/json",
    timeout: int = 45,
) -> Optional[str]:
    """
    Call Gemini Multimodal Vision API with one or more images and a text prompt.
    Returns the raw generated text (usually JSON) or None if request failed.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.warning("GEMINI_API_KEY not found in environment.")
        return None

    url = f"{GEMINI_URL}?key={api_key}"

    parts: List[Dict[str, Any]] = [{"text": prompt}]

    for p in image_paths:
        if not os.path.exists(p):
            continue
        try:
            with open(p, "rb") as f:
                img_bytes = f.read()
            mime = "image/png" if p.lower().endswith(".png") else "image/jpeg"
            b64_data = base64.b64encode(img_bytes).decode("utf-8")
            parts.append({
                "inline_data": {
                    "mime_type": mime,
                    "data": b64_data,
                }
            })
        except Exception as e:
            logger.error(f"Error reading image {p} for Gemini: {e}")

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "response_mime_type": response_mime_type,
            "temperature": 0.1,
        },
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            candidates = data.get("candidates", [])
            if candidates:
                part = candidates[0].get("content", {}).get("parts", [{}])[0]
                return part.get("text", "")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        logger.error(f"Gemini API HTTPError {e.code}: {err_msg}")
    except Exception as e:
        logger.error(f"Gemini API Call Exception: {e}")

    return None


def gemini_extract_questions(image_paths: List[str]) -> Optional[List[Dict[str, Any]]]:
    """
    Extract structured questions and sub-questions from question paper images.
    Returns a list of dicts: [ { "id": "Q1(a)", "text": "...", "marks": 5, "condition": "OR" }, ... ]
    """
    prompt = """You are an expert exam question paper parser.
Analyze this question paper document and extract every question and sub-question with exact precision.
For each item:
1. "id": Question label including parent and sub-question notation (e.g., "Q1(a)", "Q1(b)", "Q2(a)", "Q2(b)", "Q3(a)").
2. "text": Complete question text. If the question contains code, equations, or matrices, transcribe them cleanly in text.
3. "marks": Max marks assigned as an integer (e.g. 5, 10). If unspecified, default to 5.
4. "choice_group": Parent group if questions are alternatives (e.g., "Q1", "Q2_Part1", "Q3").
5. "condition": If this question has an alternative choice (e.g. "OR", "AND", or "ATTEMPT ANY ONE"), note it, else null.

Respond ONLY with valid JSON conforming to this schema:
{
  "questions": [
    {
      "id": "Q1(a)",
      "text": "Given a real-world scenario...",
      "marks": 5,
      "choice_group": "Q1",
      "condition": null
    }
  ]
}
"""
    raw_json = _call_gemini_vision(image_paths, prompt)
    if not raw_json:
        return None

    try:
        parsed = json.loads(raw_json)
        questions = parsed.get("questions", [])
        if isinstance(questions, list) and questions:
            return questions
    except Exception as e:
        logger.error(f"Failed to parse Gemini questions JSON: {e}")

    return None


def gemini_extract_rubric(image_paths: List[str]) -> Optional[List[Dict[str, Any]]]:
    """
    Extract marking rubric criteria from rubric document images.
    Returns a list of rubric criteria items:
    [ { "question_id": "Q1(a)", "criterion": "Definition of 4 Vs", "max_marks": 3, "description": "..." }, ... ]
    """
    prompt = """You are an academic marking rubric extractor.
Analyze this marking scheme / rubric image.
Extract each grading criterion and map it to its corresponding question.
For each item:
1. "question_id": Corresponding question (e.g., "Q1(a)", "Q1", "General").
2. "criterion": Name of the evaluation criterion or milestone.
3. "max_marks": Marks allocated to this specific criterion (float or integer).
4. "description": Expected student output or breakdown required to earn these marks.

Respond ONLY with valid JSON conforming to this schema:
{
  "rubrics": [
    {
      "question_id": "Q1(a)",
      "criterion": "Identification of Characteristics",
      "max_marks": 3,
      "description": "Correctly states Volume, Velocity, Variety with ecommerce context"
    }
  ]
}
"""
    raw_json = _call_gemini_vision(image_paths, prompt)
    if not raw_json:
        return None

    try:
        parsed = json.loads(raw_json)
        rubrics = parsed.get("rubrics", [])
        if isinstance(rubrics, list) and rubrics:
            return rubrics
    except Exception as e:
        logger.error(f"Failed to parse Gemini rubric JSON: {e}")

    return None


def gemini_extract_student_answers(image_paths: List[str]) -> Optional[Dict[str, str]]:
    """
    Extract and transcribe handwritten or printed student answer sheets,
    segmenting text by question identifier.
    Returns: { "Q1(a)": "Transcribed answer...", "Q1(b)": "..." }
    """
    prompt = """You are an advanced handwriting OCR engine for university exam answer sheets.
Analyze these answer sheet pages.
Transcribe student answers with high fidelity, organizing them under their respective question labels (e.g. "Q1(a)", "Q1(b)", "Q2", etc.).
Do not hallucinate or add explanations. Keep mathematical formulas, code, and diagrams (described in bracketed text) true to what the student wrote.

Respond ONLY with valid JSON:
{
  "answers": {
    "Q1(a)": "Student answer transcription...",
    "Q1(b)": "..."
  }
}
"""
    raw_json = _call_gemini_vision(image_paths, prompt)
    if not raw_json:
        return None

    try:
        parsed = json.loads(raw_json)
        answers = parsed.get("answers", {})
        if isinstance(answers, dict) and answers:
            return answers
    except Exception as e:
        logger.error(f"Failed to parse Gemini answers JSON: {e}")

    return None
