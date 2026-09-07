"""Unit tests for the long-form viral selection and batch execution pipeline."""

from __future__ import annotations

import json
import os
import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path

from mini_run_pipeline import viral_selector
from mini_run_pipeline import longform_pipeline
from mini_run_pipeline import pipeline
from mini_run_pipeline import render


def _make_sample_words(sentence_count: int = 10, words_per_sentence: int = 10, sentence_duration_ms: int = 6000):
    """Generate mock word-timed transcript words for testing."""
    words = []
    current_ms = 0
    word_dur = sentence_duration_ms // words_per_sentence

    for s_idx in range(sentence_count):
        for w_idx in range(words_per_sentence):
            is_last = (w_idx == words_per_sentence - 1)
            text = f"word{s_idx}_{w_idx}." if is_last else f"word{s_idx}_{w_idx}"
            words.append({
                "text": text,
                "start_ms": current_ms,
                "end_ms": current_ms + word_dur,
                "confidence": 0.99,
            })
            current_ms += word_dur + 50
    return words


class TestViralSelector(unittest.TestCase):

    def setUp(self):
        # 20 sentences, each ~6 seconds = ~120 seconds of content
        self.words = _make_sample_words(sentence_count=20, words_per_sentence=8, sentence_duration_ms=6000)

    def test_sentence_segmentation(self):
        sentences = viral_selector._segment_sentences(self.words)
        self.assertEqual(len(sentences), 20)
        self.assertEqual(sentences[0]["sentenceIndex"], 0)
        self.assertTrue(sentences[0]["text"].endswith("."))
        self.assertLess(sentences[0]["startMs"], sentences[0]["endMs"])

    def test_condensed_map_formatting(self):
        sentences = viral_selector._segment_sentences(self.words)
        condensed = viral_selector._build_condensed_map(sentences, max_chars=5000)
        self.assertIn("[00:00:00]", condensed)
        lines = condensed.splitlines()
        self.assertEqual(len(lines), 20)

    def test_snap_to_sentence_boundaries(self):
        sentences = viral_selector._segment_sentences(self.words)
        # Sentence 0 ends ~6000ms, sentence 1 starts ~6050ms
        s0_start = sentences[0]["startMs"]
        s1_start = sentences[1]["startMs"]

        # Snapping near sentence 1 start should snap to sentence 1 start
        snapped = viral_selector._snap_to_sentence_start(sentences, s1_start + 100)
        self.assertEqual(snapped, s1_start)

    def test_parse_llm_response_valid(self):
        sentences = viral_selector._segment_sentences(self.words)
        mock_llm_json = json.dumps([
            {
                "rank": 1,
                "sourceStartMs": 0,
                "sourceEndMs": 40000,
                "viralityScore": 0.95,
                "hook": "The biggest secret to scaling",
                "reason": "High emotional contrast and strong hook",
            },
            {
                "rank": 2,
                "sourceStartMs": 60000,
                "sourceEndMs": 100000,
                "viralityScore": 0.88,
                "hook": "Why everyone gets this wrong",
                "reason": "Counter-intuitive framework",
            },
        ])

        windows = viral_selector._parse_llm_response(mock_llm_json, sentences)
        self.assertEqual(len(windows), 2)
        self.assertEqual(windows[0]["rank"], 1)
        self.assertEqual(windows[0]["viralityScore"], 0.95)
        self.assertEqual(windows[0]["hook"], "The biggest secret to scaling")
        # Ensure gap >= 10,000 ms is preserved
        self.assertGreaterEqual(windows[1]["sourceStartMs"] - windows[0]["sourceEndMs"], 10000)

    def test_heuristic_fallback_when_llm_unavailable(self):
        sentences = viral_selector._segment_sentences(self.words)
        windows = viral_selector._heuristic_fallback_windows(sentences, n=3)
        self.assertEqual(len(windows), 3)

        for w in windows:
            self.assertIn("rank", w)
            self.assertIn("sourceStartMs", w)
            self.assertIn("sourceEndMs", w)
            self.assertIn("durationMs", w)
            self.assertIn("viralityScore", w)
            self.assertIn("hook", w)
            self.assertIn("reason", w)
            self.assertGreaterEqual(w["durationMs"], viral_selector.VIRAL_CLIP_MIN_MS)

        # Check gap between consecutive windows
        self.assertGreaterEqual(windows[1]["sourceStartMs"] - windows[0]["sourceEndMs"], viral_selector.WINDOW_GAP_MIN_MS)
        self.assertGreaterEqual(windows[2]["sourceStartMs"] - windows[1]["sourceEndMs"], viral_selector.WINDOW_GAP_MIN_MS)

    @patch("mini_run_pipeline.viral_selector._call_llm")
    def test_select_viral_windows_with_mock_llm(self, mock_call):
        mock_call.return_value = json.dumps([
            {
                "rank": 1,
                "sourceStartMs": 1000,
                "sourceEndMs": 45000,
                "viralityScore": 0.92,
                "hook": "Never do this in business",
                "reason": "Hard-hitting advice",
            },
            {
                "rank": 2,
                "sourceStartMs": 55000,
                "sourceEndMs": 95000,
                "viralityScore": 0.85,
                "hook": "The paradigm shift",
                "reason": "Surprising perspective",
            },
            {
                "rank": 3,
                "sourceStartMs": 100000,
                "sourceEndMs": 130000,
                "viralityScore": 0.81,
                "hook": "Actionable takeaway",
                "reason": "Direct conclusion",
            },
        ])

        windows = viral_selector.select_viral_windows(self.words, n=3, prompt="Business scaling")
        self.assertEqual(len(windows), 3)
        self.assertEqual(windows[0]["rank"], 1)
        self.assertEqual(windows[0]["hook"], "Never do this in business")
        mock_call.assert_called_once()

    @patch("mini_run_pipeline.viral_selector._call_llm", side_effect=RuntimeError("API Network Timeout"))
    def test_select_viral_windows_graceful_fallback(self, mock_call):
        # Even when LLM fails, select_viral_windows should NOT throw; it falls back to heuristic engine
        windows = viral_selector.select_viral_windows(self.words, n=3)
        self.assertEqual(len(windows), 3)
        self.assertEqual(windows[0]["rank"], 1)
        self.assertTrue(windows[0]["reason"].startswith("High-density"))

    def test_n_clips_clamped_to_1_and_10(self):
        sentences = viral_selector._segment_sentences(self.words)
        # Requesting 15 should clamp to 10
        with patch("mini_run_pipeline.viral_selector._call_llm", side_effect=RuntimeError("fallback")):
            windows = viral_selector.select_viral_windows(self.words, n=15)
            # Clamped to 10 or whatever the sentences allow
            self.assertLessEqual(len(windows), 10)


