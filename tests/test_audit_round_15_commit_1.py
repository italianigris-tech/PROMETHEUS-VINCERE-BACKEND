import json
from pathlib import Path
import unittest
from mini_run_pipeline.subject_placement import _clamp_safe_x_percent, plan_subject_safe_placements


class TestAuditRound15Commit1(unittest.TestCase):
    def test_clamp_safe_x_percent_width_aware(self):
        """Verify that _clamp_safe_x_percent clamps centers so text never bleeds past safe margins."""
        canvas_w = 1080.0
        safe_margin = 130.0

        # Case 1: 734px wide block requested at 32% (345.6px).
        # Unclamped left edge would be 345.6 - 367 = -21.4px (BLEED).
        # Clamped center must be >= 130 + 367 = 497px (46.0%), left edge >= 130px.
        clamped_str = _clamp_safe_x_percent("32.0%", est_width_px=734.0)
        clamped_val = float(clamped_str.replace("%", ""))
        clamped_px = (clamped_val / 100.0) * canvas_w
        half_w = 734.0 / 2.0
        self.assertGreaterEqual(clamped_px - half_w, safe_margin - 0.5, f"Left bleed: {clamped_px - half_w}")
        self.assertLessEqual(clamped_px + half_w, canvas_w - safe_margin + 0.5, f"Right bleed: {clamped_px + half_w}")

        # Case 2: 624px wide block requested at 32%.
        # Clamped center must be >= 130 + 312 = 442px (40.9%).
        clamped_str = _clamp_safe_x_percent("32.0%", est_width_px=624.0)
        clamped_val = float(clamped_str.replace("%", ""))
        clamped_px = (clamped_val / 100.0) * canvas_w
        half_w = 624.0 / 2.0
        self.assertGreaterEqual(clamped_px - half_w, safe_margin - 0.5)
        self.assertLessEqual(clamped_px + half_w, canvas_w - safe_margin + 0.5)

        # Case 3: 820px wide block (full safe envelope).
        # Clamped center must be exactly 540px (50.0%).
        clamped_str = _clamp_safe_x_percent("32.0%", est_width_px=820.0)
        self.assertEqual(clamped_str, "50.0%")
        clamped_px = 540.0
        self.assertEqual(clamped_px - 410.0, 130.0)
        self.assertEqual(clamped_px + 410.0, 950.0)

        # Case 4: Right-flank block requested at 80% with 600px width.
        # Half width = 300px. Max center = 950 - 300 = 650px (60.2%).
        clamped_str = _clamp_safe_x_percent("80.0%", est_width_px=600.0)
        clamped_val = float(clamped_str.replace("%", ""))
        clamped_px = (clamped_val / 100.0) * canvas_w
        self.assertLessEqual(clamped_px + 300.0, canvas_w - safe_margin + 0.5)

    def test_r14_recomputed_placements_zero_edge_bleed(self):
        """Verify that recomputing placements on R14 receipt chunks yields 0 safe region edge bleeds."""
        receipt_path = Path("output/gha_hakt_30s_r14_1789234228_receipt.json")
        if not receipt_path.exists():
            self.skipTest("R14 receipt not found")

        with open(receipt_path, "r", encoding="utf-8") as f:
            receipt = json.load(f)

        chunks = receipt.get("chunks", [])
        self.assertEqual(len(chunks), 25)

        # Mock observation to run plan_subject_safe_placements
        observation = {
            "frames": [
                {
                    "timestampMs": int(c.get("startMs", 0)),
                    "subjectBox": {"x": 0.35, "y": 0.20, "width": 0.30, "height": 0.50},
                    "faceLandmarks": {"forehead": [0.5, 0.22, 0.0], "chin": [0.5, 0.42, 0.0]},
                }
                for c in chunks
            ],
            "headBox": {"x": 0.35, "y": 0.20, "width": 0.30, "height": 0.25},
        }

        new_placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(len(new_placements), 25)

        canvas_w = 1080.0
        safe_margin = 130.0

        for i, (c, p) in enumerate(zip(chunks, new_placements)):
            layers = c.get("layers", [])
            max_layer_w = max(
                [float(l.get("estimatedWidthPx") or l.get("est_width") or 0.0) for l in layers],
                default=0.0,
            )
            effective_w = min(820.0, max_layer_w) if max_layer_w > 0 else 400.0

            x_pct_str = p.get("xPercent", "50%").replace("%", "")
            center_px = (float(x_pct_str) / 100.0) * canvas_w
            half_w = effective_w / 2.0
            left_px = center_px - half_w
            right_px = center_px + half_w

            left_clearance = left_px
            right_clearance = canvas_w - right_px

            self.assertGreaterEqual(
                left_clearance,
                safe_margin - 1.0,
                f"Chunk {i+1} ('{c.get('text')}') left clearance {left_clearance:.1f}px < {safe_margin}px "
                f"(xPercent={p.get('xPercent')}, effective_w={effective_w:.1f}px)",
            )
            self.assertGreaterEqual(
                right_clearance,
                safe_margin - 1.0,
                f"Chunk {i+1} ('{c.get('text')}') right clearance {right_clearance:.1f}px < {safe_margin}px "
                f"(xPercent={p.get('xPercent')}, effective_w={effective_w:.1f}px)",
            )


if __name__ == "__main__":
    unittest.main()
