"""Test Round 11 Fix 5: Overlap Routing Widening (Prepositional Phrases & Wrapping Flanks).

Verifies:
1. is_prepositional_phrase detects 'from home', 'from eBay.com', 'from my laptop', etc.
2. is_descriptor_phrase detects prepositional phrases.
3. is_wrapping_flank_chunk detects multi-word flank column chunks.
4. Prepositional phrases across 30 seeds route to 2.5D lockup with gradient fade + single grounding shadow.
"""

from __future__ import annotations

import unittest
from mini_run_pipeline.typography import (
    generate_font_manifest,
    is_2_5d_overlap_candidate,
    is_descriptor_phrase,
    is_prepositional_phrase,
    is_wrapping_flank_chunk,
)


class TestRound11OverlapWidening(unittest.TestCase):
    def test_is_prepositional_phrase_detection(self) -> None:
        """Verify prepositional phrases are correctly identified."""
        self.assertTrue(is_prepositional_phrase("from home"))
        self.assertTrue(is_prepositional_phrase("from eBay.com"))
        self.assertTrue(is_prepositional_phrase("from my laptop."))
        self.assertTrue(is_prepositional_phrase("in my bedroom"))
        self.assertTrue(is_prepositional_phrase("across the world"))
        self.assertFalse(is_prepositional_phrase("home"))
        self.assertFalse(is_prepositional_phrase("eBay.com"))
        self.assertFalse(is_prepositional_phrase("from"))

    def test_is_descriptor_phrase_includes_prepositional(self) -> None:
        """Verify is_descriptor_phrase returns True for prepositional phrases."""
        self.assertTrue(is_descriptor_phrase("from home"))
        self.assertTrue(is_descriptor_phrase("from eBay.com"))
        self.assertTrue(is_descriptor_phrase("sunshine and rainbows"))

    def test_is_wrapping_flank_chunk(self) -> None:
        """Verify wrapping flank chunk detector."""
        flank_chunk = {
            "placement": {"dominantZone": "flank_left_column", "safeRegionId": "flank_left_pillar"},
        }
        center_chunk = {
            "placement": {"dominantZone": "foreground_lower_deck"},
        }
        self.assertTrue(is_wrapping_flank_chunk(chunk=flank_chunk, text="two words"))
        self.assertFalse(is_wrapping_flank_chunk(chunk=center_chunk, text="two words"))
        self.assertFalse(is_wrapping_flank_chunk(chunk=flank_chunk, text="oneword"))

    def test_prepositional_phrases_receive_2_5d_overlap_across_30_seeds(self) -> None:
        """Verify 'from home' routes to 2.5D lockup with gradient fade & grounding shadow across 30 seeds."""
        chunks_input = [
            {
                "chunkIndex": 1,
                "text": "Over the last twelve months,",
                "startMs": 0,
                "endMs": 1400,
                "words": [{"text": "Over"}, {"text": "the"}, {"text": "last"}, {"text": "twelve"}, {"text": "months,"}],
            },
            {
                "chunkIndex": 2,
                "text": "from home",
                "startMs": 1400,
                "endMs": 2800,
                "words": [{"text": "from"}, {"text": "home"}],
            },
        ]

        for seed in range(30):
            manifest = generate_font_manifest(chunks_input, design_override={"seed": f"overlap-seed-{seed}", "creativity": "expressive"})
            chunks = manifest.get("chunks", [])
            self.assertEqual(len(chunks), 2)

            # Check chunk 2 ("from home")
            c2_layers = chunks[1].get("rendered_layers") or chunks[1].get("layers") or []
            if len(c2_layers) >= 2:
                has_overlap = any(l.get("isOverlapping") for l in c2_layers)
                has_underlap = any(l.get("isUnderlapping") for l in c2_layers)
                self.assertTrue(
                    has_overlap and has_underlap,
                    f"Seed {seed}: 'from home' did not trigger 2.5D overlap hierarchy",
                )

                # Overlapping layer must have single grounding shadow
                over_layer = next((l for l in c2_layers if l.get("isOverlapping") and not l.get("isUnderlapping")), c2_layers[-1])
                self.assertIn("0 4px 18px", over_layer.get("shadow", ""))


if __name__ == "__main__":
    unittest.main()
