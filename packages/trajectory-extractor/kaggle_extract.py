# ============================================================================
# PROMETHEUS TRAJECTORY EXTRACTOR — Kaggle single-cell edition
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
# ============================================================================

import cv2, librosa, json, os, re, hashlib, subprocess
import numpy as np
import mediapipe as mp
from pathlib import Path
from enum import Enum
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass
from pydantic import BaseModel, Field

# Optional imports (each degrades gracefully if missing)
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
    print("WARN: easyocr not available — typography fields will be heuristic-only.")

from scenedetect import detect, ContentDetector


# ============================================================================
# SCHEMA (inlined so the cell is self-contained on Kaggle)
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

class TrajectoryMetadata(BaseModel):
    extraction_mode: ExtractionMode
    source_video_id: Optional[str] = None
    edited_video_id: str
    editor_label: str = "joseph"
    extracted_at_utc: str
    extractor_version: str = "0.1.0"
    duration_seconds: float
    fps: float
    resolution: str
    windowing_mode: str
    notes: Optional[str] = None

class Trajectory(BaseModel):
    schema_version: str = "0.1.0"
    metadata: TrajectoryMetadata
    windows: list[TimelineWindow]

WINDOW_SECONDS = 1.0  # fixed-1s windowing — chosen for cross-video comparability

INPUT_DIR = "/kaggle/input/joseph-video-edits"
OUTPUT_DIR = "/kaggle/working/trajectories"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ============================================================================
# LOW-LEVEL HELPERS (video I/O, audio, OCR, faces, flow)
# ============================================================================

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

def extract_audio(path: str, sr: int = 22050):
    """librosa load; returns (y, sr, duration)."""
    y, sr = librosa.load(path, sr=sr, mono=True)
    return y, sr, len(y) / sr

def detect_scenes(path: str):
    """Returns list of (start_sec, end_sec) scene boundaries via PySceneDetect."""
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
    """Return list of (x,y,w,h) face boxes across frames using MediaPipe."""
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


# ============================================================================
# PER-FAMILY EXTRACTORS  (each returns its Pydantic model)
# ============================================================================

def extract_camera(frames, flow_mag, face_b, prev_face_b):
    mag = _b(flow_mag, 0, 8)
    movement_class = ("static" if flow_mag < 1.0 else "handheld_shake"
                      if 1.0 <= flow_mag < 3.0 else "slow_zoom_in" if flow_mag < 6.0 else "pan")
    # face box velocity
    if face_b and prev_face_b:
        dx = abs(face_b[0][0] - prev_face_b[0][0]); dy = abs(face_b[0][1] - prev_face_b[0][1])
        fbv = _b(dx + dy, 0, 60)
    else:
        fbv = EnergyBucket.none if hasattr(EnergyBucket,'none') else EnergyBucket.low
    # crop tightness from face size
    if frames and face_b:
        fh, fw = frames[0].shape[:2]
        ratio = (face_b[0][2] * face_b[0][3]) / (fw * fh)
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

