# ============================================================================
# PROMETHEUS TRAJECTORY EXTRACTOR - Kaggle single-cell edition (revamped)
# ============================================================================
# Paste this entire block into ONE Kaggle notebook cell (GPU accelerator ON).
# It produces schema-valid trajectory.json files, one per video.
#
# Run the install cell FIRST (separate cell, before this one):
#   !pip install -q opencv-python-headless librosa mediapipe pydantic scenedetect easyocr
#   !apt-get update -qq && apt-get install -y -qq ffmpeg libsm6 libxext6
#
# This code emits the 74-feature schema committed in
# packages/trajectory-extractor/trajectory_extractor/schema.py
# (Pydantic v2, Program 20 target 60-80 features, finals_only mode).
#
# REVAMP NOTES (what changed vs the previous version, and why):
#   1. FACE-BOX CRASH FIXED. face_boxes() returns a flat list of (x,y,w,h)
#      tuples, so fb[0] is ONE box. Three extractors were indexing it as
#      face_b[0][0] (treating it as a list-of-boxes) -> TypeError at window 1
#      of any speaker video, silently killing the whole trajectory via the
#      per-video try/except. All indexing now treats the primary box as a
#      single (x,y,w,h) tuple.
#   2. derive_genre() precedence fixed. The old `A and B if cond else C` line
#      made the screen-recording/tutorial branch dead code, so tutorials were
#      never filtered out (they'd pollute training). Now explicit.
#   3. EnergyBucket fallback fixed (was `...if hasattr(EnergyBucket,'none')`
#      which is always False). Removed the latent footgun.
#   4. Heavy deps (librosa/mediapipe/scenedetect/easyocr) are now OPTIONAL:
#      a missing import degrades that feature family to safe defaults instead
#      of raising ImportError and bricking the whole cell.
#   5. PER-WINDOW RESILIENCE: a single bad window is skipped with a warning
#      instead of aborting the entire video trajectory.
#   6. Numerical guards: spectral_centroid / onset_env can emit nan or warn on
#      silent/short segments - guarded and coerced to 0.0.
# ============================================================================

import json, os, hashlib
from pathlib import Path
from enum import Enum
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, model_validator

# ---- required baseline (hard errors if these are missing) ----
import numpy as np
import cv2

# ---- optional: degrade gracefully if a Kaggle install hiccupped ----
try:
    import librosa
    HAS_LIBROSA = True
except Exception:
    HAS_LIBROSA = False
    print("WARN: librosa not available - audio features will be zeroed.")

try:
    import mediapipe as mp
    HAS_MEDIAPIPE = True
except Exception:
    HAS_MEDIAPIPE = False
    print("WARN: mediapipe not available - face features will be absent.")

try:
    from scenedetect import detect, ContentDetector
    HAS_SCENEDETECT = True
except Exception:
    HAS_SCENEDETECT = False
    print("WARN: scenedetect not available - transition features will default to 'cut'.")

try:
    import easyocr
    _READER = None  # lazy-init on first use (GPU)
    def get_reader():
        global _READER
        if _READER is None:
            _READER = easyocr.Reader(['en'], gpu=True)
        return _READER
    HAS_OCR = True
except Exception:
    HAS_OCR = False
    print("WARN: easyocr not available - typography fields will be heuristic-only.")


# ============================================================================
# SCHEMA (inlined so the cell is self-contained on Kaggle)
# Kept byte-for-byte in sync with trajectory_extractor/schema.py (74 features).
# DO NOT edit one without the other.
# ============================================================================

class Intensity(str, Enum):
    minimal="minimal"; restrained="restrained"; balanced="balanced"; expressive="expressive"
class VisualDensity(str, Enum):
    quiet="quiet"; balanced="balanced"; loud="loud"
class MotionEnergy(str, Enum):
    none="none"; subtle="subtle"; active="active"
class EditorialRole(str, Enum):
    setup="setup"; explain="explain"; tension="tension"; payoff="payoff"
class EnergyBucket(str, Enum):
    low="low"; mid="mid"; high="high"
class Confidence(str, Enum):
    uncertain="uncertain"; neutral="neutral"; assertive="assertive"
class ExtractionMode(str, Enum):
    paired="paired"; finals_only="finals_only"
class SegmentGenre(str, Enum):
    editorial="editorial"; tutorial_walkthrough="tutorial_walkthrough"; broll_only="broll_only"; title_card="title_card"

def _b(v, lo, hi):
    """bucket a float into EnergyBucket"""
    if v is None: return EnergyBucket.low
    t = (v - lo) / (hi - lo + 1e-9)
    return EnergyBucket.low if t < 0.33 else EnergyBucket.high if t > 0.66 else EnergyBucket.mid

class CameraFeatures(BaseModel):
    movement_class: str
    movement_magnitude: EnergyBucket
    has_ken_burns: bool = False
    face_box_velocity: EnergyBucket
    shot_change_count: int = Field(0, ge=0, le=5)
    has_jump_cut: bool = False
    has_match_cut: bool = False
    momentum_direction: str
    crop_tightness: str
    rule_of_thirds_alignment: bool = False

class TypographyFeatures(BaseModel):
    has_text: bool = False
    role: str = "none"
    placement_zone: str = "none"
    font_weight: str = "none"
    text_color_treatment: str = "none"
    animation_class: str = "none"
    has_background_plate: bool = False
    keyword_count: int = Field(0, ge=0, le=4)
    text_duration_bucket: str = "none"
    occupancy_bucket: EnergyBucket = EnergyBucket.low

class MotionGraphicsFeatures(BaseModel):
    has_glass_card: bool = False
    has_image_asset: bool = False
    has_data_viz: bool = False
    has_screen_recording: bool = False
    micro_animation_family: str = "none"
    overlay_layer_count: int = Field(0, ge=0, le=4)
    has_particle_fx: bool = False
    has_depth_layering: bool = False

class CompositionFeatures(BaseModel):
    speaker_position: str
    has_pip: bool = False
    pip_count: int = Field(0, ge=0, le=2)
    pip_arrangement: str = "none"
    negative_space_ratio: EnergyBucket
    background_type: str
    depth_of_field: str
    has_subject_segmentation: bool = False
    subject_scale: str
    visual_symmetry: bool = False

class TransitionFeatures(BaseModel):
    dominant_type: str = "cut"
    has_audio_synced_cut: bool = False
    timing_offset_bucket: str = "on"
    has_momentum_handoff: bool = False
    transition_duration_bucket: str = "instant"
    has_flash_transition: bool = False

class AudioFeatures(BaseModel):
    sfx_class: str = "none"
    sfx_count: int = Field(0, ge=0, le=4)
    music_presence: bool = False
    music_energy: EnergyBucket
    beat_proximity: str = "off"
    ducking_active: bool = False
    has_silence_gap: bool = False
    vocal_energy: EnergyBucket
    spectral_brightness: EnergyBucket
    transient_density: EnergyBucket

