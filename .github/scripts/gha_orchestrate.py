"""
gha_orchestrate.py - Stage 1: transcription + typography planning + R2 upload.
"""
from __future__ import annotations
import base64, hashlib, json, os, re, shutil, subprocess, sys, time, tempfile
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

def load_payload() -> dict:
    # 1. Read from /tmp/pipeline_payload.json
    p = Path("/tmp/pipeline_payload.json")
    if p.exists():
        try:
            content = p.read_text(encoding="utf-8").strip()
            print(f"[orchestrate] Read /tmp/pipeline_payload.json ({len(content)} chars)", flush=True)
            return json.loads(content)
        except Exception as e:
            print(f"[orchestrate] Failed parsing /tmp/pipeline_payload.json: {e}", flush=True)

    # 2. Check PAYLOAD_B64 env var
    b64 = os.environ.get("PAYLOAD_B64", "")
    if b64:
        try:
            decoded = base64.b64decode(b64).decode("utf-8")
            print(f"[orchestrate] Decoded PAYLOAD_B64 ({len(decoded)} chars)", flush=True)
            return json.loads(decoded)
        except Exception as e:
            print(f"[orchestrate] Failed decoding PAYLOAD_B64: {e}", flush=True)

    # 3. Fallback to PIPELINE_PAYLOAD env var
    raw = os.environ.get("PIPELINE_PAYLOAD", "{}").strip()
    try:
        return json.loads(raw)
    except Exception:
        pass
    return {}

def main():
    payload = load_payload()
    print(f"[orchestrate] Parsed payload keys: {list(payload.keys())}", flush=True)

    job_id  = payload.get("jobId") or f"gha_hakt_{int(time.time())}"
    print(f"[orchestrate] job_id={job_id}", flush=True)

    source     = payload.get("source", {})
    src_str    = source.get("path") or source.get("inputUrl") or ""
    workdir    = Path(tempfile.mkdtemp(prefix="prometheus_"))
    local_vid  = workdir / "source.mp4"

    # Resolve source video
    found_source = False
    if src_str.startswith("http://") or src_str.startswith("https://"):
        import urllib.request
        print(f"[orchestrate] Downloading source from URL: {src_str}", flush=True)
        urllib.request.urlretrieve(src_str, local_vid)
        found_source = local_vid.exists() and local_vid.stat().st_size > 100
    elif src_str and Path(src_str).exists() and Path(src_str).is_file():
        print(f"[orchestrate] Using repo file: {src_str}", flush=True)
        shutil.copyfile(src_str, local_vid)
        found_source = True
    elif src_str and (Path("remotion-app/public/source") / Path(src_str).name).exists():
        matched = Path("remotion-app/public/source") / Path(src_str).name
        print(f"[orchestrate] Matched in remotion-app/public/source: {matched}", flush=True)
        shutil.copyfile(matched, local_vid)
        found_source = True
    elif src_str:
        key = src_str.lstrip("/")
        try:
            s3.download_file(UPLOAD_BUCKET, key, str(local_vid))
            print(f"[orchestrate] Fetched source from R2 upload bucket: {key}", flush=True)
            found_source = True
        except Exception as e:
            print(f"[orchestrate] Could not fetch {key} from R2: {e}", flush=True)

    if not found_source:
        # Fallback to sample talking head in repo
        for candidate in [
            "remotion-app/public/source/MALE-BLACK-TALKING-HEAD-PODCAST.mp4",
            "remotion-app/public/source/test_video.mp4",
        ]:
            cand_path = Path(candidate)
            if cand_path.exists():
                print(f"[orchestrate] Using fallback repo video: {candidate}", flush=True)
                shutil.copyfile(cand_path, local_vid)
                found_source = True
                break

    # Upload resolved source to processed bucket so all slice runners can download it
    source_r2_key = ""
    if found_source and local_vid.exists() and local_vid.stat().st_size > 100:
        source_r2_key = f"gha-renders/{job_id}/source.mp4"
        s3.upload_file(str(local_vid), PROCESSED_BUCKET, source_r2_key)
        print(f"[orchestrate] Uploaded source -> R2:{source_r2_key} ({local_vid.stat().st_size/1024/1024:.2f} MB)", flush=True)

    # Transcription (AssemblyAI)
    chunks = []
    aai_key  = os.environ.get("ASSEMBLYAI_API_KEY", "")
    selected = payload.get("selectedWindow", {})
    start_ms = int(selected.get("sourceStartMs", 0))
    end_ms   = int(selected.get("sourceEndMs", 30000))

    if aai_key and found_source:
        try:
            import assemblyai as aai
            aai.settings.api_key = aai_key
            trimmed = workdir / "trimmed.mp4"
            subprocess.run(["ffmpeg","-y","-loglevel","error",
                "-ss", str(start_ms/1000), "-to", str(end_ms/1000),
                "-i", str(local_vid), "-c","copy", str(trimmed)], check=True)
            print(f"[orchestrate] Transcribing {start_ms}-{end_ms}ms with AssemblyAI...", flush=True)
            t = aai.Transcriber().transcribe(str(trimmed))
            if hasattr(t,"words") and t.words:
                chunks = [{"text":w.text,"startMs":w.start,"endMs":w.end} for w in t.words]
                print(f"[orchestrate] {len(chunks)} words transcribed successfully!", flush=True)
        except Exception as e:
            print(f"[orchestrate] Transcription warning: {e}", flush=True)

    if not chunks:
        # Fallback word cues
        chunks = [
            {"text": "WELCOME", "startMs": 0, "endMs": 1500},
            {"text": "TO", "startMs": 1500, "endMs": 2500},
            {"text": "PROMETHEUS", "startMs": 2500, "endMs": 5000},
            {"text": "KINETIC", "startMs": 5000, "endMs": 7500},
            {"text": "TYPOGRAPHY", "startMs": 7500, "endMs": 10000},
        ]

    # Build props.json for Remotion
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
