import json
import tempfile
import unittest
from pathlib import Path

from mini_run_pipeline.orchestration import plan_mini_run_orchestration
from mini_run_pipeline.render import build_audio_mix_command
from mini_run_pipeline.song_program import (
    load_song_catalog,
    materialize_song_program,
    plan_song_program,
)


def _chunks(texts):
    duration = 3000
    return [
        {
            "chunkIndex": index,
            "text": text,
            "outputStartMs": index * duration,
            "outputEndMs": (index + 1) * duration,
            "isHero": index in {0, len(texts) - 1},
            "layers": [{"isHero": index in {0, len(texts) - 1}}],
        }
        for index, text in enumerate(texts)
    ]


def _track(
    track_id,
    *,
    duration_sec=120,
    category="other",
    genre_tags=None,
    mood_tags=None,
    use_case_tags=None,
    render_allowed=True,
):
    return {
        "id": track_id,
        "title": track_id.replace("-", " ").title(),
        "artist": "Catalog Artist",
        "category": category,
        "genreTags": genre_tags or [],
        "moodTags": mood_tags or [],
        "useCaseTags": use_case_tags or [],
        "avoidWhen": [],
        "audioObjectKey": f"music-originals/{category}/{track_id}.mp3",
        "bucket": "prometheus-music",
        "durationSec": duration_sec,
        "renderAllowed": render_allowed,
        "commercialAllowed": render_allowed,
        "licenseVerified": render_allowed,
        "licenseType": "owned_catalog",
    }


class CausalScenePlannerTests(unittest.TestCase):
    def test_landscape_source_gets_contiguous_scenes_and_a_real_pip_treatment(self):
        chunks = _chunks([
            "A useful opening thought",
            "The practical editing workflow",
            "A visual proof point",
            "The final conclusion",
        ])

        plan = plan_mini_run_orchestration(
            chunks=chunks,
            probe={"width": 1920, "height": 1080},
            duration_ms=12000,
            design={"visualIntensity": 0.82, "pipPolicy": "auto"},
            subject_observation={"frames": []},
        )

        self.assertEqual(plan["scenes"][0]["startMs"], 0)
        self.assertEqual(plan["scenes"][-1]["endMs"], 12000)
        for previous, current in zip(plan["scenes"], plan["scenes"][1:]):
            self.assertEqual(previous["endMs"], current["startMs"])
        self.assertTrue(any(scene["layout"] == "floating_pip" for scene in plan["scenes"]))
        self.assertTrue(all(scene["cause"]["chunkIds"] for scene in plan["scenes"]))

    def test_camera_and_sfx_events_trace_to_scene_transitions(self):
        plan = plan_mini_run_orchestration(
            chunks=_chunks(["One", "Two", "Three", "Four", "Five"]),
            probe={"width": 1920, "height": 1080},
            duration_ms=15000,
            design={"visualIntensity": 0.9, "pipPolicy": "featured"},
            subject_observation={"frames": []},
        )

        transition_ids = {event["id"] for event in plan["transitions"]}
        scene_ids = {scene["id"] for scene in plan["scenes"]}
        self.assertTrue(plan["transitions"])
        self.assertTrue(all(event["causedBySceneId"] in scene_ids for event in plan["transitions"]))
        self.assertTrue(all(
            move.get("causedByTransitionId") in transition_ids or move.get("causedBySceneId") in scene_ids
            for move in plan["cameraMoves"]
        ))
        self.assertTrue(all(event["causedByTransitionId"] in transition_ids for event in plan["sfx"]))
        self.assertTrue(all(move["curve"] == [0.16, 1.0, 0.3, 1.0] for move in plan["cameraMoves"]))
        self.assertTrue(all(1.0 <= move["overshootScale"] <= 1.06 for move in plan["cameraMoves"]))


