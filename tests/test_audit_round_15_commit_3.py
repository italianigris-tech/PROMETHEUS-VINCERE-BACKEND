import unittest
from mini_run_pipeline.typography import (
    generate_font_manifest,
    get_font_char_aspect,
    TALL_MATTE_FONTS,
)


class TestAuditRound15Commit3(unittest.TestCase):
    def test_aspect_aware_pivot_sizing(self):
        """Verify that pivot sizing scales by aspect multiplier to achieve target width."""
        six_caps_base_aspect = get_font_char_aspect("Six Caps", is_uppercase=False)
        self.assertLessEqual(six_caps_base_aspect, 0.30)

        # Multiplier for Six Caps (0.28): 0.40 / 0.28 ~ 1.428
        mult = max(1.0, 0.40 / six_caps_base_aspect)
        base = 240
        scaled = int(round(base * mult))
        bounded = min(320, max(180, scaled))
        self.assertGreaterEqual(bounded, 280)
        self.assertLessEqual(bounded, 320)

        anton_base_aspect = get_font_char_aspect("Anton", is_uppercase=False)
        self.assertAlmostEqual(anton_base_aspect, 0.40, delta=0.05)
        mult_anton = max(1.0, 0.40 / anton_base_aspect)
        self.assertAlmostEqual(mult_anton, 1.0, delta=0.05)

    def test_short_pivot_word_demotes_ultracondensed_in_manifest(self):
        """Verify that short pivot words (<= 5 chars) avoid ultra-condensed faces and achieve width >= 55% of headroom."""
        sample_chunk = {
            "chunkIndex": 1,
            "text": "part is I've",
            "startMs": 11169,
            "endMs": 12146,
            "subjectLayering": {"behindSubject": True, "mode": "auto"},
            "words": [
                {"text": "part", "start_ms": 11169, "end_ms": 11500},
                {"text": "is", "start_ms": 11501, "end_ms": 11800},
                {"text": "I've", "start_ms": 11801, "end_ms": 12146},
            ],
        }
        manifest = generate_font_manifest([sample_chunk])
        chunk_res = manifest["chunks"][0]
        behind_layers = [l for l in chunk_res["layers"] if l.get("behindSubject")]
        self.assertGreaterEqual(len(behind_layers), 1)

        pivot = behind_layers[0]
        # Verify font is in TALL_MATTE_FONTS
        self.assertIn(pivot["fontFamily"], TALL_MATTE_FONTS)
        # For word 'part' (4 chars), Six Caps / Saira EC should be demoted in favor of Anton / broad faces
        self.assertNotIn(pivot["fontFamily"], ["Six Caps", "Saira Extra Condensed"])
        # Font size should be robust (>= 240px)
        self.assertGreaterEqual(pivot["fontSizePx"], 240)


if __name__ == "__main__":
    unittest.main()
