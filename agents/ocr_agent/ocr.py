"""
OCR Module
Executes optical character recognition on preprocessed answer sheets and segmented regions
using PaddleOCR running fully locally without external AI APIs.
"""

import os
from typing import Dict, Any, Optional

# Cached PaddleOCR instance to avoid re-instantiating model on every call
_ocr_engine: Optional[Any] = None


def get_ocr_engine():
    """
    Lazily initialize and cache the PaddleOCR engine.
    Configured for local inference with English language support on CPU.
    Compatible with both PaddleOCR 3.x and 2.x.
    """
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from paddleocr import PaddleOCR

            try:
                # PaddleOCR 3.x API
                _ocr_engine = PaddleOCR(lang="en", device="cpu")
            except (TypeError, ValueError):
                # PaddleOCR 2.x API fallback
                _ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", use_gpu=False)
        except ImportError as err:
            raise ImportError(
                "PaddleOCR is not installed. Please run: pip install paddleocr paddlepaddle"
            ) from err
    return _ocr_engine


def run_ocr(image_path: str) -> Dict[str, Any]:
    """
    Run PaddleOCR on the preprocessed image to extract text and confidence.

    Args:
        image_path: Absolute or relative path to the image file.

    Returns:
        Dict containing:
            - text: full extracted text string joined by newlines
            - confidence: average confidence score across all recognized text lines
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found at path: {image_path}")

    # 1. Load local PaddleOCR engine instance
    engine = get_ocr_engine()

    # 2. Run OCR inference on the preprocessed image
    try:
        ocr_result = engine.ocr(image_path)
    except TypeError:
        ocr_result = engine.ocr(image_path, cls=True)

    # 3. Extract text lines and line-level confidence scores
    lines = []
    confidences = []

    if ocr_result:
        for page_data in ocr_result:
            if not page_data:
                continue

            # Format 1: PaddleOCR 3.x dict with 'rec_texts' and 'rec_scores'
            if isinstance(page_data, dict):
                texts = page_data.get("rec_texts", [])
                scores = page_data.get("rec_scores", [])
                for text_item, score_item in zip(texts, scores):
                    if text_item and str(text_item).strip():
                        lines.append(str(text_item).strip())
                        confidences.append(float(score_item))

            # Format 2: PaddleOCR 2.x list of [box, (text, conf)]
            elif isinstance(page_data, (list, tuple)):
                for line_item in page_data:
                    if line_item and len(line_item) >= 2 and line_item[1]:
                        if isinstance(line_item[1], (list, tuple)) and len(line_item[1]) >= 2:
                            text_str = line_item[1][0]
                            conf_score = line_item[1][1]
                            if text_str and str(text_str).strip():
                                lines.append(str(text_str).strip())
                                confidences.append(float(conf_score))

    # 4. Join lines into full text and compute mean confidence
    full_text = "\n".join(lines)
    avg_confidence = (
        round(sum(confidences) / len(confidences), 4) if confidences else 0.0
    )

    # 5. Return formatted dictionary
    return {
        "text": full_text,
        "confidence": avg_confidence,
    }