class TemporalFeatures(BaseModel):
    position_in_video: str
    pacing_density: EnergyBucket
    is_climax_window: bool = False
    is_restraint_window: bool = False
    sequence_trend: str
    novelty_level: EnergyBucket
    surprise_budget_state: EnergyBucket
    repetition_penalty_active: bool = False

class SpeakerVocalFeatures(BaseModel):
    is_speaking: bool = False
    speaking_rate: str = "none"
    confidence: Confidence
    has_emphasis: bool = False
    has_pause: bool = False
    face_emotion_class: str = "neutral"
    gaze_target: str = "lens"
    has_gesture: bool = False

class TimelineWindow(BaseModel):
    index: int
    start_seconds: float
    end_seconds: float
    segment_genre: SegmentGenre = SegmentGenre.editorial
    intensity: Intensity
    visual_density: VisualDensity
    motion_energy: MotionEnergy
    editorial_role: EditorialRole
    camera: CameraFeatures
    typography: TypographyFeatures
    motion_graphics: MotionGraphicsFeatures
    composition: CompositionFeatures
    transitions: TransitionFeatures
    audio: AudioFeatures
    temporal: TemporalFeatures
    speaker_vocal: SpeakerVocalFeatures

    @model_validator(mode="after")
    def validate_span(self) -> "TimelineWindow":
        if self.end_seconds <= self.start_seconds:
            raise ValueError("window end_seconds must be greater than start_seconds")
        return self

class TrajectoryMetadata(BaseModel):
    extraction_mode: ExtractionMode
    source_hash: str
    corpus_id: str
    source_video_id: Optional[str] = None
    edited_video_id: str
    vehicle: str
    style_label: str
    featureVersion: str
    extracted_at_utc: str
    extractor_version: str = "0.2.0"
    duration_seconds: float
    fps: float
    frame_count: int
    resolution: str
    windowing_mode: str
    notes: Optional[str] = None

class Trajectory(BaseModel):
    schema_version: str = "0.2.0"
    metadata: TrajectoryMetadata
    windows: list[TimelineWindow]

    @model_validator(mode="after")
    def validate_timeline_contract(self) -> "Trajectory":
        expected_duration = self.metadata.frame_count / self.metadata.fps
        tolerance = max(1.0 / self.metadata.fps, 0.05)
        if abs(expected_duration - self.metadata.duration_seconds) > tolerance:
            raise ValueError("metadata duration_seconds must match frame_count / fps within one frame")
        previous_end = 0.0
        for window in self.windows:
            if window.start_seconds + tolerance < previous_end:
                raise ValueError("timeline windows must be ordered and non-overlapping")
            if window.end_seconds > self.metadata.duration_seconds + tolerance:
                raise ValueError("timeline window extends beyond metadata duration_seconds")
            previous_end = window.end_seconds
        return self

WINDOW_SECONDS = 1.0  # fixed-1s windowing - chosen for cross-video comparability
ARTIFACT_CONTRACT_VERSION = "joseph-kaggle-artifacts-v1"
KAGGLE_EXTRACTOR_VERSION = "kaggle-1.1.0"
VIDEO_EXTENSIONS = (".mp4", ".mov", ".mkv", ".webm")

INPUT_DIR = "/kaggle/input/joseph-video-edits"
OUTPUT_DIR = "/kaggle/working/trajectories"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ============================================================================
# LOW-LEVEL HELPERS (video I/O, audio, OCR, faces, flow)
# ============================================================================

# A primary face box is a single (x, y, w, h) tuple in pixels - NOT a list.
# face_boxes() returns list[FaceBox]; we pass fb[0] (one box, or None) to the
# per-family extractors. Indexing a box is single-level: box[0]=x, [1]=y, ...
FaceBox = tuple  # (x: int, y: int, w: int, h: int)

def file_hash(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]

def get_video_meta(path: str):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    dur = n / fps if fps else 0
    cap.release()
    return {"fps": fps, "frames": n, "w": w, "h": h, "duration": dur}

def load_audio(path: str, sr: int = 22050):
    """librosa load for a whole video; returns (y, sr, duration).
    Named load_audio (NOT extract_audio) to avoid colliding with the
    per-window audio feature extractor of the same name - that collision
    silently shadowed this loader and crashed run_batch on video 1.
    Caller must check HAS_LIBROSA before calling."""
    y, sr = librosa.load(path, sr=sr, mono=True)
    return y, sr, len(y) / sr

def detect_scenes(path: str):
    """Returns list of (start_sec, end_sec) scene boundaries via PySceneDetect."""
    if os.environ.get("PROMETHEUS_DISABLE_SCENEDETECT") == "1":
        return []
    if not HAS_SCENEDETECT:
        return []
    try:
        scene_list = detect(path, ContentDetector(threshold=27.0))
        return [(s.get_seconds(), e.get_seconds()) for s, e in scene_list]
    except Exception:
        return []

def sample_window_frames(path: str, start: float, end: float, fps: float, n: int = 4):
    """Evenly sample n frames within [start,end)."""
    cap = cv2.VideoCapture(path)
    out = []
    for t in np.linspace(start, end, n, endpoint=False):
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, frame = cap.read()
        if ok:
            out.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    cap.release()
    return out

def optical_flow_mag(frames):
    """Mean per-pixel optical flow magnitude across consecutive frames."""
    if len(frames) < 2: return 0.0
    mags = []
    prev = cv2.cvtColor(frames[0], cv2.COLOR_RGB2GRAY)
    for f in frames[1:]:
        cur = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
        fl = cv2.calcOpticalFlowFarneback(prev, cur, None, 0.5, 3, 15, 3, 5, 1.2, 0)
        mags.append(np.sqrt(fl[..., 0]**2 + fl[..., 1]**2).mean())
        prev = cur
    return float(np.mean(mags)) if mags else 0.0

def face_boxes(frames):
    """Return list of (x,y,w,h) face boxes across frames using MediaPipe.
    Each ELEMENT is one box; boxes[0] is the primary (first-detected) box."""
    if not HAS_MEDIAPIPE:
        return []
    boxes = []
    with mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5) as fd:
        for f in frames:
            res = fd.process(cv2.cvtColor(f, cv2.COLOR_RGB2BGR))
            if res.detections:
                for d in res.detections:
                    bb = d.location_data.relative_bounding_box
                    h, w = f.shape[:2]
                    boxes.append((int(bb.xmin*w), int(bb.ymin*h), int(bb.width*w), int(bb.height*h)))
    return boxes

