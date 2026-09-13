import unittest
from mini_run_pipeline.typography import (
    generate_font_manifest,
    PIVOT_FACE_WHITELIST,
    BANNED_PIVOT_FONTS,
    TALL_MATTE_FONTS,
    get_font_char_aspect,
    estimate_layer_width_px,
)


class TestAuditRound16Commit3(unittest.TestCase):
    """Verifies Round 16 Commit 3: Pivot face whitelist.
    Ensures behind-subject pivots strictly draw ONLY from PIVOT_FACE_WHITELIST
    (League Gothic, Anton, Bebas Neue, Pathway Extreme, Teko)
    and that ultra-condensed faces (Six Caps, SenzaBella, Saira Extra Condensed)
    are banned from pivot duty.
    """

    def test_pivot_face_whitelist_contents(self):
        expected_whitelist = {"League Gothic", "Anton", "Bebas Neue", "Pathway Extreme", "Teko"}
        self.assertEqual(set(PIVOT_FACE_WHITELIST), expected_whitelist)
        for banned in ["Six Caps", "SenzaBella", "Saira Extra Condensed", "Antonio", "Big Shoulders Display"]:
            self.assertIn(banned, BANNED_PIVOT_FONTS)
            self.assertNotIn(banned, PIVOT_FACE_WHITELIST)

    def test_behind_subject_pivots_strictly_draw_from_whitelist_across_30_seeds(self):
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
                "text": "part is I've",
                "startMs": 6500,
                "endMs": 8500,
                "words": [{"text": "part"}, {"text": "is"}, {"text": "I've"}],
            },
            {
                "chunkIndex": 4,
                "text": "it's growing every day",
                "startMs": 8500,
                "endMs": 11000,
                "words": [{"text": "it's"}, {"text": "growing"}, {"text": "every"}, {"text": "day"}],
            },
        ]

        design_override = {
            "subjectLayering": "auto",
            "creativity": "expressive",
        }

        total_pivots = 0
        for seed in range(30):
            design = dict(design_override, seed=seed)
            manifest = generate_font_manifest(chunks_input, design_override=design)
            chunks = manifest.get("chunks", [])

            for chunk in chunks:
                for layer in chunk.get("layers", []):
                    if layer.get("behindSubject"):
                        total_pivots += 1
                        font = layer.get("fontFamily")
                        # 1. Must be in whitelist
                        self.assertIn(
                            font,
                            PIVOT_FACE_WHITELIST,
                            f"Seed {seed}, Chunk {chunk.get('chunkIndex')}: pivot font '{font}' not in whitelist!",
                        )
                        # 2. Must not be in banned set
                        self.assertNotIn(
                            font,
                            BANNED_PIVOT_FONTS,
                            f"Seed {seed}, Chunk {chunk.get('chunkIndex')}: banned font '{font}' selected for pivot!",
                        )

        self.assertGreater(total_pivots, 0, "No behind-subject pivots generated across 30 seeds")

    def test_growing_and_part_chunks_ban_six_caps_and_senzabella(self):
        """Specifically verifies the two user-critique callouts ('GROWING' and 'PART')
        never receive Six Caps or SenzaBella even when profiles offer them as candidates.
        """
        chunks_input = [
            {
                "chunkIndex": 10,
                "text": "PART is I've",
                "startMs": 11169,
                "endMs": 12146,
                "subjectLayering": {"behindSubject": True, "mode": "forced"},
                "words": [
                    {"text": "PART", "start_ms": 11169, "end_ms": 11600},
                    {"text": "is", "start_ms": 11601, "end_ms": 11800},
                    {"text": "I've", "start_ms": 11801, "end_ms": 12146},
                ],
            },
            {
                "chunkIndex": 18,
                "text": "GROWING fast",
                "startMs": 19000,
                "endMs": 20500,
                "subjectLayering": {"behindSubject": True, "mode": "forced"},
                "words": [
                    {"text": "GROWING", "start_ms": 19000, "end_ms": 19800},
                    {"text": "fast", "start_ms": 19801, "end_ms": 20500},
                ],
            },
        ]

        for seed in range(15):
            manifest = generate_font_manifest(chunks_input, design_override={"seed": seed, "subjectLayering": "forced"})
            for chunk in manifest["chunks"]:
                for layer in chunk.get("layers", []):
                    if layer.get("behindSubject"):
                        font = layer.get("fontFamily")
                        self.assertIn(
                            font,
                            PIVOT_FACE_WHITELIST,
                            f"Seed {seed}, text '{layer.get('text')}': expected whitelisted pivot font, got '{font}'",
                        )
                        self.assertNotIn(
                            font,
                            {"Six Caps", "SenzaBella", "Saira Extra Condensed"},
                            f"Seed {seed}, text '{layer.get('text')}': got banned ultra-condensed font '{font}'",
                        )

    def test_whitelisted_fonts_maintain_broad_aspect(self):
        """Verify all whitelisted fonts have char aspect ratio >= 0.35 (preventing skinny collapses)."""
        for font in PIVOT_FACE_WHITELIST:
            aspect = get_font_char_aspect(font, is_uppercase=True)
            self.assertGreaterEqual(
                aspect,
                0.50,  # uppercase aspect table multiplier 1.44 applied to base >= 0.36 -> >= 0.518
                f"Whitelisted font '{font}' has insufficient uppercase aspect ratio: {aspect}",
            )


if __name__ == "__main__":
    unittest.main()
