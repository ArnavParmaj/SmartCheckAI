"""
OCR Module
Executes optical character recognition on preprocessed answer sheets and segmented regions
using RapidOCR (PP-OCR ONNX runtime) or PaddleOCR running fully locally without external AI APIs.
"""

import os
from typing import Dict, Any, Optional

# Cached OCR instance to avoid re-instantiating model on every call
_ocr_engine: Optional[Any] = None
_engine_type: Optional[str] = None


def get_ocr_engine():
    """
    Lazily initialize and cache the OCR engine.
    Prefers RapidOCR (PP-OCR models via ONNX Runtime for high performance on CPU/ARM64)
    with seamless fallback to standard PaddleOCR.
    """
    global _ocr_engine, _engine_type
    if _ocr_engine is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _ocr_engine = RapidOCR()
            _engine_type = "rapidocr"
        except ImportError:
            try:
                from paddleocr import PaddleOCR
                try:
                    _ocr_engine = PaddleOCR(lang="en", device="cpu")
                except (TypeError, ValueError):
                    _ocr_engine = PaddleOCR(use_angle_cls=False, lang="en", use_gpu=False)
                _engine_type = "paddleocr"
            except ImportError as err:
                raise ImportError(
                    "No OCR engine found. Please install rapidocr-onnxruntime or paddleocr."
                ) from err
    return _ocr_engine


def run_ocr(image_path: str) -> Dict[str, Any]:
    """
    Run OCR on the preprocessed image to extract text, confidence, and line boxes.

    Args:
        image_path: Absolute or relative path to the image file.

    Returns:
        Dict containing:
            - text: full extracted text string joined by newlines
            - confidence: average confidence score across all recognized text lines
            - lines: list of dicts with text, confidence, and bounding box
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found at path: {image_path}")

    engine = get_ocr_engine()
    lines = []
    confidences = []
    structured_lines = []

    if _engine_type == "rapidocr":
        ocr_result, _ = engine(image_path)
        if ocr_result:
            for item in ocr_result:
                # item structure: [dt_box, text, score]
                box = item[0]
                text_str = str(item[1]).strip()
                score = float(item[2])
                if text_str:
                    lines.append(text_str)
                    confidences.append(score)
                    structured_lines.append({
                        "text": text_str,
                        "confidence": round(score, 4),
                        "box": box,
                    })

    else:
        # PaddleOCR fallback
        try:
            ocr_result = engine.ocr(image_path)
        except TypeError:
            ocr_result = engine.ocr(image_path, cls=True)

        if ocr_result:
            for page_data in ocr_result:
                if not page_data:
                    continue
                if isinstance(page_data, dict):
                    texts = page_data.get("rec_texts", [])
                    scores = page_data.get("rec_scores", [])
                    for text_item, score_item in zip(texts, scores):
                        if text_item and str(text_item).strip():
                            lines.append(str(text_item).strip())
                            confidences.append(float(score_item))
                elif isinstance(page_data, (list, tuple)):
                    for line_item in page_data:
                        if line_item and len(line_item) >= 2 and line_item[1]:
                            box = line_item[0]
                            text_str = str(line_item[1][0]).strip()
                            conf_score = float(line_item[1][1])
                            if text_str:
                                lines.append(text_str)
                                confidences.append(conf_score)
                                structured_lines.append({
                                    "text": text_str,
                                    "confidence": round(conf_score, 4),
                                    "box": box,
                                })

    full_text = "\n".join(lines)
    avg_confidence = (
        round(sum(confidences) / len(confidences), 4) if confidences else 0.0
    )

    return {
        "text": full_text,
        "confidence": avg_confidence,
        "lines": structured_lines,
    }
