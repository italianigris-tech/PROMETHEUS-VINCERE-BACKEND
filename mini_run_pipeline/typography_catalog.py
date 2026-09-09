"""Unified Typography Catalog — mini_run_pipeline authoritative registry.

Aggregates every portrait (9:16) font JSON profile and its paired placement
image into a single hydrated registry. The editorial system (typography.py /
generate_font_manifest) delegates ALL profile loading to this module.

Catalog scope (mini-run portrait only):
  * font JSON + placement pairs   -> Yuan Prometheus Screenshots/font JSON/
                                     Yuan Prometheus Screenshots/font pairing and placement/
  * Cranial font JSON + placement -> Yuan Prometheus Screenshots/cranial font JSON/
                                     Yuan Prometheus Screenshots/cranial font placement/

Landscape profiles are STRICTLY excluded -- they belong to the separate
JosephLandscapeEdit pipeline.

Public API
----------
build_catalog(include_landscape=False) -> PortraitCatalog
    Load and hydrate the full catalog from disk. Call once per process or
    per-request -- the result is a dataclass you can cache.

get_all_portrait_profiles() -> List[ProfileRecord]
    Convenience wrapper -- returns the fully hydrated portrait-only list
    as legacy dicts (same shape as the old typography.py loader output).

get_all_landscape_profiles() -> List[ProfileRecord]
    Full corpus including landscape (use for JosephLandscapeEdit only).

get_catalog_summary(catalog) -> Dict[str, Any]
    Compact audit dict: counts, hydration rates, listing of missing pairs.
"""

from __future__ import annotations

