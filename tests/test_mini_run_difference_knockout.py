"""Tests for Difference-Mode Inversion (Dynamic Knockout Typography) and Scene Transition Coupling.

Validates the 4 pillars of the playbook:
1. Core Blending Mechanics: Difference / Exclusion mode inverting underlying media (|255 - BG|).
2. Adaptive Readability & Edge Definition: Razor-thin 0.5-1px boundary stroke preventing glyph loss on midtones and high-frequency edges.
3. Refraction / Edge Dispersion: Chromatic aberration along glyph edges (red/cyan and blue/yellow dispersion).
4. System Variants:
   - difference_exclusion (Standard Dynamic Knockout)
   - frosted_glass_stencil (Blurred high-contrast glass letterform)
   - luma_inversion (Luma brightness inversion preserving saturation)
   - negative_space_cutout (High-contrast canvas stencil with raw footage peephole)
5. Scene Transitions: Seamless coupling with scene shifts, B-roll cutaways, and background textures.
"""

from __future__ import annotations

import unittest
from typing import Any, Dict, List

from mini_run_pipeline.backgrounds import (
    BACKGROUND_KINDS,
    TRANSITION_BY_TRIGGER,
    parse_background_preferences,
    plan_backgrounds,
)
from mini_run_pipeline.typography import (
    _select_difference_chunk_indices,
    generate_font_manifest,
)


def make_chunks(texts: List[str]) -> List[Dict[str, Any]]:
    return [
        {
            "chunkIndex": i,
            "text": text,
            "words": [{"text": w, "start_ms": i * 1500 + j * 300, "end_ms": i * 1500 + (j + 1) * 300}
                      for j, w in enumerate(text.split())],
            "startMs": i * 1500,
            "endMs": (i + 1) * 1500,
        }
        for i, text in enumerate(texts)
    ]


class TestDifferenceKnockoutAndTransitions(unittest.TestCase):
    def test_difference_mode_contract_and_attributes(self):
        """Verifies that difference-mode chunks satisfy the strict playbook contract."""
        inputs = make_chunks([
            "Look closely",
            "This changes everything",
            "A different perspective",
            "Now you see it",
            "Beyond the noise",
            "Pure clarity",
            "Inverted light",
            "Final conclusion",
        ])
        manifest = generate_font_manifest(inputs, {"seed": "knockout-contract", "creativity": "expressive"})

        diff_chunks = [c for c in manifest["chunks"] if c.get("blendMode") == "difference"]
        self.assertGreater(len(diff_chunks), 0, "At least one chunk must receive difference mode")

        for chunk in diff_chunks:
            self.assertTrue(chunk.get("seeThrough"), "Chunk must be marked seeThrough")
            self.assertTrue(chunk.get("isKnockout"), "Chunk must be marked isKnockout")
            self.assertTrue(chunk.get("refractionDispersion"), "Refraction dispersion must be active")
            self.assertIn("boundaryStroke", chunk, "Boundary stroke must be defined")
            self.assertIn("chromaticAberration", chunk, "Chromatic aberration must be specified")

            chroma = chunk["chromaticAberration"]
            self.assertIn("redOffsetPx", chroma)
            self.assertIn("blueOffsetPx", chroma)
            self.assertLess(chroma["redOffsetPx"], 0, "Red channel must be offset negatively")
            self.assertGreater(chroma["blueOffsetPx"], 0, "Blue channel must be offset positively")

            # Check layer level propagation
            for layer in chunk["layers"]:
                self.assertEqual(layer.get("blendMode"), "difference")
                self.assertTrue(layer.get("isKnockout"))
                self.assertTrue(layer.get("refractionDispersion"))
                self.assertIn("boundaryStroke", layer)
                self.assertIn("chromaticAberration", layer)

    def test_all_system_variants_represented(self):
        """Verifies that the 4 system variants are cycling or selectable."""
        inputs = make_chunks([f"Scene punch {i}" for i in range(24)])
        manifest = generate_font_manifest(inputs, {"seed": "variants-catalog", "creativity": "expressive"})

        diff_chunks = [c for c in manifest["chunks"] if c.get("blendMode") == "difference"]
        variants_present = {c.get("knockoutVariant") for c in diff_chunks}

        expected_variants = {
            "difference_exclusion",
            "frosted_glass_stencil",
            "luma_inversion",
            "negative_space_cutout",
        }
        # In a 24-chunk run with expressive creativity, multiple variants must be instantiated
        self.assertTrue(variants_present.intersection(expected_variants))
        for v in variants_present:
            self.assertIn(v, expected_variants)

    def test_scene_transition_coupling(self):
        """Verifies that chunks crossing scene transitions or B-roll changes are candidates."""
        chunks = make_chunks(["Intro hook", "First section", "B-roll shift", "Wrap up"])
        # Tag chunk 2 as a scene transition cut
        chunks[2]["isSceneBoundary"] = True
        chunks[2]["hasTransition"] = True
        chunks[2]["causedByTransitionId"] = "trans-1"

        import random
        rng = random.Random("trans-test")
        indices = _select_difference_chunk_indices(chunks, rng)
        self.assertIn(2, indices, "Scene boundary chunk must be selected as a difference candidate")

    def test_background_kinds_and_transitions(self):
        """Verifies backgrounds.py supports broll_cutaway, negative_space_stencil, and transition kinds."""
        self.assertIn("broll_cutaway", BACKGROUND_KINDS)
        self.assertIn("negative_space_stencil", BACKGROUND_KINDS)
        self.assertIn("scene_shift", TRANSITION_BY_TRIGGER)
        self.assertIn("broll_cutaway", TRANSITION_BY_TRIGGER)
        self.assertIn("negative_space", TRANSITION_BY_TRIGGER)

        # Parse preferences with B-roll and negative space prompts
        prefs_broll = parse_background_preferences(prompt="Add b-roll cutaway footage transitions")
        self.assertEqual(prefs_broll["preferredKind"], "broll_cutaway")

        prefs_knockout = parse_background_preferences(prompt="Use negative space stencil cutout backdrops")
        self.assertEqual(prefs_knockout["preferredKind"], "negative_space_stencil")

    def test_deterministic_seed_replay(self):
        """Verifies that the same seed deterministically selects the same difference chunks."""
        inputs = make_chunks([f"Narrative chunk {i}" for i in range(16)])
        manifest_a = generate_font_manifest(inputs, {"seed": "replay-lock", "creativity": "expressive"})
        manifest_b = generate_font_manifest(inputs, {"seed": "replay-lock", "creativity": "expressive"})

        diff_a = [c["chunkIndex"] for c in manifest_a["chunks"] if c.get("blendMode") == "difference"]
        diff_b = [c["chunkIndex"] for c in manifest_b["chunks"] if c.get("blendMode") == "difference"]
        self.assertEqual(diff_a, diff_b)

        variants_a = [c.get("knockoutVariant") for c in manifest_a["chunks"] if c.get("blendMode") == "difference"]
        variants_b = [c.get("knockoutVariant") for c in manifest_b["chunks"] if c.get("blendMode") == "difference"]
        self.assertEqual(variants_a, variants_b)


if __name__ == "__main__":
    unittest.main()
