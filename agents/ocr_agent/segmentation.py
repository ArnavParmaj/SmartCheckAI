"""
Segmentation Module
Identifies and segments question boundaries, answer sections, and sub-questions
(e.g., "Q1(a)", "Q1(b)", "Q2(a)", "Q2(b)") from extracted OCR text and spatial coordinates.
"""

import re
from typing import Dict, List, Optional, Any, Tuple


def assemble_lines_with_layout(lines: List[Dict[str, Any]]) -> str:
    """
    Cluster spatial OCR lines into natural reading rows while stripping table metadata columns
    (e.g., marks [05], course outcomes CO1, Bloom levels L2).
    """
    if not lines:
        return ""

    # Determine maximum x coordinate to detect right-hand metadata column
    max_x = max(max(p[0] for p in l.get("box", [[0, 0]])) for l in lines) if lines else 1000

    # Pattern for curriculum and exam table metadata (Marks, [05], [so], CO1, BL, L2, etc.)
    meta_re = re.compile(
        r"^\s*(\[?0?5\]?|\[?so\]?|\[?\d+\]?|CO\d*|BL|L\d+|Marks|CO)\s*$",
        re.IGNORECASE,
    )

    cleaned = []
    for l in lines:
        t = str(l.get("text", "")).strip()
        if not t:
            continue

        box = l.get("box", [[0, 0]])
        x_min = min(p[0] for p in box)
        y_min = min(p[1] for p in box)
        y_max = max(p[1] for p in box)

        # Filter out table metadata cells on the far-right margin (>72% width)
        if x_min > max_x * 0.72 and meta_re.match(t):
            continue

        height = max(1.0, y_max - y_min)
        y_center = (y_min + y_max) / 2.0
        cleaned.append({
            "text": t,
            "y": y_center,
            "x": x_min,
            "height": height,
        })

    # Sort primarily by vertical center
    cleaned.sort(key=lambda item: (item["y"], item["x"]))

    # Group into horizontal rows (within strict 10px vertical distance)
    rows = []
    for item in cleaned:
        matched = None
        for r in rows:
            if abs(r["y"] - item["y"]) <= min(10.0, item["height"] * 0.5):
                matched = r
                break
        if matched:
            matched["items"].append(item)
            matched["items"].sort(key=lambda x: x["x"])
            matched["y"] = sum(i["y"] for i in matched["items"]) / len(matched["items"])
        else:
            rows.append({"y": item["y"], "items": [item]})

    rows.sort(key=lambda r: r["y"])
    assembled_rows = [" ".join(i["text"] for i in r["items"]) for r in rows]
    return "\n".join(assembled_rows)


def bifurcate_sub_questions(parent_q_num: str, block_text: str) -> Dict[str, str]:
    """
    Sub-segment a question block into discrete sub-questions like Q1(a), Q1(b), Q2(a)...
    Detects sub-part markers (a, b, c, d, i, ii), standalone choice keywords (OR, AND),
    and common OCR character distortions.
    """
    # Regex matching sub-question markers:
    # 1) (OR|AND) optionally followed by subpart marker (e.g. "OR\nb)" or "OR\n(P" or just "OR\n")
    # 2) standard subpart markers: "(a)", "a)", "a.", "(i)", "(P)" or letter with bracket
    sub_marker_re = re.compile(
        r"(?:^|\n)\s*(?:(OR|AND)\s*\n?\s*)?(?:[\(\[]([a-hA-H]|[ivxIVX]+|[Pp])[\)\]]?|([a-hA-H]|[ivxIVX]+)[\)\]\.]|(OR|AND)(?=\n|\s+[A-Z]))\s*",
        re.IGNORECASE,
    )

    matches = list(sub_marker_re.finditer(block_text))
    if not matches:
        return {f"Q{parent_q_num}": block_text.strip()}

    letter_seq = ["a", "b", "c", "d", "e", "f", "g", "h"]
    sub_dict: Dict[str, str] = {}

    # Initial text before first sub-question marker (e.g., if parent was "Q2a) ... OR b) ...")
    first_pre = block_text[:matches[0].start()].strip()
    first_pre = re.sub(r"^\(?[a-hA-H1-9Pp][\.\)]\s*", "", first_pre)
    first_pre = re.sub(r"^\(?[a-hA-H1-9Pp]\)?\s*\n\s*", "", first_pre).strip()
    if first_pre and len(first_pre) > 5:
        sub_dict[f"Q{parent_q_num}(a)"] = first_pre

    for idx, sm in enumerate(matches):
        choice = (sm.group(1) or sm.group(4) or "").upper()
        raw_sub = sm.group(2) or sm.group(3) or ""
        sub_letter = raw_sub.lower()

        # Typo correction: if OCR read "(P" for "d" or missed letter
        if sub_letter in ["p", ""]:
            seq_idx = len(sub_dict)
            sub_letter = letter_seq[seq_idx] if seq_idx < len(letter_seq) else str(seq_idx + 1)

        start = sm.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(block_text)
        content = block_text[start:end].strip()

        # Clean any stray leading typo markers like "(P\n" or "a)", ensuring normal words (Explain, Draw, Given) are never stripped
        content = re.sub(r"^\(?[a-hA-H1-9Pp][\.\)]\s*", "", content)
        content = re.sub(r"^\(?[a-hA-H1-9Pp]\)?\s*\n\s*", "", content).strip()

        tag = f"Q{parent_q_num}({sub_letter})"
        if choice:
            content = f"[{choice}] {content}"

        if content:
            sub_dict[tag] = content

    return sub_dict if sub_dict else {f"Q{parent_q_num}": block_text.strip()}


