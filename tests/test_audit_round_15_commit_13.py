import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import numpy as np

ROOT = Path(__file__).resolve().parent.parent


class TestAuditRound15Commit13(unittest.TestCase):
    """Audit test suite for Round 15 Commit 13:
    1. Verify blue_lantern_magnetic in HierarchicalAsymmetricLockupComposition renders
       {displayText} directly with dynamic magneticLetterSpacing, eliminating empty/transparent
       child span clipping under WebkitBackgroundClip: 'text'.
    2. Verify all HAKT hero animation branches define standard backgroundClip and high-contrast
       fallback color to prevent invisible text in headless Chromium.
    3. Verify validate_text_visibility_contrast passes with 0 violations when hero layer mounts.
    """

    def test_blue_lantern_magnetic_direct_text_rendering(self):
        """blue_lantern_magnetic must render {displayText} with magneticLetterSpacing directly."""
        tsx_path = ROOT / "remotion-app" / "src" / "compositions" / "PrometheusMinRun.tsx"
        self.assertTrue(tsx_path.exists(), "PrometheusMinRun.tsx must exist")
        content = tsx_path.read_text(encoding="utf-8")

        # Must compute magneticLetterSpacing from squeezeT
        self.assertIn("const magneticLetterSpacing =", content)
        self.assertIn("letterSpacing: magneticLetterSpacing", content)

        # Must not have charSpans in the blue_lantern_magnetic hero branch
        # (charSpans inside WebkitBackgroundClip: "text" causes transparent rendering)
        self.assertNotIn("key={`blm-char-${idx}-${cIdx}`}", content)

    def test_hakt_hero_branches_have_background_clip_and_fallback_color(self):
        """All HAKT hero animation branches must define standard backgroundClip and fallback color."""
        tsx_path = ROOT / "remotion-app" / "src" / "compositions" / "PrometheusMinRun.tsx"
        content = tsx_path.read_text(encoding="utf-8")

        # Standard backgroundClip alongside WebkitBackgroundClip
        bg_clip_count = content.count('backgroundClip: isDifference ? "border-box" : "text"')
        self.assertGreaterEqual(
            bg_clip_count,
            5,
            f"Expected at least 5 hero branches with standard backgroundClip, found {bg_clip_count}",
        )

        # Fallback color when not in difference mode
        color_fallback_count = content.count('color: isDifference ? "#FFFFFF" : (heroLayer?.color || "#FF453A")')
        self.assertGreaterEqual(
            color_fallback_count,
            5,
            f"Expected at least 5 hero branches with high-contrast color fallback, found {color_fallback_count}",
        )

    def test_text_visibility_contrast_passing_with_mounted_hero(self):
        """validate_text_visibility_contrast passes when lower-deck hero text mounts."""
        from mini_run_pipeline.policy_check import validate_text_visibility_contrast

        chunk_12 = {
            "chunkIndex": 12,
            "text": "from home, sometimes",
            "startMs": 12691,
            "endMs": 14489,
            "collisionMs": 500,
            "placement": {
                "xPercent": "50.0%",
                "yPercent": "80%",
                "dominantZone": "foreground_lower_deck",
            },
            "layers": [
                {"role": "modifier", "text": "from", "estimatedWidthPx": 175},
                {"role": "hero", "text": "Home, Sometimes", "estimatedWidthPx": 1061},
            ],
        }

        # Mock frame comparison: pre has no text in bbox, mount has rendered hero text
        pre_img = np.zeros((1920, 1080, 3), dtype=np.uint8)
        mount_img = np.zeros((1920, 1080, 3), dtype=np.uint8)
        # Hero text at y=1450..1600, x=200..880
        mount_img[1450:1600, 200:880] = 250

        frames = [
            {"timestampSec": 12.541, "framePath": "dummy_pre.png"},
            {"timestampSec": 13.340, "framePath": "dummy_mount.png"},
        ]

        with patch("pathlib.Path.exists", return_value=True), \
             patch("PIL.Image.open") as mock_open:
            mock_pre = MagicMock()
            mock_pre.convert.return_value = pre_img
            mock_mount = MagicMock()
            mock_mount.convert.return_value = mount_img
            mock_open.side_effect = [mock_pre, mock_mount]

            result = validate_text_visibility_contrast(
                chunks=[chunk_12],
                frames=frames,
                frame_width=1080,
                frame_height=1920,
            )

            self.assertEqual(result["status"], "passed")
            self.assertEqual(len(result["violations"]), 0)
            self.assertEqual(result["visibleChunks"], 1)


if __name__ == "__main__":
    unittest.main()
