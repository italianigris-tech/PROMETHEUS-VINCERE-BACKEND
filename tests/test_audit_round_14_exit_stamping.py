import unittest
from mini_run_pipeline.policy_check import validate_caption_collisions
from mini_run_pipeline.pipeline import finalize_manifest_and_exits


class TestRound14ExitStamping(unittest.TestCase):
    """Test suite for Round 14 Commit 1: Exit Stamping Unification and Non-Fabricating Conformance Gate."""

    def test_missing_exit_treatment_on_collision_fails_without_fabrication(self):
        """Colliding chunks with missing exitTreatment must strictly FAIL captionCollision (no fallback fabrication)."""
        chunks = [
            {
                "chunkIndex": 1,
                "startMs": 0,
                "endMs": 1800,
                "displayStartMs": 0,
                "displayEndMs": 1800,
                # exitTreatment intentionally omitted
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
        self.assertEqual(res["status"], "failed", "Checker must not fabricate rack_focus_blur when missing on collisions")
        self.assertEqual(res["collisionsDetected"], 1)
        self.assertEqual(len(res["violations"]), 1)
        self.assertIn("missing rack_focus_blur exitTreatment", res["violations"][0])
        self.assertIn("found 'None'", res["violations"][0])

    def test_finalize_manifest_and_exits_stamps_collisions_and_layers(self):
        """finalize_manifest_and_exits stamps collisionMs and rack_focus_blur onto chunks and inner layers."""
        chunks = [
            {
                "chunkIndex": 1,
                "startMs": 0,
                "endMs": 2000,
                "displayStartMs": 0,
                "displayEndMs": 2000,
                "layers": [{"text": "Hello", "type": "hero"}],
            },
            {
                "chunkIndex": 2,
                "startMs": 1700,
                "endMs": 3500,
                "displayStartMs": 1700,
                "displayEndMs": 3500,
                "layers": [{"text": "World", "type": "hero"}],
            },
            {
                "chunkIndex": 3,
                "startMs": 4000,
                "endMs": 5000,
                "displayStartMs": 4000,
                "displayEndMs": 5000,
                "layers": [{"text": "End", "type": "hero"}],
            },
        ]
        font_manifest = {
            "chunks": [
                {"chunkIndex": 1, "layers": [{"text": "Hello"}]},
                {"chunkIndex": 2, "layers": [{"text": "World"}]},
                {"chunkIndex": 3, "layers": [{"text": "End"}]},
            ]
        }

        # Run unification stamping
        finalize_manifest_and_exits(chunks, font_manifest=font_manifest)

        # Chunk 1 collides with Chunk 2 by 300ms (2000 - 1700)
        self.assertEqual(chunks[0]["collisionMs"], 300)
        self.assertEqual(chunks[0]["exitTreatment"], "rack_focus_blur")
        self.assertEqual(chunks[0]["layers"][0]["exitTreatment"], "rack_focus_blur")
        self.assertEqual(font_manifest["chunks"][0]["exitTreatment"], "rack_focus_blur")

        # Chunk 2 does not collide with Chunk 3 (3500 < 4000)
        self.assertEqual(chunks[1]["collisionMs"], 0)
        self.assertEqual(chunks[1]["exitTreatment"], "clean_hold")
        self.assertEqual(chunks[1]["layers"][0]["exitTreatment"], "clean_hold")
        self.assertEqual(font_manifest["chunks"][1]["exitTreatment"], "clean_hold")

        # Chunk 3 is final chunk
        self.assertEqual(chunks[2]["collisionMs"], 0)
        self.assertEqual(chunks[2]["exitTreatment"], "clean_hold")

        # Now validation passes cleanly
        res = validate_caption_collisions(chunks)
        self.assertEqual(res["status"], "passed")
        self.assertEqual(res["collisionsDetected"], 1)
        self.assertEqual(len(res["violations"]), 0)


if __name__ == "__main__":
    unittest.main()
