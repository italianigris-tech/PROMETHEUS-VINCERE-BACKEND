/**
 * Test Suite: Unified Background Utilities & Background Coverage Engine
 *
 * Verifies:
 * 1. UNIFIED_TEXTURE_CATALOG indexes all 44 Texturelabs assets across 5 families (Fabric, Paper, InkPaint, Grunge, Glass).
 * 2. UNIFIED_VIDEO_CATALOG indexes all 11 landscape b-roll & proof video assets.
 * 3. Dynamic Background Coverage Engine: Generates frame-accurate BackgroundCoveragePlan entries.
 * 4. Strict Budgeting & Sparsity: Only 1-2 high-salience moments fire; majority remain clean_anchor A-roll.
 * 5. List stacks map to Paper Fiber 350XL with 30% right speaker offset.
 * 6. Pipeline manifest assembly embeds backgroundCoverages covering 100% of the timeline.
 */

import * as fs from "fs";
import * as path from "path";
import { UNIFIED_TEXTURE_CATALOG, UNIFIED_VIDEO_CATALOG, scheduleBackgroundCoverages } from "../landscape_background_catalog";
import { runLandscapeTreatmentPipeline } from "../landscape_treatment_pipeline";
import type { LandscapeSection } from "../types";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`✅ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${msg}`);
    failed++;
  }
}

console.log("===============================================================================");
console.log("TEST SUITE: UNIFIED BACKGROUND UTILITIES & BACKGROUND COVERAGE ENGINE");
console.log("===============================================================================\n");

// TEST GROUP 1: Texture & Video Asset Catalog Integrity
console.log("--- 1. Catalog Integrity & Physical Asset Presence ---");

assert(UNIFIED_TEXTURE_CATALOG.length === 44, `Texture catalog has 44 assets (got ${UNIFIED_TEXTURE_CATALOG.length})`);

const families = new Set(UNIFIED_TEXTURE_CATALOG.map(t => t.family));
assert(families.has("fabric"), "Catalog includes fabric family (14 assets)");
assert(families.has("paper"), "Catalog includes paper family (24 assets)");
assert(families.has("ink_paint"), "Catalog includes ink_paint family (4 assets)");
assert(families.has("grunge"), "Catalog includes grunge family (1 asset)");
assert(families.has("glass"), "Catalog includes glass family (1 asset)");

// Check physical disk existence of texture assets
let allTexturesExist = true;
const repoRoot = path.resolve(__dirname, "../../..");
UNIFIED_TEXTURE_CATALOG.forEach(tex => {
  const fullPath = path.join(repoRoot, tex.filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Missing texture: ${fullPath}`);
    allTexturesExist = false;
  }
});
assert(allTexturesExist, "All 44 Texturelabs texture files physically exist on disk");

assert(UNIFIED_VIDEO_CATALOG.length === 11, `Video catalog has 11 assets (got ${UNIFIED_VIDEO_CATALOG.length})`);

// TEST GROUP 2: Dynamic Background Coverage Scheduling & Sparsity
console.log("\n--- 2. Dynamic Background Coverage Scheduling & Sparsity ---");

const testSections: LandscapeSection[] = [
  {
    sectionId: "sec_1_hook",
    role: "hook",
    startSec: 0,
    endSec: 15,
    durationSec: 15,
    text: "Welcome back. Today we reveal the biggest growth secret in modern business.",
    semanticWeight: 0.9,
    commercialPressure: 0.4,
    fatigueRisk: 0.5,
    cause: { gate: "section_role", reason: "test", timeSec: 0 }
  },
  {
    sectionId: "sec_2_crisis",
    role: "setup",
    startSec: 15,
    endSec: 35,
    durationSec: 20,
    text: "Last week our primary camera lens broke and completely gave out in the middle of production.",
    semanticWeight: 0.8,
    commercialPressure: 0.5,
    fatigueRisk: 0.6,
    cause: { gate: "section_role", reason: "test", timeSec: 15 }
  },
  {
    sectionId: "sec_3_list",
    role: "explain",
    startSec: 35,
    endSec: 65,
    durationSec: 30,
    text: "First, rapid experimentation. Second, unit economics. Third, retention.",
    semanticWeight: 0.85,
    commercialPressure: 0.6,
    fatigueRisk: 0.5,
    cause: { gate: "section_role", reason: "test", timeSec: 35 }
  },
  {
    sectionId: "sec_4_screencast",
    role: "demonstrate",
    startSec: 65,
    endSec: 90,
    durationSec: 25,
    text: "Let me pull up my calendar screen so you can see the dynamic workflow.",
    semanticWeight: 0.75,
    commercialPressure: 0.5,
    fatigueRisk: 0.6,
    cause: { gate: "section_role", reason: "test", timeSec: 65 }
  }
];

const coverages = scheduleBackgroundCoverages(testSections, []);

assert(coverages.length === 4, "Scheduled exactly 4 background coverage plans (matching section count)");

// In this 90s test run, strict budgeting ensures only the #1 candidate (List) fires active coverage; others remain clean anchor
const activeCoverages = coverages.filter(c => c.coverageType !== "clean_anchor");
assert(activeCoverages.length === 1, `Budgeted Sparsity: exactly 1 active coverage scheduled (got ${activeCoverages.length})`);

// Check List -> Paper Fiber 350XL + Split Screen Right 30%
const cov3 = coverages.find(c => c.sectionId === "sec_3_list");
assert(cov3 !== undefined, "Found list coverage");
if (cov3) {
  assert(cov3.coverageType === "motion_stage_composite", "List assigned motion_stage_composite");
  assert(cov3.textureAsset?.id === "tex_paper_350", "List mapped to Charcoal Fiber 350XL");
  assert(cov3.stageComposite?.mattingMaskRequired === true, "List requires speaker matting mask");
  assert(cov3.stageComposite?.speakerOffsetX === 0.30, "List offsets speaker by 30% to the right");
}

// Check isolated Screencast test
const screencastOnly = scheduleBackgroundCoverages([testSections[3]], []);
assert(screencastOnly[0].coverageType === "motion_stage_composite", "Isolated screencast receives motion_stage_composite");
assert(screencastOnly[0].textureAsset?.id === "tex_glass_121", "Screencast mapped to Frosted Glass 121L");

// Check isolated Crisis test
const crisisOnly = scheduleBackgroundCoverages([testSections[1]], []);
assert(crisisOnly[0].coverageType === "texture_overlay", "Isolated crisis receives texture_overlay");
assert(crisisOnly[0].textureAsset?.id === "tex_paper_274", "Crisis mapped to Pressed Charcoal Pulp 274XL");

// TEST GROUP 3: Pipeline Integration & Manifest Ledger
console.log("\n--- 3. Pipeline Integration & Manifest Ledger ---");
const manifest = runLandscapeTreatmentPipeline({
  transcript: [
    { startSec: 0, endSec: 15, text: "Hook text." },
    { startSec: 15, endSec: 35, text: "Crisis text." },
    { startSec: 35, endSec: 65, text: "List text." },
    { startSec: 65, endSec: 95, text: "Screen text." },
    { startSec: 95, endSec: 140, text: "Payoff text." },
    { startSec: 140, endSec: 180, text: "Outro text." }
  ]
});

assert(Array.isArray(manifest.backgroundCoverages), "manifest.backgroundCoverages is an array");
assert(manifest.backgroundCoverages.length === manifest.sections.length, `Background coverages cover all ${manifest.sections.length} sections`);

console.log(`\n===============================================================================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`===============================================================================\n`);

if (failed > 0) {
  process.exit(1);
}
