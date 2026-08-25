/**
 * Test Suite: Dedicated Zoom Engine & Cinematic Velocity Curves
 *
 * Verifies the 3 Authoritative Broadcast Velocity Curves:
 * 1. The Standard Cinematic Push (Smooth S-Curve, 180° Shutter Motion Blur, Pinned Anchor Point).
 * 2. The Dramatic Whiplash Zoom (Fast-In, Slow-Out Ski Slope, 360° Shutter Motion Blur).
 * 3. The Rebound / Snap Zoom (3-Keyframe Elastic Overshoot + Spring Settle).
 * 4. Transform Effect contract & uncoupled shutter angle (180°/360°).
 * 5. Pinned Anchor Point Crosshairs (host_eyes at 960, 420).
 * 6. Strict Anti-Fatigue Governance (>= 3.0s minimum gap, <= 1.25x scale ceiling).
 */

import { scheduleBackgroundCoverages } from "../landscape_background_catalog";
import { buildZoomPlan } from "../landscape_zoom_engine";
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
console.log("TEST SUITE: DEDICATED ZOOM ENGINE & CINEMATIC VELOCITY CURVES");
console.log("===============================================================================\n");

// TEST GROUP 1: Background Sparsity Enforcement
console.log("--- 1. Background Sparsity & Budgeting (Anti-Oversaturation) ---");

const coachSections: LandscapeSection[] = [
  { sectionId: "sec_1", role: "hook", startSec: 0, endSec: 16, durationSec: 16, text: "Most business owners think they have a marketing problem when really, they have an offer problem.", semanticWeight: 0.85, commercialPressure: 0.5, fatigueRisk: 0.4, cause: { gate: "section_role", reason: "test", timeSec: 0 } },
  { sectionId: "sec_2", role: "setup", startSec: 16, endSec: 36, durationSec: 20, text: "And if your offer isn't strong enough to sell itself you're going to spend twice as much money trying to convince people.", semanticWeight: 0.75, commercialPressure: 0.4, fatigueRisk: 0.5, cause: { gate: "section_role", reason: "test", timeSec: 16 } },
  { sectionId: "sec_3", role: "explain", startSec: 36, endSec: 68, durationSec: 32, text: "That's why I always tell people to start with the actual outcome. What does your customer really want to achieve?", semanticWeight: 0.8, commercialPressure: 0.4, fatigueRisk: 0.5, cause: { gate: "section_role", reason: "test", timeSec: 36 } },
  { sectionId: "sec_4", role: "explain", startSec: 68, endSec: 108, durationSec: 40, text: "Because nobody wakes up wanting your software. They want the result your software creates. And once you understand that your entire business changes.", semanticWeight: 0.85, commercialPressure: 0.5, fatigueRisk: 0.5, cause: { gate: "section_role", reason: "test", timeSec: 68 } },
  { sectionId: "sec_5", role: "demonstrate", startSec: 108, endSec: 136, durationSec: 28, text: "Your messaging gets clearer. Your sales process gets easier. And suddenly, you're not chasing customers anymore.", semanticWeight: 0.9, commercialPressure: 0.6, fatigueRisk: 0.4, cause: { gate: "section_role", reason: "test", timeSec: 108 } },
  { sectionId: "sec_6", role: "payoff", startSec: 136, endSec: 172, durationSec: 36, text: "They're actually paying attention to you. But here's where most people completely screw this up. They try to scale something that hasn't even been proven yet.", semanticWeight: 0.95, commercialPressure: 0.7, fatigueRisk: 0.5, cause: { gate: "section_role", reason: "test", timeSec: 136 } },
  { sectionId: "sec_7", role: "payoff", startSec: 172, endSec: 204, durationSec: 32, text: "Don't build a machine before you know it works. Prove it first. Then scale.", semanticWeight: 1.0, commercialPressure: 0.8, fatigueRisk: 0.3, cause: { gate: "section_role", reason: "test", timeSec: 172 } }
];

const coverages = scheduleBackgroundCoverages(coachSections, []);
const activeCoverages = coverages.filter(c => c.coverageType !== "clean_anchor");
const cleanAnchors = coverages.filter(c => c.coverageType === "clean_anchor");

assert(activeCoverages.length === 1, `Strict Sparsity: exactly 1 background coverage selected in 2-minute video (got ${activeCoverages.length})`);
assert(activeCoverages[0].sectionId === "sec_5", "Selected coverage is Section 5 (3-pillar transformation: clearer, easier, not chasing)");
assert(activeCoverages[0].stageComposite?.speakerOffsetX === 0.30, "Section 5 offsets speaker 30% to the right for motion graphics");
assert(cleanAnchors.length === 6, `Default A-Roll: 6/7 sections remain clean anchor talking head (got ${cleanAnchors.length})`);

// TEST GROUP 2: The 3 Cinematic Velocity Curves
console.log("\n--- 2. The 3 Cinematic Velocity Curves & Motion Blur ---");
const zoomPlan = buildZoomPlan(coachSections, coverages, []);

assert(zoomPlan.cues.length > 0, `Generated ${zoomPlan.cues.length} zoom cues`);

