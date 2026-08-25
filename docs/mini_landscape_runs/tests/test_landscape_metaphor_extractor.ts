/**
 * Test Suite: Metaphor & Texture Placement Detection Engine
 *
 * Verifies that the Metaphor & Texture Detection Engine:
 * 1. Accurately maps metaphor triggers like "king in the playing field" to 3D Chess King + kinetic beams.
 * 2. Maps growth, engine, security vault, and dialogue triggers to distinct 2.5D visual assets.
 * 3. Schedules precise texture placements (tactile, retro/authentic, paper fiber, film grain) with spiral curves.
 * 4. Yields a structured, data-driven ledger with editorial rationale and creativity prompts.
 */

import { extractMetaphorTreatmentPoints } from "../landscape_metaphor_extractor";
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
console.log("TEST SUITE: METAPHOR & TEXTURE PLACEMENT DETECTION ENGINE");
console.log("===============================================================================\n");

// 1. Test Specific Metaphor Trigger Sentences (including User's Chess King example)
console.log("--- 1. Metaphor Trigger Accuracy ---");

const chessSection: LandscapeSection = {
  sectionId: "sec_1_strategy",
  role: "hook",
  startSec: 0,
  endSec: 15,
  durationSec: 15,
  text: "To be a king in the playing field, you need total tactical dominance.",
  semanticWeight: 0.9,
  commercialPressure: 0.4,
  fatigueRisk: 0.5,
  cause: { gate: "section_role", reason: "strategy test", timeSec: 0 }
};

const growthSection: LandscapeSection = {
  sectionId: "sec_2_growth",
  role: "payoff",
  startSec: 15,
  endSec: 35,
  durationSec: 20,
  text: "Our revenue surged 10x with exponential growth across all regions.",
  semanticWeight: 0.95,
  commercialPressure: 0.8,
  fatigueRisk: 0.6,
  cause: { gate: "section_role", reason: "growth test", timeSec: 15 }
};

const engineSection: LandscapeSection = {
  sectionId: "sec_3_engine",
  role: "explain",
  startSec: 35,
  endSec: 60,
  durationSec: 25,
  text: "Look at the core machine and gears behind our automated system architecture.",
  semanticWeight: 0.8,
  commercialPressure: 0.5,
  fatigueRisk: 0.7,
  cause: { gate: "section_role", reason: "engine test", timeSec: 35 }
};

const vaultSection: LandscapeSection = {
  sectionId: "sec_4_vault",
  role: "demonstrate",
  startSec: 60,
  endSec: 85,
  durationSec: 25,
  text: "Here is how you unlock the secret vault and break through the hidden barrier.",
  semanticWeight: 0.85,
  commercialPressure: 0.6,
  fatigueRisk: 0.5,
  cause: { gate: "section_role", reason: "vault test", timeSec: 60 }
};

const transcript = [
  { startSec: 0, endSec: 15, text: "To be a king in the playing field, you need total tactical dominance." },
  { startSec: 15, endSec: 35, text: "Our revenue surged 10x with exponential growth across all regions." },
  { startSec: 35, endSec: 60, text: "Look at the core machine and gears behind our automated system architecture." },
  { startSec: 60, endSec: 85, text: "Here is how you unlock the secret vault and break through the hidden barrier." }
];

const points = extractMetaphorTreatmentPoints(
  [chessSection, growthSection, engineSection, vaultSection],
  transcript
);

assert(points.length === 4, "Extracted exactly 4 metaphor treatment points");

// Check Chess King Point
const chessPt = points.find(p => p.sectionId === "sec_1_strategy");
assert(chessPt !== undefined, "Found strategy point");
if (chessPt) {
  assert(chessPt.metaphorCategory === "chess_king_strategy", "Categorized as chess_king_strategy");
  assert(chessPt.recommendedAsset.assetName === "3d_chess_king_piece", "Recommended 3d_chess_king_piece asset");
  assert(chessPt.recommendedAsset.beamCalloutText?.includes("KING"), "Beam callout highlights the King keyword");
  assert(chessPt.texturePlacement.kind === "tactile", "Paired with tactile texture treatment");
  assert(chessPt.texturePlacement.spiralCurve === "exponential_bloom", "Uses exponential_bloom spiral curve");
}

// Check Growth Surge Point
const growthPt = points.find(p => p.sectionId === "sec_2_growth");
assert(growthPt !== undefined, "Found growth point");
if (growthPt) {
  assert(growthPt.metaphorCategory === "growth_surge", "Categorized as growth_surge");
  assert(growthPt.recommendedAsset.assetName === "progressive_climbing_spline", "Recommended progressive_climbing_spline");
  assert(growthPt.texturePlacement.kind === "retro_authentic", "Paired with retro_authentic CRT scanline texture");
}

// Check Engine Machinery Point
const enginePt = points.find(p => p.sectionId === "sec_3_engine");
assert(enginePt !== undefined, "Found engine point");
if (enginePt) {
  assert(enginePt.metaphorCategory === "mechanical_engine", "Categorized as mechanical_engine");
  assert(enginePt.recommendedAsset.assetName === "3d_interconnected_gears", "Recommended 3d_interconnected_gears");
  assert(enginePt.texturePlacement.kind === "paper_fiber", "Paired with paper_fiber texture");
}

// Check Security Vault Point
const vaultPt = points.find(p => p.sectionId === "sec_4_vault");
assert(vaultPt !== undefined, "Found vault point");
if (vaultPt) {
  assert(vaultPt.metaphorCategory === "security_vault", "Categorized as security_vault");
  assert(vaultPt.recommendedAsset.assetName === "holographic_key_vault", "Recommended holographic_key_vault");
  assert(vaultPt.texturePlacement.kind === "grain_film", "Paired with grain_film texture");
}

// TEST GROUP 2: Pipeline Integration & Ledger Completeness
console.log("\n--- 2. Pipeline Integration & Ledger Completeness ---");
const manifest = runLandscapeTreatmentPipeline({
  transcript
});

assert(Array.isArray(manifest.metaphorTreatments), "manifest.metaphorTreatments is an array");
assert(manifest.metaphorTreatments.length === manifest.sections.length, `Metaphor ledger covers all ${manifest.sections.length} sections`);

let allLedgerFieldsValid = true;
manifest.metaphorTreatments.forEach((pt) => {
  if (!pt.pointId || !pt.spokenSnippet || !pt.recommendedAsset.visualDescription || !pt.editorialRationale || !pt.creativityLayer.creativePrompt) {
    allLedgerFieldsValid = false;
  }
  if (pt.creativityLayer.aestheticScore < 0 || pt.creativityLayer.aestheticScore > 10) {
    allLedgerFieldsValid = false;
  }
});
assert(allLedgerFieldsValid, "All metaphor treatment points carry valid assets, descriptions, rationales, and aesthetic scores");

console.log(`\n===============================================================================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`===============================================================================\n`);

if (failed > 0) {
  process.exit(1);
}
