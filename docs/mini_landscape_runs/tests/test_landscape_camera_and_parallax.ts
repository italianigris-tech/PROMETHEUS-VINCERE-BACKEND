/**
 * Test Suite: Landscape Camera System + 2.5D Parallax Rig + Browser Mirror Parity
 *
 * Verifies:
 *  1. `evaluateCameraPose` is a pure deterministic function of (plan, fps, frame, seed)
 *     for every camera kind, and stays inside physically-sane numeric bounds.
 *  2. `cameraProgress` easing: progress starts at 0 and reaches 1 exactly at endSec.
 *  3. `computeParallaxOffsets` physical honesty:
 *       - rig translation (truck/dolly) → offset ∝ depth ratio (near planes move more)
 *       - head rotation (pan/tilt)     → uniform world shift (no depth separation)
 *       - lens zoom                    → ratio-scaled magnification (near magnifies faster)
 *       - roll/dutch                   → counter-rotation, foreground rolls most
 *  4. `evaluatePlanePlacement` folds scale into the rect around the anchor and keeps opacity.
 *  5. `decideLandscapeCameraMoves` allocates exactly one plan per section from the catalog.
 *  6. Mirror parity: the plain-JS browser mirror (landscape_parallax_math_mirror.ts) agrees
 *     with the TS module over a grid of (kind × progress × ratio × intensity × frame/seed).
 *  7. Manifest wiring: `parallaxRig` is 1:1 with sections, monotonic ratios, ownership split,
 *     and every rig bound to a camera move.
 */

import { runLandscapeTreatmentPipeline } from "../landscape_treatment_pipeline";
import {
  CAMERA_MOVE_CATALOG,
  CAMERA_KINDS,
  applyEasing,
  cameraProgress,
  computeParallaxOffsets,
  decideLandscapeCameraMoves,
  evaluateCameraPose,
} from "../landscape_camera_system";
import { PARALLAX_RATIOS, buildParallaxRig, evaluatePlanePlacement } from "../landscape_parallax_rig";
import { PARALLAX_MATH_MIRROR } from "../landscape_parallax_math_mirror";
import { CameraMovePlan, LandscapeSection, EditMove } from "../types";

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

function assertClose(a: number, b: number, tol: number, msg: string) {
  assert(Math.abs(a - b) <= tol, `${msg} (${a} ≈ ${b} ±${tol})`);
}

console.log("===============================================================================");
console.log("TEST SUITE: LANDSCAPE CAMERA SYSTEM + 2.5D PARALLAX RIG + MIRROR PARITY");
console.log("===============================================================================\n");

// ---------------------------------------------------------------------------
// 1. evaluateCameraPose: determinism + bounds for every kind
// ---------------------------------------------------------------------------
console.log("--- 1. Camera Pose Evaluation (determinism + bounds) ---");
assert(CAMERA_KINDS.length >= 20, `Camera catalog has ${CAMERA_KINDS.length} cinematic kinds`);

const makePlan = (kind: CameraMovePlan["kind"], intensity = 0.7): CameraMovePlan => ({
  moveId: `cam_test_${kind}`,
  sectionId: "sec_test",
  startSec: 1,
  endSec: 5,
  kind,
  intensity,
  parallaxDepthRatios: { background: 0.35, middleGround: 1.0, foreground: 1.65 },
  pairedWithText: false,
  causalIntent: "test",
  cause: { gate: "camera_move_trigger", reason: "test", sectionId: "sec_test", timeSec: 1 },
});

for (const kind of CAMERA_KINDS) {
  const plan = makePlan(kind);
  const a = evaluateCameraPose(plan, 30, 60, 42);
  const b = evaluateCameraPose(plan, 30, 60, 42);
  const same =
    JSON.stringify(a.pose) === JSON.stringify(b.pose) && a.progress === b.progress;
  assert(same, `${kind}: deterministic across identical (plan, fps, frame, seed)`);

  const { pose } = a;
  const posOk = pose.position.every((v) => Number.isFinite(v) && Math.abs(v) <= 12);
  const rotOk = pose.rotation.every((v) => Number.isFinite(v) && Math.abs(v) <= Math.PI);
  const fovOk = pose.fov >= 20 && pose.fov <= 80;
  assert(posOk && rotOk && fovOk, `${kind}: pose within sane bounds (pos=${pose.position}, rot=${pose.rotation}, fov=${pose.fov.toFixed(1)})`);
}

