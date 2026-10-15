"""
Confidence Module
Combines OCR confidence with how well the independent grading signals agree
(concept coverage vs semantic similarity, and local vs Gemini when available)
into one confidence score, and decides whether a teacher should review the answer.
"""

from typing import List, Optional, Tuple

REVIEW_THRESHOLD = 0.75
# If two grading signals differ by more than this (as fractions of full marks),
# the answer always goes to the teacher.
DISAGREEMENT_LIMIT = 0.3


def combine(ocr_confidence: Optional[float], signals: List[float]) -> Tuple[float, bool]:
    """
    signals: score fractions (0.0-1.0) from each grader that ran.
    Returns (overall confidence 0.0-1.0, needs_review).
    """
    ocr = ocr_confidence if ocr_confidence is not None else 0.8
    spread = (max(signals) - min(signals)) if len(signals) > 1 else 0.5
    agreement = 1.0 - spread
    # A single signal can't be cross-checked, so it caps lower
    if len(signals) < 2:
        agreement = min(agreement, 0.6)

    overall = round(max(0.0, min(1.0, 0.4 * ocr + 0.6 * agreement)), 3)
    needs_review = overall < REVIEW_THRESHOLD or spread > DISAGREEMENT_LIMIT
    return overall, needs_review
