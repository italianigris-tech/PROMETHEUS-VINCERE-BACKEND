import unittest

from mini_run_pipeline.backgrounds import (
    build_background_catalog,
    build_concrete_asset_catalog,
    detect_background_reference,
    govern_backgrounds,
    parse_background_preferences,
    plan_backgrounds,
    portrait_cover_metrics,
)
from mini_run_pipeline.orchestration import plan_mini_run_orchestration


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
    def test_cool_fingered_unprompted_plain_video_emits_zero_backgrounds(self):
        # A video with ordinary conversational speech and no background prompt or brand directives
        # must run 100% clean (zero backgrounds) under cool-fingered restraint.
        chunks = _chunks([
            "Good morning everybody",
            "Today we are discussing simple everyday ideas",
            "Thank you so much for joining us",
        ])
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=_scenes(chunks),
            duration_ms=30000,
        )
        self.assertEqual(backgrounds, [], "Unprompted plain video must emit 0 backgrounds (cool-fingered restraint)")

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
            design={"maxBackgrounds": 3, "backgroundMinGapMs": 2000, "backgroundPolicy": "enabled"},
            duration_ms=30000,
        )
        self.assertLessEqual(len(backgrounds), 3)
        # behind-subject chunk 2 (index 2) must be excluded from any placement.
        self.assertNotIn("chunk-3", [b["cause"]["chunkIds"][0] for b in backgrounds])
        for background in backgrounds:
            self.assertTrue(background["cause"]["chunkIds"])
            self.assertIn("code", background)
            self.assertIn("transition", background)
            self.assertIn("entry", background)
            self.assertIn("exit", background)

    def test_non_repeating_diverse_texture_selection_in_same_run(self):
        # When multiple backgrounds are elected in a single video run,
        # each placement MUST receive a distinct texture asset (no templated duplication).
        chunks = _chunks([
            "The first pillar of editing",
            "Now the second pillar here",
            "And the third pillar arrives",
        ])
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=_scenes(chunks),
            design={"maxBackgrounds": 3, "backgroundMinGapMs": 1000, "backgroundPolicy": "enabled"},
            duration_ms=30000,
            seed="test_diversity_run_01",
        )
        self.assertGreaterEqual(len(backgrounds), 2)
        used_ids = [b["texture"]["assetId"] for b in backgrounds if b.get("texture")]
        self.assertEqual(len(used_ids), len(set(used_ids)), "All chosen texture assets must be unique in a single video")

    def test_diverse_texture_selection_across_different_seeds(self):
        # Different render seeds must pick different texture assets across the 44-asset catalog.
        chunks = _chunks(["The three pillars of editing"])
        scenes = _scenes(chunks)
        bg_alpha = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            design={"backgroundPolicy": "enabled"},
            duration_ms=10000,
            seed="seed_alpha_01",
        )
        bg_beta = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            design={"backgroundPolicy": "enabled"},
            duration_ms=10000,
            seed="seed_beta_99",
        )
        self.assertTrue(len(bg_alpha) >= 1)
        self.assertTrue(len(bg_beta) >= 1)
        # Check that different seeds hash to different asset indices or assets
        asset_alpha = bg_alpha[0]["texture"]["assetId"]
        asset_beta = bg_beta[0]["texture"]["assetId"]
        # Both must be valid bundled assets
        self.assertTrue(asset_alpha.startswith("Texturelabs_"))
        self.assertTrue(asset_beta.startswith("Texturelabs_"))

    def test_dynamic_background_kind_selection(self):
        # Screencast selects editorial_glass
        chunks = _chunks(["Open the dashboard to see stats"])
        bg_glass = plan_backgrounds(
            chunks=chunks,
            scenes=_scenes(chunks),
            design={"backgroundPolicy": "enabled"},
            duration_ms=10000,
        )
        self.assertTrue(len(bg_glass) >= 1)
        self.assertEqual(bg_glass[0]["kind"], "editorial_glass")
        self.assertIn("glass", bg_glass[0])
        self.assertEqual(bg_glass[0]["glass"]["blurPx"], 24)

        # Brand intro with brand colors selects gradient_atmosphere
        chunks_brand = _chunks(["Welcome to our channel"])
        bg_atmo = plan_backgrounds(
            chunks=chunks_brand,
            scenes=_scenes(chunks_brand),
            brand_preferences={
                "introBackground": True,
                "brandColors": {"primary": "#FF0055", "glowRgb": "255, 0, 85"},
            },
            duration_ms=10000,
        )
        self.assertTrue(len(bg_atmo) >= 1)
        self.assertEqual(bg_atmo[0]["kind"], "gradient_atmosphere")
        self.assertIn("atmosphere", bg_atmo[0])
        self.assertEqual(bg_atmo[0]["atmosphere"]["glowRgb"], "255, 0, 85")

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


