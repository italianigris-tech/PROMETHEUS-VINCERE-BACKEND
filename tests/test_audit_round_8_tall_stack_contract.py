import random
import unittest
from mini_run_pipeline.typography import (
    generate_font_manifest,
    _resolve_font_json_treatment,
    SINGLE_WORD_HERO_PRESETS,
)


class TestRound8TallStackContract(unittest.TestCase):
    """Verifies that canva_tall_glyph_stack is restricted to single-word layers or behind-subject only."""

    def test_single_word_hero_presets_contains_tall_stack(self):
        self.assertIn("canva_tall_glyph_stack", SINGLE_WORD_HERO_PRESETS)

    def test_resolve_font_json_treatment_guards_tall_stack(self):
        prof = {
            "profile_name": "Test_Tall_Profile",
            "metadata": {"overall_mood": "ultra-compressed tall grotesque"},
        }
        layer_spec = {
            "font_classification": "tall compressed sans",
            "role": "secondary_clause",
        }
        policy = {"avoidPresets": []}

        # Multi-word, NOT behind subject -> canva_tall_glyph_stack must NEVER be returned across 50 trials
        for seed in range(50):
            rng = random.Random(seed)
            fx = _resolve_font_json_treatment(
                prof, layer_spec, is_hero=False, is_single_word=False, rng=rng, policy=policy, behind_subject=False
            )
            self.assertNotEqual(
                fx,
                "canva_tall_glyph_stack",
                f"Seed {seed} returned canva_tall_glyph_stack for multi-word non-behind-subject companion!",
            )

        # Behind-subject or single-word -> canva_tall_glyph_stack CAN be selected
        found_tall_stack = False
        for seed in range(100):
            rng = random.Random(seed)
            fx = _resolve_font_json_treatment(
                prof, layer_spec, is_hero=False, is_single_word=True, rng=rng, policy=policy, behind_subject=False
            )
            if fx == "canva_tall_glyph_stack":
                found_tall_stack = True
                break
        self.assertTrue(found_tall_stack, "canva_tall_glyph_stack should be selectable for single words")

    def test_manifest_across_30_seeds_never_assigns_tall_stack_to_multi_word_companion(self):
        """Manifest generation across 30 seeds must NEVER assign canva_tall_glyph_stack to multi-word companions."""
        sample_chunks = [
            {
                "chunkIndex": 0,
                "text": "Over the last",
                "startMs": 0,
                "endMs": 1200,
                "words": [{"text": "Over"}, {"text": "the"}, {"text": "last"}],
            },
            {
                "chunkIndex": 1,
                "text": "in pure darkness",
                "startMs": 1200,
                "endMs": 2400,
                "words": [{"text": "in"}, {"text": "pure"}, {"text": "darkness"}],
            },
            {
                "chunkIndex": 2,
                "text": "like a shadow",
                "startMs": 2400,
                "endMs": 3600,
                "words": [{"text": "like"}, {"text": "a"}, {"text": "shadow"}],
            },
            {
                "chunkIndex": 3,
                "text": "12,000 physical products",
                "startMs": 3600,
                "endMs": 5200,
                "words": [{"text": "12,000"}, {"text": "physical"}, {"text": "products"}],
            },
        ]

        for seed in range(30):
            design_override = {"seed": seed, "creativity": "expressive"}
            manifest = generate_font_manifest(sample_chunks, design_override=design_override)
            chunks = manifest.get("chunks", [])
            for c in chunks:
                for layer in c.get("layers", []):
                    words = layer.get("words", [])
                    raw_text = layer.get("rawText", "")
                    word_count = len(words) if words else len(raw_text.split())
                    is_behind = layer.get("behindSubject", False)
                    fx = layer.get("fxPreset")

                    if word_count > 1 and not is_behind:
                        self.assertNotEqual(
                            fx,
                            "canva_tall_glyph_stack",
                            f"Seed {seed}, Chunk {c.get('chunkIndex')}, Layer '{raw_text}' was assigned "
                            f"canva_tall_glyph_stack despite having {word_count} words and behindSubject={is_behind}!",
                        )


if __name__ == "__main__":
    unittest.main()
