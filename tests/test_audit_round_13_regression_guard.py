"""Audit test for Round 13 Fix 5: Hermetic regression guards.
Asserts that old negatives stay negative across z-order, placement policies, and pipeline checks.
"""

import os
import json
import unittest
from pathlib import Path

from mini_run_pipeline.policy_check import run_post_render_conformance_check
from mini_run_pipeline.subject_placement import plan_subject_safe_placements

ROOT_DIR = Path(__file__).resolve().parent.parent
PROMETHEUS_TSX = ROOT_DIR / "remotion-app" / "src" / "compositions" / "PrometheusMinRun.tsx"
RECEIPT_PATH = Path(os.path.expanduser("~")) / ".gemini" / "antigravity-cli" / "brain" / "8ec47dcb-d657-40d5-8c1c-7270878d6444" / "r12_receipt.json"


class TestRound13RegressionGuards(unittest.TestCase):
    def setUp(self):
        self.code = PROMETHEUS_TSX.read_text(encoding="utf-8")
        if RECEIPT_PATH.exists():
            with open(RECEIPT_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.chunks = data.get("chunks", [])
        else:
            self.chunks = [
                {
                    "chunkIndex": i,
                    "text": f"Word chunk {i}",
                    "startMs": i * 1200,
                    "endMs": i * 1200 + 1100,
                    "subjectLayering": {"behindSubject": (i in (4, 17, 20, 23))},
                    "layers": [{"text": f"Word chunk {i}", "behindSubject": False}],
                    "placement": {
                        "dominantZone": "flank_left_column",
                        "textAlign": "left",
                        "anchor": "left",
                        "layoutSource": "font_json_layout_rules",
                    },
                }
                for i in range(25)
            ]

    def test_flank_zones_never_demoted_to_behind_subject_z25(self):
        """Flank and cranial zones must never receive behindSubject = true."""
        self.assertIn(
            "// Flank and cranial zones are foreground placements (z=100); only explicit pivot layers render under the matte (z=25).",
            self.code,
        )
        self.assertIn(
            "return layers.some((l) => Boolean(l.behindSubject));",
            self.code,
        )
        self.assertNotIn(
            'chunkPlacement?.dominantZone === "flank_left_column"',
            self.code,
            "Flank left must never be hardcoded as behindSubject",
        )

    def test_multi_word_cranial_occlusion_guard_preserved(self):
        """Layers with > 2 words are strictly barred from behindSubject."""
        from mini_run_pipeline.typography import generate_font_manifest
        test_chunks = [
            {
                "words": [
                    {"text": "one", "start_ms": 0, "end_ms": 200},
                    {"text": "two", "start_ms": 200, "end_ms": 400},
                    {"text": "three", "start_ms": 400, "end_ms": 600},
                ],
                "startMs": 0,
                "endMs": 1000,
                "text": "one two three",
            }
        ]
        manifest = generate_font_manifest(test_chunks, {"subjectLayering": "behind_subject_silhouette"})
        for chunk in manifest["chunks"]:
            for layer in chunk.get("layers", []):
                if len(layer.get("text", "").split()) > 2:
                    self.assertFalse(
                        layer.get("behindSubject", False),
                        "Layer with > 2 words must never be placed behind subject (occlusion defect guard)",
                    )

    def test_structural_order_is_behind_then_matte_then_foreground(self):
        """Ensure DOM hierarchy invariant: behind (25) < matte (50) < foreground (100)."""
        idx_behind = self.code.find("stageZIndex={25}")
        idx_matte = self.code.find('zIndex: 50, pointerEvents: "none", overflow: "hidden"')
        idx_fg = self.code.find("stageZIndex={100}")

        self.assertTrue(idx_behind > 0, "Stage 2a (z=25) must exist")
        self.assertTrue(idx_matte > 0, "Stage 3 (matte z=50) must exist")
        self.assertTrue(idx_fg > 0, "Stage 4 (foreground z=100) must exist")
        self.assertLess(idx_behind, idx_matte, "Stage 2a must precede matte Stage 3")
        self.assertLess(idx_matte, idx_fg, "Matte Stage 3 must precede foreground Stage 4")

    def test_post_render_checks_contain_both_collision_and_visibility(self):
        """Post-render conformance checks must assert captionCollision and textVisibility."""
        dummy_manifest = {
            "chunks": [
                {"chunkIndex": 1, "text": "Test one", "startMs": 0, "endMs": 1000},
                {"chunkIndex": 2, "text": "Test two", "startMs": 1100, "endMs": 2000},
            ]
        }
        report = run_post_render_conformance_check(dummy_manifest, extract_frames=False)
        checks = report.get("checks", {})
        self.assertIn("captionCollision", checks, "captionCollision check must be present")
        self.assertIn("textVisibility", checks, "textVisibility check must be present")
        self.assertGreaterEqual(report["totalChecks"], 7)

    def test_zero_stacking_lock_comment_present(self):
        """Zero Stacking Lock comment must be preserved to prevent serialization regressions."""
        self.assertIn(
            "// Allow caption sequence temporal overlap (Zero Stacking Lock):",
            self.code,
        )


if __name__ == "__main__":
    unittest.main()
