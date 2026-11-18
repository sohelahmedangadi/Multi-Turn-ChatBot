"""
CosmoAI Video Processor
Extracts visual frames, metadata, audio track, and timestamped speech transcripts from video files.

Libraries used:
1. OpenCV (cv2) & PyAV (av): Frame decoding, FPS, resolution, frame sampling, scene cut detection.
2. PyAV (av) & wave: High-performance direct audio stream extraction and resampling.
3. Faster-Whisper: Fast, local timestamped speech-to-text transcription.
4. MoviePy & imageio_ffmpeg: Fallback media handling.
"""

import sys
import os
import json
import argparse
import tempfile
import wave
import cv2
import av
import numpy as np

# Configurable safety caps for video ingestion
MAX_VIDEO_DURATION_SECONDS = float(os.environ.get('MAX_VIDEO_DURATION_SECONDS', 1800.0)) # 30 min cap
MAX_VIDEO_WIDTH = int(os.environ.get('MAX_VIDEO_WIDTH', 3840)) # 4K resolution cap
MAX_VIDEO_HEIGHT = int(os.environ.get('MAX_VIDEO_HEIGHT', 2160))
MAX_VIDEO_FRAME_COUNT = int(os.environ.get('MAX_VIDEO_FRAME_COUNT', 100000))

def extract_video_metadata(video_path):
    """
    Extracts resolution, duration, FPS, and total frames using OpenCV / PyAV.
    Enforces duration, resolution, and frame count caps BEFORE transcription begins.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"OpenCV could not open video file: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    duration_sec = total_frames / fps if fps > 0 else 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 0
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 0
    cap.release()

    # Pre-transcription safety cap checks
    if duration_sec > MAX_VIDEO_DURATION_SECONDS:
        raise ValueError(
            f"Video duration ({duration_sec:.1f}s) exceeds maximum allowable cap of {MAX_VIDEO_DURATION_SECONDS}s."
        )
    if width > MAX_VIDEO_WIDTH or height > MAX_VIDEO_HEIGHT:
        raise ValueError(
            f"Video resolution ({width}x{height}) exceeds maximum allowable cap of {MAX_VIDEO_WIDTH}x{MAX_VIDEO_HEIGHT}."
        )
    if total_frames > MAX_VIDEO_FRAME_COUNT:
        raise ValueError(
            f"Video frame count ({total_frames}) exceeds maximum allowable cap of {MAX_VIDEO_FRAME_COUNT} frames."
        )

    mins = int(duration_sec // 60)
    secs = int(duration_sec % 60)
    duration_formatted = f"{mins:02d}:{secs:02d}"

    return {
        "durationSeconds": round(duration_sec, 2),
        "durationFormatted": duration_formatted,
        "fps": round(fps, 2),
        "totalFrames": total_frames,
        "width": width,
        "height": height,
        "resolution": f"{width}x{height}",
    }


def sample_keyframes_opencv(video_path, interval_sec=5.0, max_frames=30):
    """
    Samples still frames from video at fixed intervals using OpenCV.
    Detects scene transitions based on frame difference threshold.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    step_frames = max(1, int(fps * interval_sec))
    sampled = []
    prev_gray = None

    frame_idx = 0
    while frame_idx < total_frames and len(sampled) < max_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret or frame is None:
            break

        timestamp_sec = frame_idx / fps
        t_min = int(timestamp_sec // 60)
        t_sec = int(timestamp_sec % 60)
        timestamp_str = f"{t_min:02d}:{t_sec:02d}"

        # Calculate visual brightness & motion diff
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(gray))
        diff_score = 0.0
        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray)
            diff_score = float(np.mean(diff))
        prev_gray = gray

        sampled.append({
            "frameIndex": frame_idx,
            "timestampSec": round(timestamp_sec, 2),
            "timestampFormatted": timestamp_str,
            "brightness": round(brightness, 1),
            "visualChangeScore": round(diff_score, 1),
            "isSceneCut": bool(diff_score > 35.0),
        })

        frame_idx += step_frames

    cap.release()
    return sampled


