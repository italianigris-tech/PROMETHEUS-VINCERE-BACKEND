"""Validate typography variation routing for mini-run pipeline.

Exercises generate_font_manifest with representative chunk sets and asserts:
  - Explicit seeds are deterministic while dynamic runs refresh their selection
  - No consecutive profile-ID or preset repetition
  - Usage-balancing produces a flat distribution (no single profile dominating)
  - The 4 new hero fonts (Berylium, Echelon, Foglihten-068, Goudy Bookletter)
    are reachable through upgrade_font_candidate
  - Single-word chunks remain intact
"""
import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _REPO_ROOT)

from mini_run_pipeline.typography import (
    generate_font_manifest,
    upgrade_font_candidate,
    split_single_word_syllables,
    HERO_UPGRADE_FONTS,
    COMPANION_UPGRADE_FONTS,
    ANIMA_RUNTIME_TREATMENTS,
)

NEW_HERO_FONTS = {"Berylium", "Echelon", "Foglihten-068", "Goudy Bookletter"}

# Representative chunks mirroring the render.py fallback transcript
FALLBACK_TEXTS = [
    "Here's how unedited",
    "videos made me",
    "a better editor.",
    "I used to cut everything.",
    "Every pause. Every breath.",
    "But watching raw footage",
    "changed everything.",
    "You learn what actually matters",
    "to the viewer.",
    "The story is in the silence",
    "not just the cuts.",
    "Watch your raw footage.",
    "All of it.",
]

def build_chunks(texts):
    chunks = []
    for i, text in enumerate(texts):
        start = int(i * (30000 / len(texts)))
        end = int((i + 1) * (30000 / len(texts)) - 100)
        chunks.append({
            "text": text,
            "topLabel": f"chunk {i}",
            "startMs": start,
            "endMs": end,
            "outputStartMs": start,
            "outputEndMs": end,
            "isHero": True,
        })
    return chunks


def main():
    failures = []
    def check(label, condition, detail=""):
        status = "PASS" if condition else "FAIL"
        print(f"  [{status}] {label}" + (f"  ({detail})" if detail else ""))
        if not condition:
            failures.append(label)

    chunks = build_chunks(FALLBACK_TEXTS)

    print("== Dynamic selection (same transcript refreshes across runs) ==")
    m1 = generate_font_manifest(chunks)
    m2 = generate_font_manifest(chunks)
    check("dynamic seed refreshes", m1["selectionSeed"] != m2["selectionSeed"])

    print("== Determinism (seed override respected) ==")
    m3 = generate_font_manifest(chunks, {"seed": "custom-seed-42"})
    m4 = generate_font_manifest(chunks, {"seed": "custom-seed-42"})
    check("identical for same explicit seed", m3 == m4)
    check("different from transcript seed", m3 != m1, "seed override diverges")

    print("== Profile routing ==")
    profile_ids = [c["profileId"] for c in m1["chunks"]]
    check("every chunk has a profile", all(pid for pid in profile_ids))
    consec_repeats = sum(1 for a, b in zip(profile_ids, profile_ids[1:]) if a == b)
    check("no consecutive profile repeats", consec_repeats == 0, f"repeats={consec_repeats}")
    from collections import Counter
    usage = Counter(profile_ids)
    peak = max(usage.values())
    check("flat profile distribution", peak <= max(2, len(profile_ids) // 3),
          f"peak={peak}, chunks={len(profile_ids)}")

    print("== Preset routing ==")
    presets = [c["fxPreset"] for c in m1["chunks"]]
    runtime_presets = {item["id"] for item in ANIMA_RUNTIME_TREATMENTS}
    check("every chunk has a runtime preset", all(p in runtime_presets for p in presets))
    consec_preset = sum(1 for a, b in zip(presets, presets[1:]) if a == b)
    check("no consecutive preset repeats", consec_preset == 0, f"repeats={consec_preset}")

    print("== New font integration ==")
    used_families = set()
    for c in m1["chunks"]:
        for layer in c.get("layers", []):
            used_families.add(layer["fontFamily"])
            if layer.get("accentFont"):
                used_families.add(layer["accentFont"])
    overlap = used_families & NEW_HERO_FONTS
    print(f"  fonts used across manifest: {sorted(used_families)}")
    check("new hero fonts reach manifest", len(overlap) >= 1, f"hit={sorted(overlap)}")

    print("== upgrade_font_candidate direct routing ==")
    hero_routes = {upgrade_font_candidate("Inter", True) for _ in range(40)}
    check("basic hero fonts route to display set", hero_routes <= set(HERO_UPGRADE_FONTS),
          f"routes={sorted(hero_routes)}")
    check("hero routes include at least 2 distinct fonts", len(hero_routes) >= 2)
    body_routes = {upgrade_font_candidate("Inter", False) for _ in range(40)}
    check("body routes to companion set", body_routes <= set(COMPANION_UPGRADE_FONTS),
          f"routes={sorted(body_routes)}")

    print("== Single-word integrity ==")
    sw = generate_font_manifest(build_chunks(["EDITOR", "UNEDITED", "SPECTACULAR", "Go"]))
    split_count = 0
    for c in sw["chunks"]:
        layers = c.get("layers", [])
        if len(layers) == 2:
            split_count += 1
            print(f"  {c['text']!r} -> {[l['text'] for l in layers]}")
    check("single-word chunks never fracture", split_count == 0, f"split={split_count}/4")
    check("splitter preserves each word",
          split_single_word_syllables("EDITOR") == ["EDITOR"] and
          split_single_word_syllables("UNEDITED") == ["UNEDITED"])

    print("== RNG avoidance edge case (single-candidate exhaustion) ==")
    # Force a scenario where only one profile matches: all chunks are single-word
    # and we drain the verified 2-layer bucket; should still never crash.
    tiny = generate_font_manifest(build_chunks(["ONE"] * 30))
    tiny_ids = [c["profileId"] for c in tiny["chunks"]]
    consec = sum(1 for a, b in zip(tiny_ids, tiny_ids[1:]) if a == b)
    check("no crash on exhaustion + low consecutive repeats", consec <= 3, f"repeats={consec}")

    print()
    if failures:
        print(f"FAILED: {len(failures)} check(s): {failures}")
        sys.exit(1)
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
