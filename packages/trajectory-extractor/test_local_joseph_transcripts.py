import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import run_local_joseph_artifacts as local


class AssemblyAITranscriptEvidenceTest(unittest.TestCase):
    def test_live_assemblyai_path_uploads_submits_polls_and_emits_word_timing(self):
        calls = []

        def fake_request(method, url, *, api_key, json_body=None, file_path=None):
            calls.append((method, url, json_body, Path(file_path).name if file_path else None, api_key))
            if url.endswith("/upload"):
                self.assertEqual(method, "POST")
                self.assertEqual(Path(file_path).name, "clip.wav")
                return {"upload_url": "https://cdn.example/clip.wav"}
            if url.endswith("/transcript") and method == "POST":
                self.assertEqual(json_body["audio_url"], "https://cdn.example/clip.wav")
                return {"id": "tx_123", "status": "queued"}
            if url.endswith("/transcript/tx_123"):
                return {
                    "id": "tx_123",
                    "status": "completed",
                    "text": "Build better systems.",
                    "confidence": 0.94,
                    "words": [
                        {"text": "Build", "start": 120, "end": 420, "confidence": 0.96},
                        {"text": "better", "start": 430, "end": 760, "confidence": 0.93},
                        {"text": "systems.", "start": 770, "end": 1100, "confidence": 0.92},
                    ],
                    "utterances": [
                        {"text": "Build better systems.", "start": 120, "end": 1100, "confidence": 0.94},
                    ],
                }
            raise AssertionError(f"unexpected request {method} {url}")

        with tempfile.TemporaryDirectory() as tmp:
            wav_path = Path(tmp) / "clip.wav"
            wav_path.write_bytes(b"RIFFfake")
            evidence = local._build_transcript_evidence(
                "joseph-test",
                {"title": "Joseph Test"},
                str(wav_path),
                assemblyai_api_key="test-key",
                poll_seconds=0.0,
                timeout_seconds=1.0,
                assemblyai_request=fake_request,
            )

        self.assertEqual(evidence["source"], "assemblyai")
        self.assertEqual(evidence["transcript_id"], "tx_123")
        self.assertEqual(evidence["status"], "completed")
        self.assertEqual(evidence["text"], "Build better systems.")
        self.assertEqual(evidence["segments"][0]["start_seconds"], 0.12)
        self.assertEqual(evidence["words"][1], {"text": "better", "start_seconds": 0.43, "end_seconds": 0.76, "confidence": 0.93})
        self.assertEqual(evidence["warnings"], [])
        self.assertEqual([call[0] for call in calls], ["POST", "POST", "GET"])

    def test_live_assemblyai_failure_returns_explicit_non_trainable_warning(self):
        def fake_request(method, url, *, api_key, json_body=None, file_path=None):
            if url.endswith("/upload"):
                return {"upload_url": "https://cdn.example/clip.wav"}
            if url.endswith("/transcript") and method == "POST":
                return {"id": "tx_failed", "status": "queued"}
            return {"id": "tx_failed", "status": "error", "error": "audio decode failed"}

        with tempfile.TemporaryDirectory() as tmp:
            wav_path = Path(tmp) / "clip.wav"
            wav_path.write_bytes(b"RIFFfake")
            evidence = local._build_transcript_evidence(
                "joseph-test",
                {"title": "Joseph Test"},
                str(wav_path),
                assemblyai_api_key="test-key",
                poll_seconds=0.0,
                timeout_seconds=1.0,
                assemblyai_request=fake_request,
            )

        self.assertEqual(evidence["source"], "assemblyai")
        self.assertEqual(evidence["status"], "error")
        self.assertEqual(evidence["segments"], [])
        self.assertEqual(evidence["words"], [])
        self.assertIn("assemblyai_transcription_failed:audio decode failed", evidence["warnings"])


if __name__ == "__main__":
    unittest.main()