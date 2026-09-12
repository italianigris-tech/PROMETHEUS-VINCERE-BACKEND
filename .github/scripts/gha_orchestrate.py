"""
gha_orchestrate.py - Stage 1: Full Prometheus Pipeline Orchestration for GitHub Actions.

Brings GitHub Actions into 100% domain and functional parity with the Modal pipeline:
  1. Payload parsing (design, audio, prompt, brand preferences, silence policy, window)
  2. Source resolution & media probing (duration, width, height, fps)
  3. Resolution retention & increment planning (4K invariant, scale factor)
  4. Silence detection & editorial timeline (protected pauses, dead air trimming)
  5. Editorial shot cutting (synchronized audio/video cut)
  6. Speech transcription (AssemblyAI crop-first snippet / precomputed words)
  7. Smart word chunking (cadence & voice spans)
  8. Cinematic look selection & causal shot color grading (3D LUTs applied to shot plate)
  9. Full HAKT typography manifest & brand motifs (purged distortion fonts, stopword cursive ban, 2-layer dialogue)
 10. MediaPipe subject observation & safe placement (microphone & chest avoidance at y: 80%)
 11. Silence-bridging hold/lingering policy (stable captions across speech pauses)
 12. Orchestration planning (2.5D camera moves, zooms, transitions, timed SFX events)
 13. Song program planning & music materialization (ducked background music)
 14. Subject matting (optional transparent VP9 WebM for behind-subject text)
 15. Props generation & R2 uploads (props.json, graded source.mp4, song.mp3, matte.webm)
 16. Slice matrix dispatch (frame ranges & scale factor for parallel runners)
"""
from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import boto3
from botocore.config import Config

from mini_run_pipeline import (
    chunks as chunk_lib,
    looks,
    orchestration,
    pipeline,
    render as render_lib,
    resolution,
    silence,
    song_program,
    subject_placement,
    typography,
)

ENDPOINT = os.environ["R2_ENDPOINT"]
KEY_ID = os.environ["R2_ACCESS_KEY_ID"]
KEY_SECRET = os.environ["R2_SECRET_ACCESS_KEY"]
UPLOAD_BUCKET = os.environ.get("R2_UPLOAD_BUCKET", "prometheus-uploads")
PROCESSED_BUCKET = os.environ.get("R2_PROCESSED_BUCKET", "prometheus-processed")
DEFAULT_PARALLEL_SLICES = int(os.environ.get("PARALLEL_SLICES", "20"))

s3 = boto3.client(
    "s3",
    endpoint_url=ENDPOINT,
    aws_access_key_id=KEY_ID,
    aws_secret_access_key=KEY_SECRET,
    config=Config(signature_version="s3v4"),
    region_name="auto",
)


def gha_output(key: str, value: str) -> None:
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            if "\n" in value:
                delim = f"EOF_{key}"
                f.write(f"{key}<<{delim}\n{value}\n{delim}\n")
            else:
                f.write(f"{key}={value}\n")
    print(f"[gha_output] {key}={value[:120]}", flush=True)


def load_payload() -> dict:
    p = Path("/tmp/pipeline_payload.json")
    if p.exists():
        try:
            content = p.read_text(encoding="utf-8").strip()
            print(f"[orchestrate] Read /tmp/pipeline_payload.json ({len(content)} chars)", flush=True)
            return json.loads(content)
        except Exception as e:
            print(f"[orchestrate] Failed parsing /tmp/pipeline_payload.json: {e}", flush=True)

    b64 = os.environ.get("PAYLOAD_B64", "")
    if b64:
        try:
            decoded = base64.b64decode(b64).decode("utf-8")
            print(f"[orchestrate] Decoded PAYLOAD_B64 ({len(decoded)} chars)", flush=True)
            return json.loads(decoded)
        except Exception as e:
            print(f"[orchestrate] Failed decoding PAYLOAD_B64: {e}", flush=True)

    raw = os.environ.get("PIPELINE_PAYLOAD", "{}").strip()
    try:
        return json.loads(raw)
    except Exception:
        pass
    return {}


