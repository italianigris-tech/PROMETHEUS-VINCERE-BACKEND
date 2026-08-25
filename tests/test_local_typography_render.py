"""Local Remotion render validation for varied cinematic typography.

Mirrors pipeline.py -> render.py flow (typography manifest merged into chunks,
props written to /tmp, Remotion CLI render) but restricted to 30 frames so it
runs quickly. Validates:
  - The manifest merges cleanly into chunks
  - The PrometheusMinRun composition accepts the manifest
  - The 4 new hero fonts load and render without runtime errors
"""
import json
import os
import shutil
import subprocess
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _REPO_ROOT)

from mini_run_pipeline.typography import generate_font_manifest  # noqa: E402

REMOTION_APP = os.path.join(_REPO_ROOT, "remotion-app")
PUBLIC_SOURCE = os.path.join(REMOTION_APP, "public", "source")
SRC_VIDEO = os.path.join(REMOTION_APP, "public", "dev-fixtures", "test-video.mp4")
JOB_ID = "typography_variation_validation"

TEXTS = [
    "Here's how unedited",
    "videos made me",
    "a better editor.",
    "I used to cut everything.",
    "Every pause. Every breath.",
    "But watching raw footage",
    "changed everything.",
    "You learn what actually matters",
    "to the viewer.",
    "The story is in the silence",
    "not just the cuts.",
    "Watch your raw footage.",
    "All of it.",
    "EDITOR",
    "UNEDITED",
    "Go",
]


def build_chunks(texts):
    chunks = []
    for i, text in enumerate(texts):
        start = int(i * (30000 / len(texts)))
        end = int((i + 1) * (30000 / len(texts)) - 100)
        chunks.append({
            "text": text,
            "topLabel": f"chunk {i}",
            "startMs": start,
            "endMs": end,
            "outputStartMs": start,
            "outputEndMs": end,
            "isHero": True,
        })
    return chunks


def main():
    os.makedirs(PUBLIC_SOURCE, exist_ok=True)
    rel_video = f"source_{JOB_ID}.mp4"
    dest_video = os.path.join(PUBLIC_SOURCE, rel_video)
    shutil.copyfile(SRC_VIDEO, dest_video)

    chunks = build_chunks(TEXTS)
    font_manifest = generate_font_manifest(chunks)
    for c_idx, c_item in enumerate(chunks):
        if c_idx < len(font_manifest["chunks"]):
            c_item.update(font_manifest["chunks"][c_idx])

    props = {
        "videoSrc": f"source/{rel_video}",
        "chunks": chunks,
        "durationMs": 30000,
    }

    tmp = "/tmp/mini-run-typography-validation"
    os.makedirs(tmp, exist_ok=True)
    props_path = os.path.join(tmp, f"props_{JOB_ID}.json")
    with open(props_path, "w") as f:
        json.dump(props, f, indent=2)

    out_path = os.path.join(tmp, f"mini_run_{JOB_ID}_muted.mp4")
    cmd = [
        "npx", "remotion", "render",
        "src/index.ts", "PrometheusMinRun",
        out_path,
        "--props", props_path,
        "--frames", "0-29",
        "--concurrency", "2",
        "--gl", "swangle",
        "--muted",
        "--timeout", "120000",
    ]
    print("Running:", " ".join(cmd[:8]) + " ...")
    res = subprocess.run(cmd, cwd=REMOTION_APP, capture_output=True, text=True, env={**os.environ, "TMPDIR": tmp})
    if res.returncode != 0:
        print("STDOUT tail:", res.stdout[-3000:])
        print("STDERR tail:", res.stderr[-3000:])
        sys.exit(1)

    print("Render OK:", out_path)
    size = os.path.getsize(out_path)
    print(f"Output size: {size / 1024 / 1024:.1f} MB")
    # Quick sanity on manifest variety
    families = set()
    for c in font_manifest["chunks"]:
        for layer in c.get("layers", []):
            families.add(layer.get("fontFamily"))
    print("Chunks:", len(font_manifest["chunks"]))
    print("Distinct font families used:", sorted(families))
    sys.exit(0)


if __name__ == "__main__":
    main()
