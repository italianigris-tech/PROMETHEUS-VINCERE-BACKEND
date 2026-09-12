import unittest
import json
import sys
import tempfile
from pathlib import Path


class MiniRunLooksTests(unittest.TestCase):
    """Unit tests for color-grading / looks resolution, filter generation, and LUT discovery."""

    def _select(self, **kwargs):
        from mini_run_pipeline import looks
        return looks.select_look(**kwargs)

    def test_all_ten_canonical_looks_registered(self):
        from mini_run_pipeline import looks
        ids = [look["id"] for look in looks.list_looks()]
        self.assertGreaterEqual(len(ids), 10)
        self.assertIn("teal_and_orange_blockbuster", ids)
        self.assertIn("sci_netone_balanced", ids)
        self.assertIn("neon_tokyo_cyberpunk", ids)
        self.assertIn("faded_black_and_white", ids)
        self.assertIn("kodak_2383_print", ids)
        self.assertIn("fuji_3513_print", ids)
        # every look must carry a default intensity within its range
        for look in looks.list_looks():
            lo, hi = look["policies"]["intensityRange"]
            self.assertGreaterEqual(look["params"].get("intensity", 1.0), lo)
            self.assertLessEqual(look["params"].get("intensity", 1.0), hi)

    def test_explicit_look_id_takes_highest_priority(self):
        plan = self._select(
            design={"lookId": "neon_tokyo_cyberpunk", "lookIntensity": 0.8},
            metadata={"mood": "warm, cozy"},
            prompt="give me a vintage film look",
        )
        self.assertEqual(plan["lookId"], "neon_tokyo_cyberpunk")
        self.assertEqual(plan["resolution"], "explicit")
        self.assertEqual(plan["intensity"], 0.8)

    def test_metadata_mood_resolution(self):
        plan = self._select(metadata={"mood": "harsh, gritty, intense, action"})
        self.assertEqual(plan["lookId"], "bleach_bypass")
        self.assertEqual(plan["resolution"], "metadata_mood")

    def test_prompt_keyword_resolution(self):
        plan = self._select(prompt="Please give me a blockbuster teal and orange cinematic grade")
        self.assertEqual(plan["lookId"], "teal_and_orange_blockbuster")
        self.assertEqual(plan["resolution"], "prompt_keywords")

    def test_fallback_default(self):
        plan = self._select()
        self.assertEqual(plan["lookId"], "none")
        self.assertEqual(plan["resolution"], "fallback_default")
        self.assertEqual(plan["intensity"], 0.0)

    def test_intensity_zero_yields_no_filter(self):
        from mini_run_pipeline import looks
        plan = self._select(design={"lookId": "teal_and_orange_blockbuster", "lookIntensity": 0})
        self.assertEqual(looks.build_grade_filter(plan), "")

    def test_filter_string_is_well_formed(self):
        from mini_run_pipeline import looks
        plan = self._select(design={"lookId": "teal_and_orange_blockbuster"})
        filt = looks.build_grade_filter(plan)
        self.assertTrue(filt)
        # no double commas or leading/trailing commas
        self.assertNotIn(",,", filt)
        self.assertFalse(filt.startswith(","))
        self.assertFalse(filt.endswith(","))
        # every sub-filter carries a value
        for token in filt.split(","):
            self.assertIn("=", token)

    def test_vignette_geometry_uses_dimensions_when_known(self):
        from mini_run_pipeline import looks
        plan = self._select(design={"lookId": "golden_hour_warmth"})
        no_dimensions = looks.build_grade_filter(plan, video_width=None, video_height=None)
        with_dimensions = looks.build_grade_filter(plan, video_width=1080, video_height=1920)
        # the vignette angle expression is always present, but an explicit
        # aspect= w/h is only emitted when dimensions are known.
        self.assertIn("vignette=eval=frame:angle", no_dimensions)
        self.assertNotIn("aspect=", no_dimensions)
        self.assertIn("vignette=eval=frame:angle", with_dimensions)
        self.assertIn("aspect=1080/1920", with_dimensions)

    def test_lut_discovery_finds_none_and_does_not_crash(self):
        from mini_run_pipeline import looks
        # Shipped LUTs are discovered automatically from mini_run_pipeline/luts
        self.assertTrue(looks.luts_available())
        self.assertGreaterEqual(len(looks.discover_luts()), 10)
        # In an empty directory, discovery must be safe + empty
        with tempfile.TemporaryDirectory() as tmp:
            empty_dir = Path(tmp) / "empty_luts"
            self.assertFalse(looks.luts_available(empty_dir))
            self.assertEqual(looks.discover_luts(empty_dir), [])

    def test_lut_discovery_returns_files_when_present(self):
        import mini_run_pipeline.looks as looks
        original_root = looks.LUT_DIR
        try:
            with tempfile.TemporaryDirectory() as tmp:
                lut_dir = Path(tmp)
                (lut_dir / "teal_orange.cube").write_text("LUT_3D_SIZE 33\n")
                (lut_dir / "ignore.txt").write_text("not a lut")
                looks.LUT_DIR = lut_dir
                found = looks.discover_luts()
                self.assertEqual(len(found), 1)
                self.assertEqual(found[0]["format"], "cube")
                self.assertEqual(found[0]["name"], "teal_orange")
                self.assertTrue(looks.luts_available())
        finally:
            looks.LUT_DIR = original_root

    def test_write_look_manifest_persists_json(self):
        from mini_run_pipeline import looks
        plan = self._select(design={"lookId": "vintage_film_emulation"})
        plan["gradeFilter"] = looks.build_grade_filter(plan)
        with tempfile.TemporaryDirectory() as tmp:
            path = looks.write_look_manifest(plan, tmp, "job-abc")
            p = Path(path)
            self.assertTrue(p.exists())
            data = json.loads(p.read_text())
            self.assertEqual(data["lookId"], "vintage_film_emulation")
            self.assertEqual(data["jobId"], "job-abc")
            self.assertTrue(data["gradeFilter"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
