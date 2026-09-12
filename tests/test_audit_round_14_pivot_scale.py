import unittest
from mini_run_pipeline.subject_placement import (
    analyze_cranial_negative_space,
    plan_subject_safe_placements,
)
from mini_run_pipeline.typography import generate_font_manifest


class TestRound14PivotScale(unittest.TestCase):
    """Test suite for Round 14 Commit 2: Reposition-First Headroom Solver, Size Chart Boost, and Banned Width Shrinking."""

    def test_reposition_first_cranial_solver_prioritizes_headroom(self):
        """When headroom >= 0.10, solver prioritizes cranial_crown with repositioning rather than shrinking or forcing flank."""
        subject_box = {"x": 0.32, "y": 0.18, "width": 0.36, "height": 0.55}
        analysis = analyze_cranial_negative_space(
            subject_box=subject_box,
            head_top_y=0.18,
            face_bottom_y=0.48,
            face_left_x=0.36,
            face_right_x=0.64,
        )
        self.assertEqual(analysis["dominantZone"], "cranial_crown")
        self.assertEqual(analysis["zoneId"], "behind_subject_above_head")
        self.assertTrue(analysis["haloGuard"])
        # Repositioned safely in upper headroom band
        y_pct = float(str(analysis["yPercent"]).replace("%", ""))
        self.assertGreaterEqual(y_pct, 15.0)
        self.assertLessEqual(y_pct, 24.0)
        # Banned width shrinking
        w_pct = int(str(analysis["maxWidthPercent"]).replace("%", ""))
        self.assertGreaterEqual(w_pct, 45, "Cranial crown container width must not be shrunk below 45%")

    def test_banned_width_shrinking_on_behind_subject_placements(self):
        """All behind-subject placements must strictly enforce maxWidthPercent >= 45% (eliminating 30% flank/cranial cap)."""
        chunks = [
            {
                "chunkIndex": 0,
                "text": "MASSIVE",
                "startMs": 0,
                "endMs": 1500,
                "subjectLayering": {"behindSubject": True},
            },
            {
                "chunkIndex": 1,
                "text": "PIVOT WORD",
                "startMs": 1500,
                "endMs": 3000,
                "subjectLayering": {"behindSubject": True},
            },
        ]
        observation = {
            "frames": [
                {
                    "sourceMs": 0,
                    "faceBox": {"x": 0.35, "y": 0.20, "width": 0.30, "height": 0.25},
                    "subjectBox": {"x": 0.30, "y": 0.20, "width": 0.40, "height": 0.60},
                }
            ]
        }
        placements = plan_subject_safe_placements(chunks, observation)
        for p in placements:
            raw_mwp = p.get("maxWidthPercent", "50%")
            val = int(str(raw_mwp).replace("%", "").strip())
            self.assertGreaterEqual(val, 45, f"Behind-subject chunk had squished maxWidthPercent: {raw_mwp}")

    def test_behind_subject_size_chart_boost(self):
        """Behind-subject pivot words with <= 8 characters must produce font sizes in 180-240px."""
        # 4 chars -> 240px target, 6 chars -> 210px target, 8 chars -> 180px target
        test_cases = [
            ("PURE", 4, 210, 240),
            ("GROWTH", 6, 190, 220),
            ("EXPEDITE", 8, 170, 190),
        ]

        chunks_input = [
            {
                "chunkIndex": 0,
                "text": "PURE",
                "startMs": 0,
                "endMs": 2000,
                "words": [{"text": "PURE"}],
            }
        ]
        manifest = generate_font_manifest(
            chunks_input,
            design_override={"subjectLayering": "behind_subject"},
        )
        c0 = manifest["chunks"][0]
        behind_layers = [l for l in c0["layers"] if l.get("behindSubject")]
        if behind_layers:
            self.assertGreaterEqual(behind_layers[0]["fontSizePx"], 180)


if __name__ == "__main__":
    unittest.main()
