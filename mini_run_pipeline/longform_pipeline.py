"""Long-form batch pipeline for Prometheus Mini-Run.

Accepts a 40-minute to 1-hour source video and:

1.  Transcribes the FULL video (AssemblyAI, no duration cap).
2.  Uses the viral selector LLM to choose N best windows (default 3, max 10).
3.  Dispatches N concurrent ``run_mini_run`` invocations on Modal — one per
    window — each with:
      - the appropriate ``selectedWindow`` (start/end Ms from the LLM)
      - ``maxClipMs`` override so per-clip duration is NOT capped at 30 s
4.  Waits for all N renders and returns a batch receipt.

The per-clip duration is driven by the viral selector (30 s – 5 min).  The
pipeline enforces no hard 30 s cap for clips produced through this path.

Usage (local test)::

    from mini_run_pipeline import longform_pipeline
    result = longform_pipeline.execute_longform_batch(
        source_path="/path/to/1hr-podcast.mp4",
        n_clips=3,
        prompt="Highlight moments about stoicism and discipline",
    )

Modal dispatch::

    Use the ``run_longform_batch`` Modal function defined in modal_mini_run.py.
"""

from __future__ import annotations

import os
import time
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from . import pipeline as pipeline_mod
from . import silence as silence_mod
from . import ids as ids_mod
from .viral_selector import select_viral_windows

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_N_CLIPS = 4
MAX_N_CLIPS = 10
LONGFORM_MAX_CLIP_MS = 300_000   # 5-minute ceiling per clip


# ---------------------------------------------------------------------------
# Full-source transcription (no duration cap)
# ---------------------------------------------------------------------------

def transcribe_full_source(
    source_path: Path,
    api_key: str,
) -> Dict[str, Any]:
    """Transcribe the entire source file; returns ``{words, text, provider}``."""
    return pipeline_mod.transcribe_assemblyai(api_key, source_path)


# ---------------------------------------------------------------------------
# Per-clip job execution (calls execute_pipeline_job with relaxed duration cap)
# ---------------------------------------------------------------------------

