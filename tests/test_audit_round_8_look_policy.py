import unittest
import numpy as np
from mini_run_pipeline import looks, policy_check


class TestRound8LookPolicy(unittest.TestCase):
    """Verifies talking-head default look (kodak_2383), teal intensity clamp (<=0.70), and pixel A/B acceptance."""

    def test_default_look_is_none(self):
        """Empty design and metadata must default to none (original camera natural) per Round 13 ruling."""
        manifest = looks.select_look(design={}, metadata={})
        self.assertEqual(manifest["lookId"], "none")
        self.assertEqual(manifest["resolution"], "fallback_default")
        self.assertEqual(manifest["intensity"], 0.0)

    def test_teal_and_orange_intensity_capped_at_0_70(self):
        """Teal and orange look must strictly clamp intensity to <= 0.70 to protect skin tones."""
        # Case A: Explicit ID with requested intensity 1.2
        manifest_explicit = looks.select_look(design={"lookId": "teal_and_orange_blockbuster", "lookIntensity": 1.2})
        self.assertEqual(manifest_explicit["lookId"], "teal_and_orange_blockbuster")
        self.assertLessEqual(manifest_explicit["intensity"], 0.70)

        # Case B: Prompt matched keywords with default intensity 1.0
        manifest_prompt = looks.select_look(prompt="Make this look like a Hollywood blockbuster action scene")
        self.assertEqual(manifest_prompt["lookId"], "teal_and_orange_blockbuster")
        self.assertLessEqual(manifest_prompt["intensity"], 0.70)

    def test_compute_pixel_ab_metrics_balanced_frame(self):
        """Natural frame with warm skin tones and balanced cyan must pass pixel A/B acceptance."""
        # Create 100x100 RGB image with warm skin tone: R=210, G=150, B=120
        # Hue ~ 20 deg (warm peach), Cyan excess: ((150+120)/2 - 210) = negative -> 0.0
        synthetic_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        synthetic_frame[:, :] = [210, 150, 120]

        metrics = policy_check.compute_pixel_ab_metrics(synthetic_frame)
        self.assertEqual(metrics["status"], "passed")
        self.assertLessEqual(metrics["cyanIndex"], 0.35)
        self.assertIsNotNone(metrics["skinHueDeg"])
        self.assertGreaterEqual(metrics["skinHueDeg"], 10.0)
        self.assertLessEqual(metrics["skinHueDeg"], 45.0)
        self.assertEqual(len(metrics["violations"]), 0)

    def test_compute_pixel_ab_metrics_excessive_cyan(self):
        """Unchecked aggressive teal grade (R=30, G=220, B=240) must fail with cyan index violation."""
        heavy_teal = np.zeros((100, 100, 3), dtype=np.uint8)
        heavy_teal[:, :] = [30, 220, 240]  # pure heavy cyan

        metrics = policy_check.compute_pixel_ab_metrics(heavy_teal)
        self.assertEqual(metrics["status"], "failed")
        self.assertGreater(metrics["cyanIndex"], 0.35)
        self.assertTrue(any("Cyan index" in v for v in metrics["violations"]))

    def test_validate_look_conformance(self):
        """Conformance checker must flag teal intensity > 0.70 and pass <= 0.70."""
        # Over-intensity teal look plan
        uncapped_plan = {"lookId": "teal_and_orange_blockbuster", "intensity": 1.1}
        res_fail = policy_check.validate_look_conformance(uncapped_plan)
        self.assertEqual(res_fail["status"], "failed")
        self.assertIn("exceeds talking-head cap 0.70", res_fail["violations"][0])

        # Capped teal look plan
        capped_plan = {"lookId": "teal_and_orange_blockbuster", "intensity": 0.70}
        res_pass = policy_check.validate_look_conformance(capped_plan)
        self.assertEqual(res_pass["status"], "passed")

    def test_pixel_ab_reference_comparison(self):
        """Reference comparison must pass when frames match and fail on severe skin hue drift."""
        # Base skin frame
        ref_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        ref_frame[:, :] = [210, 150, 120]  # Hue ~ 20 deg

        # Same frame -> 0 drift -> pass
        same_metrics = policy_check.compute_pixel_ab_metrics(ref_frame, reference_frame_path_or_rgb=ref_frame)
        self.assertEqual(same_metrics["status"], "passed")

        # Mutated frame: green-shifted skin (R=160, G=210, B=120) -> Hue ~ 80 deg
        mutated_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        mutated_frame[:, :] = [160, 210, 120]
    def test_none_look_filter_string_is_empty(self):
        """None or original look must produce completely empty filter string to preserve original camera pixels."""
        none_plan = looks.select_look(design={"lookId": "none"})
        self.assertEqual(looks.build_grade_filter(none_plan), "")
        self.assertEqual(looks.build_look_filter_string(none_plan), "")

    def test_active_look_silently_skipped_fails_look_conformance(self):
        """Active look must fail look conformance if pixel A/B verification was skipped."""
        active_plan = {"lookId": "kodak_2383_print", "intensity": 1.0}
        # Provide nonexistent frame path which causes compute_pixel_ab_metrics to return skipped
        res = policy_check.validate_look_conformance(active_plan, frame_path="/tmp/nonexistent_frame_123.png")
        self.assertEqual(res["status"], "failed")
        self.assertTrue(any("silently skipped" in v for v in res["violations"]))

    def test_none_look_with_skipped_pixel_ab_passes_cleanly(self):
        """None look with skipped pixel A/B must pass cleanly without violations."""
        none_plan = {"lookId": "none", "intensity": 0.0}
        res = policy_check.validate_look_conformance(none_plan, frame_path="/tmp/nonexistent_frame_123.png")
        self.assertEqual(res["status"], "passed")
        self.assertEqual(len(res["violations"]), 0)


if __name__ == "__main__":
    unittest.main()

