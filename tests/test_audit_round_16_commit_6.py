import unittest
import numpy as np
from mini_run_pipeline.policy_check import validate_line_count_and_wrap


class TestAuditRound16Commit6(unittest.TestCase):
    """Verifies Round 16 Commit 6: Refined pixel-truth wrap violation threshold.
    - Permits valid 2-row wrapping for single-line companion decks.
    - Enforces strict 2-visual-row cap on companion decks (flags >=3 rows).
    - Enforces 1-visual-row cap on single-word hero layers.
    - Enforces 2-visual-row card limit on combined hero+companion stacks (Sunday Best defect).
    """

    def test_companion_deck_2_row_wrap_passes(self):
        """Proves that a single-line companion wrapping into 2 rows is accepted as valid typography."""
        chunk = {
            "chunkIndex": 24,
            "startMs": 26873,
            "endMs": 29136,
            "placement": {
                "xPercent": "50%",
                "yPercent": "80%",
                "maxWidthPercent": "85%",
                "dominantZone": "foreground_lower_deck",
            },
            "layers": [
                {
                    "layerIndex": 0,
                    "role": "modifier",
                    "isHero": False,
                    "rawText": "sunshine and",
                    "fontSizePx": 84,
                    "behindSubject": False,
                },
                {
                    "layerIndex": 1,
                    "role": "primary_focus_word",
                    "isHero": True,
                    "rawText": "rainbows.",
                    "fontSizePx": 150,
                    "behindSubject": True,
                },
            ],
        }
        layers = chunk["layers"]

        # Companion deck renders 2 rows ("sunshine" / "and") within y in [1460, 1620]
        frame = np.zeros((1920, 1080, 3), dtype=np.uint8)
        frame[1480:1525, 300:700] = 255  # Row 1: sunshine
        frame[1555:1600, 320:650] = 255  # Row 2: and

        frames = [{"timestampSec": 28.0, "framePath": frame}]
        res = validate_line_count_and_wrap(layers, chunks=[chunk], frames=frames)

        self.assertEqual(res["status"], "passed")
        self.assertEqual(len(res["violations"]), 0)
        self.assertEqual(res["pixelTruth"]["wrapInducedRowsDetected"], 1)
        meas = res["pixelTruth"]["measurements"][0]
        self.assertEqual(meas["manifestLines"], 1)
        self.assertEqual(meas["pixelTruthRows"], 2)
        self.assertTrue(meas["wrapInduced"])

    def test_companion_deck_3_row_wrap_fails(self):
        """Proves that a companion deck wrapping into 3 rows exceeds the 2-row cap and fails."""
        chunk = {
            "chunkIndex": 24,
            "startMs": 26873,
            "endMs": 29136,
            "placement": {
                "xPercent": "50%",
                "yPercent": "80%",
                "maxWidthPercent": "85%",
                "dominantZone": "foreground_lower_deck",
            },
            "layers": [
                {
                    "layerIndex": 0,
                    "role": "modifier",
                    "isHero": False,
                    "rawText": "sunshine and rainbows and more",
                    "fontSizePx": 84,
                    "behindSubject": False,
                },
            ],
        }
        layers = chunk["layers"]

        # Companion deck renders 3 rows
        frame = np.zeros((1920, 1080, 3), dtype=np.uint8)
        frame[1450:1490, 300:700] = 255  # Row 1
        frame[1515:1555, 300:700] = 255  # Row 2
        frame[1580:1620, 300:700] = 255  # Row 3

        frames = [{"timestampSec": 28.0, "framePath": frame}]
        res = validate_line_count_and_wrap(layers, chunks=[chunk], frames=frames)

        self.assertEqual(res["status"], "failed")
        self.assertTrue(any("companion deck exceeds 2 visual rows via wrap" in v for v in res["violations"]))

    def test_hero_layer_multi_row_wrap_fails(self):
        """Proves that a single-word hero wrapping into 2 rows fails immediately."""
        chunk = {
            "chunkIndex": 5,
            "startMs": 5000,
            "endMs": 6000,
            "placement": {
                "xPercent": "50%",
                "yPercent": "50%",
                "maxWidthPercent": "85%",
                "dominantZone": "center_fullscreen",
            },
            "layers": [
                {
                    "layerIndex": 0,
                    "role": "hero",
                    "isHero": True,
                    "rawText": "UNSTOPPABLE",
                    "fontSizePx": 200,
                    "behindSubject": False,
                },
            ],
        }
        layers = chunk["layers"]

        # Hero split into 2 rows
        frame = np.zeros((1920, 1080, 3), dtype=np.uint8)
        frame[900:960, 200:800] = 255
        frame[980:1040, 200:800] = 255

        frames = [{"timestampSec": 5.5, "framePath": frame}]
        res = validate_line_count_and_wrap(layers, chunks=[chunk], frames=frames)

        self.assertEqual(res["status"], "failed")
        self.assertTrue(any("hero layer wrapped into multiple visual rows" in v for v in res["violations"]))


if __name__ == "__main__":
    unittest.main()
