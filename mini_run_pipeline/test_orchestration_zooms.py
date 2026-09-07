import unittest

from mini_run_pipeline.orchestration import (
    ZOOM_JCUT_LEAD_MS,
    ZOOM_KINDS,
    ZOOM_MIN_GAP_MS,
    govern_camera_moves,
    plan_mini_run_orchestration,
    plan_zoom_ins,
)


def _scene(scene_id: str, start_ms: int, end_ms: int, salience: float) -> dict:
    return {
        "id": scene_id,
        "startMs": start_ms,
        "endMs": end_ms,
        "salience": salience,
    }


def _qualifying_chunk(text: str, **extra) -> dict:
    return {"text": text, "chunkIndex": 0, **extra}


class ZoomPlanTests(unittest.TestCase):
    def test_numeric_beat_gets_fast_punch_in(self) -> None:
        chunks = [
            _qualifying_chunk("Here is the thing"),
            _qualifying_chunk("3 million dollars", chunkIndex=1),
        ]
        scenes = [
            _scene("scene-1", 0, 3000, 0.4),
            _scene("scene-2", 3000, 6000, 0.5),
        ]
        plan = plan_zoom_ins(
            chunks=chunks,
            scenes=scenes,
            duration_ms=8000,
            rng=__import__("random").Random(7),
        )
        self.assertEqual(len(plan["cameraMoves"]), 1)
        move = plan["cameraMoves"][0]
        self.assertEqual(move["kind"], "fast_punch_in")
        self.assertEqual(move["startScale"], 1.0)
        self.assertEqual(move["endScale"], ZOOM_KINDS["fast_punch_in"]["endScale"])
        self.assertEqual(move["cause"]["gate"], "numeric_beat")
        self.assertEqual(move["startMs"], 3000)

    def test_hero_beat_gets_slow_push_in(self) -> None:
        chunks = [
            _qualifying_chunk("Some plain words here"),
            _qualifying_chunk("The golden rule", isHero=True, chunkIndex=1),
        ]
        scenes = [
            _scene("scene-1", 0, 3000, 0.4),
            _scene("scene-2", 3000, 6000, 0.5),
        ]
        plan = plan_zoom_ins(
            chunks=chunks,
            scenes=scenes,
            duration_ms=8000,
        )
        self.assertEqual(len(plan["cameraMoves"]), 1)
        move = plan["cameraMoves"][0]
        self.assertEqual(move["kind"], "slow_push_in")
        self.assertEqual(move["cause"]["gate"], "hero_beat")

    def test_low_impact_chunk_never_zooms(self) -> None:
        chunks = [
            _qualifying_chunk("Just talking normally"),
            _qualifying_chunk("and more talking", chunkIndex=1),
        ]
        scenes = [
            _scene("scene-1", 0, 3000, 0.4),
            _scene("scene-2", 3000, 6000, 0.45),
        ]
        plan = plan_zoom_ins(chunks=chunks, scenes=scenes, duration_ms=8000)
        self.assertEqual(plan["cameraMoves"], [])
        self.assertEqual(plan["sfx"], [])

    def test_first_chunk_never_zooms(self) -> None:
        chunks = [_qualifying_chunk("3 million dollars right now")]
        scenes = [_scene("scene-1", 0, 3000, 0.9)]
        plan = plan_zoom_ins(chunks=chunks, scenes=scenes, duration_ms=4000)
        self.assertEqual(plan["cameraMoves"], [])

    def test_spacing_policy_blocks_close_zooms(self) -> None:
        chunks = [
            _qualifying_chunk("plain"),
            _qualifying_chunk("first pillar", chunkIndex=1),
            _qualifying_chunk("second pillar", chunkIndex=2),
            _qualifying_chunk("third pillar", chunkIndex=3),
        ]
        scenes = [
            _scene("scene-1", 0, 2000, 0.3),
            _scene("scene-2", 2000, 4000, 0.4),
            _scene("scene-3", 4000, 6000, 0.4),
            _scene("scene-4", 8000, 12000, 0.4),
        ]
        plan = plan_zoom_ins(chunks=chunks, scenes=scenes, duration_ms=14000)
        starts = [move["startMs"] for move in plan["cameraMoves"]]
        self.assertTrue(starts)
        for earlier, later in zip(starts, starts[1:]):
            self.assertGreaterEqual(later - earlier, ZOOM_MIN_GAP_MS)

    def test_jcut_zoom_leads_text_onset(self) -> None:
        chunks = [
            _qualifying_chunk("plain"),
            _qualifying_chunk("first pillar", chunkIndex=1),
        ]
        scenes = [
            _scene("scene-1", 0, 2500, 0.3),
            _scene("scene-2", 2500, 5000, 0.4),
        ]
        rng = __import__("random").Random(3)
        for _ in range(8):  # list_entry alternates kinds; force the J-cut branch
            plan = plan_zoom_ins(
                chunks=chunks, scenes=scenes, duration_ms=6000, rng=rng
            )
            if plan["cameraMoves"] and plan["cameraMoves"][0]["kind"] == "jcut_zoom_in":
                move = plan["cameraMoves"][0]
                self.assertLess(move["startMs"], 2500)
                self.assertEqual(move["startMs"], 2500 - ZOOM_JCUT_LEAD_MS)
                return
        self.fail("J-cut variant never sampled in 8 trials")

    def test_zoom_sfx_carries_cue_and_cause(self) -> None:
        chunks = [
            _qualifying_chunk("plain"),
            _qualifying_chunk("we collapsed hard", chunkIndex=1),
        ]
        scenes = [
            _scene("scene-1", 0, 3000, 0.3),
            _scene("scene-2", 3000, 6000, 0.4),
        ]
        plan = plan_zoom_ins(chunks=chunks, scenes=scenes, duration_ms=8000)
        self.assertEqual(len(plan["sfx"]), 1)
        sfx = plan["sfx"][0]
        self.assertEqual(sfx["cue"], ZOOM_KINDS["fast_punch_in"]["sfxCue"])
        self.assertEqual(sfx["causedByCameraMoveId"], plan["cameraMoves"][0]["id"])
        self.assertEqual(sfx["triggerMs"], plan["cameraMoves"][0]["startMs"])

    def test_max_zooms_cap(self) -> None:
        chunks = [
            _qualifying_chunk("plain"),
            _qualifying_chunk("first pillar", chunkIndex=1),
            _qualifying_chunk("10 percent", chunkIndex=2),
            _qualifying_chunk("they collapsed", chunkIndex=3),
            _qualifying_chunk("20 million", chunkIndex=4),
        ]
        scenes = [
            _scene("scene-1", 0, 2000, 0.3),
            _scene("scene-2", 2000, 6500, 0.4),
            _scene("scene-3", 6500, 11000, 0.4),
            _scene("scene-4", 11000, 15500, 0.4),
            _scene("scene-5", 15500, 20000, 0.4),
        ]
        plan = plan_zoom_ins(
            chunks=chunks, scenes=scenes, duration_ms=20000, design={"maxZooms": 2}
        )
        self.assertEqual(len(plan["cameraMoves"]), 2)

    def test_zoom_policy_disabled(self) -> None:
        chunks = [_qualifying_chunk("plain"), _qualifying_chunk("10 percent", chunkIndex=1)]
        scenes = [_scene("scene-1", 0, 3000, 0.3), _scene("scene-2", 3000, 6000, 0.4)]
        plan = plan_zoom_ins(
            chunks=chunks, scenes=scenes, duration_ms=8000, design={"zoomPolicy": "disabled"}
        )
        self.assertEqual(plan["cameraMoves"], [])
        self.assertEqual(plan["sfx"], [])

    def test_zoom_kinds_scale_parameters(self) -> None:
        pull_backs = {"zoom_out_snap", "match_cut_zoom"}
        for kind, spec in ZOOM_KINDS.items():
            if kind in pull_backs:
                self.assertLess(spec["endScale"], spec["startScale"], f"{kind} must pull back")
            else:
                self.assertGreater(spec["endScale"], spec["startScale"], f"{kind} must scale IN")
            self.assertLessEqual(max(spec["startScale"], spec["endScale"]), 1.25, f"{kind} exceeds composure ceiling")
            self.assertGreaterEqual(min(spec["startScale"], spec["endScale"]), 1.0, f"{kind} drops below 1.0 floor")

    def test_joseph_edit_selected_from_prompt(self) -> None:
        chunks = [
            _qualifying_chunk("plain intro"),
            _qualifying_chunk("we lost everything", chunkIndex=1),
        ]
        scenes = [_scene("scene-1", 0, 3000, 0.3), _scene("scene-2", 3000, 7000, 0.4)]
        plan = plan_zoom_ins(
            chunks=chunks,
            scenes=scenes,
            duration_ms=8000,
            prompt="Make this video punchy with the Joseph Edit style zooming",
        )
        self.assertEqual(len(plan["cameraMoves"]), 1)
        move = plan["cameraMoves"][0]
        self.assertEqual(move["kind"], "joseph_edit")
        self.assertTrue(move.get("cutbackAtEnd"))
        self.assertEqual(move["endScale"], 1.10)
        # SFX click triggers at cut-back (endMs)
        self.assertEqual(plan["sfx"][0]["triggerMs"], move["endMs"])
        self.assertEqual(plan["sfx"][0]["cue"], "click_bupu")

    def test_hitchcock_dolly_selected_with_parallax(self) -> None:
        chunks = [
            _qualifying_chunk("intro"),
            _qualifying_chunk("this changes everything", isHero=True, chunkIndex=1),
        ]
        scenes = [_scene("scene-1", 0, 3000, 0.3), _scene("scene-2", 3000, 7000, 0.4)]
        plan = plan_zoom_ins(
            chunks=chunks,
            scenes=scenes,
            duration_ms=8000,
            brand_preferences={"preferredZoomKind": "hitchcock_dolly"},
        )
        move = plan["cameraMoves"][0]
        self.assertEqual(move["kind"], "hitchcock_dolly")
        self.assertIn("dollyParallax", move)
        self.assertEqual(move["dollyParallax"]["backgroundScale"], 1.22)
        self.assertEqual(move["dollyParallax"]["subjectScale"], 1.02)

    def test_twist_zoom_selected_with_rotation(self) -> None:
        chunks = [
            _qualifying_chunk("intro"),
            _qualifying_chunk("3 million dollars", chunkIndex=1),
        ]
        scenes = [_scene("scene-1", 0, 3000, 0.3), _scene("scene-2", 3000, 7000, 0.4)]
        plan = plan_zoom_ins(
            chunks=chunks,
            scenes=scenes,
            duration_ms=8000,
            prompt="use twist zoom for high energy impact",
            rng=__import__("random").Random(42),
        )
        move = plan["cameraMoves"][0]
        self.assertEqual(move["kind"], "twist_zoom")
        self.assertIn("rotationDeg", move)
        self.assertGreaterEqual(move["rotationDeg"], -4.5)
        self.assertLessEqual(move["rotationDeg"], 4.5)

    def test_punch_zoom_selected_with_instant_jump(self) -> None:
        chunks = [
            _qualifying_chunk("intro"),
            _qualifying_chunk("failed again", chunkIndex=1),
        ]
        scenes = [_scene("scene-1", 0, 3000, 0.3), _scene("scene-2", 3000, 7000, 0.4)]
        plan = plan_zoom_ins(
            chunks=chunks,
            scenes=scenes,
            duration_ms=8000,
            brand_preferences={"preferredZoomKind": "punch_zoom"},
        )
        move = plan["cameraMoves"][0]
        self.assertEqual(move["kind"], "punch_zoom")
        self.assertTrue(move.get("instantJump"))

    def test_eye_line_subject_anchoring(self) -> None:
        chunks = [
            _qualifying_chunk("intro"),
            _qualifying_chunk("3 million dollars", chunkIndex=1),
        ]
        scenes = [_scene("scene-1", 0, 3000, 0.3), _scene("scene-2", 3000, 7000, 0.4)]
        # Observation tracking speaker at x=0.35, y=0.10, width=0.40, height=0.50
        # Subject center X: 0.35 + 0.20 = 0.55 -> 55.0%
        # Eye line Y: 0.10 + 0.50 * 0.30 = 0.25 -> 25.0%
        subject_obs = {
            "frames": [
                {
                    "sourceMs": 3500,
                    "subjectBox": {"x": 0.35, "y": 0.10, "width": 0.40, "height": 0.50},
                }
            ]
        }
        plan = plan_zoom_ins(
            chunks=chunks,
            scenes=scenes,
            duration_ms=8000,
            subject_observation=subject_obs,
        )
        move = plan["cameraMoves"][0]
        self.assertEqual(move["anchorPoint"]["xPercent"], 55.0)
        self.assertEqual(move["anchorPoint"]["yPercent"], 25.0)


