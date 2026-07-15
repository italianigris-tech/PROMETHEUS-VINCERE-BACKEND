import json
import sys
import tempfile
import unittest
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from trajectory_extractor.audio_artifacts import (  # noqa: E402
    build_analyzed_pcm_audio_artifact,
    build_fallback_audio_artifact,
    build_wav_audio_artifact,
    audio_features_for_window,
    ensure_audio_artifact_cached,
    load_audio_artifact_for_render,
)


class AudioArtifactContractTest(unittest.TestCase):
    def test_pcm_analysis_emits_energy_onsets_and_non_fallback_beat_grid(self):
        artifact = build_analyzed_pcm_audio_artifact(
            source_hash="sha256:pcm-track",
            samples=[0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0],
            sample_rate=4,
            energy_window_seconds=1.0,
        )

        self.assertEqual(artifact["schema_version"], "audio-artifact-v1")
        self.assertEqual(artifact["source_hash"], "sha256:pcm-track")
        self.assertEqual(artifact["analysis_mode"], "analyzed_pcm")
        self.assertFalse(artifact["is_fallback"])
        self.assertEqual(artifact["duration_seconds"], 2.0)
        self.assertEqual(artifact["energy"]["source"], "pcm_rms")
        self.assertEqual(len(artifact["energy"]["windows"]), 2)
        self.assertEqual(artifact["energy"]["windows"][0]["rms"], 0.707107)
        self.assertEqual(
            [event["time_seconds"] for event in artifact["onsets"]],
            [0.5, 1.5],
        )
        self.assertEqual(
            [beat["time_seconds"] for beat in artifact["beat_grid"]],
            [0.5, 1.5],
        )
        self.assertEqual(artifact["downbeats"], [0.5])
        self.assertEqual(artifact["sections"][0]["label"], "analyzed_audio")
        self.assertNotIn("fallback_bpm_grid", artifact["warnings"])
        self.assertNotIn("energy_unknown", artifact["warnings"])
        self.assertIn("sfx_detection_unavailable", artifact["warnings"])
        self.assertIn("voice_music_separation_unavailable", artifact["warnings"])
        self.assertIn("ducking_unavailable", artifact["warnings"])

    def test_wav_analysis_decodes_16_bit_pcm_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            wav_path = Path(tmp) / "pulse.wav"
            samples = [0, 0, 32767, 32767, 0, 0, 32767, 32767]
            with wave.open(str(wav_path), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(4)
                wav.writeframes(
                    b"".join(
                        sample.to_bytes(2, byteorder="little", signed=True)
                        for sample in samples
                    )
                )

            artifact = build_wav_audio_artifact(
                source_hash="sha256:wav-track",
                wav_path=wav_path,
                energy_window_seconds=1.0,
            )

        self.assertEqual(artifact["schema_version"], "audio-artifact-v1")
        self.assertEqual(artifact["source_hash"], "sha256:wav-track")
        self.assertEqual(artifact["analysis_mode"], "analyzed_pcm")
        self.assertFalse(artifact["is_fallback"])
        self.assertEqual(artifact["duration_seconds"], 2.0)
        self.assertEqual(artifact["media"]["source"], "wav")
        self.assertEqual(artifact["media"]["sample_rate"], 4)
        self.assertEqual(artifact["media"]["channels"], 1)
        self.assertEqual(artifact["energy"]["source"], "pcm_rms")
        self.assertEqual(
            [event["time_seconds"] for event in artifact["onsets"]],
            [0.5, 1.5],
        )
        self.assertEqual(
            [beat["time_seconds"] for beat in artifact["beat_grid"]],
            [0.5, 1.5],
        )
        self.assertNotIn("fallback_bpm_grid", artifact["warnings"])

    def test_pcm_onsets_are_rate_limited_to_keep_artifacts_bounded(self):
        samples = [0.0, 1.0] * 100
        artifact = build_analyzed_pcm_audio_artifact(
            source_hash="sha256:dense-track",
            samples=samples,
            sample_rate=100,
            energy_window_seconds=1.0,
        )

        self.assertLessEqual(len(artifact["onsets"]), 20)
        self.assertIn("pcm_onsets_rate_limited", artifact["warnings"])

    def test_window_features_use_analyzed_artifact_signals(self):
        artifact = build_analyzed_pcm_audio_artifact(
            source_hash="sha256:feature-track",
            samples=[0.0, 0.0, 1.0, 1.0],
            sample_rate=4,
            energy_window_seconds=1.0,
        )
        artifact["onsets"] = [
            {"time_seconds": 0.1, "strength": 0.7, "source": "test"},
            {"time_seconds": 0.2, "strength": 0.7, "source": "test"},
            {"time_seconds": 0.3, "strength": 0.7, "source": "test"},
        ]
        artifact["sfx_events"] = [
            {"time_seconds": 0.25, "class": "whoosh", "confidence": 0.8}
        ]
        artifact["ducking_envelope"] = {
            "source": "test",
            "points": [{"time_seconds": 0.25, "gain_db": -8.0}],
        }

        features = audio_features_for_window(
            artifact,
            start_seconds=0.0,
            end_seconds=1.0,
        )

        self.assertEqual(features["sfx_class"], "whoosh")
        self.assertEqual(features["sfx_count"], 1)
        self.assertTrue(features["music_presence"])
        self.assertEqual(features["music_energy"], "high")
        self.assertEqual(features["beat_proximity"], "on_beat")
        self.assertTrue(features["ducking_active"])
        self.assertFalse(features["has_silence_gap"])
        self.assertEqual(features["transient_density"], "high")

    def test_fallback_artifact_window_features_stay_low_confidence(self):
        artifact = build_fallback_audio_artifact(
            source_hash="sha256:fallback-track",
            duration_seconds=1.0,
            bpm=120.0,
        )

        features = audio_features_for_window(
            artifact,
            start_seconds=0.0,
            end_seconds=1.0,
        )

        self.assertEqual(features["sfx_class"], "none")
        self.assertEqual(features["sfx_count"], 0)
        self.assertFalse(features["music_presence"])
        self.assertEqual(features["music_energy"], "low")
        self.assertEqual(features["beat_proximity"], "off_beat")
        self.assertFalse(features["ducking_active"])
        self.assertEqual(features["transient_density"], "low")
    def test_fallback_artifact_is_deterministic_and_cannot_masquerade_as_analysis(self):
        first = build_fallback_audio_artifact(
            source_hash="sha256:test-track",
            duration_seconds=2.0,
            bpm=120.0,
        )
        second = build_fallback_audio_artifact(
            source_hash="sha256:test-track",
            duration_seconds=2.0,
            bpm=120.0,
        )

        self.assertEqual(first, second)
        self.assertEqual(first["schema_version"], "audio-artifact-v1")
        self.assertEqual(first["source_hash"], "sha256:test-track")
        self.assertEqual(first["analysis_mode"], "fallback_bpm")
        self.assertTrue(first["is_fallback"])
        self.assertEqual(first["beat_grid"][0]["time_seconds"], 0.0)
        self.assertEqual(first["beat_grid"][1]["time_seconds"], 0.5)
        self.assertEqual(first["downbeats"], [0.0])
        self.assertEqual(first["energy"]["source"], "fallback_unknown")
        self.assertEqual(first["sections"][0]["label"], "unknown")
        self.assertIn("fallback_bpm_grid", first["warnings"])
        self.assertIn("voice_music_separation_unavailable", first["warnings"])
        self.assertIn("ducking_unavailable", first["warnings"])

    def test_cache_is_keyed_by_source_hash_and_reuses_existing_artifact(self):
        calls = []

        def analyzer():
            calls.append("called")
            return build_fallback_audio_artifact(
                source_hash="sha256:test-track",
                duration_seconds=1.0,
                bpm=60.0,
            )

        with tempfile.TemporaryDirectory() as tmp:
            first = ensure_audio_artifact_cached(
                source_hash="sha256:test-track",
                cache_dir=Path(tmp),
                analyzer=analyzer,
            )
            second = ensure_audio_artifact_cached(
                source_hash="sha256:test-track",
                cache_dir=Path(tmp),
                analyzer=analyzer,
            )

            self.assertFalse(first.cache_hit)
            self.assertTrue(second.cache_hit)
            self.assertEqual(calls, ["called"])
            self.assertEqual(first.path, second.path)
            self.assertEqual(first.artifact, second.artifact)

            saved = json.loads(first.path.read_text(encoding="utf-8"))
            self.assertEqual(saved, first.artifact)

    def test_render_loader_never_computes_missing_artifacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            cache_dir = Path(tmp)
            with self.assertRaises(FileNotFoundError):
                load_audio_artifact_for_render(
                    source_hash="sha256:missing",
                    cache_dir=cache_dir,
                )

            cached = ensure_audio_artifact_cached(
                source_hash="sha256:test-track",
                cache_dir=cache_dir,
                analyzer=lambda: build_fallback_audio_artifact(
                    source_hash="sha256:test-track",
                    duration_seconds=1.0,
                    bpm=120.0,
                ),
            )

            loaded = load_audio_artifact_for_render(
                source_hash="sha256:test-track",
                cache_dir=cache_dir,
            )
            self.assertEqual(loaded, cached.artifact)


if __name__ == "__main__":
    unittest.main()