def extract_composition(frames, face_b):
    if not frames: return CompositionFeatures(
        speaker_position="absent", negative_space_ratio=EnergyBucket.low,
        background_type="real_scene", depth_of_field="deep", subject_scale="medium")
    f = frames[0]; h, w = f.shape[:2]
    if face_b:
        cx = face_b[0][0] + face_b[0][2]/2
        pos = "left" if cx < w*0.4 else "right" if cx > w*0.6 else "center"
        scale = "large" if face_b[0][2] > w*0.4 else "medium" if face_b[0][2] > w*0.2 else "small"
    else:
        pos = "absent"; scale = "medium"
    # negative space: fraction of low-edge area
    g = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
    nsr = float((g < 25).mean())
    return CompositionFeatures(
        speaker_position=pos, negative_space_ratio=_b(nsr, 0, 0.6),
        background_type="screenshot" if edge_density(f) > 35 and color_variance(f) < 40
                        else "real_scene",
        depth_of_field="shallow" if face_b else "deep", subject_scale=scale,
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

def extract_audio(y, sr, start, end, beat_times, onset_env):
    a0 = int(start*sr); a1 = int(end*sr)
    seg = y[a0:a1] if a1 <= len(y) else y[a0:]
    if len(seg) < 2:
        return AudioFeatures(music_energy=EnergyBucket.low, vocal_energy=EnergyBucket.low,
                             spectral_brightness=EnergyBucket.low, transient_density=EnergyBucket.low)
    rms = float(np.sqrt(np.mean(seg**2)))
    spec = float(np.mean(librosa.feature.spectral_centroid(y=seg, sr=sr)))
    # transient density: onsets in window
    if onset_env is not None and len(onset_env):
        fps_onset = len(onset_env) / (len(y)/sr)
        i0 = int(start*fps_onset); i1 = int(end*fps_onset)
        td = float(np.mean(onset_env[i0:i1])) if i1 <= len(onset_env) else 0.0
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

def extract_speaker(face_b, frames, rms):
    speaking = rms > 0.01
    conf = Confidence.assertive if rms > 0.06 else Confidence.neutral if rms > 0.02 else Confidence.uncertain
    return SpeakerVocalFeatures(
        is_speaking=speaking, confidence=conf,
        gaze_target="lens",  # refine later with iris landmarks
    )


# ============================================================================
# GENRE + GENOME DIMENSION DERIVATION
# ============================================================================

def derive_genre(comp, mg, speaker) -> SegmentGenre:
    """Tutorial filter: screen-recording UI + no speaker = tutorial_walkthrough."""
    if mg.has_screen_recording and speaker.speaker_position if hasattr(speaker,'speaker_position') else comp.speaker_position == "absent":
        return SegmentGenre.tutorial_walkthrough
    if comp.speaker_position == "absent" and comp.background_type == "real_scene":
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

def extract_trajectory(path: str, video_id: str = None) -> Trajectory:
    meta = get_video_meta(path)
    fps, dur = meta["fps"], meta["duration"]
    res = f"{meta['w']}x{meta['h']}"
    vid = video_id or file_hash(path)

    # audio
    y, sr, _ = extract_audio(path)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beats, sr=sr)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    energy_curve = librosa.feature.rms(y=y)[0]
    # normalize energy curve to 0-1 for trend math
    ec_norm = energy_curve / (energy_curve.max() + 1e-9)

    # scenes
    scenes = detect_scenes(path)
    scene_starts = [s for s, _ in scenes]

    total_windows = max(1, int(dur / WINDOW_SECONDS))
    windows = []
    prev_face = None

    print(f"  extracting {total_windows} windows...", end=" ", flush=True)
    for wi in range(total_windows):
        s, e = wi * WINDOW_SECONDS, (wi + 1) * WINDOW_SECONDS
        frames = sample_window_frames(path, s, e, fps, n=4)
        if not frames:
            continue
        flow = optical_flow_mag(frames)
        fb = face_boxes(frames)
        # OCR (cached once per window)
        texts, zones = ocr_text(frames)

        cam = extract_camera(frames, flow, (fb[0] if fb else None), prev_face)
        typo = extract_typography(frames, wi, {wi: (texts, zones)})
        mg = extract_motion_graphics(frames)
        comp = extract_composition(frames, (fb[0] if fb else None))
        trans = extract_transitions(scene_starts, s, e, beat_times)
        aud = extract_audio(y, sr, s, e, beat_times, onset_env)
        cd_pw = len([c for c in scene_starts if s <= c < e])
        tmp = extract_temporal(wi, total_windows, cd_pw, ec_norm)
        spk = extract_speaker((fb[0] if fb else None), frames,
                              float(np.sqrt(np.mean(y[int(s*sr):int(e*sr)]**2))) if int(e*sr) <= len(y) else 0.0)

        genre = derive_genre(comp, mg, spk)
        intensity, vd, me, role = derive_genome(cam, typo, mg, comp, aud, tmp)

        windows.append(TimelineWindow(
            index=wi, start_seconds=s, end_seconds=e,
            segment_genre=genre, intensity=intensity, visual_density=vd,
            motion_energy=me, editorial_role=role,
            camera=cam, typography=typo, motion_graphics=mg, composition=comp,
            transitions=trans, audio=aud, temporal=tmp, speaker_vocal=spk,
        ))
        prev_face = (fb[0] if fb else None)
    print("done.")

    return Trajectory(
        metadata=TrajectoryMetadata(
            extraction_mode=ExtractionMode.finals_only,
            edited_video_id=vid,
            editor_label="joseph",
            extracted_at_utc=datetime.now(timezone.utc).isoformat(),
            duration_seconds=dur, fps=fps, resolution=res,
            windowing_mode="fixed_1s",
        ),
        windows=windows,
    )


# ============================================================================
# BATCH DRIVER + AUDIT
# ============================================================================

def run_batch():
    if not os.path.exists(INPUT_DIR):
        print(f"NO INPUT: upload your Joseph videos to a Kaggle dataset and set INPUT_DIR to its path.")
        return
    videos = [f for f in os.listdir(INPUT_DIR) if f.lower().endswith((".mp4", ".mov", ".mkv", ".webm"))]
    print(f"Found {len(videos)} videos.")
    editorial_total, tutorial_total = 0, 0
    for v in sorted(videos):
        path = os.path.join(INPUT_DIR, v)
        print(f"\n[{v}]")
        try:
            traj = extract_trajectory(path, video_id=v.rsplit(".", 1)[0])
            out = os.path.join(OUTPUT_DIR, v.rsplit(".", 1)[0] + ".trajectory.json")
            with open(out, "w") as f:
                f.write(traj.model_dump_json(indent=2))
            ed = sum(1 for w in traj.windows if w.segment_genre == SegmentGenre.editorial)
            tu = sum(1 for w in traj.windows if w.segment_genre == SegmentGenre.tutorial_walkthrough)
            editorial_total += ed; tutorial_total += tu
            print(f"  saved {out} | {len(traj.windows)} windows | editorial={ed} tutorial={tu}")
        except Exception as ex:
            print(f"  FAILED: {ex}")
    print(f"\n=== BATCH DONE ===")
    print(f"Total editorial windows: {editorial_total}  (these are what training uses)")
    print(f"Total tutorial windows:  {tutorial_total}  (filtered OUT)")
    print(f"Ratio editorial: {editorial_total/(editorial_total+tutorial_total+1e-9):.0%}")

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
