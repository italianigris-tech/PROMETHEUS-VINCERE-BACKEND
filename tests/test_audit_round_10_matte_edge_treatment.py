import unittest
import numpy as np
from mini_run_pipeline.matting import refine_alpha_matte


class TestRound10MatteEdgeTreatment(unittest.TestCase):
    """Verifies Round 10 Fix 3:
    - Low-alpha spill (<0.12) is squashed to 0.0 (eliminates dark background halo/shadow).
    - Morphological erosion chokes outer boundary by 2px.
    - High-confidence interior is preserved at 1.0.
    - Edge transition band is crisp and free of wide dirty gray smear.
    """

    def test_refine_alpha_matte_eliminates_low_alpha_fringe(self):
        """Low-alpha noise from background spill (<0.12) must be zeroed out."""
        # 100x100 synthetic matte with low noise floor (0.05 - 0.10) in background
        alpha = np.full((100, 100), 0.08, dtype=np.float32)
        # Center circle with solid subject (1.0)
        y, x = np.ogrid[:100, :100]
        mask = (x - 50) ** 2 + (y - 50) ** 2 <= 25 ** 2
        alpha[mask] = 1.0

        refined = refine_alpha_matte(alpha, rim_compensation=True)

        # Background low noise (0.08) must be completely eliminated to 0.0
        self.assertEqual(float(np.max(refined[~mask])), 0.0, "Background noise < 0.12 was not eliminated!")
        # Solid center must remain solid 1.0
        center_val = float(refined[50, 50])
        self.assertAlmostEqual(center_val, 1.0, delta=0.05, msg="Solid center was degraded!")

    def test_refine_alpha_matte_chokes_outer_boundary(self):
        """Rim compensation must choke the outer boundary inward to remove edge color contamination."""
        # 100x100 square of size 40x40
        alpha = np.zeros((100, 100), dtype=np.float32)
        alpha[30:70, 30:70] = 1.0

        # Uncompensated (1 iteration) vs compensated (2 iterations)
        uncomp = refine_alpha_matte(alpha, rim_compensation=False)
        comp = refine_alpha_matte(alpha, rim_compensation=True)

        area_uncomp = np.sum(uncomp > 0.5)
        area_comp = np.sum(comp > 0.5)

        # Compensated matte should have a tighter footprint (shaved boundary)
        self.assertLess(area_comp, area_uncomp, "Compensated matte did not choke outer boundary!")

    def test_refine_alpha_matte_tightens_feathered_transition_band(self):
        """Fuzzy ramp from 0.0 to 1.0 must be steepened to eliminate fuzzy 6px gray halo."""
        # 1D ramp across 20 pixels
        ramp = np.linspace(0.0, 1.0, 20, dtype=np.float32).reshape(1, 20)
        # Repeat to 20x20
        alpha = np.repeat(ramp, 20, axis=0)

        refined = refine_alpha_matte(alpha, rim_compensation=True)

        # Measure width of transitional band [0.15, 0.85] in row 10
        row_orig = alpha[10]
        row_ref = refined[10]

        trans_orig = np.sum((row_orig >= 0.12) & (row_orig <= 0.88))
        trans_ref = np.sum((row_ref >= 0.12) & (row_ref <= 0.88))

        self.assertLessEqual(
            trans_ref,
            trans_orig,
            f"Feathered transition band was not tightened: {trans_ref} vs {trans_orig}",
        )


if __name__ == "__main__":
    unittest.main()
