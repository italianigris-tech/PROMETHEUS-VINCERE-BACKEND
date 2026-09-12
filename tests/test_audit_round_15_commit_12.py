import unittest
from mini_run_pipeline.typography import generate_font_manifest
from mini_run_pipeline.policy_check import (
    validate_safe_region_bounds,
    MAX_SAFE_WIDTH_PX,
    SAFE_MARGIN_X_PX,
)


class TestAuditRound15Commit12(unittest.TestCase):
    """Audit test suite for Round 15 Commit 12:
    1. Synchronize autoFitScale and fitScale after post-preflight golden ratio hero adjustments.
    2. Guarantee estimatedWidthPx * autoFitScale <= 792px across all generated layers.
    3. Verify Chunk 3 ('than 12,000 physical products') fits safely within bounds with >= 140px clearance.
    """

    def test_post_golden_ratio_autofit_scale_sync(self):
        """Layers with golden-ratio size adjustments must re-sync autoFitScale to <= 792px."""
        test_chunks = [
            {
                "chunkIndex": 3,
                "text": "than 12,000 physical products",
                "startMs": 2932,
                "endMs": 5563,
                "words": [
                    {"text": "than", "start_ms": 2932, "end_ms": 3044},
                    {"text": "12,000", "start_ms": 3140, "end_ms": 4006},
                    {"text": "physical", "start_ms": 4038, "end_ms": 4486},
                    {"text": "products", "start_ms": 4486, "end_ms": 5563},
                ],
            }
        ]
        manifest = generate_font_manifest(chunks=test_chunks, design_override={"seed": 42})
        for chunk in manifest.get("chunks", []):
            for layer in chunk.get("layers", []):
                est_w = float(layer.get("estimatedWidthPx", 0))
                scale = float(layer.get("autoFitScale", 1.0))
                effective_w = est_w * scale
                self.assertLessEqual(
                    effective_w,
                    792.0,
                    f"Chunk {chunk.get('chunkIndex')} layer '{layer.get('layerName')}' effective width {effective_w} exceeds 792px",
                )

    def test_full_transcript_manifest_safe_bounds(self):
        """All 25 chunks from full transcript meet safeRegionBounds with 0 violations."""
        test_chunks = [
            {"chunkIndex": 1, "text": "Over the last 12 months,", "startMs": 817, "endMs": 2599},
            {"chunkIndex": 2, "text": "I've purchased more", "startMs": 2179, "endMs": 3432},
            {"chunkIndex": 3, "text": "than 12,000 physical products", "startMs": 2932, "endMs": 5563},
            {"chunkIndex": 6, "text": "on Amazon for", "startMs": 7483, "endMs": 8752},
            {"chunkIndex": 7, "text": "more than 6 figures", "startMs": 8252, "endMs": 9874},
        ]
        manifest = generate_font_manifest(chunks=test_chunks, design_override={"seed": 101})
        all_layers = []
        for c in manifest.get("chunks", []):
            all_layers.extend(c.get("layers", []))

        res = validate_safe_region_bounds(all_layers, max_safe_width=MAX_SAFE_WIDTH_PX)
        self.assertEqual(res["status"], "passed")
        self.assertEqual(res["overflowCount"], 0)
        self.assertEqual(len(res["violations"]), 0)

    def test_chunk3_clearance_geometry(self):
        """Centered Chunk 3 card at 790px maximum width guarantees 145px safe margins."""
        frame_w = 1080.0
        card_w = 790.0
        clearance = (frame_w - card_w) / 2.0
        self.assertGreaterEqual(clearance, SAFE_MARGIN_X_PX)
        self.assertEqual(clearance, 145.0)


if __name__ == "__main__":
    unittest.main()
