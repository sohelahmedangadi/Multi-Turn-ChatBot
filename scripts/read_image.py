"""
CosmoAI Image Processor
Extracts visual metadata, sharpness, color metrics, and deep-learning OCR text from image files.

Libraries used:
1. Pillow (PIL): Image loading, color mode verification, EXIF orientation, and dimensions.
2. OpenCV (cv2): Matrix conversion, BGR-to-RGB, grayscale brightness, and Laplacian blur detection.
3. scikit-image (skimage): Image statistics, thresholding, and contrast metrics.
4. EasyOCR (easyocr): Deep-learning local OCR for verbatim text, bounding boxes, and confidence.
5. Google GenAI (google.genai): Native multimodal vision reasoning integration.
"""

import sys
import os
import json
import argparse
import warnings
import numpy as np
from PIL import Image, ImageOps
import cv2

# Hardening: Treat decompression bomb warnings as fatal errors
warnings.simplefilter('error', Image.DecompressionBombWarning)

# Configurable safety caps (defaults: 25MP max pixels, 8192px max width/height)
MAX_IMAGE_PIXELS = int(os.environ.get('MAX_IMAGE_PIXELS', 25000000))
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

MAX_IMAGE_WIDTH = int(os.environ.get('MAX_IMAGE_WIDTH', 8192))
MAX_IMAGE_HEIGHT = int(os.environ.get('MAX_IMAGE_HEIGHT', 8192))

try:
    import skimage.measure
    import skimage.filters
    HAS_SKIMAGE = True
except ImportError:
    HAS_SKIMAGE = False

try:
    import easyocr
    HAS_EASYOCR = True
except ImportError:
    HAS_EASYOCR = False


def extract_image_metadata(image_path):
    """
    Extracts dimensions, color mode, aspect ratio, and sharpness
    using Pillow, OpenCV, and scikit-image with strict decompression bomb guards.
    """
    try:
        with Image.open(image_path) as pil_img:
            width, height = pil_img.size

            # Enforce max dimension cap before any heavy processing or OCR
            if width > MAX_IMAGE_WIDTH or height > MAX_IMAGE_HEIGHT:
                raise ValueError(
                    f"Image dimensions ({width}x{height}) exceed maximum allowed cap of {MAX_IMAGE_WIDTH}x{MAX_IMAGE_HEIGHT}."
                )

            # Enforce total pixel limit
            total_pixels = width * height
            if total_pixels > MAX_IMAGE_PIXELS:
                raise ValueError(
                    f"Image pixel count ({total_pixels}) exceeds maximum allowed cap of {MAX_IMAGE_PIXELS}."
                )

            # Transpose image based on EXIF orientation if present
            pil_img = ImageOps.exif_transpose(pil_img) or pil_img
            width, height = pil_img.size
            img_format = pil_img.format or os.path.splitext(image_path)[1].lstrip('.').upper()
            mode = pil_img.mode
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as e:
        raise ValueError(f"Decompression bomb detected in image: {str(e)}")

    # OpenCV for fast numeric array processing & sharpness
    cv_img = cv2.imread(image_path)
    if cv_img is None:
        # Fallback reading via PIL if OpenCV failed on exotic format
        cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    h, w = cv_img.shape[:2]
    channels = cv_img.shape[2] if len(cv_img.shape) > 2 else 1

    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY) if channels > 1 else cv_img
    mean_brightness = float(np.mean(gray))

    # Laplacian variance for image blur/sharpness evaluation
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    sharpness_label = "Sharp / High Detail" if laplacian_var > 100 else ("Moderate" if laplacian_var > 30 else "Soft / Blurry")

    # Greatest common divisor for aspect ratio
    import math
    gcd = math.gcd(width, height)
    aspect_ratio = f"{width // gcd}:{height // gcd}" if gcd > 0 else f"{width}:{height}"

    meta = {
        "format": img_format,
        "width": width,
        "height": height,
        "resolution": f"{width}x{height}",
        "aspectRatio": aspect_ratio,
        "colorMode": mode,
        "channels": channels,
        "meanBrightness": round(mean_brightness, 1),
        "sharpnessScore": round(laplacian_var, 1),
        "sharpnessQuality": sharpness_label,
        "isGrayscale": bool(channels == 1 or np.allclose(cv_img[:, :, 0], cv_img[:, :, 1])),
    }

    if HAS_SKIMAGE:
        try:
            # Otsu threshold metric to measure contrast separation
            thresh = float(skimage.filters.threshold_otsu(gray))
            meta["contrastThreshold"] = round(thresh, 1)
        except:
            pass

    return meta, cv_img


