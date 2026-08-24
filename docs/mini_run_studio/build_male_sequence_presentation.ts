import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { checkStudioAssets, checkPythonEnvironment } from "./preflight_environment_check.js";
import { planDynamicPerson } from "./dynamic_person_engine.js";
import { extractAndBridgeConcept, CONCEPT_PHYSICAL_REGISTRY, generateEdisonBulbSvg, generateCombustionFireSvg, generateMarbleColumnSvg } from "./concept_physical_bridge.js";
import { CHART_GRAPH_8_PRESETS, CHART_CUSTOM_CSS, resolveAnimaChartPreset } from "./anima_chart_suite.js";
import { DOGMA_ART_STYLES, DOGMA_ASSET_REGISTRY, selectDogmaAsset } from "./art_style_dogma_engine.js";
import { AUTHORITATIVE_SFX_FAMILIES, SFX_TAXONOMY_MANIFEST } from "./sfx_governance_schema.js";
import { buildDeterministicCausalSoundManifest } from "./causal_sound_engine.js";
import { generateEbayBadgeSvg, generateAmazonBadgeSvg, generateEtsyBadgeSvg, generateLinkedInBadgeSvg, generateInstagramBadgeSvg, generateShopifyBadgeSvg, generateStripeBadgeSvg, generatePhysicalProductsBoxSvg, generateSixFiguresProfitSvg, COMPREHENSIVE_BRAND_REGISTRY, resolveBrandOrPhysicalAsset } from "./brand_vector_registry.js";

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

// 1. RESOLVE SPEAKER CUTOUT ASSET
const assetCheck = checkStudioAssets();
if (!assetCheck.speakerPath) {
  throw new Error("[CRITICAL_PIPELINE_HALT] Matted male talking head PNG asset could not be found.");
}
const resolvedSpeakerPath = assetCheck.speakerPath;
console.log(`[STUDIO_ASSET_LOADER] Matted Speaker Head Asset Resolved: ${resolvedSpeakerPath}`);
const speakerBase64 = getBase64DataUriFromPath(resolvedSpeakerPath);
const speakerMaleBase64 = getBase64DataUriFromPath(path.join(studioDir, "matted_speaker_male.png")) || speakerBase64;
const speakerLaptopBase64 = getBase64DataUriFromPath(path.join(studioDir, "matted_speaker_laptop_vertical.png")) || speakerMaleBase64;
const speakerAkimboBase64 = getBase64DataUriFromPath(path.join(studioDir, "matted_speaker_akimbo_laptop.png")) || speakerMaleBase64;

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

// Goldilocks zone scalp contact position: Scalp is at 14.79%, stage top is at 9.8%
const goldilocksHeadStageTopPercent = 9.8;

// 3. LOAD ALL 45 AUTHORITATIVE FONT JSON PROFILES FROM DISK WITH FILENAMES & IMAGE URLS
const fontJsonDir = path.join(repoRoot, "Yuan Prometheus Screenshots/font JSON");
const fontPairsDir = path.join(repoRoot, "Yuan Prometheus Screenshots/font pairing and placement");
const fontJsonFiles = fs.readdirSync(fontJsonDir).filter(f => f.endsWith(".json"));

const allFontProfiles = fontJsonFiles.map(filename => {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(fontJsonDir, filename), "utf8"));
    const imageFilename = filename.replace(/\.json$/i, ".png");
    const imageExists = fs.existsSync(path.join(fontPairsDir, imageFilename));
    return {
      ...raw,
      _filename: filename,
      _imageFilename: imageFilename,
      _imageUrl: `/font_pairs/${encodeURIComponent(imageFilename)}`,
      _jsonUrl: `/font_json/${encodeURIComponent(filename)}`,
      _imageExists: imageExists,
      // Compartmentalization: any treatment profile authored for 16:9 landscape
      // long-form (filename carries the "Landscape" token) must never leak into
      // the 9:16 short-form corpus. The landscape builder is a superset and keeps
      // them; short-form filters them out below.
      _landscapeOnly: /Landscape/i.test(filename)
    };
  } catch (e) {
    return null;
  }
}).filter(Boolean).filter((p: { _landscapeOnly?: boolean }) => !p._landscapeOnly);
console.log(`[FONT_CORPUS_LOADER] Successfully loaded ${allFontProfiles.length} authoritative Font JSON profiles with paired screenshot metadata.`);

// 4. LOAD RELEVANT ASSETS FOR TRANSCRIPTS (100% ZERO-BACKGROUND MATTED)
const techFoundersTrioBase64 = getBase64DataUriFromPath(path.join(studioDir, "assets/tech_founders_matted.png"));
const personMaskedSuitBase64 = getBase64DataUriFromPath(path.join(studioDir, "assets/person_masked_suit.jpg"));
const personStickerHeadBase64 = getBase64DataUriFromPath(path.join(studioDir, "assets/person_sticker_head.jpg"));
const focusTargetBase64 = getBase64DataUriFromPath(path.join(studioDir, "transcript3_focus_target.svg"));
const chaseQuadrantBase64 = getBase64DataUriFromPath(path.join(studioDir, "transcript3_chase_quadrant.svg"));
const atomicFlywheelBase64 = getBase64DataUriFromPath(path.join(studioDir, "transcript3_atomic_flywheel.svg"));
const metronomeSvgBase64 = getBase64DataUriFromPath(path.join(studioDir, "transcript2_metronome_unique.svg"));
const roboticArmSvgBase64 = getBase64DataUriFromPath(path.join(studioDir, "transcript2_robotic_arm_unique.svg"));
const rocketSvgBase64 = getBase64DataUriFromPath(path.join(studioDir, "transcript2_rocket_scale_unique.svg"));

// AUTHORITATIVE DOGMA ART STYLE REFERENCE SCREENSHOTS (1-8)
const DOGMA_SCREENSHOTS_BASE64: Record<string, string> = {
  "Screenshot_01_091753.png": getBase64DataUriFromPath(path.join(studioDir, "uploaded_screenshots/Screenshot_01_091753.png")),
  "Screenshot_02_091922.png": getBase64DataUriFromPath(path.join(studioDir, "uploaded_screenshots/Screenshot_02_091922.png")),
  "Screenshot_03_091938.png": getBase64DataUriFromPath(path.join(studioDir, "uploaded_screenshots/Screenshot_03_091938.png")),
  "Screenshot_04_091958.png": getBase64DataUriFromPath(path.join(studioDir, "uploaded_screenshots/Screenshot_04_091958.png")),
  "Screenshot_05_092037.png": getBase64DataUriFromPath(path.join(studioDir, "uploaded_screenshots/Screenshot_05_092037.png")),
  "Screenshot_06_092135.png": getBase64DataUriFromPath(path.join(studioDir, "uploaded_screenshots/Screenshot_06_092135.png")),
  "Screenshot_07_092157.png": getBase64DataUriFromPath(path.join(studioDir, "uploaded_screenshots/Screenshot_07_092157.png")),
  "Screenshot_08_092214.png": getBase64DataUriFromPath(path.join(studioDir, "uploaded_screenshots/Screenshot_08_092214.png"))
};

// BESPOKE GENERATED ASSETS EMBODYING DOGMA ART STYLES (100% ZERO-BACKGROUND MATTED)
const ideaStoicMonumentBase64 = getBase64DataUriFromPath(path.join(studioDir, "assets/idea_stoic_monument_matted.png"));
const ideaEngravedSynapseBase64 = getBase64DataUriFromPath(path.join(studioDir, "assets/idea_engraved_synapse_matted.png"));
const ideaVintageHalftoneBase64 = getBase64DataUriFromPath(path.join(studioDir, "assets/idea_vintage_halftone_matted.png"));
const founderArcaneExecutiveBase64 = getBase64DataUriFromPath(path.join(studioDir, "assets/founder_arcane_executive_matted.png"));
const founderImpastoOilBase64 = getBase64DataUriFromPath(path.join(studioDir, "assets/founder_impasto_oil_matted.png"));
const founderDuotoneNoirBase64 = getBase64DataUriFromPath(path.join(studioDir, "assets/founder_duotone_noir_matted.png"));

function toSvgUri(svg: string): string {
  return "data:image/svg+xml;base64," + Buffer.from(svg.trim()).toString("base64");
}

// PROCEDURAL MULTI-METAPHOR CLUSTER SVGS
const ascendingGrowthChartBase64 = toSvgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" width="320" height="220" fill="none">
  <defs>
    <linearGradient id="chartLineGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00F0FF"/>
      <stop offset="60%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#FFE600"/>
    </linearGradient>
    <linearGradient id="chartAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#00F0FF" stop-opacity="0.0"/>
    </linearGradient>
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <line x1="40" y1="30" x2="300" y2="30" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 3"/>
  <line x1="40" y1="80" x2="300" y2="80" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 3"/>
  <line x1="40" y1="130" x2="300" y2="130" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 3"/>
  <line x1="40" y1="180" x2="300" y2="180" stroke="rgba(255,255,255,0.2)"/>
  <line x1="40" y1="30" x2="40" y2="180" stroke="rgba(255,255,255,0.2)"/>
  <path d="M 40 180 Q 120 170 170 120 T 290 35 L 290 180 Z" fill="url(#chartAreaGrad)"/>
  <path d="M 40 180 Q 120 170 170 120 T 290 35" stroke="url(#chartLineGrad)" stroke-width="4.5" stroke-linecap="round" filter="url(#neonGlow)"/>
  <circle cx="290" cy="35" r="7" fill="#FFE600" filter="url(#neonGlow)"/>
  <circle cx="290" cy="35" r="3" fill="#FFFFFF"/>
  <text x="235" y="24" fill="#10B981" font-family="-apple-system, sans-serif" font-size="12" font-weight="900" letter-spacing="0.05em">+340% ↗</text>
</svg>`);

const bottleneckPlateauChartBase64 = toSvgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" width="320" height="220" fill="none">
  <defs>
    <linearGradient id="plateauLineGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00F0FF"/>
      <stop offset="45%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#EF4444"/>
    </linearGradient>
    <linearGradient id="plateauAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#EF4444" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#00F0FF" stop-opacity="0.0"/>
    </linearGradient>
    <filter id="warnGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <line x1="40" y1="180" x2="300" y2="180" stroke="rgba(255,255,255,0.2)"/>
  <line x1="40" y1="30" x2="40" y2="180" stroke="rgba(255,255,255,0.2)"/>
  <line x1="40" y1="65" x2="300" y2="65" stroke="#EF4444" stroke-width="2" stroke-dasharray="6 4" filter="url(#warnGlow)"/>
  <rect x="200" y="48" width="95" height="18" rx="4" fill="rgba(239,68,68,0.2)" stroke="#EF4444" stroke-width="1"/>
  <text x="247" y="61" fill="#EF4444" font-family="-apple-system, sans-serif" font-size="10" font-weight="900" text-anchor="middle">BOTTLENECK</text>
  <path d="M 40 180 Q 110 160 150 75 L 290 68 L 290 180 Z" fill="url(#plateauAreaGrad)"/>
  <path d="M 40 180 Q 110 160 150 75 L 290 68" stroke="url(#plateauLineGrad)" stroke-width="4.5" stroke-linecap="round" filter="url(#warnGlow)"/>
  <circle cx="150" cy="75" r="6" fill="#F59E0B" filter="url(#warnGlow)"/>
  <circle cx="290" cy="68" r="6" fill="#EF4444" filter="url(#warnGlow)"/>
</svg>`);

const organicSproutBase64 = toSvgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" fill="none">
  <defs>
    <linearGradient id="sproutGrad" x1="0%" y1="100%" x2="50%" y2="0%">
      <stop offset="0%" stop-color="#047857"/>
      <stop offset="60%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#34D399"/>
    </linearGradient>
    <filter id="leafGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <path d="M 50 200 Q 120 185 190 200" stroke="rgba(255,255,255,0.25)" stroke-width="3" stroke-linecap="round"/>
  <path d="M 120 195 C 120 150 115 110 128 65" stroke="url(#sproutGrad)" stroke-width="5" stroke-linecap="round" filter="url(#leafGlow)"/>
  <path d="M 122 135 C 90 130 75 105 85 90 C 105 88 120 110 124 125 Z" fill="url(#sproutGrad)" filter="url(#leafGlow)"/>
  <path d="M 125 110 C 155 105 170 80 160 65 C 140 63 125 85 122 100 Z" fill="url(#sproutGrad)" filter="url(#leafGlow)"/>
  <circle cx="128" cy="65" r="7" fill="#34D399" filter="url(#leafGlow)"/>
</svg>`);

const momentumTrajectoryBase64 = toSvgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 220" width="280" height="220" fill="none">
  <defs>
    <linearGradient id="rocketArc" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="50%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#EC4899"/>
    </linearGradient>
    <filter id="rocketGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <path d="M 35 185 Q 90 170 140 115 T 245 40" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-dasharray="4 4"/>
  <path d="M 35 185 Q 90 170 140 115 T 245 40" stroke="url(#rocketArc)" stroke-width="4.5" stroke-linecap="round" filter="url(#rocketGlow)"/>
  <polygon points="245,40 230,48 240,62" fill="#EC4899" filter="url(#rocketGlow)"/>
  <circle cx="245" cy="40" r="5" fill="#FFFFFF"/>
</svg>`);

const modularStackingBlocksBase64 = toSvgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" fill="none">
  <defs>
    <linearGradient id="blockCyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00F0FF"/>
      <stop offset="100%" stop-color="#0077B6"/>
    </linearGradient>
    <linearGradient id="blockPurple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C084FC"/>
      <stop offset="100%" stop-color="#6B21A8"/>
    </linearGradient>
    <filter id="isoGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g transform="translate(70, 140)">
    <polygon points="50,0 100,28 50,56 0,28" fill="url(#blockCyan)" opacity="0.85"/>
    <polygon points="0,28 50,56 50,96 0,68" fill="#0077B6" opacity="0.7"/>
    <polygon points="50,56 100,28 100,68 50,96" fill="#023E8A" opacity="0.9"/>
  </g>
  <g transform="translate(70, 80)">
    <polygon points="50,0 100,28 50,56 0,28" fill="url(#blockPurple)" opacity="0.9"/>
    <polygon points="0,28 50,56 50,96 0,68" fill="#7E22CE" opacity="0.75"/>
    <polygon points="50,56 100,28 100,68 50,96" fill="#581C87" opacity="0.95"/>
  </g>
  <g transform="translate(70, 20)" filter="url(#isoGlow)">
    <polygon points="50,0 100,28 50,56 0,28" fill="#FFE600"/>
    <polygon points="0,28 50,56 50,96 0,68" fill="#D97706"/>
    <polygon points="50,56 100,28 100,68 50,96" fill="#B45309"/>
  </g>
</svg>`);

const fractureBreakNodesBase64 = toSvgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 220" width="260" height="220" fill="none">
  <defs>
    <filter id="crackGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <path d="M 130 20 L 115 70 L 145 110 L 105 160 L 130 200" stroke="#EF4444" stroke-width="3" stroke-linecap="round" filter="url(#crackGlow)"/>
  <circle cx="65" cy="60" r="10" fill="#3B82F6" opacity="0.8"/>
  <line x1="65" y1="60" x2="115" y2="70" stroke="#3B82F6" stroke-width="2" stroke-dasharray="3 3"/>
  <circle cx="50" cy="140" r="12" fill="#3B82F6" opacity="0.8"/>
  <line x1="50" y1="140" x2="105" y2="160" stroke="#3B82F6" stroke-width="2" stroke-dasharray="3 3"/>
  <circle cx="205" cy="80" r="12" fill="#8B5CF6" opacity="0.8"/>
  <line x1="205" y1="80" x2="145" y2="110" stroke="#8B5CF6" stroke-width="2" stroke-dasharray="3 3"/>
  <circle cx="195" cy="160" r="10" fill="#8B5CF6" opacity="0.8"/>
  <line x1="195" y1="160" x2="130" y2="200" stroke="#8B5CF6" stroke-width="2" stroke-dasharray="3 3"/>
  <polygon points="130,95 122,110 138,110" fill="#FFE600" filter="url(#crackGlow)"/>
</svg>`);

const senzaBellaCssPath = path.join(studioDir, "fonts/senza_bella.css");
const senzaBellaCss = fs.existsSync(senzaBellaCssPath) ? fs.readFileSync(senzaBellaCssPath, "utf8") : "";
const studioFontsCssPath = path.join(studioDir, "fonts/studio_fonts.css");
const studioFontsCss = fs.existsSync(studioFontsCssPath) ? fs.readFileSync(studioFontsCssPath, "utf8") : "";

// 5. AUTHORITATIVE FRESH TRANSCRIPT: "Self-Sustaining Systems (Depend On You)" — 40s run
const rawSpokenChunksFreshTranscript = [
  { chunkIndex: 1, timestamp: "00:00 — 00:02", startSec: 0.0, endSec: 2.0, text: "Your business", emphasis: "context", preferredProfile: "image (39).json" },
  { chunkIndex: 2, timestamp: "00:02 — 00:04", startSec: 2.0, endSec: 4.0, text: "isn't stuck", emphasis: "context", preferredProfile: "image (13).json" },
  { chunkIndex: 3, timestamp: "00:04 — 00:06", startSec: 4.0, endSec: 6.0, text: "because you're lazy.", emphasis: "context", preferredProfile: "image (9).json" },
  { chunkIndex: 4, timestamp: "00:06 — 00:08", startSec: 6.0, endSec: 8.0, text: "It's stuck", emphasis: "contrast_claim", preferredProfile: "image (12).json" },
  { chunkIndex: 5, timestamp: "00:08 — 00:10", startSec: 8.0, endSec: 10.0, text: "because everything depends", emphasis: "clause", preferredProfile: "image (36).json" },
  { chunkIndex: 6, timestamp: "00:10 — 00:12", startSec: 10.0, endSec: 12.0, text: "on you.", emphasis: "inflection_solution", preferredProfile: "image (7).json" },
  { chunkIndex: 7, timestamp: "00:12 — 00:14", startSec: 12.0, endSec: 14.0, text: "Every decision,", emphasis: "context", preferredProfile: "image (14).json" },
  { chunkIndex: 8, timestamp: "00:14 — 00:16", startSec: 14.0, endSec: 16.0, text: "every client,", emphasis: "context", preferredProfile: "image (24).json" },
  { chunkIndex: 9, timestamp: "00:16 — 00:18", startSec: 16.0, endSec: 18.0, text: "every little problem", emphasis: "key_point", preferredProfile: "image (21).json" },
  { chunkIndex: 10, timestamp: "00:18 — 00:20", startSec: 18.0, endSec: 20.0, text: "comes back", emphasis: "transition", preferredProfile: "image (10).json" },
  { chunkIndex: 11, timestamp: "00:20 — 00:22", startSec: 20.0, endSec: 22.0, text: "to your desk.", emphasis: "key_point", preferredProfile: "image (2).json" },
  { chunkIndex: 12, timestamp: "00:22 — 00:24", startSec: 22.0, endSec: 24.0, text: "And eventually,", emphasis: "transition", preferredProfile: "image (3).json" },
  { chunkIndex: 13, timestamp: "00:24 — 00:26", startSec: 24.0, endSec: 26.0, text: "you become the bottleneck.", emphasis: "inflection_tension", preferredProfile: "image (29).json" },
  { chunkIndex: 14, timestamp: "00:26 — 00:28", startSec: 26.0, endSec: 28.0, text: "The goal isn't", emphasis: "contrast_claim", preferredProfile: "image (8).json" },
  { chunkIndex: 15, timestamp: "00:28 — 00:30", startSec: 28.0, endSec: 30.0, text: "to work harder", emphasis: "contrast_claim", preferredProfile: "image (6).json" },
  { chunkIndex: 16, timestamp: "00:30 — 00:32", startSec: 30.0, endSec: 32.0, text: "until you burn out.", emphasis: "inflection_tension", preferredProfile: "image (20).json" },
  { chunkIndex: 17, timestamp: "00:32 — 00:34", startSec: 32.0, endSec: 34.0, text: "The goal is", emphasis: "transition", preferredProfile: "image (19).json" },
  { chunkIndex: 18, timestamp: "00:34 — 00:36", startSec: 34.0, endSec: 36.0, text: "to build a business", emphasis: "hero_concept", preferredProfile: "image (35).json" },
  { chunkIndex: 19, timestamp: "00:36 — 00:38", startSec: 36.0, endSec: 38.0, text: "that can grow", emphasis: "key_point", preferredProfile: "image (18).json" },
  { chunkIndex: 20, timestamp: "00:38 — 00:40", startSec: 38.0, endSec: 40.0, text: "without you.", emphasis: "terminal_payoff", preferredProfile: "image (7).json" },
];


// TRANSCRIPT 3: "Founders Focus & Execution"
const rawSpokenChunksTranscript3 = [
  { chunkIndex: 1, timestamp: "00:00 — 00:02", startSec: 0.0, endSec: 2.0, text: "Most founders", emphasis: "context", preferredProfile: "image (21).json", assetType: "image", assetData: personMaskedSuitBase64 || techFoundersTrioBase64, assetPosition: "behind_head" },
  { chunkIndex: 2, timestamp: "00:02 — 00:04", startSec: 2.0, endSec: 4.0, text: "don't have", emphasis: "transition", preferredProfile: "image (13).json", assetType: "none" },
  { chunkIndex: 3, timestamp: "00:04 — 00:06", startSec: 4.0, endSec: 6.0, text: "a growth problem.", emphasis: "contrast_claim", preferredProfile: "image (36).json", assetType: "none" },
  { chunkIndex: 4, timestamp: "00:06 — 00:08", startSec: 6.0, endSec: 8.0, text: "They have", emphasis: "transition", preferredProfile: "image (8).json", assetType: "none" },
  { chunkIndex: 5, timestamp: "00:08 — 00:10", startSec: 8.0, endSec: 10.0, text: "a focus problem.", emphasis: "hero_concept", preferredProfile: "image (24).json", assetType: "svg", assetData: focusTargetBase64, assetPosition: "right_shoulder" },
  { chunkIndex: 6, timestamp: "00:10 — 00:12", startSec: 10.0, endSec: 12.0, text: "Because every opportunity", emphasis: "context", preferredProfile: "image (39).json", assetType: "none" },
  { chunkIndex: 7, timestamp: "00:12 — 00:14", startSec: 12.0, endSec: 14.0, text: "looks important", emphasis: "key_point", preferredProfile: "image (20).json", assetType: "none" },
  { chunkIndex: 8, timestamp: "00:14 — 00:16", startSec: 14.0, endSec: 16.0, text: "when you haven't", emphasis: "clause", preferredProfile: "image (34).json", assetType: "none" },
  { chunkIndex: 9, timestamp: "00:16 — 00:18", startSec: 16.0, endSec: 18.0, text: "decided what matters.", emphasis: "inflection_tension", preferredProfile: "image (7).json", assetType: "none" },
  { chunkIndex: 10, timestamp: "00:18 — 00:20", startSec: 18.0, endSec: 20.0, text: "So you chase", emphasis: "transition", preferredProfile: "image (10).json", assetType: "none" },
  { chunkIndex: 11, timestamp: "00:20 — 00:22", startSec: 20.0, endSec: 22.0, text: "new ideas,", emphasis: "enumeration_1", preferredProfile: "image (2).json", assetType: "svg", assetData: chaseQuadrantBase64, assetPosition: "left_shoulder" },
  { chunkIndex: 12, timestamp: "00:22 — 00:24", startSec: 22.0, endSec: 24.0, text: "new customers,", emphasis: "enumeration_2", preferredProfile: "image (3).json", assetType: "svg", assetData: chaseQuadrantBase64, assetPosition: "left_shoulder" },
  { chunkIndex: 13, timestamp: "00:24 — 00:26", startSec: 24.0, endSec: 26.0, text: "new strategies,", emphasis: "enumeration_3", preferredProfile: "image (9).json", assetType: "svg", assetData: chaseQuadrantBase64, assetPosition: "left_shoulder" },
  { chunkIndex: 14, timestamp: "00:26 — 00:28", startSec: 26.0, endSec: 28.0, text: "and new tools.", emphasis: "enumeration_4", preferredProfile: "image (14).json", assetType: "svg", assetData: chaseQuadrantBase64, assetPosition: "left_shoulder" },
  { chunkIndex: 15, timestamp: "00:28 — 00:30", startSec: 28.0, endSec: 30.0, text: "But eventually,", emphasis: "transition", preferredProfile: "image (29).json", assetType: "none" },
  { chunkIndex: 16, timestamp: "00:30 — 00:32", startSec: 30.0, endSec: 32.0, text: "you realize something.", emphasis: "inflection_solution", preferredProfile: "image (12).json", assetType: "none" },
  { chunkIndex: 17, timestamp: "00:32 — 00:34", startSec: 32.0, endSec: 34.0, text: "Growth doesn't come", emphasis: "contrast_claim", preferredProfile: "image (35).json", assetType: "none" },
  { chunkIndex: 18, timestamp: "00:34 — 00:36", startSec: 34.0, endSec: 36.0, text: "from doing more things.", emphasis: "key_point", preferredProfile: "image (19).json", assetType: "none" },
  { chunkIndex: 19, timestamp: "00:36 — 00:38", startSec: 36.0, endSec: 38.0, text: "It comes from doing", emphasis: "clause", preferredProfile: "image (6).json", assetType: "none" },
  { chunkIndex: 20, timestamp: "00:38 — 00:40", startSec: 38.0, endSec: 40.0, text: "the right things repeatedly.", emphasis: "terminal_payoff", preferredProfile: "image (18).json", assetType: "svg", assetData: atomicFlywheelBase64, assetPosition: "right_shoulder" }
];

// TRANSCRIPT 2: "Broken Business ($50k / 70 Hours)"
const rawSpokenChunksTranscript2 = [
  { chunkIndex: 1, timestamp: "00:00 — 00:02", startSec: 0.0, endSec: 2.0, text: "You can make", emphasis: "context", preferredProfile: "image (39).json" },
  { chunkIndex: 2, timestamp: "00:02 — 00:04", startSec: 2.0, endSec: 4.0, text: "$50,000 a month", emphasis: "hero_metric", metricValue: 50000, metricPrefix: "$", metricSuffix: "", preferredProfile: "image (35).json" },
  { chunkIndex: 3, timestamp: "00:04 — 00:06", startSec: 4.0, endSec: 6.0, text: "and still", emphasis: "transition", preferredProfile: "image (13).json" },
  { chunkIndex: 4, timestamp: "00:06 — 00:08", startSec: 6.0, endSec: 8.0, text: "have a broken business.", emphasis: "inflection_tension", preferredProfile: "image (12).json" },
  { chunkIndex: 5, timestamp: "00:08 — 00:10", startSec: 8.0, endSec: 10.0, text: "Because revenue", emphasis: "context", preferredProfile: "image (24).json" },
  { chunkIndex: 6, timestamp: "00:10 — 00:12", startSec: 10.0, endSec: 12.0, text: "doesn't automatically mean", emphasis: "clause", preferredProfile: "image (36).json" },
  { chunkIndex: 7, timestamp: "00:12 — 00:14", startSec: 12.0, endSec: 14.0, text: "you're building something scalable.", emphasis: "hero_concept", preferredProfile: "image (7).json" },
  { chunkIndex: 8, timestamp: "00:14 — 00:16", startSec: 14.0, endSec: 16.0, text: "I've seen founders", emphasis: "named_entity_founders", preferredProfile: "image (21).json", assetType: "image", assetData: personMaskedSuitBase64 || techFoundersTrioBase64, assetPosition: "behind_head" },
  { chunkIndex: 9, timestamp: "00:16 — 00:18", startSec: 16.0, endSec: 18.0, text: "make serious money", emphasis: "key_point", preferredProfile: "image (3).json" },
  { chunkIndex: 10, timestamp: "00:18 — 00:20", startSec: 18.0, endSec: 20.0, text: "while working", emphasis: "transition", preferredProfile: "image (34).json" },
  { chunkIndex: 11, timestamp: "00:20 — 00:22", startSec: 20.0, endSec: 22.0, text: "seventy hours every week.", emphasis: "hero_metric", metricValue: 70, metricPrefix: "", metricSuffix: " HOURS", preferredProfile: "image (35).json", assetType: "svg", assetData: metronomeSvgBase64, assetPosition: "right_shoulder" },
  { chunkIndex: 12, timestamp: "00:22 — 00:24", startSec: 22.0, endSec: 24.0, text: "That's not freedom.", emphasis: "inflection_tension", preferredProfile: "image (29).json" },
  { chunkIndex: 13, timestamp: "00:24 — 00:26", startSec: 24.0, endSec: 26.0, text: "That's a", emphasis: "transition", preferredProfile: "image (8).json" },
  { chunkIndex: 14, timestamp: "00:26 — 00:28", startSec: 26.0, endSec: 28.0, text: "very expensive job.", emphasis: "hero_concept", preferredProfile: "image (10).json" },
  { chunkIndex: 15, timestamp: "00:28 — 00:30", startSec: 28.0, endSec: 30.0, text: "The real goal", emphasis: "context", preferredProfile: "image (9).json" },
  { chunkIndex: 16, timestamp: "00:30 — 00:32", startSec: 30.0, endSec: 32.0, text: "isn't just making more money.", emphasis: "contrast_claim", preferredProfile: "image (19).json" },
  { chunkIndex: 17, timestamp: "00:32 — 00:34", startSec: 32.0, endSec: 34.0, text: "It's building systems", emphasis: "inflection_solution", preferredProfile: "image (2).json", assetType: "svg", assetData: roboticArmSvgBase64, assetPosition: "left_shoulder" },
  { chunkIndex: 18, timestamp: "00:34 — 00:36", startSec: 34.0, endSec: 36.0, text: "that keep producing results", emphasis: "key_point", preferredProfile: "image (6).json" },
  { chunkIndex: 19, timestamp: "00:36 — 00:38", startSec: 36.0, endSec: 38.0, text: "without requiring you", emphasis: "clause", preferredProfile: "image (14).json" },
  { chunkIndex: 20, timestamp: "00:38 — 00:40", startSec: 38.0, endSec: 40.0, text: "every single time.", emphasis: "terminal_payoff", preferredProfile: "image (18).json", assetType: "svg", assetData: rocketSvgBase64, assetPosition: "right_shoulder" }
];

const ALL_TRANSCRIPTS = {
  script1: {
    id: "script1",
    title: "Script #1: Self-Sustaining Systems (Depend On You)",
    chunks: rawSpokenChunksFreshTranscript
  },
  script2: {
    id: "script2",
    title: "Script #2: Broken Business ($50,000 / 70 Hours)",
    chunks: rawSpokenChunksTranscript2
  },
  script3: {
    id: "script3",
    title: "Script #3: Founders Focus & Execution",
    chunks: rawSpokenChunksTranscript3
  }
};

const rawSpokenChunks = rawSpokenChunksFreshTranscript;

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <script>
    if (window.self !== window.top || window.location.search.indexOf("embedded=true") !== -1 || window.location.search.indexOf("mode=stage_only") !== -1) {
      document.documentElement.classList.add("is-embedded");
    }
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#070913">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Prometheus Core — 100% Faithful Font JSON Realization & Reference Studio</title>
  
  <!-- Comprehensive Google WebFonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Alex+Brush&family=Anton&family=Bebas+Neue&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=Caveat:wght@700&family=Cinzel:wght@700;900&family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Dancing+Script:wght@700&family=DM+Sans:ital,opsz,wght@0,9..40,400..900;1,9..40,400..900&family=DM+Serif+Display:ital@0;1&family=Great+Vibes&family=Inter:wght@400;700;800;900&family=Kalam:wght@700&family=Lora:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:ital,wght@0,400;0,700;0,800;0,900;1,400;1,700;1,800;1,900&family=Open+Sans:wght@700;800&family=Oswald:wght@600;700&family=Outfit:wght@700;900&family=Pinyon+Script&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Press+Start+2P&family=Roboto+Slab:wght@700;900&family=Roboto:wght@700;900&family=Romanesco&family=Rozha+One&family=Sacramento&family=Sanchez&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Special+Elite&family=Syne:wght@700;800&family=VT323&display=swap" rel="stylesheet">
  
  <style>
