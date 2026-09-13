import json
import unittest
from pathlib import Path
from mini_run_pipeline.subject_placement import plan_subject_safe_placements

ROOT = Path(__file__).resolve().parent.parent
RECEIPT_PATH = ROOT / "output" / "gha_hakt_30s_pbd_1789257491_receipt.json"


class TestAuditRound16Commit2(unittest.TestCase):
    def test_layer_level_pivot_placement_assigns_deck_companion_and_cranial_pivot(self):
        """Pivot layer gets cranial placement, companion layer stays in deck zone."""
        chunk = {
            "chunkIndex": 3,
            "startMs": 2932,
            "endMs": 5563,
            "subjectLayering": {"behindSubject": True},
            "layers": [
                {"text": "THAN 12,000 PHYSICAL", "behindSubject": False, "isHero": False},
                {"text": "PRODUCTS", "behindSubject": True, "isHero": True},
            ],
        }
        observation = {
            "frames": [
                {"sourceMs": 3000, "headroomRatio": 0.18, "faceBottom": 0.52, "faceCenter": [0.5, 0.35]}
            ]
        }

        placements = plan_subject_safe_placements([chunk], observation)
        p = placements[0]

        # Chunk level placement is cranial
        self.assertEqual(p["dominantZone"], "cranial_crown")
        self.assertTrue(float(p["yPercent"].replace("%", "")) <= 25.0)

        # Layers get split placement:
        layers = chunk["layers"]
        companion = layers[0]
        pivot = layers[1]

        self.assertIn("placement", companion)
        self.assertEqual(companion["placement"]["dominantZone"], "foreground_lower_deck")
        self.assertEqual(companion["placement"]["yPercent"], "80%")

        self.assertIn("placement", pivot)
        self.assertEqual(pivot["placement"]["dominantZone"], "cranial_crown")
        self.assertTrue(float(pivot["placement"]["yPercent"].replace("%", "")) <= 25.0)

    def test_max_chunk_to_chunk_non_pivot_y_delta_bounded_at_15_percent(self):
        """Acceptance test: max chunk-to-chunk y-delta for non-pivot layers is <= 15.0%."""
        if not RECEIPT_PATH.exists():
            self.skipTest("Receipt not found")

        with open(RECEIPT_PATH, "r", encoding="utf-8") as f:
            receipt = json.load(f)

        chunks = receipt["chunks"]
        obs = receipt.get("subjectObservation")

        placements = plan_subject_safe_placements(chunks, obs)
        self.assertEqual(len(placements), len(chunks))

        prev_non_pivot_y = None
        max_delta = 0.0

        for c, p in zip(chunks, placements):
            layers = c.get("layers", [])
            for l in layers:
                is_pivot = bool(l.get("behindSubject"))
                if not is_pivot:
                    layer_p = l.get("placement") or p
                    if bool(c.get("subjectLayering", {}).get("behindSubject")) and not is_pivot:
                        layer_p = p.get("companionPlacement") or layer_p

                    y_str = layer_p.get("yPercent", "80%")
                    y_val = float(str(y_str).replace("%", ""))

                    if prev_non_pivot_y is not None:
                        dy = abs(y_val - prev_non_pivot_y)
                        if dy > max_delta:
                            max_delta = dy
                    prev_non_pivot_y = y_val

        self.assertLessEqual(
            max_delta,
            15.0,
            f"Max chunk-to-chunk non-pivot y-delta must be <= 15.0%, found {max_delta:.2f}%",
        )

    def test_pivot_alone_cranial_companion_stays_in_deck(self):
        """Chunks 3, 10, 18, 21 verify companion stays anchored in lower deck (>=75%) while pivot is cranial (<=25%)."""
        if not RECEIPT_PATH.exists():
            self.skipTest("Receipt not found")

        with open(RECEIPT_PATH, "r", encoding="utf-8") as f:
            receipt = json.load(f)

        chunks = receipt["chunks"]
        obs = receipt.get("subjectObservation")
        placements = plan_subject_safe_placements(chunks, obs)

        pivot_indices = [3, 10, 18, 21]
        for p_idx in pivot_indices:
            c = next(chk for chk in chunks if chk.get("chunkIndex") == p_idx)
            idx = chunks.index(c)
            p = placements[idx]

            pivot_layer = next(l for l in c["layers"] if l.get("behindSubject"))
            comp_layer = next(l for l in c["layers"] if not l.get("behindSubject"))

            comp_y = float(str(comp_layer["placement"]["yPercent"]).replace("%", ""))
            pivot_y = float(str(pivot_layer["placement"]["yPercent"]).replace("%", ""))

            self.assertGreaterEqual(
                comp_y,
                75.0,
                f"Chunk {p_idx} companion '{comp_layer.get('text')}' must stay in deck (y >= 75%), found {comp_y}%",
            )
            self.assertLessEqual(
                pivot_y,
                25.0,
                f"Chunk {p_idx} pivot '{pivot_layer.get('text')}' must be cranial (y <= 25%), found {pivot_y}%",
            )


if __name__ == "__main__":
    unittest.main()
