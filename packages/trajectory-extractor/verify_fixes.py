"""Local verification harness for the revamped kaggle_extract.py.

Runs WITHOUT a GPU, WITHOUT a video, WITHOUT librosa/mediapipe/easyocr.
cv2 + pydantic + numpy are all it needs (all present locally).

It loads the ACTUAL module file (not a copy) via importlib - because the
package dir has a hyphen it isn't importable the normal way - and exercises
the pure-logic paths that previously crashed or produced wrong output.
"""
import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("kaggle_extract", HERE / "kaggle_extract.py")
kx = importlib.util.module_from_spec(spec)
sys.modules["kaggle_extract"] = kx
spec.loader.exec_module(kx)

import numpy as np

passed, failed = [], []
def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f" - {detail}" if detail and not cond else ""))

# Synthetic frames: 4 frames, 720x1280 RGB (portrait, Joseph's format).
def synth_frames(w=720, h=1280, n=4):
    rng = np.random.default_rng(0)
    return [rng.integers(0, 255, (h, w, 3), dtype=np.uint8) for _ in range(n)]

frames = synth_frames()
box_a = (120, 80, 200, 260)    # a plausible face box (x,y,w,h) in px
box_b = (128, 84, 200, 260)    # slightly moved -> exercises velocity math

print("=" * 70)
print("1. FACE-BOX INDEXING - previously TypeError at window 1")
print("=" * 70)
# extract_camera: the old code did face_b[0][0] on a single box -> crash.
try:
    cam = kx.extract_camera(frames, flow_mag=2.0, face_box=box_a, prev_face_box=box_b)
    check("extract_camera with two consecutive boxes (no crash)", True)
    check("  crop_tightness classified", cam.crop_tightness in ("tight_head","medium","wide","full_body"))
    check("  face_box_velocity bucketed", cam.face_box_velocity in kx.EnergyBucket)
except Exception as e:
    check("extract_camera with two consecutive boxes (no crash)", False, f"{type(e).__name__}: {e}")

# The None path (no face) must also work.
try:
    cam_n = kx.extract_camera(frames, flow_mag=0.5, face_box=None, prev_face_box=None)
    check("extract_camera with no face (None path)", cam_n.crop_tightness == "full_body")
except Exception as e:
    check("extract_camera with no face (None path)", False, f"{type(e).__name__}: {e}")

# extract_composition: old code did face_b[0][0] + face_b[0][2]/2 on a single box -> crash.
try:
    comp = kx.extract_composition(frames, face_box=box_a)
    check("extract_composition with a box (no crash)", True)
    check("  speaker_position classified", comp.speaker_position in ("left","center","right","absent"))
    check("  subject_scale classified", comp.subject_scale in ("small","medium","large"))
    check("  depth_of_field shallow when face present", comp.depth_of_field == "shallow")
except Exception as e:
    check("extract_composition with a box (no crash)", False, f"{type(e).__name__}: {e}")

print()
print("=" * 70)
print("2. derive_genre - tutorial branch was dead code (precedence bug)")
print("=" * 70)
class C: pass
class M: pass
# Case A: screen-recording + speaker ABSENT -> should be tutorial_walkthrough
c, m = C(), M()
c.speaker_position = "absent"; m.has_screen_recording = True
check("screen-rec + no speaker -> tutorial_walkthrough",
      kx.derive_genre(c, m) == kx.SegmentGenre.tutorial_walkthrough)
# Case B: screen-recording + speaker PRESENT -> editorial (facecam tutorial is craft)
c.speaker_position = "center"; m.has_screen_recording = True
check("screen-rec + speaker present -> editorial",
      kx.derive_genre(c, m) == kx.SegmentGenre.editorial)
# Case C: no screen-rec, speaker absent -> broll_only
c.speaker_position = "absent"; m.has_screen_recording = False
check("no screen-rec + no speaker -> broll_only",
      kx.derive_genre(c, m) == kx.SegmentGenre.broll_only)

print()
print("=" * 70)
print("3. EnergyBucket fallback - no more latent 'none' member footgun")
print("=" * 70)
check("EnergyBucket has exactly low/mid/high",
      {e.value for e in kx.EnergyBucket} == {"low","mid","high"})
# _b must never reference a non-existent member
check("_b returns a real bucket for various inputs", all(
    kx._b(v, lo, hi) in kx.EnergyBucket
    for v, lo, hi in [(-1,0,1),(0,0,1),(0.2,0,1),(0.5,0,1),(0.8,0,1),(1.5,0,1),(None,0,1)]
))

print()
print("=" * 70)
print("4. SCHEMA INTEGRITY - a fully-built window must still validate (74 feats)")
print("=" * 70)
from pydantic import ValidationError
cam_full   = kx.extract_camera(frames, 2.0, box_a, box_b)
typo_full  = kx.extract_typography(frames, 0, {0: (["JOIN NOW"], ["lower_third"])})
mg_full    = kx.extract_motion_graphics(frames)
comp_full  = kx.extract_composition(frames, box_a)
trans_full = kx.extract_transitions([], 0.0, 1.0, np.array([]))
aud_full   = kx.extract_audio(None, 22050, 0.0, 1.0, np.array([]), None)  # librosa-absent path
tmp_full   = kx.extract_temporal(0, 30, 0.0, np.array([0.1,0.2,0.3]))
spk_full   = kx.extract_speaker(box_a, frames, 0.05)