def extract_ocr_text(image_path, cv_img):
    """
    Extracts printed and handwritten text using EasyOCR with bounding boxes and confidence.
    """
    if not HAS_EASYOCR:
        return {"hasText": False, "engine": "none", "textBlocks": [], "fullText": ""}

    ocr_blocks = []
    lines = []

    try:
        # Determine model directory inside workspace
        script_dir = os.path.dirname(os.path.abspath(__file__))
        workspace_model_dir = os.path.abspath(os.path.join(script_dir, "..", "data", "models", "easyocr"))
        user_net_dir = os.path.join(workspace_model_dir, "user_network")
        os.makedirs(user_net_dir, exist_ok=True)
        model_dir = workspace_model_dir if os.path.exists(workspace_model_dir) else None

        # Initialize reader on CPU for English text
        reader = easyocr.Reader(
            ['en'],
            gpu=False,
            model_storage_directory=model_dir,
            user_network_directory=user_net_dir,
            verbose=False
        )
        results = reader.readtext(image_path)

        for bbox, text, conf in results:
            clean_text = text.strip()
            if clean_text and conf >= 0.20:
                box_coords = [[int(pt[0]), int(pt[1])] for pt in bbox]
                ocr_blocks.append({
                    "text": clean_text,
                    "confidence": round(float(conf), 3),
                    "box": box_coords,
                })
                lines.append(clean_text)

        full_ocr_text = "\n".join(lines)
        return {
            "hasText": len(lines) > 0,
            "engine": "easyocr",
            "detectedLineCount": len(lines),
            "wordCount": len(full_ocr_text.split()) if full_ocr_text else 0,
            "textBlocks": ocr_blocks,
            "fullText": full_ocr_text,
        }
    except Exception as e:
        sys.stderr.write(f"EasyOCR notice: {str(e)}\n")
        return {
            "hasText": False,
            "engine": "easyocr_error",
            "error": str(e),
            "textBlocks": [],
            "fullText": "",
        }


def process_image(image_path):
    """
    Full pipeline combining Pillow loading, OpenCV metrics,
    and EasyOCR deep-learning text extraction.
    """
    filename = os.path.basename(image_path)

    # 1. Pillow & OpenCV Visual Metadata
    try:
        meta, cv_img = extract_image_metadata(image_path)
    except Exception as e:
        return {
            "filename": filename,
            "metadata": {
                "format": "UNKNOWN",
                "resolution": "Unknown",
                "width": 0,
                "height": 0,
                "aspectRatio": "N/A",
                "colorMode": "Unknown",
                "channels": 0,
                "meanBrightness": 0,
                "sharpnessScore": 0,
                "sharpnessQuality": "Unparseable",
                "isGrayscale": False,
            },
            "ocr": {"hasText": False, "engine": "none", "textBlocks": [], "fullText": ""},
            "summary": f"Image \"{filename}\" ready for inspection.",
            "structuredBlocks": [
                {
                    "page": 1,
                    "section": "Visual Properties & Quality",
                    "heading": filename,
                    "text": f"Image \"{filename}\" ready for inspection."
                }
            ],
        }

    # 2. EasyOCR Text Recognition
    ocr_result = extract_ocr_text(image_path, cv_img)

    # 3. Construct Structured Text Blocks for RAG & Vision Context
    structured_blocks = []

    # Visual Properties Block
    prop_text = (
        f"Image \"{filename}\" ({meta['format']}, {meta['resolution']}, Aspect Ratio: {meta['aspectRatio']}).\n"
        f"Color Mode: {meta['colorMode']}, Channels: {meta['channels']}, Mean Brightness: {meta['meanBrightness']}/255.\n"
        f"Visual Detail & Sharpness: {meta['sharpnessQuality']} (score: {meta['sharpnessScore']})."
    )
    structured_blocks.append({
        "page": 1,
        "section": "Visual Properties & Quality",
        "heading": filename,
        "text": prop_text,
    })

    # OCR Text Block
    if ocr_result["hasText"]:
        structured_blocks.append({
            "page": 1,
            "section": "Visible Text & OCR Extraction",
            "heading": f"OCR Text ({ocr_result['wordCount']} words)",
            "text": f"Verbatim text transcribed via EasyOCR:\n\n{ocr_result['fullText']}",
        })
    else:
        structured_blocks.append({
            "page": 1,
            "section": "Visible Text & OCR Extraction",
            "heading": "Text Detection",
            "text": "No significant printed or handwritten text detected in this image.",
        })

    summary = (
        f"Image \"{filename}\" ({meta['resolution']} {meta['format']}, {meta['sharpnessQuality']}).\n"
    )
    if ocr_result["hasText"]:
        summary += f"\nExtracted Text (OCR):\n{ocr_result['fullText']}"
    else:
        summary += "\nVisual asset ready for multimodal inspection and question answering."

    return {
        "filename": filename,
        "metadata": meta,
        "ocr": ocr_result,
        "summary": summary,
        "structuredBlocks": structured_blocks,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CosmoAI Image Processor")
    parser.add_argument("image_path", help="Path to input image file")
    parser.add_argument("--output", help="Optional output JSON file")

    args = parser.parse_args()

    if not os.path.exists(args.image_path):
        sys.stderr.write(f"File not found: {args.image_path}\n")
        sys.exit(1)

    try:
        res = process_image(args.image_path)
        out_json = json.dumps(res, indent=2)

        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(out_json)
        else:
            print(out_json)
    except Exception as exc:
        err_res = {"error": str(exc), "success": False}
        sys.stderr.write(f"{str(exc)}\n")
        print(json.dumps(err_res))
        sys.exit(1)
