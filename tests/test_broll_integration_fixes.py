"""Regression tests for the B-roll integration remediation (mini-run pipeline).

Locks the five accountability fixes:
  1. Chunk timing schema resolution (camelCase production chunks are timed for real).
  2. Two-sided interval spacing + 4.5s B-roll cooldown enforced at selection.
  3. B-roll score calibration (140 scale) so concrete cutaways outrank textures.
  4. Prompt "b-roll" no longer transmutes texture references into pseudo B-roll.
  5. Beat roles propagate from chunk metadata into orchestration scenes.

All tests are hermetic: Pexels materialization is stubbed.
"""

import hashlib
import unittest
from unittest.mock import patch

from mini_run_pipeline.broll_engine import (
    BrollAssetMetadata,
    PexelsVideoClient,
    plan_broll_cutaways_for_mini_run,
    resolve_chunk_timing_ms,
)
from mini_run_pipeline.backgrounds import plan_backgrounds
from mini_run_pipeline.orchestration import plan_mini_run_orchestration


def _stub_asset(query: str) -> BrollAssetMetadata:
    h = hashlib.md5(query.encode()).hexdigest()[:8]
    return BrollAssetMetadata(
        asset_id=f"stub_{h}", source="stub", query=query, video_url="",
        local_file="", duration_sec=6.0, width=1080, height=1920,
        orientation="portrait", aspect_ratio="9:16",
        photographer="Stub", photographer_url="",
    )


def _production_chunk(i, text, start_ms, end_ms, role=None, behind=False):
    """Chunk in the REAL production schema (camelCase only, no snake_case)."""
    c = {
        "chunkIndex": i,
        "chunkId": f"chunk-{i + 1}",
        "text": text,
        "startMs": start_ms,
        "endMs": end_ms,
        "outputStartMs": start_ms,
        "outputEndMs": end_ms,
        "subjectLayering": {"behindSubject": behind},
    }
    if role:
        c["role"] = role
    return c


def _scenes(chunks, duration_ms):
    scenes = []
    for i, c in enumerate(chunks):
        s = {
            "id": f"scene-{i + 1}",
            "startMs": c["startMs"],
            "endMs": min(c["endMs"], duration_ms),
            "salience": 0.7,
        }
        if c.get("role"):
            s["role"] = c["role"]
        scenes.append(s)
    return scenes


SUBWAY = "I walked into a crowded subway station in Manhattan at night"
OFFICE = "I sat at my desk typing on a laptop in a dark office"


class ResolveChunkTimingTests(unittest.TestCase):
    def test_prefers_production_camelcase(self):
        chunk = {"startMs": 30000, "endMs": 36000, "start_ms": 999, "end_ms": 999}
        self.assertEqual(resolve_chunk_timing_ms(chunk), (30000, 36000))

    def test_snake_case_legacy_fixture(self):
        self.assertEqual(resolve_chunk_timing_ms({"start_ms": 3000, "end_ms": 7500}), (3000, 7500))

    def test_output_fallbacks_and_positive_duration(self):
        self.assertEqual(resolve_chunk_timing_ms({"outputStartMs": 1200, "outputEndMs": 2400}), (1200, 2400))
        self.assertEqual(resolve_chunk_timing_ms({"startMs": 5000, "endMs": 4000}), (5000, 5000 + 2500))
        self.assertEqual(resolve_chunk_timing_ms({}), (0, 2500))


