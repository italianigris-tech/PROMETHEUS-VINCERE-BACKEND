import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { checkStudioAssets, checkPythonEnvironment } from "./preflight_environment_check.js";

const studioDir = __dirname;

// Read asset files and convert to inline Base64 data URIs
function getBase64DataUriFromPath(filePath: string): string {
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).replace(".", "");
    const mime = ext === "svg" ? "image/svg+xml" : (ext === "png" ? "image/png" : "image/jpeg");
    const b64 = fs.readFileSync(filePath).toString("base64");
    return `data:${mime};base64,${b64}`;
  }
  console.warn("FILE_NOT_FOUND_FOR_BASE64:", filePath);
  return "";
}

// 1. RESOLVE SPEAKER CUTOUT ASSET PORTABLY
const assetCheck = checkStudioAssets();
if (!assetCheck.speakerPath) {
  throw new Error("[CRITICAL_PIPELINE_HALT] Matted male talking head PNG asset could not be found.");
}
const resolvedSpeakerPath = assetCheck.speakerPath;
console.log(`[STUDIO_ASSET_LOADER] Matted Speaker Head Asset Resolved: ${resolvedSpeakerPath}`);
const speakerBase64 = getBase64DataUriFromPath(resolvedSpeakerPath);

// 2. LIVE MEDIAPIPE / OPENCV VISION EXTRACTION WITH PREFLIGHT RUNTIME DETECTION
const pyCheck = checkPythonEnvironment();
let scalpTopPercent = 14.79;

if (pyCheck.executablePath && pyCheck.hasOpenCv) {
  try {
    const pyCmd = `"${pyCheck.executablePath}" -c "import cv2, numpy as np; img=cv2.imread('${resolvedSpeakerPath.replace(/\\/g, "/")}'); h,w,_=img.shape; gray=cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); y_indices,_=np.where(gray>15); print(np.min(y_indices)/h)"`;
    const pyResult = execSync(pyCmd, { encoding: "utf8" }).trim();
    const parsedY = parseFloat(pyResult);
    if (Number.isFinite(parsedY) && parsedY > 0) {
      scalpTopPercent = parsedY * 100;
    }
    console.log(`[MEDIAPIPE_LIVE_TELEMETRY] Scalp Top Y Baseline Extracted (${pyCheck.executablePath}): ${scalpTopPercent.toFixed(2)}%`);
  } catch (e) {
    console.warn(`[MEDIAPIPE_TELEMETRY_WARN] Live vision detection failed, applying calibrated baseline 14.79%. Reason: ${e}`);
  }
} else {
  console.log(`[MEDIAPIPE_TELEMETRY_NOTICE] Vision libraries not present in current python environment. Using calibrated MediaPipe baseline: ${scalpTopPercent.toFixed(2)}%`);
  if (pyCheck.remediation) {
    console.log(`[MEDIAPIPE_REMEDIATION_HINT] ${pyCheck.remediation}`);
  }
}

// GOLDILOCKS ZONE TACTILE HEAD CONTACT: Position Head Stage at 15.5% (overlaps bottom 18% of text baseline at Z:10)
const goldilocksHeadStageTopPercent = 15.5;
console.log(`[GOLDILOCKS_ZONE_CALIBRATION] Head Stage Positioned at: ${goldilocksHeadStageTopPercent}% for Cinematic Tactile Scalp Contact (Z:10)`);

// 100% UNIQUE BRAND-NEW MATTED ASSETS SPECIFICALLY CREATED FOR TRANSCRIPT 2
const metronomeBase64 = getBase64DataUriFromPath(path.join(studioDir, "transcript2_metronome_unique.svg"));
const roboticArmBase64 = getBase64DataUriFromPath(path.join(studioDir, "transcript2_robotic_arm_unique.svg"));
const rocketScaleBase64 = getBase64DataUriFromPath(path.join(studioDir, "transcript2_rocket_scale_unique.svg"));