// Curve 2 Check: Dramatic Whiplash Zoom on Section 6 Return-to-Authority
const whiplashCue = zoomPlan.cues.find(c => c.curveKind === "whiplash_zoom" && c.kind === "return_to_authority_punch");
assert(whiplashCue !== undefined, "Found Whiplash Zoom on return_to_authority_punch");
if (whiplashCue) {
  assert(whiplashCue.cssBezier === "cubic-bezier(0.08, 0.95, 0.15, 1.0)", "Whiplash Zoom applies steep ski-slope bezier");
  assert(whiplashCue.transformEffect.shutterAngleDeg === 360, "Whiplash Zoom enables 360° Shutter Angle Motion Blur");
  assert(whiplashCue.transformEffect.anchorPointCrosshair.targetLabel === "host_eyes", "Anchor Point pinned to host_eyes crosshair (960, 420)");
}

// Curve 3 Check: Rebound / Snap Zoom with 3-Keyframe Elastic Overshoot
const reboundCue = zoomPlan.cues.find(c => c.curveKind === "rebound_snap_zoom");
assert(reboundCue !== undefined, "Found Rebound Snap Zoom on high-emphasis climax");
if (reboundCue) {
  assert(reboundCue.keyframes.length === 3, "Rebound Zoom has exactly 3 keyframes (Base -> Overshoot -> Settle)");
  assert(reboundCue.keyframes[0].scale === 1.0, "Keyframe 1 is 1.0x Base Scale");
  assert(reboundCue.keyframes[1].scale === 1.23, "Keyframe 2 is 1.23x Overshot Scale");
  assert(reboundCue.keyframes[2].scale === 1.18, "Keyframe 3 is 1.18x Final Resting Scale");
  assert(reboundCue.keyframes[1].interpolation === "continuous_bezier", "Keyframe 2 uses Continuous Bezier for elastic bounce");
  assert(reboundCue.transformEffect.shutterAngleDeg === 360, "Rebound Zoom uses 360° Shutter Angle Motion Blur");
}

// Curve 1 Check: Standard Cinematic Push (Smooth S-Curve)
const sCurveCue = zoomPlan.cues.find(c => c.curveKind === "standard_cinematic_push");
assert(sCurveCue !== undefined, "Found Standard Cinematic Push on building argument");
if (sCurveCue) {
  assert(sCurveCue.cssBezier === "cubic-bezier(0.42, 0.0, 0.58, 1.0)", "Standard Push applies symmetrical S-Curve bezier");
  assert(sCurveCue.transformEffect.shutterAngleDeg === 180, "Standard Push uses 180° Shutter Angle Motion Blur");
  assert(sCurveCue.transformEffect.anchorPointCrosshair.targetLabel === "host_chest", "Standard Push anchors to host_chest");
}

// TEST GROUP 3: Transform Effect & Motion Blur Pro-Tips
console.log("\n--- 3. Transform Effect & Motion Blur Pro-Tips ---");
const allUseTransformEffect = zoomPlan.cues.every(c => c.transformEffect.effectName === "Transform");
assert(allUseTransformEffect, "All zooms use internal Transform Effect keyframing (not default Motion tab)");

const allUncheckCompShutter = zoomPlan.cues.every(c => c.transformEffect.uncheckCompShutter === true);
assert(allUncheckCompShutter, "All zooms uncheck 'Use Composition Shutter Angle' for custom 180°/360° blur");

const allMotionBlurEnabled = zoomPlan.cues.every(c => c.transformEffect.motionBlur === true);
assert(allMotionBlurEnabled, "All zooms have active directional motion blur enabled");

// TEST GROUP 4: Anti-Fatigue Governance
console.log("\n--- 4. Anti-Fatigue Governance ---");
let minGapViolated = false;
for (let i = 0; i < zoomPlan.cues.length - 1; i++) {
  const current = zoomPlan.cues[i];
  const next = zoomPlan.cues[i + 1];
  if (next.startSec - current.endSec < 2.9) {
    minGapViolated = true;
    console.error(`Gap violation between ${current.zoomId} and ${next.zoomId}`);
  }
}
assert(!minGapViolated, "All zoom cues maintain >= 3.0s minimum anti-fatigue gap");

const maxScaleExceeded = zoomPlan.cues.some(c => c.endScale > 1.25 || c.startScale > 1.25 || (c.overshootScale && c.overshootScale > 1.25));
assert(!maxScaleExceeded, "No zoom cue exceeds 1.25x scale ceiling");

// TEST GROUP 5: Full Pipeline Manifest Integration
console.log("\n--- 5. Full Pipeline Manifest Integration ---");
const manifest = runLandscapeTreatmentPipeline({
  transcript: coachSections.map(s => ({ startSec: s.startSec, endSec: s.endSec, text: s.text }))
});

assert(manifest.zoomPlan !== undefined, "manifest.zoomPlan is populated");
assert(Array.isArray(manifest.zoomCues), "manifest.zoomCues is an array");
assert(manifest.zoomPlan?.governance.antiFatigueEnforced === true, "Governance antiFatigueEnforced is true");
assert(manifest.zoomPlan?.governance.motionBlurValidated === true, "Governance motionBlurValidated is true (all 180°/360° shutter angles confirmed)");

console.log(`\n===============================================================================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`===============================================================================\n`);

if (failed > 0) {
  process.exit(1);
}
