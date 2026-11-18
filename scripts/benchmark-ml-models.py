"""
CosmoAI ML Benchmarks (EasyOCR & Faster-Whisper)
Measures:
1. Cold-start model load time
2. Warm inference latency over N=30 iterations (with 3 warm-up runs excluded)
Outputs raw JSON with timing arrays and input metadata.
"""

import os
import sys
import time
import json
import numpy as np

def run_ml_benchmarks(n_iterations=30, n_warmup=3):
    fixtures_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "benchmarks", "fixtures"))
    img_path = os.path.join(fixtures_dir, "image_ocr.png")
    vid_path = os.path.join(fixtures_dir, "video_clip.mp4")
    
    results = {
        "metadata": {
            "image": {
                "file": "benchmarks/fixtures/image_ocr.png",
                "resolution": "480x240",
                "sizeBytes": os.path.getsize(img_path) if os.path.exists(img_path) else 0,
            },
            "video": {
                "file": "benchmarks/fixtures/video_clip.mp4",
                "resolution": "640x360",
                "durationSeconds": 3.0,
                "sizeBytes": os.path.getsize(vid_path) if os.path.exists(vid_path) else 0,
            },
            "python_version": sys.version.split()[0],
            "gpu_used": False,
            "device": "cpu",
            "compute_type": "int8"
        },
        "image_ocr": {
            "cold_start_ms": 0.0,
            "warmup_runs_ms": [],
            "samples_ms": []
        },
        "video_whisper": {
            "cold_start_ms": 0.0,
            "warmup_runs_ms": [],
            "samples_ms": []
        }
    }
    
    # --- 1. EasyOCR Benchmark ---
    import easyocr
    model_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "models", "easyocr"))
    user_net_dir = os.path.join(model_dir, "user_network")
    
    t0_cold_ocr = time.perf_counter()
    reader = easyocr.Reader(
        ['en'],
        gpu=False,
        model_storage_directory=model_dir if os.path.exists(model_dir) else None,
        user_network_directory=user_net_dir if os.path.exists(user_net_dir) else None,
        verbose=False
    )
    t1_cold_ocr = time.perf_counter()
    results["image_ocr"]["cold_start_ms"] = round((t1_cold_ocr - t0_cold_ocr) * 1000, 3)
    
    # Warm-up runs
    for _ in range(n_warmup):
        t0 = time.perf_counter()
        reader.readtext(img_path)
        t1 = time.perf_counter()
        results["image_ocr"]["warmup_runs_ms"].append(round((t1 - t0) * 1000, 3))
        
    # N=30 timed iterations
    for _ in range(n_iterations):
        t0 = time.perf_counter()
        res = reader.readtext(img_path)
        t1 = time.perf_counter()
        results["image_ocr"]["samples_ms"].append(round((t1 - t0) * 1000, 3))
        
    # --- 2. Faster-Whisper Benchmark ---
    # Extract audio to temp wav first
    import av
    import tempfile
    import wave
    
    temp_wav_path = None
    container = av.open(vid_path)
    if container.streams.audio:
        audio_stream = container.streams.audio[0]
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
            temp_wav_path = temp_wav.name
            
        resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)
        wav_file = wave.open(temp_wav_path, 'wb')
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        
        for frame in container.decode(audio_stream):
            frame.pts = None
            resampled_frames = resampler.resample(frame)
            for rf in resampled_frames:
                wav_file.writeframes(rf.to_ndarray().tobytes())
                
        wav_file.close()
        container.close()
        
    from faster_whisper import WhisperModel
    t0_cold_whisper = time.perf_counter()
    whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8")
    t1_cold_whisper = time.perf_counter()
    results["video_whisper"]["cold_start_ms"] = round((t1_cold_whisper - t0_cold_whisper) * 1000, 3)
    
    target_audio = temp_wav_path if (temp_wav_path and os.path.exists(temp_wav_path)) else vid_path
    
    # Warm-up runs
    for _ in range(n_warmup):
        t0 = time.perf_counter()
        segs, _ = whisper_model.transcribe(target_audio, beam_size=1)
        list(segs)
        t1 = time.perf_counter()
        results["video_whisper"]["warmup_runs_ms"].append(round((t1 - t0) * 1000, 3))
        
    # N=30 timed iterations
    for _ in range(n_iterations):
        t0 = time.perf_counter()
        segs, _ = whisper_model.transcribe(target_audio, beam_size=1)
        list(segs)
        t1 = time.perf_counter()
        results["video_whisper"]["samples_ms"].append(round((t1 - t0) * 1000, 3))
        
    if temp_wav_path and os.path.exists(temp_wav_path):
        try:
            os.remove(temp_wav_path)
        except:
            pass
            
    return results

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="CosmoAI ML Benchmarks")
    parser.add_argument("--iterations", type=int, default=30, help="Number of timed iterations")
    parser.add_argument("--warmup", type=int, default=3, help="Number of warmup iterations")
    args = parser.parse_args()
    
    data = run_ml_benchmarks(n_iterations=args.iterations, n_warmup=args.warmup)
    print(json.dumps(data))
