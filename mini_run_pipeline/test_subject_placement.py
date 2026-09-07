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
        self.assertIn("above_head", behind_placement.get("safeRegionId", "") + behind_placement.get("policy", "") + behind_placement.get("dominantZone", ""))
        self.assertFalse(behind_placement["intersectsSubject"])
        # Should be nestled in cranial crown headroom zone (around 6% to 22%)
        y_pct = float(behind_placement["yPercent"].rstrip("%"))
        self.assertGreaterEqual(y_pct, 6.0)
        self.assertLessEqual(y_pct, 22.0)
        self.assertGreater(behind_placement["availableHeightRatio"], 0.05)

        fg_placement = placements[1]
        self.assertEqual(fg_placement["safeRegionId"], "foreground_below_head_dynamic")
        # Dynamic below-head deck (clears 52% face bottom + 8% to 60% safe mid-chest zone)
        self.assertEqual(fg_placement["yPercent"], "60%")

    def test_dynamic_below_head_adapts_to_low_chin_without_overfitting(self) -> None:
        # Speaker chin is at 0.40 + 0.28 = 0.68 (68% down the screen, close-up framing).
        # Old overfitted code clamped to 68% (colliding with chin).
        # Dynamic placement must place text safely below chin at 0.68 + 0.08 = 0.76 (76%).
        observation = {
            "frames": [
                {
                    "sourceMs": 1000,
                    "faceBox": {"x": 0.4, "y": 0.40, "width": 0.20, "height": 0.28},
                    "subjectBox": {"x": 0.20, "y": 0.35, "width": 0.60, "height": 0.65},
                }
            ]
        }
        chunks = [
            {"startMs": 500, "endMs": 1500, "text": "Close up chunk", "subjectLayering": {"behindSubject": False}}
        ]
        placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(len(placements), 1)
        self.assertEqual(placements[0]["yPercent"], "76%")
        self.assertFalse(placements[0]["intersectsSubject"])

    def test_dynamic_below_head_adapts_to_wide_shot(self) -> None:
        # Wide shot: speaker chin is high up at 0.15 + 0.18 = 0.33.
        # Places text safely below chin at bounded 44% (upper chest) without floating into the face.
        observation = {
            "frames": [
                {
                    "sourceMs": 1000,
                    "faceBox": {"x": 0.4, "y": 0.15, "width": 0.10, "height": 0.18},
                    "subjectBox": {"x": 0.35, "y": 0.12, "width": 0.30, "height": 0.88},
                }
            ]
        }
        chunks = [
            {"startMs": 500, "endMs": 1500, "text": "Wide shot chunk", "subjectLayering": {"behindSubject": False}}
        ]
        placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(len(placements), 1)
        self.assertEqual(placements[0]["yPercent"], "44%")

    def test_dynamic_hysteresis_holds_steady_on_micro_nods(self) -> None:
        # Consecutive chunks with slight nod (chin 0.52 -> 0.53).
        # Hysteresis holds steady at 60% instead of jittering.
        # But when speaker leans forward (chin 0.65), it immediately adapts to 73%.
        observation = {
            "frames": [
                {"sourceMs": 500, "faceBox": {"x": 0.4, "y": 0.22, "width": 0.15, "height": 0.30}},
                {"sourceMs": 2000, "faceBox": {"x": 0.4, "y": 0.23, "width": 0.15, "height": 0.30}},
                {"sourceMs": 3500, "faceBox": {"x": 0.4, "y": 0.35, "width": 0.15, "height": 0.30}},
            ]
        }
        chunks = [
            {"startMs": 200, "endMs": 1200, "text": "Chunk 1", "subjectLayering": {"behindSubject": False}},
            {"startMs": 1500, "endMs": 2500, "text": "Chunk 2", "subjectLayering": {"behindSubject": False}},
            {"startMs": 3000, "endMs": 4000, "text": "Chunk 3", "subjectLayering": {"behindSubject": False}},
        ]
        placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(len(placements), 3)
        self.assertEqual(placements[0]["yPercent"], "60%")
        # Chunk 2 holds steady at 60%
        self.assertEqual(placements[1]["yPercent"], "60%")
        # Chunk 3 adapts to 0.65 + 0.08 = 73%
        self.assertEqual(placements[2]["yPercent"], "73%")

    def test_plan_subject_safe_placements_fallback_no_observation(self) -> None:
        chunks = [{"text": "HERO", "subjectLayering": {"behindSubject": True}}]
        placements = plan_subject_safe_placements(chunks, None)
        self.assertEqual(len(placements), 1)
        self.assertIn(placements[0]["yPercent"], ("24.0%", "24%", "10.0%", "11.0%", "10%", "11%"))
        self.assertIn(placements[0]["policy"], ("fallback_no_observation", "cranial_negative_space_cranial_crown"))

    def test_parse_observation_payload_with_startup_noise(self) -> None:
        stdout = (
            "[ WARN:0@0.405] global net_impl_backend.cpp: Targets are not supported\n"
            '{"schemaVersion": "maul-media-observation/v1", "frames": [{"sourceMs": 0}]}\n'
        )
        parsed = parse_observation_payload(stdout)
        self.assertEqual(parsed["schemaVersion"], "maul-media-observation/v1")
        self.assertEqual(len(parsed["frames"]), 1)


    def test_plan_subject_safe_placements_left_biased_speaker(self) -> None:
        # Speaker biased to left flank (like Patrick Bet-David)
        observation = {
            "frames": [
                {"sourceMs": 500, "faceBox": {"x": 0.22, "y": 0.174, "width": 0.22, "height": 0.24}},
            ]
        }
        chunks = [{"startMs": 200, "endMs": 1200, "text": "LIVE?", "subjectLayering": {"behindSubject": True}}]
        placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(len(placements), 1)
        self.assertEqual(placements[0]["dominantZone"], "flank_right_column")
        self.assertEqual(placements[0]["xPercent"], "75.4%")
        self.assertEqual(placements[0]["yPercent"], "25.4%")
        self.assertEqual(placements[0]["maxWidthPercent"], "30%")

    def test_plan_subject_safe_placements_centered_speaker(self) -> None:
        # Centered speaker with symmetric flanks
        observation = {
            "frames": [
                {"sourceMs": 500, "faceBox": {"x": 0.40, "y": 0.25, "width": 0.20, "height": 0.25}},
            ]
        }
        chunks = [{"startMs": 200, "endMs": 1200, "text": "CROWN", "subjectLayering": {"behindSubject": True}}]
        placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(len(placements), 1)
        self.assertEqual(placements[0]["dominantZone"], "cranial_crown")
        self.assertEqual(placements[0]["xPercent"], "50.0%")
        self.assertEqual(placements[0]["yPercent"], "16.0%")


if __name__ == "__main__":
    unittest.main()

