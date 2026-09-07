"""
gha_orchestrate.py - Stage 1: transcription + typography planning + R2 upload.
"""
from __future__ import annotations
import json, os, re, subprocess, sys, time, tempfile
from pathlib import Path

import boto3
from botocore.config import Config

ENDPOINT        = os.environ["R2_ENDPOINT"]
KEY_ID          = os.environ["R2_ACCESS_KEY_ID"]
KEY_SECRET      = os.environ["R2_SECRET_ACCESS_KEY"]
UPLOAD_BUCKET   = os.environ.get("R2_UPLOAD_BUCKET", "prometheus-uploads")
PROCESSED_BUCKET= os.environ.get("R2_PROCESSED_BUCKET", "prometheus-processed")
PARALLEL_SLICES = int(os.environ.get("PARALLEL_SLICES", "20"))

s3 = boto3.client("s3", endpoint_url=ENDPOINT, aws_access_key_id=KEY_ID,
    aws_secret_access_key=KEY_SECRET, config=Config(signature_version="s3v4"),
    region_name="auto")

def gha_output(key, value):
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            if "\n" in value:
                delim = f"EOF_{key}"
                f.write(f"{key}<<{delim}\n{value}\n{delim}\n")
            else:
                f.write(f"{key}={value}\n")
    print(f"[gha_output] {key}={value[:120]}", flush=True)

def parse_payload(raw: str) -> dict:
    """Parse JSON payload — tolerates GitHub Actions stripping quotes from keys."""
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Fix unquoted keys: {key: val} -> {"key": val}
    fixed = re.sub(r'(?<!["\w])([a-zA-Z_]\w*)(?=\s*:)', r'"\1"', raw)
    # Fix single-quoted string values
    fixed = re.sub(r":\s*'([^']*)'", r': "\1"', fixed)
    # Fix Python True/False/None -> JSON true/false/null
    fixed = fixed.replace(": True", ": true").replace(": False", ": false").replace(": None", ": null")
    try:
        return json.loads(fixed)
    except json.JSONDecodeError as e:
        print(f"[orchestrate] JSON parse failed even after fix: {e}")
        print(f"[orchestrate] Raw payload: {raw[:300]}")
        # Return a minimal default payload for testing
        return {}

def main():
    # Prefer file-based payload (written via heredoc, avoids shell quoting issues)
    payload_file = os.environ.get("PAYLOAD_FILE", "")
    if payload_file and Path(payload_file).exists():
        raw = Path(payload_file).read_text(encoding="utf-8").strip()
        print(f"[orchestrate] Reading payload from file: {payload_file}", flush=True)
    else:
        raw = os.environ.get("PIPELINE_PAYLOAD", "{}")
        print(f"[orchestrate] Reading payload from env var", flush=True)
    payload = parse_payload(raw)
    print(f"[orchestrate] Parsed payload keys: {list(payload.keys())}", flush=True)

    job_id  = payload.get("jobId") or f"gha_hakt_{int(time.time())}"
    print(f"[orchestrate] job_id={job_id}", flush=True)

    source     = payload.get("source", {})
    src_str    = source.get("path") or source.get("inputUrl") or ""
    workdir    = Path(tempfile.mkdtemp(prefix="prometheus_"))
    local_vid  = workdir / "source.mp4"

    # Download source video
    if src_str.startswith("http"):
        import urllib.request
        urllib.request.urlretrieve(src_str, local_vid)
        print(f"[orchestrate] Downloaded source from URL", flush=True)
    else:
        key = src_str.lstrip("/")
        try:
            s3.download_file(UPLOAD_BUCKET, key, str(local_vid))
            print(f"[orchestrate] Fetched source from R2 upload bucket: {key}", flush=True)
        except Exception as e:
            print(f"[orchestrate] No source from R2 ({e}), dry-run placeholder", flush=True)
            local_vid.write_bytes(b"")

    # Upload source to processed bucket for slice runners
    source_r2_key = ""
    if local_vid.exists() and local_vid.stat().st_size > 100:
        source_r2_key = f"gha-renders/{job_id}/source.mp4"
        s3.upload_file(str(local_vid), PROCESSED_BUCKET, source_r2_key)
        print(f"[orchestrate] Source -> R2:{source_r2_key}", flush=True)

    # Transcription
    chunks = []
    aai_key  = os.environ.get("ASSEMBLYAI_API_KEY", "")
    selected = payload.get("selectedWindow", {})
    start_ms = int(selected.get("sourceStartMs", 0))
    end_ms   = int(selected.get("sourceEndMs", 30000))

    if aai_key and local_vid.exists() and local_vid.stat().st_size > 100:
        try:
            import assemblyai as aai
            aai.settings.api_key = aai_key
            trimmed = workdir / "trimmed.mp4"
            subprocess.run(["ffmpeg","-y","-loglevel","error",
                "-ss", str(start_ms/1000), "-to", str(end_ms/1000),
                "-i", str(local_vid), "-c","copy", str(trimmed)], check=True)
            print(f"[orchestrate] Transcribing {start_ms}-{end_ms}ms...", flush=True)
            t = aai.Transcriber().transcribe(str(trimmed))
            if hasattr(t,"words") and t.words:
                chunks = [{"text":w.text,"startMs":w.start,"endMs":w.end} for w in t.words]
                print(f"[orchestrate] {len(chunks)} words transcribed", flush=True)
        except Exception as e:
            print(f"[orchestrate] Transcription error: {e}", flush=True)

    if not chunks:
        chunks = [{"text":"...","startMs":start_ms,"endMs":end_ms}]

    # Build props
    design      = payload.get("design", {})
    duration_ms = end_ms - start_ms
    props = {
        "jobId": job_id, "durationMs": duration_ms, "chunks": chunks,
        "design": design, "sourcePath": "source/source.mp4",
        "aspectRatio": design.get("aspectRatio","9:16"),
        "typographySystem": design.get("typographySystem","hakt"),
        "motif": design.get("motif","royal_amethyst"),
    }
    props_path = workdir / f"props_{job_id}.json"
    props_path.write_text(json.dumps(props, indent=2))
    props_r2_key = f"gha-renders/{job_id}/props.json"
    s3.upload_file(str(props_path), PROCESSED_BUCKET, props_r2_key)
    print(f"[orchestrate] Props -> R2:{props_r2_key}", flush=True)

    # Build slice matrix
    fps          = 30
    total_frames = max(1, int(round((duration_ms / 1000.0) * fps)))
    fps_per      = max(1, (total_frames + PARALLEL_SLICES - 1) // PARALLEL_SLICES)
    matrix = []
    for i in range(PARALLEL_SLICES):
        sf = i * fps_per
        ef = min(total_frames - 1, (i+1)*fps_per - 1)
        if sf > ef: break
        matrix.append({"slice_index": i, "start_frame": sf, "end_frame": ef})

    receipt_partial = json.dumps({
        "jobId": job_id, "chunkCount": len(chunks), "durationMs": duration_ms,
        "totalFrames": total_frames, "sliceCount": len(matrix), "orchestratedAt": time.time()
    })

    gha_output("job_id", job_id)
    gha_output("slice_matrix", json.dumps(matrix))
    gha_output("props_r2_key", props_r2_key)
    gha_output("source_r2_key", source_r2_key)
    gha_output("receipt_partial", receipt_partial)
    gha_output("total_slices", str(len(matrix)))
    print(f"[orchestrate] Done: {len(matrix)} slices over {total_frames} frames", flush=True)

if __name__ == "__main__":
    main()
