import unittest
from mini_run_pipeline.listicles import detect_and_plan_listicles


class TestRound7ListicleGuard(unittest.TestCase):
    """Verifies that temporal and metric units prevent false listicle detection (e.g. STEP 12)."""

    def test_chunk_1_12_months_suppressed(self):
        """Chunk 1 with '12 months, I\\'ve' (dict words with 'text' key) must not trigger STEP 12."""
        chunk = {
            "chunkIndex": 1,
            "text": "12 months, I've",
            "words": [
                {"text": "12", "startMs": 1298, "endMs": 1400},
                {"text": "months,", "startMs": 1400, "endMs": 2035},
                {"text": "I've", "startMs": 2035, "endMs": 2322},
            ],
            "startMs": 1298,
            "endMs": 2322,
        }
        res = detect_and_plan_listicles([chunk])
        self.assertEqual(res["listicleCount"], 0)
        self.assertIsNone(res["plans"].get(0))

    def test_asr_confusion_modes_suppressed(self):
        """Phonetic ASR confusions like 'modes' or 'moths' must also trigger temporal suppression."""
        chunk = {
            "chunkIndex": 0,
            "text": "12 modes, I've",
            "words": [
                {"text": "12"},
                {"text": "modes,"},
                {"text": "I've"},
            ],
        }
        res = detect_and_plan_listicles([chunk])
        self.assertEqual(res["listicleCount"], 0)
        self.assertIsNone(res["plans"].get(0))

    def test_words_missing_fallback_to_raw_text(self):
        """When words dict is empty or missing, raw_text fallback must suppress temporal units."""
        chunk = {
            "chunkIndex": 0,
            "text": "12 months, I've",
            "words": [],
        }
        res = detect_and_plan_listicles([chunk])
        self.assertEqual(res["listicleCount"], 0)
        self.assertIsNone(res["plans"].get(0))

    def test_cross_chunk_temporal_lookahead(self):
        """When a bare number ends a chunk and the next chunk begins with a temporal unit, suppress."""
        chunks = [
            {"chunkIndex": 0, "text": "Over the last 12", "words": [{"text": "Over"}, {"text": "the"}, {"text": "last"}, {"text": "12"}]},
            {"chunkIndex": 1, "text": "months, I've", "words": [{"text": "months,"}, {"text": "I've"}]},
        ]
        res = detect_and_plan_listicles(chunks)
        self.assertEqual(res["listicleCount"], 0)
        self.assertIsNone(res["plans"].get(0))

    def test_legitimate_step_item_preserved(self):
        """Explicit step/tip items must continue to be detected normally."""
        chunk = {
            "chunkIndex": 0,
            "text": "Step 1: Get started",
            "words": [{"text": "Step"}, {"text": "1:"}, {"text": "Get"}, {"text": "started"}],
        }
        res = detect_and_plan_listicles([chunk])
        self.assertIsNotNone(res["plans"].get(0))
        plan = res["plans"][0]
        self.assertTrue(plan["isListicle"])
        self.assertEqual(plan["itemNumber"], 1)
        self.assertEqual(plan["badgeText"], "STEP 01")


if __name__ == "__main__":
    unittest.main()
