from __future__ import annotations

import argparse
import hashlib
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .schema import (
    AudioFeatures,
    CameraFeatures,
    CompositionFeatures,
    Confidence,
    EditorialRole,
    EnergyBucket,
    ExtractionMode,
    Intensity,
    MotionEnergy,
    MotionGraphicsFeatures,
    SpeakerVocalFeatures,
    TemporalFeatures,
    TimelineWindow,
    Trajectory,
    TrajectoryMetadata,
    TransitionFeatures,
    TypographyFeatures,
    VisualDensity,
)

FEATURE_VERSION = "trajectory-features-v1"
HARNESS_REPORT = "golden-20-report.json"
MAX_REFERENCES = 20


@dataclass(frozen=True)
class FixtureReference:
    registry_id: str
    media_path: str
    source_hash: str | None = None
    corpus_id: str = "golden-20-local"
    vehicle: str = "talking_head"
    style_label: str = "joseph"
    duration_seconds: float = 1.0
    fps: float = 30.0
    frame_count: int | None = None
    resolution: str = "720x1280"
    has_matte: bool = False
    has_beat_grid: bool = False
    has_typography: bool = False
    has_camera_features: bool = False


def build_local_fixture_references(count: int = MAX_REFERENCES) -> list[FixtureReference]:
    return [
        FixtureReference(
            registry_id=f"fixture-{index:03d}",
            media_path=f"fixtures/fixture-{index:03d}.mp4",
            source_hash=f"sha256:fixture-{index:03d}",
        )
        for index in range(count)
    ]


