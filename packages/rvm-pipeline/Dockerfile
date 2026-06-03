FROM pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    RVM_OUTPUT_ROOT=/tmp/prometheus-rvm \
    RVM_MODEL_DIR=/opt/models \
    RVM_REQUIRE_CUDA=1 \
    RVM_ALLOW_TORCHHUB_FALLBACK=0

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

COPY rvm_pipeline rvm_pipeline

EXPOSE 8080

CMD ["uvicorn", "rvm_pipeline.main:app", "--host", "0.0.0.0", "--port", "8080"]
