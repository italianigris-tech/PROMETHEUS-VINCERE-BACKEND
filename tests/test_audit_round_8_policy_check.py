import unittest
from mini_run_pipeline import policy_check
from mini_run_pipeline.typography import generate_font_manifest


class TestRound8PolicyCheck(unittest.TestCase):
    """Verifies post-render conformance checker: safe-bounds, line-count/tall-stack, shadow/glow budget."""

    def test_extract_manifest_layers(self):
        manifest = {
            "fontManifest": {
                "chunks": [
                    {
                        "chunkIndex": 0,
                        "rendered_layers": [
                            {"layerName": "l0", "rawText": "Hello", "isHero": True},
                            {"layerName": "l1", "rawText": "World", "isHero": False},
                        ],
                    }
                ]
            }
        }
        layers = policy_check.extract_manifest_layers(manifest)
        self.assertEqual(len(layers), 2)
        self.assertEqual(layers[0]["rawText"], "Hello")
        self.assertEqual(layers[0]["chunkIndex"], 0)
        self.assertTrue(layers[0]["isHero"])

    def test_validate_safe_region_bounds(self):
        valid_layers = [
            {"layerName": "hero", "rawText": "SHORT TEXT", "fontFamily": "Montserrat", "fontSizePx": 80, "isHero": True}
        ]
        res_a = policy_check.validate_safe_region_bounds(valid_layers, max_safe_width=820.0)
        self.assertEqual(res_a["status"], "passed")
        self.assertEqual(len(res_a["violations"]), 0)

        overflowing_layers = [
            {
                "layerName": "overflow_layer",
                "rawText": "A tremendously long uninterrupted line of text that clearly overflows the viewport",
                "fontFamily": "Playfair Display",
                "fontSizePx": 130,
                "isHero": True,
                "fitScale": 1.0,
            }
        ]
        res_b = policy_check.validate_safe_region_bounds(overflowing_layers, max_safe_width=820.0)
        self.assertEqual(res_b["status"], "failed")
        self.assertIn("exceeds safe bound", res_b["violations"][0])

        scaled_layers = [
            {
                "layerName": "overflow_layer_scaled",
                "rawText": "A tremendously long uninterrupted line of text that clearly overflows the viewport",
                "fontFamily": "Playfair Display",
                "fontSizePx": 130,
                "isHero": True,
                "fitScale": 0.10,
            }
        ]
        res_c = policy_check.validate_safe_region_bounds(scaled_layers, max_safe_width=820.0)
        self.assertEqual(res_c["status"], "passed")

    def test_validate_line_count_and_tall_stack_contract(self):
        invalid_tall = [
            {"layerName": "tall_invalid", "rawText": "Over the last year", "fxPreset": "canva_tall_glyph_stack", "behindSubject": False, "role": "companion"}
        ]
        res_a = policy_check.validate_line_count_and_wrap(invalid_tall)
        self.assertEqual(res_a["status"], "failed")
        self.assertEqual(len(res_a["tallStackViolations"]), 1)

        valid_single = [
            {"layerName": "tall_valid_single", "rawText": "YEARS", "fxPreset": "canva_tall_glyph_stack", "behindSubject": False, "role": "hero"}
        ]
        res_b = policy_check.validate_line_count_and_wrap(valid_single)
        self.assertEqual(res_b["status"], "passed")

        valid_behind = [
            {"layerName": "tall_valid_behind", "rawText": "Over the last", "fxPreset": "canva_tall_glyph_stack", "behindSubject": True, "role": "hero"}
        ]
        res_c = policy_check.validate_line_count_and_wrap(valid_behind)
        self.assertEqual(res_c["status"], "passed")

        hyphenated = [
            {"layerName": "hyphen_bug", "rawText": "founde-\nrs", "fxPreset": "apple_keynote_headline_punch"}
        ]
        res_d = policy_check.validate_line_count_and_wrap(hyphenated)
        self.assertEqual(res_d["status"], "failed")
        self.assertEqual(len(res_d["multiLineViolations"]), 1)

    def test_validate_shadow_glow_budget(self):
        valid_layers = [
            {"layerName": "hero", "isHero": True, "ambientShadow": "none", "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)", "glow": "drop-shadow(0 0 12px rgba(255, 255, 255, 0.30))"},
            {"layerName": "comp", "isHero": False, "role": "companion", "ambientShadow": "none", "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)", "glow": "none"},
        ]
        res_a = policy_check.validate_shadow_glow_budget(valid_layers)
        self.assertEqual(res_a["status"], "passed")

        invalid_ambient = [
            {"layerName": "amb", "ambientShadow": "0 12px 30px rgba(0, 0, 0, 0.55)", "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)", "glow": "none"}
        ]
        self.assertEqual(policy_check.validate_shadow_glow_budget(invalid_ambient)["status"], "failed")

        invalid_multi_shadow = [
            {"layerName": "multi", "ambientShadow": "none", "shadow": "0 2px 10px rgba(0, 0, 0, 0.55), 0 12px 30px rgba(0, 0, 0, 0.40)", "glow": "none"}
        ]
        self.assertEqual(policy_check.validate_shadow_glow_budget(invalid_multi_shadow)["status"], "failed")

        invalid_comp_glow = [
            {"layerName": "comp_glow", "isHero": False, "role": "companion", "ambientShadow": "none", "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)", "glow": "0 0 10px rgba(255, 255, 255, 0.20)"}
        ]
        self.assertEqual(policy_check.validate_shadow_glow_budget(invalid_comp_glow)["status"], "failed")

        invalid_hero_glow_alpha = [
            {"layerName": "hero_alpha", "isHero": True, "ambientShadow": "none", "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)", "glow": "0 0 14px rgba(255, 255, 255, 0.60)"}
        ]
        self.assertEqual(policy_check.validate_shadow_glow_budget(invalid_hero_glow_alpha)["status"], "failed")

    def test_run_post_render_conformance_check_on_manifest(self):
        sample_chunks = [
            {"chunkIndex": 0, "text": "Over the last twelve months", "startMs": 0, "endMs": 1400, "words": [{"text": "Over"}, {"text": "the"}, {"text": "last"}, {"text": "twelve"}, {"text": "months"}]},
            {"chunkIndex": 1, "text": "I sold 12,000 physical products", "startMs": 1400, "endMs": 3100, "words": [{"text": "I"}, {"text": "sold"}, {"text": "12,000"}, {"text": "physical"}, {"text": "products"}]},
        ]
        manifest = generate_font_manifest(sample_chunks, design_override={"seed": 42})
        report = policy_check.run_post_render_conformance_check(
            video_path=None,
            manifest_or_props=manifest,
            extract_frames=False,
        )
        self.assertEqual(report["status"], "passed")
        self.assertEqual(report["failedChecks"], 0)
        self.assertEqual(len(report["violations"]), 0)
        self.assertIn("safeRegionBounds", report["checks"])
        self.assertIn("lineCount", report["checks"])
        self.assertIn("shadowBudget", report["checks"])
        self.assertGreater(report["totalLayersChecked"], 0)


if __name__ == "__main__":
    unittest.main()
