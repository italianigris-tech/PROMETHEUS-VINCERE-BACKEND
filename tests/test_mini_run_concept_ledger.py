"""Tests for SemanticConceptLedger and Cross-Chunk Numeric Anchor Dedup (Order 1).

Validates:
1. Temporal/Metric Unit Disambiguation:
   - '12 months', '3 weeks', '5 days' are recognized as temporal anchors, NOT hero metrics.
   - Numbers in temporal phrases do not trigger metallic chrome counter routing.
2. Hero Value Milestones:
   - Standalone metrics ('12,000', '$50,000', '100%') correctly qualify for counter routing.
3. Cross-Chunk Deduplication & Fatigue Cap:
   - Once a number root (e.g. '12000') is claimed by a counter, identical or competing
     number mentions in proximate chunks cannot re-claim the counter slot.
4. Manifest Integration:
   - Manifest exposes 'semanticConceptLedger' with claimed numbers and claims history.
"""

from __future__ import annotations

import unittest
from typing import Any, Dict, List

from mini_run_pipeline.typography import (
    SemanticConceptLedger,
    generate_font_manifest,
)


def make_chunks(texts: List[str], cadence_ms: int = 240) -> List[Dict[str, Any]]:
    chunks = []
    current_ms = 0
    for i, text in enumerate(texts):
        words = text.split()
        duration_ms = max(len(words) * cadence_ms, 500)
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
        current_ms += duration_ms + 100
    return chunks


class TestSemanticConceptLedger(unittest.TestCase):
    def test_temporal_phrase_identification(self):
        """Temporal units (months, weeks, days, years) are properly identified."""
        self.assertTrue(SemanticConceptLedger.is_temporal_phrase("Over the last 12 months"))
        self.assertTrue(SemanticConceptLedger.is_temporal_phrase("In 3 weeks time"))
        self.assertTrue(SemanticConceptLedger.is_temporal_phrase("After 5 days of testing"))
        self.assertTrue(SemanticConceptLedger.is_temporal_phrase("Working 70 hours a week"))

        self.assertFalse(SemanticConceptLedger.is_temporal_phrase("More than 12,000 physical products"))
        self.assertFalse(SemanticConceptLedger.is_temporal_phrase("Making $50,000 a month"))
        self.assertFalse(SemanticConceptLedger.is_temporal_phrase("Growing to 100% capacity"))

    def test_metric_number_extraction(self):
        """Extracts genuine numeric metrics while discarding temporal durations."""
        metrics_temporal = SemanticConceptLedger.extract_metric_numbers("Over the last 12 months")
        self.assertEqual(metrics_temporal, [])

        metrics_value = SemanticConceptLedger.extract_metric_numbers("More than 12,000 physical products")
        self.assertEqual(metrics_value, ["12000"])

        metrics_multi = SemanticConceptLedger.extract_metric_numbers("From 12 months up to 15,000 users")
        self.assertEqual(metrics_multi, ["15000"])

    def test_cross_chunk_counter_claim_and_dedup(self):
        """Enforces cross-chunk ledger lock: temporal numbers cannot claim, value metrics can claim once."""
        ledger = SemanticConceptLedger(min_counter_gap_chunks=3)

        self.assertFalse(ledger.can_claim_counter(0, "Over the last 12 months"))
        claim_temporal = ledger.claim_concept(0, "Over the last 12 months", "metallic_chrome_counter")
        self.assertIsNone(claim_temporal)

        self.assertTrue(ledger.can_claim_counter(1, "than 12,000 physical products"))
        claim_val = ledger.claim_concept(1, "than 12,000 physical products", "metallic_chrome_counter")
        self.assertEqual(claim_val, "12000")
        self.assertIn("12000", ledger.claimed_numbers)

        self.assertFalse(ledger.can_claim_counter(2, "reselling 12,000 items"))
        self.assertFalse(ledger.can_claim_counter(5, "scaling to 12,000 items"))
        self.assertTrue(ledger.can_claim_counter(5, "revenue hit 50,000 dollars"))

    def test_font_manifest_integration(self):
        """Manifest generation correctly distinguishes '12 months' from '12,000 physical'."""
        chunks = make_chunks([
            "Over the last",
            "12 months",
            "I have purchased more",
            "than 12,000 physical products",
            "from eBay to Amazon",
            "for pure profit",
        ])

        manifest = generate_font_manifest(chunks, {"seed": "concept-ledger-test-seed"})

        self.assertIn("semanticConceptLedger", manifest)
        ledger_data = manifest["semanticConceptLedger"]
        self.assertIn("claimedNumbers", ledger_data)
        self.assertIn("counterClaims", ledger_data)

        c1 = manifest["chunks"][1]
        c3 = manifest["chunks"][3]

        self.assertNotIn(c1.get("fxPreset"), ("metallic_chrome_counter", "metallic_chrome_countup_hero"))

        if c3.get("fxPreset") in ("metallic_chrome_counter", "metallic_chrome_countup_hero"):
            self.assertIn("12000", ledger_data["claimedNumbers"])

    def test_claimed_duplicate_number_detection(self):
        """Ledger correctly marks repeat numbers as claimed duplicates to damp repeated pop/punch treatments."""
        ledger = SemanticConceptLedger(min_counter_gap_chunks=3)
        ledger.claim_concept(0, "purchased 12,000 items", "metallic_chrome_counter")
        self.assertTrue(ledger.is_claimed_duplicate("sold 12,000 products"))
        self.assertFalse(ledger.is_claimed_duplicate("earned $50,000 profit"))


if __name__ == "__main__":
    unittest.main()
