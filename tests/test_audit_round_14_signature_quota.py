import unittest
from pathlib import Path
from collections import Counter
from mini_run_pipeline.typography import (
    generate_font_manifest,
    SIGNATURE_EFFECTS,
)


class TestRound14SignatureQuota(unittest.TestCase):
    """Test suite for Round 14 Commit 5: Signature Effects Quota and Cursor Bevel Materiality."""

    def test_signature_effects_quota_enforced_in_manifest(self):
        """No signature effect may be used more than 1 time per video across multi-chunk manifests."""
        # 25 chunks dialogue
        chunks_input = [
            {
                "chunkIndex": i,
                "text": f"Phrase segment number {i}",
                "startMs": i * 1200,
                "endMs": i * 1200 + 1100,
                "words": [{"text": "Phrase"}, {"text": "segment"}, {"text": "number"}, {"text": str(i)}],
            }
            for i in range(25)
        ]

        design_override = {
            "creativity": "expressive",
            "motionStyle": "kinetic",
            "treatmentSystem": "special_ops",
        }

        for seed in range(15):
            manifest = generate_font_manifest(
                chunks_input,
                design_override=dict(design_override, seed=seed),
            )
            chunks = manifest.get("chunks", [])
            assigned_fx = [c.get("fxPreset") for c in chunks if c.get("fxPreset")]
            fx_counts = Counter(assigned_fx)

            for sig_fx in SIGNATURE_EFFECTS:
                count = fx_counts.get(sig_fx, 0)
                self.assertLessEqual(
                    count,
                    1,
                    f"Seed {seed}: Signature effect '{sig_fx}' exceeded 1-use quota (found {count} uses)!",
                )

    def test_cursor_selection_reveal_materiality_in_tsx(self):
        """Assert PrometheusMinRun.tsx has dedicated cursor_selection_reveal branch with bevel and vector cursor."""
        tsx_path = Path(__file__).resolve().parent.parent / "remotion-app" / "src" / "compositions" / "PrometheusMinRun.tsx"
        self.assertTrue(tsx_path.exists())
        content = tsx_path.read_text(encoding="utf-8")

        # 1. Assert dedicated branch exists
        self.assertIn('if (fx === "cursor_selection_reveal")', content)

        # 2. Assert bevel depth and shadow consumed
        self.assertIn("layer.bevel?.depthPx", content)
        self.assertIn("bevelShadow", content)

        # 3. Assert vector cursor svg exists
        self.assertIn("<svg", content)
        self.assertIn("strokeLinejoin=\"round\"", content)


if __name__ == "__main__":
    unittest.main()
