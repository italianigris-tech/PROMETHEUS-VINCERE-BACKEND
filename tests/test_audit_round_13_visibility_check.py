"""Unit tests for Round 13 Fix 2: Text visibility assertion check.

Verifies:
1. When text renders with visible contrast delta in its placement bbox, validate_text_visibility_contrast passes.
2. When mounted text produces near-zero bbox delta (e.g. buried under opaque matte cutout), hard FAIL.
3. textVisibility is a first-class check in run_post_render_conformance_check.
"""

import shutil
import unittest
from pathlib import Path
import numpy as np
from PIL import Image

from mini_run_pipeline.policy_check import (
    validate_text_visibility_contrast,
    run_post_render_conformance_check,
)


class TestRound13VisibilityCheck(unittest.TestCase):
    """Verifies that invisible or matte-occluded text causes a hard test failure."""

    def setUp(self):
        self.scratch_dir = Path("scratch/test_visibility_check")
        self.scratch_dir.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        if self.scratch_dir.exists():
            shutil.rmtree(self.scratch_dir, ignore_errors=True)

    def _create_frame(self, filename: str, draw_text_box: bool = False, bbox=(300, 500, 600, 700)) -> Path:
        """Create a synthetic talking head frame (dark shirt/torso)."""
        # Baseline frame: dark background with subject torso
        arr = np.full((1920, 1080, 3), 20, dtype=np.uint8)
        # Simulate speaker torso in middle
        arr[400:1600, 250:850] = [35, 30, 40]

        if draw_text_box:
            # Draw high-contrast text pixels
            x1, y1, x2, y2 = bbox
            arr[y1:y2:15, x1:x2:8] = [255, 255, 255]
            arr[y1+5:y2:20, x1+5:x2:10] = [0, 240, 255]

        p = self.scratch_dir / filename
        Image.fromarray(arr).save(p)
        return p

    def test_visible_text_passes(self):
        """When text appears at mount+10 with high contrast delta, visibility check passes."""
        pre_frame = self._create_frame("pre_1.0s.png", draw_text_box=False)
        mount_frame = self._create_frame("mount_1.4s.png", draw_text_box=True, bbox=(200, 500, 600, 800))

        chunks = [
            {
                "chunkIndex": 1,
                "text": "Over the last 12 months,",
                "displayStartMs": 1000,
                "displayEndMs": 2500,
                "placement": {"xPercent": "35%", "yPercent": "35%"},
                "layers": [{"estimatedWidthPx": 400}],
            }
        ]
        frames = [
            {"timestampSec": 0.9, "framePath": str(pre_frame)},
            {"timestampSec": 1.35, "framePath": str(mount_frame)},
        ]

        res = validate_text_visibility_contrast(chunks, frames=frames)
        self.assertEqual(res["status"], "passed")
        self.assertEqual(res["visibleChunks"], 1)
        self.assertEqual(res["invisibleChunks"], 0)
        self.assertEqual(len(res["violations"]), 0)

    def test_invisible_text_causes_hard_failure(self):
        """When text mounts but bbox shows no delta (occluded/buried under matte), hard FAIL."""
        pre_frame = self._create_frame("pre_2.0s.png", draw_text_box=False)
        # Mount frame is identical to pre_frame: text was occluded / never rendered
        mount_frame = self._create_frame("mount_2.4s.png", draw_text_box=False)

        chunks = [
            {
                "chunkIndex": 2,
                "text": "Buried under speaker matte",
                "displayStartMs": 2000,
                "displayEndMs": 3500,
                "placement": {"xPercent": "35%", "yPercent": "35%"},
                "layers": [{"estimatedWidthPx": 400}],
            }
        ]
        frames = [
            {"timestampSec": 1.9, "framePath": str(pre_frame)},
            {"timestampSec": 2.35, "framePath": str(mount_frame)},
        ]

        res = validate_text_visibility_contrast(chunks, frames=frames)
        self.assertEqual(res["status"], "failed")
        self.assertEqual(res["invisibleChunks"], 1)
        self.assertGreater(len(res["violations"]), 0)
        self.assertIn("insufficient visibility delta", res["violations"][0])

    def test_integration_in_post_render_conformance_check(self):
        """textVisibility is included in policyReport['checks']."""
        pre_frame = self._create_frame("pre_1.0s.png", draw_text_box=False)
        mount_frame = self._create_frame("mount_1.4s.png", draw_text_box=True)

        manifest = {
            "chunks": [
                {
                    "chunkIndex": 1,
                    "text": "Visible Chunk",
                    "displayStartMs": 1000,
                    "displayEndMs": 2500,
                    "placement": {"xPercent": "35%", "yPercent": "35%"},
                    "layers": [{"layerName": "hero", "rawText": "Visible Chunk", "fontSizePx": 60, "isHero": True}],
                }
            ]
        }
        report = run_post_render_conformance_check(
            manifest_or_props=manifest,
            extract_frames=False,
        )
        self.assertIn("textVisibility", report["checks"])


if __name__ == "__main__":
    unittest.main()
