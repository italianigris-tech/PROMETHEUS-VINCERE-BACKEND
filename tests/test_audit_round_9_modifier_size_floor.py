import unittest
from mini_run_pipeline.typography import generate_font_manifest


class TestRound9ModifierSizeFloor(unittest.TestCase):
    """Verifies that lockup modifier layers obey font_size_px >= max(44, 0.3 * heroSize)."""

    def test_lockup_modifier_size_floor_across_30_seeds(self):
        """Lockup modifier layers (e.g. 'from eBay.com') must never be sized at 34px, strictly >= max(44, 0.3 * heroSize)."""
        chunks_input = [
            {
                "chunkIndex": 0,
                "text": "from eBay.com",
                "startMs": 0,
                "endMs": 1500,
                "words": [{"text": "from"}, {"text": "eBay.com"}],
            },
            {
                "chunkIndex": 1,
                "text": "12,000 physical products",
                "startMs": 1500,
                "endMs": 3200,
                "words": [{"text": "12,000"}, {"text": "physical"}, {"text": "products"}],
            },
        ]

        design_override = {
            "typographySystem": "hakt",
            "treatment": "hierarchical_asymmetric_lockup",
        }

        for seed in range(30):
            design = dict(design_override, seed=seed)
            manifest = generate_font_manifest(chunks_input, design_override=design)
            chunks = manifest.get("chunks", [])
            for c in chunks:
                layers = c.get("rendered_layers") or c.get("layers") or []
                if len(layers) >= 2:
                    hero_layer = next((l for l in layers if l.get("isHero")), layers[0])
                    modifier_layers = [l for l in layers if not l.get("isHero")]
                    hero_size = float(hero_layer.get("fontSizePx", 120))
                    expected_floor = max(44.0, 0.3 * hero_size)

                    for mod in modifier_layers:
                        mod_size = float(mod.get("fontSizePx", 0))
                        self.assertGreaterEqual(
                            mod_size,
                            expected_floor - 0.5,
                            f"Seed {seed}, Chunk {c.get('chunkIndex')} modifier '{mod.get('rawText')}' size {mod_size}px is below floor {expected_floor}px",
                        )
                        self.assertNotEqual(
                            mod_size,
                            34.0,
                            f"Seed {seed}, Chunk {c.get('chunkIndex')} modifier '{mod.get('rawText')}' is still stuck at old hardcoded 34px!",
                        )


if __name__ == "__main__":
    unittest.main()