def detect_text_regions(frames):
    """Heuristic text presence in lower-third / upper-third zones. Used when OCR unavailable."""
    for f in frames:
        g = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
        h, w = g.shape
        # high-contrast horizontal strips in lower/upper third
        for (y0, y1) in [(int(h*0.75), h), (0, int(h*0.18))]:
            strip = g[y0:y1, int(w*0.1):int(w*0.9)]
            if strip.size == 0: continue
            edges = cv2.Canny(strip, 100, 200)
            if edges.mean() > 18:  # tuned threshold
                return True, ("lower_third" if y0 > h/2 else "upper_third")
    return False, "none"

def ocr_text(frames):
    """Return (texts, zones) via easyocr if available."""
    if not HAS_OCR:
        return [], []
    reader = get_reader()
    texts, zones = [], []
    for f in frames:
        h, w = f.shape[:2]
        res = reader.readtext(f, detail=1, paragraph=False)
        for box, txt, conf in res:
            if conf < 0.4 or len(txt.strip()) < 2: continue
            (xs, ys) = zip(*box)
            cy = np.mean(ys)
            zone = ("lower_third" if cy > h*0.66 else "upper_third" if cy < h*0.25
                    else "center" if h*0.35 < cy < h*0.6 else "hero")
            texts.append(txt); zones.append(zone)
    return texts, zones

def edge_density(frame):
    g = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
    return float(cv2.Canny(g, 100, 200).mean())

def color_variance(frame):
    return float(frame.reshape(-1, 3).std(axis=0).mean())


def _round_time(value: float) -> float:
    return round(float(value), 6)


def _safe_stem(value: str) -> str:
    stem = Path(value).stem
    return "".join(char if char.isalnum() or char in ("-", "_") else "_" for char in stem).strip("_") or "video"


def _normalized_key(value: str) -> str:
    return "".join(char.lower() for char in value if char.isalnum())


def _write_json(path: str | Path, payload: dict) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
        f.write("\n")


def _relative_to_output(path: str | Path, output_dir: str | Path) -> str:
    try:
        return os.path.relpath(str(path), str(output_dir))
    except ValueError:
        return str(path)


def discover_video_paths(input_dir: str) -> list[str]:
    roots = []
    videos_dir = os.path.join(input_dir, "videos")
    if os.path.isdir(videos_dir):
        roots.append(videos_dir)
    roots.append(input_dir)

    seen = set()
    videos = []
    for root in roots:
        for current_root, _, files in os.walk(root):
            for name in files:
                if not name.lower().endswith(VIDEO_EXTENSIONS):
                    continue
                full = os.path.abspath(os.path.join(current_root, name))
                if full in seen:
                    continue
                seen.add(full)
                videos.append(full)
    return sorted(videos)


def load_audit_event_packets(input_dir: str) -> list[dict]:
    packets = []
    for current_root, _, files in os.walk(input_dir):
        for name in files:
            if not name.endswith(".events.json"):
                continue
            full = os.path.join(current_root, name)
            try:
                with open(full, "r", encoding="utf-8") as f:
                    packet = json.load(f)
                packet["_artifact_source_path"] = full
                packets.append(packet)
            except Exception as ex:
                packets.append({
                    "schemaVersion": "manual-feature-extraction-v1",
                    "referenceId": _safe_stem(name),
                    "events": [],
                    "candidateFeatures": [],
                    "_artifact_source_path": full,
                    "_load_error": f"{type(ex).__name__}: {ex}",
                })
    return sorted(packets, key=lambda packet: str(packet.get("referenceId", "")))


def events_for_video(audit_packets: list[dict], video_path: str, video_id: str, video_index: int) -> tuple[dict | None, list[dict]]:
    video_name_key = _normalized_key(os.path.basename(video_path))
    video_id_key = _normalized_key(video_id)
    ordinal_token = f"candidate_reference_{video_index}_of_5"

    for packet in audit_packets:
        reference_key = _normalized_key(str(packet.get("referenceId", "")))
        if reference_key and reference_key == video_id_key:
            return packet, list(packet.get("events", []))

        packet_video = packet.get("videoPath")
        if packet_video and _normalized_key(os.path.basename(packet_video)) == video_name_key:
            return packet, list(packet.get("events", []))

        status = str(packet.get("status", ""))
        if not packet_video and "candidate_reference_1_of_5" in status and (
            "gadzhi" in video_name_key or "firstvideo" in video_name_key
        ):
            return packet, list(packet.get("events", []))

        if ordinal_token and ordinal_token in status:
            return packet, list(packet.get("events", []))

    return None, []


def _event_time_span(event: dict) -> tuple[float, float, float]:
    raw = event.get("timeSeconds", 0.0)
    if isinstance(raw, list) and raw:
        start = float(raw[0])
        end = float(raw[-1]) if len(raw) > 1 else start
    else:
        start = float(raw)
        end = start
    if end < start:
        start, end = end, start
    midpoint = start + ((end - start) / 2.0)
    return _round_time(start), _round_time(end), _round_time(midpoint)


def _limited_events(events: list[dict]) -> list[tuple[int, dict]]:
    limit = int(os.environ.get("PROMETHEUS_AUDIT_EVENT_LIMIT", "40"))
    return list(enumerate(events[:limit]))


def sample_frame_at_time(path: str, time_seconds: float):
    cap = cv2.VideoCapture(path)
    cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, float(time_seconds)) * 1000)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        return None
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)


def write_frame_evidence(video_path: str, video_id: str, events: list[dict], output_dir: str) -> dict:
    frames_dir = Path(output_dir) / "frame-evidence" / video_id
    frames_dir.mkdir(parents=True, exist_ok=True)
    frames = []
    failures = []
    for event_index, event in _limited_events(events):
        start, end, midpoint = _event_time_span(event)
        frame = sample_frame_at_time(video_path, midpoint)
        filename = f"event-{event_index:03d}-{midpoint:.3f}s.jpg"
        frame_path = frames_dir / filename
        if frame is None:
            failures.append({"event_index": event_index, "time_seconds": midpoint, "reason": "frame_decode_failed"})
            continue
        cv2.imwrite(str(frame_path), cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))
        frames.append({
            "event_index": event_index,
            "start_seconds": start,
            "end_seconds": end,
            "sample_seconds": midpoint,
            "path": _relative_to_output(frame_path, output_dir),
        })
    return {
        "schema_version": "frame-evidence-v1",
        "video_id": video_id,
        "source_video_path": video_path,
        "frame_count": len(frames),
        "frames": frames,
        "failures": failures,
        "warnings": [] if events else ["no_audit_events_matched_video"],
    }


