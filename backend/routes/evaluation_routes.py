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
from agents import progress

router = APIRouter(prefix="/evaluation", tags=["Evaluation"])


class AnswerToGrade(BaseModel):
    question_id: str
    question_text: str = ""
    model_answer: str = ""  # model answer and/or rubric text
    student_answer: str = ""
    max_marks: float = 5
    ocr_confidence: Optional[float] = None
    criteria: List[Dict[str, Any]] = []  # knowledge-base criteria with their key points
    rules: List[str] = []  # rubric deductions and general marking guidelines


class EvaluateRequest(BaseModel):
    answers: List[AnswerToGrade]
    use_gemini: bool = True
    job_id: Optional[str] = None  # live progress at GET /progress/{job_id}


@router.post("/evaluate")
def evaluate_answers(req: EvaluateRequest):
    """Grade each answer; returns one result per question_id."""
    job = req.job_id
    progress.update(job, "Preparing marking criteria", stage="grading")
    get_model()  # load the shared model once before grading in parallel

    criteria = {
        a.question_id: ensure_criteria(a.question_text, a.model_answer, a.criteria or None, a.max_marks or 5)
        for a in req.answers
        if a.model_answer.strip() or a.criteria
    }
    # One model call for the whole sheet instead of one per answer
    progress.update(job, f"Second opinion on {len(criteria)} answer{'' if len(criteria) == 1 else 's'} (local Qwen)", stage="grading")
    second_opinions = gemini_grade_batch([
        {"question_id": a.question_id, "question_text": a.question_text, "model_answer": a.model_answer,
         "criteria": criteria[a.question_id], "rules": a.rules, "student_answer": a.student_answer}
        for a in req.answers if a.question_id in criteria
    ], on_progress=lambda msg: progress.update(job, msg, stage="grading")) if req.use_gemini else {}
    progress.update(job, "Combining keyword, similarity and model scores", stage="grading")

    def run(a: AnswerToGrade):
        result = grade_answer(
            a.question_text, a.model_answer, a.student_answer, a.max_marks, a.ocr_confidence,
            use_gemini=False,
            criteria=criteria.get(a.question_id),
            gemini_result=second_opinions.get(a.question_id),
            rules=a.rules,
        )
        return {"question_id": a.question_id, **result}

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(run, req.answers))

    progress.update(job, "Graded", stage="done")
    return {"status": "success", "results": results}
