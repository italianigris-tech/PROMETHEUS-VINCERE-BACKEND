"""Mini-run end-to-end pipeline orchestrator.

Ties the package together into one production-parity job:

    1. resolve the source (local path or URL) + fingerprint it,
    2. classify the call (short-form MAUL vs long-form Joseph),
    3. run transcription (AssemblyAI) and silence detection (FFmpeg
       ``silencedetect``) in parallel,
    4. build the editorial timeline (protected pauses preserved, dead air cut),
    5. chunk the transcript on silence-aware boundaries with output timings,
    6. compose the final MP4 via parallel slice workers,
    6b. optional audio bake: voice + looped music bed + timed SFX cues (the
       ``audio`` render option) are mixed deterministically and muxed into the
       same MP4 as one 48 kHz stereo AAC track — no real-time DOM capture,
    7. publish to R2 + mark the Supabase ``mini_run_jobs`` row completed.

Degrades gracefully: without R2/Supabase credentials the pipeline still runs
locally and the job record lives only in the queue backend. Without an
AssemblyAI key, transcription is skipped and the render is caption-free.
"""

from __future__ import annotations
from . import typography

import hashlib
import json
import os
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from . import (
    chunks,
    classify,
    ids,
    jobs,
    looks,
    orchestration,
    motif,
    render,
    resolution,
    silence,
    song_program,
    storage,
    subject_placement,
)

PIPELINE_JOB_NAME = "mini-run:render"
DEFAULT_ARTIFACT_ROOT = os.getenv("MINI_RUN_ARTIFACT_ROOT", "/tmp/mini-run")

ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2"
ASSEMBLYAI_TRANSCRIPT = {}
ASSEMBLYAI_POLL_INTERVAL_MS = 2500
ASSEMBLYAI_MAX_POLL_ATTEMPTS = 240

# ---------------------------------------------------------------------------
# Source resolution
# ---------------------------------------------------------------------------


def _sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def resolve_source(source: Any, artifact_root: str = DEFAULT_ARTIFACT_ROOT) -> tuple[Path, str]:
    """Resolve a source reference to a local file + its SHA-256 fingerprint.

    Accepts a plain string (path or URL) or a dict with ``path``/``url``/
    ``sourceUrl``/``sourcePath`` keys. Relative paths are checked against the
    artifact root first, then the working directory.
    """
    if isinstance(source, dict):
        raw = (
            source.get("path")
            or source.get("url")
            or source.get("sourceUrl")
            or source.get("sourcePath")
            or source.get("filePath")
        )
        if not raw:
            raise ValueError("source dict must include path/url/sourceUrl/sourcePath.")
    else:
        raw = source
    if not raw:
        raise ValueError("source is required (path or URL).")

    parsed = urllib.parse.urlparse(str(raw))
    if parsed.scheme in ("http", "https"):
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as handle:
            destination = Path(handle.name)
        urllib.request.urlretrieve(str(raw), str(destination))
        return destination, _sha256_of(destination)

    local_path = Path(str(raw))
    if not local_path.is_absolute():
        candidate = Path(artifact_root) / local_path
        if candidate.exists():
            local_path = candidate
    if not local_path.exists():
        raise FileNotFoundError(f"source does not exist: {local_path}")
    return local_path, _sha256_of(local_path)

# ---------------------------------------------------------------------------
# AssemblyAI transcription (mirrors backend/src/integrations/assemblyai.ts)
# ---------------------------------------------------------------------------


