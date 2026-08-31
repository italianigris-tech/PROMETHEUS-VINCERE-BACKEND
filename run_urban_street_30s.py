import json
import os
import sys
import time
from pathlib import Path

# Use local workspace scratch directory for temp files
SCRATCH_TMP = Path(__file__).resolve().parent / "tmp" / "mini_run_scratch"
SCRATCH_TMP.mkdir(parents=True, exist_ok=True)

os.environ["MINI_RUN_TMP_DIR"] = str(SCRATCH_TMP)
os.environ["TMPDIR"] = str(SCRATCH_TMP)
os.environ["PYTHONUTF8"] = "1"

from mini_run_pipeline import pipeline

SOURCE_VIDEO = r"C:\Users\HomePC\Downloads\ALL BUT BACKEND\RAW HEAD VIDS PINTEREST\URBAN STREET TALKING HEAD.mp4"
OUTPUT_DIR = Path(__file__).resolve().parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

DEST_VIDEO = OUTPUT_DIR / "urban_street_30s_master.mp4"
DEST_MANIFEST = OUTPUT_DIR / "urban_street_30s_manifest.json"

def main():
    job_id = f"mini_run_urban_street_{int(time.time())}"
    payload = {
        "jobId": job_id,
        "source": {"path": SOURCE_VIDEO},
        "metadata": {"pipeline": "minirun", "jobName": "urban_street_talking_head"},
        "design": {
            "aspectRatio": "9:16",
            "creativity": "expressive",
            "pacing": "adaptive",
            "motionStyle": "cinematic",
            "typographyBias": "mixed",
            "subjectLayering": "auto",
            "visualIntensity": 0.90,
            "pipPolicy": "disabled",
            "motif": "royal_amethyst",
            "listicleTreatment": "gradient_fade_oblivion",
        },
        "audio": {"songPolicy": "auto"},
        "selectedWindow": {"sourceStartMs": 0, "sourceEndMs": 30000},
    }
    print("=== STARTING URBAN STREET 30s MINI-RUN ===", flush=True)
    print(f"Job ID: {job_id}")
    print(f"Source: {SOURCE_VIDEO}", flush=True)

    t_start = time.time()
    try:
        res = pipeline.execute_pipeline_job(
            job_id=job_id,
            data=payload,
            artifact_root=Path(__file__).resolve().parent / "tmp" / "local_mini_run_artifacts",
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error: {e}", flush=True)
        sys.exit(1)
    t_end = time.time()
    dur = t_end - t_start

    print(f"\n>>> PIPELINE EXECUTION TIME: {dur:.2f} seconds! <<<", flush=True)
    summary = {k: v for k, v in res.items() if k != "fontManifest"}
    print("Result summary:", json.dumps(summary, indent=2, default=str), flush=True)

    output_path = res.get("outputPath")
    if output_path and os.path.exists(output_path):
        import shutil
        shutil.copyfile(output_path, DEST_VIDEO)
        size_mb = DEST_VIDEO.stat().st_size / (1024 * 1024)
        print(f"\nSUCCESS! Master saved to '{DEST_VIDEO}' ({size_mb:.2f} MB)", flush=True)
    else:
        print(f"\nWarning: Output path '{output_path}' not found.", flush=True)

    manifest = res.get("fontManifest", {})
    with open(DEST_MANIFEST, "w", encoding="utf-8") as f_out:
        json.dump(manifest, f_out, indent=2)
    print(f"Manifest written to '{DEST_MANIFEST}'", flush=True)

if __name__ == "__main__":
    main()
