import json
import re
from datetime import datetime
from pathlib import Path
import shutil

ROOT = Path(__file__).parent
INCOMING_DIR = ROOT / "incoming"
DONE_DIR = ROOT / "done"
ASSETS_DIR = ROOT / "assets"
TEMPLATE_FILE = ROOT / "animated-3img-folder-v1.html"
ASSET_SLUG = "animated-3img-folder"
ASSET_TYPE = "folder-stack"
TEMPLATE_KEYWORDS = [
    "animated",
    "folder",
    "stack",
    "3-image",
    "portrait-cards",
    "glassmorphism",
    "frosted",
    "gsap",
    "svg",
]
ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".jfif"}


def parse_text_artifacts(html: str):
    artifacts = []
    for m in re.finditer(r"<text\b([^>]*)>(.*?)</text>", html, re.S):
        attr_str = m.group(1)
        text_raw = m.group(2).strip()
        role = get_attr(attr_str, "data-text-role") or ""
        slot = get_attr(attr_str, "data-text-slot") or ""
        text_id = get_attr(attr_str, "id") or ""

        role_lower = role.lower()
        if role_lower == "primary":
            category = "core"
        elif role_lower in {"secondary", "tertiary"}:
            category = "descriptor"
        else:
            category = "stray"

        artifacts.append(
            {
                "id": text_id,
                "role": role_lower,
                "category": category,
                "slot": slot,
                "text": text_raw,
                "charCount": len(text_raw),
            }
        )
    counts = {"core": 0, "descriptor": 0, "stray": 0}
    for a in artifacts:
        counts[a["category"]] += 1
    return artifacts, len(artifacts), counts


def get_attr(attr_str: str, name: str):
    m = re.search(rf'{name}="([^"]*)"', attr_str)
    return m.group(1) if m else ""


def list_images():
    if not INCOMING_DIR.exists():
        return []
    files = [
        p
        for p in INCOMING_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in ALLOWED_EXTS
    ]
    return sorted(files, key=lambda p: p.name.lower())


def derive_keywords(path: Path):
    stem = path.stem
    parts = re.split(r"[\s_\-]+", stem)
    parts = [p.lower() for p in parts if p]
    seen = set()
    out = []
    for p in parts:
        if p not in seen:
            out.append(p)
            seen.add(p)
    return out


def read_assets_manifest():
    manifest_path = ROOT / "assets.json"
    if not manifest_path.exists():
        return {"version": 1, "assets": []}
    with manifest_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_assets_manifest(manifest):
    manifest_path = ROOT / "assets.json"
    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


def next_version(manifest):
    versions = []
    for asset in manifest.get("assets", []):
        fname = asset.get("filename", "")
        m = re.search(r"-v(\d+)\.html$", fname)
        if m:
            versions.append(int(m.group(1)))
    for p in ROOT.glob(f"{ASSET_SLUG}-v*.html"):
        m = re.search(r"-v(\d+)\.html$", p.name)
        if m:
            versions.append(int(m.group(1)))
    return max(versions) + 1 if versions else 1


def update_html(
    template_html: str,
    version_num: int,
    filename: str,
    keywords,
    image_hrefs,
    text_artifacts,
    text_artifact_count,
    text_artifact_counts,
):
    html = re.sub(
        r'data-asset-version="\d+"',
        f'data-asset-version="{version_num}"',
        template_html,
    )

    def replace_href(slot_id, new_href, html_in):
        pattern = rf'(<image[^>]*id="{slot_id}"[^>]*href=")([^"]+)(")'
        return re.sub(pattern, rf"\1{new_href}\3", html_in)

    html = replace_href("image_slot_1", image_hrefs[0], html)
    html = replace_href("image_slot_2", image_hrefs[1], html)
    html = replace_href("image_slot_3", image_hrefs[2], html)

    m = re.search(r"<metadata[^>]*>(.*?)</metadata>", html, re.S)
    if not m:
        raise RuntimeError("metadata block not found")
    meta_raw = m.group(1).strip()
    metadata = json.loads(meta_raw)
    metadata["assetId"] = ASSET_SLUG
    metadata["filename"] = filename
    metadata["version"] = f"{version_num}.0.0"
    metadata["textArtifacts"] = text_artifacts
    metadata["textArtifactCount"] = text_artifact_count
    metadata["textArtifactCounts"] = text_artifact_counts

    existing = metadata.get("keywords", [])
    merged = []
    seen = set()
    for k in existing + keywords:
        if k not in seen:
            merged.append(k)
            seen.add(k)
    metadata["keywords"] = merged

    meta_json = json.dumps(metadata, indent=2)
    html = html[: m.start(1)] + "\n" + meta_json + "\n" + html[m.end(1) :]

    return html


