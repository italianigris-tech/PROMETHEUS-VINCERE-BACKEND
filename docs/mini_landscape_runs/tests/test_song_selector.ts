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
 *   8. SONG-07: short-form (≤ 90s) runs are ONE song with no seams; long-form
 *      runs keep per-section songs + transition beds (AUD-09).
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

/** Build 6 sections with the given per-section duration (seconds). */
function makeSections(perSectionSec: number): LandscapeSection[] {
  return ROLES.map((role, i) => {
    const startSec = i * perSectionSec;
    return {
      sectionId: `sec_${i + 1}_${role}`,
      role,
      startSec,
      endSec: startSec + perSectionSec,
      durationSec: perSectionSec,
      text: TEXTS[i],
      semanticWeight: 0.6,
      commercialPressure: 0.5,
      fatigueRisk: 0.3,
      cause: { gate: "section_role", reason: "test section" },
    };
  });
}

// Short-form (54s) and long-form (180s) fixtures.
const shortSections = makeSections(9);
const longSections = makeSections(30);

console.log("=============================================");
console.log("SEMANTIC VIBE NODE");
console.log("=============================================");
const theme = resolveSemanticTheme({
  sections: shortSections.map((s) => ({
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
console.log("SONG SELECTOR — LONG-FORM (180s: per-section songs still apply)");
console.log("=============================================");
const selectArgs = {
  videoDurationSec: 180,
  sections: longSections.map((s) => ({
    sectionId: s.sectionId, role: s.role, startSec: s.startSec, endSec: s.endSec, text: s.text,
  })),
  theme,
  catalog: SEED_SONG_TRACKS,
};
const program = selectSongProgram(selectArgs);
assert(program.selections.length === 6, "Every section got exactly one song");
const used = program.selections.map((s) => s.trackId);
const distinct = new Set(used);
assert(distinct.size >= 4, "Dynamism: at least 4 distinct tracks across the long-form run");
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
console.log("SONG SELECTOR — SHORT-FORM (54s: ONE song end-to-end, SONG-07)");
console.log("=============================================");
const shortProgram = selectSongProgram({
  videoDurationSec: 54,
  sections: shortSections.map((s) => ({
    sectionId: s.sectionId, role: s.role, startSec: s.startSec, endSec: s.endSec, text: s.text,
  })),
  theme,
  catalog: SEED_SONG_TRACKS,
});
assert(shortProgram.selections.length === 6, "Single-song mode still covers every section");
const shortTracks = new Set(shortProgram.selections.map((s) => s.trackId));
assert(shortTracks.size === 1, `SONG-07: short-form run is ONE song (got ${shortTracks.size})`);
assert(shortProgram.blends.length === 0, "SONG-07: no blends/seams in a single-song run");
assert(shortProgram.governance.fatigueSafe, "Single-song governance stays fatigue-safe (SONG-07 exemption)");
assert(
  shortProgram.governance.checks.find((c) => c.check.includes("fatigue"))!.detail.includes("SONG-07"),
  "Fatigue check documents the single-song exemption",
);
const forcedShort = selectSongProgram({
  videoDurationSec: 54,
  sections: shortSections.map((s) => ({
    sectionId: s.sectionId, role: s.role, startSec: s.startSec, endSec: s.endSec, text: s.text,
  })),
  theme,
  catalog: SEED_SONG_TRACKS,
  options: { preferredTrackIds: ["seed_cinematic_braam_04"] } satisfies SongSelectionOptions,
});
assert(
  forcedShort.selections.every((s) => s.trackId === "seed_cinematic_braam_04"),
  "SONG-07: caller-preferred track carries the whole short-form run",
);

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
  const role = longSections.find((s) => s.sectionId === sel.sectionId)!.role;
  assert(!sel.hasVocals || role === "payoff", "Vocals policy: only payoff may carry vocals");
}

console.log("\n=============================================");
console.log("STAGE-6 SOUNDTRACK PROGRAM (song selection is the crux; bed EMPTY)");
console.log("=============================================");
// Short-form (60s video) → single-song mode: no emotional_insert, no beds.
const soundtrack = buildSoundtrackProgram(60, shortSections);
assert(soundtrack.soundBed === "empty", "Sound bed is deliberately empty (AUD-08)");
assert(soundtrack.bedId === "songbed_empty", "bedId sentinel is songbed_empty");
assert(soundtrack.catalogSource === "seed", "Seed catalog is the run source (override-ready)");
assert(soundtrack.selections!.length === 6, "Program ships per-section song selections");
assert(soundtrack.singleSongMode === true, "Short-form program is single-song mode (SONG-07)");
assert(soundtrack.blends!.length === 0, "Single-song program has no song-segue blends");
assert(!soundtrack.sections.some((s) => s.role === "emotional_insert"), "Single-song run skips the emotional insert (one song arcs it)");
assert(soundtrack.transitionBeds!.length === 0, "Single-song run has no transition beds (no seams)");
assert(soundtrack.theme!.dominantTheme.length > 0, "Program ships the semantic theme");

// Long-form (240s video) → multi-song mode: emotional_insert + transition beds.
const longSoundtrack = buildSoundtrackProgram(240, longSections);
assert(longSoundtrack.singleSongMode === false, "Long-form program is multi-song mode");
assert(longSoundtrack.sections.some((s) => s.role === "emotional_insert"), "Payoff emotional insert persists in long-form (AUD-06)");
assert(longSoundtrack.transitionBeds!.length >= 4, `Song changes get transition beds in long-form (got ${longSoundtrack.transitionBeds!.length})`);
assert(
  longSoundtrack.transitionBeds!.every((b) => b.boundarySec >= b.riserSec && b.boundarySec <= longSoundtrack.totalSec - 0.5),
  "Transition beds stay in-bounds and never start before the video",
);
assert(
  longSoundtrack.transitionBeds!.every((b) => b.levelDb <= -20),
  "Transition beds are subtle (never a loud sound effect)",
);

console.log("\n=============================================");
console.log("SONG SELECTOR TESTS: " + passedChecks + "/" + totalChecks + " passed");
console.log("=============================================");