def build_text_evidence(video_path: str, video_id: str, events: list[dict]) -> dict:
    observations = []
    warnings = []
    if not HAS_OCR:
        warnings.append("ocr_unavailable")
    for event_index, event in _limited_events(events):
        start, end, midpoint = _event_time_span(event)
        frame = sample_frame_at_time(video_path, midpoint)
        texts, zones = ocr_text([frame]) if frame is not None and HAS_OCR else ([], [])
        observations.append({
            "event_index": event_index,
            "start_seconds": start,
            "end_seconds": end,
            "sample_seconds": midpoint,
            "texts": texts,
            "zones": zones,
            "source": "easyocr_gpu" if HAS_OCR else "ocr_unavailable",
        })
    if not events:
        warnings.append("no_audit_events_matched_video")
    return {
        "schema_version": "text-evidence-v1",
        "video_id": video_id,
        "source_video_path": video_path,
        "observation_count": len(observations),
        "observations": observations,
        "warnings": warnings,
    }


def build_motion_cut_evidence(video_path: str, video_id: str, scenes: list[tuple[float, float]], events: list[dict]) -> dict:
    scene_entries = [
        {"start_seconds": _round_time(start), "end_seconds": _round_time(end)}
        for start, end in scenes
    ]
    audit_windows = []
    scene_starts = [start for start, _ in scenes]
    for event_index, event in _limited_events(events):
        start, end, midpoint = _event_time_span(event)
        audit_windows.append({
            "event_index": event_index,
            "start_seconds": start,
            "end_seconds": end,
            "sample_seconds": midpoint,
            "scene_cut_count": len([cut for cut in scene_starts if start <= cut <= end]),
        })
    return {
        "schema_version": "motion-cut-evidence-v1",
        "video_id": video_id,
        "source_video_path": video_path,
        "scene_detector": "pyscenedetect_content_detector" if HAS_SCENEDETECT else "unavailable",
        "scene_count": len(scene_entries),
        "scenes": scene_entries,
        "audit_windows": audit_windows,
        "warnings": [] if HAS_SCENEDETECT else ["scene_detection_unavailable"],
    }


def build_audio_artifact_for_video(video_path: str, source_hash: str, meta: dict) -> dict:
    if not HAS_LIBROSA:
        return build_fallback_kaggle_audio_artifact(source_hash, meta["duration"], "librosa_unavailable")
    try:
        y, sr, duration = load_audio(video_path)
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beats, sr=sr)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onset_times = librosa.onset.onset_detect(y=y, sr=sr, units="time")
        return build_librosa_audio_artifact(source_hash, y, sr, duration, beat_times, onset_times, onset_env)
    except Exception as ex:
        return build_fallback_kaggle_audio_artifact(
            source_hash,
            meta["duration"],
            f"librosa_failed:{type(ex).__name__}",
        )


def build_librosa_audio_artifact(source_hash: str, y, sr: int, duration: float, beat_times, onset_times, onset_env) -> dict:
    beat_grid = [
        {
            "beat_index": index,
            "time_seconds": _round_time(float(time_seconds)),
            "downbeat": index % 4 == 0,
            "source": "librosa_beat_track",
        }
        for index, time_seconds in enumerate(beat_times)
    ]
    onsets = []
    onset_strengths = list(onset_env) if onset_env is not None else []
    for index, time_seconds in enumerate(onset_times):
        strength = onset_strengths[min(index, len(onset_strengths) - 1)] if onset_strengths else 0.0
        onsets.append({
            "time_seconds": _round_time(float(time_seconds)),
            "strength": _round_time(float(strength)),
            "source": "librosa_onset_detect",
        })
    return {
        "schema_version": "audio-artifact-v1",
        "analyzer_version": KAGGLE_EXTRACTOR_VERSION,
        "source_hash": source_hash,
        "duration_seconds": _round_time(duration),
        "analysis_mode": "librosa_mixed_audio",
        "is_fallback": False,
        "beat_grid": beat_grid,
        "downbeats": [beat["time_seconds"] for beat in beat_grid if beat["downbeat"]],
        "onsets": onsets,
        "energy": {
            "source": "librosa_pcm_rms",
            "window_seconds": WINDOW_SECONDS,
            "windows": _mixed_audio_energy_windows(y, sr, WINDOW_SECONDS),
        },
        "sections": [
            {
                "start_seconds": 0.0,
                "end_seconds": _round_time(duration),
                "label": "analyzed_mixed_audio",
                "confidence": 0.5,
                "source": "librosa",
            }
        ],
        "sfx_events": [],
        "voice_music_separation": {"source": "unavailable", "voice_stems": [], "music_stems": []},
        "ducking_envelope": {"source": "unavailable", "points": []},
        "warnings": [
            "sfx_detection_unavailable",
            "voice_music_separation_unavailable",
            "ducking_unavailable",
        ],
    }


def build_fallback_kaggle_audio_artifact(source_hash: str, duration: float, reason: str) -> dict:
    return {
        "schema_version": "audio-artifact-v1",
        "analyzer_version": KAGGLE_EXTRACTOR_VERSION,
        "source_hash": source_hash,
        "duration_seconds": _round_time(duration),
        "analysis_mode": "fallback_unanalyzed_audio",
        "is_fallback": True,
        "beat_grid": [],
        "downbeats": [],
        "onsets": [],
        "energy": {"source": "fallback_unknown", "window_seconds": WINDOW_SECONDS, "windows": []},
        "sections": [{"start_seconds": 0.0, "end_seconds": _round_time(duration), "label": "unknown", "confidence": 0.0, "source": "fallback"}],
        "sfx_events": [],
        "voice_music_separation": {"source": "unavailable", "voice_stems": [], "music_stems": []},
        "ducking_envelope": {"source": "unavailable", "points": []},
        "warnings": [
            reason,
            "fallback_audio_artifact",
            "sfx_detection_unavailable",
            "voice_music_separation_unavailable",
            "ducking_unavailable",
        ],
    }


def _mixed_audio_energy_windows(y, sr: int, window_seconds: float) -> list[dict]:
    window_size = max(1, round(float(sr) * window_seconds))
    windows = []
    for start_index in range(0, len(y), window_size):
        end_index = min(start_index + window_size, len(y))
        segment = y[start_index:end_index]
        rms = float(np.sqrt(np.mean(segment**2))) if len(segment) else 0.0
        windows.append({
            "start_seconds": _round_time(start_index / float(sr)),
            "end_seconds": _round_time(end_index / float(sr)),
            "rms": _round_time(rms),
            "music_energy": _round_time(rms),
            "vocal_energy": _round_time(rms),
        })
    return windows


def _artifact_energy_curve(audio_artifact: dict):
    values = [
        _artifact_number(window.get("rms")) or 0.0
        for window in audio_artifact.get("energy", {}).get("windows", [])
    ]
    if not values:
        return np.array([])
    arr = np.array(values, dtype=float)
    return arr / (arr.max() + 1e-9)


