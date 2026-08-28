import json
import os
import sys
import time
from pathlib import Path

os.environ["MINI_RUN_TMP_DIR"] = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/scratch_tmp"
os.environ["TMPDIR"] = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/scratch_tmp"

from mini_run_pipeline import pipeline

VIDEO = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/LANDSCAPE VIDEOS FOR USE/Bald Head Happiness.mp4"
OUTPUT_DIR = Path("/home/ec2-user/PROMETHEUS-CORE-BACKEND/final_run_output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

DEST_VIDEO = OUTPUT_DIR / "bald_head_happiness_master.mp4"
DEST_MANIFEST = OUTPUT_DIR / "bald_head_happiness_manifest.json"
ROOT_COPY = Path("/home/ec2-user/bald_head_happiness_master.mp4")

def main():
    job_id = f"mini_run_bald_head_happiness_local_{int(time.time())}"
    payload = {
        "jobId": job_id,
        "source": {"path": VIDEO},
        "metadata": {"pipeline": "minirun", "jobName": "bald_head_happiness"},
        "design": {
            "aspectRatio": "9:16",
            "creativity": "expressive",
            "pacing": "adaptive",
            "motionStyle": "cinematic",
            "typographyBias": "mixed",
            "subjectLayering": "auto",
            "visualIntensity": 0.85,
            "pipPolicy": "disabled",
        },
        "audio": {"songPolicy": "auto"},
        "selectedWindow": {"sourceStartMs": 0, "sourceEndMs": 30000},
    }
    print("=== STARTING LOCAL BALD HEAD HAPPINESS 30s MINI-RUN ===", flush=True)
    print(f"Job ID: {job_id}")
    print(f"Source: {VIDEO}", flush=True)

    t_start = time.time()
    try:
        res = pipeline.execute_pipeline_job(
            job_id=job_id,
            data=payload,
            artifact_root=Path("/tmp/local_mini_run"),
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
        shutil.copyfile(output_path, ROOT_COPY)
        size_mb = DEST_VIDEO.stat().st_size / (1024 * 1024)
        print(f"Master saved to '{DEST_VIDEO}' and '{ROOT_COPY}' ({size_mb:.2f} MB)", flush=True)

    manifest = res.get("fontManifest", {})
    with open(DEST_MANIFEST, "w") as f_out:
        json.dump(manifest, f_out, indent=2)
    print(f"Manifest written to '{DEST_MANIFEST}'", flush=True)

if __name__ == "__main__":
    main()
