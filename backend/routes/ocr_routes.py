"""
OCR Routes
Handles endpoints for processing student answer sheets through local OCR,
including PDF page conversion, image preprocessing, text extraction via PaddleOCR,
per-question segmentation, and persisting results to Supabase.
"""

import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional

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
from config.supabase_client import supabase

router = APIRouter(prefix="/ocr", tags=["OCR"])


@router.post("/process")
async def process_ocr(
    file: UploadFile = File(...),
    answer_sheet_id: Optional[str] = Form(None),
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

        # Step 3: Run pipeline across each page (Preprocessing -> OCR -> Segmentation)
        combined_answers: Dict[str, str] = {}
        all_confidences = []

        for page_path in page_image_paths:
            # A. Preprocess image (deskew, denoise, CLAHE, resize)
            preprocessed_path = preprocess_image(page_path)
            temp_files_to_clean.append(preprocessed_path)

            # B. Execute local PaddleOCR
            ocr_result = run_ocr(preprocessed_path)
            extracted_text = ocr_result.get("text", "")
            page_confidence = ocr_result.get("confidence", 0.0)

            if page_confidence > 0:
                all_confidences.append(page_confidence)

            # C. Segment extracted text into questions
            page_answers = segment_answers(extracted_text)

            # Merge page answers with previous pages (handles multi-page questions)
            for q_key, ans_text in page_answers.items():
                if not ans_text:
                    continue
                if q_key in combined_answers:
                    combined_answers[q_key] = f"{combined_answers[q_key]}\n{ans_text}".strip()
                else:
                    combined_answers[q_key] = ans_text

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
                # Query questions for the corresponding exam if available to link question_id
                question_mapping: Dict[int, str] = {}
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
                                .select("id, question_number")
                                .eq("exam_id", exam_id)
                                .execute()
                            )
                            if q_res.data:
                                for q_row in q_res.data:
                                    question_mapping[int(q_row["question_number"])] = q_row["id"]
                except Exception as q_err:
                    print(f"Note: Could not look up question IDs: {q_err}")

                # Upsert answers into student_answers table
                for q_key, answer_text in combined_answers.items():
                    # Parse numerical question number from key (e.g. "Q1" -> 1)
                    q_num_match = re.search(r"\d+", q_key)
                    q_num = int(q_num_match.group(0)) if q_num_match else None
                    question_id = question_mapping.get(q_num) if q_num is not None else None

                    upsert_payload = {
                        "answer_sheet_id": answer_sheet_id,
                        "question_id": question_id,
                        "ocr_text": answer_text,
                        "ocr_confidence": overall_confidence,
                    }

                    supabase.table("student_answers").upsert(upsert_payload).execute()

            except Exception as db_err:
                print(f"Warning: Failed to save to Supabase student_answers: {db_err}")

        # Step 6: Return formatted JSON response
        return {
            "status": "success",
            "ocr_confidence": overall_confidence,
            "answers": combined_answers,
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
