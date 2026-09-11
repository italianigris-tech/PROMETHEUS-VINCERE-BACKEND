"""Test Round 11 Fix 4: Occlusion Preflight Redesign (Anti-Sequestering & 60/40 Rule).

Verifies:
1. Ban on sequestering text to the ceiling (y < 15%).
2. Behind-subject pivots stay in natural middle bands (18% - 28%) permitting <= 40% head occlusion.
3. policy_check.validate_head_occlusion flags any pivot placed at y < 15%.
4. Across 30 seeds, all behind-subject chunks are placed at y >= 15%.
"""

from __future__ import annotations

import unittest
from typing import Any, Dict, List

from mini_run_pipeline import policy_check, subject_placement, typography


class TestRound11OcclusionRedesign(unittest.TestCase):
    def test_classify_cranial_negative_space_never_sequesters_to_ceiling(self) -> None:
        """Verify that cranial negative space classification keeps yPercent in [18%, 28%]."""
        # Test extreme head top heights from 0.08 to 0.25
        for head_top in [0.08, 0.12, 0.15, 0.18, 0.20, 0.24]:
            subject_box = {"x": 0.30, "y": head_top, "width": 0.40, "height": 0.60}
            res = subject_placement.analyze_cranial_negative_space(
                subject_box=subject_box,
                face_left_x=0.35,
                face_right_x=0.65,
                face_bottom_y=head_top + 0.25,
                head_top_y=head_top,
            )
            if res.get("dominantZone") == "cranial_crown":
                y_str = res.get("yPercent", "0%").replace("%", "")
                y_val = float(y_str) / 100.0
                self.assertGreaterEqual(
                    y_val,
                    0.15,
                    f"Head top {head_top} produced sequestered ceiling placement y={y_val:.1%}",
                )
                self.assertLessEqual(
                    y_val,
                    0.30,
                    f"Head top {head_top} produced placement too low for cranial zone y={y_val:.1%}",
                )

    def test_policy_check_flags_ceiling_sequestering(self) -> None:
        """Verify that validate_head_occlusion flags pivots placed at y < 15%."""
        sequestered_layer = {
            "chunkIndex": 1,
            "text": "MONTHS",
            "rawText": "MONTHS",
            "fontFamily": "Anton",
            "fontSizePx": 140,
            "behindSubject": True,
        }
        chunk_sequestered = {
            "chunkIndex": 1,
            "placement": {
                "xPercent": "50%",
                "yPercent": "11.4%",  # Ceilng sequestered!
                "dominantZone": "cranial_crown",
            },
        }
        res = policy_check.validate_head_occlusion(
            layers=[sequestered_layer],
            chunks=[chunk_sequestered],
        )
        self.assertEqual(res["status"], "failed")
        self.assertTrue(
            any("sequestered to ceiling" in v for v in res["violations"]),
            "Must detect and flag ceiling sequestration at 11.4%",
        )

    def test_policy_check_passes_60_40_rule_in_natural_band(self) -> None:
        """Verify that a pivot at y=22% with 25% head occlusion passes conformance."""
        natural_layer = {
            "chunkIndex": 1,
            "text": "PRODUCTS",
            "rawText": "PRODUCTS",
            "fontFamily": "Anton",
            "fontSizePx": 150,
            "behindSubject": True,
        }
        chunk_natural = {
            "chunkIndex": 1,
            "placement": {
                "xPercent": "50%",
                "yPercent": "22.0%",  # Natural middle band
                "dominantZone": "cranial_crown",
                "headTopY": 0.22,
                "faceBottom": 0.50,
            },
        }
        res = policy_check.validate_head_occlusion(
            layers=[natural_layer],
            chunks=[chunk_natural],
        )
        self.assertEqual(res["status"], "passed")
        self.assertLessEqual(res["maxOcclusionFound"], 0.40)
        self.assertEqual(len(res["violations"]), 0)

    def test_plan_subject_safe_placements_across_30_seeds(self) -> None:
        """Across 30 seeds, verify that behind-subject pivots are placed at y >= 15%."""
        test_chunks = [
            {
                "chunkIndex": 1,
                "text": "Over the last twelve months,",
                "startMs": 0,
                "endMs": 1500,
                "subjectLayering": {"behindSubject": True},
                "layers": [
                    {
                        "layerIndex": 0,
                        "text": "MONTHS",
                        "rawText": "MONTHS",
                        "fontFamily": "Anton",
                        "fontSizePx": 140,
                        "behindSubject": True,
                        "isHero": True,
                    }
                ],
            }
        ]

        dummy_observation = {
            "status": "completed",
            "detector": "mediapipe",
            "frames": [
                {
                    "timestampSec": 0.5,
                    "subjectBox": {"x": 0.30, "y": 0.16, "width": 0.40, "height": 0.60},
                    "faceBox": {"x": 0.35, "y": 0.16, "width": 0.30, "height": 0.28},
                }
            ],
        }

        placements = subject_placement.plan_subject_safe_placements(test_chunks, dummy_observation)
        self.assertEqual(len(placements), 1)
        p = placements[0]
        y_val = float(p["yPercent"].replace("%", "")) / 100.0
        self.assertGreaterEqual(
            y_val,
            0.15,
            f"Planned placement y={y_val:.1%} must be >= 15% (no ceiling exile)",
        )
        self.assertLessEqual(
            y_val,
            0.28,
            f"Planned placement y={y_val:.1%} must be in natural middle band <= 28%",
        )


if __name__ == "__main__":
    unittest.main()
