"""Execute concurrent mini-runs on Modal for:
1. Talking Head Video Raw - akimbosd
2. Unedited Videos Made Me a Better Editor_ Here's How...

Measures individual and concurrent execution times and downloads both MP4 masters.
"""
import json
import modal
import os
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

app = modal.App("run_concurrent_mini_runs")
vol = modal.Volume.from_name("prometheus-render-artifacts")

OUTPUT_DIR = Path("/home/ec2-user/PROMETHEUS-CORE-BACKEND/final_run_output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

JOBS_CONFIG = [
    {
        "name": "akimbosd",
        "label": "Talking Head Video Raw (Akimbosd)",
        "video": "/opt/prometheus/LANDSCAPE VIDEOS FOR USE/Talking Head Video Raw - akimbosd (1080p, h264).mp4",
        "output_mp4": OUTPUT_DIR / "akimbosd_master.mp4",
        "output_manifest": OUTPUT_DIR / "akimbosd_manifest.json",
        "root_copy": Path("/home/ec2-user/akimbosd_master.mp4"),
        "selectedWindow": {"sourceStartMs": 0, "sourceEndMs": 30000},
    },
    {
        "name": "how_unedited",
        "label": "Unedited Videos Made Me a Better Editor (Here's How...)",
        "video": "/opt/prometheus/LANDSCAPE VIDEOS FOR USE/Unedited Videos Made Me a Better Editor_ Here's How....mp4",
        "output_mp4": OUTPUT_DIR / "how_unedited_master.mp4",
        "output_manifest": OUTPUT_DIR / "how_unedited_manifest.json",
        "root_copy": Path("/home/ec2-user/how_unedited_master.mp4"),
        "selectedWindow": {"sourceStartMs": 0, "sourceEndMs": 30000},
    },
]


def execute_job(cfg: dict, shared_fn) -> dict:
    job_name = cfg["name"]
    job_id = f"mini_run_concurrent_{job_name}_{int(time.time())}"
    payload = {
        "jobId": job_id,
        "source": {"path": cfg["video"]},
        "metadata": {"pipeline": "minirun", "jobName": job_name},
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
        "selectedWindow": cfg["selectedWindow"],
    }

    print(f"[{job_name.upper()}] Dispatched to Modal (jobId={job_id})...", flush=True)
    t_start = time.time()
    try:
        res = shared_fn.remote(payload)
        t_end = time.time()
        dur = t_end - t_start
        print(f"[{job_name.upper()}] Finished in {dur:.2f}s!", flush=True)

        output_url = res.get("outputUrl")
        output_path = res.get("outputPath")

        temp_video = tempfile.NamedTemporaryFile(dir=str(OUTPUT_DIR), suffix=".mp4", delete=False)
        temp_video_path = temp_video.name
        temp_video.close()

        if output_url:
            print(f"[{job_name.upper()}] Downloading completed render from URL...", flush=True)
            import urllib.request
            urllib.request.urlretrieve(output_url, temp_video_path)
        elif output_path:
            print(f"[{job_name.upper()}] Reading master video from volume path '{output_path}'...", flush=True)
            vol.reload()
            rel_path = output_path.replace("/data/", "")
            with open(temp_video_path, "wb") as f_out:
                for chunk in vol.read_file(rel_path):
                    f_out.write(chunk)

        os.replace(temp_video_path, str(cfg["output_mp4"]))
        size_mb = cfg["output_mp4"].stat().st_size / (1024 * 1024)
        print(f"[{job_name.upper()}] Saved to '{cfg['output_mp4']}' ({size_mb:.2f} MB)", flush=True)

        # Save manifest
        manifest = res.get("fontManifest", {})
        with open(cfg["output_manifest"], "w") as f_out:
            json.dump(manifest, f_out, indent=2)

        # Copy to root workspace
        import shutil
        shutil.copyfile(cfg["output_mp4"], cfg["root_copy"])
        print(f"[{job_name.upper()}] Copied to '{cfg['root_copy']}'", flush=True)

        return {
            "name": job_name,
            "label": cfg["label"],
            "jobId": job_id,
            "success": True,
            "durationSec": dur,
            "sizeMb": size_mb,
            "mp4Path": str(cfg["output_mp4"]),
            "rootMp4Path": str(cfg["root_copy"]),
            "manifestPath": str(cfg["output_manifest"]),
            "response": {k: v for k, v in res.items() if k != "fontManifest"},
        }
    except Exception as e:
        t_end = time.time()
        dur = t_end - t_start
        print(f"[{job_name.upper()}] FAILED after {dur:.2f}s: {e}", flush=True)
        return {
            "name": job_name,
            "label": cfg["label"],
            "jobId": job_id,
            "success": False,
            "durationSec": dur,
            "error": str(e),
        }


@app.local_entrypoint()
def main():
    f = modal.Function.from_name("prometheus-mini-run-studio", "run_mini_run")
    print("=== STARTING CONCURRENT MINI-RUNS ===", flush=True)
    print(f"Total concurrent jobs: {len(JOBS_CONFIG)}")
    for c in JOBS_CONFIG:
        print(f" - {c['label']} -> {c['video']}")

    overall_start = time.time()

    with ThreadPoolExecutor(max_workers=len(JOBS_CONFIG)) as executor:
        futures = [executor.submit(execute_job, c, f) for c in JOBS_CONFIG]
        results = [fut.result() for fut in futures]

    overall_end = time.time()
    total_concurrent_time = overall_end - overall_start

    print("\n=== CONCURRENT EXECUTION SUMMARY ===", flush=True)
    print(f"Total Concurrent Wall Time: {total_concurrent_time:.2f}s\n")

    summary_file = OUTPUT_DIR / "concurrent_runs_summary.json"
    summary_data = {
        "totalWallTimeSec": total_concurrent_time,
        "jobs": results,
    }
    with open(summary_file, "w") as f_out:
        json.dump(summary_data, f_out, indent=2, default=str)

    for r in results:
        print(f"Job: {r['label']}")
        print(f"  Success: {r.get('success')}")
        print(f"  Duration: {r.get('durationSec', 0):.2f}s")
        if r.get("success"):
            print(f"  Size: {r.get('sizeMb', 0):.2f} MB")
            print(f"  MP4: {r.get('rootMp4Path')}")
        else:
            print(f"  Error: {r.get('error')}")
        print("-" * 50)


if __name__ == "__main__":
    main()
