import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class TestAuditRound15Commit5(unittest.TestCase):
    def test_remotion_entrance_breathing_floors(self):
        """Verify entrance breathing floors in PrometheusMinRun.tsx."""
        tsx_path = ROOT / "remotion-app" / "src" / "compositions" / "PrometheusMinRun.tsx"
        self.assertTrue(tsx_path.exists(), "PrometheusMinRun.tsx must exist")
        content = tsx_path.read_text(encoding="utf-8")

        # 1. resolveEntranceDurationFrames floors at 20 frames
        self.assertIn(
            "const baseFrames = Math.max(20, Math.min(30, Math.round((intrinsicMs / 1000) * fps * 0.9)));",
            content,
            "baseFrames in resolveEntranceDurationFrames must be floored at >= 20 frames",
        )

        # 2. wordEntranceDuration is floored at >= 20 frames
        self.assertIn(
            "const wordEntranceDuration = Math.max(20, Math.min(30, entranceDuration));",
            content,
            "wordEntranceDuration must be floored at >= 20 frames",
        )

        # 3. subpixel_glow_mask uses wordEntranceDuration with Easing.bezier(0.16, 1.0, 0.3, 1.0)
        self.assertIn(
            "interpolate(localFrame, [0, wordEntranceDuration], [0, 1]",
            content,
            "subpixel_glow_mask must interpolate over wordEntranceDuration",
        )

        # 4. Blur sweep durationFrames floor >= 20 frames
        self.assertIn(
            "Math.max(\n      20,\n      Math.min(\n        Math.round((isRoyal ? 0.85 : 0.75) * fps)",
            content,
            "blur sweep durationFrames must be floored at >= 20 frames",
        )

    def test_pipeline_intrinsic_hold_floor(self):
        """Verify schedule_caption_timing floors intrinsic_ms at >= 850ms."""
        typo_path = ROOT / "mini_run_pipeline" / "typography.py"
        content = typo_path.read_text(encoding="utf-8")

        self.assertIn(
            "intrinsic_ms = max(850, INTRINSIC_ANIMATION_DURATIONS_MS.get(fx, 850))",
            content,
            "schedule_caption_timing must floor intrinsic_ms at >= 850ms",
        )

    def test_long_hero_routing_to_character_cascade(self):
        """Verify hero lines with >12 characters route to dynamic_staggered_character_cascade."""
        from mini_run_pipeline.typography import generate_font_manifest

        # Chunk with a long hero phrase (>12 chars): "THE LAST 12 MONTHS,"
        manifest = generate_font_manifest(
            chunks=[
                {
                    "chunkIndex": 1,
                    "text": "Over THE LAST 12 MONTHS,",
                    "startMs": 0,
                    "endMs": 2000,
                    "words": [
                        {"text": "Over", "start_ms": 0, "end_ms": 400},
                        {"text": "THE", "start_ms": 400, "end_ms": 800},
                        {"text": "LAST", "start_ms": 800, "end_ms": 1200},
                        {"text": "12", "start_ms": 1200, "end_ms": 1600},
                        {"text": "MONTHS,", "start_ms": 1600, "end_ms": 2000},
                    ],
                }
            ],
            design_override={"seed": 42},
        )

        chunks = manifest.get("chunks", [])
        self.assertEqual(len(chunks), 1)
        chunk = chunks[0]
        hero_layer = next((l for l in chunk.get("layers", []) if l.get("isHero")), None)
        self.assertIsNotNone(hero_layer, "Hero layer must exist")

        # If hero layer text length > 12 chars, it must route to dynamic_staggered_character_cascade
        clean_hero_text = "".join(ch for ch in hero_layer.get("text", "") if ch.isalnum() or ch.isspace()).strip()
        if len(clean_hero_text) > 12:
            self.assertEqual(
                hero_layer.get("fxPreset"),
                "dynamic_staggered_character_cascade",
                f"Long hero line '{clean_hero_text}' must route to dynamic_staggered_character_cascade",
            )
            self.assertEqual(
                chunk.get("fxPreset"),
                "dynamic_staggered_character_cascade",
                "Chunk fxPreset must reflect hero preset",
            )


if __name__ == "__main__":
    unittest.main()
