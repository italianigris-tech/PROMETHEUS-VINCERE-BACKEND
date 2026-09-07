/**
 * TEST: Landscape Typography Whitelist & 5-8 Word Chunker Invariants
 *
 * Verifies:
 * 1. Chunker enforces 5-8 words per chunk for normal speech.
 * 2. Words > 8 or explicit quotes trigger `isQuote: true` and `quote_kinetic_treatment`.
 * 3. Chunker produces valid word offsets and hero word selection.
 * 4. Whitelist is strictly limited to the 9 authorized presets.
 * 5. Generated/Template presentation HTML contains keyframes and CSS for all 9 presets.
 */

import { chunkLandscapeTranscript, LANDSCAPE_KINETIC_WHITELIST, type LandscapeKineticPreset } from "../landscape_chunker.js";
import { LANDSCAPE_KINETIC_PRESETS } from "../landscape_typography_engine.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`✅ [PASS] ${msg}`);
  } else {
    console.error(`❌ [FAIL] ${msg}`);
  }
}

console.log("--- Testing Landscape Chunker (5-8 Words) ---");

// Test 1: Standard speech paragraph
const sampleText = "In the heart of high performance video systems, the architecture must never compromise under load. When scale demands rapid processing, distributed pipelines ensure that every frame executes with mathematical precision.";
const chunks = chunkLandscapeTranscript(sampleText, { startSec: 0, durationSec: 20 });

assert(chunks.length > 0, `Generated ${chunks.length} chunks`);

for (const c of chunks) {
  if (!c.isQuote) {
    assert(c.wordCount >= 5 && c.wordCount <= 8, `Chunk ${c.chunkIndex} word count ${c.wordCount} within 5-8 bounds ("${c.text}")`);
  }
  assert(LANDSCAPE_KINETIC_WHITELIST.includes(c.animationPreset), `Preset ${c.animationPreset} is in whitelisted 9 presets`);
  assert(c.words.length === c.wordCount, `Word breakdown length (${c.words.length}) matches word count (${c.wordCount})`);
  assert(c.heroWord.length > 0, `Hero word extracted: "${c.heroWord}"`);
}

// Test 2: Quote handling
const quoteText = 'Albert Einstein once remarked: "Imagination is more important than knowledge, for knowledge is limited, whereas imagination embraces the entire world."';
const quoteChunks = chunkLandscapeTranscript(quoteText, { startSec: 0, durationSec: 15 });
const quoteFound = quoteChunks.some(c => c.isQuote && c.animationPreset === "quote_kinetic_treatment");
assert(quoteFound, "Explicit quote text receives isQuote=true and quote_kinetic_treatment");

// Test 3: Typography Whitelist in Engine
console.log("\n--- Testing Typography Whitelist Invariants ---");
const expectedPresets: LandscapeKineticPreset[] = [
  "apple_pro_display_hero_revealer",
  "pixel_blur_mask",
  "gaussian_blur_reveal_sweep",
  "compound_word_glitch_blur_reveal",
  "masked_dual_axis_text_reveal",
  "dynamic_3d_letter_flicker",
  "dual_kinetic_phrase_convergence",
  "rise_and_deblur_compression",
  "quote_kinetic_treatment"
];

assert(LANDSCAPE_KINETIC_WHITELIST.length === 9, `Whitelist contains exactly 9 presets (found ${LANDSCAPE_KINETIC_WHITELIST.length})`);
for (const p of expectedPresets) {
  assert(LANDSCAPE_KINETIC_WHITELIST.includes(p), `Whitelist includes preset: ${p}`);
  assert((LANDSCAPE_KINETIC_PRESETS as readonly string[]).includes(p), `Engine LANDSCAPE_KINETIC_PRESETS supports: ${p}`);
}

// Test 4: HTML template verification
console.log("\n--- Testing HTML Template Preset Implementations ---");
const htmlPath = path.resolve(__dirname, "..", "landscape_treatment_presentation.html");
assert(fs.existsSync(htmlPath), "landscape_treatment_presentation.html exists");

const html = fs.readFileSync(htmlPath, "utf-8");

for (const p of expectedPresets) {
  assert(html.includes(p), `HTML presentation source embeds preset identifier: ${p}`);
}

// Check key styles
assert(html.includes("@property --spread"), "HTML embeds @property --spread for Rise & Deblur");
assert(html.includes("phrase-row-convergence"), "HTML embeds phrase-row-convergence for Dual Convergence");
assert(html.includes("landscape-quote-container"), "HTML embeds landscape-quote-container styling");
assert(html.includes("apple-hero-wrap"), "HTML embeds apple-hero-wrap styling");
assert(html.includes("pixel-blur-mask-wrap"), "HTML embeds pixel-blur-mask-wrap styling");
assert(html.includes("gaussian-sweep-wrap"), "HTML embeds gaussian-sweep-wrap styling");
assert(html.includes("cwg-stage-inline"), "HTML embeds cwg-stage-inline styling");
assert(html.includes("mda-stage-inline"), "HTML embeds mda-stage-inline styling");
assert(html.includes("flk-text-inline"), "HTML embeds flk-text-inline styling");

console.log(`\n=============================================`);
console.log(`🎉 TYPOGRAPHY WHITELIST TESTS: ${passed}/${total} PASSED`);
console.log(`=============================================`);

if (passed !== total) {
  process.exit(1);
}
