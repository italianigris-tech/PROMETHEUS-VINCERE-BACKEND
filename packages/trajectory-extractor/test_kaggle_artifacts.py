import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from validate_kaggle_artifacts import validate_artifact_index  # noqa: E402
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


def make_trajectory(video_id="joseph-test", source_hash="sha256:test"):
    window = TimelineWindow(
        index=0,
        start_seconds=0.0,
        end_seconds=1.0,
        intensity=Intensity.restrained,
        visual_density=VisualDensity.quiet,
        motion_energy=MotionEnergy.subtle,
        editorial_role=EditorialRole.explain,
        camera=CameraFeatures(
            movement_class="static",
            movement_magnitude=EnergyBucket.low,
            face_box_velocity=EnergyBucket.low,
            shot_change_count=0,
            momentum_direction="none",
            crop_tightness="medium",
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
    return Trajectory(
        metadata=TrajectoryMetadata(
            extraction_mode=ExtractionMode.finals_only,
            source_hash=source_hash,
            corpus_id="golden-20-local",
            edited_video_id=video_id,
            vehicle="talking_head",
            style_label="joseph",
            featureVersion="trajectory-features-v1",
            extracted_at_utc="2026-07-07T00:00:00+00:00",
            extractor_version="0.2.0",
            duration_seconds=1.0,
            fps=30.0,
            frame_count=30,
            resolution="1280x720",
            windowing_mode="fixed_1s",
        ),
        windows=[window],
    )


class KaggleArtifactValidationTest(unittest.TestCase):
    def test_complete_artifact_index_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            video_id = "joseph-test"
            source_hash = "sha256:test"
            _write_json(root / "joseph-test.trajectory.json", make_trajectory(video_id, source_hash).model_dump())
            _write_json(root / "audio-artifacts" / "joseph-test.audio-artifact.json", {
                "schema_version": "audio-artifact-v1",
                "source_hash": source_hash,
                "is_fallback": False,
            })
            _write_json(root / "text-evidence" / "joseph-test.text-evidence.json", {"video_id": video_id})
            _write_json(root / "frame-evidence" / video_id / "frame-evidence.json", {"video_id": video_id})
            _write_json(root / "motion-cut-evidence" / "joseph-test.motion-cut-evidence.json", {"video_id": video_id})
            _write_json(root / "artifact-index.json", _index(video_id, source_hash))

            report = validate_artifact_index(root / "artifact-index.json")

        self.assertTrue(report["passed"], report)
        self.assertEqual(report["video_count"], 1)
        self.assertEqual(report["errors"], [])

    def test_missing_artifact_blocks_training_use(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            video_id = "joseph-test"
            source_hash = "sha256:test"
            _write_json(root / "artifact-index.json", _index(video_id, source_hash))

            report = validate_artifact_index(root / "artifact-index.json")

        self.assertFalse(report["passed"])
        self.assertTrue(any("missing" in error for error in report["errors"]))

    def test_legacy_kaggle_contract_version_still_validates(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            video_id = "joseph-test"
            source_hash = "sha256:test"
            _write_json(root / "joseph-test.trajectory.json", make_trajectory(video_id, source_hash).model_dump())
            _write_json(root / "audio-artifacts" / "joseph-test.audio-artifact.json", {
                "schema_version": "audio-artifact-v1",
                "source_hash": source_hash,
                "is_fallback": False,
            })
            _write_json(root / "text-evidence" / "joseph-test.text-evidence.json", {"video_id": video_id})
            _write_json(root / "frame-evidence" / video_id / "frame-evidence.json", {"video_id": video_id})
            _write_json(root / "motion-cut-evidence" / "joseph-test.motion-cut-evidence.json", {"video_id": video_id})
            index = _index(video_id, source_hash)
            index["schema_version"] = "joseph-kaggle-artifacts-v1"
            _write_json(root / "artifact-index.json", index)

            report = validate_artifact_index(root / "artifact-index.json")

        self.assertTrue(report["passed"], report)


def _index(video_id, source_hash):
    return {
        "schema_version": "joseph-evidence-artifacts-v1",
        "extractor_version": "local-evidence-0.1.0",
        "feature_version": "trajectory-features-v1",
        "videos": [
            {
                "video_id": video_id,
                "source_hash": source_hash,
                "feature_version": "trajectory-features-v1",
                "extractor_version": "local-evidence-0.1.0",
                "artifacts": {
                    "trajectory": "joseph-test.trajectory.json",
                    "audio_artifact": "audio-artifacts/joseph-test.audio-artifact.json",
                    "text_evidence": "text-evidence/joseph-test.text-evidence.json",
                    "frame_evidence": "frame-evidence/joseph-test/frame-evidence.json",
                    "motion_cut_evidence": "motion-cut-evidence/joseph-test.motion-cut-evidence.json",
                },
            }
        ],
        "failures": [],
    }


def _write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
