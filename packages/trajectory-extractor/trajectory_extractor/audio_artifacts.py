from __future__ import annotations

import json
import math
import re
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

AUDIO_ARTIFACT_SCHEMA_VERSION = "audio-artifact-v1"
AUDIO_ARTIFACT_ANALYZER_VERSION = "audio-artifacts-0.2.0"


@dataclass(frozen=True)
class AudioArtifactCacheResult:
    artifact: dict
    path: Path
    cache_hit: bool


def audio_features_for_window(
    artifact: dict,
    *,
    start_seconds: float,
    end_seconds: float,
) -> dict:
    """Project a persisted audio artifact into one trajectory audio window."""
    if end_seconds <= start_seconds:
        raise ValueError("window end_seconds must be greater than start_seconds")
    if artifact.get("is_fallback"):
        return _default_audio_feature_values()

    duration = end_seconds - start_seconds
    energy_values = _window_numeric_values(
        artifact,
        start_seconds,
        end_seconds,
        key="rms",
    )
    music_values = _window_numeric_values(
        artifact,
        start_seconds,
        end_seconds,
        key="music_energy",
    )
    vocal_values = _window_numeric_values(
        artifact,
        start_seconds,
        end_seconds,
        key="vocal_energy",
    )
    music_basis = music_values or energy_values
    max_music = max(music_basis, default=0.0)
    min_energy = min(energy_values, default=0.0)
    sfx_events = _events_in_window(
        artifact.get("sfx_events", []),
        start_seconds,
        end_seconds,
    )
    onset_count = len(
        _events_in_window(artifact.get("onsets", []), start_seconds, end_seconds)
    )

    return {
        "sfx_class": _dominant_sfx_class(sfx_events),
        "sfx_count": min(len(sfx_events), 4),
        "music_presence": max_music > 0.04,
        "music_energy": _energy_bucket(max_music, 0.01, 0.25),
        "beat_proximity": _beat_proximity(artifact, start_seconds, end_seconds),
        "ducking_active": _ducking_active(artifact, start_seconds, end_seconds),
        "has_silence_gap": bool(energy_values) and min_energy < 0.005,
        "vocal_energy": _energy_bucket(max(vocal_values, default=0.0), 0.01, 0.25),
        "spectral_brightness": "low",
        "transient_density": _energy_bucket(onset_count / duration, 0.0, 3.0),
    }

def build_wav_audio_artifact(
    *,
    source_hash: str,
    wav_path: str | Path,
    energy_window_seconds: float = 1.0,
    onset_threshold: float = 0.1,
) -> dict:
    """Build an analyzed artifact from an uncompressed PCM WAV file."""
    samples, sample_rate, channels, sample_width = _read_wav_mono_samples(wav_path)
    artifact = build_analyzed_pcm_audio_artifact(
        source_hash=source_hash,
        samples=samples,
        sample_rate=sample_rate,
        energy_window_seconds=energy_window_seconds,
        onset_threshold=onset_threshold,
    )
    artifact["media"] = {
        "source": "wav",
        "sample_rate": sample_rate,
        "channels": channels,
        "sample_width_bytes": sample_width,
    }
    return artifact


