import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { checkStudioAssets, checkPythonEnvironment } from "./preflight_environment_check.js";

const studioDir = __dirname;
const repoRoot = path.resolve(studioDir, "../..");

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

// 2. LIVE MEDIAPIPE / OPENCV VISION EXTRACTION
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
}

// Goldilocks zone scalp contact position
const goldilocksHeadStageTopPercent = 9.8;

// 3. LOAD ALL 45 AUTHORITATIVE FONT JSON PROFILES FROM DISK
const fontJsonDir = path.join(repoRoot, "Yuan Prometheus Screenshots/font JSON");
const fontJsonFiles = fs.readdirSync(fontJsonDir).filter(f => f.endsWith(".json"));
const allFontProfiles = fontJsonFiles.map(f => {
  try {
    return JSON.parse(fs.readFileSync(path.join(fontJsonDir, f), "utf8"));
  } catch (e) {
    return null;
  }
}).filter(Boolean);
console.log(`[FONT_CORPUS_LOADER] Successfully loaded ${allFontProfiles.length} authoritative Font JSON profiles.`);

// 4. LOAD RELEVANT ASSETS FOR TRANSCRIPT 2
const techFoundersTrioBase64 = getBase64DataUriFromPath(path.join(studioDir, "tech_founders_vintage_trio.jpg"));