const shakeA = evaluateCameraPose(makePlan("shake"), 30, 60, 1);
const shakeB = evaluateCameraPose(makePlan("shake"), 30, 60, 2);
assert(
  JSON.stringify(shakeA.pose.position) !== JSON.stringify(shakeB.pose.position),
  "shake: different seeds produce different jitter (seeded, not global-random)",
);
// ---------------------------------------------------------------------------
// 2. cameraProgress easing envelope
// ---------------------------------------------------------------------------
console.log("\n--- 2. Camera Progress Envelope ---");
const zoomPlan = makePlan("zoom_in");
assertClose(cameraProgress(zoomPlan, 30, 29), 0, 1e-9, "progress at startSec = 0");
assertClose(cameraProgress(zoomPlan, 30, 150), 1, 1e-9, "progress at endSec = 1");
const midEarly = cameraProgress(zoomPlan, 30, 60);
const linearEarly = 0.25;
assert(midEarly < linearEarly, `easeInOut starts slow: eased ${midEarly.toFixed(3)} < linear ${linearEarly.toFixed(3)} (S-curve heel)`);
const midLate = cameraProgress(zoomPlan, 30, 120);
const linearLate = 0.75;
assert(midLate > linearLate, `easeInOut ends fast: eased ${midLate.toFixed(3)} > linear ${linearLate.toFixed(3)} (S-curve head)`);
assertClose(cameraProgress(zoomPlan, 30, 90), 0.5, 1e-9, "easeInOut passes exactly through 0.5 at the linear midpoint");
assertClose(applyEasing("easeOut", 0.5), 1 - Math.pow(0.5, 3), 1e-9, "applyEasing(easeOut, 0.5) matches ease-out-cubic");
assertClose(applyEasing("linear", 0.37), 0.37, 1e-9, "applyEasing(linear) is identity");

// ---------------------------------------------------------------------------
// 3. computeParallaxOffsets physical honesty
// ---------------------------------------------------------------------------
console.log("\n--- 3. Parallax Offset Physics ---");
const RATIOS = [PARALLAX_RATIOS.background, PARALLAX_RATIOS.middleGround, PARALLAX_RATIOS.foreground];
const offsetsAt = (kind: CameraMovePlan["kind"], ratio: number) =>
  computeParallaxOffsets({ plan: makePlan(kind, 0.8), progress: 0.6, depthRatio: ratio, seed: 7 });

// Translation → real parallax: |dx| grows with ratio.
const truckFar = Math.abs(offsetsAt("truck_left", RATIOS[0]).dx);
const truckNear = Math.abs(offsetsAt("truck_left", RATIOS[2]).dx);
assert(truckNear > truckFar, `truck_left: foreground shifts more than background (${truckNear.toFixed(4)} > ${truckFar.toFixed(4)}) — REAL parallax ∝ depth`);

// Head rotation → uniform world shift (ratio-independent).
const panFar = Math.abs(offsetsAt("pan_right", RATIOS[0]).dx);
const panNear = Math.abs(offsetsAt("pan_right", RATIOS[2]).dx);
assert(Math.abs(panNear - panFar) < 1e-9, `pan_right: uniform shift across depths (${panNear.toFixed(4)} ≈ ${panFar.toFixed(4)}) — true coupling, no fake separation`);

// Lens zoom → ratio-scaled magnification.
const zoomFar = offsetsAt("zoom_in", RATIOS[0]).scale;
const zoomNear = offsetsAt("zoom_in", RATIOS[2]).scale;
assert(zoomFar > 1 && zoomNear > zoomFar, `zoom_in: magnification ∝ ratio (bg ${zoomFar.toFixed(3)} < fg ${zoomNear.toFixed(3)})`);

// Roll → counter-rotation, foreground rolls most.
const rollFar = Math.abs(offsetsAt("roll_clockwise", RATIOS[0]).rotationDeg);
const rollNear = Math.abs(offsetsAt("roll_clockwise", RATIOS[2]).rotationDeg);
assert(rollNear > rollFar, `roll_clockwise: foreground counter-rotation exceeds background (${rollNear.toFixed(2)}° > ${rollFar.toFixed(2)}°)`);

// Static → identity offsets.
const staticOff = offsetsAt("static", RATIOS[2]);
assert(staticOff.dx === 0 && staticOff.dy === 0 && staticOff.scale === 1 && staticOff.rotationDeg === 0, "static: identity offsets");

// ---------------------------------------------------------------------------
// 4. evaluatePlanePlacement anchor-preserving scale
// ---------------------------------------------------------------------------
console.log("\n--- 4. Plane Placement (anchor-preserving) ---");
const plane = {
  kind: "midground" as const,
  zDepth: 10 as const,
  parallaxRatio: 1.0,
  baseRect: { x: 0.2, y: 0.2, width: 0.4, height: 0.4, anchorX: 0.5, anchorY: 0.5 },
  contentHint: "test",
  opacity: 0.9,
  source: { owner: "animation_hand" as const },
};
const placement = evaluatePlanePlacement({ plane, cameraPlan: makePlan("dolly_in"), fps: 30, frame: 90, seed: 0 });
const scale = placement.scale;
const centerX = placement.rect.x + placement.rect.width / 2;
const baseCenterX = plane.baseRect.x + plane.baseRect.width / 2;
assertClose(centerX, baseCenterX, 0.02, "dolly_in scale keeps rect centered on the anchor (x)");
assert(placement.rect.width === plane.baseRect.width * scale, "rect width = baseWidth × scale");
assert(placement.opacity === plane.opacity, "opacity preserved through placement");

