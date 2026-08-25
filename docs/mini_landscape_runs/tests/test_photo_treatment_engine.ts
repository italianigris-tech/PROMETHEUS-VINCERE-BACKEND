/**
 * Test Suite: Cinematic Photo & Asset Treatment Engine
 *
 * Verifies:
 * 1. Halation: Red/orange edge glow on highlights.
 * 2. Chromatic Aberration: Optical color fringing on anamorphic glass.
 * 3. Diffusion / Pro-Mist: Highlight softening and glow bleed into shadows.
 * 4. Gate Weave (Still Version): Subtle asymmetric rotation & micro-offset breaking digital symmetry.
 * 5. Perceived Grain Density: Luminance-mapped grain (heavy in midtones, zero in highlights).
 * 6. Light & Exposure Shifting: Split-toning micro-contrast variance + organic light leaks.
 * 7. Asymmetric Vignette: Natural optical falloff from real lens hoods.
 * 8. Micro-Push Motion: Subtle 1.00x -> 1.045x glide.
 * 9. Manifest Integration: 100% of assets pass through the Photo Treatment System.
 */

import {
  generatePhotoTreatmentBlueprint,
  inferAssetCategory,
  inferTreatmentMood,
  treatAllManifestAssets,
} from "../photo_treatment_engine";
import { runLandscapeTreatmentPipeline } from "../landscape_treatment_pipeline";

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
console.log("TEST SUITE: CINEMATIC PHOTO & ASSET TREATMENT ENGINE");
console.log("===============================================================================\n");

// TEST GROUP 1: Optical & Lens Characteristics
console.log("--- 1. Optical & Lens Characteristics (Halation, Fringe, Diffusion) ---");

const screenshotBlueprint = generatePhotoTreatmentBlueprint({
  assetId: "test_ui_screenshot",
  assetSourcePath: "docs/mini_run_studio/uploaded_screenshots/Screenshot_14_131730.png",
  assetCategory: "screenshot_ui",
});

assert(screenshotBlueprint.halation.enabled === true, "Halation is enabled");
assert(screenshotBlueprint.halation.color.includes("rgba(255"), "Halation has warm orange/red glow color");
assert(screenshotBlueprint.halation.thresholdLuminance >= 0.70, "Halation threshold targets highlights >= 0.70");

assert(screenshotBlueprint.chromaticAberration.enabled === true, "Chromatic aberration is enabled");
assert(screenshotBlueprint.chromaticAberration.fringeOffsetPx >= 1.5, "Optical fringe offset is >= 1.5px");
assert(["magenta_green", "red_cyan", "amber_blue"].includes(screenshotBlueprint.chromaticAberration.colorPair), "Fringe uses authentic optical color pair");

assert(screenshotBlueprint.diffusionProMist.enabled === true, "Black Pro-Mist diffusion is enabled");
assert(screenshotBlueprint.diffusionProMist.highlightBleedIntensity > 0, "Pro-Mist highlight bleed is active");
assert(screenshotBlueprint.diffusionProMist.contrastCompression < 1.0, "Pro-Mist softens harsh digital contrast");

// TEST GROUP 2: Film Stock Texture & Imperfect Framing
console.log("\n--- 2. Film Stock Texture & Imperfect Framing (Gate Weave & Grain) ---");

assert(screenshotBlueprint.gateWeave.enabled === true, "Still gate weave imperfect framing is enabled");
assert(screenshotBlueprint.gateWeave.rotationDeg !== 0, `Gate weave applies subtle off-center rotation (${screenshotBlueprint.gateWeave.rotationDeg}°)`);
assert(Math.abs(screenshotBlueprint.gateWeave.rotationDeg) <= 0.8, "Gate weave rotation is restrained (<= 0.8°)");
assert(screenshotBlueprint.gateWeave.offsetXPx !== 0, "Gate weave applies micro-pixel translation");

