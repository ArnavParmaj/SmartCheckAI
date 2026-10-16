"""
Semantic Matcher Module
Computes semantic similarity between a student answer and the model answer using
sentence-transformers (all-MiniLM-L6-v2), fully local. The model is downloaded on
first use (~90 MB) and cached; if it cannot load, similarity() returns None.
"""

import logging
from typing import Optional

logger = logging.getLogger("semantic_matcher")

MODEL_NAME = "all-MiniLM-L6-v2"
_model = None
_load_failed = False


def get_model():
    """Shared SentenceTransformer instance (also used by KeyBERT), or None."""
    global _model, _load_failed
    if _model is None and not _load_failed:
        try:
            from sentence_transformers import SentenceTransformer
            # CPU: MPS (Apple GPU) hangs when first used from a worker thread, and
            # this small model is fast enough on CPU
            try:
                # Use the cached copy without contacting Hugging Face; download only the first time
                _model = SentenceTransformer(MODEL_NAME, device="cpu", local_files_only=True)
            except Exception:
                _model = SentenceTransformer(MODEL_NAME, device="cpu")
        except Exception as e:
            logger.error(f"Could not load sentence-transformers model: {e}")
            _load_failed = True
    return _model


def similarity(student_answer: str, model_answer: str) -> Optional[float]:
    """Cosine similarity clipped to 0.0-1.0, or None if the model is unavailable."""
    if not student_answer.strip() or not model_answer.strip():
        return 0.0
    model = get_model()
    if model is None:
        return None
    from sentence_transformers import util
    emb = model.encode([student_answer, model_answer], convert_to_tensor=True)
    return round(max(0.0, min(1.0, float(util.cos_sim(emb[0], emb[1])))), 3)


def best_chunk_similarity(reference: str, student_answer: str) -> Optional[float]:
    """Highest similarity between the reference and any 1-2 sentence stretch of the
    answer, so a short criterion is compared with the part of the answer about it."""
    import re
    sentences = [s.strip() for s in re.split(r"(?<=[.!?;])\s+|\n+", student_answer) if s.strip()]
    if not sentences or not reference.strip():
        return 0.0
    model = get_model()
    if model is None:
        return None
    from sentence_transformers import util
    chunks = sentences + [f"{a} {b}" for a, b in zip(sentences, sentences[1:])]
    sims = util.cos_sim(model.encode([reference], convert_to_tensor=True), model.encode(chunks, convert_to_tensor=True))
    return round(max(0.0, min(1.0, float(sims.max()))), 3)
