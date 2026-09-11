import unittest
from mini_run_pipeline.typography import (
    resolve_safe_font_candidate,
    UNSAFE_DISTORTED_FONTS,
    FONT_FAMILY_REGISTRY,
    is_serif_font,
)


class TestRound7TrialFontBan(unittest.TestCase):
    """Verifies that all trial, demo, and watermark fonts are globally banned and safely remapped."""

    def test_erotique_remapped_to_playfair_display(self):
        """Erotique Alternate Trial and variants must resolve to Playfair Display."""
        self.assertEqual(resolve_safe_font_candidate("Erotique Alternate Trial"), "Playfair Display")
        self.assertEqual(resolve_safe_font_candidate("erotique alternate trial"), "Playfair Display")
        self.assertEqual(resolve_safe_font_candidate("Erotique"), "Playfair Display")
        self.assertEqual(resolve_safe_font_candidate("erotique"), "Playfair Display")

    def test_trial_keywords_remapped(self):
        """Any font candidate with 'trial', 'demo', or 'watermark' must remap safely."""
        # Sans / generic trial fonts -> Montserrat
        self.assertEqual(resolve_safe_font_candidate("Altone Trial"), "Montserrat")
        self.assertEqual(resolve_safe_font_candidate("altone trial regular"), "Montserrat")
        self.assertEqual(resolve_safe_font_candidate("altone trial bold"), "Montserrat")
        self.assertEqual(resolve_safe_font_candidate("Aulion Demo"), "Montserrat")
        self.assertEqual(resolve_safe_font_candidate("Cool Sans Demo"), "Montserrat")
        self.assertEqual(resolve_safe_font_candidate("Brand Watermark"), "Montserrat")

        # Serif / Didone trial fonts -> Playfair Display
        self.assertEqual(resolve_safe_font_candidate("Bodoni Demo Version"), "Playfair Display")
        self.assertEqual(resolve_safe_font_candidate("Luxury Serif Trial"), "Playfair Display")
        self.assertEqual(resolve_safe_font_candidate("Didone Watermark Font"), "Playfair Display")

    def test_registries_contain_erotique_ban(self):
        """UNSAFE_DISTORTED_FONTS and FONT_FAMILY_REGISTRY must not emit Erotique Alternate Trial."""
        self.assertEqual(UNSAFE_DISTORTED_FONTS.get("erotique alternate trial"), "Playfair Display")
        self.assertEqual(UNSAFE_DISTORTED_FONTS.get("erotique"), "Playfair Display")
        self.assertEqual(FONT_FAMILY_REGISTRY.get("erotique alternate trial"), "Playfair Display")
        self.assertEqual(FONT_FAMILY_REGISTRY.get("erotique"), "Playfair Display")

    def test_clean_fonts_unaffected(self):
        """Standard, non-trial fonts resolve normally to their registered families."""
        self.assertEqual(resolve_safe_font_candidate("Playfair Display"), "Playfair Display")
        self.assertEqual(resolve_safe_font_candidate("Montserrat"), "Montserrat")
        self.assertEqual(resolve_safe_font_candidate("Anton"), "Anton")
        self.assertEqual(resolve_safe_font_candidate("Bebas Neue"), "Bebas Neue")
        self.assertEqual(resolve_safe_font_candidate("Space Mono"), "Space Mono")


if __name__ == "__main__":
    unittest.main()
