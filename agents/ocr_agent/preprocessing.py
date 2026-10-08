"""
Preprocessing Module
Handles image enhancement, noise reduction, deskewing, binarization,
and contrast normalization for scanned student answer sheets prior to OCR processing.
"""

import os
import tempfile
import cv2
import numpy as np


def deskew_image(image: np.ndarray) -> np.ndarray:
    """
    Detect skew angle of text lines and rotate image to correct tilt.
    Uses Otsu's thresholding and minAreaRect on foreground pixels.
    """
    # Invert image: text becomes white, background becomes black
    thresh = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]

    # Get coordinates of all foreground pixels
    coords = np.column_stack(np.where(thresh > 0))
    if coords.size == 0:
        return image

    # Compute rotated rectangle containing all points
    angle = cv2.minAreaRect(coords)[-1]

    # OpenCV minAreaRect returns angle in [-90, 0) or (0, 90] depending on version
    if angle < -45:
        angle = -(90 + angle)
    elif angle > 45:
        angle = 90 - angle
    else:
        angle = -angle

    # Only correct realistic scanning tilt (e.g. between 0.2 and 15 degrees)
    # to avoid 90-degree inversion on non-standard aspect ratios
    if abs(angle) > 15 or abs(angle) < 0.2:
        return image

    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    deskewed = cv2.warpAffine(
        image,
        rotation_matrix,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return deskewed


def preprocess_image(image_path: str) -> str:
    """
    Preprocess an input image for optimal OCR extraction:
    - Load image using OpenCV
    - Convert to grayscale
    - Apply deskewing (correct tilted scans)
    - Apply denoising (cv2.fastNlMeansDenoising)
    - Enhance contrast (CLAHE)
    - Resize to minimum 1200px width if smaller
    - Save processed image to a temp file
    - Return path to processed temp image
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Input image not found: {image_path}")

    # 1. Load image using OpenCV
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image from path: {image_path}")

    # 2. Convert to grayscale
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # 3. Apply deskewing (correct tilted scans)
    deskewed = deskew_image(gray)

    # 4. Only apply contrast stretching if dynamic range is severely constrained (< 100)
    img_min, img_max = int(np.min(deskewed)), int(np.max(deskewed))
    if img_max - img_min < 100:
        processed = cv2.normalize(deskewed, None, 0, 255, cv2.NORM_MINMAX)
    else:
        processed = deskewed

    # 5. Resize to minimum 1200px width if smaller, maintaining aspect ratio
    (h, w) = processed.shape[:2]
    if w < 1200:
        scale = 1200.0 / float(w)
        new_w = 1200
        new_h = int(h * scale)
        processed = cv2.resize(processed, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    # 7. Save processed image to a temp file
    temp_file = tempfile.NamedTemporaryFile(suffix="_preprocessed.png", delete=False)
    temp_path = temp_file.name
    temp_file.close()

    cv2.imwrite(temp_path, processed)

    # 8. Return path to processed temp image
    return temp_path