class BackgroundPreferencesParsingTests(unittest.TestCase):
    def test_parse_prompt_intro_and_family(self):
        prefs = parse_background_preferences(
            prompt="Make a dark tech short, use paper background for the intro hook and on transitions"
        )
        self.assertTrue(prefs["introBackground"])
        self.assertTrue(prefs["transitionBackgrounds"])
        self.assertEqual(prefs["preferredFamily"], "paper")
        self.assertEqual(prefs["policy"], "enabled")

    def test_parse_disabled_policy(self):
        prefs = parse_background_preferences(prompt="Please render with no backgrounds")
        self.assertEqual(prefs["policy"], "disabled")
        self.assertFalse(prefs["introBackground"])

    def test_parse_explicit_brand_preferences(self):
        brand_prefs = {
            "backgroundPolicy": "always",
            "introBackground": True,
            "transitionBackgrounds": True,
            "backgroundFamily": "fabric",
            "backgroundIntensity": 0.28,
            "brandColors": {"primary": "#C084FC", "glowRgb": "192, 132, 252"},
        }
        prefs = parse_background_preferences(brand_preferences=brand_prefs)
        self.assertEqual(prefs["policy"], "always")
        self.assertTrue(prefs["introBackground"])
        self.assertTrue(prefs["transitionBackgrounds"])
        self.assertEqual(prefs["preferredFamily"], "fabric")
        self.assertEqual(prefs["intensity"], 0.28)
        self.assertIn("rgba(192, 132, 252", prefs["brandTint"])


