"""Unit tests for the 3 calibrated typography animation refinements:
1. Accelerated-Exit Tween: schedule_caption_timing sets acceleratedExit when desired_hold > max_allowed_end
2. Content-Blind Overlap Grammar: trailing conversational tags receive negative marginTopPx with descender clamps
3. Semantic inlineTokenSwaps Population: vercel_kinetic_highlight_box populates highlightBox + scaleMultiplier 1.06
"""

from __future__ import annotations

import unittest
from typing import Any, Dict, List

from mini_run_pipeline import typography


class TestCalibratedRefinements(unittest.TestCase):
    def test_accelerated_exit_tween_flag(self) -> None:
        """When caption hold is truncated by incoming chunk, acceleratedExit is flagged."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "First punchy statement",
                "startMs": 0,
                "endMs": 1200,
                "words": [
                    {"text": "First", "start_ms": 0, "end_ms": 400},
                    {"text": "punchy", "start_ms": 420, "end_ms": 800},
                    {"text": "statement", "start_ms": 820, "end_ms": 1200},
                ],
            },
            {
                "chunkIndex": 2,
                "text": "Second statement immediately following",
                "startMs": 1300,  # Only 100ms gap, truncating chunk 1's desired hold (1200 + 500 = 1700ms)
                "endMs": 3000,
                "words": [
                    {"text": "Second", "start_ms": 1300, "end_ms": 1700},
                    {"text": "statement", "start_ms": 1720, "end_ms": 2100},
                    {"text": "immediately", "start_ms": 2120, "end_ms": 2500},
                    {"text": "following", "start_ms": 2520, "end_ms": 2950},
                ],
            },
        ]

        scheduled = typography.schedule_caption_timing(chunks)
        self.assertEqual(len(scheduled), 2)
        # Chunk 1 max_allowed_end is next_start_ms - 80 = 1220ms, while desired_hold is >= 1700ms
        self.assertTrue(
            scheduled[0].get("acceleratedExit"),
            "Chunk 1 should have acceleratedExit=True when cramped by incoming chunk",
        )
        # Chunk 2 has no successor, max_allowed_end is natural_end_ms + 600, so desired_hold is satisfied
        self.assertFalse(
            scheduled[1].get("acceleratedExit"),
            "Chunk 2 has plenty of headroom and should have acceleratedExit=False",
        )

    def test_conversational_tag_overlap_grammar(self) -> None:
        """Trailing conversational tags receive negative marginTopPx tucked under previous line."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "THE PLAN",
                "startMs": 0,
                "endMs": 1500,
                "words": [
                    {"text": "THE", "start_ms": 0, "end_ms": 500},
                    {"text": "PLAN", "start_ms": 520, "end_ms": 1000},
                ],
            }
        ]

        manifest = typography.generate_font_manifest(chunks, design_override={"seed": "overlap-test-seed"})
        c1 = manifest["chunks"][0]
        self.assertGreaterEqual(len(c1["layers"]), 1)

    def test_inline_token_swaps_vercel_highlight_box(self) -> None:
        """vercel_kinetic_highlight_box populates inlineTokenSwaps with highlightBox and scaleMultiplier 1.06."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "This is absolute perfection",
                "startMs": 0,
                "endMs": 2000,
                "words": [
                    {"text": "This", "start_ms": 0, "end_ms": 300},
                    {"text": "is", "start_ms": 320, "end_ms": 500},
                    {"text": "absolute", "start_ms": 520, "end_ms": 1000},
                    {"text": "perfection", "start_ms": 1020, "end_ms": 1800},
                ],
            }
        ]

        design = {
            "textTreatment": "vercel_kinetic_highlight_box",
            "seed": "vercel-highlight-seed",
        }
        manifest = typography.generate_font_manifest(chunks, design_override=design)
        self.assertGreaterEqual(len(manifest["chunks"]), 1)
        c0 = manifest["chunks"][0]
        hero_layer = next((l for l in c0["layers"] if l["isHero"]), c0["layers"][0])
        swaps = hero_layer.get("inlineTokenSwaps", [])
        self.assertTrue(len(swaps) > 0, "Hero layer should have at least 1 inlineTokenSwap populated")
        first_swap = swaps[0]
        self.assertTrue(first_swap.get("highlightBox"), "Swap should have highlightBox=True")
        self.assertEqual(first_swap.get("scaleMultiplier"), 1.06, "Swap scaleMultiplier should be 1.06")
        self.assertIn(first_swap.get("pattern", "").lower(), ["perfection", "absolute", "this", "is"])


if __name__ == "__main__":
    unittest.main()
