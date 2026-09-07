"""gha_download_inputs.py - Download source video + props + matte from R2 for a slice runner."""
from __future__ import annotations
import os, boto3, shutil
from botocore.config import Config
from pathlib import Path

s3 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    config=Config(signature_version="s3v4"), region_name="auto")

PROCESSED_BUCKET = os.environ.get("R2_PROCESSED_BUCKET", "prometheus-processed")
JOB_ID           = os.environ["JOB_ID"]
PROPS_KEY        = os.environ["PROPS_R2_KEY"]
SOURCE_KEY       = os.environ.get("SOURCE_R2_KEY", "")
MATTE_KEY        = os.environ.get("MATTE_R2_KEY", "")

# Download props.json
props_local = f"/tmp/props_{JOB_ID}.json"
s3.download_file(PROCESSED_BUCKET, PROPS_KEY, props_local)
print(f"[download] Props → {props_local}", flush=True)

# Make source available under remotion-app/public/source/ for Remotion
src_dir = Path("remotion-app/public/source")
src_dir.mkdir(parents=True, exist_ok=True)
src_local = src_dir / "source.mp4"

if SOURCE_KEY:
    s3.download_file(PROCESSED_BUCKET, SOURCE_KEY, str(src_local))
    print(f"[download] Source → {src_local} ({src_local.stat().st_size/1024/1024:.1f} MB)", flush=True)
elif not src_local.exists():
    fallback = src_dir / "MALE-BLACK-TALKING-HEAD-PODCAST.mp4"
    if fallback.exists():
        shutil.copyfile(fallback, src_local)
        print(f"[download] Copied fallback to source.mp4", flush=True)

if MATTE_KEY:
    matte_local = src_dir / "matte.webm"
    try:
        s3.download_file(PROCESSED_BUCKET, MATTE_KEY, str(matte_local))
        print(f"[download] Matte → {matte_local} ({matte_local.stat().st_size/1024/1024:.1f} MB)", flush=True)
    except Exception as e:
        print(f"[download] Warning: could not download matte: {e}", flush=True)

if src_local.exists():
    shutil.copyfile(src_local, src_dir / "test.mp4")