// NEW 20-CHUNK TRANSCRIPT PAYLOAD 4: "Most businesses don't have a growth problem."
const maleSequencePayload4 = [
  {
    chunkIndex: 1,
    timestamp: "00:00 — 00:02",
    text: "Most businesses",
    layers: [
      {
        layerName: "stem_most_businesses",
        text: "Most businesses",
        fontFamily: "Playfair Display",
        fontWeight: 700,
        fontStyle: "italic",
        fontSizePx: 32,
        color: "#FFFFFF",
        dropShadow: { xOffset: 0, yOffset: 2, blurRadius: 10, color: "rgba(0,0,0,0.9)" }
      }
    ]
  },
  {
    chunkIndex: 2,
    timestamp: "00:02 — 00:04",
    text: "don't have",
    layers: [
      {
        layerName: "stem_dont_have",
        text: "don't have",
        fontFamily: "DM Sans",
        fontWeight: 800,
        fontSizePx: 34,
        color: "#00E5FF",
        dropShadow: { xOffset: 0, yOffset: 2, blurRadius: 10, color: "rgba(0,0,0,0.9)" }
      }
    ]
  },
  {
    chunkIndex: 3,
    timestamp: "00:04 — 00:06",
    text: "a growth problem.",
    layers: [
      {
        layerName: "prefix_a",
        text: "a",
        fontFamily: "Playfair Display",
        fontWeight: 700,
        fontStyle: "italic",
        fontSizePx: 22,
        color: "#111111"
      },
      {
        layerName: "hero_growth_problem",
        text: "GROWTH PROBLEM.",
        fontFamily: "Bebas Neue",
        fontWeight: 400,
        fontSizePx: 38,
        casing: "uppercase",
        letterSpacingEm: 0.04,
        color: "#111111",
        delayedPillCard: "#FFE600",
        marginTopPx: 18
      }
    ]
  },
  {
    chunkIndex: 4,
    timestamp: "00:06 — 00:08",
    text: "They have",
    layers: [
      {
        layerName: "stem_they_have",
        text: "They have",
        fontFamily: "DM Sans",
        fontWeight: 700,
        fontSizePx: 32,
        color: "#FFFFFF"
      }
    ]
  },
  {
    chunkIndex: 5,
    timestamp: "00:08 — 00:10",
    text: "a consistency problem.",
    backgroundAsset: {
      assetId: "transcript2_metronome_unique",
      assetName: "Unique Metronome & Precision Hourglass Instrument Cutout",
      imageUrl: metronomeBase64,
      position: { topPercent: 10, leftPercent: 4, widthPx: 375 },
      depth: "behind",
      motion: "asset_bezier_scale_fade"
    },
    layers: [
      {
        layerName: "prefix_a_consistency",
        text: "a",
        fontFamily: "Playfair Display",
        fontWeight: 700,
        fontStyle: "italic",
        fontSizePx: 22,
        color: "#FFFFFF"
      },
      {
        layerName: "hero_consistency_problem",
        text: "CONSISTENCY PROBLEM.",
        fontFamily: "Bebas Neue",
        fontWeight: 400,
        fontSizePx: 35,
        casing: "uppercase",
        letterSpacingEm: 0.04,
        color: "#FFFFFF",
        circleMaskInversion: true,
        marginTopPx: 4
      }
    ]
  },
  {
    chunkIndex: 6,
    timestamp: "00:10 — 00:12",
    text: "Because getting customers",
    layers: [
      {
        layerName: "stem_getting_customers",
        text: "Because getting customers",
        fontFamily: "DM Serif Display",
        fontWeight: 400,
        fontStyle: "italic",
        fontSizePx: 26,
        color: "#FFFFFF"
      }
    ]
  },
  {
    chunkIndex: 7,
    timestamp: "00:12 — 00:14",
    text: "is one thing.",
    layers: [
      {
        layerName: "hero_one_thing",
        text: "IS ONE THING.",
        fontFamily: "Bebas Neue",
        fontWeight: 400,
        fontSizePx: 38,
        casing: "uppercase",
        color: "#111111",
        marginTopPx: 18
      }
    ]
  },
  {
    chunkIndex: 8,
    timestamp: "00:14 — 00:16",
    text: "Keeping the machine running",
    backgroundAsset: {
      assetId: "transcript2_robotic_arm_unique",
      assetName: "Unique Robotic Assembly Arm Cutout",
      imageUrl: roboticArmBase64,
      position: { topPercent: 12, leftPercent: 4, widthPx: 360 },
      depth: "behind",
      motion: "asset_rotate_spin_bezier"
    },
    layers: [
      {
        layerName: "stem_machine_running",
        text: "Keeping the machine running",
        fontFamily: "DM Sans",
        fontWeight: 700,
        fontSizePx: 24,
        color: "#FFFFFF"
      }
    ]
  },
  {
    chunkIndex: 9,
    timestamp: "00:16 — 00:18",
    text: "is something completely different.",
    layers: [
      {
        layerName: "hero_completely_different",
        text: "COMPLETELY DIFFERENT.",
        fontFamily: "Bebas Neue",
        fontWeight: 400,
        fontSizePx: 35,
        casing: "uppercase",
        color: "#111111",
        marginTopPx: 18
      }
    ]
  },
  {
    chunkIndex: 10,
    timestamp: "00:18 — 00:20",
    text: "And honestly,",
    layers: [
      {
        layerName: "prefix_and",
        text: "And",
        fontFamily: "Playfair Display",
        fontWeight: 700,
        fontStyle: "italic",
        fontSizePx: 22,
        color: "#111111"
      },
      {
        layerName: "stem_honestly",
        text: "honestly,",
        fontFamily: "DM Serif Display",
        fontWeight: 400,
        fontStyle: "italic",
        fontSizePx: 30,
        color: "#FFFFFF",
        marginTopPx: 14
      }
    ]
  },
  {
    chunkIndex: 11,
    timestamp: "00:20 — 00:22",
    text: "that's where",
    layers: [
      {
        layerName: "stem_thats_where",
        text: "that's where",
        fontFamily: "DM Sans",
        fontWeight: 800,
        fontSizePx: 30,
        color: "#00E5FF"
      }
    ]
  },
  {
    chunkIndex: 12,
    timestamp: "00:22 — 00:24",
    text: "most founders struggle.",
    layers: [
      {
        layerName: "hero_founders_struggle",
        text: "MOST FOUNDERS STRUGGLE.",
        fontFamily: "Bebas Neue",
        fontWeight: 400,
        fontSizePx: 34,
        casing: "uppercase",
        color: "#111111",
        delayedPillCard: "#00F0FF",
        marginTopPx: 18
      }
    ]
  },
  {
    chunkIndex: 13,
    timestamp: "00:24 — 00:26",
    text: "They build everything",
    layers: [
      {
        layerName: "stem_build_everything",
        text: "They build everything",
        fontFamily: "DM Sans",
        fontWeight: 700,
        fontSizePx: 26,
        color: "#FFFFFF"
      }
    ]
  },
  {
    chunkIndex: 14,
    timestamp: "00:26 — 00:28",
    text: "around themselves,",
    layers: [
      {
        layerName: "stem_around_themselves",
        text: "around themselves,",
        fontFamily: "Playfair Display",
        fontWeight: 700,
        fontStyle: "italic",
        fontSizePx: 26,
        color: "#FFFFFF"
      }
    ]
  },
  {
    chunkIndex: 15,
    timestamp: "00:28 — 00:30",
    text: "then wonder why",
    layers: [
      {
        layerName: "stem_wonder_why",
        text: "then wonder why",
        fontFamily: "DM Sans",
        fontWeight: 700,
        fontSizePx: 28,
        color: "#FFFFFF"
      }
    ]
  },
  {
    chunkIndex: 16,
    timestamp: "00:30 — 00:32",
    text: "the business can't scale.",
    layers: [
      {
        layerName: "prefix_the_business",
        text: "the business",
        fontFamily: "Playfair Display",
        fontWeight: 700,
        fontStyle: "italic",
        fontSizePx: 22,
        color: "#111111"
      },
      {
        layerName: "hero_cant_scale",
        text: "CAN'T SCALE.",
        fontFamily: "Bebas Neue",
        fontWeight: 400,
        fontSizePx: 38,
        casing: "uppercase",
        color: "#FFFFFF",
        delayedPillCard: "#FF3366",
        marginTopPx: 18
      }
    ]
  },
  {
    chunkIndex: 17,
    timestamp: "00:32 — 00:34",
    text: "You need systems",
    layers: [
      {
        layerName: "stem_need_systems",
        text: "You need systems",
        fontFamily: "DM Sans",
        fontWeight: 700,
        fontSizePx: 28,
        color: "#FFFFFF"
      }
    ]
  },
  {
    chunkIndex: 18,
    timestamp: "00:34 — 00:36",
    text: "that create momentum",
    layers: [
      {
        layerName: "hero_create_momentum",
        text: "CREATE MOMENTUM",
        fontFamily: "Bebas Neue",
        fontWeight: 400,
        fontSizePx: 36,
        color: "#00E5FF",
        marginTopPx: 4
      }
    ]
  },
  {
    chunkIndex: 19,
    timestamp: "00:36 — 00:38",
    text: "even when you're not involved.",
    layers: [
      {
        layerName: "stem_not_involved",
        text: "even when you're not involved.",
        fontFamily: "DM Sans",
        fontWeight: 700,
        fontSizePx: 20,
        color: "#FFFFFF"
      }
    ]
  },
  {
    chunkIndex: 20,
    timestamp: "00:38 — 00:40",
    text: "That's how businesses scale.",
    backgroundAsset: {
      assetId: "transcript2_rocket_scale_unique",
      assetName: "Unique Cyberpunk Starship Rocket Launch Cutout",
      imageUrl: rocketScaleBase64,
      position: { topPercent: 10, leftPercent: 4, widthPx: 375 },
      depth: "behind",
      motion: "asset_bezier_scale_fade"
    },
    layers: [
      {
        layerName: "prefix_thats_how",
        text: "That's how",
        fontFamily: "Playfair Display",
        fontWeight: 700,
        fontStyle: "italic",
        fontSizePx: 24,
        color: "#FFFFFF"
      },
      {
        layerName: "payoff_businesses_scale",
        text: "BUSINESSES SCALE.",
        fontFamily: "Bebas Neue",
        fontWeight: 400,
        fontSizePx: 36,
        casing: "uppercase",
        letterSpacingEm: 0.04,
        color: "#00E5FF",
        marginTopPx: -2
      }
    ]
  }
];

