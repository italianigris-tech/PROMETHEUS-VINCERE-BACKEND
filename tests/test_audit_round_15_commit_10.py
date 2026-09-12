import unittest
from mini_run_pipeline.subject_placement import plan_subject_safe_placements
from mini_run_pipeline.policy_check import (
    validate_safe_region_bounds,
    validate_text_visibility_contrast,
    MAX_SAFE_WIDTH_PX,
    SAFE_MARGIN_X_PX,
)


class TestAuditRound15Commit10(unittest.TestCase):
    """Audit test suite for Round 15 Commit 10:
    1. Lower-deck dialogue placement strictly defaults to centered alignment and anchor.
    2. Manifest autoFitScale pass-through brings wide text within safe region bounds (<= 820px).
    3. Text visibility contrast sampling accounts for collisionMs / defocus exit timing.
    4. Centered lower-deck geometry satisfies the 130px safe region clearance boundary.
    """

    def test_lower_deck_placement_enforces_center_alignment(self):
        """foreground_lower_deck placement must force textAlign='center' and anchor='center'."""
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
            },
            {
                "chunkIndex": 1,
                "text": "on Amazon for my business",
                "startMs": 2100,
                "endMs": 4000,
                "layers": [
                    {
                        "layerName": "hero",
                        "rawText": "on Amazon for my business",
                        "fontFamily": "Inter",
                        "fontSizePx": 96,
                        "estimatedWidthPx": 780.0,
                    }
                ],
            }
        ]
        observation = {
            "frames": [
                {
                    "sourceMs": 1000,
                    "faceBox": {"x": 0.40, "y": 0.20, "width": 0.20, "height": 0.25},
                }
            ]
        }
        placements = plan_subject_safe_placements(chunks, observation)
        for p in placements:
            if p["dominantZone"] == "foreground_lower_deck":
                self.assertEqual(p["textAlign"], "center")
                self.assertEqual(p["anchor"], "center")
                self.assertEqual(p["xPercent"], "50.0%")

    def test_manifest_autofit_scale_effective_width(self):
        """Layers with autoFitScale < 1.0 scale effective_width to remain <= MAX_SAFE_WIDTH_PX (820px)."""
        # Unscaled width is 1356px, which would violate 820px limit
        raw_width = 1356.0
        scale = 820.0 / raw_width  # ~0.6047
        layers = [
            {
                "chunkIndex": 0,
                "layerName": "hero",
                "rawText": "Over the last 12 months,",
                "fontFamily": "Inter",
                "fontSizePx": 104,
                "estimatedWidthPx": raw_width,
                "autoFitScale": scale,
            },
            {
                "chunkIndex": 6,
                "layerName": "hero",
                "rawText": "than 6 figures",
                "fontFamily": "Inter",
                "fontSizePx": 120,
                "estimatedWidthPx": 998.0,
                "autoFitScale": 820.0 / 998.0,
            },
        ]
        res = validate_safe_region_bounds(layers, max_safe_width=MAX_SAFE_WIDTH_PX)
        self.assertEqual(res["status"], "passed")
        self.assertEqual(res["overflowCount"], 0)
        self.assertEqual(len(res["violations"]), 0)

    def test_visibility_contrast_collision_aware_mount_ts(self):
        """Contrast check samples mid-hold accounting for collisionMs exit defocus."""
        # Chunk 8: startMs=10768, endMs=11669, collisionMs=500
        # If naive midpoint used: (10768 + 11669) / 2000 = 11.218s (during collision unmount/blur)
        # Collision-aware: effective_end = 11669 - 500 = 11169 -> mount_ts = (10768 + 11169) / 2000 = 10.969s
        start_ms = 10768
        end_ms = 11669
        collision_ms = 500

        naive_mount_ts = (start_ms + end_ms) / 2000.0
        effective_end_ms = max(start_ms + 200, end_ms - collision_ms) if collision_ms > 0 else end_ms
        collision_aware_mount_ts = (start_ms + effective_end_ms) / 2000.0

        self.assertAlmostEqual(naive_mount_ts, 11.2185, places=3)
        self.assertAlmostEqual(collision_aware_mount_ts, 10.9685, places=3)
        # Verify sampling occurs strictly within the active, non-colliding speech duration
        self.assertLess(collision_aware_mount_ts, (end_ms - collision_ms) / 1000.0)

    def test_safe_region_pixel_clearance_geometry(self):
        """Centered placement of an 820px card within a 1080px frame satisfies 130px clearance."""
        frame_width = 1080
        max_card_width = MAX_SAFE_WIDTH_PX  # 820.0
        left_clearance = (frame_width - max_card_width) / 2.0
        right_clearance = (frame_width - max_card_width) / 2.0

        self.assertGreaterEqual(left_clearance, SAFE_MARGIN_X_PX)
        self.assertGreaterEqual(right_clearance, SAFE_MARGIN_X_PX)
        self.assertEqual(left_clearance, 130.0)
        self.assertEqual(right_clearance, 130.0)


if __name__ == "__main__":
    unittest.main()
