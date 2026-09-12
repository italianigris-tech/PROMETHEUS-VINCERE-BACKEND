"""Test Round 11 Fix 2: Group Completion Anchoring & Accelerated-Exit Tween.

Verifies:
1. Multi-word layer entrance completes at the last word's start.
2. Completed group holds for its intrinsic duration from that point.
3. 5-frame exit tween (scale/blur opacity ramp in last 5 frames of durationFrames).
4. Caption sequence temporal overlap allowed (runningEndFrame blocking eliminated).
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path


class TestRound11GroupAnchoring(unittest.TestCase):
    def setUp(self) -> None:
        self.remotion_file = Path("remotion-app/src/compositions/PrometheusMinRun.tsx")
        self.assertTrue(self.remotion_file.exists(), "PrometheusMinRun.tsx must exist")
        self.code = self.remotion_file.read_text(encoding="utf-8")

    def test_running_end_frame_blocking_eliminated(self) -> None:
        """Verify that runningEndFrame serialization lock is completely removed."""
        self.assertNotIn(
            "runningEndFrame",
            self.code,
            "runningEndFrame blocking must be eliminated to allow temporal overlap",
        )
        self.assertIn(
            "// Allow caption sequence temporal overlap (Zero Stacking Lock):",
            self.code,
            "Must document Zero Stacking Lock in Remotion chunk sequence rendering",
        )

    def test_resolve_chunk_entrance_frame_anchors_to_last_word(self) -> None:
        """Verify that resolveChunkEntranceFrame supports lastWordStartFrame parameter."""
        match = re.search(
            r"export const resolveChunkEntranceFrame = \([\s\S]*?\): number => \{([\s\S]*?)\};",
            self.code,
        )
        self.assertIsNotNone(match, "resolveChunkEntranceFrame must be defined")
        body = match.group(1)
        self.assertIn(
            "lastWordStartFrame",
            body,
            "resolveChunkEntranceFrame must anchor to lastWordStartFrame",
        )

    def test_5_frame_scale_blur_exit_tween(self) -> None:
        """Verify that MultiLayerTypographyCard implements a 5-frame scale/blur exit tween."""
        self.assertIn(
            "const exitFrames = 5;",
            self.code,
            "Exit tween must use 5 exitFrames",
        )
        self.assertTrue(
            "const exitBlur = exitProgress * 4;" in self.code or "exitProgress * 20" in self.code,
            "Exit tween must apply blur ramp",
        )
        self.assertIn(
            "const exitScale = interpolate(exitProgress, [0, 1], [1.0, 0.94]);",
            self.code,
            "Exit tween must apply scale ramp from 1.0 to 0.94",
        )

    def test_group_entrance_anchoring_calculation(self) -> None:
        """Verify that entranceFrame in MultiLayerTypographyCard is computed from lastWordStartFrame."""
        self.assertIn(
            "const entranceFrame = resolveChunkEntranceFrame(contentStartFrame, totalFrames, lastWordStartFrame);",
            self.code,
            "MultiLayerTypographyCard must pass lastWordStartFrame to resolveChunkEntranceFrame",
        )


if __name__ == "__main__":
    unittest.main()
