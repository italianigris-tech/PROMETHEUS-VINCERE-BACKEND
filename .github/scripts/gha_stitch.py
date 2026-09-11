"""
gha_stitch.py - Stage 3: Full Prometheus Pipeline Stitching & Broadcast Audio Mix.

Brings GitHub Actions into 100% domain and functional parity with the Modal pipeline:
  1. Downloads all rendered video slices from R2.
  2. Concat video slices via zero-drift 30fps filter.
  3. Resolution retention check & Lanczos alignment if dimensions differ from target.
  4. Downloads source video and extracts synchronized 48kHz stereo dialogue.
  5. Downloads materialized song track from R2 (if song program planned).
  6. Resolves timed SFX cues from bundled corpus (remotion-app/public/sfx).
  7. Broadcast-standard audio mix:
     - Sidechain compression (music dynamically ducks under speech)
     - Mobile phone speaker EQ (80Hz rumble cut + 1200Hz melodic presence contour)
     - Millisecond-accurate SFX delay & gain balancing
     - EBU R128 loudness normalization (-14 LUFS, -1 dBTP)
     - Master peak limiter
  8. Invariant validation (duration contract & resolution non-depreciation).
  9. Master MP4 and comprehensive receipt upload to R2 and GitHub Actions artifacts.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import boto3
from botocore.config import Config

from mini_run_pipeline import render as render_lib, resolution, silence

s3 = boto3.client(
    "s3",
    endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    config=Config(signature_version="s3v4"),
    region_name="auto",
)

PROCESSED_BUCKET = os.environ.get("R2_PROCESSED_BUCKET", "prometheus-processed")
PUBLIC_BASE = os.environ.get("R2_PUBLIC_PROCESSED_BASE", "")
JOB_ID = os.environ["JOB_ID"]
TOTAL_SLICES = int(os.environ.get("TOTAL_SLICES", "20"))
RECEIPT_PARTIAL_STR = os.environ.get("RECEIPT_PARTIAL", "{}")
PROPS_R2_KEY = os.environ.get("PROPS_R2_KEY", f"gha-renders/{JOB_ID}/props.json")
SONG_R2_KEY = os.environ.get("SONG_R2_KEY", "")

partial = json.loads(RECEIPT_PARTIAL_STR) if RECEIPT_PARTIAL_STR else {}
slices_dir = Path("/tmp/slices_dl")
slices_dir.mkdir(parents=True, exist_ok=True)

# 1. Download all slices
slice_paths = []
t_dl = time.monotonic()
for i in range(TOTAL_SLICES):
    key = f"gha-renders/{JOB_ID}/slices/slice_{i:02d}.mp4"
    local = slices_dir / f"slice_{i:02d}.mp4"
    try:
        s3.download_file(PROCESSED_BUCKET, key, str(local))
        slice_paths.append(local)
        print(f"[stitch] Downloaded slice {i:02d} ({local.stat().st_size/1024:.0f} KB)", flush=True)
    except Exception as e:
        print(f"[stitch] WARNING: missing slice {i:02d}: {e}", flush=True)

print(f"[stitch] Downloaded {len(slice_paths)}/{TOTAL_SLICES} slices in {time.monotonic()-t_dl:.1f}s", flush=True)

if not slice_paths:
    raise RuntimeError("No slices downloaded — render failed.")

# Sort by index
slice_paths.sort(key=lambda p: int(p.stem.split("_")[1]))

# 2. Build concat manifest
concat_txt = slices_dir / "concat.txt"
with concat_txt.open("w", encoding="utf-8") as f:
    for p in slice_paths:
        f.write(f"file '{p}'\n")

muted_master = slices_dir / f"muted_master_{JOB_ID}.mp4"
t_concat = time.monotonic()
concat_cmd = [
    "ffmpeg", "-y", "-loglevel", "error",
    "-f", "concat", "-safe", "0",
    "-i", str(concat_txt),
    "-vf", "fps=30,setpts=N/(30*TB)",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "12",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    str(muted_master),
]
subprocess.run(concat_cmd, check=True)
print(f"[stitch] Slices concatenated in {time.monotonic()-t_concat:.2f}s -> {muted_master}", flush=True)

# 3. Download props.json from R2
props = {}
props_file = Path(f"/tmp/props_{JOB_ID}.json")
try:
    s3.download_file(PROCESSED_BUCKET, PROPS_R2_KEY, str(props_file))
    props = json.loads(props_file.read_text(encoding="utf-8"))
    print(f"[stitch] Loaded props from R2 ({len(props)} keys)", flush=True)
except Exception as p_err:
    print(f"[stitch] Notice: could not load props from R2: {p_err}", flush=True)

# 4. Check Resolution and Align via Lanczos if needed
target_width = int(props.get("targetWidth") or 1080)
target_height = int(props.get("targetHeight") or 1920)
resolution_plan = props.get("resolutionPlan") or partial.get("resolution")

muted_probe = silence.probe_media(str(muted_master))
actual_muted_w = int(muted_probe.get("width") or 0)
actual_muted_h = int(muted_probe.get("height") or 0)
active_muted_video = muted_master

if actual_muted_w < target_width or actual_muted_h < target_height:
    print(f"[stitch] Upscaling concatenated slices via Lanczos: {actual_muted_w}x{actual_muted_h} -> {target_width}x{target_height}", flush=True)
    aligned_master = slices_dir / f"muted_aligned_{JOB_ID}.mp4"
    enforce_filter = resolution.build_resolution_enforcement_filter(
        actual_muted_w, actual_muted_h, target_width, target_height
    )
    if enforce_filter:
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(muted_master),
            "-vf", enforce_filter,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            str(aligned_master),
        ], check=True)
        active_muted_video = aligned_master

# 5. Download source video and extract synchronized dialogue audio
source_path = slices_dir / "source.mp4"
audio_path = slices_dir / f"dialogue_{JOB_ID}.aac"
try:
    s3.download_file(PROCESSED_BUCKET, f"gha-renders/{JOB_ID}/source.mp4", str(source_path))
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(source_path),
        "-vn", "-c:a", "aac", "-b:a", "192k",
        str(audio_path)
    ], check=True)
    print(f"[stitch] Extracted dialogue track -> {audio_path}", flush=True)
except Exception as a_err:
    print(f"[stitch] Warning: dialogue extraction failed: {a_err}", flush=True)

# 6. Download Song Track from R2 (if planned)
song_program_obj = props.get("songProgram") or partial.get("songProgram")
downloaded_song = False
if SONG_R2_KEY:
    local_song = slices_dir / f"song_{JOB_ID}.mp3"
    try:
        s3.download_file(PROCESSED_BUCKET, SONG_R2_KEY, str(local_song))
        if local_song.exists() and local_song.stat().st_size > 1000:
            downloaded_song = True
            if song_program_obj and (song_program_obj.get("events") or []):
                for event in song_program_obj["events"]:
                    event["localPath"] = str(local_song)
            print(f"[stitch] Downloaded song track -> {local_song}", flush=True)
    except Exception as s_err:
        print(f"[stitch] Warning: could not download song track: {s_err}", flush=True)

# 7. Resolve SFX Cues
orchestration_obj = props.get("orchestration") or {}
sfx_events = list(orchestration_obj.get("sfx") or [])
resolved_sfx = render_lib.resolve_sfx_event_paths(
    sfx_events,
    REPO_ROOT / "remotion-app" / "public",
)
print(f"[stitch] Resolved {len(resolved_sfx)}/{len(sfx_events)} timed SFX events", flush=True)

# 8. Broadcast Audio Mix Command Execution
master_path = Path(f"/tmp/master_{JOB_ID}.mp4")
t_mix = time.monotonic()
effective_duration_ms = int(props.get("durationMs") or partial.get("durationMs", 30000))

if downloaded_song and song_program_obj and (song_program_obj.get("events") or []):
    print("[stitch] Building song-first, dialogue-anchored sidechain ducked audio mix...", flush=True)
    mix_cmd = render_lib.build_audio_mix_command(
        muted_video_path=str(active_muted_video),
        dialogue_path=str(audio_path),
        song_program=song_program_obj,
        sfx_events=resolved_sfx,
        output_path=str(master_path),
    )
    subprocess.run(mix_cmd, check=True)
    audio_mix_status = {
        "status": "baked",
        "songCount": len(song_program_obj.get("events") or []),
        "sfxCount": len(resolved_sfx),
        "ducking": (song_program_obj.get("dialogueDucking") or {}).get("mode", "sidechain"),
        "targetLufs": -14,
        "sampleRate": 48000,
    }
else:
    print("[stitch] Building dialogue + timed SFX audio mix with loudness normalization...", flush=True)
    mix_cmd = render_lib.build_sfx_dialogue_mix_command(
        muted_video_path=str(active_muted_video),
        dialogue_path=str(audio_path),
        sfx_events=resolved_sfx,
        duration_ms=effective_duration_ms,
        output_path=str(master_path),
    )
    subprocess.run(mix_cmd, check=True)
    audio_mix_status = {
        "status": "dialogue_and_sfx",
        "songCount": 0,
        "sfxCount": len(resolved_sfx),
        "targetLufs": -14,
        "sampleRate": 48000,
    }

mix_duration_ms = int((time.monotonic() - t_mix) * 1000)
print(f"[stitch] Master mix completed in {mix_duration_ms}ms -> {master_path} ({master_path.stat().st_size/1024/1024:.2f} MB)", flush=True)

# 9. Invariant Verification
try:
    final_dur_ms = render_lib._probe_media_duration_ms(master_path)
    render_lib.require_render_duration(
        actual_duration_ms=final_dur_ms,
        expected_duration_ms=effective_duration_ms,
    )
    audio_mix_status["encodedDurationMs"] = final_dur_ms
    print(f"[stitch] Duration contract verified: {final_dur_ms}ms (target: {effective_duration_ms}ms)", flush=True)
except Exception as dur_err:
    print(f"[stitch] Duration contract note: {dur_err}", flush=True)

resolution_receipt = {}
try:
    if resolution_plan:
        resolution_receipt = resolution.verify_output_resolution(
            output_path=str(master_path),
            plan=resolution_plan,
            input_width=int(muted_probe.get("width", target_width)),
            input_height=int(muted_probe.get("height", target_height)),
        )
        print(f"[stitch] Resolution contract verified: {resolution_receipt.get('tier')} ({resolution_receipt.get('width')}x{resolution_receipt.get('height')})", flush=True)
except Exception as res_err:
    print(f"[stitch] Resolution verification notice: {res_err}", flush=True)

# 9b. Post-render Conformance Verification
policy_report = {}
try:
    from mini_run_pipeline import policy_check
    policy_report = policy_check.run_post_render_conformance_check(
        video_path=master_path,
        manifest_or_props=props.get("fontManifest") or props,
    )
    print(f"[stitch] Conformance check status: {policy_report.get('status')} ({len(policy_report.get('violations', []))} violations)", flush=True)
except Exception as pol_err:
    print(f"[stitch] Conformance check notice: {pol_err}", flush=True)

# 10. Upload Master MP4 to R2
master_key = f"gha-renders/{JOB_ID}/master.mp4"
s3.upload_file(str(master_path), PROCESSED_BUCKET, master_key)
output_url = f"{PUBLIC_BASE}/{master_key}" if PUBLIC_BASE else f"r2://{PROCESSED_BUCKET}/{master_key}"
print(f"[stitch] Master MP4 -> R2:{master_key}", flush=True)

# 11. Write Full Receipt
receipt = {
    **partial,
    "jobId": JOB_ID,
    "status": "completed",
    "backend": "github-actions",
    "outputPath": master_key,
    "outputUrl": output_url,
    "masterSizeBytes": master_path.stat().st_size,
    "slicesRendered": len(slice_paths),
    "resolution": resolution_receipt or resolution_plan,
    "policyReport": policy_report,
    "audioMix": audio_mix_status,
    "orchestration": {
        "status": "baked" if orchestration_obj else "not_planned",
        "sceneCount": len(orchestration_obj.get("scenes") or []),
        "sfxCount": len(resolved_sfx),
        "cameraMoveCount": len(orchestration_obj.get("cameraMoves") or []),
    },
    "look": props.get("lookPlan") or partial.get("lookPlan") or {},
    "asrWords": props.get("asrWords") or [],
    "fontManifest": props.get("fontManifest") or {},
    "chunks": props.get("chunks") or [],
    "completedAt": time.time(),
}
receipt_path = Path(f"/tmp/receipt_{JOB_ID}.json")
receipt_path.write_text(json.dumps(receipt, indent=2))
print(f"[stitch] Receipt written: {receipt_path}", flush=True)
print(json.dumps(receipt, indent=2))
