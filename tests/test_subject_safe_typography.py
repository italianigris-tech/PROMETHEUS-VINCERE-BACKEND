"""Regression coverage for MediaPipe-driven mini-run text placement."""

from __future__ import annotations

import unittest

from mini_run_pipeline.subject_placement import (
    parse_observation_payload,
    plan_subject_safe_placements,
    analyze_cranial_negative_space,
)


def observation_with_centered_subject():
    return {
        "frames": [
            {
                "sourceMs": 1500,
                "subjectBox": {"x": 0.24, "y": 0.18, "width": 0.52, "height": 0.70},
                "luminanceGrid": {"columns": 12, "rows": 20, "samples": [0.25] * 240},
            }
        ]
    }


class SubjectSafePlacementTests(unittest.TestCase):
    def test_observation_parser_accepts_runtime_noise_before_structured_receipt(self):
        observation = parse_observation_payload(
            "INFO: MediaPipe initialized\n"
            '{"schemaVersion":"maul-media-observation/v1","frames":[{"sourceMs":0}]}'
        )

        self.assertEqual(observation["schemaVersion"], "maul-media-observation/v1")
        self.assertEqual(len(observation["frames"]), 1)

    def test_cranial_crown_headroom_selection(self):
        """When generous headroom exists above head, text crowns above in royal Didone arch."""
        analysis = analyze_cranial_negative_space(
            subject_box={"x": 0.30, "y": 0.20, "width": 0.40, "height": 0.65},
            head_top_y=0.20,
        )
        self.assertEqual(analysis["dominantZone"], "cranial_crown")
        self.assertEqual(analysis["fontTreatment"], "tall_didone_arch")
        self.assertEqual(analysis["xPercent"], "50%")
        self.assertEqual(analysis["textAlign"], "center")

    def test_left_flank_editorial_pillar_selection(self):
        """When speaker is framed on the right, text adapts to left flank editorial column."""
        analysis = analyze_cranial_negative_space(
            subject_box={"x": 0.55, "y": 0.08, "width": 0.40, "height": 0.85},
            head_top_y=0.08,
        )
        self.assertEqual(analysis["dominantZone"], "flank_left_column")
        self.assertEqual(analysis["fontTreatment"], "editorial_column_stack")
        self.assertEqual(analysis["textAlign"], "left")

    def test_right_flank_editorial_pillar_selection(self):
        """When speaker is framed on the left, text adapts to right flank editorial column."""
        analysis = analyze_cranial_negative_space(
            subject_box={"x": 0.05, "y": 0.08, "width": 0.40, "height": 0.85},
            head_top_y=0.08,
        )
        self.assertEqual(analysis["dominantZone"], "flank_right_column")
        self.assertEqual(analysis["fontTreatment"], "editorial_column_stack")
        self.assertEqual(analysis["textAlign"], "right")

    def test_tight_headroom_lower_third_fallback(self):
        """When centered speaker has low headroom, text defaults to safe lower third deck."""
        analysis = analyze_cranial_negative_space(
            subject_box={"x": 0.25, "y": 0.05, "width": 0.50, "height": 0.90},
            head_top_y=0.05,
        )
        self.assertEqual(analysis["dominantZone"], "foreground_lower_deck")
        self.assertEqual(analysis["yPercent"], "68%")
        self.assertEqual(analysis["fontTreatment"], "kinetic_anchor_deck")

    def test_temporal_camera_shift_multi_window(self):
        """As camera angle changes over time, placement pivots between crown, left flank, and lower deck."""
        observation = {
            "frames": [
                # 0-12s: Centered speaker with good headroom
                {"sourceMs": 3000, "faceCount": 1, "faceBox": {"y": 0.22}, "subjectBox": {"x": 0.30, "y": 0.22, "width": 0.40, "height": 0.60}},
                {"sourceMs": 8000, "faceCount": 1, "faceBox": {"y": 0.20}, "subjectBox": {"x": 0.30, "y": 0.20, "width": 0.40, "height": 0.60}},
                # 13-16s: Camera shifted, speaker on right, left flank open
                {"sourceMs": 14000, "faceCount": 1, "faceBox": {"y": 0.12}, "subjectBox": {"x": 0.58, "y": 0.12, "width": 0.38, "height": 0.80}},
                # 17-22s: Close up, tight headroom, centered
                {"sourceMs": 19000, "faceCount": 1, "faceBox": {"y": 0.05}, "subjectBox": {"x": 0.25, "y": 0.05, "width": 0.50, "height": 0.90}},
            ]
        }

        chunks = [
            {"chunkIndex": 1, "startMs": 1000, "endMs": 9000, "subjectLayering": {"behindSubject": True}},
            {"chunkIndex": 2, "startMs": 13000, "endMs": 16000, "subjectLayering": {"behindSubject": True}},
            {"chunkIndex": 3, "startMs": 17000, "endMs": 22000, "subjectLayering": {"behindSubject": True}},
        ]

        placements = plan_subject_safe_placements(chunks, observation)

        # Chunk 1 (1s-9s): Cranial crown (centered above head)
        self.assertEqual(placements[0]["dominantZone"], "cranial_crown")
        self.assertEqual(placements[0]["textAlign"], "center")
        self.assertEqual(placements[0]["speakerCategory"], "solo_speaker")

        # Chunk 2 (13s-16s): Camera shifted right -> Left Flank Column
        self.assertEqual(placements[1]["dominantZone"], "flank_left_column")
        self.assertEqual(placements[1]["textAlign"], "left")

        # Chunk 3 (17s-22s): Close up -> Lower deck fallback
        self.assertEqual(placements[2]["dominantZone"], "foreground_lower_deck")
        self.assertEqual(placements[2]["yPercent"], "68%")

    def test_multi_speaker_room_provisioning(self):
        """Detects multi-speaker presence when multiple faces are observed."""
        observation = {
            "frames": [
                {"sourceMs": 2000, "faceCount": 2, "faceBox": {"y": 0.15}, "subjectBox": {"x": 0.20, "y": 0.15, "width": 0.60, "height": 0.70}},
            ]
        }
        chunks = [{"chunkIndex": 1, "startMs": 1000, "endMs": 3000, "subjectLayering": {"behindSubject": False}}]
        placements = plan_subject_safe_placements(chunks, observation)
        self.assertEqual(placements[0]["speakerCategory"], "multi_speaker")
        self.assertEqual(placements[0]["faceCount"], 2)


if __name__ == "__main__":
    unittest.main()
