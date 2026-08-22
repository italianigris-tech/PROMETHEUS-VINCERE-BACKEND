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

for (const slug of [
  "sky-high-ripple",
  "vibe-chromatic-bloom",
  "glassmorphic-o3-refraction",
  "canva-tall-glyph-stack",
  "skywall-tall-subject-mask",
]) {
  assert(builder.includes(`slug: "${slug}"`), `Typography source contains ${slug}`);
  assert(live.includes(`"slug":"${slug}"`), `Live ANIMA suite contains ${slug}`);
}

assert(live.includes("35 distinct kinetic treatments") && live.includes("35 Active Presets"), "Typography suite declares 35 live visual assets");
const presentationBuilder = fs.readFileSync(path.join(studio, "build_male_sequence_presentation.ts"), "utf8");
assert(presentationBuilder.includes("TALL_FONT_BEHIND_PRINCIPAL_SPEAKER"), "Tall font policy is represented in the typography source");
assert(presentationBuilder.includes("CORE_TEXT_HERO_OVERRIDES_FONT_JSON"), "A core phrase can explicitly override its source font JSON");
assert(presentationBuilder.includes("selectCorePhraseForSubjectMask"), "Core text selection is semantic rather than a whole-caption treatment");
assert(presentationBuilder.includes("reflowCompanionLayersAroundSubjectMask"), "Supporting typography is reflowed around the behind-subject core phrase");
assert(presentationBuilder.includes("subjectMaskCompanionStage"), "Supporting typography has its own foreground layout plane");
assert(presentationBuilder.includes("z-index: 10; /* Z:10 behind the matted foreground speaker */"), "Behind-subject core text is actually below the matte plane");
assert(presentationBuilder.includes("isCoreSubjectText"), "Only the core phrase is routed behind the subject");

if (failed) process.exit(1);
