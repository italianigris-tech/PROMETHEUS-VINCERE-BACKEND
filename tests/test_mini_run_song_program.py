import unittest
import json
import os
import tempfile
from pathlib import Path

from mini_run_pipeline import song_program


class MiniRunSongProgramTests(unittest.TestCase):
    """Unit tests for sound and music utilization in the mini-run pipeline."""

    @classmethod
    def setUpClass(cls):
        cls.catalog = song_program.load_song_catalog()

    def test_catalog_discovery_has_valid_approved_entries(self):
        entries = self.catalog.get("entries", [])
        self.assertGreaterEqual(len(entries), 200)
        for track in entries:
            self.assertTrue(track.get("id"))
            self.assertTrue(track.get("title"))
            self.assertTrue(track.get("category"))
            self.assertTrue(track.get("renderAllowed"))
            self.assertTrue(track.get("commercialAllowed"))
            self.assertTrue(track.get("licenseVerified"))
            self.assertGreater(float(track.get("durationSec", 0)), 0)

    def test_list_selectable_songs_unfiltered(self):
        songs = song_program.list_selectable_songs(self.catalog)
        self.assertGreaterEqual(len(songs), 200)

    def test_iter_selectable_songs_lazily_streams(self):
        generator = song_program.iter_selectable_songs(self.catalog)
        first_few = [next(generator) for _ in range(5)]
        self.assertEqual(len(first_few), 5)
        for item in first_few:
            self.assertTrue(item.get("id"))

    def test_pagination_slices_correctly(self):
        page1 = song_program.list_selectable_songs(self.catalog, page=1, page_size=15)
        page2 = song_program.list_selectable_songs(self.catalog, page=2, page_size=15)
        self.assertEqual(len(page1), 15)
        self.assertEqual(len(page2), 15)
        p1_ids = {s["id"] for s in page1}
        p2_ids = {s["id"] for s in page2}
        self.assertEqual(len(p1_ids.intersection(p2_ids)), 0)

    def test_list_selectable_songs_filtered_by_category(self):
        lofi = song_program.list_selectable_songs(self.catalog, category="lo-fi")
        self.assertGreater(len(lofi), 0)
        for s in lofi:
            self.assertTrue("lo-fi" in s["category"].lower() or any("lo-fi" in t.lower() for t in s["genreTags"]))

    def test_list_selectable_songs_filtered_by_mood(self):
        chill = song_program.list_selectable_songs(self.catalog, mood="chill")
        self.assertGreater(len(chill), 0)
        for s in chill:
            self.assertTrue(any("chill" in t.lower() for t in s["moodTags"]))

    def test_list_selectable_songs_filtered_by_intensity(self):
        hard = song_program.list_selectable_songs(self.catalog, intensity="hard")
        self.assertGreater(len(hard), 0)
        for s in hard:
            self.assertEqual(s["intensity"].lower(), "hard")

    def test_list_selectable_songs_filtered_by_search(self):
        search_res = song_program.list_selectable_songs(self.catalog, search="trailer")
        self.assertGreater(len(search_res), 0)
        self.assertTrue(any("trailer" in s["title"].lower() for s in search_res))

    # -----------------------------------------------------------------------
    # Individual Selection Tests ("How the individual selects songs")
    # -----------------------------------------------------------------------

    def test_individual_selection_by_exact_track_id(self):
        target_id = "music-preview-cinematic-trailer-epic-intense-trailer"
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=[{"text": "generic speech text", "startMs": 0, "endMs": 3000, "wordCount": 3}],
            duration_ms=10000,
            design={"songTrackId": target_id},
        )
        self.assertEqual(len(program["events"]), 1)
        self.assertEqual(program["events"][0]["trackId"], target_id)
        self.assertEqual(program["events"][0]["resolution"], "individual_selection")

    def test_individual_selection_by_title_substring(self):
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=[{"text": "generic speech text", "startMs": 0, "endMs": 3000, "wordCount": 3}],
            duration_ms=10000,
            design={"songTitle": "The Way"},
        )
        self.assertIn("The Way", program["events"][0]["title"])
        self.assertEqual(program["events"][0]["resolution"], "individual_selection")

    def test_individual_selection_by_genre(self):
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=[{"text": "generic speech text", "startMs": 0, "endMs": 3000, "wordCount": 3}],
            duration_ms=10000,
            design={"songGenre": "lo-fi"},
        )
        self.assertEqual(program["events"][0]["resolution"], "individual_selection")
        self.assertTrue("lo-fi" in program["events"][0]["category"] or any("lo-fi" in t for t in program["events"][0].get("genreTags", [])))

    def test_individual_selection_by_mood(self):
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=[{"text": "generic speech text", "startMs": 0, "endMs": 3000, "wordCount": 3}],
            duration_ms=10000,
            design={"songMood": "calm"},
        )
        self.assertEqual(program["events"][0]["resolution"], "individual_selection")

    def test_individual_selection_by_intensity(self):
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=[{"text": "generic speech text", "startMs": 0, "endMs": 3000, "wordCount": 3}],
            duration_ms=10000,
            design={"songIntensity": "hard"},
        )
        self.assertEqual(program["events"][0]["resolution"], "individual_selection")
        self.assertEqual(program["events"][0]["intensity"], "hard")

    def test_individual_selection_by_artist(self):
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=[{"text": "generic speech text", "startMs": 0, "endMs": 3000, "wordCount": 3}],
            duration_ms=10000,
            design={"songArtist": "Vivaldi"},
        )
        self.assertEqual(program["events"][0]["resolution"], "individual_selection")
        self.assertIn("Vivaldi", program["events"][0]["artist"])

    def test_individual_selection_custom_audio_file(self):
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            f.write(b"fake audio bytes for custom source test" * 100)
            custom_path = f.name
        try:
            program = song_program.plan_song_program(
                catalog=self.catalog,
                chunks=[{"text": "generic speech text", "startMs": 0, "endMs": 3000, "wordCount": 3}],
                duration_ms=10000,
                design={"songSource": custom_path},
            )
            self.assertEqual(program["events"][0]["resolution"], "individual_selection")
            self.assertEqual(program["events"][0]["localPath"], custom_path)
            self.assertEqual(program["events"][0]["category"], "custom")
        finally:
            if os.path.exists(custom_path):
                os.remove(custom_path)

    def test_individual_policy_disabled_produces_no_music(self):
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=[{"text": "generic speech text", "startMs": 0, "endMs": 3000, "wordCount": 3}],
            duration_ms=10000,
            design={"songPolicy": "disabled"},
        )
        self.assertEqual(program["policy"], "disabled")
        self.assertEqual(len(program["events"]), 0)
        self.assertEqual(program["baseGainDb"], -60.0)

    # -----------------------------------------------------------------------
    # System Autonomous Selection Tests ("How the system selects songs")
    # -----------------------------------------------------------------------

    def test_system_autonomous_selection_with_transcript_semantics(self):
        chunks = [
            {"text": "The tech robot AI revolution is here right now", "startMs": 0, "endMs": 3000, "wordCount": 9},
            {"text": "Futuristic algorithms are learning to code software", "startMs": 3200, "endMs": 6000, "wordCount": 8},
        ]
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=chunks,
            duration_ms=15000,
            design={"seed": "deterministic-ai-seed-1"},
        )
        self.assertEqual(program["selectionMode"], "system_autonomous")
        event = program["events"][0]
        self.assertIn("semantic", event["scoreBreakdown"])
        self.assertTrue(
            "tech" in event.get("category", "").lower()
            or any(t in event.get("genreTags", []) for t in {"tech", "futuristic", "ai", "trap"})
            or event["selectionScore"] > 0
        )

    def test_system_autonomous_selection_with_look_affinity_blockbuster(self):
        chunks = [{"text": "Regular speech talking about everyday life", "startMs": 0, "endMs": 3000, "wordCount": 7}]
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=chunks,
            duration_ms=15000,
            design={"lookId": "teal_and_orange_blockbuster"},
        )
        event = program["events"][0]
        self.assertEqual(event["lookAffinity"], "teal_and_orange_blockbuster")

    def test_system_autonomous_selection_with_fast_speech_cadence(self):
        fast_words = [{"text": f"word{i}", "start_ms": i * 160, "end_ms": (i + 1) * 160} for i in range(30)]
        chunks = [{
            "text": " ".join(w["text"] for w in fast_words),
            "startMs": 0,
            "endMs": 5000,
            "words": fast_words,
            "wordCount": 30,
        }]
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=chunks,
            duration_ms=15000,
            design={"seed": "fast-cadence-seed"},
        )
        self.assertGreater(program["speechCadenceWps"], 2.8)
        event = program["events"][0]
        self.assertIn(event["intensity"], {"hard", "medium"})

    def test_system_autonomous_selection_with_slow_speech_cadence(self):
        chunks = [{
            "text": "Peaceful quiet contemplation",
            "startMs": 0,
            "endMs": 4000,
            "wordCount": 3,
        }]
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=chunks,
            duration_ms=15000,
            design={"seed": "slow-cadence-seed"},
        )
        self.assertLess(program["speechCadenceWps"], 2.0)

    def test_dynamic_ducking_profile_by_intensity(self):
        duck_hard = song_program._compute_ducking_profile("hard")
        self.assertEqual(duck_hard["ratio"], 3.8)
        self.assertEqual(duck_hard["attackMs"], 95)
        self.assertEqual(duck_hard["releaseMs"], 750)

        duck_soft = song_program._compute_ducking_profile("soft")
        self.assertEqual(duck_soft["ratio"], 2.5)
        self.assertEqual(duck_soft["attackMs"], 150)
        self.assertEqual(duck_soft["releaseMs"], 950)

    def test_runway_exhaustion_multi_track_chaining(self):
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=[{"text": "long video testing chaining", "startMs": 0, "endMs": 3000, "wordCount": 4}],
            duration_ms=60000,
            design={"songTrackId": "music-preview-other-work-for-it"},
        )
        self.assertGreaterEqual(len(program["events"]), 2)
        self.assertEqual(len(program["transitions"]), len(program["events"]) - 1)
        first_trans = program["transitions"][0]
        self.assertEqual(first_trans["fromTrackId"], "music-preview-other-work-for-it")
    def test_gateway_music_catalog_endpoint(self):
        import urllib.request
        from mini_run_gateway import start_gateway

        server = start_gateway(port=8991, node_studio_port=8992, start_node_studio=False)
        try:
            with urllib.request.urlopen("http://127.0.0.1:8991/api/pipeline/music/catalog") as res:
                self.assertEqual(res.status, 200)
                data = json.loads(res.read().decode("utf-8"))
                self.assertTrue(data["ok"])
                self.assertGreaterEqual(data["total"], 200)
                self.assertIn("categories", data)
                self.assertIn("moods", data)

            with urllib.request.urlopen("http://127.0.0.1:8991/api/pipeline/music/catalog?page=1&pageSize=10") as res:
                self.assertEqual(res.status, 200)
                data = json.loads(res.read().decode("utf-8"))
                self.assertTrue(data["ok"])
                self.assertEqual(data["count"], 10)
                self.assertGreaterEqual(data["total"], 200)
                self.assertEqual(data["page"], 1)
                self.assertEqual(data["pageSize"], 10)
                self.assertGreaterEqual(data["totalPages"], 20)

            with urllib.request.urlopen("http://127.0.0.1:8991/api/pipeline/songs?category=lo-fi") as res:
                self.assertEqual(res.status, 200)
                data = json.loads(res.read().decode("utf-8"))
                self.assertTrue(data["ok"])
                self.assertGreater(data["count"], 0)
        finally:
            server.shutdown()
            server.server_close()

    def test_autonomous_chorus_and_drop_detection(self):
        # Locate any real local song in PROMETHEUS_SONGS
        song_cand = song_program._find_any_valid_local_song()
        self.assertIsNotNone(song_cand)
        start_ms, reason = song_program.detect_track_chorus_or_drop(str(song_cand), timeline_duration_ms=30000)
        self.assertIsInstance(start_ms, int)
        self.assertGreaterEqual(start_ms, 0)
        self.assertIsInstance(reason, str)

    def test_materialize_dynamic_chorus_offset(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            fallback = song_program.resolve_fallback_local_song(duration_ms=25000, cache_dir=tmp_dir)
            self.assertIsNotNone(fallback)
            event = fallback["events"][0]
            self.assertGreater(event["actualDurationMs"], 0)
            self.assertEqual(fallback["baseGainDb"], -7.0)

    def test_extract_audio_intent_business_deliberate_prompt(self):
        prompt = "This is a business related call, new section should have been intentional, deliberate."
        intent = song_program.extract_audio_intent_from_prompt(prompt)
        self.assertIn("business", intent["activeDomains"])
        self.assertIn("intentional_deliberate", intent["activeDomains"])
        self.assertEqual(intent["explicitMood"], "deliberate")
        self.assertIn("business", intent["preferredCategories"])
        self.assertIn("intentional", intent["preferredTags"])
        self.assertIn("other", intent["avoidCategories"])

    def test_prompt_influences_music_selection_for_business_call(self):
        chunks = [
            {"text": "We are going over the financial targets and executive roadmap for next quarter", "startMs": 0, "endMs": 4000, "wordCount": 12},
            {"text": "Discipline and clear execution will determine our growth and market position", "startMs": 4200, "endMs": 8500, "wordCount": 11},
        ]
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=chunks,
            duration_ms=15000,
            prompt="Business related call, intentional, deliberate executive underscore",
        )
        self.assertEqual(program["selectionMode"], "system_autonomous")
        self.assertIn("business", program["audioIntent"]["activeDomains"])
        event = program["events"][0]
        self.assertIn("domainContext", event["scoreBreakdown"])
        self.assertGreater(event["scoreBreakdown"]["domainContext"], 0.0)
        # Verify track is not a casual pop/party track
        self.assertNotEqual(event["category"], "other")
        self.assertIn(
            event["category"],
            {"business", "authority", "classical", "piano", "lo-fi-chill-soft-focus", "lofi", "motivational-uplift", "documentary"}
        )

    def test_pbd_transcript_autonomous_business_selection_penalizes_party_clash(self):
        # Realistic Patrick Bet-David transcript tokens reflecting his story
        chunks = [
            {"text": "at this point, let me explain to you where I was at", "startMs": 0, "endMs": 3000, "wordCount": 11},
            {"text": "Patrick Bet-David was a party guy at this time Century Club Key Club", "startMs": 3200, "endMs": 7000, "wordCount": 13},
            {"text": "My life consisted of bodybuilding, partying, working out, that was it", "startMs": 7200, "endMs": 11500, "wordCount": 11},
            {"text": "Then I was recommended the first book How to Win Friends and Influence People", "startMs": 11800, "endMs": 16000, "wordCount": 13},
            {"text": "Valuetainment, CEO conference, Vault Conference vision and old business card", "startMs": 16200, "endMs": 20000, "wordCount": 10},
        ]
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=chunks,
            duration_ms=20000,
            prompt="Business related call, intentional, deliberate",
        )
        event = program["events"][0]
        # Verify party track 'other/give-me-everything-stripped-down' is NOT chosen
        self.assertNotEqual(event["trackId"], "other/give-me-everything-stripped-down")
        self.assertIn(
            event["category"],
            {"business", "authority", "classical", "piano", "lo-fi-chill-soft-focus", "lofi", "motivational-uplift", "documentary"}
        )
        # Verify domainContext score is positive and logs domain evidence
        self.assertGreater(event["scoreBreakdown"]["domainContext"], 0)
        self.assertTrue(any("business" in str(e).lower() or "intentional" in str(e).lower() for e in event["selectionEvidence"]))

    def test_explicit_prompt_direct_track_request(self):
        chunks = [{"text": "Testing direct prompt track selection", "startMs": 0, "endMs": 3000, "wordCount": 5}]
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=chunks,
            duration_ms=10000,
            prompt="Please use track Executive Board Bed for this meeting",
        )
        self.assertEqual(program["events"][0]["resolution"], "individual_selection")
        self.assertIn("Executive Board Bed", program["events"][0]["title"])

    def test_list_selectable_songs_with_prompt_ranking(self):
        songs = song_program.list_selectable_songs(
            self.catalog,
            prompt="intentional deliberate business meeting call",
            page=1,
            page_size=5,
        )
        self.assertGreater(len(songs), 0)
        first_song = songs[0]
        self.assertIn(
            first_song["category"],
            {"business", "classical", "piano", "lo-fi-chill-soft-focus", "lofi", "motivational-uplift", "documentary"}
        )

    def test_gateway_music_recommend_endpoint(self):
        import urllib.request
        from mini_run_gateway import start_gateway

        server = start_gateway(port=8993, node_studio_port=8994, start_node_studio=False)
        try:
            url = "http://127.0.0.1:8993/api/pipeline/music/recommend?prompt=business+call+intentional+deliberate"
            with urllib.request.urlopen(url) as res:
                self.assertEqual(res.status, 200)
                data = json.loads(res.read().decode("utf-8"))
                self.assertTrue(data["ok"])
                self.assertIn("audioIntent", data)
                self.assertIn("business", data["audioIntent"]["activeDomains"])
                self.assertGreater(len(data["recommendedSongs"]), 0)
        finally:
            server.shutdown()
            server.server_close()


    # -----------------------------------------------------------------------
    # Creator Reference Archetype & Emotional Storyboard Tests
    # -----------------------------------------------------------------------

    def test_creator_reference_archetypes_present_in_catalog(self):
        """Verify that all 5 creator reference archetypes and 14 curated tracks exist in catalog."""
        entries = self.catalog.get("entries", [])
        archetypes = {e.get("archetype") for e in entries if e.get("archetype")}
        for expected in ["positive", "authority", "storytelling", "educational", "emotional"]:
            self.assertIn(expected, archetypes)

        # Check for key iconic tracks
        track_ids = {e["id"] for e in entries}
        self.assertIn("educational/earfquake", track_ids)
        self.assertIn("authority/feeling-blue", track_ids)
        self.assertIn("positive/first-place", track_ids)
        self.assertIn("emotional/limerence", track_ids)
        self.assertIn("storytelling/leanin-slowed", track_ids)

        # Verify pre-computed drops
        earfquake = next(e for e in entries if e["id"] == "educational/earfquake")
        self.assertEqual(earfquake["dropOnsetSec"], 22.5)

    def test_emotional_storyboard_positive_narrative(self):
        chunks = [
            {"text": "We won first place! Celebrating this incredible victory and amazing breakthrough!", "startMs": 0, "endMs": 4000, "wordCount": 12},
            {"text": "A transformed future full of joy, happiness, and unstoppable energy.", "startMs": 4200, "endMs": 9000, "wordCount": 10},
        ]
        storyboard = song_program.analyze_video_emotional_storyboard(chunks, duration_ms=25000)
        self.assertEqual(storyboard["dominant_archetype"], "positive")
        self.assertEqual(storyboard["entry_preference"], "hook_drop")
        self.assertGreater(storyboard["archetype_scores"]["positive"], 0.0)

    def test_emotional_storyboard_authority_narrative(self):
        chunks = [
            {"text": "In business leadership, discipline is the absolute standard you must command.", "startMs": 0, "endMs": 4000, "wordCount": 11},
            {"text": "Face the brutal truth, respect the rules, and dominate the market revenue.", "startMs": 4200, "endMs": 9000, "wordCount": 12},
        ]
        storyboard = song_program.analyze_video_emotional_storyboard(chunks, duration_ms=25000)
        self.assertEqual(storyboard["dominant_archetype"], "authority")
        self.assertGreater(storyboard["archetype_scores"]["authority"], 0.0)

    def test_emotional_storyboard_storytelling_narrative(self):
        chunks = [
            {"text": "Years ago when I started this journey, I remember walking through the darkest struggles.", "startMs": 0, "endMs": 4000, "wordCount": 14},
            {"text": "Looking back at that memory, that moment turned my path into a life lesson.", "startMs": 4200, "endMs": 9000, "wordCount": 14},
        ]
        storyboard = song_program.analyze_video_emotional_storyboard(chunks, duration_ms=25000)
        self.assertEqual(storyboard["dominant_archetype"], "storytelling")
        self.assertEqual(storyboard["trajectory"], "steady_storytelling_flow")

    def test_emotional_storyboard_educational_narrative(self):
        chunks = [
            {"text": "Here is the exact step by step framework to scale your workflow.", "startMs": 0, "endMs": 4000, "wordCount": 12},
            {"text": "Three critical mistakes to avoid and secret techniques you must learn.", "startMs": 4200, "endMs": 9000, "wordCount": 11},
        ]
        storyboard = song_program.analyze_video_emotional_storyboard(chunks, duration_ms=25000)
        self.assertEqual(storyboard["dominant_archetype"], "educational")
        self.assertEqual(storyboard["entry_preference"], "hook_drop")

    def test_emotional_storyboard_emotional_narrative(self):
        chunks = [
            {"text": "I was broken and crying in the dark, feeling the painful sorrow and empty regret.", "startMs": 0, "endMs": 4000, "wordCount": 15},
            {"text": "The bittersweet tears and deep longing that tore through my vulnerable soul.", "startMs": 4200, "endMs": 9000, "wordCount": 12},
        ]
        storyboard = song_program.analyze_video_emotional_storyboard(chunks, duration_ms=25000)
        self.assertEqual(storyboard["dominant_archetype"], "emotional")
        self.assertGreater(storyboard["archetype_scores"]["emotional"], 0.0)

    def test_emotional_storyboard_emotional_shift_detection(self):
        chunks = [
            {"text": "I was broken and crying in the dark with deep pain.", "startMs": 0, "endMs": 3000, "wordCount": 11},
            {"text": "We transformed the struggle into power.", "startMs": 8000, "endMs": 14000, "wordCount": 6},
            {"text": "Now we won first place! Celebrating this amazing victory!", "startMs": 20000, "endMs": 25000, "wordCount": 9},
        ]
        storyboard = song_program.analyze_video_emotional_storyboard(chunks, duration_ms=28000)
        self.assertTrue(storyboard["emotional_shift"])
        self.assertEqual(storyboard["trajectory"], "emotional_to_positive")

    def test_intelligent_song_entry_hook_drop_calculation(self):
        # EARFQUAKE has a 22.5s slow intro before the beat drops
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=[{"text": "Here is the step by step framework to learn this secret", "startMs": 0, "endMs": 3000, "wordCount": 11}],
            duration_ms=30000,
            design={"songTrackId": "educational/earfquake"},
        )
        event = program["events"][0]
        self.assertEqual(event["sourceStartMs"], 22500)
        self.assertEqual(event["sourceEndMs"], 52500)
        self.assertEqual(event["intelligentEntry"]["strategy"], "hook_drop")
        self.assertEqual(event["intelligentEntry"]["dropOnsetSec"], 22.5)

    def test_intelligent_song_entry_climax_sync_calculation(self):
        storyboard = {
            "entry_preference": "climax_sync",
            "climax_ms": 15000,  # Narrative climax hits at 15.0s
        }
        track = {
            "id": "test-track",
            "durationSec": 120.0,
            "dropOnsetSec": 22.5,
        }
        entry = song_program.compute_intelligent_song_entry(
            track=track,
            storyboard=storyboard,
            duration_ms=30000,
            timeline_start_ms=0,
            timeline_end_ms=30000,
        )
        self.assertEqual(entry["strategy"], "climax_sync")
        # Desired start = 22.5s - 15.0s = 7.5s (7500ms)
        self.assertEqual(entry["sourceStartMs"], 7500)
        self.assertEqual(entry["sourceEndMs"], 37500)

    def test_intelligent_song_entry_runway_safety_clamping(self):
        storyboard = {"entry_preference": "hook_drop"}
        track = {
            "id": "short-track",
            "durationSec": 25.0,  # 25,000ms total runway
            "dropOnsetSec": 15.0, # 15,000ms drop
        }
        # Video is 20,000ms. If sourceStartMs was 15,000ms, 15000 + 20000 = 35000 > 25000!
        entry = song_program.compute_intelligent_song_entry(
            track=track,
            storyboard=storyboard,
            duration_ms=20000,
            timeline_start_ms=0,
            timeline_end_ms=20000,
        )
        # Clamped to 25000 - 20000 = 5000ms
        self.assertEqual(entry["sourceStartMs"], 5000)
        self.assertEqual(entry["sourceEndMs"], 25000)
        self.assertIn("Clamped", entry["reason"])

    def test_autonomous_selection_selects_creator_curated_track(self):
        educational_chunks = [
            {"text": "Here is the exact step by step tutorial to master this skill.", "startMs": 0, "endMs": 3000, "wordCount": 12},
            {"text": "Learn the principles and avoid common mistakes with this guide.", "startMs": 3200, "endMs": 6500, "wordCount": 10},
        ]
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=educational_chunks,
            duration_ms=20000,
        )
        event = program["events"][0]
        self.assertEqual(event["archetype"], "educational")
        self.assertIn(event["trackId"], {"educational/earfquake", "educational/daisies", "educational/atm"})
        self.assertGreater(event["sourceStartMs"], 0)

    def test_individual_selection_by_archetype(self):
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=[{"text": "Generic speech", "startMs": 0, "endMs": 3000, "wordCount": 2}],
            duration_ms=15000,
            design={"songArchetype": "emotional"},
        )
        event = program["events"][0]
        self.assertEqual(event["resolution"], "individual_selection")
        self.assertEqual(event["archetype"], "emotional")

    def test_individual_selection_by_creator_artist(self):
        program = song_program.plan_song_program(
            catalog=self.catalog,
            chunks=[{"text": "Generic speech", "startMs": 0, "endMs": 3000, "wordCount": 2}],
            duration_ms=15000,
            design={"songArtist": "Tyler, The Creator"},
        )
        event = program["events"][0]
        self.assertEqual(event["trackId"], "educational/earfquake")
        self.assertIn("Tyler, The Creator", event["artist"])

    def test_list_selectable_songs_filtered_by_archetype(self):
        authority_songs = song_program.list_selectable_songs(self.catalog, archetype="authority")
        self.assertGreater(len(authority_songs), 0)
        for s in authority_songs:
            self.assertEqual(s["archetype"], "authority")


if __name__ == "__main__":
    unittest.main()

