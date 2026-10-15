"""
Answer Key Reader
Reads the faculty's typed answer key (PDF, Word or text) and splits it into one
model answer per question label. Typed documents are read directly (no OCR); a PDF
without a text layer (a scan) falls back to OCR. Splitting is rule-based, with
Gemini as an optional second attempt when the rules can't find most questions.
"""

import io
import json
import logging
import re
from typing import Dict, List, Optional, Tuple

from agents.llm import call_llm, llm_available

logger = logging.getLogger("answer_key")


def read_typed_document(file_bytes: bytes, filename: str) -> str:
    """Plain text of a .pdf, .docx or .txt file ('' if a PDF has no text layer)."""
    name = filename.lower()
    if name.endswith(".pdf"):
        import fitz  # PyMuPDF
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            return "\n".join(page.get_text() for page in doc).strip()
    if name.endswith(".docx"):
        import docx
        document = docx.Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in document.paragraphs).strip()
    return file_bytes.decode("utf-8", errors="ignore").strip()


def parse_label(label: str) -> Tuple[Optional[str], Optional[str]]:
    """'Q1(a)' -> ('1', 'a'); 'Q2' -> ('2', None); 'Q1.ii' -> ('1', 'ii')."""
    m = re.match(r"\s*Q?\.?\s*(\d+)\s*[\.\-]?\s*\(?\s*([a-z]{1,4})?\s*\)?", label, re.IGNORECASE)
    if not m:
        return None, None
    return m.group(1), (m.group(2) or "").lower() or None


# A line that starts a new answer: "Q1(a)", "Q.1 a)", "Ans 2(b):", "1(a)", "1.", "(b)", "b)"
MARKER_RE = re.compile(
    r"^\s*(?P<prefix>(?:Q(?:uestion)?|Ans(?:wer)?)\s*\.?\s*)?"
    r"(?:(?P<num>\d+)\s*(?P<punct>[\.\):])?\s*)?"
    r"(?:\(\s*(?P<sub1>[a-z]{1,4})\s*\)|(?P<sub2>[a-z]{1,4})\s*\))?"
    r"\s*[:\.\-]?\s*",
    re.IGNORECASE,
)


def _marker(line: str):
    """(num, sub, end) if the line starts a new answer, else None."""
    m = MARKER_RE.match(line)
    if not m:
        return None
    num, sub = m.group("num"), (m.group("sub1") or m.group("sub2") or "").lower() or None
    if not num and not sub:
        return None
    # A bare number ("3 types of data...") is only a marker with Q/Ans or "3." / "3)" / "3:"
    if num and not sub and not m.group("prefix") and not m.group("punct"):
        return None
    return num, sub, m.end()


def split_by_questions(text: str, labels: List[str]) -> Dict[str, str]:
    """Split answer-key text into {label: answer} for the given question labels.
    Answers are expected in question order, so a marker for an earlier question is
    treated as part of the current answer (e.g. a list item "a)" inside Q3)."""
    wanted = {parse_label(l): l for l in labels}
    order = {l: i for i, l in enumerate(labels)}
    sections: Dict[str, List[str]] = {}
    current_label: Optional[str] = None
    current_num: Optional[str] = None

    for line in text.splitlines():
        found = _marker(line)
        if found:
            num, sub, end = found
            key_num = num or current_num  # a bare "(b)" belongs to the last number seen
            label = wanted.get((key_num, sub)) or (wanted.get((key_num, None)) if not sub else None)
            if label and label not in sections and (current_label is None or order[label] > order[current_label]):
                current_label, current_num = label, key_num
                sections[label] = [line[end:].strip()]
                continue
        if current_label:
            sections[current_label].append(line.strip())

    return {label: _clean_answer(parts) for label, parts in sections.items()}


# "[5 Marks]", "(10 marks)", possibly broken across lines by the PDF
MARKS_TAG_RE = re.compile(r"[\[\(]\s*\d+(?:\.\d+)?\s*marks?\s*[\]\)]", re.IGNORECASE)
BULLET_RE = re.compile(r"^\s*(?:[-*•]|\d+[.)]|[a-z][.)]|\([a-z0-9]+\))\s+", re.IGNORECASE)


def _clean_answer(lines: List[str]) -> str:
    """
    Turn one answer's raw lines into clean model-answer text:
    - drop the repeated question text that answer keys often put on the marker line
      (everything up to a "[5 Marks]" tag near the start)
    - re-join lines the PDF hard-wrapped mid-sentence, keeping bullets and paragraphs
    """
    text = "\n".join(l for l in lines if l is not None)
    head = MARKS_TAG_RE.search(re.sub(r"\s*\n\s*", " ", text[:400]))
    if head:
        # Find the same tag position in the original text (whitespace may differ)
        flat_index = head.end()
        consumed, i = 0, 0
        while i < len(text) and consumed < flat_index:
            if text[i].isspace():
                while i < len(text) and text[i].isspace():
                    i += 1
                consumed += 1
            else:
                i += 1
                consumed += 1
        text = text[i:]

    paragraphs: List[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            if paragraphs and paragraphs[-1]:
                paragraphs.append("")
            continue
        prev = paragraphs[-1] if paragraphs else ""
        if prev and not BULLET_RE.match(line) and not prev.endswith((".", ";", "?", "!")):
            paragraphs[-1] = f"{prev} {line}"
        else:
            paragraphs.append(line)
    return "\n".join(p for p in paragraphs if p).strip()


def gemini_split(text: str, labels: List[str]) -> Dict[str, str]:
    """Second attempt at splitting, used only when rule-based splitting misses questions."""
    if not llm_available("text"):
        return {}
    prompt = f"""This is a teacher's typed answer key. Split it into the model answer for each of
these question labels: {labels}. Copy the answer text exactly; do not summarise or add anything.
Use an empty string for a label with no answer.

Answer key:
{text}

Respond ONLY with valid JSON: {{"answers": {{"<label>": "<answer text>"}}}}"""
    raw, engine = call_llm(prompt, task="text", timeout=90)
    if not raw:
        return {}
    gemini_split.last_engine = engine
    try:
        answers = json.loads(raw).get("answers", {})
        return {l: str(answers.get(l, "")).strip() for l in labels if answers.get(l)}
    except Exception as e:
        logger.error(f"Failed to parse Gemini split JSON: {e}")
        return {}


def split_answer_key(text: str, labels: List[str]) -> Tuple[Dict[str, str], str]:
    """Returns ({label: model answer}, engine)."""
    answers = split_by_questions(text, labels)
    if len(answers) >= max(1, len(labels) // 2):
        return answers, "rules"
    second = gemini_split(text, labels)
    if len(second) > len(answers):
        return second, getattr(gemini_split, "last_engine", None) or "llm"
    return answers, "rules"
