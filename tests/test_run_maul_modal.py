import importlib.util
from pathlib import Path
import unittest


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "run-maul-modal.py"


def load_module():
    spec = importlib.util.spec_from_file_location("run_maul_modal", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load run-maul-modal.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class MaulModalCliTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cli = load_module()

    def read_manifest(self):
        return {
            "schemaVersion": "maul-unified-short-render-manifest/v3",
            "replayKey": "a" * 64,
            "layerPolicy": {
                "baseVideo": "required",
                "typography": "required",
                "sourceTreatment": "disabled",
                "sourceLegibilityOverlay": "disabled",
                "editorialCuts": "disabled",
                "transitions": "disabled",
                "backgroundAnimation": "disabled",
                "motionGraphics": "disabled",
                "audioTreatment": "enabled",
            },
            "plans": {
                "textChunk": {"chunks": [
                    {"chunkId": "hook", "text": "Start"},
                    {"chunkId": "context", "text": "Continue"},
                    {"chunkId": "payoff", "text": "Finish"},
                ]},
                "textPlacement": {
                    "status": "planned",
                    "foregroundChunkIds": ["hook", "payoff"],
                },
                "textAnimation": {"programs": [{"id": "program-1"}]},
                "typographyMotion": {
                    "chunkTypographyBindings": [
                        {"chunkId": "hook", "provenance": {"compilerVersion": "test"}},
                    ],
                },
                "visual": {},
            },
            "output": {"width": 1080, "height": 1920, "fps": 30},
        }

    def test_rejects_thin_manifest_before_modal_dispatch(self):
        with self.assertRaises(self.cli.ManifestQualityError) as context:
            self.cli.validate_full_scale_manifest(self.read_manifest())

        message = str(context.exception)
        self.assertIn("sourceTreatment", message)
        self.assertIn("foreground", message)

    def test_accepts_full_scale_manifest(self):
        manifest = self.read_manifest()
        manifest["layerPolicy"] = {
            "baseVideo": "required",
            "typography": "required",
            "sourceTreatment": "enabled",
            "sourceLegibilityOverlay": "enabled",
            "editorialCuts": "enabled",
            "transitions": "enabled",
            "backgroundAnimation": "enabled",
            "motionGraphics": "enabled",
            "audioTreatment": "enabled",
        }
        chunks = manifest["plans"]["textChunk"]["chunks"]
        manifest["plans"]["textPlacement"]["foregroundChunkIds"] = [
            chunk["chunkId"] for chunk in chunks
        ]
        manifest["plans"]["visual"]["visualTrack"] = {"scenes": []}
        manifest["plans"]["textAnimation"]["programs"] = [{"id": "program-1"}]

        summary = self.cli.validate_full_scale_manifest(manifest)

        self.assertEqual(summary["chunkCount"], len(chunks))
        self.assertEqual(summary["foregroundChunkCount"], len(chunks))
        self.assertGreater(summary["animationProgramCount"], 0)

    def test_rejects_full_scale_manifest_without_typography_provenance(self):
        manifest = self.read_manifest()
        manifest["layerPolicy"] = {
            "baseVideo": "required",
            "typography": "required",
            "sourceTreatment": "enabled",
            "sourceLegibilityOverlay": "enabled",
            "editorialCuts": "enabled",
            "transitions": "enabled",
            "backgroundAnimation": "enabled",
            "motionGraphics": "enabled",
            "audioTreatment": "enabled",
        }
        chunks = manifest["plans"]["textChunk"]["chunks"]
        manifest["plans"]["textPlacement"]["foregroundChunkIds"] = [
            chunk["chunkId"] for chunk in chunks
        ]
        manifest["plans"]["visual"]["visualTrack"] = {"scenes": []}
        manifest["plans"]["typographyMotion"] = {
            "chunkTypographyBindings": [{"chunkId": "hook"}],
        }

        with self.assertRaises(self.cli.ManifestQualityError) as context:
            self.cli.validate_full_scale_manifest(manifest)

        self.assertIn("provenance", str(context.exception))

    def test_wait_for_call_is_bounded_and_reports_progress(self):
        class FakeCall:
            object_id = "fc-test"

            def __init__(self):
                self.calls = 0

            def get(self, timeout=0):
                self.calls += 1
                if self.calls < 3:
                    raise TimeoutError()
                return {"status": "completed", "outputFile": "final.mp4"}

        events = []
        result = self.cli.wait_for_call(
            FakeCall(),
            timeout_seconds=5,
            poll_interval_seconds=0,
            emit=events.append,
            monotonic=lambda: 0,
        )

        self.assertEqual(result["status"], "completed")
        self.assertEqual([event["status"] for event in events], ["running", "running", "completed"])


if __name__ == "__main__":
    unittest.main()
