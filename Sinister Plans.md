# Sinister Plans

## What This Video Proves

Source: `HOW TO EDIT LIKE GADZHI --JOSEPH 1.mp4`

Known facts from the MP4 and trajectory:

- Duration: 23:18.
- Resolution: 640x360, 30 fps.
- Trajectory windows: 301 scene-based windows.
- Text/lower-third windows: 191 of 301.
- Tutorial-walkthrough windows: 16 of 301.
- Broad role arc: hook -> setup -> explanation -> demonstration -> payoff -> outro.
- Independent FFmpeg scene detection found 233 scene-change events.

The important contradiction:

- The trajectory says `shot_change_count = 0` for every window.
- FFmpeg detects 233 scene changes.
- Therefore transition/cut features are not training-safe yet.

## Ontology Coverage From This One Video

Strongly inferable:

- Segment timing and scene windows.
- Broad editorial role arc.
- Tutorial versus editorial sections.
- Lower-third / subtitle presence.
- Caption density and text treatment frequency.
- Cut rhythm and dense change clusters.
- Speaker-visible versus speaker-absent windows.
- Payoff/outro escalation regions.
- Repetition patterns across the edit.

Partially inferable:

- Rhetorical role.
- Information density.
- Cognitive load.
- Viewer attention target.
- Emphasis intent.
- Object/screen/person relationship.
- Whether an edit helped clarity.

Not safely inferable from this artifact alone:

- Joseph's rejected alternatives.
- True viewer trust or retention.
- Exact reason Joseph chose one edit over another.
- Whether audio/music/SFX were intentionally shaped.
- Whether a move is good, neutral, or harmful without human judgment.

## The Audit Questions

For each important edit moment, answer:

1. What happened?
2. Why did a human editor probably do it?
3. What viewer problem did it solve?
4. Which current feature captures that?
5. Was the feature measured reliably?
6. What feature was missing?
7. Was the edit good, neutral, or harmful?

## Example Rows To Look For

Hook:

- What happened: Fast opening pattern, early visual/text setup.
- Why: Establish stakes and tell the viewer this will be useful.
- Viewer problem: "Why should I keep watching?"
- Captured by: role, text presence, scene timing, visual density.
- Missing: exact promise, stakes, curiosity gap.

Tutorial walkthrough:

- What happened: Screen/instruction segments appear inside the edit.
- Why: Demonstrate the process rather than only talk about it.
- Viewer problem: "Show me what you mean."
- Captured by: segment_genre, speaker visibility, text.
- Missing: whether the screen is evidence, example, or instruction.

Payoff cluster:

- What happened: Dense scene changes and text near the late video.
- Why: Increase momentum around conclusion or key takeaway.
- Viewer problem: "What is the final usable lesson?"
- Captured by: temporal role, text, scene-change density.
- Missing: actual conceptual importance and whether the intensity is justified.

Outro:

- What happened: Longer final section with text and speaker presence.
- Why: Close the loop, summarize, or call the viewer to act.
- Viewer problem: "What do I do now?"
- Captured by: outro role, text presence, speaker state.
- Missing: CTA type, trust risk, emotional landing.

## How To Hit 90 Percent Feature Explainability

Use the 90 percent test like this:

- Pick 5 Joseph videos.
- Mark only key edit decisions, not every frame.
- For each decision, write the human reason first.
- Then map that reason to current features.
- If no feature explains the reason, record a missing ontology requirement.
- If a feature claims to explain it but was measured wrong, mark it unreliable.
- If the edit is stylistic but not useful, mark it as habit, not judgment.

Count an edit as explained only when:

- The edit action is captured.
- The reason for the action is represented.
- The viewer problem is represented.
- The extractor measured the relevant signal reliably.
- The renderer could actually reproduce the intended treatment.

Do not count it as explained when:

- The feature only names the visible move.
- The extractor used a silent default.
- The reason requires transcript/context that is missing.
- The feature confuses "not detected" with "not present."

## Immediate Fix Priorities

1. Fix missingness: unknown must not become low/false.
2. Fix transition/cut detection before IRL.
3. Separate visible action from editorial intent.
4. Add transcript/rhetorical-role annotation.
5. Add screen/person/object relationship labels.
6. Validate tutorial filtering manually.
7. Run feature audit before any reward training.

## The Rule

Do not teach the system that Joseph uses zooms, captions, or cuts.

Teach it why a viewer needed emphasis, clarity, proof, restraint, or demonstration, then let zooms, captions, and cuts become tools for serving that intent.
