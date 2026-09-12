import unittest
from pathlib import Path


class TestRound14VerticalGradient(unittest.TestCase):
    """Test suite for Round 14 Commit 3: Behind-Subject Bottom Linear Gradient Fade."""

    def test_vertical_gradient_bottom_fade_present_in_tsx(self):
        """Assert PrometheusMinRun.tsx defines and applies linear-gradient bottom fade mask to behindSubject layers."""
        tsx_path = Path(__file__).resolve().parent.parent / "remotion-app" / "src" / "compositions" / "PrometheusMinRun.tsx"
        self.assertTrue(tsx_path.exists(), f"PrometheusMinRun.tsx not found at {tsx_path}")

        content = tsx_path.read_text(encoding="utf-8")

        # 1. Assert mask constant exists
        expected_mask = "linear-gradient(to bottom, rgba(0,0,0,1) 65%, rgba(0,0,0,0) 100%)"
        self.assertIn(
            expected_mask,
            content,
            "BEHIND_SUBJECT_BOTTOM_FADE_MASK definition missing from PrometheusMinRun.tsx",
        )

        # 2. Assert maskImage and WebkitMaskImage applied conditionally on isBehindSubject
        self.assertIn("maskImage: isBehindSubject", content)
        self.assertIn("WebkitMaskImage: isBehindSubject", content)

        # 3. Assert resolveBehindSubjectMask export exists
        self.assertIn("export const resolveBehindSubjectMask", content)


if __name__ == "__main__":
    unittest.main()
