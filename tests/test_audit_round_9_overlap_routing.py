import unittest
from mini_run_pipeline.typography import (
    generate_font_manifest,
    is_descriptor_phrase,
)


class TestRound9OverlapRouting(unittest.TestCase):
    """Verifies that descriptor phrases are preferentially routed into the 2.5D archetype."""

    def test_is_descriptor_phrase_detector(self):
        """is_descriptor_phrase must correctly detect compound phrases, adjective+noun, and coordinated pairs."""
        self.assertTrue(is_descriptor_phrase("sunshine and rainbows."))
        self.assertTrue(is_descriptor_phrase("12,000 physical products"))
        self.assertTrue(is_descriptor_phrase("digital camera and accessories"))
        self.assertTrue(is_descriptor_phrase("clean modern results"))
        self.assertFalse(is_descriptor_phrase("hello"))
        self.assertFalse(is_descriptor_phrase("and"))
        self.assertFalse(is_descriptor_phrase("the"))

    def test_descriptor_phrases_receive_2_5d_overlap_and_gradient(self):
        """Chunks with descriptor phrases must route to the 2.5D archetype with gradient fade & grounding shadow."""
        chunks_input = [
            {
                "chunkIndex": 0,
                "text": "Over the last 12 months",
                "startMs": 0,
                "endMs": 1400,
                "words": [{"text": "Over"}, {"text": "the"}, {"text": "last"}, {"text": "12"}, {"text": "months"}],
            },
            {
                "chunkIndex": 1,
                "text": "sunshine and rainbows.",
                "startMs": 1400,
                "endMs": 3000,
                "words": [{"text": "sunshine"}, {"text": "and"}, {"text": "rainbows."}],
            },
        ]

        for seed in range(30):
            manifest = generate_font_manifest(chunks_input, design_override={"seed": seed, "creativity": "expressive"})
            chunks = manifest.get("chunks", [])
            self.assertEqual(len(chunks), 2)

            # Check chunk 1 ("sunshine and rainbows.")
            c1_layers = chunks[1].get("rendered_layers") or chunks[1].get("layers") or []
            if len(c1_layers) >= 2:
                # One layer must be marked isOverlapping and one marked isUnderlapping
                has_overlap = any(l.get("isOverlapping") for l in c1_layers)
                has_underlap = any(l.get("isUnderlapping") for l in c1_layers)
                self.assertTrue(
                    has_overlap and has_underlap,
                    f"Seed {seed}: 'sunshine and rainbows.' did not trigger 2.5D overlap hierarchy (isOverlapping={has_overlap}, isUnderlapping={has_underlap})",
                )

                # Overlapping layer must have single grounding shadow
                over_layer = next((l for l in c1_layers if l.get("isOverlapping") and not l.get("isUnderlapping")), c1_layers[-1])
                self.assertIn("0 4px 18px", over_layer.get("shadow", ""))

                # Underlapping layer must have vertical linear gradient fade
                under_layer = next(l for l in c1_layers if l.get("isUnderlapping"))
                self.assertTrue(
                    bool(under_layer.get("verticalGradient") or under_layer.get("hasGradient")),
                    f"Seed {seed}: Underlapping layer missing vertical linear gradient fade",
                )


if __name__ == "__main__":
    unittest.main()
