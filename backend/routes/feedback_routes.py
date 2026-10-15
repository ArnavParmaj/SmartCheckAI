"""
Feedback Routes
Builds student-facing feedback from a grade and the covered / missing concepts.
"""

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

from agents.feedback_agent.feedback_generator import template_feedback

router = APIRouter(prefix="/feedback", tags=["Feedback"])


class FeedbackRequest(BaseModel):
    marks_awarded: float
    max_marks: float
    concepts_covered: List[str] = []
    concepts_missed: List[str] = []


@router.post("/generate")
def generate(req: FeedbackRequest):
    feedback = template_feedback(req.marks_awarded, req.max_marks, req.concepts_covered, req.concepts_missed)
    return {"status": "success", "feedback": feedback}
