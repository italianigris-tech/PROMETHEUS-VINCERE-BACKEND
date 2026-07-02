import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from trajectory_extractor.fixture_harness import (  # noqa: E402
    FixtureReference,
    build_local_fixture_references,
    run_fixture_harness,
)
from trajectory_extractor.schema import Trajectory  # noqa: E402


class Golden20FixtureHarnessTest(unittest.TestCase):
    def test_harness_emits_twenty_valid_trajectories_and_report(self):
        fixtures = build_local_fixture_references(20)

        with tempfile.TemporaryDirectory() as tmp:
            report = run_fixture_harness(fixtures, Path(tmp))

            self.assertEqual(report["processed_count"], 20)
            self.assertEqual(report["success_count"], 20)
            self.assertEqual(report["failure_count"], 0)
            self.assertEqual(report["failure_rate"], 0.0)
            self.assertEqual(report["skipped_count"], 0)
            self.assertGreaterEqual(report["runtime_ms"], 0)

            report_path = Path(tmp) / "golden-20-report.json"
            self.assertTrue(report_path.exists())
            saved_report = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(saved_report["processed_count"], 20)

            for entry in saved_report["references"]:
                trajectory_path = Path(entry["trajectory_path"])
                self.assertTrue(trajectory_path.exists())
                trajectory = Trajectory.model_validate_json(
                    trajectory_path.read_text(encoding="utf-8")
                )
                self.assertEqual(trajectory.metadata.corpus_id, "golden-20-local")
                self.assertEqual(trajectory.metadata.featureVersion, "trajectory-features-v1")
                self.assertIn("missing_matte", entry["warnings"])
                self.assertIn("missing_beat_grid", entry["warnings"])
                self.assertIn("missing_typography", entry["warnings"])
                self.assertIn("missing_camera_features", entry["warnings"])
                self.assertIn("warnings:", trajectory.metadata.notes)
                self.assertGreaterEqual(entry["runtime_ms"], 0)

    def test_harness_limits_run_to_first_twenty_references(self):
        fixtures = build_local_fixture_references(22)

        with tempfile.TemporaryDirectory() as tmp:
            report = run_fixture_harness(fixtures, Path(tmp))

            self.assertEqual(report["processed_count"], 20)
            self.assertEqual(report["skipped_count"], 2)
            self.assertFalse((Path(tmp) / "fixture-020" / "trajectory.json").exists())

    def test_fixture_warnings_reflect_available_inputs(self):
        fixture = FixtureReference(
            registry_id="complete-fixture",
            media_path="fixtures/complete-fixture.mp4",
            source_hash="sha256:complete",
            duration_seconds=1.0,
            fps=30.0,
            frame_count=30,
            resolution="720x1280",
            has_matte=True,
            has_beat_grid=True,
            has_typography=True,
            has_camera_features=True,
        )

        with tempfile.TemporaryDirectory() as tmp:
            report = run_fixture_harness([fixture], Path(tmp))

            self.assertEqual(report["references"][0]["warnings"], [])


if __name__ == "__main__":
    unittest.main()
