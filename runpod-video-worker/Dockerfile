# PyTorch runtime image keeps CUDA/cuDNN aligned with torch and avoids compiling GPU
# libraries during build. This assumes RunPod hosts provide NVIDIA drivers compatible
# with CUDA 12.4; change the tag if your endpoint standardizes on another CUDA line.
FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

# Runtime defaults are explicit so cold starts do not depend on shell profile state.
# /opt/models is outside /app so code changes do not invalidate model-cache layers.
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MODEL_DIR=/opt/models \
    INPUT_DIR=/tmp/runpod-video-worker/input \
    OUTPUT_DIR=/tmp/runpod-video-worker/output \
    MAX_CLIP_SECONDS=10 \
    FFMPEG_LOGLEVEL=error

WORKDIR /app

# ffmpeg is the only OS-level media dependency. ca-certificates is needed for HTTPS
# downloads. Apt cache removal keeps the runtime image smaller for faster cold pulls.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies before copying application code so Docker can reuse
# this layer when handler.py changes. The base image already includes CUDA torch;
# requirements keeps torch explicit while avoiding a separate CUDA wheel install.
COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

# Optional build-time model fetch. Leaving RVM_WEIGHTS_URL empty produces a valid
# placeholder worker; setting it bakes weights into the image to reduce cold start.
COPY download_weights.py .
ARG RVM_WEIGHTS_URL=""
ARG RVM_WEIGHTS_SHA256=""
ENV RVM_WEIGHTS_URL=${RVM_WEIGHTS_URL} \
    RVM_WEIGHTS_SHA256=${RVM_WEIGHTS_SHA256}
RUN python download_weights.py

# Copy only the inference handler after dependencies and weights for cache efficiency.
COPY handler.py .

# RunPod invokes the process as a serverless worker. Passing a JSON path instead starts
# a local one-shot invocation, which scripts/local_test.sh uses inside the same image.
CMD ["python", "-u", "handler.py"]
