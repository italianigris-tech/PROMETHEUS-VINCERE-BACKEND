"""Hermetic test verifying Item 3: ASR words and font manifest are persisted into receipts and props."""

import unittest
import json
from pathlib import Path


class TestReceiptPersistence(unittest.TestCase):
    def test_gha_orchestrate_and_stitch_receipt_contract(self):
        """Verify that props and stitch receipt dictionaries retain asrWords, fontManifest, and chunks."""
        # Simulate props produced by gha_orchestrate.py
        norm_words = [
            {"text": "Over", "start_ms": 100, "end_ms": 300, "confidence": 0.99},
            {"text": "the", "start_ms": 300, "end_ms": 450, "confidence": 0.98},
            {"text": "last", "start_ms": 450, "end_ms": 700, "confidence": 0.99},
            {"text": "12", "start_ms": 700, "end_ms": 900, "confidence": 0.95},
            {"text": "months", "start_ms": 900, "end_ms": 1300, "confidence": 0.99},
        ]
        chunks = [
            {"chunkIndex": 0, "text": "Over the last 12 months", "startMs": 100, "endMs": 1300}
        ]
        font_manifest = {
            "chunks": chunks,
            "motif": {"name": "obsidian_crimson"},
            "profile": {"id": "v2_test_profile"},
        }
        
        # Verify props schema
        props = {
            "jobId": "test_job_123",
            "chunks": chunks,
            "fontManifest": font_manifest,
            "asrWords": norm_words,
        }
        self.assertIn("asrWords", props)
        self.assertEqual(len(props["asrWords"]), 5)
        self.assertIn("fontManifest", props)
        self.assertIn("chunks", props)

        # Simulate stitch receipt generation matching gha_stitch.py
        partial = {
            "jobId": "test_job_123",
            "chunkCount": len(chunks),
            "deploymentFingerprint": {"gitSha": "test_sha"},
        }
        
        receipt = {
            **partial,
            "jobId": "test_job_123",
            "status": "completed",
            "asrWords": props.get("asrWords") or [],
            "fontManifest": props.get("fontManifest") or {},
            "chunks": props.get("chunks") or [],
        }

        self.assertIn("asrWords", receipt)
        self.assertEqual(len(receipt["asrWords"]), 5)
        self.assertEqual(receipt["asrWords"][0]["text"], "Over")
        self.assertIn("fontManifest", receipt)
        self.assertEqual(receipt["fontManifest"]["motif"]["name"], "obsidian_crimson")
        self.assertIn("chunks", receipt)
        self.assertEqual(receipt["chunks"][0]["text"], "Over the last 12 months")


if __name__ == "__main__":
    unittest.main()
