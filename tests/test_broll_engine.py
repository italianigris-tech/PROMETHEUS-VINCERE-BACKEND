"""Comprehensive unit tests for the B-Roll Intelligence & Cinematic Treatment Engine."""

import unittest
from mini_run_pipeline.broll_engine import (
    BrollSuitabilityEngine,
    BrollSuitabilityEvaluation,
    extract_broll_search_queries,
    prescribe_after_effects_treatment,
    PexelsVideoClient,
    plan_broll_cutaways_for_mini_run,
)
from mini_run_pipeline.backgrounds import plan_backgrounds
from mini_run_pipeline.orchestration import plan_mini_run_orchestration


class BrollSuitabilityScoringTests(unittest.TestCase):
    """Test the multifaceted mathematical scoring formula for B-roll eligibility."""

    def test_insufficient_time_clamped_and_routed_to_kinetic_typography(self):
        """Micro-phrases (< 1.4s) lack sufficiency of time to parse scene semantics."""
        eval_res = BrollSuitabilityEngine.evaluate_chunk(
            chunk_index=0,
            text="Stop right now",
            duration_sec=0.9,
            time_since_last_broll_sec=12.0,
            time_since_last_visual_break_sec=12.0,
        )
        self.assertFalse(eval_res.is_eligible)
        self.assertEqual(eval_res.recommended_treatment_category, "kinetic_typography")
        self.assertEqual(eval_res.duration_score, 0.0)
        self.assertIn("<1.4s", eval_res.rationale)

    def test_abstract_and_numeric_tokens_routed_to_motion_graphics(self):
        """Abstract concepts, numbers, percentages, and frameworks belong to motion graphics / charts."""
        eval_res = BrollSuitabilityEngine.evaluate_chunk(
            chunk_index=1,
            text="The 3 pillars of 72% revenue growth and strategy",
            duration_sec=3.2,
            time_since_last_broll_sec=12.0,
            time_since_last_visual_break_sec=12.0,
        )
        self.assertFalse(eval_res.is_eligible)
        self.assertEqual(eval_res.recommended_treatment_category, "motion_graphic")
        self.assertGreater(eval_res.abstract_penalty, 0.3)
        self.assertIn("motion graphic", eval_res.rationale.lower())

    def test_concrete_physical_world_environment_is_broll_eligible(self):
        """Tangible physical nouns and environments warrant high-tier cinematic B-roll."""
        eval_res = BrollSuitabilityEngine.evaluate_chunk(
            chunk_index=2,
            text="Walking through the busy office skyscrapers at night",
            duration_sec=3.6,
            time_since_last_broll_sec=15.0,
            time_since_last_visual_break_sec=8.0,
        )
        self.assertTrue(eval_res.is_eligible)
        self.assertEqual(eval_res.recommended_treatment_category, "broll_cutaway")
        self.assertGreaterEqual(eval_res.composite_score, 0.62)
        self.assertIn("office", eval_res.matched_concrete_terms)
        self.assertIn("skyscrapers", eval_res.matched_concrete_terms)

    def test_cooldown_penalty_prevents_back_to_back_cutaway_spam(self):
        """A B-roll placed too recently (< 4.5s) is penalized to prevent visual fatigue."""
        eval_res = BrollSuitabilityEngine.evaluate_chunk(
            chunk_index=3,
            text="Typing on a computer laptop in a dark room",
            duration_sec=3.0,
            time_since_last_broll_sec=1.8,
            time_since_last_visual_break_sec=1.8,
        )
        self.assertFalse(eval_res.is_eligible)
        self.assertEqual(eval_res.recommended_treatment_category, "talking_head")
        self.assertGreater(eval_res.cooldown_penalty, 0.5)

    def test_fatigue_score_rises_with_uninterrupted_talking_head(self):
        """Fatigue score accumulates over time to break talking-head visual monotony."""
        short_break = BrollSuitabilityEngine.calculate_fatigue_score(1.5)
        med_break = BrollSuitabilityEngine.calculate_fatigue_score(4.5)
        long_break = BrollSuitabilityEngine.calculate_fatigue_score(8.0)

        self.assertLess(short_break, med_break)
        self.assertEqual(long_break, 1.0)


class BrollQueryExtractionTests(unittest.TestCase):
    """Test extraction of focused visual search queries from transcript phrases."""

    def test_extracts_concrete_nouns_and_action_verbs(self):
        text = "When you walk into a crowded subway station in New York"
        primary_q, fallback_q = extract_broll_search_queries(text)
        self.assertIn("cinematic", primary_q)
        self.assertTrue(any(w in primary_q for w in ("walk", "crowded", "subway", "station")))

    def test_filters_conversational_filler_words(self):
        text = "You know what I mean because you just have to look at it"
        primary_q, _ = extract_broll_search_queries(text)
        # Filler words like 'you', 'because', 'just' should be filtered
        words = primary_q.split()
        self.assertNotIn("because", words)
        self.assertNotIn("just", words)


