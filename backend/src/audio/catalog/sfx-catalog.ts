import {createHash} from "node:crypto";
import {access, readFile} from "node:fs/promises";
import path from "node:path";

import {sfxCatalogSchema, type SfxCatalog} from "./sfx-catalog.schema.js";

export const JOSEPH_TRACER_CURATION = [
  ["UI INTERFACE/freesound_community-ui-click-43196.mp3", "ui_click_freesound", ["entry", "semantic_substitute"], "digital", "neutral", "soft", ["ui", "click", "text"]],
  ["UI INTERFACE/Generdyn - GUI - 01.wav", "ui_click_gui_01", ["entry"], "digital", "neutral", "soft", ["ui", "click", "select"]],
  ["UI INTERFACE/Generdyn - GUI - 02.wav", "ui_click_gui_02", ["entry"], "digital", "neutral", "medium", ["ui", "click", "confirm"]],
  ["WHOOSHES/Light - Whoosh - (Nikko Hunt's S.D.Essentials).wav", "whoosh_light", ["motion_follow", "transition_bridge"], "air", "left_to_right", "soft", ["whoosh", "light", "motion"]],
  ["WHOOSHES/Whip - Whoosh - (Nikko Hunt's S.D.Essentials).wav", "whoosh_whip", ["motion_follow", "transition_bridge"], "air", "right_to_left", "medium", ["whoosh", "whip", "motion"]],
  ["WHOOSHES/Low - Whoosh - (Nikko Hunt's S.D.Essentials).wav", "whoosh_low", ["motion_follow", "transition_bridge"], "sub", "inward", "medium", ["whoosh", "low", "transition"]],
  ["IMPACT HITS/Generdyn - HITS - 01.wav", "impact_hit_01", ["entry", "release"], "cinematic", "neutral", "hard", ["impact", "payoff", "hit"]],
  ["IMPACT HITS/Generdyn - HITS - 03.wav", "impact_hit_03", ["entry", "release"], "cinematic", "neutral", "hard", ["impact", "payoff", "hit"]],
  ["IMPACT HITS/Generdyn - HITS - 06.wav", "impact_hit_06", ["entry", "release"], "cinematic", "outward", "hard", ["impact", "payoff", "hit"]],
  ["CINEMATIC HITS/Metallic - Hit - (Nikko Hunt's S.D.Essentials).wav", "impact_metallic", ["semantic_substitute", "release"], "metal", "neutral", "hard", ["impact", "metal", "reveal"]],
  ["RISERS/Generdyn - RISER - 01.wav", "riser_01", ["transition_bridge"], "cinematic", "outward", "medium", ["riser", "build", "transition"]],
  ["RISERS/Generdyn - RISER - 03.wav", "riser_03", ["transition_bridge"], "air", "outward", "medium", ["riser", "build", "transition"]],
  ["RISERS/White Noise - Riser - (Nikko Hunt's S.D.Essentials).wav", "riser_white_noise", ["transition_bridge"], "air", "outward", "soft", ["riser", "build", "transition"]],
  ["SWEEPS/Reverse Cymbal - Sweeps - (Nikko Hunt's S.D.Essentials).wav", "release_reverse_cymbal", ["release", "transition_bridge"], "metal", "inward", "medium", ["release", "cymbal", "transition"]],
  ["ACCENTS PUNCTUATION/winning-elevation-111355.mp3", "accent_winning", ["release"], "cinematic", "outward", "medium", ["accent", "win", "payoff"]],
  ["ACCENTS PUNCTUATION/cash-register-purchase-87313.mp3", "accent_cash_register", ["semantic_substitute"], "digital", "neutral", "medium", ["cash", "purchase", "proof"]],
  ["OFFICE FOLEY/marker-lineswav-14823.mp3", "foley_marker", ["motion_follow", "semantic_substitute"], "paper", "left_to_right", "soft", ["marker", "write", "explain"]],
  ["OFFICE FOLEY/paper-flutter-5933.mp3", "foley_paper_flutter", ["motion_follow"], "paper", "neutral", "soft", ["paper", "article", "proof"]],
  ["TEXT/type-writing-6834.mp3", "texture_typewriter", ["motion_follow"], "texture", "neutral", "soft", ["typing", "text", "continuous"]],
  ["TEXT/virtualzero-keyboard-typing-fast-371229.mp3", "texture_keyboard_fast", ["motion_follow"], "texture", "neutral", "medium", ["typing", "text", "continuous"]],
  ["DATA TELEMETRY/data-reveal-sound-6460.mp3", "data_reveal", ["semantic_substitute", "entry"], "digital", "outward", "medium", ["data", "reveal", "proof"]],
  ["DATA TELEMETRY/Digital counting.mp3", "data_counting", ["motion_follow"], "digital", "neutral", "soft", ["data", "count", "continuous"]],
  ["GLITCHES/Data Processing - Glitch - (Nikko Hunt's S.D.Essentials).wav", "glitch_data", ["transition_bridge", "semantic_substitute"], "digital", "neutral", "medium", ["glitch", "data", "transition"]],
  ["TRANSITIONS/freesound_community-camera-shutter-6305.mp3", "camera_shutter", ["semantic_substitute", "release"], "digital", "neutral", "medium", ["camera", "proof", "cut"]],
  ["MECHANICAL CLICKS/camera-shutter-18399.mp3", "camera_shutter_mechanical", ["semantic_substitute"], "metal", "neutral", "medium", ["camera", "proof", "click"]],
  ["SNAP/soundreality-finger-snap-reverb-423222.mp3", "snap_reverb", ["entry"], "organic", "neutral", "soft", ["snap", "text", "emphasis"]],
  ["LOOPS/Generdyn - INSTLoops - 01.wav", "texture_loop_01", ["motion_follow"], "texture", "neutral", "soft", ["texture", "continuous", "bed"]],
  ["SOUNDSCAPES/Deep Rumble - Soundscapes - (Nikko Hunt's S.D.Essentials).wav", "texture_deep_rumble", ["motion_follow"], "sub", "neutral", "soft", ["texture", "continuous", "tension"]],
  ["ATMOS/Generdyn - ATMOS - 01.wav", "texture_atmos_01", ["motion_follow"], "texture", "neutral", "soft", ["texture", "continuous", "atmos"]],
  ["SWOOSHES/ES_Jump Swish - SFX Producer.mp3", "swish_jump", ["motion_follow", "transition_bridge"], "air", "left_to_right", "medium", ["swish", "motion", "transition"]],
] as const;

export const fileSha256 = async (filePath: string) =>
  createHash("sha256").update(await readFile(filePath)).digest("hex");

export const verifySfxCatalogFiles = async ({catalog, root}: {catalog: unknown; root: string}): Promise<SfxCatalog> => {
  const parsed = sfxCatalogSchema.parse(catalog);
  for (const asset of parsed.assets) {
    const assetPath = path.resolve(root, asset.objectKey);
    await access(assetPath);
    if ((await fileSha256(assetPath)) !== asset.sha256) throw new Error(`SFX hash mismatch for ${asset.assetId}.`);
  }
  return parsed;
};

export const assertReleaseEligibleSfx = (asset: SfxCatalog["assets"][number]) => {
  if (asset.rights.usage !== "release" || asset.rights.state !== "release_allowed") {
    throw new Error(`SFX ${asset.assetId} is preview-only because commercial rights evidence is unavailable.`);
  }
};
