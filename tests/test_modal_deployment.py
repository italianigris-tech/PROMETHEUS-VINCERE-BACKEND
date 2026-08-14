import ast
from pathlib import Path
import unittest


REPO_ROOT = Path(__file__).resolve().parents[1]
MODAL_APP = REPO_ROOT / "modal_app.py"


class ModalDeploymentImageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tree = ast.parse(MODAL_APP.read_text(encoding="utf-8"))

    def _assignment_source(self, name: str) -> str:
        assignments = [
            node
            for node in self.tree.body
            if isinstance(node, ast.Assign)
            and any(isinstance(target, ast.Name) and target.id == name for target in node.targets)
        ]
        self.assertEqual(len(assignments), 1, f"Expected one {name} assignment")
        return ast.unparse(assignments[0].value)

    def _decorator_call(self, function_name: str, attribute_name: str) -> ast.Call:
        function = next(
            node
            for node in self.tree.body
            if isinstance(node, ast.FunctionDef) and node.name == function_name
        )
        calls = [
            item
            for item in function.decorator_list
            if isinstance(item, ast.Call)
            and isinstance(item.func, ast.Attribute)
            and item.func.attr == attribute_name
        ]
        self.assertEqual(len(calls), 1)
        return calls[0]

    @staticmethod
    def _literal_keyword(call: ast.Call, keyword_name: str) -> object:
        keyword = next((item for item in call.keywords if item.arg == keyword_name), None)
        if keyword is None:
            raise AssertionError(f"Missing {keyword_name} configuration")
        if isinstance(keyword.value, ast.BinOp) and isinstance(keyword.value.op, ast.Mult):
            return ast.literal_eval(keyword.value.left) * ast.literal_eval(keyword.value.right)
        return ast.literal_eval(keyword.value)

    def test_api_image_excludes_the_render_stack(self) -> None:
        source = self._assignment_source("api_image")

        for heavy_dependency in (
            "ffmpeg",
            "libgbm1",
            "remotion-app",
            "Yuan Prometheus Screenshots/font JSON",
            "motion-assets/vendor",
        ):
            self.assertNotIn(
                heavy_dependency,
                source,
                f"Thin API image must not include {heavy_dependency}",
            )
        self.assertIn("backend/src", source)
        self.assertIn("packages/shared-types/src", source)

    def test_worker_image_owns_render_dependencies_and_typography_corpus(self) -> None:
        source = self._assignment_source("worker_image")

        for worker_dependency in (
            "ffmpeg",
            "libgbm1",
            "apps/worker/src",
            "remotion-app/src",
            "Yuan Prometheus Screenshots/font JSON",
        ):
            self.assertIn(
                worker_dependency,
                source,
                f"Heavy worker image must include {worker_dependency}",
            )

    def test_api_scales_to_zero_and_starts_only_the_core_server(self) -> None:
        function_call = self._decorator_call("api", "function")
        function = next(
            node
            for node in self.tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "api"
        )
        source = ast.unparse(function)

        self.assertEqual(ast.unparse(function_call.keywords[0].value), "api_image")
        self.assertEqual(self._literal_keyword(function_call, "min_containers"), 0)
        self.assertLessEqual(self._literal_keyword(function_call, "scaledown_window"), 60)
        self.assertIn("start:core", source)
        self.assertNotIn('["npm", "start"]', source)

    def test_worker_runs_only_on_demand_and_is_concurrency_bounded(self) -> None:
        function_call = self._decorator_call("render_worker", "function")
        self.assertEqual(ast.unparse(function_call.keywords[0].value), "worker_image")
        self.assertEqual(self._literal_keyword(function_call, "gpu"), "L4")
        self.assertEqual(self._literal_keyword(function_call, "min_containers"), 0)
        self.assertGreaterEqual(self._literal_keyword(function_call, "cpu"), 8)
        self.assertGreaterEqual(self._literal_keyword(function_call, "max_containers"), 4)
        self.assertLessEqual(self._literal_keyword(function_call, "scaledown_window"), 60)

    def test_maul_calls_scale_independently_and_publish_from_local_scratch(self) -> None:
        function_call = self._decorator_call("maul_render_worker", "function")
        function = next(
            node
            for node in self.tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "maul_render_worker"
        )
        source = ast.unparse(function)

        self.assertGreaterEqual(self._literal_keyword(function_call, "max_containers"), 20)
        self.assertIn("TemporaryDirectory", source)
        self.assertIn("shutil.copyfile", source)
        self.assertIn("artifacts.commit", source)
        self.assertIn("stageTimingsMs", source)

    def test_maul_export_fans_twelve_frame_slices_across_gpu_workers(self) -> None:
        module_source = MODAL_APP.read_text(encoding="utf-8")
        coordinator = next(
            node
            for node in self.tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "maul_render_worker"
        )
        slice_call = self._decorator_call("maul_frame_slice_worker", "function")

        self.assertIn("maul_frame_slice_worker.spawn", ast.unparse(coordinator))
        self.assertIn("MAUL_FRAMES_PER_SLICE", module_source)
        self.assertIn("MAUL_FRAMES_PER_SLICE = 12", module_source)
        self.assertIn("MAUL_MAX_PARALLEL_SLICES = 8", module_source)
        self.assertNotIn("ThreadPoolExecutor", ast.unparse(coordinator))
        self.assertIn("segmentBytes", ast.unparse(coordinator))
        self.assertEqual(self._literal_keyword(slice_call, "gpu"), "L4")
        self.assertGreaterEqual(self._literal_keyword(slice_call, "cpu"), 8)
        self.assertGreaterEqual(self._literal_keyword(slice_call, "max_containers"), 50)
        self.assertIn("h264_nvenc", ast.unparse(coordinator))

        coordinator_call = self._decorator_call("maul_render_worker", "function")
        self.assertFalse(any(keyword.arg == "gpu" for keyword in coordinator_call.keywords))
        self.assertEqual(self._literal_keyword(coordinator_call, "min_containers"), 0)

    def test_render_worker_requires_nvenc_and_reports_encoder(self) -> None:
        module_source = MODAL_APP.read_text(encoding="utf-8")
        function = next(
            node
            for node in self.tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "render_worker"
        )
        source = ast.unparse(function)

        self.assertIn("assert_nvenc_available", source)
        self.assertIn("encoder", source)
        self.assertIn("h264_nvenc", module_source)

    def test_render_dispatch_requires_pipeline_identity_and_routes_maul_separately(self) -> None:
        module_source = MODAL_APP.read_text(encoding="utf-8")
        self.assertIn('pipeline == "maul"', module_source)
        self.assertIn('pipeline == "joseph"', module_source)
        self.assertIn("maul_render_worker.spawn", module_source)
        self.assertIn("render_worker.spawn", module_source)
        self.assertIn("pipelineJobId", module_source)
        self.assertIn("render-maul-slice.ts", module_source)
        self.assertIn("render-maul-audio.ts", module_source)
        self.assertIn("maul-remotion-bundle", self._assignment_source("worker_image"))

    def test_matte_worker_is_gpu_bounded_and_scales_to_zero(self) -> None:
        source = self._assignment_source("matte_image")
        self.assertIn("packages/rvm-pipeline", source)
        self.assertIn("ffmpeg", source)
        self.assertIn("RobustVideoMatting", source)
        self.assertIn("rvm_resnet50.pth", source)
        self.assertIn("imageio-ffmpeg", source)
        self.assertIn('RVM_ALLOW_TORCHHUB_FALLBACK', source)
        self.assertIn("'0'", source)
        extractor_source = (REPO_ROOT / "packages/rvm-pipeline/rvm_pipeline/extract.py").read_text(encoding="utf-8")
        self.assertIn("RVM_REPO_IS_LOCAL", extractor_source)
        self.assertIn('source="local"', extractor_source)
        self.assertIn("get_ffmpeg_exe", extractor_source)
        self.assertIn('"-q:v",\n        "8"', extractor_source)
        self.assertNotIn('"-crf"', extractor_source)
        self.assertNotIn('"-lossless"', extractor_source)
        self.assertNotIn('"-auto-alt-ref"', extractor_source)

        function_call = self._decorator_call("matte_window_worker", "function")
        self.assertEqual(ast.unparse(function_call.keywords[0].value), "matte_image")
        self.assertEqual(self._literal_keyword(function_call, "gpu"), "L4")
        self.assertEqual(self._literal_keyword(function_call, "min_containers"), 0)
        self.assertGreaterEqual(self._literal_keyword(function_call, "max_containers"), 4)

    def test_dispatch_adapter_batches_matte_windows_into_one_worker_call(self) -> None:
        module_source = MODAL_APP.read_text(encoding="utf-8")
        self.assertIn('self.path == "/matte/spawn"', module_source)
        self.assertIn("matte_worker.spawn(request)", module_source)

    def test_batch_coordinator_fans_windows_out_and_uses_content_cache(self) -> None:
        module_source = MODAL_APP.read_text(encoding="utf-8")
        coordinator = next(
            node for node in self.tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "matte_worker"
        )
        window_worker = next(
            node for node in self.tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "matte_window_worker"
        )

        self.assertIn("matte_window_worker.map", ast.unparse(coordinator))
        self.assertNotIn("extract_matte", ast.unparse(coordinator))
        self.assertIn("cacheKey", ast.unparse(window_worker))
        self.assertIn("cacheHit", ast.unparse(window_worker))

    def test_core_dispatches_and_polls_the_worker_through_an_internal_adapter(self) -> None:
        module_source = MODAL_APP.read_text(encoding="utf-8")
        api_function = next(
            node
            for node in self.tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "api"
        )

        self.assertIn("render_worker.spawn", module_source)
        self.assertIn("modal.FunctionCall.from_id", module_source)
        self.assertIn("artifacts.reload", module_source)
        self.assertIn("start_dispatch_server", ast.unparse(api_function))
        self.assertIn("MODAL_RENDER_DISPATCH_URL", ast.unparse(api_function))

    def test_failed_api_startup_has_a_bounded_cold_start_window(self) -> None:
        web_server_call = self._decorator_call("api", "web_server")
        startup_timeout = self._literal_keyword(web_server_call, "startup_timeout")

        self.assertGreaterEqual(startup_timeout, 60)
        self.assertLessEqual(startup_timeout, 180)


if __name__ == "__main__":
    unittest.main()
