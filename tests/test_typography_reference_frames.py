"""Validate the 13 kinetic-typography reference frames map to the mini-run pipeline.

Reference frames live in ``docs/mini_run_studio/uploaded_screenshots/`` and encode the
"This is Hitesh / spending hours on each video" short-form style. Each reference frame is
represented in the authoritative 9:16 portrait font-JSON corpus as a named style profile,
and ``generate_font_manifest`` (the mini-run pipeline typography engine) must reproduce
every reference phrase verbatim with a well-formed, per-layer hero composition.

This module is dual-mode:
  * Standalone:  ``python3 tests/test_typography_reference_frames.py``
  * Pytest:      ``python3 -m pytest tests/test_typography_reference_frames.py``
"""
from __future__ import annotations

import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _REPO_ROOT)

from mini_run_pipeline.typography import (  # noqa: E402
    generate_font_manifest,
    load_all_portrait_font_json_profiles,
)

_UPLOADED = os.path.join(_REPO_ROOT, "docs", "mini_run_studio", "uploaded_screenshots")

# The 13 reference frames, in the order they live in uploaded_screenshots.
# "spending hours on each video" appears twice (small + large cascade) -> same phrase.
REFERENCE_FRAME_FILES = [
    "Screenshot_01_090425.png",
    "Screenshot_02_090446.png",
    "Screenshot_03_090452.png",
    "Screenshot_04_090459.png",
    "Screenshot_05_090516.png",
    "Screenshot_06_173946.png",
    "Screenshot_07_174002.png",
    "Screenshot_08_174018.png",
    "Screenshot_10_021337.png",
    "Screenshot_11_021343.png",
    "Screenshot_12_021354.png",
    "Screenshot_14_021413.png",
    "_B00E0CA3-D821-46BA-B0F3-9283B53992FF__vfhn.png",
]

REFERENCE_PHRASES = [
    "Not CONVINCED yet",
    "WOULD YOU HIRE",
    "This is Hitesh",
    "biggest mistake",
    "Shot it Blurry",
    "spending hours on each video",
    "most creators and video editors",
    "spending hours on each video",
    "to sleep tonight.",
    "my mom said to me,",
    "my mom",
    "less.",
    "YOU'LL wake up and someone ELSE.",
]

REFERENCE_PROFILE_NAMES = [
    "Not_Convinced_Yet_Full_Frame_Red_Grotesque",
    "This_Is_Hitesh_Editorial_Script_Serif_Stack",
    "Biggest_Mistake_Full_Bleed_Red_Frame_Bleed",
    "Shot_It_Blurry_Gold_Italic_Serif_Dark_Background",
    "Spending_Hours_On_Each_Video_Script_Editorial",
    "Most_Creators_And_Video_Editors_Mixed_Script_Sans",
    "To_Sleep_Tonight_Two_Tone_Overlap_Treatment",
    "My_Mom_Said_To_Me_Wall_Man_Z_Plane_Treatment",
    "My_Mom_Wall_Man_Single_Line_Z_Plane",
    "Less_See_Through_Video_Letterform_Treatment",
    "Youll_Wake_Up_And_Someone_Else_Hierarchy_Stack",
]

# Tall-font monolithic stack profiles for "WOULD YOU HIRE" / impact single-words
# (carry metadata.is_tall_font === True per governance policy 10.8).
TALL_FONT_PROFILE_NAMES = [
    "Harmony_UltraTall_Didone_Serif",
    "Community_UltraCondensed_Grotesk",
    "Terrance_Extreme_Hairline_Tall",
    "Exarch_Heavy_Industrial_Block",
    "Humane_Spiked_Stem_Brutalist",
    "Growth_UltraCondensed_Pill_Grotesk",
    "Skywall_Futuristic_Metallic_Display",
]

REFERENCE_TOKENS = [
    "Convinced",
    "Hitesh",
    "Biggest",
    "Blurry",
    "Spending_Hours",
    "Most_Creators",
    "To_Sleep",
    "My_Mom",
    "Less",
    "Youll",
]


def _build_chunks(phrases):
    return [
        {
            "text": phrase,
            "topLabel": f"ref-{i}",
            "startMs": int(i * 2000),
            "endMs": int((i + 1) * 2000),
            "outputStartMs": int(i * 2000),
            "outputEndMs": int((i + 1) * 2000),
            "isHero": True,
        }
        for i, phrase in enumerate(phrases)
    ]


def test_reference_frame_screenshots_present():
    missing = [f for f in REFERENCE_FRAME_FILES if not os.path.exists(os.path.join(_UPLOADED, f))]
    assert not missing, f"Reference frame screenshots missing in {_UPLOADED}: {missing}"


