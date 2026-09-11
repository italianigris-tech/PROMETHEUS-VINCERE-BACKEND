import unittest
from mini_run_pipeline.typography import (
    _find_best_hero_index,
    smart_partition_chunk_words,
)


class TestRound7NumericHero(unittest.TestCase):
    """Verifies that numeric quantities are prioritized as hero focus words in chunks."""

    def test_find_best_hero_index_prioritizes_digits(self):
        # "12,000" (5 chars) must beat "physical" (8 chars) and "products" (8 chars)
        self.assertEqual(_find_best_hero_index(["12,000", "physical", "products"]), 0)
        self.assertEqual(_find_best_hero_index(["over", "500", "million"]), 1)
        self.assertEqual(_find_best_hero_index(["more", "than", "10x"]), 2)
        self.assertEqual(_find_best_hero_index(["sold", "100k", "units"]), 1)

    def test_find_best_hero_index_non_numeric_longest_substantive(self):
        # When no digits are present, longest substantive content word wins
        self.assertEqual(_find_best_hero_index(["build", "unstoppable", "momentum"]), 1)
        self.assertEqual(_find_best_hero_index(["the", "big", "adventure"]), 2)

    def test_smart_partition_chunk_words_numeric_hero_layer_binding_l1_hero(self):
        # Profile like Getting_More_Personal: layer 0 is secondary (scale 0.5), layer 1 is hero (scale 1.0)
        layers = [
            {"role": "secondary_clause", "font_style": {"relative_scale": 0.5}},
            {"role": "primary_focus_word", "font_style": {"relative_scale": 1.0}},
        ]
        words = ["12,000", "physical", "products"]
        allocations = smart_partition_chunk_words(words, layers)

        self.assertEqual(len(allocations), 2)
        # Allocation 0: leading numeric word gets the hero layer and is_hero=True
        self.assertEqual(allocations[0]["words"], ["12,000"])
        self.assertTrue(allocations[0]["is_hero"])
        self.assertEqual(allocations[0]["layer"]["role"], "primary_focus_word")

        # Allocation 1: companion words get the subordinate layer and is_hero=False
        self.assertEqual(allocations[1]["words"], ["physical", "products"])
        self.assertFalse(allocations[1]["is_hero"])
        self.assertEqual(allocations[1]["layer"]["role"], "secondary_clause")

    def test_smart_partition_chunk_words_numeric_hero_layer_binding_l0_hero(self):
        # Profile where layer 0 is hero (scale 1.0), layer 1 is secondary (scale 0.5)
        layers = [
            {"role": "primary_focus_word", "font_style": {"relative_scale": 1.0}},
            {"role": "secondary_clause", "font_style": {"relative_scale": 0.5}},
        ]
        words = ["12,000", "physical", "products"]
        allocations = smart_partition_chunk_words(words, layers)

        self.assertEqual(len(allocations), 2)
        self.assertEqual(allocations[0]["words"], ["12,000"])
        self.assertTrue(allocations[0]["is_hero"])
        self.assertEqual(allocations[0]["layer"]["role"], "primary_focus_word")

        self.assertEqual(allocations[1]["words"], ["physical", "products"])
        self.assertFalse(allocations[1]["is_hero"])
        self.assertEqual(allocations[1]["layer"]["role"], "secondary_clause")


if __name__ == "__main__":
    unittest.main()
