import sys
from pathlib import Path

# Ensure project root is in sys.path
backend_dir = Path(__file__).resolve().parent
project_root = backend_dir.parent
for p in [str(project_root), str(backend_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from agents.ocr_agent.preprocessing import preprocess_image
from agents.ocr_agent.ocr import run_ocr
from agents.ocr_agent.segmentation import segment_answers

IMAGE_PATH = str(backend_dir / "test_sample.jpg")

print("Step 1: Preprocessing...")
processed = preprocess_image(IMAGE_PATH)
print(f"Processed image: {processed}")

print("\nStep 2: OCR...")
result = run_ocr(processed)
print(f"Confidence: {result['confidence']}")
print(f"Text:\n{result['text']}")

print("\nStep 3: Segmentation...")
answers = segment_answers(result['text'])
for q, ans in answers.items():
    print(f"\n{q}: {ans[:100]}")
