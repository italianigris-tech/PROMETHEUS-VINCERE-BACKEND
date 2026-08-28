import unittest
from mini_run_pipeline.subject_placement import (
    _aggregate_head_top,
    _aggregate_subject_box,
    plan_subject_safe_placements,
    parse_observation_payload,
)


class SubjectPlacementTests(unittest.TestCase):
    def test_aggregate_head_top_estimates_hair_crown(self) -> None:
        observation = {
            "frames": [
                {"faceBox": {"x": 0.4, "y": 0.20, "width": 0.15, "height": 0.30}},
                {"faceBox": {"x": 0.4, "y": 0.22, "width": 0.15, "height": 0.30}},
            ]
        }
        head_top = _aggregate_head_top(observation)
        self.assertIsNotNone(head_top)
        # Median face top is 0.21, height 0.30 -> crown ~ 0.21 - 0.30*0.22 = 0.144
        self.assertAlmostEqual(head_top, 0.144, places=2)

    def test_aggregate_head_top_returns_none_for_empty_frames(self) -> None:
        self.assertIsNone(_aggregate_head_top({"frames": []}))
        self.assertIsNone(_aggregate_head_top({}))

    def test_aggregate_subject_box(self) -> None:
        observation = {
            "frames": [
                {"subjectBox": {"x": 0.2, "y": 0.15, "width": 0.5, "height": 0.8}},
                {"subjectBox": {"x": 0.24, "y": 0.17, "width": 0.52, "height": 0.82}},
            ]
        }
        sub_box = _aggregate_subject_box(observation)
        self.assertIsNotNone(sub_box)
        self.assertAlmostEqual(sub_box["x"], 0.22, places=2)
        self.assertAlmostEqual(sub_box["y"], 0.16, places=2)

    def test_plan_subject_safe_placements_above_head(self) -> None:
        observation = {
            "frames": [
                {
                    "faceBox": {"x": 0.4, "y": 0.22, "width": 0.15, "height": 0.30},
                    "subjectBox": {"x": 0.25, "y": 0.16, "width": 0.5, "height": 0.84},
                }
            ]
        }
        chunks = [
            {"text": "EDITOR.", "subjectLayering": {"behindSubject": True}},
            {"text": "Subtitle", "subjectLayering": {"behindSubject": False}},
        ]
        placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(len(placements), 2)

        behind_placement = placements[0]
        self.assertEqual(behind_placement["anchor"], "center")
        self.assertEqual(behind_placement["safeRegionId"], "behind_subject_above_head")
        self.assertIn("above_head_mediapipe", behind_placement["policy"])
        self.assertFalse(behind_placement["intersectsSubject"])
        # Should be elevated in top headroom zone (around 6% to 14%)
        y_pct = float(behind_placement["yPercent"].rstrip("%"))
        self.assertGreaterEqual(y_pct, 6.0)
        self.assertLessEqual(y_pct, 14.0)
        self.assertGreater(behind_placement["availableHeightRatio"], 0.05)

        fg_placement = placements[1]
        self.assertEqual(fg_placement["yPercent"], "68%")
        self.assertEqual(fg_placement["safeRegionId"], "foreground_center")

    def test_plan_subject_safe_placements_fallback_no_observation(self) -> None:
        chunks = [{"text": "HERO", "subjectLayering": {"behindSubject": True}}]
        placements = plan_subject_safe_placements(chunks, None)
        self.assertEqual(len(placements), 1)
        self.assertEqual(placements[0]["yPercent"], "10.0%")
        self.assertEqual(placements[0]["policy"], "fallback_no_observation")

    def test_parse_observation_payload_with_startup_noise(self) -> None:
        stdout = (
            "[ WARN:0@0.405] global net_impl_backend.cpp: Targets are not supported\n"
            '{"schemaVersion": "maul-media-observation/v1", "frames": [{"sourceMs": 0}]}\n'
        )
        parsed = parse_observation_payload(stdout)
        self.assertEqual(parsed["schemaVersion"], "maul-media-observation/v1")
        self.assertEqual(len(parsed["frames"]), 1)


if __name__ == "__main__":
    unittest.main()
