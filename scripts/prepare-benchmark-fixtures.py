"""
CosmoAI Benchmark Fixtures Generator
Generates reproducible test fixtures for:
1. 15-page PDF document (benchmarks/fixtures/doc_15pages.pdf)
2. Text-rich OCR Image (benchmarks/fixtures/image_ocr.png)
3. 3-second Speech/Audio Video (benchmarks/fixtures/video_clip.mp4)
"""

import os
import sys
import wave
import math
import struct
import tempfile
import cv2
import numpy as np
import pypdf
import av

FIXTURES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "benchmarks", "fixtures"))
os.makedirs(FIXTURES_DIR, exist_ok=True)

def generate_15page_pdf():
    pdf_path = os.path.join(FIXTURES_DIR, "doc_15pages.pdf")
    
    # Use real text PDF from uploads_storage
    src_pdf = os.path.join(os.path.dirname(__file__), "..", "uploads_storage", "file_mwhjygdj_q7asa.bin")
    
    writer = pypdf.PdfWriter()
    
    if os.path.exists(src_pdf):
        reader = pypdf.PdfReader(src_pdf)
        for i in range(15):
            writer.add_page(reader.pages[i % len(reader.pages)])
    else:
        # Fallback create blank pages
        for i in range(15):
            writer.add_blank_page(width=612, height=792)
            
    with open(pdf_path, "wb") as f:
        writer.write(f)
        
    reader_check = pypdf.PdfReader(pdf_path)
    file_size = os.path.getsize(pdf_path)
    return {
        "file": pdf_path,
        "pageCount": len(reader_check.pages),
        "sizeBytes": file_size,
        "sizeKb": round(file_size / 1024, 2)
    }

def generate_ocr_image():
    img_path = os.path.join(FIXTURES_DIR, "image_ocr.png")
    width, height = 480, 240
    img = np.full((height, width, 3), 255, dtype=np.uint8)
    
    cv2.putText(img, "CosmoAI Research Benchmark", (25, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    cv2.putText(img, "Multimodal Document Parser", (25, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (40, 40, 40), 2)
    cv2.putText(img, "EasyOCR Deep Learning Engine", (25, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 140), 2)
    
    cv2.imwrite(img_path, img)
    file_size = os.path.getsize(img_path)
    return {
        "file": img_path,
        "width": width,
        "height": height,
        "resolution": f"{width}x{height}",
        "sizeBytes": file_size,
        "sizeKb": round(file_size / 1024, 2)
    }

def generate_video_clip():
    video_path = os.path.join(FIXTURES_DIR, "video_clip.mp4")
    duration_sec = 3.0
    fps = 24
    width, height = 640, 360
    total_frames = int(duration_sec * fps)
    
    # 1. Create container with PyAV
    container = av.open(video_path, mode="w")
    video_stream = container.add_stream("h264", rate=fps)
    video_stream.width = width
    video_stream.height = height
    video_stream.pix_fmt = "yuv420p"
    
    audio_stream = container.add_stream("aac", rate=16000)
    audio_stream.layout = "mono"
    
    # Write video frames
    for i in range(total_frames):
        frame_rgb = np.full((height, width, 3), 240, dtype=np.uint8)
        # Add visual movement/text
        cv2.putText(frame_rgb, f"Benchmark Frame {i}", (50, 180), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 100, 200), 2)
        frame = av.VideoFrame.from_ndarray(frame_rgb, format="bgr24")
        for packet in video_stream.encode(frame):
            container.mux(packet)
            
    for packet in video_stream.encode():
        container.mux(packet)
        
    # Write audio frames (16kHz sine wave)
    sample_rate = 16000
    samples_total = int(duration_sec * sample_rate)
    chunk_size = 1024
    for offset in range(0, samples_total, chunk_size):
        cur_samples = min(chunk_size, samples_total - offset)
        audio_data = np.zeros((1, cur_samples), dtype=np.int16)
        for s in range(cur_samples):
            idx = offset + s
            audio_data[0, s] = int(32767.0 * 0.2 * math.sin(2.0 * math.pi * 440.0 * idx / sample_rate))
        audio_frame = av.AudioFrame.from_ndarray(audio_data, format="s16", layout="mono")
        audio_frame.sample_rate = sample_rate
        for packet in audio_stream.encode(audio_frame):
            container.mux(packet)
            
    for packet in audio_stream.encode():
        container.mux(packet)
        
    container.close()
    
    file_size = os.path.getsize(video_path)
    return {
        "file": video_path,
        "durationSeconds": duration_sec,
        "width": width,
        "height": height,
        "resolution": f"{width}x{height}",
        "sizeBytes": file_size,
        "sizeKb": round(file_size / 1024, 2)
    }

if __name__ == "__main__":
    pdf_info = generate_15page_pdf()
    print("PDF:", pdf_info)
    img_info = generate_ocr_image()
    print("Image:", img_info)
    vid_info = generate_video_clip()
    print("Video:", vid_info)
