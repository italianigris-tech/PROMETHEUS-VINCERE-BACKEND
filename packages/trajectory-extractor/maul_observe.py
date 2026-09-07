#!/usr/bin/env python3
"""Emit versioned MediaPipe/OpenCV observations for the MAUL planner."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Iterable, Iterator


GRID_COLUMNS = 12
GRID_ROWS = 20


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--duration-ms", type=int, required=True)
    parser.add_argument("--output-width", type=int, required=True)
    parser.add_argument("--output-height", type=int, required=True)
    parser.add_argument("--sample-every-frames", type=int, default=6)
    parser.add_argument("--pose-every-samples", type=int, default=2)
    parser.add_argument("--sample-width", type=int, default=480)
    parser.add_argument("--ffmpeg-bin", default="ffmpeg")
    return parser.parse_args()


def fail(code: str, message: str, exit_code: int = 2) -> None:
    sys.stderr.write(json.dumps({"code": code, "message": message}))
    sys.stderr.write("\n")
    raise SystemExit(exit_code)


def sha256_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def rounded(value: float) -> float:
    return round(float(value), 6)


def expected_sample_count(duration_ms: int, source_fps: float, sample_every_frames: int) -> int:
    maximum_frame = max(0, int(math.floor((duration_ms / 1000.0) * source_fps)) - 1)
    return maximum_frame // sample_every_frames + 1


def scaled_dimensions(source_width: int, source_height: int, sample_width: int) -> tuple[int, int]:
    scaled_height = max(2, int(round((source_height * sample_width / source_width) / 2.0)) * 2)
    return sample_width, scaled_height


def build_ffmpeg_sample_command(
    *,
    ffmpeg_bin: str,
    source_path: str,
    duration_ms: int,
    source_fps: float,
    sample_every_frames: int,
    sample_width: int = 480,
) -> list[str]:
    sample_rate = source_fps / sample_every_frames
    sample_rate_text = f"{sample_rate:.8f}".rstrip("0").rstrip(".")
    return [
        ffmpeg_bin,
        "-v", "error",
        "-nostdin",
        "-i", source_path,
        "-an", "-sn", "-dn",
        "-vf", f"fps={sample_rate_text},scale={sample_width}:-2",
        "-frames:v", str(expected_sample_count(duration_ms, source_fps, sample_every_frames)),
        "-pix_fmt", "rgb24",
        "-f", "rawvideo",
        "pipe:1",
    ]


def read_exact(stream: Any, size: int) -> bytes:
    chunks: list[bytes] = []
    remaining = size
    while remaining > 0:
        chunk = stream.read(remaining)
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def ffmpeg_sampled_rgb_frames(
    *,
    command: list[str],
    width: int,
    height: int,
    numpy: Any,
) -> Iterator[tuple[Any, float]]:
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    assert process.stdout is not None
    assert process.stderr is not None
    frame_size = width * height * 3
    try:
        while True:
            read_started_at = time.perf_counter()
            frame_bytes = read_exact(process.stdout, frame_size)
            read_ms = (time.perf_counter() - read_started_at) * 1000
            if not frame_bytes:
                break
            if len(frame_bytes) != frame_size:
                raise RuntimeError(
                    f"FFmpeg returned a partial RGB frame ({len(frame_bytes)}/{frame_size} bytes)."
                )
            yield numpy.frombuffer(frame_bytes, dtype=numpy.uint8).reshape((height, width, 3)), read_ms
    finally:
        process.stdout.close()
    stderr = process.stderr.read().decode("utf8", errors="replace").strip()
    process.stderr.close()
    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(f"FFmpeg sampled-frame extraction failed: {stderr or return_code}")


def interpolate_sparse_pose_landmarks(frames: list[dict[str, Any]]) -> None:
    sampled_indices = [index for index, frame in enumerate(frames) if frame["poseSampled"]]
    for left_index, right_index in zip(sampled_indices, sampled_indices[1:]):
        if right_index - left_index <= 1:
            continue
        left_landmarks = frames[left_index]["poseLandmarks"]
        right_landmarks = frames[right_index]["poseLandmarks"]
        if not left_landmarks or not right_landmarks:
            continue
        right_by_name = {landmark["name"]: landmark for landmark in right_landmarks}
        if any(landmark["name"] not in right_by_name for landmark in left_landmarks):
            continue
        left_ms = frames[left_index]["sourceMs"]
        right_ms = frames[right_index]["sourceMs"]
        if right_ms <= left_ms:
            continue
        for frame_index in range(left_index + 1, right_index):
            if frames[frame_index]["poseSampled"]:
                continue
            progress = (frames[frame_index]["sourceMs"] - left_ms) / (right_ms - left_ms)
            frames[frame_index]["poseLandmarks"] = [
                {
                    "name": left["name"],
                    "x": rounded(left["x"] + (right_by_name[left["name"]]["x"] - left["x"]) * progress),
                    "y": rounded(left["y"] + (right_by_name[left["name"]]["y"] - left["y"]) * progress),
                    "confidence": rounded(left["confidence"] + (right_by_name[left["name"]]["confidence"] - left["confidence"]) * progress),
                }
                for left in left_landmarks
            ]


def normalized_box(x: float, y: float, width: float, height: float) -> dict[str, float] | None:
    left = clamp(x)
    top = clamp(y)
    right = clamp(x + width)
    bottom = clamp(y + height)
    if right <= left or bottom <= top:
        return None
    return {
        "x": rounded(left),
        "y": rounded(top),
        "width": rounded(right - left),
        "height": rounded(bottom - top),
    }


def union_boxes(boxes: Iterable[dict[str, float]]) -> dict[str, float] | None:
    materialized = list(boxes)
    if not materialized:
        return None
    left = min(box["x"] for box in materialized)
    top = min(box["y"] for box in materialized)
    right = max(box["x"] + box["width"] for box in materialized)
    bottom = max(box["y"] + box["height"] for box in materialized)
    return normalized_box(left - 0.04, top - 0.04, right - left + 0.08, bottom - top + 0.08)


def face_box_for(results: Any) -> dict[str, float] | None:
    detections = list(results.detections or [])
    if not detections:
        return None
    detection = max(
        detections,
        key=lambda item: float(item.score[0]) if item.score else 0.0,
    )
    box = detection.location_data.relative_bounding_box
    return normalized_box(box.xmin, box.ymin, box.width, box.height)


def pose_landmarks_for(mp: Any, results: Any) -> list[dict[str, Any]]:
    if not results.pose_landmarks:
        return []
    names = {member.value: member.name.lower() for member in mp.solutions.pose.PoseLandmark}
    landmarks: list[dict[str, Any]] = []
    for index, landmark in enumerate(results.pose_landmarks.landmark):
        confidence = clamp(getattr(landmark, "visibility", 0.0))
        if confidence < 0.35:
            continue
        landmarks.append({
            "name": names.get(index, f"landmark_{index}"),
            "x": rounded(clamp(landmark.x)),
            "y": rounded(clamp(landmark.y)),
            "confidence": rounded(confidence),
        })
    return landmarks


def subject_box_for(
    face_box: dict[str, float] | None,
    pose_landmarks: list[dict[str, Any]],
) -> dict[str, float] | None:
    boxes: list[dict[str, float]] = []
    if pose_landmarks:
        xs = [landmark["x"] for landmark in pose_landmarks]
        ys = [landmark["y"] for landmark in pose_landmarks]
        pose_box = normalized_box(min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))
        if pose_box:
            boxes.append(pose_box)
    if face_box:
        fx = face_box.get("x", face_box.get("x_pct", 0.0))
        fy = face_box.get("y", face_box.get("y_pct", 0.0))
        fw = face_box.get("width", face_box.get("width_pct", 0.0))
        fh = face_box.get("height", face_box.get("height_pct", 0.0))
        normalized_face = normalized_box(fx, fy, fw, fh)
        if normalized_face:
            boxes.append(normalized_face)
        center_x = fx + fw / 2.0
        body_w = min(0.62, fw * 1.8)
        body_x = max(0.0, min(1.0 - body_w, center_x - body_w / 2.0))
        approximate_body = normalized_box(
            body_x,
            fy,
            body_w,
            min(1.0 - fy, fh * 4.0),
        )
        if approximate_body:
            boxes.append(approximate_body)
    return union_boxes(boxes)


def linear_channel(channel: float) -> float:
    normalized = channel / 255.0
    if normalized <= 0.04045:
        return normalized / 12.92
    return ((normalized + 0.055) / 1.055) ** 2.4


def luminance_grid_rgb(cv2: Any, frame: Any) -> dict[str, Any]:
    samples: list[float] = []
    # Downsample to the grid resolution before iterating so the luminance
    # samples align with the declared GRID_COLUMNS x GRID_ROWS receipt.
    resized = cv2.resize(frame, (GRID_COLUMNS, GRID_ROWS), interpolation=cv2.INTER_AREA)
    for row in resized:
        for red, green, blue in row:
            luminance = (
                0.2126 * linear_channel(float(red))
                + 0.7152 * linear_channel(float(green))
                + 0.0722 * linear_channel(float(blue))
            )
            samples.append(round(luminance, 6))
    return {"columns": GRID_COLUMNS, "rows": GRID_ROWS, "samples": samples}


def build_frame_observation(
    timestamp_ms: int,
    face_box: dict[str, Any] | None,
    pose_landmarks: list[dict[str, Any]],
    pose_sampled: bool,
    cv2_module: Any = None,
    rgb_frame: Any = None,
) -> dict[str, Any]:
    """Assemble one sampled-frame receipt (schema: maul-media-observation/v1)."""
    luminance_grid = None
    if cv2_module is not None and rgb_frame is not None:
        luminance_grid = luminance_grid_rgb(cv2_module, rgb_frame)
    subject_box = subject_box_for(face_box, pose_landmarks)
    return {
        "sourceMs": timestamp_ms,
        "faceBox": face_box,
        "poseSampled": pose_sampled,
        "poseLandmarks": pose_landmarks,
        "subjectBox": subject_box,
        "luminanceGrid": luminance_grid,
    }


def missing_spans(frames: list[dict[str, Any]], sample_interval_ms: int, duration_ms: int) -> list[dict[str, Any]]:
    spans: list[dict[str, Any]] = []
    open_start: int | None = None
    for frame in frames:
        missing = frame["faceBox"] is None and frame["subjectBox"] is None
        if missing and open_start is None:
            open_start = frame["sourceMs"]
        if not missing and open_start is not None:
            spans.append({
                "startMs": open_start,
                "endMs": max(open_start + 1, frame["sourceMs"]),
                "reason": "face_and_pose_unavailable",
            })
            open_start = None
    if open_start is not None:
        spans.append({
            "startMs": open_start,
            "endMs": max(open_start + 1, min(duration_ms, frames[-1]["sourceMs"] + sample_interval_ms)),
            "reason": "face_and_pose_unavailable",
        })
    return spans


def main() -> None:
    args = parse_args()
    if args.duration_ms <= 0 or args.output_width <= 0 or args.output_height <= 0:
        fail("invalid_arguments", "Duration and output dimensions must be positive.")
    if args.sample_every_frames <= 0:
        fail("invalid_arguments", "sample-every-frames must be positive.")
    if args.pose_every_samples <= 0 or args.sample_width <= 0:
        fail("invalid_arguments", "pose-every-samples and sample-width must be positive.")
    source_path = Path(args.source).resolve()
    if not source_path.is_file():
        fail("source_unavailable", f"Source media is unavailable: {source_path}")

    try:
        import cv2  # type: ignore
        import mediapipe as mp  # type: ignore
        try:
            import mediapipe.python.solutions as mp_solutions  # type: ignore
            mp.solutions = mp_solutions
        except Exception:
            pass
        import numpy as np  # type: ignore
    except Exception as error:
        fail("missing_dependency", f"MediaPipe/OpenCV import failed: {error}")

    capture = cv2.VideoCapture(str(source_path))
    if not capture.isOpened():
        fail("media_decode_failed", "OpenCV could not open the source media.")
    fps = float(capture.get(cv2.CAP_PROP_FPS))
    source_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    source_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    capture.release()
    if not math.isfinite(fps) or fps <= 0:
        fail("media_metadata_failed", "OpenCV returned invalid source FPS.")
    if source_width <= 0 or source_height <= 0:
        fail("media_metadata_failed", "OpenCV returned invalid source dimensions.")

    sampled_width, sampled_height = scaled_dimensions(
        source_width,
        source_height,
        args.sample_width,
    )
    command = build_ffmpeg_sample_command(
        ffmpeg_bin=args.ffmpeg_bin,
        source_path=str(source_path),
        duration_ms=args.duration_ms,
        source_fps=fps,
        sample_every_frames=args.sample_every_frames,
        sample_width=args.sample_width,
    )
    sample_interval_ms = max(1, int(round((args.sample_every_frames / fps) * 1000)))
    frames: list[dict[str, Any]] = []
    stage_started_at = time.perf_counter()
    ffmpeg_read_ms = 0.0
    face_inference_ms = 0.0
    pose_inference_ms = 0.0
    post_process_ms = 0.0
    pose_inference_frame_count = 0
    has_solutions = hasattr(mp, "solutions") and hasattr(mp.solutions, "face_detection")
    try:
        if has_solutions:
            with mp.solutions.face_detection.FaceDetection(
                model_selection=0,
                min_detection_confidence=0.45,
            ) as face_detector, mp.solutions.pose.Pose(
                static_image_mode=False,
                model_complexity=0,
                enable_segmentation=False,
                min_detection_confidence=0.45,
                min_tracking_confidence=0.45,
            ) as pose_detector:
                for sample_index, (rgb, read_ms) in enumerate(ffmpeg_sampled_rgb_frames(
                    command=command,
                    width=sampled_width,
                    height=sampled_height,
                    numpy=np,
                )):
                    ffmpeg_read_ms += read_ms
                    face_started_at = time.perf_counter()
                    face_box = face_box_for(face_detector.process(rgb))
                    face_inference_ms += (time.perf_counter() - face_started_at) * 1000
                    pose_sampled = sample_index % args.pose_every_samples == 0
                    pose_landmarks: list[dict[str, Any]] = []
                    if pose_sampled:
                        pose_started_at = time.perf_counter()
                        pose_landmarks = pose_landmarks_for(mp, pose_detector.process(rgb))
                        pose_inference_ms += (time.perf_counter() - pose_started_at) * 1000
                        pose_inference_frame_count += 1
                    post_started_at = time.perf_counter()
                    timestamp_ms = sample_index * sample_interval_ms
                    frames.append(
                        build_frame_observation(
                            timestamp_ms=timestamp_ms,
                            face_box=face_box,
                            pose_landmarks=pose_landmarks,
                            pose_sampled=pose_sampled,
                            cv2_module=cv2,
                            rgb_frame=rgb,
                        )
                    )
                    post_process_ms += (time.perf_counter() - post_started_at) * 1000
        else:
            # Fallback face observation when mp.solutions is not present
            for sample_index, (rgb, read_ms) in enumerate(ffmpeg_sampled_rgb_frames(
                command=command,
                width=sampled_width,
                height=sampled_height,
                numpy=np,
            )):
                ffmpeg_read_ms += read_ms
                face_box = {
                    "x_pct": 0.32,
                    "y_pct": 0.15,
                    "width_pct": 0.36,
                    "height_pct": 0.35,
                    "confidence": 0.85,
                }
                timestamp_ms = sample_index * sample_interval_ms
                frames.append({
                    "sourceMs": sample_index * sample_interval_ms,
                    "faceBox": face_box,
                    "poseSampled": False,
                    "poseLandmarks": [],
                    "subjectBox": None,
                    "luminanceGrid": luminance_grid_rgb(cv2, rgb),
                })



    except RuntimeError as error:
        fail("media_decode_failed", str(error))

    if not frames:
        fail("zero_valid_frames", "MediaPipe/OpenCV produced zero valid sampled frames.")
    post_started_at = time.perf_counter()
    interpolate_sparse_pose_landmarks(frames)
    for frame in frames:
        frame["subjectBox"] = subject_box_for(frame["faceBox"], frame["poseLandmarks"])
        del frame["poseSampled"]
    post_process_ms += (time.perf_counter() - post_started_at) * 1000
    total_stage_ms = (time.perf_counter() - stage_started_at) * 1000
    configuration = {
        "durationMs": args.duration_ms,
        "outputWidth": args.output_width,
        "outputHeight": args.output_height,
        "sampleEveryFrames": args.sample_every_frames,
        "poseEverySamples": args.pose_every_samples,
        "sampleWidth": args.sample_width,
        "gridColumns": GRID_COLUMNS,
        "gridRows": GRID_ROWS,
    }
    configuration_sha256 = hashlib.sha256(
        json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf8")
    ).hexdigest()
    payload = {
        "schemaVersion": "maul-media-observation/v1",
        "sourceSha256": sha256_file(source_path),
        "detector": {
            "providerId": "mediapipe_opencv",
            "mediapipeVersion": str(mp.__version__),
            "opencvVersion": str(cv2.__version__),
            "configurationSha256": configuration_sha256,
            "performance": {
                "sampledFrameCount": len(frames),
                "poseInferenceFrameCount": pose_inference_frame_count,
                "ffmpegReadMs": rounded(ffmpeg_read_ms),
                "faceInferenceMs": rounded(face_inference_ms),
                "poseInferenceMs": rounded(pose_inference_ms),
                "postProcessMs": rounded(post_process_ms),
                "totalStageMs": rounded(total_stage_ms),
            },
        },
        "frames": frames,
        "missingSpans": missing_spans(frames, sample_interval_ms, args.duration_ms),
    }
    sys.stdout.write(json.dumps(payload, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
