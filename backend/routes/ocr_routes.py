"""
OCR Routes
Handles endpoints for processing student answer sheets through local OCR,
including PDF page conversion, image preprocessing, text extraction via PaddleOCR,
per-question segmentation, and persisting results to Supabase.
"""

import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

# Ensure project root and backend directory are in sys.path for robust module imports
backend_dir = Path(__file__).resolve().parent.parent
project_root = backend_dir.parent
for p in [str(project_root), str(backend_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from agents.ocr_agent.preprocessing import preprocess_image
from agents.ocr_agent.ocr import run_ocr
from agents.ocr_agent.segmentation import segment_answers
from agents.ocr_agent.gemini_ocr import (
    GEMINI_MODEL,
    is_gemini_available,
    gemini_extract_questions,
    gemini_extract_rubric,
    gemini_extract_student_answers,
)
from config.supabase_client import supabase

router = APIRouter(prefix="/ocr", tags=["OCR"])


def _extract_page_images(file_bytes: bytes, filename: str) -> Tuple[List[str], List[str]]:
    """Helper to convert uploaded file (PDF or image) to a list of page image filepaths."""
    temp_files = []
    file_ext = Path(filename or "upload").suffix.lower()

    temp_input = tempfile.NamedTemporaryFile(suffix=file_ext, delete=False)
    temp_input.write(file_bytes)
    temp_input.close()
    temp_files.append(temp_input.name)

    page_images = []
    if file_ext == ".pdf":
        try:
            import fitz
            pdf_doc = fitz.open(temp_input.name)
            for page_index in range(len(pdf_doc)):
                page = pdf_doc.load_page(page_index)
                pixmap = page.get_pixmap(dpi=200)
                page_temp = tempfile.NamedTemporaryFile(
                    suffix=f"_page_{page_index}.png", delete=False
                )
                pixmap.save(page_temp.name)
                page_temp.close()
                page_images.append(page_temp.name)
                temp_files.append(page_temp.name)
            pdf_doc.close()
        except ImportError:
            pass
    else:
        page_images.append(temp_input.name)

    return page_images, temp_files


@router.post("/extract-questions")
async def extract_questions_endpoint(
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    """
    Extract structured questions, sub-questions, and marks from a Question Paper:
    Uses Gemini Multimodal Vision when available, seamlessly falling back to local OCR.
    """
    file_bytes = await file.read()
    if not file_bytes:
        return {"status": "error", "message": "Uploaded file is empty"}

    page_images, temp_files = _extract_page_images(file_bytes, file.filename or "question_paper.jpg")

    try:
        if is_gemini_available():
            gemini_qs = gemini_extract_questions(page_images)
            if gemini_qs:
                return {
                    "status": "success",
                    "engine": GEMINI_MODEL,
                    "questions": gemini_qs,
                }

        # Fallback to local RapidOCR + Segmentation
        all_segmented = {}
        for p in page_images:
            prep = preprocess_image(p)
            temp_files.append(prep)
            res = run_ocr(prep)
            segs = segment_answers(res.get("text", ""), lines=res.get("lines"))
            all_segmented.update(segs)

        fallback_qs = [
            {
                "id": k,
                "text": v,
                "marks": 5,
                "choice_group": k.split("(")[0] if "(" in k else k,
                "condition": "OR" if "[OR]" in v else ("AND" if "[AND]" in v else None),
            }
            for k, v in all_segmented.items()
        ]

        return {
            "status": "success",
            "engine": "local-rapidocr",
            "questions": fallback_qs,
        }
    finally:
        for f in temp_files:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except Exception:
                pass


@router.post("/extract-rubric")
async def extract_rubric_endpoint(
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    """
    Extract grading criteria and mark breakdowns from a Marking Rubric:
    Uses Gemini Multimodal Vision when available, falling back to local OCR.
    """
    file_bytes = await file.read()
    if not file_bytes:
        return {"status": "error", "message": "Uploaded file is empty"}

    page_images, temp_files = _extract_page_images(file_bytes, file.filename or "rubric.jpg")

    try:
        if is_gemini_available():
            rubrics = gemini_extract_rubric(page_images)
            if rubrics:
                return {
                    "status": "success",
                    "engine": GEMINI_MODEL,
                    "rubrics": rubrics,
                }

        # Fallback to local RapidOCR
        all_text = ""
        for p in page_images:
            prep = preprocess_image(p)
            temp_files.append(prep)
            res = run_ocr(prep)
            all_text += "\n" + res.get("text", "")

        fallback_rubrics = [
            {
                "question_id": "General",
                "criterion": "General Evaluation",
                "max_marks": 5,
                "description": all_text.strip()[:300],
            }
        ]

        return {
            "status": "success",
            "engine": "local-rapidocr",
            "rubrics": fallback_rubrics,
        }
    finally:
        for f in temp_files:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except Exception:
                pass


@router.post("/process")
async def process_ocr(
    file: UploadFile = File(...),
    answer_sheet_id: Optional[str] = Form(None),
    question_labels: Optional[str] = Form(None, description="JSON list of the exam's question labels"),
) -> Dict[str, Any]:
    """
    Process an uploaded answer sheet (image or PDF):
    1. Read and save uploaded file to a temporary location
    2. If PDF, extract each page as an image using PyMuPDF (fitz)
    3. For each page:
       - Run preprocessing (deskew, denoise, CLAHE contrast, resize)
       - Run local PaddleOCR extraction
       - Segment text into question-based sections
    4. Aggregate per-question answers and compute average OCR confidence
    5. Save results to Supabase 'student_answers' table if answer_sheet_id is provided
    6. Return structured JSON response or error status
    """
    temp_files_to_clean = []

    try:
        # Step 1: Validate file upload and save to temporary file
        file_bytes = await file.read()
        if not file_bytes:
            return {"status": "error", "message": "Uploaded file is empty"}

        filename = file.filename or "upload"
        file_ext = Path(filename).suffix.lower()

        # Temporary input file to store the raw upload
        temp_input = tempfile.NamedTemporaryFile(suffix=file_ext, delete=False)
        temp_input.write(file_bytes)
        temp_input.close()
        temp_files_to_clean.append(temp_input.name)

        # Step 2: Convert PDF pages to images or use uploaded image directly
        page_image_paths = []

        if file_ext == ".pdf":
            try:
                import fitz  # PyMuPDF
            except ImportError:
                return {
                    "status": "error",
                    "message": "PyMuPDF (fitz) is required for PDF processing. Please install pymupdf.",
                }

            # Open PDF document with PyMuPDF
            pdf_doc = fitz.open(temp_input.name)
            for page_index in range(len(pdf_doc)):
                page = pdf_doc.load_page(page_index)
                # Render at 200 DPI for sharp handwriting recognition
                pixmap = page.get_pixmap(dpi=200)
                page_temp = tempfile.NamedTemporaryFile(
                    suffix=f"_page_{page_index}.png", delete=False
                )
                pixmap.save(page_temp.name)
                page_temp.close()
                page_image_paths.append(page_temp.name)
                temp_files_to_clean.append(page_temp.name)
            pdf_doc.close()

            if not page_image_paths:
                return {
                    "status": "error",
                    "message": "PDF contains no readable pages.",
                }
        else:
            # Single image file (JPG, PNG, WebP, etc.)
            page_image_paths.append(temp_input.name)

        # Step 3: Run pipeline across each page (Gemini Multimodal or Local OCR Fallback)
        combined_answers: Dict[str, str] = {}
        # Per-answer OCR confidence (0.0-1.0): Gemini rates each answer's legibility;
        # local OCR uses the confidence of the page(s) the answer came from
        answer_confidences: Dict[str, float] = {}
        all_confidences = []
        engine_used = "local-rapidocr"

        # Try Gemini Multimodal handwriting transcription first if configured
        if is_gemini_available():
            try:
                labels = json.loads(question_labels) if question_labels else None
                gemini_answers = gemini_extract_student_answers(page_image_paths, labels)
                if gemini_answers:
                    for label, item in gemini_answers.items():
                        combined_answers[label] = item["text"]
                        if item["confidence"] is not None:
                            answer_confidences[label] = item["confidence"]
                    all_confidences = list(answer_confidences.values())
                    engine_used = GEMINI_MODEL
            except Exception as e:
                print(f"Gemini OCR failed, falling back to local OCR: {e}")

        if not combined_answers:
            for page_path in page_image_paths:
                # A. Preprocess image (deskew, dynamic range, resize)
                preprocessed_path = preprocess_image(page_path)
                temp_files_to_clean.append(preprocessed_path)

                # B. Execute local PaddleOCR/RapidOCR
                ocr_result = run_ocr(preprocessed_path)
                extracted_text = ocr_result.get("text", "")
                page_confidence = ocr_result.get("confidence", 0.0)

                if page_confidence > 0:
                    all_confidences.append(page_confidence)

                # C. Segment extracted text into questions using spatial layout
                page_answers = segment_answers(extracted_text, lines=ocr_result.get("lines"))

                # Merge page answers with previous pages (handles multi-page questions)
                for q_key, ans_text in page_answers.items():
                    if not ans_text:
                        continue
                    if page_confidence > 0:
                        # An answer spanning pages is only as reliable as its worst page
                        answer_confidences[q_key] = min(answer_confidences.get(q_key, 1.0), page_confidence)
                    if q_key in combined_answers:
                        combined_answers[q_key] = f"{combined_answers[q_key]}\n{ans_text}".strip()
                    else:
                        combined_answers[q_key] = ans_text

        # Naturally sort combined_answers by question number and sub-part (Q1(a), Q1(b)...)
        def sort_key(k: str):
            m = re.match(r"Q(\d+)(?:\((.+)\))?", k, re.IGNORECASE)
            if m:
                return (int(m.group(1)), m.group(2) or "")
            num = re.search(r"\d+", k)
            return (int(num.group()) if num else 999, k)

        combined_answers = {
            k: combined_answers[k]
            for k in sorted(combined_answers.keys(), key=sort_key)
        }

        # If no answers extracted, provide empty Q1 entry
        if not combined_answers:
            combined_answers = {"Q1": ""}

        # Step 4: Calculate overall average OCR confidence
        overall_confidence = (
            round(sum(all_confidences) / len(all_confidences), 4)
            if all_confidences
            else 0.0
        )

        # Step 5: Save each question's OCR text and confidence to Supabase table: student_answers
        if answer_sheet_id and supabase is not None:
            try:
                # Map question labels (e.g. "Q1(b)") to question IDs for this exam.
                # question_number is only the position in the exam, so it cannot tell
                # sub-questions apart; matching needs the label column (migration 001).
                question_mapping: Dict[str, str] = {}
                try:
                    sheet_res = (
                        supabase.table("answer_sheets")
                        .select("exam_id")
                        .eq("id", answer_sheet_id)
                        .execute()
                    )
                    if sheet_res.data and len(sheet_res.data) > 0:
                        exam_id = sheet_res.data[0].get("exam_id")
                        if exam_id:
                            q_res = (
                                supabase.table("questions")
                                .select("*")
                                .eq("exam_id", exam_id)
                                .execute()
                            )
                            for q_row in q_res.data or []:
                                if q_row.get("label"):
                                    question_mapping[q_row["label"].strip().upper()] = q_row["id"]
                except Exception as q_err:
                    print(f"Note: Could not look up question IDs: {q_err}")

                # Insert answers into student_answers table, skipping any that match no question
                for q_key, answer_text in combined_answers.items():
                    question_id = question_mapping.get(q_key.strip().upper())
                    if question_id is None:
                        print(f"Note: No question with label '{q_key}'; answer not saved")
                        continue

                    upsert_payload = {
                        "answer_sheet_id": answer_sheet_id,
                        "question_id": question_id,
                        "ocr_text": answer_text,
                        "ocr_confidence": answer_confidences.get(q_key, overall_confidence),
                    }

                    supabase.table("student_answers").upsert(upsert_payload).execute()

            except Exception as db_err:
                print(f"Warning: Failed to save to Supabase student_answers: {db_err}")

        # Step 6: Return formatted JSON response
        return {
            "status": "success",
            "engine": engine_used,
            "ocr_confidence": overall_confidence,
            "answers": combined_answers,
            "answer_confidences": {k: round(v, 4) for k, v in answer_confidences.items()},
        }

    except Exception as err:
        # Proper error handling returning status: error with message
        return {
            "status": "error",
            "message": str(err),
        }

    finally:
        # Cleanup all temporary files generated during processing
        for temp_path in temp_files_to_clean:
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except OSError:
                pass
