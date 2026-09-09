"""Test Suite: 38.Whitecheckered Transcript Animation & Asset Translation Engine.

Runs exclusively within mini_run_pipeline/.
Tests:
1. Transcript parsing & segmentation.
2. Weight scoring to find all animation candidates and isolate the #1 heaviest moment.
3. Live Google AI (Gemini 2.5 Flash) call with strict structured schema.
4. Hard temporal boundary audit: keyframes must never exceed statement duration.
5. HTML component rendering with transparent checkerboard (.img-wrap) styling.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Add backend root to path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from mini_run_pipeline.whitecheckered_engine import (
    parse_timestamped_transcript,
    score_animation_candidates,
    generate_whitecheckered_animation_plan,
    render_whitecheckered_stage_html,
)

SAMPLE_TRANSCRIPT = """\
[00:00]
Look, I’m going to keep this simple. If you’re waiting for permission, you’re already behind. No one’s coming to save you. No mentor, no investor, no viral post. The only person who can move your life forward is you.

[00:12]
I see too many smart people stuck in “research mode.” They watch another breakdown, read another thread, take another course. And nothing changes. Because information without execution is just entertainment.

[00:24]
Here’s the shift: stop trying to feel ready. Start trying to be useful. The market doesn’t care about your confidence. It cares about whether you can solve a real problem for a real person, reliably, at scale.

[00:36]
So step one is brutal but clean: take full responsibility for where you are. Your revenue, your skills, your network, your reputation—all of it is a lagging indicator of the choices you’ve made and the work you’ve put in.

[00:49]
Step two: pick a game where effort compounds. Not a lottery ticket. Not a trend that dies in six months. A game where every call, every offer, every iteration makes the next one easier. That’s how you build leverage.

[01:03]
People ask me, “What’s the edge?” The edge is volume with feedback. Do more than everyone else, but do it with a system. Track what works, kill what doesn’t, double down on the tiny things that move revenue.

[01:16]
And let’s talk about identity. You don’t “become” a serious operator by saying it. You become one by stacking undeniable proof. Ship the thing. Close the deal. Fix the problem. Your confidence is just a byproduct of evidence.

[01:30]
Here’s something most won’t admit: you only need to get this right once. One offer, one niche, one channel that truly works. But to find that one, you have to be willing to run a hundred small experiments and be wrong ninety-nine times.

[01:44]
The cost isn’t money. It’s ego. It’s admitting your first draft is bad, your first offer is weak, your first pitch is awkward. And doing it anyway. That’s the tax on entry. Pay it early.

[01:57]
Now, about teams. You don’t need a big team. You need a clear standard. Hire for reliability, train for skill, fire for values. One person who owns the outcome is worth ten people who own tasks.

[02:11]
If you’re leading, your job is simple: remove friction. Make it obvious what to do, easy to do it, and costly to ignore. Clarity beats motivation every single time.

[02:23]
Let’s get personal for a second. If your goal is “get rich,” you’ll chase shortcuts. If your goal is “get better,” you’ll build systems. And ironically, getting better is what makes getting rich inevitable.

[02:36]
So ask yourself: what’s the one constraint that, if removed, would 10x your results? Is it leads? Conversion? Delivery? Focus there. Don’t spread yourself thin. Go deep where it matters.

[02:50]
And stop negotiating with yourself. You know the work. You know the calls to make, the content to post, the offers to test. The gap between you and the next level isn’t knowledge. It’s consistency under boredom.

[03:04]
One more thing: your reputation is your real asset. Be on time. Do what you say. Tell the truth, especially when it costs you. In a world of noise, being reliable is a superpower.

[03:17]
So here’s the challenge: for the next 90 days, act like the person you claim you want to be. Same standards. Same follow-through. Same obsession with outcomes. Let your results do the talking.

[03:30]
Because at the end of the day, nobody remembers your intentions. They remember what you shipped, what you sold, and what you solved. Own the outcome. Everything else is commentary.