def _execute_single_clip(
    *,
    job_id: str,
    source_path: str,
    words: List[Dict[str, Any]],
    window: Dict[str, Any],
    design: Optional[Dict[str, Any]],
    audio: Optional[Dict[str, Any]],
    prompt: Optional[str],
    brand_preferences: Optional[Dict[str, Any]],
    artifact_root: str,
    slice_executor: Optional[Callable],
) -> Dict[str, Any]:
    """Execute one mini-run pipeline job for a single viral window clip."""
    clip_index = window.get("rank", 1)
    source_start_ms = int(window["sourceStartMs"])
    source_end_ms = int(window["sourceEndMs"])
    duration_ms = source_end_ms - source_start_ms

    # Filter words to only those inside this window
    window_words = [
        w for w in words
        if int(w.get("end_ms", w.get("end", 0))) > source_start_ms
        and int(w.get("start_ms", w.get("start", 0))) < source_end_ms
    ]

    data: Dict[str, Any] = {
        "jobId": job_id,
        "source": {"path": str(source_path)},
        "metadata": {"pipeline": "minirun", "jobName": f"longform_clip_{clip_index}"},
        "design": design or {},
        "audio": audio or {},
        "prompt": prompt,
        "brandPreferences": brand_preferences,
        "selectedWindow": {
            "sourceStartMs": source_start_ms,
            "sourceEndMs": source_end_ms,
        },
        # Longform flag — tells pipeline.py NOT to cap at 30 s
        "maxClipMs": LONGFORM_MAX_CLIP_MS,
        # Pre-filtered words for this window (saves re-transcription)
        "_precomputedWords": window_words,
        # Viral metadata riders for downstream consumers
        "viralMetadata": {
            "viralityScore": window.get("viralityScore"),
            "hook": window.get("hook"),
            "reason": window.get("reason"),
            "rank": clip_index,
        },
    }

    print(
        f"[longform_pipeline] Clip #{clip_index} executing "
        f"({source_start_ms//1000}s - {source_end_ms//1000}s, "
        f"duration {duration_ms//1000}s, jobId={job_id})",
        flush=True,
    )

    return pipeline_mod.execute_pipeline_job(
        job_id=job_id,
        data=data,
        artifact_root=artifact_root,
        slice_executor=slice_executor,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def execute_longform_batch(
    source_path: str,
    *,
    n_clips: int = DEFAULT_N_CLIPS,
    prompt: Optional[str] = None,
    brand_preferences: Optional[Dict[str, Any]] = None,
    design: Optional[Dict[str, Any]] = None,
    audio: Optional[Dict[str, Any]] = None,
    artifact_root: str = "/tmp/mini-run",
    job_id_prefix: Optional[str] = None,
    slice_executor: Optional[Callable] = None,
    assemblyai_api_key: Optional[str] = None,
    precomputed_words: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Full longform batch: transcribe → viral select → N concurrent renders.

    Args:
        source_path: Absolute path to the long-form source video.
        n_clips: Number of clips to produce (1–10; default 3).
        prompt: User prompt to steer viral selection.
        brand_preferences: Brand prefs dict.
        design: Remotion design dict (aspectRatio, typography, etc.)
        audio: Audio options dict (songPolicy, etc.)
        artifact_root: Base directory for rendered output.
        job_id_prefix: Prefix for generated job IDs.
        slice_executor: Optional custom Modal/Lambda slice dispatcher.
        assemblyai_api_key: AssemblyAI key (falls back to env).
        precomputed_words: Optional pre-existing word list (skips transcription).

    Returns:
        ``{batchId, clipCount, clips: [...], stageTimingsMs}``
        Each entry in ``clips`` is a full render receipt from
        ``execute_pipeline_job`` augmented with ``viralMetadata``.
    """
    started_at = time.monotonic()
    n_clips = max(1, min(MAX_N_CLIPS, n_clips))
    api_key = assemblyai_api_key or os.getenv("ASSEMBLYAI_API_KEY", "")
    prefix = job_id_prefix or f"longform_{int(time.time())}"
    source = Path(source_path)

    if not source.exists():
        raise FileNotFoundError(f"Long-form source not found: {source_path}")

    # ------------------------------------------------------------------
    # Stage 1: Full transcription (no 30 s cap)
    # ------------------------------------------------------------------
    t0 = time.monotonic()
    if precomputed_words is not None:
        words = precomputed_words
        transcribe_ms = 0
        print(
            f"[longform_pipeline] Using {len(words)} precomputed words for: {source.name}",
            flush=True,
        )
    else:
        print(
            f"[longform_pipeline] Transcribing full source: {source.name} …",
            flush=True,
        )
        transcript = transcribe_full_source(source, api_key)
        words = transcript.get("words") or []
        transcribe_ms = round((time.monotonic() - t0) * 1000)
        print(
            f"[longform_pipeline] Transcription done: {len(words)} words "
            f"in {transcribe_ms}ms",
            flush=True,
        )

    # ------------------------------------------------------------------
    # Stage 2: Viral window selection via LLM
    # ------------------------------------------------------------------
    t1 = time.monotonic()
    windows = select_viral_windows(
        words=words,
        n=n_clips,
        prompt=prompt,
        brand_preferences=brand_preferences,
    )
    select_ms = round((time.monotonic() - t1) * 1000)
    print(
        f"[longform_pipeline] Viral selection done: {len(windows)} windows "
        f"in {select_ms}ms",
        flush=True,
    )

    # ------------------------------------------------------------------
    # Stage 3: Concurrent render jobs
    # ------------------------------------------------------------------
    t2 = time.monotonic()
    batch_id = f"{prefix}_batch"
    clip_job_ids = [f"{prefix}_clip{w['rank']}" for w in windows]

    results: List[Optional[Dict[str, Any]]] = [None] * len(windows)
    errors: List[Optional[str]] = [None] * len(windows)

    with ThreadPoolExecutor(max_workers=len(windows)) as pool:
        future_map = {
            pool.submit(
                _execute_single_clip,
                job_id=clip_job_ids[i],
                source_path=str(source),
                words=words,
                window=windows[i],
                design=design,
                audio=audio,
                prompt=prompt,
                brand_preferences=brand_preferences,
                artifact_root=artifact_root,
                slice_executor=slice_executor,
            ): i
            for i in range(len(windows))
        }
        for fut in as_completed(future_map):
            idx = future_map[fut]
            try:
                results[idx] = fut.result()
            except Exception as exc:
                errors[idx] = str(exc)
                print(
                    f"[longform_pipeline] Clip #{windows[idx]['rank']} FAILED: {exc}",
                    flush=True,
                )

    render_ms = round((time.monotonic() - t2) * 1000)
    total_ms = round((time.monotonic() - started_at) * 1000)

    # Merge viral metadata into each clip result
    clips: List[Dict[str, Any]] = []
    for i, (window, result, error) in enumerate(zip(windows, results, errors)):
        clip_entry: Dict[str, Any] = {
            "clipIndex": i,
            "rank": window["rank"],
            "jobId": clip_job_ids[i],
            "window": {
                "sourceStartMs": window["sourceStartMs"],
                "sourceEndMs": window["sourceEndMs"],
                "durationMs": window["durationMs"],
            },
            "viralMetadata": {
                "viralityScore": window.get("viralityScore"),
                "hook": window.get("hook"),
                "reason": window.get("reason"),
            },
            "success": result is not None,
            "error": error,
        }
        if result:
            clip_entry.update({
                "outputPath": result.get("outputPath"),
                "outputUrl": result.get("outputUrl"),
                "r2Key": result.get("r2Key"),
                "chunkCount": result.get("chunkCount"),
                "stageTimingsMs": result.get("stageTimingsMs"),
            })
        clips.append(clip_entry)

    succeeded = sum(1 for c in clips if c["success"])
    print(
        f"[longform_pipeline] Batch complete: {succeeded}/{len(clips)} succeeded, "
        f"total {total_ms}ms",
        flush=True,
    )

    return {
        "batchId": batch_id,
        "sourcePath": str(source),
        "clipCount": len(clips),
        "succeeded": succeeded,
        "clips": clips,
        "stageTimingsMs": {
            "transcribe": transcribe_ms,
            "viralSelect": select_ms,
            "render": render_ms,
            "total": total_ms,
        },
    }


# ---------------------------------------------------------------------------
# Modal-friendly variant: accepts a payload dict (mirrors run_mini_run pattern)
# ---------------------------------------------------------------------------

def execute_longform_batch_from_payload(
    payload: Dict[str, Any],
    artifact_root: str = "/data",
    slice_executor: Optional[Callable] = None,
) -> Dict[str, Any]:
    """Entry point for the Modal ``run_longform_batch`` function.

    Payload keys::
        source           - dict with path/url/inputUrl (same as render endpoint)
        nClips           - int, 1–10 (default 3)
        prompt           - optional string
        brandPreferences - optional dict
        design           - optional dict
        audio            - optional dict
        jobIdPrefix      - optional string

    Returns the same receipt as ``execute_longform_batch``.
    """
    from . import pipeline as pm

    source_raw = payload.get("source") or {}
    if isinstance(source_raw, str):
        source_raw = {"path": source_raw}

    source_path_str, _ = pm.resolve_source(source_raw, artifact_root=artifact_root)

    return execute_longform_batch(
        source_path=str(source_path_str),
        n_clips=int(payload.get("nClips", DEFAULT_N_CLIPS)),
        prompt=payload.get("prompt"),
        brand_preferences=payload.get("brandPreferences") or payload.get("brand_preferences"),
        design=payload.get("design"),
        audio=payload.get("audio"),
        artifact_root=artifact_root,
        job_id_prefix=payload.get("jobIdPrefix"),
        slice_executor=slice_executor,
        assemblyai_api_key=os.getenv("ASSEMBLYAI_API_KEY", ""),
        precomputed_words=payload.get("precomputedWords") or payload.get("words"),
    )
