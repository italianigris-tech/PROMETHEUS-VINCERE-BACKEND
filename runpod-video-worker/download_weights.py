import hashlib
import os
import urllib.request
from pathlib import Path


MODEL_DIR = Path(os.getenv("MODEL_DIR", "/opt/models"))
DEFAULT_WEIGHTS_URL = "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_resnet50.pth"
RAW_WEIGHTS_URL = os.getenv("RVM_WEIGHTS_URL", None)
if RAW_WEIGHTS_URL is None:
    WEIGHTS_URL = DEFAULT_WEIGHTS_URL
else:
    WEIGHTS_URL = RAW_WEIGHTS_URL.strip()
WEIGHTS_NAME = os.getenv("RVM_WEIGHTS_NAME", "rvm_resnet50.pth").strip() or "rvm_resnet50.pth"
EXPECTED_SHA256 = os.getenv("RVM_WEIGHTS_SHA256", "").strip()
RVM_TORCHHUB_REPO = os.getenv("RVM_TORCHHUB_REPO", "PeterL1n/RobustVideoMatting")
RVM_VARIANT = os.getenv("RVM_VARIANT", "resnet50")
PRELOAD_TORCHHUB = os.getenv("RVM_PRELOAD_TORCHHUB", "1").strip().lower() in {"1", "true", "yes"}


def checksum_matches(path: Path, expected_sha256: str) -> bool:
    """Validate a downloaded checkpoint when a SHA-256 digest is configured."""

    if not expected_sha256:
        return True

    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().lower() == expected_sha256.lower()


def download_if_missing() -> Path:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    target = MODEL_DIR / WEIGHTS_NAME
    skip_download = WEIGHTS_URL == "" or WEIGHTS_URL.lower() in {"none", "skip"}

    if target.exists() and checksum_matches(target, EXPECTED_SHA256):
        print(f"weights already present: {target}")
        preload_torchhub_model_definition()
        return target

    if target.exists() and skip_download:
        preload_torchhub_model_definition()
        raise RuntimeError(f"existing weights failed checksum validation: {target}")

    if skip_download:
        print("RVM weights download skipped by RVM_WEIGHTS_URL")
        preload_torchhub_model_definition()
        return target

    partial = target.with_suffix(target.suffix + ".part")
    if partial.exists():
        partial.unlink()

    print(f"downloading weights to {target}")
    request = urllib.request.Request(WEIGHTS_URL, headers={"User-Agent": "runpod-video-worker/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        with partial.open("wb") as output:
            for chunk in iter(lambda: response.read(1024 * 1024), b""):
                if chunk:
                    output.write(chunk)

    if not checksum_matches(partial, EXPECTED_SHA256):
        partial.unlink(missing_ok=True)
        raise RuntimeError("downloaded weights failed checksum validation")

    partial.replace(target)
    print(f"weights ready: {target}")
    preload_torchhub_model_definition()
    return target


def preload_torchhub_model_definition() -> None:
    """Cache the official RVM model code during image build for network-free runtime."""

    if not PRELOAD_TORCHHUB:
        return

    try:
        import torch

        try:
            torch.hub.load(RVM_TORCHHUB_REPO, RVM_VARIANT, pretrained=False, progress=False, trust_repo=True)
        except TypeError:
            torch.hub.load(RVM_TORCHHUB_REPO, RVM_VARIANT, pretrained=False, progress=False)
        print(f"torchhub model definition cached: {RVM_TORCHHUB_REPO}/{RVM_VARIANT}")
    except Exception as exc:
        raise RuntimeError(f"failed to cache RVM TorchHub model definition: {exc}") from exc


if __name__ == "__main__":
    download_if_missing()