assert(screenshotBlueprint.perceivedGrain.enabled === true, "Perceived grain density is enabled");
assert(screenshotBlueprint.perceivedGrain.midtoneDensity > screenshotBlueprint.perceivedGrain.highlightDensity, "Grain is heavy in midtones and non-existent in specular highlights");
assert(screenshotBlueprint.perceivedGrain.midtoneDensity > screenshotBlueprint.perceivedGrain.shadowDensity, "Grain midtone density > shadow density");

// TEST GROUP 3: Light & Exposure Shifting (Split-Toning, Light Leaks, Vignette)
console.log("\n--- 3. Light & Exposure Shifting (Split-Toning, Light Leaks, Vignette) ---");

assert(screenshotBlueprint.splitToning.enabled === true, "Split-toning micro-contrast variance is enabled");
assert(screenshotBlueprint.splitToning.microContrastVariance > 1.0, "Micro-contrast variance > 1.0x");
assert(screenshotBlueprint.splitToning.highlightTint.length > 0, "Highlight tint is defined");
assert(screenshotBlueprint.splitToning.shadowTint.length > 0, "Shadow tint is defined");

const vintageBlueprint = generatePhotoTreatmentBlueprint({
  assetId: "test_archival_photo",
  assetSourcePath: "archival_documentary_photo.jpg",
  assetCategory: "archival_photo",
});

assert(vintageBlueprint.lightLeaks.enabled === true, "Organic light leaks enabled for vintage/archival assets");
assert(vintageBlueprint.lightLeaks.colorGradient.includes("radial-gradient"), "Light leak uses organic radial gradient");

assert(screenshotBlueprint.vignette.enabled === true, "Asymmetric lens hood vignette is enabled");
assert(["anamorphic_oval", "petal_rectangular", "vintage_vignette"].includes(screenshotBlueprint.vignette.lensHoodShape), "Vignette uses authentic lens hood shape");
assert(screenshotBlueprint.vignette.cornerDarkeningPct >= 0.18, "Vignette corner darkening is >= 18%");

// TEST GROUP 4: Slow Cinematic Micro-Push
console.log("\n--- 4. Slow Cinematic Micro-Push Motion ---");

assert(screenshotBlueprint.microMotion.enabled === true, "Slow cinematic push motion is enabled");
assert(screenshotBlueprint.microMotion.startScale === 1.00, "Micro-push starts at 1.00x");
assert(screenshotBlueprint.microMotion.endScale > 1.00 && screenshotBlueprint.microMotion.endScale <= 1.06, `Micro-push ends at subtle scale (${screenshotBlueprint.microMotion.endScale}x)`);
assert(screenshotBlueprint.microMotion.easing.includes("cubic-bezier"), "Micro-push uses smooth S-curve easing");

// TEST GROUP 5: Full Manifest Integration (Mandatory Asset Processing)
console.log("\n--- 5. Full Manifest Integration (Mandatory Asset Processing) ---");

const manifest = runLandscapeTreatmentPipeline({
  transcript: [
    { startSec: 0, endSec: 15, text: "Hook text." },
    { startSec: 15, endSec: 35, text: "Let me pull up my calendar screen demo." },
    { startSec: 35, endSec: 65, text: "First, rapid experimentation. Second, unit economics." },
    { startSec: 65, endSec: 95, text: "Don't build a machine before you know it works." },
    { startSec: 95, endSec: 140, text: "Payoff text." },
    { startSec: 140, endSec: 180, text: "Outro text." }
  ]
});

assert(Array.isArray(manifest.photoTreatments), "manifest.photoTreatments is an array");
assert(manifest.photoTreatments.length > 0, `Photo treatments compiled for ${manifest.photoTreatments.length} assets`);

// Verify every blueprint has full layer stack and rationale
manifest.photoTreatments.forEach((pt, i) => {
  assert(pt.compositeStackLayerOrder.length === 9, `Asset ${i + 1} (${pt.assetId}) has full 9-layer composite stack`);
  assert(pt.rationale.length > 20, `Asset ${i + 1} has documented aesthetic rationale`);
});

console.log(`\n===============================================================================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`===============================================================================\n`);

if (failed > 0) {
  process.exit(1);
}
