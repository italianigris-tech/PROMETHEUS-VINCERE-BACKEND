"""
run_github_hakt_test.py
Drop-in replacement for run_modal_30s_hakt_test.py.
Triggers prometheus-render.yml via GitHub Actions API, polls for completion,
downloads the receipt + master MP4, extracts keyframes.
"""
from __future__ import annotations
import argparse, base64, json, os, random, subprocess, sys, time
from pathlib import Path

# Curated rotation sets for high-end aesthetic diversity across runs
CURATED_MOTIFS = [
    "champagne_gold",
    "electric_cyan",
    "emerald_luxury",
    "obsidian_crimson",
    "crimson_editorial",
    "sunset_amber",
    "royal_amethyst",
    "pure_editorial_mono",
]

CURATED_LOOKS = [
    "kodak_2383_print",
    "fuji_3513_print",
    "teal_and_orange_blockbuster",
    "golden_hour_warmth",
    "moody_dramatic_cinema",
    "sci_netone_balanced",
    "vintage_film_emulation",
]

# Use gh CLI to trigger + poll — no extra deps needed
REPO       = "italianigris-tech/PROMETHEUS-VINCERE-BACKEND"
WORKFLOW   = "prometheus-render.yml"
OUTPUT_DIR = Path(__file__).resolve().parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

JOB_ID = f"gha_hakt_30s_pbd_{int(time.time())}"

def build_payload(args=None) -> dict:
    selected_motif = (args.motif if args and args.motif else random.choice(CURATED_MOTIFS))
    selected_look = (args.look if args and args.look else random.choice(CURATED_LOOKS))
    
    return {
        "jobId": JOB_ID,
        "source": {"path": "remotion-app/public/source/MALE-BLACK-TALKING-HEAD-PODCAST.mp4"},
        "selectedWindow": {"sourceStartMs": 0, "sourceEndMs": 30000},
        "maxClipMs": 30000,
        "silencePolicy": "preserve",
        "parallelSlices": 18,
        "metadata": {
            "pipeline": "minirun",
            "jobName": "pbd_30s_hakt_gha",
            "lookId": selected_look,
        },
        "design": {
            "aspectRatio": "9:16",
            "typographySystem": "hakt",
            "lookId": selected_look,
            "lookPolicy": "dynamic",
            "springPhysics": {"damping": 24, "stiffness": 180, "mass": 1.1},
            "specularSheen": True,
            "specularAngle": -35,
            "halationBloom": True,
            "halationSpread": 1.6,
            "backdropCanvas": "paper",
            "canvasTexture": "paper",
            "textureOpacity": 0.18,
            "grainIntensity": 0.08,
            "additiveBlend": True,
            "motionStyle": "cinematic",
            "creativity": "expressive",
            "pacing": "adaptive",
            "typographyBias": "mixed",
            "visualIntensity": 0.95,
            "motif": selected_motif,
            "subjectLayering": "auto",
            "pipPolicy": "disabled",
        },
        "audio": {"songPolicy": "auto", "sfxEnabled": True, "cueBus": True},
    }

