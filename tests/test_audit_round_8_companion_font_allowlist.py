import unittest
from mini_run_pipeline.typography import (
    FONT_FAMILY_REGISTRY,
    COMPANION_UPGRADE_FONTS,
    DECORATIVE_BARRED_COMPANION_FONTS,
    is_barred_companion_font,
    upgrade_font_candidate,
    generate_font_manifest,
)


class TestRound8CompanionFontAllowlist(unittest.TestCase):
    """Verifies that decorative alternates and trial faces are strictly barred from companion tiers."""

    def test_amerika_alternates_remapped_in_registry(self):
        """Amerika Alternates must resolve to the authoritative full Amerika family."""
        self.assertEqual(FONT_FAMILY_REGISTRY.get("amerika alternates"), "Amerika")

    def test_is_barred_companion_font_detection(self):
        """Authoritative barred fonts must be flagged by is_barred_companion_font."""
        barred_examples = [
            "Amerika Alternates",
            "amerika alternates",
            "Erotique Alternate Trial",
            "Quanton",
            "Blaak",
            "Foundland",
            "Aulion Demo",
            "Aesthico",
            "The Glamoure",
            "Black Delights",
            "Bellavoir Serif",
            "Candlescript",
            "Freebooter Script",
            "Grand Cru",
            "ZT Otez",
            "Migra",
            "Elegist",
            "Vogue",
            "ANTENNA",
            "Abril Fatface",
            "Blaak Thin PERSONAL USE",
            "Foundland Italic PERSONAL USE ONLY",
        ]
        for f in barred_examples:
            self.assertTrue(
                is_barred_companion_font(f),
                f"Expected '{f}' to be flagged as a barred companion font.",
            )

        # Standard clean companion fonts must not be barred
        clean_examples = [
            "Montserrat",
            "Outfit",
            "DM Sans",
            "Altone",
            "Pathway Extreme",
            "Inter",
            "Space Mono",
        ]
        for f in clean_examples:
            self.assertFalse(
                is_barred_companion_font(f),
                f"Clean font '{f}' was incorrectly flagged as barred.",
            )

    def test_upgrade_font_candidate_remaps_barred_companions(self):
        """Companion layers with barred fonts must be remapped to clean companion fonts."""
        for font in [
            "Amerika Alternates",
            "Quanton",
            "Blaak",
            "The Glamoure",
            "Black Delights",
            "Bellavoir Serif",
            "Vogue",
            "Antenna",
            "Abril Fatface",
        ]:
            upgraded = upgrade_font_candidate(font, is_hero=False, role="companion")
            self.assertIn(
                upgraded,
                COMPANION_UPGRADE_FONTS,
                f"Font '{font}' was not remapped to a clean companion font! Got '{upgraded}'",
            )

    def test_manifest_across_30_seeds_never_assigns_barred_font_to_companion(self):
        """Manifest generation across 30 seeds must NEVER assign a barred font to companion layers."""
        sample_chunks = [
            {
                "chunkIndex": 0,
                "text": "Over the last 12 months",
                "startMs": 0,
                "endMs": 1400,
                "words": [{"text": "Over"}, {"text": "the"}, {"text": "last"}, {"text": "12"}, {"text": "months"}],
            },
            {
                "chunkIndex": 1,
                "text": "I've sold more than",
                "startMs": 1400,
                "endMs": 2800,
                "words": [{"text": "I've"}, {"text": "sold"}, {"text": "more"}, {"text": "than"}],
            },
            {
                "chunkIndex": 2,
                "text": "12,000 physical products",
                "startMs": 2800,
                "endMs": 4500,
                "words": [{"text": "12,000"}, {"text": "physical"}, {"text": "products"}],
            },
            {
                "chunkIndex": 3,
                "text": "generating multiple 6 figures",
                "startMs": 4500,
                "endMs": 6200,
                "words": [{"text": "generating"}, {"text": "multiple"}, {"text": "6"}, {"text": "figures"}],
            },
        ]

        for seed in range(30):
            design_override = {"seed": seed, "creativity": "expressive"}
            manifest = generate_font_manifest(sample_chunks, design_override=design_override)
            chunks = manifest.get("chunks", [])
            for c in chunks:
                for layer in c.get("layers", []):
                    is_hero = layer.get("isHero", False)
                    if not is_hero:
                        font_family = layer.get("fontFamily", "")
                        accent_font = layer.get("accentFont", "")
                        self.assertFalse(
                            is_barred_companion_font(font_family),
                            f"Seed {seed}, Chunk {c.get('chunkIndex')}, Layer '{layer.get('rawText')}' companion has barred fontFamily '{font_family}'!",
                        )
                        self.assertFalse(
                            is_barred_companion_font(accent_font),
                            f"Seed {seed}, Chunk {c.get('chunkIndex')}, Layer '{layer.get('rawText')}' companion has barred accentFont '{accent_font}'!",
                        )


if __name__ == "__main__":
    unittest.main()