[03:42]
That’s it.
"""


def run_tests():
    print("==================================================================")
    print("RUNNING 38.WHITECHECKERED TRANSCRIPT ANIMATION ENGINE TEST SUITE")
    print("==================================================================")

    # 1. Parse transcript
    segments = parse_timestamped_transcript(SAMPLE_TRANSCRIPT)
    print(f"\n[1/5] Parsed {len(segments)} timestamped segments.")
    assert len(segments) == 18, f"Expected 18 segments, got {len(segments)}"

    # 2. Score candidates
    scored = score_animation_candidates(segments)
    candidates = [s for s in scored if s["isCandidate"]]
    heaviest = scored[0]
    print(f"\n[2/5] Scored {len(scored)} segments. Found {len(candidates)} animation candidates.")
    print(f"      Top #1 Heaviest Segment: Rank 1 (Score: {heaviest['weightScore']})")
    print(f"      Timestamp: [{heaviest['startSec']}s - {heaviest['endSec']}s] (Duration: {heaviest['durationSec']}s)")
    print(f"      Text: \"{heaviest['text']}\"")
    print(f"      Matched Motifs: {heaviest['matchedMotifs']}")

    assert heaviest["isHeaviest"] is True, "Rank 1 must be marked as isHeaviest"
    assert heaviest["durationSec"] > 0, "Duration must be positive"

    # 3. Invoke Google AI (Gemini 2.5 Flash)
    print("\n[3/5] Calling Google AI (Gemini 2.5 Flash) with strict 38.Whitecheckered schema...")
    plan = generate_whitecheckered_animation_plan(heaviest)
    print("      Live response received successfully!")
    print(f"      Archetype: #{plan.get('archetypeId')} ({plan.get('archetypeName')})")
    print(f"      Simulated Query: \"{plan.get('queryBar', {}).get('queryText')}\"")
    print(f"      Results Count: {len(plan.get('results', []))}")
    for r in plan.get("results", []):
        active_mark = " [ACTIVE]" if r.get("isActive") else ""
        print(f"        - {r.get('badge')}: {r.get('title')} ({r.get('detail')}){active_mark}")

    # 4. Enforce strict duration bounds
    print("\n[4/5] Auditing Temporal Compliance (Zero Time Overflow Invariant)...")
    dur_ceiling = heaviest["durationSec"]
    for event in plan.get("keyframeSchedule", []):
        t = float(event.get("timeSec", 0.0))
        assert t <= dur_ceiling, f"Event '{event.get('event')}' at {t}s exceeded ceiling {dur_ceiling}s!"
        print(f"      ✓ Event @ {t:.1f}s: {event.get('event')} <= {dur_ceiling}s")

    print(f"      Temporal Audit: PASS. Entire animation fits within {dur_ceiling}s.")

    # 5. Render HTML Component
    print("\n[5/5] Generating 38.Whitecheckered Stage HTML Component...")
    html_output = render_whitecheckered_stage_html(plan)
    assert "ARCHETYPE #38" in html_output
    assert "38.WHITECHECKERED" in html_output
    assert "wc-checker-backer" in html_output
    print("      HTML Component rendered successfully with transparent checkerboard backing.")

    # Save artifact to docs/mini_run_studio/ for visual preview
    output_html_path = backend_root / "docs" / "mini_run_studio" / "whitecheckered_preview.html"
    full_preview = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>38.Whitecheckered — Archetype #38 Live Preview</title>
  <style>
    body {{
      background: #030712;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      font-family: system-ui, -apple-system, sans-serif;
    }}
    .preview-container {{
      width: 100%;
      max-width: 440px;
    }}
    .statement-box {{
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 20px;
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.5;
    }}
    .statement-box strong {{
      color: #38bdf8;
    }}
  </style>
</head>
<body>
  <div class="preview-container">
    <div class="statement-box">
      <strong>Spoken Statement (Selected Heaviest Inflection Point):</strong><br>
      "{heaviest['text']}"<br><br>
      <strong>Duration:</strong> {heaviest['durationSec']}s &nbsp;|&nbsp; <strong>Weight Score:</strong> {heaviest['weightScore']}
    </div>
    {html_output}
  </div>
</body>
</html>"""
    output_html_path.write_text(full_preview, encoding="utf-8")
    print(f"      Saved standalone preview to: {output_html_path}")

    print("\n==================================================================")
    print("ALL 38.WHITECHECKERED TESTS PASSED!")
    print("==================================================================")


if __name__ == "__main__":
    run_tests()
