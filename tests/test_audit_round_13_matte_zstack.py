"""Audit test for Round 13 Fix 3: Enforce structural z-stack partitioning.
background (1) < behind-pivots (25) < matte (50) < foreground text (100)
"""

import os
import re
import unittest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMETHEUS_TSX = os.path.join(
    ROOT_DIR, "remotion-app", "src", "compositions", "PrometheusMinRun.tsx"
)


class TestRound13MatteZStackAudit(unittest.TestCase):
    def setUp(self):
        with open(PROMETHEUS_TSX, "r", encoding="utf-8") as f:
            self.tsx_content = f.read()

    def test_spatial_camera_rig_supports_stage_zindex(self):
        """Spatial3DCameraRig must accept stageZIndex and apply it to its container."""
        self.assertIn("stageZIndex?: number;", self.tsx_content)
        self.assertIn("stageZIndex = 100", self.tsx_content)
        # Verify it applies to AbsoluteFill
        self.assertIn("zIndex: stageZIndex", self.tsx_content)

    def test_behind_chunks_rendered_before_matte_at_z25(self):
        """behindChunks must be in a Spatial3DCameraRig at stageZIndex={25} before the matte."""
        # Find the section with behindChunks
        behind_match = re.search(
            r"behindChunks\.length\s*>\s*0\s*&&\s*\(\s*<Spatial3DCameraRig[^>]*stageZIndex=\{25\}",
            self.tsx_content,
        )
        self.assertIsNotNone(behind_match, "behindChunks must be rendered with stageZIndex={25}")

    def test_subject_matte_rendered_at_z50_between_stages(self):
        """Subject matte OffthreadVideo container must be rendered at zIndex: 50."""
        # Check matte AbsoluteFill has zIndex: 50
        matte_fill_match = re.search(
            r"<AbsoluteFill\s+style=\{\{\s*zIndex:\s*50,\s*pointerEvents:\s*\"none\"",
            self.tsx_content,
        )
        self.assertIsNotNone(matte_fill_match, "Matte AbsoluteFill container must have zIndex: 50")

    def test_foreground_chunks_rendered_after_matte_at_z100(self):
        """foregroundChunks must be rendered in a Spatial3DCameraRig at stageZIndex={100} after the matte."""
        fg_match = re.search(
            r"foregroundChunks\.length\s*>\s*0\s*&&\s*\(\s*<Spatial3DCameraRig[^>]*stageZIndex=\{100\}",
            self.tsx_content,
        )
        self.assertIsNotNone(fg_match, "foregroundChunks must be rendered with stageZIndex={100}")

    def test_structural_order_is_behind_then_matte_then_foreground(self):
        """Verify structural order in JSX: behind stage (25) precedes matte (50) which precedes foreground (100)."""
        idx_behind = self.tsx_content.find("stageZIndex={25}")
        idx_matte = self.tsx_content.find("zIndex: 50, pointerEvents: \"none\", overflow: \"hidden\"")
        idx_fg = self.tsx_content.find("stageZIndex={100}")

        self.assertTrue(idx_behind > 0, "behind stage not found")
        self.assertTrue(idx_matte > 0, "matte not found")
        self.assertTrue(idx_fg > 0, "foreground stage not found")

        self.assertLess(
            idx_behind,
            idx_matte,
            "behind stage (z=25) must be declared BEFORE matte stage (z=50) in DOM tree",
        )
        self.assertLess(
            idx_matte,
            idx_fg,
            "matte stage (z=50) must be declared BEFORE foreground stage (z=100) in DOM tree",
        )


if __name__ == "__main__":
    unittest.main()
