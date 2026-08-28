import unittest

from mini_run_pipeline.backgrounds import (
    build_background_catalog,
    detect_background_reference,
    govern_backgrounds,
    plan_backgrounds,
    portrait_cover_metrics,
)


def _chunks(texts):
    return [
        {
            "chunkIndex": index,
            "chunkId": f"chunk-{index + 1}",
            "text": text,
            "outputStartMs": index * 5000,
            "outputEndMs": (index + 1) * 5000,
        }
        for index, text in enumerate(texts)
    ]


def _scenes(chunks, duration_ms=30000):
    scenes = []
    for index, chunk in enumerate(chunks):
        start = int(chunk["outputStartMs"])
        end = duration_ms if index == len(chunks) - 1 else int(chunk["outputEndMs"])
        scenes.append({
            "id": f"scene-{index + 1}",
            "startMs": start,
            "endMs": end,
            "layout": "pan_scan",
            "salience": 0.5,
        })
    return scenes


class PortraitCoverMetricsTests(unittest.TestCase):
    def test_landscape_3x2_source_is_tagged_as_a_tight_cover_crop(self):
        # 4240x2832 is a 3:2 landscape; a 9:16 cover crop keeps only the middle strip.
        metric = portrait_cover_metrics(4240, 2832)
        self.assertLess(metric["visibleWidthRatio"], 0.62)
        assert metric["verdict"] in ("cover_crop_tight", "cover_crop_usable")
        self.assertGreater(metric["coverScale"], 1.0)

    def test_portrait_source_needs_no_crop(self):
        metric = portrait_cover_metrics(1080, 1920)
        self.assertEqual(metric["verdict"], "portrait_native_ok")
        self.assertAlmostEqual(metric["visibleWidthRatio"], 1.0, places=2)


class CatalogTests(unittest.TestCase):
    def test_catalog_lists_every_bundled_asset_with_cover_preview(self):
        catalog = build_background_catalog()
        self.assertTrue(catalog)
        for entry in catalog:
            self.assertEqual(entry["assetStatus"], "bundled")
            self.assertIn("portraitCover", entry)
            self.assertIn("family", entry)
            self.assertIn("filePath", entry)
        # Ordered best 9:16 fit first.
        widths = [entry["portraitCover"]["visibleWidthRatio"] for entry in catalog]
        self.assertEqual(widths, sorted(widths, reverse=True))


class DetectReferenceTests(unittest.TestCase):
    def test_list_stack_triggers_on_ordinal_and_step_words(self):
        score, trigger, candidate, code = detect_background_reference("The three pillars")
        self.assertGreater(score, 0)
        self.assertEqual(trigger, "list_stack")
        self.assertEqual(code, "bg_list_stack")
        self.assertTrue(candidate)

    def test_screencast_triggers_on_interface_verbs(self):
        score, trigger, _, _ = detect_background_reference("Open the dashboard")
        self.assertGreater(score, 0)
        self.assertEqual(trigger, "screencast")

    def test_crisis_triggers_on_breakage(self):
        score, trigger, _, _ = detect_background_reference("The pipeline totally collapsed")
        self.assertGreater(score, 0)
        self.assertEqual(trigger, "crisis")

    def test_plain_copy_returns_zero(self):
        score, trigger, _, _ = detect_background_reference("Hello there friend")
        self.assertEqual(score, 0)
        self.assertIsNone(trigger)


class PlanBackgroundsTests(unittest.TestCase):
    def test_respects_budget_and_gap_and_excludes_behind_subject(self):
        chunks = _chunks([
            "The three pillars of editing",  # list_stack
            "Open the dashboard",            # screencast
            "The whole system broke",        # crisis
            "Three steps to a calmer grade", # list_stack
            "A closing thought",
            "One final idea",
        ])
        # The crisis chunk should never host a backdrop (text must render atop).
        chunks[2]["subjectLayering"] = {"behindSubject": True}

        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=_scenes(chunks),
            design={"maxBackgrounds": 3, "backgroundMinGapMs": 2000},
            duration_ms=30000,
        )
        self.assertLessEqual(len(backgrounds), 3)
        # behind-subject chunk 2 (index 2) must be excluded from any placement.
        self.assertNotIn("chunk-3", [b["cause"]["chunkIds"][0] for b in backgrounds])
        for background in backgrounds:
            self.assertTrue(background["cause"]["chunkIds"])
            self.assertIn("code", background)
            self.assertIn("transition", background)
            self.assertIn("texture", background)
            self.assertIn("entry", background)
            self.assertIn("exit", background)

    def test_disabled_policy_returns_nothing(self):
        chunks = _chunks(["The three pillars of editing"])
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=_scenes(chunks),
            design={"backgroundPolicy": "disabled"},
            duration_ms=30000,
        )
        self.assertEqual(backgrounds, [])

    def test_missing_texture_assets_yields_empty_plan(self):
        chunks = _chunks(["The three pillars of editing"])
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=_scenes(chunks),
            texture_catalog=[],
            duration_ms=30000,
        )
        self.assertEqual(backgrounds, [])


class GovernBackgroundsTests(unittest.TestCase):
    def test_clean_plan_has_no_issues(self):
        chunks = _chunks(["The three pillars of editing", "A closing thought"])
        scenes = _scenes(chunks)
        backgrounds = plan_backgrounds(chunks=chunks, scenes=scenes, duration_ms=30000)
        self.assertEqual(govern_backgrounds(backgrounds, scenes), [])

    def test_unknown_scene_and_missing_texture_are_flagged(self):
        chunks = _chunks(["The three pillars of editing"])
        scenes = _scenes(chunks)
        backgrounds = plan_backgrounds(chunks=chunks, scenes=scenes, duration_ms=30000)
        # Tamper with the plan so it violates the causal contract.
        backgrounds[0]["sceneId"] = "scene-does-not-exist"
        backgrounds[0].pop("texture")
        issues = govern_backgrounds(backgrounds, scenes)
        self.assertTrue(any("unknown scene" in issue for issue in issues))
        self.assertTrue(any("no texture asset" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()

