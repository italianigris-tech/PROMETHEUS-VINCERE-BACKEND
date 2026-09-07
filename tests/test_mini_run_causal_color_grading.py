"""Unit and integration tests for causal color grading and the 7-pillar optical stack.

Verifies:
1. Registration and keyword resolution for film print stocks (Kodak 2383, Fuji 3513) and modern cinematic looks.
2. 3D LUT resolution with tetrahedral interpolation ('lut3d=...:interp=tetrahedral').
3. 7-Pillar optical finishing stack generation (gate weave, optical distortion, soft shoulder roll-off, subtractive saturation, film grain).
4. Causal shot grading execution via `grade_video_shot`.
5. Causal rendering pipeline contract: shot-first color grading -> matting on graded plate -> clean typography overlay.
"""

from pathlib import Path
import json
import subprocess
import tempfile
import unittest

from mini_run_pipeline import looks


class CausalColorGradingTests(unittest.TestCase):
    """Test suite verifying the causal shot-grading and optical finishing system."""

    def test_canonical_print_stocks_registered_and_resolvable(self):
        looks_list = looks.list_looks()
        look_ids = {item["id"] for item in looks_list}
        self.assertIn("kodak_2383_print", look_ids)
        self.assertIn("fuji_3513_print", look_ids)
        self.assertIn("teal_and_orange_blockbuster", look_ids)
        self.assertIn("moody_dramatic_cinema", look_ids)

        # Keyword matching for Kodak 2383
        kodak = looks.select_look(prompt="I want a 35mm celluloid film print look with warm amber highlights")
        self.assertEqual(kodak["lookId"], "kodak_2383_print")

        # Keyword matching for Fuji 3513
        fuji = looks.select_look(metadata={"mood": "atmospheric emerald cool shadows and magenta highlights"})
        self.assertEqual(fuji["lookId"], "fuji_3513_print")

    def test_tetrahedral_interpolation_preferred_for_3d_luts(self):
        plan = looks.select_look(design={"lookId": "kodak_2383_print"})
        filter_str = looks.build_grade_filter(plan)
        self.assertIn("lut3d=", filter_str)
        self.assertIn("interp=tetrahedral", filter_str)
        self.assertIn("kodak_2383_print.cube", filter_str)

    def test_seven_pillar_optical_finishing_stack_generation(self):
        plan = looks.select_look(design={"lookId": "kodak_2383_print"})
        plan["opticalFinishing"] = {
            "gateWeave": True,
            "lensDistortion": True,
            "shoulderRollOff": True,
            "subtractiveSaturation": True,
            "filmGrain": True,
        }
        filter_str = looks.build_grade_filter(plan)

        # Pillar 1 & 7: Gate Weave and Film Breathe
        self.assertIn("crop=in_w-4:in_h-4", filter_str)
        self.assertIn("sin(14.5*t)", filter_str)
        self.assertIn("brightness=", filter_str)

        # Pillar 5: Subtle Optical Distortion
        self.assertIn("lenscorrection=cx=0.5:cy=0.5:k1=0.008:k2=0.002", filter_str)

        # Core 3D LUT
        self.assertIn("lut3d=", filter_str)

        # Pillar 4: Non-Linear Highlight Roll-Off / Soft Shoulder
        self.assertIn("curves=all='0/0 0.5/0.5 0.75/0.75 0.88/0.85 0.96/0.92 1.0/0.965'", filter_str)

        # Pillar 6: Subtractive Saturation / Split-Toned Density
        self.assertIn("colorbalance=rs=-0.08:gs=0.02:bs=0.06:rh=0.04:gh=0.01:bh=-0.04", filter_str)

        # Pillar 3: Analog Emulsion Film Grain
        self.assertIn("noise=alls=10:allf=t", filter_str)

    def test_grade_video_shot_produces_output_file(self):
        repo_root = Path(__file__).resolve().parent.parent
        test_video = repo_root / "remotion-app" / "public" / "dev-fixtures" / "test-video.mp4"
        if not test_video.exists():
            self.skipTest(f"Test fixture not found: {test_video}")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            input_shot = tmp_path / "raw_shot.mp4"
            output_shot = tmp_path / "graded_shot.mp4"

            # Cut 0.5s segment
            subprocess.run([
                "ffmpeg", "-y", "-loglevel", "error",
                "-ss", "0", "-t", "0.5",
                "-i", str(test_video),
                "-c:v", "libx264", "-preset", "ultrafast",
                str(input_shot),
            ], check=True)

            plan = looks.select_look(design={"lookId": "teal_and_orange_blockbuster"})
            plan["opticalFinishing"] = {"gateWeave": True, "filmGrain": True}

            result_path = looks.grade_video_shot(
                input_shot_path=input_shot,
                output_shot_path=output_shot,
                look_plan=plan,
                width=1280,
                height=720,
            )

            self.assertTrue(result_path.exists())
            self.assertGreater(result_path.stat().st_size, 1000)

    def test_causal_contract_shot_first_then_matting_and_typography(self):
        """Verifies that render.py imports grade_video_shot and establishes the causal order."""
        import inspect
        from mini_run_pipeline import render

        render_source = inspect.getsource(render.render_final_video)

        # 1. Shot cutting must occur
        self.assertIn("cut_editorial_shot(", render_source)
        # 2. Shot color grading must occur BEFORE handle_matte
        idx_shot_grade = render_source.find("looks.grade_video_shot(")
        idx_matte = render_source.find("handle_matte(")
        idx_remotion = render_source.find("npx_bin, \"remotion\", \"render\"")

        self.assertGreater(idx_shot_grade, 0, "Shot grading step not found in render_final_video")
        self.assertGreater(idx_matte, 0, "Matte handling step not found in render_final_video")
        self.assertGreater(idx_remotion, 0, "Remotion render step not found in render_final_video")

        # Strict causality check: Shot grading precedes matting, which precedes Remotion composition
        self.assertLess(idx_shot_grade, idx_matte, "Causality violation: shot grading must happen BEFORE subject matting")
        self.assertLess(idx_matte, idx_remotion, "Causality violation: matting must happen BEFORE Remotion rendering")

        # Post-Remotion grading of muted_output must NOT occur
        self.assertNotIn("ffmpeg\", \"-y\", \"-loglevel\", \"error\",\n            \"-i\", str(muted_output),\n            \"-vf\", grade_filter", render_source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
