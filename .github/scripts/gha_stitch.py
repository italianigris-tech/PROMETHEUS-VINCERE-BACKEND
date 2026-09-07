"""
gha_stitch.py - Stage 3: download all slices from R2, concat, write receipt.
"""
from __future__ import annotations
import json, os, subprocess, time, boto3
from botocore.config import Config
from pathlib import Path

s3 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    config=Config(signature_version="s3v4"), region_name="auto")

PROCESSED_BUCKET   = os.environ.get("R2_PROCESSED_BUCKET", "prometheus-processed")
PUBLIC_BASE        = os.environ.get("R2_PUBLIC_PROCESSED_BASE", "")
JOB_ID             = os.environ["JOB_ID"]
TOTAL_SLICES       = int(os.environ.get("TOTAL_SLICES", "20"))
RECEIPT_PARTIAL    = os.environ.get("RECEIPT_PARTIAL", "{}")

partial = json.loads(RECEIPT_PARTIAL) if RECEIPT_PARTIAL else {}
slices_dir = Path("/tmp/slices_dl")
slices_dir.mkdir(parents=True, exist_ok=True)

# Download all slices
slice_paths = []
t_dl = time.monotonic()
for i in range(TOTAL_SLICES):
    key = f"gha-renders/{JOB_ID}/slices/slice_{i:02d}.mp4"
    local = slices_dir / f"slice_{i:02d}.mp4"
    try:
        s3.download_file(PROCESSED_BUCKET, key, str(local))
        slice_paths.append(local)
        print(f"[stitch] Downloaded slice {i:02d} ({local.stat().st_size/1024:.0f} KB)", flush=True)
    except Exception as e:
        print(f"[stitch] WARNING: missing slice {i:02d}: {e}", flush=True)

print(f"[stitch] Downloaded {len(slice_paths)}/{TOTAL_SLICES} slices in {time.monotonic()-t_dl:.1f}s", flush=True)

if not slice_paths:
    raise RuntimeError("No slices downloaded — render failed.")

# Sort by index
slice_paths.sort(key=lambda p: int(p.stem.split("_")[1]))

# Build concat manifest
concat_txt = slices_dir / "concat.txt"
with concat_txt.open("w") as f:
    for p in slice_paths:
        f.write(f"file '{p}'\n")

# FFmpeg concat (stream copy, no reencode)
master_path = Path(f"/tmp/master_{JOB_ID}.mp4")
t_stitch = time.monotonic()
subprocess.run([
    "ffmpeg", "-y", "-loglevel", "error",
    "-f", "concat", "-safe", "0",
    "-i", str(concat_txt),
    "-c", "copy",
    "-movflags", "+faststart",
    str(master_path)
], check=True)
stitch_ms = int((time.monotonic() - t_stitch) * 1000)
print(f"[stitch] Concatenated in {stitch_ms}ms → {master_path} ({master_path.stat().st_size/1024/1024:.2f} MB)", flush=True)

# Upload master to R2
master_key = f"gha-renders/{JOB_ID}/master.mp4"
s3.upload_file(str(master_path), PROCESSED_BUCKET, master_key)
output_url = f"{PUBLIC_BASE}/{master_key}" if PUBLIC_BASE else f"r2://{PROCESSED_BUCKET}/{master_key}"
print(f"[stitch] Master → R2:{master_key}", flush=True)

# Write receipt
receipt = {
    **partial,
    "outputPath": master_key,
    "outputUrl": output_url,
    "masterSizeBytes": master_path.stat().st_size,
    "slicesRendered": len(slice_paths),
    "stitchMs": stitch_ms,
    "completedAt": time.time(),
    "backend": "github-actions",
}
receipt_path = Path(f"/tmp/receipt_{JOB_ID}.json")
receipt_path.write_text(json.dumps(receipt, indent=2))
print(f"[stitch] Receipt written: {receipt_path}", flush=True)
print(json.dumps(receipt, indent=2))