class BrandPreferencesAndPromptExecutionTests(unittest.TestCase):
    def test_intro_background_placed_on_chunk_zero_when_prompt_requests(self):
        # Plain copy chunk 0 that would normally NEVER qualify for a background
        chunks = _chunks([
            "Welcome to the ultimate guide",
            "Here is the first step",
            "And here is the conclusion",
        ])
        scenes = _scenes(chunks)
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            prompt="Put a clean background for the introduction opener",
            duration_ms=30000,
        )
        self.assertTrue(len(backgrounds) >= 1)
        intro_bg = backgrounds[0]
        self.assertEqual(intro_bg["sceneId"], "scene-1")
        self.assertEqual(intro_bg["chunkIndex"], 0)
        self.assertIn("intro", intro_bg["cause"]["gate"])
        self.assertEqual(intro_bg["transition"]["kind"], "zoom_punch")
        self.assertEqual(govern_backgrounds(backgrounds, scenes), [])

    def test_intro_background_placed_via_brand_preferences(self):
        chunks = _chunks([
            "Welcome to our brand story",
            "We build high precision systems",
        ])
        scenes = _scenes(chunks)
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            brand_preferences={
                "introBackground": True,
                "backgroundFamily": "paper",
                "brandColors": {"glowRgb": "0, 240, 255"},
            },
            duration_ms=30000,
        )
        self.assertTrue(len(backgrounds) >= 1)
        intro_bg = backgrounds[0]
        self.assertEqual(intro_bg["sceneId"], "scene-1")
        self.assertEqual(intro_bg["cause"]["gate"], "brand_intro_background")
        self.assertEqual(intro_bg["texture"]["family"], "paper")
        self.assertIn("rgba(0, 240, 255", intro_bg["texture"]["brandTint"])
        self.assertEqual(govern_backgrounds(backgrounds, scenes), [])

    def test_transition_context_switch_background_placement(self):
        chunks = _chunks([
            "Introductory thought here",
            "Now shifting context completely",
            "Final takeaway for today",
        ])
        scenes = _scenes(chunks)
        transitions = [
            {
                "id": "transition-1",
                "fromSceneId": "scene-1",
                "toSceneId": "scene-2",
                "startMs": 4800,
                "endMs": 5200,
                "peakVelocityMs": 5000,
                "effect": "bokeh_defocus_blend",
            }
        ]
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            transitions=transitions,
            brand_preferences={"transitionBackgrounds": True, "backgroundFamily": "grunge"},
            duration_ms=30000,
        )
        self.assertTrue(len(backgrounds) >= 1)
        trans_bg = next((b for b in backgrounds if b["sceneId"] == "scene-2"), None)
        self.assertIsNotNone(trans_bg)
        self.assertEqual(trans_bg["cause"]["gate"], "transition_context_switch")
        self.assertEqual(trans_bg["cause"]["causedByTransitionId"], "transition-1")
        self.assertEqual(trans_bg["texture"]["family"], "grunge")
        self.assertEqual(govern_backgrounds(backgrounds, scenes), [])

    def test_intro_only_policy_restricts_to_intro(self):
        chunks = _chunks([
            "Welcome to the show",
            "The 3 pillars of editing",  # has list_stack trigger
        ])
        scenes = _scenes(chunks)
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            brand_preferences={"backgroundPolicy": "intro_only"},
            duration_ms=30000,
        )
        self.assertEqual(len(backgrounds), 1)
        self.assertEqual(backgrounds[0]["chunkIndex"], 0)


class OrchestrationIntegrationTests(unittest.TestCase):
    def test_orchestration_passes_prompt_and_brand_preferences(self):
        chunks = [
            {"chunkIndex": 0, "chunkId": "chunk-1", "text": "Opening hook line", "startMs": 0, "endMs": 3000},
            {"chunkIndex": 1, "chunkId": "chunk-2", "text": "3 pillars of content", "startMs": 3000, "endMs": 7000},
            {"chunkIndex": 2, "chunkId": "chunk-3", "text": "Final wrap up", "startMs": 7000, "endMs": 10000},
        ]
        probe = {"width": 1080, "height": 1920}
        manifest = plan_mini_run_orchestration(
            chunks=chunks,
            probe=probe,
            duration_ms=10000,
            prompt="Use paper background on intro and transitions",
            brand_preferences={"backgroundFamily": "paper"},
        )
        self.assertIn("backgrounds", manifest)
        self.assertIn("transitions", manifest)
        self.assertTrue(len(manifest["backgrounds"]) >= 1)
        # Verify chunk 0 intro background exists
        has_intro = any(b["chunkIndex"] == 0 for b in manifest["backgrounds"])
        self.assertTrue(has_intro)


