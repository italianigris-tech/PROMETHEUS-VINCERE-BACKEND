import unittest
from mini_run_pipeline.typography import generate_font_manifest, is_descriptor_phrase


class TestRound10NounPhraseOverlap(unittest.TestCase):
    """Verifies Round 10 Fix 5:
    - Descriptor noun-phrase chunks ('sunshine and rainbows.') route to 2.5D lockup.
    - Tight tier pairing: companion layer sized at >= 70px (ratio >= 0.60 of hero).
    - 2.5D overlap: negative margin tuck, single grounding shadow, and vertical gradient fade.
    """

    def test_descriptor_phrase_detector(self):
        self.assertTrue(is_descriptor_phrase("sunshine and rainbows."))
        self.assertTrue(is_descriptor_phrase("12,000 physical products"))
        self.assertTrue(is_descriptor_phrase("clean modern results"))
        self.assertFalse(is_descriptor_phrase("hello"))

    def test_sunshine_and_rainbows_routes_to_tight_2_5d_lockup_across_30_seeds(self):
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
            chunk = manifest["chunks"][1]
            layers = chunk.get("layers", [])

            self.assertGreaterEqual(len(layers), 2, f"Seed {seed}: chunk not split into multi-layer lockup")

            hero_layer = next((l for l in layers if l.get("isHero")), layers[0])
            companion_layer = next((l for l in layers if not l.get("isHero")), layers[-1])

            hero_size = float(hero_layer.get("fontSizePx", 0))
            comp_size = float(companion_layer.get("fontSizePx", 0))

            # 1. Tight tier pairing: companion must be >= 70px
            self.assertGreaterEqual(
                comp_size,
                70.0,
                f"Seed {seed}: companion size {comp_size}px is below 70px floor for descriptor phrase!",
            )
            # Ratio must be tight (<= 1.7x gap)
            tier_ratio = hero_size / comp_size
            self.assertLessEqual(
                tier_ratio,
                1.70,
                f"Seed {seed}: tier ratio {tier_ratio:.2f} is too wide (hero {hero_size}px vs companion {comp_size}px)!",
            )

            # 2. 2.5D overlap: one overlapping, one underlapping
            has_overlap = any(l.get("isOverlapping") for l in layers)
            has_underlap = any(l.get("isUnderlapping") for l in layers)
            self.assertTrue(
                has_overlap and has_underlap,
                f"Seed {seed}: 2.5D overlap hierarchy missing (overlap={has_overlap}, underlap={has_underlap})",
            )

            # 3. Grounding shadow & vertical gradient
            over_layer = next(l for l in layers if l.get("isOverlapping"))
            under_layer = next(l for l in layers if l.get("isUnderlapping"))
            self.assertIn("0 4px 18px", over_layer.get("shadow", ""))
            self.assertTrue(bool(under_layer.get("verticalGradient") or under_layer.get("hasGradient")))


if __name__ == "__main__":
    unittest.main()
