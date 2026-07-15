from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REFERENCES = [
    (
        "joseph-masterclass-01",
        "JOSEPH VIDEO PROOF/HOW TO EDIT LIKE GADZHI --JOSEPH first video.mp4",
        "docs/audits/joseph-masterclass-feature-extraction-01.events.json",
    ),
    (
        "joseph-cinematic-documentary-02",
        "JOSEPH VIDEO PROOF/How_to_Edit_Cinematic_Documentary_     second video.mp4",
        "docs/audits/joseph-cinematic-documentary-feature-extraction-02.events.json",
    ),
    (
        "joseph-video-questions-03",
        "JOSEPH VIDEO PROOF/Answering_Your_Top_Video_Editing_Questions_in_15minutes     third video.mp4",
        "docs/audits/joseph-video-questions-feature-extraction-03.events.json",
    ),
    (
        "joseph-viral-reels-premiere-04",
        "JOSEPH VIDEO PROOF/YouTube_How-to-Edit-Viral-Instagram-Reels      fourth video.mp4",
        "docs/audits/joseph-viral-reels-premiere-feature-extraction-04.events.json",
    ),
    (
        "joseph-viral-cinematic-reels-05",
        "JOSEPH VIDEO PROOF/How_to_Edit_Viral_Cinematic_Reels    fifth video.mp4",
        "docs/audits/joseph-viral-cinematic-reels-feature-extraction-05.events.json",
    ),
]


@dataclass(frozen=True)
class JosephReference:
    reference_id: str
    video_path: Path
    audit_events_path: Path


def build_references(repo_root: Path = REPO_ROOT) -> list[JosephReference]:
    return [
        JosephReference(
            reference_id=reference_id,
            video_path=repo_root / video_path,
            audit_events_path=repo_root / audit_path,
        )
        for reference_id, video_path, audit_path in DEFAULT_REFERENCES
    ]


def prepare_dataset(output_dir: str | Path, *, kaggle_id: str | None = None, copy_videos: bool = True) -> dict[str, Any]:
    output_root = Path(output_dir)
    videos_dir = output_root / "videos"
    audits_dir = output_root / "audits"
    notebook_dir = output_root / "notebook"
    videos_dir.mkdir(parents=True, exist_ok=True)
    audits_dir.mkdir(parents=True, exist_ok=True)
    notebook_dir.mkdir(parents=True, exist_ok=True)

    references = []
    for reference in build_references():
        _require_file(reference.video_path)
        _require_file(reference.audit_events_path)
        audit = _read_json(reference.audit_events_path)
        video_target = videos_dir / f"{reference.reference_id}{reference.video_path.suffix.lower()}"
        audit_target = audits_dir / f"{reference.reference_id}.events.json"
        if copy_videos:
            shutil.copy2(reference.video_path, video_target)
        shutil.copy2(reference.audit_events_path, audit_target)
        references.append({
            "reference_id": reference.reference_id,
            "title": audit.get("title"),
            "status": audit.get("status"),
            "video_file": str(video_target.relative_to(output_root)),
            "audit_events_file": str(audit_target.relative_to(output_root)),
            "video_sha256": _sha256_file(reference.video_path),
            "audit_event_count": len(audit.get("events", [])),
            "candidate_feature_count": len(audit.get("candidateFeatures", [])),
        })

    extractor_source = REPO_ROOT / "packages" / "trajectory-extractor" / "kaggle_extract.py"
    shutil.copy2(extractor_source, notebook_dir / "kaggle_extract.py")

    manifest = {
        "schema_version": "joseph-kaggle-dataset-manifest-v1",
        "kaggle_dataset_id": kaggle_id or "replace-me/joseph-video-edits",
        "reference_count": len(references),
        "references": references,
        "run_instruction": "Enable GPU, install the cell dependencies, then run notebook/kaggle_extract.py and call run_batch('/kaggle/input/<dataset-slug>').",
    }
    _write_json(output_root / "joseph-kaggle-manifest.json", manifest)
    _write_json(output_root / "dataset-metadata.json", {
        "title": "Joseph Video Edits IRL Extraction Packet",
        "id": kaggle_id or "replace-me/joseph-video-edits",
        "licenses": [{"name": "unknown"}],
    })
    return manifest


def _require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"required file not found: {path}")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prepare the five-video Joseph Kaggle dataset packet.")
    parser.add_argument("--output", required=True, help="Output directory for the Kaggle dataset packet.")
    parser.add_argument("--kaggle-id", help="Kaggle dataset id, e.g. username/joseph-video-edits.")
    parser.add_argument("--manifest-only", action="store_true", help="Write manifest/audits/extractor without copying large videos.")
    args = parser.parse_args(argv)

    manifest = prepare_dataset(args.output, kaggle_id=args.kaggle_id, copy_videos=not args.manifest_only)
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
