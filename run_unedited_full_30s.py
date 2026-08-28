"""Full end-to-end run of the DEPLOYED prometheus-mini-run-studio `run_mini_run`
on the "Unedited Videos Made Me a Better Editor" reference video.

Runs the entire mini-run pipeline (transcribe -> chunk -> edit -> matte -> render)
for the FIRST 30 SECONDS of the source, pulled through Modal on this EC2 host.

Writes to a FRESH destination so the prior render (mini_run_30s_master.mp4) is
preserved for before/after comparison.
"""
import json
import modal
import time
import os
import sys
import tempfile

app = modal.App("run_unedited_full_30s")
vol = modal.Volume.from_name("prometheus-render-artifacts")

# Reference video baked into the deployed image at this path.
VIDEO = "/opt/prometheus/LANDSCAPE VIDEOS FOR USE/Unedited Videos Made Me a Better Editor_ Here's How....mp4"

# Fresh output files (do not overwrite the prior render).
DEST_VIDEO = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/mini_run_fullrun_30s.mp4"
DEST_MANIFEST = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/mini_run_fullrun_30s_manifest.json"


@app.local_entrypoint()
def main():
    job_id = f"mini_run_better_editor_full_{int(time.time())}"
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
            "visualIntensity": 0.82,
            "pipPolicy": "disabled",
        },
        "audio": {"songPolicy": "auto"},
        # First 30 seconds only.
        "selectedWindow": {"sourceStartMs": 0, "sourceEndMs": 30000},
    }
    print(f"Sending FULL first-30s request to Modal run_mini_run (jobId={job_id})...", flush=True)
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
    destination_dir = os.path.dirname(DEST_VIDEO)
    temp_video = tempfile.NamedTemporaryFile(dir=destination_dir, suffix=".mp4", delete=False)
    temp_video.close()
    if output_url:
        import urllib.request
        print("Downloading completed render from presigned URL...", flush=True)
        urllib.request.urlretrieve(output_url, temp_video.name)
    elif output_path:
        remote_path = output_path.replace("/data/", "").lstrip("/")
        print(f"Streaming completed render from volume '{remote_path}'...", flush=True)
        bytes_written = 0
        with open(temp_video.name, "wb") as out_f:
            for chunk in vol.read_file(remote_path):
                out_f.write(chunk)
                bytes_written += len(chunk)
    if output_url or output_path:
        os.replace(temp_video.name, DEST_VIDEO)
        print(f"Master saved to '{DEST_VIDEO}' ({os.path.getsize(DEST_VIDEO) / (1024*1024):.2f} MB)", flush=True)
    else:
        os.unlink(temp_video.name)

    font_manifest = res.get("fontManifest")
    if font_manifest:
        font_manifest = {
            **font_manifest,
            "orchestrationManifest": res.get("orchestrationManifest"),
            "songProgram": res.get("songProgram"),
            "audioMix": res.get("audioMix"),
        }
        with open(DEST_MANIFEST, "w", encoding="utf-8") as out_m:
            json.dump(font_manifest, out_m, indent=2)
        print(f"Manifest written to '{DEST_MANIFEST}'", flush=True)
    elif output_path:
        try:
            remote_manifest = os.path.dirname(output_path.replace("/data/", "").lstrip("/")) + "/font_manifest.json"
            with open(DEST_MANIFEST, "wb") as out_m:
                for chunk in vol.read_file(remote_manifest):
                    out_m.write(chunk)
            print(f"Manifest downloaded to '{DEST_MANIFEST}'", flush=True)
        except Exception as e:
            print(f"Warning downloading manifest: {e}", flush=True)


if __name__ == "__main__":
    main()
