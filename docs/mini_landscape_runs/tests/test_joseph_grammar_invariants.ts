/**
 * MINI LANDSCAPE RUNS — TEST: JOSEPH GRAMMAR INVARIANTS
 *
 * Mirrors docs/mini_run_studio/test_kinetic_governance_invariants.ts: verifies
 * the edit grammar, composition director, and SFX engine never violate the
 * Joseph landscape governance policy.
 *
 * Run: npx tsx docs/mini_landscape_runs/tests/test_joseph_grammar_invariants.ts
 */

import { segmentCutVideo } from "../section_segmenter.js";
import { allocateEditMoves } from "../joseph_edit_grammar.js";
import { selectLandscapeTransitions, selectTypographyMoveIds } from "../landscape_composition_director.js";
import { buildSfxCues } from "../landscape_sfx_engine.js";

let passedChecks = 0;
let totalChecks = 0;
function assert(condition: boolean, message: string) {
  totalChecks++;
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedChecks++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

console.log("=============================================");
console.log("JOSEPH GRAMMAR INVARIANT TESTS (180s cut)");
console.log("=============================================");

const transcript = [
  { timeSec: 8, text: "today I will show you the system" },
  { timeSec: 16, text: "most editors ignore the budget" },
  { timeSec: 30, text: "you need to allocate motion and sound" },
  { timeSec: 45, text: "silence is a tool not a mistake" },
  { timeSec: 60, text: "this is how the workflow runs" },
  { timeSec: 75, text: "open the panel and click the render button" },
  { timeSec: 90, text: "proof is everything" },
  { timeSec: 105, text: "this graph shows the trend" },
  { timeSec: 120, text: "the numbers move in your favor" },
  { timeSec: 150, text: "save 40 percent of your time with this workflow" },
  { timeSec: 152, text: "here is the single sentence to remember" },
  { timeSec: 165, text: "subscribe and start applying today" },
];

const sections = segmentCutVideo(180, { transcript });
assert(sections.length === 6, `All six roles segmented (got ${sections.length}: ${sections.map((s) => s.role).join(",")})`);

const moves = allocateEditMoves(sections);
assert(moves.length >= sections.length, "At least one move per section (BUD-04)");

// BUD-04 + BUD-01: every section covered, move count capped.
for (const s of sections) {
  const sectionMoves = moves.filter((m) => m.sectionId === s.sectionId && m.moveId !== "momentum_death");
  assert(sectionMoves.length >= 1, `Section ${s.sectionId} has >= 1 move`);
  const budget = Math.max(1, Math.min(4, Math.floor(s.durationSec / 8)));
  assert(sectionMoves.length <= budget, `Section ${s.sectionId} move count ${sectionMoves.length} <= budget ${budget}`);
  for (const m of sectionMoves) {
    assert(m.startSec >= s.startSec - 0.05 && m.endSec <= s.endSec + 0.05, `Move ${m.moveId} inside section ${s.sectionId}`);
  }
}

// BUD-03: macro assets only on allowed moves.
const macroAllowed = ["proof_insert", "value_contrast", "explain_workflow", "focus_handoff"];
assert(
  moves.every((m) => !m.allowMacroAsset || macroAllowed.includes(m.moveId)),
  "Macro assets only on proof/value/workflow/focus moves (BUD-03)",
);

// SFX-03: fatigue_relief and momentum_death never allow invented sound.
assert(
  moves.every((m) => !(m.moveId === "fatigue_relief" || m.moveId === "momentum_death") || !m.allowSfx),
  "fatigue_relief / momentum_death set allowSfx=false (SFX-03)",
);

// value_contrast is direction-aware.
for (const m of moves.filter((m) => m.moveId === "value_contrast")) {
  assert(m.numberDirection === "down" || m.numberDirection === "up" || m.numberDirection === "digit_entry", `value_contrast direction-aware (got ${m.numberDirection})`);
}
assert(
  moves.some((m) => m.moveId === "value_contrast" && m.numberDirection === "down"),
  "value_contrast reads 'save 40%' as a downward counter",
);

// thesis_punctuation is payoff-only (TYP-03).
for (const m of moves.filter((m) => m.moveId === "thesis_punctuation")) {
  const section = sections.find((s) => s.sectionId === m.sectionId);
  assert(section?.role === "payoff", "thesis_punctuation only in payoff (TYP-03)");
}

// TRN-01: transition min-gap 3.0s.
const transitions = selectLandscapeTransitions(sections);
assert(transitions.length >= 1, "At least one section-boundary transition selected");
for (let i = 1; i < transitions.length; i++) {
  assert(transitions[i].timeSec - transitions[i - 1].timeSec >= 3.0 - 0.05, "Transition min-gap 3.0s respected (TRN-01)");
}

// TYP-02: typography rate <= 0.7.
const typographyIds = selectTypographyMoveIds(moves);
const typographyEligible = moves.filter((m) => ["emphasize_keyword", "cta_pressure", "thesis_punctuation"].includes(m.moveId) && m.allowSfx);
assert(typographyIds.length / Math.max(1, typographyEligible.length) <= 0.7 + 0.05, "Typography rate <= 0.7 (TYP-02)");

// SFX invariants.
const sfx = buildSfxCues(moves, transitions);
assert(sfx.length >= moves.length, `Every move yields a cue or omission decision (got ${sfx.length} cues)`);

for (const c of sfx.filter((c) => c.family === "none")) {
  assert(c.intentionalOmission, "family=none cues are intentional omissions (SFX-03)");
}
for (const c of sfx.filter((c) => !c.intentionalOmission)) {
  assert(c.family !== "none", "Non-omission cues always have a sound family");
}

// SFX-01: every cue traces to a move or a transition.
// Move cues always carry cause.moveId; boundary-transition cues never do.
const moveIds = new Set(moves.map((m) => m.moveId));
const transitionTimes = new Set(transitions.map((t) => t.timeSec));
for (const c of sfx) {
  const traced = c.cause.moveId
    ? moveIds.has(c.cause.moveId)
    : c.cause.gate === "transition"
      ? [...transitionTimes].some((t) => Math.abs(t - (c.cause.timeSec ?? -1)) < 0.1)
      : false;
  assert(traced, `Cue ${c.id} traces to a move or transition (SFX-01)`);
}

// SFX-04: no two cues of the same family within 0.9s.
const byFamily: Record<string, number[]> = {};
for (const c of sfx) {
  (byFamily[c.family] ??= []).push(c.timeSec);
}
let familyGapViolations = 0;
for (const [family, times] of Object.entries(byFamily)) {
  if (family === "none") continue;
  const sorted = times.sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] < 0.9 - 0.05) familyGapViolations++;
  }
}
assert(familyGapViolations === 0, "SFX-04 family repetition window respected");

console.log("\n=============================================");
if (passedChecks === totalChecks) {
  console.log(`🎉 JOSEPH GRAMMAR INVARIANTS PASSED: ${passedChecks}/${totalChecks}`);
} else {
  console.error(`💥 JOSEPH GRAMMAR INVARIANTS FAILED: ${totalChecks - passedChecks} failures.`);
}
console.log("=============================================");