def build_analyzed_pcm_audio_artifact(
    *,
    source_hash: str,
    samples: list[float],
    sample_rate: int | float,
    energy_window_seconds: float = 1.0,
    onset_threshold: float = 0.1,
) -> dict:
    """Build a deterministic artifact from decoded mono PCM samples."""
    if not source_hash:
        raise ValueError("source_hash is required")
    if not samples:
        raise ValueError("samples are required")
    if sample_rate <= 0:
        raise ValueError("sample_rate must be positive")
    if energy_window_seconds <= 0:
        raise ValueError("energy_window_seconds must be positive")

    duration_seconds = len(samples) / float(sample_rate)
    onsets, suppressed_onset_count = _pcm_onsets(samples, sample_rate, onset_threshold)
    beat_grid = [
        {
            "beat_index": index,
            "time_seconds": onset["time_seconds"],
            "downbeat": index % 4 == 0,
            "source": "pcm_onset",
        }
        for index, onset in enumerate(onsets)
    ]
    warnings = [
        "sfx_detection_unavailable",
        "voice_music_separation_unavailable",
        "ducking_unavailable",
    ]
    if not beat_grid:
        warnings.append("beat_grid_insufficient_onsets")
    if suppressed_onset_count:
        warnings.append("pcm_onsets_rate_limited")

    return {
        "schema_version": AUDIO_ARTIFACT_SCHEMA_VERSION,
        "analyzer_version": AUDIO_ARTIFACT_ANALYZER_VERSION,
        "source_hash": source_hash,
        "duration_seconds": _round_time(duration_seconds),
        "analysis_mode": "analyzed_pcm",
        "is_fallback": False,
        "beat_grid": beat_grid,
        "downbeats": [
            beat["time_seconds"] for beat in beat_grid if beat["downbeat"]
        ],
        "onsets": onsets,
        "energy": {
            "source": "pcm_rms",
            "window_seconds": _round_time(energy_window_seconds),
            "windows": _pcm_energy_windows(samples, sample_rate, energy_window_seconds),
        },
        "sections": [
            {
                "start_seconds": 0.0,
                "end_seconds": _round_time(duration_seconds),
                "label": "analyzed_audio",
                "confidence": 0.5,
                "source": "pcm_energy",
            }
        ],
        "sfx_events": [],
        "voice_music_separation": {
            "source": "unavailable",
            "voice_stems": [],
            "music_stems": [],
        },
        "ducking_envelope": {
            "source": "unavailable",
            "points": [],
        },
        "warnings": warnings,
    }


def build_fallback_audio_artifact(
    *,
    source_hash: str,
    duration_seconds: float,
    bpm: float = 120.0,
) -> dict:
    """Build a deterministic fallback artifact when real audio analysis is unavailable."""
    if not source_hash:
        raise ValueError("source_hash is required")
    if duration_seconds <= 0:
        raise ValueError("duration_seconds must be positive")
    if bpm <= 0:
        raise ValueError("bpm must be positive")

    beat_interval = 60.0 / bpm
    beat_grid = []
    beat_index = 0
    time_seconds = 0.0
    while time_seconds < duration_seconds - 1e-9:
        beat_grid.append(
            {
                "beat_index": beat_index,
                "time_seconds": _round_time(time_seconds),
                "downbeat": beat_index % 4 == 0,
                "source": "fallback_bpm",
            }
        )
        beat_index += 1
        time_seconds = beat_index * beat_interval

    return {
        "schema_version": AUDIO_ARTIFACT_SCHEMA_VERSION,
        "analyzer_version": AUDIO_ARTIFACT_ANALYZER_VERSION,
        "source_hash": source_hash,
        "duration_seconds": _round_time(duration_seconds),
        "analysis_mode": "fallback_bpm",
        "is_fallback": True,
        "bpm": bpm,
        "beat_grid": beat_grid,
        "downbeats": [
            beat["time_seconds"] for beat in beat_grid if beat["downbeat"]
        ],
        "energy": {
            "source": "fallback_unknown",
            "window_seconds": 1.0,
            "windows": _unknown_energy_windows(duration_seconds),
        },
        "sections": [
            {
                "start_seconds": 0.0,
                "end_seconds": _round_time(duration_seconds),
                "label": "unknown",
                "confidence": 0.0,
                "source": "fallback",
            }
        ],
        "sfx_events": [],
        "voice_music_separation": {
            "source": "unavailable",
            "voice_stems": [],
            "music_stems": [],
        },
        "ducking_envelope": {
            "source": "unavailable",
            "points": [],
        },
        "warnings": [
            "fallback_bpm_grid",
            "energy_unknown",
            "sfx_detection_unavailable",
            "voice_music_separation_unavailable",
            "ducking_unavailable",
        ],
    }


def ensure_audio_artifact_cached(
    *,
    source_hash: str,
    cache_dir: str | Path,
    analyzer: Callable[[], dict],
) -> AudioArtifactCacheResult:
    """Return a cached artifact, computing it only when the source-hash file is absent."""
    path = audio_artifact_path(cache_dir, source_hash)
    if path.exists():
        return AudioArtifactCacheResult(
            artifact=_read_json(path),
            path=path,
            cache_hit=True,
        )

    artifact = analyzer()
    if artifact.get("source_hash") != source_hash:
        raise ValueError("audio artifact source_hash must match the cache key")

    path.parent.mkdir(parents=True, exist_ok=True)
    _write_json(path, artifact)
    return AudioArtifactCacheResult(
        artifact=artifact,
        path=path,
        cache_hit=False,
    )


