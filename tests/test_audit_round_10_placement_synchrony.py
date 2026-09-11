import unittest
from mini_run_pipeline.typography import _layout_rules_placement
from mini_run_pipeline.subject_placement import plan_subject_safe_placements


class TestRound10PlacementSynchrony(unittest.TestCase):
    """Verifies Round 10 Fix 6:
    - _layout_rules_placement assigns 32%/left for left alignment, 68%/right for right.
    - plan_subject_safe_placements honors font_json flank coordinates when flank clearance >= 0.22.
    - Inter-chunk hysteresis maintains column anchor across adjacent chunks and clamps vertical
      delta to <= 5% (e.g. ±0.03) instead of jumping 13% across coordinates.
    """

    def test_layout_rules_placement_assigns_flank_coordinates(self):
        left_prof = {"layout_rules": {"horizontal_alignment": "left", "max_width_percent": 40}}
        left_res = _layout_rules_placement(left_prof)
        self.assertEqual(left_res["xPercent"], "32%")
        self.assertEqual(left_res["anchor"], "left")
        self.assertEqual(left_res["textAlign"], "left")
        self.assertEqual(left_res["dominantZone"], "flank_left_column")

        right_prof = {"layout_rules": {"horizontal_alignment": "right", "max_width_percent": 35}}
        right_res = _layout_rules_placement(right_prof)
        self.assertEqual(right_res["xPercent"], "68%")
        self.assertEqual(right_res["anchor"], "right")
        self.assertEqual(right_res["textAlign"], "right")
        self.assertEqual(right_res["dominantZone"], "flank_right_column")

        center_prof = {"layout_rules": {"horizontal_alignment": "center", "max_width_percent": 85}}
        center_res = _layout_rules_placement(center_prof)
        self.assertEqual(center_res["xPercent"], "50%")
        self.assertEqual(center_res["anchor"], "center")
        self.assertEqual(center_res["textAlign"], "center")
        self.assertEqual(center_res["dominantZone"], "foreground_lower_deck")

    def test_plan_subject_safe_placements_honors_font_json_flank(self):
        observation = {
            "summary": {
                "headroomRatio": 0.20,
                "faceBottom": 0.45,
                "flankLeftRatio": 0.28,
                "flankRightRatio": 0.28,
            },
            "frames": [],
        }

        chunks = [
            {
                "startMs": 0,
                "endMs": 1000,
                "text": "Left Column Headline",
                "placement": {
                    "layoutSource": "font_json_layout_rules",
                    "dominantZone": "flank_left_column",
                    "xPercent": "32%",
                    "anchor": "left",
                    "textAlign": "left",
                },
            }
        ]

        placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(len(placements), 1)
        p = placements[0]
        self.assertEqual(p["dominantZone"], "flank_left_column")
        self.assertEqual(p["xPercent"], "32%")
        self.assertEqual(p["anchor"], "left")
        self.assertEqual(p["textAlign"], "left")

    def test_inter_chunk_hysteresis_maintains_column_and_clamps_vertical_delta(self):
        observation = {
            "summary": {
                "headroomRatio": 0.20,
                "faceBottom": 0.45,
                "flankLeftRatio": 0.28,
                "flankRightRatio": 0.28,
            },
            "frames": [],
        }

        # Chunk 0 sets up left flank via font_json
        # Chunk 1 has no font_json (default/center profile)
        # Chunk 2 has no font_json (default/center profile)
        chunks = [
            {
                "startMs": 0,
                "endMs": 1200,
                "text": "First Left Chunk",
                "placement": {
                    "layoutSource": "font_json_layout_rules",
                    "dominantZone": "flank_left_column",
                    "xPercent": "32%",
                    "anchor": "left",
                    "textAlign": "left",
                },
            },
            {
                "startMs": 1200,
                "endMs": 2400,
                "text": "Second Follow-up Chunk",
            },
            {
                "startMs": 2400,
                "endMs": 3600,
                "text": "Third Follow-up Chunk",
            },
        ]

        placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(len(placements), 3)

        for idx, p in enumerate(placements):
            self.assertEqual(
                p["dominantZone"],
                "flank_left_column",
                f"Chunk {idx} should maintain flank_left_column via hysteresis",
            )
            self.assertEqual(p["xPercent"], "32%", f"Chunk {idx} should maintain 32% X coordinate")
            self.assertEqual(p["anchor"], "left", f"Chunk {idx} should maintain left anchor")
            self.assertEqual(p["textAlign"], "left", f"Chunk {idx} should maintain left alignment")

        # Verify vertical stagger delta between adjacent chunks is clamped <= 5% (not 13% jump)
        y0 = float(placements[0]["yPercent"].rstrip("%"))
        y1 = float(placements[1]["yPercent"].rstrip("%"))
        y2 = float(placements[2]["yPercent"].rstrip("%"))

        delta_0_1 = abs(y1 - y0)
        delta_1_2 = abs(y2 - y1)

        self.assertLessEqual(
            delta_0_1,
            5.0,
            f"Delta between chunk 0 and 1 ({delta_0_1}%) exceeds 5% hysteresis clamp",
        )
        self.assertLessEqual(
            delta_1_2,
            5.0,
            f"Delta between chunk 1 and 2 ({delta_1_2}%) exceeds 5% hysteresis clamp",
        )

    def test_explicit_direction_switch_breaks_hysteresis(self):
        observation = {
            "summary": {
                "headroomRatio": 0.20,
                "faceBottom": 0.45,
                "flankLeftRatio": 0.28,
                "flankRightRatio": 0.28,
            },
            "frames": [],
        }

        chunks = [
            {
                "startMs": 0,
                "endMs": 1200,
                "text": "Left chunk",
                "placement": {
                    "layoutSource": "font_json_layout_rules",
                    "dominantZone": "flank_left_column",
                    "xPercent": "32%",
                    "anchor": "left",
                    "textAlign": "left",
                },
            },
            {
                "startMs": 1200,
                "endMs": 2400,
                "text": "Right chunk",
                "placement": {
                    "layoutSource": "font_json_layout_rules",
                    "dominantZone": "flank_right_column",
                    "xPercent": "68%",
                    "anchor": "right",
                    "textAlign": "right",
                },
            },
        ]

        placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(placements[0]["dominantZone"], "flank_left_column")
        self.assertEqual(placements[0]["xPercent"], "32%")
        self.assertEqual(placements[1]["dominantZone"], "flank_right_column")
        self.assertEqual(placements[1]["xPercent"], "68%")


if __name__ == "__main__":
    unittest.main()