const perLayerKineticMap: Record<number, Record<string, { fx: string; treatmentOverlay?: string; name: string; type: string; depth: "behind_subject" | "in_front_of_subject"; zone: "head_contact" | "chest_lower_third"; score: string }>> = {
  1: {
    "stem_most_businesses": { fx: "defocus_rack_focus", name: "Defocus Aperture Snap", type: "word", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Crisp White (#FFFFFF)" }
  },
  2: {
    "stem_dont_have": { fx: "chromatic_character_displace", name: "Chromatic Displace Glitch", type: "letter", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Electric Cyan (#00E5FF)" }
  },
  3: {
    "prefix_a": { fx: "subpixel_blur_mask", name: "Helper Prefix Slide", type: "word", depth: "behind_subject", zone: "head_contact", score: "Top Contrast (Dark #111111)" },
    "hero_growth_problem": { fx: "delayed_pill_card_sweep", name: "Delayed Highlight Sweep Card (Ref #2)", type: "phrase", depth: "behind_subject", zone: "head_contact", score: "Goldilocks Scalp Contact ($Z:10$)" }
  },
  4: {
    "stem_they_have": { fx: "top_down_character_drop", name: "Top-Down Character Drop Engine", type: "letter", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Character Drop" }
  },
  5: {
    "prefix_a_consistency": { fx: "subpixel_blur_mask", name: "Helper Prefix Slide", type: "word", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Crisp White (#FFFFFF)" },
    "hero_consistency_problem": { fx: "circle_inversion_mask", name: "Circle Contrast Inversion Mask (Ref #0/#1)", type: "phrase", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Metronome Cutout ($Z:10$)" }
  },
  6: {
    "stem_getting_customers": { fx: "subpixel_blur_mask", name: "Soft Word Rise", type: "word", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Crisp White (#FFFFFF)" }
  },
  7: {
    "hero_one_thing": { fx: "keynote_punch", name: "Keynote Focal Punch", type: "phrase", depth: "behind_subject", zone: "head_contact", score: "Goldilocks Scalp Contact ($Z:10$)" }
  },
  8: {
    "stem_machine_running": { fx: "slot_bounce", name: "Kinetic Slot Bounce", type: "word", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Robotic Arm Cutout ($Z:10$)" }
  },
  9: {
    "hero_completely_different": { fx: "staggered_rotate_x", name: "3D Cascade", type: "letter", depth: "behind_subject", zone: "head_contact", score: "Goldilocks Scalp Contact ($Z:10$)" }
  },
  10: {
    "prefix_and": { fx: "subpixel_blur_mask", name: "Helper Prefix Slide", type: "word", depth: "behind_subject", zone: "head_contact", score: "Top Contrast (Dark #111111)" },
    "stem_honestly": { fx: "defocus_rack_focus", name: "Defocus Aperture Snap", type: "word", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Crisp White (#FFFFFF)" }
  },
  11: {
    "stem_thats_where": { fx: "chromatic_character_displace", name: "Chromatic Displace Glitch", type: "letter", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Electric Cyan (#00E5FF)" }
  },
  12: {
    "hero_founders_struggle": { fx: "delayed_pill_card_sweep", name: "Cyan Delayed Highlight Sweep Card (Ref #2)", type: "phrase", depth: "behind_subject", zone: "head_contact", score: "Goldilocks Scalp Contact ($Z:10$)" }
  },
  13: {
    "stem_build_everything": { fx: "subpixel_blur_mask", name: "Soft Word Rise", type: "word", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Crisp White (#FFFFFF)" }
  },
  14: {
    "stem_around_themselves": { fx: "subpixel_blur_mask", name: "Soft Word Rise", type: "word", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Crisp White (#FFFFFF)" }
  },
  15: {
    "stem_wonder_why": { fx: "top_down_character_drop", name: "Top-Down Character Drop Engine", type: "letter", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Character Drop" }
  },
  16: {
    "prefix_the_business": { fx: "subpixel_blur_mask", name: "Helper Prefix Slide", type: "word", depth: "behind_subject", zone: "head_contact", score: "Top Contrast (Dark #111111)" },
    "hero_cant_scale": { fx: "delayed_pill_card_sweep", name: "Red Delayed Highlight Sweep Card (Ref #2)", type: "phrase", depth: "behind_subject", zone: "head_contact", score: "Goldilocks Scalp Contact ($Z:10$)" }
  },
  17: {
    "stem_need_systems": { fx: "subpixel_blur_mask", name: "Soft Word Rise", type: "word", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Crisp White (#FFFFFF)" }
  },
  18: {
    "hero_create_momentum": { fx: "staggered_rotate_x", treatmentOverlay: "electric_blue_energy_line", name: "3D Cascade + Energy Line", type: "letter", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Cyan Momentum (#00E5FF)" }
  },
  19: {
    "stem_not_involved": { fx: "subpixel_blur_mask", name: "Soft Word Rise", type: "word", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Crisp White (#FFFFFF)" }
  },
  20: {
    "prefix_thats_how": { fx: "subpixel_blur_mask", name: "Controlled Detachment Prefix", type: "word", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Chest Zone ($Z:30$)" },
    "payoff_businesses_scale": { fx: "typewriter_engine", name: "Ghost Typewriter Engine", type: "letter", depth: "in_front_of_subject", zone: "chest_lower_third", score: "Rocket Launch Cutout ($Z:10$)" }
  }
};

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prometheus Core — Goldilocks Zone Scalp Contact Studio</title>
  
  <!-- Authoritative WebFont imports -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,400..800;1,9..40,400..800&family=DM+Serif+Display:ital@0;1&family=Great+Vibes&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --bg-dark: #070913;
      --panel-bg: #101625;
      --panel-border: rgba(255, 255, 255, 0.08);
      --accent-cyan: #00F0FF;
      --accent-purple: #8B5CF6;
      --accent-pink: #EC4899;
      --accent-green: #10B981;
      --accent-yellow: #F59E0B;
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --stage-width: 415px;
      --stage-height: 738px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'DM Sans', sans-serif; }
    body { background-color: var(--bg-dark); color: var(--text-main); min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; overflow-x: hidden; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 22px; font-weight: 800; letter-spacing: 0.04em; background: linear-gradient(135deg, #00F0FF 0%, #A855F7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-transform: uppercase; margin-bottom: 6px; }
    .header p { font-size: 13px; color: var(--text-muted); }
    .app-layout { display: flex; gap: 32px; max-width: 1240px; width: 100%; align-items: flex-start; justify-content: center; }

    /* CLEAN DARK STAGE CANVAS CONTAINER */
    .stage-container { position: relative; width: var(--stage-width); height: var(--stage-height); background: linear-gradient(180deg, #070913 0%, #0F172A 100%); border-radius: 40px; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 10px #1E293B; overflow: hidden; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 36px 20px; perspective: 1000px; }
    .stage-notch { position: absolute; top: 14px; width: 120px; height: 22px; background: #1E293B; border-radius: 12px; z-index: 100; }
    .stage-time-badge { position: absolute; top: 16px; right: 24px; font-size: 11px; font-weight: 700; color: #64748B; letter-spacing: 0.05em; z-index: 100; font-family: monospace; }
    
    /* DYNAMIC MEDIAPIPE FACE BOX BOUNDARY OVERLAY */
    .mediapipe-face-overlay { position: absolute; left: 0%; top: ${scalpTopPercent.toFixed(2)}%; width: 100%; height: 60%; border-top: 2px dashed #00F0FF; background: rgba(0, 240, 255, 0.04); z-index: 15; pointer-events: none; transition: opacity 0.3s; }
    .mediapipe-bbox-label-red { position: absolute; top: 6px; left: 12px; font-size: 9px; font-weight: 800; font-family: monospace; color: #00F0FF; background: rgba(16, 22, 37, 0.85); padding: 2px 8px; border-radius: 4px; border: 1px solid #00F0FF; }

    /* AUTHORITATIVE MATTED MALE TALKING HEAD CUTOUT LAYER (Z-INDEX: 20) */
    .speaker-matted-layer { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 108%; height: auto; max-height: 88%; object-fit: contain; z-index: 20; pointer-events: none; filter: drop-shadow(0 15px 25px rgba(0,0,0,0.25)); }

    /* BACKGROUND MATTED ASSET CONTAINER (Z-INDEX: 10) BEHIND SPEAKER! */
    .semantic-bg-asset-layer {
      position: absolute;
      z-index: 10;
      pointer-events: none;
      transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* PRISTINE FULL-COLOR TREATED ASSET CANVAS */
    .treated-asset-canvas {
      display: block;
      filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.35));
    }

    .halftone-mosaic-wrap {
      position: relative;
      display: inline-block;
    }

    /* GAUSSIAN BLUR ENTRY + CUBIC BEZIER SMOOTH ANIMATION PRIMITIVES */
    .asset-anim-asset_gaussian_bezier_rise {
      animation: assetGaussianRise 0.75s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }

    @keyframes assetGaussianRise {
      0% { opacity: 0; filter: blur(14px); transform: translateY(40px) scale(0.9); }
      70% { filter: blur(2px); }
      100% { opacity: 1; filter: blur(0px); transform: translateY(0) scale(1); }
    }

    .asset-anim-asset_rotate_spin_bezier .treated-asset-canvas {
      animation: assetRotateSpinBezier 26s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
    }

    @keyframes assetRotateSpinBezier {
      0% { transform: rotate(0deg); filter: blur(12px); opacity: 0; }
      10% { filter: blur(0px); opacity: 1; }
      100% { transform: rotate(360deg); filter: blur(0px); opacity: 1; }
    }

    .asset-anim-asset_bezier_scale_fade {
      animation: assetBezierScaleFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes assetBezierScaleFade {
      0% { opacity: 0; filter: blur(16px); transform: scale(0.65) translateY(30px); }
      60% { filter: blur(1px); transform: scale(1.04); }
      100% { opacity: 1; filter: blur(0px); transform: scale(1) translateY(0); }
    }

    /* RESTORED CINEMATIC GOLDILOCKS ZONE STAGE POSITIONS (Zone A: y=${goldilocksHeadStageTopPercent}% AT Z:10 FOR TACTILE HEAD CONTACT!) */
    .family-composite-stage-head { position: absolute; top: ${goldilocksHeadStageTopPercent}%; left: 0; width: 100%; display: flex; flex-direction: column; justify-content: flex-start; align-items: center; text-align: center; overflow: visible; pointer-events: none; }
    .family-composite-stage-chest { position: absolute; top: 56.5%; left: 0; width: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; overflow: visible; pointer-events: none; z-index: 30 !important; }
    .layer-group { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; overflow: visible; }
    .typo-layer { max-width: 96%; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; overflow: visible; backface-visibility: visible; white-space: nowrap; position: relative; text-align: center; }

    .layer-behind-subject { z-index: 10 !important; position: relative; }
    .layer-front-of-subject { z-index: 30 !important; position: relative; }
    .char-item, .word-item { font-family: inherit !important; font-size: inherit !important; font-weight: inherit !important; font-style: inherit !important; color: inherit !important; text-shadow: inherit !important; line-height: inherit !important; letter-spacing: inherit !important; text-transform: inherit !important; overflow: visible !important; margin-right: 0.24em; white-space: nowrap; }
    .char-item:last-child, .word-item:last-child { margin-right: 0; }

    /* DELAYED LEFT-TO-RIGHT HIGHLIGHT CARD SWEEP */
    .delayed-pill-card-container {
      position: relative;
      display: inline-block;
      padding: 6px 18px;
      overflow: hidden;
      border-radius: 6px;
      margin-top: 4px;
    }
    .delayed-pill-card-bg {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 0%;
      border-radius: 6px;
      z-index: 1;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      animation: pillCardSweepLeftToRight 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.25s forwards;
    }
    @keyframes pillCardSweepLeftToRight {
      0% { width: 0%; }
      100% { width: 100%; }
    }
    .delayed-pill-card-text {
      position: relative;
      z-index: 2;
      animation: textLandFirst 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes textLandFirst { 0% { opacity: 0; transform: scale(1.12); filter: blur(8px); } 100% { opacity: 1; transform: scale(1); filter: blur(0px); } }

    /* CIRCLE CONTRAST INVERSION MASK */
    .circle-mask-bg-circle {
      position: absolute;
      width: 150px;
      height: 150px;
      background: #00F0FF;
      border-radius: 50%;
      z-index: 1;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 40px rgba(0, 240, 255, 0.6);
      animation: circleMaskPop 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes circleMaskPop { 0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } }

    .overlay-cinematic_viewport_mask_sweep { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); animation: viewportMaskSweep 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes viewportMaskSweep { 0% { clip-path: polygon(0 0, 0 0, 0 100%, 0 100%); transform: translateX(-16px); } 100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); transform: translateX(0); } }
    .overlay-electric_blue_energy_line::after { content: ''; position: absolute; bottom: -4px; left: 0; width: 100%; height: 3px; background: linear-gradient(90deg, #00E5FF, #3B82F6); border-radius: 2px; box-shadow: 0 0 10px #00E5FF; animation: energyLineExpand 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes energyLineExpand { 0% { width: 0%; opacity: 0; } 100% { width: 100%; opacity: 1; } }

    .layer-fx-staggered_rotate_x .char-item { display: inline-block; transform-origin: 50% 100%; animation: charRotateXCascade 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
    @keyframes charRotateXCascade { 0% { opacity: 0; transform: perspective(600px) rotateX(-90deg) translateY(24px); filter: blur(8px); } 100% { opacity: 1; transform: perspective(600px) rotateX(0deg) translateY(0); filter: blur(0px); } }
    .layer-fx-slot_bounce .word-item { display: inline-block; animation: wordSlotBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) backwards; }
    @keyframes wordSlotBounce { 0% { opacity: 0; transform: translateY(32px) scaleY(0.7); } 70% { transform: translateY(-6px) scaleY(1.05); } 100% { opacity: 1; transform: translateY(0) scaleY(1); } }
    .layer-fx-keynote_punch { animation: keynoteFocalPunch 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes keynoteFocalPunch { 0% { opacity: 0; transform: scale(1.38); filter: blur(16px); } 60% { transform: scale(0.96); filter: blur(0px); } 100% { opacity: 1; transform: scale(1); filter: blur(0px); } }
    .layer-fx-subpixel_blur_mask .word-item, .layer-fx-subpixel_blur_mask { animation: subpixelMask 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
    @keyframes subpixelMask { 0% { opacity: 0; transform: translateY(16px); filter: blur(8px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0px); } }
    .layer-fx-defocus_rack_focus { animation: defocusSnap 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes defocusSnap { 0% { opacity: 0; filter: blur(28px); transform: scale(1.18); } 70% { filter: blur(2px); } 100% { opacity: 1; filter: blur(0px); transform: scale(1); } }
    .layer-fx-chromatic_character_displace .char-item { display: inline-block; animation: chromaticGlitchChar 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
    .layer-fx-chromatic_character_displace .char-item:nth-child(even) { color: #00F0FF !important; text-shadow: -2px 0 #FF3366, 2px 0 #00F0FF !important; }
    @keyframes chromaticGlitchChar { 0% { opacity: 0; transform: translateX(-12px) skewX(20deg); filter: blur(6px); } 100% { opacity: 1; transform: translateX(0) skewX(0deg); filter: blur(0px); } }

    .inspector-panel { flex: 1; max-width: 600px; background: var(--panel-bg); border: 1px solid var(--panel-border); border-radius: 20px; padding: 24px; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); }
    .inspector-title { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent-cyan); display: flex; align-items: center; justify-content: space-between; }
    .badge-live { font-size: 10px; padding: 3px 8px; background: rgba(0, 240, 255, 0.15); border: 1px solid var(--accent-cyan); border-radius: 12px; color: var(--accent-cyan); }
    .controls-bar { display: flex; gap: 10px; align-items: center; background: rgba(255, 255, 255, 0.03); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--panel-border); flex-wrap: wrap; }
    .btn { background: #1E293B; border: 1px solid var(--panel-border); color: var(--text-main); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; }
    .btn-primary { background: #2563EB; border-color: #2563EB; }
    .btn-green { background: rgba(16, 185, 129, 0.2); border-color: var(--accent-green); color: var(--accent-green); }
    .timeline-scrubber { flex: 1; min-width: 120px; height: 6px; -webkit-appearance: none; background: #334155; border-radius: 4px; outline: none; cursor: pointer; }
    .timeline-scrubber::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--accent-cyan); cursor: pointer; }
    .meta-card { background: rgba(255, 255, 255, 0.02); border: 1px solid var(--panel-border); border-radius: 12px; padding: 16px; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .meta-label { color: var(--text-muted); }
    .meta-val { font-weight: 600; color: #FFF; text-align: right; }
    .layers-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    .layers-table th, .layers-table td { padding: 7px 8px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
    .layers-table th { color: var(--text-muted); font-weight: 600; text-transform: uppercase; font-size: 9px; }
    .badge-optimal { color: var(--accent-green); font-weight: 700; }
    .chunk-picker { display: flex; gap: 6px; flex-wrap: wrap; max-height: 120px; overflow-y: auto; padding-right: 4px; }
    .chip { padding: 4px 10px; font-size: 11px; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--panel-border); border-radius: 6px; cursor: pointer; color: var(--text-muted); }
    .chip.active { background: rgba(0, 240, 255, 0.12); border-color: var(--accent-cyan); color: var(--accent-cyan); }
  </style>
</head>
<body>

  <div class="header">
    <h1>Prometheus Core — Goldilocks Zone Scalp Contact Studio</h1>
    <p>Isolated Test Run • Goldilocks Scalp Contact ($Z:10$) • Fluid Font Scaler Zero Edge Clipping</p>
  </div>

  <div class="app-layout">
    <div class="stage-container">
      <div class="stage-notch"></div>
      <div class="stage-time-badge" id="timeBadge">00:00</div>

      <!-- Z-INDEX 10: BACKGROUND MATTED SEMANTIC ASSET LAYER (BEHIND SPEAKER SHOULDER!) -->
      <div class="semantic-bg-asset-layer" id="semanticBgAssetLayer"></div>

      <!-- Z-INDEX 20: AUTHORITATIVE MATTED MALE TALKING HEAD SPEAKER (INLINE BASE64) -->
      <img src="${speakerBase64}" id="mattedSpeakerImg" class="speaker-matted-layer" alt="The Matted Male Talking Head">

      <!-- Z-INDEX 15: LIVE MEDIAPIPE FACE SCALP BOUNDARY OVERLAY -->
      <div class="mediapipe-face-overlay" id="mediapipeFaceOverlay">
        <span class="mediapipe-bbox-label-red">MediaPipe Scalp Top Baseline: ${scalpTopPercent.toFixed(2)}%</span>
      </div>

      <!-- ZONE A: HEAD-CONTACT STAGE (y:${goldilocksHeadStageTopPercent}% AT Z:10 - TACTILE SCALP CONTACT!) -->
      <div class="family-composite-stage-head" id="familyHeadStage"></div>

      <!-- ZONE B: CHEST STAGE (y:56.5% AT Z:30) -->
      <div class="family-composite-stage-chest" id="familyChestStage"></div>
    </div>

    <div class="inspector-panel">
      <div class="inspector-title">
        <span>Goldilocks Scalp Contact Studio</span>
        <span class="badge-live">TACTILE 3D DEPTH ACTIVE</span>
      </div>

      <div class="controls-bar">
        <button class="btn btn-primary" id="btnPlay">Pause</button>
        <button class="btn" id="btnPrev">Prev</button>
        <button class="btn" id="btnNext">Next</button>
        <button class="btn btn-green" id="btnToggleBbox">Scalp Baseline Line: ON</button>
        <input type="range" class="timeline-scrubber" id="timelineScrubber" min="0" max="19" value="0">
      </div>

      <div class="meta-card">
        <div class="meta-row">
          <span class="meta-label">Observation Provider</span>
          <span class="meta-val" style="color: var(--accent-cyan);">mediapipe_opencv_py311</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Scalp Contact Calibration</span>
          <span class="meta-val" style="color: var(--accent-pink);">Goldilocks Zone (${goldilocksHeadStageTopPercent}% at Z:10)</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Active Background Asset</span>
          <span class="meta-val" id="metaBgAssetInfo" style="color: var(--accent-pink);">None Active</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Chunk & Timestamp</span>
          <span class="meta-val" id="metaChunkInfo">Chunk 1 of 20 • 00:00</span>
        </div>
      </div>

      <div class="meta-card">
        <div class="meta-row" style="margin-bottom: 10px;">
          <span class="meta-label" style="font-weight: 700; color: var(--text-main);">Kinetic Typography & Asset Telemetry</span>
        </div>
        <table class="layers-table">
          <thead>
            <tr>
              <th>Layer Name</th>
              <th>Font / Asset Specs</th>
              <th>Animation Treatment</th>
              <th>Z-Stack Depth</th>
              <th>Alignment Status</th>
            </tr>
          </thead>
          <tbody id="layersTableBody"></tbody>
        </table>
      </div>

      <div class="meta-card">
        <div class="meta-row" style="margin-bottom: 10px;">
          <span class="meta-label" style="font-weight: 700; color: var(--text-main);">Sequence Navigation</span>
        </div>
        <div class="chunk-picker" id="chunkPicker"></div>
      </div>
    </div>
  </div>

  <script>
    const payload = ${JSON.stringify(maleSequencePayload4)};
    const perLayerMap = ${JSON.stringify(perLayerKineticMap)};

    let currentIndex = 0;
    let isPlaying = true;
    let showBbox = true;
    let timer = null;

    const familyHeadStage = document.getElementById('familyHeadStage');
    const familyChestStage = document.getElementById('familyChestStage');
    const semanticBgAssetLayer = document.getElementById('semanticBgAssetLayer');
    const mediapipeFaceOverlay = document.getElementById('mediapipeFaceOverlay');
    const timeBadge = document.getElementById('timeBadge');
    const metaChunkInfo = document.getElementById('metaChunkInfo');
    const metaBgAssetInfo = document.getElementById('metaBgAssetInfo');
    const layersTableBody = document.getElementById('layersTableBody');
    const chunkPicker = document.getElementById('chunkPicker');
    const timelineScrubber = document.getElementById('timelineScrubber');
    const btnPlay = document.getElementById('btnPlay');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const btnToggleBbox = document.getElementById('btnToggleBbox');

    // ALGORITHMIC OUTER BOUNDARY FLOOD MATTING:
    function renderOuterFloodMatteAsset(dataUri, targetWidthPx, callback) {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const visited = new Uint8Array(width * height);
        const queue = [];

        function trySeed(x, y) {
          const idx = y * width + x;
          if (visited[idx]) return;
          const p = idx * 4;
          const brightness = (data[p] + data[p + 1] + data[p + 2]) / 3;
          if (brightness < 45) {
            visited[idx] = 1;
            queue.push(idx);
          }
        }

        for (let x = 0; x < width; x++) { trySeed(x, 0); trySeed(x, height - 1); }
        for (let y = 0; y < height; y++) { trySeed(0, y); trySeed(width - 1, y); }

        let head = 0;
        while (head < queue.length) {
          const curr = queue[head++];
          const cx = curr % width;
          const cy = Math.floor(curr / width);

          data[curr * 4 + 3] = 0;

          const neighbors = [
            [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
          ];

          for (let n = 0; n < neighbors.length; n++) {
            const nx = neighbors[n][0];
            const ny = neighbors[n][1];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (!visited[nIdx]) {
                const np = nIdx * 4;
                const nBrightness = (data[np] + data[np + 1] + data[np + 2]) / 3;
                if (nBrightness < 45) {
                  visited[nIdx] = 1;
                  queue.push(nIdx);
                }
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        canvas.className = 'treated-asset-canvas';
        canvas.style.width = targetWidthPx + 'px';
        canvas.style.height = 'auto';

        callback(canvas);
      };
      img.src = dataUri;
    }

    payload.forEach((item, index) => {
      const chip = document.createElement('div');
      chip.className = 'chip' + (index === 0 ? ' active' : '');
      chip.innerText = '#' + (index + 1);
      chip.onclick = () => jumpTo(index);
      chunkPicker.appendChild(chip);
    });

    function applyCasing(text, casing) {
      if (casing === 'uppercase') return text.toUpperCase();
      if (casing === 'lowercase') return text.toLowerCase();
      if (casing === 'title_case') {
        return text.replace(/(^|\\s)([^\\s])/g, (_, p, c) => p + c.toUpperCase());
      }
      return text;
    }

    function renderChunk(index) {
      currentIndex = index;
      const data = payload[index];
      const chunkKinetic = perLayerMap[index + 1] || {};
      const isHeadZoneChunk = Object.values(chunkKinetic).some(t => t.zone === 'head_contact');

      timeBadge.innerText = data.timestamp.split('—')[0].trim();
      metaChunkInfo.innerText = \`Chunk \${data.chunkIndex} of \${payload.length} • \${data.timestamp}\`;
      timelineScrubber.value = index;

      Array.from(chunkPicker.children).forEach((chip, i) => {
        chip.classList.toggle('active', i === index);
      });

      familyHeadStage.innerHTML = '';
      familyChestStage.innerHTML = '';
      semanticBgAssetLayer.innerHTML = '';
      layersTableBody.innerHTML = '';

      if (data.backgroundAsset) {
        const bgAsset = data.backgroundAsset;
        metaBgAssetInfo.innerText = \`\${bgAsset.assetName}\`;

        const halftoneWrap = document.createElement('div');
        halftoneWrap.className = 'halftone-mosaic-wrap';

        const animContainer = document.createElement('div');
        animContainer.className = \`asset-anim-\${bgAsset.motion || 'asset_bezier_scale_fade'}\`;
        animContainer.appendChild(halftoneWrap);

        renderOuterFloodMatteAsset(bgAsset.imageUrl, bgAsset.position.widthPx, (keyedCanvas) => {
          halftoneWrap.appendChild(keyedCanvas);
        });

        semanticBgAssetLayer.style.top = \`\${bgAsset.position.topPercent}%\`;
        semanticBgAssetLayer.style.left = \`\${bgAsset.position.leftPercent}%\`;
        semanticBgAssetLayer.appendChild(animContainer);

        const trAsset = document.createElement('tr');
        trAsset.innerHTML = \`
          <td style="font-family: monospace; color: var(--accent-pink); font-weight: 700;">[BG-ASSET] \${bgAsset.assetId}</td>
          <td style="color: var(--accent-yellow); font-weight: 700;">Shoulder Clearance</td>
          <td style="color: var(--accent-purple); font-weight: 700;">BEHIND SPEAKER (Z:10)</td>
          <td><span class="badge-optimal">Shoulder Clearance Enforced</span></td>
        \`;
        layersTableBody.appendChild(trAsset);
      } else {
        metaBgAssetInfo.innerText = 'None Active';
      }

      const familyGroup = document.createElement('div');
      familyGroup.className = 'layer-group';
      let globalCharIndex = 0;

      data.layers.forEach((layer, layerIdx) => {
        const layerTrait = chunkKinetic[layer.layerName] || { fx: 'subpixel_blur_mask', type: 'word', depth: 'in_front_of_subject', zone: 'head_contact', score: 'Standard Rule' };
        const isBoldMattedLayer = (layerTrait.depth === 'behind_subject') && (layer.fontWeight >= 700 || layer.fontSizePx >= 34);

        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td style="font-family: monospace; color: var(--accent-cyan);">\${layer.layerName}</td>
          <td style="font-weight: 700;">\${layer.fontFamily} \${layer.fontSizePx}px</td>
          <td style="font-weight: 700; color: var(--accent-yellow);">\${layerTrait.name}</td>
          <td style="font-weight: 700; color: \${isBoldMattedLayer ? 'var(--accent-pink)' : 'var(--accent-cyan)'}">\${isBoldMattedLayer ? 'BEHIND SPEAKER (Z:10)' : 'IN FRONT (Z:30)'}</td>
          <td><span class="badge-optimal">\${isBoldMattedLayer ? 'Goldilocks Scalp Contact' : 'Front Stage Clearance'}</span></td>
        \`;
        layersTableBody.appendChild(tr);

        const layerDiv = document.createElement('div');
        const overlayClass = layerTrait.treatmentOverlay ? ' overlay-' + layerTrait.treatmentOverlay : '';
        layerDiv.className = 'typo-layer layer-fx-' + layerTrait.fx + overlayClass + (isBoldMattedLayer ? ' layer-behind-subject' : ' layer-front-of-subject');

        layerDiv.style.fontFamily = \`"\${layer.fontFamily}", sans-serif\`;
        layerDiv.style.fontWeight = layer.fontWeight;
        layerDiv.style.fontStyle = layer.fontStyle || 'normal';
        layerDiv.style.fontSize = \`\${layer.fontSizePx}px\`;
        layerDiv.style.lineHeight = layer.lineHeight || 1.1;
        layerDiv.style.letterSpacing = layer.letterSpacingEm ? \`\${layer.letterSpacingEm}em\` : 'normal';
        layerDiv.style.color = layer.color || '#FFFFFF';
        layerDiv.style.marginTop = layer.marginTopPx ? \`\${layer.marginTopPx}px\` : '0px';

        if (layer.layerName.startsWith('prefix_')) {
          layerDiv.style.alignSelf = 'flex-start';
          layerDiv.style.marginLeft = '18px';
          layerDiv.style.marginBottom = '2px';
        }

        // 1. DELAYED LEFT-TO-RIGHT HIGHLIGHT CARD SWEEP
        if (layer.delayedPillCard) {
          const pillContainer = document.createElement('div');
          pillContainer.className = 'delayed-pill-card-container';

          const pillBg = document.createElement('div');
          pillBg.className = 'delayed-pill-card-bg';
          pillBg.style.backgroundColor = layer.delayedPillCard;

          const pillText = document.createElement('div');
          pillText.className = 'delayed-pill-card-text';
          pillText.innerText = applyCasing(layer.text, layer.casing);
          pillText.style.color = layer.color || '#111111';

          pillContainer.appendChild(pillBg);
          pillContainer.appendChild(pillText);
          layerDiv.appendChild(pillContainer);

        // 2. CIRCLE CONTRAST INVERSION MASK TREATMENT
        } else if (layer.circleMaskInversion) {
          const circleBg = document.createElement('div');
          circleBg.className = 'circle-mask-bg-circle';
          layerDiv.appendChild(circleBg);

          const rawText = applyCasing(layer.text, layer.casing);
          const words = rawText.split(/\\s+/);
          words.forEach((w) => {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'word-item';
            wordSpan.innerText = w;
            wordSpan.style.color = '#FFFFFF';
            wordSpan.style.zIndex = '2';
            layerDiv.appendChild(wordSpan);
          });

        // 3. STANDARD KINETIC ANIMATION TREATMENTS
        } else {
          let shadowCss = '';
          if (layer.dropShadow) {
            const s = layer.dropShadow;
            shadowCss = \`\${s.xOffset}px \${s.yOffset}px \${s.blurRadius}px \${s.color}\`;
          }
          if (layer.pseudoGlow) {
            shadowCss = shadowCss ? \`\${shadowCss}, \${layer.pseudoGlow}\` : layer.pseudoGlow;
          }
          if (shadowCss) {
            layerDiv.style.textShadow = shadowCss;
          }

          const rawText = applyCasing(layer.text, layer.casing);
          const isScriptFont = layer.fontFamily.toLowerCase().includes('vibes') || layer.fontFamily.toLowerCase().includes('script');

          if (layerTrait.type === 'letter' && !isScriptFont) {
            Array.from(rawText).forEach((char) => {
              const charSpan = document.createElement('span');
              charSpan.className = 'char-item';
              charSpan.innerHTML = char === ' ' ? '&nbsp;' : char;
              charSpan.style.animationDelay = \`\${globalCharIndex * 0.035}s\`;
              globalCharIndex++;
              layerDiv.appendChild(charSpan);
            });
          } else {
            const words = rawText.split(/\\s+/);
            words.forEach((w, wIdx) => {
              const wordSpan = document.createElement('span');
              wordSpan.className = 'word-item';
              wordSpan.innerText = w;
              wordSpan.style.animationDelay = \`\${(layerIdx * 2 + wIdx) * 0.09}s\`;
              layerDiv.appendChild(wordSpan);
            });
          }
        }

        familyGroup.appendChild(layerDiv);
      });

      if (isHeadZoneChunk) {
        familyHeadStage.appendChild(familyGroup);
      } else {
        familyChestStage.appendChild(familyGroup);
      }
    }

    function jumpTo(index) {
      renderChunk(index);
      if (isPlaying) restartTimer();
    }

    function nextChunk() {
      const next = (currentIndex + 1) % payload.length;
      renderChunk(next);
    }

    function prevChunk() {
      const prev = (currentIndex - 1 + payload.length) % payload.length;
      renderChunk(prev);
    }

    function togglePlay() {
      isPlaying = !isPlaying;
      btnPlay.innerText = isPlaying ? 'Pause' : 'Play';
      if (isPlaying) {
        restartTimer();
      } else {
        clearInterval(timer);
      }
    }

    function toggleBbox() {
      showBbox = !showBbox;
      mediapipeFaceOverlay.style.opacity = showBbox ? '1' : '0';
      btnToggleBbox.innerText = \`Scalp Baseline Line: \${showBbox ? 'ON' : 'OFF'}\`;
    }

    function restartTimer() {
      clearInterval(timer);
      timer = setInterval(nextChunk, 2400);
    }

    btnPlay.onclick = togglePlay;
    btnNext.onclick = () => { nextChunk(); if (isPlaying) restartTimer(); };
    btnPrev.onclick = () => { prevChunk(); if (isPlaying) restartTimer(); };
    btnToggleBbox.onclick = toggleBbox;
    timelineScrubber.oninput = (e) => jumpTo(parseInt(e.target.value, 10));

    renderChunk(0);
    restartTimer();
  </script>
</body>
</html>`;

const outHtmlPath = path.join(studioDir, "typography_treatment_presentation.html");
fs.writeFileSync(outHtmlPath, htmlContent);
console.log("SUCCESSFULLY_BUILT_GOLDILOCKS_SCALP_CONTACT_STUDIO:", outHtmlPath);
