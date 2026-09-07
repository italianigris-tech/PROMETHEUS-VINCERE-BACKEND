"""Static deployment contract for the isolated 30-way mini-run renderer."""

import ast
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "modal_mini_run.py"


class ModalMiniRunContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source = MODULE.read_text(encoding="utf-8")
        self.tree = ast.parse(self.source)

    def test_mini_run_image_excludes_macro_and_landscape_media_trees(self) -> None:
        self.assertNotIn('local("backend")', self.source)
        self.assertNotIn('local("LANDSCAPE VIDEOS FOR USE")', self.source)
        self.assertNotIn('local("RAW HEAD VIDS PINTEREST")', self.source)

    def test_generated_remotion_media_is_not_an_image_input(self) -> None:
        for pattern in ('"**/.cache/**"', '"**/build/**"', '"**/dist/**"', '"public/uploads/**"'):
            self.assertIn(pattern, self.source)

    def test_slice_workers_have_capacity_for_exactly_thirty_parallel_slices(self) -> None:
        render = next(node for node in self.tree.body if isinstance(node, ast.FunctionDef) and node.name == "render_remotion_slice")
        decorator = next(
            decorator
            for decorator in render.decorator_list
            if isinstance(decorator, ast.Call)
            and isinstance(decorator.func, ast.Attribute)
            and decorator.func.attr == "function"
        )
        max_containers = next(keyword.value for keyword in decorator.keywords if keyword.arg == "max_containers")
        self.assertIn("PARALLEL_SLICE_COUNT", ast.unparse(max_containers))
        self.assertIn("PARALLEL_SLICE_COUNT = 30", self.source)
        self.assertIn('payload.get("parallelSlices", PARALLEL_SLICE_COUNT)', self.source)
        self.assertIn("parallelSlices must be {PARALLEL_SLICE_COUNT}", self.source)


if __name__ == "__main__":
    unittest.main()
