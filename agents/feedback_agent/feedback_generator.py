"""
Feedback Generator Module
Produces short, student-facing feedback from a grading result, built locally from
the covered and missing concepts. (When Gemini also graded the answer, the scorer
uses Gemini's wording instead.)
"""

from typing import List


def template_feedback(marks: float, max_marks: float, covered: List[str], missing: List[str]) -> str:
    if max_marks and marks >= max_marks:
        return "Complete answer - all key points are covered."
    from agents.concept_agent.concept_extractor import concept_label
    covered = [concept_label(c) for c in covered]
    missing = [concept_label(c) for c in missing]
    parts = []
    if covered:
        parts.append("Good: you covered " + ", ".join(covered) + ".")
    if missing:
        parts.append("To improve, include " + ", ".join(missing) + ".")
    return " ".join(parts) or "The answer does not address the question; review this topic."
