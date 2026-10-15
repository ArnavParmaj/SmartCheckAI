"""
AI Vision Document Reading
Reads question papers, marking rubrics and handwritten answer sheets with a vision
model from the free provider chain in agents/llm.py (Groq, then Gemini), falling back
to local RapidOCR in the routes when no provider is available.

(The module keeps its original name so existing imports keep working.)
"""

import json
import logging
from typing import Any, Dict, List, Optional, Tuple

from agents.llm import call_llm, llm_available

logger = logging.getLogger("gemini_ocr")
logger.setLevel(logging.INFO)

# Key a model uses for text at the top of a page that continues the previous page's answer
CONTINUED_KEY = "_continued"
HEADER_HINT = """
Also read the student's handwritten name and roll number from the booklet header into "student"
(empty strings if not written)."""


def is_gemini_available(model: Optional[str] = None) -> bool:
    """Kept for existing callers: true if any cloud vision provider can be used."""
    return llm_available("vision")


def _call_gemini_vision(image_paths: List[str], prompt: str, timeout: int = 90, model: Optional[str] = None, **_: Any) -> Optional[str]:
    """Kept for existing callers: routes to the provider chain."""
    text, _engine = call_llm(prompt, image_paths, task="vision" if image_paths else "text", timeout=timeout)
    return text


def _parse(raw: Optional[str], key: str, kind: type):
    if not raw:
        return None
    try:
        value = json.loads(raw).get(key)
        return value if isinstance(value, kind) and value else None
    except Exception as e:
        logger.error(f"Failed to parse {key} JSON: {e}")
        return None


def _read_document(prompt: str, image_paths: List[str], document_text: Optional[str], timeout: int = 90):
    """Typed documents are sent as text (accurate, few tokens); scans as page images."""
    if document_text and document_text.strip():
        return call_llm(f"{prompt}\nDocument text:\n{document_text}", task="text", timeout=timeout)
    return call_llm(prompt, image_paths, task="vision", timeout=timeout)


def gemini_extract_questions(image_paths: List[str], document_text: Optional[str] = None) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """
    Questions and sub-questions from a question paper (its text if typed, else page images).
    Returns ([{"id": "Q1(a)", "text": "...", "marks": 5, "choice_group": "Q1", "condition": None}], engine).
    """
    prompt = """You are an expert exam question paper parser.
Analyze this question paper document and extract every question and sub-question with exact precision.
For each item:
1. "id": Question label including parent and sub-question notation (e.g., "Q1(a)", "Q1(b)", "Q2(a)", "Q2(b)", "Q3(a)").
2. "text": Complete question text, without the marks. If it contains code, equations, or matrices, transcribe them cleanly in text.
3. "marks": Max marks assigned as an integer (e.g. 5, 10). If unspecified, default to 5.
4. "choice_group": Parent group if questions are alternatives (e.g., "Q1", "Q2_Part1", "Q3").
5. "condition": If this question has an alternative choice (e.g. "OR", "AND", or "ATTEMPT ANY ONE"), note it, else null.

Respond ONLY with valid JSON conforming to this schema:
{"questions": [{"id": "Q1(a)", "text": "...", "marks": 5, "choice_group": "Q1", "condition": null}]}
"""
    raw, engine = _read_document(prompt, image_paths, document_text)
    return _parse(raw, "questions", list), engine


def gemini_extract_rubric(image_paths: List[str], document_text: Optional[str] = None) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """
    Marking criteria from a rubric (its text if typed, else page images).
    Returns ([{"question_id": "Q1(a)", "criterion": "...", "max_marks": 3, "description": "..."}], engine).
    """
    prompt = """You are an academic marking rubric extractor.
Analyze this marking scheme / rubric and extract three kinds of rows:
- "criterion": a marked criterion of a question.
- "deduction": a question's deduction / common-error / misconception rule (e.g. "Calling HDFS a database: deduct 0.5").
- "guideline": a general marking guideline that applies to every question.
For each row:
1. "type": "criterion", "deduction" or "guideline".
2. "question_id": the question, written like "Q1(a)", "Q2(a)"; "General" for guidelines.
3. "criterion": the criterion name (for deductions/guidelines, a short title).
4. "max_marks": marks for a criterion (number); 0 for deductions and guidelines.
5. "description": for criteria, the expected points / keywords AND the partial-credit rule; for deductions and
   guidelines, the full rule as written.
Do not include rows that are totals or score-band descriptors.

Respond ONLY with valid JSON:
{"rubrics": [{"type": "criterion", "question_id": "Q1(a)", "criterion": "Definition", "max_marks": 1, "description": "..."}]}
"""
    raw, engine = _read_document(prompt, image_paths, document_text, timeout=120)
    return _parse(raw, "rubrics", list), engine