class AfterEffectsTreatmentsTests(unittest.TestCase):
    """Verify all 7 After Effects-grade broadcast treatments are properly prescribed."""

    def test_prescribes_evidentiary_dossier_card_for_proof(self):
        treatment = prescribe_after_effects_treatment(beat_type="proof")
        self.assertEqual(treatment.treatment_name, "evidentiary_dossier_card")
        self.assertEqual(treatment.framing["style"], "polaroid_card")
        self.assertTrue(treatment.shadow["double_state"])
        self.assertEqual(treatment.motion_physics["entrance_physics"], "slap_drop_bounce")

    def test_prescribes_retinal_flash_for_crisis(self):
        treatment = prescribe_after_effects_treatment(beat_type="crisis")
        self.assertEqual(treatment.treatment_name, "retinal_flash_cut")
        self.assertTrue(treatment.transient["retinal_flash"])
        self.assertTrue(treatment.transient["color_inversion"])

    def test_prescribes_rack_focus_spotlight_for_revelation(self):
        treatment = prescribe_after_effects_treatment(beat_type="revelation")
        self.assertEqual(treatment.treatment_name, "rack_focus_spotlight")
        self.assertTrue(treatment.optical["defocus_dive"])
        self.assertGreater(treatment.optical["blur_start_px"], 20)

    def test_prescribes_cinematic_fullbleed_with_ken_burns(self):
        treatment = prescribe_after_effects_treatment(treatment_type="cinematic_fullbleed")
        self.assertEqual(treatment.treatment_name, "cinematic_fullbleed")
        self.assertTrue(treatment.ken_burns["enabled"])
        self.assertEqual(treatment.framing["style"], "full_bleed")

    def test_prescribes_track_matte_unfurl(self):
        treatment = prescribe_after_effects_treatment(treatment_type="track_matte_unfurl")
        self.assertEqual(treatment.treatment_name, "track_matte_unfurl")
        self.assertEqual(treatment.framing["style"], "unfurl_crop")
        self.assertEqual(treatment.motion_physics["entrance_physics"], "track_matte_wipe")

    def test_prescribes_hinged_3d_swing(self):
        treatment = prescribe_after_effects_treatment(treatment_type="hinged_3d_swing")
        self.assertEqual(treatment.treatment_name, "hinged_3d_swing")
        self.assertEqual(treatment.motion_physics["entrance_physics"], "hinged_3d_swing")


class PexelsClientFileSelectionTests(unittest.TestCase):
    """Test selection of highest-resolution portrait 9:16 files."""

    def test_selects_portrait_over_landscape(self):
        client = PexelsVideoClient(api_key="mock_key")
        mock_record = {
            "id": 12345,
            "duration": 8,
            "video_files": [
                {"id": 1, "quality": "hd", "width": 1920, "height": 1080, "link": "http://example.com/land.mp4"},
                {"id": 2, "quality": "hd", "width": 1080, "height": 1920, "link": "http://example.com/port.mp4"},
            ],
        }
        best = client.select_best_vertical_file(mock_record)
        self.assertIsNotNone(best)
        self.assertEqual(best["width"], 1080)
        self.assertEqual(best["height"], 1920)
        self.assertEqual(best["link"], "http://example.com/port.mp4")


class EndToEndBrollIntegrationTests(unittest.TestCase):
    """Test full integration of B-roll into plan_backgrounds and orchestration."""

    def test_plan_backgrounds_generates_broll_cutaway_on_concrete_prompt(self):
        chunks = [
            {"chunkIndex": 0, "chunkId": "c1", "text": "Welcome to the show", "start_ms": 0, "end_ms": 3000, "outputStartMs": 0, "outputEndMs": 3000},
            {"chunkIndex": 1, "chunkId": "c2", "text": "Walking inside the modern office skyscraper", "start_ms": 3000, "end_ms": 7500, "outputStartMs": 3000, "outputEndMs": 7500},
            {"chunkIndex": 2, "chunkId": "c3", "text": "And that changed everything", "start_ms": 7500, "end_ms": 11000, "outputStartMs": 7500, "outputEndMs": 11000},
        ]
        scenes = [
            {"id": "scene-1", "startMs": 0, "endMs": 3000, "salience": 0.5, "role": "intro"},
            {"id": "scene-2", "startMs": 3000, "endMs": 7500, "salience": 0.9, "role": "proof"},
            {"id": "scene-3", "startMs": 7500, "endMs": 11000, "salience": 0.5, "role": "climax"},
        ]

        # Explicitly request broll via prompt
        bg_plan = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            prompt="add cinematic b-roll cutaway footage",
            duration_ms=11000,
        )

        self.assertTrue(any(bg.get("kind") == "broll_cutaway" for bg in bg_plan))
        broll_bg = next(bg for bg in bg_plan if bg.get("kind") == "broll_cutaway")
        self.assertIn("broll", broll_bg)
        self.assertIn("treatment", broll_bg["broll"])
        self.assertIn("treatment_name", broll_bg["broll"]["treatment"])

    def test_orchestration_manifest_synchronizes_broll_sfx(self):
        chunks = [
            {"chunkIndex": 0, "chunkId": "c1", "text": "Welcome to the show", "start_ms": 0, "end_ms": 3000, "outputStartMs": 0, "outputEndMs": 3000},
            {"chunkIndex": 1, "chunkId": "c2", "text": "Walking inside the modern office skyscraper", "start_ms": 3000, "end_ms": 7500, "outputStartMs": 3000, "outputEndMs": 7500},
        ]
        scenes = [
            {"id": "scene-1", "startMs": 0, "endMs": 3000, "salience": 0.5, "role": "intro"},
            {"id": "scene-2", "startMs": 3000, "endMs": 7500, "salience": 0.9, "role": "proof"},
        ]

        manifest = plan_mini_run_orchestration(
            chunks=chunks,
            probe={"width": 1080, "height": 1920},
            prompt="b-roll cutaway",
            duration_ms=7500,
        )

        self.assertIn("backgrounds", manifest)
        self.assertIn("sfx", manifest)
        # Ensure B-roll sfx is included if broll was planned
        has_broll = any(bg.get("kind") == "broll_cutaway" for bg in manifest["backgrounds"])
        if has_broll:
            self.assertTrue(any("broll" in str(s.get("id")) or "broll" in str(s.get("causedByBackgroundId")) for s in manifest["sfx"]))


if __name__ == "__main__":
    unittest.main()