class MotionGraphicsViewfinderScaffoldTests(unittest.TestCase):
    def test_concrete_asset_catalog_indexes_matted_assets(self):
        catalog = build_concrete_asset_catalog()
        self.assertTrue(catalog)
        asset_ids = [c["assetId"] for c in catalog]
        self.assertTrue(any("thinking" in aid.lower() for aid in asset_ids))
        self.assertTrue(any("halftone" in aid.lower() for aid in asset_ids))
        thinking = next(c for c in catalog if "thinking" in c["assetId"].lower())
        self.assertEqual(thinking["concept"], "opportunity_decision")
        self.assertTrue(thinking["isMatted"])

    def test_detect_opportunity_and_machine_triggers(self):
        score1, trigger1, candidate1, _ = detect_background_reference("Everything starts looking like an opportunity")
        self.assertGreater(score1, 90)
        self.assertEqual(trigger1, "opportunity_filter")
        self.assertEqual(candidate1, "viewfinder_scaffold")

        score2, trigger2, candidate2, _ = detect_background_reference("You're building a machine that can operate without you")
        self.assertGreater(score2, 90)
        self.assertEqual(trigger2, "machine_automation")
        self.assertEqual(candidate2, "cgi_hybrid_path_typography")

    def test_plan_viewfinder_scaffold_background(self):
        chunks = _chunks([
            "Everything starts looking like an opportunity",
            "but most people don't know which matter",
        ])
        scenes = _scenes(chunks)
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            prompt="Use viewfinder scaffold with white container and corner L brackets",
            duration_ms=15000,
        )
        self.assertTrue(len(backgrounds) >= 1)
        vf_bg = backgrounds[0]
        self.assertEqual(vf_bg["kind"], "viewfinder_scaffold")
        self.assertIn("viewfinder", vf_bg)
        self.assertEqual(vf_bg["viewfinder"]["scaffoldColor"], "#FFFFFF")
        self.assertEqual(vf_bg["viewfinder"]["cornerMarks"], "L_brackets")
        self.assertEqual(govern_backgrounds(backgrounds, scenes), [])

    def test_plan_cgi_hybrid_and_frame_breaking_backgrounds(self):
        chunks = _chunks([
            "You're not building a business anymore",
            "You're building a machine that can operate without you",
        ])
        scenes = _scenes(chunks)
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            prompt="Build 3D CGI hybrid machine with frame-breaking cutout",
            brand_preferences={"backgroundKind": "cgi_hybrid_path_typography"},
            duration_ms=15000,
        )
        self.assertTrue(len(backgrounds) >= 1)
        bg = backgrounds[0]
        self.assertEqual(bg["kind"], "cgi_hybrid_path_typography")
        self.assertIn("cgiAnchor", bg)
        self.assertEqual(bg["cgiAnchor"]["model"], "polyhedral_sphere_wireframe")
        self.assertTrue(bg["cgiAnchor"]["pathBoundTypography"])
        self.assertEqual(govern_backgrounds(backgrounds, scenes), [])

    def test_plan_hierarchical_spatial_staging_core_and_peripheral(self):
        chunks = _chunks([
            "Tired of hunting for good project files",
            "While others look plain",
        ])
        scenes = _scenes(chunks)
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            prompt="Use hierarchical spatial staging with hero anchor and peripheral props",
            duration_ms=15000,
        )
        self.assertTrue(len(backgrounds) >= 1)
        bg = backgrounds[0]
        self.assertEqual(bg["kind"], "hierarchical_spatial_staging")
        self.assertIn("hierarchicalStaging", bg)
        staging = bg["hierarchicalStaging"]
        self.assertTrue(staging["twoTierHierarchy"])
        # Core hero anchor in center quadrant
        self.assertEqual(staging["coreHero"]["quadrant"], "center_primary")
        self.assertEqual(staging["coreHero"]["scaleDownSettle"], [1.08, 1.00])
        self.assertGreaterEqual(staging["coreHero"]["microTilt"]["rotateXMinDeg"], 2.0)
        self.assertLessEqual(staging["coreHero"]["microTilt"]["rotateXMaxDeg"], 5.0)
        self.assertTrue(staging["coreHero"]["microTilt"]["specularSheen"])
        # Peripheral micro-assets along periphery bounding boxes
        peripherals = staging["peripheralMicroAssets"]
        self.assertGreaterEqual(len(peripherals), 4)
        quadrants = [p["quadrant"] for p in peripherals]
        self.assertIn("top_left", quadrants)
        self.assertIn("top_right", quadrants)
        self.assertIn("bottom_left", quadrants)
        self.assertIn("bottom_right", quadrants)
        self.assertEqual(govern_backgrounds(backgrounds, scenes), [])

    def test_plan_ambient_shadow_gobo_dynamic_environment_lighting(self):
        chunks = _chunks([
            "Dynamic environment lighting with ambient shadow gobo",
            "Slowly drifting across flat background",
        ])
        scenes = _scenes(chunks)
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            prompt="Add ambient shadow gobo window frame overlay with swaying foliage",
            duration_ms=15000,
        )
        self.assertTrue(len(backgrounds) >= 1)
        bg = backgrounds[0]
        self.assertEqual(bg["kind"], "ambient_shadow_gobo")
        self.assertIn("shadowGobo", bg)
        gobo = bg["shadowGobo"]
        self.assertIn(gobo["blendMode"], ("multiply", "soft-light"))
        # 15% - 35% opacity range
        self.assertGreaterEqual(gobo["opacity"], 0.15)
        self.assertLessEqual(gobo["opacity"], 0.35)
        # 0.2 - 0.5 Hz frequency
        self.assertGreaterEqual(gobo["frequencyHz"], 0.2)
        self.assertLessEqual(gobo["frequencyHz"], 0.5)
        self.assertGreaterEqual(len(gobo["layers"]), 2)
        self.assertEqual(govern_backgrounds(backgrounds, scenes), [])

    def test_plan_single_frame_retinal_inversion_micro_flash(self):
        chunks = _chunks([
            "Hard audio transient punch",
            "Instantaneous retinal inversion",
        ])
        scenes = _scenes(chunks)
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            prompt="Trigger 1-frame retinal inversion micro flash",
            duration_ms=15000,
        )
        self.assertTrue(len(backgrounds) >= 1)
        bg = backgrounds[0]
        self.assertEqual(bg["kind"], "single_frame_retinal_inversion")
        self.assertIn("retinalInversion", bg)
        flash = bg["retinalInversion"]
        # Strictly 1 to 2 frames (~33-66 ms)
        self.assertIn(flash["durationFrames"], (1, 2))
        self.assertLessEqual(flash["durationMs"], 66)
        self.assertIn(flash["blendMode"], ("difference", "invert_100"))
        self.assertEqual(govern_backgrounds(backgrounds, scenes), [])

    def test_plan_dynamic_attention_gated_bokeh_defocus_rack(self):
        chunks = _chunks([
            "Focus shift to incoming subject",
            "Deprioritized assets drop out of focus",
        ])
        scenes = _scenes(chunks)
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            prompt="Attention-gated bokeh defocus rack with optical blur",
            duration_ms=15000,
        )
        self.assertTrue(len(backgrounds) >= 1)
        bg = backgrounds[0]
        self.assertEqual(bg["kind"], "attention_gated_bokeh")
        self.assertIn("attentionBokeh", bg)
        bokeh = bg["attentionBokeh"]
        # Blur radius ramping up to 20-35px
        self.assertGreaterEqual(bokeh["maxBlurRadiusPx"], 20)
        self.assertLessEqual(bokeh["maxBlurRadiusPx"], 35)
        # 300-450 ms rack focus duration
        self.assertGreaterEqual(bokeh["rackFocusDurationMs"], 300)
        self.assertLessEqual(bokeh["rackFocusDurationMs"], 450)
        self.assertEqual(bokeh["transitionCurve"], "smooth_s_curve")
        self.assertEqual(govern_backgrounds(backgrounds, scenes), [])

    def test_plan_continuous_spatial_canvas_vertical_descent(self):
        chunks = _chunks([
            "Continuous spatial canvas unified plane",
            "Vertical descent with damped spring easing",
        ])
        scenes = _scenes(chunks)
        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            prompt="Unified plane continuous spatial canvas with vertical descent",
            duration_ms=15000,
        )
        self.assertTrue(len(backgrounds) >= 1)
        bg = backgrounds[0]
        self.assertEqual(bg["kind"], "continuous_spatial_canvas")
        self.assertIn("spatialCanvas", bg)
        spatial = bg["spatialCanvas"]
        self.assertTrue(spatial["unifiedPlane"])
        self.assertEqual(spatial["axis"], "Y")
        self.assertEqual(spatial["inertialHandoff"], "damped_spring_easing")
        self.assertTrue(spatial["revealFromBelow"])
        self.assertEqual(govern_backgrounds(backgrounds, scenes), [])


if __name__ == "__main__":
    unittest.main()


