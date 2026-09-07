"""Unit and integration tests for Mini-Run Resolution Retention and Increment System."""

import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path

from mini_run_pipeline import resolution
from mini_run_pipeline.resolution import ResolutionDepreciationError


class MiniRunResolutionTests(unittest.TestCase):
    """Test suite for resolution classification, planning, non-depreciation, and increment."""

    def test_classify_resolution_tiers(self):
        # 1080p portrait and landscape
        self.assertEqual(resolution.classify_resolution(1080, 1920)["tier"], "1080p")
        self.assertEqual(resolution.classify_resolution(1920, 1080)["tier"], "1080p")

        # 4K UHD portrait and landscape
        self.assertEqual(resolution.classify_resolution(2160, 3840)["tier"], "4k")
        self.assertEqual(resolution.classify_resolution(3840, 2160)["tier"], "4k")

        # 8K FUHD portrait and landscape
        self.assertEqual(resolution.classify_resolution(4320, 7680)["tier"], "8k")
        self.assertEqual(resolution.classify_resolution(7680, 4320)["tier"], "8k")

        # 1440p (2K)
        self.assertEqual(resolution.classify_resolution(1440, 2560)["tier"], "1440p")

        # Sub-1080p
        self.assertEqual(resolution.classify_resolution(720, 1280)["tier"], "sd_or_720p")

    def test_4k_input_retention_guarantee(self):
        """Invariant: A 4K video input MUST exit as at least 4K, never depreciating to 1080p."""
        # 4K portrait input
        plan = resolution.plan_resolution(2160, 3840)
        self.assertEqual(plan["input"]["tier"], "4k")
        self.assertEqual(plan["target"]["tier"], "4k")
        self.assertEqual(plan["target"]["width"], 2160)
        self.assertEqual(plan["target"]["height"], 3840)
        self.assertEqual(plan["scaleFactor"], 2.0)
        self.assertTrue(plan["isPreserved"])
        self.assertEqual(plan["policy"], "retention")

        # 4K landscape input (e.g. 3840x2160) converted to portrait mini-run
        plan_land = resolution.plan_resolution(3840, 2160)
        self.assertEqual(plan_land["input"]["tier"], "4k")
        self.assertEqual(plan_land["target"]["tier"], "4k")
        self.assertEqual(plan_land["target"]["width"], 2160)
        self.assertEqual(plan_land["target"]["height"], 3840)
        self.assertEqual(plan_land["scaleFactor"], 2.0)

    def test_strict_anti_depreciation_blocks_downgrade(self):
        """Even if caller explicitly asks for 1080p on a 4K input, non-depreciation floor is enforced."""
        plan = resolution.plan_resolution(2160, 3840, options={"targetResolution": "1080p"})
        self.assertEqual(plan["target"]["tier"], "4k")
        self.assertEqual(plan["policy"], "retention_enforced")
        self.assertIn("would depreciate", plan["reason"])

    def test_resolution_increment_1080p_to_4k(self):
        """Calling increment on 1080p input automatically steps up to 4K UHD."""
        plan = resolution.plan_resolution(1080, 1920, options={"incrementResolution": True})
        self.assertEqual(plan["input"]["tier"], "1080p")
        self.assertEqual(plan["target"]["tier"], "4k")
        self.assertEqual(plan["target"]["width"], 2160)
        self.assertEqual(plan["target"]["height"], 3840)
        self.assertEqual(plan["scaleFactor"], 2.0)
        self.assertTrue(plan["isIncremented"])
        self.assertEqual(plan["policy"], "increment")

    def test_resolution_increment_4k_to_8k(self):
        """Calling increment on 4K input automatically steps up to 8K FUHD."""
        plan = resolution.plan_resolution(2160, 3840, options={"incrementResolution": True})
        self.assertEqual(plan["input"]["tier"], "4k")
        self.assertEqual(plan["target"]["tier"], "8k")
        self.assertEqual(plan["target"]["width"], 4320)
        self.assertEqual(plan["target"]["height"], 7680)
        self.assertEqual(plan["scaleFactor"], 4.0)
        self.assertTrue(plan["isIncremented"])
        self.assertEqual(plan["policy"], "increment")

    def test_resolution_increment_8k_stays_at_ceiling(self):
        """8K input with increment requested remains at 8K ceiling."""
        plan = resolution.plan_resolution(4320, 7680, options={"incrementResolution": True})
        self.assertEqual(plan["target"]["tier"], "8k")
        self.assertEqual(plan["scaleFactor"], 4.0)

    def test_explicit_target_resolution(self):
        """Caller can explicitly request target resolution tiers."""
        plan_4k = resolution.plan_resolution(1080, 1920, options={"targetResolution": "4k"})
        self.assertEqual(plan_4k["target"]["tier"], "4k")
        self.assertEqual(plan_4k["scaleFactor"], 2.0)

        plan_8k = resolution.plan_resolution(1080, 1920, options={"targetResolution": "8k"})
        self.assertEqual(plan_8k["target"]["tier"], "8k")
        self.assertEqual(plan_8k["scaleFactor"], 4.0)

    def test_cost_profile_and_feasibility_analysis(self):
        """Cost profile calculates accurate pixel multipliers, GPU requirements, and feasibility."""
        cost_1080 = resolution.estimate_resolution_cost("1080p")
        self.assertEqual(cost_1080["pixelRatioVs1080p"], 1.0)
        self.assertIn("Native production baseline", cost_1080["feasibilityAssessment"])

        cost_4k = resolution.estimate_resolution_cost("4k")
        self.assertEqual(cost_4k["pixelRatioVs1080p"], 4.0)
        self.assertGreater(cost_4k["estimatedComputeCostUsd"], cost_1080["estimatedComputeCostUsd"])
        self.assertIn("Highly feasible", cost_4k["feasibilityAssessment"])
        self.assertIn("2160x3840", cost_4k["targetResolution"])

        cost_8k = resolution.estimate_resolution_cost("8k")
        self.assertEqual(cost_8k["pixelRatioVs1080p"], 16.0)
        self.assertGreater(cost_8k["estimatedComputeCostUsd"], cost_4k["estimatedComputeCostUsd"])
        self.assertIn("A100", cost_8k["recommendedGpu"])
        self.assertIn("MAX_TEXTURE_SIZE", cost_8k["feasibilityAssessment"])

    def test_verification_fixture_detects_depreciation(self):
        """Verification fixture raises ResolutionDepreciationError if output resolution drops."""
        plan = resolution.plan_resolution(2160, 3840)  # Requires 4K target

        # Mock probe returning 1080p when 4K was required
        with patch("mini_run_pipeline.silence.probe_media", return_value={"width": 1080, "height": 1920}):
            with patch.object(Path, "exists", return_value=True):
                with self.assertRaises(ResolutionDepreciationError) as ctx:
                    resolution.verify_output_resolution(
                        output_path="/tmp/fake_output.mp4",
                        plan=plan,
                        input_width=2160,
                        input_height=3840,
                    )
                self.assertIn("depreciated below planned target", str(ctx.exception))

    def test_verification_fixture_success(self):
        """Verification fixture succeeds and returns audit receipt when target resolution is satisfied."""
        plan = resolution.plan_resolution(2160, 3840)

        with patch("mini_run_pipeline.silence.probe_media", return_value={"width": 2160, "height": 3840}):
            with patch.object(Path, "exists", return_value=True):
                receipt = resolution.verify_output_resolution(
                    output_path="/tmp/fake_output.mp4",
                    plan=plan,
                    input_width=2160,
                    input_height=3840,
                )
                self.assertEqual(receipt["status"], "verified")
                self.assertEqual(receipt["actualWidth"], 2160)
                self.assertEqual(receipt["actualHeight"], 3840)
                self.assertTrue(receipt["nonDepreciationSatisfied"])

    def test_pipeline_job_creation_with_resolution_options(self):
        """Pipeline job creation captures resolution options on the job envelope."""
        from mini_run_pipeline import pipeline as pipeline_mod
        job = pipeline_mod.create_pipeline_job(
            source="/tmp/mock_4k.mp4",
            job_id="test-res-job-1",
            options={
                "targetResolution": "4k",
                "incrementResolution": True,
            }
        )
        self.assertEqual(job["status"], "queued")
        self.assertEqual(job["data"]["targetResolution"], "4k")
        self.assertTrue(job["data"]["incrementResolution"])

    def test_render_slice_specs_pass_scale_factor_for_4k(self):
        """4K input resolution causes render slice specs and props to carry scale=2.0 and target dimensions."""
        from mini_run_pipeline import render as render_mod

        captured_specs = []
        def mock_slice_executor(specs):
            captured_specs.extend(specs)
            for s in specs:
                Path(s["outputSlicePath"]).touch()
            return specs

        timeline = {
            "sourceWidth": 2160,
            "sourceHeight": 3840,
            "outputDurationMs": 2000,
            "timestampMap": [{"outputStartMs": 0, "outputEndMs": 2000}],
        }
        chunks = [{"text": "Hello 4K", "outputStartMs": 0, "outputEndMs": 1900}]

        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            out_root = Path(tmpdir)
            fake_src = out_root / "fake_in.mp4"
            fake_src.touch()

            # Mock probe to report 4K input and 4K output
            with patch("mini_run_pipeline.silence.probe_media", return_value={"width": 2160, "height": 3840, "durationMs": 2000}):
                with patch("mini_run_pipeline.render._probe_media_duration_ms", return_value=2000):
                    with patch("mini_run_pipeline.render.cut_part", side_effect=lambda *a, **kw: Path(kw.get("output_path") or a[3]).touch()):
                        with patch("mini_run_pipeline.render._run_ffmpeg"):
                            with patch("mini_run_pipeline.render.require_render_duration"):
                                # Create dummy final output so existence check passes
                                dummy_final = out_root / "mini_run_test-4k-timeline.mp4"
                                dummy_final.touch()

                                receipt = render_mod.render_final_video(
                                    source_path=str(fake_src),
                                    timeline=timeline,
                                    chunks=chunks,
                                    output_root=str(out_root),
                                    job_id="test-4k",
                                    slice_executor=mock_slice_executor,
                                    max_clip_ms=2000,
                                )

                                # Verify slice specs captured carry scale=2.0 and target 2160x3840
                                self.assertTrue(len(captured_specs) > 0)
                                first_spec = captured_specs[0]
                                self.assertEqual(first_spec["scale"], 2.0)
                                self.assertEqual(first_spec["targetWidth"], 2160)
                                self.assertEqual(first_spec["targetHeight"], 3840)

                                # Verify receipt carries resolution audit
                                self.assertIn("resolution", receipt)
                                self.assertEqual(receipt["resolution"]["targetWidth"], 2160)
                                self.assertEqual(receipt["resolution"]["targetHeight"], 3840)
                                self.assertEqual(receipt["resolution"]["scaleFactor"], 2.0)


if __name__ == "__main__":
    unittest.main()
