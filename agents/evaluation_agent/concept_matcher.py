"""
Concept Matcher Module
Checks which required concepts appear in a student answer. A concept counts as
covered if it appears literally (with crude stemming and knowledge-base synonyms)
or if some phrase of the answer means the same thing (sentence-transformers).
"""

import re
from typing import Any, Dict, List

from agents.concept_agent.knowledge_base import variants
from agents.evaluation_agent.semantic_matcher import get_model

# Key-point-to-phrase cosine similarity for a paraphrase to count as covering the
# point (full credit) or partly covering it (half credit). Tuned on sample answers:
# proper explanations scored 0.6-0.72, vague mentions 0.45-0.6, wrong ones < 0.45.
COVERED_THRESHOLD = 0.6
PARTIAL_THRESHOLD = 0.45


def _stem(word: str) -> str:
    """Crude stem so 'reduces'/'reduced'/'reducing' match 'reduce'."""
    return word[:6]


def _lexically_covered(concept: str, answer_stems: set, answer_text: str) -> bool:
    for v in variants(concept):
        if v in answer_text:
            return True
        words = re.findall(r"[a-z0-9]+", v)
        if words and sum(_stem(w) in answer_stems for w in words) / len(words) >= 0.6:
            return True
    return False


def _semantic_scores(concepts: List[str], student_answer: str) -> List[float]:
    """Best similarity of each concept to any phrase of the answer (0 if no model)."""
    model = get_model()
    phrases = [p.strip() for p in re.split(r"[.;:\n]+|,\s*", student_answer) if p.strip()]
    if model is None or not phrases:
        return [0.0] * len(concepts)
    from sentence_transformers import util
    sims = util.cos_sim(
        model.encode(concepts, convert_to_tensor=True),
        model.encode(phrases, convert_to_tensor=True),
    )
    return sims.max(dim=1).values.tolist()


def match_concepts(concepts: List[str], student_answer: str) -> Dict[str, Any]:
    """Returns { "covered", "partial", "missing": [...], "coverage": 0.0-1.0 }
    where a partly covered point counts half."""
    if not concepts:
        return {"covered": [], "partial": [], "missing": [], "coverage": 0.0}

    text = student_answer.lower()
    stems = {_stem(w) for w in re.findall(r"[a-z0-9]+", text)}
    semantic = _semantic_scores(concepts, student_answer)

    covered, partial, missing = [], [], []
    for c, s in zip(concepts, semantic):
        if s >= COVERED_THRESHOLD or _lexically_covered(c, stems, text):
            covered.append(c)
        elif s >= PARTIAL_THRESHOLD:
            partial.append(c)
        else:
            missing.append(c)
    coverage = (len(covered) + 0.5 * len(partial)) / len(concepts)
    return {"covered": covered, "partial": partial, "missing": missing, "coverage": round(coverage, 3)}
