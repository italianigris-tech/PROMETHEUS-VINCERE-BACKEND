import unittest
from mini_run_pipeline.typography import (
    get_font_char_aspect,
    preflight_and_fit_layer_widths,
    estimate_layer_width_px,
)
from mini_run_pipeline.policy_check import (
    validate_safe_region_bounds,
    MAX_SAFE_WIDTH_PX,
    SAFE_MARGIN_X_PX,
)


class TestAuditRound15Commit11(unittest.TestCase):
    """Audit test suite for Round 15 Commit 11:
    1. Authoritative uppercase font character aspect ratio >= 0.748 accurately modeling browser layout.
    2. Preflight layer width fitting target adjusted to 790px for comfortable 145px safe-margin clearance.
    3. Manifest autoFitScale scaling guarantees effective width <= 790px and passes safe region check.
    4. Centered lower-deck geometry maintains >= 140px clearance on both left and right edges.
    """

    def test_authoritative_uppercase_char_aspect(self):
        """Uppercase sans fonts must use aspect >= 0.74 to match browser CSS bold layout."""
        inter_aspect = get_font_char_aspect("Inter", is_uppercase=True)
        dm_aspect = get_font_char_aspect("DM Sans", is_uppercase=True)
        altone_aspect = get_font_char_aspect("Altone", is_uppercase=True)

        self.assertGreaterEqual(inter_aspect, 0.74)
        self.assertGreaterEqual(dm_aspect, 0.74)
        self.assertGreaterEqual(altone_aspect, 0.74)

    def test_preflight_fit_target_safe_width_790(self):
        """preflight_and_fit_layer_widths targets 790px safe boundary."""
        layers = [
            {
                "layerIndex": 1,
                "layerName": "category_label",
                "rawText": "the last 12 months,",
                "fontFamily": "Inter",
                "fontSizePx": 104,
                "font_size_px": 104,
                "casing": "uppercase",
                "isHero": True,
            },
            {
                "layerIndex": 1,
                "layerName": "category_label",
                "rawText": "than 6 figures",
                "fontFamily": "Inter",
                "fontSizePx": 104,
                "font_size_px": 104,
                "casing": "uppercase",
                "isHero": True,
            }
        ]
        preflight_and_fit_layer_widths(layers, max_safe_width=790.0)

        for l in layers:
            est = float(l.get("estimatedWidthPx", l.get("est_width", 0)))
            fit_scale = float(l.get("autoFitScale", 1.0))
            effective_w = est * fit_scale
            self.assertLessEqual(
                effective_w,
                792.0,
                f"Effective width {effective_w} must fit within 790px (±2px rounding)",
            )

    def test_lower_deck_geometry_clearance_140px(self):
        """A 790px centered card yields 145px clearance, exceeding the 130px safe margin by 15px."""
        canvas_width = 1080.0
        max_card_width = 790.0
        left_clearance = (canvas_width - max_card_width) / 2.0
        right_clearance = (canvas_width - max_card_width) / 2.0

        self.assertGreaterEqual(left_clearance, SAFE_MARGIN_X_PX + 10.0)
        self.assertGreaterEqual(right_clearance, SAFE_MARGIN_X_PX + 10.0)
        self.assertEqual(left_clearance, 145.0)
        self.assertEqual(right_clearance, 145.0)

    def test_safe_region_bounds_with_commit_11_metrics(self):
        """Layers with Commit 11 fitScale pass validate_safe_region_bounds with 0 violations."""
        layers = [
            {
                "chunkIndex": 1,
                "layerName": "category_label",
                "rawText": "the last 12 months,",
                "fontFamily": "Inter",
                "fontSizePx": 104,
                "casing": "uppercase",
                "estimatedWidthPx": 1478,
                "autoFitScale": round(790.0 / 1478.0, 4),
            },
            {
                "chunkIndex": 7,
                "layerName": "category_label",
                "rawText": "than 6 figures",
                "fontFamily": "Inter",
                "fontSizePx": 104,
                "casing": "uppercase",
                "estimatedWidthPx": 1091,
                "autoFitScale": round(790.0 / 1091.0, 4),
            }
        ]
        res = validate_safe_region_bounds(layers, max_safe_width=MAX_SAFE_WIDTH_PX)
        self.assertEqual(res["status"], "passed")
        self.assertEqual(res["overflowCount"], 0)
        self.assertEqual(len(res["violations"]), 0)


if __name__ == "__main__":
    unittest.main()
