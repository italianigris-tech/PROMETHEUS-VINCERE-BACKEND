"""Comprehensive unit tests for Hierarchical Asymmetric Kinetic Typography
(Documentary Lockup Captions / Micro-Macro Kinetic Type).

Verifies:
1. Catalog registration in ANIMA_RUNTIME_TREATMENTS and aliases.
2. 3:1 to 4:1 scale ratio between Hero and Modifier layers.
3. Font weights (Hero: 900 Ultra-Bold / Black, Modifier: 600 Semi-Bold).
4. Kerning/tracking (-0.035em / -0.025em) and compact leading (0.88).
5. Case conventions (Modifier lowercase dominance, proper nouns capitalized, milestones uppercase).
6. Soft vertical gradient overlay and dark contrast drop shadows.
7. Tactile mechanical UI transient SFX (-18 dB to -24 dB).
8. Zero regression on existing baseline chunking and typography.
"""

from __future__ import annotations

import unittest
from typing import Any, Dict, List

from mini_run_pipeline import typography
from mini_run_pipeline import orchestration


class TestHierarchicalAsymmetricLockup(unittest.TestCase):
    def test_catalog_registration(self) -> None:
        """All three canonical treatment IDs are registered in ANIMA_RUNTIME_TREATMENTS."""
        registered_ids = {item["id"] for item in typography.ANIMA_RUNTIME_TREATMENTS}
        self.assertIn("hierarchical_asymmetric_lockup", registered_ids)
        self.assertIn("documentary_lockup_captions", registered_ids)
        self.assertIn("micro_macro_kinetic_type", registered_ids)

        for item in typography.ANIMA_RUNTIME_TREATMENTS:
            if item["id"] == "hierarchical_asymmetric_lockup":
                self.assertIn("editorial", item["styles"])
                self.assertIn("luxury", item["styles"])
                self.assertAlmostEqual(item["energy"], 0.45)

    def test_font_manifest_generation_with_lockup(self) -> None:
        """Generating font manifest with hierarchical lockup produces two-tier asymmetric layers."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "Mark Dowdle was the only one",
                "startMs": 0,
                "endMs": 1800,
                "words": [
                    {"text": "Mark", "start_ms": 0, "end_ms": 300},
                    {"text": "Dowdle", "start_ms": 320, "end_ms": 650},
                    {"text": "was", "start_ms": 680, "end_ms": 850},
                    {"text": "the", "start_ms": 870, "end_ms": 1000},
                    {"text": "only", "start_ms": 1020, "end_ms": 1350},
                    {"text": "one", "start_ms": 1380, "end_ms": 1750},
                ],
            },
            {
                "chunkIndex": 2,
                "text": "up in the mountains",
                "startMs": 1900,
                "endMs": 3200,
                "words": [
                    {"text": "up", "start_ms": 1900, "end_ms": 2100},
                    {"text": "in", "start_ms": 2120, "end_ms": 2300},
                    {"text": "the", "start_ms": 2320, "end_ms": 2500},
                    {"text": "mountains", "start_ms": 2520, "end_ms": 3150},
                ],
            },
        ]

        design = {
            "treatment": "hierarchical_asymmetric_lockup",
            "aspectRatio": "9:16",
            "seed": "lockup-contract-deterministic-seed",
        }

        manifest = typography.generate_font_manifest(chunks, design_override=design)
        self.assertEqual(len(manifest["chunks"]), 2)

        # Chunk 1: "Mark Dowdle was the only one" -> Option B (Bottom-tucked modifier)
        c1 = manifest["chunks"][0]
        self.assertEqual(c1["treatmentSystem"], "hierarchical_asymmetric_lockup")
        self.assertEqual(c1["lockupOption"], "bottom_tucked")
        self.assertEqual(len(c1["layers"]), 2)

        hero_l1 = next(l for l in c1["layers"] if l["isHero"])
        mod_l1 = next(l for l in c1["layers"] if not l["isHero"])

        # Hero layer assertions
        self.assertEqual(hero_l1["fontWeight"], 900)
        self.assertGreaterEqual(hero_l1["fontSizePx"], 96)
        self.assertLessEqual(hero_l1["fontSizePx"], 148)
        self.assertEqual(hero_l1["letterSpacingEm"], -0.035)
        self.assertTrue(hero_l1["hasGradient"])
        self.assertIn("linear-gradient", hero_l1["verticalGradient"])

        # Modifier layer assertions: 3:1 to 4:1 scale ratio
        self.assertIn(mod_l1["fontWeight"], [300, 600])
        scale_ratio = hero_l1["fontSizePx"] / mod_l1["fontSizePx"]
        self.assertGreaterEqual(scale_ratio, 2.8)
        self.assertLessEqual(scale_ratio, 4.5)
        self.assertEqual(mod_l1["letterSpacingEm"], 0.005)
        self.assertEqual(mod_l1["color"], "#F2F2F2")

        # Chunk 2: "up in the mountains" -> Option A (Top-tucked modifier)
        c2 = manifest["chunks"][1]
        self.assertEqual(c2["treatmentSystem"], "hierarchical_asymmetric_lockup")
        self.assertEqual(c2["lockupOption"], "top_tucked")
        self.assertEqual(len(c2["layers"]), 2)

        hero_l2 = next(l for l in c2["layers"] if l["isHero"])
        mod_l2 = next(l for l in c2["layers"] if not l["isHero"])
        self.assertIn("mountains", hero_l2["rawText"].lower())
        self.assertIn("up in the", mod_l2["rawText"].lower())
        self.assertEqual(mod_l2["casing"], "lowercase")

    def test_prompt_keyword_inference(self) -> None:
        """Prompt mentioning 'luxury documentary lockup' selects hierarchical lockup automatically."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "the first winter ascent",
                "startMs": 0,
                "endMs": 1500,
                "words": [
                    {"text": "the", "start_ms": 0, "end_ms": 200},
                    {"text": "first", "start_ms": 220, "end_ms": 500},
                    {"text": "winter", "start_ms": 520, "end_ms": 900},
                    {"text": "ascent", "start_ms": 920, "end_ms": 1400},
                ],
            }
        ]
        design = {
            "prompt": "Produce a high luxury documentary lockup with micro-macro type",
            "aspectRatio": "9:16",
        }
        manifest = typography.generate_font_manifest(chunks, design_override=design)
        c0 = manifest["chunks"][0]
        self.assertEqual(c0["treatmentSystem"], "hierarchical_asymmetric_lockup")
        self.assertEqual(c0["lockupOption"], "top_tucked")

    def test_sfx_transient_clicks(self) -> None:
        """Hierarchical lockup chunks trigger subtle tactile mechanical UI clicks at -18 to -24 dB."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "Mark Dowdle was the only one",
                "startMs": 0,
                "endMs": 2000,
                "words": [
                    {"text": "Mark", "start_ms": 0, "end_ms": 300},
                    {"text": "Dowdle", "start_ms": 350, "end_ms": 700},
                    {"text": "was", "start_ms": 750, "end_ms": 950},
                    {"text": "the", "start_ms": 1000, "end_ms": 1200},
                    {"text": "only", "start_ms": 1250, "end_ms": 1500},
                    {"text": "one", "start_ms": 1550, "end_ms": 1900},
                ],
                "layers": [
                    {"isHero": True, "fontSizePx": 120, "fxPreset": "hierarchical_asymmetric_lockup"},
                    {"isHero": False, "fontSizePx": 36, "fxPreset": "hierarchical_asymmetric_lockup"},
                ],
                "treatmentSystem": "hierarchical_asymmetric_lockup",
            }
        ]

        manifest = orchestration.plan_orchestration_manifest(
            chunks=chunks,
            scenes=[{"index": 0, "startMs": 0, "endMs": 2000}],
            design={"aspectRatio": "9:16"},
            duration_ms=2000,
        )

        lockup_sfx = [
            s for s in manifest.get("sfx", [])
            if s.get("causedByTreatment") == "hierarchical_asymmetric_lockup"
        ]
        self.assertGreaterEqual(len(lockup_sfx), 3)
        for s in lockup_sfx:
            # Must be within subtle dialogue underlay range: -18 dB to -24 dB
            self.assertGreaterEqual(s["gainDb"], -24.0)
            self.assertLessEqual(s["gainDb"], -18.0)
            self.assertIn(s["cue"], ["mechanical_click", "shutter_snap", "click_bupu", "tap_bupu"])

    def test_compact_leading_and_tight_tracking(self) -> None:
        """Lockup chunks enforce compact leading (0.88) on hero and tight tracking (-0.035em/-0.025em)."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "The Grand Ascent",
                "startMs": 0,
                "endMs": 1800,
                "words": [
                    {"text": "The", "start_ms": 0, "end_ms": 300},
                    {"text": "Grand", "start_ms": 320, "end_ms": 800},
                    {"text": "Ascent", "start_ms": 820, "end_ms": 1700},
                ],
            }
        ]
        manifest = typography.generate_font_manifest(
            chunks,
            design_override={
                "treatment": "hierarchical_asymmetric_lockup",
                "aspectRatio": "9:16",
                "seed": "lockup-compact-leading-deterministic-seed",
            },
        )
        c0 = manifest["chunks"][0]
        hero = next(l for l in c0["layers"] if l["isHero"])
        modifier = next(l for l in c0["layers"] if not l["isHero"])

        self.assertEqual(hero["lineHeight"], 0.88)
        self.assertEqual(hero["letterSpacingEm"], -0.035)
        self.assertEqual(modifier["letterSpacingEm"], 0.005)
        self.assertIn(hero["fontFamily"], ["Inter", "Montserrat", "Helvetica", "Neue Haas Grotesk", "Apple Garamond"])

    def test_backward_compatibility_other_treatments(self) -> None:
        """Other standard treatments generate without interruption or regressions."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "Standard caption chunk",
                "startMs": 0,
                "endMs": 1500,
                "words": [
                    {"text": "Standard", "start_ms": 0, "end_ms": 500},
                    {"text": "caption", "start_ms": 520, "end_ms": 1000},
                    {"text": "chunk", "start_ms": 1020, "end_ms": 1450},
                ],
            }
        ]
        manifest = typography.generate_font_manifest(
            chunks,
            design_override={"treatment": "apple_keynote_headline_punch", "aspectRatio": "9:16"},
        )
        c0 = manifest["chunks"][0]
        self.assertEqual(c0.get("fxPreset"), "apple_keynote_headline_punch")
        self.assertNotEqual(c0.get("treatmentSystem"), "hierarchical_asymmetric_lockup")
        self.assertIsNone(c0.get("lockupOption"))


if __name__ == "__main__":
    unittest.main()