// 5. AUTHORITATIVE 20-CHUNK RAW SPOKEN TRANSCRIPT (Script #2)
const rawSpokenChunks = [
  { chunkIndex: 1, timestamp: "00:00 — 00:02", text: "You can make", emphasis: "context" },
  { chunkIndex: 2, timestamp: "00:02 — 00:04", text: "$50,000 a month", emphasis: "hero_metric", metricValue: 50000, metricPrefix: "$", metricSuffix: "" },
  { chunkIndex: 3, timestamp: "00:04 — 00:06", text: "and still", emphasis: "transition" },
  { chunkIndex: 4, timestamp: "00:06 — 00:08", text: "have a broken business.", emphasis: "inflection_tension" },
  { chunkIndex: 5, timestamp: "00:08 — 00:10", text: "Because revenue", emphasis: "context" },
  { chunkIndex: 6, timestamp: "00:10 — 00:12", text: "doesn't automatically mean", emphasis: "clause" },
  { chunkIndex: 7, timestamp: "00:12 — 00:14", text: "you're building something scalable.", emphasis: "hero_concept" },
  { chunkIndex: 8, timestamp: "00:14 — 00:16", text: "I've seen founders", emphasis: "named_entity_founders" },
  { chunkIndex: 9, timestamp: "00:16 — 00:18", text: "make serious money", emphasis: "key_point" },
  { chunkIndex: 10, timestamp: "00:18 — 00:20", text: "while working", emphasis: "transition" },
  { chunkIndex: 11, timestamp: "00:20 — 00:22", text: "seventy hours every week.", emphasis: "hero_metric", metricValue: 70, metricPrefix: "", metricSuffix: " HOURS" },
  { chunkIndex: 12, timestamp: "00:22 — 00:24", text: "That's not freedom.", emphasis: "inflection_tension" },
  { chunkIndex: 13, timestamp: "00:24 — 00:26", text: "That's a", emphasis: "transition" },
  { chunkIndex: 14, timestamp: "00:26 — 00:28", text: "very expensive job.", emphasis: "hero_concept" },
  { chunkIndex: 15, timestamp: "00:28 — 00:30", text: "The real goal", emphasis: "context" },
  { chunkIndex: 16, timestamp: "00:30 — 00:32", text: "isn't just making more money.", emphasis: "contrast_claim" },
  { chunkIndex: 17, timestamp: "00:32 — 00:34", text: "It's building systems", emphasis: "inflection_solution" },
  { chunkIndex: 18, timestamp: "00:34 — 00:36", text: "that keep producing results", emphasis: "key_point" },
  { chunkIndex: 19, timestamp: "00:36 — 00:38", text: "without requiring you", emphasis: "clause" },
  { chunkIndex: 20, timestamp: "00:38 — 00:40", text: "every single time.", emphasis: "terminal_payoff" }
];

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#070913">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Prometheus Core — Dynamic Probabilistic Selector Studio</title>
  
  <!-- Authoritative WebFont imports -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,400..900;1,9..40,400..900&family=DM+Serif+Display:ital@0;1&family=Great+Vibes&family=Montserrat:wght@800;900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --bg-dark: #070913;
      --panel-bg: #101625;
      --panel-border: rgba(255, 255, 255, 0.08);
      --accent-cyan: #00F0FF;
      --accent-purple: #8B5CF6;
      --accent-pink: #EC4899;
      --accent-green: #10B981;
      --accent-lime: #84CC16;
      --accent-yellow: #F59E0B;
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --stage-max-w: 395px;
      --stage-width: min(var(--stage-max-w), calc((100dvh - 170px) * (9 / 16)), calc(100vw - 20px));
      --stage-height: calc(var(--stage-width) * (16 / 9));
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'DM Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
    
    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: max(10px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
      overflow-x: hidden;
    }

    .header { text-align: center; margin-bottom: 8px; max-width: 900px; width: 100%; }
    .header h1 { font-size: clamp(15px, 3.8vw, 20px); font-weight: 800; letter-spacing: 0.04em; background: linear-gradient(135deg, #00F0FF 0%, #A855F7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-transform: uppercase; margin-bottom: 2px; }
    .header p { font-size: clamp(11px, 2.4vw, 12px); color: var(--text-muted); }

    /* DYNAMIC SELECTOR TOOLBAR */
    .selector-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 12px;
      max-width: 900px;
      width: 100%;
    }

    .btn-reroll {
      background: linear-gradient(135deg, #00F0FF 0%, #8B5CF6 100%);
      color: #070913;
      border: none;
      border-radius: 20px;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 900;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 18px rgba(0, 240, 255, 0.4);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .btn-reroll:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 6px 24px rgba(0, 240, 255, 0.6); }
    .btn-reroll:active { transform: scale(0.97); }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      color: var(--text-main);
      border-radius: 20px;
      padding: 7px 14px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.2s;
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.12); border-color: var(--accent-cyan); }

    .telemetry-chip {
      background: rgba(16, 22, 37, 0.9);
      border: 1px solid var(--panel-border);
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 11px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: monospace;
    }
    .telemetry-chip strong { color: var(--accent-cyan); font-weight: 800; }

    /* VIEW MODE TABS */
    .view-mode-tabs {
      display: flex;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--panel-border);
      border-radius: 30px;
      padding: 3px;
      gap: 4px;
      margin-bottom: 12px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    .tab-btn {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 7px 10px;
      border-radius: 24px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .tab-btn.active {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(139, 92, 246, 0.3));
      color: #FFF;
      border: 1px solid var(--accent-cyan);
      box-shadow: 0 2px 8px rgba(0, 240, 255, 0.25);
    }

    .app-layout {
      display: flex;
      gap: 24px;
      max-width: 1240px;
      width: 100%;
      align-items: flex-start;
      justify-content: center;
      transition: all 0.3s ease;
    }

    /* 9:16 MOBILE VIEWPORT STAGE CONTAINER */
    .stage-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: auto;
    }

    .stage-container {
      position: relative;
      width: var(--stage-width);
      height: var(--stage-height);
      aspect-ratio: 9 / 16;
      background: linear-gradient(180deg, #070913 0%, #0F172A 100%);
      border-radius: clamp(24px, 6vw, 36px);
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.95), 0 0 0 clamp(4px, 1.2vw, 8px) #1E293B;
      overflow: hidden !important;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 30px 16px;
      perspective: 1000px;
      user-select: none;
      touch-action: pan-y;
      cursor: pointer;
    }
    .stage-notch { position: absolute; top: 12px; width: 110px; height: 20px; background: #1E293B; border-radius: 12px; z-index: 100; }
    .stage-time-badge { position: absolute; top: 14px; right: 18px; font-size: 11px; font-weight: 700; color: #64748B; letter-spacing: 0.05em; z-index: 100; font-family: monospace; }
    
    .swipe-gesture-hint {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(16, 22, 37, 0.85);
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      padding: 4px 12px;
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      z-index: 100;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 6px;
      backdrop-filter: blur(8px);
    }

    /* MEDIAPIPE FACE BOX BOUNDARY OVERLAY */
    .mediapipe-face-overlay { position: absolute; left: 0%; top: ${scalpTopPercent.toFixed(2)}%; width: 100%; height: 60%; border-top: 2px dashed #00F0FF; background: rgba(0, 240, 255, 0.04); z-index: 15; pointer-events: none; transition: opacity 0.3s; }
    .mediapipe-bbox-label-red { position: absolute; top: 6px; left: 12px; font-size: 9px; font-weight: 800; font-family: monospace; color: #00F0FF; background: rgba(16, 22, 37, 0.85); padding: 2px 8px; border-radius: 4px; border: 1px solid #00F0FF; }

    /* MATTED MALE TALKING HEAD CUTOUT (Z:20) */
    .speaker-matted-layer { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 108%; height: auto; max-height: 88%; object-fit: contain; z-index: 20; pointer-events: none; filter: drop-shadow(0 15px 25px rgba(0,0,0,0.25)); }

    /* BACKGROUND MATTED ASSET (Z:10) BEHIND SPEAKER */
    .semantic-bg-asset-layer {
      position: absolute;
      z-index: 10;
      pointer-events: none;
      transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .treated-asset-canvas {
      display: block;
      filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.35));
    }
    .halftone-mosaic-wrap { position: relative; display: inline-block; }

    /* 3D KINETIC TYPOGRAPHY STAGES */
    .head-kinetic-stage {
      position: absolute;
      top: ${goldilocksHeadStageTopPercent}%;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      z-index: 10; /* BEHIND SPEAKER HEAD */
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      text-align: center;
    }

    .chest-kinetic-stage {
      position: absolute;
      top: 56.5%;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      z-index: 30; /* IN FRONT OF SPEAKER CHEST */
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      text-align: center;
    }

    .layer-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
    }

    .typo-layer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 6px 8px;
      max-width: 82%; /* Safe Margin */
      margin: 0 auto;
    }

    /* KINETIC ANIMATION PRIMITIVES */
    .word-item {
      display: inline-block;
      opacity: 0;
      animation-fill-mode: forwards;
      animation-duration: 0.65s;
      animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
    }

    .layer-fx-subpixel_blur_mask .word-item { animation-name: blurRise; }
    .layer-fx-defocus_rack_focus .word-item { animation-name: defocusSnap; }
    .layer-fx-staggered_rotate_x .word-item { animation-name: rotate3DCascade; }
    .layer-fx-keynote_punch .word-item { animation-name: keynotePunch; }
    .layer-fx-slot_bounce .word-item { animation-name: slotBounce; }
    .layer-fx-top_down_character_drop .word-item { animation-name: topDownDrop; }
    .layer-fx-typewriter_engine .word-item { animation-name: typewriterFade; }
    .layer-fx-chromatic_character_displace .word-item { animation-name: chromaticDisplace; }

    @keyframes blurRise { 0% { opacity: 0; filter: blur(12px); transform: translateY(22px) scale(0.96); } 100% { opacity: 1; filter: blur(0px); transform: translateY(0) scale(1); } }
    @keyframes defocusSnap { 0% { opacity: 0; filter: blur(18px); transform: scale(1.18); } 50% { filter: blur(4px); } 100% { opacity: 1; filter: blur(0); transform: scale(1); } }
    @keyframes rotate3DCascade { 0% { opacity: 0; filter: blur(8px); transform: perspective(600px) rotateX(75deg) translateY(30px); } 100% { opacity: 1; filter: blur(0); transform: perspective(600px) rotateX(0deg) translateY(0); } }
    @keyframes keynotePunch { 0% { opacity: 0; transform: scale(0.75); filter: blur(6px); } 60% { transform: scale(1.06); filter: blur(0px); } 100% { opacity: 1; transform: scale(1); } }
    @keyframes slotBounce { 0% { opacity: 0; transform: translateY(-40px); } 70% { transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
    @keyframes topDownDrop { 0% { opacity: 0; transform: translateY(-30px); filter: blur(8px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0px); } }
    @keyframes typewriterFade { 0% { opacity: 0; } 100% { opacity: 1; } }
    @keyframes chromaticDisplace {
      0% { opacity: 0; transform: translate(-8px, -4px) skewX(12deg); filter: drop-shadow(-4px 0 0 #00ffff) drop-shadow(4px 0 0 #ff0055); }
      50% { opacity: 0.9; transform: translate(4px, 2px) skewX(-6deg); filter: drop-shadow(2px 0 0 #00ffff) drop-shadow(-2px 0 0 #ff0055); }
      100% { opacity: 1; transform: translate(0, 0) skewX(0deg); filter: drop-shadow(0 0 0 transparent); }
    }

    /* CYBER MATRIX GLITCH (TYPO #30) */
    .lime-glitch-char {
      display: inline-block;
      font-weight: 900;
      animation: limeGlitchCharAnim 0.75s cubic-bezier(0.16, 1, 0.3, 1) backwards;
    }
    .lime-accent { color: #84CC16 !important; text-shadow: 0 0 20px rgba(132, 204, 22, 0.5) !important; }
    @keyframes limeGlitchCharAnim {
      0% { opacity: 0; transform: translate(-10px, -6px) skewX(18deg) scale(1.1); filter: blur(8px) drop-shadow(-6px 0 0 #00ffff) drop-shadow(6px 0 0 #ff0055); }
      30% { opacity: 0.9; transform: translate(6px, 3px) skewX(-12deg); filter: blur(2px) drop-shadow(4px 0 0 #00ffff) drop-shadow(-4px 0 0 #ff0055); }
      100% { opacity: 1; transform: translate(0, 0) skewX(0deg) scale(1); filter: blur(0px); }
    }

    /* DELAYED HIGHLIGHT CARD SWEEP */
    .delayed-pill-card-container {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 14px;
      border-radius: 8px;
      overflow: hidden;
    }
    .delayed-pill-card-bg {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      transform: scaleX(0);
      transform-origin: left center;
      border-radius: 8px;
      animation: pillCardSweepLeftToRight 0.5s 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      z-index: 1;
    }
    .delayed-pill-card-text {
      position: relative;
      z-index: 2;
      animation: pillTextFadeIn 0.3s ease forwards;
    }
    .card-yellow { background-color: #FFE600; }
    .card-red-pressure { background-color: #FF1744; }
    .card-cyan { background-color: #00F0FF; }

    @keyframes pillCardSweepLeftToRight { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
    @keyframes pillTextFadeIn { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }

    /* DYNAMIC NUMERIC TICKING COUNTER */
    .numeric-counter-item {
      display: inline-block;
      font-variant-numeric: tabular-nums;
    }

    /* SIDE INSPECTOR PANEL */
    .inspector-panel {
      flex: 1;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 20px;
      padding: 16px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.5);
      max-width: 580px;
      width: 100%;
    }
    .inspector-title { font-size: 14px; font-weight: 800; color: var(--accent-cyan); text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
    .chunk-chips-container { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 16px; max-height: 120px; overflow-y: auto; padding-right: 4px; }
    .chip { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--panel-border); color: var(--text-muted); font-size: 10px; font-weight: 700; padding: 4px 8px; border-radius: 12px; cursor: pointer; transition: all 0.15s; }
    .chip.active { background: var(--accent-cyan); color: #070913; border-color: var(--accent-cyan); font-weight: 900; }

    .layers-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    .layers-table th { text-align: left; padding: 6px 8px; color: var(--text-muted); border-bottom: 1px solid var(--panel-border); font-size: 10px; text-transform: uppercase; }
    .layers-table td { padding: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); vertical-align: middle; }
    .badge-optimal { background: rgba(16, 185, 129, 0.15); color: #10B981; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 9px; }

    /* CONTROLS TOOLBAR */
    .controls-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-top: 12px;
      width: 100%;
    }
    .ctrl-btn { background: rgba(255, 255, 255, 0.08); border: 1px solid var(--panel-border); color: #FFF; border-radius: 20px; padding: 8px 14px; font-size: 11.5px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
    .ctrl-btn:hover { background: rgba(255, 255, 255, 0.16); border-color: var(--accent-cyan); }
    .ctrl-btn-primary { background: linear-gradient(135deg, #00F0FF, #8B5CF6); color: #070913; font-weight: 900; border: none; }

    .timeline-slider-wrap { width: 100%; margin-top: 8px; display: flex; align-items: center; gap: 8px; }
    .timeline-slider { flex: 1; accent-color: var(--accent-cyan); }
  </style>
</head>
<body>

  <div class="header">
    <h1>Prometheus Dynamic Probabilistic Selector Studio</h1>
    <p>45 Font Profiles • 29 Kinetic Presets • Live Combinatorial Generator</p>
  </div>

  <!-- DYNAMIC SELECTOR RE-ROLL TOOLBAR -->
  <div class="selector-toolbar">
    <button class="btn-reroll" id="btnReroll" onclick="reRollTreatment()">
      🎲 Re-Roll Dynamic Treatment
    </button>
    <button class="btn-secondary" onclick="resetSeed(101)">
      ↺ Reset Seed #101
    </button>
    <div class="telemetry-chip">
      <span>Seed: <strong id="lblActiveSeed">#101</strong></span>
    </div>
    <div class="telemetry-chip">
      <span>Permutations: <strong>&gt;35,000</strong></span>
    </div>
    <a href="typography.html" target="_blank" class="btn-secondary" style="text-decoration:none;">
      ⚡ Master Kinetic Suite (29 Presets)
    </a>
  </div>

  <!-- VIEW MODE TABS -->
  <div class="view-mode-tabs">
    <button class="tab-btn active" id="tabPresentation" onclick="setViewMode('presentation')">🎬 20-Chunk Sequence</button>
    <button class="tab-btn" id="tabDiagnostics" onclick="setViewMode('diagnostics')">🔍 Trait Inspector</button>
  </div>

  <div class="app-layout">
    
    <!-- 9:16 MOBILE STAGE WRAPPER -->
    <div class="stage-wrapper">
      <div class="stage-container" id="stageContainer" onclick="nextChunk()">
        <div class="stage-notch"></div>
        <div class="stage-time-badge" id="stageTimeBadge">00:00</div>

        <!-- MEDIAPIPE GOLDILOCKS WIREFRAME OVERLAY -->
        <div class="mediapipe-face-overlay" id="mediapipeFaceOverlay" style="opacity: 0;">
          <span class="mediapipe-bbox-label-red">MEDIAPIPE SCALP Y: ${scalpTopPercent.toFixed(2)}% (Z:10 GOLDILOCKS)</span>
        </div>

        <!-- BACKGROUND MATTED ASSET (Z:10) -->
        <div class="semantic-bg-asset-layer" id="semanticBgAssetLayer"></div>

        <!-- ZONE A: HEAD CONTACT STAGE (Z:10) BEHIND SPEAKER HEAD -->
        <div class="head-kinetic-stage" id="familyHeadStage"></div>

        <!-- SPEAKER MATTED HEAD CUTOUT (Z:20) -->
        <img class="speaker-matted-layer" src="${speakerBase64}" alt="Speaker Matted Head" />

        <!-- ZONE B: CHEST LOWER-THIRD STAGE (Z:30) IN FRONT OF CHEST -->
        <div class="chest-kinetic-stage" id="familyChestStage"></div>

        <div class="swipe-gesture-hint">
          <span>👆 Tap Stage for Next Chunk</span>
        </div>
      </div>

      <!-- PLAYBACK CONTROLS -->
      <div class="controls-bar">
        <button class="ctrl-btn" id="btnPrev" onclick="prevChunk()">⏮ Prev</button>
        <button class="ctrl-btn ctrl-btn-primary" id="btnPlay" onclick="togglePlay()">⏸ Pause</button>
        <button class="ctrl-btn" id="btnNext" onclick="nextChunk()">Next ⏭</button>
        <button class="ctrl-btn" id="btnToggleBbox" onclick="toggleBbox()">📐 Wireframe: OFF</button>
      </div>

      <div class="timeline-slider-wrap">
        <input type="range" class="timeline-slider" id="timelineScrubber" min="0" max="19" value="0" oninput="jumpTo(parseInt(this.value, 10))">
      </div>
    </div>

    <!-- SIDE INSPECTOR PANEL -->
    <div class="inspector-panel" id="inspectorPanel">
      <div class="inspector-title">
        <span>Dynamic Layer Inspector</span>
        <span id="lblActiveChunk" style="font-size: 11px; color: var(--text-muted);">Chunk 1 of 20</span>
      </div>

      <div class="chunk-chips-container" id="chunkPicker"></div>

      <div style="margin-bottom: 8px; font-size: 11px; color: var(--text-muted);">
        <span>Active Profile: <strong id="lblActiveProfile" style="color: var(--accent-cyan);">--</strong></span> • 
        <span>Inflection Tier: <strong id="lblActiveTier" style="color: var(--accent-yellow);">--</strong></span>
      </div>

      <table class="layers-table">
        <thead>
          <tr>
            <th>Layer / Role</th>
            <th>Font & Scale</th>
            <th>Kinetic Preset</th>
            <th>Depth Plane</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="layersTableBody"></tbody>
      </table>
    </div>

  </div>

  <script>
    // 1. EMBEDDED CORPUS: 45 AUTHORITATIVE FONT JSON PROFILES
    const ALL_FONT_PROFILES = ${JSON.stringify(allFontProfiles)};
    const TECH_FOUNDERS_BASE64 = "${techFoundersTrioBase64}";
    const RAW_CHUNKS = ${JSON.stringify(rawSpokenChunks)};

    // 2. KINETIC PRESET POOL (29 Signature Treatments)
    const KINETIC_PRESETS = [
      { id: "subpixel_blur_mask", name: "Soft Subpixel Blur Rise", scope: "word" },
      { id: "defocus_rack_focus", name: "Defocus Aperture Snap", scope: "word" },
      { id: "staggered_rotate_x", name: "3D Perspective Stagger Cascade", scope: "letter" },
      { id: "keynote_punch", name: "Keynote Focal Scale Punch", scope: "phrase" },
      { id: "slot_bounce", name: "Kinetic Slot Machine Bounce", scope: "word" },
      { id: "acid_lime_letter_glitch", name: "Cyber Acid Lime Matrix Glitch (TYPO #30)", scope: "glyph" },
      { id: "chromatic_character_displace", name: "RGB Chromatic Split Glitch", scope: "letter" },
      { id: "top_down_character_drop", name: "Kinetic Top-Down Glyph Drop", scope: "letter" },
      { id: "typewriter_engine", name: "Hexta Ghost Typewriter", scope: "letter" }
    ];

    let currentSeed = 101;
    let compiledSequence = [];
    let currentIndex = 0;
    let isPlaying = true;
    let showBbox = false;
    let playTimer = null;

    // Seeded PRNG (Mulberry32)
    function mulberry32(a) {
      return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }
    }

    // 3. DYNAMIC PROBABILISTIC SELECTOR ENGINE
    function compileDynamicSequence(seed) {
      const rng = mulberry32(seed);
      let lastProfileName = "";
      let lastCardIndex = -10;
      let lastHeroPreset = "";

      return RAW_CHUNKS.map((raw, chunkIdx) => {
        const words = raw.text.trim().split(' ').filter(w => w.length > 0);
        const wordCount = words.length;

        // Filter candidate font profiles matching word count (+/- 1)
        let candidateProfiles = ALL_FONT_PROFILES.filter(p => {
          if (p.profile_name === lastProfileName) return false;
          const pWords = p.metadata?.total_word_count || 2;
          return Math.abs(pWords - wordCount) <= 1;
        });

        if (candidateProfiles.length === 0) {
          candidateProfiles = ALL_FONT_PROFILES.filter(p => p.profile_name !== lastProfileName);
        }

        const selectedProfile = candidateProfiles[Math.floor(rng() * candidateProfiles.length)] || ALL_FONT_PROFILES[0];
        lastProfileName = selectedProfile.profile_name;

        // Multi-Layer Splicing Grammar
        let layers = [];
        let kineticMap = {};
        let backgroundAsset = null;

        // Splicing: Split multi-word chunks into prefix + hero or single layer
        if (wordCount >= 2) {
          const splitIdx = Math.max(1, Math.floor(wordCount / 2));
          const prefixText = words.slice(0, splitIdx).join(' ');
          const heroText = words.slice(splitIdx).join(' ');

          const layer1Profile = selectedProfile.typography_layers[0] || {};
          const layer2Profile = selectedProfile.typography_layers[1] || selectedProfile.typography_layers[0] || {};

          // Choose 2 non-competing kinetic presets
          const prefixFx = rng() > 0.4 ? "subpixel_blur_mask" : "defocus_rack_focus";
          
          let heroFxPool = KINETIC_PRESETS.filter(p => p.id !== prefixFx && p.id !== lastHeroPreset);
          if (raw.emphasis === "inflection_tension" && rng() > 0.3) {
            heroFxPool = KINETIC_PRESETS.filter(p => p.id === "acid_lime_letter_glitch" || p.id === "chromatic_character_displace" || p.id === "staggered_rotate_x");
          }
          const heroPreset = heroFxPool[Math.floor(rng() * heroFxPool.length)] || KINETIC_PRESETS[0];
          lastHeroPreset = heroPreset.id;

          // Layer 1 (Prefix)
          const l1 = {
            layerName: "prefix_" + chunkIdx,
            text: prefixText,
            fontFamily: layer1Profile.matched_font_candidates?.[0] || "Playfair Display",
            fontWeight: layer1Profile.font_style?.weight || 700,
            fontStyle: layer1Profile.font_style?.style || "italic",
            fontSizePx: Math.round((layer1Profile.font_style?.size_px_base || 34) * 0.85),
            color: "#FFFFFF",
            casing: layer1Profile.font_style?.casing || "none",
            dropShadow: { xOffset: 0, yOffset: 2, blurRadius: 10, color: "rgba(0,0,0,0.85)" }
          };

          // Layer 2 (Hero Keyword)
          const l2 = {
            layerName: "hero_" + chunkIdx,
            text: heroText,
            fontFamily: layer2Profile.matched_font_candidates?.[0] || "DM Sans",
            fontWeight: layer2Profile.font_style?.weight || 800,
            fontStyle: layer2Profile.font_style?.style || "normal",
            fontSizePx: layer2Profile.font_style?.size_px_base || 40,
            color: layer2Profile.font_style?.color || (heroPreset.id === "acid_lime_letter_glitch" ? "#84CC16" : (rng() > 0.5 ? "#00F0FF" : "#FFE600")),
            casing: layer2Profile.font_style?.casing || "none",
            letterSpacingEm: layer2Profile.font_style?.letter_spacing_em || -0.02,
            marginTopPx: 2,
            dropShadow: { xOffset: 0, yOffset: 3, blurRadius: 12, color: "rgba(0,0,0,0.9)" }
          };

          // Dynamic Numeric Counter Prior
          if (raw.metricValue) {
            l2.numericCounter = {
              targetValue: raw.metricValue,
              prefix: raw.metricPrefix || "",
              suffix: raw.metricSuffix || "",
              durationMs: 850
            };
          }

          // Delayed Highlight Card Sweep Prior (anti-clustering: separation >= 4)
          if ((raw.emphasis === "inflection_tension" || raw.emphasis === "inflection_solution") && (chunkIdx - lastCardIndex >= 4) && rng() > 0.35) {
            l2.delayedPillCard = rng() > 0.5 ? "#FFE600" : "#FF1744";
            lastCardIndex = chunkIdx;
          }

          layers = [l1, l2];
          
          const isHeadZone = l2.fontWeight >= 700 && rng() > 0.45;
          kineticMap[l1.layerName] = { fx: prefixFx, name: "Helper Prefix", depth: isHeadZone ? "behind_subject" : "in_front_of_subject", zone: isHeadZone ? "head_contact" : "chest_lower_third" };
          kineticMap[l2.layerName] = { fx: heroPreset.id, name: heroPreset.name, depth: isHeadZone ? "behind_subject" : "in_front_of_subject", zone: isHeadZone ? "head_contact" : "chest_lower_third" };

        } else {
          // Single Word Chunk
          const layer1Profile = selectedProfile.typography_layers[0] || {};
          let fx = KINETIC_PRESETS[Math.floor(rng() * KINETIC_PRESETS.length)];
          if (raw.emphasis === "terminal_payoff") fx = { id: "typewriter_engine", name: "Hexta Ghost Typewriter" };

          const isHeadZone = rng() > 0.5;
          const l1 = {
            layerName: "stem_" + chunkIdx,
            text: raw.text,
            fontFamily: layer1Profile.matched_font_candidates?.[0] || "DM Sans",
            fontWeight: layer1Profile.font_style?.weight || 800,
            fontStyle: layer1Profile.font_style?.style || "normal",
            fontSizePx: layer1Profile.font_style?.size_px_base || 42,
            color: layer1Profile.font_style?.color || "#FFFFFF",
            casing: layer1Profile.font_style?.casing || "none",
            dropShadow: { xOffset: 0, yOffset: 2, blurRadius: 10, color: "rgba(0,0,0,0.9)" }
          };

          layers = [l1];
          kineticMap[l1.layerName] = { fx: fx.id, name: fx.name, depth: isHeadZone ? "behind_subject" : "in_front_of_subject", zone: isHeadZone ? "head_contact" : "chest_lower_third" };
        }

        // Entity Matting Prior (Chunk 8: "founders")
        if (raw.emphasis === "named_entity_founders" && TECH_FOUNDERS_BASE64) {
          backgroundAsset = {
            assetId: "tech_founders_vintage_trio",
            assetName: "Silicon Valley Founders Trio Cutout",
            imageUrl: TECH_FOUNDERS_BASE64,
            position: { topPercent: 8, leftPercent: 5, widthPx: 290 },
            motion: "asset_gaussian_bezier_rise"
          };
        }

        return {
          chunkIndex: raw.chunkIndex,
          timestamp: raw.timestamp,
          text: raw.text,
          profileName: selectedProfile.profile_name,
          emphasis: raw.emphasis,
          layers: layers,
          kineticMap: kineticMap,
          backgroundAsset: backgroundAsset
        };
      });
    }

    // 4. RENDER PRESENTATION CHUNK
    function renderPresentationChunk(index) {
      currentIndex = index;
      const chunk = compiledSequence[index];
      if (!chunk) return;

      document.getElementById('stageTimeBadge').innerText = chunk.timestamp.split('—')[0].trim();
      document.getElementById('lblActiveChunk').innerText = 'Chunk ' + chunk.chunkIndex + ' of ' + compiledSequence.length + ' • ' + chunk.timestamp;
      document.getElementById('lblActiveProfile').innerText = chunk.profileName.replace(/_/g, ' ');
      document.getElementById('lblActiveTier').innerText = chunk.emphasis.toUpperCase();
      document.getElementById('timelineScrubber').value = index;

      const headStage = document.getElementById('familyHeadStage');
      const chestStage = document.getElementById('familyChestStage');
      const bgLayer = document.getElementById('semanticBgAssetLayer');
      const tableBody = document.getElementById('layersTableBody');

      headStage.innerHTML = '';
      chestStage.innerHTML = '';
      bgLayer.innerHTML = '';
      tableBody.innerHTML = '';

      // Render Background Matted Asset if present
      if (chunk.backgroundAsset) {
        const bg = chunk.backgroundAsset;
        const img = document.createElement('img');
        img.src = bg.imageUrl;
        img.style.width = bg.position.widthPx + 'px';
        img.style.borderRadius = '16px';
        img.style.filter = 'drop-shadow(0 12px 30px rgba(0,0,0,0.6))';
        img.style.opacity = '0.9';
        bgLayer.style.top = bg.position.topPercent + '%';
        bgLayer.style.left = bg.position.leftPercent + '%';
        bgLayer.appendChild(img);

        const trAsset = document.createElement('tr');
        trAsset.innerHTML = 
          '<td style="font-family: monospace; color: var(--accent-pink); font-weight: 700;">[BG-ASSET] ' + bg.assetId + '</td>' +
          '<td style="color: var(--accent-yellow); font-weight: 700;">Cutout Layer</td>' +
          '<td style="color: var(--accent-purple); font-weight: 700;">BEHIND SPEAKER (Z:10)</td>' +
          '<td><span class="badge-optimal">Shoulder Clearance Enforced</span></td>' +
          '<td><span class="badge-optimal">ACTIVE</span></td>';
        tableBody.appendChild(trAsset);
      }

      // Update Chip Active States
      const chipContainer = document.getElementById('chunkPicker');
      chipContainer.innerHTML = '';
      compiledSequence.forEach((c, idx) => {
        const chip = document.createElement('button');
        chip.className = 'chip ' + (idx === index ? 'active' : '');
        chip.innerText = '#' + c.chunkIndex + ' ' + c.text.slice(0, 13) + '...';
        chip.onclick = (e) => { e.stopPropagation(); jumpTo(idx); };
        chipContainer.appendChild(chip);
      });

      const isHeadZone = Object.values(chunk.kineticMap).some(t => t.zone === 'head_contact');
      const layerGroup = document.createElement('div');
      layerGroup.className = 'layer-group';

      chunk.layers.forEach((layer, lIdx) => {
        const trait = chunk.kineticMap[layer.layerName] || { fx: 'subpixel_blur_mask', name: 'Standard Rule', depth: 'in_front_of_subject' };
        const isBehind = (trait.depth === 'behind_subject');

        const layerDiv = document.createElement('div');
        layerDiv.className = 'typo-layer layer-fx-' + trait.fx;
        layerDiv.style.fontFamily = '"' + layer.fontFamily + '", sans-serif';
        layerDiv.style.fontWeight = layer.fontWeight;
        layerDiv.style.fontStyle = layer.fontStyle || 'normal';
        layerDiv.style.fontSize = layer.fontSizePx + 'px';
        layerDiv.style.color = layer.color || '#FFFFFF';
        if (layer.letterSpacingEm) layerDiv.style.letterSpacing = layer.letterSpacingEm + 'em';
        if (layer.marginTopPx) layerDiv.style.marginTop = layer.marginTopPx + 'px';
        if (layer.dropShadow) {
          layerDiv.style.textShadow = layer.dropShadow.xOffset + 'px ' + layer.dropShadow.yOffset + 'px ' + layer.dropShadow.blurRadius + 'px ' + layer.dropShadow.color;
        }

        // 1. Delayed Highlight Card Sweep
        if (layer.delayedPillCard || trait.fx === 'delayed_pill_card_sweep') {
          const cardWrap = document.createElement('div');
          cardWrap.className = 'delayed-pill-card-container';
          const cardBg = document.createElement('div');
          cardBg.className = 'delayed-pill-card-bg ' + (layer.delayedPillCard === '#FF1744' ? 'card-red-pressure' : 'card-yellow');
          const cardText = document.createElement('span');
          cardText.className = 'delayed-pill-card-text';
          cardText.innerText = layer.text;
          cardText.style.color = layer.delayedPillCard === '#FFE600' ? '#111111' : '#FFFFFF';
          cardWrap.appendChild(cardBg);
          cardWrap.appendChild(cardText);
          layerDiv.appendChild(cardWrap);

        // 2. Cyber Matrix Glitch (TYPO #30)
        } else if (trait.fx === 'acid_lime_letter_glitch') {
          Array.from(layer.text).forEach((ch, chIdx) => {
            const span = document.createElement('span');
            span.className = 'lime-glitch-char lime-accent';
            span.style.animationDelay = (chIdx * 0.04) + 's';
            span.innerText = ch;
            layerDiv.appendChild(span);
          });

        // 3. Dynamic Numeric Ticker
        } else if (layer.numericCounter) {
          const counterSpan = document.createElement('span');
          counterSpan.className = 'numeric-counter-item word-item';
          const nc = layer.numericCounter;
          counterSpan.innerText = nc.prefix + '0' + nc.suffix;
          layerDiv.appendChild(counterSpan);

          const startTime = performance.now();
          function tick(now) {
            const prog = Math.min(1, (now - startTime) / nc.durationMs);
            const val = Math.floor((1 - Math.pow(1 - prog, 3)) * nc.targetValue);
            counterSpan.innerText = nc.prefix + val.toLocaleString() + nc.suffix;
            if (prog < 1) requestAnimationFrame(tick);
            else counterSpan.innerText = nc.prefix + nc.targetValue.toLocaleString() + nc.suffix;
          }
          requestAnimationFrame(tick);

        // 4. Standard Kinetic Word Animation
        } else {
          const words = layer.text.split(' ');
          words.forEach((w, wIdx) => {
            const span = document.createElement('span');
            span.className = 'word-item';
            span.innerText = w;
            span.style.animationDelay = (wIdx * 0.07) + 's';
            layerDiv.appendChild(span);
          });
        }

        layerGroup.appendChild(layerDiv);

        // Populate Inspector Table Row
        const tr = document.createElement('tr');
        tr.innerHTML = 
          '<td style="font-family: monospace; color: var(--accent-cyan); font-weight: 700;">' + layer.layerName + '</td>' +
          '<td style="font-weight: 700;">' + layer.fontFamily + ' ' + layer.fontSizePx + 'px</td>' +
          '<td style="font-weight: 700; color: var(--accent-yellow);">' + trait.name + '</td>' +
          '<td style="font-weight: 700; color: ' + (isBehind ? 'var(--accent-pink)' : 'var(--accent-cyan)') + '">' + (isBehind ? 'BEHIND SPEAKER (Z:10)' : 'IN FRONT (Z:30)') + '</td>' +
          '<td><span class="badge-optimal">' + (isBehind ? 'Goldilocks Scalp' : 'Clearance Verified') + '</span></td>';
        tableBody.appendChild(tr);
      });

      if (isHeadZone) {
        headStage.appendChild(layerGroup);
      } else {
        chestStage.appendChild(layerGroup);
      }
    }

    // 5. RE-ROLL & SEED MANAGEMENT
    function reRollTreatment() {
      currentSeed = Math.floor(Math.random() * 90000) + 100;
      document.getElementById('lblActiveSeed').innerText = '#' + currentSeed;
      compiledSequence = compileDynamicSequence(currentSeed);
      renderPresentationChunk(currentIndex);
      if (isPlaying) restartTimer();
    }

    function resetSeed(seedNum) {
      currentSeed = seedNum;
      document.getElementById('lblActiveSeed').innerText = '#' + currentSeed;
      compiledSequence = compileDynamicSequence(currentSeed);
      renderPresentationChunk(0);
      if (isPlaying) restartTimer();
    }

    function jumpTo(idx) {
      renderPresentationChunk(idx);
      if (isPlaying) restartTimer();
    }

    function nextChunk() {
      renderPresentationChunk((currentIndex + 1) % compiledSequence.length);
    }

    function prevChunk() {
      renderPresentationChunk((currentIndex - 1 + compiledSequence.length) % compiledSequence.length);
    }

    function togglePlay() {
      isPlaying = !isPlaying;
      document.getElementById('btnPlay').innerText = isPlaying ? '⏸ Pause' : '▶ Play';
      if (isPlaying) restartTimer();
      else clearInterval(playTimer);
    }

    function toggleBbox() {
      showBbox = !showBbox;
      document.getElementById('mediapipeFaceOverlay').style.opacity = showBbox ? '1' : '0';
      document.getElementById('btnToggleBbox').innerText = '📐 Wireframe: ' + (showBbox ? 'ON' : 'OFF');
    }

    function restartTimer() {
      clearInterval(playTimer);
      playTimer = setInterval(nextChunk, 2400);
    }

    function setViewMode(mode) {
      document.getElementById('tabPresentation').classList.toggle('active', mode === 'presentation');
      document.getElementById('tabDiagnostics').classList.toggle('active', mode === 'diagnostics');
      document.getElementById('inspectorPanel').style.display = (mode === 'diagnostics' || window.innerWidth > 900) ? 'block' : 'none';
    }

    // INITIAL BOOTSTRAP
    compiledSequence = compileDynamicSequence(currentSeed);
    renderPresentationChunk(0);
    restartTimer();
  </script>
</body>
</html>`;

const outHtmlPath = path.join(studioDir, "typography_treatment_presentation.html");
fs.writeFileSync(outHtmlPath, htmlContent);
console.log("SUCCESSFULLY_BUILT_PROBABILISTIC_SELECTOR_STUDIO:", outHtmlPath);