class SongProgrammeTests(unittest.TestCase):
    def test_only_render_approved_tracks_are_eligible(self):
        program = plan_song_program(
            catalog=[
                _track("unsafe-perfect-match", category="tech", genre_tags=["ai"], render_allowed=False),
                _track("approved-support", category="other", use_case_tags=["speech-friendly"]),
            ],
            chunks=_chunks(["AI systems and a practical workflow"]),
            duration_ms=3000,
            design={},
        )

        self.assertEqual([event["trackId"] for event in program["events"]], ["approved-support"])
        self.assertEqual(program["events"][0]["approval"]["licenseVerified"], True)

    def test_semantic_catalog_metadata_changes_track_ranking(self):
        program = plan_song_program(
            catalog=[
                _track("calm-piano", category="classical", mood_tags=["calm"]),
                _track(
                    "future-signal",
                    category="tech-futuristic-ai",
                    genre_tags=["tech", "futuristic", "ai"],
                    use_case_tags=["workflow"],
                ),
            ],
            chunks=_chunks(["A futuristic AI workflow for creators"]),
            duration_ms=3000,
            design={},
        )

        self.assertEqual(program["events"][0]["trackId"], "future-signal")
        self.assertGreater(program["events"][0]["selectionScore"], 0)
        self.assertTrue(program["events"][0]["selectionEvidence"])

    def test_one_song_with_runway_covers_the_short_without_a_forced_change(self):
        program = plan_song_program(
            catalog=[
                _track("primary", duration_sec=90, mood_tags=["focused"]),
                _track("secondary", duration_sec=90, mood_tags=["focused"]),
            ],
            chunks=_chunks(["Focused explanation", "Focused proof"]),
            duration_ms=6000,
            design={},
        )

        self.assertEqual(len(program["events"]), 1)
        self.assertEqual(program["events"][0]["timelineStartMs"], 0)
        self.assertEqual(program["events"][0]["timelineEndMs"], 6000)
        self.assertEqual(program["transitions"], [])

    def test_exhausted_song_hands_off_with_a_gapless_crossfade(self):
        program = plan_song_program(
            catalog=[
                _track("short-ai", duration_sec=7, category="tech", genre_tags=["ai", "workflow"]),
                _track("continuation", duration_sec=12, category="other", mood_tags=["focused"]),
            ],
            chunks=_chunks(["AI workflow", "Focused explanation", "A clear finish"]),
            duration_ms=9000,
            design={"songCrossfadeMs": 800},
        )

        self.assertEqual(len(program["events"]), 2)
        first, second = program["events"]
        self.assertLess(second["timelineStartMs"], first["timelineEndMs"])
        self.assertEqual(first["timelineEndMs"] - second["timelineStartMs"], 800)
        self.assertEqual(program["transitions"][0]["durationMs"], 800)
        self.assertEqual(program["transitions"][0]["fromTrackId"], "short-ai")
        self.assertEqual(program["transitions"][0]["toTrackId"], "continuation")

    def test_r2_catalog_reference_is_loaded_through_storage(self):
        catalog = {"entries": [_track("r2-song")]}

        class CatalogStorage:
            def __init__(self):
                self.reads = []

            def read_json(self, key, bucket=None):
                self.reads.append((bucket, key))
                return catalog

        storage = CatalogStorage()
        loaded = load_song_catalog("r2://prometheus-music/catalog/music.json", storage=storage)

        self.assertEqual(loaded, catalog)
        self.assertEqual(storage.reads, [("prometheus-music", "catalog/music.json")])

    def test_materialization_downloads_every_planned_song_to_a_local_file(self):
        program = plan_song_program(
            catalog=[_track("short", duration_sec=3), _track("long", duration_sec=10)],
            chunks=_chunks(["Short", "Longer explanation"]),
            duration_ms=6000,
            design={"songTrackId": "short", "songCrossfadeMs": 600},
        )

        class DownloadStorage:
            def __init__(self):
                self.downloads = []

            def download_file(self, key, local_path, bucket=None):
                self.downloads.append((bucket, key))
                Path(local_path).write_bytes(b"ID3-renderable-audio")
                return str(local_path)

        with tempfile.TemporaryDirectory() as temp_dir:
            storage = DownloadStorage()
            materialized = materialize_song_program(program, storage=storage, cache_dir=temp_dir)

            self.assertEqual(len(storage.downloads), 2)
            self.assertTrue(all(Path(event["localPath"]).is_file() for event in materialized["events"]))
            self.assertTrue(all(Path(event["localPath"]).stat().st_size > 0 for event in materialized["events"]))

    def test_local_catalog_path_is_supported_for_offline_validation(self):
        catalog = {"entries": [_track("local-song")]}
        with tempfile.TemporaryDirectory() as temp_dir:
            catalog_path = Path(temp_dir) / "catalog.json"
            catalog_path.write_text(json.dumps(catalog), encoding="utf-8")

            self.assertEqual(load_song_catalog(str(catalog_path)), catalog)


class AudioMixCommandTests(unittest.TestCase):
    def test_song_program_is_ducked_crossfaded_and_normalized_with_event_sfx(self):
        program = {
            "durationMs": 9000,
            "baseGainDb": -18,
            "dialogueDucking": {"threshold": 0.02, "ratio": 8, "attackMs": 20, "releaseMs": 350},
            "events": [
                {"id": "song-1", "localPath": "/tmp/song-a.mp3", "sourceStartMs": 0, "sourceEndMs": 7000, "timelineStartMs": 0, "timelineEndMs": 7000},
                {"id": "song-2", "localPath": "/tmp/song-b.mp3", "sourceStartMs": 0, "sourceEndMs": 2800, "timelineStartMs": 6200, "timelineEndMs": 9000},
            ],
            "transitions": [{"fromTrackId": "a", "toTrackId": "b", "durationMs": 800}],
        }
        command = build_audio_mix_command(
            muted_video_path="/tmp/muted.mp4",
            dialogue_path="/tmp/dialogue.aac",
            song_program=program,
            sfx_events=[{"id": "sfx-1", "localPath": "/tmp/whoosh.mp3", "triggerMs": 3100, "gainDb": -15}],
            output_path="/tmp/final.mp4",
        )
        filtergraph = command[command.index("-filter_complex") + 1]

        self.assertIn("/tmp/song-a.mp3", command)
        self.assertIn("/tmp/song-b.mp3", command)
        self.assertIn("acrossfade=d=0.800", filtergraph)
        self.assertIn("sidechaincompress=threshold=0.02:ratio=8", filtergraph)
        self.assertIn("adelay=3100|3100", filtergraph)
        self.assertIn("loudnorm=I=-14:TP=-1:LRA=11", filtergraph)
        self.assertIn("-ar", command)
        self.assertEqual(command[command.index("-ar") + 1], "48000")

    def test_audio_bake_rejects_a_planned_program_without_materialized_songs(self):
        with self.assertRaisesRegex(RuntimeError, "materialized song"):
            build_audio_mix_command(
                muted_video_path="/tmp/muted.mp4",
                dialogue_path="/tmp/dialogue.aac",
                song_program={"durationMs": 3000, "events": [{"id": "song-1"}]},
                sfx_events=[],
                output_path="/tmp/final.mp4",
            )


if __name__ == "__main__":
    unittest.main()