def _artifact_window_rms(audio_artifact: dict, start: float, end: float) -> float:
    return max(_artifact_window_values(audio_artifact, start, end, "rms"), default=0.0)


# ============================================================================
# PER-FAMILY EXTRACTORS  (each returns its Pydantic model)
# ============================================================================

def extract_camera(frames, flow_mag, face_box: Optional[FaceBox], prev_face_box: Optional[FaceBox]):
    """face_box / prev_face_box are SINGLE boxes (x,y,w,h) or None - NOT lists."""
    mag = _b(flow_mag, 0, 8)
    movement_class = ("static" if flow_mag < 1.0 else "handheld_shake"
                      if 1.0 <= flow_mag < 3.0 else "slow_zoom_in" if flow_mag < 6.0 else "pan")
    # face-box velocity: single-box arithmetic. box=(x,y,w,h).
    if face_box is not None and prev_face_box is not None:
        dx = abs(face_box[0] - prev_face_box[0])   # x delta
        dy = abs(face_box[1] - prev_face_box[1])   # y delta
        fbv = _b(dx + dy, 0, 60)
    else:
        fbv = EnergyBucket.low  # no detectable face motion
    # crop tightness from face size relative to frame
    if frames and face_box is not None:
        fh, fw = frames[0].shape[:2]
        fx, fy, bw, bh = face_box
        ratio = (bw * bh) / (fw * fh)
        tight = "tight_head" if ratio > 0.18 else "medium" if ratio > 0.06 else "wide"
    else:
        tight = "full_body"
    return CameraFeatures(
        movement_class=movement_class, movement_magnitude=mag,
        face_box_velocity=fbv, momentum_direction="none",
        crop_tightness=tight,
    )

def extract_typography(frames, window_idx, text_cache):
    """text_cache: dict keyed by window_idx -> (texts, zones)."""
    texts, zones = text_cache.get(window_idx, ([], []))
    has = len(texts) > 0
    zone = zones[0] if zones else "none"
    # role inference (heuristic on text content)
    joined = " ".join(texts).upper()
    if any(k in joined for k in ["JOIN", "GET", "TRY", "FREE", "CLICK", "LINK", "BIO"]):
        role = "cta"
    elif len(texts) == 1 and len(texts[0].split()) <= 3 and zone == "center":
        role = "title_card"
    elif zone == "lower_third":
        role = "lower_third"
    elif texts:
        role = "caption"
    else:
        role = "none"
    occ = _b(sum(len(t) for t in texts) / 100.0, 0, 5) if has else EnergyBucket.low
    return TypographyFeatures(
        has_text=has, role=role, placement_zone=zone,
        font_weight="bold" if has else "none",
        occupancy_bucket=occ,
    )

