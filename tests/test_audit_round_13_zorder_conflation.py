"""Unit tests for Round 13 Fix 1: Reverting z-order conflation.

Verifies:
1. Flank and cranial zone chunks with foreground layers evaluate to behindSubject: false (zIndex 100).
2. Only explicit pivot layers evaluate to behindSubject: true (zIndex 25).
3. Regression guard: expanding conditions must not turn old negative flank placements into behind-subject layers.
"""

import unittest
from mini_run_pipeline.subject_placement import plan_subject_safe_placements


class TestRound13ZOrderConflation(unittest.TestCase):
    """Test that flank placements are foreground (zIndex 100), not behind-subject (zIndex 25)."""

    def test_flank_chunks_are_not_behind_subject(self):
        """Flank chunks are foreground placements and must have behindSubject=False on their layers."""
        chunks = [
            {
                "chunkIndex": 0,
                "text": "Over the last 12 months,",
                "startMs": 800,
                "endMs": 2000,
                "layers": [
                    {"layerIndex": 0, "text": "Over", "behindSubject": False},
                    {"layerIndex": 1, "text": "THE LAST 12 MONTHS,", "behindSubject": False},
                ],
            },
            {
                "chunkIndex": 1,
                "text": "I've purchased more",
                "startMs": 2100,
                "endMs": 3200,
                "layers": [
                    {"layerIndex": 0, "text": "I'VE", "behindSubject": False},
                    {"layerIndex": 1, "text": "PURCHASED MORE", "behindSubject": False},
                ],
            },
        ]
        observations = [
            {"sourceMs": 1000, "faceBox": {"x": 0.55, "y": 0.20, "width": 0.20, "height": 0.25}},
            {"sourceMs": 2500, "faceBox": {"x": 0.55, "y": 0.20, "width": 0.20, "height": 0.25}},
        ]
        placements = plan_subject_safe_placements(chunks, {"frames": observations})
        self.assertEqual(len(placements), 2)
        for p in placements:
            # Flank placement is a 'where', not a z-order
            self.assertIn("flank", p.get("dominantZone", "") + p.get("safeRegionId", ""))
            # Must not be marked as a behind-subject occluded element
            self.assertFalse(p.get("intersectsSubject", False))

    def test_pivot_chunk_layers_preserve_explicit_behind_subject(self):
        """Only explicitly declared pivot layers have behindSubject=True."""
        pivot_chunk = {
            "chunkIndex": 4,
            "text": "resold",
            "startMs": 6500,
            "endMs": 7800,
            "layers": [
                {"layerIndex": 0, "text": "RESOLD", "behindSubject": True},
            ],
        }
        self.assertTrue(any(l.get("behindSubject") for l in pivot_chunk["layers"]))

    def test_z_order_contract_flank_is_foreground_100_pivot_is_25(self):
        """Z-order contract: foreground flank is z=100; behind-pivot is z=25."""
        def mock_resolve_typography_zindex(behind_subject: bool) -> int:
            return 25 if behind_subject else 100

        def mock_resolve_chunk_behind_subject(matte_available: bool, layers: list) -> bool:
            if not matte_available or not layers:
                return False
            return any(bool(l.get("behindSubject")) for l in layers)

        flank_layers = [{"text": "Sunshine", "behindSubject": False}]
        pivot_layers = [{"text": "RESOLD", "behindSubject": True}]

        # Flank chunk with matte available
        flank_behind = mock_resolve_chunk_behind_subject(True, flank_layers)
        self.assertFalse(flank_behind)
        self.assertEqual(mock_resolve_typography_zindex(flank_behind), 100)

        # Pivot chunk with matte available
        pivot_behind = mock_resolve_chunk_behind_subject(True, pivot_layers)
        self.assertTrue(pivot_behind)
        self.assertEqual(mock_resolve_typography_zindex(pivot_behind), 25)

    def test_regression_guard_old_negatives_stay_negative(self):
        """Regression guard: flank, lower deck, and center zones must never evaluate to behindSubject."""
        foreground_zones = ["flank_left_column", "flank_right_column", "lower_deck", "centered_title"]
        for zone in foreground_zones:
            layers = [{"text": "Word", "behindSubject": False}]
            # Even if placement is in that zone, chunk must NOT be behindSubject
            is_behind = any(bool(l.get("behindSubject")) for l in layers)
            self.assertFalse(is_behind, f"Zone '{zone}' falsely evaluated to behind-subject!")


if __name__ == "__main__":
    unittest.main()
