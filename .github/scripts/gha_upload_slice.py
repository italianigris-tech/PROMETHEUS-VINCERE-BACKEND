"""gha_upload_slice.py - Upload a rendered slice MP4 to R2."""
import os, boto3
from botocore.config import Config
from pathlib import Path

s3 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    config=Config(signature_version="s3v4"), region_name="auto")

PROCESSED_BUCKET = os.environ.get("R2_PROCESSED_BUCKET", "prometheus-processed")
JOB_ID           = os.environ["JOB_ID"]
SLICE_INDEX      = os.environ["SLICE_INDEX"]

local_path = Path(f"/tmp/slices/slice_{SLICE_INDEX}.mp4")
if not local_path.exists():
    raise FileNotFoundError(f"Slice not found: {local_path}")

r2_key = f"gha-renders/{JOB_ID}/slices/slice_{int(SLICE_INDEX):02d}.mp4"
s3.upload_file(str(local_path), PROCESSED_BUCKET, r2_key)
size_mb = local_path.stat().st_size / 1024 / 1024
print(f"[upload_slice] slice_{SLICE_INDEX} → R2:{r2_key} ({size_mb:.2f} MB)", flush=True)