def extract_motion_graphics(frames):
    if not frames: return MotionGraphicsFeatures()
    f = frames[len(frames)//2]
    ed = edge_density(f); cv = color_variance(f)
    # screen-recording heuristic: very high edge density + low color variance (UI)
    has_sr = ed > 35 and cv < 40
    has_viz = ed > 30 and cv > 60  # chart-like
    has_asset = cv > 55  # inserted colorful image
    layers = int(has_sr) + int(has_viz) + int(has_asset)
    return MotionGraphicsFeatures(
        has_screen_recording=has_sr, has_data_viz=has_viz, has_image_asset=has_asset,
        overlay_layer_count=min(layers, 4),
    )

def extract_composition(frames, face_box: Optional[FaceBox]):
    """face_box is a SINGLE box (x,y,w,h) or None."""
    if not frames: return CompositionFeatures(
        speaker_position="absent", negative_space_ratio=EnergyBucket.low,
        background_type="real_scene", depth_of_field="deep", subject_scale="medium")
    f = frames[0]; h, w = f.shape[:2]
    if face_box is not None:
        fx, fy, bw, bh = face_box
        cx = fx + bw / 2
        pos = "left" if cx < w*0.4 else "right" if cx > w*0.6 else "center"
        scale = "large" if bw > w*0.4 else "medium" if bw > w*0.2 else "small"
    else:
        pos = "absent"; scale = "medium"
    # negative space: fraction of low-edge area
    g = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
    nsr = float((g < 25).mean())
    return CompositionFeatures(
        speaker_position=pos, negative_space_ratio=_b(nsr, 0, 0.6),
        background_type="screenshot" if edge_density(f) > 35 and color_variance(f) < 40
                        else "real_scene",
        depth_of_field="shallow" if face_box is not None else "deep", subject_scale=scale,
    )

def extract_transitions(scene_starts, window_start, window_end, beat_times):
    """Find a scene cut within this window; check beat alignment."""
    cut = next((s for s in scene_starts if window_start <= s < window_end), None)
    if cut is None:
        return TransitionFeatures()
    # nearest beat
    if beat_times is not None and len(beat_times):
        nearest = beat_times[np.argmin(np.abs(beat_times - cut))]
        diff = abs(nearest - cut)
        synced = diff < 0.08
        offset = "on" if diff < 0.05 else "early" if nearest > cut else "late"
    else:
        synced, offset = False, "on"
    return TransitionFeatures(has_audio_synced_cut=synced, timing_offset_bucket=offset)

def _default_audio():
    return AudioFeatures(
        music_energy=EnergyBucket.low,
        vocal_energy=EnergyBucket.low,
        beat_proximity="off_beat",
        spectral_brightness=EnergyBucket.low,
        transient_density=EnergyBucket.low,
    )


def audio_artifact_beat_times(audio_artifact):
    """Return analyzed artifact beat times; fallback grids are not training facts."""
    if not audio_artifact or audio_artifact.get("is_fallback"):
        return np.array([])
    times = []
    for beat in audio_artifact.get("beat_grid", []):
        value = _artifact_number(beat.get("time_seconds"))
        if value is not None:
            times.append(value)
    return np.array(times, dtype=float)


def extract_audio_from_artifact(audio_artifact, start, end):
    if audio_artifact.get("is_fallback"):
        return _default_audio()

    span = max(end - start, 1e-9)
    energy_values = _artifact_window_values(audio_artifact, start, end, "rms")
    music_values = _artifact_window_values(audio_artifact, start, end, "music_energy")
    vocal_values = _artifact_window_values(audio_artifact, start, end, "vocal_energy")
    music_basis = music_values or energy_values
    max_music = max(music_basis, default=0.0)
    min_energy = min(energy_values, default=0.0)
    sfx_events = _artifact_events_in_window(audio_artifact.get("sfx_events", []), start, end)
    onsets = _artifact_events_in_window(audio_artifact.get("onsets", []), start, end)

    return AudioFeatures(
        sfx_class=_artifact_sfx_class(sfx_events),
        sfx_count=min(len(sfx_events), 4),
        music_presence=max_music > 0.04,
        music_energy=_b(max_music, 0.01, 0.25),
        beat_proximity=_artifact_beat_proximity(audio_artifact, start, end),
        ducking_active=_artifact_ducking_active(audio_artifact, start, end),
        has_silence_gap=bool(energy_values) and min_energy < 0.005,
        vocal_energy=_b(max(vocal_values, default=0.0), 0.01, 0.25),
        spectral_brightness=EnergyBucket.low,
        transient_density=_b(len(onsets) / span, 0, 3.0),
    )


def _artifact_window_values(audio_artifact, start, end, key):
    values = []
    for window in audio_artifact.get("energy", {}).get("windows", []):
        if not _artifact_spans_overlap(window.get("start_seconds"), window.get("end_seconds"), start, end):
            continue
        value = _artifact_number(window.get(key))
        if value is not None:
            values.append(value)
    return values


def _artifact_events_in_window(events, start, end):
    return [
        event for event in events
        if start <= float(event.get("time_seconds", -1.0)) < end
    ]


def _artifact_sfx_class(events):
    for event in events:
        label = event.get("class") or event.get("label") or event.get("sfx_class")
        if label:
            return str(label)
    return "none"


def _artifact_beat_proximity(audio_artifact, start, end):
    beat_times = audio_artifact_beat_times(audio_artifact)
    if not len(beat_times):
        return "off_beat"
    midpoint = (start + end) / 2
    return "on_beat" if np.min(np.abs(beat_times - midpoint)) < 0.1 else "off_beat"


def _artifact_ducking_active(audio_artifact, start, end):
    points = audio_artifact.get("ducking_envelope", {}).get("points", [])
    for point in _artifact_events_in_window(points, start, end):
        gain_db = _artifact_number(point.get("gain_db"))
        gain = _artifact_number(point.get("gain"))
        if gain_db is not None and gain_db < -0.5:
            return True
        if gain is not None and gain < 0.95:
            return True
    return False


def _artifact_spans_overlap(span_start, span_end, window_start, window_end):
    start = _artifact_number(span_start)
    end = _artifact_number(span_end)
    if start is None or end is None:
        return False
    return start < window_end and end > window_start


def _artifact_number(value):
    if isinstance(value, (int, float)):
        return float(value)
    return None


def extract_audio(y, sr, start, end, beat_times, onset_env, audio_artifact=None):
    if audio_artifact is not None:
        return extract_audio_from_artifact(audio_artifact, start, end)
    if y is None or not HAS_LIBROSA:
        return _default_audio()
    a0 = int(start*sr); a1 = int(end*sr)
    seg = y[a0:a1] if a1 <= len(y) else y[a0:]
    if len(seg) < 2:
        return _default_audio()
    rms = float(np.sqrt(np.mean(seg**2)))
    # spectral centroid can warn/return nan on near-silent segments - guard it
    try:
        spec = float(np.mean(librosa.feature.spectral_centroid(y=seg, sr=sr)))
        if not np.isfinite(spec): spec = 0.0
    except Exception:
        spec = 0.0
    # transient density: onsets in window
    if onset_env is not None and len(onset_env):
        fps_onset = len(onset_env) / (len(y)/sr)
        i0 = int(start*fps_onset); i1 = int(end*fps_onset)
        sl = onset_env[i0:i1]
        td = float(np.mean(sl)) if len(sl) else 0.0
        if not np.isfinite(td): td = 0.0
    else:
        td = 0.0
    # beat proximity of window midpoint
    if beat_times is not None and len(beat_times):
        mid = (start+end)/2
        bp = "on_beat" if np.min(np.abs(beat_times-mid)) < 0.1 else "off_beat"
    else:
        bp = "off_beat"
    music = rms > 0.04  # crude music-presence threshold
    return AudioFeatures(
        sfx_class="none", music_presence=music,
        music_energy=_b(rms, 0.01, 0.25), vocal_energy=_b(rms, 0.01, 0.25),
        spectral_brightness=_b(spec, 500, 4000), transient_density=_b(td, 0, 1),
        beat_proximity=bp, has_silence_gap=(rms < 0.005),
    )

def extract_temporal(window_idx, total_windows, cut_density_per_window, energy_curve):
    pos = window_idx / max(1, total_windows)
    zone = ("hook" if pos < 0.1 else "intro" if pos < 0.25 else "body"
            if pos < 0.75 else "climax" if pos < 0.9 else "outro")
    cd = _b(cut_density_per_window, 0, 1.0)
    # trend from energy curve slope
    if len(energy_curve) > 2 and window_idx < len(energy_curve):
        local = energy_curve[max(0,window_idx-3):window_idx+3]
        slope = np.polyfit(range(len(local)), local, 1)[0] if len(local) > 1 else 0
        trend = "rising" if slope > 0.02 else "falling" if slope < -0.02 else "steady"
    else:
        trend = "steady"
    is_climax = zone == "climax"
    is_restraint = zone in ("intro", "outro")
    return TemporalFeatures(
        position_in_video=zone, pacing_density=cd,
        is_climax_window=is_climax, is_restraint_window=is_restraint,
        sequence_trend=trend, novelty_level=EnergyBucket.mid,
        surprise_budget_state=EnergyBucket.mid,
    )

def extract_speaker(face_box, frames, rms):
    """face_box/frames reserved for future face-emotion + gaze hooks; rms drives vocal state today."""
    speaking = rms > 0.01
    conf = Confidence.assertive if rms > 0.06 else Confidence.neutral if rms > 0.02 else Confidence.uncertain
    return SpeakerVocalFeatures(
        is_speaking=speaking, confidence=conf,
        gaze_target="lens",  # refine later with iris landmarks
    )


# ============================================================================
# GENRE + GENOME DIMENSION DERIVATION
# ============================================================================

def derive_genre(comp, mg) -> SegmentGenre:
    """Classify the window's genre so tutorials can be FILTERED before training.

    Tutorial walkthrough = screen-recording UI with NO speaker (pure app demo).
    A screen-recording WITH a speaker (facecam over a tutorial) is still Joseph's
    editorial craft, so it is NOT filtered out. Only speaker-absent UI segments
    are treated as non-editorial noise.
    """
    if mg.has_screen_recording and comp.speaker_position == "absent":
        return SegmentGenre.tutorial_walkthrough
    if comp.speaker_position == "absent":
        return SegmentGenre.broll_only
    return SegmentGenre.editorial

def derive_genome(cam, typo, mg, comp, aud, tmp) -> tuple[Intensity, VisualDensity, MotionEnergy, EditorialRole]:
    # intensity from text + overlays + motion
    busyness = int(typo.has_text) + mg.overlay_layer_count + (1 if aud.music_presence else 0)
    intensity = (Intensity.minimal if busyness == 0 else Intensity.restrained if busyness <= 1
                 else Intensity.balanced if busyness <= 2 else Intensity.expressive)
    # visual density
    vd = (VisualDensity.quiet if not typo.has_text and mg.overlay_layer_count == 0
          else VisualDensity.loud if mg.overlay_layer_count >= 2 or typo.occupancy_bucket == EnergyBucket.high
          else VisualDensity.balanced)
    # motion energy from camera + transient density
    me = (MotionEnergy.none if cam.movement_class == "static" and aud.transient_density == EnergyBucket.low
          else MotionEnergy.active if cam.movement_class in ("pan","handheld_shake") or aud.transient_density == EnergyBucket.high
          else MotionEnergy.subtle)
    # editorial role from temporal zone
    role_map = {"hook": EditorialRole.setup, "intro": EditorialRole.setup, "body": EditorialRole.explain,
                "climax": EditorialRole.payoff, "outro": EditorialRole.tension}
    role = role_map.get(tmp.position_in_video, EditorialRole.explain)
    return intensity, vd, me, role


# ============================================================================
# MAIN PER-VIDEO PIPELINE
# ============================================================================

def extract_trajectory(
    path: str,
    video_id: str = None,
    audio_artifact: Optional[dict] = None,
    window_indices: Optional[list[int]] = None,
    scene_starts: Optional[list[float]] = None,
    frame_sample_count: int = 4,
) -> Trajectory:
    meta = get_video_meta(path)
    fps, dur = meta["fps"], meta["duration"]
    res = f"{meta['w']}x{meta['h']}"
    vid = video_id or file_hash(path)

    # audio (optional family)
    if audio_artifact is not None:
        y, sr = None, 22050
        beat_times, onset_env, ec_norm = audio_artifact_beat_times(audio_artifact), None, _artifact_energy_curve(audio_artifact)
    elif HAS_LIBROSA:
        y, sr, _ = load_audio(path)
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beats, sr=sr)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        energy_curve = librosa.feature.rms(y=y)[0]
        ec_norm = energy_curve / (energy_curve.max() + 1e-9)
    else:
        y, sr = None, 22050
        beat_times, onset_env, ec_norm = np.array([]), None, np.array([])
    total_windows = max(1, int(dur / WINDOW_SECONDS))
    if scene_starts is None:
        # scenes (optional family)
        scenes = detect_scenes(path)
        scene_starts = [s for s, _ in scenes]
    else:
        scene_starts = list(scene_starts)

    if window_indices is None:
        selected_windows = list(range(total_windows))
        windowing_mode = "fixed_1s"
    else:
        selected_windows = sorted({wi for wi in window_indices if 0 <= wi < total_windows})
        if not selected_windows:
            selected_windows = [0]
        windowing_mode = f"sparse_fixed_1s:{len(selected_windows)}/{total_windows}"

    windows = []
    prev_face: Optional[FaceBox] = None
    failed_windows = 0
    sample_count = max(1, int(frame_sample_count))

    print(f"  extracting {len(selected_windows)}/{total_windows} windows...", end=" ", flush=True)
    for wi in selected_windows:
        try:
            s, e = wi * WINDOW_SECONDS, (wi + 1) * WINDOW_SECONDS
            frames = sample_window_frames(path, s, e, fps, n=sample_count)
            if not frames:
                # nothing to decode for this window - skip rather than abort the video
                failed_windows += 1
                continue
            flow = optical_flow_mag(frames)
            fb = face_boxes(frames)
            primary: Optional[FaceBox] = fb[0] if fb else None
            # OCR (cached once per window)
            texts, zones = ocr_text(frames)

            cam = extract_camera(frames, flow, primary, prev_face)
            typo = extract_typography(frames, wi, {wi: (texts, zones)})
            mg = extract_motion_graphics(frames)
            comp = extract_composition(frames, primary)
            trans = extract_transitions(scene_starts, s, e, beat_times)
            aud = extract_audio(y, sr, s, e, beat_times, onset_env, audio_artifact=audio_artifact)
            cd_pw = len([c for c in scene_starts if s <= c < e])
            tmp = extract_temporal(wi, total_windows, cd_pw, ec_norm)
            if y is not None and int(e*sr) <= len(y):
                seg = y[int(s*sr):int(e*sr)]
                rms_w = float(np.sqrt(np.mean(seg**2))) if len(seg) else 0.0
            elif audio_artifact is not None:
                rms_w = _artifact_window_rms(audio_artifact, s, e)
            else:
                rms_w = 0.0
            spk = extract_speaker(primary, frames, rms_w)

            genre = derive_genre(comp, mg)
            intensity, vd, me, role = derive_genome(cam, typo, mg, comp, aud, tmp)

            windows.append(TimelineWindow(
                index=wi, start_seconds=s, end_seconds=e,
                segment_genre=genre, intensity=intensity, visual_density=vd,
                motion_energy=me, editorial_role=role,
                camera=cam, typography=typo, motion_graphics=mg, composition=comp,
                transitions=trans, audio=aud, temporal=tmp, speaker_vocal=spk,
            ))
            prev_face = primary
        except Exception as ex:
            failed_windows += 1
            print(f"\n  WARN: window {wi} failed ({type(ex).__name__}: {ex}); skipped.",
                  end=" ", flush=True)
            continue
    print("done.")

    if not windows:
        raise ValueError(f"no windows could be extracted from {path} (duration={dur:.1f}s)")

    notes = None
    if failed_windows:
        notes = (f"{failed_windows}/{total_windows} windows skipped during extraction "
                 f"(decoded={len(windows)}).")

    return Trajectory(
        metadata=TrajectoryMetadata(
            extraction_mode=ExtractionMode.finals_only,
            source_hash=file_hash(path),
            corpus_id=os.environ.get("PROMETHEUS_CORPUS_ID", "golden-20-local"),
            edited_video_id=vid,
            vehicle=os.environ.get("PROMETHEUS_VEHICLE", "talking_head"),
            style_label=os.environ.get("PROMETHEUS_STYLE_LABEL", "joseph"),
            featureVersion="trajectory-features-v1",
            extracted_at_utc=datetime.now(timezone.utc).isoformat(),
            extractor_version="0.2.0",
            duration_seconds=dur, fps=fps, frame_count=meta["frames"], resolution=res,
            windowing_mode=windowing_mode,
            notes=notes,
        ),
        windows=windows,
    )


