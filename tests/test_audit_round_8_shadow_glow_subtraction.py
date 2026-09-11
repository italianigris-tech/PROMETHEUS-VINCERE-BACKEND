import re
import unittest
from mini_run_pipeline.typography import (
    clamp_glow_alpha,
    resolve_layer_gradient_and_glow,
    generate_font_manifest,
    BRAND_PALETTES,
)


class TestRound8ShadowGlowSubtraction(unittest.TestCase):
    """Verifies manifest-level single contact shadow and hero-only glow subtraction."""

    def test_clamp_glow_alpha(self):
        """clamp_glow_alpha must constrain glow opacity to <= 0.35."""
        self.assertEqual(clamp_glow_alpha("none"), "none")
        self.assertEqual(clamp_glow_alpha(""), "none")

        # RGBA with high alpha clamped to 0.35
        clamped_rgba = clamp_glow_alpha("0 0 16px rgba(255, 69, 58, 0.85)")
        self.assertIn("rgba(255, 69, 58, 0.35)", clamped_rgba)

        # RGBA with low alpha preserved
        preserved_rgba = clamp_glow_alpha("0 0 14px rgba(255, 255, 255, 0.20)")
        self.assertIn("rgba(255, 255, 255, 0.20)", preserved_rgba)

        # 8-digit hex #RRGGBBAA clamped to <= 0.35
        clamped_hex = clamp_glow_alpha("0 0 16px #FF453A88")
        self.assertIn("0.35", clamped_hex)

    def test_resolve_layer_gradient_and_glow_contact_shadow_only(self):
        """resolve_layer_gradient_and_glow must emit single contact shadow and no ambient shadow."""
        palette = BRAND_PALETTES["champagne_gold"]
        # Hero layer
        hero_res = resolve_layer_gradient_and_glow("test_prof", "hero", "#FFFFFF", True, palette)
        self.assertEqual(hero_res["ambientShadow"], "none")
        self.assertEqual(hero_res["contactShadow"], "0 2px 10px rgba(0, 0, 0, 0.55)")
        self.assertNotIn("0 12px 30px", hero_res["shadow"])
        self.assertNotIn("0 3px 6px", hero_res["shadow"])

        # Companion layer: glow must be strictly "none"
        comp_res = resolve_layer_gradient_and_glow("test_prof", "companion", "#FFFFFF", False, palette)
        self.assertEqual(comp_res["glow"], "none")
        self.assertEqual(comp_res["opticalBleed"], "none")
        self.assertEqual(comp_res["ambientShadow"], "none")
        self.assertEqual(comp_res["contactShadow"], "0 2px 10px rgba(0, 0, 0, 0.55)")

    def test_manifest_across_30_seeds_companion_glow_strictly_none(self):
        """Across 30 seeds, all companion layers must have glow == 'none' and no triple-shadow stack."""
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
                    is_hero = layer.get("isHero", False)
                    glow = layer.get("glow", "none")
                    shadow = layer.get("shadow", "")

                    if not is_hero:
                        self.assertEqual(
                            glow,
                            "none",
                            f"Seed {seed}, Chunk {c.get('chunkIndex')}, Layer '{layer.get('rawText')}' companion has non-none glow: '{glow}'!",
                        )
                    else:
                        # Hero glow opacity must be <= 0.35 if rgba
                        rgba_matches = re.findall(r"rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d\.]+)\s*\)", glow)
                        for alpha_str in rgba_matches:
                            alpha = float(alpha_str)
                            self.assertLessEqual(
                                alpha,
                                0.36,  # allow tiny float rounding e.g. 0.35
                                f"Seed {seed}, Chunk {c.get('chunkIndex')}, Hero glow alpha {alpha} exceeds 0.35: '{glow}'",
                            )

                    # Shadow must not contain the old triple-shadow ambient stack (0 12px 30px)
                    self.assertNotIn(
                        "0 12px 30px",
                        shadow,
                        f"Seed {seed}, Chunk {c.get('chunkIndex')}, Layer '{layer.get('rawText')}' shadow contains old ambient stack: '{shadow}'",
                    )


if __name__ == "__main__":
    unittest.main()