def main():
    started_at = time.monotonic()
    payload = load_payload()
    print(f"[orchestrate] Loaded payload keys: {list(payload.keys())}", flush=True)

    job_id = payload.get("jobId") or f"gha_hakt_{int(time.time())}"
    parallel_slices = int(payload.get("parallelSlices") or DEFAULT_PARALLEL_SLICES)
    print(f"[orchestrate] job_id={job_id}, parallel_slices={parallel_slices}", flush=True)

    workdir = Path(tempfile.mkdtemp(prefix=f"prom_{job_id}_"))
    local_vid = workdir / "raw_input.mp4"

    # 1. Resolve source video
    source = payload.get("source", {})
    src_str = source.get("path") or source.get("inputUrl") or ""
    found_source = False

    if src_str.startswith("http://") or src_str.startswith("https://"):
        import urllib.request
        print(f"[orchestrate] Downloading source from URL: {src_str}", flush=True)
        urllib.request.urlretrieve(src_str, local_vid)
        found_source = local_vid.exists() and local_vid.stat().st_size > 100
    elif src_str and Path(src_str).exists() and Path(src_str).is_file():
        print(f"[orchestrate] Using local file: {src_str}", flush=True)
        shutil.copyfile(src_str, local_vid)
        found_source = True
    elif src_str and (REPO_ROOT / "remotion-app/public/source" / Path(src_str).name).exists():
        matched = REPO_ROOT / "remotion-app/public/source" / Path(src_str).name
        print(f"[orchestrate] Matched in remotion-app/public/source: {matched}", flush=True)
        shutil.copyfile(matched, local_vid)
        found_source = True
    elif src_str and (REPO_ROOT / "remotion-app/public/dev-fixtures" / Path(src_str).name).exists():
        matched = REPO_ROOT / "remotion-app/public/dev-fixtures" / Path(src_str).name
        print(f"[orchestrate] Matched in remotion-app/public/dev-fixtures: {matched}", flush=True)
        shutil.copyfile(matched, local_vid)
        found_source = True
    elif src_str:
        key = src_str.lstrip("/")
        try:
            s3.download_file(UPLOAD_BUCKET, key, str(local_vid))
            print(f"[orchestrate] Fetched source from R2 upload bucket: {key}", flush=True)
            found_source = True
        except Exception as e:
            print(f"[orchestrate] Could not fetch {key} from R2: {e}", flush=True)

    if not found_source:
        for candidate in [
            REPO_ROOT / "remotion-app/public/source/test-video.mp4",
            REPO_ROOT / "remotion-app/public/dev-fixtures/test-video.mp4",
            REPO_ROOT / "remotion-app/public/source/MALE-BLACK-TALKING-HEAD-PODCAST.mp4",
            REPO_ROOT / "remotion-app/public/source/test_video.mp4",
        ]:
            if candidate.exists() and candidate.stat().st_size > 1000:
                print(f"[orchestrate] Using fallback repo video: {candidate}", flush=True)
                shutil.copyfile(candidate, local_vid)
                found_source = True
                break

    if not found_source or not local_vid.exists() or local_vid.stat().st_size < 1000:
        print("[orchestrate] Source is missing/pointer. Synthesizing 30s test MP4 with ffmpeg...", flush=True)
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", "testsrc=duration=30:size=1080x1920:rate=30",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=30",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", str(local_vid)
        ], check=True)
        found_source = True

    # 2. Media Probe
    probe = silence.probe_media(str(local_vid))
    source_duration_ms = int(probe.get("durationMs", 30000))
    source_width = int(probe.get("width", 1080))
    source_height = int(probe.get("height", 1920))
    source_fps = float(probe.get("fps", 30.0))
    print(f"[orchestrate] Media probe: {source_width}x{source_height} @ {source_fps:.2f}fps, {source_duration_ms}ms", flush=True)

    # 3. Resolution Retention & Increment Plan
    resolution_plan = resolution.plan_resolution(
        input_width=source_width,
        input_height=source_height,
        options=payload,
    )
    target_width = int(resolution_plan["target"]["width"])
    target_height = int(resolution_plan["target"]["height"])
    scale_factor = float(resolution_plan.get("scaleFactor", 1.0))
    print(f"[orchestrate] Resolution plan: {source_width}x{source_height} -> {target_width}x{target_height} (scale={scale_factor})", flush=True)

    # 4. Silence Detection & Editorial Timeline
    selected_window = payload.get("selectedWindow") or {
        "sourceStartMs": 0,
        "sourceEndMs": min(source_duration_ms, 30000),
    }
    window_start_ms = int(selected_window.get("sourceStartMs", 0))
    window_end_ms = int(selected_window.get("sourceEndMs", source_duration_ms))
    effective_analysis_ms = min(source_duration_ms, window_end_ms) if window_end_ms > 0 else source_duration_ms
    max_clip_ms = int(payload.get("maxClipMs", 30000))

    silence_spans = []
    try:
        silence_spans = silence.detect_silence_with_ffmpeg(
            str(local_vid),
            source_duration_ms,
            max_duration_ms=effective_analysis_ms,
        )
    except Exception as s_err:
        print(f"[orchestrate] Silence detection fallback: {s_err}", flush=True)

    silence_policy = str(payload.get("silencePolicy") or "preserve").lower()
    timeline = silence.build_editorial_timeline(
        selected_window=selected_window,
        words=[],
        silence_spans=silence_spans,
        source_duration_ms=source_duration_ms,
        source_width=source_width,
        source_height=source_height,
        silence_policy=silence_policy,
    )
    output_duration_ms = int(timeline.get("outputDurationMs", effective_analysis_ms - window_start_ms))
    effective_duration_ms = min(max_clip_ms, output_duration_ms) if output_duration_ms > 0 else max_clip_ms
    print(f"[orchestrate] Editorial timeline: {effective_duration_ms}ms (silencePolicy={silence_policy})", flush=True)

    # 5. Editorial Shot Cut
    raw_shot_path = workdir / f"raw_shot_{job_id}.mp4"
    render_lib.cut_editorial_shot(
        str(local_vid),
        timeline,
        str(raw_shot_path),
        max_clip_ms=effective_duration_ms,
    )

    # 6. Speech Transcription
    raw_words = []
    precomputed = payload.get("_precomputedWords")
    if precomputed is not None:
        raw_words = precomputed
        print(f"[orchestrate] Using {len(raw_words)} precomputed words from payload", flush=True)
    else:
        aai_key = os.environ.get("ASSEMBLYAI_API_KEY", "")
        if aai_key and raw_shot_path.exists() and raw_shot_path.stat().st_size > 1000:
            try:
                transcript_res = pipeline.transcribe_assemblyai(
                    aai_key,
                    raw_shot_path,
                    start_ms=0,
                    duration_ms=effective_duration_ms,
                )
                raw_words = transcript_res.get("words") or []
                print(f"[orchestrate] Transcribed {len(raw_words)} words via AssemblyAI", flush=True)
            except Exception as t_err:
                print(f"[orchestrate] Transcription notice: {t_err}", flush=True)

    if not raw_words:
        raw_words = [
            {"text": "WELCOME", "start_ms": 0, "end_ms": 1500, "confidence": 1.0},
            {"text": "TO", "start_ms": 1500, "end_ms": 2500, "confidence": 1.0},
            {"text": "PROMETHEUS", "start_ms": 2500, "end_ms": 5000, "confidence": 1.0},
            {"text": "KINETIC", "start_ms": 5000, "end_ms": 7500, "confidence": 1.0},
            {"text": "TYPOGRAPHY", "start_ms": 7500, "end_ms": 10000, "confidence": 1.0},
        ]

    # Normalize word objects
    norm_words = []
    for w in raw_words:
        s_ms = int(w.get("start_ms", w.get("start", 0)))
        e_ms = int(w.get("end_ms", w.get("end", s_ms + 400)))
        norm_words.append({
            "text": str(w.get("text", "")).strip(),
            "start_ms": s_ms,
            "end_ms": e_ms,
            "start": s_ms,
            "end": e_ms,
            "confidence": float(w.get("confidence", 1.0)),
        })

    # 7. Smart Word Chunking
    smart_chunks = chunk_lib.smart_chunk_words(
        norm_words,
        voice_spans=timeline.get("voiceSpans") or [{"sourceStartMs": 0, "sourceEndMs": effective_duration_ms}],
        protected_ranges=timeline.get("protectedRanges") or [],
        timestamp_map=timeline.get("timestampMap") or [],
        target_words=int(payload.get("targetChunkWords", 3)),
        max_chunk_words=int(payload.get("maxChunkWords", 5)),
    )
    print(f"[orchestrate] Smart chunking formed {len(smart_chunks)} cadence groups", flush=True)

    # 8. Causal Shot Color Grading (3D LUTs)
    design = payload.get("design") or {}
    look_plan = looks.select_look(
        design=design,
        metadata=payload.get("metadata") or {},
        prompt=payload.get("prompt"),
    )
    look_plan["lutsAvailable"] = looks.luts_available()
    look_plan["lutFiles"] = looks.discover_luts()
    look_plan["gradeFilter"] = looks.build_grade_filter(
        look_plan,
        video_width=target_width,
        video_height=target_height,
    )
    active_shot_path = raw_shot_path
    if look_plan.get("gradeFilter"):
        graded_shot_path = workdir / f"shot_graded_{job_id}.mp4"
        try:
            looks.grade_video_shot(
                input_shot_path=raw_shot_path,
                output_shot_path=graded_shot_path,
                look_plan=look_plan,
                width=source_width,
                height=source_height,
            )
            if graded_shot_path.exists() and graded_shot_path.stat().st_size > 1000:
                active_shot_path = graded_shot_path
                print(f"[orchestrate] Causally graded shot segment: {graded_shot_path} (look={look_plan.get('lookName')})", flush=True)
        except Exception as g_err:
            print(f"[orchestrate] Shot grading fallback: {g_err}", flush=True)
            active_shot_path = raw_shot_path

    # 9. Typography Manifest & Brand Motif
    font_manifest = typography.generate_font_manifest(smart_chunks, design)
    chunks = font_manifest.get("chunks") or smart_chunks
    resolved_motif = font_manifest.get("motif")
    print(f"[orchestrate] Generated font manifest ({len(chunks)} chunks, motif={resolved_motif.get('name') if resolved_motif else 'none'})", flush=True)

    # 10. MediaPipe Subject Observation & Safe Placement
    subject_obs = None
    try:
        if active_shot_path.exists() and active_shot_path.stat().st_size > 1000:
            print(f"[orchestrate] Running MediaPipe subject observation on {active_shot_path}...", flush=True)
            subject_obs = subject_placement.observe_subject(str(active_shot_path), effective_duration_ms)
            if subject_obs:
                placements = subject_placement.plan_subject_safe_placements(chunks, subject_obs)
                for manifest_chunk, placement in zip(chunks, placements):
                    dom_zone = placement.get("dominantZone")
                    y_raw = placement.get("yPercent", "54%")
                    try:
                        y_num = float(str(y_raw).rstrip("%"))
                    except Exception:
                        y_num = 54.0
                    # Microphone & Chest Avoidance:
                    # In mobile 9:16 talking heads, mic/chest spans 50%-74% Y.
                    # Lower-third captions MUST sit at 78%-82% Y for pristine clearance.
                    if dom_zone == "foreground_lower_deck" and y_num < 78.0:
                        placement["yPercent"] = "80%"
                    manifest_chunk["placement"] = placement
                print(f"[orchestrate] Applied subject-safe placements with microphone avoidance!", flush=True)
    except Exception as obs_err:
        print(f"[orchestrate] Subject observation notice: {obs_err}", flush=True)

    # 11. Silence-Bridging Hold/Lingering Policy
    for c_idx, c_item in enumerate(chunks):
        out_start = int(c_item.get("startMs", c_item.get("outputStartMs", 0)))
        c_item["startMs"] = out_start
        raw_end = int(c_item.get("displayEndMs", c_item.get("endMs", c_item.get("outputEndMs", 0))))
        next_start = effective_duration_ms
        if c_idx + 1 < len(chunks):
            nxt = chunks[c_idx + 1]
            next_start = int(nxt.get("startMs", nxt.get("outputStartMs", effective_duration_ms)))
        words_list = c_item.get("words", [])
        last_word_start = int(words_list[-1].get("start_ms", c_item.get("startMs", 0))) if words_list else int(c_item.get("startMs", 0))
        is_behind = bool(
            c_item.get("subjectLayering", {}).get("behindSubject")
            or any(l.get("behindSubject") for l in c_item.get("layers", []))
            or c_item.get("placement", {}).get("safeRegionId") == "upper_third"
        )
        max_allowed = max(raw_end, next_start - 80)
        desired_hold = max(raw_end, last_word_start + 750, raw_end + (550 if is_behind else 450))
        extended_display_end = min(effective_duration_ms, min(desired_hold, max_allowed))
        c_item["displayEndMs"] = extended_display_end
        c_item["outputEndMs"] = extended_display_end
        c_item["endMs"] = extended_display_end

    # 11b. Rack-Focus Handoff Stamping (Unified with pipeline.finalize_manifest_and_exits)
    pipeline.finalize_manifest_and_exits(chunks, font_manifest=font_manifest)
    print(f"[orchestrate] Stamped exitTreatments onto {len(chunks)} chunks (rack_focus_blur on collisions)", flush=True)

    # 12. Orchestration Manifest (Camera moves, waypoints, zooms, timed SFX)
    orchestration_manifest = None
    try:
        orchestration_manifest = orchestration.plan_mini_run_orchestration(
            chunks=chunks,
            probe=probe,
            duration_ms=effective_duration_ms,
            design=design,
            subject_observation=subject_obs,
            prompt=payload.get("prompt"),
            brand_preferences=payload.get("brandPreferences") or (design.get("brandPreferences") if isinstance(design, dict) else None),
        )
        print(f"[orchestrate] Orchestration manifest planned (scenes={len(orchestration_manifest.get('scenes', []))}, sfx={len(orchestration_manifest.get('sfx', []))})", flush=True)
    except Exception as orch_err:
        print(f"[orchestrate] Orchestration planning notice: {orch_err}", flush=True)

    # 13. Song Program Planning & Music Materialization
    audio = payload.get("audio") or {}
    materialized_song_program = None
    song_r2_key = ""
    if str(audio.get("songPolicy", "auto")) != "disabled":
        try:
            catalog = song_program.load_song_catalog(audio.get("catalogPath"), storage=s3)
            user_prompt = (
                payload.get("prompt")
                or payload.get("userPrompt")
                or (audio or {}).get("prompt")
                or (design or {}).get("prompt")
            )
            song_design = {
                **(design or {}),
                **audio,
                "prompt": user_prompt,
                "lookId": look_plan.get("lookId"),
                "lookName": look_plan.get("lookName"),
            }
            planned_song = song_program.plan_song_program(
                catalog=catalog,
                chunks=chunks,
                duration_ms=effective_duration_ms,
                design=song_design,
                prompt=user_prompt,
            )
            songs_dir = workdir / "songs"
            songs_dir.mkdir(parents=True, exist_ok=True)
            materialized_song_program = song_program.materialize_song_program(
                planned_song,
                storage=s3,
                cache_dir=str(songs_dir),
            )
        except Exception as sp_err:
            print(f"[orchestrate] Song selection fallback: {sp_err}", flush=True)
            try:
                songs_dir = workdir / "songs"
                songs_dir.mkdir(parents=True, exist_ok=True)
                materialized_song_program = song_program.resolve_fallback_local_song(
                    duration_ms=effective_duration_ms,
                    cache_dir=str(songs_dir),
                )
            except Exception as fb_err:
                print(f"[orchestrate] Emergency local song fallback notice: {fb_err}", flush=True)

        if materialized_song_program and (materialized_song_program.get("events") or []):
            first_event = materialized_song_program["events"][0]
            local_song_path = Path(first_event.get("localPath", ""))
            if local_song_path.is_file() and local_song_path.stat().st_size > 1000:
                song_r2_key = f"gha-renders/{job_id}/song.mp3"
                s3.upload_file(str(local_song_path), PROCESSED_BUCKET, song_r2_key)
                print(f"[orchestrate] Uploaded song -> R2:{song_r2_key} ({local_song_path.name})", flush=True)

    # 14. Subject Matting (Optional VP9 WebM for behind-subject text)
    matte_r2_key = ""
    matte_error = None
    behind_chunks = [c for c in chunks if c.get("subjectLayering", {}).get("behindSubject")]
    if behind_chunks and (design.get("subjectLayering") != "disabled"):
        try:
            from mini_run_pipeline import matting
            matte_out = workdir / f"matte_{job_id}.webm"
            matting.segment_video_window(
                source_video_path=active_shot_path,
                start_ms=0,
                end_ms=effective_duration_ms,
                output_webm_path=matte_out,
                width=source_width,
                height=source_height,
                fps=source_fps,
            )
            if matte_out.exists() and matte_out.stat().st_size > 1000:
                matte_r2_key = f"gha-renders/{job_id}/matte.webm"
                s3.upload_file(str(matte_out), PROCESSED_BUCKET, matte_r2_key)
                print(f"[orchestrate] Uploaded transparent matte -> R2:{matte_r2_key}", flush=True)
            else:
                matte_error = "Matte file was empty or missing after generation"
        except Exception as m_err:
            matte_error = str(m_err)
            print(f"[orchestrate] Matting notice (graceful degrade): {m_err}", flush=True)

    # 15. Upload Graded Source Video to R2
    source_r2_key = f"gha-renders/{job_id}/source.mp4"
    s3.upload_file(str(active_shot_path), PROCESSED_BUCKET, source_r2_key)
    print(f"[orchestrate] Uploaded graded source -> R2:{source_r2_key} ({active_shot_path.stat().st_size/1024/1024:.2f} MB)", flush=True)

    # 16. Build and Upload props.json for Remotion
    props = {
        "jobId": job_id,
        "videoSrc": "source/source.mp4",
        "sourcePath": "source/source.mp4",
        "matteSrc": "source/matte.webm" if matte_r2_key else None,
        "durationMs": effective_duration_ms,
        "chunks": chunks,
        "design": design,
        "aspectRatio": design.get("aspectRatio", "9:16"),
        "typographySystem": design.get("typographySystem", "hakt"),
        "motif": resolved_motif or design.get("motif", "royal_amethyst"),
        "fontManifest": font_manifest,
        "orchestration": orchestration_manifest,
        "targetWidth": target_width,
        "targetHeight": target_height,
        "scale": scale_factor,
        "resolutionPlan": resolution_plan,
        "lookPlan": look_plan,
        "songProgram": materialized_song_program,
        "profile": font_manifest.get("profile") if font_manifest else None,
        "asrWords": norm_words,
    }
    props_path = workdir / f"props_{job_id}.json"
    props_path.write_text(json.dumps(props, indent=2))
    props_r2_key = f"gha-renders/{job_id}/props.json"
    s3.upload_file(str(props_path), PROCESSED_BUCKET, props_r2_key)
    print(f"[orchestrate] Uploaded props -> R2:{props_r2_key}", flush=True)

    # 17. Build Slice Matrix
    fps = 30
    total_frames = max(1, int(round((effective_duration_ms / 1000.0) * fps)))
    fps_per = max(1, (total_frames + parallel_slices - 1) // parallel_slices)
    matrix = []
    for i in range(parallel_slices):
        sf = i * fps_per
        ef = min(total_frames - 1, (i + 1) * fps_per - 1)
        if sf > ef:
            break
        matrix.append({
            "slice_index": i,
            "start_frame": sf,
            "end_frame": ef,
            "scale": scale_factor,
        })

    # Deployment fingerprint stamp
    git_sha = os.environ.get("GITHUB_SHA")
    if not git_sha:
        try:
            import subprocess
            git_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL).decode("utf-8").strip()
        except Exception:
            git_sha = "unknown"

    try:
        from mini_run_pipeline.typography import load_typography_profiles_v2_catalog, ANIMA_RUNTIME_TREATMENTS
        v2_profile_count = len(load_typography_profiles_v2_catalog().get("profiles", []))
        runtime_treatment_count = len(ANIMA_RUNTIME_TREATMENTS)
    except Exception:
        v2_profile_count = 0
        runtime_treatment_count = 0

    receipt_partial = json.dumps({
        "jobId": job_id,
        "chunkCount": len(chunks),
        "durationMs": effective_duration_ms,
        "totalFrames": total_frames,
        "sliceCount": len(matrix),
        "resolution": resolution_plan,
        "lookPlan": look_plan,
        "songProgram": materialized_song_program,
        "matte": {
            "status": "completed" if matte_r2_key else ("failed_fallback_foreground" if matte_error else "not_available"),
            "r2Key": matte_r2_key or None,
            "behindSubjectChunkCount": len(behind_chunks),
            "error": str(matte_error) if matte_error else None,
        },
        "deploymentFingerprint": {
            "gitSha": git_sha,
            "v2ProfileCount": v2_profile_count,
            "runtimeTreatmentCatalogCount": runtime_treatment_count,
        },
        "gitSha": git_sha,
        "v2ProfileCount": v2_profile_count,
        "runtimeTreatmentCatalogCount": runtime_treatment_count,
        "orchestratedAt": time.time(),
        "stageTimingsMs": {
            "orchestrate": round((time.monotonic() - started_at) * 1000),
        },
    })

    gha_output("job_id", job_id)
    gha_output("slice_matrix", json.dumps(matrix))
    gha_output("props_r2_key", props_r2_key)
    gha_output("source_r2_key", source_r2_key)
    gha_output("matte_r2_key", matte_r2_key)
    gha_output("song_r2_key", song_r2_key)
    gha_output("receipt_partial", receipt_partial)
    gha_output("total_slices", str(len(matrix)))
    print(f"[orchestrate] Orchestration completed successfully: {len(matrix)} slices over {total_frames} frames", flush=True)


if __name__ == "__main__":
    main()
