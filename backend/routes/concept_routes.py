"""
Concept Extraction Routes
Extracts the key concepts a correct answer must contain from a model answer / rubric
(local KeyBERT, keyword fallback).
"""

from fastapi import APIRouter
from pydantic import BaseModel

from agents.concept_agent.concept_extractor import extract_concepts

router = APIRouter(prefix="/concepts", tags=["Concepts"])


class ConceptRequest(BaseModel):
    model_answer: str
    max_concepts: int = 6


@router.post("/extract")
def extract(req: ConceptRequest):
    return {"status": "success", **extract_concepts(req.model_answer, req.max_concepts)}