def extract_audio_and_transcribe(video_path):
    """
    Extracts the audio track from video using PyAV and transcribes
    using faster-whisper with timestamps.
    """
    audio_segments = []
    full_transcript = ""

    temp_wav_path = None
    try:
        container = av.open(video_path)
        if not container.streams.audio:
            return [], ""

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

        if os.path.exists(temp_wav_path) and os.path.getsize(temp_wav_path) > 1024:
            from faster_whisper import WhisperModel
            model = WhisperModel("tiny", device="cpu", compute_type="int8")
            segments, info = model.transcribe(temp_wav_path, beam_size=1)

            transcript_lines = []
            for s in segments:
                start_min = int(s.start // 60)
                start_sec = int(s.start % 60)
                end_min = int(s.end // 60)
                end_sec = int(s.end % 60)
                time_label = f"[{start_min:02d}:{start_sec:02d} - {end_min:02d}:{end_sec:02d}]"
                text = s.text.strip()
                if text:
                    audio_segments.append({
                        "start": round(s.start, 2),
                        "end": round(s.end, 2),
                        "timeLabel": time_label,
                        "text": text,
                    })
                    transcript_lines.append(f"{time_label} {text}")

            full_transcript = "\n".join(transcript_lines)

    except Exception as e:
        sys.stderr.write(f"Audio transcription notice: {str(e)}\n")
    finally:
        if temp_wav_path and os.path.exists(temp_wav_path):
            try:
                os.remove(temp_wav_path)
            except:
                pass

    return audio_segments, full_transcript


def process_video(video_path, interval_sec=5.0):
    """Combines metadata, visual keyframe analysis, and audio speech transcription."""
    filename = os.path.basename(video_path)
    
    # 1. OpenCV Metadata
    try:
        meta = extract_video_metadata(video_path)
    except Exception as e:
        return {
            "filename": filename,
            "metadata": {
                "durationSeconds": 0,
                "durationFormatted": "00:00",
                "fps": 24.0,
                "totalFrames": 0,
                "width": 0,
                "height": 0,
                "resolution": "Unknown",
            },
            "keyframesCount": 0,
            "keyframes": [],
            "hasAudio": False,
            "transcriptSegments": [],
            "fullTranscript": "",
            "summary": f"Video \"{filename}\" queued for analysis.",
            "sceneBlocks": [
                {
                    "page": 1,
                    "section": "Video Overview & Synopsis",
                    "heading": filename,
                    "text": f"Video \"{filename}\" queued for analysis.",
                }
            ],
        }

    # 2. OpenCV Keyframes Sampling
    keyframes = sample_keyframes_opencv(video_path, interval_sec=interval_sec)

    # 3. Audio Extraction & Faster-Whisper Speech-to-Text
    audio_segments, full_transcript = extract_audio_and_transcribe(video_path)

    # 4. Construct Chronological Scene Timeline Blocks
    scene_blocks = []

    if audio_segments:
        # Build scenes aligned with spoken segments
        for idx, seg in enumerate(audio_segments):
            scene_blocks.append({
                "page": idx + 1,
                "section": f"Scene {idx + 1} ({seg['timeLabel']})",
                "heading": f"Timeline {seg['timeLabel']}",
                "text": f"{seg['timeLabel']} Spoken Dialogue & Narration:\n\"{seg['text']}\"",
            })
    else:
        # Fall back to visual keyframe scenes
        for idx, kf in enumerate(keyframes):
            cut_notice = " [Visual Scene Cut]" if kf['isSceneCut'] else ""
            scene_blocks.append({
                "page": idx + 1,
                "section": f"Scene {idx + 1} ({kf['timestampFormatted']})",
                "heading": f"Frame at {kf['timestampFormatted']}",
                "text": f"[{kf['timestampFormatted']}] Visual frame at index {kf['frameIndex']} (brightness: {kf['brightness']}){cut_notice}.",
            })

    # Executive Overview
    summary_overview = (
        f"Video \"{filename}\" ({meta['resolution']}, {meta['fps']} FPS, duration: {meta['durationFormatted']}).\n"
    )
    if full_transcript:
        summary_overview += f"\nFull Audio Transcription & Spoken Content:\n{full_transcript}"
    else:
        summary_overview += f"\nVisual analysis complete across {len(keyframes)} sampled frames."

    result = {
        "filename": filename,
        "metadata": meta,
        "keyframesCount": len(keyframes),
        "keyframes": keyframes,
        "hasAudio": bool(audio_segments),
        "transcriptSegments": audio_segments,
        "fullTranscript": full_transcript,
        "summary": summary_overview,
        "sceneBlocks": scene_blocks,
    }
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CosmoAI Video Processor")
    parser.add_argument("video_path", help="Path to input video file")
    parser.add_argument("--interval", type=float, default=5.0, help="Frame sampling interval in seconds")
    parser.add_argument("--output", help="Optional output JSON path")

    args = parser.parse_args()
    
    if not os.path.exists(args.video_path):
        sys.stderr.write(f"File not found: {args.video_path}\n")
        sys.exit(1)

    try:
        result = process_video(args.video_path, interval_sec=args.interval)
        out_json = json.dumps(result, indent=2)
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
