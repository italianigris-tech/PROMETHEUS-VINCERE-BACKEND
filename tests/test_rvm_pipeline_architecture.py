from pathlib import Path
import unittest


REPO_ROOT = Path(__file__).resolve().parents[1]
EXTRACTOR = REPO_ROOT / "packages/rvm-pipeline/rvm_pipeline/extract.py"


class RvmPipelineArchitectureTests(unittest.TestCase):
    def test_rgb_frames_are_streamed_instead_of_png_round_tripped(self) -> None:
        source = EXTRACTOR.read_text(encoding="utf-8")

        self.assertIn("decode_video_frames", source)
        self.assertNotIn("frame_paths = extract_video_frames", source)
        self.assertIn("encode_transparent_webm(paths[\"input\"]", source)
        self.assertNotIn("read_rgb_frames(frame_paths)", source)


if __name__ == "__main__":
    unittest.main()
