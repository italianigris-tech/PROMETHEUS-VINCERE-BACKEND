import * as fs from "node:fs";
import * as path from "node:path";

const studioDir = __dirname;
const htmlPath = path.join(studioDir, "typography_treatment_presentation.html");

if (!fs.existsSync(htmlPath)) {
  console.error("FAIL: HTML presentation missing");
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, "utf8");

// Extract javascript code from HTML
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const targetScript = scriptMatches.find(m => m[1].includes('compileDynamicSequence'));
if (!targetScript) {
  console.error("FAIL: compileDynamicSequence script block not found in HTML");
  process.exit(1);
}

const scriptCode = targetScript[1];

// Create a simulation test by evaluating the sequence compiler
const evalScope = `
const mockElement = () => ({
  className: '',
  innerText: '',
  innerHTML: '',
  style: {},
  dataset: {},
  classList: { add: () => {}, remove: () => {}, toggle: () => {} },
  appendChild: () => {},
  setAttribute: () => {},
  addEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  scrollIntoView: () => {},
  onclick: null
});

const window = { addEventListener: () => {}, location: { search: '' }, self: 1, top: 1 };
const document = {
  body: { classList: { add: () => {}, remove: () => {}, toggle: () => {} } },
  getElementById: () => ({
    ...mockElement(),
    value: 0
  }),
  createElement: mockElement,
  createElementNS: mockElement,
  querySelector: () => null,
  querySelectorAll: () => []
};
const performance = { now: () => Date.now() };
const requestAnimationFrame = (fn) => {};
const setTimeout = (fn) => {};

${scriptCode}

let failures = 0;
let totalTypewriterViolations = 0;
let multiHeroViolations = 0;

for (let s = 1; s <= 1000; s++) {
  const seed = (s * 1337) % 99999 + 1;
  const sequence = compileDynamicSequence(seed);
  
  let typewriterCount = 0;
  sequence.forEach((chunk, cIdx) => {
    let heroCount = 0;
    chunk.layers.forEach((l, lIdx) => {
      if (l.fxPreset === 'typewriter_mono_caret' || l.fxPreset === 'glow_search_input_caret') {
        typewriterCount++;
      }
            // Zone A: subject_mask_core_text is monolith_clean_seal (ZERO treatment) — not a hero preset.
      // Zone B: only the styled effects are hero presets; subpixel_blur_mask / monolith_clean_seal are not.
      const HERO_PRESETS = new Set([
        'keynote_punch',
        'acid_lime_letter_glitch',
        'defocus_rack_focus',
        'glitch_scan',
        'chromatic_sheen',
        'pulse_reveal',
      ]);
      if (HERO_PRESETS.has(l.fxPreset)) {
        heroCount++;
      }
    });

    if (heroCount > 1) {
      multiHeroViolations++;
      console.error(\`Seed \${seed} Chunk \${cIdx} has multiple hero presets (\${heroCount})!\`);
    }
  });

  if (typewriterCount > 1) {
    totalTypewriterViolations++;
    console.error(\`Seed \${seed} violated Typewriter Budget! Used \${typewriterCount} times.\`);
  }
}

console.log("==========================================");
console.log("1,000-SEED KINETIC INVARIANT MONTE CARLO RESULTS:");
console.log(\`Total Sequences Tested: 1,000 (20,000 Chunks)\`);
console.log(\`Typewriter Overuse Violations: \${totalTypewriterViolations}\`);
console.log(\`Multi-Hero Preset Violations: \${multiHeroViolations}\`);
console.log("==========================================");

if (totalTypewriterViolations > 0 || multiHeroViolations > 0) {
  process.exit(1);
} else {
  console.log("ALL 1,000 RANDOM SEEDS PASSED 100% INVARIANT GOVERNANCE WITH ZERO VIOLATIONS!");
}
`;

fs.writeFileSync(path.join(studioDir, "scratch_test_eval.js"), evalScope);

// Execute the eval and propagate the exit code
import { execSync } from "node:child_process";
try {
  const output = execSync("node " + JSON.stringify(path.join(studioDir, "scratch_test_eval.js")), { encoding: "utf8" });
  process.stdout.write(output);
} catch (e: any) {
  if (e.stdout) process.stdout.write(e.stdout);
  if (e.stderr) process.stderr.write(e.stderr);
  process.exit(1);
}
