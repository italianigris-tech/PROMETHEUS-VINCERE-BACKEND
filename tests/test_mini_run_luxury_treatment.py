import unittest
import sys
import tempfile
import types
from unittest.mock import patch
from pathlib import Path


def chunks(texts):
    return [
        {
            "chunkIndex": index + 1,
            "text": text,
            "startMs": index * 1000,
            "endMs": index * 1000 + 900,
            "words": [
                {"text": word, "start_ms": index * 1000 + word_index * 180, "end_ms": index * 1000 + (word_index + 1) * 180}
                for word_index, word in enumerate(text.split())
            ],
        }
        for index, text in enumerate(texts)
    ]


class GenerativeTypographyTests(unittest.TestCase):
    def test_martin_receipt_resolves_a_volume_foreground_asset(self):
        from mini_run_pipeline.render import resolve_martin_foreground_path

        resolved = resolve_martin_foreground_path(
            {"stitch": [{"foregroundFile": "martin/mini-run-test/full.webm"}]},
            "/data",
        )

        self.assertEqual(resolved, Path("/data/media/martin/mini-run-test/full.webm"))

    def test_martin_artifact_volume_is_reloaded_before_the_foreground_is_read(self):
        from mini_run_pipeline.render import reload_martin_artifact_volume

        calls = []
        reload_martin_artifact_volume(types.SimpleNamespace(reload=lambda: calls.append("reload")))

        self.assertEqual(calls, ["reload"])

    def test_required_tall_layering_rejects_missing_foreground(self):
        from mini_run_pipeline.render import require_subject_layering_assets

        with self.assertRaisesRegex(RuntimeError, "required.*foreground"):
            require_subject_layering_assets(
                required=True,
                behind_subject_chunk_count=1,
                foreground_path=None,
                observation={"frames": [{"sourceMs": 0}]},
            )

    def test_required_tall_layering_rejects_missing_observation(self):
        from mini_run_pipeline.render import require_subject_layering_assets

        with self.assertRaisesRegex(RuntimeError, "required.*observation"):
            require_subject_layering_assets(
                required=True,
                behind_subject_chunk_count=1,
                foreground_path=Path("/tmp/foreground.webm"),
                observation=None,
            )

    def test_caption_schedule_clamps_preroll_to_the_previous_caption_exit(self):
        from mini_run_pipeline.typography import schedule_caption_timing

        scheduled = schedule_caption_timing([
            {"startMs": 0, "endMs": 1000, "layers": [{"entryLeadMs": 0}]},
            {"startMs": 1000, "endMs": 1800, "layers": [{"entryLeadMs": 360}]},
        ])

        self.assertEqual(scheduled[0]["displayStartMs"], 0)
        self.assertEqual(scheduled[0]["displayEndMs"], 1000)
        self.assertEqual(scheduled[1]["displayStartMs"], 1000)
        self.assertEqual(scheduled[1]["layers"][0]["effectiveEntryLeadMs"], 0)

    def test_subject_layering_uses_only_tall_matte_optimized_profiles(self):
        from mini_run_pipeline.typography import generate_font_manifest

        manifest = generate_font_manifest(
            chunks(["FRAME", "SHAPE", "BUILD", "FOCUS"]),
            {"seed": "subject-plane", "subjectLayering": "required"},
        )
        behind = [chunk for chunk in manifest["chunks"] if chunk["subjectLayering"]["behindSubject"]]

        self.assertTrue(behind)
        self.assertTrue(all(chunk["subjectLayering"]["isTallProfile"] for chunk in behind))
        self.assertTrue(all(layer["behindSubject"] for chunk in behind for layer in chunk["layers"]))

    def test_runtime_catalog_includes_the_complete_anima_typography_suite(self):
        from mini_run_pipeline.typography import ANIMA_RUNTIME_TREATMENTS

        ids = {treatment["id"] for treatment in ANIMA_RUNTIME_TREATMENTS}
        self.assertGreaterEqual(len(ids), 41)
        self.assertIn("canva_tall_glyph_stack", ids)
        self.assertIn("cinematic_distance_convergence", ids)

    def test_gateway_normalizes_design_controls_before_enqueuing(self):
        import mini_run_gateway

        captured = {}

        def create_job(source, **kwargs):
            captured["source"] = source
            captured.update(kwargs)
            return {"jobId": "test", "status": "queued"}

        with patch("mini_run_pipeline.pipeline.create_pipeline_job", side_effect=create_job):
            result = mini_run_gateway.handle_render({
                "source": {"path": "/tmp/input.mp4"},
                "design": {
                    "creativity": "expressive",
                    "pacing": "not-valid",
                    "motionStyle": "kinetic",
                    "typographyBias": "script",
                    "avoidPresets": ["gaussian_blur_reveal_sweep", "not-real"],
                },
            })

        self.assertEqual(result["status"], "queued")
        self.assertEqual(captured["options"]["design"], {
            "creativity": "expressive",
            "pacing": "adaptive",
            "motionStyle": "kinetic",
            "typographyBias": "script",
            "avoidPresets": ["gaussian_blur_reveal_sweep"],
            "canvasWidth": 1080,
            "canvasHeight": 1920,
            "subjectLayering": "auto",
        })

    def test_policy_normalizes_prompt_controls(self):
        from mini_run_pipeline.typography import resolve_typography_policy

        self.assertEqual(resolve_typography_policy({
            "creativity": "expressive",
            "pacing": "slow",
            "motionStyle": "editorial",
            "typographyBias": "serif",
            "avoidPresets": ["gaussian_blur_reveal_sweep"],
        }), {
            "creativity": "expressive",
            "pacing": "slow",
            "motionStyle": "editorial",
            "typographyBias": "serif",
            "subjectLayering": "auto",
            "avoidPresets": ["gaussian_blur_reveal_sweep"],
        })

    def test_matte_gateway_uses_the_current_modal_function_lookup_api(self):
        import mini_run_gateway

        calls = []
        commits = []
        class FakeFunction:
            @staticmethod
            def from_name(app_name, function_name):
                calls.append((app_name, function_name))
                return types.SimpleNamespace(remote=lambda request: {"windows": [{
                    "windowId": "full", "foregroundFile": "martin/test/full.webm",
                }]})
        class FakeVolume:
            @staticmethod
            def from_name(name):
                self.assertEqual(name, "prometheus-render-artifacts")
                return types.SimpleNamespace(commit=lambda: commits.append(name))

        with tempfile.TemporaryDirectory() as root, tempfile.NamedTemporaryFile(suffix=".mp4") as source, patch.dict(sys.modules, {
            "modal": types.SimpleNamespace(Function=FakeFunction, Volume=FakeVolume),
        }), patch.object(mini_run_gateway, "ARTIFACT_ROOT", Path(root)):
            receipt = mini_run_gateway.handle_matte({
                "jobId": "test",
                "source": {"inputUrl": source.name},
                "windows": [{"windowId": "full", "sourceStartMs": 0, "sourceEndMs": 1000}],
            })

        self.assertEqual(calls, [("prometheus-backend", "matte_worker")])
        self.assertEqual(commits, ["prometheus-render-artifacts"])
        self.assertEqual(receipt["stitch"][0]["foregroundFile"], "martin/test/full.webm")

    def test_explicit_seed_cannot_replay_a_selection_trajectory(self):
        from mini_run_pipeline.typography import generate_font_manifest

        design = {"seed": "stable", "creativity": "expressive"}
        first = generate_font_manifest(chunks(["Shape the raw story", "Then refine the rhythm"]), design)
        second = generate_font_manifest(chunks(["Shape the raw story", "Then refine the rhythm"]), design)

        self.assertNotEqual(first["selectionNonce"], second["selectionNonce"])
        self.assertEqual(first["selectionMode"], "entropy")
        self.assertEqual(second["selectionMode"], "entropy")

    def test_selection_nonce_changes_a_valid_selection_trajectory(self):
        from mini_run_pipeline.typography import generate_font_manifest

        left = generate_font_manifest(chunks(["Shape the raw story", "Then refine the rhythm", "Keep the tension alive"]), {"seed": "left", "creativity": "expressive"})
        right = generate_font_manifest(chunks(["Shape the raw story", "Then refine the rhythm", "Keep the tension alive"]), {"seed": "right", "creativity": "expressive"})

        self.assertNotEqual(
            [(item["profileId"], item["selection"]["primaryFx"]) for item in left["chunks"]],
            [(item["profileId"], item["selection"]["primaryFx"]) for item in right["chunks"]],
        )

    def test_default_expressive_manifest_uses_multiple_curated_palettes(self):
        from mini_run_pipeline.typography import generate_font_manifest

        manifest = generate_font_manifest(
            chunks([
                "Shape the raw story", "Then refine the rhythm", "Keep the tension alive",
                "Make every frame matter", "Find the emotional center", "Let the silence speak",
            ]),
            {"seed": "palette-proof", "creativity": "expressive"},
        )

        self.assertGreaterEqual(len({chunk["paletteId"] for chunk in manifest["chunks"]}), 4)

    def test_literal_phrasing_is_not_recorded_as_a_treatment_selector(self):
        from mini_run_pipeline.typography import generate_font_manifest

        design = {"seed": "same-shape", "motionStyle": "cinematic"}
        left = generate_font_manifest(chunks(["Videos made me", "A better video"]), design)
        right = generate_font_manifest(chunks(["Stories shaped us", "A brighter future"]), design)

        self.assertNotIn("Videos made me", str(left["selectionPolicy"]))
        self.assertNotIn("Stories shaped us", str(right["selectionPolicy"]))

    def test_all_portrait_profiles_are_reported_as_eligible(self):
        from mini_run_pipeline.typography import eligible_portrait_profile_ids, load_all_portrait_font_json_profiles

        self.assertEqual(set(eligible_portrait_profile_ids()), {profile["id"] for profile in load_all_portrait_font_json_profiles()})
        self.assertGreaterEqual(len(eligible_portrait_profile_ids()), 63)
