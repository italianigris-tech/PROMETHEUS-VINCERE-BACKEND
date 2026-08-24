/**
 * MINI LANDSCAPE RUNS — SONG SELECTOR + SEMANTIC VIBE + SOUNDTRACK TEST
 *
 * Pure-logic test (no media, no render, no Modal token spend). Proves:
 *   1. The semantic node turns transcript text into a vibe + a dominant theme.
 *   2. The song selector gives every section exactly one track.
 *   3. Anti-fatigue / dynamism: no immediate same-track reuse.
 *   4. Vocals policy is honoured.
 *   5. Blends connect two distinct selected tracks.
 *   6. Dynamic user preference overrides (force / ban) actually change the run.
 *   7. The Stage-6 soundtrack programme keeps the sound bed EMPTY.
 *
 * Run: npx tsx docs/mini_landscape_runs/tests/test_song_selector.ts
 */

import { resolveSemanticTheme } from "../landscape_semantic_theme.js";
import { SEED_SONG_TRACKS } from "../landscape_song_catalog.js";
import { selectSongProgram, type SongSelectionOptions } from "../landscape_song_selector.js";
import { buildSoundtrackProgram } from "../landscape_soundtrack_engine.js";
import type { LandscapeSection } from "../types.js";

let passedChecks = 0;
let totalChecks = 0;
function assert(condition: boolean, message: string) {
  totalChecks++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedChecks++;
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

const ROLES: LandscapeSection["role"][] = ["hook", "setup", "explain", "demonstrate", "payoff", "outro"];
const TEXTS = [
  "this is huge, we must win because revenue and profit grow every quarter",
  "let me set the context, the company and the market are changing",
  "here is a clear framework, the steps are simple and logical",
  "watch the workflow demonstrate the system in action",
  "the premium result, if you believe it you achieve it",
  "thank you for watching, take the first step now",
];

const sections: LandscapeSection[] = ROLES.map((role, i) => {
  const startSec = i * 10;
  return {
    sectionId: `sec_${i + 1}_${role}`,
    role,
    startSec,
    endSec: startSec + 9,
    durationSec: 9,
    text: TEXTS[i],
    semanticWeight: 0.6,
    commercialPressure: 0.5,
    fatigueRisk: 0.3,
    cause: { gate: "section_role", reason: "test section" },
  };
});

console.log("=============================================");
console.log("SEMANTIC VIBE NODE");
console.log("=============================================");
const theme = resolveSemanticTheme({
  sections: sections.map((s) => ({
    sectionId: s.sectionId, role: s.role, text: s.text,
    semanticWeight: s.semanticWeight, commercialPressure: s.commercialPressure, fatigueRisk: s.fatigueRisk,
  })),
});
assert(theme.perSection.length === 6, `Semantic node produced a vibe for all 6 sections (got ${theme.perSection.length})`);
assert(
  theme.dominantTheme.includes("business") || theme.dominantTheme.includes("conviction") || theme.dominantTheme.includes("clarity"),
  `Dominant theme reflects business/conviction/clarity transcript (got "${theme.dominantTheme}")`,
);
assert(theme.source === "deterministic", "Semantic node is deterministic by default");
const hookVibe = theme.perSection.find((s) => s.sectionId === "sec_1_hook")!;
assert(hookVibe.conviction > 0.5, `Hook conviction raised by lexical evidence (${hookVibe.conviction})`);
console.log("\n=============================================");
console.log("SONG SELECTOR (default run over the seed catalog)");
console.log("=============================================");
const selectArgs = {
  sections: sections.map((s) => ({
    sectionId: s.sectionId, role: s.role, startSec: s.startSec, endSec: s.endSec, text: s.text,
  })),
  theme,
  catalog: SEED_SONG_TRACKS,
};
const program = selectSongProgram(selectArgs);
assert(program.selections.length === 6, "Every section got exactly one song");
const used = program.selections.map((s) => s.trackId);
const distinct = new Set(used);
assert(distinct.size >= 4, "Dynamism: at least 4 distinct tracks across the run");
assert(
  program.selections.every((s, i) => i === 0 || s.trackId !== used[i - 1]),
  "Anti-fatigue: same track never repeats back-to-back",
);
assert(program.blends.length >= 5, "Blends exist across all boundaries");
assert(
  program.blends.every((b) => b.fromTrackId !== b.toTrackId),
  "Every blend connects two distinct tracks",
);
assert(program.governance.allSectionsSelected, "Governance reports all sections selected");
assert(program.governance.fatigueSafe, "Governance reports fatigue-safe order");
assert(program.governance.blendsOrphanFree, "Governance reports blends are distinct-paired");

console.log("\n=============================================");
console.log("USER PREFERENCES (dynamic, not a naive two-line answer)");
console.log("=============================================");
const forced = selectSongProgram({
  ...selectArgs,
  options: { preferredTrackIds: ["seed_cinematic_braam_04", "seed_cinematic_braam_04"] } satisfies SongSelectionOptions,
});
assert(forced.selections[0]?.trackId === "seed_cinematic_braam_04", "preferredTrackIds force the chosen track");

const banned = selectSongProgram({
  ...selectArgs,
  options: { bannedTrackIds: ["seed_cinematic_braam_04"] } satisfies SongSelectionOptions,
});
assert(!banned.selections.some((s) => s.trackId === "seed_cinematic_braam_04"), "bannedTrackIds keep a song out");

const vocalPolicy = selectSongProgram({
  ...selectArgs,
  options: { avoidVocals: true, allowVocalsRoles: ["payoff"] } satisfies SongSelectionOptions,
});
for (const sel of vocalPolicy.selections) {
  const role = sections.find((s) => s.sectionId === sel.sectionId)!.role;
  assert(!sel.hasVocals || role === "payoff", "Vocals policy: only payoff may carry vocals");
}

console.log("\n=============================================");
console.log("STAGE-6 SOUNDTRACK PROGRAM (song selection is the crux; bed EMPTY)");
console.log("=============================================");
const soundtrack = buildSoundtrackProgram(60, sections);
assert(soundtrack.soundBed === "empty", "Sound bed is deliberately empty (AUD-08)");
assert(soundtrack.bedId === "songbed_empty", "bedId sentinel is songbed_empty");
assert(soundtrack.catalogSource === "seed", "Seed catalog is the run source (override-ready)");
assert(soundtrack.selections!.length === 6, "Program ships per-section song selections");
assert(soundtrack.theme!.dominantTheme.length > 0, "Program ships the semantic theme");
assert(soundtrack.sections.some((s) => s.role === "emotional_insert"), "Payoff emotional insert persists");

console.log("\n=============================================");
console.log("SONG SELECTOR TESTS: " + passedChecks + "/" + totalChecks + " passed");
console.log("=============================================");
