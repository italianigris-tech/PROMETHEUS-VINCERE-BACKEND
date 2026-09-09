"""Unit and Integration Test Suite: Mineral Extraction & Macro Section Image Orchestration Bridge.

Part of the Mini-Run Pipeline (mini_run_pipeline/).

Verifies:
1. Mineral & physical material taxonomy extraction.
2. Macro section expansion and strictly non-landscape (9:16 vertical only) invariants.
3. Non-destructive complementary orchestration preservation.
4. Requisite macro image asset binding and resolution integrity.
5. Pluggable EnablingImageTool adapter mechanics (ready for user tool injection).
6. Comprehensive JSON manifest generation and consistency.
"""

from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path
from PIL import Image

# Ensure repository root is in sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from mini_run_pipeline.mineral_macro_bridge import (
    MineralMacroBridgeEngine,
    MineralPhysicalEntity,
    MacroCinematographySpec,
    RequisiteImageAsset,
    LocalCatalogImageTool,
    ExternalUserToolAdapter,
    MINERAL_TAXONOMY,
    DEFAULT_ASPECT_RATIO,
    MANIFEST_OUTPUT_PATH,
    MACRO_ASSETS_DIR,
)


class TestMineralMacroBridge(unittest.TestCase):
    """Test suite for mineral extraction and macro section image orchestration."""

    def setUp(self):
        self.engine = MineralMacroBridgeEngine()
        self.test_manifest_path = REPO_ROOT / "docs" / "mini_run_studio" / "deep_semantic_manifest.json"

    def test_01_mineral_taxonomy_coverage(self):
        """Ensure all required mineral & physical material archetypes are registered."""
        expected_keys = [
            "weathered_cast_iron",
            "parchment_oak_slate",
            "oiled_steel_brass",
            "borosilicate_luminescent",
            "marble_bedrock_foundation",
        ]
        for k in expected_keys:
            self.assertIn(k, MINERAL_TAXONOMY)
            entity = MINERAL_TAXONOMY[k]
            self.assertIsInstance(entity, MineralPhysicalEntity)
            self.assertTrue(len(entity.tactile_surface_properties) > 10)
            self.assertTrue(entity.physical_weight_kg_m3 > 0)
            self.assertTrue(len(entity.acoustic_resonance) > 5)

    def test_02_mineral_extraction_grounding(self):
        """Test intelligent mapping from monologue phrases to mineral foundations."""
        # Inflection 1: Radical Self-Reliance
        m1 = self.engine.extract_mineral_grounding("Radical Self-Reliance", "No one's coming to save you. No mentor, no investor.")
        self.assertEqual(m1.entity_id, "min_cast_iron")
        self.assertEqual(m1.mineral_domain, "ferrous_metallurgy")

        # Inflection 2: Research Mode
        m2 = self.engine.extract_mineral_grounding("The Research Mode Trap", "Information without execution is just entertainment.")
        self.assertEqual(m2.entity_id, "min_parchment_slate")

        # Inflection 3: Systematic Edge
        m3 = self.engine.extract_mineral_grounding("The Systematic Edge", "The edge is volume with feedback. Do it with a system.")
        self.assertEqual(m3.entity_id, "min_oiled_brass_steel")

        # Inflection 4: 100 Experiments
        m4 = self.engine.extract_mineral_grounding("The 100-Experiment Asymmetry", "Run a hundred small experiments and be wrong ninety-nine times.")
        self.assertEqual(m4.entity_id, "min_borosilicate_crystal")

        # Bedrock Foundation
        m5 = self.engine.extract_mineral_grounding("Bedrock Foundation", "Your reputation is your real asset... Own the outcome.")
        self.assertEqual(m5.entity_id, "min_marble_bedrock")

    def test_03_strict_portrait_macro_invariant(self):
        """Validate that any landscape aspect ratio or format is strictly rejected."""
        # Should succeed with valid 9:16 portrait
        self.engine.enforce_portrait_macro_invariant("9:16")

        # Should strictly reject landscape formats
        forbidden = ["16:9", "4:3", "21:9", "landscape", "1.77"]
        for f in forbidden:
            with self.assertRaises(ValueError) as ctx:
                self.engine.enforce_portrait_macro_invariant(f)
            self.assertIn("strictly rejects landscape formats", str(ctx.exception))

    def test_04_macro_cinematography_synthesis(self):
        """Verify macro cinematography parameters meet high-tier documentary standards."""
        entity = MINERAL_TAXONOMY["weathered_cast_iron"]
        macro_spec = self.engine.synthesize_macro_spec(entity)

        self.assertEqual(macro_spec.aspect_ratio, DEFAULT_ASPECT_RATIO)
        self.assertIn("35mm Anamorphic", macro_spec.lens_type)
        self.assertIn("T1.5", macro_spec.aperture)
        self.assertIn("Chiaroscuro", macro_spec.lighting_style)
        self.assertIn("Kodak Vision3 5219", macro_spec.film_emulsion)
        self.assertTrue(len(macro_spec.secondary_motion) >= 2)

    def test_05_requisite_image_assets_exist_and_are_portrait(self):
        """Confirm all requisite macro images exist in repo and are vertical portrait (not landscape)."""
        required_files = [
            "i001_cast_iron_gear_macro.jpg",
            "i002_research_dossier_macro.jpg",
            "i003_systematic_gears_macro.jpg",
            "i004_experiment_testtube_macro.jpg",
            "mineral_bedrock_column_macro.jpg",
        ]
        for fname in required_files:
            p = MACRO_ASSETS_DIR / fname
            self.assertTrue(p.exists(), f"Missing required macro asset: {p}")

            # Verify image dimensions are portrait 9:16
            with Image.open(p) as im:
                w, h = im.size
                self.assertGreater(h, w, f"Image {fname} is not vertical! ({w}x{h})")
                ratio = w / h
                self.assertAlmostEqual(ratio, 9 / 16, delta=0.03, msg=f"Image {fname} ratio {ratio:.3f} deviates from 9:16")

    def test_06_enabling_tool_adapter_lifecycle(self):
        """Test the pluggable EnablingImageTool architecture with fallback and custom mock."""
        adapter = ExternalUserToolAdapter()

        # 1. Unbound adapter falls back to local catalog
        img_default = adapter.acquire_image("Test prompt", "I001")
        self.assertIsInstance(img_default, RequisiteImageAsset)
        self.assertEqual(img_default.aspect_ratio, "9:16")

        # 2. Bind a simulated user tool
        mock_called = {}
        def mock_user_tool(prompt: str, concept_id: str, aspect_ratio: str):
            mock_called["prompt"] = prompt
            mock_called["concept_id"] = concept_id
            return RequisiteImageAsset(
                asset_id=f"user_tool_{concept_id}",
                file_path="/mock/path/user_gen.jpg",
                relative_path="assets/macro_sections/user_gen.jpg",
                aspect_ratio=aspect_ratio,
                dimensions=(1080, 1920),
                mime_type="image/jpeg",
                color_palette=["#000000", "#FFFFFF"],
                has_alpha=False
            )

        adapter.set_tool(mock_user_tool)
        img_custom = adapter.acquire_image("Custom user prompt", "I002")
        self.assertEqual(img_custom.asset_id, "user_tool_I002")
        self.assertEqual(mock_called["concept_id"], "I002")

    def test_07_full_manifest_processing_integrity(self):
        """Execute full end-to-end manifest processing and verify non-destructive support."""
        if not self.test_manifest_path.exists():
            self.skipTest("deep_semantic_manifest.json not present")

        manifest = self.engine.process_semantic_manifest(self.test_manifest_path)

        self.assertEqual(manifest["aspectRatioStandard"], "9:16")
        self.assertTrue(manifest["landscapeProhibited"])
        self.assertEqual(manifest["activeImageToolProvider"], "LocalCatalogImageTool")

        sections = manifest["macroSections"]
        self.assertEqual(len(sections), 5, "Expected 4 inflections + 1 bedrock foundation")

        for sec in sections:
            self.assertIn("concept_id", sec)
            self.assertIn("mineral_entity", sec)
            self.assertIn("macro_spec", sec)
            self.assertIn("requisite_image", sec)
            self.assertIn("veo_image_to_video_prompt", sec)
            self.assertEqual(sec["macro_spec"]["aspect_ratio"], "9:16")

            # Check that requisite image file actually exists
            img_file = Path(sec["requisite_image"]["file_path"])
            self.assertTrue(img_file.exists(), f"Image file does not exist: {img_file}")


if __name__ == "__main__":
    unittest.main()