// ---------------------------------------------------------------------------
// 5. decideLandscapeCameraMoves allocation
// ---------------------------------------------------------------------------
console.log("\n--- 5. Camera Planner Allocation ---");
const sections: LandscapeSection[] = [
  { sectionId: "s1", role: "hook", startSec: 0, endSec: 8, durationSec: 8, text: "Welcome — we break down the pipeline.", semanticWeight: 0.9, commercialPressure: 0.4, fatigueRisk: 0.2, cause: { gate: "section_role", reason: "t", sectionId: "s1", timeSec: 0 } },
  { sectionId: "s2", role: "explain", startSec: 8, endSec: 20, durationSec: 12, text: "First, the list of four key steps.", semanticWeight: 0.7, commercialPressure: 0.5, fatigueRisk: 0.4, cause: { gate: "section_role", reason: "t", sectionId: "s2", timeSec: 8 } },
  { sectionId: "s3", role: "demonstrate", startSec: 20, endSec: 34, durationSec: 14, text: "Our revenue surged 10x on the chart.", semanticWeight: 0.8, commercialPressure: 0.9, fatigueRisk: 0.5, cause: { gate: "section_role", reason: "t", sectionId: "s3", timeSec: 20 } },
  { sectionId: "s4", role: "outro", startSec: 34, endSec: 46, durationSec: 12, text: "This is the thesis that matters most.", semanticWeight: 0.95, commercialPressure: 0.6, fatigueRisk: 0.6, cause: { gate: "section_role", reason: "t", sectionId: "s4", timeSec: 34 } },
];
const moves: EditMove[] = [
  { moveId: "thesis_punctuation", sectionId: "s4", startSec: 36, endSec: 42, viewerProblem: "p", priority: 8, allowSfx: true, allowMacroAsset: true, cause: { gate: "edit_move", reason: "t", sectionId: "s4", timeSec: 36 } },
  { moveId: "value_contrast", sectionId: "s3", startSec: 22, endSec: 30, viewerProblem: "p", priority: 7, allowSfx: true, allowMacroAsset: true, cause: { gate: "edit_move", reason: "t", sectionId: "s3", timeSec: 22 } },
];
const plans = decideLandscapeCameraMoves(sections, moves, ["thesis_punctuation"]);
assert(plans.length === sections.length, `decideLandscapeCameraMoves returns one plan per section (${plans.length}/${sections.length})`);
assert(plans.every((p) => CAMERA_KINDS.includes(p.kind)), "every planned kind is in the catalog");
const s4plan = plans.find((p) => p.sectionId === "s4");
assert(s4plan?.kind === "push_in", `thesis section receives push_in (got ${s4plan?.kind})`);
const s3plan = plans.find((p) => p.sectionId === "s3");
assert(s3plan?.kind === "zoom_in", `metric section receives zoom_in (got ${s3plan?.kind})`);
assert(plans.every((p) => p.endSec > p.startSec), "every plan spans a positive window");
assert(s4plan?.pairedWithText === true, "plans paired with typography are flagged");

// ---------------------------------------------------------------------------
// 6. Mirror parity over a grid
// ---------------------------------------------------------------------------
console.log("\n--- 6. Browser Mirror Parity ---");
const specs = PARALLAX_MATH_MIRROR.mirrorSpecsFromCatalog(CAMERA_MOVE_CATALOG);
let parityFails = 0;
let parityChecks = 0;
for (const kind of CAMERA_KINDS) {
  for (const intensity of [0.3, 0.7, 1.0]) {
    const plan = makePlan(kind, intensity);
    for (const frame of [30, 75, 120, 149]) {
      const ts = evaluateCameraPose(plan, 30, frame, 42);
      const js = PARALLAX_MATH_MIRROR.mirrorPose(plan, 30, frame, 42, specs);
      parityChecks++;
      const poseSame =
        ts.pose.position.every((v, i) => Math.abs(v - js.pose.position[i]) < 1e-12) &&
        ts.pose.rotation.every((v, i) => Math.abs(v - js.pose.rotation[i]) < 1e-12) &&
        Math.abs(ts.pose.fov - js.pose.fov) < 1e-12;
      if (!poseSame) {
        parityFails++;
        console.error(`  mirror pose drift: ${kind}@${intensity} frame ${frame}: TS=${JSON.stringify(ts.pose)} JS=${JSON.stringify(js.pose)}`);
      }
      if (Math.abs(ts.progress - js.progress) > 1e-12) parityFails++;

      for (const ratio of [0.35, 1.0, 1.65]) {
        const tsOff = computeParallaxOffsets({ plan, progress: ts.progress, depthRatio: ratio, seed: 42 });
        const jsOff = PARALLAX_MATH_MIRROR.mirrorOffsets(plan, js.progress, ratio, 42);
        parityChecks++;
        if (
          Math.abs(tsOff.dx - jsOff.dx) > 1e-12 ||
          Math.abs(tsOff.dy - jsOff.dy) > 1e-12 ||
          Math.abs(tsOff.scale - jsOff.scale) > 1e-12 ||
          Math.abs(tsOff.rotationDeg - jsOff.rotationDeg) > 1e-12
        ) {
          parityFails++;
          console.error(`  mirror offset drift: ${kind}@${intensity} ratio ${ratio} frame ${frame}: TS=${JSON.stringify(tsOff)} JS=${JSON.stringify(jsOff)}`);
        }
      }
    }
  }
}
assert(parityFails === 0, `mirror and TS module agree over ${parityChecks} pose+offset evaluations (grid: ${CAMERA_KINDS.length} kinds × 3 intensities × 4 frames × 3 ratios)`);

