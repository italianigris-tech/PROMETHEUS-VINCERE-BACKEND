"""Hermetic test verifying Item 2: Narrow quantity+unit fuzzy matching and cross-chunk context."""

import unittest
from mini_run_pipeline import typography
from mini_run_pipeline.typography import SemanticConceptLedger


class TestFuzzyTemporalMatching(unittest.TestCase):
    def test_exact_temporal_units_suppressed_from_counters(self):
        """Standard temporal units like 'months' are recognized as duration, not counters."""
        self.assertTrue(SemanticConceptLedger.is_temporal_phrase("last 12 months"))
        self.assertEqual(SemanticConceptLedger.extract_metric_numbers("last 12 months"), [])

    def test_asr_modes_fuses_to_months_when_quantity_and_unit(self):
        """ASR misrecognition 'modes' fuses to 'months' when preceded by temporal modifier."""
        # Preceded by 'last'
        self.assertTrue(SemanticConceptLedger.is_temporal_phrase("last 12 modes"))
        self.assertEqual(SemanticConceptLedger.extract_metric_numbers("last 12 modes"), [])

        # Preceded by 'past' or 'over'
        self.assertTrue(SemanticConceptLedger.is_temporal_phrase("over the past 6 modes"))
        self.assertEqual(SemanticConceptLedger.extract_metric_numbers("over the past 6 modes"), [])

    def test_genuine_modes_not_over_suppressed(self):
        """Genuine uses like '6 modes of thinking' are NOT suppressed as temporal phrases."""
        self.assertFalse(SemanticConceptLedger.is_temporal_phrase("6 modes of thinking"))
        self.assertEqual(SemanticConceptLedger.extract_metric_numbers("6 modes of thinking"), ["6"])

        # Standalone '6 modes' without temporal preposition
        self.assertFalse(SemanticConceptLedger.is_temporal_phrase("6 modes"))
        self.assertEqual(SemanticConceptLedger.extract_metric_numbers("6 modes"), ["6"])

    def test_cross_chunk_temporal_context(self):
        """When a chunk ends with a number and the next chunk starts with the unit, context bridges the gap."""
        ledger = SemanticConceptLedger()
        # chunk 0: 'last 12', chunk 1: 'modes, I've'
        can_claim = ledger.can_claim_counter(0, "last 12", next_chunk_text="modes, I've")
        self.assertFalse(can_claim, "Should not claim counter when next chunk provides temporal unit 'modes'")

    def test_hero_metric_milestones_remain_eligible(self):
        """True numeric milestones like '12,000 physical products' remain eligible for counters."""
        self.assertFalse(SemanticConceptLedger.is_temporal_phrase("12,000 physical products"))
        self.assertEqual(SemanticConceptLedger.extract_metric_numbers("12,000 physical products"), ["12000"])


if __name__ == "__main__":
    unittest.main()
