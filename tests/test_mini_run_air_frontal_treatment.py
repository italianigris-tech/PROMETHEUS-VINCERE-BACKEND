import unittest
from pathlib import Path

from mini_run_pipeline.typography import (
    ANIMA_RUNTIME_TREATMENTS,
    SINGLE_WORD_HERO_PRESETS,
    generate_font_manifest,
    resolve_layer_gradient_and_glow,
)


def make_chunks(texts):
    return [
        {
            "chunkIndex": index + 1,
            "text": text,
            "startMs": index * 1200,
            "endMs": index * 1200 + 1000,
            "words": [
                {
                    "text": word,
                    "start_ms": index * 1200 + word_index * 200,
                    "end_ms": index * 1200 + (word_index + 1) * 200,
                }
                for word_index, word in enumerate(text.split())
            ],
        }
        for index, text in enumerate(texts)
    ]


class AirFrontalOpticalBloomTests(unittest.TestCase):
    """Test suite verifying the 5-pillar In-The-Air Frontal Optical Bloom typography treatment."""

    def test_catalog_registers_air_frontal_optical_bloom(self):
        treatment_ids = {t["id"] for t in ANIMA_RUNTIME_TREATMENTS}
        self.assertIn("air_frontal_optical_bloom", treatment_ids)
        self.assertIn("in_the_air_diffusion_bloom", treatment_ids)

        preset = next(t for t in ANIMA_RUNTIME_TREATMENTS if t["id"] == "air_frontal_optical_bloom")
        self.assertIn("frontal", preset["styles"])
        self.assertIn("cinematic", preset["styles"])

    def test_single_word_hero_presets_includes_air_frontal(self):
        self.assertIn("air_frontal_optical_bloom", SINGLE_WORD_HERO_PRESETS)
        self.assertIn("in_the_air_diffusion_bloom", SINGLE_WORD_HERO_PRESETS)

    def test_resolve_layer_gradient_and_glow_embodies_5_pillars(self):
        res = resolve_layer_gradient_and_glow(
            profile_name="air_frontal_cinematic_test",
            role="primary_focus_word",
            raw_color="#FFFFFF",
            is_hero=True,
            brand_palette={"id": "pure_editorial_mono"},
            layer_effects={"air_frontal_optical_bloom": True},
        )

        # Pillar 1: Diffusion & Optical Bloom
        self.assertTrue(res.get("opticalBloom"))
        self.assertIn("drop-shadow", res.get("glow", ""))

        # Pillar 2: Non-Uniform Vertical Micro-Gradient
        self.assertTrue(res.get("hasGradient"))
        self.assertIn("linear-gradient(180deg", res.get("verticalGradient", ""))
        self.assertIn("#FFFFFF", res.get("verticalGradient", ""))

        # Pillar 3: Subtle Edge Feathering / Anti-Aliasing Bleed
        self.assertEqual(res.get("edgeFeatherPx"), 0.35)

        # Pillar 4: Soft Dark Underlay (Omnidirectional Backplate Shadow Halo)
        self.assertIn("0 0 28px rgba(0, 0, 0, 0.45)", res.get("backplateShadow", ""))

        # Pillar 5: Atmospheric Blend / Screen Interaction
        self.assertEqual(res.get("atmosphericBlend"), "screen")
        self.assertEqual(res.get("treatmentOverlay"), "air_frontal_optical_bloom")

    def test_generate_font_manifest_applies_air_frontal_to_foreground_layers(self):
        chunks = make_chunks(["THE INVISIBLE FORCE", "SHAPING REALITY TODAY"])
        manifest = generate_font_manifest(
            chunks,
            design_override={
                "seed": "optical-air-seed",
                "frontalTreatment": "air_frontal_optical_bloom",
                "subjectLayering": "disabled",
            },
        )

        self.assertIn("chunks", manifest)
        self.assertGreaterEqual(len(manifest["chunks"]), 1)

        for chunk in manifest["chunks"]:
            self.assertEqual(chunk.get("frontalTreatment"), "air_frontal_optical_bloom")
            self.assertEqual(chunk.get("fxPreset"), "air_frontal_optical_bloom")

            for layer in chunk["layers"]:
                # Check 5 pillars on layer
                self.assertEqual(layer.get("frontalTreatment"), "air_frontal_optical_bloom")
                self.assertTrue(layer.get("opticalBloom"))
                self.assertEqual(layer.get("edgeFeatherPx"), 0.35)
                self.assertIsNotNone(layer.get("backplateShadow"))
                self.assertEqual(layer.get("atmosphericBlend"), "screen")
                self.assertTrue(layer.get("hasGradient"))
                self.assertIn("linear-gradient(180deg", layer.get("verticalGradient", ""))

    def test_remotion_archetype_names_includes_air_frontal(self):
        # Verify TypeScript source code has air_frontal_optical_bloom in ALL_ARCHETYPE_FX_NAMES
        archetypes_ts = Path("remotion-app/src/compositions/AnimationArchetypes.tsx").read_text(encoding="utf-8")
        self.assertIn('"air_frontal_optical_bloom"', archetypes_ts)
        self.assertIn("export const AirFrontalOpticalBloom", archetypes_ts)

    def test_remotion_min_run_layer_type_includes_frontal_fields(self):
        min_run_ts = Path("remotion-app/src/compositions/PrometheusMinRun.tsx").read_text(encoding="utf-8")
        self.assertIn("frontalTreatment?: string;", min_run_ts)
        self.assertIn("opticalBloom?:", min_run_ts)
        self.assertIn("edgeFeatherPx?:", min_run_ts)
        self.assertIn("backplateShadow?:", min_run_ts)
        self.assertIn("atmosphericBlend?:", min_run_ts)
        self.assertIn('layer.treatmentOverlay === "air_frontal_optical_bloom"', min_run_ts)


if __name__ == "__main__":
    unittest.main()
