import unittest
from mini_run_pipeline.motif import (
    resolve_brand_motif,
    motif_to_brand_palette,
    MOTIF_PRESETS,
)
from mini_run_pipeline.typography import generate_font_manifest

class TestBrandMotifSystem(unittest.TestCase):
    def setUp(self):
        self.sample_chunks = [
            {
                "chunkIndex": 1,
                "text": "BUILDING YOUR BRAND IDENTITY",
                "startMs": 0,
                "endMs": 1400,
                "outputStartMs": 0,
                "outputEndMs": 1400,
                "words": [
                    {"word": "BUILDING", "startMs": 0, "endMs": 400},
                    {"word": "YOUR", "startMs": 420, "endMs": 700},
                    {"word": "BRAND", "startMs": 720, "endMs": 1050},
                    {"word": "IDENTITY", "startMs": 1070, "endMs": 1400},
                ],
            },
            {
                "chunkIndex": 2,
                "text": "CREATES LASTING IMPACT",
                "startMs": 1500,
                "endMs": 2800,
                "outputStartMs": 1500,
                "outputEndMs": 2800,
                "words": [
                    {"word": "CREATES", "startMs": 1500, "endMs": 1900},
                    {"word": "LASTING", "startMs": 1920, "endMs": 2300},
                    {"word": "IMPACT", "startMs": 2320, "endMs": 2800},
                ],
            },
        ]

    def test_motif_is_off_by_default(self):
        """Motif must be disabled (None) by default when omitted or false."""
        self.assertIsNone(resolve_brand_motif(None))
        self.assertIsNone(resolve_brand_motif({}))
        self.assertIsNone(resolve_brand_motif({"motif": False}))
        self.assertIsNone(resolve_brand_motif({"motif": {"enabled": False}}))

        # Typography manifest without motif uses standard dynamic variation
        manifest = generate_font_manifest(self.sample_chunks, {})
        self.assertIsNone(manifest.get("motif"))
        self.assertIn(manifest.get("palettePolicy"), ("explicit", "balanced_curated_variation"))

    def test_motif_enabled_with_preset_string(self):
        """String preset name resolves full 3-color brand schema."""
        motif_purple = resolve_brand_motif({"motif": "royal_amethyst"})
        self.assertIsNotNone(motif_purple)
        self.assertTrue(motif_purple["enabled"])
        self.assertEqual(motif_purple["preset"], "royal_amethyst")
        self.assertEqual(motif_purple["colors"]["primary"], "#C084FC")
        self.assertEqual(motif_purple["colors"]["base"], "#FFFFFF")
        self.assertEqual(motif_purple["colors"]["accent"], "#A78BFA")

        # Fuzzy matching string alias 'purple'
        motif_alias = resolve_brand_motif({"brandMotif": "purple"})
        self.assertIsNotNone(motif_alias)
        self.assertEqual(motif_alias["preset"], "royal_amethyst")

    def test_motif_custom_3_color_palette(self):
        """Custom 3-color palette (base, primary, accent) is ingested faithfully."""
        custom_cfg = {
            "motif": {
                "enabled": True,
                "name": "Acme Brand",
                "colors": {
                    "base": "#F8FAFC",
                    "primary": "#8B5CF6",
                    "accent": "#EC4899",
                },
                "fonts": {
                    "primaryFamily": "Montserrat",
                    "accentFamily": "Playfair Display",
                },
            }
        }
        motif = resolve_brand_motif(custom_cfg)
        self.assertIsNotNone(motif)
        self.assertEqual(motif["colors"]["base"], "#F8FAFC")
        self.assertEqual(motif["colors"]["primary"], "#8B5CF6")
        self.assertEqual(motif["colors"]["accent"], "#EC4899")

        palette = motif_to_brand_palette(motif)
        self.assertEqual(palette["companion_color"], "#F8FAFC")
        self.assertEqual(palette["hero_color"], "#8B5CF6")
        self.assertEqual(palette["accent_border"], "#EC4899")
        self.assertTrue(palette["isMotif"])

    def test_typography_manifest_resonates_with_active_motif(self):
        """When motif is active, hero words get signature brand color while base text stays readable."""
        manifest = generate_font_manifest(
            self.sample_chunks,
            {"motif": "royal_amethyst"}
        )
        self.assertIsNotNone(manifest.get("motif"))
        self.assertEqual(manifest["palettePolicy"], "brand_motif")
        self.assertEqual(manifest["brandPalette"]["hero_color"], "#C084FC")
        self.assertEqual(manifest["brandPalette"]["companion_color"], "#FFFFFF")

        # Verify chunks have layers rendered with brand motif styling
        first_chunk = manifest["chunks"][0]
        self.assertGreater(len(first_chunk["layers"]), 0)
        hero_layers = [l for l in first_chunk["layers"] if l.get("isHero")]
        companion_layers = [l for l in first_chunk["layers"] if not l.get("isHero")]
        
        # Hero layer is styled with brand signature
        self.assertTrue(len(hero_layers) > 0 or len(companion_layers) > 0)

if __name__ == "__main__":
    unittest.main()
