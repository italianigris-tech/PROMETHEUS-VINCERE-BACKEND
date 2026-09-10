"""B-ROLL ACCOUNTABILITY PROBE (Sherlock audit) -- MINI-RUN PIPELINE ONLY.

Probes the LIVE mini-run B-roll integration end-to-end and prints a decision
trace for every chunk: engine scorecard, pipeline selection, Pexels asset
resolution, and prescribed After Effects treatment.

Run from the repo root:  python tests/probe_broll_accountability.py
Sections:
  1. Per-chunk engine scorecard (the exact call backgrounds.py makes).
  2. AUTO mode (default pipeline, no prompt) -- does B-roll ever fire?
  3. DIRECTED mode (prompt-mandated B-roll) -- full broll payload trace.
  4. The 'master planner' plan_broll_cutaways_for_mini_run (dead code?) with
     instrumented cooldown/fatigue telemetry.
  5. Live Pexels search (no download) -- what the API actually recommends.
  6. Verdict table.
"""

import hashlib
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from mini_run_pipeline.broll_engine import (  # noqa: E402
    BrollAssetMetadata,
    BrollSuitabilityEngine,
    PexelsVideoClient,
    extract_broll_search_queries,
    plan_broll_cutaways_for_mini_run,
)
from mini_run_pipeline.orchestration import plan_mini_run_orchestration  # noqa: E402


# ---------------------------------------------------------------------------
# Transcript A -- 60s doctrinal gauntlet (15 chunks). Designed beats:
#   concrete-heavy, stats/abstract, micro-short, cooldown-adjacent pair,
#   behindSubject exclusion, and a realistic famine tail.
# ---------------------------------------------------------------------------
TRANSCRIPT_A = [
    # (start_ms, end_ms, role, text, behind_subject)
    (0,     3400,  "intro",         "Nobody wants to hear this but success is boring", False),
    (3400,  7600,  "world_context", "I walked into a crowded subway station in Manhattan at night", False),
    (7600,  10800, "proof",         "72% of revenue growth comes from 3 pillars of the system", False),
    (10800, 15000, "crisis",        "I sat at my desk typing on a laptop in a dark office", False),
    (15000, 16200, "climax",        "Stop.", False),
    (16200, 21000, "world_context", "The factory machines were building robots near the highway", False),
    (21000, 25000, "resolution",    "The framework is a mindset shift and a strategy funnel", False),
    (25000, 28000, "world_context", "I drove a supercar down the empty highway at sunrise", False),
    (30500, 34000, "world_context", "People crowded the city streets near the office", False),
    (34000, 37000, "proof",         "Revenue doubled, a 10x growth in profit", False),
    (37000, 41500, "revelation",    "Rain fell on the empty street outside the hospital window", False),
    (41500, 44000, "proof",         "Coffee cup on the desk, money on the table", True),   # behindSubject
    (44000, 48500, "crisis",        "Walking the urban streets, traffic lights, smoke and fire", False),
    (48500, 52000, "resolution",    "First, second, third step of the process workflow", False),
    (52000, 58000, "proof",         "Standing in the crowded warehouse at night, staring at the machines", False),
]

# Transcript B -- 40s of realistic conversational creator speech (b-roll famine test).
TRANSCRIPT_B = [
    (0,     4200,  "intro",      "So here is the thing nobody tells you about making it", False),
    (4200,  8100,  "hook",       "Most people think it is about talent", False),
    (8100,  9600,  "climax",     "It is not", False),
    (9600,  13800, "proof",      "It is about deciding before you are ready", False),
    (13800, 18200, "resolution", "Every single day you choose the harder thing", False),
    (18200, 22600, "revelation", "The work compounds quietly in the dark", False),
    (22600, 26800, "crisis",     "Then one day everything changes for you", False),
    (26800, 30200, "revelation", "That is the whole secret", False),
    (30200, 34500, "proof",      "Nobody is coming to save you", False),
    (34500, 40000, "climax",     "So start now", False),
]


def build_chunks(transcript):
    """Chunks in the REAL production schema (chunks.py:142-145):
    camelCase startMs/endMs/outputStartMs/outputEndMs. No snake_case start_ms --
    that key exists only on words, never on chunks."""
    chunks = []
    for i, (s, e, _role, text, behind) in enumerate(transcript):
        chunks.append({
            "chunkIndex": i,
            "chunkId": f"chunk-{i + 1}",
            "text": text,
            "startMs": s,
            "endMs": e,
            "outputStartMs": s,
            "outputEndMs": e,
            "displayStartMs": s,
            "subjectLayering": {"behindSubject": behind},
        })
    return chunks


