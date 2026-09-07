"""Pre-flight verification of the 4 Backend Asset Pillars.

Audits:
  Pillar 1: Font JSON Exemplars (Yuan Prometheus Screenshots/font JSON/*.json)
  Pillar 2: Font Binaries (remotion-app/public/fonts/**/*.otf, *.ttf)
  Pillar 3: CSS Font-Face Declarations (remotion-app/public/all_fonts_dynamic.css) & Python Registry
  Pillar 4: Sound FX Files (SOUND FX/**/*.mp3, *.wav)

Usage:
  python scripts/verify_backend_assets.py
"""
import os
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

def main():
    print("=" * 60)
    print("AUDITING PROMETHEUS BACKEND ASSET INGESTION PILLARS")
    print("=" * 60)
    errors = []

    # Pillar 1: Font JSON Exemplars
    exemplar_dir = REPO_ROOT / "Yuan Prometheus Screenshots" / "font JSON"
    if not exemplar_dir.exists():
        errors.append(f"[Pillar 1] Font JSON directory missing: {exemplar_dir}")
    else:
        json_files = list(exemplar_dir.glob("*.json"))
        print(f"[OK] Pillar 1: Found {len(json_files)} font JSON exemplars in {exemplar_dir.name}")
        if len(json_files) == 0:
            errors.append(f"[Pillar 1] No .json exemplars found in {exemplar_dir}")

    # Pillar 2: Font Binaries
    fonts_dir = REPO_ROOT / "remotion-app" / "public" / "fonts"
    if not fonts_dir.exists():
        errors.append(f"[Pillar 2] Font binaries directory missing: {fonts_dir}")
        font_files = []
    else:
        font_files = list(fonts_dir.rglob("*.[to]tf")) + list(fonts_dir.rglob("*.woff*"))
        print(f"[OK] Pillar 2: Found {len(font_files)} physical font binaries in remotion-app/public/fonts")
        if len(font_files) == 0:
            errors.append(f"[Pillar 2] No font binaries (.ttf, .otf, .woff) in {fonts_dir}")

    # Pillar 3: CSS Font Registry & Python Registry Cross-Check
    css_file = REPO_ROOT / "remotion-app" / "public" / "all_fonts_dynamic.css"
    if not css_file.exists():
        errors.append(f"[Pillar 3] CSS font declaration file missing: {css_file}")
        css_text = ""
    else:
        css_text = css_file.read_text(encoding="utf-8")
        font_face_count = len(re.findall(r"@font-face", css_text))
        print(f"[OK] Pillar 3: Found {font_face_count} @font-face rules in all_fonts_dynamic.css")

    # Cross-reference with mini_run_pipeline/typography.py
    try:
        from mini_run_pipeline.typography import FONT_FAMILY_REGISTRY
        unique_families = sorted(set(FONT_FAMILY_REGISTRY.values()))
        print(f"[OK] Python Registry: Found {len(FONT_FAMILY_REGISTRY)} mapped rules across {len(unique_families)} unique font families in typography.py")
        
        # Google fonts or system webfonts that are loaded via Google Fonts CDN or local fallbacks:
        GOOGLE_OR_WEBFONTS = {
            "Anton", "Bebas Neue", "DM Sans", "Montserrat", "Oswald", "Playfair Display",
            "Cormorant Garamond", "Bodoni Moda", "Great Vibes", "Alex Brush", "Dancing Script",
            "Sacramento", "Pinyon Script", "Space Mono", "Syne", "Cinzel", "Cinzel Decorative",
            "Fraunces", "Lora", "Prata", "Italiana", "Unna", "Marcellus", "Castoro", "Almendra",
            "Allura", "Barlow Condensed", "Black Han Sans", "Inter", "Kalam", "Lato", "Open Sans",
            "Outfit", "Plus Jakarta Sans", "Raleway", "Rozha One", "Source Sans", "Source Serif",
            "Six Caps", "Apple Garamond"
        }

        missing_declarations = []
        for fam in unique_families:
            # Check if declared in CSS or handled via font CDN
            pattern = rf'font-family:\s*["\']?{re.escape(fam)}["\']?'
            in_css = bool(re.search(pattern, css_text, re.IGNORECASE))
            if not in_css and fam not in GOOGLE_OR_WEBFONTS:
                missing_declarations.append(fam)

        if missing_declarations:
            errors.append(f"[Pillar 3] Font families registered in Python but missing in all_fonts_dynamic.css or webfont registry: {missing_declarations}")

    except Exception as e:
        errors.append(f"[Pillar 3] Failed to verify FONT_FAMILY_REGISTRY: {e}")

    # Pillar 4: Sound FX Files
    sfx_dir = REPO_ROOT / "SOUND FX"
    if not sfx_dir.exists():
        errors.append(f"[Pillar 4] Sound FX directory missing: {sfx_dir}")
    else:
        sfx_files = list(sfx_dir.rglob("*.mp3")) + list(sfx_dir.rglob("*.wav"))
        print(f"[OK] Pillar 4: Found {len(sfx_files)} Sound FX audio files in SOUND FX/")
        if len(sfx_files) == 0:
            errors.append(f"[Pillar 4] No audio files (.mp3, .wav) found in {sfx_dir}")

    print("=" * 60)
    if errors:
        print("[FAIL] PRE-FLIGHT ASSET AUDIT FAILED:")
        for err in errors:
            print(f"   * {err}")
        print("=" * 60)
        sys.exit(1)
    else:
        print("[SUCCESS] ALL 4 ASSET PILLARS FULLY LINKED AND OPERATIONAL!")
        print("=" * 60)
        sys.exit(0)

if __name__ == "__main__":
    main()
