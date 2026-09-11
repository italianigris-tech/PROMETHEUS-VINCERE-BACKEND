"""Snapshot regression test verifying Item 1: Chunker 3/5 + Unit Binding against the real akimbo transcript."""

import json
import unittest
from pathlib import Path

from mini_run_pipeline import chunks, silence


class TestChunkerSnapshot(unittest.TestCase):
    def setUp(self):
        transcript_path = Path("docs/mini_run_studio/akimbo_assemblyai_raw.json")
        self.assertTrue(transcript_path.exists(), "akimbo_assemblyai_raw.json must exist")
        data = json.loads(transcript_path.read_text(encoding="utf-8"))
        self.words = data["words"][:87]  # 30-second snippet (87 words)

    def test_akimbo_chunking_snapshot_and_invariants(self):
        """Verify chunker invariants against the real akimbo transcript:
        1. Target 3-5 words per chunk.
        2. No 1-word hanging orphans.
        3. Numbers never separate from their following token (unit binding).
        4. Phrase integrity for:
           - '12,000 physical products'
           - 'figures in Pure profit.'
           - 'dream come true, right?'
           - '12 months'
        """
        produced_chunks = chunks.smart_chunk_words(self.words)
        self.assertGreater(len(produced_chunks), 15, "Should produce realistic cadence chunks")

        # Invariant 1 & 2: Word counts and orphan check
        for i, c in enumerate(produced_chunks):
            w_list = c.get("words", [])
            w_count = len(w_list)
            # Standalone 1-word chunk is only allowed if it was an explicit single-word sentence
            if w_count == 1:
                t = str(w_list[0].get("text", "")).strip()
                self.assertTrue(
                    t.endswith((".", "!", "?")),
                    f"Chunk {i} has 1 word ({t!r}) without being a terminal sentence"
                )
            self.assertLessEqual(w_count, 5, f"Chunk {i} exceeded max 5 words: {c.get('text')}")

        # Invariant 3: Unit binding - numbers never separate from their following token
        for i, c in enumerate(produced_chunks[:-1]):
            last_word = str(c["words"][-1].get("text", "")).strip()
            cleaned = last_word.rstrip(".,!?:;—%").replace(",", "")
            self.assertFalse(
                any(ch.isdigit() for ch in cleaned),
                f"Chunk {i} ({c['text']!r}) ends on a number; severed from following unit token!"
            )

        # Invariant 4: Phrase integrity
        chunk_texts = [c.get("text", "") for c in produced_chunks]

        # 4a. '12' bound with 'months'
        c_12_months = next((t for t in chunk_texts if "12" in t and "months" in t), None)
        self.assertIsNotNone(c_12_months, f"Expected '12' and 'months' in same chunk. Chunks: {chunk_texts[:4]}")

        # 4b. '12,000 physical products'
        c_12k_products = next((t for t in chunk_texts if "12,000" in t and "physical products" in t), None)
        self.assertIsNotNone(c_12k_products, f"Expected '12,000 physical products' intact. Chunks: {chunk_texts[2:6]}")

        # 4c. 'figures in Pure profit.'
        c_profit = next((t for t in chunk_texts if "figures in" in t and "profit" in t.lower()), None)
        self.assertIsNotNone(c_profit, f"Expected 'figures in Pure profit.' intact. Chunks: {chunk_texts[6:12]}")

        # 4d. 'dream come true, right?'
        c_dream = next((t for t in chunk_texts if "dream come true" in t), None)
        self.assertIsNotNone(c_dream, f"Expected 'dream come true, right?' intact. Chunks: {chunk_texts[15:22]}")


if __name__ == "__main__":
    unittest.main()
