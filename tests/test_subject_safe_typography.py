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

    def test_foreground_text_can_use_the_standard_center_stage(self):
        placement = plan_subject_safe_placements(
            [{
                "chunkIndex": 1,
                "sourceStartMs": 1000,
                "sourceEndMs": 2000,
                "subjectLayering": {"behindSubject": False},
            }],
            observation_with_centered_subject(),
        )[0]

        self.assertEqual(placement["safeRegionId"], "foreground_center")
        self.assertEqual(placement["xPercent"], "50%")
        self.assertEqual(placement["yPercent"], "68%")


if __name__ == "__main__":
    unittest.main()
