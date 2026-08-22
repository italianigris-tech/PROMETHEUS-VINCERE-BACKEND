import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { checkStudioAssets, checkPythonEnvironment } from "./preflight_environment_check.js";

const studioDir = __dirname;
const repoRoot = path.resolve(studioDir, "../..");

// Helper to convert asset files to inline Base64
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
}

const goldilocksHeadStageTopPercent = 9.8;

// 3. LOAD ALL 45 AUTHORITATIVE FONT JSON PROFILES
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
      _imageExists: imageExists
    };
  } catch (e) {
    return null;
  }
}).filter(Boolean);

console.log(`[FONT_CORPUS_LOADER] Loaded ${allFontProfiles.length} authoritative Font JSON profiles.`);

// 4. LOAD ASSETS FOR TRANSCRIPT 3
const focusTargetBase64 = getBase64DataUriFromPath(path.join(studioDir, "transcript3_focus_target.svg"));
const chaseQuadrantBase64 = getBase64DataUriFromPath(path.join(studioDir, "transcript3_chase_quadrant.svg"));
const atomicFlywheelBase64 = getBase64DataUriFromPath(path.join(studioDir, "transcript3_atomic_flywheel.svg"));
const foundersTrioBase64 = getBase64DataUriFromPath(path.join(studioDir, "tech_founders_vintage_trio.jpg"));

// 5. AUTHORITATIVE 20-CHUNK RAW SPOKEN TRANSCRIPT (Script #3: Founders Focus & Execution)
const rawSpokenChunksTranscript3 = [
  { chunkIndex: 1, timestamp: "00:00 — 00:02", startSec: 0.0, endSec: 2.0, text: "Most founders", emphasis: "context", preferredProfile: "image (21).json", assetType: "image", assetData: foundersTrioBase64, assetPosition: "behind_head" },
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

// Write video cues manifest for Transcript 3
fs.writeFileSync(
  path.join(studioDir, "authoritative_video_cues_transcript3.json"),
  JSON.stringify(rawSpokenChunksTranscript3, null, 2),
  "utf-8"
);

// 6. BUILD SPATIO-TEMPORAL SOUND DESIGN MANIFEST FOR TRANSCRIPT 3
const soundTreatmentTranscript3 = rawSpokenChunksTranscript3.map((chunk, idx) => {
  let sfxCategory = "MECHANICAL CLICKS";
  let sfxName = "Typewriter Single Strike";
  let sfxFile = "SOUND FX/TEXT/type-writing-6834.mp3";
  let stereoPan = 0.0;
  let depthPlane = 30;
  let lowpassCutoffHz = 18500;
  let gainDb = -6.0;

  if (chunk.emphasis === "hero_concept") {
    sfxCategory = "IMPACTS";
    sfxName = "Focus Target Lock Accent";
    sfxFile = "SOUND FX/IMPACTS/ES_Punch Sub - SFX Producer.mp3";
    stereoPan = 0.75;
    depthPlane = 10;
    lowpassCutoffHz = 1400;
    gainDb = -4.5;
  } else if (chunk.emphasis.startsWith("enumeration")) {
    sfxCategory = "WOODBLOCK TICKS";
    sfxName = `Quadrant Item Step #${chunk.chunkIndex - 10}`;
    sfxFile = "SOUND FX/TEXT/dragon-studio-typing-with-keyboard-435489.mp3";
    stereoPan = -0.75;
    depthPlane = 20;
    lowpassCutoffHz = 6500;
    gainDb = -6.0;
  } else if (chunk.emphasis === "terminal_payoff") {
    sfxCategory = "ORCHESTRAL CLIMAX";
    sfxName = "Atomic Compounding Climax Braaam";
    sfxFile = "SOUND FX/IMPACTS/Braaam - Deep Metal Horn (Sub Drop) - (Nikko Hunt's S.D.Essentials).wav";
    stereoPan = 0.0;
    depthPlane = 10;
    lowpassCutoffHz = 18500;
    gainDb = -3.5;
  } else if (chunk.emphasis === "transition") {
    sfxCategory = "SWOOSHES";
    sfxName = "Jump Swish Swoosh";
    sfxFile = "SOUND FX/SWOOSHES/ES_Jump Swish - SFX Producer.mp3";
    stereoPan = 0.0;
    depthPlane = 20;
    lowpassCutoffHz = 12000;
    gainDb = -7.0;
  }

  return {
    id: `cue_t3_${String(chunk.chunkIndex).padStart(2, "0")}`,
    chunkIndex: chunk.chunkIndex,
    timestampSeconds: chunk.startSec,
    frame: Math.round(chunk.startSec * 30),
    spokenText: chunk.text,
    emphasis: chunk.emphasis,
    visualTrigger: {
      type: chunk.assetType !== "none" ? "ASSET_HERO_TRIGGER" : "TYPOGRAPHY_KINETIC_TRIGGER",
      elementName: chunk.text,
      screenXPercent: stereoPan < 0 ? 20 : (stereoPan > 0 ? 80 : 50),
      screenYPercent: 40
    },
    soundDesign: {
      category: sfxCategory,
      soundName: sfxName,
      soundFile: sfxFile,
      stereoPan: stereoPan,
      depthPlane: depthPlane,
      lowpassCutoffHz: lowpassCutoffHz,
      gainDb: gainDb,
      durationEstimateSec: 0.8
    }
  };
});

fs.writeFileSync(
  path.join(studioDir, "authoritative_sound_treatment_transcript3.json"),
  JSON.stringify(soundTreatmentTranscript3, null, 2),
  "utf-8"
);

console.log("[TRANSCRIPT3_BUILDER] Successfully compiled video cues and spatial sound treatment for Transcript 3.");
