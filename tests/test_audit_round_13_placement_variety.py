"""Audit test for Round 13 Fix 4: Placement variety rebalance & anti-monoculture.
Asserts:
1. Consecutive same-zone placements are capped at <= 3.
2. Hysteresis breaks after 3 chunks and rotates across flank_left, flank_right, and foreground_lower_deck.
3. Speaker collision protection takes precedence when speaker is off-center.
"""

import os
import json
import itertools
import unittest
from collections import Counter

from mini_run_pipeline.subject_placement import plan_subject_safe_placements

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECEIPT_PATH = os.path.join(
    os.path.expanduser("~"),
    ".gemini",
    "antigravity-cli",
    "brain",
    "8ec47dcb-d657-40d5-8c1c-7270878d6444",
    "r12_receipt.json",
)


class TestRound13PlacementVarietyAudit(unittest.TestCase):
    def setUp(self):
        if os.path.exists(RECEIPT_PATH):
            with open(RECEIPT_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.chunks = data.get("chunks", [])
        else:
            # Fallback 25 synthetic chunks
            self.chunks = [
                {
                    "chunkIndex": i,
                    "text": f"Word chunk {i}",
                    "startMs": i * 1200,
                    "endMs": i * 1200 + 1100,
                    "subjectLayering": {"behindSubject": (i in (4, 17, 20, 23))},
                    "placement": {
                        "dominantZone": "flank_left_column",
                        "textAlign": "left",
                        "anchor": "left",
                        "layoutSource": "font_json_layout_rules",
                    },
                }
                for i in range(25)
            ]

    def test_consecutive_same_zone_capped_at_three(self):
        """No single zone may appear more than 3 consecutive times."""
        placements = plan_subject_safe_placements(self.chunks, None)
        zones = [p["dominantZone"] for p in placements]

        grouped = [(k, len(list(g))) for k, g in itertools.groupby(zones)]
        for zone, count in grouped:
            self.assertLessEqual(
                count,
                3,
                f"Zone '{zone}' was repeated {count} consecutive times (cap is <= 3).",
            )

    def test_placement_distribution_has_variety(self):
        """Full run must include left flank, right flank, lower deck, and cranial crown."""
        placements = plan_subject_safe_placements(self.chunks, None)
        zones = [p["dominantZone"] for p in placements]
        counts = Counter(zones)

        self.assertIn("flank_left_column", counts)
        self.assertIn("flank_right_column", counts)
        self.assertIn("foreground_lower_deck", counts)
        self.assertIn("cranial_crown", counts)

        # Monoculture guard: flank_left must not account for > 65% of the total chunks
        left_ratio = counts["flank_left_column"] / len(zones)
        self.assertLess(
            left_ratio,
            0.65,
            f"flank_left_column represented {left_ratio:.1%} of placements (must be < 65%)",
        )

    def test_offcenter_speaker_strict_clearance_priority(self):
        """When speaker is pushed hard to the right, speaker safety forces left flank."""
        offcenter_observation = {
            "frames": [
                {
                    "sourceMs": i * 1000,
                    "faceBox": {"x": 0.65, "y": 0.25, "width": 0.20, "height": 0.25},
                }
                for i in range(5)
            ]
        }
        test_chunks = [
            {
                "chunkIndex": i,
                "text": f"Test chunk {i}",
                "startMs": i * 1000,
                "endMs": i * 1000 + 900,
                "subjectLayering": {"behindSubject": False},
            }
            for i in range(4)
        ]
        placements = plan_subject_safe_placements(test_chunks, offcenter_observation)
        for p in placements:
            self.assertEqual(
                p["dominantZone"],
                "flank_left_column",
                "Speaker on right side must force placements into open left flank",
            )


if __name__ == "__main__":
    unittest.main()
