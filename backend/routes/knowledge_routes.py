"""
Knowledge Routes
Builds the per-question knowledge base from the faculty's typed answer key and rubric:
model answer, key points, and which rubric criterion each key point earns marks for.
"""

import json
from typing import Any, Dict, List

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from agents.concept_agent.answer_key import read_typed_document, split_answer_key
from agents.concept_agent.knowledge_builder import build_knowledge
from agents.evaluation_agent.semantic_matcher import get_model

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])


class QuestionSpec(BaseModel):
    label: str
    text: str = ""
    max_marks: float = 5
    criteria: List[Dict[str, Any]] = []
    rules: List[str] = []  # rubric deductions and general marking guidelines
    model_answer: str = ""


@router.post("/build")
async def build_from_answer_key(
    questions: str = Form(..., description="JSON list of {label, text, max_marks, criteria}"),
    file: UploadFile = File(None),
    answer_key_text: str = Form(""),
) -> Dict[str, Any]:
    """Read the answer key (file or pasted text), split it by question and build knowledge."""
    specs = [QuestionSpec(**q) for q in json.loads(questions)]
    text = answer_key_text
    if file is not None:
        text = read_typed_document(await file.read(), file.filename or "answer_key.txt")
    if not text.strip():
        return {"status": "error", "message": "The answer key has no readable text. Upload a typed PDF, Word (.docx) or text file."}

    answers, engine = split_answer_key(text, [q.label for q in specs])
    get_model()
    knowledge = {}
    for q in specs:
        model_answer = answers.get(q.label, "")
        knowledge[q.label] = build_knowledge(q.text, model_answer, q.criteria, q.max_marks, q.rules)

    missing = [q.label for q in specs if not answers.get(q.label)]
    return {"status": "success", "split_engine": engine, "knowledge": knowledge, "missing": missing}


@router.post("/rebuild")
def rebuild_question(q: QuestionSpec) -> Dict[str, Any]:
    """Rebuild one question's knowledge after faculty edit its model answer or criteria."""
    return {"status": "success", "knowledge": build_knowledge(q.text, q.model_answer, q.criteria, q.max_marks, q.rules)}
