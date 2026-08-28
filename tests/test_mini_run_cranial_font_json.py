"""Unit tests for Cranial Font Placement JSON specifications and typography integration."""

from __future__ import annotations

import unittest

from mini_run_pipeline.typography import (
    load_all_cranial_font_json_profiles,
    load_all_font_json_profiles,
    _is_cranial_profile,
    _is_behind_subject_candidate_profile,
    generate_font_manifest,
)


class CranialFontJsonTests(unittest.TestCase):
    def test_cranial_profiles_loaded_and_paired_images_exist(self):
        """Verify all 6 cranial font JSON profiles load and link to their paired images."""
        cranial_profiles = load_all_cranial_font_json_profiles()
        self.assertEqual(len(cranial_profiles), 6)

        expected_ids = {
            "cranial image center (1)",
            "cranial image center (2)",
            "cranial image center (3)",
            "cranial image center (4)",
            "cranial image center (5)",
            "cranial image center (6)",
        }
        loaded_ids = {p["id"] for p in cranial_profiles}
        self.assertEqual(loaded_ids, expected_ids)

        for prof in cranial_profiles:
            self.assertTrue(prof["paired_image_exists"], f"Image missing for {prof['id']}")
            self.assertTrue(prof["is_cranial_profile"])
            self.assertIn("cranial_spec", prof)
            self.assertEqual(prof["cranial_spec"]["alignment"], "center")
            self.assertGreater(len(prof["typography_layers"]), 0)

    def test_cranial_profile_classifiers(self):
        """Verify _is_cranial_profile and _is_behind_subject_candidate_profile recognize cranial profiles."""
        cranial_profiles = load_all_cranial_font_json_profiles()
        for prof in cranial_profiles:
            self.assertTrue(_is_cranial_profile(prof))
            self.assertTrue(_is_behind_subject_candidate_profile(prof))

    def test_generate_font_manifest_can_match_cranial_profiles(self):
        """Verify generate_font_manifest successfully uses behind-subject candidates."""
        chunks = [
            {"chunkIndex": 1, "startMs": 1000, "endMs": 3000, "text": "Talking Head"},
            {"chunkIndex": 2, "startMs": 3500, "endMs": 5500, "text": "VIDEOS"},
            {"chunkIndex": 3, "startMs": 6000, "endMs": 8000, "text": "built"},
        ]
        result = generate_font_manifest(
            chunks=chunks,
            design_override={"policy": {"subjectLayering": "required"}},
        )
        self.assertEqual(len(result["chunks"]), 3)
        has_behind = any(
            c.get("subjectLayering", {}).get("behindSubject") or any(l.get("behindSubject") for l in c.get("layers", []))
            for c in result["chunks"]
        )
        self.assertTrue(has_behind)


if __name__ == "__main__":
    unittest.main()
