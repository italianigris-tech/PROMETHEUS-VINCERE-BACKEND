import unittest
from pathlib import Path
from mini_run_pipeline.typography import schedule_caption_timing, INTRINSIC_ANIMATION_DURATIONS_MS


class TestRound14EntranceCurves(unittest.TestCase):
    """Test suite for Round 14 Commit 4: Intrinsic Animation Durations and Eased Entrance Curves."""

    def test_intrinsic_durations_and_curves_in_tsx(self):
        """Assert PrometheusMinRun.tsx binds entrance durations to INTRINSIC_ANIMATION_DURATIONS_MS with cubic bezier easing."""
        tsx_path = Path(__file__).resolve().parent.parent / "remotion-app" / "src" / "compositions" / "PrometheusMinRun.tsx"
        self.assertTrue(tsx_path.exists(), f"PrometheusMinRun.tsx not found at {tsx_path}")

        content = tsx_path.read_text(encoding="utf-8")

        # 1. Assert exports exist
        self.assertIn("export const INTRINSIC_ANIMATION_DURATIONS_MS", content)
        self.assertIn("export const resolveEntranceDurationFrames", content)
        self.assertIn("export const resolveChunkEntranceFrame", content)

        # 2. Assert cubic bezier easing is bound to chunk entrance
        self.assertIn("Easing.bezier(0.16, 1.0, 0.3, 1.0)", content)

        # 3. Assert chunkEntrance passes fxPreset and fps
        self.assertIn("resolveChunkEntranceFrame(contentStartFrame, totalFrames, lastWordStartFrame, chunk.fxPreset, fps)", content)

    def test_hold_law_preserves_minimum_500ms_hold(self):
        """Hold Law in schedule_caption_timing strictly preserves at least 500ms hold floor."""
        chunks = [
            {
                "chunkIndex": 0,
                "startMs": 0,
                "endMs": 1000,
                "words": [{"text": "Hello", "start_ms": 0, "end_ms": 800}],
                "fxPreset": "cinematic_viewport_mask_sweep",
            },
            {
                "chunkIndex": 1,
                "startMs": 1500,
                "endMs": 2500,
                "words": [{"text": "World", "start_ms": 1500, "end_ms": 2300}],
                "fxPreset": "kinetic_impact_snap",
            },
        ]
        scheduled = schedule_caption_timing(chunks)
        c0 = scheduled[0]
        # Content ends at 800ms. Floor must be at least 800 + 500 = 1300ms
        self.assertGreaterEqual(c0["displayEndMs"], 1300)
        self.assertGreaterEqual(c0["displayEndMs"] - 800, 500)


if __name__ == "__main__":
    unittest.main()
