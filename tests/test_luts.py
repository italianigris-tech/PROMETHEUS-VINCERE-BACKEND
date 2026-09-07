"""Unit and integration tests for canonical 3D LUT files and discovery.

Verifies:
1. File existence for all 10 canonical .cube LUT files.
2. File size and exact line count (4 header lines + 33*33*33 data lines = 35,941 lines).
3. Strict Adobe .cube header validation (TITLE, LUT_3D_SIZE 33, DOMAIN_MIN, DOMAIN_MAX).
4. Strict floating-point formatting with 6 decimal places and range bounds [0.0, 1.0].
5. Successful discovery via mini_run_pipeline.looks.discover_luts() and looks.luts_available().
6. Integration with looks.build_grade_filter() prioritizing lut3d over parametric fallback.
7. FFmpeg lut3d filter parsing and execution without error.
"""

from pathlib import Path
import re
import shutil
import subprocess
import unittest

from mini_run_pipeline import looks

CANONICAL_LUT_FILENAMES = [
    "kodak_2383_print.cube",
    "fuji_3513_print.cube",
    "teal_and_orange_blockbuster.cube",
    "moody_dramatic_cinema.cube",
    "vintage_film_emulation.cube",
    "clean_log_to_rec709.cube",
    "golden_hour_warmth.cube",
    "bleach_bypass.cube",
    "urban_desaturated.cube",
    "sci_netone_balanced.cube",
]

EXPECTED_LINE_COUNT = 4 + (33 * 33 * 33)  # 35,941 lines
FLOAT_LINE_REGEX = re.compile(r"^[0-9]\.[0-9]{6}\s+[0-9]\.[0-9]{6}\s+[0-9]\.[0-9]{6}$")


