"""
Scorer Module
Hybrid, criterion-wise grader. For each rubric criterion of a question the local
pipeline (no external API) checks:
  - concept coverage: the criterion's key concepts (from the faculty answer key)
    found in the student answer, literally or by meaning
  - semantic similarity between the criterion and the closest part of the answer
and awards that criterion's marks in 0.5 steps, with a reason. If GEMINI_API_KEY is
set, Gemini grades the same criteria as a second opinion and each criterion's mark is
the average of both. Disagreement between signals sends the answer to faculty review.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from agents.concept_agent.concept_extractor import concept_label
from agents.concept_agent.knowledge_builder import build_knowledge
from agents.evaluation_agent.concept_matcher import match_concepts
from agents.evaluation_agent.confidence import combine
from agents.evaluation_agent.semantic_matcher import best_chunk_similarity, similarity
from agents.feedback_agent.feedback_generator import template_feedback
from agents.ocr_agent.gemini_ocr import GEMINI_TEXT_MODEL, _call_gemini_vision, is_gemini_available

logger = logging.getLogger("scorer")

# MiniLM cosine similarity rarely goes below ~0.2 for any text or above ~0.85 for a
# paraphrase, so rescale that band to 0-1 before treating it as a score fraction.
SIM_FLOOR, SIM_CEIL = 0.2, 0.85
COVERAGE_WEIGHT = 0.6  # criterion score = 60% concept coverage + 40% similarity
MET, PARTIAL = 0.8, 0.3  # fraction of a criterion's marks for "met" / "partly met"


def _round_half(x: float) -> float:
    return round(x * 2) / 2


def _scaled(sim: float) -> float:
    return max(0.0, min(1.0, (sim - SIM_FLOOR) / (SIM_CEIL - SIM_FLOOR)))


def _status(fraction: float) -> str:
    return "met" if fraction >= MET else "partial" if fraction >= PARTIAL else "missed"


def _local_reason(status: str, match: Dict[str, Any], criterion: str) -> str:
    covered = [concept_label(c) for c in match["covered"]]
    partial = [concept_label(c) for c in match["partial"]]
    missing = [concept_label(c) for c in match["missing"]]
    parts = []
    if covered:
        parts.append(f"Covered: {', '.join(covered)}.")
    if partial:
        parts.append(f"Only partly explained: {', '.join(partial)}.")
    if missing:
        parts.append(f"Missing: {', '.join(missing)}.")
    if parts:
        if status != "met" and not partial and not missing:
            parts.append("Explanation is thinner than the model answer.")
        return " ".join(parts)
    return {
        "met": f"Answer clearly addresses: {criterion}.",
        "partial": f"Answer only partly addresses: {criterion}.",
        "missed": f"Answer does not address: {criterion}.",
    }[status]


def _grade_criterion_locally(crit: Dict[str, Any], student_answer: str, model_answer: str) -> Dict[str, Any]:
    concepts = crit.get("concepts") or []
    reference = ". ".join(filter(None, [crit["criterion"], crit.get("description", ""), ", ".join(concepts)])) or model_answer
    match = match_concepts(concepts, student_answer)
    sim = best_chunk_similarity(reference, student_answer)

    if concepts and sim is not None:
        fraction = COVERAGE_WEIGHT * match["coverage"] + (1 - COVERAGE_WEIGHT) * _scaled(sim)
    elif concepts:
        fraction = match["coverage"]
    else:
        fraction = _scaled(sim or 0.0)

    status = _status(fraction)
    return {
        "criterion": crit["criterion"],
        "marks": crit["marks"],
        "fraction": fraction,
        "marks_awarded": _round_half(fraction * crit["marks"]),
        "status": status,
        "reason": _local_reason(status, match, crit["criterion"]),
        "concepts_covered": match["covered"],
        "concepts_partial": match["partial"],
        "concepts_missed": match["missing"],
    }


def _gemini_grade(question_text: str, model_answer: str, criteria: List[Dict[str, Any]], student_answer: str) -> Optional[Dict[str, Any]]:
    """Second-opinion grade per criterion from Gemini, or None if unavailable / failed."""
    if not is_gemini_available(GEMINI_TEXT_MODEL):
        return None
    rubric = "\n".join(f"- {c['criterion']} ({c['marks']} marks): {c.get('description', '')}" for c in criteria)
    prompt = f"""You are a strict but fair examiner. Grade the student's answer against the faculty
