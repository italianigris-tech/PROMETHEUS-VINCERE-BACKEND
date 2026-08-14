import unittest

from maul_observe import (
    build_ffmpeg_sample_command,
    expected_sample_count,
    interpolate_sparse_pose_landmarks,
)


class MaulObserveSamplingTests(unittest.TestCase):
    def test_builds_one_raw_rgb_ffmpeg_sampling_pass(self) -> None:
        command = build_ffmpeg_sample_command(
            ffmpeg_bin="ffmpeg",
            source_path="source.mp4",
            duration_ms=20_033,
            source_fps=30.0,
            sample_every_frames=12,
        )

        self.assertEqual(command[0], "ffmpeg")
        self.assertIn("fps=2.5,scale=480:-2", command)
        self.assertEqual(command[-5:], ["-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"])
        self.assertEqual(command[command.index("-frames:v") + 1], "50")

    def test_matches_existing_sample_count_contract(self) -> None:
        self.assertEqual(expected_sample_count(20_033, 30.0, 12), 50)
        self.assertEqual(expected_sample_count(20_000, 30.0, 12), 50)

    def test_interpolates_only_intentionally_skipped_pose_samples(self) -> None:
        frames = [
            {"sourceMs": 0, "poseSampled": True, "poseLandmarks": [
                {"name": "nose", "x": 0.2, "y": 0.3, "confidence": 0.9},
            ]},
            {"sourceMs": 400, "poseSampled": False, "poseLandmarks": []},
            {"sourceMs": 800, "poseSampled": True, "poseLandmarks": [
                {"name": "nose", "x": 0.6, "y": 0.7, "confidence": 0.7},
            ]},
        ]

        interpolate_sparse_pose_landmarks(frames)

        self.assertEqual(frames[1]["poseLandmarks"], [
            {"name": "nose", "x": 0.4, "y": 0.5, "confidence": 0.8},
        ])

    def test_does_not_bridge_failed_pose_inference(self) -> None:
        frames = [
            {"sourceMs": 0, "poseSampled": True, "poseLandmarks": [
                {"name": "nose", "x": 0.2, "y": 0.3, "confidence": 0.9},
            ]},
            {"sourceMs": 400, "poseSampled": False, "poseLandmarks": []},
            {"sourceMs": 800, "poseSampled": True, "poseLandmarks": []},
        ]

        interpolate_sparse_pose_landmarks(frames)

        self.assertEqual(frames[1]["poseLandmarks"], [])


if __name__ == "__main__":
    unittest.main()
