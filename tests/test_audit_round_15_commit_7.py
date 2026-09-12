import unittest
from pathlib import Path
from mini_run_pipeline.pipeline import finalize_manifest_and_exits, resolve_chunk_zone
from mini_run_pipeline.policy_check import validate_caption_collisions

ROOT = Path(__file__).resolve().parent.parent


class TestAuditRound15Commit7(unittest.TestCase):
    def test_same_zone_handoff_downgrades_to_clean_hold(self):
        """When adjacent chunks share the same spatial zone, collision handoff downgrades to clean_hold."""
        # Scenario: Two chunks in flank_left with 250ms collision
        chunks = [
            {
                "chunkIndex": 1,
                "startMs": 0,
                "endMs": 2000,
                "displayStartMs": 0,
                "displayEndMs": 2000,
                "spatial_zone": "flank_left",
                "placement": {"dominantZone": "flank_left_column"},
                "layers": [{"text": "First in flank", "isHero": True}],
            },
            {
                "chunkIndex": 2,
                "startMs": 1750,
                "endMs": 3500,
                "displayStartMs": 1750,
                "displayEndMs": 3500,
                "spatial_zone": "flank_left",
                "placement": {"dominantZone": "flank_left_column"},
                "layers": [{"text": "Second in flank", "isHero": True}],
            },
        ]

        finalize_manifest_and_exits(chunks)

        self.assertEqual(chunks[0]["collisionMs"], 250)
        self.assertEqual(
            chunks[0]["exitTreatment"],
            "clean_hold",
            "Same-zone collision handoff (flank_left -> flank_left) must downgrade to clean_hold to prevent double blur",
        )
        self.assertEqual(
            chunks[0]["layers"][0]["exitTreatment"],
            "clean_hold",
            "Inner layers must also inherit clean_hold",
        )

        # Conformance gate validation
        check_result = validate_caption_collisions(chunks)
        self.assertEqual(
            check_result["status"],
            "passed",
            f"Policy check must pass for same-zone clean_hold handoff: {check_result['violations']}",
        )
        self.assertTrue(check_result["boundaries"][0]["sameZone"])

    def test_different_zone_handoff_uses_rack_focus_blur(self):
        """When adjacent chunks occupy different spatial zones, collision handoff retains rack_focus_blur."""
        # Scenario: Chunk 1 in flank_left, Chunk 2 in lower_deck with 300ms collision
        chunks = [
            {
                "chunkIndex": 1,
                "startMs": 0,
                "endMs": 2000,
                "displayStartMs": 0,
                "displayEndMs": 2000,
                "placement": {"dominantZone": "flank_left_column"},
                "layers": [{"text": "Left flank text", "isHero": True}],
            },
            {
                "chunkIndex": 2,
                "startMs": 1700,
                "endMs": 3500,
                "displayStartMs": 1700,
                "displayEndMs": 3500,
                "placement": {"dominantZone": "foreground_lower_deck"},
                "layers": [{"text": "Lower deck text", "isHero": True}],
            },
        ]

        finalize_manifest_and_exits(chunks)

        self.assertEqual(chunks[0]["collisionMs"], 300)
        self.assertEqual(
            chunks[0]["exitTreatment"],
            "rack_focus_blur",
            "Different-zone collision handoff must retain rack_focus_blur",
        )
        self.assertEqual(chunks[0]["layers"][0]["exitTreatment"], "rack_focus_blur")

        check_result = validate_caption_collisions(chunks)
        self.assertEqual(
            check_result["status"],
            "passed",
            f"Policy check must pass for different-zone rack_focus_blur: {check_result['violations']}",
        )
        self.assertFalse(check_result["boundaries"][0]["sameZone"])

    def test_resolve_chunk_zone_normalization(self):
        """Verify canonical zone resolution handles variants."""
        self.assertEqual(resolve_chunk_zone({"placement": {"dominantZone": "flank_left_column"}}), "flank_left")
        self.assertEqual(resolve_chunk_zone({"placement": {"dominantZone": "flank_right_column"}}), "flank_right")
        self.assertEqual(resolve_chunk_zone({"placement": {"dominantZone": "foreground_lower_deck"}}), "lower_deck")
        self.assertEqual(resolve_chunk_zone({"placement": {"dominantZone": "cranial_crown"}}), "cranial")
        self.assertEqual(resolve_chunk_zone({"spatial_zone": "lower_deck"}), "lower_deck")


if __name__ == "__main__":
    unittest.main()
