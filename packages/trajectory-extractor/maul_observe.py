#!/usr/bin/env python3
"""Emit versioned MediaPipe/OpenCV observations for the MAUL planner."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any, Iterable


GRID_COLUMNS = 12
GRID_ROWS = 20


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--duration-ms", type=int, required=True)
    parser.add_argument("--output-width", type=int, required=True)
    parser.add_argument("--output-height", type=int, required=True)
    parser.add_argument("--sample-every-frames", type=int, default=6)
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
        boxes.append(face_box)
        approximate_body = normalized_box(
            face_box["x"] - face_box["width"] * 0.9,
            face_box["y"],
            face_box["width"] * 2.8,
            min(1.0 - face_box["y"], face_box["height"] * 4.4),
        )
        if approximate_body:
            boxes.append(approximate_body)
    return union_boxes(boxes)


def linear_channel(channel: float) -> float:
    normalized = channel / 255.0
    if normalized <= 0.04045:
        return normalized / 12.92
    return ((normalized + 0.055) / 1.055) ** 2.4


def luminance_grid(cv2: Any, frame: Any) -> dict[str, Any]:
    resized = cv2.resize(frame, (GRID_COLUMNS, GRID_ROWS), interpolation=cv2.INTER_AREA)
    samples: list[float] = []
    for row in resized:
        for blue, green, red in row:
            luminance = (
                0.2126 * linear_channel(float(red))
                + 0.7152 * linear_channel(float(green))
                + 0.0722 * linear_channel(float(blue))
            )
            samples.append(round(luminance, 6))
    return {"columns": GRID_COLUMNS, "rows": GRID_ROWS, "samples": samples}


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
    source_path = Path(args.source).resolve()
    if not source_path.is_file():
        fail("source_unavailable", f"Source media is unavailable: {source_path}")

    try:
        import cv2  # type: ignore
        import mediapipe as mp  # type: ignore
    except Exception as error:
        fail("missing_dependency", f"MediaPipe/OpenCV import failed: {error}")

    capture = cv2.VideoCapture(str(source_path))
    if not capture.isOpened():
        fail("media_decode_failed", "OpenCV could not open the source media.")
    fps = float(capture.get(cv2.CAP_PROP_FPS))
    if not math.isfinite(fps) or fps <= 0:
        capture.release()
        fail("media_metadata_failed", "OpenCV returned invalid source FPS.")

    maximum_frame = max(0, int(math.floor((args.duration_ms / 1000.0) * fps)) - 1)
    frame_indices = range(0, maximum_frame + 1, args.sample_every_frames)
    frames: list[dict[str, Any]] = []
    try:
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
            for frame_index in frame_indices:
                capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
                success, frame = capture.read()
                if not success:
                    continue
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                face_box = face_box_for(face_detector.process(rgb))
                pose_landmarks = pose_landmarks_for(mp, pose_detector.process(rgb))
                frames.append({
                    "sourceMs": int(round((frame_index / fps) * 1000)),
                    "faceBox": face_box,
                    "poseLandmarks": pose_landmarks,
                    "subjectBox": subject_box_for(face_box, pose_landmarks),
                    "luminanceGrid": luminance_grid(cv2, frame),
                })
    finally:
        capture.release()

    if not frames:
        fail("zero_valid_frames", "MediaPipe/OpenCV produced zero valid sampled frames.")
    sample_interval_ms = max(1, int(round((args.sample_every_frames / fps) * 1000)))
    configuration = {
        "durationMs": args.duration_ms,
        "outputWidth": args.output_width,
        "outputHeight": args.output_height,
        "sampleEveryFrames": args.sample_every_frames,
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
        },
        "frames": frames,
        "missingSpans": missing_spans(frames, sample_interval_ms, args.duration_ms),
    }
    sys.stdout.write(json.dumps(payload, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
