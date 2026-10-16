"""
Printed Document Reading
Question papers and marking rubrics are printed, so they are read without a large AI model:
  1. Text: the text layer of a typed PDF/DOCX/TXT, else RapidOCR (PaddleOCR's PP-OCR
     models on ONNX Runtime) for scans and photos.
  2. Structure: rules for question headings, marks, OR/AND choices, rubric criterion
     tables, deduction lists and general guidelines.
The routes only fall back to the local vision/text model when these rules find nothing.
Handwritten answer sheets still go to the vision model (agents/ocr_agent/gemini_ocr.py).
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from agents.concept_agent.answer_key import read_typed_document
from agents.ocr_agent.ocr import run_ocr
from agents.ocr_agent.segmentation import assemble_lines_with_layout

logger = logging.getLogger("printed_documents")

DEFAULT_MARKS = 5

# "Q1. a) Explain...", "Q2a)Demonstrate", "Q3 Attempt any one", "Question 4: ..."
Q_RE = re.compile(r"^\s*Q(?:uestion)?\s*\.?\s*(\d+)\s*[.:)]?\s*(?:\(?([a-h])\))?\s*(.*)$", re.IGNORECASE)
SUB_RE = re.compile(r"^\s*\(?([a-h])\s*[).]\s*(.*)$")
CONDITION_RE = re.compile(r"^\s*(OR|AND)\s*$", re.IGNORECASE)
ATTEMPT_RE = re.compile(r"attempt\s+any\s+\w+", re.IGNORECASE)
MARKS_RE = re.compile(r"[\[(]\s*0?(\d{1,2}(?:\.\d+)?)\s*(?:marks?|m)?\s*[\])]", re.IGNORECASE)
BULLET_RE = re.compile(r"^\s*(?:[•●▪◦*\-–]|\d+[.)])\s*(.*)$")


def label_for(number: str, letter: Optional[str]) -> str:
    return f"Q{int(number)}({letter.lower()})" if letter else f"Q{int(number)}"


def read_printed_document(file_bytes: bytes, filename: str, page_images: List[str], keep_numbers: bool = False) -> Tuple[str, str]:
    """
    (text, engine): the typed text layer when there is one, else RapidOCR over the page images.
    keep_numbers keeps short numeric cells (rubric marks) that layout assembly otherwise
    drops as margin metadata of question papers.
    """
    text = ""
    if re.search(r"\.(pdf|docx|txt)$", filename or "", re.IGNORECASE):
        try:
            text = read_typed_document(file_bytes, filename)
        except Exception:
            text = ""
    if len(text.strip()) >= 50:
        return text, "local-text"
    pages = []
    for path in page_images:
        res = run_ocr(path)
        pages.append(assemble_lines_with_layout(res.get("lines") or [], strip_metadata=not keep_numbers) or res.get("text", ""))
    return "\n".join(pages), "local-rapidocr"


def parse_questions(text: str) -> List[Dict[str, Any]]:
    """Questions and sub-questions from question paper text, in the order printed."""
    items: List[Dict[str, Any]] = []
    number: Optional[str] = None
    current: Optional[Dict[str, Any]] = None
    group_condition: Dict[str, str] = {}
    pending: Optional[str] = None  # "OR"/"AND" seen; the next block is a new alternative

    def start(letter: Optional[str], first_line: str):
        nonlocal current, pending
        current = {"id": label_for(number, letter), "lines": [first_line] if first_line else [], "condition": pending}
        if pending and items and items[-1]["id"].startswith(f"Q{int(number)}"):
            items[-1]["condition"] = items[-1]["condition"] or pending
        pending = None
        items.append(current)

    def next_letter() -> str:
        letters = [re.search(r"\(([a-h])\)$", i["id"]) for i in items if i["id"].startswith(f"Q{int(number)}(")]
        last = max((m.group(1) for m in letters if m), default="`")
        return chr(ord(last) + 1)

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        q = Q_RE.match(line)
        if q:
            number, letter, rest = q.group(1), q.group(2), q.group(3).strip()
            current, pending = None, None
            if ATTEMPT_RE.search(rest) and not letter:
                group_condition[number] = "ATTEMPT ANY ONE"
                rest = ATTEMPT_RE.sub("", rest).strip(" :-")
            if letter or rest:
                start(letter, rest)
            continue
        if number is None:
            continue  # paper header and instructions
        if CONDITION_RE.match(line):
            pending = line.upper()
            continue
        sub = SUB_RE.match(line)
        if sub:
            start(sub.group(1), sub.group(2).strip())
        elif pending or current is None:
            # A block after "OR" with its label lost (common in scans), or text under a bare "Q3"
            start(next_letter() if (pending or group_condition.get(number)) else None, line)
        else:
            current["lines"].append(line)

    questions = []
    for item in items:
        body = " ".join(item["lines"])
        marks_match = MARKS_RE.search(body)
        marks = float(marks_match.group(1)) if marks_match else DEFAULT_MARKS
        body = MARKS_RE.sub("", body).strip(" .")
        if len(body) < 8:
            continue
        group = item["id"].split("(")[0]
        questions.append({
            "id": item["id"],
            "text": re.sub(r"\s+", " ", body),
            "marks": int(marks) if marks == int(marks) else marks,
            "choice_group": group,
            "condition": item["condition"] or group_condition.get(group[1:]),
        })
    return questions


def normalize_label(label: str) -> str:
    """"Q2.a", "2 (a)", "Q2a" -> "Q2(a)"; anything else ("General") unchanged."""
    m = re.fullmatch(r"\s*Q?(?:uestion)?\s*\.?\s*(\d+)\s*[.:]?\s*\(?([a-h])?\)?\s*", str(label or ""), re.IGNORECASE)
    return label_for(m.group(1), m.group(2)) if m else label


def _question_label(line: str) -> Optional[str]:
    q = Q_RE.match(line)
    return label_for(q.group(1), q.group(2)) if q else None


def _number(value: Any) -> Optional[float]:
    m = re.search(r"\d+(?:\.\d+)?", str(value or ""))
    return float(m.group()) if m else None


def parse_rubric_tables(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Criterion rows from the tables of a typed rubric PDF. Each table belongs to the
    nearest question heading above it (headings and tables are walked in page order).
    """
    import pymupdf

    rows: List[Dict[str, Any]] = []
    label: Optional[str] = None
    with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page in doc:
            events = []
            for block in page.get_text("blocks"):
                for line in str(block[4]).splitlines():
                    found = _question_label(line)
                    if found:
                        events.append((block[1], "heading", found))
                        break
            for table in page.find_tables().tables:
                events.append((table.bbox[1], "table", table))
            for _y, kind, value in sorted(events, key=lambda e: e[0]):
                if kind == "heading":
                    label = value
                    continue
                cells = value.extract()
                if not cells:
                    continue
                header = [str(c or "").strip().lower() for c in cells[0]]
                col = lambda *names: next((i for i, h in enumerate(header) if any(n in h for n in names)), None)
                c_name, c_marks = col("criterion", "criteria"), col("mark")
                if c_name is None or c_marks is None or label is None:
                    continue  # e.g. a score-band table
                c_points, c_partial = col("expected", "points", "keyword", "description"), col("partial")
                for row in cells[1:]:
                    name = str(row[c_name] or "").strip()
                    marks = _number(row[c_marks])
                    if not name or name.lower().startswith("total") or marks is None:
                        continue
                    points = str(row[c_points] or "").strip() if c_points is not None else ""
                    partial = str(row[c_partial] or "").strip() if c_partial is not None else ""
                    description = points + (f" | Partial credit: {partial}" if partial else "")
                    rows.append({
                        "type": "criterion", "question_id": label, "criterion": re.sub(r"\s+", " ", name),
                        "max_marks": marks, "description": re.sub(r"\s+", " ", description).strip(),
                    })
    return rows


