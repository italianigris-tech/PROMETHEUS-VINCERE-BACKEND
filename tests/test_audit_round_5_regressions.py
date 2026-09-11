"""Hermetic regression tests verifying the 5 Round 5 audit fixes.

Tests:
1. Behind-subject gating: '12,000 physical products' and any multi-word phrase with digits
   is strictly disqualified from behindSubject.
2. Behind-subject bounds: Words >= 3 or total length > 10 chars never matte behind subject.
3. Dialogue clamp: 4-word and 5-word phrases ('figures in pure profit.') partition into <= 2 layers.
4. Placement variety: Consecutive centered foreground chunks stagger between mid-chest (62%)
   and lower-third baseline (75%) rather than locking to 68%.
5. Script bias normalization: No 1.75x artificial multiplier favoring cursive/script over grotesques/serifs.
6. 3D LUT finishing stack: Post-LUT filter does not inject cyan colorbalance or noise > 3.
"""

import unittest
from mini_run_pipeline import typography, subject_placement, looks


class Round5RegressionTests(unittest.TestCase):
    def test_12000_physical_products_never_mattes_behind_subject(self):
        """Invariant: '12,000 physical products' (multi-word with digits) must NEVER be behindSubject."""
        chunks = [
            {"text": "Over the last", "startMs": 800, "endMs": 1300},
            {"text": "12 months, I've", "startMs": 1300, "endMs": 2400},
            {"text": "purchased more than", "startMs": 2400, "endMs": 3200},
            {"text": "12,000 physical products", "startMs": 3200, "endMs": 4900},
            {"text": "from eBay.com that", "startMs": 4900, "endMs": 6500},
        ]
        manifest = typography.generate_font_manifest(chunks, {"seed": "audit_test", "subjectLayering": "auto"})
        manifest_chunks = manifest.get("chunks", [])
        c3 = next((c for c in manifest_chunks if "12,000" in c.get("text", "") and "physical" in c.get("text", "")), None)
        self.assertIsNotNone(c3)
        self.assertFalse(c3.get("behindSubject", False), "'12,000 physical products' must NOT be behindSubject")
        for layer in c3.get("layers", []):
            self.assertFalse(layer.get("behindSubject", False), "Layer inside '12,000 physical products' must NOT be behindSubject")

    def test_multi_word_phrases_with_digits_permanently_disqualified_from_behind_subject(self):
        """Any phrase with digits and > 1 word must be disqualified from cranial/behind-subject placement."""
        multi_digit_phrases = [
            "100 million dollars",
            "over 500 cars",
            "50 percent margin",
            "in 2026 alone",
        ]
        chunks = [{"text": phrase, "startMs": i * 1500, "endMs": (i + 1) * 1500} for i, phrase in enumerate(multi_digit_phrases)]
        manifest = typography.generate_font_manifest(chunks, {"seed": "audit_digits", "subjectLayering": "auto"})
        for chunk in manifest.get("chunks", []):
            self.assertFalse(chunk.get("behindSubject", False), f"'{chunk.get('text')}' should not be behindSubject")

    def test_dialogue_clamp_partitions_four_words_into_two_layers(self):
        """Invariant: 'figures in pure profit.' (4 tokens) must partition into at most 2 layers."""
        words = ["figures", "in", "pure", "profit."]
        three_layer_profile = [
            {"role": "companion", "font_style": {"relative_scale": 0.5}, "font_classification": "Sans"},
            {"role": "hero", "font_style": {"relative_scale": 1.2}, "font_classification": "Script"},
            {"role": "accent", "font_style": {"relative_scale": 0.9}, "font_classification": "Script"},
        ]
        partitions = typography.smart_partition_chunk_words(words, three_layer_profile)
        self.assertLessEqual(len(partitions), 2, "4-word dialogue must be clamped to <= 2 layers")
        flat_words = [w for p in partitions for w in p["words"]]
        self.assertEqual(flat_words, words)
        self.assertIn("pure", partitions[-1]["words"])
        self.assertIn("profit.", partitions[-1]["words"])

    def test_placement_hysteresis_broken_with_staging_bands(self):
        """Invariant: Consecutive centered foreground chunks stagger between lower-third and mid-chest."""
        chunks = [
            {"text": f"dialogue chunk {i}", "startMs": i * 1000, "endMs": (i + 1) * 1000}
            for i in range(6)
        ]
        observation = {
            "summary": {
                "headroomRatio": 0.25,
                "faceBottom": 0.48,
                "flankLeftRatio": 0.25,
                "flankRightRatio": 0.25,
            },
            "frames": [],
        }
        placements = subject_placement.plan_subject_safe_placements(chunks, observation)
        self.assertEqual(len(placements), 6)
        y_values = [p["yPercent"] for p in placements]
        distinct_y = set(y_values)
        self.assertGreater(len(distinct_y), 1, f"Placement must vary across staging bands, got {distinct_y}")
        for y_str in y_values:
            y_float = float(y_str.replace("%", "")) / 100.0
            self.assertGreaterEqual(y_float, 0.55, f"Y {y_str} must be below chin")

    def test_script_bias_bonus_normalized(self):
        """Invariant: _profile_bias_score does not inflate script over editorial/grotesque."""
        script_profile = {
            "id": "script_test",
            "profile_name": "Luxury Cursive Script",
            "typography_layers": [{"font_classification": "Script"}],
            "metadata": {"overall_mood": "cursive elegant flourish"},
        }
        editorial_profile = {
            "id": "editorial_test",
            "profile_name": "Vogue Didone Editorial",
            "typography_layers": [{"font_classification": "Didone Serif"}],
            "metadata": {"overall_mood": "editorial vogue serif"},
        }
        grotesque_profile = {
            "id": "grotesque_test",
            "profile_name": "Modern Display Grotesque",
            "typography_layers": [{"font_classification": "Grotesque"}],
            "metadata": {"overall_mood": "display modern grotesque"},
        }
        script_score = typography._profile_bias_score(script_profile, "mixed")
        editorial_score = typography._profile_bias_score(editorial_profile, "mixed")
        grotesque_score = typography._profile_bias_score(grotesque_profile, "mixed")
        self.assertLessEqual(script_score, editorial_score, "Script score must not exceed editorial")
        self.assertLessEqual(script_score, grotesque_score, "Script score must not exceed grotesque")

    def test_3d_lut_post_finishing_neutralized(self):
        """Invariant: When a 3D LUT is active, post-finishing does not inject cyan sludge or harsh noise."""
        plan = looks.select_look(design={"lookId": "teal_and_orange_blockbuster"})
        filt = looks.build_grade_filter(plan, video_width=1080, video_height=1920)
        self.assertIn("lut3d=", filt, "3D LUT must be used")
        self.assertNotIn("rs=-0.08", filt, "Must not inject aggressive -0.08 red split-toning")
        self.assertNotIn("bs=0.06", filt, "Must not inject aggressive +0.06 blue cyan push")
        self.assertNotIn("noise=alls=10", filt, "Must not inject harsh noise=alls=10")
        if "noise=alls=" in filt:
            import re
            m = re.search(r"noise=alls=(\d+)", filt)
            self.assertIsNotNone(m)
            self.assertLessEqual(int(m.group(1)), 3, "Noise must be <= 3 for subtle film grain")


if __name__ == "__main__":
    unittest.main(verbosity=2)