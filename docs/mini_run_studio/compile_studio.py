#!/usr/bin/env python3
"""Compiler for the Master 9:16 Backgrounds & Transitions Studio deliverable."""

import base64
import io
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
STUDIO_DIR = ROOT / "docs" / "mini_run_studio"
TEXTURES_DIR = ROOT / "mini_run_pipeline" / "textures"
ASSETS_DIR = STUDIO_DIR / "assets"
CONCRETE_DIR = ROOT / "prometheus CONCRETE assets"

def get_base64_data_uri(path: Path) -> str:
    if not path.exists():
        print(f"Warning: Asset {path} not found")
        return ""
    suffix = path.suffix.lower().replace(".", "")
    mime = "image/jpeg" if suffix in ("jpg", "jpeg") else "image/png"
    data = base64.b64encode(path.read_bytes()).decode("utf-8")
    return f"data:{mime};base64,{data}"

def get_resized_b64(path: Path, max_size=(540, 960), quality=78) -> str:
    if not path.exists():
        print(f"Warning: Asset {path} not found")
        return ""
    try:
        im = Image.open(path)
        im.thumbnail(max_size, Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        suffix = path.suffix.lower().replace(".", "")
        if suffix == "png":
            # Preserve alpha channel for cutouts
            im.save(buf, format="PNG", optimize=True)
            data = base64.b64encode(buf.getvalue()).decode("utf-8")
            return f"data:image/png;base64,{data}"
        else:
            im.convert("RGB").save(buf, format="JPEG", quality=quality)
            data = base64.b64encode(buf.getvalue()).decode("utf-8")
            return f"data:image/jpeg;base64,{data}"
    except Exception as e:
        print(f"Failed to resize {path}: {e}")
        return get_base64_data_uri(path)

def build():
    print("Encoding tactile textures...")
    paper_b64 = get_resized_b64(TEXTURES_DIR / "Texturelabs_Paper_270XL.jpg", max_size=(500, 888), quality=75)
    fabric_b64 = get_resized_b64(TEXTURES_DIR / "Texturelabs_Fabric_145L.jpg", max_size=(500, 888), quality=75)
    ink_b64 = get_resized_b64(TEXTURES_DIR / "Texturelabs_InkPaint_397XL.jpg", max_size=(500, 888), quality=75)
    grunge_b64 = get_resized_b64(TEXTURES_DIR / "Texturelabs_Grunge_146XL.jpg", max_size=(500, 888), quality=75)
    glass_b64 = get_resized_b64(TEXTURES_DIR / "Texturelabs_Glass_121L.jpg", max_size=(500, 888), quality=75)

    print("Encoding matted cutouts & plates...")
    think_b64 = get_resized_b64(CONCRETE_DIR / "thinking__choice__choose-removebg-preview.png", max_size=(500, 600))
    halftone_b64 = get_resized_b64(ASSETS_DIR / "idea_vintage_halftone_matted.png", max_size=(500, 600))
    gears_b64 = get_resized_b64(STUDIO_DIR / "industrial_gears_cutout.jpg", max_size=(500, 600), quality=75)
    monument_b64 = get_resized_b64(ASSETS_DIR / "idea_stoic_monument_matted.png", max_size=(500, 600))

    template_path = STUDIO_DIR / "studio_template.html"
    if not template_path.exists():
        raise FileNotFoundError(f"Template not found at {template_path}")

    template_content = template_path.read_text(encoding="utf-8")
    final_html = (
        template_content
        .replace("__PAPER_B64__", paper_b64)
        .replace("__FABRIC_B64__", fabric_b64)
        .replace("__INK_B64__", ink_b64)
        .replace("__GRUNGE_B64__", grunge_b64)
        .replace("__GLASS_B64__", glass_b64)
        .replace("__THINK_B64__", think_b64)
        .replace("__HALFTONE_B64__", halftone_b64)
        .replace("__GEARS_B64__", gears_b64)
        .replace("__MONUMENT_B64__", monument_b64)
    )

    out_file1 = STUDIO_DIR / "motion_graphics_viewfinder_studio.html"
    out_file1.write_text(final_html, encoding="utf-8")
    print(f"Successfully wrote: {out_file1} ({out_file1.stat().st_size:,} bytes)")

    out_file2 = ROOT / "motion-graphics-viewfinder-studio.html"
    out_file2.write_text(final_html, encoding="utf-8")
    print(f"Successfully wrote: {out_file2} ({out_file2.stat().st_size:,} bytes)")

if __name__ == "__main__":
    build()
