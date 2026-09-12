import re
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np

ROOT = Path(__file__).resolve().parent.parent


class TestAuditRound15Commit4(unittest.TestCase):
    def test_vjkt_remotion_registration_and_contrast_floor(self):
        """Verify vj_kinetic_typography / vjkt registration and strobe contrast floor in Remotion."""
        tsx_path = ROOT / "remotion-app" / "src" / "compositions" / "PrometheusMinRun.tsx"
        self.assertTrue(tsx_path.exists(), "PrometheusMinRun.tsx must exist")
        content = tsx_path.read_text(encoding="utf-8")

        # 1. EXTENDED_ANIMA_TREATMENTS registration
        self.assertIn('"vj_kinetic_typography"', content)
        self.assertIn('"vjkt"', content)

        # 2. Dedicated renderer branch
        branch_pattern = re.compile(
            r'if\s*\(\s*fx\s*===\s*["\']vj_kinetic_typography["\']\s*\|\|\s*fx\s*===\s*["\']vjkt["\']\s*\)'
        )
        self.assertTrue(
            branch_pattern.search(content),
            "Dedicated branch for vj_kinetic_typography / vjkt must exist in PrometheusMinRun.tsx",
        )

        # 3. Off-state opacity floor >= 0.35 (specifically 0.45)
        self.assertIn("[0.45, 1.0]", content, "Strobe opacity must be floored at >= 0.45")

        # 4. Luminous text stroke
        self.assertTrue(
            "WebkitTextStroke" in content and "1.5px" in content,
            "Must define WebkitTextStroke with 1.5px stroke width for luminous contrast",
        )

    def test_visibility_sampler_timing_mid_chunk(self):
        """Verify validate_text_visibility_contrast samples during mid-chunk hold."""
        policy_path = ROOT / "mini_run_pipeline" / "policy_check.py"
        content = policy_path.read_text(encoding="utf-8")

        # Verify code logic: mount_ts = (start_ms + end_ms) / 2000.0
        self.assertIn(
            "mount_ts = (start_ms + end_ms) / 2000.0",
            content,
            "validate_text_visibility_contrast must calculate mount_ts as mid-chunk hold",
        )
        # Ensure premature start_ms + 333 is not used for mount_ts
        self.assertNotIn(
            "mount_ts = (start_ms + 333) / 1000.0",
            content,
            "Premature start_ms + 333ms mount_ts should be removed",
        )

    def test_contrast_sampler_execution_at_midpoint(self):
        """Verify sampler logic inspects frames near (start_ms + end_ms) / 2000.0."""
        from mini_run_pipeline.policy_check import validate_text_visibility_contrast

        manifest = {
            "typography": {
                "chunks": [
                    {
                        "chunk_index": 0,
                        "start_ms": 1000,
                        "end_ms": 3000,
                        "spatial_zone": "center_hero",
                        "layers": [{"text": "TEST HERO", "estimatedWidthPx": 400}],
                    }
                ]
            }
        }

        # Frame timestamps: pre at 0.85s (1000 - 150), mount at 2.00s ((1000 + 3000) / 2000)
        # We supply dummy frame objects
        frames = [
            {"timestampSec": 0.85, "framePath": "dummy_pre.png"},
            {"timestampSec": 2.00, "framePath": "dummy_mount.png"},
        ]

        # Mock image loading: pre is black, mount has bright text
        pre_img = np.zeros((1920, 1080, 3), dtype=np.uint8)
        mount_img = np.zeros((1920, 1080, 3), dtype=np.uint8)
        mount_img[860:1060, 440:640] = 255  # bright patch in center

        with patch("pathlib.Path.exists", return_value=True), \
             patch("PIL.Image.open") as mock_open:
            mock_pre = unittest.mock.MagicMock()
            mock_pre.convert.return_value = pre_img
            mock_mount = unittest.mock.MagicMock()
            mock_mount.convert.return_value = mount_img
            mock_open.side_effect = [mock_pre, mock_mount]

            result = validate_text_visibility_contrast(
                chunks=manifest["typography"]["chunks"],
                frames=frames,
                frame_width=1080,
                frame_height=1920,
            )

            self.assertEqual(result["status"], "passed", f"Policy check should pass: {result}")
            self.assertEqual(len(result["violations"]), 0)


if __name__ == "__main__":
    unittest.main()
