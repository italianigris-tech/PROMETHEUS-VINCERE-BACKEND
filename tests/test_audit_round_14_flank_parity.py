import unittest
from mini_run_pipeline.typography import (
    generate_font_manifest,
    get_font_char_aspect,
)
from mini_run_pipeline.subject_placement import (
    analyze_cranial_negative_space,
    plan_subject_safe_placements,
    _clamp_safe_x_percent,
)


class TestRound14FlankParity(unittest.TestCase):
    """Test suite for Round 14 Commit 7: Flank Bleed Parity & Single Width Estimator."""

    def test_estimated_width_px_stamped_on_all_layers(self):
        """Manifest must stamp estimatedWidthPx on every layer across all chunks."""
        chunks_input = [
            {
                "chunkIndex": i,
                "text": f"Universal width estimate test phrase {i}",
                "startMs": i * 1500,
                "endMs": i * 1500 + 1400,
                "words": [
                    {"text": "Universal"},
                    {"text": "width"},
                    {"text": "estimate"},
                    {"text": "test"},
                    {"text": str(i)},
                ],
            }
            for i in range(10)
        ]

        for seed in range(5):
            manifest = generate_font_manifest(
                chunks_input,
                design_override={"seed": seed, "creativity": "expressive"},
            )
            for chunk in manifest.get("chunks", []):
                layers = chunk.get("layers") or chunk.get("rendered_layers") or []
                self.assertGreater(len(layers), 0)
                for l in layers:
                    self.assertIn(
                        "estimatedWidthPx",
                        l,
                        f"Chunk {chunk.get('chunkIndex')} layer missing estimatedWidthPx!",
                    )
                    self.assertIsInstance(l["estimatedWidthPx"], int)
                    self.assertGreater(l["estimatedWidthPx"], 0)

                    # Verify formula agreement
                    l_font = l.get("fontFamily", "Inter")
                    l_text = l.get("text") or l.get("rawText", "")
                    l_clean = "".join(ch for ch in l_text if ch.isprintable())
                    l_upper = l.get("casing") == "uppercase" or l_clean.isupper()
                    l_aspect = get_font_char_aspect(l_font, is_uppercase=l_upper)
                    expected_w = int(round(len(l_clean) * float(l.get("fontSizePx", 60)) * l_aspect))
                    self.assertEqual(
                        l["estimatedWidthPx"],
                        expected_w,
                        f"estimatedWidthPx ({l['estimatedWidthPx']}) diverges from authoritative formula ({expected_w})!",
                    )

    def test_flank_columns_clamped_to_safe_130px_margins(self):
        """Flank column xPercent must stay within [12.0%, 88.0%] (130px safe margin in 1080px frame)."""
        # Test helper directly
        self.assertEqual(_clamp_safe_x_percent("6%"), "12.0%")
        self.assertEqual(_clamp_safe_x_percent("94%"), "88.0%")
        self.assertEqual(_clamp_safe_x_percent("35.5%"), "35.5%")

        # Test Priority 2 (Dominant Right Flank)
        # Left-framed speaker with narrow headroom:
        cranial_right = analyze_cranial_negative_space(
            subject_box={"x": 0.15, "y": 0.08, "width": 0.25, "height": 0.70},
            head_top_y=0.08,
            face_bottom_y=0.45,
            face_left_x=0.18,
            face_right_x=0.38,
        )
        self.assertEqual(cranial_right["dominantZone"], "flank_right_column")
        x_pct = float(cranial_right["xPercent"].replace("%", ""))
        self.assertGreaterEqual(x_pct, 12.0)
        self.assertLessEqual(x_pct, 88.0)

        # Test Priority 3 (Dominant Left Flank)
        # Right-framed speaker with narrow headroom:
        cranial_left = analyze_cranial_negative_space(
            subject_box={"x": 0.60, "y": 0.08, "width": 0.25, "height": 0.70},
            head_top_y=0.08,
            face_bottom_y=0.45,
            face_left_x=0.62,
            face_right_x=0.82,
        )
        self.assertEqual(cranial_left["dominantZone"], "flank_left_column")
        x_pct_l = float(cranial_left["xPercent"].replace("%", ""))
        self.assertGreaterEqual(x_pct_l, 12.0)
        self.assertLessEqual(x_pct_l, 88.0)

    def test_plan_subject_safe_placements_clamps_flank_x(self):
        """plan_subject_safe_placements enforces the 12%-88% boundary on flank zones."""
        chunks = [
            {
                "chunkIndex": 0,
                "text": "First chunk test",
                "startMs": 0,
                "endMs": 1000,
                "font_json": {"xPercent": "5%", "anchor": "left"},
            },
            {
                "chunkIndex": 1,
                "text": "Second chunk test",
                "startMs": 1000,
                "endMs": 2000,
                "font_json": {"xPercent": "95%", "anchor": "right"},
            },
        ]
        observation = {
            "headroomRatio": 0.05,
            "actualHeadTop": 0.05,
            "faceBottomY": 0.45,
            "flankLeftRatio": 0.40,
            "flankRightRatio": 0.40,
            "subjectBox": {"x": 0.35, "y": 0.05, "width": 0.30, "height": 0.70},
            "temporalCranialSpace": {
                "headroomRatio": 0.05,
                "actualHeadTop": 0.05,
                "flankLeftRatio": 0.40,
                "flankRightRatio": 0.40,
                "dominantZone": "flank_left_column",
            },
        }
        planned = plan_subject_safe_placements(chunks, observation)
        for p in planned:
            if "flank" in p.get("dominantZone", ""):
                x_val = float(p["xPercent"].replace("%", ""))
                self.assertGreaterEqual(x_val, 12.0)
                self.assertLessEqual(x_val, 88.0)


if __name__ == "__main__":
    unittest.main()
