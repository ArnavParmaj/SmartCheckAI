"""
Knowledge Builder
Turns one question's model answer and rubric into the knowledge the grader uses:
  { model_answer, concepts: [...], criteria: [{criterion, description, marks, concepts}] }
Each key concept from the model answer is attached to the rubric criterion it best
supports, so marks can be explained criterion by criterion. Runs locally.
"""

from typing import Any, Dict, List, Optional

from agents.concept_agent.concept_extractor import extract_key_points
from agents.evaluation_agent.semantic_matcher import get_model

# A key point is placed under a single criterion only when it clearly matches it
# (similarity >= CLEAR_MATCH); criteria within MARGIN of the best match share it.
CLEAR_MATCH = 0.35
MARGIN = 0.08


def _normalise_criteria(criteria: List[Dict[str, Any]], question_text: str, max_marks: float) -> List[Dict[str, Any]]:
    cleaned = []
    for c in criteria or []:
        name = str(c.get("criterion") or "").strip()
        desc = str(c.get("description") or "").strip()
        marks = float(c.get("marks", c.get("max_marks", 0)) or 0)
        if (name or desc) and marks > 0:
            cleaned.append({"criterion": name or desc[:60], "description": desc, "marks": marks})

    if not cleaned:
        return [{"criterion": "Content and accuracy", "description": question_text, "marks": float(max_marks)}]

    # Rubric marks that don't add up to the question's marks are scaled to fit
    total = sum(c["marks"] for c in cleaned)
    if max_marks and abs(total - max_marks) > 0.01:
        for c in cleaned:
            c["marks"] = round(c["marks"] * max_marks / total * 4) / 4
    return cleaned


def _assign_concepts(concepts: List[str], criteria: List[Dict[str, Any]]) -> None:
    """Attach each concept to the most similar criterion (in place)."""
    for c in criteria:
        c["concepts"] = []
    if not concepts:
        return
    if len(criteria) == 1:
        criteria[0]["concepts"] = list(concepts)
        return
    model = get_model()
    if model is None:
        for i, concept in enumerate(concepts):
            criteria[i % len(criteria)]["concepts"].append(concept)
        return
    from sentence_transformers import util
    sims = util.cos_sim(
        model.encode(concepts, convert_to_tensor=True),
        model.encode([f"{c['criterion']}. {c['description']}" for c in criteria], convert_to_tensor=True),
    )
    for i, concept in enumerate(concepts):
        row = [float(x) for x in sims[i]]
        best = max(row)
        if best < CLEAR_MATCH:
            # Rubric wording too generic to place this point (e.g. "Identifies the Vs"):
            # it counts toward every criterion; faculty can narrow it in review
            targets = range(len(criteria))
        else:
            targets = [j for j, v in enumerate(row) if v >= best - MARGIN]
        for j in targets:
            criteria[j]["concepts"].append(concept)


def build_knowledge(
    question_text: str,
    model_answer: str,
    criteria: List[Dict[str, Any]],
    max_marks: float,
    rules: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """rules: the rubric's deduction rules and general marking guidelines for this question."""
    concepts = extract_key_points(model_answer)["concepts"] if model_answer.strip() else []
    normalised = _normalise_criteria(criteria, question_text, max_marks)
    _assign_concepts(concepts, normalised)
    return {"model_answer": model_answer, "concepts": concepts, "criteria": normalised, "rules": list(rules or [])}
