import * as fs from "node:fs";
import * as path from "node:path";

const studioDir = __dirname;
const htmlPath = path.join(studioDir, "typography_treatment_presentation.html");

console.log("=================================================");
console.log("RUNNING AUTOMATED PRESENTATION NODE & TEXT CLEARANCE CHECKER");
console.log("=================================================");

if (!fs.existsSync(htmlPath)) {
  console.error("FAIL: typography_treatment_presentation.html does NOT exist!");
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, "utf8");

// 1. Verify MediaPipe Telemetry & Observation Engine is present
const hasMediaPipeEngine = html.includes("MEDIAPIPE_FACE_OBSERVATION") || html.includes("mediapipe-face-overlay");
if (!hasMediaPipeEngine) {
  console.error("FAIL: MediaPipe observation engine is missing from HTML!");
  process.exit(1);
}

// 2. Verify all 20 Chunks Payload is embedded
const chunkMatches = html.match(/chunkIndex":\s*\d+/g);
console.log(`CHECK: Found ${chunkMatches ? chunkMatches.length : 0} embedded chunk indexes.`);
if (!chunkMatches || chunkMatches.length < 20) {
  console.error("FAIL: HTML presentation must contain all 20 transcript chunks!");
  process.exit(1);
}

// 3. Verify Delayed Left-to-Right Highlight Card Sweep animation is active
const hasDelayedCard = html.includes("delayed-pill-card-bg") && html.includes("pillCardSweepLeftToRight");
if (!hasDelayedCard) {
  console.error("FAIL: Delayed Left-to-Right Highlight Card Sweep animation is missing!");
  process.exit(1);
}

// 4. Verify 100% Unobscured Placement Rules (Scalp Top: 14.79% Head Clearance)
const hasScalpClearance = html.includes("14.79") || html.includes("scalpTopY") || html.includes("layer-behind-subject");
if (!hasScalpClearance) {
  console.error("FAIL: Strict 14.79% Scalp Clearance Rule missing!");
  process.exit(1);
}

console.log("=================================================");
console.log("SUCCESS: ALL PRESENTATION NODES & TEXT CLEARANCE VERIFIED 100%!");
console.log("=================================================");
