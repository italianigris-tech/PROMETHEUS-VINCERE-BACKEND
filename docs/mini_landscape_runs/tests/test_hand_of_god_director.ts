/**
 * Test Suite: The "Hand of God" Compiler & Directive Reconciler (14 Macro Domains)
 *
 * Verifies that the Hand of God engine covers all 14 macro domains:
 * 1. Camera zones
 * 2. Negative treatment
 * 3. Lexicon
 * 4. Cuts
 * 5. Animation
 * 6. Background
 * 7. Audio change suggestion
 * 8. Lists
 * 9. PIP treatment
 * 10. Picture-in-picture style
 * 11. Asset suggestion
 * 12. Framing & reframing
 * 13. B-roll / cutaway strategy
 * 14. Color / visual treatment
 *
 * And strictly enforces the boundary:
 * Typography / Text Hierarchy and Sound Design / SFX are EXCLUDED from LLM control
 * and remain 100% owned by Prometheus Core and the 71 QPs.
 */

import { compileHandOfGodBlueprint, applyHandOfGodDirectives } from "../hand_of_god_director";
import { runLandscapeTreatmentPipeline } from "../landscape_treatment_pipeline";
import type { LandscapeSection, HandOfGodBlueprint } from "../types";

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
console.log("TEST SUITE: HAND OF GOD 14-DOMAIN COMPILER & PLIABLE CAUSAL RECONCILIATION");
console.log("===============================================================================\n");

// TEST GROUP 1: All 14 Macro Domains Coverage
console.log("--- 1. Verification of All 14 Macro Domains ---");

const testSections: LandscapeSection[] = [
  {
    sectionId: "sec_1_hook",
    role: "hook",
    startSec: 0,
    endSec: 15,
    durationSec: 15,
    text: "Welcome back. Today we break down the four core concepts to building a unicorn company.",
    semanticWeight: 0.9,
    commercialPressure: 0.4,
    fatigueRisk: 0.5,
    cause: { gate: "section_role", reason: "test", timeSec: 0 }
  },
  {
    sectionId: "sec_2_negative_idea",
    role: "setup",
    startSec: 15,
    endSec: 35,
    durationSec: 20,
    text: "Most people have a completely broken idea of what product market fit really means and their camera lens gives out.",
    semanticWeight: 0.8,
    commercialPressure: 0.5,
    fatigueRisk: 0.6,
    cause: { gate: "section_role", reason: "test", timeSec: 15 }
  },
  {
    sectionId: "sec_3_list_pillars",
    role: "demonstrate",
    startSec: 35,
    endSec: 65,
    durationSec: 30,
    text: "First, rapid experimentation. Second, unit economics. Third, hyper-retention.",
    semanticWeight: 0.85,
    commercialPressure: 0.6,
    fatigueRisk: 0.5,
    cause: { gate: "section_role", reason: "test", timeSec: 35 }
  },
  {
    sectionId: "sec_4_calendar_pip",
    role: "explain",
    startSec: 65,
    endSec: 90,
    durationSec: 25,
    text: "Let me pull up my calendar screen so you can see the dynamic workflow layout.",
    semanticWeight: 0.75,
    commercialPressure: 0.5,
    fatigueRisk: 0.6,
    cause: { gate: "section_role", reason: "test", timeSec: 65 }
  }
];

const blueprint = compileHandOfGodBlueprint(testSections);

assert(blueprint.directives.length === testSections.length, `Compiled ${testSections.length} section directives`);

const d1 = blueprint.directives[0];
const d2 = blueprint.directives[1];
const d3 = blueprint.directives[2];
const d4 = blueprint.directives[3];

// 1. Camera zones
assert(d1.cameraZones.intent === "slow_zoom_in", "1. Camera Zones: Hook has slow_zoom_in");
assert(d2.cameraZones.intent === "punch_in", "1. Camera Zones: Negative crisis has punch_in");

// 2. Negative treatment
assert(d2.negativeTreatment.isNegative === true, "2. Negative Treatment: Detected crisis");
assert(d2.negativeTreatment.shockwaveEffect === "optical_fracture", "2. Negative Treatment: Optical fracture for broken lens");

// 3. Lexicon
assert(d2.lexicon.triggerTokens.includes("camera") || d2.lexicon.triggerTokens.includes("idea"), "3. Lexicon: Extracted trigger tokens");

