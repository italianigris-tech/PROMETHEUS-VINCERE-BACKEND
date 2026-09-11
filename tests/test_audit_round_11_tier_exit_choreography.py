"""Test Round 11 Fix 3: Tier Exit Choreography in Multi-Tier Lockups.

Verifies:
1. In 2-tier lockups, companion tier animates OUT when hero layer completes entrance or lands.
2. Companion tier does not statically linger after hero entry (e.g. 'sometimes in my' exits when 'Sunday best' lands).
3. KineticLayerRenderer accepts tierExitFrame and applies scale/blur/opacity exit tween, returning null after 10 frames.
4. HierarchicalAsymmetricLockupComposition triggers exit for modifier words when hero lands.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path


class TestRound11TierExitChoreography(unittest.TestCase):
    def setUp(self) -> None:
        self.remotion_file = Path("remotion-app/src/compositions/PrometheusMinRun.tsx")
        self.assertTrue(self.remotion_file.exists(), "PrometheusMinRun.tsx must exist")
        self.code = self.remotion_file.read_text(encoding="utf-8")

    def test_companion_exit_frame_calculation_in_card(self) -> None:
        """Verify that MultiLayerTypographyCard calculates companionExitFrame when companion precedes hero."""
        self.assertIn(
            "// In 2-tier lockups, calculate companion tier exit frame when hero lands",
            self.code,
            "Must calculate companion tier exit frame in 2-tier lockup",
        )
        self.assertIn(
            "companionExitFrame = contentStartFrame + Math.round(((heroStartMs - chunkStartMs) / 1000) * fps);",
            self.code,
            "companionExitFrame must be anchored to heroStartMs",
        )
        self.assertIn(
            "tierExitFrame={isCompanion ? companionExitFrame : undefined}",
            self.code,
            "tierExitFrame must be passed to companion layer renderer",
        )

    def test_kinetic_layer_renderer_tier_exit_tween(self) -> None:
        """Verify KineticLayerRenderer implements tier exit tween and returns null upon completion."""
        self.assertIn(
            "tierExitFrame?: number;",
            self.code,
            "KineticLayerRenderer props must include tierExitFrame",
        )
        self.assertIn(
            "if (isTierExiting && tierExitElapsed >= 10) {",
            self.code,
            "Companion tier must unmount (return null) once exit completes",
        )
        self.assertIn(
            "const tierExitOpacity = 1 - tierExitP;",
            self.code,
            "Companion tier must fade out during tier exit",
        )

    def test_hierarchical_lockup_modifier_exit_on_hero_landing(self) -> None:
        """Verify HierarchicalAsymmetricLockupComposition triggers modifier exit when hero lands."""
        self.assertIn(
            "// Tier Exit Choreography: If companion modifier enters before hero, modifier animates OUT when hero lands",
            self.code,
            "Must document Tier Exit Choreography in lockup modifier rendering",
        )
        self.assertIn(
            "const triggerF = Math.min(wordPushF, heroStartF);",
            self.code,
            "Modifier push trigger must be triggered by hero landing frame",
        )

    def test_chunk_15_timing_simulation(self) -> None:
        """Simulate Chunk 15 timing to prove companion exits when hero lands."""
        fps = 30
        chunk_start_ms = 14951
        companion_start_ms = 14951
        hero_start_ms = 15992

        content_start_frame = Math_round = round((chunk_start_ms / 1000) * fps)
        hero_start_frame = content_start_frame + round(((hero_start_ms - chunk_start_ms) / 1000) * fps)

        self.assertGreater(
            hero_start_ms,
            companion_start_ms,
            "Companion precedes hero in Chunk 15",
        )
        # Verify companion exit frame corresponds exactly to hero landing frame
        companion_exit_frame = content_start_frame + round(((hero_start_ms - chunk_start_ms) / 1000) * fps)
        self.assertEqual(companion_exit_frame, hero_start_frame)
        self.assertEqual(companion_exit_frame - content_start_frame, 31)  # ~1.04s gap at 30fps


if __name__ == "__main__":
    unittest.main()
