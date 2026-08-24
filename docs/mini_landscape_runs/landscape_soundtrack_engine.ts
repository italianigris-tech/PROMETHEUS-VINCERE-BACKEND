/**
 * MINI LANDSCAPE RUNS — STAGE 6: LANDSCAPE SOUNDTRACK ENGINE (song-selective)
 *
 * Recommend the audio for a video, the small way:
 *   1. break the (cut) video into its role sections — Stage 2 already did,
 *   2. read the SEMANTIC TEME of each section's transcript (a causally-linked
 *      node, not a naive two-line guess),
 *   3. SELECT a song per section from the personal catalog (the crux),
 *   4. BLEND across song boundaries so the run never fatigues from repetition,
 *   5. leave the general SOUND BED EMPTY — per studio policy the bed is not the
 *      point; song selection is. (Libra/short-form generation is out of scope
 *      for long-form beds and would not be economical over 20-40 minutes.)
 */

import type {
  EditMove,
  LandscapeSection,
  SemanticTheme,
  SongSelection,
  SongBlend,
  SoundtrackProgram,
  SoundtrackSection,
} from "./types.js";
import { EMPTY_BED_ID, loadSongCatalog, SEED_SONG_TRACKS } from "./landscape_song_catalog.js";
import { resolveSemanticTheme, type ResolveSemanticThemeInput } from "./landscape_semantic_theme.js";
import { selectSongProgram, type SongSelectionOptions } from "./landscape_song_selector.js";

export interface SoundtrackOptions {
  /** Optional injected LLM/semantic theme (the studio supports an LLM node). */
  semantic?: SemanticTheme | null;
  /** A caller-supplied song catalog (defaults to the seed catalogue). */
  catalog?: { source: string; tracks: typeof SEED_SONG_TRACKS };
  /** Song-selection knobs: user preference overrides, vocals policy, cache/inclusion. */
  songOptions?: SongSelectionOptions;
  /** The general sound bed policy. Only 'empty' is honored today. */
  soundBed?: "empty" | "curated";
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const DEFAULTS = {
  integratedTargetLufs: -14,
  truePeakCeilingDb: -1.5,
  fadeInSec: 2.0,
  fadeOutSec: 2.0,
  tailSec: 0.5,
};

export function buildSongProgram(
  videoDurationSec: number,
  sections: LandscapeSection[],
  opts: SoundtrackOptions = {},
): SoundtrackProgram {
  // 1) Semantic understanding of the transcript (causally linked).
  const theme = resolveSemanticTheme({
    sections: sections.map((s) => ({
      sectionId: s.sectionId,
      role: s.role,
      text: s.text,
      semanticWeight: s.semanticWeight,
      commercialPressure: s.commercialPressure,
      fatigueRisk: s.fatigueRisk,
    })),
    llmTheme: opts.semantic ?? null,
  } satisfies ResolveSemanticThemeInput);

  // 2.) Load the song catalog (caller override > seed).
  const catalog = opts.catalog ?? loadSongCatalog();

  // 3.) Per-section song selection (the crux).
  const program = selectSongProgram({
    sections: sections.map((s) => ({
      sectionId: s.sectionId,
      role: s.role,
      startSec: s.startSec,
      endSec: s.endSec,
      text: s.text,
    })),
    theme,
    catalog: catalog.tracks,
    options: opts.songOptions,
  });

  // 4.) Envelope: intake fade, body, outro fade. Bed stays EMPTY by policy.
  const totalSec = round2(videoDurationSec + DEFAULTS.tailSec);
  const sectionsEnvelope: SoundtrackSection[] = (
    [
      {
        sectionIndex: 0,
        startSec: 0,
        endSec: round2(Math.min(videoDurationSec, DEFAULTS.fadeInSec)),
        role: "intro_fade",
      },
      {
        sectionIndex: 1,
        startSec: round2(Math.min(videoDurationSec, DEFAULTS.fadeInSec)),
        endSec: round2(Math.max(DEFAULTS.fadeInSec, videoDurationSec - DEFAULTS.fadeOutSec)),
        role: "bed",
      },
      {
        sectionIndex: 2,
        startSec: round2(Math.max(DEFAULTS.fadeInSec, videoDurationSec - DEFAULTS.fadeOutSec)),
        endSec: totalSec,
        role: "outro_fade",
      },
    ] as Array<{ sectionIndex: number; startSec: number; endSec: number; role: "intro_fade" | "bed" | "outro_fade" }>
  ).map((env) => ({
    ...env,
    assetId: EMPTY_BED_ID,
    gainDb: -20,
    cause: {
      gate: env.role === "intro_fade" ? ("video_start_fade" as const) : env.role === "outro_fade" ? ("video_end_fade" as const) : ("section_role" as const),
      reason: `${env.role} envelope, bed deliberately empty (AUD-08).`,
      timeSec: round2(env.startSec),
    },
  }));

  const payoffSection = sections.find((s) => s.role === "payoff");
  if (payoffSection) {
    sectionsEnvelope.push({
      sectionIndex: 3,
      startSec: round2(payoffSection.startSec),
      endSec: round2(Math.min(payoffSection.endSec, payoffSection.startSec + 8)),
      role: "emotional_insert",
      assetId: program.selections.find((sel) => sel.sectionId === payoffSection.sectionId)?.trackId ?? EMPTY_BED_ID,
      gainDb: -16,
      cause: { gate: "section_role", reason: `Emotional emphasis across ${payoffSection.sectionId}.`, timeSec: round2(payoffSection.startSec), sectionId: payoffSection.sectionId },
    });
  }

  return {
    videoDurationSec,
    fadeInSec: DEFAULTS.fadeInSec,
    fadeOutSec: DEFAULTS.fadeOutSec,
    totalSec,
    integratedTargetLufs: DEFAULTS.integratedTargetLufs,
    truePeakCeilingDb: DEFAULTS.truePeakCeilingDb,
    bedId: EMPTY_BED_ID,
    padId: EMPTY_BED_ID,
    sections: sectionsEnvelope.sort((a, b) => a.startSec - b.startSec),
    voiceDucking: { enabled: true, reductionDb: -6, attackSec: 0.04, releaseSec: 0.25 },
    soundBed: opts.soundBed ?? "empty",
    catalogSource: catalog.source,
    theme,
    selections: program.selections,
    blends: program.blends,
  };
}

/** Backwards-compatible export used by the pipeline and existing tests. */
export const buildSoundtrackProgram = buildSongProgram;