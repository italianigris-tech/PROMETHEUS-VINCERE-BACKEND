from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from trajectory_extractor.schema import Trajectory  # noqa: E402

ARTIFACT_CONTRACT_VERSION = "joseph-evidence-artifacts-v1"
LEGACY_ARTIFACT_CONTRACT_VERSION = "joseph-kaggle-artifacts-v1"
ACCEPTED_ARTIFACT_CONTRACT_VERSIONS = {
    ARTIFACT_CONTRACT_VERSION,
    LEGACY_ARTIFACT_CONTRACT_VERSION,
}
REQUIRED_ARTIFACT_KEYS = {
    "trajectory",
    "audio_artifact",
    "text_evidence",
    "frame_evidence",
    "motion_cut_evidence",
}


def validate_artifact_index(index_path: str | Path, *, allow_failures: bool = False) -> dict[str, Any]:
    index_path = Path(index_path)
    index = _read_json(index_path)
    root = index_path.parent
    errors: list[str] = []
    warnings: list[str] = []

    if index.get("schema_version") not in ACCEPTED_ARTIFACT_CONTRACT_VERSIONS:
        errors.append(
            "index.schema_version must be one of "
            f"{', '.join(sorted(ACCEPTED_ARTIFACT_CONTRACT_VERSIONS))}"
        )
    feature_version = _required_string(index, "feature_version", errors, "index")
    extractor_version = _required_string(index, "extractor_version", errors, "index")
    videos = index.get("videos")
    if not isinstance(videos, list) or not videos:
        errors.append("index.videos must be a non-empty list")
        videos = []

    failures = index.get("failures", [])
    if failures and not allow_failures:
        errors.append("index.failures must be empty before training use")

    for video in videos:
        video_id = _required_string(video, "video_id", errors, "video")
        source_hash = _required_string(video, "source_hash", errors, f"video:{video_id}")
        if video.get("feature_version") != feature_version:
            errors.append(f"video:{video_id}.feature_version must match index.feature_version")
        if video.get("extractor_version") != extractor_version:
            errors.append(f"video:{video_id}.extractor_version must match index.extractor_version")

        artifacts = video.get("artifacts")
        if not isinstance(artifacts, dict):
            errors.append(f"video:{video_id}.artifacts must be an object")
            continue
        missing = sorted(REQUIRED_ARTIFACT_KEYS.difference(artifacts))
        if missing:
            errors.append(f"video:{video_id}.artifacts missing {', '.join(missing)}")

        trajectory = _load_artifact(root, artifacts, "trajectory", errors, video_id)
        audio = _load_artifact(root, artifacts, "audio_artifact", errors, video_id)
        text = _load_artifact(root, artifacts, "text_evidence", errors, video_id)
        frame = _load_artifact(root, artifacts, "frame_evidence", errors, video_id)
        motion = _load_artifact(root, artifacts, "motion_cut_evidence", errors, video_id)

        if trajectory is not None:
            try:
                parsed = Trajectory.model_validate(trajectory)
                if parsed.metadata.source_hash != source_hash:
                    errors.append(f"video:{video_id}.trajectory source_hash mismatch")
                if parsed.metadata.featureVersion != feature_version:
                    errors.append(f"video:{video_id}.trajectory featureVersion mismatch")
                if parsed.metadata.edited_video_id != video_id:
                    warnings.append(f"video:{video_id}.trajectory edited_video_id differs from artifact video_id")
            except Exception as exc:
                errors.append(f"video:{video_id}.trajectory invalid: {type(exc).__name__}: {exc}")

        if audio is not None:
            if audio.get("source_hash") != source_hash:
                errors.append(f"video:{video_id}.audio_artifact source_hash mismatch")
            if audio.get("schema_version") != "audio-artifact-v1":
                errors.append(f"video:{video_id}.audio_artifact schema_version mismatch")
            if audio.get("is_fallback"):
                warnings.append(f"video:{video_id}.audio_artifact is fallback; audio features are not training-ready")

        for label, artifact in (("text_evidence", text), ("frame_evidence", frame), ("motion_cut_evidence", motion)):
            if artifact is None:
                continue
            if artifact.get("video_id") != video_id:
                errors.append(f"video:{video_id}.{label} video_id mismatch")

    return {
        "schema_version": "evidence-artifact-validation-v1",
        "index_path": str(index_path),
        "passed": len(errors) == 0,
        "video_count": len(videos),
        "failure_count": len(failures),
        "errors": errors,
        "warnings": warnings,
    }


def _required_string(obj: dict[str, Any], key: str, errors: list[str], scope: str) -> str:
    value = obj.get(key)
    if not isinstance(value, str) or not value:
        errors.append(f"{scope}.{key} must be a non-empty string")
        return ""
    return value


def _load_artifact(root: Path, artifacts: dict[str, Any], key: str, errors: list[str], video_id: str) -> dict[str, Any] | None:
    rel = artifacts.get(key)
    if not isinstance(rel, str) or not rel:
        return None
    path = root / rel
    if not path.exists():
        errors.append(f"video:{video_id}.{key} missing at {path}")
        return None
    try:
        return _read_json(path)
    except Exception as exc:
        errors.append(f"video:{video_id}.{key} unreadable: {type(exc).__name__}: {exc}")
        return None


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate Joseph evidence artifact contract output before IRL training.")
    parser.add_argument("--index", required=True, help="Path to artifact-index.json returned by local/API/GPU extraction.")
    parser.add_argument("--report", help="Optional path to write the validation report JSON.")
    parser.add_argument("--allow-failures", action="store_true", help="Allow index.failures for diagnostic runs only.")
    args = parser.parse_args(argv)

    report = validate_artifact_index(args.index, allow_failures=args.allow_failures)
    text = json.dumps(report, indent=2, sort_keys=True)
    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