def _assemblyai_upload(api_key: str, file_path: Path) -> str:
    with file_path.open("rb") as handle:
        payload = handle.read()
    request = urllib.request.Request(
        f"{ASSEMBLYAI_BASE_URL}/upload",
        data=payload,
        headers={"authorization": api_key, "content-type": "application/octet-stream"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = json.loads(response.read())
    return str(body["upload_url"])


def _assemblyai_create_transcript(api_key: str, audio_url: str) -> str:
    request = urllib.request.Request(
        f"{ASSEMBLYAI_BASE_URL}/transcript",
        data=json.dumps({"audio_url": audio_url, **ASSEMBLYAI_TRANSCRIPT}).encode("utf-8"),
        headers={"authorization": api_key, "content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = json.loads(response.read())
    return str(body["id"])


def _assemblyai_poll(
    api_key: str,
    transcript_id: str,
    poll_interval_ms: int = ASSEMBLYAI_POLL_INTERVAL_MS,
    max_attempts: int = ASSEMBLYAI_MAX_POLL_ATTEMPTS,
) -> List[dict[str, Any]]:
    for _ in range(max_attempts):
        request = urllib.request.Request(
            f"{ASSEMBLYAI_BASE_URL}/transcript/{transcript_id}",
            headers={"authorization": api_key},
            method="GET",
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            transcript = json.loads(response.read())
        status = transcript.get("status")
        if status == "completed":
            return [
                {
                    "text": str(word.get("text", "")).strip(),
                    "start_ms": int(word.get("start", 0)),
                    "end_ms": int(word.get("end", 0)),
                    "confidence": float(word.get("confidence", 1.0)),
                }
                for word in (transcript.get("words") or [])
            ]
        if status == "error":
            raise RuntimeError(f"AssemblyAI transcription error: {transcript.get('error')}")
        time.sleep(poll_interval_ms / 1000.0)
    raise TimeoutError("AssemblyAI transcription did not complete in time.")


def transcribe_assemblyai(
    api_key: str,
    file_path: Path,
    poll_interval_ms: int = ASSEMBLYAI_POLL_INTERVAL_MS,
    max_attempts: int = ASSEMBLYAI_MAX_POLL_ATTEMPTS,
    start_ms: int = 0,
    duration_ms: Optional[int] = None,
) -> Dict[str, Any]:
    """Transcribe a local file with AssemblyAI; returns provider/words/text.

    Crop-First Optimization:
    If start_ms > 0 or duration_ms is specified, or if file_path is a large video file,
    an isolated 16kHz mono audio snippet is extracted first. This guarantees:
      1. Tiny upload payloads (~200-500 KB instead of 500 MB+).
      2. Fast transcription in ~3-5 seconds with zero timeouts.
      3. Pinpoint synchronization with no long-form timestamp drift or cross-segment speech bleeding.
    Without an API key it degrades to an empty transcript so the pipeline can
    still run caption-free in fully offline studio mode.
    """
    if not api_key:
        return {"provider": "none", "transcriptId": None, "text": "", "words": []}

    upload_target = file_path
    temp_audio_file = None
    extracted_snippet = False

    try:
        suffix = file_path.suffix.lower()
        should_extract = (
            start_ms > 0
            or (duration_ms is not None and duration_ms > 0)
            or suffix in (".mp4", ".mov", ".mkv", ".avi", ".webm")
        )
        if should_extract:
            fd, tmp_path_str = tempfile.mkstemp(suffix=".mp3")
            os.close(fd)
            temp_audio_file = Path(tmp_path_str)
            cmd = ["ffmpeg", "-y", "-loglevel", "error"]
            if start_ms > 0:
                cmd.extend(["-ss", f"{start_ms / 1000.0:.3f}"])
            cmd.extend(["-i", str(file_path)])
            if duration_ms is not None and duration_ms > 0:
                cmd.extend(["-t", f"{duration_ms / 1000.0:.3f}"])
            cmd.extend([
                "-vn", "-ac", "1", "-ar", "16000",
                "-c:a", "libmp3lame", "-b:a", "64k",
                str(temp_audio_file),
            ])
            res = subprocess.run(cmd, capture_output=True)
            if res.returncode == 0 and temp_audio_file.exists() and temp_audio_file.stat().st_size > 0:
                upload_target = temp_audio_file
                extracted_snippet = True
            else:
                if temp_audio_file and temp_audio_file.exists():
                    temp_audio_file.unlink(missing_ok=True)
                temp_audio_file = None

        upload_url = _assemblyai_upload(api_key, upload_target)
        transcript_id = _assemblyai_create_transcript(api_key, upload_url)
        raw_words = _assemblyai_poll(api_key, transcript_id, poll_interval_ms, max_attempts)

        words = []
        offset_ms = start_ms if (extracted_snippet and start_ms > 0) else 0
        for w in raw_words:
            words.append({
                "text": str(w.get("text", "")).strip(),
                "start_ms": int(w.get("start_ms", 0)) + offset_ms,
                "end_ms": int(w.get("end_ms", 0)) + offset_ms,
                "confidence": float(w.get("confidence", 1.0)),
            })

        return {
            "provider": "assemblyai",
            "transcriptId": transcript_id,
            "text": " ".join(word["text"] for word in words),
            "words": words,
        }
    finally:
        if temp_audio_file and temp_audio_file.exists():
            try:
                temp_audio_file.unlink(missing_ok=True)
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Job creation
# ---------------------------------------------------------------------------


def create_pipeline_job(
    source: Any,
    job_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    queue_backend: Optional[Any] = None,
    artifact_root: str = DEFAULT_ARTIFACT_ROOT,
    start_worker: bool = False,
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create + enqueue a mini-run pipeline job.

    Returns ``{jobId, status, pipeline, pipelineJobId, data}``. When Supabase
    credentials are configured a ``mini_run_jobs`` row is inserted too.
    """
    job_id = job_id or ids.create_job_id()
    metadata = metadata or {}

    decision = classify.classify_call(metadata)
    source_sha256 = ""
    try:
        _, source_sha256 = resolve_source(source, artifact_root=artifact_root)
    except Exception:  # noqa: BLE001 - fingerprint is best-effort at enqueue time
        source_sha256 = ""

    data: Dict[str, Any] = {
        "source": source if isinstance(source, dict) else {"path": str(source)},
        "metadata": metadata,
        "pipelineJobId": classify.pipeline_job_id(decision["pipeline"], job_id, source_sha256),
        "createdAtMs": int(time.time() * 1000),
    }
    # Render options (design, selected window, chunk params) ride on the job
    # envelope so the worker composes the final MP4 exactly as requested. These
    # are merged *before* enqueueing so a fast worker never reads a partial job.
    if options:
        data.update(options)

    queue = queue_backend or jobs.create_job_queue()
    queue.enqueue(PIPELINE_JOB_NAME, data, job_id=job_id)

    store = storage.SupabaseStore()
    if store.enabled:
        try:
            store.create_job(
                {
                    "id": job_id,
                    "status": "queued",
                    "progress": 0,
                    "pipeline": decision["pipeline"],
                    "mode": decision["mode"],
                    "pipeline_job_id": data["pipelineJobId"],
                    "source": json.dumps(data["source"]),
                    "result": None,
                    "error": None,
                }
            )
        except Exception:  # noqa: BLE001 - queue record still authoritative
            pass

    if start_worker:
        _ensure_worker(artifact_root=artifact_root, queue_backend=queue)

    return {
        "jobId": job_id,
        "status": "queued",
        "pipeline": decision["pipeline"],
        "pipelineJobId": data["pipelineJobId"],
        "data": data,
    }


def get_pipeline_job(job_id: str, queue_backend: Optional[Any] = None) -> Optional[Dict[str, Any]]:
    """Read a job from the queue backend, falling back to Supabase."""
    queue = queue_backend or jobs.create_job_queue()
    envelope = queue.get(job_id)
    if envelope is not None:
        return envelope
    store = storage.SupabaseStore()
    if store.enabled:
        row = store.get_job(job_id)
        if row:
            return {"id": job_id, "data": {}, "returnvalue": None, "_state": row.get("status")}
def resolve_chunk_zone(chunk: Dict[str, Any]) -> str:
    """Extract canonical spatial zone from chunk or its placement metadata."""
    if not isinstance(chunk, dict):
        return ""
    placement = chunk.get("placement") or {}
    zone = (
        chunk.get("spatial_zone")
        or chunk.get("spatialZone")
        or placement.get("dominantZone")
        or placement.get("zone")
        or placement.get("safeRegionId")
        or ""
    )
    zone_str = str(zone).lower()
    if "flank_left" in zone_str or "left_pillar" in zone_str:
        return "flank_left"
    if "flank_right" in zone_str or "right_pillar" in zone_str:
        return "flank_right"
    if "cranial" in zone_str or "above_head" in zone_str or "crown" in zone_str:
        return "cranial"
    if "lower_deck" in zone_str or "lower" in zone_str or "bottom" in zone_str:
        return "lower_deck"
    if "center" in zone_str:
        return "center"
    return zone_str


def finalize_manifest_and_exits(
    chunks: List[Dict[str, Any]],
    font_manifest: Optional[Dict[str, Any]] = None,
) -> None:
    """Stamp collisionMs and exitTreatment onto chunks and font_manifest.

    Single authoritative source of truth for both local pipeline and GHA orchestration:
    - collision > 0 and different spatial zones -> rack_focus_blur
    - collision == 0 or same spatial zone -> clean_hold (hard cut avoids same-zone double blur)
    """
    m_chunks = (font_manifest or {}).get("chunks") or []
    for c_idx in range(len(chunks)):
        c_cur = chunks[c_idx]
        m_cur = m_chunks[c_idx] if c_idx < len(m_chunks) else None
        cur_disp_end = int(c_cur.get("displayEndMs", c_cur.get("endMs", 0)))
        if c_idx + 1 < len(chunks):
            next_c = chunks[c_idx + 1]
            next_start = int(next_c.get("displayStartMs", next_c.get("startMs", 0)))
            collision_ms = max(0, cur_disp_end - next_start)
            cur_zone = resolve_chunk_zone(c_cur)
            next_zone = resolve_chunk_zone(next_c)
            is_same_zone = bool(cur_zone and next_zone and cur_zone == next_zone)
        else:
            collision_ms = 0
            is_same_zone = False

        exit_treatment = "rack_focus_blur" if (collision_ms > 0 and not is_same_zone) else "clean_hold"
        c_cur["collisionMs"] = collision_ms
        c_cur["exitTreatment"] = exit_treatment
        for lyr in c_cur.get("layers", []):
            if isinstance(lyr, dict):
                lyr["exitTreatment"] = exit_treatment
        if m_cur is not None:
            m_cur["collisionMs"] = collision_ms
            m_cur["exitTreatment"] = exit_treatment
            for lyr in m_cur.get("layers", []):
                if isinstance(lyr, dict):
                    lyr["exitTreatment"] = exit_treatment


# ---------------------------------------------------------------------------
# Pipeline execution
# ---------------------------------------------------------------------------

SliceExecutor = Callable[[List[Dict[str, Any]]], List[Dict[str, Any]]]


def execute_pipeline_job(
    job_id: str,
    data: Dict[str, Any],
    artifact_root: str = DEFAULT_ARTIFACT_ROOT,
    slice_executor: Optional[SliceExecutor] = None,
) -> Dict[str, Any]:
    """Run one mini-run pipeline job end to end and return the render receipt."""
    started_at = time.monotonic()
    artifact_root = Path(artifact_root)
    artifact_root.mkdir(parents=True, exist_ok=True)

    r2 = storage.R2Storage()
    store = storage.SupabaseStore()

    def update(status: str, progress: int, result: Any = None, error: Optional[str] = None) -> None:
        if not store.enabled:
            return
        try:
            store.update_job(
                job_id,
                {
                    "status": status,
                    "progress": progress,
                    "result": json.dumps(result) if result is not None else None,
                    "error": error,
                },
            )
        except Exception:  # noqa: BLE001 - status writes must never kill the job
            pass

    update("processing", 10)

    # 1) resolve + fingerprint the source.
    source_path, source_sha256 = resolve_source(data.get("source"), artifact_root=str(artifact_root))
    update("processing", 20)

    # 2) classify short-form vs long-form (canonical pipeline job ID).
    decision = classify.classify_call(data.get("metadata") or {})
    pipeline_job_id = classify.pipeline_job_id(decision["pipeline"], job_id, source_sha256)

    # 3) media probe, then transcription + silence detection + subject observation in parallel.
    probe = silence.probe_media(str(source_path))
    source_duration_ms = int(probe.get("durationMs", 0))
    source_width = int(probe.get("width", 0))
    source_height = int(probe.get("height", 0))

    # 3b) Resolution Retention & Increment Plan
    # Non-negotiable invariant: 4K in -> at least 4K out.
    # Never downscale below input quality; support resolution increment (1080p -> 4K, 4K -> 8K).
    resolution_plan = resolution.plan_resolution(
        input_width=source_width,
        input_height=source_height,
        options=data,
    )
    print(
        f"[pipeline] resolution planned: {resolution_plan['input']['label']} -> "
        f"{resolution_plan['target']['label']} ({resolution_plan['target']['width']}x{resolution_plan['target']['height']}) "
        f"scale={resolution_plan['scaleFactor']} policy={resolution_plan['policy']} "
        f"incremented={resolution_plan['isIncremented']}",
        flush=True,
    )
    update("processing", 30)

    selected_window = data.get("selectedWindow") or {
        "sourceStartMs": 0,
        "sourceEndMs": source_duration_ms,
    }
    window_start_ms = int(selected_window.get("sourceStartMs", 0))
    window_end_ms = int(selected_window.get("sourceEndMs", source_duration_ms))
    effective_analysis_ms = min(source_duration_ms, window_end_ms) if window_end_ms > 0 else source_duration_ms
    max_clip_ms: int = int(data.get("maxClipMs", 30000))
    observe_duration_ms = min(max_clip_ms, effective_analysis_ms) if effective_analysis_ms > 0 else max_clip_ms

    precomputed_words = data.get("_precomputedWords")

    def transcribe_task() -> Dict[str, Any]:
        if precomputed_words is not None:
            return {
                "provider": "precomputed",
                "transcriptId": "precomputed",
                "text": " ".join(w.get("text", "") for w in precomputed_words),
                "words": precomputed_words,
            }
        target_start_ms = window_start_ms
        target_duration_ms = min(effective_analysis_ms - target_start_ms, max_clip_ms) if effective_analysis_ms > target_start_ms else max_clip_ms
        return transcribe_assemblyai(
            os.getenv("ASSEMBLYAI_API_KEY", ""),
            source_path,
            start_ms=target_start_ms,
            duration_ms=target_duration_ms,
        )

    def silence_task() -> List[Dict[str, Any]]:
        return silence.detect_silence_with_ffmpeg(
            str(source_path),
            source_duration_ms,
            max_duration_ms=effective_analysis_ms,
        )

    def observe_task() -> Optional[Dict[str, Any]]:
        try:
            return subject_placement.observe_subject(
                str(source_path),
                observe_duration_ms,
            )
        except Exception as e:
            print(f"[pipeline] Parallel subject observation error: {e}", flush=True)
            return None

    leg_started_at = time.monotonic()
    with ThreadPoolExecutor(max_workers=3) as pool:
        transcribe_future = pool.submit(transcribe_task)
        silence_future = pool.submit(silence_task)
        observe_future = pool.submit(observe_task)
        transcript = transcribe_future.result()
        silence_spans = silence_future.result()
        precomputed_observation = observe_future.result()
    leg_ms = round((time.monotonic() - leg_started_at) * 1000)

    words = transcript.get("words") or []
    update("processing", 40)


    # 4) editorial timeline: protected pauses preserved or dead air cut based on silencePolicy.
    silence_policy = str(
        data.get("silencePolicy")
        or (data.get("design") or {}).get("silencePolicy")
        or "preserve"
    ).lower()
    timeline = silence.build_editorial_timeline(
        selected_window=selected_window,
        words=words,
        silence_spans=silence_spans,
        source_duration_ms=source_duration_ms,
        source_width=int(probe.get("width", 0)),
        source_height=int(probe.get("height", 0)),
        silence_policy=silence_policy,
    )
    update("processing", 55)

    # 5) silence-aware chunking with output-timed windows for the burn.
    chunked = chunks.smart_chunk_words(
        words,
        voice_spans=timeline["voiceSpans"],
        protected_ranges=timeline["protectedRanges"],
        timestamp_map=timeline["timestampMap"],
        target_words=int(data.get("targetChunkWords", 3)),
        max_chunk_words=int(data.get("maxChunkWords", 5)),
    )

    # 5b) COLOR GRADING / LOOKS — resolved *after* the transcript has been
    # chunked and *before* the final render is handed off for treatment. The
    # user prompt / design preferences / metadata drive which of the 10
    # cinematic looks is applied. The resolved look manifest rides the render
    # receipt so downstream consumers can see exactly which grade was used.
    design = data.get("design") or None
    look_plan = looks.select_look(
        design=design,
        metadata=data.get("metadata") or {},
        prompt=data.get("prompt"),
    )
    look_plan["lutsAvailable"] = looks.luts_available()
    look_plan["lutFiles"] = looks.discover_luts()
    look_plan["gradeFilter"] = looks.build_grade_filter(
        look_plan,
        video_width=resolution_plan["target"]["width"],
        video_height=resolution_plan["target"]["height"],
    )
    look_manifest_path = looks.write_look_manifest(
        look_plan, str(artifact_root), job_id
    )
    print(
        f"[pipeline] look resolved: {look_plan['lookName']} "
        f"({look_plan['resolution']}) intensity={look_plan['intensity']} "
        f"luts={look_plan['lutsAvailable']}",
        flush=True,
    )

    # Generate the typography plan first. Behind-subject tall-font choices are
    # then positioned from the precomputed MediaPipe observation used as render evidence.
    font_manifest = typography.generate_font_manifest(chunked, design)
    resolved_motif = font_manifest.get("motif")
    if resolved_motif:
        print(
            f"[pipeline] brand motif active: {resolved_motif['name']} "
            f"(primary={resolved_motif['colors']['primary']}, "
            f"base={resolved_motif['colors']['base']}, "
            f"accent={resolved_motif['colors']['accent']})",
            flush=True,
        )
    else:
        print("[pipeline] brand motif: disabled (default dynamic palette mode)", flush=True)

    behind_subject_chunks = [
        chunk for chunk in font_manifest["chunks"]
        if chunk.get("subjectLayering", {}).get("behindSubject")
    ]
    subject_observation = precomputed_observation
    if subject_observation is None:
        try:
            subject_observation = subject_placement.observe_subject(
                str(source_path),
                min(max_clip_ms, int(timeline.get("outputDurationMs", source_duration_ms))),
            )
        except Exception as e:
            print(f"[pipeline] Subject observation fallback failed: {e}", flush=True)
            subject_observation = None
    if subject_observation:
        placements = subject_placement.plan_subject_safe_placements(
            font_manifest["chunks"], subject_observation,
        )
        for manifest_chunk, placement in zip(font_manifest["chunks"], placements):
            manifest_chunk["placement"] = placement
        font_manifest["subjectObservation"] = {
            "status": "completed",
            "frameCount": len(subject_observation.get("frames", [])),
            "detector": subject_observation.get("detector", {}).get("providerId"),
        }
    else:
        font_manifest["subjectObservation"] = {"status": "failed", "frameCount": 0}
    manifest_dir = Path(artifact_root) / "media" / "mini-run" / "renders" / job_id
    manifest_dir.mkdir(parents=True, exist_ok=True)
    manifest_file = manifest_dir / "font_manifest.json"
    manifest_file.write_text(json.dumps(font_manifest, indent=2))

    effective_duration_ms = min(max_clip_ms, int(timeline.get("outputDurationMs", source_duration_ms)))
    for c_idx, c_item in enumerate(chunked):
        if c_idx < len(font_manifest["chunks"]):
            m_chunk = font_manifest["chunks"][c_idx]
            c_item.update(m_chunk)

            out_start = int(c_item.get("startMs", c_item.get("outputStartMs", 0)))
            c_item["startMs"] = out_start
            m_chunk["startMs"] = out_start

            words_list = c_item.get("words", [])
            last_word_end = max(
                [int(w.get("end_ms", 0)) for w in words_list]
                + [int(c_item.get("endMs", c_item.get("outputEndMs", out_start + 1)))]
            )

            fx = c_item.get("fxPreset") or (c_item.get("layers", [{}])[0].get("fxPreset") if c_item.get("layers") else "")
            intrinsic_ms = typography.INTRINSIC_ANIMATION_DURATIONS_MS.get(fx, 750)
            elapsed = max(0, last_word_end - out_start)
            hold_floor_ms = max(500, intrinsic_ms - elapsed)
            inviolable_floor_end = min(effective_duration_ms, last_word_end + hold_floor_ms)

            # Inviolable Hold Law: displayEndMs must be at least inviolable_floor_end
            scheduled_end = int(m_chunk.get("displayEndMs", inviolable_floor_end))
            extended_display_end = min(effective_duration_ms, max(inviolable_floor_end, scheduled_end))

            c_item["displayEndMs"] = extended_display_end
            m_chunk["displayEndMs"] = extended_display_end
            c_item["outputEndMs"] = extended_display_end
            m_chunk["outputEndMs"] = extended_display_end
            c_item["endMs"] = extended_display_end
            m_chunk["endMs"] = extended_display_end

    # Rack-Focus Handoff Gate (Round 12 / Round 14):
    finalize_manifest_and_exits(chunked, font_manifest=font_manifest)

    manifest_file.write_text(json.dumps(font_manifest, indent=2))
    update("processing", 65)

    # 6) Build independent visual and song plans, then compose one causal MP4.
    audio = data.get("audio") or {}
    if not isinstance(audio, dict):
        raise ValueError("audio option must be an object: {music?, cueBus?}")
    output_root = artifact_root / "media" / "mini-run" / "renders" / job_id
    effective_duration_ms = min(max_clip_ms, int(timeline.get("outputDurationMs", source_duration_ms)))
    orchestration_manifest = orchestration.plan_mini_run_orchestration(
        chunks=chunked,
        probe=probe,
        duration_ms=effective_duration_ms,
        design=design,
        subject_observation=subject_observation,
        prompt=data.get("prompt"),
        brand_preferences=data.get("brandPreferences") or (design.get("brandPreferences") if isinstance(design, dict) else None),
    )
    orchestration_file = manifest_dir / "orchestration_manifest.json"
    orchestration_file.write_text(json.dumps(orchestration_manifest, indent=2))

    materialized_song_program = None
    if str(audio.get("songPolicy", "auto")) != "disabled":
        try:
            catalog = song_program.load_song_catalog(audio.get("catalogPath"), storage=r2)
            user_prompt = (
                data.get("prompt")
                or data.get("userPrompt")
                or (audio or {}).get("prompt")
                or (audio or {}).get("userPrompt")
                or (design or {}).get("prompt")
                or (design or {}).get("userPrompt")
            )
            song_design = {
                **(design or {}),
                **audio,
                "prompt": user_prompt,
                "userPrompt": user_prompt,
                "lookId": look_plan.get("lookId") if isinstance(look_plan, dict) else None,
                "lookName": look_plan.get("lookName") if isinstance(look_plan, dict) else None,
            }
            planned_song_program = song_program.plan_song_program(
                catalog=catalog,
                chunks=chunked,
                duration_ms=effective_duration_ms,
                design=song_design,
                prompt=user_prompt,
            )
            materialized_song_program = song_program.materialize_song_program(
                planned_song_program,
                storage=r2,
                cache_dir=str(output_root / "songs"),
            )
        except Exception as e:
            import traceback
            print(f"[pipeline] Song selection skipped / fallback: {e}", flush=True)
            traceback.print_exc()
            try:
                materialized_song_program = song_program.resolve_fallback_local_song(
                    duration_ms=effective_duration_ms,
                    cache_dir=str(output_root / "songs"),
                )
                if materialized_song_program:
                    print(
                        f"[pipeline] Successfully engaged emergency local fallback song: {materialized_song_program.get('events', [{}])[0].get('title')}",
                        flush=True,
                    )
            except Exception as fb_err:
                print(f"[pipeline] Emergency local fallback failed: {fb_err}", flush=True)


    render_receipt = render.render_final_video(
        source_path=str(source_path),
        timeline=timeline,
        chunks=chunked,
        design=design,
        subject_observation=subject_observation,
        audio=audio,
        orchestration=orchestration_manifest,
        song_program=materialized_song_program,
        look_plan=look_plan,
        output_root=str(output_root),
        job_id=job_id,
        slice_executor=slice_executor,
        max_clip_ms=max_clip_ms,
        resolution_plan=resolution_plan,
    )
    update("processing", 85)

    # 7) publish: the artifact already lives on the shared volume; mirror to R2.
    final_path = Path(render_receipt["outputPath"])
    r2_key = f"mini-run/{job_id}/{final_path.name}"
    uploaded = r2.enabled
    output_url = ""
    if r2.enabled:
        r2.upload_file(str(final_path), r2_key, content_type="video/mp4")
        output_url = r2.object_url(r2_key)

    result: Dict[str, Any] = {
        **render_receipt,
        "resolution": render_receipt.get("resolution", resolution_plan),
        "r2Key": r2_key if uploaded else None,
        "outputUrl": output_url or None,
        "pipelineJobId": pipeline_job_id,
        "pipeline": decision["pipeline"],
        "mode": decision["mode"],
        "chunkCount": len(chunked),
        "chunks": chunked,
        "asrWords": words,
        "fontManifest": font_manifest,
        "motif": resolved_motif,
        "orchestrationManifest": orchestration_manifest,
        "lookManifest": look_plan,
        "lookManifestPath": look_manifest_path,
        "songProgram": materialized_song_program,
        "cutRanges": len(timeline["cutCandidates"]),
        "protectedRanges": len(timeline["protectedRanges"]),
        "sourceDurationMs": source_duration_ms,
        "stageTimingsMs": {
            **render_receipt["stageTimingsMs"],
            "analysisParallel": leg_ms,
            "total": round((time.monotonic() - started_at) * 1000),
        },
    }
    update("completed", 100, result=result, error=None)
    return result


# ---------------------------------------------------------------------------
# Convenience: queue + worker wiring
# ---------------------------------------------------------------------------

_worker = None


def _ensure_worker(
    artifact_root: str = DEFAULT_ARTIFACT_ROOT,
    queue_backend: Optional[Any] = None,
) -> jobs.JobWorker:
    """Start a persistent pipeline worker (idempotent)."""
    global _worker
    if _worker is None:
        _worker = build_worker(artifact_root=artifact_root, queue_backend=queue_backend)
        _worker.start()
    return _worker


def build_worker(
    artifact_root: str = DEFAULT_ARTIFACT_ROOT,
    queue_backend: Optional[Any] = None,
    concurrency: int = 2,
) -> jobs.JobWorker:
    """A worker whose handlers drain pipeline jobs end to end."""

    def handler(job_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return execute_pipeline_job(job_id, data, artifact_root=artifact_root)

    return jobs.JobWorker(
        handlers={PIPELINE_JOB_NAME: handler},
        concurrency=concurrency,
        queue_backend=queue_backend,
    )


__all__ = [
    "PIPELINE_JOB_NAME",
    "create_pipeline_job",
    "get_pipeline_job",
    "execute_pipeline_job",
    "resolve_source",
    "transcribe_assemblyai",
    "build_worker",
    "_ensure_worker",
]