def run_fixture_harness(
    references: Iterable[FixtureReference],
    output_dir: str | Path,
    *,
    limit: int = MAX_REFERENCES,
) -> dict:
    output_root = Path(output_dir)
    output_root.mkdir(parents=True, exist_ok=True)

    all_references = list(references)
    selected = all_references[:limit]
    run_start = time.perf_counter()
    entries = []

    for reference in selected:
        entry_start = time.perf_counter()
        output_path = output_root / _safe_path_part(reference.registry_id) / "trajectory.json"
        try:
            trajectory, warnings = build_fixture_trajectory(reference)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(trajectory.model_dump_json(indent=2), encoding="utf-8")
            entries.append(
                {
                    "registry_id": reference.registry_id,
                    "status": "success",
                    "trajectory_path": str(output_path.resolve()),
                    "warnings": warnings,
                    "window_count": len(trajectory.windows),
                    "runtime_ms": _elapsed_ms(entry_start),
                }
            )
        except Exception as exc:
            entries.append(
                {
                    "registry_id": reference.registry_id,
                    "status": "failed",
                    "trajectory_path": str(output_path.resolve()),
                    "warnings": fixture_warnings(reference),
                    "error": f"{type(exc).__name__}: {exc}",
                    "runtime_ms": _elapsed_ms(entry_start),
                }
            )

    success_count = sum(1 for entry in entries if entry["status"] == "success")
    failure_count = len(entries) - success_count
    report = {
        "schema_version": "golden-20-harness-v1",
        "requested_count": len(all_references),
        "processed_count": len(entries),
        "skipped_count": max(0, len(all_references) - len(selected)),
        "success_count": success_count,
        "failure_count": failure_count,
        "failure_rate": failure_count / len(entries) if entries else 0.0,
        "runtime_ms": _elapsed_ms(run_start),
        "references": entries,
    }
    (output_root / HARNESS_REPORT).write_text(
        json.dumps(report, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return report


def build_fixture_trajectory(reference: FixtureReference) -> tuple[Trajectory, list[str]]:
    warnings = fixture_warnings(reference)
    frame_count = reference.frame_count or max(1, round(reference.duration_seconds * reference.fps))
    duration = frame_count / reference.fps
    windows = [
        _fixture_window(
            index=index,
            start=float(index),
            end=min(float(index + 1), duration),
            reference=reference,
        )
        for index in range(max(1, int(duration)))
    ]
    notes = f"warnings: {', '.join(warnings)}" if warnings else None
    trajectory = Trajectory(
        metadata=TrajectoryMetadata(
            extraction_mode=ExtractionMode.finals_only,
            source_hash=reference.source_hash or _stable_source_hash(reference),
            corpus_id=reference.corpus_id,
            edited_video_id=reference.registry_id,
            vehicle=reference.vehicle,
            style_label=reference.style_label,
            featureVersion=FEATURE_VERSION,
            extracted_at_utc="1970-01-01T00:00:00+00:00",
            extractor_version="0.2.0",
            duration_seconds=duration,
            fps=reference.fps,
            frame_count=frame_count,
            resolution=reference.resolution,
            windowing_mode="fixed_1s",
            notes=notes,
        ),
        windows=windows,
    )
    return trajectory, warnings


def fixture_warnings(reference: FixtureReference) -> list[str]:
    warnings = []
    if not reference.has_matte:
        warnings.append("missing_matte")
    if not reference.has_beat_grid:
        warnings.append("missing_beat_grid")
    if not reference.has_typography:
        warnings.append("missing_typography")
    if not reference.has_camera_features:
        warnings.append("missing_camera_features")
    return warnings


def _fixture_window(
    *,
    index: int,
    start: float,
    end: float,
    reference: FixtureReference,
) -> TimelineWindow:
    has_typography = reference.has_typography
    has_camera = reference.has_camera_features
    return TimelineWindow(
        index=index,
        start_seconds=start,
        end_seconds=end,
        intensity=Intensity.restrained,
        visual_density=VisualDensity.balanced if has_typography else VisualDensity.quiet,
        motion_energy=MotionEnergy.subtle if has_camera else MotionEnergy.none,
        editorial_role=EditorialRole.setup if index == 0 else EditorialRole.explain,
        camera=CameraFeatures(
            movement_class="slow_zoom_in" if has_camera else "static",
            movement_magnitude=EnergyBucket.mid if has_camera else EnergyBucket.low,
            face_box_velocity=EnergyBucket.low,
            shot_change_count=0,
            momentum_direction="in" if has_camera else "none",
            crop_tightness="medium",
        ),
        typography=TypographyFeatures(
            has_text=has_typography,
            role="caption" if has_typography else "none",
            placement_zone="lower_third" if has_typography else "none",
            font_weight="bold" if has_typography else "none",
            occupancy_bucket=EnergyBucket.mid if has_typography else EnergyBucket.low,
        ),
        motion_graphics=MotionGraphicsFeatures(),
        composition=CompositionFeatures(
            speaker_position="center",
            negative_space_ratio=EnergyBucket.mid,
            background_type="real_scene",
            depth_of_field="deep",
            subject_scale="medium",
        ),
        transitions=TransitionFeatures(),
        audio=AudioFeatures(
            music_energy=EnergyBucket.low,
            beat_proximity="on_beat" if reference.has_beat_grid else "off",
            vocal_energy=EnergyBucket.low,
            spectral_brightness=EnergyBucket.low,
            transient_density=EnergyBucket.low,
        ),
        temporal=TemporalFeatures(
            position_in_video="hook" if index == 0 else "body",
            pacing_density=EnergyBucket.low,
            sequence_trend="steady",
            novelty_level=EnergyBucket.mid,
            surprise_budget_state=EnergyBucket.mid,
        ),
        speaker_vocal=SpeakerVocalFeatures(
            confidence=Confidence.neutral,
            gaze_target="lens",
        ),
    )


def _stable_source_hash(reference: FixtureReference) -> str:
    digest = hashlib.sha256(
        f"{reference.registry_id}:{reference.media_path}".encode("utf-8")
    ).hexdigest()
    return f"sha256:{digest}"


def _safe_path_part(value: str) -> str:
    return "".join(char if char.isalnum() or char in ("-", "_") else "_" for char in value)


def _elapsed_ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the Golden 20 local trajectory fixture harness.")
    parser.add_argument("--output", required=True, help="Directory where trajectories and the report are written.")
    parser.add_argument("--count", type=int, default=MAX_REFERENCES, help="Number of local fixture references to build.")
    args = parser.parse_args(argv)

    report = run_fixture_harness(
        build_local_fixture_references(args.count),
        Path(args.output),
    )
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["failure_count"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())