"""Audit test for Round 13 Addendum Item 1: Narrative-beat song handoff trigger.
Verifies that:
1. For clips >= 20s, a second track handoff is triggered at a narrative beat boundary.
2. The transition gate is recorded as 'narrative_beat_transition'.
3. Crossfade and compatibility score are computed.
4. For short clips (< 20s), single track behavior is preserved.
"""

import json
import os
import unittest
from pathlib import Path

from mini_run_pipeline.song_program import plan_song_program, load_song_catalog

RECEIPT_PATH = Path(os.path.expanduser("~")) / ".gemini" / "antigravity-cli" / "brain" / "8ec47dcb-d657-40d5-8c1c-7270878d6444" / "r12_receipt.json"


class TestRound13NarrativeSongHandoff(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = load_song_catalog()
        if RECEIPT_PATH.exists():
            with open(RECEIPT_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            cls.chunks = data.get("chunks", [])
        else:
            cls.chunks = [
                {"chunkIndex": i, "startMs": i * 1200, "endMs": i * 1200 + 1100, "text": f"Word chunk {i}"}
                for i in range(25)
            ]

    def test_clips_ge_20s_trigger_narrative_beat_handoff(self):
        """A 30s clip must trigger a narrative beat handoff resulting in >= 2 tracks and 1 transition."""
        sp = plan_song_program(catalog=self.catalog, chunks=self.chunks, duration_ms=30000)
        events = sp.get("events", [])
        transitions = sp.get("transitions", [])

        self.assertGreaterEqual(len(events), 2, "Clips >= 20s must have at least 2 song events")
        self.assertGreaterEqual(len(transitions), 1, "Clips >= 20s must have at least 1 transition")

        first_trans = transitions[0]
        self.assertEqual(
            first_trans.get("cause", {}).get("gate"),
            "narrative_beat_transition",
            "Transition cause gate must be 'narrative_beat_transition'",
        )
        self.assertGreater(first_trans.get("durationMs", 0), 0, "Transition must have non-zero crossfade")
        self.assertIn("compatibilityScore", first_trans)

    def test_clips_lt_20s_preserve_single_track(self):
        """Clips < 20s must remain on a single track without spurious cuts."""
        sp = plan_song_program(catalog=self.catalog, chunks=self.chunks[:5], duration_ms=12000)
        events = sp.get("events", [])
        transitions = sp.get("transitions", [])

        self.assertEqual(len(events), 1, "Clips < 20s must use a single track")
        self.assertEqual(len(transitions), 0, "Clips < 20s must have 0 transitions")


if __name__ == "__main__":
    unittest.main()