def test_reference_profiles_in_portrait_corpus():
    loaded = {p["profile_name"] for p in load_all_portrait_font_json_profiles()}
    absent = [n for n in REFERENCE_PROFILE_NAMES if n not in loaded]
    assert not absent, f"Reference style profiles missing from portrait corpus: {absent}"


def test_reference_profiles_are_portrait_and_layered():
    profiles = {p["profile_name"]: p for p in load_all_portrait_font_json_profiles()}
    for name in REFERENCE_PROFILE_NAMES:
        prof = profiles[name]
        assert "landscape" not in name.lower(), f"{name} must be a 9:16 portrait profile"
        layers = prof.get("typography_layers", [])
        assert layers, f"{name} has no typography layers"
        for layer in layers:
            assert layer.get("matched_font_candidates"), (
                f"{name}:{layer.get('layer_name')} has no font candidates"
            )
            assert layer.get("font_style"), f"{name}:{layer.get('layer_name')} has no font_style"


def test_tall_font_profiles_flagged_for_impact_stacks():
    profiles = {p["profile_name"]: p for p in load_all_portrait_font_json_profiles()}
    for name in TALL_FONT_PROFILE_NAMES:
        prof = profiles.get(name)
        assert prof is not None, f"Tall-font profile missing: {name}"
        assert prof["metadata"].get("is_tall_font") is True, (
            f"{name} must carry metadata.is_tall_font=True"
        )


def test_manifest_reproduces_all_reference_phrases():
    manifest = generate_font_manifest(_build_chunks(REFERENCE_PHRASES))
    assert manifest["chunkCount"] == len(REFERENCE_PHRASES), (
        f"expected {len(REFERENCE_PHRASES)} chunk(s), got {manifest['chunkCount']}"
    )
    rendered = [c["text"] for c in manifest["chunks"]]
    assert rendered == REFERENCE_PHRASES, f"phrase round-trip mismatch: {rendered}"
    assert manifest["canvas"]["aspectRatio"] == "9:16", "composition must be 9:16"


def test_every_reference_chunk_has_a_hero_layer():
    manifest = generate_font_manifest(_build_chunks(REFERENCE_PHRASES))
    for c in manifest["chunks"]:
        layers = c.get("layers", [])
        assert layers, f"chunk {c['text']!r} rendered no layers"
        hero = [l for l in layers if l.get("isHero")]
        assert len(hero) == 1, (
            f"chunk {c['text']!r} must have exactly one hero layer (got {len(hero)})"
        )
        for layer in layers:
            assert layer.get("fontFamily"), f"chunk {c['text']!r} layer missing fontFamily"
            assert layer.get("text"), f"chunk {c['text']!r} layer missing resolved text"
            assert layer["fontSizePx"] > 0, f"chunk {c['text']!r} layer has non-positive font size"


def test_manifest_is_deterministic_for_reference_set():
    design = {"seed": "reference-frame-determinism"}
    a = generate_font_manifest(_build_chunks(REFERENCE_PHRASES), design)
    b = generate_font_manifest(_build_chunks(REFERENCE_PHRASES), design)
    assert a == b, "same reference set and explicit seed must yield an identical manifest"


def test_reference_token_coverage_in_corpus():
    names = {p["profile_name"] for p in load_all_portrait_font_json_profiles()}
    missing = [tok for tok in REFERENCE_TOKENS if not any(tok in n for n in names)]
    assert not missing, f"Reference-frame tokens not represented in the corpus: {missing}"


def main():
    failures = []
    checks = [
        test_reference_frame_screenshots_present,
        test_reference_profiles_in_portrait_corpus,
        test_reference_profiles_are_portrait_and_layered,
        test_tall_font_profiles_flagged_for_impact_stacks,
        test_manifest_reproduces_all_reference_phrases,
        test_every_reference_chunk_has_a_hero_layer,
        test_manifest_is_deterministic_for_reference_set,
        test_reference_token_coverage_in_corpus,
    ]
    for check in checks:
        label = check.__name__
        try:
            check()
            print(f"  [PASS] {label}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [FAIL] {label}: {exc}")
            failures.append(label)
    print()
    if failures:
        print(f"FAILED: {len(failures)} check(s): {failures}")
        sys.exit(1)
    print(
        f"ALL REFERENCE-FRAME CHECKS PASSED "
        f"({len(REFERENCE_FRAME_FILES)} frames / {len(REFERENCE_PROFILE_NAMES)} profiles / "
        f"{len(REFERENCE_PHRASES)} phrases)"
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