class CanonicalLutTests(unittest.TestCase):
    """Tests verifying the 10 canonical 33x33x33 3D LUTs."""

    def setUp(self):
        self.lut_dir = looks.LUT_DIR

    def test_lut_directory_exists(self):
        self.assertTrue(
            self.lut_dir.is_dir(),
            f"LUT directory does not exist: {self.lut_dir}",
        )

    def test_all_ten_canonical_lut_files_exist(self):
        for filename in CANONICAL_LUT_FILENAMES:
            cube_path = self.lut_dir / filename
            self.assertTrue(
                cube_path.is_file(),
                f"Missing canonical LUT file: {cube_path}",
            )

    def test_lut_file_sizes_and_line_counts(self):
        for filename in CANONICAL_LUT_FILENAMES:
            cube_path = self.lut_dir / filename
            size = cube_path.stat().st_size
            # Standard 33x33x33 ASCII .cube file is ~950KB - 1.05MB
            self.assertGreater(
                size,
                900_000,
                f"{filename} is suspiciously small ({size} bytes)",
            )
            self.assertLess(
                size,
                1_200_000,
                f"{filename} is suspiciously large ({size} bytes)",
            )

            lines = cube_path.read_text(encoding="utf-8").splitlines()
            self.assertEqual(
                len(lines),
                EXPECTED_LINE_COUNT,
                f"{filename} has {len(lines)} lines; expected {EXPECTED_LINE_COUNT}",
            )

    def test_lut_headers_strictly_valid(self):
        for filename in CANONICAL_LUT_FILENAMES:
            cube_path = self.lut_dir / filename
            with cube_path.open("r", encoding="utf-8") as f:
                header = [f.readline().strip() for _ in range(4)]

            # Line 1: TITLE "..."
            self.assertTrue(
                header[0].startswith('TITLE "') and header[0].endswith('"'),
                f"{filename}: invalid TITLE header: {header[0]}",
            )
            title_content = header[0][7:-1]
            self.assertGreater(len(title_content), 3)

            # Line 2: LUT_3D_SIZE 33
            self.assertEqual(
                header[1],
                "LUT_3D_SIZE 33",
                f"{filename}: invalid LUT_3D_SIZE header: {header[1]}",
            )

            # Line 3: DOMAIN_MIN 0.0 0.0 0.0
            self.assertEqual(
                header[2],
                "DOMAIN_MIN 0.0 0.0 0.0",
                f"{filename}: invalid DOMAIN_MIN header: {header[2]}",
            )

            # Line 4: DOMAIN_MAX 1.0 1.0 1.0
            self.assertEqual(
                header[3],
                "DOMAIN_MAX 1.0 1.0 1.0",
                f"{filename}: invalid DOMAIN_MAX header: {header[3]}",
            )

    def test_lut_data_table_strictly_formatted(self):
        """Verify strict 6-decimal floating point format and [0.0, 1.0] bounds."""
        for filename in CANONICAL_LUT_FILENAMES:
            cube_path = self.lut_dir / filename
            lines = cube_path.read_text(encoding="utf-8").splitlines()
            data_lines = lines[4:]

            self.assertEqual(len(data_lines), 33 * 33 * 33)

            # Check boundary samples across data table
            check_indices = [
                0, 1, 32, 33, 100, 1000, 5000, 15000, 30000,
                len(data_lines) - 2, len(data_lines) - 1
            ]
            for idx in check_indices:
                line = data_lines[idx]
                self.assertTrue(
                    FLOAT_LINE_REGEX.match(line),
                    f"{filename} line {idx + 5} invalid format: {line}",
                )
                r, g, b = map(float, line.split())
                self.assertTrue(0.0 <= r <= 1.0, f"{filename} line {idx + 5}: R out of bounds {r}")
                self.assertTrue(0.0 <= g <= 1.0, f"{filename} line {idx + 5}: G out of bounds {g}")
                self.assertTrue(0.0 <= b <= 1.0, f"{filename} line {idx + 5}: B out of bounds {b}")

            # Check entire file for NaN or Inf
            full_text = cube_path.read_text(encoding="utf-8")
            self.assertNotIn("nan", full_text.lower(), f"{filename} contains NaN")
            self.assertNotIn("inf", full_text.lower(), f"{filename} contains Inf")

    def test_lut_discovery_finds_all_canonical_luts(self):
        discovered = looks.discover_luts()
        self.assertTrue(looks.luts_available())
        discovered_names = {item["name"] for item in discovered}

        for filename in CANONICAL_LUT_FILENAMES:
            stem = Path(filename).stem
            self.assertIn(
                stem,
                discovered_names,
                f"Canonical look '{stem}' not found in discovered LUTs: {discovered_names}",
            )

        for item in discovered:
            self.assertEqual(item["format"], "cube")
            self.assertTrue(Path(item["path"]).is_file())
            self.assertGreater(item["sizeBytes"], 900_000)

    def test_looks_pipeline_resolves_and_uses_lut3d(self):
        """Verify that selecting canonical looks emits lut3d filter in ffmpeg string."""
        for filename in CANONICAL_LUT_FILENAMES:
            look_id = Path(filename).stem
            plan = looks.select_look(design={"lookId": look_id})
            filter_str = looks.build_grade_filter(plan)

            self.assertIn(
                "lut3d=file=",
                filter_str,
                f"Look {look_id} did not prioritize lut3d filter: {filter_str}",
            )
            self.assertIn(
                f"{look_id}.cube",
                filter_str,
                f"Look {look_id} filter string does not reference {look_id}.cube",
            )
            self.assertTrue(
                "interp=tetrahedral" in filter_str or "interp=trilinear" in filter_str,
                f"Look {look_id} missing valid interpolation mode: {filter_str}",
            )

    def test_ffmpeg_lut3d_parses_every_cube_file(self):
        """Verify that FFmpeg's lut3d filter can parse and execute every single LUT."""
        ffmpeg_bin = shutil.which("ffmpeg")
        if not ffmpeg_bin:
            self.skipTest("ffmpeg not available on PATH")

        for filename in CANONICAL_LUT_FILENAMES:
            cube_path = self.lut_dir / filename
            # Use forward slashes and escape colon/comma for FFmpeg filter argument
            norm_path = str(cube_path.resolve()).replace("\\", "/")
            esc_path = norm_path.replace(":", "\\:").replace(",", "\\,").replace("'", "'\\''")

            cmd = [
                ffmpeg_bin,
                "-y",
                "-f", "lavfi",
                "-i", "color=c=0x808080:s=32x32:d=0.1",
                "-vf", f"lut3d=file='{esc_path}':interp=trilinear",
                "-f", "null",
                "-",
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(
                result.returncode,
                0,
                f"FFmpeg failed to parse {filename}:\n{result.stderr[-400:]}",
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
