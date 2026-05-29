# RunPod Video Matting Worker

Minimal RunPod Serverless GPU worker for short video matting jobs. The current handler is inference-only and includes a placeholder RVM hook that emits correctly structured alpha and RGBA artifacts. Swap `load_rvm_model()` and `run_rvm_inference_hook()` with real RVM inference when weights are available.

## Build

```bash
docker build -t runpod-video-worker:local .
```

Optional baked-in weights:

```bash
docker build \
  --build-arg RVM_WEIGHTS_URL="https://your-storage.example/rvm.pth" \
  --build-arg RVM_WEIGHTS_SHA256="expected_sha256_hex" \
  -t runpod-video-worker:local .
```

## Docker Login, Tag, Push

```bash
docker login
docker tag runpod-video-worker:local your-dockerhub-user/runpod-video-worker:0.1.0
docker push your-dockerhub-user/runpod-video-worker:0.1.0
```

## RunPod Deployment

Create a Serverless endpoint and use the pushed image. Use a GPU worker class with CUDA 12-compatible NVIDIA drivers. Set environment variables as needed:

```text
MODEL_DIR=/opt/models
OUTPUT_DIR=/tmp/runpod-video-worker/output
INPUT_DIR=/tmp/runpod-video-worker/input
MAX_CLIP_SECONDS=10
MAX_INPUT_BYTES=268435456
```

For production RVM inference, either bake weights into the image with build args or mount/download them into `MODEL_DIR`. Baking weights increases image size but reduces cold start variance.

## Input

```json
{
  "input_video_url": "string",
  "metadata": {},
  "job_id": "string",
  "timestamps": {
    "start": 0,
    "end": 10
  }
}
```

`metadata` is returned as the original object and is not mutated, enriched, normalized, or copied into artifact manifests.

## Output

```json
{
  "success": true,
  "metadata": {},
  "job_id": "matting-job-0003",
  "artifact_paths": ["/tmp/runpod-video-worker/output/matting-job-0003_matting_artifacts.tar.gz"],
  "timing": {}
}
```

The archive contains alpha PNG frames, RGBA PNG frames, and an artifact manifest. Extracted source frames stay as intermediate worker files and are not returned.

## Local Testing

```bash
chmod +x scripts/local_test.sh
./scripts/local_test.sh
```

The sample payload uses a placeholder URL. Replace `input_video_url` with a reachable HTTPS URL or a mounted `file://` path before running.

## GPU Requirements

The Dockerfile uses `pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime`. Use RunPod workers with NVIDIA drivers compatible with CUDA 12.4. The placeholder alpha path does not require CUDA, but real RVM weights should run on GPU.

## Cold Start Behavior

Dependencies are installed before application code, and optional weights are downloaded during build. This makes code-only changes cache-efficient and avoids downloading model weights on every serverless cold start. The tradeoff is image size: baked weights improve startup predictability but increase pull time.

## Debugging

Set `FFMPEG_LOGLEVEL=info` for more media diagnostics. Validation errors usually mean an invalid URL, non-object metadata, or timestamps longer than `MAX_CLIP_SECONDS`. If real weights are present and CUDA is unavailable, the handler fails fast rather than silently falling back to CPU.
