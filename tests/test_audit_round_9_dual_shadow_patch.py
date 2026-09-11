import re
import unittest
from mini_run_pipeline.typography import generate_font_manifest
from mini_run_pipeline.policy_check import validate_shadow_glow_budget, extract_manifest_layers


class TestRound9DualShadowPatch(unittest.TestCase):
    """Verifies that Archetype A & B overlapping layers use a single grounding shadow and preserve gradient fade."""

    def test_overlapping_layers_have_single_grounding_shadow_and_gradient(self):
        """Multi-layer overlapping chunks must receive a single grounding shadow (no dual shadows) and retain gradient fade."""
        chunks_input = [
            {
                "chunkIndex": 0,
                "text": "Over the last 12 months",
                "startMs": 0,
                "endMs": 1800,
                "words": [{"text": "Over"}, {"text": "the"}, {"text": "last"}, {"text": "12"}, {"text": "months"}],
            },
            {
                "chunkIndex": 1,
                "text": "12,000 physical products",
                "startMs": 1800,
                "endMs": 3600,
                "words": [{"text": "12,000"}, {"text": "physical"}, {"text": "products"}],
            },
            {
                "chunkIndex": 2,
                "text": "sunshine and rainbows.",
                "startMs": 3600,
                "endMs": 5400,
                "words": [{"text": "sunshine"}, {"text": "and"}, {"text": "rainbows."}],
            },
        ]

        for seed in range(30):
            manifest = generate_font_manifest(chunks_input, design_override={"seed": seed, "creativity": "expressive"})
            layers = extract_manifest_layers(manifest)
            budget_result = validate_shadow_glow_budget(layers)

            # Ensure zero compounding multi-shadow violations
            self.assertEqual(
                budget_result["multiShadowViolations"],
                [],
                f"Seed {seed} generated compounding shadows: {budget_result['multiShadowViolations']}",
            )

            # Check each overlapping layer specifically
            for chunk in manifest.get("chunks", []):
                chunk_layers = chunk.get("rendered_layers") or chunk.get("layers") or []
                for layer in chunk_layers:
                    shadow = layer.get("shadow") or ""
                    if layer.get("isOverlapping"):
                        # Must have single grounding shadow (no commas separating multiple shadow clauses)
                        clauses = [s.strip() for s in re.split(r",\s*(?![^(]*\))", shadow) if s.strip()]
                        self.assertEqual(
                            len(clauses),
                            1,
                            f"Seed {seed}, chunk {chunk.get('chunkIndex')} overlapping layer '{layer.get('rawText')}' has multiple shadow clauses: '{shadow}'",
                        )
                    if layer.get("isUnderlapping"):
                        # Must preserve vertical gradient fade
                        self.assertTrue(
                            bool(layer.get("verticalGradient") or layer.get("hasGradient")),
                            f"Seed {seed}, chunk {chunk.get('chunkIndex')} underlapping layer '{layer.get('rawText')}' missing vertical gradient fade",
                        )


if __name__ == "__main__":
    unittest.main()
