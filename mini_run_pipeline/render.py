"""Final composed render — parallel slice workers, concat, mux.

Mirrors the production MAUL render worker assembly shape:

    1. pre-cut the source along the timestamp map (dead air removed),
    2. concat the parts stream-copy into one compressed timeline,
    3. fan out typography burn-in across parallel slice workers (up to 8),
    4. concat the burned slices into the final encoded MP4,
    5. publish (volume + R2 happen in the pipeline orchestrator).

The typography is the Mini-Run Studio's design engine output: each chunk gets
a drawn caption with the studio's style spec (font, size, color, box, pop-in
alpha) burned into the final H.264 MP4.

Audio bake (added for deterministic production renders): after the concat of
burned slices the pipeline may apply ``render_audio_mix`` — voice taken from
the source stream, a music bed looped with ``-stream_loop -1`` (with
time-based volume fades that work even on compositor-less ffmpeg builds), and
timed SFX cues placed with ``adelay``/``pan`` — all summed through
``amix=inputs=N:duration=first:normalize=0`` into a 48 kHz stereo AAC track
muxed into the same MP4. This replaces the DOM studio's real-time audio capture
for production; the studio stays an editor/preview surface.
"""

from __future__ import annotations

import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

MAX_PARALLEL_SLICES = 8
SLICE_TARGET_MS = 5000  # ~5 seconds of output per slice
FFMPEG_TIMEOUT_SECONDS = 15 * 60

# Audio bake constants (deterministic SFX + soundtrack mix inside the MP4).
SOUND_FX_SUBDIR = "SOUND FX"
AUDIO_SAMPLE_RATE = 48000
AUDIO_BITRATE = "192k"
DEFAULT_MUSIC_GAIN_DB = -14.0
DEFAULT_CUE_GAIN_DB = -8.0
DEFAULT_FADE_IN_MS = 400
DEFAULT_FADE_OUT_MS = 600

_HAS_DRAWTEXT: Optional[bool] = None
_HAS_PAD: Optional[bool] = None

DEFAULT_DESIGN: Dict[str, Any] = {
    "font": "LiberationSans-Regular",
    "fontSize": 72,
    "fontColor": "white",
    "box": True,
    "boxColor": "black@0.5",
    "boxBorderW": 24,
    "xExpr": "(w-text_w)/2",
    "yExpr": "h-280",
    "popMs": 150,
}

_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _fontfile() -> str:
    for candidate in _FONT_CANDIDATES:
        if os.path.exists(candidate):
            return candidate
    return ""


def _escape_drawtext(value: str) -> str:
    """Escape a value for use inside a quoted ffmpeg drawtext option."""
    return (
        value.replace("\\", "\\\\")
        .replace("'", "\u2019")
        .replace(":", "\\:")
        .replace(",", "\\,")
        .replace("%", "\\%")
    )


def _run_ffmpeg(args: List[str], timeout: int = FFMPEG_TIMEOUT_SECONDS) -> None:
    completed = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if completed.returncode != 0:
        stderr = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(f"ffmpeg failed ({' '.join(args[:6])}...): {stderr[-3000:]}")