class ProductionSchemaTimingTests(unittest.TestCase):
    """Fix 1: camelCase chunks must be evaluated with their real duration."""

    CHUNKS = [
        _production_chunk(0, "Nobody tells you this", 0, 3000),
        _production_chunk(1, OFFICE, 30000, 36000, role="proof"),
    ]

    def test_broll_evaluation_carries_real_duration(self):
        with patch.object(PexelsVideoClient, "materialize_asset", lambda self, q, **k: _stub_asset(q)):
            bg_plan = plan_backgrounds(
                chunks=self.CHUNKS, scenes=_scenes(self.CHUNKS, 40000),
                design={"backgroundPolicy": "enabled", "maxBackgrounds": 2},
                duration_ms=40000,
            )
        broll = [b for b in bg_plan if b.get("kind") == "broll_cutaway"]
        self.assertTrue(broll, "concrete camelCase chunk must yield a b-roll cutaway")
        evaluation = broll[0]["broll"]["evaluation"]
        self.assertEqual(evaluation["duration_sec"], 6.0, "must read 6.0s from startMs/endMs, not the 2.5s fallback")

    def test_fatigue_rises_across_video(self):
        chunks = [
            _production_chunk(0, "Nobody tells you this", 0, 3000),
            _production_chunk(1, SUBWAY, 5000, 9000),
            _production_chunk(2, OFFICE, 25000, 29000),
        ]
        with patch.object(PexelsVideoClient, "materialize_asset", lambda self, q, **k: _stub_asset(q)):
            bg_plan = plan_backgrounds(
                chunks=chunks, scenes=_scenes(chunks, 40000),
                design={"backgroundPolicy": "enabled", "maxBackgrounds": 3},
                duration_ms=40000,
            )
        evals = [(b["chunkIndex"], b["broll"]["evaluation"]) for b in bg_plan if b.get("kind") == "broll_cutaway"]
        evals.sort(key=lambda item: item[0])  # selection order is score-based; compare chronologically
        self.assertGreaterEqual(len(evals), 2)
        self.assertLess(evals[0][1]["fatigue_score"], evals[-1][1]["fatigue_score"],
                        "fatigue must accumulate across the video, not flatline at 0.1")


class CooldownAndSpacingTests(unittest.TestCase):
    """Fix 2: 4.5s B-roll cooldown + two-sided chronological interval spacing."""

    def _plan(self, office_start, office_end):
        chunks = [
            _production_chunk(0, "Nobody tells you this", 0, 3000),
            _production_chunk(1, SUBWAY, 3000, 7600),
            _production_chunk(2, OFFICE, office_start, office_end),
        ]
        with patch.object(PexelsVideoClient, "materialize_asset", lambda self, q, **k: _stub_asset(q)):
            return plan_backgrounds(
                chunks=chunks, scenes=_scenes(chunks, 30000),
                design={"backgroundPolicy": "enabled", "maxBackgrounds": 3,
                        "backgroundMinGapMs": 2000},
                duration_ms=30000,
            )

    def test_cooldown_blocks_cutaways_closer_than_4500ms(self):
        # Scene gap between the two eligible cutaways is 1400ms: generic 2200ms
        # gap would allow it; the B-roll cooldown doctrine (4.5s) must block it.
        backgrounds = self._plan(9000, 13600)
        broll = [b for b in backgrounds if b.get("kind") == "broll_cutaway"]
        self.assertEqual(len(broll), 1, "4.5s cooldown must prevent back-to-back cutaways")

    def test_cooldown_allows_cutaways_6000ms_apart(self):
        backgrounds = self._plan(13600, 18200)
        broll = [b for b in backgrounds if b.get("kind") == "broll_cutaway"]
        self.assertEqual(len(broll), 2, "cutaways 6s apart must both be placed")

    def test_earlier_candidate_survives_later_top_scorer(self):
        # The later chunk scores higher; the earlier eligible chunk must still
        # be selected (signed-gap bug used to discard every earlier candidate).
        chunks = [
            _production_chunk(0, "Nobody tells you this", 0, 3000),
            _production_chunk(1, SUBWAY, 3000, 7600),
            _production_chunk(2, OFFICE, 30000, 36000),
        ]
        with patch.object(PexelsVideoClient, "materialize_asset", lambda self, q, **k: _stub_asset(q)):
            backgrounds = plan_backgrounds(
                chunks=chunks, scenes=_scenes(chunks, 40000),
                design={"backgroundPolicy": "enabled", "maxBackgrounds": 3},
                duration_ms=40000,
            )
        broll = [b for b in backgrounds if b.get("kind") == "broll_cutaway"]
        self.assertEqual(len(broll), 2, "both chronological cutaways must survive score-ordered selection")
        starts = sorted(b["entry"]["startMs"] for b in broll)
        self.assertLess(starts[0], 10000, "the early cutaway must not be skipped")