def build_scenes(transcript, duration_ms):
    # NOTE: mirrors orchestration.py:495-510 -- scenes carry salience but NO role.
    scenes = []
    for i, (s, e, role, _text, _behind) in enumerate(transcript):
        scenes.append({
            "id": f"scene-{i + 1}",
            "startMs": s,
            "endMs": min(e, duration_ms),
            "layout": "pan_scan",
            "salience": 0.7,
            # We ALSO smuggle the doctrinal role in a side key so we can compare
            # what production omits vs what the engine expects.
            "_doctrinal_role": role,
        })
    return scenes


def hr(title):
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


# ---------------------------------------------------------------------------
# Telemetry recorder: instruments BrollSuitabilityEngine.evaluate_chunk to
# capture the cooldown/fatigue inputs the pipeline ACTUALLY passes.
# ---------------------------------------------------------------------------
class EvaluateRecorder:
    KEYS = ("chunk_index", "duration_sec", "time_since_last_broll_sec",
            "time_since_last_visual_break_sec")

    def __init__(self):
        self.calls = []
        self._orig = None

    def __enter__(self):
        self._orig = BrollSuitabilityEngine.evaluate_chunk.__func__

        def wrapper(cls, **kwargs):
            self.calls.append({k: kwargs.get(k) for k in self.KEYS})
            return self._orig(cls, **kwargs)

        BrollSuitabilityEngine.evaluate_chunk = classmethod(wrapper)
        return self

    def __exit__(self, *exc):
        BrollSuitabilityEngine.evaluate_chunk = classmethod(self._orig)
        return False

    def summary(self):
        if not self.calls:
            return "  (evaluate_chunk never called)"
        broll_gaps = [c["time_since_last_broll_sec"] for c in self.calls]
        breaks = [c["time_since_last_visual_break_sec"] for c in self.calls]
        monotonic_breaks = all(b2 >= b1 for b1, b2 in zip(breaks, breaks[1:]))
        return (
            f"  evaluate_chunk calls: {len(self.calls)}\n"
            f"  time_since_last_broll_sec   min={min(broll_gaps):.2f} max={max(broll_gaps):.2f}"
            f"  -> cooldown (<4.5s) ever fired: {any(g < 4.5 for g in broll_gaps)}\n"
            f"  time_since_last_visual_break min={min(breaks):.2f} max={max(breaks):.2f}"
            f"  monotonic(never resets after B-roll): {monotonic_breaks}"
        )


class StubPexelsClient:
    """Offline stand-in so the dead-code planner probe never touches network."""

    def materialize_asset(self, query, **kwargs):
        h = hashlib.md5(query.encode()).hexdigest()[:8]
        return BrollAssetMetadata(
            asset_id=f"stub_{h}", source="stub", query=query, video_url="",
            local_file="", duration_sec=6.0, width=1080, height=1920,
            orientation="portrait", aspect_ratio="9:16",
            photographer="Stub", photographer_url="",
        )


def describe_broll(bg):
    b = bg.get("broll") or {}
    t = b.get("treatment") or {}
    ev = b.get("evaluation") or {}
    return {
        "assetId": b.get("assetId"),
        "source": b.get("source"),
        "query": b.get("query"),
        "videoFile": b.get("videoFile"),
        "videoUrl": (b.get("videoUrl") or "")[:60],
        "WxH": f"{b.get('width')}x{b.get('height')}",
        "treatment": t.get("treatment_name"),
        "composite": ev.get("composite_score"),
        "matched_concrete": ev.get("matched_concrete_terms"),
        "matched_abstract": ev.get("matched_abstract_terms"),
        "rationale": ev.get("rationale"),
    }