def _has_drawtext() -> bool:
    """True when the ffmpeg in PATH has the ``drawtext`` filter.

    The Remotion-bundled binary ships without ``drawtext`` (it is not needed for
    its own pipeline), so we cannot assume it exists on every image. On a minimal
    build we degrade to a caption-free render instead of crashing the whole job.
    """
    global _HAS_DRAWTEXT
    if _HAS_DRAWTEXT is not None:
        return _HAS_DRAWTEXT
    supported = False
    try:
        completed = subprocess.run(
            ["ffmpeg", "-hide_banner", "-filters"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if completed.returncode == 0:
            supported = any(
                line.rstrip().endswith("drawtext")
                for line in (completed.stdout or completed.stderr).splitlines()
            )
    except Exception:  # noqa: BLE001 - treat unknown as unavailable
        supported = False
    _HAS_DRAWTEXT = supported
    return supported


def _has_pad() -> bool:
    """True when the ffmpeg in PATH has the ``pad`` filter.

    Like ``drawtext``, ``pad`` is stripped from Remotion's bundled minimal build.
    On a full ffmpeg we center the source on a fixed 9:16 canvas; on a minimal
    build we still scale-to-fit but skip the padding so the render never crashes.
    """
    global _HAS_PAD
    if _HAS_PAD is not None:
        return _HAS_PAD
    supported = False
    try:
        completed = subprocess.run(
            ["ffmpeg", "-hide_banner", "-filters"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if completed.returncode == 0:
            supported = any(
                line.rstrip().endswith("pad")
                for line in (completed.stdout or completed.stderr).splitlines()
            )
    except Exception:  # noqa: BLE001 - treat unknown as unavailable
        supported = False
    _HAS_PAD = supported
    return supported


def build_drawtext_filter(chunk: Dict[str, Any], design: Dict[str, Any]) -> str:
    """One drawtext filter for a chunk's caption window (output-timed)."""
    start_ms = int(chunk.get("outputStartMs", chunk.get("startMs", 0)))
    end_ms = int(chunk.get("outputEndMs", chunk.get("endMs", start_ms)))
    start_sec = start_ms / 1000.0
    pop_ms = int(design.get("popMs", 150))
    fontfile = _fontfile()
    font_part = f"fontfile={fontfile}" if fontfile else f"font={_escape_drawtext(str(design.get('font', 'Sans')))}"
    text = _escape_drawtext(str(chunk.get("text", "")))
    box_part = (
        f":box=1:boxcolor={_escape_drawtext(str(design.get('boxColor', 'black@0.5')))}"
        f":boxborderw={int(design.get('boxBorderW', 24))}"
        if design.get("box", True)
        else ""
    )
    enable = f"between(t,{start_sec:.3f},{end_ms / 1000.0:.3f})"
    alpha = (
        f"if(lt(t,{start_sec:.3f}),0,"
        f"if(lt(t,{start_sec + pop_ms / 1000.0:.3f}),"
        f"(t-{start_sec:.3f})/{max(0.05, pop_ms / 1000.0):.3f},1))"
    )
    return (
        f"drawtext={font_part}"
        f":text='{text}'"
        f":fontsize={int(design.get('fontSize', 72))}"
        f":fontcolor={_escape_drawtext(str(design.get('fontColor', 'white')))}"
        f"{box_part}"
        f":x={design.get('xExpr', '(w-text_w)/2')}"
        f":y={design.get('yExpr', 'h-280')}"
        f":alpha='{alpha}'"
        f":enable='{enable}'"
    )


def cut_part(
    source_path: str,
    source_start_ms: int,
    source_end_ms: int,
    output_path: str,
) -> Dict[str, Any]:
    """Cut one timestamp-map segment out of the source (frame-exact re-encode)."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    duration = max(0.05, (source_end_ms - source_start_ms) / 1000.0)
    _run_ffmpeg(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-ss", f"{source_start_ms / 1000.0:.3f}", "-t", f"{duration:.3f}",
            "-i", str(source_path),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            str(output_path),
        ]
    )
    return {"sourceStartMs": source_start_ms, "sourceEndMs": source_end_ms, "file": str(output_path)}


def _concat_files(paths: List[str], output_path: str) -> None:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as handle:
        handle.write("".join(f"file '{path}'\n" for path in paths))
        list_path = handle.name
    try:
        _run_ffmpeg(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-f", "concat", "-safe", "0", "-i", str(list_path),
                "-c", "copy", "-y", str(output_path),
            ]
        )
    finally:
        Path(list_path).unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Audio bake: deterministic SFX + soundtrack mix (voice, music bed, SFX cues)
# ---------------------------------------------------------------------------
#
# Contract for the ``audio`` render option:
#
#     "audio": {
#         "music": {"url", "gainDb"=-14.0, "fadeInMs"=400, "fadeOutMs"=600},
#         "cueBus": [{"atMs", "url", "gainDb"=-8.0, "pan"=0.0, "durationMs"=0}]
#     }
#
# ``url`` may be a bare filename resolved against the ``SOUND FX`` library
# (backend root, Modal's ``/opt/prometheus``, or ``MINI_RUN_SFX_ROOT``), an
# absolute local path, or an http(s) URL that is downloaded into a tempfile.
# Music is looped with ``-stream_loop -1``; the voice track is pulled from the
# source video's audio stream (a silent filler replaces it when absent). The
# graph only uses filters present in both the minimal Remotion ffmpeg and a
# full build: ``aformat``, ``volume`` (with a time expression for fades —
# there is no ``afade`` on the minimal build), ``adelay``, ``pan``, ``atrim``,
# ``asetpts`` and ``amix``. No ``alimiter``/``loudnorm`` dependency either.
# The whole mix is a 48 kHz stereo AAC track muxed into the same output MP4.


def _has_audio_stream(path: str) -> bool:
    """True when the file at ``path`` contains an audio stream.

    Uses ``ffmpeg -i`` probe output (ffprobe is absent on the minimal build).
    """
    try:
        completed = subprocess.run(
            ["ffmpeg", "-hide_banner", "-i", str(path)],
            capture_output=True,
            text=True,
            timeout=60,
        )
    except Exception:  # noqa: BLE001 - treat probe failure as no audio
        return False
    return "Audio:" in (completed.stderr or "")


def _resolve_audio_url(url: str) -> str:
    """Resolve a music/SFX asset reference to a local file path.

    Accepts an http(s) URL (downloaded to a tempfile), an absolute local path,
    or a bare filename looked up against the ``SOUND FX`` library. Raises
    ``FileNotFoundError`` with the candidate roots when nothing matches so a
    bad asset fails the job loudly instead of silently dropping audio.
    """
    raw = str(url).strip()
    if not raw:
        raise ValueError("audio asset url is empty")
    parsed = urllib.parse.urlparse(raw)
    if parsed.scheme in ("http", "https"):
        suffix = Path(urllib.parse.unquote(parsed.path)).suffix or ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
            dest = Path(handle.name)
        urllib.request.urlretrieve(raw, str(dest))
        return str(dest)
    candidate = Path(raw)
    if candidate.is_absolute() and candidate.exists():
        return str(candidate)
    backend_root = Path(__file__).resolve().parent.parent
    roots = [
        os.getenv("MINI_RUN_SFX_ROOT", ""),
        str(backend_root / SOUND_FX_SUBDIR),
        str(Path("/opt/prometheus") / SOUND_FX_SUBDIR),  # Modal container mount
        str(Path.cwd() / SOUND_FX_SUBDIR),
    ]
    rel = raw.lstrip("/")
    for root in roots:
        if not root:
            continue
        candidate = Path(root) / rel
        if candidate.exists():
            return str(candidate)
    raise FileNotFoundError(
        f"audio asset not found: {raw!r} (tried absolute path, MINI_RUN_SFX_ROOT, "
        f"{backend_root / SOUND_FX_SUBDIR}, /opt/prometheus/{SOUND_FX_SUBDIR}, cwd/{SOUND_FX_SUBDIR})"
    )


def _linear_pan_gains(pan: float) -> Tuple[float, float]:
    """Return ``(left_gain, right_gain)`` for a linear pan in [-1, 1].

    ``pan=-1`` hard left, ``0`` center (full level), ``+1`` hard right.
    """
    p = max(-1.0, min(1.0, float(pan)))
    return (1.0 - p) / 2.0, (1.0 + p) / 2.0


def _fade_volume_expr(duration_s: float, fade_in_s: float, fade_out_s: float) -> Optional[str]:
    """Time-based ``volume`` expression implementing fades, or None if unused.

    ``afade`` is unavailable on the minimal Remotion ffmpeg build, so the fades
    are done with a per-frame ``volume`` expression (``t`` is in seconds).
    """
    fi = min(max(0.0, fade_in_s), max(0.0, duration_s - 0.1))
    fo = min(max(0.0, fade_out_s), max(0.0, duration_s - 0.1))
    if fi <= 0.001 and fo <= 0.001:
        return None
    if fi > 0.001 and fo > 0.001:
        return (
            f"if(lt(t,{fi:.3f}),t/{fi:.3f},"
            f"if(gt(t,{duration_s - fo:.3f}),max(0,({duration_s:.3f}-t)/{fo:.3f}),1))"
        )
    if fi > 0.001:
        return f"if(lt(t,{fi:.3f}),t/{fi:.3f},1)"
    return f"if(gt(t,{duration_s - fo:.3f}),max(0,({duration_s:.3f}-t)/{fo:.3f}),1)"


def build_audio_mix_filter_complex(
    duration_ms: int,
    has_voice: bool,
    music: Optional[Dict[str, Any]],
    cues: List[Dict[str, Any]],
) -> str:
    """Build the full ``-filter_complex`` string for the audio bake.

    Input ordering must match ``render_audio_mix``'s command line: ``[0:a]`` is
    the video file's own audio (voice), ``[1:a]`` the (looped) music bed, and
    ``[2:a]``.. each SFX cue. ``duration=first`` in the final ``amix`` anchors
    the output to the voice timeline, so the mix always ends with the render.
    """
    duration_s = max(0.1, duration_ms / 1000.0)
    parts: List[str] = []
    mix_inputs: List[str] = []
    if has_voice:
        parts.append("[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asetpts=N/SR/TB[voice]")
    else:
        # No source audio: anchor the mix with a silent filler so the bed and
        # cues still fill the full render duration.
        parts.append(
            f"anullsrc=r=48000:cl=stereo,atrim=0:{duration_s:.3f},asetpts=N/SR/TB[voice]"
        )
    mix_inputs.append("[voice]")

    next_input = 1
    if music:
        gain_db = float(music.get("gainDb", DEFAULT_MUSIC_GAIN_DB))
        fade = _fade_volume_expr(
            duration_s,
            int(music.get("fadeInMs", DEFAULT_FADE_IN_MS)) / 1000.0,
            int(music.get("fadeOutMs", DEFAULT_FADE_OUT_MS)) / 1000.0,
        )
        chain = f"[{next_input}:a]aformat=sample_rates=48000:channel_layouts=stereo"
        if fade:
            chain += f",volume='{fade}':eval=frame"
        chain += f",volume={gain_db:g}dB,atrim=0:{duration_s:.3f}[music]"
        parts.append(chain)
        mix_inputs.append("[music]")
        next_input += 1

    for cue in cues:
        at_ms = max(0, int(cue.get("atMs", 0)))
        gain_db = float(cue.get("gainDb", DEFAULT_CUE_GAIN_DB))
        gl, gr = _linear_pan_gains(float(cue.get("pan", 0.0)))
        chain = (
            f"[{next_input}:a]aformat=sample_rates=48000:channel_layouts=stereo"
            f",volume={gain_db:g}dB"
        )
        dur_ms = max(0, int(cue.get("durationMs", 0)))
        if dur_ms > 0:
            chain += f",atrim=0:{min(dur_ms, int(duration_ms)) / 1000.0:.3f}"
        chain += (
            f",adelay={at_ms}:all=1"
            f",pan=stereo|c0={gl:.4f}*c0+{gl:.4f}*c1|c1={gr:.4f}*c0+{gr:.4f}*c1"
            f"[cue{next_input}]"
        )
        parts.append(chain)
        mix_inputs.append(f"[cue{next_input}]")
        next_input += 1

    parts.append(
        "".join(mix_inputs)
        + f"amix=inputs={len(mix_inputs)}:duration=first:dropout_transition=0:normalize=0[aout]"
    )
    return ";".join(parts)


def render_audio_mix(
    video_path: str,
    audio_spec: Dict[str, Any],
    output_path: str,
    duration_ms: int,
) -> Dict[str, Any]:
    """Bake voice + music bed + timed SFX cues into a single MP4 audio track.

    Muxes the video stream through ``-c:v copy`` and replaces the audio with the
    48 kHz stereo AAC mix, so the result is one self-contained MP4 (typography
    and combined SFX/soundtrack together). Returns a small receipt dict.
    """
    started_at = time.monotonic()
    music = audio_spec.get("music") or None
    raw_cues = audio_spec.get("cueBus") or []
    cues = [cue for cue in raw_cues if isinstance(cue, dict) and cue.get("url")]
    if not music and not cues:
        return {"applied": False, "reason": "audio spec has no music or cueBus entries"}

    resolved_music = _resolve_audio_url(music["url"]) if music else None
    resolved_cues: List[Dict[str, Any]] = []
    for cue in cues:
        resolved_cues.append({**cue, "_path": _resolve_audio_url(cue["url"])})

    has_voice = _has_audio_stream(video_path)
    filter_complex = build_audio_mix_filter_complex(duration_ms, has_voice, music, resolved_cues)

    args = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video_path)]
    if resolved_music:
        args += ["-stream_loop", "-1", "-i", resolved_music]
    for cue in resolved_cues:
        args += ["-i", cue["_path"]]
    args += [
        "-filter_complex", filter_complex,
        "-map", "0:v",
        "-map", "[aout]",
        "-t", f"{max(0.1, duration_ms / 1000.0):.3f}",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", AUDIO_BITRATE,
        "-movflags", "+faststart",
        str(output_path),
    ]
    _run_ffmpeg(args)

    return {
        "applied": True,
        "voice": has_voice,
        "music": music["url"] if music else None,
        "cueCount": len(resolved_cues),
        "outputPath": str(output_path),
        "elapsedMs": round((time.monotonic() - started_at) * 1000),
    }


def burn_slice(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Burn typography into one output-time slice of the compressed timeline.

    ``payload`` = ``{inputPath, outputPath, sliceIndex, startMs, endMs,
    chunks, design}`` where chunks carry output-timed windows. Audio is copied
    through untouched so the final concat keeps the perfect audio timeline.
    """
    started_at = time.monotonic()
    input_path = payload["inputPath"]
    output_path = payload["outputPath"]
    start_ms = int(payload["startMs"])
    end_ms = int(payload["endMs"])
    chunks = payload.get("chunks") or []
    design = {**DEFAULT_DESIGN, **(payload.get("design") or {})}

    # On a compositor-less ffmpeg (no ``drawtext``) degrade to a caption-free
    # slice rather than failing the whole job; Modal's full ffmpeg burns text.
    drawtext_available = _has_drawtext()
    filters = [
        build_drawtext_filter(chunk, design)
        for chunk in (chunks if drawtext_available else [])
        if int(chunk.get("outputStartMs", 0)) < end_ms
        and int(chunk.get("outputEndMs", chunk.get("outputStartMs", 0))) > start_ms
    ]
    # Optionally normalize to a fixed portrait canvas (9:16) so every short has
    # the same output geometry regardless of the source's native resolution. The
    # caption position expressions (x/y) evaluate against this padded canvas.
    pre_filters: List[str] = []
    canvas_w = design.get("canvasWidth")
    canvas_h = design.get("canvasHeight")
    if canvas_w and canvas_h:
        pre_filters.append(
            f"scale={int(canvas_w)}:{int(canvas_h)}:force_original_aspect_ratio=decrease"
        )
        if _has_pad():
            pre_filters.append(
                f"pad={int(canvas_w)}:{int(canvas_h)}:(ow-iw)/2:(oh-ih)/2:color=black"
            )
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    args = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-ss", f"{start_ms / 1000.0:.3f}",
        "-t", f"{max(0.05, (end_ms - start_ms) / 1000.0):.3f}",
        "-i", str(input_path),
    ]
    vf = [*pre_filters, *filters]
    if vf:
        args += ["-vf", ",".join(vf)]
    args += [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-c:a", "copy",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(output_path),
    ]
    _run_ffmpeg(args)
    return {
        "sliceIndex": int(payload["sliceIndex"]),
        "startMs": start_ms,
        "endMs": end_ms,
        "outputPath": str(output_path),
        "elapsedMs": round((time.monotonic() - started_at) * 1000),
    }


def render_final_video(
    source_path: str,
    timeline: Dict[str, Any],
    chunks: List[Dict[str, Any]],
    design: Optional[Dict[str, Any]] = None,
    audio: Optional[Dict[str, Any]] = None,
    output_root: str = "/tmp/mini-run-render",
    job_id: str = "job",
    max_parallel: int = MAX_PARALLEL_SLICES,
    slice_executor: Optional[SliceExecutor] = None,
) -> Dict[str, Any]:
    """Compose the final encoded MP4 with typography burned in.

    Returns receipts + stage timings identical in shape to the production MAUL
    render worker: ``stageTimingsMs`` with fanout/concat/slice min/max/avg/total.
    When ``audio`` (see ``render_audio_mix``) is supplied the final MP4 also
    carries the baked voice + music bed + SFX cue mix (``audioMix`` receipt).
    """
    started_at = time.monotonic()
    output_root = Path(output_root)
    output_root.mkdir(parents=True, exist_ok=True)
    design = {**DEFAULT_DESIGN, **(design or {})}
    timestamp_map = timeline.get("timestampMap") or []
    output_duration_ms = int(timeline.get("outputDurationMs", 0)) or (
        timestamp_map[-1]["outputEndMs"] if timestamp_map else 0
    )
    keep_segments = [segment for segment in timestamp_map if segment["mode"] != "cut"]

    # 1) parallel pre-cut along the timestamp map (dead air removed).
    cut_started_at = time.monotonic()
    parts_dir = output_root / "parts"
    cut_payloads = [
        {
            "source_path": source_path,
            "source_start_ms": segment["sourceStartMs"],
            "source_end_ms": segment["sourceEndMs"],
            "output_path": str(parts_dir / f"part-{index:04d}.mp4"),
        }
        for index, segment in enumerate(keep_segments)
        if segment["sourceEndMs"] > segment["sourceStartMs"]
    ]
    with ThreadPoolExecutor(max_workers=max_parallel) as pool:
        part_receipts = list(
            pool.map(
                lambda item: cut_part(
                    item["source_path"],
                    item["source_start_ms"],
                    item["source_end_ms"],
                    item["output_path"],
                ),
                cut_payloads,
            )
        )
    cut_ms = round((time.monotonic() - cut_started_at) * 1000)

    # 2) concat the cleaned parts stream-copy -> one compressed timeline.
    compressed_path = output_root / "compressed.mp4"
    _concat_files([receipt["file"] for receipt in part_receipts], str(compressed_path))

    # 3) fan out typography burn across parallel slice workers.
    fanout_started_at = time.monotonic()
    slice_count = min(
        max_parallel,
        max(1, math.ceil(output_duration_ms / SLICE_TARGET_MS)),
    )
    slices_dir = output_root / "slices"
    slice_ms = max(1, math.ceil(output_duration_ms / slice_count))
    slice_payloads = []
    for slice_index in range(slice_count):
        start_ms = slice_index * slice_ms
        end_ms = min(output_duration_ms, start_ms + slice_ms)
        slice_payloads.append(
            {
                "inputPath": str(compressed_path),
                "outputPath": str(slices_dir / f"slice-{slice_index:04d}.mp4"),
                "sliceIndex": slice_index,
                "startMs": start_ms,
                "endMs": end_ms,
                "chunks": chunks,
                "design": design,
            }
        )
    executor = slice_executor or (lambda payloads: _thread_pool_slices(payloads, max_parallel))
    receipts = executor(slice_payloads)
    fanout_ms = round((time.monotonic() - fanout_started_at) * 1000)

    # 4) concat the burned slices -> one timeline MP4.
    concat_started_at = time.monotonic()
    timeline_path = output_root / f"mini_run_{job_id}-timeline.mp4"
    _concat_files(
        [receipt["outputPath"] for receipt in sorted(receipts, key=lambda r: r["sliceIndex"])],
        str(timeline_path),
    )
    concat_ms = round((time.monotonic() - concat_started_at) * 1000)

    # 5) optional audio bake: deterministic SFX + soundtrack mix, muxed into the
    #    same MP4 (voice + looped music bed + timed SFX cues -> 48k stereo AAC).
    audio_mix_started_at = time.monotonic()
    final_path = timeline_path
    audio_receipt = None
    if audio and (audio.get("music") or audio.get("cueBus")):
        final_path = output_root / f"mini_run_{job_id}-final.mp4"
        audio_receipt = render_audio_mix(
            str(timeline_path), audio, str(final_path), output_duration_ms
        )
    audio_mix_ms = round((time.monotonic() - audio_mix_started_at) * 1000)

    timings: Dict[str, Any] = {
        "cut": cut_ms,
        "concat": concat_ms,
        "fanout": fanout_ms,
        "sliceMin": min(receipt["elapsedMs"] for receipt in receipts),
        "sliceMax": max(receipt["elapsedMs"] for receipt in receipts),
        "sliceAverage": round(sum(receipt["elapsedMs"] for receipt in receipts) / len(receipts)),
        "sliceCount": len(receipts),
        "total": round((time.monotonic() - started_at) * 1000),
    }
    if audio_receipt is not None:
        timings["audioMix"] = audio_mix_ms
    result: Dict[str, Any] = {
        "pipeline": "minirun",
        "jobId": job_id,
        "status": "completed",
        "outputFile": final_path.name,
        "outputPath": str(final_path),
        "encoder": "libx264",
        "frameSlices": len(receipts),
        "stageTimingsMs": timings,
    }
    if audio_receipt is not None:
        result["audioMix"] = audio_receipt
    return result


SliceExecutor = Callable[[List[Dict[str, Any]]], List[Dict[str, Any]]]


def _thread_pool_slices(payloads: List[Dict[str, Any]], max_parallel: int) -> List[Dict[str, Any]]:
    with ThreadPoolExecutor(max_workers=max_parallel) as pool:
        return list(pool.map(burn_slice, payloads))
