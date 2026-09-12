import unittest
from mini_run_pipeline.policy_check import validate_cranial_halo_guard, run_post_render_conformance_check
from mini_run_pipeline.subject_placement import analyze_cranial_negative_space, plan_subject_safe_placements


class TestRound13HaloGuard(unittest.TestCase):
    """Verifies Round 13 Addendum 3:
    1. validate_cranial_halo_guard flags behind-subject text intersecting the alpha feather ring without halo protection.
    2. Passes when haloGuard or depthRim protection is active.
    3. Passes when text clears the halo ring via lateral flank or headroom clearance.
    4. run_post_render_conformance_check includes cranialHaloGuard as a first-class check.
    5. Headroom solver sets haloGuard=True and tightens maxWidthPercent for cranial placements.
    """

    def test_halo_guard_fails_when_pivot_straddles_feather_ring_without_guard(self):
        """Behind-subject pivot straddling headTopY alpha feather ring without haloGuard fails."""
        bad_layers = [
            {
                "chunkIndex": 0,
                "layerName": "unprotected_pivot",
                "rawText": "UNPROTECTED",
                "fontFamily": "Anton",
                "fontSizePx": 150,
                "behindSubject": True,
            }
        ]
        bad_chunks = [
            {
                "chunkIndex": 0,
                "placement": {
                    "xPercent": "50%",
                    "yPercent": "20.0%",
                    "headTopY": 0.20,
                    "dominantZone": "cranial_crown",
                    "haloGuard": False,
                },
            }
        ]
        res = validate_cranial_halo_guard(bad_layers, chunks=bad_chunks, max_halo_intersection_threshold=0.10)
        self.assertEqual(res["status"], "failed")
        self.assertGreater(res["maxHaloIntersectionFound"], 0.10)
        self.assertTrue(any("intersects cranial alpha feather ring" in v for v in res["violations"]))

    def test_halo_guard_passes_when_halo_guard_active(self):
        """Behind-subject pivot with haloGuard armed passes even when intersecting cranial feather ring."""
        protected_layers = [
            {
                "chunkIndex": 0,
                "layerName": "protected_pivot",
                "rawText": "PROTECTED",
                "fontFamily": "Anton",
                "fontSizePx": 150,
                "behindSubject": True,
                "haloGuard": True,
            }
        ]
        protected_chunks = [
            {
                "chunkIndex": 0,
                "placement": {
                    "xPercent": "50%",
                    "yPercent": "20.0%",
                    "headTopY": 0.20,
                    "dominantZone": "cranial_crown",
                    "haloGuard": True,
                },
            }
        ]
        res = validate_cranial_halo_guard(protected_layers, chunks=protected_chunks, max_halo_intersection_threshold=0.10)
        self.assertEqual(res["status"], "passed")
        self.assertEqual(len(res["violations"]), 0)

    def test_halo_guard_passes_when_clearing_halo_via_flank(self):
        """Text positioned in the flank column completely clears the cranial feather ring."""
        flank_layers = [
            {
                "chunkIndex": 0,
                "layerName": "flank_pivot",
                "rawText": "PILLAR",
                "fontFamily": "Anton",
                "fontSizePx": 150,
                "behindSubject": True,
            }
        ]
        flank_chunks = [
            {
                "chunkIndex": 0,
                "placement": {
                    "xPercent": "88%",
                    "yPercent": "25.0%",
                    "headTopY": 0.20,
                    "dominantZone": "flank_right_column",
                },
            }
        ]
        res = validate_cranial_halo_guard(flank_layers, chunks=flank_chunks, max_halo_intersection_threshold=0.10)
        self.assertEqual(res["status"], "passed")
        self.assertEqual(res["maxHaloIntersectionFound"], 0.0)
        self.assertEqual(len(res["violations"]), 0)

    def test_run_post_render_conformance_check_includes_cranial_halo_guard(self):
        """run_post_render_conformance_check must report cranialHaloGuard in checks."""
        manifest = {
            "chunks": [
                {
                    "chunkIndex": 0,
                    "text": "Hello world",
                    "placement": {"xPercent": "50%", "yPercent": "20%", "haloGuard": True},
                    "layers": [{"rawText": "Hello world", "behindSubject": False}],
                }
            ]
        }
        report = run_post_render_conformance_check(manifest_or_props=manifest, extract_frames=False)
        checks = report.get("checks", {})
        self.assertIn("cranialHaloGuard", checks, "cranialHaloGuard check must be present in policyReport")
        self.assertEqual(checks["cranialHaloGuard"]["status"], "passed")
        self.assertGreaterEqual(report["totalChecks"], 8)

    def test_subject_placement_sets_halo_guard_for_cranial_crown(self):
        """analyze_cranial_negative_space must set haloGuard=True and maxWidthPercent <= 50% for cranial placements."""
        subject_box = {"x": 0.35, "y": 0.18, "width": 0.30, "height": 0.60}
        analysis = analyze_cranial_negative_space(subject_box=subject_box, head_top_y=0.18)
        if analysis.get("dominantZone") == "cranial_crown":
            self.assertTrue(analysis.get("haloGuard"), "cranial_crown must have haloGuard enabled")
            max_w_str = str(analysis.get("maxWidthPercent", "100%")).replace("%", "")
            self.assertLessEqual(float(max_w_str), 50.0, "cranial_crown maxWidthPercent must be <= 50%")


if __name__ == "__main__":
    unittest.main()
