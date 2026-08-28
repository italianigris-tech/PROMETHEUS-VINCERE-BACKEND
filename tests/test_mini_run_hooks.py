"""Tests for the expanded Mini-Run Hook Lingua library."""

import unittest
from mini_run_pipeline import hooks, typography


class MiniRunHookLinguaTests(unittest.TestCase):
    def test_hook_treatments_count_and_naming(self):
        """Ensure all 21 hook treatments are registered and conform to prefix convention."""
        treatments = hooks.hook_treatment_ids()
        self.assertGreaterEqual(len(treatments), 20)
        for treatment_id in treatments:
            self.assertTrue(treatment_id.startswith("hook_"), f"Invalid prefix for {treatment_id}")

    def test_ease_curves_format(self):
        """All easing curves must be 4-tuple cubic-bezier control points."""
        for name, curve in hooks.HOOK_EASE_CURVES.items():
            self.assertEqual(len(curve), 4, f"Curve {name} must have 4 points")
            self.assertTrue(all(isinstance(v, (int, float)) for v in curve))

    def test_plan_hook_treatment_chunk_zero_only(self):
        """Hooks only activate on chunk index 0."""
        self.assertIsNone(hooks.plan_hook_treatment(1, "Second chunk text"))
        self.assertIsNone(hooks.plan_hook_treatment(5, "Later chunk text"))
        plan = hooks.plan_hook_treatment(0, "First chunk text")
        self.assertIsNotNone(plan)
        self.assertTrue(plan["hookEnabled"])

    def test_plan_hook_treatment_disabled(self):
        """Hooks can be explicitly disabled via design options."""
        plan = hooks.plan_hook_treatment(0, "First chunk text", design={"hooks": "disabled"})
        self.assertIsNone(plan)

    def test_plan_hook_modular_layers_present(self):
        """The HookPlan must contain the 5 modular layers + backward compatibility fields."""
        plan = hooks.plan_hook_treatment(
            chunk_index=0,
            chunk_text="This is an epic opening hook",
            design={"visualIntensity": 0.9},
            brand_palette={"zone": {"glow_rgb": "0, 255, 200"}},
        )
        self.assertIsNotNone(plan)

        # 5 Modular layers
        self.assertIn("camera", plan)
        self.assertIn("optical", plan)
        self.assertIn("artifact", plan)
        self.assertIn("typography", plan)
        self.assertIn("audioCue", plan)

        # Backward compatibility layers
        self.assertIn("zoom", plan)
        self.assertIn("lensBlur", plan)
        self.assertIn("directionalBlur", plan)
        self.assertIn("motionBlur", plan)
        self.assertEqual(plan["brandGlow"], "0, 255, 200")

    def test_semantic_hook_selection_keywords(self):
        """Verify automatic keyword routing to appropriate cinematic hook families."""
        # Family E: Chrome/Money
        plan_money = hooks.plan_hook_treatment(0, "Make millions in profit scale wealth")
        self.assertEqual(plan_money["hookType"], "hook_metallic_chrome_reflection")

        # Family D: Glitch/Tech
        plan_glitch = hooks.plan_hook_treatment(0, "The AI code software glitch error")
        self.assertEqual(plan_glitch["hookType"], "hook_rgb_chromatic_split_glitch")

        # Family B: Flash/Alert
        plan_flash = hooks.plan_hook_treatment(0, "Stop right now warning alert")
        self.assertEqual(plan_flash["hookType"], "hook_sharp_white_flash_cut")

        # Family A: Bokeh Bloom/Dream
        plan_bokeh = hooks.plan_hook_treatment(0, "Imagine a beautiful dream in life")
        self.assertEqual(plan_bokeh["hookType"], "hook_bokeh_defocus_bloom")

        # Family C: Crash Zoom
        plan_crash = hooks.plan_hook_treatment(0, "Look at this fast run here")
        self.assertEqual(plan_crash["hookType"], "hook_crash_zoom_snap")

    def test_explicit_hook_override(self):
        """Explicit design hookPreset overrides keyword heuristics."""
        plan = hooks.plan_hook_treatment(
            0,
            "Make millions in profit",
            design={"hookPreset": "hook_vintage_film_burn_strobe"},
        )
        self.assertEqual(plan["hookType"], "hook_vintage_film_burn_strobe")

    def test_typography_runtime_treatments_sync(self):
        """All hook treatments must be present in typography.ANIMA_RUNTIME_TREATMENTS."""
        registered_ids = {t["id"] for t in typography.ANIMA_RUNTIME_TREATMENTS}
        for hook_id in hooks.HOOK_TREATMENTS:
            self.assertIn(hook_id, registered_ids, f"Missing {hook_id} in ANIMA_RUNTIME_TREATMENTS")


if __name__ == "__main__":
    unittest.main()