def load_audio_artifact_for_render(
    *,
    source_hash: str,
    cache_dir: str | Path,
) -> dict:
    """Load an existing artifact for render-time use; never analyzes or writes."""
    path = audio_artifact_path(cache_dir, source_hash)
    if not path.exists():
        raise FileNotFoundError(
            f"audio artifact missing for {source_hash}; render path must not compute it"
        )
    return _read_json(path)


def audio_artifact_path(cache_dir: str | Path, source_hash: str) -> Path:
    if not source_hash:
        raise ValueError("source_hash is required")
    safe_hash = re.sub(r"[^A-Za-z0-9_.-]+", "_", source_hash).strip("_")
    return Path(cache_dir) / f"{safe_hash}.audio-artifact.json"


def _default_audio_feature_values() -> dict:
    return {
        "sfx_class": "none",
        "sfx_count": 0,
        "music_presence": False,
        "music_energy": "low",
        "beat_proximity": "off_beat",
        "ducking_active": False,
        "has_silence_gap": False,
        "vocal_energy": "low",
        "spectral_brightness": "low",
        "transient_density": "low",
    }


def _window_numeric_values(
    artifact: dict,
    start_seconds: float,
    end_seconds: float,
    *,
    key: str,
) -> list[float]:
    values = []
    for window in artifact.get("energy", {}).get("windows", []):
        if not _spans_overlap(
            window.get("start_seconds"),
            window.get("end_seconds"),
            start_seconds,
            end_seconds,
        ):
            continue
        value = _numeric_or_none(window.get(key))
        if value is not None:
            values.append(value)
    return values


def _events_in_window(
    events: list[dict],
    start_seconds: float,
    end_seconds: float,
) -> list[dict]:
    return [
        event
        for event in events
        if start_seconds <= float(event.get("time_seconds", -1.0)) < end_seconds
    ]


def _dominant_sfx_class(events: list[dict]) -> str:
    for event in events:
        label = event.get("class") or event.get("label") or event.get("sfx_class")
        if label:
            return str(label)
    return "none"


def _beat_proximity(artifact: dict, start_seconds: float, end_seconds: float) -> str:
    beat_times = [
        float(beat["time_seconds"])
        for beat in artifact.get("beat_grid", [])
        if "time_seconds" in beat
    ]
    if not beat_times:
        return "off_beat"
    midpoint = (start_seconds + end_seconds) / 2.0
    return "on_beat" if min(abs(time - midpoint) for time in beat_times) < 0.1 else "off_beat"


def _ducking_active(artifact: dict, start_seconds: float, end_seconds: float) -> bool:
    points = artifact.get("ducking_envelope", {}).get("points", [])
    for point in _events_in_window(points, start_seconds, end_seconds):
        gain_db = _numeric_or_none(point.get("gain_db"))
        gain = _numeric_or_none(point.get("gain"))
        if gain_db is not None and gain_db < -0.5:
            return True
        if gain is not None and gain < 0.95:
            return True
    return False


def _spans_overlap(
    span_start: object,
    span_end: object,
    window_start: float,
    window_end: float,
) -> bool:
    start = _numeric_or_none(span_start)
    end = _numeric_or_none(span_end)
    if start is None or end is None:
        return False
    return start < window_end and end > window_start


