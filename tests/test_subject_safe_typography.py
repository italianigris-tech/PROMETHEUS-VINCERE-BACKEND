"""Regression coverage for MediaPipe-driven mini-run text placement."""

from __future__ import annotations

import unittest

from mini_run_pipeline.subject_placement import parse_observation_payload, plan_subject_safe_placements


def observation_with_centered_subject():
    return {
        "frames": [
            {
                "sourceMs": 1500,
                "subjectBox": {"x": 0.24, "y": 0.04, "width": 0.52, "height": 0.88},
                "luminanceGrid": {"columns": 12, "rows": 20, "samples": [0.25] * 240},
            }
        ]
    }


class SubjectSafePlacementTests(unittest.TestCase):
    def test_observation_parser_accepts_runtime_noise_before_structured_receipt(self):
        observation = parse_observation_payload(
            "INFO: MediaPipe initialized\\n"
            '{"schemaVersion":"maul-media-observation/v1","frames":[{"sourceMs":0}]}'
        )

        self.assertEqual(observation["schemaVersion"], "maul-media-observation/v1")
        self.assertEqual(len(observation["frames"]), 1)

    def test_tall_behind_subject_chunk_uses_visible_region_not_subject_center(self):
        placement = plan_subject_safe_placements(
            [{
                "chunkIndex": 1,
                "sourceStartMs": 1000,
                "sourceEndMs": 2000,
                "subjectLayering": {"behindSubject": True},
            }],
            observation_with_centered_subject(),
        )[0]

        self.assertIn(placement["safeRegionId"], {"upper_left", "upper_right", "lower_left", "lower_right"})
        self.assertNotEqual(placement["xPercent"], "50%")
        self.assertFalse(placement["intersectsSubject"])

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


if __name__ == "__main__":
    unittest.main()
