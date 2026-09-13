import unittest
from pathlib import Path
from mini_run_pipeline.pipeline import finalize_manifest_and_exits, resolve_chunk_zone
from mini_run_pipeline.policy_check import validate_caption_collisions

ROOT = Path(__file__).resolve().parent.parent


class TestAuditRound16Commit1(unittest.TestCase):
    def test_same_zone_collision_truncates_to_next_mount_minus_30ms(self):
        """When adjacent chunks occupy the same zone, outgoing displayEndMs is truncated to nextMount - 30ms."""
        chunks = [
            {
                "chunkIndex": 1,
                "startMs": 817,
                "endMs": 2599,
                "displayStartMs": 817,
                "displayEndMs": 2599,
                "placement": {"dominantZone": "foreground_lower_deck"},
                "layers": [{"text": "OVER", "isHero": False}, {"text": "THE LAST 12 MONTHS,", "isHero": True}],
            },
            {
                "chunkIndex": 2,
                "startMs": 2179,
                "endMs": 3432,
                "displayStartMs": 2179,
                "displayEndMs": 3432,
                "placement": {"dominantZone": "foreground_lower_deck"},
                "layers": [{"text": "i've", "isHero": False}, {"text": "Purchased More", "isHero": True}],
            },
        ]
        font_manifest = {
            "chunks": [
                {"chunkIndex": 1, "startMs": 817, "endMs": 2599, "displayEndMs": 2599, "layers": [{"text": "OVER"}, {"text": "THE LAST 12 MONTHS,"}]},
                {"chunkIndex": 2, "startMs": 2179, "endMs": 3432, "displayEndMs": 3432, "layers": [{"text": "i've"}, {"text": "Purchased More"}]},
            ]
        }

        finalize_manifest_and_exits(chunks, font_manifest=font_manifest)

        expected_truncated_end = 2179 - 30  # 2149 ms
        self.assertEqual(chunks[0]["displayEndMs"], expected_truncated_end)
        self.assertEqual(chunks[0]["outputEndMs"], expected_truncated_end)
        self.assertEqual(chunks[0]["endMs"], expected_truncated_end)
        self.assertEqual(font_manifest["chunks"][0]["displayEndMs"], expected_truncated_end)
        self.assertEqual(chunks[0]["collisionMs"], 0, "Same-zone collision must be exactly 0 after true hard cut")
        self.assertEqual(chunks[0]["exitTreatment"], "clean_hold")
        self.assertEqual(chunks[0]["layers"][0]["exitTreatment"], "clean_hold")

        # Conformance gate validation passes
        report = validate_caption_collisions(chunks)
        self.assertEqual(report["status"], "passed")
        self.assertEqual(report["collisionsDetected"], 0)
        self.assertEqual(len(report["violations"]), 0)

    def test_caption_collision_policy_fails_on_same_zone_overlap(self):
        """captionCollision gate must fail if a same-zone pair has collisionMs > 0."""
        untruncated_same_zone_chunks = [
            {
                "chunkIndex": 1,
                "startMs": 0,
                "endMs": 2000,
                "displayStartMs": 0,
                "displayEndMs": 2000,
                "exitTreatment": "clean_hold",
                "placement": {"dominantZone": "foreground_lower_deck"},
            },
            {
                "chunkIndex": 2,
                "startMs": 1700,
                "endMs": 3500,
                "displayStartMs": 1700,
                "displayEndMs": 3500,
                "placement": {"dominantZone": "foreground_lower_deck"},
            },
        ]

        report = validate_caption_collisions(untruncated_same_zone_chunks)
        self.assertEqual(report["status"], "failed")
        self.assertEqual(len(report["violations"]), 1)
        self.assertIn("same-zone collision", report["violations"][0])
        self.assertIn("clean_hold handoffs require a true hard-cut (overlap == 0)", report["violations"][0])

    def test_different_zone_collision_retains_rack_focus_blur(self):
        """Cross-zone collisions keep full hold and rack_focus_blur."""
        chunks = [
            {
                "chunkIndex": 2,
                "startMs": 2179,
                "endMs": 3432,
                "displayStartMs": 2179,
                "displayEndMs": 3432,
                "placement": {"dominantZone": "foreground_lower_deck"},
                "layers": [{"text": "Purchased More", "isHero": True}],
            },
            {
                "chunkIndex": 3,
                "startMs": 2932,
                "endMs": 5563,
                "displayStartMs": 2932,
                "displayEndMs": 5563,
                "placement": {"dominantZone": "cranial_crown"},
                "layers": [{"text": "PRODUCTS", "isHero": True}],
            },
        ]

        finalize_manifest_and_exits(chunks)

        # 3432 - 2932 = 500 ms collision across different zones
        self.assertEqual(chunks[0]["collisionMs"], 500)
        self.assertEqual(chunks[0]["displayEndMs"], 3432, "Cross-zone chunk must not be truncated")
        self.assertEqual(chunks[0]["exitTreatment"], "rack_focus_blur")

        report = validate_caption_collisions(chunks)
        self.assertEqual(report["status"], "passed")
        self.assertEqual(report["collisionsDetected"], 1)

    def test_historical_420ms_pairs_recompute_to_zero(self):
        """The four historical same-zone pairs (1->2, 8->9, 14->15, 19->20) recompute from 420ms to 0ms."""
        pairs = [
            (1, 817, 2599, 2, 2179, 3432),
            (8, 9406, 11188, 9, 10768, 11669),
            (14, 14951, 17518, 15, 17098, 18159),
            (19, 21505, 22967, 20, 22547, 23992),
        ]
        for c1_idx, s1, e1, c2_idx, s2, e2 in pairs:
            pair_chunks = [
                {
                    "chunkIndex": c1_idx,
                    "startMs": s1,
                    "endMs": e1,
                    "displayStartMs": s1,
                    "displayEndMs": e1,
                    "placement": {"dominantZone": "foreground_lower_deck"},
                    "layers": [{"text": "text1", "isHero": True}],
                },
                {
                    "chunkIndex": c2_idx,
                    "startMs": s2,
                    "endMs": e2,
                    "displayStartMs": s2,
                    "displayEndMs": e2,
                    "placement": {"dominantZone": "foreground_lower_deck"},
                    "layers": [{"text": "text2", "isHero": True}],
                },
            ]
            self.assertEqual(e1 - s2, 420, f"Original overlap for pair {c1_idx}->{c2_idx} was 420ms")
            finalize_manifest_and_exits(pair_chunks)
            self.assertEqual(
                pair_chunks[0]["collisionMs"],
                0,
                f"Pair {c1_idx}->{c2_idx} collision must recompute from 420ms to 0ms",
            )
            self.assertEqual(pair_chunks[0]["displayEndMs"], s2 - 30)
            self.assertEqual(pair_chunks[0]["exitTreatment"], "clean_hold")

            res = validate_caption_collisions(pair_chunks)
            self.assertEqual(res["status"], "passed")
            self.assertEqual(res["collisionsDetected"], 0)


if __name__ == "__main__":
    unittest.main()
