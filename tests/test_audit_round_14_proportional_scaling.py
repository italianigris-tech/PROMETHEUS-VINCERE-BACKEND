import unittest
from mini_run_pipeline.typography import (
    generate_font_manifest,
    preflight_and_fit_layer_widths,
)


class TestRound14ProportionalScaling(unittest.TestCase):
    """Test suite for Round 14 Commit 6: Relative Proportional Lockup Scaling (companion >= 0.55 * hero)."""

    def test_companion_size_at_least_55_percent_of_hero_in_manifest(self):
        """In multi-layer chunks, every companion layer must have fontSizePx >= 0.55 * hero_fontSizePx."""
        chunks_input = [
            {
                "chunkIndex": i,
                "text": f"Historic landmark discovery phrase {i}",
                "startMs": i * 1500,
                "endMs": i * 1500 + 1400,
                "words": [
                    {"text": "Historic"},
                    {"text": "landmark"},
                    {"text": "discovery"},
                    {"text": "phrase"},
                    {"text": str(i)},
                ],
            }
            for i in range(12)
        ]

        # Test across multiple seeds and treatments
        for seed in range(10):
            manifest = generate_font_manifest(
                chunks_input,
                design_override={"seed": seed, "creativity": "expressive"},
            )
            for chunk in manifest.get("chunks", []):
                layers = chunk.get("rendered_layers", [])
                if len(layers) > 1:
                    hero_layer = next((l for l in layers if l.get("isHero")), None)
                    if hero_layer:
                        hero_size = hero_layer.get("fontSizePx", 0)
                        expected_floor = int(round(0.55 * hero_size))
                        for comp in layers:
                            if not comp.get("isHero"):
                                comp_size = comp.get("fontSizePx", 0)
                                self.assertGreaterEqual(
                                    comp_size,
                                    expected_floor,
                                    f"Seed {seed} Chunk {chunk.get('chunkIndex')}: Companion font size ({comp_size}px) "
                                    f"dropped below 55% floor ({expected_floor}px) of hero size ({hero_size}px)!",
                                )

    def test_preflight_width_fitting_respects_proportional_companion_floor(self):
        """preflight_and_fit_layer_widths respects the 0.55 * hero floor for companions."""
        layers = [
            {
                "rawText": "THE HERO TITLE",
                "primary_font": "Trajan Pro",
                "isHero": True,
                "fontSizePx": 120,
            },
            {
                "rawText": "companion descriptive line",
                "primary_font": "Apple Garamond",
                "isHero": False,
                "fontSizePx": 66,
            },
        ]

        # Under standard safe width, companion should maintain >= 66px
        preflight_and_fit_layer_widths(layers, max_safe_width=820.0)
        self.assertGreaterEqual(layers[1]["fontSizePx"], 66)


if __name__ == "__main__":
    unittest.main()
