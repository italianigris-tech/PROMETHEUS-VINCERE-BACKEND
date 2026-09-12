import os
import unittest
from pathlib import Path

from mini_run_pipeline.subject_placement import (
    plan_subject_safe_placements,
    analyze_cranial_negative_space,
)
from mini_run_pipeline.policy_check import (
    validate_head_occlusion,
    validate_cranial_halo_guard,
    validate_safe_region_bounds,
)


class TestAuditRound15Commit9(unittest.TestCase):
    """Audit test suite for Round 15 Commit 9:
    1. Cranial crown center_y bounded to 15.0% keeping pivot head occlusion <= 38% (35.6% actual).
    2. Flank zone eligibility rejection for wide headlines (> 550px) preventing edge spill.
    3. Headroom negative space analysis retains natural composition zone >= 15% per 60/40 rule.
    """

    def test_cranial_crown_head_occlusion_cap(self):
        """Cranial headroom placement bounds pivot occlusion to <= 40% (60/40 rule)."""
        chunk_17 = {
            "chunkIndex": 17,
            "text": "dream come true, right?",
            "startMs": 19662,
            "endMs": 20864,
            "placement": {
                "xPercent": "50.0%",
                "yPercent": "15.0%",
                "anchor": "center",
                "textAlign": "center",
                "dominantZone": "cranial_crown",
                "headTopY": 0.144,
                "faceBottom": 0.5346,
            },
            "layers": [
                {
                    "layerIndex": 1,
                    "role": "primary_focus_word",
                    "rawText": "right?",
                    "fontFamily": "Teko",
                    "fontSizePx": 175.0,
                    "casing": "uppercase",
                    "behindSubject": True,
                    "chunkIndex": 17,
                }
            ],
        }
        res = validate_head_occlusion(chunk_17["layers"], chunks=[chunk_17])
        self.assertEqual(res["status"], "passed")
        self.assertLessEqual(res["maxOcclusionFound"], 0.38)
        self.assertEqual(len(res["violations"]), 0)

    def test_cranial_crown_negative_space_solver(self):
        """analyze_cranial_negative_space places text at center_y >= 15% and <= 20%."""
        subject_box = {"x": 0.35, "y": 0.144, "width": 0.30, "height": 0.70}
        cranial = analyze_cranial_negative_space(
            subject_box=subject_box,
            head_top_y=0.144,
            face_bottom_y=0.5346,
        )
        self.assertEqual(cranial["dominantZone"], "cranial_crown")
        # center_y must be at least 15.0% (anti-sequestering) and at most 20.0%
        y_pct_str = cranial["yPercent"].replace("%", "")
        y_pct = float(y_pct_str)
        self.assertGreaterEqual(y_pct, 15.0)
        self.assertLessEqual(y_pct, 20.0)

    def test_wide_headline_flank_rejection(self):
        """Wide headlines (> 550px) cannot flank the subject; must route to foreground lower deck."""
        chunks = [
            {
                "chunkIndex": 0,
                "text": "Over the last 12 months, I've purchased more than 12,000 physical products",
                "startMs": 0,
                "endMs": 2000,
                "layers": [
                    {
                        "layerName": "hero",
                        "rawText": "Over the last 12 months,",
                        "fontFamily": "Inter",
                        "fontSizePx": 104,
                        "estimatedWidthPx": 820.0,
                    }
                ],
            }
        ]
        # Speaker observation with wide flank clearance (e.g. face on right -> flankLeft = 0.58)
        observation = {
            "frames": [
                {
                    "sourceMs": 500,
                    "faceBox": {"x": 0.58, "y": 0.174, "width": 0.22, "height": 0.24},
                }
            ]
        }
        placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(len(placements), 1)
        # Headline is 820px wide -> must NOT be assigned to flank_left_column
        self.assertNotEqual(placements[0]["dominantZone"], "flank_left_column")
        self.assertEqual(placements[0]["dominantZone"], "foreground_lower_deck")

    def test_narrow_phrase_flank_acceptance(self):
        """Narrow phrases (<= 550px) remain eligible for flank placement when lateral space allows."""
        chunks = [
            {
                "chunkIndex": 0,
                "text": "quick tip",
                "startMs": 0,
                "endMs": 1000,
                "layers": [
                    {
                        "layerName": "hero",
                        "rawText": "quick tip",
                        "fontFamily": "Inter",
                        "fontSizePx": 80,
                        "estimatedWidthPx": 320.0,
                    }
                ],
            }
        ]
        # Speaker strongly biased right -> open left flank
        observation = {
            "frames": [
                {
                    "sourceMs": 500,
                    "faceBox": {"x": 0.58, "y": 0.174, "width": 0.22, "height": 0.24},
                }
            ]
        }
        placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(len(placements), 1)
        self.assertEqual(placements[0]["dominantZone"], "flank_left_column")


if __name__ == "__main__":
    unittest.main()
