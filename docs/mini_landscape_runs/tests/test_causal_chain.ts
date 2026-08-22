/**
 * MINI LANDSCAPE RUNS — TEST: CAUSAL CHAIN
 *
 * Runs the full stage 0–7 pipeline against a synthetic 240s landscape probe
 * (no media file needed) and proves every entity in the manifest is causally
 * resolvable — the core non-negotiable of this studio.
 *
 * Run: npx tsx docs/mini_landscape_runs/tests/test_causal_chain.ts
 */

import { runLandscapeTreatmentPipeline, runGovernanceChecks } from "../landscape_treatment_pipeline.js";
import { classifyCall } from "../call_parser.js";
import { parseSilencedetectLog } from "../silence_cutter.js";
import type { CausalRef, LandscapeTreatmentManifest, MediaProbe } from "../types.js";

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

const VALID_GATES = new Set<CausalRef["gate"]>([
  "form_decision", "silence_cut", "section_role", "edit_move", "transition",
  "asset_entry", "asset_exit", "number_lock", "cta_hit", "speaker_return",
  "intentional_silence", "section_boundary", "video_start_fade", "video_end_fade",
]);

console.log("=============================================");
console.log("CAUSAL CHAIN TEST (240s synthetic landscape)");
console.log("=============================================");

// Stage 0: prompt + synthetic probe → long_form.
const probe: MediaProbe = {
  path: "sample_masterclass.mp4",
  durationSec: 240,
  width: 1920,
  height: 1080,
  fps: 30,
  hasAudio: true,
  aspect: "landscape",
};
const form = classifyCall({ prompt: "long form masterclass tutorial on editing workflows" });
assert(form.form === "long_form", `Call Parser routes long-form to this studio (got ${form.form})`);
assert(form.confidence >= 0.9, `Confidence high for explicit prompt (got ${form.confidence})`);

// Stage 1: canned detection for a 240s masterclass.
const canned = [
  "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'sample.mp4':",
  "  Duration: 00:04:00.00, start: 0.000000, bitrate: 1000 kb/s",
  "[silencedetect @ 0x55a1] silence_start: 30",
  "[silencedetect @ 0x55a1] silence_end: 31 | silence_duration: 1",
  "[silencedetect @ 0x55a1] silence_start: 120.5",
  "[silencedetect @ 0x55a1] silence_end: 122 | silence_duration: 1.5",
].join("\n");
const detection = parseSilencedetectLog(canned);
assert(detection.durationSec === 240, `Detection duration 240s (got ${detection.durationSec})`);

// Stages 0–7: full pipeline with no media file (virtual source).
const manifest = runLandscapeTreatmentPipeline({
  prompt: "long form masterclass tutorial on editing workflows",
  detection,
  transcript: [
    { timeSec: 10, text: "here is the opening promise" },
    { timeSec: 40, text: "the context you need" },
    { timeSec: 80, text: "explain the core concept" },
    { timeSec: 140, text: "watch the workflow demonstration" },
    { timeSec: 200, text: "this is the payoff" },
    { timeSec: 230, text: "subscribe for more" },
  ],
});

assert(manifest.studio === "mini_landscape_runs", "Manifest is stamped by this studio");
assert(manifest.canvas.aspect === "16:9", `Canvas is 16:9 landscape (${manifest.canvas.width}x${manifest.canvas.height})`);
assert(manifest.silenceCut.outputDurationSec < manifest.silenceCut.sourceDurationSec, "Silence cut shortened the masterclass");
assert(manifest.sections.length === 6, `Six role sections (got ${manifest.sections.map((s) => s.role).join(",")})`);
assert(manifest.editMoves.length >= manifest.sections.length, "Every section has >= 1 edit move");
assert(manifest.transitions.length >= 1, "At least one boundary transition");
assert(manifest.sfxCues.length >= manifest.editMoves.length, "Every move has an SFX decision (cue or omission)");
assert(manifest.soundtrack.totalSec > manifest.silenceCut.outputDurationSec, "Soundtrack programme outlasts the cut video (AUD-05)");

