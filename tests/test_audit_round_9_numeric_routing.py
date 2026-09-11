import unittest
from mini_run_pipeline.typography import generate_font_manifest, SemanticConceptLedger


class TestRound9NumericRouting(unittest.TestCase):
    """Verifies that hasNumber + can_claim_counter hard-binds chunks to the counter family (no lottery)."""

    def test_unclaimed_number_always_routes_to_counter_across_30_seeds(self):
        """Chunks with valid countable numbers must 100% route to counter family across all seeds."""
        chunks_input = [
            {
                "chunkIndex": 0,
                "text": "Over the last 12 months",
                "startMs": 0,
                "endMs": 1400,
                "words": [{"text": "Over"}, {"text": "the"}, {"text": "last"}, {"text": "12"}, {"text": "months"}],
            },
            {
                "chunkIndex": 1,
                "text": "12,000 physical products",
                "startMs": 1400,
                "endMs": 3000,
                "words": [{"text": "12,000"}, {"text": "physical"}, {"text": "products"}],
            },
            {
                "chunkIndex": 2,
                "text": "generating multiple 6 figures",
                "startMs": 3000,
                "endMs": 4800,
                "words": [{"text": "generating"}, {"text": "multiple"}, {"text": "6"}, {"text": "figures"}],
            },
        ]

        counter_presets = {"metallic_chrome_counter", "metallic_chrome_countup_hero"}

        for seed in range(30):
            manifest = generate_font_manifest(chunks_input, design_override={"seed": seed, "creativity": "expressive"})
            chunks = manifest.get("chunks", [])
            self.assertEqual(len(chunks), 3)

            # Chunk 1 ("12,000 physical products") MUST be a counter preset across all seeds
            c1_fx = chunks[1].get("fxPreset")
            c1_layers = chunks[1].get("rendered_layers") or chunks[1].get("layers") or []
            c1_layer_fxs = {l.get("fxPreset") for l in c1_layers}
            self.assertTrue(
                c1_fx in counter_presets or any(fx in counter_presets for fx in c1_layer_fxs),
                f"Seed {seed}: Chunk 1 ('12,000 physical products') got '{c1_fx}', expected counter preset in {counter_presets}",
            )

            # Chunk 0 ("Over the last 12 months") is temporal ('months' suppressed) -> must NOT be bound to counter
            c0_fx = chunks[0].get("fxPreset")
            self.assertNotIn(
                c0_fx,
                counter_presets,
                f"Seed {seed}: Chunk 0 ('Over the last 12 months') unexpectedly routed to counter: '{c0_fx}'",
            )

    def test_semantic_ledger_can_claim_counter(self):
        """Ledger must validate that '12,000' can claim counter while '12 months' cannot."""
        ledger = SemanticConceptLedger()
        self.assertFalse(ledger.can_claim_counter(0, "Over the last 12 months"))
        self.assertTrue(ledger.can_claim_counter(1, "12,000 physical products"))


if __name__ == "__main__":
    unittest.main()