def run(custom_args=None):
    payload = build_payload(custom_args)
    print("=" * 70)
    print(f"LAUNCHING 30s HAKT TEST VIA GITHUB ACTIONS: {payload['jobId']}")
    print(f"Palette Motif: {payload['design']['motif']} | 3D LUT Look: {payload['design']['lookId']}")
    print("=" * 70)

    payload_json = json.dumps(payload)
    payload_b64 = base64.b64encode(payload_json.encode("utf-8")).decode("ascii")
    t_start = time.monotonic()

    # Get existing latest run ID to detect the new run reliably
    prev_run_id = None
    init_res = subprocess.run([
        "gh", "run", "list", "--repo", REPO,
        "--workflow", WORKFLOW,
        "--limit", "1",
        "--json", "databaseId",
    ], capture_output=True, text=True)
    if init_res.returncode == 0:
        init_runs = json.loads(init_res.stdout)
        if init_runs:
            prev_run_id = init_runs[0]["databaseId"]

    # Trigger the workflow
    trigger_cmd = [
        "gh", "workflow", "run", WORKFLOW,
        "--repo", REPO,
        "--field", f"payload_b64={payload_b64}",
    ]
    print(f"[trigger] Dispatching workflow...", flush=True)
    res = subprocess.run(trigger_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[trigger] ERROR: {res.stderr}", flush=True)
        sys.exit(1)
    print(f"[trigger] Dispatched! Waiting for new run to appear...", flush=True)

    # Poll for the new run ID
    run_id = None
    for attempt in range(25):
        time.sleep(3)
        list_res = subprocess.run([
            "gh", "run", "list", "--repo", REPO,
            "--workflow", WORKFLOW,
            "--limit", "5",
            "--json", "databaseId,status,conclusion,createdAt",
        ], capture_output=True, text=True)
        if list_res.returncode == 0:
            runs = json.loads(list_res.stdout)
            for r in runs:
                if r["databaseId"] != prev_run_id:
                    run_id = r["databaseId"]
                    break
            if run_id:
                break

    if not run_id:
        print("[trigger] ERROR: could not find workflow run ID", flush=True)
        sys.exit(1)

    print(f"[trigger] Run ID: {run_id}", flush=True)
    print(f"[trigger] Watch: https://github.com/{REPO}/actions/runs/{run_id}", flush=True)
    print("-" * 70)

    # Poll until done
    last_report = time.monotonic()
    while True:
        elapsed = time.monotonic() - t_start
        status_res = subprocess.run([
            "gh", "run", "view", str(run_id),
            "--repo", REPO,
            "--json", "status,conclusion",
        ], capture_output=True, text=True)

        if status_res.returncode == 0:
            info = json.loads(status_res.stdout)
            status     = info.get("status", "unknown")
            conclusion = info.get("conclusion", "")

            if status == "completed":
                print(f"\n[poll] Run completed in {elapsed:.1f}s — conclusion: {conclusion}", flush=True)
                if conclusion != "success":
                    print(f"[poll] ERROR: workflow did not succeed (conclusion={conclusion})", flush=True)
                    print(f"       Logs: https://github.com/{REPO}/actions/runs/{run_id}", flush=True)
                    sys.exit(1)
                break

            if time.monotonic() - last_report >= 15:
                print(f"... still running ({elapsed:.0f}s, status={status}) ...", flush=True)
                last_report = time.monotonic()

        time.sleep(8)

    # Download artifacts
    artifact_dir = OUTPUT_DIR / JOB_ID
    artifact_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[download] Fetching artifacts...", flush=True)
    dl_res = subprocess.run([
        "gh", "run", "download", str(run_id),
        "--repo", REPO,
        "--dir", str(artifact_dir),
    ], capture_output=True, text=True)
    if dl_res.returncode != 0:
        print(f"[download] WARNING: {dl_res.stderr}", flush=True)

    # Find receipt and MP4
    receipt_files = list(artifact_dir.rglob("*.json"))
    mp4_files     = list(artifact_dir.rglob("*.mp4"))

    receipt = {}
    if receipt_files:
        receipt_file = receipt_files[0]
        receipt = json.loads(receipt_file.read_text())
        # Copy to output root with standard name
        out_receipt = OUTPUT_DIR / f"{JOB_ID}_receipt.json"
        out_receipt.write_text(json.dumps(receipt, indent=2))
        print(f"[download] Receipt → {out_receipt}", flush=True)

    local_mp4 = None
    if mp4_files:
        local_mp4 = OUTPUT_DIR / f"{JOB_ID}_master.mp4"
        import shutil
        shutil.copy(mp4_files[0], local_mp4)
        print(f"[download] Master MP4 → {local_mp4} ({local_mp4.stat().st_size/1024/1024:.2f} MB)", flush=True)

    # Extract keyframes
    if local_mp4 and local_mp4.exists():
        print("\n[frames] Extracting proof keyframes...", flush=True)
        for ts in [2.0, 7.5, 15.0, 22.5, 28.0]:
            frame_file = OUTPUT_DIR / f"{JOB_ID}_frame_{ts:.1f}s.png"
            subprocess.run([
                "ffmpeg", "-y", "-loglevel", "error",
                "-ss", f"{ts:.3f}", "-i", str(local_mp4),
                "-vframes", "1", "-q:v", "2", str(frame_file)
            ], check=False)
            if frame_file.exists():
                print(f"  Captured {ts:.1f}s → {frame_file.name}", flush=True)

    total_elapsed = time.monotonic() - t_start
    print("\n" + "=" * 70)
    print(f"GITHUB ACTIONS RENDER COMPLETE in {total_elapsed:.1f}s")
    print(f"Run: https://github.com/{REPO}/actions/runs/{run_id}")
    if local_mp4:
        print(f"MP4: {local_mp4}")
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Trigger 30s HAKT Cloud Render with dynamic or custom styling")
    parser.add_argument("--motif", default=None, choices=CURATED_MOTIFS, help="Brand motif palette")
    parser.add_argument("--look", default=None, choices=CURATED_LOOKS, help="Cinematic 3D LUT look")
    parser.add_argument("--mood", default=None, help="Mood descriptor")
    args = parser.parse_args()
    run(args)
