from pathlib import Path
import unittest


REPO_ROOT = Path(__file__).resolve().parents[1]
OBSERVER = REPO_ROOT / "packages/trajectory-extractor/maul_observe.py"


class MediaPipeObservationArchitectureTests(unittest.TestCase):
    def test_sampling_decodes_sequentially_without_random_frame_seeks(self) -> None:
        source = OBSERVER.read_text(encoding="utf-8")
        main_body = source[source.index("def main()") :]

        self.assertNotIn("CAP_PROP_POS_FRAMES", main_body)
        self.assertIn("frame_index % args.sample_every_frames", main_body)
        self.assertIn("capture.grab()", main_body)


if __name__ == "__main__":
    unittest.main()