def _numeric_or_none(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _energy_bucket(value: float, lo: float, hi: float) -> str:
    t = (float(value) - lo) / (hi - lo + 1e-9)
    if t < 0.33:
        return "low"
    if t > 0.66:
        return "high"
    return "mid"

def _read_wav_mono_samples(wav_path: str | Path) -> tuple[list[float], int, int, int]:
    with wave.open(str(wav_path), "rb") as wav:
        if wav.getcomptype() != "NONE":
            raise ValueError("compressed WAV files are not supported")

        channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        sample_rate = wav.getframerate()
        frame_count = wav.getnframes()
        raw_frames = wav.readframes(frame_count)

    if channels <= 0:
        raise ValueError("WAV channel count must be positive")
    if sample_rate <= 0:
        raise ValueError("WAV sample rate must be positive")
    if sample_width not in (1, 2, 3, 4):
        raise ValueError("unsupported WAV sample width")

    return (
        _decode_wav_pcm_frames(raw_frames, channels, sample_width),
        sample_rate,
        channels,
        sample_width,
    )


def _decode_wav_pcm_frames(
    raw_frames: bytes,
    channels: int,
    sample_width: int,
) -> list[float]:
    frame_width = channels * sample_width
    if frame_width <= 0:
        raise ValueError("WAV frame width must be positive")
    if len(raw_frames) % frame_width != 0:
        raise ValueError("WAV PCM data is truncated")

    samples = []
    for frame_start in range(0, len(raw_frames), frame_width):
        channel_values = []
        for channel in range(channels):
            sample_start = frame_start + channel * sample_width
            sample_bytes = raw_frames[sample_start : sample_start + sample_width]
            channel_values.append(_decode_wav_pcm_sample(sample_bytes, sample_width))
        samples.append(sum(channel_values) / channels)
    return samples


def _decode_wav_pcm_sample(sample_bytes: bytes, sample_width: int) -> float:
    if sample_width == 1:
        return (sample_bytes[0] - 128) / 128.0
    if sample_width == 2:
        return int.from_bytes(sample_bytes, "little", signed=True) / 32768.0
    if sample_width == 3:
        sign_byte = b"\xff" if sample_bytes[2] & 0x80 else b"\x00"
        return (
            int.from_bytes(sample_bytes + sign_byte, "little", signed=True) / 8388608.0
        )
    if sample_width == 4:
        return int.from_bytes(sample_bytes, "little", signed=True) / 2147483648.0
    raise ValueError("unsupported WAV sample width")


def _unknown_energy_windows(duration_seconds: float) -> list[dict]:
    windows = []
    start = 0.0
    while start < duration_seconds - 1e-9:
        end = min(start + 1.0, duration_seconds)
        windows.append(
            {
                "start_seconds": _round_time(start),
                "end_seconds": _round_time(end),
                "rms": "unknown",
                "music_energy": "unknown",
                "vocal_energy": "unknown",
            }
        )
        start = end
    return windows


def _pcm_energy_windows(
    samples: list[float],
    sample_rate: int | float,
    window_seconds: float,
) -> list[dict]:
    window_size = max(1, round(float(sample_rate) * window_seconds))
    windows = []
    for start_index in range(0, len(samples), window_size):
        end_index = min(start_index + window_size, len(samples))
        segment = samples[start_index:end_index]
        windows.append(
            {
                "start_seconds": _round_time(start_index / float(sample_rate)),
                "end_seconds": _round_time(end_index / float(sample_rate)),
                "rms": _round_time(_rms(segment)),
                "music_energy": "unknown",
                "vocal_energy": "unknown",
            }
        )
    return windows


def _pcm_onsets(
    samples: list[float],
    sample_rate: int | float,
    threshold: float,
    min_interval_seconds: float = 0.1,
) -> tuple[list[dict], int]:
    onsets = []
    suppressed = 0
    previous = 0.0
    min_interval_samples = max(1, round(float(sample_rate) * min_interval_seconds))
    last_onset_index = -min_interval_samples
    for index, sample in enumerate(samples):
        current = abs(float(sample))
        if previous <= threshold < current:
            if index - last_onset_index >= min_interval_samples:
                onsets.append(
                    {
                        "time_seconds": _round_time(index / float(sample_rate)),
                        "strength": _round_time(current - previous),
                        "source": "pcm_rising_edge",
                    }
                )
                last_onset_index = index
            else:
                suppressed += 1
        previous = current
    return onsets, suppressed

def _rms(samples: list[float]) -> float:
    if not samples:
        return 0.0
    return math.sqrt(sum(float(sample) ** 2 for sample in samples) / len(samples))


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, artifact: dict) -> None:
    path.write_text(
        json.dumps(artifact, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _round_time(value: float) -> float:
    return round(float(value), 6)