def _read_answer_page(image_path: str, question_labels: Optional[List[str]], first_page: bool = False) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, str], Optional[str]]:
    labels_hint = (
        f"The exam's questions are labelled exactly: {', '.join(question_labels)}. Use exactly these labels as keys, "
        "mapping however the student wrote the number (e.g. '1 a', 'Q1. a)', 'Ans 1(a)', '1.a') to the matching label.\n"
        if question_labels else ""
    )
    prompt = labels_hint + f"""You are an advanced handwriting OCR engine for university exam answer sheets.
This image is ONE page of a student's answer booklet. Transcribe the student's answers with high fidelity,
organised under their question labels. Do not treat the booklet header (name, roll number, set, subject) as an answer.{HEADER_HINT if first_page else ""}
If the page starts with text that continues an answer from the previous page (no question label before it),
put that text under the key "{CONTINUED_KEY}".
Do not hallucinate, correct or add anything. Keep formulas, code and lists as written; describe diagrams in [brackets].
For each answer give "confidence": 0.0-1.0, how sure you are the transcription is exact.
Lower it for messy, faint, crossed-out or ambiguous handwriting and for words you had to guess.

Respond ONLY with valid JSON:
{{"answers": {{"Q1(a)": {{"text": "...", "confidence": 0.93}}}}{', "student": {"name": "...", "roll_number": "..."}' if first_page else ''}}}
"""
    raw, engine = call_llm(prompt, [image_path], task="vision")
    answers = _parse(raw, "answers", dict) or {}
    student = (_parse(raw, "student", dict) or {}) if first_page else {}
    student = {k: str(student.get(k) or "").strip() for k in ("name", "roll_number")}
    result = {}
    for label, value in answers.items():
        if isinstance(value, dict):
            conf = value.get("confidence")
            text = str(value.get("text", "")).strip()
            conf = max(0.0, min(1.0, float(conf))) if conf is not None else None
        else:
            text, conf = str(value).strip(), None
        if text:
            result[label] = {"text": text, "confidence": conf}
    return result, student, engine


def gemini_extract_student_answers(image_paths: List[str], question_labels: Optional[List[str]] = None) -> Tuple[Optional[Dict[str, Dict[str, Any]]], Optional[str], Dict[str, str]]:
    """
    Handwritten answer sheet pages, read one page per request (keeps each request
    within free-tier per-minute token limits) and merged in page order.
    Returns ({"Q1(a)": {"text": "...", "confidence": 0.92}}, engine, {"name", "roll_number"} from the header).
    """
    merged: Dict[str, Dict[str, Any]] = {}
    last_label: Optional[str] = None
    engine = None
    student: Dict[str, str] = {}
    for i, path in enumerate(image_paths):
        page, page_student, page_engine = _read_answer_page(path, question_labels, first_page=(i == 0))
        if page_engine is None:
            return (merged or None), engine, student
        student = student or page_student
        engine = engine or page_engine
        for label, item in page.items():
            if label == CONTINUED_KEY:
                if last_label is None:
                    continue
                label = last_label
            if label in merged:
                prev = merged[label]
                prev["text"] = f"{prev['text']}\n{item['text']}"
                confs = [c for c in (prev["confidence"], item["confidence"]) if c is not None]
                prev["confidence"] = min(confs) if confs else None
            else:
                merged[label] = dict(item)
            last_label = label
    return (merged or None), engine, student