genre = kx.derive_genre(comp_full, mg_full)
intensity, vd, me, role = kx.derive_genome(cam_full, typo_full, mg_full, comp_full, aud_full, tmp_full)
try:
    win = kx.TimelineWindow(
        index=0, start_seconds=0.0, end_seconds=1.0,
        segment_genre=genre, intensity=intensity, visual_density=vd,
        motion_energy=me, editorial_role=role,
        camera=cam_full, typography=typo_full, motion_graphics=mg_full,
        composition=comp_full, transitions=trans_full, audio=aud_full,
        temporal=tmp_full, speaker_vocal=spk_full,
    )
    check("TimelineWindow validates with all families populated", True)
except ValidationError as e:
    check("TimelineWindow validates with all families populated", False, str(e).splitlines()[0])

# Feature count per window must stay in Program 20 band.
families = [cam_full, typo_full, mg_full, comp_full, trans_full, aud_full, tmp_full, spk_full]
feat = sum(len(type(f).model_fields) for f in families) + 4
check(f"feature count in 60-80 band (got {feat})", 60 <= feat <= 80)

# Full trajectory (metadata + windows) validates and round-trips through JSON.
from datetime import datetime, timezone
try:
    traj = kx.Trajectory(
        metadata=kx.TrajectoryMetadata(
            extraction_mode=kx.ExtractionMode.finals_only,
            source_hash="sha256:smoke", corpus_id="golden-20-local",
            edited_video_id="smoke", vehicle="talking_head", style_label="joseph",
            featureVersion="trajectory-features-v1",
            extracted_at_utc=datetime.now(timezone.utc).isoformat(),
            extractor_version="0.2.0",
            duration_seconds=30.0, fps=30.0, frame_count=900,
            resolution="720x1280", windowing_mode="fixed_1s",
        ),
        windows=[win],
    )
    js = traj.model_dump_json()
    kx.Trajectory.model_validate_json(js)  # parse back
    check("Trajectory validates + round-trips through JSON", True)
except Exception as e:
    check("Trajectory validates + round-trips through JSON", False, f"{type(e).__name__}: {e}")

print()
print("=" * 70)
print("5. AUDIO LIBROSA-ABSENT PATH - must return sane defaults, not crash")
print("=" * 70)
a = kx.extract_audio(None, 22050, 0.0, 1.0, np.array([]), None)
check("audio defaults to low buckets when librosa absent",
      a.music_energy == a.vocal_energy == a.spectral_brightness == a.transient_density == kx.EnergyBucket.low)

analyzed_artifact = {
    "is_fallback": False,
    "beat_grid": [{"time_seconds": 0.5, "source": "pcm_onset"}],
    "onsets": [
        {"time_seconds": 0.1, "strength": 0.7},
        {"time_seconds": 0.2, "strength": 0.7},
        {"time_seconds": 0.3, "strength": 0.7},
    ],
    "energy": {
        "windows": [
            {
                "start_seconds": 0.0,
                "end_seconds": 1.0,
                "rms": 0.3,
                "music_energy": 0.3,
                "vocal_energy": 0.2,
            }
        ]
    },
    "sfx_events": [{"time_seconds": 0.25, "class": "whoosh"}],
    "ducking_envelope": {"points": [{"time_seconds": 0.25, "gain_db": -8.0}]},
}
aa = kx.extract_audio(None, 22050, 0.0, 1.0, np.array([]), None, audio_artifact=analyzed_artifact)
check("audio artifact path maps analyzed signals into AudioFeatures",
      aa.music_presence and aa.music_energy == kx.EnergyBucket.high
      and aa.beat_proximity == "on_beat" and aa.sfx_class == "whoosh"
      and aa.sfx_count == 1 and aa.ducking_active
      and aa.transient_density == kx.EnergyBucket.high)

fallback_artifact = {
    "is_fallback": True,
    "beat_grid": [{"time_seconds": 0.5, "source": "fallback_bpm"}],
    "energy": {"windows": [{"start_seconds": 0.0, "end_seconds": 1.0, "rms": "unknown"}]},
    "warnings": ["fallback_bpm_grid"],
}
fa = kx.extract_audio(None, 22050, 0.0, 1.0, np.array([]), None, audio_artifact=fallback_artifact)
check("fallback artifact cannot masquerade as analyzed audio",
      not fa.music_presence and fa.music_energy == kx.EnergyBucket.low
      and fa.beat_proximity == "off_beat" and fa.sfx_class == "none"
      and fa.sfx_count == 0 and not fa.ducking_active)

check("analyzed artifact beat grid can feed transition sync",
      kx.audio_artifact_beat_times(analyzed_artifact).tolist() == [0.5]
      and kx.audio_artifact_beat_times(fallback_artifact).tolist() == [])

print()
print("=" * 70)
print("6. LOCAL SPARSE WINDOWS - smoke run must stay bounded")
print("=" * 70)
sys.path.insert(0, str(HERE))
local_spec = importlib.util.spec_from_file_location("run_local_joseph_artifacts", HERE / "run_local_joseph_artifacts.py")
local = importlib.util.module_from_spec(local_spec)
sys.modules["run_local_joseph_artifacts"] = local
local_spec.loader.exec_module(local)
probe_events = [
    {"timeSeconds": [10.2, 12.9]},
    {"timeSeconds": 20.4},
]
check("local sparse windows default to bookends plus audit midpoints",
      local._trajectory_window_indices(probe_events, 30.0, context_radius=0) == [0, 11, 20, 29])
check("local sparse windows can opt into neighbor context",
      local._trajectory_window_indices(probe_events, 30.0, context_radius=1) == [0, 10, 11, 12, 19, 20, 21, 29])

print()
print("=" * 70)
print(f"RESULT: {len(passed)} passed, {len(failed)} failed")
print("=" * 70)
if failed:
    print("FAILED:")
    for f in failed: print("  -", f)
    sys.exit(1)
print("ALL CHECKS PASSED.")
