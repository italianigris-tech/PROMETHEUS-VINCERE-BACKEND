"""Test Round 11 Fix 1: The Hold Law and Chunk Boundary Integrity.

Verifies:
1. Floor invariant: displayEndMs >= lastWordEndMs + max(500, intrinsic - elapsed).
2. Elimination of truncating next_start - 80 clamp during dense speech.
3. 0 negative holds across 30 seeds in generate_font_manifest.
4. Chunk boundary rounding: chunk.endMs >= max(word.end_ms) for all chunks.
"""

from __future__ import annotations

import unittest
from typing import Any, Dict, List

from mini_run_pipeline import chunks, typography


class TestRound11HoldLaw(unittest.TestCase):
    def test_chunk_boundary_rounding_with_timestamp_map(self) -> None:
        """Verify that sub_chunk['endMs'] is never less than any word's end_ms."""
        words = [
            {"text": "Over", "start_ms": 100, "end_ms": 300},
            {"text": "the", "start_ms": 310, "end_ms": 450},
            {"text": "last", "start_ms": 460, "end_ms": 780},
        ]
        timestamp_map = [
            {"sourceStartMs": 0, "sourceEndMs": 1000, "outputStartMs": 0, "outputEndMs": 1000, "mode": "keep"}
        ]
        result = chunks.smart_chunk_words(words, timestamp_map=timestamp_map)
        self.assertGreater(len(result), 0)
        for chunk in result:
            chunk_words = chunk.get("words", [])
            if chunk_words:
                max_w_end = max(int(w.get("end_ms", 0)) for w in chunk_words)
                self.assertGreaterEqual(
                    chunk["endMs"],
                    max_w_end,
                    f"Chunk endMs {chunk['endMs']} must be >= last word end_ms {max_w_end}",
                )
                self.assertGreaterEqual(
                    chunk["outputEndMs"],
                    max_w_end,
                    f"Chunk outputEndMs {chunk['outputEndMs']} must be >= last word end_ms {max_w_end}",
                )

    def test_dense_speech_inviolable_floor_override(self) -> None:
        """Verify that in dense speech (next_start == last_word_end), the hold floor is NOT clamped."""
        dense_chunks = [
            {
                "chunkIndex": 1,
                "text": "First dense phrase",
                "startMs": 0,
                "endMs": 1000,
                "words": [
                    {"text": "First", "start_ms": 0, "end_ms": 300},
                    {"text": "dense", "start_ms": 320, "end_ms": 650},
                    {"text": "phrase", "start_ms": 670, "end_ms": 1000},
                ],
                "fxPreset": "kinetic_impact_snap",
            },
            {
                "chunkIndex": 2,
                "text": "Second phrase begins immediately",
                "startMs": 1000,  # 0ms gap
                "endMs": 2200,
                "words": [
                    {"text": "Second", "start_ms": 1000, "end_ms": 1300},
                    {"text": "phrase", "start_ms": 1320, "end_ms": 1600},
                    {"text": "begins", "start_ms": 1620, "end_ms": 1900},
                    {"text": "immediately", "start_ms": 1920, "end_ms": 2200},
                ],
                "fxPreset": "kinetic_impact_snap",
            },
        ]

        scheduled = typography.schedule_caption_timing(dense_chunks)
        self.assertEqual(len(scheduled), 2)
        chunk1 = scheduled[0]
        chunk2 = scheduled[1]

        # Chunk 1 last word ends at 1000ms. Inviolable floor is 1000 + 500 = 1500ms.
        # It must NOT be clamped to 1000 - 80 = 920ms.
        self.assertGreaterEqual(
            chunk1["displayEndMs"],
            1500,
            f"Chunk 1 displayEndMs {chunk1['displayEndMs']} violated the 500ms hold floor",
        )
        self.assertTrue(
            chunk1.get("acceleratedExit"),
            "Chunk 1 must flag acceleratedExit when hold extends past next chunk's soft margin",
        )
        # Chunk 2 should start at its speech onset (1000ms), not be pushed to 1500ms
        self.assertEqual(
            chunk2["displayStartMs"],
            1000,
            "Chunk 2 displayStartMs must enter at speech onset, compressing lead-in during overlap",
        )

    def test_zero_negative_holds_across_30_seeds(self) -> None:
        """Across 30 seeds, every single chunk must satisfy displayEndMs >= lastWordEndMs + 500ms."""
        sample_script = [
            "Over the last twelve months,",
            "I built an empire",
            "from my laptop.",
            "Not because I was smarter,",
            "or worked twenty hours a day.",
            "I found products people wanted,",
            "and sold them directly.",
            "No warehouse,",
            "no inventory risk,",
            "just clean margins.",
        ]
        base_chunks = []
        curr_time = 500
        for idx, text in enumerate(sample_script):
            words = text.split()
            w_objs = []
            for w in words:
                w_start = curr_time
                w_end = w_start + 280
                w_objs.append({"text": w, "start_ms": w_start, "end_ms": w_end})
                curr_time = w_end + 30
            base_chunks.append({
                "chunkIndex": idx + 1,
                "text": text,
                "startMs": w_objs[0]["start_ms"],
                "endMs": w_objs[-1]["end_ms"],
                "outputStartMs": w_objs[0]["start_ms"],
                "outputEndMs": w_objs[-1]["end_ms"],
                "words": w_objs,
            })
            curr_time += 60

        for seed_idx in range(30):
            seed = f"round-11-hold-law-seed-{seed_idx}"
            manifest = typography.generate_font_manifest(base_chunks, {"seed": seed})
            m_chunks = manifest.get("chunks", [])
            self.assertEqual(len(m_chunks), len(base_chunks))

            for c in m_chunks:
                c_words = c.get("words", [])
                last_w_end = max((int(w.get("end_ms", 0)) for w in c_words), default=c.get("endMs", 0))
                disp_end = int(c.get("displayEndMs", 0))
                hold = disp_end - last_w_end

                self.assertGreaterEqual(
                    hold,
                    500,
                    f"Seed {seed} chunk {c.get('chunkIndex')} hold {hold}ms < 500ms floor "
                    f"(dispEnd={disp_end}, lastWordEnd={last_w_end})",
                )


if __name__ == "__main__":
    unittest.main()