${senzaBellaCss}
${studioFontsCss}
${CHART_CUSTOM_CSS}
    :root {
      --bg-dark: #070913;
      --panel-bg: #101625;
      --panel-border: rgba(255, 255, 255, 0.08);
      --accent-cyan: #00F0FF;
      --accent-purple: #8B5CF6;
      --accent-pink: #EC4899;
      --accent-green: #10B981;
      --accent-lime: #84CC16;
      --accent-yellow: #FFE600;
      --accent-blue: #0A00FF;
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --stage-max-w: 380px;
      --stage-width: clamp(320px, 350px, 380px);
      --stage-height: calc(var(--stage-width) * (16 / 9));
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    
    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: max(10px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
      overflow-x: hidden;
      background-image: 
        radial-gradient(ellipse 60% 40% at 50% 0%, rgba(139, 92, 246, 0.12), transparent 70%),
        radial-gradient(ellipse 40% 30% at 85% 15%, rgba(0, 240, 255, 0.08), transparent 60%);
    }

    /* EMBEDDED STAGE-ONLY FOCUS MODE (FOR SLOT DASHBOARD) */
    body.is-embedded {
      padding: 0 !important;
      margin: 0 !important;
      background: transparent !important;
      background-image: none !important;
      overflow: hidden !important;
      width: 100vw !important;
      height: 100vh !important;
      min-height: 100vh !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    body.is-embedded .nav-bar,
    body.is-embedded .header,
    body.is-embedded .selector-toolbar,
    body.is-embedded .run-set-ref-strip,
    body.is-embedded .transport-card,
    body.is-embedded #transportCard,
    body.is-embedded .inspector-panel,
    body.is-embedded #viewInspectorSfx,
    body.is-embedded #sfxTelemetryBadge,
    body.is-embedded #mediapipeTelemetryPill,
    body.is-embedded .compare-stage-grid,
    body.is-embedded .ref-ribbon-wrap,
    body.is-embedded .stage-controls-underneath {
      display: none !important;
    }
    body.is-embedded .app-layout {
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    body.is-embedded .stage-wrapper {
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    body.is-embedded .stage-container {
      height: calc(100vh - 8px) !important;
      max-height: calc(100vh - 8px) !important;
      width: auto !important;
      aspect-ratio: 9 / 16 !important;
      max-width: calc((100vh - 8px) * (9 / 16)) !important;
      border-radius: 28px !important;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.95), 0 0 0 4px #1E293B !important;
      margin: 0 auto !important;
    }

    /* TOP GLOBAL NAVIGATION */
    .nav-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 18px;
      background: rgba(16, 22, 37, 0.85);
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      backdrop-filter: blur(16px);
      max-width: 1280px;
      width: 100%;
      margin-bottom: 12px;
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .nav-brand .badge {
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(0, 240, 255, 0.15);
      color: var(--accent-cyan);
      border: 1px solid rgba(0, 240, 255, 0.3);
      text-transform: uppercase;
      font-weight: 800;
    }
    .nav-links {
      display: flex;
      gap: 8px;
    }
    .nav-links a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 8px;
      transition: all 0.2s;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
    }
    .nav-links a:hover, .nav-links a.active {
      color: #fff;
      background: rgba(0, 240, 255, 0.15);
      border-color: rgba(0, 240, 255, 0.4);
    }

    .header { text-align: center; margin-bottom: 8px; max-width: 1280px; width: 100%; }
    .header h1 { font-size: clamp(16px, 3.5vw, 22px); font-weight: 900; letter-spacing: 0.02em; background: linear-gradient(135deg, #00F0FF 0%, #A855F7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-transform: uppercase; margin-bottom: 3px; }
    .header p { font-size: clamp(11.5px, 2.2vw, 13px); color: var(--text-muted); }

    /* DYNAMIC SELECTOR TOOLBAR */
    .selector-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 12px;
      max-width: 1280px;
      width: 100%;
    }

    .btn-reroll {
      background: linear-gradient(135deg, #00F0FF 0%, #8B5CF6 100%);
      color: #070913;
      border: none;
      border-radius: 20px;
      padding: 7px 16px;
      font-size: 12.5px;
      font-weight: 900;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 18px rgba(0, 240, 255, 0.35);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .btn-reroll:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 6px 24px rgba(0, 240, 255, 0.55); }
    .btn-reroll:active { transform: scale(0.98); }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      color: var(--text-main);
      border-radius: 20px;
      padding: 6px 13px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.2s;
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.12); border-color: var(--accent-cyan); }
    .btn-secondary.active { background: rgba(0, 240, 255, 0.2); border-color: var(--accent-cyan); color: #00F0FF; }

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
      max-width: 640px;
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
      white-space: nowrap;
    }
    .tab-btn.active {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(139, 92, 246, 0.3));
      color: #FFF;
      border: 1px solid var(--accent-cyan);
      box-shadow: 0 2px 8px rgba(0, 240, 255, 0.25);
    }

    /* ========================================================================= */
    /* RUN SET IMAGE REFERENCE RIBBON (AT-A-GLANCE STRIP & QUICK SEEK JUMPER)    */
    /* ========================================================================= */
    .run-set-ref-strip {
      width: 100%;
      max-width: 1280px;
      background: rgba(14, 19, 38, 0.88);
      border: 1px solid var(--panel-border);
      border-radius: 18px;
      padding: 12px 16px;
      margin-bottom: 16px;
      backdrop-filter: blur(12px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .ref-strip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .ref-strip-title {
      font-size: 12.5px;
      font-weight: 900;
      color: #FFF;
      display: flex;
      align-items: center;
      gap: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .ref-strip-title .badge-count {
      background: rgba(0, 240, 255, 0.15);
      border: 1px solid rgba(0, 240, 255, 0.35);
      color: var(--accent-cyan);
      padding: 2px 7px;
      border-radius: 6px;
      font-size: 10.5px;
      font-family: monospace;
    }
    .ref-strip-subtitle {
      font-size: 11.5px;
      color: var(--text-muted);
    }
    .ref-cards-carousel {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 8px;
      scrollbar-width: thin;
      scrollbar-color: var(--accent-cyan) rgba(255,255,255,0.05);
    }
    .ref-cards-carousel::-webkit-scrollbar { height: 6px; }
    .ref-cards-carousel::-webkit-scrollbar-thumb { background: rgba(0, 240, 255, 0.4); border-radius: 4px; }

    .run-ref-card {
      flex: 0 0 210px;
      background: rgba(22, 29, 56, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }
    .run-ref-card:hover {
      border-color: var(--accent-cyan);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 240, 255, 0.2);
    }
    .run-ref-card.active-in-chunk {
      border-color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.12);
      box-shadow: 0 0 16px rgba(0, 240, 255, 0.4);
    }
    .run-set-ref-strip.collapsed .ref-cards-carousel,
    .run-set-ref-strip.collapsed .ref-strip-subtitle {
      display: none !important;
    }
    .run-set-ref-strip.collapsed {
      margin-bottom: 8px !important;
      padding: 10px 16px !important;
    }
    .btn-collapse-ribbon {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--panel-border);
      color: var(--accent-cyan);
      padding: 4px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: background 0.15s;
    }
    .btn-collapse-ribbon:hover {
      background: rgba(0, 240, 255, 0.15);
      border-color: var(--accent-cyan);
    }
    .run-ref-thumb-wrap {
      width: 100%;
      height: 125px;
      background: #080B15;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 6px;
      position: relative;
    }
    .run-ref-thumb-wrap img {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 4px;
      display: block;
    }
    .run-ref-card-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .run-ref-name {
      font-size: 11.5px;
      font-weight: 800;
      color: #FFF;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 130px;
    }
    .usage-badge {
      font-size: 10px;
      font-weight: 900;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      font-family: monospace;
    }
    .usage-multi {
      background: rgba(16, 185, 129, 0.25);
      border: 1px solid #10B981;
      color: #10B981;
      animation: pulseGlow 2s infinite alternate;
    }
    .usage-single {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: var(--text-muted);
    }

    .run-ref-occurrences {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .occ-chip {
      font-size: 9.5px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(0, 240, 255, 0.1);
      border: 1px solid rgba(0, 240, 255, 0.3);
      color: var(--accent-cyan);
      cursor: pointer;
      transition: all 0.15s;
    }
    .occ-chip:hover {
      background: var(--accent-cyan);
      color: #070913;
    }

    .app-layout {
      display: flex;
      gap: 20px;
      max-width: 1280px;
      width: 100%;
      align-items: flex-start;
      justify-content: center;
      transition: all 0.3s ease;
    }

    /* STAGE & VIDEO PLAYER WRAPPER */
    .stage-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: auto;
      gap: 12px;
    }

    /* DUAL STAGE / VIDEO WRAPPER FOR SPLIT MODE */
    .dual-player-row {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
    }

    /* 9:16 MOBILE VIEWPORT STAGE CONTAINER */
    .stage-container {
      position: relative;
      width: var(--stage-width);
      height: var(--stage-height);
      aspect-ratio: 9 / 16;
      background: radial-gradient(circle at 50% 30%, #151c33 0%, #0a0e1c 70%, #050711 100%);
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

    /* STATIC MATTED COACH TALKING HEAD CUTOUT (Z:20) */
    .speaker-matted-layer {
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 108%;
      height: auto;
      max-height: 88%;
      object-fit: contain;
      z-index: 20;
      pointer-events: none;
      display: block !important;
      opacity: 1 !important;
      filter: drop-shadow(0 15px 30px rgba(0,0,0,0.6));
    }
    .stage-container.drag-over {
      outline: 3px dashed var(--accent-pink) !important;
      outline-offset: -8px;
    }

    /* BACKGROUND & FLANK SHOULDER ASSET LAYER */
    .semantic-bg-asset-layer {
      position: absolute;
      z-index: 25; /* IN FRONT OF VIDEO CANVAS (Z:5), FLANKED AT SHOULDERS WITH CLEAR HEAD CLEARANCE */
      pointer-events: none;
      transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      width: auto !important;
      max-width: 90%;
    }
    .semantic-bg-asset-layer .chart-stage {
      position: relative;
      width: 360px;
      height: 210px;
      transform: scale(1.22);
      transform-origin: center center;
      overflow: visible;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      mask-image: radial-gradient(ellipse 80% 75% at 50% 50%, #000 35%, rgba(0,0,0,0.6) 70%, transparent 100%);
      -webkit-mask-image: radial-gradient(ellipse 80% 75% at 50% 50%, #000 35%, rgba(0,0,0,0.6) 70%, transparent 100%);
    }
    .semantic-bg-asset-layer img {
      filter: drop-shadow(0 12px 28px rgba(0,0,0,0.75));
    }

    /* ========================================================================= */
    /* MASTER ASSET MOTION & ANIMATION SUITE (SMOOTH BEZIER ENTRANCE & IDLE)    */
    /* ========================================================================= */
    /* Diplo Treatment for Asset Introduction (Spring Dip-In & Bezier Settle) */
    .asset-motion-diplo-drop {
      animation: assetDiploDrop 0.68s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, assetGentleBreathing 4.5s ease-in-out 0.68s infinite alternate;
      will-change: transform, opacity, filter;
    }
    @keyframes assetDiploDrop {
      0% {
        opacity: 0;
        transform: translate3d(0, -38px, 0) scale(0.68) rotate(-4deg);
        filter: blur(5px) drop-shadow(0 24px 40px rgba(0,0,0,0.85));
      }
      60% {
        opacity: 1;
        transform: translate3d(0, 6px, 0) scale(1.05) rotate(1.2deg);
        filter: blur(0px) drop-shadow(0 14px 28px rgba(0,0,0,0.7));
      }
      82% {
        transform: translate3d(0, -3px, 0) scale(0.98) rotate(-0.5deg);
      }
      100% {
        opacity: 0.95;
        transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
        filter: drop-shadow(0 12px 26px rgba(0,0,0,0.6));
      }
    }

    .asset-motion-swoosh-pop {
      animation: assetEntranceSwoosh 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards, assetIdleFloat 4s ease-in-out 0.65s infinite alternate;
      will-change: transform, opacity, filter;
    }
    @keyframes assetEntranceSwoosh {
      0% {
        opacity: 0;
        transform: translate3d(24px, 36px, 0) scale(0.72) rotate(-3deg);
        filter: blur(4px) drop-shadow(0 20px 40px rgba(0,0,0,0.8));
      }
      65% {
        opacity: 1;
        transform: translate3d(-3px, -4px, 0) scale(1.04) rotate(0.8deg);
        filter: blur(0px) drop-shadow(0 14px 30px rgba(0,0,0,0.7));
      }
      100% {
        opacity: 0.95;
        transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
        filter: drop-shadow(0 12px 28px rgba(0,0,0,0.6));
      }
    }
    @keyframes assetIdleFloat {
      0% { transform: translate3d(0, 0, 0) rotate(0deg); }
      100% { transform: translate3d(0, -6px, 0) rotate(1deg); }
    }

    .asset-motion-character-glide {
      animation: assetCharacterGlide 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards, assetGentleBreathing 5s ease-in-out 0.7s infinite alternate;
      will-change: transform, opacity;
    }
    @keyframes assetCharacterGlide {
      0% {
        opacity: 0;
        transform: translate3d(40px, 14px, 0) scale(0.82);
        filter: blur(3px);
      }
      100% {
        opacity: 0.95;
        transform: translate3d(0, 0, 0) scale(1);
        filter: drop-shadow(0 14px 32px rgba(0,0,0,0.7));
      }
    }
    @keyframes assetGentleBreathing {
      0% { transform: translate3d(0, 0, 0) scale(1); }
      100% { transform: translate3d(0, -4px, 0) scale(1.02); }
    }

    .asset-motion-focus-burst {
      animation: assetFocusBurst 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, assetSubtleHover 3.5s ease-in-out 0.6s infinite alternate;
      will-change: transform, opacity;
    }
    @keyframes assetFocusBurst {
      0% {
        opacity: 0;
        transform: translate3d(0, 24px, 0) scale(0.62) rotate(-5deg);
      }
      70% {
        opacity: 1;
        transform: translate3d(0, -4px, 0) scale(1.06) rotate(1.2deg);
      }
      100% {
        opacity: 0.95;
        transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
      }
    }
    @keyframes assetSubtleHover {
      0% { transform: translate3d(0, 0, 0) rotate(0deg); }
      100% { transform: translate3d(0, -5px, 0) rotate(1.5deg); }
    }

    /* BRAND & MICRO-ASSET DYNAMIC ANIMATIONS */
    .micro-anim-hologram-laser-scan {
      animation: hologramLaserEntrance 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards, hologramLaserIdle 3.8s ease-in-out 0.65s infinite alternate;
      will-change: transform, opacity, filter;
    }
    @keyframes hologramLaserEntrance {
      0% { opacity: 0; transform: translate3d(0, 20px, 0) scale(0.75) perspective(500px) rotateY(-15deg); filter: blur(6px) drop-shadow(0 0 20px #00F0FF); }
      70% { opacity: 1; transform: translate3d(0, -4px, 0) scale(1.04) perspective(500px) rotateY(2deg); filter: blur(0px) drop-shadow(0 0 12px #00F0FF); }
      100% { opacity: 0.98; transform: translate3d(0, 0, 0) scale(1) perspective(500px) rotateY(0deg); filter: drop-shadow(0 12px 28px rgba(0,0,0,0.75)); }
    }
    @keyframes hologramLaserIdle {
      0%   { transform: translate3d(0, 0px, 0) scale(1) rotate(0deg);      filter: drop-shadow(0 10px 24px rgba(0,0,0,0.75)) drop-shadow(0 0 0px rgba(0,240,255,0)); }
      30%  { transform: translate3d(0, -5px, 0) scale(1.02) rotate(-0.8deg); filter: drop-shadow(0 14px 30px rgba(0,240,255,0.35)) drop-shadow(0 0 8px rgba(0,240,255,0.2)); }
      65%  { transform: translate3d(0, -8px, 0) scale(1.03) rotate(0.5deg);  filter: drop-shadow(0 18px 36px rgba(0,240,255,0.55)) drop-shadow(0 0 14px rgba(0,240,255,0.3)); }
      100% { transform: translate3d(0, -4px, 0) scale(1.015) rotate(-0.3deg); filter: drop-shadow(0 14px 28px rgba(0,0,0,0.7)) drop-shadow(0 0 6px rgba(0,240,255,0.15)); }
    }

    .micro-anim-specular-glow-pulse {
      animation: specularGlowEntrance 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, specularGlowIdle 3s ease-in-out 0.7s infinite alternate;
      will-change: transform, opacity, filter;
    }
    @keyframes specularGlowEntrance {
      0% { opacity: 0; transform: scale(0.65) rotate(6deg); filter: blur(8px) drop-shadow(0 0 30px #FFE600); }
      60% { opacity: 1; transform: scale(1.06) rotate(-2deg); filter: blur(0px) drop-shadow(0 0 20px #FFE600); }
      100% { opacity: 0.98; transform: scale(1) rotate(0deg); filter: drop-shadow(0 14px 30px rgba(234,179,8,0.45)); }
    }
    @keyframes specularGlowIdle {
      0% { transform: scale(1); filter: drop-shadow(0 12px 26px rgba(234,179,8,0.4)); }
      100% { transform: scale(1.03) translateY(-4px); filter: drop-shadow(0 16px 36px rgba(234,179,8,0.7)); }
    }

    .micro-anim-elastic-badge-pop {
      animation: elasticBadgePop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, assetIdleFloat 4s ease-in-out 0.65s infinite alternate;
      will-change: transform, opacity;
    }
    @keyframes elasticBadgePop {
      0% { opacity: 0; transform: translate3d(0, -30px, 0) scale(0.6) rotate(-6deg); filter: blur(6px); }
      65% { opacity: 1; transform: translate3d(0, 4px, 0) scale(1.06) rotate(1deg); filter: blur(0px); }
      100% { opacity: 0.98; transform: translate3d(0, 0, 0) scale(1) rotate(0deg); filter: drop-shadow(0 14px 28px rgba(0,0,0,0.8)); }
    }

    .micro-anim-stroke-draw-reveal {
      animation: strokeDrawReveal 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards, assetGentleBreathing 4s ease-in-out 0.65s infinite alternate;
      will-change: transform, opacity;
    }
    @keyframes strokeDrawReveal {
      0% { opacity: 0; transform: translate3d(-20px, 0, 0) scale(0.8); filter: blur(4px); }
      100% { opacity: 0.98; transform: translate3d(0, 0, 0) scale(1); filter: drop-shadow(0 12px 28px rgba(0,0,0,0.7)); }
    }

    /* 3D KINETIC TYPOGRAPHY STAGES */
    .head-kinetic-stage {
      position: absolute;
      top: ${goldilocksHeadStageTopPercent}%;
      left: 50%;
      transform: translateX(-50%);
      width: 94%;
      max-width: 320px;
      z-index: 10; /* Z:10 behind the matted foreground speaker */
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      text-align: center;
      overflow: visible !important;
    }

    .chest-kinetic-stage {
      position: absolute;
      top: 56.5%;
      left: 50%;
      transform: translateX(-50%);
      width: 94%;
      max-width: 320px;
      z-index: 30; /* IN FRONT OF SPEAKER CHEST (Z:30) */
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      text-align: center;
      overflow: visible !important;
    }



    /* Foreground companion copy is laid out around—not inside—the masked core phrase. */
    .subject-mask-companion-stage {
      position: absolute;
      top: 8.5%;
      left: 50%;
      transform: translateX(-50%);
      width: 94%;
      max-width: 330px;
      z-index: 30; /* Z:30 in front of the matted foreground speaker at Z:20 */
      pointer-events: none;
      overflow: visible !important;
    }
    .subject-mask-core-layout,
    .subject-mask-companion-layout {
      box-sizing: border-box;
      max-width: 100%;
      padding-left: 8px;
      padding-right: 8px;
    }
    .subject-mask-core-layout .typo-layer {
      white-space: nowrap;
      max-width: 100%;
      font-stretch: condensed;
      line-height: 0.82 !important;
      z-index: 10; /* Z:10 behind the matted foreground speaker */
    }
    /* TALL-FONT MONOLITH (Zone A / Z:10): clean, tall, no decorative kinetic treatment. */
    .typo-layer .monolith-seal-text,
    .subject-mask-core-layout .monolith-seal-text {
      display: inline-block;
      white-space: nowrap;
      font-stretch: condensed;
      line-height: 0.92 !important;
      letter-spacing: -0.01em;
      transform-origin: center;
      animation: tallMonolithSeal 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes tallMonolithSeal {
      0%   { opacity: 0; transform: scale(0.86) translateY(10px); filter: blur(10px); }
      100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
    }
    .subject-mask-companion-layout.anchor-upper-left,
    .subject-mask-companion-layout.anchor-top-left {
      align-items: flex-start;
      text-align: left;
      transform: translateY(-8px);
    }
    .subject-mask-companion-layout.anchor-upper-right,
    .subject-mask-companion-layout.anchor-top-right {
      align-items: flex-end;
      text-align: right;
      transform: translateY(-8px);
    }
    .subject-mask-companion-layout.anchor-top-satellite,
    .subject-mask-companion-layout.anchor-top-center {
      align-items: center;
      text-align: center;
      transform: translateY(-16px);
    }
    .subject-mask-companion-layout.anchor-lower-right,
    .subject-mask-companion-layout.anchor-bottom-right {
      align-items: flex-end;
      text-align: right;
      transform: translateY(96px);
    }
    .subject-mask-companion-layout.anchor-flanked-left {
      align-items: flex-start;
      text-align: left;
      transform: translate(-14px, 24px);
    }
    .subject-mask-companion-layout.anchor-flanked-right {
      align-items: flex-end;
      text-align: right;
      transform: translate(14px, 24px);
    }
    .subject-mask-companion-layout.anchor-split-diagonal {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: 100%;
      min-height: 120px;
    }
    .subject-mask-companion-layout.anchor-split-diagonal .companion-prefix {
      align-self: flex-start;
      text-align: left;
      transform: translate(-4px, -12px);
    }
    .subject-mask-companion-layout.anchor-split-diagonal .companion-suffix {
      align-self: flex-end;
      text-align: right;
      transform: translate(4px, 48px);
    }
    .subject-mask-companion-layout.anchor-monolithic-stack {
      align-items: center;
      text-align: center;
    }

    .layer-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      overflow: visible !important;
    }

    .layer-group.layout-inline-horizontal {
      flex-direction: row !important;
      align-items: baseline !important;
      justify-content: center !important;
      gap: 0px !important;
      flex-wrap: wrap !important;
      max-width: 96% !important;
      overflow: visible !important;
    }
    .layer-group.layout-inline-horizontal .typo-layer {
      display: inline-flex !important;
      margin: 0 !important;
      overflow: visible !important;
    }

    .typo-layer {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap !important;
      align-items: baseline;
      justify-content: center;
      max-width: 100%;
      width: 100%;
      margin-left: auto;
      margin-right: auto;
      row-gap: 0.15em;
      column-gap: 0;
      line-height: 1.15;
      word-break: normal;
      overflow-wrap: normal;
      white-space: normal;
      overflow: visible !important;
    }

    .typo-layer *,
    .word-span,
    .word-item,
    .typewriter-char,
    .spring-cascade-char,
    .lime-glitch-char,
    .glyph-slot-char,
    .sketch-circle-text,
    .delayed-pill-card-text,
    .viewport-mask-sweep-text,
    .search-capsule-wrap span,
    .delayed-pill-card-container span {
      font-family: inherit !important;
      font-weight: inherit !important;
      font-style: inherit !important;
    }

    .word-span {
      display: inline-block !important;
      white-space: nowrap !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
      hyphens: none !important;
      -webkit-hyphens: none !important;
      flex-shrink: 0 !important;
      margin-right: 0.28em;
      padding-right: 0.14em;
      padding-left: 0.04em;
      overflow: visible !important;
      vertical-align: baseline;
    }
    .word-span:last-child {
      margin-right: 0 !important;
    }
    .word-spacer {
      display: inline-block !important;
      width: 0.28em;
      flex-shrink: 0 !important;
    }

    .word-item {
      display: inline-block !important;
      white-space: nowrap !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
      hyphens: none !important;
      -webkit-hyphens: none !important;
      flex-shrink: 0 !important;
      margin-right: 0.26em;
      padding-right: 0.14em;
      padding-left: 0.04em;
      overflow: visible !important;
      opacity: 0;
      animation-fill-mode: forwards;
      animation-duration: 0.65s;
      animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
    }
    .word-item:last-child {
      margin-right: 0 !important;
    }

    .layer-fx-subpixel_blur_mask .word-item { animation-name: blurRise; }
    .layer-fx-defocus_rack_focus .word-item { animation-name: defocusSnap; }
    .layer-fx-staggered_rotate_x .word-item { animation-name: rotate3DCascade; }
    .layer-fx-keynote_punch .word-item { animation-name: keynotePunch; }
    .layer-fx-slot_bounce .word-item { animation-name: slotBounce; }
    .layer-fx-top_down_character_drop .word-item { animation-name: topDownDrop; }
    .layer-fx-chromatic_character_displace .word-item { animation-name: chromaticDisplace; }

    @keyframes blurRise { 0% { opacity: 0; filter: blur(10px); transform: translateY(16px) scale(0.97); } 100% { opacity: 1; filter: blur(0px); transform: translateY(0) scale(1); } }
    @keyframes defocusSnap { 0% { opacity: 0; filter: blur(14px); transform: scale(1.03); } 50% { filter: blur(3px); } 100% { opacity: 1; filter: blur(0); transform: scale(1); } }
    @keyframes rotate3DCascade { 0% { opacity: 0; filter: blur(6px); transform: perspective(500px) rotateX(60deg) translateY(20px); } 100% { opacity: 1; filter: blur(0); transform: perspective(500px) rotateX(0deg) translateY(0); } }
    @keyframes keynotePunch { 0% { opacity: 0; transform: scale(0.88); filter: blur(4px); } 60% { transform: scale(1.02); filter: blur(0px); } 100% { opacity: 1; transform: scale(1); } }
    @keyframes slotBounce { 0% { opacity: 0; transform: translateY(-30px); } 70% { transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
    @keyframes topDownDrop { 0% { opacity: 0; transform: translateY(-24px); filter: blur(6px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0px); } }
    @keyframes chromaticDisplace {
      0% { opacity: 0; transform: translate(-6px, -3px) skewX(8deg); filter: drop-shadow(-3px 0 0 #00ffff) drop-shadow(3px 0 0 #ff0055); }
      50% { opacity: 0.9; transform: translate(3px, 1px) skewX(-4deg); filter: drop-shadow(1px 0 0 #00ffff) drop-shadow(-1px 0 0 #ff0055); }
      100% { opacity: 1; transform: translate(0, 0) skewX(0deg); filter: drop-shadow(0 0 0 transparent); }
    }

    .typewriter-char {
      display: inline-block;
      opacity: 0;
      animation: typeCharFade 0.05s forwards;
    }
    .typewriter-caret {
      display: inline-block;
      color: #00F0FF;
      font-weight: 900;
      margin-left: 2px;
      animation: blinkCaretAnim 0.7s infinite;
    }
    @keyframes typeCharFade { 0% { opacity: 0; transform: translateY(2px); } 100% { opacity: 1; transform: translateY(0); } }
    @keyframes blinkCaretAnim { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

    .viewport-mask-sweep-wrap {
      position: relative;
      display: inline-block;
      overflow: visible !important;
      max-width: 100%;
    }
    .viewport-mask-sweep-text {
      animation: maskSweepReveal 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      padding-right: 0.1em;
      padding-left: 0.04em;
    }
    .viewport-mask-sweep-bar {
      position: absolute;
      top: 0; left: 0; width: 3px; height: 100%;
      background: #00F0FF;
      box-shadow: 0 0 12px #00F0FF, 0 0 4px #FFF;
      animation: maskBarMove 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes maskSweepReveal {
      0% { clip-path: polygon(0 0, 0 0, 0 100%, 0 100%); }
      100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
    }
    @keyframes maskBarMove {
      0% { left: 0%; opacity: 1; }
      90% { left: 100%; opacity: 1; }
      100% { left: 100%; opacity: 0; }
    }

    .spring-cascade-char {
      display: inline-block;
      opacity: 0;
      padding-right: 0.08em;
      animation: springCascadeAnim 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    @keyframes springCascadeAnim {
      0% { opacity: 0; transform: translateY(24px) scale(0.6) perspective(400px) rotateX(45deg); filter: blur(6px); }
      70% { transform: translateY(-3px) scale(1.04) perspective(400px) rotateX(-5deg); filter: blur(0px); }
      100% { opacity: 1; transform: translateY(0) scale(1) perspective(400px) rotateX(0deg); filter: blur(0px); }
    }

    .search-capsule-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: rgba(0, 240, 255, 0.08);
      border: 1.5px solid #00F0FF;
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.35);
      border-radius: 30px;
      padding: 6px 16px;
      margin: 4px auto;
      max-width: 96%;
      box-sizing: border-box;
      white-space: nowrap !important;
      word-break: keep-all !important;
      flex-shrink: 0 !important;
      overflow: visible !important;
    }
    .search-capsule-icon { font-size: 13px; color: #00F0FF; flex-shrink: 0 !important; }

    .glyph-slot-wrap {
      display: inline-flex;
      flex-wrap: wrap !important;
      align-items: center;
      justify-content: center;
      overflow: visible !important;
      perspective: 400px;
      min-height: 1.25em;
      white-space: normal !important;
      word-break: normal !important;
      max-width: 100%;
    }
    .glyph-slot-char {
      display: inline-block;
      overflow: visible !important;
      padding-right: 0.06em;
      animation: slotCharSpin 0.65s cubic-bezier(0.16, 1, 0.3, 1) backwards;
    }
    @keyframes slotCharSpin {
      0% { transform: translateY(-120%) perspective(300px) rotateX(-90deg); opacity: 0; filter: blur(4px); }
      100% { transform: translateY(0) perspective(300px) rotateX(0deg); opacity: 1; filter: blur(0); }
    }

    .lime-glitch-char {
      display: inline-block;
      white-space: nowrap !important;
      word-break: keep-all !important;
      font-weight: 900;
      padding-right: 0.06em;
      animation: limeGlitchCharAnim 0.75s cubic-bezier(0.16, 1, 0.3, 1) backwards;
    }
    .lime-accent { color: #84CC16 !important; text-shadow: 0 0 16px rgba(132, 204, 22, 0.5) !important; }
    @keyframes limeGlitchCharAnim {
      0% { opacity: 0; transform: translate(-6px, -4px) skewX(10deg) scale(1.02); filter: blur(6px) drop-shadow(-4px 0 0 #00ffff) drop-shadow(4px 0 0 #ff0055); }
      30% { opacity: 0.9; transform: translate(4px, 2px) skewX(-6deg); filter: blur(1px) drop-shadow(2px 0 0 #00ffff) drop-shadow(-2px 0 0 #ff0055); }
      100% { opacity: 1; transform: translate(0, 0) skewX(0deg) scale(1); filter: blur(0px); }
    }

    /* ────────────────────────────────────────────────────────────
       5 SPECIALIZED MASTER KINETIC TYPOGRAPHY SUITES (ANIMA TYPO)
       ──────────────────────────────────────────────────────────── */

    /* 1. SKYHIGH LIQUID CHROME WAVE (Cotton.js sinusoidal wave distortion) */
    .skyhigh-wave-wrap {
      display: inline-flex;
      flex-wrap: wrap !important;
      align-items: center;
      justify-content: center;
      overflow: visible !important;
      max-width: 100%;
    }
    .skyhigh-wave-char {
      display: inline-block;
      white-space: nowrap !important;
      background: linear-gradient(180deg, #FFFFFF 0%, #E2E8F0 25%, #94A3B8 50%, #FFFFFF 75%, #475569 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 10px rgba(255, 255, 255, 0.4));
      animation: skyhighWaveEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) backwards, skyhighWaveIdle 3s ease-in-out infinite alternate;
      will-change: transform, filter;
      padding: 0 0.03em;
    }
    @keyframes skyhighWaveEntrance {
      0% { opacity: 0; transform: translateY(30px) scaleY(0.4) skewX(20deg); filter: blur(10px); }
      60% { opacity: 1; transform: translateY(-8px) scaleY(1.15) skewX(-8deg); filter: blur(1px); }
      100% { opacity: 1; transform: translateY(0) scaleY(1) skewX(0deg); filter: blur(0px); }
    }
    @keyframes skyhighWaveIdle {
      0% { transform: translateY(0px) rotateZ(0deg) skewX(0deg); }
      33% { transform: translateY(-8px) rotateZ(-1.5deg) skewX(4deg); }
      66% { transform: translateY(6px) rotateZ(1.5deg) skewX(-4deg); }
      100% { transform: translateY(-3px) rotateZ(0deg) skewX(0deg); }
    }

    /* 2. OVERLAPPING 3D LETTER TILT (CANVA Layered Stagger) */
    .overlap-tilt-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      perspective: 700px;
      overflow: visible !important;
      max-width: 100%;
      letter-spacing: -0.08em;
    }
    .overlap-tilt-char {
      position: relative;
      display: inline-block;
      padding: 0 0.04em;
      margin-right: -0.1em;
      color: #E2E8F0;
      text-shadow: 0 1px 2px rgba(0,0,0,0.6);
      filter: drop-shadow(6px 0px 8px rgba(0, 0, 0, 0.9)) drop-shadow(12px 4px 16px rgba(0, 0, 0, 0.7));
      animation: letterOverlapTiltEntrance 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) backwards, letterOverlapBreathe 4s ease-in-out infinite alternate;
      will-change: transform, opacity;
      transform-style: preserve-3d;
    }
    @keyframes letterOverlapTiltEntrance {
      0% { opacity: 0; transform: perspective(600px) rotateY(-40deg) translateZ(50px) translateY(24px); filter: blur(8px); }
      70% { opacity: 1; transform: perspective(600px) rotateY(6deg) translateZ(-5px) translateY(-3px); filter: blur(0px); }
      100% { opacity: 1; transform: perspective(600px) rotateY(0deg) translateZ(0) translateY(0); filter: blur(0px); }
    }
    @keyframes letterOverlapBreathe {
      0% { transform: perspective(600px) rotateY(0deg) translateZ(0); }
      100% { transform: perspective(600px) rotateY(-4deg) translateZ(8px); }
    }

    /* 3. 3D CAUSTIC GLASSMORPHIC LETTERFORMS (Glass A Refraction) */
    .glassmorphic-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: visible !important;
      max-width: 100%;
    }
    .glassmorphic-char {
      display: inline-block;
      color: rgba(255, 255, 255, 0.88);
      -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.85);
      text-shadow: 0 0 16px rgba(255, 255, 255, 0.9), 0 0 32px rgba(0, 240, 255, 0.6), 0 8px 24px rgba(0, 0, 0, 0.5);
      background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.7) 100%);
      -webkit-background-clip: text;
      animation: glassmorphicEntrance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) backwards, glassmorphicCausticShimmer 3.5s ease-in-out infinite alternate;
      will-change: transform, filter;
      padding: 0 0.05em;
    }
    @keyframes glassmorphicEntrance {
      0% { opacity: 0; transform: scale(0.5) translateY(28px) rotate(-6deg); filter: blur(12px) brightness(2); }
      65% { opacity: 1; transform: scale(1.08) translateY(-4px) rotate(1deg); filter: blur(0px) brightness(1.2); }
      100% { opacity: 1; transform: scale(1) translateY(0) rotate(0deg); filter: blur(0px) brightness(1); }
    }
    @keyframes glassmorphicCausticShimmer {
      0% { filter: drop-shadow(0 0 10px rgba(255,255,255,0.6)) drop-shadow(0 0 20px rgba(0,240,255,0.3)); transform: scale(1) translateY(0); }
      100% { filter: drop-shadow(0 0 24px rgba(255,255,255,0.95)) drop-shadow(0 0 40px rgba(0,240,255,0.75)); transform: scale(1.03) translateY(-3px); }
    }

    /* 4. VIBE CHROMATIC LUMINESCENCE PULSE (Anamorphic beam smearing) */
    .vibe-luminescence-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: visible !important;
      max-width: 100%;
    }
    .vibe-luminescence-char {
      display: inline-block;
      color: #FFFFFF;
      text-shadow: 0 0 20px rgba(140, 180, 255, 0.9), 0 0 40px rgba(255, 120, 220, 0.75), 0 0 80px rgba(0, 240, 255, 0.5);
      animation: vibeEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) backwards, vibeChromaticShudder 2.5s ease-in-out infinite alternate;
      will-change: transform, filter;
      padding: 0 0.06em;
    }
    @keyframes vibeEntrance {
      0% { opacity: 0; transform: scale(1.2) translateY(10px); filter: blur(18px); }
      100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0.4px); }
    }
    @keyframes vibeChromaticShudder {
      0% {
        transform: translate(0, 0);
        filter: drop-shadow(-3px -8px 14px rgba(0, 240, 255, 0.8)) drop-shadow(3px 8px 14px rgba(255, 0, 128, 0.8)) blur(0.3px);
      }
      25% {
        transform: translate(-1.5px, 0.5px);
        filter: drop-shadow(-5px -12px 20px rgba(0, 240, 255, 0.9)) drop-shadow(5px 12px 20px rgba(255, 0, 128, 0.9)) blur(0.6px);
      }
      75% {
        transform: translate(1.5px, -0.5px);
        filter: drop-shadow(-2px -6px 10px rgba(0, 240, 255, 0.7)) drop-shadow(2px 6px 10px rgba(255, 0, 128, 0.7)) blur(0.2px);
      }
      100% {
        transform: translate(0, 0);
        filter: drop-shadow(-4px -10px 18px rgba(0, 240, 255, 0.85)) drop-shadow(4px 10px 18px rgba(255, 0, 128, 0.85)) blur(0.4px);
      }
    }

    /* 5. SKYWALL MONOLITHIC STEEL HYDRAULIC RISE */
    .skywall-steel-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: visible !important;
      max-width: 100%;
    }
    .skywall-steel-char {
      display: inline-block;
      background: linear-gradient(180deg, #FFFFFF 0%, #CBD5E1 30%, #64748B 60%, #94A3B8 80%, #334155 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.95)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8));
      animation: skywallMonolithicRise 0.65s cubic-bezier(0.16, 1, 0.3, 1) backwards, skywallSteelSheen 4s ease-in-out infinite alternate;
      will-change: transform, filter;
      padding: 0 0.02em;
    }
    @keyframes skywallMonolithicRise {
      0% { opacity: 0; transform: translateY(40px) scaleY(1.25); filter: blur(8px); }
      70% { opacity: 1; transform: translateY(-4px) scaleY(0.98); filter: blur(0px); }
      100% { opacity: 1; transform: translateY(0) scaleY(1); filter: blur(0px); }
    }
    @keyframes skywallSteelSheen {
      0% { filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 6px rgba(200, 225, 255, 0.2)); }
      100% { filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.98)) drop-shadow(0 0 16px rgba(200, 225, 255, 0.6)); }
    }


    .delayed-pill-card-container {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 16px;
      border-radius: 10px;
      box-sizing: border-box;
      max-width: 100%;
      margin: 4px auto;
      white-space: normal !important;
      word-break: normal !important;
      flex-shrink: 0 !important;
      overflow: visible !important;
    }
    .delayed-pill-card-bg {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      transform: scaleX(0);
      transform-origin: left center;
      border-radius: 10px;
      animation: pillCardSweepLeftToRight 0.45s 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      z-index: 1;
    }
    .delayed-pill-card-text {
      position: relative;
      z-index: 2;
      font-weight: 900;
      white-space: nowrap !important;
      padding-right: 0.12em;
      padding-left: 0.04em;
      flex-shrink: 0 !important;
      animation: pillTextFadeIn 0.3s 0.25s ease forwards;
    }
    .card-yellow { background-color: #FFE600; }
    .card-red-pressure { background-color: #FF1744; }
    .card-cyan { background-color: #00F0FF; }
    .card-lavender { background-color: #C084FC; box-shadow: 0 0 18px rgba(192, 132, 252, 0.5); }

    @keyframes pillCardSweepLeftToRight { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
    @keyframes pillTextFadeIn { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }

    .editorial-double-underline {
      position: relative;
      display: inline-block;
      white-space: nowrap !important;
      border-bottom: 2.5px solid currentColor;
      padding-bottom: 2px;
      line-height: 1;
    }
    .editorial-double-underline::after {
      content: '';
      position: absolute;
      left: 0;
      bottom: -4px;
      width: 100%;
      height: 1.5px;
      background-color: currentColor;
    }

    .sketch-circle-loop-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 20px;
      margin: 2px auto;
      white-space: nowrap !important;
      word-break: keep-all !important;
      flex-shrink: 0 !important;
    }
    .sketch-circle-loop-svg {
      position: absolute;
      top: -10px;
      left: -14px;
      width: calc(100% + 28px);
      height: calc(100% + 20px);
      pointer-events: none;
      overflow: visible;
      z-index: 1;
    }
    .sketch-circle-path {
      fill: none;
      stroke: #00F0FF;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.92;
      filter: drop-shadow(0 2px 8px rgba(0, 240, 255, 0.45));
      stroke-dasharray: 800;
      stroke-dashoffset: 800;
      animation: sketchCircleDraw 0.65s 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes sketchCircleDraw {
      0% { stroke-dashoffset: 800; }
      100% { stroke-dashoffset: 0; }
    }
    .sketch-circle-text {
      position: relative;
      z-index: 2;
      white-space: nowrap !important;
      word-break: keep-all !important;
    }

    .typo-line-row {
      display: flex;
      flex-direction: row;
      align-items: baseline;
      justify-content: center;
      gap: 0.28em;
      max-width: 100%;
      flex-wrap: wrap;
    }

    /* BOTTOM CONTROLS & TIMELINE */
    .controls-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      max-width: var(--stage-width);
      width: 100%;
      flex-wrap: wrap;
    }

    .timeline-slider-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: var(--stage-width);
      width: 100%;
    }
    .timeline-slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      font-family: monospace;
      color: var(--text-muted);
    }
    .timeline-slider-header strong { color: var(--accent-cyan); }
    .timeline-slider {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.1);
      outline: none;
      cursor: pointer;
    }
    .timeline-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--accent-cyan);
      cursor: pointer;
      box-shadow: 0 0 10px var(--accent-cyan);
    }

    /* RIGHT INSPECTOR PANEL & CROSS-COMPARISON BOX */
    .inspector-panel {
      flex: 1;
      min-width: 320px;
      max-width: 720px;
      background: rgba(16, 22, 37, 0.85);
      border: 1px solid var(--panel-border);
      border-radius: 20px;
      padding: 16px 20px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
      backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .inspector-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      font-weight: 800;
      color: #FFF;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 10px;
    }
    .inspector-title .spurt-badge {
      font-size: 11px;
      background: rgba(0, 240, 255, 0.15);
      color: var(--accent-cyan);
      border: 1px solid rgba(0, 240, 255, 0.3);
      padding: 3px 8px;
      border-radius: 6px;
      font-family: monospace;
    }

    /* CHUNK PICKER CHIPS */
    .chunk-chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-height: 100px;
      overflow-y: auto;
      padding: 4px;
      background: rgba(0,0,0,0.25);
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.04);
    }
    .chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--panel-border);
      color: var(--text-muted);
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 10.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }
    .chip:hover { color: #FFF; border-color: rgba(255,255,255,0.2); }
    .chip.active {
      background: var(--accent-cyan);
      color: #070913;
      border-color: var(--accent-cyan);
      font-weight: 900;
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
    }

    /* CROSS-COMPARISON CARD (SIDE-BY-SIDE ORIGINAL VS LIVE SPECIMEN) */
    .cross-compare-card {
      background: rgba(10, 14, 28, 0.95);
      border: 1px solid rgba(0, 240, 255, 0.25);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .compare-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: rgba(0,0,0,0.4);
      border-bottom: 1px solid var(--panel-border);
      font-size: 12px;
      font-weight: 800;
      color: #FFF;
    }
    .compare-stage-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: 180px;
    }
    @media (max-width: 600px) {
      .compare-stage-grid { grid-template-columns: 1fr; }
    }
    .compare-col {
      padding: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .compare-col.col-ref {
      background: rgba(0,0,0,0.5);
      border-right: 1px solid var(--panel-border);
    }
    .compare-col-label {
      position: absolute;
      top: 8px;
      left: 10px;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(0,0,0,0.7);
      color: var(--text-muted);
      border: 1px solid rgba(255,255,255,0.06);
    }
    .compare-col img {
      max-width: 90%;
      max-height: 130px;
      object-fit: contain;
      border-radius: 6px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.6);
      cursor: zoom-in;
    }
    .live-specimen-box {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 10px;
    }

    /* FIDELITY RADAR BAR */
    .fidelity-radar-bar {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(0,0,0,0.3);
      border-top: 1px solid var(--panel-border);
      justify-content: space-around;
      flex-wrap: wrap;
    }
    .radar-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 10.5px;
      color: var(--text-muted);
    }
    .radar-item strong { color: #FFF; }
    .radar-icon { font-size: 11px; }

    /* INSPECTOR SUB-TABS */
    .spec-tabs {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 8px;
    }
    .spec-tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 11.5px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
    }
    .spec-tab-btn.active {
      background: rgba(255,255,255,0.1);
      color: #FFF;
    }

    /* SPECIFICATION TABLE */
    .spec-table-wrap {
      overflow-x: auto;
      max-height: 180px;
    }
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      text-align: left;
    }
    .spec-table th, .spec-table td {
      padding: 6px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .spec-table th {
      color: var(--text-muted);
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      background: rgba(0,0,0,0.2);
    }

    /* RAW JSON VIEWER */
    .raw-json-box {
      background: #060913;
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 10px;
      font-family: monospace;
      font-size: 11px;
      color: #A5B4FC;
      max-height: 180px;
      overflow-y: auto;
      white-space: pre-wrap;
    }

    /* ========================================================================= */
    /* MODE 2: CORPUS IMAGE REFERENCE & BENCHMARK GALLERY                        */
    /* ========================================================================= */
    .corpus-gallery-panel {
      width: 100%;
      max-width: 1280px;
      display: none;
      flex-direction: column;
      gap: 16px;
    }
    .gallery-filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: space-between;
      align-items: center;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      padding: 12px 18px;
      border-radius: 14px;
    }
    .gallery-filter-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 18px;
    }
    .corpus-card {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      transition: all 0.2s;
    }
    .corpus-card:hover {
      border-color: var(--accent-cyan);
      transform: translateY(-2px);
    }
    .corpus-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: rgba(0,0,0,0.3);
      border-bottom: 1px solid var(--panel-border);
    }
    .corpus-card-title {
      font-size: 12.5px;
      font-weight: 800;
      color: #FFF;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .corpus-preview-stage {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: 140px;
      border-bottom: 1px solid var(--panel-border);
    }
    .corpus-ref-col {
      background: #080C1A;
      border-right: 1px solid var(--panel-border);
      padding: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .corpus-ref-col img {
      max-width: 95%;
      max-height: 110px;
      object-fit: contain;
      border-radius: 6px;
    }
    .corpus-render-col {
      padding: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .corpus-card-footer {
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--text-muted);
      background: rgba(0,0,0,0.15);
    }

    /* ========================================================================= */
    /* MODE 3: NETWORK GRAPH & ANALYTICS LAB                                     */
    /* ========================================================================= */
    .analytics-lab-panel {
      width: 100%;
      max-width: 1280px;
      display: none;
      flex-direction: column;
      gap: 16px;
    }
    .kpi-banner {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .kpi-card {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 14px;
      padding: 14px 18px;
    }
    .kpi-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
    .kpi-val { font-size: 22px; font-weight: 900; }
    .kpi-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

    .analytics-workspace-grid {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 16px;
    }
    @media (max-width: 960px) {
      .analytics-workspace-grid { grid-template-columns: 1fr; }
    }
    .graph-container-card {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 18px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      min-height: 580px;
    }
    .svg-graph-wrapper {
      flex: 1;
      width: 100%;
      min-height: 520px;
      position: relative;
    }
    .svg-graph-wrapper svg { width: 100%; height: 100%; }

    .analytics-side-col {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .side-tab-bar {
      display: flex;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 3px;
      gap: 4px;
    }
    .side-tab-btn {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 6px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
    }
    .side-tab-btn.active {
      background: var(--accent-cyan);
      color: #070913;
      font-weight: 900;
    }
    .ranking-list {
      max-height: 520px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ranking-item {
      background: rgba(22, 29, 56, 0.7);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      padding: 10px 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .ranking-item:hover {
      border-color: var(--accent-cyan);
      background: rgba(22, 29, 56, 0.95);
    }
    .ranking-item-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .rank-name { font-size: 12px; font-weight: 800; color: #FFF; }
    .rank-badge { font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    .badge-active { background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid #10B981; }
    .badge-zero { background: rgba(255, 0, 85, 0.2); color: #FF0055; border: 1px solid #FF0055; }
    .rank-bar-bg { width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; margin-bottom: 6px; }
    .rank-bar-fill { height: 100%; border-radius: 2px; }

    /* IMAGE MODAL ENLARGE */
    .img-modal-overlay {
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.9);
      backdrop-filter: blur(10px);
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .img-modal-card {
      background: #101625;
      border: 1px solid rgba(0, 240, 255, 0.4);
      border-radius: 18px;
      padding: 16px;
      max-width: 900px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 25px 80px rgba(0,0,0,0.9);
    }
    .img-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 8px;
    }
    .img-modal-body {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .img-modal-body img {
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
      border-radius: 8px;
    }

    @keyframes pulseGlow {
      from { box-shadow: 0 0 6px rgba(16, 185, 129, 0.3); }
      to { box-shadow: 0 0 14px rgba(16, 185, 129, 0.7); }
    }

    /* INSPECTOR DUAL-MODE SEGMENTED SWITCHER */
    .inspector-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      gap: 12px;
      flex-wrap: wrap;
    }
    .inspector-segmented-switcher {
      display: flex;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 3px;
      gap: 4px;
    }
    .seg-tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }
    .seg-tab-btn:hover {
      color: #fff;
      background: rgba(255,255,255,0.06);
    }
    .seg-tab-btn.active {
      background: var(--accent-cyan);
      color: #070913;
      font-weight: 900;
      box-shadow: 0 0 16px rgba(6, 182, 212, 0.4);
    }

    /* INSPECTOR SWAP CONTAINERS */
    .inspector-view-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
      animation: fadeIn 0.2s ease-out;
    }

    .anima-selector-card {
      background: var(--panel-bg);
      border: 1px solid rgba(6, 182, 212, 0.35);
      border-radius: 18px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.7), 0 0 20px rgba(6,182,212,0.12);
    }

    .active-anomaly-signal-box {
      background: rgba(0,0,0,0.65);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .anomaly-badge {
      background: var(--accent-cyan);
      color: #000;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 900;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .anomaly-layer-blueprint {
      background: rgba(124,58,237,0.12);
      border: 1px solid rgba(124,58,237,0.3);
      border-radius: 8px;
      padding: 10px 12px;
      font-family: var(--font-mono);
      font-size: 11px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-top: 4px;
    }
    .anomaly-matrix-title {
      font-size: 11px;
      font-weight: 800;
      color: var(--text-secondary);
      font-family: var(--font-mono);
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
    }
    .anomaly-table-wrap {
      max-height: 280px;
      overflow-y: auto;
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      background: rgba(0,0,0,0.4);
    }
    .anomaly-table-row {
      cursor: pointer;
      transition: background 0.15s;
    }
    .anomaly-table-row:hover {
      background: rgba(6,182,212,0.15);
    }
    .anomaly-table-row.active-row {
      background: rgba(6,182,212,0.25);
      border-left: 3px solid var(--accent-cyan);
    }
  
    /* ULTRA-STRICT EMBEDDED STAGE-ONLY FOCUS (100% CLEAN 9:16 PHONE STAGE) */
    html.is-embedded, body.is-embedded {
      padding: 0 !important;
      margin: 0 !important;
      background: #000 !important;
      background-image: none !important;
      overflow: hidden !important;
      width: 100vw !important;
      height: 100vh !important;
      min-height: 100vh !important;
      display: block !important;
    }
    html.is-embedded .nav-bar,
    html.is-embedded .header,
    html.is-embedded .selector-toolbar,
    html.is-embedded .view-mode-tabs,
    html.is-embedded .run-set-ref-strip,
    html.is-embedded .transport-card,
    html.is-embedded #transportCard,
    html.is-embedded .inspector-panel,
    html.is-embedded #inspectorPanel,
    html.is-embedded .controls-bar,
    html.is-embedded .timeline-slider-wrap,
    html.is-embedded #viewInspectorProvenance,
    html.is-embedded #viewInspectorAnima,
    html.is-embedded #viewInspectorSfx,
    html.is-embedded #crossCompareCard,
    html.is-embedded .inspector-view-container,
    html.is-embedded .inspector-header-bar,
    html.is-embedded .chunk-chips-container,
    html.is-embedded #sfxTelemetryBadge,
    html.is-embedded #mediapipeTelemetryPill,
    html.is-embedded .compare-stage-grid,
    html.is-embedded .ref-ribbon-wrap,
    html.is-embedded .stage-controls-underneath,
    html.is-embedded .sync-video-card,
    body.is-embedded .nav-bar,
    body.is-embedded .header,
    body.is-embedded .selector-toolbar,
    body.is-embedded .view-mode-tabs,
    body.is-embedded .run-set-ref-strip,
    body.is-embedded .transport-card,
    body.is-embedded #transportCard,
    body.is-embedded .inspector-panel,
    body.is-embedded #inspectorPanel,
    body.is-embedded .controls-bar,
    body.is-embedded .timeline-slider-wrap,
    body.is-embedded #viewInspectorProvenance,
    body.is-embedded #viewInspectorAnima,
    body.is-embedded #viewInspectorSfx,
    body.is-embedded #crossCompareCard,
    body.is-embedded .inspector-view-container,
    body.is-embedded .inspector-header-bar,
    body.is-embedded .chunk-chips-container,
    body.is-embedded #sfxTelemetryBadge,
    body.is-embedded #mediapipeTelemetryPill,
    body.is-embedded .compare-stage-grid,
    body.is-embedded .ref-ribbon-wrap,
    body.is-embedded .stage-controls-underneath,
    body.is-embedded .sync-video-card {
      display: none !important;
      visibility: hidden !important;
      width: 0 !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    html.is-embedded .app-layout,
    body.is-embedded .app-layout,
    html.is-embedded .stage-wrapper,
    body.is-embedded .stage-wrapper,
    html.is-embedded .dual-player-row,
    body.is-embedded .dual-player-row {
      width: 100vw !important;
      height: 100vh !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
    }
    html.is-embedded .stage-container,
    body.is-embedded .stage-container {
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      position: relative !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
      overflow: hidden !important;
      background: radial-gradient(circle at 50% 30%, #151c33 0%, #0a0e1c 70%, #050711 100%) !important;
    }
    html.is-embedded .speaker-matted-layer,
    body.is-embedded .speaker-matted-layer {
      position: absolute !important;
      bottom: 0 !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      width: 100% !important;
      height: auto !important;
      max-height: 90% !important;
      object-fit: contain !important;
      z-index: 20 !important;
      pointer-events: none !important;
      display: block !important;
      opacity: 1 !important;
    }
    html.is-embedded .chest-kinetic-stage,
    body.is-embedded .chest-kinetic-stage {
      position: absolute !important;
      bottom: 18% !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      width: 92% !important;
      z-index: 30 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      pointer-events: none !important;
    }
    html.is-embedded .head-kinetic-stage,
    body.is-embedded .head-kinetic-stage {
      position: absolute !important;
      top: 5.5% !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      width: 96% !important;
      z-index: 10 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      pointer-events: none !important;
    }

  
    /* FREEZE ALL TEXT MOVEMENT & CSS KEYFRAMES WHEN PAUSED */
    body.is-paused *,
    body.is-paused *::before,
    body.is-paused *::after,
    .is-paused *,
    .is-paused *::before,
    .is-paused *::after {
      animation-play-state: paused !important;
    }

  
    /* FANCY MODE TOGGLE: PRODUCTION VS TEST MATTING DEPTH */
    .fancy-mode-toggle {
      background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.2));
      border: 1.5px solid #10B981;
      color: #FFF;
      border-radius: 8px;
      padding: 6px 14px;
      font-weight: 800;
      font-size: 12px;
      font-family: var(--font-mono);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 14px rgba(16,185,129,0.25);
    }
    .fancy-mode-toggle:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 20px rgba(16,185,129,0.45);
    }
    .fancy-mode-toggle.active-test {
      background: linear-gradient(135deg, rgba(236,72,153,0.25), rgba(168,85,247,0.3));
      border-color: #EC4899;
      color: #FFD1E8;
      box-shadow: 0 0 16px rgba(236,72,153,0.35);
    }
    .test-depth-hud-bar {
      display: none;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: rgba(15,23,42,0.85);
      border: 1px solid rgba(236,72,153,0.4);
      border-radius: 8px;
      padding: 6px 12px;
      margin-top: 8px;
      font-size: 11px;
      font-family: var(--font-mono);
      color: #E2E8F0;
    }
    .test-depth-hud-btn {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.2);
      color: #FFF;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .test-depth-hud-btn:hover {
      background: rgba(236,72,153,0.3);
      border-color: #EC4899;
    }
    .test-depth-hud-btn.active {
      background: #EC4899;
      border-color: #EC4899;
      color: #FFF;
      font-weight: 700;
    }

    /* ============================= */
    /* 🎞️ MATTED VIDEO GALLERY MODAL */
    /* ============================= */
    .matted-gallery-modal {
      position: fixed;
      inset: 0;
      background: rgba(3, 7, 18, 0.88);
      backdrop-filter: blur(10px);
      z-index: 99999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .matted-gallery-modal.open { display: flex; }
    .matted-gallery-modal-box {
      width: 100%;
      max-width: 720px;
      max-height: 82vh;
      background: rgba(14, 19, 38, 0.98);
      border: 1px solid rgba(168, 85, 247, 0.45);
      border-radius: 18px;
      box-shadow: 0 24px 70px rgba(0,0,0,0.85), 0 0 30px rgba(168,85,247,0.25);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .matted-gallery-modal-head {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      position: relative;
    }
    .matted-gallery-modal-head h3 {
      font-size: 16px;
      font-weight: 900;
      color: #F0ABFC;
      margin: 0;
    }
    .matted-gallery-sub {
      font-size: 11px;
      color: #8E9BAE;
      font-family: var(--font-mono);
    }
    .matted-gallery-close {
      margin-left: auto;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      color: #FFF;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .matted-gallery-close:hover { background: #EF4444; border-color: #EF4444; }
    .matted-gallery-hint {
      padding: 10px 20px;
      font-size: 11.5px;
      color: #94A3B8;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .matted-gallery-list {
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .matted-gallery-empty {
      text-align: center;
      color: #64748B;
      padding: 30px 10px;
      font-size: 13px;
    }
    .matted-gallery-item {
      display: flex;
      align-items: center;
      gap: 14px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 10px 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .matted-gallery-item:hover {
      background: rgba(168,85,247,0.12);
      border-color: #A855F7;
    }
    .matted-gallery-thumb {
      width: 92px;
      height: 56px;
      border-radius: 8px;
      overflow: hidden;
      background: #000;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .matted-gallery-thumb video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: transparent;
    }
    .matted-gallery-item-meta {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .matted-gallery-item-name {
      font-size: 12.5px;
      font-weight: 700;
      color: #FFF;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .matted-gallery-item-size {
      font-size: 11px;
      color: #8E9BAE;
      font-family: var(--font-mono);
    }
    .matted-gallery-item-load {
      margin-left: auto;
      background: linear-gradient(135deg, rgba(236,72,153,0.9), rgba(168,85,247,0.9));
      border: none;
      color: #FFF;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      flex-shrink: 0;
    }
    .matted-gallery-item-load:hover { transform: scale(1.04); }

  </style>
</head>
<body>

  <!-- TOP GLOBAL NAV -->
  <nav class="nav-bar">
    <div class="nav-brand">
      <span>⚡ PROMETHEUS RUN STUDIO</span>
      <span class="badge">100% FAITHFUL FONT JSON REALIZATION</span>
    </div>
    <div class="nav-links">
      <a href="/typo" class="active">🎬 /typo Kinetic & Video Studio</a>
      <a href="/">🎥 / Video SFX Player</a>
      <a href="/mixfont">🎨 /mixfont Testing Hub</a>
      <a href="/anima">✨ /anima ANIMA Studio</a>
      <a href="/paste">📸 /paste Gallery</a>
    </div>
  </nav>

  <!-- HEADER -->
  <div class="header">
    <h1>Faithful Font JSON Realization & Run-Set Image Reference Studio</h1>
    <p>Spoken Spurt Timing • 45 Authoritative Font JSON Profiles • Video Frame Sync & Image Benchmark</p>
  </div>

  <!-- DYNAMIC TOOLBAR -->
  <div class="selector-toolbar">
    <div class="telemetry-chip" style="background: rgba(6,182,212,0.15); border-color: var(--accent-cyan); display: flex; align-items: center; gap: 6px;">
      <span style="color: var(--accent-cyan); font-weight: 800;">📜 Transcript:</span>
      <select id="selTranscript" onchange="switchTranscript(this.value)" style="background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; padding: 4px 8px; font-weight: 800; font-family: var(--font-mono); font-size: 11px; outline: none; cursor: pointer;">
        <option value="script1" selected>Active: E2A Flipping Model ($12k Products / Amazon)</option>
        <option value="script2">Script #2: Broken Business ($50k / 70h)</option>
        <option value="script3">Script #3: Focus vs Growth Problem</option>
      </select>
    </div>
    <div class="telemetry-chip" style="background: rgba(139,92,246,0.15); border-color: var(--accent-purple); display: flex; align-items: center; gap: 6px;">
      <span style="color: var(--accent-purple); font-weight: 800;">👤 Coach Image:</span>
      <select id="selSpeakerCutout" onchange="switchCoachCutout(this.value)" style="background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; padding: 4px 8px; font-weight: 800; font-family: var(--font-mono); font-size: 11px; outline: none; cursor: pointer;">
        <option value="male" selected>Coach: Male Cutout (Clean)</option>
        <option value="laptop">Coach: Desk / Laptop Talking Head</option>
        <option value="akimbo">Coach: Akimbo Frame Cutout</option>
      </select>
    </div>
    <button class="btn-reroll" onclick="reRollTreatment()">
      <span>🎲 Re-roll Seed Sequence</span>
    </button>
    <button class="btn-secondary" onclick="resetSeed(101)">
      <span>🔄 Reset to Seed #101</span>
    </button>
    <button class="btn-secondary" id="btnToggleBbox" onclick="toggleBbox()">
      <span>📐 Wireframe: OFF</span>
    </button>
    <button class="btn-secondary" id="btnAudioMode" onclick="toggleAudioMode()">
      <span>🔊 SFX: ACTIVE</span>
    </button>
    <div class="telemetry-chip">
      <span>Seed: <strong id="lblActiveSeed">#101</strong></span>
    </div>
    <div class="telemetry-chip">
      <span>Scalp Baseline: <strong id="lblScalpBaseline">14.79%</strong></span>
    </div>
    <div class="telemetry-chip">
      <span>Timeline: <strong id="lblVideoClock">00:00.00</strong></span>
    </div>
  </div>

  <!-- VIEW MODE TABS -->
  <div class="view-mode-tabs">
    <button class="tab-btn active" id="tabPresentation" onclick="setViewMode('presentation')">📱 Phone Stage (Static Coach)</button>
    <button class="tab-btn" id="tabGallery" onclick="setViewMode('gallery')">🖼️ Corpus Reference Gallery (45)</button>
    <button class="tab-btn" id="tabAnalytics" onclick="setViewMode('analytics')">🕸️ Graph & Analytics</button>
  </div>

  <!-- ========================================================================= -->
  <!-- RUN-SET IMAGE REFERENCES RIBBON (AT-A-GLANCE STRIP & 1-CLICK TIMELINE SEEK) -->
  <!-- ========================================================================= -->
  <section class="run-set-ref-strip" id="runSetRefStrip">
    <div class="ref-strip-header">
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div class="ref-strip-title">
          <span>🖼️ Run Set Image References</span>
          <span class="badge-count" id="refStripCount">19 Unique Profiles</span>
        </div>
        <button class="btn-collapse-ribbon" id="btnToggleRefStrip" onclick="toggleRefStrip()">
          🔼 Collapse Ribbon
        </button>
      </div>
      <div class="ref-strip-subtitle">
        Click any reference image card or timestamp pill to <strong>instantly jump the stage & kinetic typography</strong> to that exact moment.
      </div>
    </div>
    <div class="ref-cards-carousel" id="refCardsCarousel">
      <!-- Dynamically Populated by JavaScript -->
    </div>
  </section>

  <!-- ========================================================================= -->
  <!-- MAIN WORKSPACE: STAGE, INSPECTOR                                            -->
  <!-- ========================================================================= -->
  <div class="app-layout" id="mainAppLayout">
    
    <!-- STAGE WRAPPER -->
    <div class="stage-wrapper" id="stageWrapper">
      
      <div class="dual-player-row" id="dualPlayerRow">
        
        <!-- 9:16 KINETIC MOBILE VIEWPORT STAGE CONTAINER -->
        <div class="stage-container" id="stageContainer" onclick="nextChunk()">
          <div class="stage-notch"></div>
          <div class="stage-time-badge" id="stageTimeBadge">00:00</div>

          <!-- MediaPipe Observation Wireframe -->
          <div class="mediapipe-face-overlay" id="mediapipeFaceOverlay" style="opacity: 0;">
            <div class="mediapipe-bbox-label-red">MEDIAPIPE FACE BOX (SCALP: 14.79%)</div>
          </div>

          <!-- Background Semantic Asset (Z:10 behind coach / Z:25 flanked) -->
          <div class="semantic-bg-asset-layer" id="semanticBgAssetLayer"></div>

          <!-- Head Contact Kinetic Typography Stage (Zone A - Z:10 behind coach) -->
          <div class="head-kinetic-stage" id="familyHeadStage"></div>

          <!-- Static Matted Coach Cutout (Z:20) -->
          <img src="${speakerBase64}" class="speaker-matted-layer" id="speakerCutout" alt="Static Matted Coach">

          <!-- Subject-mask companion text (Z:30, reflowed around core word) -->
          <div class="subject-mask-companion-stage" id="subjectMaskCompanionStage"></div>

          <!-- Chest Kinetic Typography Stage (Zone B - Z:30 in front of coach) -->
          <div class="chest-kinetic-stage" id="familyChestStage"></div>

          <div class="swipe-gesture-hint">
            <span>👆 Tap stage or scrub timeline to trigger spoken spurts</span>
          </div>
        </div>

        <!-- DEPTH TUNING HUD (Zone A / Zone B Sandbox) -->
        <div class="test-depth-hud-bar" id="testModeDepthHud" style="display: flex;">
          <span style="color: #EC4899; font-weight: 800;">👤 Coach Depth Plane:</span>
          <button class="test-depth-hud-btn active" id="btnDepthBehindHead" onclick="setDepthOverride('behind_head')">👤 Zone A (Behind Coach Z:10)</button>
          <button class="test-depth-hud-btn" id="btnDepthChest" onclick="setDepthOverride('chest')">👕 Zone B (On Chest Z:30)</button>
          <button class="test-depth-hud-btn" onclick="adjustScalpOffset(-10)">⬆ -10px</button>
          <button class="test-depth-hud-btn" onclick="adjustScalpOffset(10)">⬇ +10px</button>
          <span id="lblScalpOffsetStatus" style="font-size: 10px; color: #94A3B8;">Offset: 0px</span>
        </div>

      </div>

      <!-- PLAYBACK & TIMELINE CONTROLS -->
      <div class="controls-bar">
        <button class="btn-secondary" onclick="prevChunk()">⏮ Prev</button>
        <button class="btn-secondary" id="btnPlay" onclick="togglePlay()" style="background: rgba(0, 240, 255, 0.2); border-color: var(--accent-cyan); color: #FFF;">▶ Play</button>
        <button class="btn-secondary" onclick="nextChunk()">⏭ Next</button>
        <button class="btn-secondary" id="soundToggleBtn" onclick="toggleSoundMute()" style="color: #10B981; border-color: #10B981;">🔊 SFX: ACTIVE</button>
        <span id="sfxTelemetryBadge" style="font-size: 11px; font-weight: 700; color: #00F0FF; background: rgba(0,240,255,0.1); border: 1px solid rgba(0,240,255,0.3); padding: 4px 8px; border-radius: 6px; transition: opacity 0.3s ease;">🔊 SFX: Initialized</span>
      </div>

      <div class="timeline-slider-wrap">
        <div class="timeline-slider-header">
          <span>Active Chunk: <strong id="lblActiveChunk">Chunk 1 of 20 • 00:00 — 00:02</strong></span>
          <span>Frame: <strong id="lblActiveFrame">#0</strong></span>
        </div>
        <input type="range" class="timeline-slider" id="timelineScrubber" min="0" max="19" value="0" step="1" oninput="jumpTo(parseInt(this.value, 10))">
      </div>

    </div>

    <!-- RIGHT INSPECTOR PANEL & SIDE-BY-SIDE CROSS COMPARISON -->
    <div class="inspector-panel" id="inspectorPanel">
      
      <!-- INSPECTOR DUAL-MODE HEADER SWITCHER -->
      <div class="inspector-header-bar">
        <div class="inspector-segmented-switcher">
          <button class="seg-tab-btn active" id="segBtnProvenance" onclick="setInspectorView('provenance')">
            <span>🔬 Provenance & Font Match</span>
          </button>
          <button class="seg-tab-btn" id="segBtnAnima" onclick="setInspectorView('anima')">
            <span>🧠 ANIMA Treatment Selector</span>
          </button>
          <button class="seg-tab-btn" id="segBtnSfx" onclick="setInspectorView('sfx')">
            <span>🔊 SFX Intelligence</span>
          </button>
        </div>
        <span class="spurt-badge" id="lblActiveTimestamp">00:00 — 00:02</span>
      </div>

      <!-- 20-CHUNK QUICK SWITCHER CHIPS -->
      <div class="chunk-chips-container" id="chunkPicker"></div>

      <!-- ========================================================================= -->
      <!-- VIEW 1: PROVENANCE & FONT SPECIFICATION                                   -->
      <!-- ========================================================================= -->
      <div class="inspector-view-container" id="viewInspectorProvenance">
        
        <!-- SIDE-BY-SIDE COMPARISON CARD -->
        <div class="cross-compare-card" id="crossCompareCard">
          <div class="compare-card-header">
            <span id="lblCompareTitle">image (39).png vs Live Web Hydration</span>
            <button class="btn-secondary" style="padding: 2px 8px; font-size: 10px;" onclick="enlargeReferenceImage()">🔍 Enlarge Image</button>
          </div>
          <div class="compare-stage-grid">
            <div class="compare-col col-ref">
              <span class="compare-col-label">Original Graphic Reference</span>
              <img id="refCompareImg" src="/font_pairs/image%20(39).png" alt="Reference Image" onclick="enlargeReferenceImage()">
            </div>
            <div class="compare-col">
              <span class="compare-col-label">Live Web Hydrated Specimen</span>
              <div class="live-specimen-box" id="liveSpecimenPreview"></div>
            </div>
          </div>
          <div class="fidelity-radar-bar">
            <div class="radar-item">
              <span class="radar-icon">✅</span>
              <span>Fonts: <strong id="radarFontsStatus">Resolved</strong></span>
            </div>
            <div class="radar-item">
              <span class="radar-icon">🎯</span>
              <span>Fidelity: <strong id="radarFidelityStatus">100% Match</strong></span>
            </div>
            <div class="radar-item">
              <span class="radar-icon">📐</span>
              <span>Plane: <strong id="radarPlaneStatus">Zone B (Z:30)</strong></span>
            </div>
            <div class="radar-item">
              <span class="radar-icon">🌓</span>
              <span>Contrast: <strong id="radarContrastStatus">WCAG AAA</strong></span>
            </div>
          </div>
        </div>

        <!-- METADATA READOUT CHIPS -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <div class="telemetry-chip" style="flex: 1;">
            <span>Assigned Profile: <strong id="lblActiveProfile">image (39).json</strong></span>
          </div>
          <div class="telemetry-chip" style="flex: 1;">
            <span>Mood: <strong id="lblActiveMood">Classic Editorial Didone</strong></span>
          </div>
        </div>

        <!-- SPECIFICATION SUB-TABS -->
        <div class="spec-tabs">
          <button class="spec-tab-btn active" id="tabSpecTable" onclick="showSpecTab('table')">📋 Font JSON Layers</button>
          <button class="spec-tab-btn" id="tabSpecJson" onclick="showSpecTab('json')">📜 Raw JSON Code</button>
          <button class="spec-tab-btn" id="tabSpecPlayground" onclick="showSpecTab('playground')">🧪 Custom Text Test</button>
        </div>

        <!-- VIEW 1A: LAYERS TABLE -->
        <div class="spec-table-wrap" id="viewSpecTable">
          <table class="spec-table">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Matched Font & Size</th>
                <th>Casing & Margin</th>
                <th>Motion Engine</th>
                <th>Plane</th>
              </tr>
            </thead>
            <tbody id="layersTableBody"></tbody>
          </table>
        </div>

        <!-- VIEW 1B: RAW JSON CODE -->
        <div class="raw-json-box" id="viewSpecJson" style="display: none;"></div>

        <!-- VIEW 1C: LIVE PLAYGROUND -->
        <div id="viewSpecPlayground" style="display: none; flex-direction: column; gap: 8px;">
          <input type="text" id="playgroundInput" placeholder="Type custom test phrase..." style="background: rgba(0,0,0,0.4); border: 1px solid var(--panel-border); border-radius: 8px; padding: 8px 12px; color: #FFF; font-size: 13px; outline: none;" oninput="updatePlaygroundSpecimen(this.value)">
          <div id="playgroundPreviewStage" style="padding: 16px; background: rgba(0,0,0,0.5); border-radius: 8px; min-height: 80px; display: flex; align-items: center; justify-content: center;"></div>
        </div>

      </div>

      <!-- ========================================================================= -->
      <!-- VIEW 2: ANIMA ANOMALY TREATMENT SELECTOR (COMPACT SWAP VIEW)              -->
      <!-- ========================================================================= -->
      <div class="inspector-view-container" id="viewInspectorAnima" style="display: none;">
        
        <div class="anima-selector-card">
          
          <!-- LIVE ACTIVE CHUNK ANOMALY CARD -->
          <div class="active-anomaly-signal-box">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="card-badge" id="anomalyActiveBadge" style="background:var(--accent-cyan); color:#000;">ANIMA #15</span>
              <span id="anomalyActiveConf" style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-emerald); font-weight: 800;">96% CONFIDENCE</span>
            </div>
            <div style="font-size: 15px; font-weight: 900; color: #fff; margin-top: 4px;" id="anomalyActiveName">Person / Character Asset</div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;" id="anomalyActiveReason">Human archetype role setup ('founders') with vintage Silicon Valley founders trio backdrop.</div>

            <div class="anomaly-layer-blueprint">
              <div><span style="color:var(--text-muted);">Z:10 Background Asset:</span> <strong id="anomalyZ10" style="color:#fff;">Vintage Tech Founders Trio Asset</strong></div>
              <div><span style="color:var(--text-muted);">Z:20 Scalp Clearance:</span> <strong style="color:#fff;">MediaPipe 14.79% Boundary</strong></div>
              <div><span style="color:var(--text-muted);">Z:30 Kinetic Engine:</span> <strong id="anomalyZ30" style="color:#38bdf8;">Senza Bella / Serif Subpixel Blur</strong></div>
              <div><span style="color:var(--text-muted);">3D Audio SFX Cue:</span> <strong id="anomalyAudio" style="color:#a855f7;">HUD Optical Ping (1400Hz)</strong></div>
              <div style="margin-top:4px; padding-top:4px; border-top:1px solid rgba(255,255,255,0.08);"><span style="color:var(--accent-cyan);">Asset Sourcing Workflow:</span> <span id="anomalyWorkflow" style="color:#cbd5e1; font-size:10px;">1. Entity token matched -> 2. Load vector asset -> 3. 60fps stroke render -> 4. Depth plane placement.</span></div>
            </div>
          </div>

          <!-- FULL 20-CHUNK SEQUENCE TREATMENT TABLE -->
          <div class="anomaly-matrix-title">
            <span>📋 Full 20-Chunk Sequence Treatment Plan</span>
            <span style="color:var(--accent-cyan); font-size:10px;">Click row to jump</span>
          </div>
          <div class="anomaly-table-wrap">
            <table class="spec-table" id="anomalyMatrixTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Spoken Spurt</th>
                  <th>Assigned Archetype</th>
                  <th>Layer Blueprint</th>
                  <th>Audio Cue</th>
                </tr>
              </thead>
              <tbody id="anomalyMatrixTbody">
                <!-- Dynamically populated by JS -->
              </tbody>
            </table>
          </div>

        </div>

      </div>

      <!-- ========================================================================= -->
      <!-- VIEW 3: DETERMINISTIC SFX INTELLIGENCE & 4-NEPHEW VARIANT CONSOLE          -->
      <!-- ========================================================================= -->
      <div class="inspector-view-container" id="viewInspectorSfx" style="display: none; flex-direction: column; gap: 12px;">
        
        <div class="anomaly-drawer-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; font-weight: 800; color: var(--accent-cyan);">🔊 ACTIVE CHUNK SOUND CUES</span>
            <span id="sfxActiveChunkLabel" style="font-size: 10px; font-family: monospace; color: var(--accent-yellow);">Chunk #1 • 2 Cues</span>
          </div>
          <div id="sfxActiveChunkCuesList" style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;"></div>
        </div>

        <div class="anomaly-matrix-title">
          <span>🎛️ Acoustic Family Matrix (4 Nephew Variants Each)</span>
          <span style="color: var(--accent-green); font-size: 10px;">Click variant to audition</span>
        </div>

        <div id="sfxFamilyGridContainer" style="display: flex; flex-direction: column; gap: 10px;"></div>

        <div class="anomaly-matrix-title" style="margin-top: 8px;">
          <span>📋 20-Chunk Causal Sound Timeline</span>
        </div>
        <div class="anomaly-table-wrap">
          <table class="spec-table" id="sfxTimelineTable">
            <thead>
              <tr>
                <th>Time</th>
                <th>Chunk</th>
                <th>Sound Label & Family</th>
                <th>Variant ID</th>
                <th>Spatial Pan</th>
                <th>Audition</th>
              </tr>
            </thead>
            <tbody id="sfxTimelineTbody"></tbody>
          </table>
        </div>

      </div>

    </div>

  </div>

  <!-- ========================================================================= -->
  <!-- MODE 2: CORPUS IMAGE REFERENCE & BENCHMARK GALLERY PANEL (ALL 45 PROFILES) -->
  <!-- ========================================================================= -->
  <section class="corpus-gallery-panel" id="corpusGalleryPanel">
    <div class="gallery-filter-bar">
      <div class="gallery-filter-chips">
        <button class="btn-secondary active" id="galFltAll" onclick="filterGallery('all')">All 45 Profiles</button>
        <button class="btn-secondary" id="galFltRunSet" onclick="filterGallery('runset')">⭐ Active in Current Run Set</button>
        <button class="btn-secondary" id="galFltMulti" onclick="filterGallery('multi')">🔥 Multi-Used (2x+)</button>
        <button class="btn-secondary" id="galFltUnused" onclick="filterGallery('unused')">💤 Unused in Current Run Set</button>
      </div>
      <input type="text" id="gallerySearchInput" placeholder="🔍 Search by image, font, mood..." style="background: rgba(0,0,0,0.3); border: 1px solid var(--panel-border); border-radius: 8px; padding: 6px 12px; color: #FFF; font-size: 12px; width: 220px; outline: none;" oninput="searchGallery(this.value)">
    </div>
    <div class="gallery-grid" id="galleryCardsGrid"></div>
  </section>

  <!-- ========================================================================= -->
  <!-- MODE 3: NETWORK GRAPH & ANALYTICS LAB PANEL                               -->
  <!-- ========================================================================= -->
  <section class="analytics-lab-panel" id="analyticsLabPanel">
    <div class="kpi-banner">
      <div class="kpi-card">
        <div class="kpi-label">Corpus Total Profiles</div>
        <div class="kpi-val" style="color: var(--accent-cyan);">45 Profiles</div>
        <div class="kpi-sub">Authoritative Font JSONs</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Active in Current Run</div>
        <div class="kpi-val" id="kpiActiveCount" style="color: var(--accent-green);">-- Unique</div>
        <div class="kpi-sub" id="kpiActiveRate">Current Seed Sequence</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Under-Utilized Profiles</div>
        <div class="kpi-val" id="kpiUnderCount" style="color: var(--accent-pink);">-- Profiles</div>
        <div class="kpi-sub">0 or 1 appearance in sequence</div>
      </div>
      <div class="kpi-card" style="cursor: pointer;" onclick="runMonteCarloSimulation(100)">
        <div class="kpi-label">100-Run Monte Carlo Simulation</div>
        <div class="kpi-val" id="kpiSimCoverage" style="color: var(--accent-yellow);">Ready (Click to Run)</div>
        <div class="kpi-sub">Simulate 100 random seeds</div>
      </div>
    </div>

    <div class="analytics-workspace-grid">
      <div class="graph-container-card">
        <div style="font-size: 13px; font-weight: 800; margin-bottom: 8px;">🕸️ Font Pairing & Profile Combination Network Graph</div>
        <div class="svg-graph-wrapper" id="svgGraphWrapper">
          <svg id="networkGraphSvg" viewBox="0 0 920 560"></svg>
        </div>
      </div>
      <div class="analytics-side-col">
        <div class="side-tab-bar">
          <button class="side-tab-btn active" id="sideTabRanking" onclick="switchSideTab('ranking')">📊 Utilization Ranking</button>
          <button class="side-tab-btn" id="sideTabSpecimen" onclick="switchSideTab('specimen')">🔬 Specimen</button>
        </div>
        <div class="ranking-list" id="rankingListContainer"></div>
      </div>
    </div>
  </section>

  <!-- IMAGE ENLARGE MODAL -->
  <div class="img-modal-overlay" id="imgModalOverlay" onclick="closeImageModal()">
    <div class="img-modal-card" onclick="event.stopPropagation()">
      <div class="img-modal-header">
        <span id="imgModalTitle" style="font-size: 14px; font-weight: 800; color: #FFF;">Reference Image Inspection</span>
        <button class="btn-secondary" onclick="closeImageModal()" style="padding: 4px 8px;">✕ Close</button>
      </div>
      <div class="img-modal-body">
        <img id="imgModalSrc" src="" alt="Enlarged Reference">
      </div>
    </div>
  </div>

  <script>
    // Embedded Mode Detection
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('embedded') === 'true' || urlParams.get('mode') === 'stage_only') {
      document.body.classList.add('is-embedded');
    }

    // 1. DATA INGESTION: ALL 45 AUTHORITATIVE FONT JSON PROFILES & MULTI-TRANSCRIPT REGISTRY
    const ALL_FONT_PROFILES = ${JSON.stringify(allFontProfiles)};
    const TECH_FOUNDERS_BASE64 = "${techFoundersTrioBase64}";
    const DYNAMIC_PERSON_PLAN = ${JSON.stringify(planDynamicPerson("The founder becomes the bottleneck for everything."))};
    const ALL_CHART_PRESETS = ${JSON.stringify(CHART_GRAPH_8_PRESETS)};
    const ALL_TRANSCRIPTS = ${JSON.stringify(ALL_TRANSCRIPTS)};
    const AUTHORITATIVE_SFX_FAMILIES = ${JSON.stringify(AUTHORITATIVE_SFX_FAMILIES)};
    const SFX_TAXONOMY_MANIFEST = ${JSON.stringify(SFX_TAXONOMY_MANIFEST)};
    let activeTranscriptKey = "script1";
    let RAW_CHUNKS = ALL_TRANSCRIPTS[activeTranscriptKey].chunks;

    // INVARIANT DOGMA ART STYLE CANDIDATES (Screenshots 1-8)
    const DOGMA_SCREENSHOTS_BASE64 = ${JSON.stringify(DOGMA_SCREENSHOTS_BASE64)};
    const EDISON_BULB_THRIVING = "${generateEdisonBulbSvg("thriving", 1.0)}";
    const EDISON_BULB_NEGATED = "${generateEdisonBulbSvg("negated_broken", 1.0)}";
    const COMBUSTION_FIRE_SVG = "${generateCombustionFireSvg(1.6)}";
    const MARBLE_PILLAR_SVG = "${generateMarbleColumnSvg("thriving")}";

    // AUTHORITATIVE BRAND & MICRO-ASSET VECTOR SUITE
    const EBAY_BADGE_SVG = "${generateEbayBadgeSvg()}";
    const AMAZON_BADGE_SVG = "${generateAmazonBadgeSvg()}";
    const ETSY_BADGE_SVG = "${generateEtsyBadgeSvg()}";
    const LINKEDIN_BADGE_SVG = "${generateLinkedInBadgeSvg()}";
    const INSTAGRAM_BADGE_SVG = "${generateInstagramBadgeSvg()}";
    const SHOPIFY_BADGE_SVG = "${generateShopifyBadgeSvg()}";
    const STRIPE_BADGE_SVG = "${generateStripeBadgeSvg()}";
    const PHYSICAL_BOX_SVG = "${generatePhysicalProductsBoxSvg()}";
    const SIX_FIGURES_PROFIT_SVG = "${generateSixFiguresProfitSvg()}";

    const BRAND_ASSET_REGISTRY = [
      {
        id: "brand_ebay",
        name: "eBay E-Commerce Marketplace Badge",
        regex: /(^|[^a-z])(ebay(\.com)?|e2a)([^a-z]|$)/i,
        imageUrl: EBAY_BADGE_SVG,
        position: "right_shoulder",
        widthPx: 120,
        microAnimationClass: "micro-anim-hologram-laser-scan",
        audioCue: "HUD Optical Ping & Mechanical Ratchet Click (Z:10, 1400Hz)"
      },
      {
        id: "brand_amazon",
        name: "Amazon E-Commerce & Prime Badge",
        regex: /(^|[^a-z])(amazon(\.com)?|fba|prime)([^a-z]|$)/i,
        imageUrl: AMAZON_BADGE_SVG,
        position: "left_shoulder",
        widthPx: 120,
        microAnimationClass: "micro-anim-specular-glow-pulse",
        audioCue: "HUD Optical Ping (Z:10, 1400Hz)"
      },
      {
        id: "brand_etsy",
        name: "Etsy Artisan Marketplace Badge",
        regex: /(^|[^a-z])(etsy(\.com)?|handmade)([^a-z]|$)/i,
        imageUrl: ETSY_BADGE_SVG,
        position: "right_shoulder",
        widthPx: 200,
        microAnimationClass: "micro-anim-elastic-badge-pop",
        audioCue: "Avatar Pop Acoustic Resonance (Z:20, 6500Hz)"
      },
      {
        id: "brand_linkedin",
        name: "LinkedIn Professional Network Badge",
        regex: /(^|[^a-z])(linkedin(\.com)?)([^a-z]|$)/i,
        imageUrl: LINKEDIN_BADGE_SVG,
        position: "left_shoulder",
        widthPx: 200,
        microAnimationClass: "micro-anim-elastic-badge-pop",
        audioCue: "HUD Optical Scan Ping (Z:10, 1400Hz)"
      },
      {
        id: "brand_instagram",
        name: "Instagram Meta Platform Badge",
        regex: /(^|[^a-z])(instagram(\.com)?|ig)([^a-z]|$)/i,
        imageUrl: INSTAGRAM_BADGE_SVG,
        position: "right_shoulder",
        widthPx: 200,
        microAnimationClass: "micro-anim-specular-glow-pulse",
        audioCue: "HUD Optical Ping (Z:10, 1400Hz)"
      },
      {
        id: "brand_shopify",
        name: "Shopify Merchant Commerce Badge",
        regex: /(^|[^a-z])(shopify(\.com)?)([^a-z]|$)/i,
        imageUrl: SHOPIFY_BADGE_SVG,
        position: "left_shoulder",
        widthPx: 200,
        microAnimationClass: "micro-anim-stroke-draw-reveal",
        audioCue: "HUD Optical Ping (Z:10, 1400Hz)"
      },
      {
        id: "brand_stripe",
        name: "Stripe Global Payments Badge",
        regex: /(^|[^a-z])(stripe(\.com)?)([^a-z]|$)/i,
        imageUrl: STRIPE_BADGE_SVG,
        position: "right_shoulder",
        widthPx: 200,
        microAnimationClass: "micro-anim-elastic-badge-pop",
        audioCue: "HUD Optical Ping (Z:10, 1400Hz)"
      }
    ];

    function resolveClientBrandOrPhysicalAsset(text) {
      for (const item of BRAND_ASSET_REGISTRY) {
        if (item.regex.test(text)) {
          return item;
        }
      }
      return null;
    }

    const DOGMA_IDEA_ASSETS = [
      {
        id: "bespoke_idea_stoic_monument",
        name: "Classical Stoic Philosopher Pondering Glowing Monument (Dogma Style #02)",
        imageUrl: "${ideaStoicMonumentBase64}",
        negatedImageUrl: "${ideaStoicMonumentBase64}",
        position: "left_shoulder",
        widthPx: 240,
        baseWeight: 3.5
      },
      {
        id: "bespoke_idea_engraved_synapse",
        name: "Anatomical Copperplate Synaptic Luminous Brain (Dogma Style #03)",
        imageUrl: "${ideaEngravedSynapseBase64}",
        negatedImageUrl: "${ideaEngravedSynapseBase64}",
        position: "right_shoulder",
        widthPx: 230,
        baseWeight: 3.2
      },
      {
        id: "bespoke_idea_vintage_halftone",
        name: "Vintage Halftone Lithograph Palm & Brain Bulb (Dogma Style #01)",
        imageUrl: "${ideaVintageHalftoneBase64}",
        negatedImageUrl: "${ideaVintageHalftoneBase64}",
        position: "right_shoulder",
        widthPx: 225,
        baseWeight: 2.9
      },
      {
        id: "concept_edison_bulb",
        name: "Vintage Incandescent Edison Bulb (Breakthrough Filament)",
        imageUrl: EDISON_BULB_THRIVING,
        negatedImageUrl: EDISON_BULB_NEGATED,
        position: "right_shoulder",
        widthPx: 210,
        baseWeight: 2.0
      }
    ];

    const DOGMA_FOUNDER_ASSETS = [
      {
        id: "bespoke_founder_arcane_executive",
        name: "Stylized Polygonal Founder Executive (Dogma Style #06)",
        imageUrl: "${founderArcaneExecutiveBase64}",
        position: "behind_head",
        widthPx: 240,
        baseWeight: 3.5
      },
      {
        id: "bespoke_founder_impasto_oil",
        name: "Impasto Palette-Knife Visionary Founder (Dogma Style #05)",
        imageUrl: "${founderImpastoOilBase64}",
        position: "behind_head",
        widthPx: 235,
        baseWeight: 3.2
      },
      {
        id: "bespoke_founder_duotone_noir",
        name: "Duotone Crimson Graphic Noir Leader & Skyline (Dogma Style #07)",
        imageUrl: "${founderDuotoneNoirBase64}",
        position: "behind_head",
        widthPx: 235,
        baseWeight: 3.0
      }
    ];

    function extractAndBridgeConcept(chunkText, surrounding, isNegated, usageHistory = {}, rng = Math.random) {
      const currentLower = chunkText.toLowerCase();
      const contextLower = (chunkText + " " + (surrounding || "")).toLowerCase();

      // 1. IDEA CLUSTER WITH VARIETY SELECTOR
      if (/(^|[^a-z])(idea|ideas|genius|insight|brainstorm|concept|thesis|clarity|philosophy|discovery)([^a-z]|$)/i.test(currentLower)) {
        const scored = DOGMA_IDEA_ASSETS.map(c => {
          const usage = usageHistory[c.id] || 0;
          const penalty = Math.pow(0.12, usage);
          return { candidate: c, weight: c.baseWeight * penalty * (0.85 + rng() * 0.3) };
        });
        const totalW = scored.reduce((sum, s) => sum + s.weight, 0);
        let r = rng() * totalW;
        let selected = scored[0].candidate;
        for (const s of scored) {
          if (r <= s.weight) { selected = s.candidate; break; }
          r -= s.weight;
        }
        usageHistory[selected.id] = (usageHistory[selected.id] || 0) + 1;
        const img = isNegated ? (selected.negatedImageUrl || selected.imageUrl) : selected.imageUrl;
        return {
          matchedCandidate: {
            id: selected.id,
            name: selected.name,
            defaultPosition: selected.position,
            renderWidthPx: selected.widthPx
          },
          confidenceScore: 0.98,
          renderedSvgUri: img
        };
      }

      // 2. FOUNDER / LEADER CLUSTER WITH VARIETY SELECTOR
      if (/(^|[^a-z])(founder|founders|ceo|leader|executive|boss|creator|entrepreneur)([^a-z]|$)/i.test(currentLower)) {
        const scored = DOGMA_FOUNDER_ASSETS.map(c => {
          const usage = usageHistory[c.id] || 0;
          const penalty = Math.pow(0.12, usage);
          return { candidate: c, weight: c.baseWeight * penalty * (0.85 + rng() * 0.3) };
        });
        const totalW = scored.reduce((sum, s) => sum + s.weight, 0);
        let r = rng() * totalW;
        let selected = scored[0].candidate;
        for (const s of scored) {
          if (r <= s.weight) { selected = s.candidate; break; }
          r -= s.weight;
        }
        usageHistory[selected.id] = (usageHistory[selected.id] || 0) + 1;
        return {
          matchedCandidate: {
            id: selected.id,
            name: selected.name,
            defaultPosition: selected.position,
            renderWidthPx: selected.widthPx
          },
          confidenceScore: 0.97,
          renderedSvgUri: selected.imageUrl
        };
      }

      // 3. ANGER / PASSION / BURNOUT
      if (/(^|[^a-z])(anger|angry|furious|passion|burnout|burning|fire|heat|rage|intense|fury|flame)([^a-z]|$)/i.test(currentLower)) {
        return {
          matchedCandidate: {
            id: "concept_combustion_fire",
            name: "Combustion Fire & Thermal Flare (Anger / Passion / Burnout)",
            defaultPosition: "behind_head",
            renderWidthPx: 220
          },
          confidenceScore: 0.97,
          renderedSvgUri: COMBUSTION_FIRE_SVG
        };
      }

      // 4. DISCIPLINE / RESILIENCE / ARCHITECTURE / SYSTEM
      if (/(^|[^a-z])(discipline|resilience|foundation|structure|operating system|system|unshakeable|principles|bedrock|conviction)([^a-z]|$)/i.test(currentLower)) {
        return {
          matchedCandidate: {
            id: "concept_marble_pillar",
            name: "Classical Ionic Marble Column (Discipline / Resilience / Foundation)",
            defaultPosition: "left_shoulder",
            renderWidthPx: 200
          },
          confidenceScore: 0.94,
          renderedSvgUri: MARBLE_PILLAR_SVG
        };
      }

      return null;
    }

        // Parent-Window Message Bridge for Transcript & Playback Sync
    
    // Unmute Web Audio on first user gesture
    window.addEventListener("click", () => {
      getOrCreateAudioContext();
    }, { once: true });

    window.addEventListener("message", (event) => {
      if (!event.data) return;
      if (event.data.type === "SWITCH_COACH" && event.data.mode) {
        switchCoachCutout(event.data.mode);
      } else if (event.data.type === "SWITCH_SPEAKER" && event.data.mode) {
        switchCoachCutout(event.data.mode);
      } else if (event.data.type === "SWITCH_TRANSCRIPT" && event.data.key) {
        switchTranscript(event.data.key);
      } else if (event.data.type === "SEEK_CHUNK" && typeof event.data.index === "number") {
        seekVideoAndJumpChunk(event.data.index);
      } else if (event.data.type === "TOGGLE_PLAY") {
        isPlaying = !isPlaying;
        applyPlaybackPauseState();
      } else if (event.data.type === "PLAY") {
        isPlaying = true;
        applyPlaybackPauseState();
      } else if (event.data.type === "PAUSE") {
        isPlaying = false;
        applyPlaybackPauseState();
      } else if (event.data.type === "PREV_CHUNK") {
        prevChunk();
        notifyParentPlaybackState();
      } else if (event.data.type === "NEXT_CHUNK") {
        nextChunk();
        notifyParentPlaybackState();
      } else if (event.data.type === "SET_AUDIO" && typeof event.data.muted === "boolean") {
        isSoundMuted = event.data.muted;
        const audioBtn = document.getElementById("btnAudioMode");
        if (audioBtn) audioBtn.innerText = isSoundMuted ? "🔇 SFX: MUTED" : "🔊 SFX: ACTIVE";
      } else if (event.data.type === "UNMUTE") {
        isSoundMuted = false;
        const audioBtn = document.getElementById("btnAudioMode");
        if (audioBtn) audioBtn.innerText = "🔊 SFX: ACTIVE";
      }
    });

    function notifyParentPlaybackState() {
      if (window.parent && window.parent !== window) {
        const c = compiledSequence ? compiledSequence[currentIndex] : null;
        window.parent.postMessage({
          type: "PLAYBACK_STATE",
          isPlaying: isPlaying,
          currentChunkIdx: currentIndex,
          timestamp: c ? c.timestamp : "00:00 — 00:02",
          text: c ? c.text : ""
        }, "*");
      }
    }

    const COACH_CUTOUTS = {
      male: "${speakerMaleBase64}",
      laptop: "${speakerLaptopBase64}",
      akimbo: "${speakerAkimboBase64}"
    };

    let currentCoachMode = "male";

    function switchCoachCutout(mode) {
      currentCoachMode = mode;
      const speakerCutout = document.getElementById("speakerCutout");
      const scalpEl = document.getElementById("lblScalpBaseline");
      const selEl = document.getElementById("selSpeakerCutout");
      const faceLabel = document.querySelector(".mediapipe-bbox-label-red");
      if (selEl) selEl.value = mode;

      if (speakerCutout && COACH_CUTOUTS[mode]) {
        speakerCutout.src = COACH_CUTOUTS[mode];
      }

      if (mode === "laptop" || mode === "akimbo") {
        if (scalpEl) scalpEl.innerText = "11.30%";
        if (faceLabel) faceLabel.innerText = "MEDIAPIPE FACE BOX (SCALP: 11.30%)";
      } else {
        if (scalpEl) scalpEl.innerText = "14.79%";
        if (faceLabel) faceLabel.innerText = "MEDIAPIPE FACE BOX (SCALP: 14.79%)";
      }
      seekVideoAndJumpChunk(currentIndex);
    }

    function switchTranscript(key) {
      if (!ALL_TRANSCRIPTS[key]) return;
      activeTranscriptKey = key;
      RAW_CHUNKS = ALL_TRANSCRIPTS[key].chunks;
      compiledSequence = compileDynamicSequence(currentSeed);
      if (typeof renderRunSetImageReferenceRibbon === "function") renderRunSetImageReferenceRibbon();
      if (typeof renderSfxIntelligenceTab === "function") renderSfxIntelligenceTab();
      if (typeof renderCorpusGallery === "function") renderCorpusGallery();
      seekVideoAndJumpChunk(0);
      console.log("[STUDIO] Switched transcript to:", ALL_TRANSCRIPTS[key].title);
    }

    // Create lookup map by filename & profile_name
    const PROFILE_MAP = {};
    ALL_FONT_PROFILES.forEach(p => {
      if (p._filename) PROFILE_MAP[p._filename] = p;
      if (p.profile_name) PROFILE_MAP[p.profile_name] = p;
    });

    // 2. KINETIC PRESET REPERTOIRE (Authoritative Motion Engines)
    // TALL_FONT_BEHIND_PRINCIPAL_SPEAKER: these condensed profiles are a depth
    // treatment, never ordinary foreground captions. The compiler routes them to
    // the matted speaker's occluded plane and restricts them to their five treatments.
    const TALL_FONT_TREATMENT_IDS = [
      "skyhigh_liquid_chrome_wave",
      "staggered_letter_overlap_tilt",
      "glassmorphic_caustic_refract",
      "vibe_chromatic_luminescence_pulse",
      "skywall_monolithic_steel_rise"
    ];
    const TALL_FONT_PROFILE_PATTERN = /bebas|anton|oswald|sixcaps|six caps|teko|antonio|big shoulders|league gothic|saira extra condensed|pathway extreme/i;
    // Tall-font depth text is a clean monolithic cinematic element behind the principal
    // speaker: it receives NO decorative kinetic "treatment" (no chrome/glass/glitch/overlap).
    // Decorative treatments remain a Zone B (foreground companion) concept only.
    const TALL_MONOLITH_REVEAL = "monolith_clean_seal";
    function isTallFontProfile(profile) {
      // AUTHORITATIVE tall-font signal: the Prometheus Yuan Font JSON corpus marks every
      // intended tall-font profile (policy §10.8) with metadata.is_tall_font === true.
      // This is the generalizable, policy-level signal — it covers all 7 authoritative tall
      // families, including Harmony_UltraTall_Didone_Serif (elegant / high-tech Didone serif),
      // which a hardcoded font-name regex previously could not reach. Using the corpus flag
      // means any tall-font profile added later is recognized without new hardcoded names.
      if (profile && profile.metadata && profile.metadata.is_tall_font === true) return true;
      // Backward-compatible fallback: legacy condensed/display font-family heuristic for
      // profiles that predate the authoritative flag. Preserves existing behavior for
      // typography that does not require tall-font treatment.
      return TALL_FONT_PROFILE_PATTERN.test(JSON.stringify(profile || {}));
    }

    // CORE_TEXT_HERO_OVERRIDES_FONT_JSON: a subject-mask treatment owns only one
    // semantically important phrase. The rest of the source profile remains a
    // companion composition rather than being moved wholesale behind the speaker.
    const CORE_TEXT_HERO_OVERRIDES_FONT_JSON = true;

    // Linguistic Stopwords & Functional Particles that cannot be dominant focal words
    const LINGUISTIC_FUNCTIONAL_PARTICLES = new Set([
      "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "by", "for",
      "with", "about", "against", "between", "into", "through", "during", "before", "after",
      "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under",
      "again", "further", "once", "here", "there", "all", "any", "both", "each", "few",
      "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same",
      "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now",
      "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my",
      "your", "his", "its", "our", "their", "this", "that", "these", "those", "am", "is",
      "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do",
      "does", "did", "doing", "yet", "without", "every"
    ]);

    // High-impact lexical semantic terms & inflection indicators
    const CORE_SUBJECT_TERMS = /\b(products?|physical|hire|hired|convinced|convince|biggest|mistake|high[ -]?tech|freedom|bottleneck|scale|growth|system|systems|foundation|foundations|strategy|strategies|blurry|hitesh|revenue|profit|framework|execution|ceiling|broke|broken|cash|pricing|selling)\b/i;

    /**
     * Policy-driven semantic dominance & inflection analyzer.
     * Evaluates linguistic salience, metric emphasis, and syntactic role to identify
     * the dominant hero punch phrase across any 40s sequence.
     */
    function selectCorePhraseForSubjectMask(raw, words) {
      if (!words || words.length === 0) return null;
      const normalized = words.map(word => String(word).replace(/^[^a-z0-9$]+|[^a-z0-9]+$/gi, ''));
      const fullText = normalized.join(' ');
      if (!fullText.trim()) return null;

      // 1. Evaluate whether this chunk warrants a tall-font depth treatment
      const hasMetric = Boolean(raw.metricValue || /[\$€£0-9]/.test(fullText));
      const hasInflectionEmphasis = (
        raw.emphasis === 'inflection_tension' ||
        raw.emphasis === 'inflection_solution' ||
        raw.emphasis === 'named_entity_founders' ||
        raw.emphasis === 'terminal_payoff'
      );
      const hasCoreLexicalTerm = CORE_SUBJECT_TERMS.test(fullText);
      const isConcisePunchy = normalized.length <= 4 && normalized.some(w => !LINGUISTIC_FUNCTIONAL_PARTICLES.has(w.toLowerCase()) && w.length >= 4);

      const isEligible = hasMetric || hasInflectionEmphasis || hasCoreLexicalTerm || isConcisePunchy;
      if (!isEligible) return null;

      // 2. Score each word by linguistic salience
      const salienceScores = normalized.map((word, idx) => {
        const lower = word.toLowerCase();
        let score = 1.0;
        if (LINGUISTIC_FUNCTIONAL_PARTICLES.has(lower)) {
          score = 0.1;
        } else {
          score += Math.min(word.length * 0.4, 3.0); // Substantive word length bonus
          if (/^[\$0-9]/.test(word)) score += 4.0; // Metric bonus
          if (CORE_SUBJECT_TERMS.test(word)) score += 5.0; // Thematic core term bonus
          if (/[A-Z]/.test(words[idx])) score += 1.5; // Capitalization bonus
        }
        return { index: idx, word, score };
      });

      // 3. Find optimal 1–3 word focal phrase window with highest salience density
      let bestWindow = { start: 0, end: 1, score: -1 };
      for (let len = 1; len <= Math.min(3, normalized.length); len++) {
        for (let start = 0; start <= normalized.length - len; start++) {
          const end = start + len;
          const windowScores = salienceScores.slice(start, end);
          const totalScore = windowScores.reduce((sum, s) => sum + s.score, 0);
          const hasSubstantive = windowScores.some(s => s.score >= 2.0);
          if (hasSubstantive && totalScore > bestWindow.score) {
            bestWindow = { start, end, score: totalScore };
          }
        }
      }

      // Check if preceding token is an adjective/modifier (e.g. "physical", "biggest", "high", "not", "would", "shot")
      let finalStart = bestWindow.start;
      if (finalStart > 0) {
        const prevWord = normalized[finalStart - 1].toLowerCase();
        if (/^(physical|high|biggest|not|would|shot)$/i.test(prevWord) && bestWindow.end - (finalStart - 1) <= 3) {
          finalStart = finalStart - 1;
        }
      }

      const coreWords = normalized.slice(finalStart, bestWindow.end).filter(Boolean);
      if (!coreWords.length) return null;

      // ZONE A RULE: the behind-speaker monolith is the SINGLE most-salient word of the
      // dominant window — NEVER a multi-word phrase. Multi-word phrases overrun the 9x6
      // portrait frame (the single-word width guarantee is enforced by the width clamp in
      // calculateTallHeroFontSize). All non-hero words of the dominant window reflow
      // forward into Zone B as companions.
      let heroWordIndex = finalStart;
      let heroBestScore = -1;
      for (let idx = finalStart; idx < bestWindow.end; idx++) {
        if (salienceScores[idx].score > heroBestScore) {
          heroBestScore = salienceScores[idx].score;
          heroWordIndex = idx;
        }
      }
      const heroWord = { text: normalized[heroWordIndex], index: heroWordIndex };

      const reason = raw.metricValue ? 'metric_semantic_noun' : raw.emphasis || 'lexical_semantic_noun';

      return {
        text: coreWords.join(' '),
        heroWord: heroWord,
        wordIndexes: Array.from({ length: bestWindow.end - finalStart }, (_, offset) => finalStart + offset),
        reason: reason,
        startIndex: finalStart,
        endIndex: bestWindow.end,
        totalWords: normalized.length
      };
    }

    /**
     * Adaptive mood-based Tall Font Profile selector.
     * Matches semantic intent to the 7 authoritative tall font JSON profiles.
     */
    function selectTallFontProfile(profiles, seed, chunkIdx, emphasisMood) {
      const candidates = profiles.filter(isTallFontProfile);
      if (!candidates.length) return null;

      const mood = String(emphasisMood || '').toLowerCase();
      let preferred = [];

      if (mood.includes('tension') || mood.includes('mistake') || mood.includes('breaking') || mood.includes('bottleneck')) {
        preferred = candidates.filter(p => /industrial|brutalist|exarch|humane|anton|teko/i.test(p.profile_name || ''));
      } else if (mood.includes('fashion') || mood.includes('harmony') || mood.includes('elegant') || mood.includes('founder') || mood.includes('solution')) {
        preferred = candidates.filter(p => /didone|harmony|bodoni|serif/i.test(p.profile_name || ''));
      } else if (mood.includes('growth') || mood.includes('scale') || mood.includes('metric') || mood.includes('pill')) {
        preferred = candidates.filter(p => /growth|pill|community|bebas|oswald/i.test(p.profile_name || ''));
      } else if (mood.includes('tech') || mood.includes('system') || mood.includes('skywall')) {
        preferred = candidates.filter(p => /skywall|metallic|hairline|terrance|saira/i.test(p.profile_name || ''));
      }

      const pool = preferred.length > 0 ? preferred : candidates;
      return pool[Math.abs(seed + chunkIdx * 17) % pool.length];
    }

    /**
     * Dynamic Companion Reflow Engine.
     * Analyzes companion word distribution around the dominant core phrase to establish
     * an intentional cinematic composition (split-diagonal, top-satellite, flanked lateral).
     */
    function reflowCompanionLayersAroundSubjectMask(words, coreDecision, seed, chunkIdx) {
      // Only the single Zone A hero word sits behind the principal speaker. Every other
      // token — including the non-hero words of the dominant phrase — reflows forward
      // into Zone B (in front of subject) as a companion.
      const consumed = new Set(coreDecision.heroWord ? [coreDecision.heroWord.index] : coreDecision.wordIndexes);
      const splitIndex = coreDecision.heroWord ? coreDecision.heroWord.index : coreDecision.startIndex;
      const prefixWords = [];
      const suffixWords = [];
      const companionWords = [];

      words.forEach((word, idx) => {
        if (!consumed.has(idx)) {
          companionWords.push(word);
          if (idx < splitIndex) {
            prefixWords.push(word);
          } else {
            suffixWords.push(word);
          }
        }
      });

      let companionAnchor = 'upper-left';
      let compositionMode = 'stacked';

      if (prefixWords.length > 0 && suffixWords.length > 0) {
        // Visual Reference #1: "Not CONVINCED yet" (Split diagonal framing)
        companionAnchor = 'split-diagonal';
        compositionMode = 'split-diagonal';
      } else if (prefixWords.length > 0 && suffixWords.length === 0) {
        // Visual Reference #3 & #5: "This is Hitesh", "Shot it Blurry" (Top-satellite / header)
        companionAnchor = (seed + chunkIdx) % 2 === 0 ? 'top-satellite' : 'upper-left';
        compositionMode = 'top-satellite';
      } else if (prefixWords.length === 0 && suffixWords.length > 0) {
        // Lateral flanking or lower-right payoff
        companionAnchor = (seed + chunkIdx) % 2 === 0 ? 'flanked-right' : 'lower-right';
        compositionMode = 'flanked-lateral';
      } else {
        // Visual Reference #2 & #4: "WOULD YOU HIRE", "biggest mistake" (Monolithic stack)
        companionAnchor = 'monolithic-stack';
        compositionMode = 'monolithic-stack';
      }

      return {
        companionWords,
        prefixWords,
        suffixWords,
        companionAnchor,
        compositionMode
      };
    }

    const KINETIC_PRESETS = [
      { id: "subpixel_blur_mask", name: "Soft Subpixel Blur Rise" },
      { id: "defocus_rack_focus", name: "Defocus Aperture Snap" },
      { id: "staggered_rotate_x", name: "3D Perspective Stagger Cascade" },
      { id: "keynote_punch", name: "Keynote Focal Scale Punch" },
      { id: "slot_bounce", name: "Kinetic Slot Machine Bounce" },
      { id: "acid_lime_letter_glitch", name: "Cyber Acid Lime Matrix Glitch (TYPO #30)" },
      { id: "chromatic_character_displace", name: "RGB Chromatic Split Glitch" },
      { id: "top_down_character_drop", name: "Kinetic Top-Down Glyph Drop" },
      { id: "typewriter_mono_caret", name: "Hexta Terminal Typewriter + Caret" },
      { id: "viewport_mask_sweep", name: "Cinematic Viewport Mask Sweep" },
      { id: "staggered_glyph_slot", name: "Motion Primitive Skeletal Glyphs Slot" },
      { id: "spring_character_cascade", name: "Dynamic Staggered Craft Cascade 44" },
      { id: "glow_search_input_caret", name: "Glow Search Input & Parsing Caret" },
      { id: "skyhigh_liquid_chrome_wave", name: "Skyhigh Liquid Chrome Wave (Cotton.js Warp)" },
      { id: "staggered_letter_overlap_tilt", name: "Cinematic Overlapping 3D Letter Tilt (CANVA Stagger)" },
      { id: "glassmorphic_caustic_refract", name: "3D Caustic Glassmorphic Letterforms (Glass Refraction)" },
      { id: "vibe_chromatic_luminescence_pulse", name: "Vibe Ethereal Luminescence & Chromatic Shudder" },
      { id: "skywall_monolithic_steel_rise", name: "Skywall Monolithic Steel Hydraulic Rise" },
      { id: "monolith_clean_seal", name: "Tall-Font Clean Monolith Seal (Zone A, No Treatment)" }
    ];

    
    // =========================================================================
    // 🧪 DUAL-MODE STUDIO ENGINE (PRODUCTION LIVE VIDEO VS TEST MATTING SANDBOX)
    // =========================================================================
    let currentStudioMode = "production";
    let testModeDepthOverride = "behind_head"; // "behind_head" | "chest"
    let testModeScalpOffsetY = 0;

    function setDepthOverride(depth) {
      testModeDepthOverride = depth;
      const btnBehind = document.getElementById("btnDepthBehindHead");
      const btnChest = document.getElementById("btnDepthChest");
      if (btnBehind) btnBehind.classList.toggle("active", depth === "behind_head");
      if (btnChest) btnChest.classList.toggle("active", depth === "chest");
      renderPresentationChunk(currentIndex);
    }

    function adjustScalpOffset(deltaPx) {
      testModeScalpOffsetY += deltaPx;
      const headStage = document.getElementById("familyHeadStage");
      if (headStage) {
        headStage.style.transform = "translateX(-50%) translateY(" + testModeScalpOffsetY + "px)";
      }
      const lbl = document.getElementById("lblScalpOffsetStatus");
      if (lbl) lbl.innerText = "Offset: " + (testModeScalpOffsetY > 0 ? "+" : "") + testModeScalpOffsetY + "px";
    }


    let currentSeed = 101;
    let compiledSequence = [];
    let currentCausalSoundManifest = [];
    let currentIndex = 0;
    let isPlaying = true;
    let showBbox = false;
    let playTimer = null;
    let isLoopingSpurt = false;
    let currentAudioMode = 'sfx'; // 'sfx' | 'vocals' | 'mute'
    let currentViewMode = 'presentation';

    // =========================================================================
    // 🔊 CAUSAL SPATIO-TEMPORAL WEB AUDIO SYNTHESIZER ENGINE (0 LATENCY)
    // =========================================================================
    let audioCtx = null;
    let isSoundMuted = false;
    let masterGainNode = null;

    function getOrCreateAudioContext() {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
          masterGainNode = audioCtx.createGain();
          masterGainNode.gain.value = 0.65;
          masterGainNode.connect(audioCtx.destination);
        }
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      return audioCtx;
    }

    function toggleSoundMute() {
      isSoundMuted = !isSoundMuted;
      const btn = document.getElementById("soundToggleBtn");
      if (btn) {
        btn.innerText = isSoundMuted ? "🔇 SFX: MUTED" : "🔊 SFX: ACTIVE";
        btn.style.color = isSoundMuted ? "#FF4D4D" : "#10B981";
      }
    }

        function playNotificationDing(targetTime) {
      if (!audioCtx) return;
      const now = targetTime || audioCtx.currentTime;
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      const gain2 = audioCtx.createGain();
      
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(2093, now); // C7 crystal bell fundamental
      
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(4186, now); // 2nd harmonic sparkle
      
      gain1.gain.setValueAtTime(0.28, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      
      gain2.gain.setValueAtTime(0.08, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      
      osc1.start(now);
      osc1.stop(now + 0.7);
      osc2.start(now);
      osc2.stop(now + 0.3);
    }

    function playCausalSynthesizedCue(cue) {
      if (isSoundMuted) return;
      const ctx = getOrCreateAudioContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;
        const p = cue.synthParams || {};
        const isClickFamily = (cue.familyKey === "text_click_family") || (cue.variantId && cue.variantId.startsWith("mouse_click"));
        const targetGain = (cue.gain || p.baseGain || 0.35) * (isSoundMuted ? 0 : 1);

        if (isClickFamily) {
          // 🖱️ 100% AUTHENTIC MECHANICAL MICRO-SWITCH MOUSE CLICK TRANSIENT (ZERO OSCILLATOR BLOOP TONES)
          const sampleRate = ctx.sampleRate;
          const clickDuration = Math.min(0.03, cue.durationSec || 0.024);
          const bufferSize = Math.floor(sampleRate * clickDuration);
          const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
          const data = buffer.getChannelData(0);

          const cutoff = p.filterCutoffHz || 3800;
          const qVal = p.filterQ || 2.4;

          // Pure tactile micro-switch impulse profile
          for (let i = 0; i < bufferSize; i++) {
            const decay = Math.exp(-i / (sampleRate * 0.003));
            data[i] = ((Math.random() * 2 - 1) * 0.9 + (i < 6 ? 1.0 : 0)) * decay;
          }

          const noiseSource = ctx.createBufferSource();
          noiseSource.buffer = buffer;

          const hpFilter = ctx.createBiquadFilter();
          hpFilter.type = "highpass";
          hpFilter.frequency.setValueAtTime(cutoff, now);
          hpFilter.Q.setValueAtTime(qVal, now);

          const peakFilter = ctx.createBiquadFilter();
          peakFilter.type = "peaking";
          peakFilter.frequency.setValueAtTime(cutoff * 1.35, now);
          peakFilter.gain.setValueAtTime(6.0, now);
          peakFilter.Q.setValueAtTime(3.0, now);

          const clickGain = ctx.createGain();
          clickGain.gain.setValueAtTime(targetGain * 0.9, now);
          clickGain.gain.exponentialRampToValueAtTime(0.0001, now + clickDuration);

          noiseSource.connect(hpFilter);
          hpFilter.connect(peakFilter);
          peakFilter.connect(clickGain);

          if (ctx.createStereoPanner && typeof cue.spatialPan === "number") {
            const panner = ctx.createStereoPanner();
            panner.pan.setValueAtTime(cue.spatialPan, now);
            clickGain.connect(panner);
            panner.connect(masterGainNode || ctx.destination);
          } else {
            clickGain.connect(masterGainNode || ctx.destination);
          }

          noiseSource.start(now);
          noiseSource.stop(now + clickDuration + 0.01);

          // Micro-rebound second click (14ms later, simulates spring release)
          const relDuration = 0.008;
          const relSize = Math.floor(sampleRate * relDuration);
          const relBuffer = ctx.createBuffer(1, relSize, sampleRate);
          const relData = relBuffer.getChannelData(0);
          for (let i = 0; i < relSize; i++) {
            relData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.0015));
          }
          const relSource = ctx.createBufferSource();
          relSource.buffer = relBuffer;
          const relGain = ctx.createGain();
          relGain.gain.setValueAtTime(targetGain * 0.35, now + 0.014);
          relGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014 + relDuration);

          relSource.connect(hpFilter);
          relSource.start(now + 0.014);
          relSource.stop(now + 0.014 + relDuration + 0.01);
        } else {
          // Clean Filtered Air Noise & Subtle Transients (Zero 440Hz Sine Pitch Drops)
          const sampleRate = ctx.sampleRate;
          const dur = Math.min(0.6, cue.durationSec || 0.35);
          const bufSize = Math.floor(sampleRate * dur);
          const buffer = ctx.createBuffer(1, bufSize, sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufSize; i++) {
            const progress = i / bufSize;
            const env = Math.sin(progress * Math.PI);
            data[i] = (Math.random() * 2 - 1) * env * 0.75;
          }
          const noiseSource = ctx.createBufferSource();
          noiseSource.buffer = buffer;
          const filter = ctx.createBiquadFilter();
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(850, now);
          filter.frequency.exponentialRampToValueAtTime(1450, now + dur * 0.5);
          filter.frequency.exponentialRampToValueAtTime(450, now + dur);
          filter.Q.setValueAtTime(1.8, now);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(targetGain * 0.45, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
          noiseSource.connect(filter);
          filter.connect(gain);
          gain.connect(masterGainNode || ctx.destination);
          noiseSource.start(now);
          noiseSource.stop(now + dur + 0.02);
          return;

          filter.type = p.filterType || "lowpass";
          filter.frequency.setValueAtTime(cue.lowpassCutoffHz || p.filterCutoffHz || 16000, now);
          filter.Q.setValueAtTime(p.filterQ || 1.0, now);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(targetGain, now + (p.attackSec || 0.01));
          gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetGain * (p.sustainLevel || 0.1)), now + (p.decaySec || 0.1));
          gain.gain.exponentialRampToValueAtTime(0.0001, now + (cue.durationSec || 0.3));

          osc.connect(filter);

          if (p.noiseBurst) {
            const bufferSize = Math.floor(ctx.sampleRate * Math.min(0.06, cue.durationSec || 0.05));
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              output[i] = Math.random() * 2 - 1;
            }
            const whiteNoise = ctx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(targetGain * 0.45, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + (p.decaySec || 0.03));
            whiteNoise.connect(filter);
            whiteNoise.start(now);
            whiteNoise.stop(now + 0.07);
          }

          if (ctx.createStereoPanner && typeof cue.spatialPan === "number") {
            const panner = ctx.createStereoPanner();
            panner.pan.setValueAtTime(cue.spatialPan, now);
            filter.connect(panner);
            panner.connect(gain);
          } else {
            filter.connect(gain);
          }

          gain.connect(masterGainNode || ctx.destination);
          osc.start(now);
          osc.stop(now + (cue.durationSec || 0.3) + 0.05);
        }

        const sfxBadge = document.getElementById("sfxTelemetryBadge");
        if (sfxBadge) {
          sfxBadge.innerText = "🔊 SFX: " + (cue.label || cue.name || "Cue");
          sfxBadge.style.opacity = "1";
          setTimeout(() => { if (sfxBadge) sfxBadge.style.opacity = "0.7"; }, 600);
        }
      } catch (e) {
        console.warn("[SFX_SYNTH_WARN]", e);
      }
    }

    function auditionPreset(familyKey, variantIndex) {
      const family = AUTHORITATIVE_SFX_FAMILIES[familyKey];
      if (!family || !family.variants[variantIndex]) return;
      const variant = family.variants[variantIndex];
      playCausalSynthesizedCue({
        id: "audition_" + variant.variantId,
        chunkIndex: currentIndex + 1,
        timeSec: 0,
        durationSec: variant.durationSec,
        familyKey: familyKey,
        variantId: variant.variantId,
        variantIndex: variant.variantIndex,
        label: variant.name,
        triggerReason: "User Interactive Audition",
        spatialPan: 0.0,
        depthPlane: 30,
        lowpassCutoffHz: variant.filterCutoffHz,
        gain: variant.baseGain,
        synthParams: {
          oscType: variant.oscType,
          startFreqHz: variant.startFreqHz,
          endFreqHz: variant.endFreqHz,
          attackSec: variant.attackSec,
          decaySec: variant.decaySec,
          sustainLevel: variant.sustainLevel,
          releaseSec: variant.releaseSec,
          noiseBurst: variant.noiseBurst,
          filterType: variant.filterType,
          filterCutoffHz: variant.filterCutoffHz,
          filterQ: variant.filterQ
        }
      });
    }

    // Synchronized Video Players
    const syncVideo = document.getElementById('syncVideoPlayer');
    const stageVideoBg = document.getElementById('stageVideoBg');

    // Seeded PRNG (Mulberry32)
    function mulberry32(a) {
      return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }
    }

    // Canonical Google WebFonts & High-Fashion DaFont Family Resolver
    function resolveCanonicalGoogleFontFamily(rawName) {
      if (!rawName) return 'DM Sans';
      const lower = rawName.toLowerCase();
      if (lower.includes('senza bella') || lower.includes('senza') || lower.includes('silver hairline') || lower.includes('silver hairpoint')) return 'Senza Bella';
      if (lower.includes('abril fatface')) return 'Abril Fatface';
      if (lower.includes('alex brush')) return 'Alex Brush';
      if (lower.includes('anton')) return 'Anton';
      if (lower.includes('antonio')) return 'Antonio';
      if (lower.includes('bebas')) return 'Bebas Neue';
      if (lower.includes('big shoulders')) return 'Big Shoulders Display';
      if (lower.includes('bodoni') || lower.includes('didot')) return 'Bodoni Moda';
      if (lower.includes('caveat')) return 'Caveat';
      if (lower.includes('cinzel decorative')) return 'Cinzel Decorative';
      if (lower.includes('cinzel')) return 'Cinzel';
      if (lower.includes('cormorant')) return 'Cormorant Garamond';
      if (lower.includes('courier')) return 'Courier Prime';
      if (lower.includes('dancing')) return 'Dancing Script';
      if (lower.includes('dm serif')) return 'DM Serif Display';
      if (lower.includes('dm sans')) return 'DM Sans';
      if (lower.includes('great vibes')) return 'Great Vibes';
      if (lower.includes('inter')) return 'Inter';
      if (lower.includes('italiana')) return 'Italiana';
      if (lower.includes('kalam')) return 'Kalam';
      if (lower.includes('lora')) return 'Lora';
      if (lower.includes('montserrat')) return 'Montserrat';
      if (lower.includes('open sans')) return 'Open Sans';
      if (lower.includes('oswald')) return 'Oswald';
      if (lower.includes('outfit')) return 'Outfit';
      if (lower.includes('pathway')) return 'Pathway Extreme';
      if (lower.includes('pinyon')) return 'Pinyon Script';
      if (lower.includes('playfair')) return 'Playfair Display';
      if (lower.includes('press start')) return 'Press Start 2P';
      if (lower.includes('roboto slab')) return 'Roboto Slab';
      if (lower.includes('roboto')) return 'Roboto';
      if (lower.includes('romanesco')) return 'Romanesco';
      if (lower.includes('rozha')) return 'Rozha One';
      if (lower.includes('sacramento')) return 'Sacramento';
      if (lower.includes('saira')) return 'Saira Extra Condensed';
      if (lower.includes('sanchez')) return 'Sanchez';
      if (lower.includes('six caps')) return 'Six Caps';
      if (lower.includes('space mono')) return 'Space Mono';
      if (lower.includes('special elite')) return 'Special Elite';
      if (lower.includes('syne')) return 'Syne';
      if (lower.includes('teko')) return 'Teko';
      if (lower.includes('vt323')) return 'VT323';
      return 'DM Sans';
    }

    // Relative Luminance for Contrast Calculation
    function getRelativeLuminance(hex) {
      if (!hex || hex === 'transparent') return 0;
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      if (hex.length !== 6) return 0;
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    }

    // Anti-Blend High-Contrast Color Guard: Brighten any dark neutrals to guarantee 100% legibility on dark video canvas
    function resolveFaithfulFontJsonColor(colorHex) {
      if (!colorHex || colorHex === 'transparent') return '#FFFFFF';
      const lum = getRelativeLuminance(colorHex);
      // If luminance is below 0.38 (dark gray, charcoal, dark navy), upgrade to crisp luminous white
      if (lum < 0.38) {
        return '#FFFFFF';
      }
      return colorHex;
    }

    // Authoritative Casing Realization
    function applyFontJsonCasing(text, casing) {
      if (!casing || casing === 'normal') return text;
      if (casing === 'lowercase') return text.toLowerCase();
      if (casing === 'uppercase') return text.toUpperCase();
      if (casing === 'title_case' || casing === 'capitalize') {
        return text.replace(/(^|\\s)([^\\s])/gu, (_, p, c) => p + c.toUpperCase());
      }
      return text;
    }

    // Mathematical Safe Font Sizing (Zero Syllable Breaking & Zero Clipping Invariant)
    function calculateSafeContainedFontSize(text, idealFontSize, maxAllowedWidthPx = 200, fontName = 'sans', casing = 'normal', letterSpacingEm = 0, isNowrapOrSingleLine = false) {
      const isUpper = (casing === 'uppercase' || text === text.toUpperCase());
      let charFactor = isUpper ? 0.65 : 0.50;
      
      if (fontName.includes('Bebas') || fontName.includes('Anton') || fontName.includes('Oswald') || fontName.includes('Senza')) {
        charFactor = isUpper ? 0.46 : 0.38;
      } else if (fontName.includes('Great Vibes') || fontName.includes('Dancing') || fontName.includes('Sacramento')) {
        charFactor = isUpper ? 0.58 : 0.48;
      } else if (fontName.includes('Playfair') || fontName.includes('Bodoni') || fontName.includes('Cinzel') || fontName.includes('Cormorant') || fontName.includes('DM Serif') || fontName.includes('Abril')) {
        charFactor = isUpper ? 0.68 : 0.54;
      }

      const effectiveCharRatio = charFactor + (letterSpacingEm || 0);
      const words = text.split(' ').filter(w => w.length > 0);
      let maxWordLen = 0;
      words.forEach(w => { if (w.length > maxWordLen) maxWordLen = w.length; });
      
      let candidateSize = idealFontSize;

      // 1. Ensure the longest single word fits within bounds
      const maxWordWidth = maxWordLen * candidateSize * effectiveCharRatio;
      if (maxWordWidth > (maxAllowedWidthPx * 0.85)) {
        candidateSize = Math.floor((maxAllowedWidthPx * 0.85) / (maxWordLen * effectiveCharRatio));
      }

      // 2. If single word or single-line nowrap container (or short multi-word phrase on one line)
      if (words.length === 1 || isNowrapOrSingleLine) {
        const estimatedWidth = text.length * candidateSize * effectiveCharRatio;
        if (estimatedWidth > (maxAllowedWidthPx * 0.88)) {
          candidateSize = Math.floor((maxAllowedWidthPx * 0.88) / (text.length * effectiveCharRatio));
        }
      } else if (words.length >= 2) {
        const totalLineEstimatedWidth = text.length * candidateSize * effectiveCharRatio;
        if (words.length <= 3 && totalLineEstimatedWidth > (maxAllowedWidthPx * 1.5)) {
          candidateSize = Math.floor((maxAllowedWidthPx * 1.5) / (text.length * effectiveCharRatio));
        }
      }

      return Math.max(14, candidateSize);
    }

    /**
     * Tall-font hero sizer for the behind-principal-speaker (Zone A / Z:10) monolith.
     * Unlike ordinary contained captions, tall text is sized against the HEAD-STAGE VERTICAL
     * extent so its glyph height dominates the frame — orders of magnitude taller than the
     * foreground companion layers (~24-48px). The value is only clamped by the available
     * width so a single-line condensed monolith still fits, and it never collapses back down
     * to ordinary caption scale (hard floor keeps it visually tall).
     */
        function calculateTallHeroFontSize(text, fontName) {
      const upper = String(text || '').toUpperCase().trim();
      if (!upper) return 120;
      let charFactor = 0.46; // condensed tall grotesk/display (Bebas/Anton/Oswald/condensed)
      if (/playfair|bodoni|didone|cinzel|cormorant|serif/i.test(fontName)) charFactor = 0.55;
      const stageHeight = 675; // ~9:16 portrait stage
      const maxWidthBudget = 360; // FRAME-WIDTH CEILING (stage is clamp(320,350,380) wide; 360 leaves a gutter). No hero word may ever exceed this — guarantees no 9x16 overflow.
      const stageTarget = Math.floor(stageHeight * 0.62); // ≈ 418px vertical-dominance goal ("orders of magnitude" tall)

      // Zone A monolith is always a SINGLE word, so the longest-word width is the gate.
      const compressed = upper.replace(/\s+/g, '');
      const longestWord = compressed.length || 1;

      // Horizontal safety clamp: the hero word must never render wider than the frame.
      // This is the guard that previously broke for long monoliths like "BOTTLENECK"
      // (where the 150px floor overrode the width clamp and caused frame overflow).
      const widthFit = Math.floor(maxWidthBudget / (longestWord * charFactor));

      // Vertical dominance aims for 62% of stage height, but never exceeds the width budget.
      let size = Math.min(stageTarget, widthFit);

      // The floor may never exceed the width-safe ceiling. Long words (e.g. BOTTLENECK) have
      // widthFit < 90, so the floor MUST defer to the width clamp — this is the guarantee
      // that no tall monolith ever overflows the 360px frame interior, while short hero
      // words still reach full vertical dominance (up to ~418px).
      const floor = Math.min(90, widthFit);
      return Math.max(floor, size);
    }

    // Word Allocation to Layers
    function allocateWordsToLayers(profileLayers, tokenCount) {
      if (!profileLayers || profileLayers.length === 0) return [];
      const activeLayers = tokenCount >= profileLayers.length 
        ? [...profileLayers] 
        : profileLayers.slice(0, tokenCount);

      const observedTotal = activeLayers.reduce((sum, l) => sum + (l.word_count || 1), 0);
      const ideals = activeLayers.map(l => (tokenCount * (l.word_count || 1)) / observedTotal);
      const counts = ideals.map(ideal => Math.max(1, Math.floor(ideal)));

      while (counts.reduce((sum, c) => sum + c, 0) < tokenCount) {
        let maxDeficit = -999;
        let maxIdx = 0;
        counts.forEach((c, idx) => {
          const deficit = ideals[idx] - c;
          if (deficit > maxDeficit) { maxDeficit = deficit; maxIdx = idx; }
        });
        counts[maxIdx] += 1;
      }

      while (counts.reduce((sum, c) => sum + c, 0) > tokenCount) {
        let maxRemovable = -999;
        let maxIdx = 0;
        counts.forEach((c, idx) => {
          if (c > 1) {
            const removable = c - ideals[idx];
            if (removable > maxRemovable) { maxRemovable = removable; maxIdx = idx; }
          }
        });
        counts[maxIdx] -= 1;
      }

      return activeLayers.map((layer, idx) => ({
        layer: layer,
        wordCount: counts[idx] || 1
      }));
    }

    // 3. SEQUENCE COMPILER EXECUTING 100% FAITHFUL FONT JSON INVARIANTS
    function compileDynamicSequence(seed) {
      const rng = mulberry32(seed);
      let lastProfileName = "";
      let lastCardIndex = -10;
      let lastHeroPreset = "";
      let lastSubjectMaskChunk = -99;
      
      const presetUsageHistory = {};
      KINETIC_PRESETS.forEach(p => { presetUsageHistory[p.id] = 0; });

      function getDispositionToWearinessPenalty(presetId) {
        const count = presetUsageHistory[presetId] || 0;
        if (presetId === "typewriter_mono_caret" || presetId === "glow_search_input_caret") {
          const totalTypewriterUses = (presetUsageHistory["typewriter_mono_caret"] || 0) + (presetUsageHistory["glow_search_input_caret"] || 0);
          if (totalTypewriterUses >= 1) return 0;
          return 1.0;
        }
        if (presetId === "acid_lime_letter_glitch" || presetId === "chromatic_character_displace") {
          if (count >= 2) return 0;
          if (count === 1) return 0.2;
          return 1.0;
        }
        if (count >= 3) return 0.15;
        if (count >= 2) return 0.45;
        if (count >= 1) return 0.85;
        return 1.0;
      }

      const lastConceptTriggerChunk = {};

      const compiled = RAW_CHUNKS.map((raw, chunkIdx) => {
        let words = raw.text.trim().split(' ').filter(w => w.length > 0);
        if (raw.metricValue) {
          if (raw.metricPrefix === "$" && raw.metricValue === 50000) {
            words = ["$50,000", "a month"];
          } else if (raw.metricValue === 70) {
            words = ["70 HOURS", "every week."];
          } else if (raw.metricValue === 100) {
            words = ["100", "IDEAS"];
          } else if (raw.metricValue === 12000) {
            words = ["12,000", "physical products"];
          } else {
            const formatted = (raw.metricPrefix || "") + raw.metricValue.toLocaleString() + (raw.metricSuffix || "");
            const otherWords = raw.text.replace(new RegExp(String(raw.metricValue) + '|[0-9,]+', 'g'), '').trim().split(' ').filter(w => w.length > 0);
            words = [formatted, ...otherWords];
          }
        }
        const wordCount = words.length;
        const totalChars = raw.text.length;
        const selectedCorePhrase = selectCorePhraseForSubjectMask(raw, words);
        const coreSubjectDecision = selectedCorePhrase && (chunkIdx - lastSubjectMaskChunk >= 3)
          ? selectedCorePhrase : null;
        if (coreSubjectDecision) lastSubjectMaskChunk = chunkIdx;
        const companionLayout = coreSubjectDecision
          ? reflowCompanionLayersAroundSubjectMask(words, coreSubjectDecision, seed, chunkIdx) : null;
        const companionWords = companionLayout ? companionLayout.companionWords : words;
        const companionWordCount = Math.max(1, companionWords.length);

        let profile = null;
        if (seed === 101 && raw.preferredProfile && PROFILE_MAP[raw.preferredProfile]) {
          profile = PROFILE_MAP[raw.preferredProfile];
        } else {
          let candidates = ALL_FONT_PROFILES.filter(p => {
            if (p.profile_name === lastProfileName) return false;
            if (isTallFontProfile(p)) return false;
            const pWords = p.metadata?.total_word_count || p.typography_layers?.length || 2;
            const isCompoundProfile = (p.profile_name.includes("Portfolio") || p.profile_name.includes("Unearth") || p.profile_name.includes("Drop_Cap"));
            if (wordCount >= 2 && isCompoundProfile) return false;
            if (wordCount <= 2 && pWords >= 5) return false;
            return Math.abs(pWords - wordCount) <= (wordCount >= 4 ? 1 : 0);
          });
          if (candidates.length === 0) {
            candidates = ALL_FONT_PROFILES.filter(p => {
              const isCompoundProfile = (p.profile_name.includes("Portfolio") || p.profile_name.includes("Unearth") || p.profile_name.includes("Drop_Cap"));
              return !isTallFontProfile(p) && (wordCount >= 2 ? !isCompoundProfile : true);
            });
          }
          profile = candidates[Math.floor(rng() * candidates.length)] || ALL_FONT_PROFILES[0];
        }
        lastProfileName = profile.profile_name;
        const tallFontSubjectTreatment = !!coreSubjectDecision;
        const tallCoreProfile = tallFontSubjectTreatment ? selectTallFontProfile(ALL_FONT_PROFILES, seed, chunkIdx, raw.emphasis || spurtTone) : null;

        const isInlineCompound = (wordCount === 1 && (profile.profile_name.includes("Portfolio") || profile.profile_name.includes("Unearth") || profile.profile_name.includes("Drop_Cap")));
        const layerAllocations = allocateWordsToLayers(profile.typography_layers, companionWordCount);
        let wordOffset = 0;
        let prevLayerFontSize = 0;

        let willUseDelayedCard = false;
        let cardColor = "#FFE600";
        if ((raw.emphasis === "inflection_tension" || raw.emphasis === "inflection_solution") && 
            (chunkIdx - lastCardIndex >= 4) && (seed === 101 ? (raw.emphasis === "inflection_tension") : (rng() > 0.35))) {
          willUseDelayedCard = true;
          cardColor = (raw.emphasis === "inflection_tension") ? "#FFE600" : "#C084FC";
          lastCardIndex = chunkIdx;
        }

        let heroLayerIdx = coreSubjectDecision ? -1 : layerAllocations.findIndex(a => a.layer.role === "primary_focus_word");
        if (heroLayerIdx === -1) heroLayerIdx = layerAllocations.findIndex(a => a.layer.role === "header");
        if (heroLayerIdx === -1) heroLayerIdx = 0;

        let heroFxPreset = "keynote_punch";
        if (seed === 101) {
          if (chunkIdx === 0) heroFxPreset = "defocus_rack_focus";
          else if (chunkIdx === 1) heroFxPreset = "keynote_punch";
          else if (chunkIdx === 2) heroFxPreset = "viewport_mask_sweep";
          else if (chunkIdx === 3) heroFxPreset = "keynote_punch";
          else if (chunkIdx === 4) heroFxPreset = "spring_character_cascade";
          else if (chunkIdx === 5) heroFxPreset = "slot_bounce";
          else if (chunkIdx === 6) heroFxPreset = "keynote_punch";
          else if (chunkIdx === 7) heroFxPreset = "spring_character_cascade";
          else if (chunkIdx === 8) heroFxPreset = "chromatic_character_displace";
          else if (chunkIdx === 9) heroFxPreset = "acid_lime_letter_glitch";
          else if (chunkIdx === 10) heroFxPreset = "defocus_rack_focus";
          else if (chunkIdx === 11) heroFxPreset = "staggered_rotate_x";
          else if (chunkIdx === 12) heroFxPreset = "top_down_character_drop";
          else if (chunkIdx === 13) heroFxPreset = "viewport_mask_sweep";
          else if (chunkIdx === 14) heroFxPreset = "keynote_punch";
          else if (chunkIdx === 15) heroFxPreset = "defocus_rack_focus";
          else if (chunkIdx === 16) heroFxPreset = "spring_character_cascade";
          else if (chunkIdx === 17) heroFxPreset = "staggered_glyph_slot";
          else if (chunkIdx === 18) heroFxPreset = "typewriter_mono_caret";
          else heroFxPreset = "keynote_punch";
        } else {
          let candidates = KINETIC_PRESETS.filter(p => {
            if (TALL_FONT_TREATMENT_IDS.includes(p.id) && !tallFontSubjectTreatment) return false;
            if (p.id === "subpixel_blur_mask") return false;
            if (p.id === lastHeroPreset) return false;
            return getDispositionToWearinessPenalty(p.id) > 0;
          });
          heroFxPreset = candidates[Math.floor(rng() * candidates.length)]?.id || "keynote_punch";
        }

        // The behind-speaker monolith receives NO decorative treatment (TALL_MONOLITH_REVEAL).
        // Foreground companions keep normal hero presets; the tall decorative IDs are not forced.
        presetUsageHistory[heroFxPreset] = (presetUsageHistory[heroFxPreset] || 0) + 1;
        lastHeroPreset = heroFxPreset;

        let renderedLayers = [];

        if (coreSubjectDecision && companionLayout?.compositionMode === 'split-diagonal' && companionLayout.prefixWords?.length > 0 && companionLayout.suffixWords?.length > 0) {
          // Visual Reference #1: "Not CONVINCED yet" (Diagonal framing around dominant text)
          renderedLayers = [
            {
              layerName: 'companion_prefix',
              role: 'companion_prefix',
              layoutLine: 1,
              rawText: companionLayout.prefixWords.join(' '),
              text: companionLayout.prefixWords.join(' '),
              fontFamily: 'Bodoni Moda',
              fontWeight: 600,
              fontStyle: 'italic',
              fontSizePx: 28,
              color: '#FFFFFF',
              casing: 'normal',
              letterSpacingEm: 0.02,
              lineHeight: 1.0,
              marginTopPx: 0,
              dropShadow: { x_offset: 0, y_offset: 2, blur_radius: 12, color: 'rgba(0,0,0,0.95)' },
              fxPreset: 'subpixel_blur_mask',
              extraClass: 'companion-prefix'
            },
            {
              layerName: 'companion_suffix',
              role: 'companion_suffix',
              layoutLine: 2,
              rawText: companionLayout.suffixWords.join(' '),
              text: companionLayout.suffixWords.join(' '),
              fontFamily: 'Bodoni Moda',
              fontWeight: 600,
              fontStyle: 'italic',
              fontSizePx: 28,
              color: '#FFFFFF',
              casing: 'normal',
              letterSpacingEm: 0.02,
              lineHeight: 1.0,
              marginTopPx: 0,
              dropShadow: { x_offset: 0, y_offset: 2, blur_radius: 12, color: 'rgba(0,0,0,0.95)' },
              fxPreset: 'subpixel_blur_mask',
              extraClass: 'companion-suffix'
            }
          ];
        } else if (coreSubjectDecision && companionLayout?.compositionMode === 'top-satellite' && companionLayout.prefixWords?.length > 0) {
          // Visual Reference #3 & #5: "This is Hitesh", "Shot it Blurry" (Satellite header above dominant text)
          renderedLayers = [
            {
              layerName: 'companion_satellite',
              role: 'companion_satellite',
              layoutLine: 1,
              rawText: companionLayout.prefixWords.join(' '),
              text: companionLayout.prefixWords.join(' '),
              fontFamily: (seed + chunkIdx) % 2 === 0 ? 'Caveat' : 'Playfair Display',
              fontWeight: 700,
              fontStyle: (seed + chunkIdx) % 2 === 0 ? 'normal' : 'italic',
              fontSizePx: 32,
              color: '#F8FAFC',
              casing: 'normal',
              letterSpacingEm: 0.03,
              lineHeight: 1.0,
              marginTopPx: 0,
              dropShadow: { x_offset: 0, y_offset: 2, blur_radius: 10, color: 'rgba(0,0,0,0.9)' },
              fxPreset: 'subpixel_blur_mask',
              extraClass: 'companion-satellite'
            }
          ];
        } else {
          renderedLayers = layerAllocations.map((alloc, layerIdx) => {
            const lSpec = alloc.layer;
            const assignedWords = companionWords.slice(wordOffset, wordOffset + alloc.wordCount).join(' ');
            wordOffset += alloc.wordCount;
            if (!assignedWords) return null;

            const fStyle = lSpec.font_style || {};
            const fEffects = lSpec.effects || {};
            
            const matchedFamily = (lSpec.matched_font_candidates && lSpec.matched_font_candidates[0]) 
              ? lSpec.matched_font_candidates[0] 
              : "DM Sans";

            const baseSize = fStyle.size_px_base || 44;
            const isHero = (layerIdx === heroLayerIdx);
            const isCardTarget = willUseDelayedCard && isHero;
            const isNowrapPreset = (heroFxPreset === 'staggered_glyph_slot' || heroFxPreset === 'viewport_mask_sweep' || heroFxPreset === 'glow_search_input_caret' || isCardTarget);

            const textWithCasing = applyFontJsonCasing(assignedWords, fStyle.casing);
            const maxAllowedWidth = isCardTarget ? 170 : 220;
            const safeFontSize = calculateSafeContainedFontSize(textWithCasing, baseSize, maxAllowedWidth, matchedFamily, fStyle.casing, fStyle.letter_spacing_em, isNowrapPreset);

            let rawMarginTop = fStyle.vertical_margin_top_px || 0;
            let safeMarginTop = Math.max(0, rawMarginTop);
            prevLayerFontSize = safeFontSize;

            let resolvedColor = resolveFaithfulFontJsonColor(fStyle.color);
            const fxPreset = isHero ? heroFxPreset : "subpixel_blur_mask";

            const layerObj = {
              layerName: lSpec.layer_name || ("layer_" + layerIdx),
              role: lSpec.role || "header",
              layoutLine: lSpec.layout_line || (layerIdx + 1),
              doubleUnderline: !!(fEffects && fEffects.double_underline),
              sketchCircle: !!(fEffects && (fEffects.sketch_circle_loop || fEffects.pencil_circle || fEffects.sketch_circle)),
              rawText: assignedWords,
              text: textWithCasing,
              fontFamily: matchedFamily,
              fontWeight: fStyle.weight || 700,
              fontStyle: fStyle.style || "normal",
              fontSizePx: safeFontSize,
              color: resolvedColor,
              casing: fStyle.casing || "normal",
              letterSpacingEm: fStyle.letter_spacing_em || 0,
              lineHeight: fStyle.line_height || 1.05,
              marginTopPx: safeMarginTop,
              dropShadow: fEffects.drop_shadow || { x_offset: 0, y_offset: 2, blur_radius: 12, color: "rgba(0,0,0,0.9)" },
              fxPreset: fxPreset
            };

            if (raw.metricValue && layerIdx === 0) {
              layerObj.numericCounter = {
                targetValue: raw.metricValue,
                prefix: raw.metricPrefix || "",
                suffix: raw.metricSuffix || "",
                durationMs: 850
              };
            }

            if (isCardTarget && !layerObj.numericCounter) {
              layerObj.delayedPillCard = cardColor;
            }

            return layerObj;
          });
        }

        renderedLayers = renderedLayers.filter(Boolean);
        if (coreSubjectDecision) {
          const coreSpec = tallCoreProfile?.typography_layers?.[0] || {};
          const coreStyle = coreSpec.font_style || {};
          const coreFamily = (coreSpec.matched_font_candidates && coreSpec.matched_font_candidates[0]) || 'Bebas Neue';
          const tallHeroText = coreSubjectDecision.heroWord ? coreSubjectDecision.heroWord.text : coreSubjectDecision.text;
          const coreText = applyFontJsonCasing(tallHeroText, 'uppercase');
          const coreFontSize = calculateTallHeroFontSize(tallHeroText, coreFamily);
          renderedLayers.unshift({
            layerName: 'subject_mask_core_text', role: 'subject_mask_core_text', layoutLine: 0,
            rawText: tallHeroText, text: coreText, fontFamily: coreFamily,
            fontWeight: coreStyle.weight || 800, fontStyle: 'normal', fontSizePx: coreFontSize,
            color: resolveFaithfulFontJsonColor(coreStyle.color || '#FFFFFF'), casing: 'uppercase',
            letterSpacingEm: 0.01, lineHeight: 0.9, marginTopPx: 0,
            dropShadow: { x_offset: 0, y_offset: 6, blur_radius: 24, color: 'rgba(0,0,0,0.98)' },
            fxPreset: TALL_MONOLITH_REVEAL,
            isCoreSubjectText: true, fontJsonOverridden: CORE_TEXT_HERO_OVERRIDES_FONT_JSON
          });
        }

        // ZONE GATING: only TRUE TALL-FONT text is permitted behind the principal speaker
        // (Zone A / Z:10). A tall profile is always applied when tallFontSubjectTreatment is
        // true, so this gate excludes ordinary typography — even short phrases — from the
        // behind-speaker plane. Zone B (Z:30) carries everything else in front.
        const isHeadZone = !!(tallFontSubjectTreatment);
        const depthPlane = isHeadZone ? "behind_subject" : "in_front_of_subject";

        let backgroundAsset = null;
        const chunkText = raw.text;
        const surrounding = RAW_CHUNKS.slice(Math.max(0, chunkIdx - 2), Math.min(RAW_CHUNKS.length, chunkIdx + 3)).map(c => c.text).join(' ');
        const hasBottleneck = /\b(problem|bottleneck|breaking|break|stuck|trap|expensive|can't|cannot|nothing|fails?|ceiling)\b/i.test(chunkText + ' ' + surrounding);
        const spurtTone = hasBottleneck ? "tension_bottleneck" : (/\b(scale|grow|growth|multiply|results|exponential|10x|scalable)\b/i.test(chunkText) ? "optimistic_scale" : "neutral_execution");

        const METAPHOR_CLUSTERS = {
          growth: [
            // ANIMA #04 Authoritative Master Vector Trajectory Presets (Live DOM Components)
            { id: "anima_chart_01_bullish_uptrend", name: "ANIMA #04 (CHART #01 Exponential Bullish Parabolic Uptrend: 50k->70k->80만)", tone: ["optimistic_scale", "tension_bottleneck", "pure_metric"], baseWeight: 10.0, renderMode: "dom_component", htmlMarkup: ALL_CHART_PRESETS[0] ? ALL_CHART_PRESETS[0].html : "", svg: "${ascendingGrowthChartBase64}", position: "right_shoulder", widthPx: 320, animaPresetId: 1 },
            { id: "anima_chart_05_bearish_selloff", name: "ANIMA #04 (CHART #05 Bearish Selloff Crash Grid: -68.4% Drawdown / Bottleneck Plateau)", tone: ["tension_bottleneck"], baseWeight: 1.5, renderMode: "dom_component", htmlMarkup: ALL_CHART_PRESETS[4] ? ALL_CHART_PRESETS[4].html : "", svg: "${bottleneckPlateauChartBase64}", position: "right_shoulder", widthPx: 320, animaPresetId: 5 },
            { id: "anima_chart_07_emerald_mountain", name: "ANIMA #04 (CHART #07 High-Voltage Neon Emerald Bullish Mountain)", tone: ["optimistic_scale"], baseWeight: 1.4, renderMode: "dom_component", htmlMarkup: ALL_CHART_PRESETS[6] ? ALL_CHART_PRESETS[6].html : "", svg: "${ascendingGrowthChartBase64}", position: "right_shoulder", widthPx: 320, animaPresetId: 7 },
            { id: "anima_chart_03_telemetry_laser", name: "ANIMA #04 (CHART #03 Neon Telemetry Laser Spline: 783 kwh Apex)", tone: ["tension_bottleneck", "pure_metric"], baseWeight: 1.2, renderMode: "dom_component", htmlMarkup: ALL_CHART_PRESETS[2] ? ALL_CHART_PRESETS[2].html : "", svg: "${bottleneckPlateauChartBase64}", position: "right_shoulder", widthPx: 320, animaPresetId: 3 },
            { id: "growth_sprout_organic", name: "Botanical Sprout & Leaf Unfurl Metaphor", tone: ["optimistic_scale"], baseWeight: 0.3, renderMode: "image", svg: "${organicSproutBase64}", position: "left_shoulder", widthPx: 180 },
            { id: "growth_momentum_trajectory", name: "Parabolic Momentum Vector Trajectory", tone: ["optimistic_scale", "pure_metric"], baseWeight: 0.3, renderMode: "image", svg: "${momentumTrajectoryBase64}", position: "right_shoulder", widthPx: 195 },
            { id: "growth_modular_stack", name: "Isometric Expanding Modular Stack", tone: ["optimistic_scale", "tension_bottleneck"], baseWeight: 0.2, renderMode: "image", svg: "${modularStackingBlocksBase64}", position: "left_shoulder", widthPx: 185 }
          ],
          breaking: [
            { id: "breaking_fracture_nodes", name: "Fractured Organizational Node Network", tone: ["tension_bottleneck"], baseWeight: 1.5, renderMode: "image", svg: "${fractureBreakNodesBase64}", position: "left_shoulder", widthPx: 200 }
          ]
        };

        // BRAND & PHYSICAL ASSET RESOLUTION — MUST BE FIRST PRIORITY.
        // Evaluated BEFORE matchedClusterKey so a brand mention ("scale your eBay store")
        // cannot accidentally route into the metaphor cluster fallthrough.
        const matchedBrand = resolveClientBrandOrPhysicalAsset(chunkText);

        const lower = chunkText.toLowerCase();
        let matchedClusterKey = null;
        // Only compute cluster key if brand did not match, to keep priority ordering structurally enforced
        if (!matchedBrand) {
          if (lower.includes("growth") || lower.includes("scale") || lower.includes("expand")) matchedClusterKey = "growth";
          else if ((lower.includes("breaking") || lower.includes("broken") || lower.includes("breaks")) && !raw.assetData) matchedClusterKey = "breaking";
        }

        if (matchedBrand) {
          const isLeft = (matchedBrand.position === "left_shoulder");
          const isRight = (matchedBrand.position === "right_shoulder");
          backgroundAsset = {
            assetId: matchedBrand.id,
            assetName: matchedBrand.name,
            renderMode: "image",
            imageUrl: matchedBrand.imageUrl,
            microAnimationClass: matchedBrand.microAnimationClass,
            position: isLeft ? { topPercent: 12, leftPercent: 4, widthPx: matchedBrand.widthPx } :
                      isRight ? { topPercent: 12, leftPercent: 54, widthPx: matchedBrand.widthPx } :
                      { topPercent: 8, leftPercent: 8, widthPx: matchedBrand.widthPx }
          };
        } else if (matchedClusterKey && METAPHOR_CLUSTERS[matchedClusterKey]) {
          const cluster = METAPHOR_CLUSTERS[matchedClusterKey];
          let candidates = cluster.filter(c => c.tone.includes(spurtTone));
          if (candidates.length === 0) candidates = cluster;

          const scored = candidates.map(c => {
            const usage = presetUsageHistory[c.id] || 0;
            const penalty = Math.pow(0.12, usage);
            return { candidate: c, weight: c.baseWeight * penalty };
          });

          const totalW = scored.reduce((sum, s) => sum + s.weight, 0);
          let r = rng() * totalW;
          let selected = scored[0].candidate;
          for (const s of scored) {
            if (r <= s.weight) {
              selected = s.candidate;
              break;
            }
            r -= s.weight;
          }

          presetUsageHistory[selected.id] = (presetUsageHistory[selected.id] || 0) + 1;
          const isLeft = (selected.position === "left_shoulder");
          const isRight = (selected.position === "right_shoulder");
          backgroundAsset = {
            assetId: selected.id,
            assetName: selected.name,
            renderMode: selected.renderMode || "image",
            htmlMarkup: selected.htmlMarkup || null,
            imageUrl: selected.svg || null,
            position: isLeft ? { topPercent: 12, leftPercent: 2, widthPx: selected.widthPx } :
                      isRight ? { topPercent: 12, leftPercent: 52, widthPx: selected.widthPx } :
                      { topPercent: 8, leftPercent: 6, widthPx: selected.widthPx }
          };
        } else {
          // Autonomous Concept-to-Physical Manifestation Bridge with Dogma Variety & Spacing Cooldown
          const isIdeaMention = /(^|[^a-z])(idea|ideas|genius|insight|brainstorm|concept|thesis|clarity|philosophy|discovery)([^a-z]|$)/i.test(chunkText);
          const isFounderMention = /(^|[^a-z])(founder|founders|ceo|leader|executive|boss|creator|entrepreneur)([^a-z]|$)/i.test(chunkText);
          
          const lastIdeaTrigger = lastConceptTriggerChunk["idea"] ?? -99;
          const lastFounderTrigger = lastConceptTriggerChunk["founder"] ?? -99;

          // Cooldown check: At least 3 chunks between repeated idea/founder expressions to avoid screen spam
          const isCoolingDown = (isIdeaMention && (chunkIdx - lastIdeaTrigger < 3)) ||
                                (isFounderMention && (chunkIdx - lastFounderTrigger < 3));

          let bridgedConcept = null;
          if (!isCoolingDown) {
            bridgedConcept = extractAndBridgeConcept(chunkText, surrounding, hasBottleneck, presetUsageHistory, rng);
            if (bridgedConcept) {
              if (isIdeaMention) lastConceptTriggerChunk["idea"] = chunkIdx;
              if (isFounderMention) lastConceptTriggerChunk["founder"] = chunkIdx;
            }
          }

          if (bridgedConcept) {
            const cand = bridgedConcept.matchedCandidate;
            const isLeft = (cand.defaultPosition === "left_shoulder");
            const isRight = (cand.defaultPosition === "right_shoulder");
            backgroundAsset = {
              assetId: cand.id,
              assetName: cand.name + " (" + Math.round(bridgedConcept.confidenceScore * 100) + "% Confidence)",
              imageUrl: bridgedConcept.renderedSvgUri,
              position: isLeft ? { topPercent: 12, leftPercent: 2, widthPx: cand.renderWidthPx } :
                        isRight ? { topPercent: 12, leftPercent: 52, widthPx: cand.renderWidthPx } :
                        { topPercent: 8, leftPercent: 6, widthPx: cand.renderWidthPx }
            };
          } else if (raw.assetData) {
            const isLeft = (raw.assetPosition === "left_shoulder");
            const isRight = (raw.assetPosition === "right_shoulder");
            backgroundAsset = {
              assetId: "asset_chunk_" + raw.chunkIndex,
              assetName: raw.text + " Reference",
              imageUrl: raw.assetData,
              position: isLeft ? { topPercent: 12, leftPercent: 2, widthPx: 190 } :
                        isRight ? { topPercent: 12, leftPercent: 52, widthPx: 190 } :
                        { topPercent: 8, leftPercent: 6, widthPx: 280 }
            };
          } else if (raw.emphasis === "named_entity_founders" && TECH_FOUNDERS_BASE64) {
            backgroundAsset = {
              assetId: "tech_founders_vintage_trio",
              assetName: "Silicon Valley Founders Trio Cutout",
              imageUrl: TECH_FOUNDERS_BASE64,
              position: { topPercent: 8, leftPercent: 5, widthPx: 290 }
            };
          }
        }

        const imageFilename = (profile._filename || "image (1).json").replace(/\.json$/i, ".png");

        return {
          chunkIndex: raw.chunkIndex,
          timestamp: raw.timestamp,
          startSec: raw.startSec,
          endSec: raw.endSec,
          text: raw.text,
          profileName: profile.profile_name,
          profileFilename: profile._filename || "image.json",
          imageFilename: imageFilename,
          imageUrl: "/font_pairs/" + encodeURIComponent(imageFilename),
          profileMood: profile.metadata?.overall_mood || "Editorial Pairing",
          isInlineHorizontal: isInlineCompound,
          depthPlane: depthPlane,
          isHeadZone: isHeadZone,
          coreSubjectMask: !!coreSubjectDecision,
                    corePhrase: coreSubjectDecision?.text || null,
          tallHeroWord: coreSubjectDecision?.heroWord?.text || null,
          companionAnchor: companionLayout?.companionAnchor || null,
          compositionMode: companionLayout?.compositionMode || null,
          prefixWords: companionLayout?.prefixWords || [],
          suffixWords: companionLayout?.suffixWords || [],
          layers: renderedLayers,
          backgroundAsset: backgroundAsset,
          rawProfile: profile
        };
      });

      // 🔊 GENERATE CAUSAL SPATIO-TEMPORAL SOUND MANIFEST
      currentCausalSoundManifest = buildCausalSoundManifestClient(compiled);
      return compiled;
    }

    // Client-side Deterministic Causal Sound Manifest Generator with 4 Nephew Variants & Repetition Caps
    function buildCausalSoundManifestClient(sequence) {
      const cues = [];
      // Editorial restraint: typography earns a sound cue; it does not receive one by default.
      const TYPOGRAPHY_SFX_COVERAGE_TARGET = 0.6;
      const typographyCueIndexes = new Set(sequence
        .map((chunk, index) => {
          const emphasisScore = (chunk.emphasis || "").includes("inflection") ? 4 : 0;
          const fxPreset = chunk.layers?.[0]?.fxPreset || "";
          const motionScore = (fxPreset.includes("glitch") || fxPreset.includes("typewriter")) ? 3 : 0;
          const wordScore = ((chunk.text || "").trim().split(/\s+/).filter(Boolean).length >= 5) ? 2 : 1;
          return { index, score: emphasisScore + motionScore + wordScore + ((index * 37 + sequence.length * 13) % 101) / 1000 };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.round(sequence.length * TYPOGRAPHY_SFX_COVERAGE_TARGET))
        .map(entry => entry.index));
      const trackers = {
        text_click_family: { activeVariantIndex: 0, repetitionCount: 0 },
        text_typing_family: { activeVariantIndex: 0, repetitionCount: 0 },
        text_glitch_family: { activeVariantIndex: 0, repetitionCount: 0 },
        lengthy_text_gear_family: { activeVariantIndex: 0, repetitionCount: 0 },
        camera_motion_whoosh_family: { activeVariantIndex: 0, repetitionCount: 0 },
        transition_action_family: { activeVariantIndex: 0, repetitionCount: 0 },
        sub_bass_tension_family: { activeVariantIndex: 0, repetitionCount: 0 },
        telemetry_arpeggio_family: { activeVariantIndex: 0, repetitionCount: 0 }
      };

      function getVariant(famKey) {
        const fam = AUTHORITATIVE_SFX_FAMILIES[famKey];
        if (!fam) return AUTHORITATIVE_SFX_FAMILIES.text_click_family.variants[0];
        const st = trackers[famKey];
        if (st.repetitionCount >= fam.maxConsecutiveRepetitions) {
          st.activeVariantIndex = (st.activeVariantIndex + 1) % fam.variants.length;
          st.repetitionCount = 1;
        } else {
          st.repetitionCount += 1;
        }
        return fam.variants[st.activeVariantIndex];
      }

      sequence.forEach((chunk, idx) => {
        const t = chunk.startSec || (idx * 2.0);
        const chunkDuration = chunk.endSec ? (chunk.endSec - chunk.startSec) : 2.0;
        const text = chunk.text || "";
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length;

        const fontName = chunk.profileName || chunk.fontProfile?.profile_name || "";
        const fontLower = fontName.toLowerCase();
        const fxPreset = chunk.layers?.[0]?.fxPreset || "";

        const isGlitch = fxPreset.includes("glitch") || fxPreset.includes("displace") || fontLower.includes("glitch");
        const isMono = fontLower.includes("mono") || fontLower.includes("elite") || fontLower.includes("typewriter") || fontLower.includes("vt323") || fxPreset.includes("typewriter");
        const isLengthyText = wordCount >= 5;

        // 1. TYPOGRAPHY TEXT SFX
        if (typographyCueIndexes.has(idx) && isGlitch) {
          const v = getVariant("text_glitch_family");
          cues.push({
            id: "cue_glitch_" + (idx + 1), chunkIndex: chunk.chunkIndex, timeSec: t + 0.04, durationSec: v.durationSec,
            familyKey: "text_glitch_family", variantId: v.variantId, variantIndex: v.variantIndex, label: v.name + " (" + v.variantId + ")",
            triggerReason: "Kinetic Glitch Animation [" + (fxPreset || fontName) + "]", spatialPan: 0.0, depthPlane: 30,
            lowpassCutoffHz: v.filterCutoffHz, gain: v.baseGain, synthParams: v
          });
        } else if (typographyCueIndexes.has(idx) && isLengthyText) {
          const v = getVariant("lengthy_text_gear_family");
          cues.push({
            id: "cue_gear_" + (idx + 1), chunkIndex: chunk.chunkIndex, timeSec: t + 0.05, durationSec: v.durationSec,
            familyKey: "lengthy_text_gear_family", variantId: v.variantId, variantIndex: v.variantIndex, label: v.name + " (" + v.variantId + ")",
            triggerReason: "Lengthy Sequential Text Flow (" + wordCount + " Words)", spatialPan: 0.0, depthPlane: 30,
            lowpassCutoffHz: v.filterCutoffHz, gain: v.baseGain, synthParams: v
          });
        } else if (typographyCueIndexes.has(idx) && isMono) {
          const v = getVariant("text_typing_family");
          cues.push({
            id: "cue_typing_" + (idx + 1), chunkIndex: chunk.chunkIndex, timeSec: t + 0.04, durationSec: v.durationSec,
            familyKey: "text_typing_family", variantId: v.variantId, variantIndex: v.variantIndex, label: v.name + " (" + v.variantId + ")",
            triggerReason: "Monospace Keystroke Reveal [" + fontName + "]", spatialPan: 0.0, depthPlane: 30,
            lowpassCutoffHz: v.filterCutoffHz, gain: v.baseGain, synthParams: v
          });
        } else if (typographyCueIndexes.has(idx)) {
          const v = getVariant("text_click_family");
          cues.push({
            id: "cue_click_" + (idx + 1), chunkIndex: chunk.chunkIndex, timeSec: t + 0.03, durationSec: v.durationSec,
            familyKey: "text_click_family", variantId: v.variantId, variantIndex: v.variantIndex, label: v.name + " (" + v.variantId + ")",
            triggerReason: "Standard Kinetic Text Reveal [" + (fontName || "Sans") + "]", spatialPan: 0.0, depthPlane: 30,
            lowpassCutoffHz: v.filterCutoffHz, gain: v.baseGain, synthParams: v
          });
        }

                const isHighlight = text.toLowerCase().includes("feels") || text.toLowerCase().includes("system") || fxPreset.includes("highlight") || fxPreset.includes("marker");
        if (isHighlight) {
          cues.push({
            id: "cue_highlight_" + (idx + 1), chunkIndex: chunk.chunkIndex, timeSec: t + 0.12, durationSec: 0.45,
            familyKey: "camera_motion_whoosh_family", variantId: "whoosh_rescale_subtle_04", variantIndex: 3,
            label: "Subtle Highlight Whoosh / Marker Line Draw",
            triggerReason: "Kinetic Highlighter Brush Accent on 'feels'",
            spatialPan: 0.25, depthPlane: 20, lowpassCutoffHz: 2800, gain: 0.32,
            synthParams: { baseGain: 0.32, durationSec: 0.45 }
          });
        }

        // 2. SPEED-CONSONANT CAMERA & VIEWPORT WHOOSHES
        if (idx === 0 || idx === 10 || chunk.backgroundAsset) {
          const isSlow = chunkDuration >= 2.0;
          const isFast = chunkDuration < 0.8;
          const famWhoosh = AUTHORITATIVE_SFX_FAMILIES.camera_motion_whoosh_family;
          const v = isSlow ? famWhoosh.variants[0] : (isFast ? famWhoosh.variants[2] : famWhoosh.variants[1]);
          const isLeft = chunk.backgroundAsset ? ((chunk.backgroundAsset.position?.leftPercent ?? 50) < 30) : false;
          const pan = chunk.backgroundAsset ? (isLeft ? -0.75 : 0.75) : 0.0;
          cues.push({
            id: "cue_whoosh_" + (idx + 1), chunkIndex: chunk.chunkIndex, timeSec: t + 0.08, durationSec: v.durationSec,
            familyKey: "camera_motion_whoosh_family", variantId: v.variantId, variantIndex: v.variantIndex, label: v.name + " (" + v.variantId + ")",
            triggerReason: "Speed-Consonant Viewport Motion [Duration: " + chunkDuration.toFixed(1) + "s]", spatialPan: pan, depthPlane: 10,
            lowpassCutoffHz: v.filterCutoffHz, gain: v.baseGain, synthParams: v
          });
        }

        // 3. ASSET MOTION RHYMING SWOOSH (REPLACES HARSH BRAAAMS WITH CLEAN AIR SWOOSH)
        if (chunk.backgroundAsset) {
          const v = AUTHORITATIVE_SFX_FAMILIES.camera_motion_whoosh_family.variants[1]; // Cinematic Swoosh #02
          cues.push({
            id: "cue_asset_swoosh_" + (idx + 1), chunkIndex: chunk.chunkIndex, timeSec: t + 0.04, durationSec: v.durationSec,
            familyKey: "camera_motion_whoosh_family", variantId: v.variantId, variantIndex: v.variantIndex, label: v.name + " (" + v.variantId + ")",
            triggerReason: "Asset Entrance Motion Rhyme (Smooth Bezier Swoosh)", spatialPan: 0.0, depthPlane: 10,
            lowpassCutoffHz: v.filterCutoffHz, gain: v.baseGain, synthParams: v
          });
        }

        // 4. ANIMA CHARTS & TELEMETRY ARPEGGIOS
        if (chunk.backgroundAsset && chunk.backgroundAsset.renderMode === "dom_component") {
          const v = getVariant("telemetry_arpeggio_family");
          cues.push({
            id: "cue_telemetry_" + (idx + 1), chunkIndex: chunk.chunkIndex, timeSec: t + 0.35, durationSec: v.durationSec,
            familyKey: "telemetry_arpeggio_family", variantId: v.variantId, variantIndex: v.variantIndex, label: v.name + " (" + v.variantId + ")",
            triggerReason: "ANIMA #04 Dynamic Vector Chart Spline Drawing", spatialPan: 0.75, depthPlane: 10,
            lowpassCutoffHz: v.filterCutoffHz, gain: v.baseGain, synthParams: v
          });
        }

        // 5. TRANSITIONS (BONE SNAPS & APERTURE SHUTTERS)
        if (false /* disabled synthetic bone snap */) {
          const v = getVariant("transition_action_family");
          cues.push({
            id: "cue_trans_" + (idx + 1), chunkIndex: chunk.chunkIndex, timeSec: t + 0.02, durationSec: v.durationSec,
            familyKey: "transition_action_family", variantId: v.variantId, variantIndex: v.variantIndex, label: v.name + " (" + v.variantId + ")",
            triggerReason: "Major Narrative Act Boundary & Structural Pivot", spatialPan: 0.0, depthPlane: 30,
            lowpassCutoffHz: v.filterCutoffHz, gain: v.baseGain, synthParams: v
          });
        }
      });

      return cues;
    }

    function renderSfxIntelligenceTab() {
      const familyContainer = document.getElementById("sfxFamilyGridContainer");
      const activeCuesList = document.getElementById("sfxActiveChunkCuesList");
      const activeLabel = document.getElementById("sfxActiveChunkLabel");
      const timelineTbody = document.getElementById("sfxTimelineTbody");

      if (!familyContainer) return;

      const chunk = compiledSequence[currentIndex];
      const chunkCues = (currentCausalSoundManifest || []).filter(c => c.chunkIndex === (chunk?.chunkIndex || 1));
      
      if (activeLabel) {
        activeLabel.innerText = "Chunk #" + (chunk?.chunkIndex || 1) + " • " + chunkCues.length + " Cues Active";
      }

      if (activeCuesList) {
        activeCuesList.innerHTML = "";
        if (chunkCues.length === 0) {
          activeCuesList.innerHTML = '<div style="font-size:11px; color:var(--text-muted);">No sound cues for active spurt.</div>';
        } else {
          chunkCues.forEach(c => {
            const item = document.createElement("div");
            item.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 6px; border-left: 3px solid #00F0FF;";
            const panStr = c.spatialPan === 0 ? "Center" : (c.spatialPan < 0 ? "Left " + c.spatialPan : "Right +" + c.spatialPan);
            item.innerHTML = 
              '<div>' +
                '<div style="font-size: 11px; font-weight: 700; color: #FFF;">' + c.label + '</div>' +
                '<div style="font-size: 10px; color: var(--text-secondary);">' + c.triggerReason + ' • Pan: ' + panStr + '</div>' +
              '</div>' +
              '<button class="btn-secondary" style="padding: 2px 8px; font-size: 10px;" onclick="auditionCueById(\\\'' + c.id + '\\\')">▶ Audition</button>';
            activeCuesList.appendChild(item);
          });
        }
      }

      // Render the 6 Acoustic Families & 4 Variants
      familyContainer.innerHTML = "";
      Object.keys(AUTHORITATIVE_SFX_FAMILIES).forEach(famKey => {
        const fam = AUTHORITATIVE_SFX_FAMILIES[famKey];
        const card = document.createElement("div");
        card.className = "anomaly-drawer-card";
        card.style.background = "rgba(15, 23, 42, 0.65)";

        let variantsHtml = "";
        fam.variants.forEach((v, vIdx) => {
          variantsHtml += 
            '<div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: rgba(0,0,0,0.25); border-radius: 4px; border-left: 2px solid ' + (vIdx === 0 ? '#10B981' : '#38BDF8') + ';">' +
              '<div>' +
                '<span style="font-size: 11px; font-weight: 700; color: #FFF;">Variant #' + v.variantIndex + ': ' + v.name + '</span>' +
                '<span style="font-size: 9px; color: var(--text-secondary); margin-left: 6px;">[' + v.oscType + ' • ' + v.startFreqHz + 'Hz->' + v.endFreqHz + 'Hz • ' + v.durationSec + 's]</span>' +
              '</div>' +
              '<button class="btn-secondary" style="padding: 2px 6px; font-size: 9px;" onclick="auditionPreset(\\\'' + famKey + '\\\', ' + vIdx + ')">▶ Play</button>' +
            '</div>';
        });

        card.innerHTML = 
          '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">' +
            '<span style="font-size: 12px; font-weight: 800; color: #FFF;">🎛️ ' + fam.familyName + '</span>' +
            '<span style="font-size: 10px; color: var(--accent-yellow); font-family: monospace;">Max Reps: ' + fam.maxConsecutiveRepetitions + 'x before Nephew</span>' +
          '</div>' +
          '<div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 8px;">' + fam.description + '</div>' +
          '<div style="display: flex; flex-direction: column; gap: 4px;">' +
            variantsHtml +
          '</div>';
        familyContainer.appendChild(card);
      });

      // Render 20-Chunk Timeline Table
      if (timelineTbody) {
        timelineTbody.innerHTML = "";
        (currentCausalSoundManifest || []).forEach(cue => {
          const tr = document.createElement("tr");
          tr.style.cursor = "pointer";
          tr.onclick = () => { seekVideoAndJumpChunk(cue.chunkIndex - 1); };
          const panStr = cue.spatialPan === 0 ? "Center" : (cue.spatialPan < 0 ? "Left " + cue.spatialPan : "Right +" + cue.spatialPan);
          tr.innerHTML = 
            '<td style="font-family: monospace; font-size: 10px; color: var(--accent-cyan);">' + cue.timeSec.toFixed(2) + 's</td>' +
            '<td style="font-weight: 700; color: #FFF;">#' + cue.chunkIndex + '</td>' +
            '<td style="font-size: 11px; color: #CBD5E1;"><strong style="color:#FFF;">' + cue.label + '</strong><br><span style="font-size:9px; color:var(--text-muted);">' + cue.triggerReason + '</span></td>' +
            '<td style="font-family: monospace; font-size: 10px; color: var(--accent-yellow);">' + cue.variantId + '</td>' +
            '<td style="font-size: 10px; color: var(--text-secondary);">' + panStr + '</td>' +
            '<td><button class="btn-secondary" style="padding: 2px 6px; font-size: 9px;" onclick="event.stopPropagation(); auditionCueById(\\\'' + cue.id + '\\\')">▶</button></td>';
          timelineTbody.appendChild(tr);
        });
      }
    }

    function auditionCueById(cueId) {
      const cue = (currentCausalSoundManifest || []).find(c => c.id === cueId);
      if (cue) playCausalSynthesizedCue(cue);
    }

    // 4. COMPUTE & RENDER RUN-SET IMAGE REFERENCES MATRIX
        function toggleRefStrip() {
      const strip = document.getElementById("runSetRefStrip");
      const btn = document.getElementById("btnToggleRefStrip");
      if (!strip || !btn) return;
      strip.classList.toggle("collapsed");
      const isCol = strip.classList.contains("collapsed");
      btn.innerText = isCol ? "🔽 Show Reference Ribbon" : "🔼 Collapse Ribbon";
    }

    function renderRunSetImageReferenceRibbon() {
      const carousel = document.getElementById('refCardsCarousel');
      carousel.innerHTML = '';

      // Group active sequence by image
      const imageUsageMap = {};
      compiledSequence.forEach((chunk, idx) => {
        const imgName = chunk.imageFilename;
        if (!imageUsageMap[imgName]) {
          imageUsageMap[imgName] = {
            imageFilename: imgName,
            imageUrl: chunk.imageUrl,
            profileName: chunk.profileName,
            profileMood: chunk.profileMood,
            profileFilename: chunk.profileFilename,
            occurrences: []
          };
        }
        imageUsageMap[imgName].occurrences.push({
          chunkIndex: chunk.chunkIndex,
          seqIndex: idx,
          timestamp: chunk.timestamp,
          startSec: chunk.startSec,
          text: chunk.text
        });
      });

      const uniqueList = Object.values(imageUsageMap);
      document.getElementById('refStripCount').innerText = uniqueList.length + ' Unique Profiles (' + compiledSequence.length + ' Chunks)';

      uniqueList.forEach(item => {
        const card = document.createElement('div');
        const isCurrentActive = item.occurrences.some(o => o.seqIndex === currentIndex);
        const isMulti = item.occurrences.length > 1;

        card.className = 'run-ref-card' + (isCurrentActive ? ' active-in-chunk' : '');
        card.id = 'runRefCard_' + item.imageFilename.replace(/[^a-zA-Z0-9]/g, '_');

        // Clicking card jumps to first occurrence
        card.onclick = () => {
          seekVideoAndJumpChunk(item.occurrences[0].seqIndex);
        };

        let chipsHtml = '';
        item.occurrences.forEach(occ => {
          chipsHtml += 
            '<span class="occ-chip" title="' + occ.text + '" onclick="event.stopPropagation(); seekVideoAndJumpChunk(' + occ.seqIndex + ')">' +
              '#' + occ.chunkIndex + ' @ ' + occ.timestamp.split('—')[0].trim() +
            '</span>';
        });

        card.innerHTML = 
          '<div class="run-ref-thumb-wrap">' +
            '<img src="' + item.imageUrl + '" alt="' + item.imageFilename + '" loading="lazy">' +
          '</div>' +
          '<div class="run-ref-card-meta">' +
            '<span class="run-ref-name" title="' + item.profileName + '">' + item.imageFilename + '</span>' +
            '<span class="usage-badge ' + (isMulti ? 'usage-multi' : 'usage-single') + '">' + item.occurrences.length + 'x Used</span>' +
          '</div>' +
          '<div class="run-ref-occurrences">' +
            chipsHtml +
          '</div>';

        carousel.appendChild(card);
      });
    }

    // 5. SEEK TIMELINE AND JUMP TO CHUNK WITH REAL-TIME SYNCHRONIZATION
    function seekVideoAndJumpChunk(chunkIndex) {
      const chunk = compiledSequence[chunkIndex];
      if (!chunk) return;

      currentTimelineSec = chunk.startSec;
      const min = Math.floor(currentTimelineSec / 60);
      const sec = (currentTimelineSec % 60).toFixed(2);
      const clockEl = document.getElementById('lblVideoClock');
      if (clockEl) clockEl.innerText = (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;

      renderPresentationChunk(chunkIndex);

      // Highlight active reference card in ribbon
      if (document.querySelectorAll) {
        document.querySelectorAll('.run-ref-card').forEach(c => {
          if (c.classList && c.classList.remove) c.classList.remove('active-in-chunk');
        });
      }
      const activeCard = document.getElementById('runRefCard_' + chunk.imageFilename.replace(/[^a-zA-Z0-9]/g, '_'));
      if (activeCard) {
        if (activeCard.classList && activeCard.classList.add) activeCard.classList.add('active-in-chunk');
        const carousel = document.getElementById('refCardsCarousel');
        if (carousel && typeof carousel.scrollTo === 'function') {
          const cardLeft = activeCard.offsetLeft || 0;
          const cardWidth = activeCard.clientWidth || 0;
          const carouselWidth = carousel.clientWidth || 300;
          carousel.scrollTo({
            left: Math.max(0, cardLeft - (carouselWidth / 2) + (cardWidth / 2)),
            behavior: 'smooth'
          });
        }
      }
    }

    // 6. RENDER ACTIVE PRESENTATION CHUNK & INSPECTOR CROSS-COMPARISON
    // LIVE_MATTED_COMPOSITION_DIRECTOR: the caller owns foreground/background depth.
    function resolveLiveMattedComposition(asset) {
      const speakerCutout = document.getElementById("speakerCutout");
      const hasVisibleMattedSpeaker = Boolean(speakerCutout && speakerCutout.style.display !== "none");
      const requiresForegroundInteraction = asset && asset.requiresForegroundInteraction === true;
      const isBehindPrincipalSpeaker = hasVisibleMattedSpeaker && !requiresForegroundInteraction;
      return {
        placement: isBehindPrincipalSpeaker ? "behind_principal_speaker" : "foreground_callout",
        zIndex: isBehindPrincipalSpeaker ? "10" : "25"
      };
    }

    function renderPresentationChunk(index) {
      currentIndex = index;
      const chunk = compiledSequence[index];
      if (!chunk) return;

      const timeStr = chunk.timestamp.split('—')[0].trim();
      document.getElementById('stageTimeBadge').innerText = timeStr;
      document.getElementById('lblActiveTimestamp').innerText = chunk.timestamp;
      document.getElementById('lblActiveChunk').innerText = 'Chunk ' + chunk.chunkIndex + ' of ' + compiledSequence.length + ' • ' + chunk.timestamp;
      document.getElementById('lblActiveFrame').innerText = '#' + Math.floor(chunk.startSec * 23.976);
      document.getElementById('lblActiveProfile').innerText = '[' + chunk.profileFilename + '] ' + chunk.profileName.replace(/_/g, ' ');
      document.getElementById('lblActiveMood').innerText = chunk.profileMood;
      document.getElementById('timelineScrubber').value = index;

      // Update Side-by-Side Comparison Inspector
      document.getElementById('lblCompareTitle').innerText = chunk.imageFilename + ' vs Live Web Hydration';
      document.getElementById('refCompareImg').src = chunk.imageUrl;
      document.getElementById('radarPlaneStatus').innerText = chunk.depthPlane === 'behind_subject' ? 'ZONE A (Z:10)' : 'ZONE B (Z:30)';

      const headStage = document.getElementById('familyHeadStage');
      const chestStage = document.getElementById('familyChestStage');
      const subjectMaskCompanionStage = document.getElementById('subjectMaskCompanionStage');
      const bgLayer = document.getElementById('semanticBgAssetLayer');
      const tableBody = document.getElementById('layersTableBody');
      const specimenPreview = document.getElementById('liveSpecimenPreview');

      headStage.innerHTML = '';
      chestStage.innerHTML = '';
      subjectMaskCompanionStage.innerHTML = '';
      bgLayer.innerHTML = '';
      tableBody.innerHTML = '';
      specimenPreview.innerHTML = '';

      // Background Polymorphic Mount Slot
      // Live preview: Z:25 (in front of raw video at Z:5, flanked at shoulders)
      // Test lab: Z:10 (behind matted speaker cutout at Z:20) when depthPlane = behind_subject
      if (chunk.backgroundAsset) {
        const bg = chunk.backgroundAsset;
        const composition = resolveLiveMattedComposition(bg);
        bgLayer.style.zIndex = composition.zIndex;
        bgLayer.dataset.compositionPlacement = composition.placement;
        bgLayer.style.top = bg.position.topPercent + '%';
        bgLayer.style.left = bg.position.leftPercent + '%';

        if (bg.renderMode === "dom_component" && bg.htmlMarkup) {
          bgLayer.innerHTML = bg.htmlMarkup;
          bgLayer.className = 'semantic-bg-asset-layer anima-active-stage asset-motion-swoosh-pop';
          void bgLayer.offsetWidth;
        } else {
          bgLayer.className = 'semantic-bg-asset-layer';
          const img = document.createElement('img');
          img.src = bg.imageUrl;
          img.style.width = bg.position.widthPx + 'px';
          img.style.borderRadius = '16px';
          img.style.opacity = '0.95';

          const isCharacter = bg.assetName && (bg.assetName.includes('founder') || bg.assetName.includes('person') || bg.assetName.includes('trio'));
          const isProblemOrBulb = bg.assetName && (bg.assetName.includes('bulb') || bg.assetName.includes('synapse') || bg.assetName.includes('focus'));

          if (bg.microAnimationClass) {
            img.className = bg.microAnimationClass;
          } else if (isCharacter) {
            img.className = 'asset-motion-character-glide';
          } else if (isProblemOrBulb) {
            img.className = 'asset-motion-diplo-drop';
          } else {
            img.className = 'asset-motion-diplo-drop';
          }

          bgLayer.appendChild(img);
          void img.offsetWidth;
        }
      }

      // Update 20-Chunk Picker Chips
      const chipContainer = document.getElementById('chunkPicker');
      chipContainer.innerHTML = '';
      compiledSequence.forEach((c, idx) => {
        const chip = document.createElement('button');
        chip.className = 'chip ' + (idx === index ? 'active' : '');
        chip.innerText = '#' + c.chunkIndex + ' ' + c.text.slice(0, 14) + '...';
        chip.onclick = (e) => { e.stopPropagation(); seekVideoAndJumpChunk(idx); };
        chipContainer.appendChild(chip);
      });

      const layerGroup = document.createElement('div');
      layerGroup.className = 'layer-group' + (chunk.isInlineHorizontal ? ' layout-inline-horizontal' : '') + (chunk.coreSubjectMask ? ' subject-mask-companion-layout anchor-' + chunk.companionAnchor : '');
      const subjectMaskCoreGroup = document.createElement('div');
      subjectMaskCoreGroup.className = 'layer-group subject-mask-core-layout';

      const lineGroups = [];
      chunk.layers.forEach((layer) => {
        const lastGroup = lineGroups[lineGroups.length - 1];
        if (lastGroup && lastGroup.lineNum === layer.layoutLine) {
          lastGroup.layers.push(layer);
        } else {
          lineGroups.push({ lineNum: layer.layoutLine, layers: [layer] });
        }
      });

      // Build Specimen Preview HTML for Inspector Comparison
      let specimenHtml = '';

      lineGroups.forEach((group) => {
        const lineRow = document.createElement('div');
        lineRow.className = 'typo-line-row';

        const targetLayerGroup = group.layers.some(layer => layer.isCoreSubjectText) ? subjectMaskCoreGroup : layerGroup;

        group.layers.forEach((layer) => {
          const isBehind = (chunk.depthPlane === 'behind_subject');
          const canonicalFamily = resolveCanonicalGoogleFontFamily(layer.fontFamily);

          const layerDiv = document.createElement('div');
          layerDiv.className = 'typo-layer layer-fx-' + layer.fxPreset + (layer.doubleUnderline ? ' editorial-double-underline' : '') + (layer.extraClass ? ' ' + layer.extraClass : '');
          layerDiv.style.fontFamily = '"' + canonicalFamily + '", sans-serif';
          layerDiv.style.fontWeight = layer.fontWeight;
          layerDiv.style.fontStyle = layer.fontStyle || 'normal';
          layerDiv.style.fontSize = layer.fontSizePx + 'px';
          layerDiv.style.lineHeight = layer.lineHeight || 1.05;
          layerDiv.style.color = layer.color || '#FFFFFF';
          layerDiv.setAttribute('data-caption-renderer', 'true');
          layerDiv.setAttribute('data-font-family', canonicalFamily);
          layerDiv.setAttribute('data-font-weight', String(layer.fontWeight));
          if (layer.letterSpacingEm) layerDiv.style.letterSpacing = layer.letterSpacingEm + 'em';
          if (layer.marginTopPx && !chunk.isInlineHorizontal && group.layers.length === 1) {
            layerDiv.style.marginTop = layer.marginTopPx + 'px';
          }
          // High-contrast dual drop shadow to guarantee razor-sharp legibility over video background
          layerDiv.style.textShadow = '0 2px 14px rgba(0,0,0,0.95), 0 0 24px rgba(0,0,0,0.90)';

          function renderCharSpansByWord(targetContainer, text, charClassName, delayStep = 0.04, extraWordSpanClass = '') {
            const words = text.split(' ').filter(w => w.length > 0);
            let globalCharIdx = 0;
            words.forEach((word, wIdx) => {
              const wordSpan = document.createElement('span');
              wordSpan.className = 'word-span ' + extraWordSpanClass;
              wordSpan.setAttribute('data-caption-renderer', 'true');
              
              Array.from(word).forEach((ch) => {
                const charSpan = document.createElement('span');
                charSpan.className = charClassName;
                charSpan.setAttribute('data-caption-renderer', 'true');
                charSpan.style.animationDelay = (globalCharIdx * delayStep) + 's';
                charSpan.innerText = ch;
                wordSpan.appendChild(charSpan);
                globalCharIdx++;
              });

              targetContainer.appendChild(wordSpan);

              if (wIdx < words.length - 1) {
                const spaceSpan = document.createElement('span');
                spaceSpan.className = 'word-spacer';
                spaceSpan.innerHTML = '&nbsp;';
                targetContainer.appendChild(spaceSpan);
              }
            });
          }

          // 0. Dynamic Numeric Ticker (PRIORITY: Real-time kinetic counter animation)
          if (layer.numericCounter) {
            const counterSpan = document.createElement('span');
            counterSpan.className = 'numeric-counter-item word-item word-span';
            counterSpan.setAttribute('data-caption-renderer', 'true');
            counterSpan.style.fontVariantNumeric = 'tabular-nums';
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

          // A. Hand-Drawn Sketched Pencil Circle Loop Accent
          } else if (layer.sketchCircle) {
            const circleWrap = document.createElement('div');
            circleWrap.className = 'sketch-circle-loop-wrap';

            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('class', 'sketch-circle-loop-svg');
            svg.setAttribute('viewBox', '0 0 240 70');
            svg.setAttribute('preserveAspectRatio', 'none');

            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('class', 'sketch-circle-path');
            path.setAttribute('d', 'M 20,35 C 15,12 85,6 150,7 C 215,8 235,18 230,36 C 225,54 175,64 110,63 C 45,62 12,52 16,33 C 20,14 90,8 155,9 C 220,10 236,22 228,38 C 220,52 170,62 105,61');
            path.setAttribute('vector-effect', 'non-scaling-stroke');
            svg.appendChild(path);
            circleWrap.appendChild(svg);

            const textInner = document.createElement('div');
            textInner.className = 'sketch-circle-text';
            const words = layer.text.split(' ').filter(w => w.length > 0);
            words.forEach((w, wIdx) => {
              const span = document.createElement('span');
              span.className = 'word-item word-span';
              span.innerText = w;
              span.style.animationDelay = (wIdx * 0.07) + 's';
              textInner.appendChild(span);
            });
            circleWrap.appendChild(textInner);
            layerDiv.appendChild(circleWrap);

          // 1. Delayed Animated Highlight Card Sweep
          } else if (layer.delayedPillCard) {
            const cardWrap = document.createElement('div');
            cardWrap.className = 'delayed-pill-card-container';
            const cardBg = document.createElement('div');
            let bgClass = 'card-yellow';
            let textColor = '#111111';
            if (layer.delayedPillCard === '#FF1744') { bgClass = 'card-red-pressure'; textColor = '#FFFFFF'; }
            else if (layer.delayedPillCard === '#00F0FF') { bgClass = 'card-cyan'; textColor = '#070913'; }
            else if (layer.delayedPillCard === '#C084FC') { bgClass = 'card-lavender'; textColor = '#070913'; }
            cardBg.className = 'delayed-pill-card-bg ' + bgClass;
            
            const cardText = document.createElement('span');
            cardText.className = 'delayed-pill-card-text';
            cardText.innerText = layer.text;
            cardText.style.color = textColor;
            cardWrap.appendChild(cardBg);
            cardWrap.appendChild(cardText);
            layerDiv.appendChild(cardWrap);

          // 2. Hexta Terminal Typewriter + Caret
          } else if (layer.fxPreset === 'typewriter_mono_caret') {
            renderCharSpansByWord(layerDiv, layer.text, 'typewriter-char', 0.045);
            const caret = document.createElement('span');
            caret.className = 'typewriter-caret';
            caret.innerText = '|';
            layerDiv.appendChild(caret);

          // 3. Cinematic Viewport Mask Sweep
          } else if (layer.fxPreset === 'viewport_mask_sweep') {
            const sweepWrap = document.createElement('div');
            sweepWrap.className = 'viewport-mask-sweep-wrap';
            const sweepText = document.createElement('div');
            sweepText.className = 'viewport-mask-sweep-text';
            sweepText.innerText = layer.text;
            const sweepBar = document.createElement('div');
            sweepBar.className = 'viewport-mask-sweep-bar';
            sweepWrap.appendChild(sweepText);
            sweepWrap.appendChild(sweepBar);
            layerDiv.appendChild(sweepWrap);

          // 4. Motion Primitive Skeletal Glyphs Slot
          } else if (layer.fxPreset === 'staggered_glyph_slot') {
            const slotWrap = document.createElement('div');
            slotWrap.className = 'glyph-slot-wrap';
            renderCharSpansByWord(slotWrap, layer.text, 'glyph-slot-char', 0.045);
            layerDiv.appendChild(slotWrap);

          // 5. Glow Search Input & Parsing Caret
          } else if (layer.fxPreset === 'glow_search_input_caret') {
            const capsule = document.createElement('div');
            capsule.className = 'search-capsule-wrap';
            const icon = document.createElement('span');
            icon.className = 'search-capsule-icon';
            icon.innerText = '🔍';
            capsule.appendChild(icon);

            const textWrap = document.createElement('span');
            textWrap.style.whiteSpace = 'nowrap';
            renderCharSpansByWord(textWrap, layer.text, 'typewriter-char', 0.04);
            capsule.appendChild(textWrap);

            const caret = document.createElement('span');
            caret.className = 'typewriter-caret';
            caret.innerText = '|';
            capsule.appendChild(caret);
            layerDiv.appendChild(capsule);

          // 6. Dynamic Staggered Craft Cascade
          } else if (layer.fxPreset === 'spring_character_cascade') {
            renderCharSpansByWord(layerDiv, layer.text, 'spring-cascade-char', 0.035);

          // 7. Cyber Matrix Glitch
          } else if (layer.fxPreset === 'acid_lime_letter_glitch') {
            renderCharSpansByWord(layerDiv, layer.text, 'lime-glitch-char lime-accent', 0.04);

          // 8. Skyhigh Liquid Chrome Wave (Cotton.js sinusoidal wave distortion)
          } else if (layer.fxPreset === 'skyhigh_liquid_chrome_wave') {
            const waveWrap = document.createElement('div');
            waveWrap.className = 'skyhigh-wave-wrap';
            renderCharSpansByWord(waveWrap, layer.text, 'skyhigh-wave-char', 0.055);
            layerDiv.appendChild(waveWrap);

          // 9. Overlapping 3D Letter Tilt (CANVA Layered Stagger)
          } else if (layer.fxPreset === 'staggered_letter_overlap_tilt') {
            const overlapWrap = document.createElement('div');
            overlapWrap.className = 'overlap-tilt-wrap';
            const words = layer.text.split(' ').filter(w => w.length > 0);
            let charIndex = 0;
            words.forEach((w, wIdx) => {
              const wordSpan = document.createElement('span');
              wordSpan.className = 'word-span';
              Array.from(w).forEach((ch) => {
                const span = document.createElement('span');
                span.className = 'overlap-tilt-char';
                span.innerText = ch;
                span.style.zIndex = String(20 + charIndex);
                span.style.animationDelay = (charIndex * 0.06) + 's';
                wordSpan.appendChild(span);
                charIndex++;
              });
              overlapWrap.appendChild(wordSpan);
              if (wIdx < words.length - 1) {
                const sp = document.createElement('span');
                sp.className = 'word-spacer';
                sp.innerHTML = '&nbsp;';
                overlapWrap.appendChild(sp);
              }
            });
            layerDiv.appendChild(overlapWrap);

          // 10. 3D Caustic Glassmorphic Letterforms (Glass A Refraction)
          } else if (layer.fxPreset === 'glassmorphic_caustic_refract') {
            const glassWrap = document.createElement('div');
            glassWrap.className = 'glassmorphic-wrap';
            renderCharSpansByWord(glassWrap, layer.text, 'glassmorphic-char', 0.05);
            layerDiv.appendChild(glassWrap);

          // 11. Vibe Chromatic Luminescence Pulse (Anamorphic beam smearing)
          } else if (layer.fxPreset === 'vibe_chromatic_luminescence_pulse') {
            const vibeWrap = document.createElement('div');
            vibeWrap.className = 'vibe-luminescence-wrap';
            renderCharSpansByWord(vibeWrap, layer.text, 'vibe-luminescence-char', 0.06);
            layerDiv.appendChild(vibeWrap);

          // 12. Skywall Monolithic Steel Hydraulic Rise
          } else if (layer.fxPreset === 'skywall_monolithic_steel_rise') {
            const steelWrap = document.createElement('div');
            steelWrap.className = 'skywall-steel-wrap';
            renderCharSpansByWord(steelWrap, layer.text, 'skywall-steel-char', 0.04);
            layerDiv.appendChild(steelWrap);

          // TALL-FONT MONOLITH (Zone A / Z:10): clean whole-phrase seal. Tall depth text
          // receives NO decorative kinetic treatment — it is a single clean monolithic element
          // rendered as one block (no per-char chrome/glass/glitch/overlap, no word stagger).
          } else if (layer.fxPreset === 'monolith_clean_seal') {
            const monolithText = document.createElement('span');
            monolithText.className = 'monolith-seal-text';
            monolithText.setAttribute('data-caption-renderer', 'true');
            monolithText.innerText = layer.text;
            layerDiv.appendChild(monolithText);

          // 13. Standard Kinetic Word Animation
          } else {
            const words = layer.text.split(' ').filter(w => w.length > 0);
            words.forEach((w, wIdx) => {
              const span = document.createElement('span');
              span.className = 'word-item word-span';
              span.setAttribute('data-caption-renderer', 'true');
              span.innerText = w;
              span.style.animationDelay = (wIdx * 0.07) + 's';
              layerDiv.appendChild(span);
            });
          }

          lineRow.appendChild(layerDiv);

          // Build Specimen Preview snippet
          specimenHtml += 
            '<div style="font-family: &quot;' + canonicalFamily + '&quot;, sans-serif; font-weight: ' + layer.fontWeight + '; font-style: ' + (layer.fontStyle || 'normal') + '; font-size: ' + Math.min(26, layer.fontSizePx) + 'px; color: ' + layer.color + '; letter-spacing: ' + (layer.letterSpacingEm || 0) + 'em; margin-top: ' + (layer.marginTopPx || 0) + 'px; line-height: 1.1;">' +
              layer.text +
            '</div>';

          // Inspector Table Row
          const tr = document.createElement('tr');
          tr.innerHTML = 
            '<td style="font-family: monospace; color: var(--accent-cyan); font-weight: 700;">' + layer.layerName + ' (' + layer.role + ')</td>' +
            '<td style="font-weight: 700;">' + canonicalFamily + ' ' + layer.fontWeight + ' ' + (layer.fontStyle === 'italic' ? 'Italic' : '') + ' • ' + layer.fontSizePx + 'px</td>' +
            '<td>' + (layer.casing || 'normal') + ' • ' + (layer.marginTopPx && !chunk.isInlineHorizontal ? layer.marginTopPx + 'px offset' : '0px inline') + '</td>' +
            '<td style="font-weight: 700; color: var(--accent-yellow);">' + layer.fxPreset + '</td>' +
            '<td style="font-weight: 700; color: ' + (isBehind ? 'var(--accent-pink)' : 'var(--accent-cyan)') + '">' + (isBehind ? 'ZONE A (Z:10)' : 'ZONE B (Z:30)') + '</td>';
          tableBody.appendChild(tr);
        });

        targetLayerGroup.appendChild(lineRow);
      });

      specimenPreview.innerHTML = specimenHtml;
      document.getElementById('viewSpecJson').innerText = JSON.stringify(chunk.rawProfile, null, 2);

      const isBehindHeadPlacement = (currentStudioMode === "test_matting") 
        ? (testModeDepthOverride === "behind_head") 
        : chunk.isHeadZone;

      if (chunk.coreSubjectMask) {
        headStage.appendChild(subjectMaskCoreGroup);
        subjectMaskCompanionStage.appendChild(layerGroup);
      } else if (isBehindHeadPlacement) {
        headStage.appendChild(layerGroup);
      } else {
        chestStage.appendChild(layerGroup);
      }

      // 🔊 TRIGGER CAUSAL SPATIO-TEMPORAL SOUND CUES FOR THIS CHUNK
      if (currentCausalSoundManifest && currentCausalSoundManifest.length > 0) {
        const chunkCues = currentCausalSoundManifest.filter(cue => cue.chunkIndex === chunk.chunkIndex);
        chunkCues.forEach(cue => {
          const offsetMs = Math.max(0, (cue.timeSec - (chunk.startSec || 0)) * 1000);
          setTimeout(() => {
            if (currentIndex === index) {
              playCausalSynthesizedCue(cue);
            }
          }, offsetMs);
        });
      }

      // Update Collapsible Anomaly Treatment Selector Drawer
      updateAnomalyDrawerForChunk(chunk, index);
    }

    // =========================================================================
    // ANIMA ANOMALY TREATMENT SELECTOR & GENERALIZED TAXONOMY ROUTER
    // =========================================================================
    const BRAND_ENTITIES = ["google", "instagram", "tesla", "apple", "microsoft", "amazon", "meta", "facebook", "twitter", "stripe", "openai", "github", "figma", "vercel", "shopify", "notion", "slack", "discord", "youtube", "tiktok", "netflix", "uber", "airbnb", "spotify"];
    const CONCRETE_TOOL_ENTITIES = ["tool", "tools", "screwdriver", "spanner", "wrench", "hammer", "pliers", "gear", "gears", "machinery", "hardware", "software", "instrument", "instruments", "engine", "calculator", "compiler", "terminal", "debugger", "workbench", "stack", "toolkit", "apparatus", "gadget"];
    const CONCEPT_ENTITIES = ["idea", "ideas", "strategy", "strategies", "focus", "vision", "clarity", "matters", "discipline", "leverage", "momentum", "principle", "principles", "mindset", "philosophy", "thesis", "priorities", "conviction"];
    const HUMAN_ROLE_ENTITIES = ["founder", "founders", "customer", "customers", "user", "users", "client", "clients", "developer", "developers", "engineer", "engineers", "designer", "designers", "creator", "creators", "leader", "leaders", "ceo", "cto", "doctor"];
    const CYCLICAL_ENTITIES = ["repeatedly", "again and again", "flywheel", "cycle", "loop", "compounding", "iteratively", "feedback loop", "recurring", "compound", "iteration"];
    const COMPARISON_KEYWORDS = ["versus", "vs", "compared to", "in contrast", "while", "difference between", "rather than", "instead of", "doesn't come from", "doesn't automatically", "not freedom"];

    function matchWordTokens(list, text) {
      return list.filter(item => new RegExp('\\b' + item + '\\b', 'i').test(text));
    }

    function routeChunkToArchetype(chunk) {
      const text = chunk.text;
      const lower = text.toLowerCase();
      const signals = [];

      const matchedTools = matchWordTokens(CONCRETE_TOOL_ENTITIES, text);
      const matchedBrands = matchWordTokens(BRAND_ENTITIES, text);
      const matchedCycles = matchWordTokens(CYCLICAL_ENTITIES, text);
      const matchedConcepts = matchWordTokens(CONCEPT_ENTITIES, text);
      const matchedRoles = matchWordTokens(HUMAN_ROLE_ENTITIES, text);
      const matchedComp = matchWordTokens(COMPARISON_KEYWORDS, text);

      const moneyMatch = text.match(/\$[\d,]+(\.\d+)?(\s*(k|m|b|thousand|million|billion|a month|per month))?/gi);
      const percentMatch = text.match(/\b\d+(\.\d+)?%/g) || (lower.includes("percent") ? ["percentage"] : []);

      // 1. Concrete Tools & Utility Instruments -> ANIMA #02 Micro Asset
      if (matchedTools.length > 0) {
        signals.push({
          id: 2, serial: "02", name: "Micro Asset (Concrete Tool / Utility Icon)", conf: 0.96,
          reason: "Concrete physical/digital utility instrument detected: " + matchedTools.join(', '),
          preset: "MICRO #01 (Mechanical Gear / Screwdriver / Spanner Vector Tool Asset)",
          z10: "Mechanical Vector Tooling Asset (" + matchedTools.join(', ') + ")",
          workflow: "1. Tokenizer extracts " + matchedTools[0] + " -> 2. Vector Registry queries canonical wrench/screwdriver/gear SVG -> 3. Parametric 60fps stroke drawing physics -> 4. Depth plane placement (Z:10 / Z:30) outside 14.79% scalp box.",
          audio: "HUD Optical Ping & Mechanical Ratchet Click (Z:10, 1400Hz)"
        });
      } else if (matchedBrands.length > 0) {
        signals.push({
          id: 2, serial: "02", name: "Micro Asset (Brand / Logo)", conf: 0.96,
          reason: "Brand/entity token(s): " + matchedBrands.join(', '),
          preset: "MICRO #01 (Dynamic Vector Brand Badge)",
          z10: "Brand Vector Logo Layer (" + matchedBrands.join(', ') + ")",
          workflow: "1. Brand token matched -> 2. Load official vector SVG -> 3. Ambient specular glow -> 4. Z:10 background anchoring.",
          audio: "HUD Optical Ping (Z:10, 1400Hz)"
        });
      }

      // 2. Compounding Loops & Flywheels -> ANIMA #49 Loop / Cycle
      if (matchedCycles.length > 0) {
        signals.push({
          id: 49, serial: "49", name: "Loop / Cycle (Compounding Flywheel)", conf: 0.98,
          reason: "Compounding cadence & feedback loop detected: " + matchedCycles.join(', '),
          preset: "LOOP #01 (Compounding Orbital Flywheel Loop)",
          z10: "Atomic Compounding Flywheel Loop",
          workflow: "1. Cyclic cadence detected -> 2. Load 3-node compounding flywheel orbital mesh -> 3. 60fps continuous angular velocity rotation -> 4. Sub-bass harmonic drone.",
          audio: "Master Orchestral Climax Slam (Z:10, 1200Hz)"
        });
      }

      // 3. Abstract Concepts & Strategy -> ANIMA #23 Concept Visualization
      if (matchedConcepts.length > 0) {
        const isFocus = matchedConcepts.some(c => c === "focus" || c === "matters" || c === "priorities");
        const isIdea = matchedConcepts.some(c => c === "idea" || c === "ideas");
        const isStrategy = matchedConcepts.some(c => c === "strategy" || c === "strategies");

        const assetTitle = isFocus ? "Precision Focus Target HUD & Crosshair" :
                           isIdea ? "Radiant Synapse / Lightbulb Burst Token" :
                           isStrategy ? "Strategic Chess Knight & Compass Node" : "Abstract Vector Concept Mesh";

        signals.push({
          id: 23, serial: "23", name: "Concept Visualization (" + matchedConcepts[0] + ")", conf: 0.94,
          reason: "Abstract mental principle or strategic token: " + matchedConcepts.join(', '),
          preset: "CONCEPT #01 (" + assetTitle + ")",
          z10: assetTitle,
          workflow: "1. Abstract cognitive noun mapped -> 2. Load semantic visual metaphor (" + assetTitle + ") -> 3. 60fps HUD pulse -> 4. Depth sync.",
          audio: "HUD Optical Scan Ping (Z:10, 1400Hz)"
        });
      }

      // 4. Human Roles & Personas -> ANIMA #15 Person / Character Asset
      if (matchedRoles.length > 0) {
        signals.push({
          id: 15, serial: "15", name: "Person / Character Asset (" + matchedRoles[0] + ")", conf: 0.95,
          reason: "Human archetype / professional role setup: " + matchedRoles.join(', '),
          preset: "PERSON #01 (Vintage Tech Founders Trio / Depth Matted Avatar)",
          z10: "Vintage Tech Founders Trio Asset Layer",
          workflow: "1. Role entity matched -> 2. Fetch depth matted portrait asset -> 3. Enforce 14.79% scalp clearance -> 4. Vocal EQ warming.",
          audio: "Mid-Field Vocal Warmth EQ (Z:20, 6500Hz)"
        });
      }

      // 5. Financial Figures -> ANIMA #05 Number / Statistic
      if (moneyMatch && moneyMatch.length > 0) {
        signals.push({
          id: 5, serial: "05", name: "Number / Statistic", conf: 0.97,
          reason: "Financial metric: " + moneyMatch.join(', '),
          preset: "STAT #01 (Giant 3D Punch-In Figure)",
          z10: "3D Number Punch Layer",
          workflow: "1. Extract numerical currency digits -> 2. Render 3D font JSON kinetic mesh -> 3. Overshoot spring punch.",
          audio: "Sub-Bass Heavy Impact Climax (Z:30, 18500Hz)"
        });
      }

      // 6. Percentages -> ANIMA #06 Percentage
      if (percentMatch && percentMatch.length > 0) {
        signals.push({
          id: 6, serial: "06", name: "Percentage", conf: 0.98,
          reason: "Percentage metric: " + percentMatch.join(', '),
          preset: "PERCENT #01 (Polar Arc Radial Gauge)",
          z10: "Radial Percentage Sweep",
          workflow: "1. Percentage token matched -> 2. Compute polar arc angle -> 3. 60fps radial SVG fill.",
          audio: "High-Freq Electronic Chirp (Z:30, 16000Hz)"
        });
      }

      // 7. Comparative Contrast -> ANIMA #07 Comparison
      if (matchedComp.length > 0) {
        signals.push({
          id: 7, serial: "07", name: "Comparison", conf: 0.90,
          reason: "Contrast / tension claim: " + matchedComp[0],
          preset: "COMP #01 (Split-Screen Contrast Claim)",
          z10: "Split Contrast Backdrop",
          workflow: "1. Comparative contrast detected -> 2. Split stage into dual comparative panes -> 3. Staggered comparison.",
          audio: "Stereo Split Left-Right Ping (Pan: -0.75 / +0.75)"
        });
      }

      // 8. Typography Fallback -> ANIMA #01 Typography
      if (signals.length === 0) {
        signals.push({
          id: 1, serial: "01", name: "Typography (Kinetic Text)", conf: 0.99,
          reason: "Direct verbal statement requiring pure typographic rhythm & focal emphasis",
          preset: chunk.profileName || "TYPO #01 (Apple Pro Display Hero Revealer)",
          z10: chunk.backgroundAsset ? chunk.backgroundAsset.assetName : "Standard Stage Backdrop",
          workflow: "1. Spoken spurt timing matched -> 2. Resolve font JSON pairing profile -> 3. Render 60fps subpixel blur.",
          audio: "Subpixel Keystroke Click (Z:30, 18500Hz)"
        });
      }

      signals.sort((a, b) => b.conf - a.conf);
      return {
        primary: signals[0],
        secondaries: signals.slice(1)
      };
    }

    function updateAnomalyDrawerForChunk(chunk, index) {
      const routing = routeChunkToArchetype(chunk);
      const p = routing.primary;

      const badgeEl = document.getElementById('anomalyActiveBadge');
      const confEl = document.getElementById('anomalyActiveConf');
      const nameEl = document.getElementById('anomalyActiveName');
      const reasonEl = document.getElementById('anomalyActiveReason');
      const z10El = document.getElementById('anomalyZ10');
      const z30El = document.getElementById('anomalyZ30');
      const audioEl = document.getElementById('anomalyAudio');
      const workflowEl = document.getElementById('anomalyWorkflow');

      if (badgeEl) badgeEl.innerText = 'ANIMA #' + p.serial;
      if (confEl) confEl.innerText = Math.round(p.conf * 100) + '% CONFIDENCE';
      if (nameEl) nameEl.innerText = p.name;
      if (reasonEl) reasonEl.innerText = p.reason;
      if (z10El) z10El.innerText = p.z10;
      if (z30El) z30El.innerText = p.preset;
      if (audioEl) audioEl.innerText = p.audio;
      if (workflowEl) workflowEl.innerText = p.workflow;

      // Update active row in matrix table
      document.querySelectorAll('.anomaly-table-row').forEach(r => r.classList.remove('active-row'));
      const activeRow = document.getElementById('anomalyRow_' + index);
      if (activeRow) {
        activeRow.classList.add('active-row');
        const tableWrap = activeRow.closest ? activeRow.closest('.anomaly-table-wrap') : null;
        if (tableWrap && typeof tableWrap.scrollTo === 'function') {
          const rowTop = activeRow.offsetTop || 0;
          const wrapHeight = tableWrap.clientHeight || 300;
          tableWrap.scrollTo({
            top: Math.max(0, rowTop - (wrapHeight / 2) + 20),
            behavior: 'smooth'
          });
        }
      }
    }

    function populateAnomalyMatrixTable() {
      const tbody = document.getElementById('anomalyMatrixTbody');
      if (!tbody) return;
      tbody.innerHTML = '';

      compiledSequence.forEach((chunk, idx) => {
        const routing = routeChunkToArchetype(chunk);
        const p = routing.primary;
        const tr = document.createElement('tr');
        tr.className = 'anomaly-table-row' + (idx === currentIndex ? ' active-row' : '');
        tr.id = 'anomalyRow_' + idx;
        tr.onclick = () => seekVideoAndJumpChunk(idx);

        tr.innerHTML = 
          '<td style="font-family:monospace; color:var(--accent-cyan); font-weight:800;">#' + (idx + 1 < 10 ? '0' : '') + (idx + 1) + '</td>' +
          '<td style="font-weight:700; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + chunk.text + '</td>' +
          '<td><span class="anomaly-badge" style="background:rgba(6,182,212,0.2); color:var(--accent-cyan); border:1px solid var(--accent-cyan);">' + p.serial + ' ' + p.name + '</span></td>' +
          '<td style="font-size:10px; color:var(--text-secondary);">' + p.preset + '</td>' +
          '<td style="font-size:10px; color:var(--accent-purple); font-family:monospace;">' + p.audio.split('(')[0] + '</td>';

        tbody.appendChild(tr);
      });
    }

    let currentInspectorView = 'provenance'; // 'provenance' | 'anima'

    function setInspectorView(mode) {
      currentInspectorView = mode;
      const btnProv = document.getElementById('segBtnProvenance');
      const btnAnima = document.getElementById('segBtnAnima');
      const btnSfx = document.getElementById('segBtnSfx');
      const viewProv = document.getElementById('viewInspectorProvenance');
      const viewAnima = document.getElementById('viewInspectorAnima');
      const viewSfx = document.getElementById('viewInspectorSfx');

      if (btnProv) btnProv.classList.toggle('active', mode === 'provenance');
      if (btnAnima) btnAnima.classList.toggle('active', mode === 'anima');
      if (btnSfx) btnSfx.classList.toggle('active', mode === 'sfx');
      if (viewProv) viewProv.style.display = (mode === 'provenance') ? 'flex' : 'none';
      if (viewAnima) viewAnima.style.display = (mode === 'anima') ? 'flex' : 'none';
      if (viewSfx) viewSfx.style.display = (mode === 'sfx') ? 'flex' : 'none';

      if (mode === 'sfx') {
        renderSfxIntelligenceTab();
      }
    }

    // 7. REAL-TIME SPOKEN TIMELINE & SPOKEN AUDIO TIMEUPDATE SYNCHRONIZATION
    let currentTimelineSec = 0.0;
    let timelineClockInterval = null;

    function startTimelineClock() {
      if (timelineClockInterval) clearInterval(timelineClockInterval);
      timelineClockInterval = setInterval(() => {
        if (!compiledSequence || compiledSequence.length === 0 || !isPlaying) return;
        currentTimelineSec += 0.05;

        const min = Math.floor(currentTimelineSec / 60);
        const sec = (currentTimelineSec % 60).toFixed(2);
        const clockEl = document.getElementById('lblVideoClock');
        if (clockEl) clockEl.innerText = (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;

        // Find exact chunk matching current timeline time
        const curChunkIdx = compiledSequence.findIndex(c => currentTimelineSec >= c.startSec && currentTimelineSec < c.endSec);
        if (curChunkIdx !== -1 && curChunkIdx !== currentIndex) {
          renderPresentationChunk(curChunkIdx);
          notifyParentPlaybackState();
        }

        // Loop Spurt or wrap handling
        if (isLoopingSpurt) {
          const c = compiledSequence[currentIndex];
          if (c && currentTimelineSec >= c.endSec) {
            currentTimelineSec = c.startSec;
          }
        } else {
          const lastChunk = compiledSequence[compiledSequence.length - 1];
          if (lastChunk && currentTimelineSec >= lastChunk.endSec) {
            const firstChunk = compiledSequence[0];
            currentTimelineSec = firstChunk ? firstChunk.startSec : 0.0;
            renderPresentationChunk(0);
            notifyParentPlaybackState();
          }
        }
      }, 50);
    }

    function stopTimelineClock() {
      if (timelineClockInterval) {
        clearInterval(timelineClockInterval);
        timelineClockInterval = null;
      }
    }

    // 8. PLAYBACK CONTROLS & DUAL PAUSE FREEZE ENGINE
    function applyPlaybackPauseState() {
      const playBtn = document.getElementById('btnPlay');
      if (playBtn) playBtn.innerText = isPlaying ? '⏸ Pause' : '▶ Play';

      const stage = document.querySelector('.stage-container');
      if (isPlaying) {
        document.body.classList.remove('is-paused');
        if (stage) stage.classList.remove('is-paused');
        startTimelineClock();
      } else {
        document.body.classList.add('is-paused');
        if (stage) stage.classList.add('is-paused');
        stopTimelineClock();
      }
      notifyParentPlaybackState();
    }

    function togglePlay() {
      isPlaying = !isPlaying;
      applyPlaybackPauseState();
    }

    function toggleLoopSpurt() {
      isLoopingSpurt = !isLoopingSpurt;
      const btn = document.getElementById('btnLoopSpurt');
      if (btn) {
        btn.innerText = '🔄 Loop Spurt: ' + (isLoopingSpurt ? 'ON' : 'OFF');
        btn.classList.toggle('active', isLoopingSpurt);
      }
    }

    function toggleAudioMode() {
      toggleSoundMute();
      const btn = document.getElementById('btnAudioMode');
      if (btn) {
        btn.innerText = isSoundMuted ? '🔇 SFX: MUTED' : '🔊 SFX: ACTIVE';
      }
    }

    function nextChunk() {
      const nextIdx = (currentIndex + 1) % compiledSequence.length;
      seekVideoAndJumpChunk(nextIdx);
    }

    function prevChunk() {
      const prevIdx = (currentIndex - 1 + compiledSequence.length) % compiledSequence.length;
      seekVideoAndJumpChunk(prevIdx);
    }

    function jumpTo(idx) {
      seekVideoAndJumpChunk(idx);
    }

    function restartTimer() {
      clearInterval(playTimer);
      playTimer = null;
    }

    function toggleBbox() {
      showBbox = !showBbox;
      document.getElementById('mediapipeFaceOverlay').style.opacity = showBbox ? '1' : '0';
      document.getElementById('btnToggleBbox').innerText = '📐 Wireframe: ' + (showBbox ? 'ON' : 'OFF');
      document.getElementById('btnToggleBbox').classList.toggle('active', showBbox);
    }

    function reRollTreatment() {
      currentSeed = Math.floor(Math.random() * 90000) + 100;
      document.getElementById('lblActiveSeed').innerText = '#' + currentSeed;
      compiledSequence = compileDynamicSequence(currentSeed);
      renderRunSetImageReferenceRibbon();
      seekVideoAndJumpChunk(0);
    }

    function resetSeed(seedNum) {
      currentSeed = seedNum;
      document.getElementById('lblActiveSeed').innerText = '#' + currentSeed;
      compiledSequence = compileDynamicSequence(currentSeed);
      renderRunSetImageReferenceRibbon();
      seekVideoAndJumpChunk(0);
    }

    // 9. VIEW MODE SWITCHER
    function setViewMode(mode) {
      currentViewMode = mode;
      if (document.querySelectorAll) {
        document.querySelectorAll('.tab-btn').forEach(b => { if (b.classList) b.classList.remove('active'); });
      }

      const syncCard = document.getElementById('syncVideoCard');
      const stageBg = document.getElementById('stageVideoBg');
      const mainLayout = document.getElementById('mainAppLayout');
      const runSetStrip = document.getElementById('runSetRefStrip');
      const galleryPanel = document.getElementById('corpusGalleryPanel');
      const analyticsPanel = document.getElementById('analyticsLabPanel');

      if (syncCard) syncCard.style.display = 'none';
      if (stageBg) stageBg.style.display = 'none';
      if (mainLayout) mainLayout.style.display = 'flex';
      if (runSetStrip) runSetStrip.style.display = 'block';
      if (galleryPanel) galleryPanel.style.display = 'none';
      if (analyticsPanel) analyticsPanel.style.display = 'none';

      const tabPres = document.getElementById('tabPresentation');
      const tabSplit = document.getElementById('tabSplitVideo');
      const tabVbg = document.getElementById('tabVideoBg');
      const tabGal = document.getElementById('tabGallery');
      const tabAna = document.getElementById('tabAnalytics');

      if (mode === 'presentation') {
        if (tabPres && tabPres.classList) tabPres.classList.add('active');
      } else if (mode === 'split') {
        if (tabSplit && tabSplit.classList) tabSplit.classList.add('active');
        if (syncCard) syncCard.style.display = 'block';
      } else if (mode === 'video_bg') {
        if (tabVbg && tabVbg.classList) tabVbg.classList.add('active');
        if (stageBg) stageBg.style.display = 'block';
      } else if (mode === 'gallery') {
        if (tabGal && tabGal.classList) tabGal.classList.add('active');
        if (mainLayout) mainLayout.style.display = 'none';
        if (runSetStrip) runSetStrip.style.display = 'none';
        if (galleryPanel) galleryPanel.style.display = 'flex';
        renderCorpusGallery();
      } else if (mode === 'analytics') {
        if (tabAna && tabAna.classList) tabAna.classList.add('active');
        if (mainLayout) mainLayout.style.display = 'none';
        if (runSetStrip) runSetStrip.style.display = 'none';
        if (analyticsPanel) analyticsPanel.style.display = 'flex';
        initAnalyticsLab();
      }
    }

    function showSpecTab(tab) {
      if (document.querySelectorAll) {
        document.querySelectorAll('.spec-tab-btn').forEach(b => { if (b.classList) b.classList.remove('active'); });
      }
      const vTable = document.getElementById('viewSpecTable');
      const vJson = document.getElementById('viewSpecJson');
      const vPlay = document.getElementById('viewSpecPlayground');
      if (vTable) vTable.style.display = tab === 'table' ? 'block' : 'none';
      if (vJson) vJson.style.display = tab === 'json' ? 'block' : 'none';
      if (vPlay) vPlay.style.display = tab === 'playground' ? 'flex' : 'none';

      const tTable = document.getElementById('tabSpecTable');
      const tJson = document.getElementById('tabSpecJson');
      const tPlay = document.getElementById('tabSpecPlayground');
      if (tab === 'table' && tTable && tTable.classList) tTable.classList.add('active');
      if (tab === 'json' && tJson && tJson.classList) tJson.classList.add('active');
      if (tab === 'playground') {
        if (tPlay && tPlay.classList) tPlay.classList.add('active');
        const input = document.getElementById('playgroundInput');
        updatePlaygroundSpecimen(input ? input.value : 'System Architecture');
      }
    }

    function updatePlaygroundSpecimen(customText) {
      const chunk = compiledSequence[currentIndex];
      if (!chunk) return;
      const stage = document.getElementById('playgroundPreviewStage');
      let html = '';
      chunk.layers.forEach(l => {
        const canonical = resolveCanonicalGoogleFontFamily(l.fontFamily);
        html += '<div style="font-family: &quot;' + canonical + '&quot;, sans-serif; font-weight: ' + l.fontWeight + '; font-style: ' + (l.fontStyle || 'normal') + '; font-size: ' + Math.min(28, l.fontSizePx) + 'px; color: ' + l.color + '; letter-spacing: ' + (l.letterSpacingEm || 0) + 'em; margin-top: 4px;">' + (customText || l.text) + '</div>';
      });
      stage.innerHTML = html;
    }

    function enlargeReferenceImage() {
      const chunk = compiledSequence[currentIndex];
      if (!chunk) return;
      document.getElementById('imgModalSrc').src = chunk.imageUrl;
      document.getElementById('imgModalTitle').innerText = '[' + chunk.imageFilename + '] ' + chunk.profileName.replace(/_/g, ' ');
      document.getElementById('imgModalOverlay').style.display = 'flex';
    }

    function closeImageModal() {
      document.getElementById('imgModalOverlay').style.display = 'none';
    }

    // 10. CORPUS GALLERY ENGINE (MODE 2)
    let galleryFilter = 'all';
    function renderCorpusGallery() {
      const grid = document.getElementById('galleryCardsGrid');
      grid.innerHTML = '';

      const usageMap = {};
      compiledSequence.forEach(c => {
        usageMap[c.imageFilename] = (usageMap[c.imageFilename] || 0) + 1;
      });

      const list = ALL_FONT_PROFILES.filter(p => {
        const usage = usageMap[p._imageFilename] || 0;
        if (galleryFilter === 'runset' && usage === 0) return false;
        if (galleryFilter === 'multi' && usage < 2) return false;
        if (galleryFilter === 'unused' && usage > 0) return false;
        return true;
      });

      list.forEach(p => {
        const usage = usageMap[p._imageFilename] || 0;
        const card = document.createElement('article');
        card.className = 'corpus-card';

        let layersPreview = '';
        (p.typography_layers || []).forEach(l => {
          const font = (l.matched_font_candidates && l.matched_font_candidates[0]) ? l.matched_font_candidates[0] : 'DM Sans';
          const canonical = resolveCanonicalGoogleFontFamily(font);
          const st = l.font_style || {};
          const safeColor = resolveFaithfulFontJsonColor(st.color);
          layersPreview += 
            '<div style="font-family: &quot;' + canonical + '&quot;, sans-serif; font-weight: ' + (st.weight || 700) + '; font-style: ' + (st.style || 'normal') + '; font-size: ' + Math.min(22, st.size_px_base || 20) + 'px; color: ' + safeColor + '; letter-spacing: ' + (st.letter_spacing_em || 0) + 'em; line-height: 1.1;">' +
              (l.sample_text || l.layer_name) +
            '</div>';
        });

        card.innerHTML = 
          '<div class="corpus-card-header">' +
            '<div class="corpus-card-title">' +
              '<span>' + p._imageFilename + '</span>' +
              (usage > 0 ? '<span class="usage-badge usage-multi">' + usage + 'x In Run Set</span>' : '<span class="usage-badge usage-single">Unused</span>') +
            '</div>' +
            (usage > 0 ? '<button class="btn-secondary btn-gal-jump" style="padding: 2px 8px; font-size: 10px;" data-img="' + p._imageFilename + '">▶ Jump to Video</button>' : '') +
          '</div>' +
          '<div class="corpus-preview-stage">' +
            '<div class="corpus-ref-col">' +
              '<img class="gal-thumb" src="' + p._imageUrl + '" alt="' + p._imageFilename + '" loading="lazy" data-img-url="' + p._imageUrl + '" data-img-title="' + p.profile_name + '">' +
            '</div>' +
            '<div class="corpus-render-col">' +
              layersPreview +
            '</div>' +
          '</div>' +
          '<div class="corpus-card-footer">' +
            '<span>' + (p.metadata?.overall_mood || 'Editorial Pairing') + '</span>' +
            '<span>' + (p.typography_layers?.length || 2) + ' Layers</span>' +
          '</div>';

        const jumpBtn = card.querySelector('.btn-gal-jump');
        if (jumpBtn) {
          jumpBtn.addEventListener('click', () => jumpFromGalleryToRunSet(p._imageFilename));
        }

        const thumb = card.querySelector('.gal-thumb');
        if (thumb) {
          thumb.addEventListener('click', () => enlargeGalleryImage(p._imageUrl, p.profile_name));
        }

        grid.appendChild(card);
      });
    }

    function filterGallery(flt) {
      galleryFilter = flt;
      document.querySelectorAll('.gallery-filter-chips button').forEach(b => b.classList.remove('active'));
      if (flt === 'all') document.getElementById('galFltAll').classList.add('active');
      if (flt === 'runset') document.getElementById('galFltRunSet').classList.add('active');
      if (flt === 'multi') document.getElementById('galFltMulti').classList.add('active');
      if (flt === 'unused') document.getElementById('galFltUnused').classList.add('active');
      renderCorpusGallery();
    }

    function searchGallery(query) {
      const q = query.toLowerCase();
      document.querySelectorAll('.corpus-card').forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(q) ? 'flex' : 'none';
      });
    }

    function jumpFromGalleryToRunSet(imageFilename) {
      const idx = compiledSequence.findIndex(c => c.imageFilename === imageFilename);
      if (idx !== -1) {
        setViewMode('presentation');
        seekVideoAndJumpChunk(idx);
      }
    }

    function enlargeGalleryImage(url, title) {
      document.getElementById('imgModalSrc').src = url;
      document.getElementById('imgModalTitle').innerText = title.replace(/_/g, ' ');
      document.getElementById('imgModalOverlay').style.display = 'flex';
    }

    // 11. COMBINATION GRAPH & ANALYTICS LAB ENGINE (MODE 3)
    let multiRunSimulationResults = null;
    function initAnalyticsLab() {
      const usageMap = {};
      ALL_FONT_PROFILES.forEach(p => { usageMap[p._filename] = 0; });
      compiledSequence.forEach(c => {
        if (usageMap[c.profileFilename] !== undefined) usageMap[c.profileFilename] += 1;
      });

      const activeCount = Object.values(usageMap).filter(v => v > 0).length;
      document.getElementById('kpiActiveCount').innerText = activeCount + ' / 45';
      document.getElementById('kpiActiveRate').innerText = Math.round((activeCount / 45) * 100) + '% Coverage in Seed #' + currentSeed;
      document.getElementById('kpiUnderCount').innerText = Object.values(usageMap).filter(v => v < 2).length + ' Profiles';

      renderNetworkGraph(usageMap);
      renderUtilizationRanking(usageMap);
    }

    function renderNetworkGraph(usageMap) {
      const svg = document.getElementById('networkGraphSvg');
      svg.innerHTML = '';
      const W = 920, H = 560;
      const cx = W / 2, cy = H / 2;
      const rProfiles = 230;

      ALL_FONT_PROFILES.forEach((pObj, idx) => {
        const angle = (idx / ALL_FONT_PROFILES.length) * 2 * Math.PI - Math.PI / 2;
        const px = cx + rProfiles * Math.cos(angle);
        const py = cy + rProfiles * Math.sin(angle);
        const usage = usageMap[pObj._filename] || 0;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.style.cursor = 'pointer';

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', px);
        circle.setAttribute('cy', py);
        circle.setAttribute('r', usage > 0 ? '9' : '5');
        circle.setAttribute('fill', usage > 0 ? '#00F0FF' : '#1A233A');
        circle.setAttribute('stroke', usage > 0 ? '#FFF' : '#FF0055');
        circle.setAttribute('stroke-width', '1.5');
        g.appendChild(circle);

        if (usage > 0) {
          const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          t.setAttribute('x', px);
          t.setAttribute('y', py + 3);
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-size', '8');
          t.setAttribute('font-weight', '900');
          t.setAttribute('fill', '#070913');
          t.textContent = usage + 'x';
          g.appendChild(t);
        }

        const numId = pObj._filename.match(/\\d+/)?.[0] || '';
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const lx = px + 14 * Math.cos(angle);
        const ly = py + 14 * Math.sin(angle);
        label.setAttribute('x', lx);
        label.setAttribute('y', ly + 3);
        label.setAttribute('text-anchor', px > cx ? 'start' : 'end');
        label.setAttribute('font-size', '9');
        label.setAttribute('font-weight', usage > 0 ? '800' : '500');
        label.setAttribute('fill', usage > 0 ? '#00F0FF' : '#8E9BAE');
        label.textContent = '#' + numId;
        g.appendChild(label);

        g.onclick = () => {
          jumpFromGalleryToRunSet(pObj._imageFilename);
        };

        svg.appendChild(g);
      });
    }

    function renderUtilizationRanking(usageMap) {
      const container = document.getElementById('rankingListContainer');
      container.innerHTML = '';

      const list = [...ALL_FONT_PROFILES].map(p => ({
        ...p,
        usageCount: usageMap[p._filename] || 0
      })).sort((a, b) => b.usageCount - a.usageCount);

      list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'ranking-item';
        div.onclick = () => jumpFromGalleryToRunSet(item._imageFilename);

        const badgeClass = item.usageCount >= 2 ? 'badge-active' : (item.usageCount === 1 ? 'badge-active' : 'badge-zero');
        const badgeText = item.usageCount > 0 ? (item.usageCount + 'x IN RUN') : 'UNUSED (0)';
        const barPct = Math.min(100, Math.max(8, item.usageCount * 50));
        const barColor = item.usageCount >= 2 ? '#10B981' : (item.usageCount === 1 ? '#00F0FF' : '#FF0055');

        div.innerHTML = 
          '<div class="ranking-item-top">' +
            '<div class="rank-name">[' + item._imageFilename + '] ' + item.profile_name.replace(/_/g, ' ') + '</div>' +
            '<span class="rank-badge ' + badgeClass + '">' + badgeText + '</span>' +
          '</div>' +
          '<div class="rank-bar-bg">' +
            '<div class="rank-bar-fill" style="width: ' + barPct + '%; background: ' + barColor + ';"></div>' +
          '</div>';
        container.appendChild(div);
      });
    }

    function runMonteCarloSimulation(numSeeds = 100) {
      document.getElementById('kpiSimCoverage').innerText = 'Simulating...';
      setTimeout(() => {
        const simCounts = {};
        ALL_FONT_PROFILES.forEach(p => { simCounts[p._filename] = 0; });

        for (let s = 1; s <= numSeeds; s++) {
          const testSeed = (s * 7919) % 99999 + 10;
          const seq = compileDynamicSequence(testSeed);
          seq.forEach(chunk => {
            if (simCounts[chunk.profileFilename] !== undefined) {
              simCounts[chunk.profileFilename] += 1;
            }
          });
        }

        multiRunSimulationResults = simCounts;
        const totalUsed = Object.values(simCounts).filter(v => v > 0).length;
        const pct = Math.round((totalUsed / 45) * 100);
        document.getElementById('kpiSimCoverage').innerText = pct + '% (' + totalUsed + '/45)';
        alert('✔ 100-Seed Monte Carlo Complete!\\n\\nCorpus Profile Coverage: ' + pct + '% (' + totalUsed + ' out of 45 profiles chosen across ' + (numSeeds * 20) + ' chunks).');
      }, 50);
    }

    // INITIAL BOOTSTRAP
    compiledSequence = compileDynamicSequence(currentSeed);
    renderRunSetImageReferenceRibbon();
    populateAnomalyMatrixTable();
    seekVideoAndJumpChunk(0);
    applyPlaybackPauseState();
  </script>
</body>
</html>`;

const outHtmlPath = path.join(studioDir, "typography_treatment_presentation.html");
fs.writeFileSync(outHtmlPath, htmlContent);
console.log("SUCCESSFULLY_BUILT_AUTHORITATIVE_FONT_JSON_STUDIO:", outHtmlPath);
