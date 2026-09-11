import os
import unittest
from pathlib import Path
import numpy as np
from PIL import Image

from mini_run_pipeline.policy_check import (
    measure_frame_text_pixel_bounds,
    run_post_render_conformance_check,
    validate_safe_region_bounds,
    SAFE_MARGIN_X_PX,
)


class TestRound9FrameConformance(unittest.TestCase):
    """Verifies frame-based conformance checking, edge bleed detection, and side-by-side reporting."""

    def setUp(self):
        self.scratch_dir = Path("scratch/test_frame_conformance")
        self.scratch_dir.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        import shutil
        if self.scratch_dir.exists():
            shutil.rmtree(self.scratch_dir, ignore_errors=True)

    def _create_synthetic_frame(self, x_min: int, x_max: int, y_min: int, y_max: int, color=(255, 255, 255)) -> Path:
        """Create a 1080x1920 synthetic frame with text at [x_min:x_max, y_min:y_max]."""
        arr = np.zeros((1920, 1080, 3), dtype=np.uint8)
        arr[y_min:y_max, x_min:x_max] = color
        p = self.scratch_dir / f"frame_{x_min}_{x_max}.png"
        Image.fromarray(arr).save(p)
        return p

    def test_safe_centered_text_no_edge_bleed(self):
        """Centered text within [130, 950] margin envelope must pass with zero edge bleed."""
        frame = self._create_synthetic_frame(200, 880, 900, 1050)
        res = measure_frame_text_pixel_bounds(frame, safe_margin_x=130.0)
        self.assertTrue(res["detected"])
        self.assertFalse(res["edgeBleed"])
        self.assertEqual(res["bleedSide"], "none")
        self.assertGreaterEqual(res["leftClearancePx"], 130.0)
        self.assertGreaterEqual(res["rightClearancePx"], 130.0)
        self.assertAlmostEqual(res["bbox"]["width"], 680, delta=2)

    def test_left_edge_bleed_detected(self):
        """Text bleeding past the left margin (X < 130) must flag edgeBleed=True and bleedSide='left'."""
        frame = self._create_synthetic_frame(50, 500, 900, 1050)
        res = measure_frame_text_pixel_bounds(frame, safe_margin_x=130.0)
        self.assertTrue(res["detected"])
        self.assertTrue(res["edgeBleed"])
        self.assertEqual(res["bleedSide"], "left")
        self.assertLess(res["leftClearancePx"], 130.0)

    def test_right_edge_bleed_detected(self):
        """Text bleeding past the right margin (X > 950) must flag edgeBleed=True and bleedSide='right'."""
        frame = self._create_synthetic_frame(600, 1020, 900, 1050)
        res = measure_frame_text_pixel_bounds(frame, safe_margin_x=130.0)
        self.assertTrue(res["detected"])
        self.assertTrue(res["edgeBleed"])
        self.assertEqual(res["bleedSide"], "right")
        self.assertLess(res["rightClearancePx"], 130.0)

    def test_manifest_estimate_and_pixel_truth_side_by_side(self):
        """Post-render conformance report must include manifest-estimate AND pixel-truth side by side."""
        # Create one safe frame and one edge-bleeding frame
        safe_frame = self._create_synthetic_frame(250, 750, 900, 1020)
        bleed_frame = self._create_synthetic_frame(40, 420, 950, 1100)

        manifest = {
            "chunks": [
                {
                    "chunkIndex": 0,
                    "text": "Safe Centered Headline",
                    "startMs": 0,
                    "endMs": 2000,
                    "layers": [
                        {
                            "layerName": "hero",
                            "rawText": "Safe Centered Headline",
                            "fontFamily": "Montserrat",
                            "fontSizePx": 70,
                            "estimatedWidthPx": 500.0,
                            "isHero": True,
                        }
                    ],
                },
                {
                    "chunkIndex": 1,
                    "text": "Bleeding Left Headline",
                    "startMs": 2000,
                    "endMs": 4000,
                    "layers": [
                        {
                            "layerName": "hero",
                            "rawText": "Bleeding Left Headline",
                            "fontFamily": "Montserrat",
                            "fontSizePx": 70,
                            "estimatedWidthPx": 380.0,  # Manifest thinks width 380 is safe (<820)
                            "isHero": True,
                        }
                    ],
                },
            ]
        }

        # Mock frame results passing the synthetic paths
        report = run_post_render_conformance_check(
            video_path=None,
            manifest_or_props=manifest,
            extract_frames=False,
        )
        self.assertIn("safeRegionBounds", report["checks"])
        self.assertIn("manifestEstimate", report["checks"]["safeRegionBounds"])

        # Directly call with frame paths
        from mini_run_pipeline.policy_check import validate_safe_region_bounds_with_frames
        evaluated = validate_safe_region_bounds_with_frames(
            layers=manifest["chunks"][0]["layers"] + manifest["chunks"][1]["layers"],
            frames=[
                {"timestampSec": 1.0, "framePath": str(safe_frame)},
                {"timestampSec": 3.0, "framePath": str(bleed_frame)},
            ],
            chunks=manifest["chunks"],
        )

        self.assertEqual(evaluated["status"], "failed")  # Because bleed_frame failed pixel truth!
        self.assertIn("manifestEstimate", evaluated)
        self.assertIn("pixelTruth", evaluated)
        self.assertEqual(evaluated["manifestEstimate"]["status"], "passed")
        self.assertEqual(evaluated["pixelTruth"]["status"], "failed")
        self.assertGreater(evaluated["pixelTruth"]["edgeBleedCount"], 0)

        # Confirm side-by-side comparisons structure
        comparisons = evaluated["pixelTruth"]["sideBySideComparisons"]
        self.assertEqual(len(comparisons), 2)
        bleed_comp = comparisons[1]
        self.assertEqual(bleed_comp["manifestEstimate"]["text"], "Bleeding Left Headline")
        self.assertTrue(bleed_comp["pixelTruth"]["edgeBleedDetected"])
        self.assertEqual(bleed_comp["pixelTruth"]["bleedSide"], "left")


if __name__ == "__main__":
    unittest.main()