def main():
    INCOMING_DIR.mkdir(exist_ok=True)
    DONE_DIR.mkdir(exist_ok=True)
    ASSETS_DIR.mkdir(exist_ok=True)

    if not TEMPLATE_FILE.exists():
        raise SystemExit(f"Template not found: {TEMPLATE_FILE.name}")

    images = list_images()
    if not images:
        print("No images found in incoming/.")
        return

    batch = images[:10]
    triplets = [
        batch[i : i + 3]
        for i in range(0, len(batch), 3)
        if len(batch[i : i + 3]) == 3
    ]
    if not triplets:
        print("Not enough images for a 3-image asset. Need at least 3.")
        return

    manifest = read_assets_manifest()
    version = next_version(manifest)

    template_html = TEMPLATE_FILE.read_text(encoding="utf-8")
    text_artifacts, text_artifact_count, text_artifact_counts = parse_text_artifacts(
        template_html
    )

    used_files = []
    new_assets = []

    for triplet in triplets:
        asset_filename = f"{ASSET_SLUG}-v{version}.html"
        asset_folder = ASSETS_DIR / f"{ASSET_SLUG}-v{version}"
        asset_folder.mkdir(parents=True, exist_ok=True)

        hrefs = []
        derived_keywords = []
        for idx, img in enumerate(triplet, start=1):
            ext = img.suffix.lower()
            dest_name = (
                f"portrait-{'left' if idx == 1 else 'center' if idx == 2 else 'right'}{ext}"
            )
            dest_path = asset_folder / dest_name
            shutil.copy2(img, dest_path)
            hrefs.append(f"assets/{asset_folder.name}/{dest_name}")
            derived_keywords.extend(derive_keywords(img))

        keywords = TEMPLATE_KEYWORDS[:]
        for k in derived_keywords:
            if k not in keywords:
                keywords.append(k)

        updated_html = update_html(
            template_html,
            version,
            asset_filename,
            keywords,
            hrefs,
            text_artifacts,
            text_artifact_count,
            text_artifact_counts,
        )
        (ROOT / asset_filename).write_text(updated_html, encoding="utf-8")

        new_assets.append(
            {
                "assetId": ASSET_SLUG,
                "displayName": "Animated 3-Image Folder",
                "filename": asset_filename,
                "type": ASSET_TYPE,
                "macro": "animated folder with 3 image points",
                "keywords": keywords,
                "imageSlots": 3,
                "imageSlotNames": ["image_slot_1", "image_slot_2", "image_slot_3"],
                "imageSlotRoles": ["left", "center", "right"],
                "textSlots": 2,
                "textSlotNames": ["text_primary_1", "text_secondary_1"],
                "textSlotRoles": ["primary", "secondary"],
                "textArtifacts": text_artifacts,
                "textArtifactCount": text_artifact_count,
                "textArtifactCounts": text_artifact_counts,
                "version": f"{version}.0.0",
            }
        )

        used_files.extend(triplet)
        version += 1

    manifest.setdefault("assets", [])
    # Backfill text artifact data for existing entries if missing
    for asset in manifest["assets"]:
        if asset.get("assetId") == ASSET_SLUG and "textArtifacts" not in asset:
            asset["textArtifacts"] = text_artifacts
            asset["textArtifactCount"] = text_artifact_count
            asset["textArtifactCounts"] = text_artifact_counts
    manifest["assets"].extend(new_assets)
    write_assets_manifest(manifest)

    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    batch_dir = DONE_DIR / f"batch-{stamp}"
    batch_dir.mkdir(parents=True, exist_ok=True)
    for img in used_files:
        shutil.move(str(img), batch_dir / img.name)

    print(
        f"Created {len(new_assets)} asset(s). Moved {len(used_files)} image(s) to {batch_dir}."
    )


if __name__ == "__main__":
    main()