// Every governance check must pass → allCausal.
const checks = runGovernanceChecks({
  form: manifest.form,
  silenceCut: manifest.silenceCut,
  sections: manifest.sections,
  editMoves: manifest.editMoves,
  transitions: manifest.transitions,
  typographyMoveIds: manifest.typographyCueMoveIds,
  sfxCues: manifest.sfxCues,
  soundtrack: manifest.soundtrack,
});
assert(checks.every((c) => c.pass), "All governance checks pass");
assert(manifest.governance.allCausal === true, "Manifest declares allCausal=true");
assert(manifest.governance.checks.length === checks.length, "Manifest carries the full governance checklist");
assert(manifest.governance.josephAuditSources.length === 6, "Policy cites all six Joseph audit sources");

// Deep causal resolution: every CausalRef resolves against real entities.
const sectionIds = new Set(manifest.sections.map((s) => s.sectionId));
const moveIds = new Set(manifest.editMoves.map((m) => m.moveId));
const maxTime = manifest.soundtrack.totalSec + 0.05;
let unresolved = 0;
let invalidGates = 0;
let outOfBounds = 0;

const checkRef = (owner: string, ref: CausalRef) => {
  if (!VALID_GATES.has(ref.gate)) invalidGates++;
  if (ref.sectionId && !sectionIds.has(ref.sectionId)) {
    unresolved++;
    console.error(`  ${owner}: unresolved sectionId ${ref.sectionId}`);
  }
  if (ref.moveId && !moveIds.has(ref.moveId)) {
    unresolved++;
    console.error(`  ${owner}: unresolved moveId ${ref.moveId}`);
  }
  if (ref.timeSec !== undefined && (ref.timeSec < -0.05 || ref.timeSec > maxTime + 0.05)) {
    outOfBounds++;
    console.error(`  ${owner}: timeSec ${ref.timeSec} out of bounds`);
  }
};

manifest.sections.forEach((s) => checkRef(`section ${s.sectionId}`, s.cause));
manifest.silenceCut.keepSegments.forEach((k) => checkRef(`keep ${k.index}`, k.cause));
manifest.editMoves.forEach((m) => checkRef(`move ${m.moveId}`, m.cause));
manifest.transitions.forEach((t) => checkRef(`transition ${t.effectId}`, t.cause));
manifest.sfxCues.forEach((c) => checkRef(`cue ${c.id}`, c.cause));
manifest.soundtrack.sections.forEach((st) => checkRef(`soundtrack ${st.role}`, st.cause));

assert(invalidGates === 0, `All CausalRef gates are valid (${invalidGates} invalid)`);
assert(unresolved === 0, `All CausalRef references resolve (${unresolved} unresolved)`);
assert(outOfBounds === 0, `All CausalRef timestamps are in bounds (${outOfBounds} out of bounds)`);

// Specific causal facts.
const payoffSection = manifest.sections.find((s) => s.role === "payoff");
const emotional = manifest.soundtrack.sections.find((s) => s.role === "emotional_insert");
assert(emotional !== undefined && payoffSection !== undefined && emotional.cause.sectionId === payoffSection.sectionId, "Emotional insert pad traces to the payoff section (AUD-06)");
const transCauseOk = manifest.transitions.every((t) => t.cause.gate === "transition");
assert(transCauseOk, "Every transition cause gate is 'transition'");
const keepCauseOk = manifest.silenceCut.keepSegments.every((k) => k.cause.gate === "silence_cut");
assert(keepCauseOk, "Every keep segment traces to the silence cut (SIL-05)");

// JSON roundtrip.
const json = JSON.stringify(manifest);
const revived = JSON.parse(json) as LandscapeTreatmentManifest;
assert(revived.governance.allCausal === true && revived.sections.length === manifest.sections.length, "Manifest survives JSON roundtrip");

console.log("\n=============================================");
if (passedChecks === totalChecks) {
  console.log(`🎉 CAUSAL CHAIN TESTS PASSED: ${passedChecks}/${totalChecks}`);
} else {
  console.error(`💥 CAUSAL CHAIN TESTS FAILED: ${totalChecks - passedChecks} failures.`);
}
console.log("=============================================");