class ZoomGovernanceTests(unittest.TestCase):
    def test_clean_plan_has_no_issues(self) -> None:
        chunks = [
            _qualifying_chunk("plain"),
            _qualifying_chunk("10 percent", chunkIndex=1),
        ]
        scenes = [_scene("scene-1", 0, 3000, 0.3), _scene("scene-2", 3000, 8000, 0.4)]
        plan = plan_zoom_ins(chunks=chunks, scenes=scenes, duration_ms=9000)
        self.assertEqual(govern_camera_moves(plan["cameraMoves"], scenes), [])

    def test_inverted_window_flagged(self) -> None:
        moves = [{"id": "zoom-x", "startMs": 5000, "endMs": 4000, "causedBySceneId": "scene-1", "cause": {"gate": "hero_beat"}, "startScale": 1.0, "endScale": 1.1}]
        issues = govern_camera_moves(moves, [_scene("scene-1", 0, 8000, 0.4)])
        self.assertTrue(any("inverted" in issue for issue in issues))

    def test_zoom_out_flagged_for_normal_zooms(self) -> None:
        moves = [{"id": "zoom-x", "startMs": 1000, "endMs": 2000, "causedBySceneId": "scene-1", "cause": {"gate": "hero_beat"}, "startScale": 1.1, "endScale": 1.0}]
        issues = govern_camera_moves(moves, [_scene("scene-1", 0, 8000, 0.4)])
        self.assertTrue(any("scale IN" in issue for issue in issues))

    def test_zoom_out_snap_allowed_in_governance(self) -> None:
        moves = [{"id": "zoom-snap", "startMs": 1000, "endMs": 1600, "kind": "zoom_out_snap", "causedBySceneId": "scene-1", "cause": {"gate": "salience_spike"}, "startScale": 1.15, "endScale": 1.0}]
        issues = govern_camera_moves(moves, [_scene("scene-1", 0, 8000, 0.4)])
        self.assertEqual(issues, [])

    def test_extreme_rotation_flagged(self) -> None:
        moves = [{"id": "zoom-rot", "startMs": 1000, "endMs": 2000, "kind": "twist_zoom", "rotationDeg": 55.0, "causedBySceneId": "scene-1", "cause": {"gate": "hero_beat"}, "startScale": 1.0, "endScale": 1.15}]
        issues = govern_camera_moves(moves, [_scene("scene-1", 0, 8000, 0.4)])
        self.assertTrue(any("rotation" in issue for issue in issues))

    def test_excessive_scale_flagged(self) -> None:
        moves = [{"id": "zoom-x", "startMs": 1000, "endMs": 2000, "causedBySceneId": "scene-1", "cause": {"gate": "hero_beat"}, "startScale": 1.0, "endScale": 1.4}]
        issues = govern_camera_moves(moves, [_scene("scene-1", 0, 8000, 0.4)])
        self.assertTrue(any("composure ceiling" in issue for issue in issues))

    def test_spacing_violation_flagged(self) -> None:
        moves = [
            {"id": "zoom-a", "startMs": 1000, "endMs": 2000, "causedBySceneId": "scene-1", "cause": {"gate": "hero_beat"}, "startScale": 1.0, "endScale": 1.1},
            {"id": "zoom-b", "startMs": 1000 + ZOOM_MIN_GAP_MS - 500, "endMs": 1000 + ZOOM_MIN_GAP_MS + 500, "causedBySceneId": "scene-1", "cause": {"gate": "hero_beat"}, "startScale": 1.0, "endScale": 1.1},
        ]
        issues = govern_camera_moves(moves, [_scene("scene-1", 0, 30000, 0.4)])
        self.assertTrue(any("spacing policy" in issue for issue in issues))

    def test_unknown_scene_flagged(self) -> None:
        moves = [{"id": "zoom-x", "startMs": 1000, "endMs": 2000, "causedBySceneId": "scene-99", "cause": {"gate": "hero_beat"}, "startScale": 1.0, "endScale": 1.1}]
        issues = govern_camera_moves(moves, [_scene("scene-1", 0, 8000, 0.4)])
        self.assertTrue(any("unknown scene" in issue for issue in issues))

    def test_missing_gate_flagged(self) -> None:
        moves = [{"id": "zoom-x", "startMs": 1000, "endMs": 2000, "causedBySceneId": "scene-1", "cause": {"gate": ""}, "startScale": 1.0, "endScale": 1.1}]
        issues = govern_camera_moves(moves, [_scene("scene-1", 0, 8000, 0.4)])
        self.assertTrue(any("impact gate" in issue for issue in issues))


