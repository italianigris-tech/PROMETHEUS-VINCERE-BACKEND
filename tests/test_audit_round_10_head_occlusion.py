import unittest
from mini_run_pipeline import policy_check
from mini_run_pipeline.typography import generate_font_manifest
from mini_run_pipeline.subject_placement import analyze_cranial_negative_space, plan_subject_safe_placements


class TestRound10HeadOcclusion(unittest.TestCase):
    """Verifies Round 10 Fix 2:
    1. headOcclusion check in policyReport computes matte-alpha / cranial ∩ pivot-bbox ratio.
    2. Fails when head occlusion > 40%.
    3. Preflight placement shifts pivots into upper cranial space (<=15% Y) to stay <= 40%.
    4. Conformance report includes 'headOcclusion' in checks.
    """

    def test_head_occlusion_fails_above_40_percent(self):
        """A layer placed deeply behind the skull (>40% overlap) must fail."""
        # Chunk with text centered directly in the skull (Y = 30%)
        bad_layers = [
            {
                "layerName": "occluded_pivot",
                "rawText": "PRODUCTS",
                "fontFamily": "Anton",
                "fontSizePx": 150,
                "behindSubject": True,
                "chunkIndex": 0,
            }
        ]
        bad_chunks = [
            {
                "chunkIndex": 0,
                "placement": {
                    "xPercent": "50%",
                    "yPercent": "30.0%",  # deeply centered behind face/skull
                    "headTopY": 0.18,
                    "faceBottom": 0.45,
                },
            }
        ]
        res = policy_check.validate_head_occlusion(bad_layers, chunks=bad_chunks, max_occlusion_threshold=0.40)
        self.assertEqual(res["status"], "failed")
        self.assertGreater(res["maxOcclusionFound"], 0.40)
        self.assertGreater(len(res["violations"]), 0)
        self.assertIn("exceeds maximum threshold 40%", res["violations"][0])

    def test_head_occlusion_passes_in_upper_cranial_space(self):
        """A layer placed in natural cranial space (Y = 22.0%) must pass (occlusion <= 40%)."""
        good_layers = [
            {
                "layerName": "safe_pivot",
                "rawText": "PRODUCTS",
                "fontFamily": "Anton",
                "fontSizePx": 150,
                "behindSubject": True,
                "chunkIndex": 0,
            }
        ]
        good_chunks = [
            {
                "chunkIndex": 0,
                "placement": {
                    "xPercent": "50%",
                    "yPercent": "22.0%",  # natural cranial crown
                    "headTopY": 0.22,
                    "faceBottom": 0.45,
                },
            }
        ]
        res = policy_check.validate_head_occlusion(good_layers, chunks=good_chunks, max_occlusion_threshold=0.40)
        self.assertEqual(res["status"], "passed")
        self.assertLessEqual(res["maxOcclusionFound"], 0.40)
        self.assertEqual(len(res["violations"]), 0)

    def test_default_cranial_placement_shifts_to_upper_space(self):
        """When subject_box is None, default cranial crown must be nestled in natural middle band (18%-28%), not ceiling (<15%)."""
        analysis = analyze_cranial_negative_space(subject_box=None, head_top_y=None)
        y_pct_str = analysis.get("yPercent", "100%")
        y_pct = float(y_pct_str.replace("%", ""))
        self.assertTrue(18.0 <= y_pct <= 28.0, f"Default cranial yPercent {y_pct}% outside [18%, 28%] natural middle band!")

    def test_conformance_report_includes_head_occlusion_check(self):
        """run_post_render_conformance_check must report headOcclusion in checks."""
        chunks_input = [
            {
                "chunkIndex": 0,
                "text": "Over the last 12 months",
                "startMs": 0,
                "endMs": 2000,
                "words": [{"text": "Over"}, {"text": "the"}, {"text": "last"}, {"text": "12"}, {"text": "months"}],
            },
            {
                "chunkIndex": 1,
                "text": "12,000 physical products",
                "startMs": 2000,
                "endMs": 4000,
                "words": [{"text": "12,000"}, {"text": "physical"}, {"text": "products"}],
            },
        ]
        manifest = generate_font_manifest(chunks_input, design_override={"seed": 42, "subjectLayering": "auto"})
        report = policy_check.run_post_render_conformance_check(
            video_path=None,
            manifest_or_props=manifest,
            extract_frames=False,
        )
        self.assertIn("headOcclusion", report["checks"])
        self.assertEqual(report["checks"]["headOcclusion"]["status"], "passed")
        self.assertEqual(report["status"], "passed")


if __name__ == "__main__":
    unittest.main()