// 4. Cuts
assert(d1.cuts.cadence === "rapid", "4. Cuts: Hook has rapid cut cadence");

// 5. Animation
assert(d1.animation.motionMode === "2.5D_parallax", "5. Animation: Configured 2.5D parallax with velocity ratios");

// 6. Background
assert(d1.background.rigKind === "cinematic_environment", "6. Background: Hook has cinematic environment");
assert(d2.background.stageLighting === "ember_crisis", "6. Background: Crisis has ember lighting");

// 7. Audio change suggestion
assert(d2.audioChangeSuggestion.energyDelta < 0, "7. Audio Suggestion: Negative crisis dips energy");
assert(d2.audioChangeSuggestion.tensionLevel === "drop", "7. Audio Suggestion: Drop tension on failure");

// 8. Lists
assert(d3.lists.isList === true, "8. Lists: Section 3 marked as isList=true");
assert(d3.lists.pillarCount === 3, "8. Lists: Pillar count 3 extracted");

// 9. PIP treatment
assert(d4.pipTreatment.required === true, "9. PIP Treatment: Screen demonstration requires PiP");
assert(d4.pipTreatment.position === "top_right", "9. PIP Treatment: Positioned top_right");

// 10. Picture-in-picture style
assert(d4.pipStyle.stylePreset === "screencast_feed", "10. PIP Style: Preset screencast_feed selected");

// 11. Asset suggestion
assert(d2.assetSuggestion.suggestedAsset === "broken_light_bulb" || d2.assetSuggestion.suggestedAsset === "fractured_lens_schematic", "11. Asset Suggestion: Suggested diagnostic asset");
assert(d2.assetSuggestion.placementPlane === "flank_shoulder" || d2.assetSuggestion.placementPlane === "behind_speaker", "11. Asset Suggestion: Placed behind or flanking speaker");

// 12. Framing & reframing
assert(d3.framingReframing.speakerFraming === "split_screen_right_30", "12. Framing & Reframing: List triggers split_screen_right_30");
assert(d3.framingReframing.mattingMaskRequired === true, "12. Framing & Reframing: Matting mask required for offset");

// 13. B-roll / cutaway strategy
assert(d4.brollCutawayStrategy.cutawayStrategy === "split_canvas", "13. B-roll / Cutaway Strategy: Screen demo uses split_canvas");

// 14. Color / visual treatment
assert(d2.colorVisualTreatment.textureKind === "retro_authentic", "14. Color/Visual Treatment: Crisis uses retro scanlines");
assert(d3.colorVisualTreatment.textureKind === "paper_fiber", "14. Color/Visual Treatment: List uses paper fiber");

// TEST GROUP 2: Strict Isolation Check (Typography & SFX Excluded)
console.log("\n--- 2. Strict Isolation Check (Typography & SFX Excluded) ---");
let hasExcludedFields = false;
blueprint.directives.forEach((d: any) => {
  if (d.fontSize || d.fontFamily || d.textShadow || d.sfxFile || d.soundEffectUrl || d.gradientStops) {
    hasExcludedFields = true;
  }
});
assert(!hasExcludedFields, "Typography / Text Hierarchy and Sound Design / SFX are 100% EXCLUDED from LLM blueprint");

// TEST GROUP 3: Pipeline Ingestion & Reconciled Manifest
console.log("\n--- 3. Pipeline Ingestion & Reconciled Manifest ---");
const manifest = runLandscapeTreatmentPipeline({
  transcript: [
    { startSec: 0, endSec: 15, text: "Hook sentence." },
    { startSec: 15, endSec: 35, text: "Setup crisis sentence." },
    { startSec: 35, endSec: 65, text: "First, pillar one. Second, pillar two. Third, pillar three." },
    { startSec: 65, endSec: 95, text: "Demonstrate workflow screen." },
    { startSec: 95, endSec: 140, text: "Payoff metric numbers." },
    { startSec: 140, endSec: 180, text: "Outro conclusion." }
  ]
});

assert(manifest.handOfGodBlueprint !== undefined, "Manifest carries handOfGodBlueprint");
assert(manifest.handOfGodBlueprint?.directives.length === 6, "All 6 sections have full 14-area Hand of God directives");

console.log(`\n===============================================================================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`===============================================================================\n`);

if (failed > 0) {
  process.exit(1);
}
