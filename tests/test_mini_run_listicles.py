import unittest
from mini_run_pipeline.listicles import (
    detect_and_plan_listicles,
    LISTICLE_TREATMENTS,
)
from mini_run_pipeline.typography import generate_font_manifest

class TestListicleIntelligenceEngine(unittest.TestCase):
    def test_teaser_list_and_blur_detection(self):
        """Teaser announcements like 'There are 5 things...' generate a retention card with blurred teaser items."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "THERE ARE 5 THINGS YOU NEED TO KNOW",
                "startMs": 0,
                "endMs": 2000,
                "words": [
                    {"word": "THERE", "startMs": 0, "endMs": 300},
                    {"word": "ARE", "startMs": 310, "endMs": 600},
                    {"word": "5", "startMs": 610, "endMs": 900},
                    {"word": "THINGS", "startMs": 910, "endMs": 1300},
                    {"word": "YOU", "startMs": 1310, "endMs": 1500},
                    {"word": "NEED", "startMs": 1510, "endMs": 1700},
                    {"word": "TO", "startMs": 1710, "endMs": 1850},
                    {"word": "KNOW", "startMs": 1860, "endMs": 2000},
                ],
            }
        ]

        result = detect_and_plan_listicles(chunks)
        self.assertEqual(result["listicleCount"], 1)
        self.assertIn(0, result["plans"])

        teaser_plan = result["plans"][0]
        self.assertTrue(teaser_plan["isListicle"])
        self.assertEqual(teaser_plan["mode"], "teaser_blur")
        self.assertEqual(teaser_plan["totalCount"], 5)
        self.assertEqual(teaser_plan["treatment"], "list_and_blur_teaser")
        self.assertEqual(len(teaser_plan["teaserItems"]), 5)
        
        # Item 1 is active/unblurred, Items 2..5 are teased with blur for retention
        self.assertFalse(teaser_plan["teaserItems"][0]["blurred"])
        self.assertTrue(teaser_plan["teaserItems"][1]["blurred"])
        self.assertTrue(teaser_plan["teaserItems"][4]["blurred"])

    def test_sequential_step_item_detection(self):
        """Sequential step mentions ('Number 1', 'Step 2') generate giant stylized numeral treatments."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "NUMBER 1 MASTER YOUR FOCUS",
                "startMs": 0,
                "endMs": 1500,
                "words": [
                    {"word": "NUMBER", "startMs": 0, "endMs": 300},
                    {"word": "1", "startMs": 310, "endMs": 600},
                    {"word": "MASTER", "startMs": 610, "endMs": 1000},
                    {"word": "YOUR", "startMs": 1010, "endMs": 1200},
                    {"word": "FOCUS", "startMs": 1210, "endMs": 1500},
                ],
            },
            {
                "chunkIndex": 2,
                "text": "STEP 2 BUILD LEVERAGE",
                "startMs": 1600,
                "endMs": 3000,
                "words": [
                    {"word": "STEP", "startMs": 1600, "endMs": 1900},
                    {"word": "2", "startMs": 1910, "endMs": 2200},
                    {"word": "BUILD", "startMs": 2210, "endMs": 2600},
                    {"word": "LEVERAGE", "startMs": 2610, "endMs": 3000},
                ],
            },
        ]

        result = detect_and_plan_listicles(chunks, {"listicleTreatment": "gradient_fade_oblivion"})
        self.assertIn(0, result["plans"])
        self.assertIn(1, result["plans"])

        step1 = result["plans"][0]
        self.assertEqual(step1["mode"], "step_item")
        self.assertEqual(step1["itemNumber"], 1)
        self.assertEqual(step1["itemNumberFormatted"], "01")
        self.assertEqual(step1["treatment"], "gradient_fade_oblivion")

        step2 = result["plans"][1]
        self.assertEqual(step2["mode"], "step_item")
        self.assertEqual(step2["itemNumber"], 2)
        self.assertEqual(step2["itemNumberFormatted"], "02")

    def test_listicle_typography_manifest_integration(self):
        """Typography manifest attaches listicle data and catalog metadata."""
        chunks = [
            {
                "chunkIndex": 1,
                "text": "TOP 3 SECRETS FOR VIRAL VIDEOS",
                "startMs": 0,
                "endMs": 1800,
                "words": [
                    {"word": "TOP", "startMs": 0, "endMs": 300},
                    {"word": "3", "startMs": 310, "endMs": 600},
                    {"word": "SECRETS", "startMs": 610, "endMs": 1000},
                    {"word": "FOR", "startMs": 1010, "endMs": 1200},
                    {"word": "VIRAL", "startMs": 1210, "endMs": 1500},
                    {"word": "VIDEOS", "startMs": 1510, "endMs": 1800},
                ],
            }
        ]

        manifest = generate_font_manifest(chunks)
        self.assertIn("listicleCatalog", manifest)
        self.assertIsNotNone(manifest["chunks"][0].get("listicle"))
        self.assertEqual(manifest["chunks"][0]["listicle"]["totalCount"], 3)

if __name__ == "__main__":
    unittest.main()
