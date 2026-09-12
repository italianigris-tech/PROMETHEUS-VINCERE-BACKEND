import unittest
from pathlib import Path
from mini_run_pipeline.subject_placement import analyze_chunk_temporal_cranial_space
from mini_run_pipeline.policy_check import validate_head_occlusion


class TestRound12ContinuousMatte(unittest.TestCase):
    """Test suite for Round 12 Fix 3: Continuous Matte Mount & Dynamic Flank Tracking (<= 30% occlusion)."""

    def setUp(self):
        root = Path(__file__).resolve().parent.parent
        self.remotion_tsx = (root / "remotion-app" / "src" / "compositions" / "PrometheusMinRun.tsx").read_text(encoding="utf-8")

    def test_continuous_matte_mount_no_unmount_check(self):
        """Verify that matte OffthreadVideo mounts continuously without hasBehindSubjectLayer unmount guard."""
        self.assertNotIn(
            "const hasBehindSubjectLayer =",
            self.remotion_tsx,
            "hasBehindSubjectLayer unmount check must be removed for continuous matte mounting",
        )
        self.assertIn(
            "{matteSrc && (() => {",
            self.remotion_tsx,
            "matteSrc must guard the continuous matte mount",
        )

    def test_dynamic_flank_tracking_cranial_crown_subtle_sway(self):
        """When speaker has subtle head sway, cranial crown tracks opposite flank (62% right, 38% left)."""
        # Subtle sway left: mid_x = 0.48 -> tracks right to ~62% in cranial crown
        analysis_left = analyze_chunk_temporal_cranial_space(
            chunk_start_ms=0,
            chunk_end_ms=1500,
            observation={
                "frames": [
                    {
                        "sourceMs": 500,
                        "faceBox": {"x": 0.38, "y": 0.16, "width": 0.20, "height": 0.25},
                    }
                ]
            }
        )
        self.assertEqual(analysis_left["dominantZone"], "cranial_crown")
        x_left = float(analysis_left["xPercent"].replace("%", ""))
        self.assertGreaterEqual(x_left, 58.0)
        self.assertLessEqual(x_left, 65.0)

        # Subtle sway right: mid_x = 0.52 -> tracks left to ~38% in cranial crown
        analysis_right = analyze_chunk_temporal_cranial_space(
            chunk_start_ms=0,
            chunk_end_ms=1500,
            observation={
                "frames": [
                    {
                        "sourceMs": 500,
                        "faceBox": {"x": 0.42, "y": 0.16, "width": 0.20, "height": 0.25},
                    }
                ]
            }
        )
        self.assertEqual(analysis_right["dominantZone"], "cranial_crown")
        x_right = float(analysis_right["xPercent"].replace("%", ""))
        self.assertGreaterEqual(x_right, 35.0)
        self.assertLessEqual(x_right, 42.0)

    def test_dynamic_flank_tracking_large_sway_routes_to_flank_column(self):
        """When speaker has large lateral offset, routes cleanly to flank editorial pillar."""
        # Large offset left: mid_x = 0.42 -> routes to flank_right_column
        analysis = analyze_chunk_temporal_cranial_space(
            chunk_start_ms=0,
            chunk_end_ms=1500,
            observation={
                "frames": [
                    {
                        "sourceMs": 500,
                        "faceBox": {"x": 0.32, "y": 0.16, "width": 0.20, "height": 0.25},
                    }
                ]
            }
        )
        self.assertEqual(analysis["dominantZone"], "flank_right_column")
        x_pct = float(analysis["xPercent"].replace("%", ""))
        self.assertGreaterEqual(x_pct, 70.0)

    def test_occlusion_strictly_below_30_percent_with_flank_tracking(self):
        """Verify that head occlusion remains <= 30% with dynamic flank tracking."""
        layers = [
            {
                "chunkIndex": 1,
                "behindSubject": True,
                "text": "EXPERIENCE",
                "rawText": "EXPERIENCE",
                "fontFamily": "Anton",
                "fontSizePx": 160.0,
                "casing": "uppercase",
                "placement": {
                    "xPercent": "60%",
                    "yPercent": "18.0%",
                    "headTopY": 0.16,
                    "faceBottom": 0.45,
                }
            }
        ]
        res = validate_head_occlusion(layers, max_occlusion_threshold=0.40)
        self.assertEqual(res["status"], "passed")
        occ = res["maxOcclusionFound"]
        self.assertLessEqual(occ, 0.30, f"Head occlusion {occ:.1%} must be <= 30% under flank tracking")


if __name__ == "__main__":
    unittest.main()
