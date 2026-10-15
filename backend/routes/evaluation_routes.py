"""
Evaluation Routes
Grades student answers with the hybrid scorer: local concept coverage + semantic
similarity, plus an optional Gemini second opinion.
"""

from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from agents.evaluation_agent.scorer import ensure_criteria, gemini_grade_batch, grade_answer
from agents.evaluation_agent.semantic_matcher import get_model

router = APIRouter(prefix="/evaluation", tags=["Evaluation"])


class AnswerToGrade(BaseModel):
    question_id: str
    question_text: str = ""
    model_answer: str = ""  # model answer and/or rubric text
    student_answer: str = ""
    max_marks: float = 5
    ocr_confidence: Optional[float] = None
    criteria: List[Dict[str, Any]] = []  # knowledge-base criteria with their key points


class EvaluateRequest(BaseModel):
    answers: List[AnswerToGrade]
    use_gemini: bool = True


@router.post("/evaluate")
def evaluate_answers(req: EvaluateRequest):
    """Grade each answer; returns one result per question_id."""
    get_model()  # load the shared model once before grading in parallel

    criteria = {
        a.question_id: ensure_criteria(a.question_text, a.model_answer, a.criteria or None, a.max_marks or 5)
        for a in req.answers
        if a.model_answer.strip() or a.criteria
    }
    # One Gemini call for the whole sheet instead of one per answer
    second_opinions = gemini_grade_batch([
        {"question_id": a.question_id, "question_text": a.question_text, "model_answer": a.model_answer,
         "criteria": criteria[a.question_id], "student_answer": a.student_answer}
        for a in req.answers if a.question_id in criteria
    ]) if req.use_gemini else {}

    def run(a: AnswerToGrade):
        result = grade_answer(
            a.question_text, a.model_answer, a.student_answer, a.max_marks, a.ocr_confidence,
            use_gemini=False,
            criteria=criteria.get(a.question_id),
            gemini_result=second_opinions.get(a.question_id),
        )
        return {"question_id": a.question_id, **result}

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(run, req.answers))

    return {"status": "success", "results": results}