model answer, criterion by criterion. Award marks in steps of 0.5, never above a criterion's marks.
Judge meaning, not wording or spelling (the answer was transcribed from handwriting).

Question: {question_text}
Faculty model answer: {model_answer}
Criteria:
{rubric}
Student answer: {student_answer}

Respond ONLY with valid JSON:
{{"criteria": [{{"criterion": "<name as given>", "marks": <number>, "reason": "<one sentence>"}}],
  "feedback": "<1-2 sentences to the student on how to improve>"}}"""
    raw = _call_gemini_vision([], prompt, timeout=60, model=GEMINI_TEXT_MODEL)
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        crit = _parse_criteria_grades(parsed.get("criteria", []), criteria)
        return {"criteria": crit, "feedback": parsed.get("feedback", "")} if crit else None
    except Exception as e:
        logger.error(f"Failed to parse Gemini grade JSON: {e}")
        return None


def _parse_criteria_grades(items: List[Dict[str, Any]], criteria: List[Dict[str, Any]]) -> Optional[List[Dict[str, Any]]]:
    """Match Gemini's per-criterion grades to our criteria (by name, else by position)."""
    by_name = {str(c.get("criterion", "")).strip().lower(): c for c in items}
    out = []
    for i, crit in enumerate(criteria):
        g = by_name.get(crit["criterion"].strip().lower()) or (items[i] if i < len(items) else None)
        if g is None:
            return None
        out.append({"marks": max(0.0, min(crit["marks"], float(g.get("marks", 0)))), "reason": g.get("reason", "")})
    return out