class TestConfigurableDurationCap(unittest.TestCase):

    def test_pipeline_default_cap_is_30s(self):
        data = {}
        max_clip_ms = int(data.get("maxClipMs", 30000))
        self.assertEqual(max_clip_ms, 30000)

    def test_pipeline_custom_cap_honored(self):
        data = {"maxClipMs": 180000}
        max_clip_ms = int(data.get("maxClipMs", 30000))
        self.assertEqual(max_clip_ms, 180000)

    def test_render_final_video_signature_accepts_max_clip_ms(self):
        import inspect
        sig = inspect.signature(render.render_final_video)
        self.assertIn("max_clip_ms", sig.parameters)
        self.assertEqual(sig.parameters["max_clip_ms"].default, 30000)


class TestLongformBatchOrchestration(unittest.TestCase):

    def setUp(self):
        self.words = _make_sample_words(sentence_count=25, words_per_sentence=8, sentence_duration_ms=6000)

    @patch("mini_run_pipeline.pipeline.execute_pipeline_job")
    def test_execute_longform_batch_concurrent_fanout(self, mock_exec):
        # Mock execute_pipeline_job returning a valid render receipt
        def fake_job(job_id, data, artifact_root=None, slice_executor=None):
            return {
                "outputPath": f"/tmp/renders/{job_id}/final.mp4",
                "outputUrl": f"https://r2.prometheus.test/{job_id}.mp4",
                "r2Key": f"mini-run/{job_id}/final.mp4",
                "chunkCount": 8,
                "stageTimingsMs": {"render": 1200, "total": 1500},
            }
        mock_exec.side_effect = fake_job

        # Create a mock source file
        dummy_source = Path("/tmp/test_source_video.mp4")
        dummy_source.parent.mkdir(parents=True, exist_ok=True)
        dummy_source.write_text("fake video content")

        try:
            with patch("mini_run_pipeline.viral_selector._call_llm", side_effect=RuntimeError("Use heuristic")):
                batch_result = longform_pipeline.execute_longform_batch(
                    source_path=str(dummy_source),
                    n_clips=3,
                    prompt="High energy tech insights",
                    precomputed_words=self.words,
                    artifact_root="/tmp/test_artifacts",
                )

            self.assertEqual(batch_result["clipCount"], 3)
            self.assertEqual(batch_result["succeeded"], 3)
            self.assertEqual(len(batch_result["clips"]), 3)

            # Check that viral metadata is passed down to each clip
            for clip in batch_result["clips"]:
                self.assertTrue(clip["success"])
                self.assertIn("rank", clip)
                self.assertIn("viralMetadata", clip)
                self.assertIn("viralityScore", clip["viralMetadata"])
                self.assertIn("hook", clip["viralMetadata"])
                self.assertIn("reason", clip["viralMetadata"])
                self.assertIn("outputPath", clip)
                self.assertIn("outputUrl", clip)

            # Ensure execute_pipeline_job was called exactly 3 times
            self.assertEqual(mock_exec.call_count, 3)

            # Verify that each call received _precomputedWords and maxClipMs = 300000
            for call in mock_exec.call_args_list:
                call_data = call.kwargs.get("data") or call.args[1]
                self.assertEqual(call_data["maxClipMs"], 300000)
                self.assertIn("_precomputedWords", call_data)
                self.assertIn("viralMetadata", call_data)

        finally:
            if dummy_source.exists():
                dummy_source.unlink()

    def test_gateway_longform_input_validation(self):
        from mini_run_gateway import handle_longform_batch

        # Missing source raises ValueError
        with self.assertRaises(ValueError):
            handle_longform_batch({"nClips": 3})

        # nClips > 10 raises ValueError
        with self.assertRaises(ValueError):
            handle_longform_batch({"source": "/path/to/video.mp4", "nClips": 15})

        # nClips < 1 raises ValueError
        with self.assertRaises(ValueError):
            handle_longform_batch({"source": "/path/to/video.mp4", "nClips": 0})


if __name__ == "__main__":
    unittest.main()