def parse_criteria_text(text: str) -> List[Dict[str, Any]]:
    """
    Criterion rows from typed rubric text without table structure (DOCX/TXT): numbered rows like "1.1 Definition of Big Data 1 too large / fast ..." under a question heading.
    """
    rows: List[Dict[str, Any]] = []
    label: Optional[str] = None
    row_re = re.compile(r"^\s*(\d+)\.(\d+)\s+(.+?)\s+(\d+(?:\.\d+)?)(?:\s+(.*))?$")
    for line in text.splitlines():
        found = _question_label(line)
        if found:
            label = found
            continue
        m = row_re.match(line)
        if m and label:
            rows.append({
                "type": "criterion", "question_id": label, "criterion": m.group(3).strip(),
                "max_marks": float(m.group(4)), "description": (m.group(5) or "").strip(),
            })
        elif rows and label and rows[-1]["question_id"] == label and line.strip() and not BULLET_RE.match(line) \
                and not re.match(r"^\s*(total|deduction|score band|marks\b)", line, re.IGNORECASE):
            rows[-1]["description"] = f"{rows[-1]['description']} {line.strip()}".strip()
    return rows


def _collect_items(lines: List[str]) -> List[str]:
    """Bulleted or numbered items, joining each item's wrapped lines."""
    items: List[str] = []
    for line in lines:
        m = BULLET_RE.match(line)
        if m and m.group(1).strip():
            items.append(m.group(1).strip())
        elif items and line.strip():
            items[-1] = f"{items[-1]} {line.strip()}"
    return items


def parse_rubric_rules(text: str) -> List[Dict[str, Any]]:
    """General marking guidelines (before the first question) and each question's deductions."""
    rows: List[Dict[str, Any]] = []
    lines = text.splitlines()
    first_q = next((i for i, l in enumerate(lines) if _question_label(l)), len(lines))

    start = next((i + 1 for i, l in enumerate(lines[:first_q]) if re.search(r"guideline|instruction", l, re.IGNORECASE)), None)
    if start is not None:
        for item in _collect_items(lines[start:first_q]):
            rows.append({"type": "guideline", "question_id": "General", "criterion": " ".join(item.split()[:6]),
                         "max_marks": 0, "description": item})

    label: Optional[str] = None
    in_deductions = False
    block: List[str] = []

    def flush():
        if label and block:
            for item in _collect_items(block):
                rows.append({"type": "deduction", "question_id": label, "criterion": item.split(":")[0][:80],
                             "max_marks": 0, "description": item})
        block.clear()

    for line in lines[first_q:]:
        found = _question_label(line)
        if found:
            flush()
            label, in_deductions = found, False
        elif not BULLET_RE.match(line) and re.search(r"deduction|common error|misconception", line, re.IGNORECASE):
            flush()
            in_deductions = True
        elif re.match(r"^\s*(score band|band descriptor)", line, re.IGNORECASE):
            flush()
            in_deductions = False
        elif in_deductions:
            block.append(line)
    flush()
    return rows