def gemini_grade_batch(answers: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    Second opinion for a whole answer sheet in ONE Gemini call (saves free-tier quota).
    answers: [{question_id, question_text, model_answer, criteria, student_answer}]
    Returns {question_id: {"criteria": [...], "feedback": str}}; {} if unavailable.
    """
    todo = [a for a in answers if a["student_answer"].strip() and a["criteria"]]
    if not todo or not is_gemini_available(GEMINI_TEXT_MODEL):
        return {}
    blocks = []
    for a in todo:
        rubric = "\n".join(f"  - {c['criterion']} ({c['marks']} marks): {c.get('description', '')}" for c in a["criteria"])
        blocks.append(f"""### {a['question_id']}
Question: {a['question_text']}
Faculty model answer: {a['model_answer']}
Criteria:
{rubric}
Student answer: {a['student_answer']}""")
    prompt = f"""You are a strict but fair examiner. Grade each student answer below against the faculty
model answer, criterion by criterion. Award marks in steps of 0.5, never above a criterion's marks.
Judge meaning, not wording or spelling (answers were transcribed from handwriting).

{chr(10).join(blocks)}

Respond ONLY with valid JSON:
{{"answers": {{"<question id as given after ###>": {{
   "criteria": [{{"criterion": "<name as given>", "marks": <number>, "reason": "<one sentence>"}}],
   "feedback": "<1-2 sentences to the student on how to improve>"}}}}}}"""
    raw = _call_gemini_vision([], prompt, timeout=120, model=GEMINI_TEXT_MODEL)
    if not raw:
        return {}
    try:
        graded = json.loads(raw).get("answers", {})
    except Exception as e:
        logger.error(f"Failed to parse Gemini batch grade JSON: {e}")
        return {}
    out = {}
    for a in todo:
        g = graded.get(a["question_id"])
        crit = _parse_criteria_grades(g.get("criteria", []), a["criteria"]) if isinstance(g, dict) else None
        if crit:
            out[a["question_id"]] = {"criteria": crit, "feedback": g.get("feedback", "")}
    return out


def _summary(results: List[Dict[str, Any]], total: float, max_marks: float) -> str:
    if total >= max_marks:
        return f"Full marks ({total:g}/{max_marks:g}): every criterion was met."
    lost = [r for r in results if r["marks_awarded"] < r["marks"]]
    strong = [r["criterion"] for r in results if r["status"] == "met"]
    parts = [f"Scored {total:g}/{max_marks:g}."]
    if lost:
        parts.append("Lost marks on: " + "; ".join(
            f"{r['criterion']} (-{r['marks'] - r['marks_awarded']:g}: {r['reason'].rstrip('.')})" for r in lost
        ) + ".")
    if strong:
        parts.append("Strong on: " + ", ".join(strong) + ".")
    return " ".join(parts)


def ensure_criteria(question_text: str, model_answer: str, criteria: Optional[List[Dict[str, Any]]], max_marks: float) -> List[Dict[str, Any]]:
    """Knowledge-base criteria with key points, building them from the model answer if needed."""
    if criteria and any(c.get("concepts") for c in criteria):
        return criteria
    return build_knowledge(question_text, model_answer, criteria or [], max_marks)["criteria"]


def grade_answer(
    question_text: str,
    model_answer: str,
    student_answer: str,
    max_marks: float,
    ocr_confidence: Optional[float] = None,
    use_gemini: bool = True,
    criteria: Optional[List[Dict[str, Any]]] = None,
    gemini_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    criteria: knowledge-base criteria [{criterion, description, marks, concepts}].
    Without them, knowledge is built on the fly from the model answer.
    gemini_result: a second opinion already fetched in a batch (see gemini_grade_batch);
    when given, or when use_gemini is False, no Gemini call is made here.
    """
    max_marks = float(max_marks) if max_marks else 5.0
    student_answer = student_answer or ""

    if not model_answer.strip() and not criteria:
        return {
            "marks_awarded": 0.0, "max_marks": max_marks, "confidence": 0.0, "needs_review": True,
            "rationale": "No faculty answer key for this question, so it could not be graded.",
            "feedback": "", "criteria": [], "concepts_covered": [], "concepts_missed": [], "engine": "none",
        }

    criteria = ensure_criteria(question_text, model_answer, criteria, max_marks)

    if not student_answer.strip():
        results = [{
            "criterion": c["criterion"], "marks": c["marks"], "marks_awarded": 0.0, "status": "missed",
            "reason": "No answer written.", "concepts_covered": [], "concepts_partial": [], "concepts_missed": c.get("concepts", []),
        } for c in criteria]
        return {
            "marks_awarded": 0.0, "max_marks": max_marks, "confidence": 0.95, "needs_review": False,
            "rationale": "No answer was written for this question.", "feedback": "No answer was given for this question.",
            "criteria": results, "concepts_covered": [], "concepts_missed": [c for r in results for c in r["concepts_missed"]],
            "similarity": 0.0, "engine": "local",
        }

    # Local pipeline, criterion by criterion
    results = [_grade_criterion_locally(c, student_answer, model_answer) for c in criteria]
    local_total = sum(r["marks_awarded"] for r in results)
    overall_sim = similarity(student_answer, model_answer) if model_answer.strip() else None

    signals = [local_total / max_marks]
    if overall_sim is not None:
        signals.append(_scaled(overall_sim))

    covered = [c for r in results for c in r["concepts_covered"]]
    missed = [c for r in results for c in r["concepts_missed"] + r["concepts_partial"]]
    feedback = template_feedback(local_total, max_marks, covered, missed)
    engine = "local"

    # Optional Gemini second opinion, averaged per criterion
    gemini = gemini_result
    if gemini is None and use_gemini:
        gemini = _gemini_grade(question_text, model_answer, criteria, student_answer)
    if gemini:
        for r, g in zip(results, gemini["criteria"]):
            r["marks_awarded"] = _round_half((r["marks_awarded"] + g["marks"]) / 2)
            r["status"] = _status(r["marks_awarded"] / r["marks"])
            r["local_check"] = r["reason"]
            if g["reason"]:
                r["reason"] = g["reason"]
        signals.append(sum(g["marks"] for g in gemini["criteria"]) / max_marks)
        feedback = gemini["feedback"] or feedback
        engine = "hybrid"

    total = min(max_marks, sum(r["marks_awarded"] for r in results))
    confidence, needs_review = combine(ocr_confidence, signals)
    for r in results:
        r.pop("fraction", None)

    return {
        "marks_awarded": total,
        "max_marks": max_marks,
        "confidence": confidence,
        "needs_review": needs_review,
        "rationale": _summary(results, total, max_marks),
        "feedback": feedback,
        "criteria": results,
        "concepts_covered": covered,
        "concepts_missed": missed,
        "similarity": overall_sim,
        "engine": engine,
    }
