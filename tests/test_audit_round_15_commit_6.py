import unittest
from pathlib import Path
from mini_run_pipeline.typography import generate_font_manifest, preflight_and_fit_layer_widths

ROOT = Path(__file__).resolve().parent.parent


class TestAuditRound15Commit6(unittest.TestCase):
    def test_legibility_floor_across_all_layers(self):
        """Verify that every layer generated across diverse chunks respects fontSizePx >= 64."""
        test_chunks = [
            {
                "chunkIndex": 1,
                "text": "Over THE LAST 12 MONTHS,",
                "startMs": 0,
                "endMs": 1800,
                "words": [
                    {"text": "Over", "start_ms": 0, "end_ms": 300},
                    {"text": "THE", "start_ms": 300, "end_ms": 600},
                    {"text": "LAST", "start_ms": 600, "end_ms": 1000},
                    {"text": "12", "start_ms": 1000, "end_ms": 1400},
                    {"text": "MONTHS,", "start_ms": 1400, "end_ms": 1800},
                ],
            },
            {
                "chunkIndex": 2,
                "text": "i've Purchased More",
                "startMs": 1900,
                "endMs": 3200,
                "words": [
                    {"text": "i've", "start_ms": 1900, "end_ms": 2300},
                    {"text": "Purchased", "start_ms": 2300, "end_ms": 2800},
                    {"text": "More", "start_ms": 2800, "end_ms": 3200},
                ],
            },
            {
                "chunkIndex": 3,
                "text": "Than 12,000 physical PRODUCTS",
                "startMs": 3300,
                "endMs": 4800,
                "words": [
                    {"text": "Than", "start_ms": 3300, "end_ms": 3600},
                    {"text": "12,000", "start_ms": 3600, "end_ms": 4100},
                    {"text": "physical", "start_ms": 4100, "end_ms": 4400},
                    {"text": "PRODUCTS", "start_ms": 4400, "end_ms": 4800},
                ],
            },
        ]

        manifest = generate_font_manifest(chunks=test_chunks, design_override={"seed": 101})
        chunks = manifest.get("chunks", [])
        self.assertEqual(len(chunks), 3)

        for chunk in chunks:
            for layer in chunk.get("layers", []):
                font_size = float(layer.get("fontSizePx", 0))
                self.assertGreaterEqual(
                    font_size,
                    64.0,
                    f"Layer '{layer.get('text')}' font size {font_size} must be >= 64px floor",
                )

    def test_golden_ratio_tier_ladder(self):
        """Verify fontSize_hero >= fontSize_companion * 1.618 in multi-layer chunks."""
        test_chunks = [
            {
                "chunkIndex": 1,
                "text": "Over THE LAST 12 MONTHS,",
                "startMs": 0,
                "endMs": 1800,
                "words": [
                    {"text": "Over", "start_ms": 0, "end_ms": 300},
                    {"text": "THE", "start_ms": 300, "end_ms": 600},
                    {"text": "LAST", "start_ms": 600, "end_ms": 1000},
                    {"text": "12", "start_ms": 1000, "end_ms": 1400},
                    {"text": "MONTHS,", "start_ms": 1400, "end_ms": 1800},
                ],
            },
            {
                "chunkIndex": 2,
                "text": "from Ebay.com That",
                "startMs": 1900,
                "endMs": 3200,
                "words": [
                    {"text": "from", "start_ms": 1900, "end_ms": 2300},
                    {"text": "Ebay.com", "start_ms": 2300, "end_ms": 2800},
                    {"text": "That", "start_ms": 2800, "end_ms": 3200},
                ],
            },
        ]

        manifest = generate_font_manifest(chunks=test_chunks, design_override={"seed": 42})
        for chunk in manifest.get("chunks", []):
            layers = chunk.get("layers", [])
            if len(layers) > 1:
                hero_layer = next((l for l in layers if l.get("isHero")), None)
                companion_layers = [l for l in layers if not l.get("isHero")]
                if hero_layer and companion_layers:
                    hero_sz = float(hero_layer.get("fontSizePx", 0))
                    max_comp_sz = max(float(l.get("fontSizePx", 0)) for l in companion_layers)
                    # Allow 1px rounding margin
                    self.assertGreaterEqual(
                        hero_sz,
                        (max_comp_sz * 1.618) - 1.5,
                        f"Hero size {hero_sz} must follow golden ratio >= companion {max_comp_sz} * 1.618",
                    )

    def test_preflight_and_fit_enforces_64px_floor(self):
        """Verify preflight_and_fit_layer_widths clamps to 64px floor."""
        layers = [
            {"isHero": False, "fontFamily": "Inter", "rawText": "A VERY LONG COMPANION LINE THAT OVERFLOWS", "fontSizePx": 70},
            {"isHero": True, "fontFamily": "Inter", "rawText": "HERO", "fontSizePx": 130},
        ]
        # Extremely narrow max_safe_width forces heavy shrinkage
        preflight_and_fit_layer_widths(layers, max_safe_width=200)

        companion = layers[0]
        self.assertGreaterEqual(
            float(companion["fontSizePx"]),
            64.0,
            "Companion layer must not shrink below 64px legibility floor",
        )


if __name__ == "__main__":
    unittest.main()