def segment_answers(ocr_text: str, lines: Optional[List[Dict[str, Any]]] = None) -> Dict[str, str]:
    """
    Parse OCR text or spatial lines to detect question markers and bifurcate into
    per-question / per-sub-question text (e.g., Q1(a), Q1(b), Q2(a)...).

    Args:
        ocr_text: Full transcribed text from OCR engine.
        lines: Optional list of structured line objects with text and bounding box.

    Returns:
        Dict mapping question keys (e.g., "Q1(a)", "Q1(b)") to corresponding question text,
        guaranteed to be naturally sorted.
    """
    if lines:
        assembled = assemble_lines_with_layout(lines)
        if assembled:
            ocr_text = assembled

    if not ocr_text or not ocr_text.strip():
        return {"Q1": ""}

    # 1. First priority: Check for explicit Q-markers (Q1, Q2, Question 1, Ans 1, Q2a, etc.)
    q_marker_re = re.compile(
        r"(?:^|\n)\s*(?:Q(?:uestion|ue)?|Ans(?:wer)?)\s*[:\-\.]?\s*(\d+)(?:\s*([a-h])[\)\.]?)?",
        re.IGNORECASE,
    )
    parent_matches = list(q_marker_re.finditer(ocr_text))

    # 2. Second priority: If no explicit Q markers found, match numbered items like "1.", "2)",
    # skipping instruction preambles
    if not parent_matches:
        numbered_re = re.compile(
            r"(?:^|\n)\s*(?:\(?(\d+)[\.\)\:]\s+)",
            re.IGNORECASE,
        )
        instr_idx = -1
        instr_match = re.search(r"instructions?[:\n\.]", ocr_text, re.IGNORECASE)
        if instr_match:
            instr_idx = instr_match.end()

        raw_matches = list(numbered_re.finditer(ocr_text))
        if instr_idx > 0:
            parent_matches = [m for m in raw_matches if m.start() > instr_idx]
        else:
            parent_matches = raw_matches

    # 3. Fallback: If no markers detected anywhere, return entire text under "Q1"
    if not parent_matches:
        return {"Q1": ocr_text.strip()}

    raw_bifurcated: Dict[str, str] = {}

    for i, match in enumerate(parent_matches):
        q_num = match.group(1)
        inline_sub = match.group(2) if len(match.groups()) >= 2 else None

        start_pos = match.end()
        end_pos = parent_matches[i + 1].start() if (i + 1 < len(parent_matches)) else len(ocr_text)

        content = ocr_text[start_pos:end_pos].strip()

        # If inline subpart was attached to question header (e.g. Q2a), prepend it
        if inline_sub:
            content = f"{inline_sub}) {content}"

        # Bifurcate this parent question block into sub-questions if present
        sub_items = bifurcate_sub_questions(q_num, content)
        for k, v in sub_items.items():
            if k in raw_bifurcated:
                raw_bifurcated[k] = f"{raw_bifurcated[k]}\n{v}".strip()
            else:
                raw_bifurcated[k] = v

    # Natural sorting helper: sort by parent number, then sub-letter
    def natural_sort_key(key_str: str) -> Tuple[int, str]:
        # Match pattern Q<number>(<subpart>) or Q<number>
        m = re.match(r"Q(\d+)(?:\((.+)\))?", key_str, re.IGNORECASE)
        if m:
            num = int(m.group(1))
            sub = m.group(2) or ""
            return (num, sub)
        num_search = re.search(r"\d+", key_str)
        return (int(num_search.group()) if num_search else 999, key_str)

    sorted_answers = {
        k: raw_bifurcated[k]
        for k in sorted(raw_bifurcated.keys(), key=natural_sort_key)
        if raw_bifurcated[k].strip()
    }

    return sorted_answers if sorted_answers else {"Q1": ocr_text.strip()}
