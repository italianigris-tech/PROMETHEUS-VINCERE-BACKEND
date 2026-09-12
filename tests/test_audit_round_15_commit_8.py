import os
import unittest
from pathlib import Path
import numpy as np
from PIL import Image

from mini_run_pipeline.subject_placement import (
    _clamp_safe_x_percent,
    plan_subject_safe_placements,
)
from mini_run_pipeline.policy_check import (
    measure_frame_text_pixel_bounds,
    validate_safe_region_bounds_with_frames,
    SAFE_MARGIN_X_PX,
)


class TestAuditRound15Commit8(unittest.TestCase):
    """Audit test suite for Round 15 Commit 8:
    1. Width-aware and anchor-aware placement clamping with robust text fallback.
    2. Prevention of false-positive edge bleeds on real frames (Chunk 6 and Chunk 19).
    """

    def setUp(self):
        self.scratch_dir = Path("scratch/test_r15_c8")
        self.scratch_dir.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        import shutil
        if self.scratch_dir.exists():
            shutil.rmtree(self.scratch_dir, ignore_errors=True)

    def test_clamp_safe_x_percent_anchor_aware(self):
        """_clamp_safe_x_percent respects anchor geometry and keeps text within [130, 950]."""
        # Center anchor with 600px width: safe center must be between 130 + 300 = 430px (39.8%) and 950 - 300 = 650px (60.2%)
        clamped_center_low = _clamp_safe_x_percent("20%", est_width_px=600.0, anchor="center")
        self.assertEqual(clamped_center_low, "39.8%")

        clamped_center_high = _clamp_safe_x_percent("85%", est_width_px=600.0, anchor="center")
        self.assertEqual(clamped_center_high, "60.2%")

        # Left anchor with 400px width: safe left must be >= 130px (12.0%) and <= 950 - 400 = 550px (50.9%)
        clamped_left_low = _clamp_safe_x_percent("5%", est_width_px=400.0, anchor="left")
        self.assertEqual(clamped_left_low, "12.0%")

        clamped_left_high = _clamp_safe_x_percent("80%", est_width_px=400.0, anchor="left")
        self.assertEqual(clamped_left_high, "50.9%")

    def test_plan_subject_safe_placements_unpopulated_layers_fallback(self):
        """plan_subject_safe_placements estimates width from raw text when layers is empty."""
        chunks = [
            {
                "chunkIndex": 0,
                "text": "Over the last 12 months, I've purchased more than 12,000 physical products",
                "startMs": 0,
                "endMs": 2000,
                "layers": [],  # Empty layers
            }
        ]
        placements = plan_subject_safe_placements(chunks, None)
        self.assertEqual(len(placements), 1)
        p = placements[0]
        # Text with 74 chars will have estimated width > 820px envelope -> clamps to 50.0% center
        self.assertEqual(p["xPercent"], "50.0%")

    def test_measure_frame_text_pixel_bounds_chunk6_and_chunk19(self):
        """measure_frame_text_pixel_bounds correctly isolates text without false bleed on real frames."""
        # If master render frames exist from previous run, test directly against them
        f_8_6 = Path("scratch_frames/frame_8.6s.png")
        f_22_5 = Path("scratch_frames/frame_22.5s.png")
        if f_8_6.exists() and f_22_5.exists():
            # Chunk 6 (8.6s): placed at yPercent ~ 51.4% (center y ~ 987px)
            res_8_6 = measure_frame_text_pixel_bounds(f_8_6, safe_margin_x=130.0, expected_y_center=987.0)
            self.assertTrue(res_8_6["detected"])
            self.assertFalse(res_8_6["edgeBleed"])
            self.assertGreaterEqual(res_8_6["leftClearancePx"], 130.0)
            self.assertGreaterEqual(res_8_6["rightClearancePx"], 130.0)

            # Chunk 19 (22.5s): placed at yPercent ~ 80% (center y ~ 1536px)
            res_22_5 = measure_frame_text_pixel_bounds(f_22_5, safe_margin_x=130.0, expected_y_center=1536.0)
            self.assertTrue(res_22_5["detected"])
            self.assertFalse(res_22_5["edgeBleed"])
            self.assertGreaterEqual(res_22_5["leftClearancePx"], 130.0)
            self.assertGreaterEqual(res_22_5["rightClearancePx"], 130.0)
        else:
            # Synthetic frame with human skin tone patch and bright text
            arr = np.zeros((1920, 1080, 3), dtype=np.uint8)
            # Add warm human skin patch in upper third [500..800, 50..300] (lum ~ 100)
            arr[500:800, 50:300] = [140, 100, 70]
            # Add bright dialogue text at lower third [1450..1550, 250..830] (lum ~ 255)
            arr[1450:1550, 250:830] = [255, 255, 255]
            p_synth = self.scratch_dir / "synth_skin_and_text.png"
            Image.fromarray(arr).save(p_synth)

            res = measure_frame_text_pixel_bounds(p_synth, safe_margin_x=130.0, expected_y_center=1500.0)
            self.assertTrue(res["detected"])
            self.assertFalse(res["edgeBleed"])
            self.assertGreaterEqual(res["leftClearancePx"], 130.0)
            self.assertGreaterEqual(res["rightClearancePx"], 130.0)


if __name__ == "__main__":
    unittest.main()
