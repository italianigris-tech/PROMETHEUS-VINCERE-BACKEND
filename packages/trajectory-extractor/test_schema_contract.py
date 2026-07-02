import sys
import unittest
from pathlib import Path

from pydantic import ValidationError

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from trajectory_extractor.schema import (  # noqa: E402
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


def make_window(index=0, start=0.0, end=1.0):
    return TimelineWindow(
        index=index,
        start_seconds=start,
        end_seconds=end,
        intensity=Intensity.restrained,
        visual_density=VisualDensity.quiet,
        motion_energy=MotionEnergy.subtle,
        editorial_role=EditorialRole.explain,
        camera=CameraFeatures(
            movement_class="static",
            movement_magnitude=EnergyBucket.low,
            face_box_velocity=EnergyBucket.low,
            momentum_direction="none",
            crop_tightness="medium",
            shot_change_count=0,
        ),
        typography=TypographyFeatures(),
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
            vocal_energy=EnergyBucket.low,
            spectral_brightness=EnergyBucket.low,
            transient_density=EnergyBucket.low,
        ),
        temporal=TemporalFeatures(
            position_in_video="body",
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


def make_metadata(**overrides):
    data = {
        "extraction_mode": ExtractionMode.finals_only,
        "source_hash": "sha256:abc123",
        "corpus_id": "golden-20-local",
        "edited_video_id": "edit-001",
        "vehicle": "talking_head",
        "style_label": "joseph",
        "featureVersion": "trajectory-features-v1",
        "extracted_at_utc": "2026-07-02T00:00:00+00:00",
        "extractor_version": "0.2.0",
        "duration_seconds": 1.0,
        "fps": 30.0,
        "frame_count": 30,
        "resolution": "720x1280",
        "windowing_mode": "fixed_1s",
    }
    data.update(overrides)
    return TrajectoryMetadata(**data)


class TrajectorySchemaContractTest(unittest.TestCase):
    def test_metadata_records_absolute_demonstration_provenance(self):
        trajectory = Trajectory(metadata=make_metadata(), windows=[make_window()])

        dumped = trajectory.model_dump()
        self.assertEqual(dumped["metadata"]["source_hash"], "sha256:abc123")
        self.assertEqual(dumped["metadata"]["corpus_id"], "golden-20-local")
        self.assertEqual(dumped["metadata"]["vehicle"], "talking_head")
        self.assertEqual(dumped["metadata"]["style_label"], "joseph")
        self.assertEqual(dumped["metadata"]["featureVersion"], "trajectory-features-v1")
        self.assertEqual(dumped["metadata"]["fps"], 30.0)
        self.assertEqual(dumped["windows"][0]["start_seconds"], 0.0)
        self.assertEqual(dumped["windows"][0]["end_seconds"], 1.0)

    def test_metadata_rejects_missing_feature_version(self):
        data = make_metadata().model_dump()
        data.pop("featureVersion")

        with self.assertRaises(ValidationError):
            TrajectoryMetadata(**data)

    def test_duration_must_match_fps_and_frame_count(self):
        metadata = make_metadata(duration_seconds=3.0, fps=30.0, frame_count=30)

        with self.assertRaises(ValidationError):
            Trajectory(metadata=metadata, windows=[make_window()])

    def test_windows_must_stay_inside_declared_duration(self):
        metadata = make_metadata(duration_seconds=1.0, fps=30.0, frame_count=30)

        with self.assertRaises(ValidationError):
            Trajectory(metadata=metadata, windows=[make_window(start=0.0, end=1.5)])

    def test_absolute_demonstrations_do_not_embed_pairwise_verdicts(self):
        trajectory_fields = set(Trajectory.model_fields)
        metadata_fields = set(TrajectoryMetadata.model_fields)

        forbidden = {"winner_id", "loser_id", "preference_verdict", "pairwise_verdict"}
        self.assertTrue(forbidden.isdisjoint(trajectory_fields))
        self.assertTrue(forbidden.isdisjoint(metadata_fields))


if __name__ == "__main__":
    unittest.main()
