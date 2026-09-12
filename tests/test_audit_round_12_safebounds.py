import unittest
from mini_run_pipeline.typography import (
    get_font_char_aspect,
    estimate_layer_width_px,
    preflight_and_fit_layer_widths,
)
from mini_run_pipeline.policy_check import validate_safe_region_bounds


class TestRound12SafeBounds(unittest.TestCase):
    """Test suite for Round 12 Fix 4: Display Serif Safe Region Bounds Calibration."""

    def test_custom_display_serif_aspect_calibration(self):
        """Paris Forbel and Foglihten aspect ratios must reflect wide swash letterforms (>= 0.70)."""
        aspect_paris = get_font_char_aspect("Paris Forbel", is_uppercase=False)
        self.assertGreaterEqual(aspect_paris, 0.70)
        self.assertEqual(aspect_paris, 0.74)

        aspect_foglihten = get_font_char_aspect("FoglihtenNo07", is_uppercase=False)
        self.assertGreaterEqual(aspect_foglihten, 0.70)
        self.assertEqual(aspect_foglihten, 0.75)

        aspect_playfair = get_font_char_aspect("Playfair Display", is_uppercase=False)
        self.assertGreaterEqual(aspect_playfair, 0.65)
        self.assertEqual(aspect_playfair, 0.68)

    def test_preflight_shrinks_wide_display_serifs_to_fit_820px(self):
        """A 14-character Paris Forbel phrase at 100px originally ~1036px must shrink to fit <= 820px."""
        layers = [
            {
                "chunkIndex": 1,
                "layerIndex": 0,
                "rawText": "PARISIAN LUXURY",
                "fontFamily": "Paris Forbel",
                "fontSizePx": 100.0,
                "isHero": True,
            }
        ]
        preflight_and_fit_layer_widths(layers, max_safe_width=820.0)

        fit_w = layers[0]["est_width"]
        auto_scale = layers[0].get("autoFitScale", 1.0)
        effective_w = fit_w * auto_scale
        self.assertLessEqual(effective_w, 820.0, f"Effective width {effective_w:.1f}px must not exceed safe bound 820px")
        self.assertLess(layers[0]["font_size_px"], 100.0, "Font size must be shrunk to fit safe bounds")

        # Conformance check must pass
        check = validate_safe_region_bounds(layers, max_safe_width=820.0)
        self.assertEqual(check["status"], "passed", f"Violations: {check.get('violations')}")

    def test_conformance_check_clean_envelope_all_fonts(self):
        """Multiple wide fonts fit cleanly within 820px envelope after preflight."""
        layers = [
            {"chunkIndex": 1, "rawText": "12,000 PHYSICAL PRODUCTS", "fontFamily": "Foglihten", "fontSizePx": 88.0},
            {"chunkIndex": 2, "rawText": "OVER THE LAST 12 MONTHS", "fontFamily": "Paris Forbel", "fontSizePx": 84.0},
            {"chunkIndex": 3, "rawText": "ARCHITECTURAL DESIGN", "fontFamily": "Bodoni Moda", "fontSizePx": 80.0},
        ]
        preflight_and_fit_layer_widths(layers, max_safe_width=820.0)
        check = validate_safe_region_bounds(layers, max_safe_width=820.0)
        self.assertEqual(check["status"], "passed")
        self.assertEqual(len(check["violations"]), 0)


if __name__ == "__main__":
    unittest.main()
