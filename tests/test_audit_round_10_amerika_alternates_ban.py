import unittest
from mini_run_pipeline.typography import (
    generate_font_manifest,
    resolve_safe_font_candidate,
    UNSAFE_DISTORTED_FONTS,
    DECORATIVE_BARRED_COMPANION_FONTS,
)


class TestRound10AmerikaAlternatesBan(unittest.TestCase):
    """Verifies Round 10 Fix 4:
    - 'amerika alternates' and 'amerika' are globally barred and present in UNSAFE_DISTORTED_FONTS.
    - resolve_safe_font_candidate never emits 'Amerika' or 'Amerika Alternates'.
    - Manifest generation across 30 seeds never emits Amerika as fontFamily or accentFont.
    """

    def test_amerika_in_unsafe_distorted_fonts(self):
        self.assertIn("amerika alternates", UNSAFE_DISTORTED_FONTS)
        self.assertIn("amerika", UNSAFE_DISTORTED_FONTS)
        self.assertIn("amerika", DECORATIVE_BARRED_COMPANION_FONTS)

    def test_resolve_safe_font_candidate_remaps_amerika(self):
        res1 = resolve_safe_font_candidate("amerika alternates")
        self.assertNotIn(res1.lower(), ("amerika", "amerika alternates"))
        res2 = resolve_safe_font_candidate("Amerika Alternates")
        self.assertNotIn(res2.lower(), ("amerika", "amerika alternates"))
        res3 = resolve_safe_font_candidate("amerika")
        self.assertNotIn(res3.lower(), ("amerika", "amerika alternates"))

    def test_manifest_across_30_seeds_never_emits_amerika(self):
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
            {
                "chunkIndex": 2,
                "text": "perfectly transparent, growing",
                "startMs": 4000,
                "endMs": 6000,
                "words": [{"text": "perfectly"}, {"text": "transparent,"}, {"text": "growing"}],
            },
        ]

        design_override = {
            "subjectLayering": "auto",
            "creativity": "expressive",
        }

        for seed in range(30):
            design = dict(design_override, seed=seed)
            manifest = generate_font_manifest(chunks_input, design_override=design)
            for chunk in manifest.get("chunks", []):
                for layer in chunk.get("layers", []):
                    font = layer.get("fontFamily", "")
                    accent = layer.get("accentFont", "")
                    self.assertNotIn(
                        font.lower(),
                        ("amerika", "amerika alternates"),
                        f"Seed {seed}, Chunk {chunk.get('chunkIndex')}: barred font '{font}' emitted in layer!",
                    )
                    self.assertNotIn(
                        accent.lower(),
                        ("amerika", "amerika alternates"),
                        f"Seed {seed}, Chunk {chunk.get('chunkIndex')}: barred font '{accent}' emitted in accentFont!",
                    )


if __name__ == "__main__":
    unittest.main()
