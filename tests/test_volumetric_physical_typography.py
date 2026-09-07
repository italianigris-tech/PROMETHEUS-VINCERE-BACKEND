import unittest
from mini_run_pipeline import typography
from mini_run_pipeline.motif import resolve_brand_motif, motif_to_brand_palette


class VolumetricPhysicalTypographyTests(unittest.TestCase):
    def test_build_volumetric_luminance_gradient_purple(self):
        """Verify 6-stop convex physical gradient is constructed from purple #A855F7."""
        grad = typography.build_volumetric_luminance_gradient("#A855F7")
        self.assertIn("linear-gradient(180deg", grad)
        self.assertIn("#FFFFFF 0%", grad)
        # Specular rim
        self.assertIn("10%", grad)
        # Crown highlight
        self.assertIn("24%", grad)
        # Core body
        self.assertIn("#A855F7 58%", grad)
        # Shadow crevice
        self.assertIn("88%", grad)
        # Ground bounce
        self.assertIn("100%", grad)

    def test_build_volumetric_luminance_gradient_white(self):
        """Verify pure white input generates crisp high-contrast convex shading."""
        grad = typography.build_volumetric_luminance_gradient("#FFFFFF")
        self.assertIn("linear-gradient(180deg", grad)
        self.assertIn("#FFFFFF 0%", grad)
        self.assertIn("#CBD5E1 100%", grad)

    def test_resolve_layer_gradient_and_glow_physical_properties(self):
        """Verify resolve_layer_gradient_and_glow populates 5-pillar lighting properties."""
        res = typography.resolve_layer_gradient_and_glow(
            profile_name="test_profile",
            role="hero",
            raw_color="#A855F7",
            is_hero=True,
            brand_palette={"id": "royal_amethyst", "glow": "0 0 16px rgba(168,85,247,0.4)"},
        )
        self.assertTrue(res["hasGradient"])
        self.assertTrue(res["specularChamfer"])
        self.assertTrue(res["specularSheen"])
        self.assertEqual(res["specularAngle"], -35)
        self.assertTrue(res["volumetricShading"])
        self.assertEqual(res["contactShadow"], "0 3px 6px rgba(0, 0, 0, 0.95)")
        self.assertEqual(res["ambientShadow"], "0 12px 30px rgba(0, 0, 0, 0.55)")
        self.assertIn("linear-gradient", res["gradient"])

    def test_motif_to_brand_palette_emits_volumetric_gradients(self):
        """Verify motif presets include 6-stop volumetricGradient and companionGradient."""
        motif = resolve_brand_motif({"motif": "royal_amethyst"})
        palette = motif_to_brand_palette(motif)
        self.assertIn("volumetric_gradient", palette)
        self.assertIn("companion_gradient", palette)
        self.assertIn("#FFFFFF 0%", palette["volumetric_gradient"])
        self.assertIn("55%", palette["volumetric_gradient"])
        self.assertTrue(palette["specular_chamfer"])
        self.assertEqual(palette["specular_angle"], -35)

    def test_generate_font_manifest_attaches_physical_lighting(self):
        """Verify generate_font_manifest passes physical lighting fields to all rendered layers."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "good.",
                "startMs": 0,
                "endMs": 1500,
                "words": [{"text": "good.", "start_ms": 0, "end_ms": 1500}],
            }
        ]
        manifest = typography.generate_font_manifest(chunks)
        self.assertGreaterEqual(len(manifest["chunks"]), 1)
        layers = manifest["chunks"][0]["layers"]
        self.assertGreaterEqual(len(layers), 1)

        for layer in layers:
            self.assertTrue(layer["hasGradient"])
            self.assertIn("linear-gradient", layer["verticalGradient"])
            self.assertTrue(layer["specularChamfer"])
            self.assertTrue(layer["volumetricShading"])
            self.assertEqual(layer["contactShadow"], "0 3px 6px rgba(0, 0, 0, 0.95)")
            self.assertEqual(layer["ambientShadow"], "0 12px 30px rgba(0, 0, 0, 0.55)")


if __name__ == "__main__":
    unittest.main()
