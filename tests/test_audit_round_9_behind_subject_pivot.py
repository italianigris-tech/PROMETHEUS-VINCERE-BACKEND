import unittest
from mini_run_pipeline.typography import generate_font_manifest


class TestRound9BehindSubjectPivot(unittest.TestCase):
    """Verifies that multi-word chunks admit a single pivot word behind-subject while companions stay foreground."""

    def test_multi_word_chunks_admit_behind_subject_pivot_without_starvation(self):
        """When all chunks have 3-5 words, behind-subject depth must not be starved to 0."""
        # 30-second dialogue where all chunks have 3-5 words (the exact scenario from Round 8)
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

        for seed in range(30):
            design = dict(design_override, seed=seed)
            manifest = generate_font_manifest(chunks_input, design_override=design)
            chunks = manifest.get("chunks", [])

            behind_chunks = [c for c in chunks if c.get("subjectLayering", {}).get("behindSubject")]
            self.assertGreater(
                len(behind_chunks),
                0,
                f"Seed {seed}: Behind-subject moments starved to 0 across 5 multi-word chunks!",
            )

            for bc in behind_chunks:
                layers = bc.get("layers", [])
                behind_layers = [l for l in layers if l.get("behindSubject")]
                fg_layers = [l for l in layers if not l.get("behindSubject")]

                # The behind-subject layer must be a single pivot word (not a full 3-5 word phrase)
                for bl in behind_layers:
                    bl_words = bl.get("rawText", "").split()
                    self.assertLessEqual(
                        len(bl_words),
                        2,
                        f"Seed {seed}, Chunk {bc.get('chunkIndex')}: multi-word phrase '{bl.get('rawText')}' illegally placed behind subject!",
                    )

                # In multi-layer chunks, companion layers must stay in foreground
                if len(layers) > 1:
                    self.assertGreater(
                        len(fg_layers),
                        0,
                        f"Seed {seed}, Chunk {bc.get('chunkIndex')}: All layers placed behind subject; companion must stay foreground!",
                    )


if __name__ == "__main__":
    unittest.main()