// ---------------------------------------------------------------------------
// 7. Manifest wiring: parallaxRig
// ---------------------------------------------------------------------------
console.log("\n--- 7. Manifest Parallax Rig Wiring ---");
const manifest = runLandscapeTreatmentPipeline({
  transcript: [
    { startSec: 0, endSec: 12, text: "Welcome. Today we're unveiling the breakthrough workflow architecture." },
    { startSec: 12, endSec: 40, text: "Let's demonstrate the four key steps on this dashboard." },
    { startSec: 40, endSec: 75, text: "Here is the revenue chart showing our 10x throughput surge." },
    { startSec: 75, endSec: 120, text: "Start now and elevate your long-form production quality." },
  ],
});
assert(Array.isArray(manifest.parallaxRig), "manifest.parallaxRig is an array");
assert(manifest.parallaxRig.length === manifest.sections.length, `parallaxRig is 1:1 with sections (${manifest.parallaxRig.length}/${manifest.sections.length})`);

const monoOk = manifest.parallaxRig.every((pr) => {
  const r = pr.parallaxDepthRatios;
  return r.background < r.middleGround && r.middleGround < r.foreground;
});
assert(monoOk, "parallaxDepthRatios strictly monotonic in every rig");

const boundOk = manifest.parallaxRig.every((pr) => (manifest.cameraMoves ?? []).some((c) => c.moveId === pr.cameraMoveId));
assert(boundOk, "every rig is bound to a camera move");

const ownershipOk = manifest.parallaxRig.every(
  (pr) => pr.backgroundPlane.source?.owner === "background_system" && pr.midgroundPlane.source?.owner === "animation_hand" && pr.foregroundPlane.source?.owner === "animation_hand",
);
assert(ownershipOk, "ownership split: background referenced, midground+foreground placed by animation hand");

const rigCheck = manifest.governance.checks.find((c) => c.check.includes("2.5D parallax rig"));
assert(rigCheck !== undefined && rigCheck.pass, "governance: every section has a bound 2.5D parallax rig");

// ---------------------------------------------------------------------------
// 8. buildParallaxRig end-to-end on real sections
// ---------------------------------------------------------------------------
console.log("\n--- 8. buildParallaxRig Determinism ---");
const rigA = buildParallaxRig({
  sections: manifest.sections,
  backgroundCoverages: manifest.backgroundCoverages ?? [],
  backgroundRigs: manifest.backgroundRigs ?? [],
  cameraMoves: manifest.cameraMoves ?? [],
  pipInsets: manifest.pipInsets ?? [],
  metaphorTreatments: manifest.metaphorTreatments ?? [],
});
const rigB = buildParallaxRig({
  sections: manifest.sections,
  backgroundCoverages: manifest.backgroundCoverages ?? [],
  backgroundRigs: manifest.backgroundRigs ?? [],
  cameraMoves: manifest.cameraMoves ?? [],
  pipInsets: manifest.pipInsets ?? [],
  metaphorTreatments: manifest.metaphorTreatments ?? [],
});
assert(JSON.stringify(rigA) === JSON.stringify(rigB), "buildParallaxRig is a pure deterministic function of its inputs");

const pipRig = rigA.find((r) => (manifest.pipInsets ?? []).some((p) => p.enabled && p.sectionId === r.sectionId));
if (pipRig) {
  assert(pipRig.foregroundPlane.contentHint.includes("PiP"), "PiP section foreground plane announces HUD chrome + grain (MAT-04)");
}

console.log(`\n===============================================================================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`===============================================================================\n`);

if (failed > 0) {
  process.exit(1);
}