import json
import datetime
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Source directories (mirrors the constants in typography.py exactly so both
# files always point to the same data on disk).
# ---------------------------------------------------------------------------
_REPO_ROOT = Path(__file__).resolve().parent.parent

FONT_JSON_DIR       = _REPO_ROOT / "Yuan Prometheus Screenshots" / "font JSON"
FONT_PAIRS_DIR      = _REPO_ROOT / "Yuan Prometheus Screenshots" / "font pairing and placement"
CRANIAL_JSON_DIR    = _REPO_ROOT / "Yuan Prometheus Screenshots" / "cranial font JSON"
CRANIAL_PAIRS_DIR   = _REPO_ROOT / "Yuan Prometheus Screenshots" / "cranial font placement"

# Production override paths (Lambda / Docker / /opt mount).
_OPT_ROOT           = Path("/opt/prometheus/Yuan Prometheus Screenshots")
OPT_FONT_JSON_DIR   = _OPT_ROOT / "font JSON"
OPT_FONT_PAIRS_DIR  = _OPT_ROOT / "font pairing and placement"
OPT_CRANIAL_JSON    = _OPT_ROOT / "cranial font JSON"
OPT_CRANIAL_PAIRS   = _OPT_ROOT / "cranial font placement"


def _resolve_dir(primary: Path, fallback: Path) -> Path:
    return primary if primary.exists() else fallback


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class ProfileRecord:
    """A fully hydrated font profile ready for editorial selection.

    Every field maps 1-to-1 to the dict keys that typography.py reads so
    zero translation is needed when passing to generate_font_manifest.
    """
    # Core identity
    id: str
    filename: str
    profile_name: str
    source: str                        # "portrait" | "cranial" | "landscape"
    is_landscape: bool
    is_cranial_profile: bool

    # Paired placement image -- HYDRATED: path resolved at load time
    paired_image: Optional[str]        # basename of the .png, or None
    paired_image_path: Optional[Path]  # absolute path, or None
    paired_image_exists: bool

    # Font design payload
    typography_layers: List[Dict[str, Any]]
    total_words: int
    layout_rules: Dict[str, Any]
    metadata: Dict[str, Any]
    cranial_spec: Dict[str, Any]       # populated only for cranial profiles

    # Full raw JSON (kept for backward-compat callers that read `raw`)
    raw: Dict[str, Any]

    # ---------------------------------------------------------------------------
    # Convenience accessors
    # ---------------------------------------------------------------------------

    @property
    def overall_mood(self) -> str:
        return str(self.metadata.get("overall_mood", ""))

    @property
    def treatment_system(self) -> str:
        return str(self.metadata.get("treatment_system", ""))

    @property
    def all_font_candidates(self) -> List[str]:
        out: List[str] = []
        for layer in self.typography_layers:
            out.extend(layer.get("matched_font_candidates", []))
        return out

    @property
    def all_font_classifications(self) -> List[str]:
        return [str(l.get("font_classification", "")) for l in self.typography_layers]

    def as_legacy_dict(self) -> Dict[str, Any]:
        """Return the profile as a plain dict matching the old typography.py shape.

        Lets typography.py pass catalog profiles wherever it previously used the
        raw dicts from load_all_font_json_profiles() with zero adaptation.
        """
        return {
            "id":                   self.id,
            "filename":             self.filename,
            "profile_name":         self.profile_name,
            "paired_image":         self.paired_image,
            "paired_image_exists":  self.paired_image_exists,
            "metadata":             self.metadata,
            "layout_rules":         self.layout_rules,
            "typography_layers":    self.typography_layers,
            "total_words":          self.total_words,
            "is_landscape":         self.is_landscape,
            "is_cranial_profile":   self.is_cranial_profile,
            "cranial_spec":         self.cranial_spec,
            "raw":                  self.raw,
        }


@dataclass
class PortraitCatalog:
    """Hydrated catalog of all portrait (non-landscape) font profiles."""
    portrait_profiles: List[ProfileRecord]       # excludes landscape
    landscape_profiles: List[ProfileRecord]      # landscape-only
    cranial_profiles: List[ProfileRecord]        # cranial (subset of portrait_profiles)
    built_at: str                                # ISO-8601 UTC timestamp

    # ---------------------------------------------------------------------------
    # Convenience queries
    # ---------------------------------------------------------------------------

    def portrait_only(self) -> List[ProfileRecord]:
        """All 9:16 portrait profiles (includes cranial)."""
        return self.portrait_profiles

    def cranial_only(self) -> List[ProfileRecord]:
        """Behind-subject cranial profiles only."""
        return self.cranial_profiles

    def foreground_portrait(self) -> List[ProfileRecord]:
        """Portrait profiles that are NOT cranial (standard foreground)."""
        return [p for p in self.portrait_profiles if not p.is_cranial_profile]

    def all_profiles(self) -> List[ProfileRecord]:
        """Full corpus: portrait + landscape."""
        return self.portrait_profiles + self.landscape_profiles

    def get_by_id(self, profile_id: str) -> Optional[ProfileRecord]:
        for p in self.all_profiles():
            if p.id == profile_id:
                return p
        return None

    def hydration_rate(self) -> float:
        """Fraction of portrait profiles with a confirmed paired image."""
        total = len(self.portrait_profiles)
        if total == 0:
            return 0.0
        paired = sum(1 for p in self.portrait_profiles if p.paired_image_exists)
        return round(paired / total, 4)


# ---------------------------------------------------------------------------
# Internal loaders
# ---------------------------------------------------------------------------

def _load_standard_profiles(
    json_dir: Path,
    pairs_dir: Path,
    include_landscape: bool,
) -> List[ProfileRecord]:
    """Load font JSON files from json_dir, cross-reference pairing images."""
    records: List[ProfileRecord] = []
    if not json_dir.exists():
        return records

    for file_path in sorted(json_dir.glob("*.json")):
        is_landscape_file = "landscape" in file_path.name.lower()

        try:
            data: Dict[str, Any] = json.loads(file_path.read_text(encoding="utf-8"))
        except Exception:
            continue

        pname = data.get("profile_name", file_path.stem)

        # Skip landscape when include_landscape=False
        if not include_landscape and (
            is_landscape_file or "landscape" in str(pname).lower()
        ):
            continue

        # Exclude wall_man_z_plane profiles from mini-run portrait pool.
        # These profiles embed fixed sample text incompatible with transcript-
        # driven word rendering.
        meta = data.get("metadata", {})
        if not include_landscape and meta.get("treatment_system") == "wall_man_z_plane":
            continue

        img_name = file_path.stem + ".png"
        img_path = pairs_dir / img_name
        img_exists = img_path.exists()

        layers = data.get("typography_layers", [])
        total_words = meta.get("total_word_count", len(layers))

        records.append(ProfileRecord(
            id=file_path.stem,
            filename=file_path.name,
            profile_name=pname,
            source="landscape" if is_landscape_file else "portrait",
            is_landscape=is_landscape_file or "landscape" in str(pname).lower(),
            is_cranial_profile=False,
            paired_image=img_name if img_exists else None,
            paired_image_path=img_path if img_exists else None,
            paired_image_exists=img_exists,
            typography_layers=layers,
            total_words=total_words,
            layout_rules=data.get("layout_rules", {}),
            metadata=meta,
            cranial_spec={},
            raw=data,
        ))

    return records


def _load_cranial_profiles(
    json_dir: Path,
    pairs_dir: Path,
) -> List[ProfileRecord]:
    """Load cranial font JSON profiles from their dedicated directory."""
    records: List[ProfileRecord] = []
    if not json_dir.exists():
        return records

    for file_path in sorted(json_dir.glob("*.json")):
        try:
            data: Dict[str, Any] = json.loads(file_path.read_text(encoding="utf-8"))
        except Exception:
            continue

        img_name = file_path.stem + ".png"
        img_path = pairs_dir / img_name
        img_exists = img_path.exists()

        layers = data.get("typography_layers", [])
        meta = data.get("metadata", {})
        total_words = meta.get("total_word_count", len(layers))

        records.append(ProfileRecord(
            id=file_path.stem,
            filename=file_path.name,
            profile_name=data.get("profile_name", file_path.stem),
            source="cranial",
            is_landscape=False,
            is_cranial_profile=True,
            paired_image=img_name if img_exists else None,
            paired_image_path=img_path if img_exists else None,
            paired_image_exists=img_exists,
            typography_layers=layers,
            total_words=total_words,
            layout_rules=data.get("layout_rules", {}),
            metadata=meta,
            cranial_spec=data.get("cranial_spec", {}),
            raw=data,
        ))

    return records


# ---------------------------------------------------------------------------
# Public catalog builder
# ---------------------------------------------------------------------------

def build_catalog(include_landscape: bool = False) -> PortraitCatalog:
    """Build and return the fully hydrated PortraitCatalog.

    Args:
        include_landscape: When False (default / mini-run) landscape profiles
            are excluded. When True (JosephLandscapeEdit admin access) the
            full corpus is loaded.

    Returns:
        A PortraitCatalog with all profiles hydrated and paired.
    """
    json_dir   = _resolve_dir(FONT_JSON_DIR,    OPT_FONT_JSON_DIR)
    pairs_dir  = _resolve_dir(FONT_PAIRS_DIR,   OPT_FONT_PAIRS_DIR)
    cr_json    = _resolve_dir(CRANIAL_JSON_DIR,  OPT_CRANIAL_JSON)
    cr_pairs   = _resolve_dir(CRANIAL_PAIRS_DIR, OPT_CRANIAL_PAIRS)

    # Load the full standard directory (portrait + landscape mixed in)
    all_standard = _load_standard_profiles(json_dir, pairs_dir, include_landscape=True)

    landscape_profiles = [p for p in all_standard if p.is_landscape]
    portrait_standard  = [p for p in all_standard if not p.is_landscape]

    # Cranial profiles are always portrait-only
    cranial_profiles = _load_cranial_profiles(cr_json, cr_pairs)

    # Deduplicate by ID (giving precedence to dedicated cranial profiles)
    seen_ids = set()
    portrait_profiles = []
    # Add dedicated cranial profiles first so their cranial_spec is preserved
    for p in cranial_profiles:
        seen_ids.add(p.id)
        portrait_profiles.append(p)
    # Then append non-duplicate standard profiles
    for p in portrait_standard:
        if p.id not in seen_ids:
            seen_ids.add(p.id)
            portrait_profiles.append(p)

    return PortraitCatalog(
        portrait_profiles=portrait_profiles,
        landscape_profiles=landscape_profiles,
        cranial_profiles=cranial_profiles,
        built_at=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


# ---------------------------------------------------------------------------
# Convenience wrappers (drop-in replacements for typography.py loaders)
# ---------------------------------------------------------------------------

def get_all_portrait_profiles() -> List[Dict[str, Any]]:
    """Return all portrait (9:16) profiles as legacy dicts.

    Drop-in replacement for typography.py's load_all_portrait_font_json_profiles().
    """
    catalog = build_catalog(include_landscape=False)
    return [p.as_legacy_dict() for p in catalog.portrait_profiles]


def get_all_landscape_profiles() -> List[Dict[str, Any]]:
    """Return the full corpus (portrait + landscape) as legacy dicts.

    For use by JosephLandscapeEdit / admin-access callers only.
    """
    catalog = build_catalog(include_landscape=True)
    return [p.as_legacy_dict() for p in catalog.all_profiles()]


def get_all_cranial_profiles() -> List[Dict[str, Any]]:
    """Return cranial profiles only as legacy dicts.

    Drop-in replacement for typography.py's load_all_cranial_font_json_profiles().
    """
    catalog = build_catalog(include_landscape=False)
    return [p.as_legacy_dict() for p in catalog.cranial_profiles]


def get_catalog_summary(catalog: Optional[PortraitCatalog] = None) -> Dict[str, Any]:
    """Return a compact audit dict for logging / health checks.

    Resolves the catalog from disk if not provided.
    """
    if catalog is None:
        catalog = build_catalog(include_landscape=False)

    portrait_paired   = [p for p in catalog.portrait_profiles if p.paired_image_exists]
    portrait_unpaired = [p for p in catalog.portrait_profiles if not p.paired_image_exists]
    cranial_paired    = [p for p in catalog.cranial_profiles  if p.paired_image_exists]
    cranial_unpaired  = [p for p in catalog.cranial_profiles  if not p.paired_image_exists]

    return {
        "built_at": catalog.built_at,
        "portrait": {
            "total":          len(catalog.portrait_profiles),
            "paired":         len(portrait_paired),
            "unpaired":       len(portrait_unpaired),
            "hydration_rate": catalog.hydration_rate(),
            "unpaired_ids":   [p.id for p in portrait_unpaired],
            "paired_ids":     [p.id for p in portrait_paired],
        },
        "cranial": {
            "total":          len(catalog.cranial_profiles),
            "paired":         len(cranial_paired),
            "unpaired":       len(cranial_unpaired),
            "unpaired_ids":   [p.id for p in cranial_unpaired],
        },
        "landscape": {
            "total":          len(catalog.landscape_profiles),
        },
        "dirs": {
            "font_json":      str(_resolve_dir(FONT_JSON_DIR,    OPT_FONT_JSON_DIR)),
            "font_pairs":     str(_resolve_dir(FONT_PAIRS_DIR,   OPT_FONT_PAIRS_DIR)),
            "cranial_json":   str(_resolve_dir(CRANIAL_JSON_DIR, OPT_CRANIAL_JSON)),
            "cranial_pairs":  str(_resolve_dir(CRANIAL_PAIRS_DIR,OPT_CRANIAL_PAIRS)),
        },
    }
