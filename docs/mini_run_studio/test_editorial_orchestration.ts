import { buildDeterministicCausalSoundManifest } from "./causal_sound_engine.js";
import { buildGeminiMusicRequest, decideAssetComposition, TRANSITION_EFFECTS } from "./composition_director.js";
import * as fs from "node:fs";
import * as path from "node:path";

let failures = 0;
function assert(condition: boolean, message: string) {
  if (condition) console.log(`PASS: ${message}`);
  else {
    console.error(`FAIL: ${message}`);
    failures++;
  }
}

const sequence = Array.from({ length: 10 }, (_, index) => ({
  chunkIndex: index + 1,
  startSec: index * 2,
  endSec: index * 2 + 2,
  text: `Narrative phrase ${index + 1}`,
  profileName: "Editorial Sans",
  layers: [{ fxPreset: "subpixel_blur_mask" }],
  emphasis: index === 2 ? "inflection_tension" : index === 7 ? "transition" : "normal",
  backgroundAsset: index === 7 ? { renderMode: "dom_component" } : undefined,
}));

const cues = buildDeterministicCausalSoundManifest(sequence);
const typographyCues = cues.filter(c => [
  "text_click_family",
  "text_typing_family",
  "text_glitch_family",
  "lengthy_text_gear_family",
].includes(c.familyKey));

assert(typographyCues.length === 6, "10 ordinary typography events receive the 60% cue budget (not 100%)");

const transitionCues = cues.filter(c => c.familyKey === "transition_action_family");
assert(transitionCues.length <= 1, "Only a minority of semantic inflection candidates receive a transition cue");
assert(transitionCues.every(c => [3, 8].includes(c.chunkIndex)), "Transition cues derive from semantic candidates, not fixed chunk indices");

const semanticTransitionSequence = Array.from({ length: 12 }, (_, index) => ({
  chunkIndex: index + 1,
  startSec: index * 2,
  endSec: index * 2 + 2,
  text: `Editorial phrase ${index + 1}`,
  profileName: "Editorial Sans",
  layers: [{ fxPreset: "subpixel_blur_mask" }],
  emphasis: index === 1 ? "inflection_tension" : index === 5 ? "inflection_solution" : "normal",
}));
const semanticTransitionCues = buildDeterministicCausalSoundManifest(semanticTransitionSequence)
  .filter(c => c.familyKey === "transition_action_family");
assert(semanticTransitionCues.every(c => [2, 6].includes(c.chunkIndex)), "Transition cues follow semantic inflections even when they move away from legacy fixed indices");

const presentationHtml = fs.readFileSync(path.join(__dirname, "typography_treatment_presentation.html"), "utf8");
assert(presentationHtml.includes("TYPOGRAPHY_SFX_COVERAGE_TARGET = 0.6"), "The live mini-run client applies the 60% typography SFX budget");
assert(presentationHtml.includes("LIVE_MATTED_COMPOSITION_DIRECTOR"), "The live renderer has a caller-owned matte placement decision");
assert(presentationHtml.includes('bgLayer.style.zIndex = composition.zIndex'), "The live renderer applies the composition decision instead of a test-lab-only Z-index");
const presentationBuilder = fs.readFileSync(path.join(__dirname, "build_male_sequence_presentation.ts"), "utf8");
assert(presentationBuilder.includes("TYPOGRAPHY_SFX_COVERAGE_TARGET = 0.6"), "The typography presentation generator preserves the 60% SFX policy on rebuild");

const brandPlacement = decideAssetComposition({ hasMattedPrincipalSpeaker: true, assetRole: "brand" });
assert(brandPlacement.placement === "behind_principal_speaker" && brandPlacement.zIndex === 10 && brandPlacement.occludedByPrincipalSpeaker,
  "Composition Director—not ANIMA—places supporting brand assets behind the matted speaker");
assert(TRANSITION_EFFECTS.length === 6 && TRANSITION_EFFECTS.every(effect => effect.overlayOnly && !effect.affectsSourceVideo),
  "Six transition treatments are overlay-only and never alter the source video");
const geminiRequest = buildGeminiMusicRequest(sequence, 45);
assert(geminiRequest.model === "lyria-3-pro-preview" && geminiRequest.brief.typographySfxCoverageTarget === 0.6,
  "The music handoff packages the restrained editorial brief for Gemini");

if (failures > 0) process.exit(1);
