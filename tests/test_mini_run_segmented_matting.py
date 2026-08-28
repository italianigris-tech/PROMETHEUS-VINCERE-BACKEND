"""Unit tests for segmented matting, window stitching, brand palette ingestion, and behind-subject variety."""

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from mini_run_pipeline.render import (
    extract_matte_windows_from_chunks,
    stitch_matte_windows,
)
from mini_run_pipeline.typography import (
    BRAND_PALETTES,
    DEFAULT_VARIATION_PALETTES,
    generate_font_manifest,
    resolve_brand_palette,
    zone_schema_colors,
)


class TestSegmentedMatting(unittest.TestCase):
    def test_extract_matte_windows_empty_when_no_behind_subject(self):
        chunks = [
            {"outputStartMs": 0, "outputEndMs": 1000, "text": "hello", "subjectLayering": {"behindSubject": False}},
            {"outputStartMs": 1000, "outputEndMs": 2000, "text": "world", "layers": [{"behindSubject": False}]},
        ]
        windows = extract_matte_windows_from_chunks(chunks, effective_duration_ms=5000, buffer_ms=750)
        self.assertEqual(windows, [])

    def test_extract_matte_windows_single_chunk_with_padding(self):
        chunks = [
            {"outputStartMs": 0, "outputEndMs": 2000, "text": "normal chunk"},
            {
                "outputStartMs": 2500,
                "outputEndMs": 4000,
                "text": "behind text",
                "subjectLayering": {"behindSubject": True},
            },
            {"outputStartMs": 5000, "outputEndMs": 7000, "text": "normal end"},
        ]
        windows = extract_matte_windows_from_chunks(chunks, effective_duration_ms=10000, buffer_ms=750)
        self.assertEqual(len(windows), 1)
        win = windows[0]
        # 2500 - 750 = 1750, 4000 + 750 = 4750
        self.assertEqual(win["sourceStartMs"], 1750)
        self.assertEqual(win["sourceEndMs"], 4750)
        self.assertEqual(win["outputStartMs"], 1750)
        self.assertEqual(win["outputEndMs"], 4750)

    def test_extract_matte_windows_merges_overlapping_intervals(self):
        chunks = [
            {
                "outputStartMs": 1000,
                "outputEndMs": 2500,
                "text": "chunk 1",
                "subjectLayering": {"behindSubject": True},
            },
            {
                "outputStartMs": 3000,
                "outputEndMs": 4500,
                "text": "chunk 2",
                "subjectLayering": {"behindSubject": True},
            },
            {
                "outputStartMs": 8000,
                "outputEndMs": 9500,
                "text": "chunk 3",
                "subjectLayering": {"behindSubject": True},
            },
        ]
        # Chunk 1: 1000-750 = 250, 2500+750 = 3250
        # Chunk 2: 3000-750 = 2250, 4500+750 = 5250
        # Chunk 1 & 2 overlap (2250 < 3250) -> merged into [250, 5250]
        # Chunk 3: 8000-750 = 7250, 9500+750 = 10000 (clamped to 10000)
        windows = extract_matte_windows_from_chunks(chunks, effective_duration_ms=10000, buffer_ms=750)
        self.assertEqual(len(windows), 2)
        self.assertEqual(windows[0]["sourceStartMs"], 250)
        self.assertEqual(windows[0]["sourceEndMs"], 5250)
        self.assertEqual(windows[1]["sourceStartMs"], 7250)
        self.assertEqual(windows[1]["sourceEndMs"], 10000)

    def test_extract_matte_windows_clamps_to_boundaries(self):
        chunks = [
            {
                "outputStartMs": 200,
                "outputEndMs": 1000,
                "text": "start chunk",
                "subjectLayering": {"behindSubject": True},
            },
        ]
        windows = extract_matte_windows_from_chunks(chunks, effective_duration_ms=5000, buffer_ms=800)
        self.assertEqual(len(windows), 1)
        self.assertEqual(windows[0]["sourceStartMs"], 0)
        self.assertEqual(windows[0]["sourceEndMs"], 1800)


class TestBrandPaletteIngestion(unittest.TestCase):
    def test_custom_brand_dict_populates_zone_and_colors(self):
        brand_input = {
            "heroColor": "#123456",
            "companionColor": "#ABCDEF",
            "glow": "0 0 20px rgba(18, 52, 86, 0.5)",
            "accentBorder": "#654321",
        }
        palette = resolve_brand_palette(brand_input)
        self.assertEqual(palette["hero_color"], "#123456")
        self.assertEqual(palette["companion_color"], "#ABCDEF")
        self.assertEqual(palette["glow"], "0 0 20px rgba(18, 52, 86, 0.5)")
        self.assertEqual(palette["accent_border"], "#654321")

        zone = zone_schema_colors(palette)
        self.assertEqual(zone["primary"], "#123456")
        self.assertEqual(zone["base"], "#ABCDEF")
        self.assertEqual(zone["accent"], "#654321")
        self.assertEqual(zone["keyword"], "#123456")
        self.assertEqual(zone["glow_rgb"], "18, 52, 86")

    def test_explicit_brand_motif_resolution(self):
        for motif in ("electric_cyan", "emerald_luxury", "royal_amethyst", "sunset_amber", "pure_editorial_mono"):
            palette = resolve_brand_palette(motif)
            self.assertEqual(palette["hero_color"], BRAND_PALETTES[motif]["hero_color"])
            self.assertEqual(palette["zone"]["name"], motif)

    def test_dynamic_palette_variety_across_seeds(self):
        chunks = [
            {"startMs": 0, "endMs": 1500, "text": "Look at that"},
            {"startMs": 1500, "endMs": 3000, "text": "amazing result"},
        ]
        palettes_selected = set()
        for seed in ("seed_a", "seed_b", "seed_c", "seed_d", "seed_e", "seed_f", "seed_g", "seed_h", "seed_i"):
            manifest = generate_font_manifest(chunks, {"seed": seed})
            palettes_selected.add(manifest["brandPalette"]["id"])
        # Should not be stuck on one palette; should exhibit multiple varieties across seeds
        self.assertGreater(len(palettes_selected), 1)


