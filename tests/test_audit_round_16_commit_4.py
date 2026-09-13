import unittest
import numpy as np
from pathlib import Path
from mini_run_pipeline.policy_check import (
    measure_pixel_row_projection_lines,
    validate_line_count_and_wrap,
)


class TestAuditRound16Commit4(unittest.TestCase):
    """Verifies Round 16 Commit 4: Pixel-truth lineCount via row projection
    restricted to placement bounding boxes.
    Distinguishes 2-layer / 3-row visual wraps from manifest line counts,
    and isolates text regions from speaker face and microphone.
    """

    def test_row_projection_detects_visual_rows_within_placement_bbox(self):
        """Verify row projection correctly detects 2 distinct text row bands."""
        frame = np.zeros((1920, 1080, 3), dtype=np.uint8)
        # Line 1: y in [1480, 1530] (span 51px)
        frame[1480:1531, 300:780] = 255
        # Line 2: y in [1560, 1605] (span 46px)
        frame[1560:1606, 320:750] = 255

        placement = {
            "xPercent": "50%",
            "yPercent": "80%",
            "maxWidthPercent": "85%",
            "dominantZone": "foreground_lower_deck",
        }
        layers = [
            {"fontSizePx": 60, "rawText": "Line 1"},
            {"fontSizePx": 55, "rawText": "Line 2"},
        ]

        meas = measure_pixel_row_projection_lines(frame, placement=placement, layers=layers)
        self.assertTrue(meas["detected"])
        self.assertEqual(meas["rowCount"], 2)
        self.assertEqual(len(meas["bands"]), 2)

        band1 = meas["bands"][0]
        band2 = meas["bands"][1]
        self.assertTrue(1475 <= band1["y0"] <= 1485)
        self.assertTrue(1525 <= band1["y1"] <= 1535)
        self.assertTrue(1555 <= band2["y0"] <= 1565)
        self.assertTrue(1600 <= band2["y1"] <= 1610)

    def test_distinguish_2_layer_3_row_wrap_from_manifest_layers(self):
        """Demonstrates policy_check detecting wrap-induced 3-row display from a 2-layer manifest."""
        chunk = {
            "chunkIndex": 14,
            "startMs": 14951,
            "endMs": 16874,
            "placement": {
                "xPercent": "50%",
                "yPercent": "80%",
                "maxWidthPercent": "85%",
                "dominantZone": "foreground_lower_deck",
            },
            "layers": [
                {"role": "hero", "isHero": True, "rawText": "SUNDAY BEST", "fontSizePx": 70},
                {"role": "companion", "isHero": False, "rawText": "sometimes in my favorite", "fontSizePx": 55},
            ],
        }
        layers = chunk["layers"]

        # Scenario A: Clean 2 rows (no wrap)
        frame_clean = np.zeros((1920, 1080, 3), dtype=np.uint8)
        frame_clean[1480:1530, 300:780] = 255  # Row 1: SUNDAY BEST
        frame_clean[1560:1600, 320:750] = 255  # Row 2: sometimes in my favorite

        frames_clean = [{"timestampSec": 15.5, "framePath": frame_clean}]
        res_clean = validate_line_count_and_wrap(layers, chunks=[chunk], frames=frames_clean)
        self.assertEqual(res_clean["status"], "passed")
        self.assertEqual(res_clean["pixelTruth"]["wrapInducedRowsDetected"], 0)
        self.assertEqual(res_clean["pixelTruth"]["measurements"][0]["pixelTruthRows"], 2)
        self.assertFalse(res_clean["pixelTruth"]["measurements"][0]["wrapInduced"])

        # Scenario B: Wrap-induced 3rd row (companion wraps due to container width)
        frame_wrapped = np.zeros((1920, 1080, 3), dtype=np.uint8)
        frame_wrapped[1460:1510, 300:780] = 255  # Row 1: SUNDAY BEST
        frame_wrapped[1535:1575, 320:750] = 255  # Row 2: sometimes in my (wrap row 1)
        frame_wrapped[1600:1640, 360:680] = 255  # Row 3: favorite (wrap row 2)

        frames_wrapped = [{"timestampSec": 15.5, "framePath": frame_wrapped}]
        res_wrapped = validate_line_count_and_wrap(layers, chunks=[chunk], frames=frames_wrapped)
        self.assertEqual(res_wrapped["status"], "failed")
        self.assertEqual(res_wrapped["pixelTruth"]["wrapInducedRowsDetected"], 1)
        meas = res_wrapped["pixelTruth"]["measurements"][0]
        self.assertEqual(meas["manifestLines"], 2)
        self.assertEqual(meas["pixelTruthRows"], 3)
        self.assertTrue(meas["wrapInduced"])
        self.assertTrue(any("wrap-induced row detected" in v for v in res_wrapped["violations"]))

    def test_placement_bbox_restriction_isolates_from_face_and_mic(self):
        """Proves that restricting to placement bbox ignores face/mic high-luminance artifacts.
        This directly prevents the probe failure identified in the Round 15 critique.
        """
        frame = np.zeros((1920, 1080, 3), dtype=np.uint8)

        # Speaker face artifact (y=650-900)
        frame[650:900, 400:680] = 240
        # Microphone artifact (y=1050-1200)
        frame[1050:1200, 480:600] = 220

        # Legitimate text in lower deck (y=1500-1550)
        frame[1500:1550, 250:830] = 255

        placement = {
            "xPercent": "50%",
            "yPercent": "80%",
            "maxWidthPercent": "85%",
            "dominantZone": "foreground_lower_deck",
        }
        layers = [{"fontSizePx": 64, "rawText": "Single line in lower deck"}]

        meas = measure_pixel_row_projection_lines(frame, placement=placement, layers=layers)
        self.assertTrue(meas["detected"])
        # Should detect exactly 1 text line, ignoring the face and mic outside the placement bbox
        self.assertEqual(meas["rowCount"], 1)
        band = meas["bands"][0]
        self.assertTrue(1495 <= band["y0"] <= 1505)
        self.assertTrue(1545 <= band["y1"] <= 1555)

        # Check crop bbox coordinates exclude face (y < 900) and mic (y < 1200)
        crop_bbox = meas["bbox"]
        self.assertGreaterEqual(crop_bbox["y0"], 1300)
        self.assertLessEqual(crop_bbox["y1"], 1850)


if __name__ == "__main__":
    unittest.main()