def main():
    duration_ms = 60000
    chunks_a = build_chunks(TRANSCRIPT_A)
    scenes_a = build_scenes(TRANSCRIPT_A, duration_ms)

    # ------------------------------------------------------------------ 1
    hr("SECTION 1: ENGINE SCORECARD -- Transcript A (60s doctrinal gauntlet)")
    print(f"{'i':>2} {'sec':>9} {'D':>5} {'C':>5} {'F':>5} {'R':>5} {'coolP':>6} {'absP':>5} "
          f"{'SCORE':>6} {'verdict':>18}  concrete-terms")
    for i, (s, e, role, text, behind) in enumerate(TRANSCRIPT_A):
        ev = BrollSuitabilityEngine.evaluate_chunk(
            chunk_index=i, text=text, duration_sec=(e - s) / 1000.0,
            time_since_last_broll_sec=s + 100.0,        # what backgrounds.py:1056 really passes
            time_since_last_visual_break_sec=s / 1000.0,  # last_end_ms<=0 branch -> elapsed video time
            beat_type=None,                             # production scenes have NO role (orchestration.py:495)
        )
        tag = "BROLL!" if ev.is_eligible else ev.recommended_treatment_category
        flag = " [behindSubject]" if behind else ""
        print(f"{i:>2} {s/1000:>4.1f}-{e/1000:<4.1f} {ev.duration_score:>5.2f} {ev.concreteness_score:>5.2f} "
              f"{ev.fatigue_score:>5.2f} {ev.rhetorical_score:>5.2f} {ev.cooldown_penalty:>6.2f} "
              f"{ev.abstract_penalty:>5.2f} {ev.composite_score:>6.2f} {tag:>18}  "
              f"{','.join(ev.matched_concrete_terms) or '-'}{flag}")

    # ------------------------------------------------------------------ 1b
    hr("SECTION 1b: SCORECARD AS THE PIPELINE ACTUALLY FEEDS IT (start_ms=0, dur=2.5s)")
    print("backgrounds.py:1067 reads chunk.get('start_ms', 0) -> 0.0 for camelCase chunks,")
    print("and duration defaults to 2.5s -> D(t)=1.0 constant, F=0.1 constant for every chunk.")
    print(f"{'i':>2} {'C':>5} {'F':>5} {'SCORE':>6} {'eligible':>8}  (composite == 0.395 + 0.35*C)")
    for i, (_s, _e, _role, text, _behind) in enumerate(TRANSCRIPT_A):
        ev = BrollSuitabilityEngine.evaluate_chunk(
            chunk_index=i, text=text, duration_sec=2.5,
            time_since_last_broll_sec=100.0,
            time_since_last_visual_break_sec=0.0,
            beat_type=None,
        )
        print(f"{i:>2} {ev.concreteness_score:>5.2f} {ev.fatigue_score:>5.2f} "
              f"{ev.composite_score:>6.2f} {str(ev.is_eligible):>8}  {','.join(ev.matched_concrete_terms) or '-'}")

    # ------------------------------------------------------------------ 2
    hr("SECTION 2: AUTO MODE (default pipeline, no prompt) -- real orchestration path")
    with EvaluateRecorder() as rec_auto:
        t0 = time.time()
        manifest_auto = plan_mini_run_orchestration(
            chunks=chunks_a, probe={"width": 1080, "height": 1920},
            prompt=None, duration_ms=duration_ms,
        )
        print(f"plan_mini_run_orchestration(auto) in {time.time()-t0:.1f}s")
    scene_keys = sorted(manifest_auto["scenes"][0].keys()) if manifest_auto.get("scenes") else []
    print(f"production scene keys: {scene_keys}")
    print(f"scene carries 'role'? {'role' in scene_keys}   carries 'beatType'? {'beatType' in scene_keys}")
    kinds_auto = [(b.get("id"), b.get("kind"), b.get("chunkIndex")) for b in manifest_auto.get("backgrounds", [])]
    n_broll_auto = sum(1 for _, k, _ in kinds_auto if k == "broll_cutaway")
    print(f"backgrounds selected (auto): {kinds_auto or 'NONE'}")
    print(f"B-ROLL CUTAWAYS IN AUTO MODE: {n_broll_auto}")
    print("cooldown/fatigue telemetry (auto path):")
    print(rec_auto.summary())

    # ------------------------------------------------------------------ 3
    hr("SECTION 3: DIRECTED MODE (prompt='add cinematic b-roll cutaway footage')")
    with EvaluateRecorder() as rec_dir:
        t0 = time.time()
        manifest_dir = plan_mini_run_orchestration(
            chunks=chunks_a, probe={"width": 1080, "height": 1920},
            prompt="add cinematic b-roll cutaway footage", duration_ms=duration_ms,
        )
        print(f"plan_mini_run_orchestration(directed) in {time.time()-t0:.1f}s")
    bgs_dir = manifest_dir.get("backgrounds", [])
    brolls_dir = [b for b in bgs_dir if b.get("kind") == "broll_cutaway"]
    print(f"backgrounds selected (directed): {[(b.get('id'), b.get('kind'), b.get('chunkIndex')) for b in bgs_dir]}")
    print(f"B-ROLL CUTAWAYS IN DIRECTED MODE: {len(brolls_dir)}")
    for b in brolls_dir:
        d = describe_broll(b)
        print(f"  - {b.get('id')} chunk={b.get('chunkIndex')} scene={b.get('sceneId')} "
              f"entry={b.get('entry', {}).get('startMs')}-{b.get('entry', {}).get('endMs')} transition={b.get('transition', {}).get('kind')}")
        for k, v in d.items():
            print(f"      {k:>17}: {v}")
    print("cooldown/fatigue telemetry (directed path):")
    print(rec_dir.summary())
    sfx_broll = [s for s in manifest_dir.get("sfx", []) if "broll" in str(s.get("id", ""))]
    print(f"b-roll sfx cues: {[(s.get('id'), s.get('cue'), s.get('triggerMs')) for s in sfx_broll] or 'NONE'}")

    # ------------------------------------------------------------------ 4
    hr("SECTION 4: 'MASTER PLANNER' plan_broll_cutaways_for_mini_run (referenced only by tests)")
    chunks_b = build_chunks(TRANSCRIPT_A)
    scenes_for_planner = [
        {"id": f"scene-{i + 1}", "startMs": s, "endMs": e, "role": role}
        for i, (s, e, role, _t, _b) in enumerate(TRANSCRIPT_A)
    ]
    with EvaluateRecorder() as rec_plan:
        directives = plan_broll_cutaways_for_mini_run(
            chunks=chunks_b, scenes=scenes_for_planner, duration_ms=duration_ms,
            max_brolls=4, seed="sherlock", client=StubPexelsClient(), download_assets=False,
        )
    print(f"placements: {len(directives)} (max_brolls=4)")
    for d in directives:
        print(f"  - {d.placement_id} chunk={d.chunk_index} {d.start_ms}-{d.end_ms}ms "
              f"asset={d.asset.asset_id}({d.asset.source}) treatment={d.treatment.treatment_name} "
              f"score={d.evaluation.composite_score}")
    print("cooldown/fatigue telemetry (planner):")
    print(rec_plan.summary())
    print("NOTE: this planner is NEVER called by the live pipeline "
          "(grep: only tests/test_broll_engine.py imports it).")

    # ------------------------------------------------------------------ 5
    hr("SECTION 5: LIVE PEXELS PROBE (search only, no download)")
    for label, text in (("subway chunk", TRANSCRIPT_A[1][3]), ("office chunk", TRANSCRIPT_A[3][3])):
        q, fq = extract_broll_search_queries(text, beat_name=TRANSCRIPT_A[1][2])
        print(f"  [{label}] text: {text!r}")
        print(f"    primary query : {q!r}   fallback: {fq!r}")
        try:
            client = PexelsVideoClient()
            t0 = time.time()
            vids = client.search_videos(q, per_page=3)
            print(f"    Pexels returned {len(vids)} videos in {time.time()-t0:.1f}s")
            for v in vids[:3]:
                best = client.select_best_vertical_file(v) or {}
                print(f"      id={v.get('id')} dur={v.get('duration')}s best_file="
                      f"{best.get('width')}x{best.get('height')} {best.get('quality')}")
        except Exception as exc:
            print(f"    NETWORK FAIL: {exc}  (pipeline would silently fall back to a mock asset)")

    # ------------------------------------------------------------------ 6
    hr("SECTION 6: VERDICTS")
    print(f"""
  [H1] Auto mode starves B-roll (max_backgrounds clamped to 1, backgrounds.py:828-830)
       -> auto B-roll count this run: {n_broll_auto}
  [H2] Cooldown penalty is dead in production (last_broll_sec never updated,
       backgrounds.py:1056 / broll_engine.py:781)
       -> telemetry above: 'cooldown ever fired' should read False for both paths
  [H3] Fatigue never resets after a B-roll (time_since_break derived from
       last_end_ms before any B-roll is selected, backgrounds.py:1071)
       -> telemetry above: 'monotonic' should read True
  [H4] Master planner plan_broll_cutaways_for_mini_run is dead code (broll_engine.py:760)
  [H5] Production scenes have NO role/beatType -> rhetorical boost + beat-based
       treatment mapping are dead; treatments fall to md5 dice (broll_engine.py:669)
       -> 'scene carries role?' printed above
  [H6] 4.5s COOLDOWN_GAP_SEC doctrine unenforced in live path (generic 2.2s gap,
       backgrounds.py:834) -> check whether two directed B-rolls landed < 4.5s apart
""")


if __name__ == "__main__":
    main()
