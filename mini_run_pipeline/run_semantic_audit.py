"""Script to test deep semantic extraction on the monologue transcript."""

from __future__ import annotations

import json
import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from mini_run_pipeline.semantic_director import perform_deep_semantic_extraction
from mini_run_pipeline.test_whitecheckered_engine import SAMPLE_TRANSCRIPT


def main():
    print("Executing Deep Semantic Extraction on 'Own the Outcome' transcript...")
    res = perform_deep_semantic_extraction(SAMPLE_TRANSCRIPT)

    theme = res.get("narrativeTheme", "N/A")
    arch = res.get("speakerArchetype", "N/A")
    print(f"\n=======================================================")
    print(f"THEMATIC ARC: {theme}")
    print(f"OPERATOR ARCHETYPE: {arch}")
    print(f"=======================================================")

    print("\nTHEMATIC BEATS:")
    for b in res.get("thematicBeats", []):
        print(f"  • [{b.get('timeRange')}] {b.get('beatName')}: {b.get('coreIdea')}")

    print("\nSELECTED CORE CONCEPT INFLECTIONS & ASSET TREATMENTS:")
    for inf in res.get("selectedInflections", []):
        print(f"\n▶ [{inf.get('timestamp')}] {inf.get('conceptName')} ({inf.get('durationSec')}s | Veo: {inf.get('veoDurationSeconds')}s)")
        print(f"  Spoken: \"{inf.get('spokenPhrase')}\"")
        print(f"  Headline: {inf.get('headline')} | Badges: {inf.get('badges')}")
        print(f"  Visual Metaphor: {inf.get('visualMetaphor')}")
        print(f"  Optical Blur: {inf.get('opticalBlur')}")
        print(f"  Spatial Physics: {inf.get('spatialPhysics')}")
        print(f"  Framed Container: {inf.get('framedContainer')}")
        print(f"  Shadow Behavior: {inf.get('shadowBehavior')}")
        print(f"  Secondary Motion: {inf.get('secondaryMotion')}")
        print(f"  Veo 3.1 Prompt: {inf.get('veoPrompt')[:120]}...")

    # Save to json file for pipeline consumption
    output_file = Path(__file__).resolve().parent.parent / "docs" / "mini_run_studio" / "deep_semantic_manifest.json"
    output_file.write_text(json.dumps(res, indent=2), encoding="utf-8")
    print(f"\nSaved manifest to: {output_file}")


if __name__ == "__main__":
    main()
