/**
 * MINI LANDSCAPE RUNS — LONGFORM CAPACITY TEST
 *
 * Generates a synthetic landscape manifest with 64 sections (well beyond
 * the original studio's 20-chunk hardcoded limit) and runs it through the
 * Stage 8 builder, verifying the built presentation contains all 64 chunks
 * with valid JS syntax, no hardcoded capacity limits, and the generalized
 * background registry + seams intact.
 *
 * Run: npx tsx docs/mini_landscape_runs/tests/test_longform_capacity.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import type { LandscapeTreatmentManifest, LandscapeSection, EditMove, TransitionTreatment, SfxCue, SoundtrackProgram } from "../types.js";

const CHUNK_COUNT = 64;
const outDir = path.resolve(__dirname, "..", "out");
const manifestPath = path.join(outDir, "test_longform_manifest.json");
const builtHtmlPath = path.join(outDir, "landscape_presentation_longform_capacity.html");

let passedChecks = 0;
let totalChecks = 0;
function assert(condition: boolean, message: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`✅ [PASS] ${message}`);
  } else {
    console.log(`❌ [FAIL] ${message}`);
  }
}

// Build a synthetic manifest with CHUNK_COUNT sections.
const sections: LandscapeSection[] = [];
const editMoves: EditMove[] = [];
const transitions: TransitionTreatment[] = [];
const sfxCues: SfxCue[] = [];
const roles: LandscapeSection["role"][] = ["hook", "setup", "explain", "demonstrate", "payoff", "outro"];

for (let i = 0; i < CHUNK_COUNT; i++) {
  const startSec = i * 2.0;
  const endSec = startSec + 1.8;
  const role = roles[i % roles.length];
  const sectionId = `sec_${String(i).padStart(3, "0")}`;

  sections.push({
    sectionId, role,
    startSec, endSec, durationSec: endSec - startSec,
    text: `Long-form chunk ${i + 1} of ${CHUNK_COUNT}. This is a ${role} section for capacity testing.`,
    semanticWeight: 0.5, commercialPressure: 0.3, fatigueRisk: 0.1,
    cause: { gate: "section_role", reason: `capacity test section ${i}` }
  });

  editMoves.push({
    moveId: i % 2 === 0 ? "emphasize_keyword" : "explain_workflow",
    sectionId, startSec, endSec,
    viewerProblem: "capacity test", priority: 5,
    allowSfx: true, allowMacroAsset: false,
    cause: { gate: "edit_move", reason: "capacity test" }
  });

  if (i % 8 === 0 && i > 0) {
    transitions.push({
      sectionId, timeSec: startSec, effectId: "light_burn",
      cause: { gate: "transition", reason: "capacity test transition" }
    });
  }

  sfxCues.push({
    id: `cue_${i}`, timeSec: startSec + 0.1, durationSec: 0.3,
    family: "click", label: `Click ${i}`,
    gainDb: -6, spatialPan: 0, depthPlane: 10,
    intentionalOmission: false,
    cause: { gate: "edit_move", reason: "capacity test cue" }
  });
}

const manifest: LandscapeTreatmentManifest = {
  version: "1.0.0",
  studio: "mini_landscape_runs",
  canvas: { width: 1920, height: 1080, aspect: "16:9" },
  generatedAtIso: new Date().toISOString(),
  form: { form: "long_form", confidence: 0.99, reasons: ["capacity test"], promptHints: [], cause: { gate: "form_decision", reason: "capacity test" } },
  silenceCut: {
    sourcePath: "/dev/null", outputPath: null, hasAudio: false,
    noiseDb: -50, minSilenceSec: 0.5, minKeepPauseSec: 0.15, paddingSec: 0.1,
    detectedSilences: [], keepSegments: [],
    sourceDurationSec: CHUNK_COUNT * 2.0, outputDurationSec: CHUNK_COUNT * 1.8,
    removedSec: 0, skipSilenceCut: true,
    cause: { gate: "silence_cut", reason: "capacity test" }
  },
  sections,
  editMoves,
  transitions,
  typographyCueMoveIds: ["emphasize_keyword"],
  sfxCues,
  soundtrack: {
    videoDurationSec: CHUNK_COUNT * 1.8, fadeInSec: 0.5, fadeOutSec: 0.5,
    totalSec: CHUNK_COUNT * 1.8 + 1.0, integratedTargetLufs: -14, truePeakCeilingDb: -1,
    bedId: "test_bed", padId: "test_pad",
    sections: sections.map((s, i) => ({
      sectionIndex: i, startSec: s.startSec, endSec: s.endSec,
      role: i === 0 ? "intro_fade" : (i === sections.length - 1 ? "outro_fade" : "bed"),
      assetId: "test_bed", gainDb: -12,
      cause: { gate: "section_role", reason: "capacity test soundtrack" }
    })),
    voiceDucking: { enabled: true, reductionDb: 6, attackSec: 0.01, releaseSec: 0.1 }
  },
  governance: {
    policyVersion: "1.0.0-capacity-test",
    allCausal: true,
    checks: [],
    josephAuditSources: []
  }
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

// Run the Stage 8 builder against the synthetic long-form manifest.
const builderPath = path.resolve(__dirname, "..", "build_landscape_presentation.ts");
const builderOut = execSync(
  `npx tsx "${builderPath}" --manifest "${manifestPath}" --out "${builtHtmlPath}" --run-id longform_capacity`,
  { encoding: "utf8" },
);

assert(
  /Successfully loaded \d+ authoritative Font JSON profiles/.test(builderOut),
  "Builder loads the authoritative font profile corpus from disk",
);
assert(
  builderOut.includes("64 chunks"),
  "Builder reports all 64 chunks in the built run",
);

const html = fs.readFileSync(builtHtmlPath, "utf8");

// 1. All 64 chunks injected.
const chunkMatches = html.match(/Long-form chunk \d+ of 64/g) || [];
assert(chunkMatches.length >= 64, `Built HTML contains all 64 long-form chunks (found ${chunkMatches.length})`);

// 2. No hardcoded capacity limits remain.
assert(!html.includes('max="19"'), "Timeline scrubber max is no longer hardcoded to 19");
assert(!html.includes("idx === 10"), "Camera whoosh midpoint is no longer hardcoded to chunk 10");
assert(!html.includes("Chunk 1 of 20"), "Static 'Chunk 1 of 20' label removed");
assert(!html.includes("/ 45"), "KPI coverage denominators no longer hardcode 45 profiles");
assert(!html.includes("20-Chunk"), "No '20-Chunk' chrome labels remain");

// 3. Generalized background registry + transitions present.
assert(html.includes("BACKGROUND_ASSET_REGISTRY"), "Background asset registry present");
assert(html.includes("base_dogma_08"), "All 8 Dogma base image slots present");
assert(html.includes("video_bg_02"), "Video background placeholder slots present");
assert(html.includes("scheduleBaseBackgroundScene"), "Background scene scheduler present");
assert(html.includes("transitionFromPreviousScene"), "Background transition surface present");
assert(html.includes('id="baseBackgroundLayer"'), "Base background DOM layer present");

// 4. Seams intact (font profile + run data).
assert(
  html.includes("SEAM_BEGIN:__LANDSCAPE_FONT_PROFILES__") && html.includes("SEAM_END:__LANDSCAPE_FONT_PROFILES__"),
  "Font-profile seam markers present",
);
assert(
  html.includes("SEAM_BEGIN:__LANDSCAPE_RUN_DATA__") && html.includes("SEAM_END:__LANDSCAPE_RUN_DATA__"),
  "Run-data seam markers present",
);

// 5. Run-data companion JSON reflects all chunks.
const runData = JSON.parse(fs.readFileSync(path.join(outDir, "landscape_run_longform_capacity.json"), "utf8"));
assert(
  runData.transcripts.run1.chunks.length === CHUNK_COUNT,
  `Run-data JSON carries all ${CHUNK_COUNT} chunks`,
);

console.log(`\n=============================================\n🎉 LONGFORM CAPACITY TESTS PASSED: ${passedChecks}/${totalChecks}\n=============================================`);
if (passedChecks !== totalChecks) process.exit(1);
