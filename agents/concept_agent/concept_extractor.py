"""
Concept Extractor Module
Extracts the key concepts a correct answer must contain from the model answer / rubric.
Runs locally: KeyBERT (on the shared sentence-transformers model), falling back to
simple keyword frequency if the model cannot load. No external API is used.
"""

import logging
import re
from collections import Counter
from typing import Any, Dict, List

from agents.evaluation_agent.semantic_matcher import get_model

logger = logging.getLogger("concept_extractor")

STOPWORDS = set("""
a an the and or but if then else of in on at to for from by with without into onto over under
is are was were be been being has have had do does did can could should would will shall may might must
this that these those it its they them their there here which who whom whose what when where why how
as such than also very more most less least any all each every some no not only own same so too
answer question explain describe define write give state discuss marks mark student students example examples
criteria criterion correctly correct using use used following
""".split())


def _keyword_concepts(text: str, max_concepts: int) -> List[str]:
    """Fallback: the most common content words of the model answer."""
    words = re.findall(r"[A-Za-z][A-Za-z0-9\-]{2,}", text.lower())
    counts = Counter(w for w in words if w not in STOPWORDS)
    return [w for w, _ in counts.most_common(max_concepts)]


def _keybert_concepts(text: str, max_concepts: int) -> List[str]:
    model = get_model()
    if model is None:
        return []
    from keybert import KeyBERT
    kw = KeyBERT(model=model).extract_keywords(
        text,
        keyphrase_ngram_range=(1, 3),
        stop_words=list(STOPWORDS | {"english"}),
        use_mmr=True,  # diverse phrases instead of near-duplicates
        diversity=0.6,
        top_n=max_concepts,
    )
    return [phrase for phrase, _ in kw]


def extract_concepts(model_answer: str, max_concepts: int = 6) -> Dict[str, Any]:
    """Returns { "concepts": [str, ...], "engine": "keybert" | "keyword" | "none" }."""
    if not model_answer.strip():
        return {"concepts": [], "engine": "none"}

    try:
        concepts = _keybert_concepts(model_answer, max_concepts)
        if concepts:
            return {"concepts": concepts, "engine": "keybert"}
    except Exception as e:
        logger.error(f"KeyBERT extraction failed: {e}")

    return {"concepts": _keyword_concepts(model_answer, max_concepts), "engine": "keyword"}


def extract_key_points(model_answer: str, max_points: int = 8) -> Dict[str, Any]:
    """
    Key points of a model answer: its sentences / bullet lines / ';' clauses, which read
    naturally for faculty review and are matched by meaning against the student answer.
    Falls back to keyphrases when the answer is one long sentence.
    """
    parts = re.split(r"(?<=[.!?])\s+|\n+|;\s+|\s+-\s+(?=[A-Z])", model_answer)
    points = []
    for p in parts:
        p = re.sub(r"^\s*(?:[-*•]|\d+[.)]|[a-z][.)])\s*", "", p).strip().rstrip(".")
        if len(p.split()) >= 3:
            points.append(p)
    if len(points) >= 2:
        return {"concepts": points[:max_points], "engine": "key-points"}
    return extract_concepts(model_answer, max_concepts=max_points)


def concept_label(concept: str) -> str:
    """Short name for a key point: the term before ':' if there is one, else its first words."""
    head = concept.split(":", 1)[0].strip()
    if ":" in concept and len(head.split()) <= 5:
        return head
    words = concept.split()
    return " ".join(words[:6]) + ("…" if len(words) > 6 else "")