# ============================================================================
# BATCH DRIVER + AUDIT
# ============================================================================

def run_batch(input_dir: str = None, output_dir: str = None):
    """Batch-extract videos and emit the Joseph Kaggle artifact contract.

    The returned artifact index is the handoff back to the local repo. IRL must
    validate this index before any trajectory is allowed into training.
    """
    in_dir = input_dir or os.environ.get("PROMETHEUS_INPUT_DIR", INPUT_DIR)
    out_dir = output_dir or os.environ.get("PROMETHEUS_OUTPUT_DIR", OUTPUT_DIR)
    if not os.path.exists(in_dir):
        print(f"NO INPUT: '{in_dir}' not found. Upload Joseph videos to a Kaggle dataset and pass its mount path to run_batch(...).")
        return None
    os.makedirs(out_dir, exist_ok=True)

    videos = discover_video_paths(in_dir)
    audit_packets = load_audit_event_packets(in_dir)
    print(f"Found {len(videos)} videos in {in_dir}.")
    print(f"Found {len(audit_packets)} manual audit event packet(s).")

    generated_at = datetime.now(timezone.utc).isoformat()
    artifact_index = {
        "schema_version": ARTIFACT_CONTRACT_VERSION,
        "extractor_version": KAGGLE_EXTRACTOR_VERSION,
        "feature_version": "trajectory-features-v1",
        "generated_at_utc": generated_at,
        "input_dir": in_dir,
        "output_dir": out_dir,
        "training_gate": "validate_locally_before_irl_training",
        "required_artifacts": [
            "trajectory",
            "audio_artifact",
            "text_evidence",
            "frame_evidence",
            "motion_cut_evidence",
        ],
        "videos": [],
        "failures": [],
    }
    editorial_total, tutorial_total = 0, 0

    for video_index, path in enumerate(videos, start=1):
        video_name = os.path.basename(path)
        video_id = _safe_stem(video_name)
        print(f"\n[{video_name}]")
        try:
            meta = get_video_meta(path)
            source_hash = file_hash(path)
            audit_packet, audit_events = events_for_video(audit_packets, path, video_id, video_index)
            scenes = detect_scenes(path)
            audio_artifact = build_audio_artifact_for_video(path, source_hash, meta)
            traj = extract_trajectory(path, video_id=video_id, audio_artifact=audio_artifact)

            trajectory_path = Path(out_dir) / f"{video_id}.trajectory.json"
            audio_path = Path(out_dir) / "audio-artifacts" / f"{video_id}.audio-artifact.json"
            text_path = Path(out_dir) / "text-evidence" / f"{video_id}.text-evidence.json"
            frame_summary_path = Path(out_dir) / "frame-evidence" / video_id / "frame-evidence.json"
            motion_path = Path(out_dir) / "motion-cut-evidence" / f"{video_id}.motion-cut-evidence.json"

            frame_evidence = write_frame_evidence(path, video_id, audit_events, out_dir)
            text_evidence = build_text_evidence(path, video_id, audit_events)
            motion_evidence = build_motion_cut_evidence(path, video_id, scenes, audit_events)

            _write_json(trajectory_path, traj.model_dump())
            _write_json(audio_path, audio_artifact)
            _write_json(text_path, text_evidence)
            _write_json(frame_summary_path, frame_evidence)
            _write_json(motion_path, motion_evidence)

            ed = sum(1 for w in traj.windows if w.segment_genre == SegmentGenre.editorial)
            tu = sum(1 for w in traj.windows if w.segment_genre == SegmentGenre.tutorial_walkthrough)
            editorial_total += ed; tutorial_total += tu

            warnings = []
            warnings.extend(audio_artifact.get("warnings", []))
            warnings.extend(text_evidence.get("warnings", []))
            warnings.extend(motion_evidence.get("warnings", []))
            if audit_packet is None:
                warnings.append("manual_audit_packet_not_matched")

            artifact_index["videos"].append({
                "video_id": video_id,
                "source_hash": source_hash,
                "feature_version": "trajectory-features-v1",
                "extractor_version": KAGGLE_EXTRACTOR_VERSION,
                "source_video_path": path,
                "duration_seconds": _round_time(meta["duration"]),
                "fps": meta["fps"],
                "resolution": f"{meta['w']}x{meta['h']}",
                "audit_reference_id": audit_packet.get("referenceId") if audit_packet else None,
                "audit_event_count": len(audit_events),
                "editorial_windows": ed,
                "tutorial_windows": tu,
                "artifacts": {
                    "trajectory": _relative_to_output(trajectory_path, out_dir),
                    "audio_artifact": _relative_to_output(audio_path, out_dir),
                    "text_evidence": _relative_to_output(text_path, out_dir),
                    "frame_evidence": _relative_to_output(frame_summary_path, out_dir),
                    "motion_cut_evidence": _relative_to_output(motion_path, out_dir),
                },
                "warnings": sorted(set(warnings)),
            })
            print(f"  saved contract artifacts | windows={len(traj.windows)} editorial={ed} tutorial={tu} events={len(audit_events)}")
        except Exception as ex:
            failure = {
                "video_id": video_id,
                "source_video_path": path,
                "error": f"{type(ex).__name__}: {ex}",
            }
            artifact_index["failures"].append(failure)
            print(f"  FAILED: {failure['error']}")

    failure_path = Path(out_dir) / "extraction-failures.json"
    index_path = Path(out_dir) / "artifact-index.json"
    _write_json(failure_path, {
        "schema_version": "kaggle-extraction-failures-v1",
        "generated_at_utc": generated_at,
        "failure_count": len(artifact_index["failures"]),
        "failures": artifact_index["failures"],
    })
    artifact_index["failure_report"] = _relative_to_output(failure_path, out_dir)
    _write_json(index_path, artifact_index)

    print(f"\n=== BATCH DONE ===")
    print(f"Artifact index: {index_path}")
    print(f"Total editorial windows: {editorial_total}  (these are what training uses after validation)")
    print(f"Total tutorial windows:  {tutorial_total}  (filtered OUT)")
    print(f"Failures: {len(artifact_index['failures'])}")
    denominator = editorial_total + tutorial_total + 1e-9
    print(f"Ratio editorial: {editorial_total/denominator:.0%}")
    return artifact_index

def audit():
    """Program 20 feature-count gate."""
    families = [("camera",CameraFeatures),("typography",TypographyFeatures),
                ("motion_graphics",MotionGraphicsFeatures),("composition",CompositionFeatures),
                ("transitions",TransitionFeatures),("audio",AudioFeatures),
                ("temporal",TemporalFeatures),("speaker_vocal",SpeakerVocalFeatures)]
    total = sum(len(m.model_fields) for _, m in families) + 4
    print(f"Feature audit: {total} features/window | Program 20 target 60-80 -> "
          f"{'PASS' if 60<=total<=80 else 'FAIL'}")

if __name__ == "__main__":
    audit()
    run_batch()
