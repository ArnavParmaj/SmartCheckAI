"""
Segmentation Module
Identifies and segments question boundaries, answer sections, and question markers
(e.g., "Q1", "Q.1", "1.", "Question 1", "Ans 1") from extracted OCR text.
"""

import re
from typing import Dict

# Regex pattern matching various question header formats:
# 1. Q1, Q.1, Q 1, Q-1, Q: 1
# 2. Question 1, Question. 1, Question: 1, Question - 1
# 3. Que 1, Que. 1, Que: 1
# 4. Ans 1, Ans. 1, Answer 1, Answer: 1
# 5. Numbered markers like 1., 2), (1), 1: at start of line
QUESTION_MARKER_REGEX = re.compile(
    r"(?:^|\n)\s*"
    r"(?:"
    r"(?:Q(?:uestion|ue)?|Ans(?:wer)?)\.?\s*[:\-\.]?\s*(\d+)"
    r"|"
    r"\(?(\d+)\)?\s*[\.\:\-\)]"
    r"|"
    r"\bQ(\d+)\b"
    r")"
    r"[\s\:\.\-]*",
    re.IGNORECASE,
)


def segment_answers(ocr_text: str) -> Dict[str, str]:
    """
    Parse OCR text to detect question markers and segment into per-question answers.

    Args:
        ocr_text: Full transcribed text from OCR engine.

    Returns:
        Dict mapping question keys (e.g., "Q1", "Q2") to corresponding student answer text.
        If no question markers are detected, returns entire text under key "Q1".
    """
    if not ocr_text or not ocr_text.strip():
        return {"Q1": ""}

    # 1. Find all question marker occurrences in text
    matches = list(QUESTION_MARKER_REGEX.finditer(ocr_text))

    # 2. If no markers detected, return entire text under key "Q1"
    if not matches:
        return {"Q1": ocr_text.strip()}

    answers: Dict[str, str] = {}

    # 3. Split text by question marker boundaries
    for i, match in enumerate(matches):
        # Determine question number from whichever capturing group matched
        q_num = match.group(1) or match.group(2) or match.group(3)
        key = f"Q{q_num}"

        start_pos = match.end()
        end_pos = matches[i + 1].start() if (i + 1 < len(matches)) else len(ocr_text)

        content = ocr_text[start_pos:end_pos].strip()

        # Handle multi-page or continued answers under the same question number
        if key in answers:
            if content:
                answers[key] = f"{answers[key]}\n{content}".strip()
        else:
            answers[key] = content

    # 4. Fallback if markers matched but yielded empty answers
    if not answers or all(not v for v in answers.values()):
        return {"Q1": ocr_text.strip()}

    return answers
