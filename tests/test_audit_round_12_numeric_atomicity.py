import unittest
from mini_run_pipeline.chunks import smart_chunk_words, TIME_AND_NUMERIC_UNITS
from mini_run_pipeline.typography import generate_font_manifest


class TestRound12NumericAtomicity(unittest.TestCase):
    """Test suite for Round 12 Fix 2: Compound Numeric Atomicity & Hero Tier Binding."""

    def test_prepositional_ramp_absorbs_numeric_compound(self):
        """Prepositional ramp 'Over the last' binds with '12 months' into a single chunk."""
        words = [
            {"text": "Over", "start_ms": 0, "end_ms": 200},
            {"text": "the", "start_ms": 210, "end_ms": 350},
            {"text": "last", "start_ms": 360, "end_ms": 600},
            {"text": "12", "start_ms": 620, "end_ms": 800},
            {"text": "months,", "start_ms": 810, "end_ms": 1200},
            {"text": "I've", "start_ms": 1220, "end_ms": 1400},
            {"text": "built", "start_ms": 1410, "end_ms": 1700},
        ]
        chunks = smart_chunk_words(words)
        self.assertGreaterEqual(len(chunks), 2)
        # First chunk should absorb "12 months" into the prepositional ramp
        self.assertIn("12 months", chunks[0]["text"])
        self.assertEqual(chunks[0]["text"], "Over the last 12 months,")

    def test_numeric_token_never_stranded_at_chunk_end(self):
        """Numeric token never ends a chunk if a unit follows in the utterance."""
        words = [
            {"text": "We", "start_ms": 0, "end_ms": 200},
            {"text": "hit", "start_ms": 210, "end_ms": 400},
            {"text": "6", "start_ms": 410, "end_ms": 600},
            {"text": "figures", "start_ms": 610, "end_ms": 900},
            {"text": "this", "start_ms": 910, "end_ms": 1100},
            {"text": "year", "start_ms": 1110, "end_ms": 1400},
        ]
        chunks = smart_chunk_words(words)
        for chunk in chunks:
            words_in_chunk = [w["text"] for w in chunk["words"]]
            # Chunk must not end with just "6"
            self.assertNotEqual(words_in_chunk[-1], "6")

    def test_lockup_allocation_never_isolates_number_on_modifier_layer(self):
        """In lockup treatments, numeric token is forced to hero tier with noun, never isolated on modifier."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "12 months, I've",
                "startMs": 0,
                "endMs": 1500,
                "words": [
                    {"text": "12", "start_ms": 0, "end_ms": 300},
                    {"text": "months,", "start_ms": 310, "end_ms": 800},
                    {"text": "I've", "start_ms": 810, "end_ms": 1200},
                ],
            }
        ]
        # Force lockup treatment via design_override
        manifest = generate_font_manifest(
            chunks,
            design_override={
                "seed": "lockup_test_seed",
                "avoidPresets": [],
            }
        )
        c0 = manifest["chunks"][0]
        layers = c0.get("layers", [])
        for layer in layers:
            raw_text = str(layer.get("rawText", "")).strip()
            role = str(layer.get("role", "")).lower()
            # "12" must NEVER be on a modifier layer alone
            if raw_text == "12":
                self.assertNotEqual(role, "modifier", "Numeric token '12' must not be isolated on modifier layer!")

    def test_30_seed_sweep_no_isolated_numeric_modifier(self):
        """30-seed sweep asserting zero isolated numeric modifier layers across layouts."""
        test_chunks = [
            {
                "chunkIndex": 1,
                "text": "12 months, I've",
                "startMs": 0,
                "endMs": 1500,
                "words": [
                    {"text": "12", "start_ms": 0, "end_ms": 300},
                    {"text": "months,", "start_ms": 310, "end_ms": 800},
                    {"text": "I've", "start_ms": 810, "end_ms": 1200},
                ],
            },
            {
                "chunkIndex": 2,
                "text": "12,000 physical products",
                "startMs": 1600,
                "endMs": 3100,
                "words": [
                    {"text": "12,000", "start_ms": 1600, "end_ms": 2000},
                    {"text": "physical", "start_ms": 2010, "end_ms": 2500},
                    {"text": "products", "start_ms": 2510, "end_ms": 3000},
                ],
            },
        ]
        for seed_idx in range(30):
            manifest = generate_font_manifest(
                test_chunks,
                design_override={"seed": f"numeric_atomicity_seed_{seed_idx}"}
            )
            for ch in manifest.get("chunks", []):
                for layer in ch.get("layers", []):
                    raw_text = str(layer.get("rawText", "")).strip()
                    role = str(layer.get("role", "")).lower()
                    if raw_text in ("12", "12,000", "6"):
                        self.assertNotEqual(
                            role,
                            "modifier",
                            f"Seed {seed_idx}: isolated numeric token '{raw_text}' found on modifier layer!"
                        )


if __name__ == "__main__":
    unittest.main()
