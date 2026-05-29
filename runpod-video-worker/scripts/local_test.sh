#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-runpod-video-worker:local}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Building ${IMAGE_NAME}"
docker build -t "${IMAGE_NAME}" "${ROOT_DIR}"

echo "==> Running one-shot handler with test_payload.json"
echo "    Replace the placeholder input_video_url before expecting a successful media run."
docker run --rm --gpus all \
  -v "${ROOT_DIR}/test_payload.json:/payload.json:ro" \
  "${IMAGE_NAME}" \
  python -u /app/handler.py /payload.json
