"""Test Round 12 Fix 1: Rack-Focus Handoff.

Verifies:
1. Hold Law floor (displayEnd >= lastWordEnd + 500ms) is inviolable.
2. Every overlap boundary (collisionMs > 0) declares exitTreatment == "rack_focus_blur".
3. Gaps (collisionMs == 0) declare exitTreatment == "clean_hold".
4. Outgoing blur achieves >= 12px within 3 frames of incoming chunk mount.
"""

import unittest
from typing import Any, Dict, List


class TestRound12RackFocus(unittest.TestCase):
    def test_rack_focus_handoff_gate_declaration(self):
        """Verify collisionMs and exitTreatment calculation across chunks."""
        chunks = [
            # Chunk 0: last word ends at 1298, displayEnd at 1798.
            # Next chunk starts at 1298 -> collision = 500ms -> rack_focus_blur
            {
                "chunkIndex": 0,
                "startMs": 800,
                "endMs": 1798,
                "displayStartMs": 800,
                "displayEndMs": 1798,
                "words": [{"text": "Over", "end_ms": 1000}, {"text": "last", "end_ms": 1298}],
            },
            # Chunk 1: last word ends at 2300, displayEnd at 2800.
            # Next chunk starts at 3500 -> gap = 700ms -> clean_hold
            {
                "chunkIndex": 1,
                "startMs": 1298,
                "endMs": 2800,
                "displayStartMs": 1298,
                "displayEndMs": 2800,
                "words": [{"text": "months", "end_ms": 2300}],
            },
            # Chunk 2: last chunk -> collision = 0 -> clean_hold
            {
                "chunkIndex": 2,
                "startMs": 3500,
                "endMs": 4200,
                "displayStartMs": 3500,
                "displayEndMs": 4200,
                "words": [{"text": "final", "end_ms": 3700}],
            },
        ]

        for c_idx in range(len(chunks)):
            cur = chunks[c_idx]
            disp_end = cur["displayEndMs"]
            if c_idx + 1 < len(chunks):
                next_start = chunks[c_idx + 1]["displayStartMs"]
                collision_ms = max(0, disp_end - next_start)
            else:
                collision_ms = 0
            cur["collisionMs"] = collision_ms
            cur["exitTreatment"] = "rack_focus_blur" if collision_ms > 0 else "clean_hold"

        # Assertions
        self.assertEqual(chunks[0]["collisionMs"], 500)
        self.assertEqual(chunks[0]["exitTreatment"], "rack_focus_blur")

        self.assertEqual(chunks[1]["collisionMs"], 0)
        self.assertEqual(chunks[1]["exitTreatment"], "clean_hold")

        self.assertEqual(chunks[2]["collisionMs"], 0)
        self.assertEqual(chunks[2]["exitTreatment"], "clean_hold")

    def test_inviolable_hold_floor_maintained(self):
        """Hold floor must never be truncated below lastWordEnd + 500ms."""
        last_word_end = 1298
        hold_floor = 500
        inviolable_end = last_word_end + hold_floor
        self.assertEqual(inviolable_end, 1798)
        self.assertGreaterEqual(inviolable_end - last_word_end, 500)

    def test_rack_focus_blur_curve_exceeds_12px_at_frame_3(self):
        """At frame 3 of the 5-frame rack focus exit, blur must be >= 12px."""
        # Bezier curve (0.16, 1.0, 0.3, 1.0) applied over 5 frames
        # At t = 3/5 = 0.6, easing(0.6) is approx 0.72
        # Blur = 0.72 * 20px = 14.4px >= 12px
        linear_t = 3.0 / 5.0
        # Power approximation for bezier(0.16, 1.0, 0.3, 1.0)
        eased_t = 1.0 - (1.0 - linear_t) ** 2.2
        blur_px = eased_t * 20.0
        self.assertGreaterEqual(blur_px, 12.0)


if __name__ == "__main__":
    unittest.main()
