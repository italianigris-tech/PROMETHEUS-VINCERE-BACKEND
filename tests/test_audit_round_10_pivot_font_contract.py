import unittest
from mini_run_pipeline.typography import generate_font_manifest, TALL_MATTE_FONTS


class TestRound10PivotFontContract(unittest.TestCase):
    """Verifies Round 10 Fix 1: Behind-subject pivots must draw only from TALL_MATTE_FONTS,
    have uppercase casing, tall-chart sizing, and strictly bar Playfair Display and Amerika Alternates.
    """

    def test_pivot_font_contract_across_30_seeds(self):
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
                "text": "I've sold more than",
                "startMs": 2000,
                "endMs": 4000,
                "words": [{"text": "I've"}, {"text": "sold"}, {"text": "more"}, {"text": "than"}],
            },
            {
                "chunkIndex": 2,
                "text": "12,000 physical products",
                "startMs": 4000,
                "endMs": 6500,
                "words": [{"text": "12,000"}, {"text": "physical"}, {"text": "products"}],
            },
            {
                "chunkIndex": 3,
                "text": "generating multiple 6 figures",
                "startMs": 6500,
                "endMs": 9000,
                "words": [{"text": "generating"}, {"text": "multiple"}, {"text": "6"}, {"text": "figures"}],
            },
            {
                "chunkIndex": 4,
                "text": "in pure profit.",
                "startMs": 9000,
                "endMs": 11000,
                "words": [{"text": "in"}, {"text": "pure"}, {"text": "profit."}],
            },
        ]

        design_override = {
            "subjectLayering": "auto",
            "creativity": "expressive",
        }

        total_behind_pivots = 0
        barred_fonts = {"Playfair Display", "Amerika", "Amerika Alternates"}

        for seed in range(30):
            design = dict(design_override, seed=seed)
            manifest = generate_font_manifest(chunks_input, design_override=design)
            chunks = manifest.get("chunks", [])

            for chunk in chunks:
                layers = chunk.get("layers", [])
                for layer in layers:
                    if layer.get("behindSubject"):
                        total_behind_pivots += 1
                        font_family = layer.get("fontFamily")
                        casing = layer.get("casing")
                        font_size = layer.get("fontSizePx")
                        raw_text = layer.get("rawText", "")
                        clean_len = len("".join(c for c in raw_text if c.isalnum()))

                        # 1. Font must be in TALL_MATTE_FONTS
                        self.assertIn(
                            font_family,
                            TALL_MATTE_FONTS,
                            f"Seed {seed}, Chunk {chunk.get('chunkIndex')}: pivot font '{font_family}' is not in TALL_MATTE_FONTS!",
                        )

                        # 2. Barred fonts check
                        self.assertNotIn(
                            font_family,
                            barred_fonts,
                            f"Seed {seed}, Chunk {chunk.get('chunkIndex')}: barred font '{font_family}' selected for behind-subject pivot!",
                        )

                        # 3. Casing must be uppercase
                        self.assertEqual(
                            casing,
                            "uppercase",
                            f"Seed {seed}, Chunk {chunk.get('chunkIndex')}: pivot casing is '{casing}', expected 'uppercase'!",
                        )

                        # 4. Tall-chart sizing check
                        if clean_len <= 4:
                            self.assertGreaterEqual(
                                font_size,
                                210,
                                f"Seed {seed}: pivot '{raw_text}' (len {clean_len}) size {font_size} < 210",
                            )
                        elif clean_len <= 6:
                            self.assertGreaterEqual(
                                font_size,
                                175,
                                f"Seed {seed}: pivot '{raw_text}' (len {clean_len}) size {font_size} < 175",
                            )
                        elif clean_len <= 8:
                            self.assertGreaterEqual(
                                font_size,
                                150,
                                f"Seed {seed}: pivot '{raw_text}' (len {clean_len}) size {font_size} < 150",
                            )

        self.assertGreater(total_behind_pivots, 0, "No behind-subject pivots generated across 30 seeds!")


if __name__ == "__main__":
    unittest.main()