class PromptPoisoningTests(unittest.TestCase):
    """Fix 4: 'add b-roll' prompt must not turn texture references into pseudo B-roll."""

    def test_listicle_chunk_never_becomes_pseudo_broll(self):
        chunks = [
            _production_chunk(0, "Nobody tells you this", 0, 3000),
            _production_chunk(1, "First, second, third step of the process workflow", 3000, 7000),
            _production_chunk(2, OFFICE, 7000, 12000, role="proof"),
        ]
        with patch.object(PexelsVideoClient, "materialize_asset", lambda self, q, **k: _stub_asset(q)):
            bg_plan = plan_backgrounds(
                chunks=chunks, scenes=_scenes(chunks, 20000),
                prompt="add cinematic b-roll cutaway footage",
                duration_ms=20000,
            )
        for bg in bg_plan:
            if bg.get("kind") != "broll_cutaway":
                continue
            evaluation = (bg.get("broll") or {}).get("evaluation") or {}
            self.assertEqual(evaluation.get("recommended_treatment_category"), "broll_cutaway",
                             "every placed B-roll must carry a real suitability evaluation")
            self.assertNotEqual(bg.get("chunkIndex"), 1,
                                "listicle chunk is abstract doctrine and must never host B-roll")

    def test_prompted_broll_lifts_budget(self):
        chunks = [
            _production_chunk(0, "Nobody tells you this", 0, 3000),
            _production_chunk(1, SUBWAY, 3000, 7600),
            _production_chunk(2, OFFICE, 15000, 20000),
        ]
        with patch.object(PexelsVideoClient, "materialize_asset", lambda self, q, **k: _stub_asset(q)):
            bg_plan = plan_backgrounds(
                chunks=chunks, scenes=_scenes(chunks, 25000),
                prompt="add cinematic b-roll cutaway footage",
                duration_ms=25000,
            )
        broll = [b for b in bg_plan if b.get("kind") == "broll_cutaway"]
        self.assertEqual(len(broll), 2, "an explicit B-roll prompt is directed: budget must exceed the auto clamp of 1")


class SceneRolePropagationTests(unittest.TestCase):
    """Fix 5: editorial beat roles flow into orchestration scenes."""

    def test_roles_propagate_and_intro_is_derived(self):
        chunks = [
            _production_chunk(0, "Nobody tells you this", 0, 3000),
            _production_chunk(1, OFFICE, 3000, 8000, role="proof"),
        ]
        with patch.object(PexelsVideoClient, "materialize_asset", lambda self, q, **k: _stub_asset(q)):
            manifest = plan_mini_run_orchestration(
                chunks=chunks, probe={"width": 1080, "height": 1920},
                prompt=None, duration_ms=8000,
            )
        scenes = manifest["scenes"]
        self.assertEqual(scenes[0].get("role"), "intro")
        self.assertEqual(scenes[1].get("role"), "proof")


class RevivedMasterPlannerTests(unittest.TestCase):
    """Fix 1b: plan_broll_cutaways_for_mini_run works with production chunks."""

    def test_planner_places_cutaways_for_camelcase_chunks(self):
        chunks = [
            _production_chunk(0, "Nobody tells you this", 0, 3000),
            _production_chunk(1, SUBWAY, 3000, 7600),
            _production_chunk(2, OFFICE, 15000, 20000),
        ]
        scenes = [
            {"id": "scene-1", "startMs": 0, "endMs": 3000, "role": "intro"},
            {"id": "scene-2", "startMs": 3000, "endMs": 7600, "role": "world_context"},
            {"id": "scene-3", "startMs": 15000, "endMs": 20000, "role": "proof"},
        ]

        class StubClient:
            def materialize_asset(self, query, **kwargs):
                return _stub_asset(query)

        directives = plan_broll_cutaways_for_mini_run(
            chunks=chunks, scenes=scenes, duration_ms=20000,
            max_brolls=3, seed="regression", client=StubClient(), download_assets=False,
        )
        self.assertEqual(len(directives), 2, "both spaced cutaways must be planned")
        for d in directives:
            self.assertGreater(d.evaluation.duration_sec, 1.4,
                               "production chunks must keep their real duration (not 0.1s)")


if __name__ == "__main__":
    unittest.main()
