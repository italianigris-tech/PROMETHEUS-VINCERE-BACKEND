import unittest
from mini_run_pipeline.policy_check import (
    validate_caption_collisions,
    run_post_render_conformance_check,
)


class TestRound12CollisionCheck(unittest.TestCase):
    """Test suite for Round 12 Fix 5: Policy Checker captionCollision Conformance."""

    def test_clean_hold_when_no_collision(self):
        """Chunks with zero overlap report collisionMs=0 and exitTreatment='clean_hold'."""
        chunks = [
            {"chunkIndex": 1, "startMs": 0, "endMs": 1500, "displayStartMs": 0, "displayEndMs": 1500},
            {"chunkIndex": 2, "startMs": 1800, "endMs": 3200, "displayStartMs": 1800, "displayEndMs": 3200},
        ]
        res = validate_caption_collisions(chunks)
        self.assertEqual(res["status"], "passed")
        self.assertEqual(res["boundariesChecked"], 1)
        self.assertEqual(res["collisionsDetected"], 0)
        self.assertEqual(res["maxCollisionMs"], 0)
        self.assertEqual(res["boundaries"][0]["exitTreatment"], "clean_hold")

    def test_rack_focus_blur_exit_when_collision_present(self):
        """When chunk N+1 mounts inside chunk N's hold, exitTreatment='rack_focus_blur' passes."""
        chunks = [
            {
                "chunkIndex": 1,
                "startMs": 0,
                "endMs": 1800,
                "displayStartMs": 0,
                "displayEndMs": 1800,
                "collisionMs": 300,
                "exitTreatment": "rack_focus_blur",
            },
            {
                "chunkIndex": 2,
                "startMs": 1500,
                "endMs": 3000,
                "displayStartMs": 1500,
                "displayEndMs": 3000,
            },
        ]
        res = validate_caption_collisions(chunks)
        self.assertEqual(res["status"], "passed")
        self.assertEqual(res["collisionsDetected"], 1)
        self.assertEqual(res["maxCollisionMs"], 300)
        self.assertEqual(res["boundaries"][0]["exitTreatment"], "rack_focus_blur")
        self.assertEqual(len(res["violations"]), 0)

    def test_collision_without_rack_focus_exit_fails_conformance(self):
        """Colliding boundary with invalid exitTreatment fails conformance check with descriptive violation."""
        chunks = [
            {
                "chunkIndex": 1,
                "startMs": 0,
                "endMs": 1800,
                "displayStartMs": 0,
                "displayEndMs": 1800,
                "exitTreatment": "truncated_cut",
            },
            {
                "chunkIndex": 2,
                "startMs": 1500,
                "endMs": 3000,
                "displayStartMs": 1500,
                "displayEndMs": 3000,
            },
        ]
        res = validate_caption_collisions(chunks)
        self.assertEqual(res["status"], "failed")
        self.assertGreaterEqual(len(res["violations"]), 1)
        self.assertIn("rack_focus_blur", res["violations"][0])

    def test_conformance_report_includes_caption_collision_check(self):
        """Full post-render conformance check includes captionCollision in report.checks."""
        chunks = [
            {"chunkIndex": 1, "text": "Hello world", "startMs": 0, "endMs": 1200},
            {"chunkIndex": 2, "text": "Next phrase", "startMs": 1500, "endMs": 2800},
        ]
        manifest = {"chunks": chunks}
        report = run_post_render_conformance_check(
            manifest_or_props=manifest,
            extract_frames=False,
        )
        self.assertIn("captionCollision", report["checks"])
        self.assertEqual(report["checks"]["captionCollision"]["status"], "passed")
        self.assertEqual(report["totalChecks"], 6)


if __name__ == "__main__":
    unittest.main()