class OrchestrationZoomIntegrationTests(unittest.TestCase):
    def test_orchestration_manifest_carries_zooms_and_sfx(self) -> None:
        chunks = [
            _qualifying_chunk("Here is my story", chunkIndex=0, startMs=0, endMs=3000),
            _qualifying_chunk("and it changed", chunkIndex=1, startMs=3000, endMs=6000),
            _qualifying_chunk("3 million dollars", chunkIndex=2, startMs=6000, endMs=10000),
        ]
        manifest = plan_mini_run_orchestration(
            chunks=chunks,
            probe={"width": 1080, "height": 1920},
            duration_ms=10000,
        )
        zoom_moves = [move for move in manifest["cameraMoves"] if move["kind"] in ZOOM_KINDS]
        self.assertEqual(len(zoom_moves), 1)
        self.assertEqual(zoom_moves[0]["causedBySceneId"], "scene-3")
        self.assertEqual(zoom_moves[0]["cause"]["gate"], "numeric_beat")
        zoom_sfx = [event for event in manifest["sfx"] if event.get("causedByCameraMoveId")]
        self.assertEqual(len(zoom_sfx), 1)
        self.assertEqual(zoom_sfx[0]["cue"], ZOOM_KINDS["fast_punch_in"]["sfxCue"])

    def test_orchestration_without_impact_chunks_has_no_zooms(self) -> None:
        chunks = [
            _qualifying_chunk("Nothing special", chunkIndex=0, startMs=0, endMs=4000),
            _qualifying_chunk("nothing special here", chunkIndex=1, startMs=4000, endMs=8000),
        ]
        manifest = plan_mini_run_orchestration(
            chunks=chunks,
            probe={"width": 1080, "height": 1920},
            duration_ms=8000,
        )
        self.assertEqual(manifest["cameraMoves"], [])
        self.assertFalse(any(event.get("causedByCameraMoveId") for event in manifest["sfx"]))


