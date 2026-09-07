"""Tests for Special Ops Typography Tier & Interoperability Architecture.

Validates the Special Ops Arsenal:
1. Chiseled Prism Bevel & Split Metallic Gradient (Spec 01)
   - 48%-50% baseline two-tone split gradient
   - Inset ridge chamfer & high-contrast dark barrier stroke
   - High-mass display grotesque stem weight (>= 700 / 800)
2. VJKT (Video Jockey Kinetic Typography - Spec 02)
   - High-cadence stroboscopic & chromatic aberration split
   - Cognitive fatigue cap: maximum 2 uses per timeline
3. Causal Dispatch & Anti-Dilution
   - Special Ops system guarantees regular expression of elite treatments
   - Interoperability across difference mode, subject layering, and brand palettes
"""

from __future__ import annotations

import unittest
from typing import Any, Dict, List

from mini_run_pipeline.typography import (
    ANIMA_RUNTIME_TREATMENTS,
    SINGLE_WORD_HERO_PRESETS,
    generate_font_manifest,
    resolve_layer_gradient_and_glow,
    resolve_typography_policy,
)


def make_chunks(texts: List[str], cadence_ms: int = 240) -> List[Dict[str, Any]]:
    chunks = []
    current_ms = 0
    for i, text in enumerate(texts):
        words = text.split()
        duration_ms = len(words) * cadence_ms
        chunk_words = [
            {
                "text": w,
                "start_ms": current_ms + j * cadence_ms,
                "end_ms": current_ms + (j + 1) * cadence_ms,
            }
            for j, w in enumerate(words)
        ]
        chunks.append({
            "chunkIndex": i + 1,
            "text": text,
            "words": chunk_words,
            "startMs": current_ms,
            "endMs": current_ms + duration_ms,
        })
        current_ms += duration_ms
    return chunks


class TestSpecialOpsTierAndInteroperability(unittest.TestCase):
    def test_catalog_registration(self):
        """Verify all Special Ops presets are registered in ANIMA_RUNTIME_TREATMENTS."""
        treatment_ids = {t["id"] for t in ANIMA_RUNTIME_TREATMENTS}
        self.assertIn("chiseled_prism_metallic", treatment_ids)
        self.assertIn("prism_chisel_hard_bevel", treatment_ids)
        self.assertIn("vj_kinetic_typography", treatment_ids)
        self.assertIn("vjkt", treatment_ids)
        self.assertIn("air_frontal_optical_bloom", treatment_ids)
        self.assertIn("hierarchical_asymmetric_lockup", treatment_ids)
        self.assertIn("see_through_glass_letterform", treatment_ids)

        # Single word hero presets must include chiseled prism
        self.assertIn("chiseled_prism_metallic", SINGLE_WORD_HERO_PRESETS)
        self.assertIn("prism_chisel_hard_bevel", SINGLE_WORD_HERO_PRESETS)

    def test_chiseled_prism_metallic_resolution(self):
        """Verify chiseled prism two-tone split horizon and dark barrier stroke."""
        res = resolve_layer_gradient_and_glow(
            profile_name="chiseled_prism_test",
            role="primary_focus_word",
            raw_color="#FFFFFF",
            is_hero=True,
            brand_palette={"id": "pure_editorial_mono"},
            layer_effects={"chiseled_prism_metallic": True},
        )

        self.assertTrue(res.get("chiseledPrism"))
        self.assertTrue(res.get("hasGradient"))
        self.assertIn("linear-gradient(180deg", res.get("gradient", ""))
        self.assertIn("47%", res.get("gradient", ""))
        self.assertIn("49%", res.get("gradient", ""))
        self.assertEqual(res.get("boundaryStroke"), "2.5px rgba(0, 0, 0, 0.95)")
        self.assertIn("#CBD5E1", res.get("shadow", ""))
        self.assertIn("#0F172A", res.get("shadow", ""))

    def test_special_ops_policy_resolution(self):
        """Verify resolve_typography_policy correctly parses special_ops system."""
        policy_default = resolve_typography_policy({})
        self.assertFalse(policy_default.get("specialOps"))

        policy_special = resolve_typography_policy({"typographySystem": "special_ops"})
        self.assertTrue(policy_special.get("specialOps"))

        policy_flag = resolve_typography_policy({"specialOps": True})
        self.assertTrue(policy_flag.get("specialOps"))

    def test_special_ops_manifest_anti_dilution(self):
        """Verify that Special Ops system guarantees regular expression of elite treatments."""
        chunks = make_chunks([
            "Look closely",
            "REVOLUTION",
            "Speed velocity",
            "OVERDRIVE",
            "This changes everything",
            "BREAKTHROUGH",
            "Unstoppable power",
            "MONUMENTAL",
        ])

        manifest = generate_font_manifest(
            chunks,
            {
                "seed": "special-ops-anti-dilution-42",
                "typographySystem": "special_ops",
                "creativity": "expressive",
            },
        )

        self.assertTrue(manifest.get("specialOpsEnabled"))
        self.assertIn("chiseled_prism_metallic", manifest.get("specialOpsCatalog", []))
        self.assertIn("vj_kinetic_typography", manifest.get("specialOpsCatalog", []))

        special_ops_detected = []
        for c in manifest["chunks"]:
            preset = c.get("fxPreset")
            if preset in (
                "chiseled_prism_metallic", "prism_chisel_hard_bevel",
                "vj_kinetic_typography", "vjkt",
                "air_frontal_optical_bloom", "hierarchical_asymmetric_lockup",
                "see_through_glass_letterform", "difference_mode_inversion",
            ) or c.get("isKnockout") or c.get("chiseledPrism") or c.get("vjkt"):
                special_ops_detected.append(preset)

        # Anti-dilution proof: at least 25% of chunks must carry Special Ops treatments
        self.assertGreaterEqual(len(special_ops_detected), 2, "Special Ops must be expressed without dilution")

    def test_vjkt_cognitive_fatigue_cap(self):
        """Verify that VJKT does not exceed 2 occurrences per sequence."""
        chunks = make_chunks([f"Fast word {i}" for i in range(20)], cadence_ms=180)
        manifest = generate_font_manifest(
            chunks,
            {
                "seed": "vjkt-fatigue-cap-seed",
                "typographySystem": "special_ops",
                "pacing": "fast",
            },
        )

        vjkt_count = sum(1 for c in manifest["chunks"] if c.get("fxPreset") in ("vj_kinetic_typography", "vjkt") or c.get("vjkt"))
        self.assertLessEqual(vjkt_count, 2, "VJKT must strictly obey maximum 2 uses fatigue cap")

    def test_chiseled_prism_stem_weight_gating(self):
        """Verify that chiseled prism chunks enforce fontWeight >= 800."""
        chunks = make_chunks(["SOLID", "IMPACT"])
        manifest = generate_font_manifest(
            chunks,
            {
                "seed": "prism-weight-seed",
                "fxPreset": "chiseled_prism_metallic",
            },
        )

        for c in manifest["chunks"]:
            for layer in c["layers"]:
                if layer.get("chiseledPrism") or layer.get("fxPreset") == "chiseled_prism_metallic":
                    self.assertGreaterEqual(layer.get("fontWeight", 0), 800)


if __name__ == "__main__":
    unittest.main()
