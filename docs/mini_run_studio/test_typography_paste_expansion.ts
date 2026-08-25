import * as fs from "node:fs";
import * as path from "node:path";

let failed = 0;
function assert(condition: boolean, message: string) {
  if (condition) console.log(`PASS: ${message}`);
  else { console.error(`FAIL: ${message}`); failed++; }
}

const studio = __dirname;
const builder = fs.readFileSync(path.join(studio, "build_anima_studio.ts"), "utf8");
const live = fs.readFileSync(path.join(studio, "anima_studio.html"), "utf8");

assert(builder.includes(`slug: "canva-tall-glyph-stack"`), `Typography source contains canva-tall-glyph-stack`);
assert(live.includes(`"slug":"canva-tall-glyph-stack"`), `Live ANIMA suite contains canva-tall-glyph-stack`);

for (const deletedSlug of [
  "sky-high-ripple",
  "vibe-chromatic-bloom",
  "glassmorphic-o3-refraction",
  "skywall-tall-subject-mask",
  "see-through-letterform",
  "wall-man-z-plane"
]) {
  assert(!builder.includes(`slug: "${deletedSlug}"`), `Typography source does NOT contain deleted ${deletedSlug}`);
  assert(!live.includes(`"slug":"${deletedSlug}"`), `Live ANIMA suite does NOT contain deleted ${deletedSlug}`);
}

assert(live.includes("41 distinct kinetic treatments") && live.includes("41 Active Presets"), "Typography suite declares 41 live visual assets");

for (const newSlug of [
  "hightech-kinetic-brands",
  "kinetic-cyber-they-need",
  "kinetic-glow-sweep-attention",
  "kinetic-word-fast-pulse",
  "kinetic-dynamic-slant-move",
  "kinetic-chromatic-typewriter",
  "3d-metallic-chrome-counter",
  "apple-gaussian-chrome-goal",
  "cinematic-apple-word-bounce",
  "cinematic-distance-convergence"
]) {
  assert(builder.includes(`slug: "${newSlug}"`), `Typography source contains ${newSlug}`);
  assert(live.includes(`"slug":"${newSlug}"`), `Live ANIMA suite contains ${newSlug}`);
}
const presentationBuilder = fs.readFileSync(path.join(studio, "build_male_sequence_presentation.ts"), "utf8");
assert(presentationBuilder.includes("TALL_FONT_BEHIND_PRINCIPAL_SPEAKER"), "Tall font policy is represented in the typography source");
assert(presentationBuilder.includes("CORE_TEXT_HERO_OVERRIDES_FONT_JSON"), "A core phrase can explicitly override its source font JSON");
assert(presentationBuilder.includes("selectCorePhraseForSubjectMask"), "Core text selection is semantic rather than a whole-caption treatment");
assert(presentationBuilder.includes("reflowCompanionLayersAroundSubjectMask"), "Supporting typography is reflowed around the behind-subject core phrase");
assert(presentationBuilder.includes("subjectMaskCompanionStage"), "Supporting typography has its own foreground layout plane");
assert(presentationBuilder.includes("z-index: 10; /* Z:10 behind the matted foreground speaker */"), "Behind-subject core text is actually below the matte plane");
assert(presentationBuilder.includes("isCoreSubjectText"), "Only the core phrase is routed behind the subject");

if (failed) process.exit(1);
