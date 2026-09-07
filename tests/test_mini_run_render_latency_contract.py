"""Fast regression loop for the mini-run two-minute render architecture."""

import ast
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODAL_MODULE = ROOT / "modal_mini_run.py"
REMOTION_PACKAGE = ROOT / "remotion-app" / "package.json"
PINNED_REMOTION_VERSION = "4.0.428"


class MiniRunRenderLatencyContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source = MODAL_MODULE.read_text(encoding="utf-8")
        self.tree = ast.parse(self.source)
        self.package = json.loads(REMOTION_PACKAGE.read_text(encoding="utf-8"))
        self.render_slice = next(
            node for node in self.tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "render_remotion_slice"
        )
        self.render_slice_source = ast.get_source_segment(self.source, self.render_slice) or ""

    def test_slice_renders_the_prebuilt_bundle_and_places_dynamic_media_inside_it(self) -> None:
        self.assertIn('BUNDLE_PUBLIC_SOURCE_ROOT = BUNDLE_ROOT / "public" / "source"', self.source)
        self.assertIn("public_source_dir = Path(BUNDLE_PUBLIC_SOURCE_ROOT)", self.render_slice_source)
        self.assertIn("entry_target = str(BUNDLE_ROOT)", self.render_slice_source)
        self.assertNotIn('entry_target = "src/index.ts"', self.render_slice_source)

    def test_image_preinstalls_the_browser_before_parallel_slice_execution(self) -> None:
        self.assertIn('npx remotion browser ensure', self.source)

    def test_all_remotion_dependencies_are_pinned_to_one_version(self) -> None:
        dependencies = self.package["dependencies"]
        remotion_versions = {
            name: version
            for name, version in dependencies.items()
            if name == "remotion" or name.startswith("@remotion/")
        }
        self.assertTrue(remotion_versions)
        self.assertEqual(set(remotion_versions.values()), {PINNED_REMOTION_VERSION})


if __name__ == "__main__":
    unittest.main()
