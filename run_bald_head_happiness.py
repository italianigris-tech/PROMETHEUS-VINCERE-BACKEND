"""Invoke the DEPLOYED prometheus-mini-run-studio run_mini_run on the Bald Head Happiness video.

Measures sub-minute execution performance and saves master MP4.
"""
import json
import modal
import os
import sys
import tempfile
import time
from pathlib import Path

app = modal.App("run_bald_head_happiness")
vol = modal.Volume.from_name("prometheus-render-artifacts")

VIDEO = "/opt/prometheus/LANDSCAPE VIDEOS FOR USE/Bald Head Happiness.mp4"

OUTPUT_DIR = Path("/home/ec2-user/PROMETHEUS-CORE-BACKEND/final_run_output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

DEST_VIDEO = OUTPUT_DIR / "bald_head_happiness_master.mp4"
DEST_MANIFEST = OUTPUT_DIR / "bald_head_happiness_manifest.json"
ROOT_COPY = Path("/home/ec2-user/bald_head_happiness_master.mp4")


@app.local_entrypoint()
def main():
    job_id = f"mini_run_bald_head_happiness_{int(time.time())}"
    f = modal.Function.from_name("prometheus-mini-run-studio", "run_mini_run")
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
    print(f"=== STARTING BALD HEAD HAPPINESS 30s MINI-RUN ===", flush=True)
    print(f"Job ID: {job_id}")
    print(f"Source: {VIDEO}", flush=True)

    t_start = time.time()
    try:
        res = f.remote(payload)
    except Exception as e:
        print(f"Error: {e}", flush=True)
        sys.exit(1)
    t_end = time.time()
    dur = t_end - t_start

    print(f"\n>>> PIPELINE EXECUTION TIME: {dur:.2f} seconds! <<<", flush=True)
    summary = {k: v for k, v in res.items() if k != "fontManifest"}
    print("Result summary:", json.dumps(summary, indent=2, default=str), flush=True)

    output_url = res.get("outputUrl")
    output_path = res.get("outputPath")

    temp_video = tempfile.NamedTemporaryFile(dir=str(OUTPUT_DIR), suffix=".mp4", delete=False)
    temp_video_path = temp_video.name
    temp_video.close()

    if output_path:
        print(f"Reading master video directly from volume path '{output_path}'...", flush=True)
        vol.reload()
        rel_path = output_path.replace("/data/", "")
        with open(temp_video_path, "wb") as f_out:
            for chunk in vol.read_file(rel_path):
                f_out.write(chunk)
    elif output_url:
        print("Downloading completed render from presigned URL...", flush=True)
        import urllib.request
        urllib.request.urlretrieve(output_url, temp_video_path)

    os.replace(temp_video_path, str(DEST_VIDEO))
    size_mb = DEST_VIDEO.stat().st_size / (1024 * 1024)
    print(f"Master saved to '{DEST_VIDEO}' ({size_mb:.2f} MB)", flush=True)

    # Save manifest
    manifest = res.get("fontManifest", {})
    with open(DEST_MANIFEST, "w") as f_out:
        json.dump(manifest, f_out, indent=2)
    print(f"Manifest written to '{DEST_MANIFEST}'", flush=True)

    # Copy to workspace root
    import shutil
    shutil.copyfile(DEST_VIDEO, ROOT_COPY)
    print(f"Copied final render to '{ROOT_COPY}'", flush=True)


if __name__ == "__main__":
    main()