class TestBehindSubjectVariety(unittest.TestCase):
    def test_behind_subject_multi_moment_selection(self):
        chunks = [
            {"startMs": 0, "endMs": 1200, "text": "Here is why"},
            {"startMs": 1200, "endMs": 2500, "text": "raw footage"},
            {"startMs": 2500, "endMs": 3800, "text": "is amazing"},
            {"startMs": 3800, "endMs": 5000, "text": "for creators"},
            {"startMs": 5000, "endMs": 6500, "text": "game changer"},
            {"startMs": 6500, "endMs": 7800, "text": "in video editing"},
            {"startMs": 7800, "endMs": 9000, "text": "because everyone"},
            {"startMs": 9000, "endMs": 10500, "text": "realizes the secret"},
            {"startMs": 10500, "endMs": 12000, "text": "key insight"},
            {"startMs": 12000, "endMs": 13500, "text": "transforms workflow"},
            {"startMs": 13500, "endMs": 15000, "text": "to save time"},
            {"startMs": 15000, "endMs": 16500, "text": "final takeaway"},
            {"startMs": 16500, "endMs": 18000, "text": "for everyone"},
        ]
        manifest = generate_font_manifest(
            chunks,
            {"subjectLayering": "required", "seed": "test_variety_123"},
        )
        behind_chunks = [c for c in manifest["chunks"] if c.get("subjectLayering", {}).get("behindSubject")]
        # With 13 chunks and subjectLayering="required", should select 2 distinct spaced moments
        self.assertGreaterEqual(len(behind_chunks), 2)
        # Verify cooldown spacing (at least 3 chunks apart)
        indices = [manifest["chunks"].index(c) for c in behind_chunks]
        for i in range(len(indices) - 1):
            self.assertGreaterEqual(indices[i + 1] - indices[i], 3)


    def test_stitch_matte_windows_with_ffmpeg(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmppath = Path(tmpdir)
            media_dir = tmppath / "media" / "martin" / "job_test"
            media_dir.mkdir(parents=True, exist_ok=True)
            w1_path = media_dir / "win1.webm"
            w2_path = media_dir / "win2.webm"
            out_path = tmppath / "output_stitched.webm"

            # Create 2 short test alpha WebMs with ffmpeg
            import subprocess
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=blue@0.8:s=360x640:r=30:d=1",
                "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "25",
                str(w1_path)
            ], check=True, capture_output=True)

            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=red@0.8:s=360x640:r=30:d=1",
                "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "25",
                str(w2_path)
            ], check=True, capture_output=True)

            receipt = {
                "status": "completed",
                "stitch": [
                    {
                        "windowId": "win1",
                        "foregroundFile": "martin/job_test/win1.webm",
                        "outputStartMs": 1000,
                        "outputEndMs": 2000,
                    },
                    {
                        "windowId": "win2",
                        "foregroundFile": "martin/job_test/win2.webm",
                        "outputStartMs": 3000,
                        "outputEndMs": 4000,
                    },
                ]
            }

            stitched = stitch_matte_windows(
                receipt=receipt,
                effective_duration_ms=5000,
                output_path=out_path,
                artifact_root=str(tmppath),
                width=360,
                height=640,
                fps=30.0,
            )
            self.assertTrue(stitched.exists())
            self.assertGreater(stitched.stat().st_size, 0)

    def test_song_selection_diversity_across_seeds(self):
        from mini_run_pipeline.song_program import plan_song_program
        catalog = {
            "entries": [
                {
                    "id": f"song-{i}",
                    "title": f"Track {i}",
                    "category": "cinematic" if i % 2 == 0 else "chill",
                    "genreTags": ["instrumental", "background"],
                    "moodTags": ["focused"],
                    "useCaseTags": ["underscore"],
                    "durationSec": 120,
                    "renderAllowed": True,
                    "commercialAllowed": True,
                    "licenseVerified": True,
                    "audioObjectKey": f"songs/track_{i}.mp3",
                }
                for i in range(20)
            ]
        }
        chunks = [{"text": "Hello and welcome to this video presentation."}]
        picked_tracks = set()
        for seed_idx in range(10):
            prog = plan_song_program(
                catalog=catalog,
                chunks=chunks,
                duration_ms=30000,
                design={"seed": f"seed_song_{seed_idx}"},
            )
            picked_tracks.add(prog["events"][0]["trackId"])
        # With 10 seeds over a 20-track catalog, we must see multiple distinct tracks selected
        self.assertGreater(len(picked_tracks), 1)

    def test_font_profile_diversity_across_corpus(self):
        chunks = [
            {"startMs": i * 1000, "endMs": (i + 1) * 1000, "text": f"Phrase number {i} with expressive words"}
            for i in range(20)
        ]
        manifest = generate_font_manifest(chunks, {"seed": "rich_variety_test"})
        distinct_profiles = set(c["profileId"] for c in manifest["chunks"])
        # Over 20 chunks, diversity policy should pick at least 8+ distinct font JSON profiles
        self.assertGreaterEqual(len(distinct_profiles), 8)


if __name__ == "__main__":
    unittest.main()