class TransitionAndAudioGainTests(unittest.TestCase):
    def test_transitions_generate_film_burn_and_proper_cadence(self) -> None:
        chunks = [
            _qualifying_chunk("Opening statement here.", chunkIndex=0, startMs=0, endMs=4500),
            _qualifying_chunk("Second narrative shift now.", chunkIndex=1, startMs=4500, endMs=9000),
            _qualifying_chunk("Third critical turning point.", chunkIndex=2, startMs=9000, endMs=14000),
            _qualifying_chunk("Final concluding remarks.", chunkIndex=3, startMs=14000, endMs=18000),
        ]
        manifest = plan_mini_run_orchestration(
            chunks=chunks,
            probe={"width": 1080, "height": 1920},
            duration_ms=18000,
            prompt="Make a vintage cinematic short with film burn transitions",
        )
        transitions = manifest["transitions"]
        self.assertGreaterEqual(len(transitions), 2)
        # Should detect film burn request in prompt
        self.assertTrue(any(tr["effect"] in ("film_burn", "film_burn_strobe") for tr in transitions))
        # SFX for transitions must be punchy broadcast gain (-8.5 to -9.5 dB)
        trans_sfx = [s for s in manifest["sfx"] if s.get("causedByTransitionId")]
        self.assertGreaterEqual(len(trans_sfx), 2)
        for s in trans_sfx:
            self.assertGreaterEqual(s["gainDb"], -10.0)
            self.assertLessEqual(s["gainDb"], -8.0)

    def test_audio_gain_levels_are_clearly_audible(self) -> None:
        chunks = [
            _qualifying_chunk("SingleWord", chunkIndex=0, startMs=0, endMs=3000, hookPlan={"hookEnabled": True, "hookType": "hook_impact"}),
            _qualifying_chunk("Focus", chunkIndex=1, startMs=3000, endMs=5000, words=[{"word": "Focus"}]),
            _qualifying_chunk("3 million dollars", chunkIndex=2, startMs=5000, endMs=8000),
        ]
        manifest = plan_mini_run_orchestration(
            chunks=chunks,
            probe={"width": 1080, "height": 1920},
            duration_ms=8000,
        )
        # Hook impact SFX must be >= -8.0 dB
        hook_sfx = [s for s in manifest["sfx"] if s.get("causedByHook")]
        if hook_sfx:
            self.assertGreaterEqual(hook_sfx[0]["gainDb"], -8.0)

        # Single word click SFX must be audible (>= -14.0 dB, not -26 dB)
        text_sfx = [s for s in manifest["sfx"] if s["id"].startswith("sfx-text-entry")]
        if text_sfx:
            self.assertGreaterEqual(text_sfx[0]["gainDb"], -14.0)

        # Zoom SFX must be audible (>= -10.0 dB)
        zoom_sfx = [s for s in manifest["sfx"] if s.get("causedByCameraMoveId")]
        if zoom_sfx:
            self.assertGreaterEqual(zoom_sfx[0]["gainDb"], -10.0)


if __name__ == "__main__":
    unittest.main()
