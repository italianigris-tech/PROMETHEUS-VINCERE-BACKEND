import unittest
from mini_run_pipeline.typography import (
    FONT_CHAR_ASPECT_TABLE,
    get_font_char_aspect,
    estimate_layer_width_px,
    preflight_and_fit_layer_widths,
    generate_font_manifest,
)


class TestRound8WidthPreflight(unittest.TestCase):
    """Verifies per-font aspect table, largest-first shrink, and legibility floors."""

    def test_font_char_aspect_table(self):
        """Authoritative aspect table must contain condensed, serif, and sans profiles."""
        # Ultra-condensed
        self.assertLessEqual(FONT_CHAR_ASPECT_TABLE["six caps"], 0.35)
        self.assertLessEqual(FONT_CHAR_ASPECT_TABLE["anton"], 0.42)
        self.assertLessEqual(FONT_CHAR_ASPECT_TABLE["bebas neue"], 0.40)

        # Wide display serifs
        self.assertGreaterEqual(FONT_CHAR_ASPECT_TABLE["bodoni moda"], 0.60)
        self.assertGreaterEqual(FONT_CHAR_ASPECT_TABLE["playfair display"], 0.60)

        # Clean supportive sans
        self.assertGreaterEqual(FONT_CHAR_ASPECT_TABLE["montserrat"], 0.50)
        self.assertLessEqual(FONT_CHAR_ASPECT_TABLE["montserrat"], 0.60)
        self.assertGreaterEqual(FONT_CHAR_ASPECT_TABLE["outfit"], 0.50)
        self.assertGreaterEqual(FONT_CHAR_ASPECT_TABLE["dm sans"], 0.50)

    def test_get_font_char_aspect_uppercase(self):
        """Uppercase text must apply widening factor (~1.3x)."""
        aspect_lower = get_font_char_aspect("Montserrat", is_uppercase=False)
        aspect_upper = get_font_char_aspect("Montserrat", is_uppercase=True)
        self.assertGreater(aspect_upper, aspect_lower)
        self.assertAlmostEqual(aspect_upper / aspect_lower, 1.32, delta=0.05)

    def test_preflight_and_fit_largest_first_shrink(self):
        """Preflight must shrink the largest overflowing layer first and respect legibility floors."""
        layers = [
            {
                "rawText": "A very long headline that definitely overflows",
                "primary_font": "Playfair Display",
                "fontSizePx": 130,
                "is_hero_layer": True,
                "is_upper": False,
            },
            {
                "rawText": "A long companion clause that also overflows",
                "primary_font": "Montserrat",
                "fontSizePx": 75,
                "is_hero_layer": False,
                "is_upper": False,
            },
        ]
        preflight_and_fit_layer_widths(layers, max_safe_width=820.0)

        hero = layers[0]
        companion = layers[1]

        # Hero must not be shrunk below 80px legibility floor
        self.assertGreaterEqual(hero["fontSizePx"], 80)
        self.assertLess(hero["fontSizePx"], 130)

        # Companion must not be shrunk below 50px legibility floor
        self.assertGreaterEqual(companion["fontSizePx"], 50)
        self.assertLess(companion["fontSizePx"], 75)

    def test_preflight_extreme_overflow_hits_floor_cleanly(self):
        """When text is overwhelmingly long, shrink stops at the legibility floor without collapsing to 0."""
        layers = [
            {
                "rawText": "Super extraordinarily excessively long companion phrase that should hit floor",
                "primary_font": "Montserrat",
                "fontSizePx": 75,
                "is_hero_layer": False,
                "is_upper": False,
            }
        ]
        preflight_and_fit_layer_widths(layers, max_safe_width=820.0)
        self.assertEqual(layers[0]["fontSizePx"], 50)

    def test_manifest_across_30_seeds_respects_legibility_floors(self):
        """Manifest generation across 30 seeds must NEVER shrink heroes < 80px or companions < 50px."""
        sample_chunks = [
            {
                "chunkIndex": 0,
                "text": "Over the last 12 months",
                "startMs": 0,
                "endMs": 1400,
                "words": [{"text": "Over"}, {"text": "the"}, {"text": "last"}, {"text": "12"}, {"text": "months"}],
            },
            {
                "chunkIndex": 1,
                "text": "I've sold more than",
                "startMs": 1400,
                "endMs": 2800,
                "words": [{"text": "I've"}, {"text": "sold"}, {"text": "more"}, {"text": "than"}],
            },
            {
                "chunkIndex": 2,
                "text": "12,000 physical products",
                "startMs": 2800,
                "endMs": 4500,
                "words": [{"text": "12,000"}, {"text": "physical"}, {"text": "products"}],
            },
            {
                "chunkIndex": 3,
                "text": "generating multiple 6 figures",
                "startMs": 4500,
                "endMs": 6200,
                "words": [{"text": "generating"}, {"text": "multiple"}, {"text": "6"}, {"text": "figures"}],
            },
        ]

        for seed in range(30):
            design_override = {"seed": seed, "creativity": "expressive"}
            manifest = generate_font_manifest(sample_chunks, design_override=design_override)
            chunks = manifest.get("chunks", [])
            for c in chunks:
                for layer in c.get("layers", []):
                    is_behind = layer.get("behindSubject", False)
                    is_hero = layer.get("isHero", False)
                    font_size = layer.get("fontSizePx", 0)
                    fx = layer.get("fxPreset", "")

                    if is_behind or fx == "hierarchical_asymmetric_lockup":
                        # Behind-subject and asymmetric lockup modifier use deliberate distinct scales
                        continue

                    if is_hero:
                        self.assertGreaterEqual(
                            font_size,
                            80,
                            f"Seed {seed}, Chunk {c.get('chunkIndex')}, Hero layer '{layer.get('rawText')}' font size {font_size}px is below 80px floor!",
                        )
                    else:
                        self.assertGreaterEqual(
                            font_size,
                            50,
                            f"Seed {seed}, Chunk {c.get('chunkIndex')}, Companion layer '{layer.get('rawText')}' font size {font_size}px is below 50px floor!",
                        )


if __name__ == "__main__":
    unittest.main()
