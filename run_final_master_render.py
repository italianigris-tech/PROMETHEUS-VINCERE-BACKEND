"""Invoke the DEPLOYED prometheus-mini-run-studio run_mini_run on the Dan Martell reference video.

Saves results to /home/ec2-user/PROMETHEUS-CORE-BACKEND/final_run_output/
"""
import json
import modal
import time
import os
import sys
import tempfile
from pathlib import Path

app = modal.App("run_final_master_render")
vol = modal.Volume.from_name("prometheus-render-artifacts")

VIDEO = "/opt/prometheus/LANDSCAPE VIDEOS FOR USE/Dan Martell, Scared of Achieving SHORT VER.mp4"

OUTPUT_DIR = Path("/home/ec2-user/PROMETHEUS-CORE-BACKEND/final_run_output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

DEST_VIDEO = OUTPUT_DIR / "dan_martell_master_varied.mp4"
DEST_MANIFEST = OUTPUT_DIR / "dan_martell_manifest_varied.json"


@app.local_entrypoint()
def main():
    job_id = f"mini_run_dan_martell_final_{int(time.time())}"
    f = modal.Function.from_name("prometheus-mini-run-studio", "run_mini_run")
    payload = {
        "jobId": job_id,
        "source": {"path": VIDEO},
        "metadata": {"pipeline": "minirun"},
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
    print(f"Sending Dan Martell 30s master run request to Modal (jobId={job_id})...", flush=True)
    start = time.time()
    try:
        res = f.remote(payload)
    except Exception as e:
        print(f"Error: {e}", flush=True)
        sys.exit(1)
    end = time.time()

    print(f"Time taken: {end - start:.2f} seconds", flush=True)
    summary = {k: v for k, v in res.items() if k != "fontManifest"}
    print("Result summary:", json.dumps(summary, indent=2, default=str), flush=True)

    output_url = res.get("outputUrl")
    output_path = res.get("outputPath")
    
    temp_video = tempfile.NamedTemporaryFile(dir=str(OUTPUT_DIR), suffix=".mp4", delete=False)
    temp_video_path = temp_video.name
    temp_video.close()

    if output_url:
        print(f"Downloading completed render from presigned URL...", flush=True)
        import urllib.request
        urllib.request.urlretrieve(output_url, temp_video_path)
    elif output_path:
        print(f"Reading master video from volume path '{output_path}'...", flush=True)
        vol.reload()
        rel_path = output_path.replace("/data/", "")
        with open(temp_video_path, "wb") as f_out:
            for chunk in vol.read_file(rel_path):
                f_out.write(chunk)

    os.replace(temp_video_path, str(DEST_VIDEO))
    size_mb = DEST_VIDEO.stat().st_size / (1024 * 1024)
    print(f"Master saved to '{DEST_VIDEO}' ({size_mb:.2f} MB)", flush=True)

    # Save manifest
    manifest = res.get("fontManifest", {})
    with open(DEST_MANIFEST, "w") as f_out:
        json.dump(manifest, f_out, indent=2)
    print(f"Manifest written to '{DEST_MANIFEST}'", flush=True)

    # Also copy to root workspace for easy access
    root_copy = Path("/home/ec2-user/final_output.mp4")
    import shutil
    shutil.copyfile(DEST_VIDEO, root_copy)
    print(f"Copied final render to '{root_copy}'", flush=True)


if __name__ == "__main__":
    main()
