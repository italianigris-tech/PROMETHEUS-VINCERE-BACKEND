/**
 * MINI LANDSCAPE RUNS — STAGE 6: LANDSCAPE SOUNDTRACK ENGINE
 *
 * Builds the bed/pad programme for the CUT video duration, mirroring the
 * mini-run soundtrack governance engine: exact duration + tail (AUD-05),
 * 2s fades (AUD-03), −14 LUFS / −1.5 dBTP targets (AUD-01/02), voice ducking
 * (AUD-04), and a seed-rotated palette resolved through the GoSound/Libra
 * bridge (AUD-06/07). Every section traces to a video event — no orphan beds.
 */

import type { EditMove, LandscapeSection, SoundtrackProgram, SoundtrackSection } from "./types.js";

export interface SoundtrackOptions {
  integratedTargetLufs?: number;
  truePeakCeilingDb?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  tailSec?: number;
  seed?: number;
}

interface LibraCandidate {
  id: string;
  elevation: number;
  momentum: number;
  warmth: number;
  intensity: 1 | 2 | 3 | 4 | 5;
}

/** GoSound/Libra provider catalog — resolved at render time (AUD-07). */
export const LIBRA_CATALOG: LibraCandidate[] = [
  { id: "libra_soft_bed_01", elevation: 0.3, momentum: 0.2, warmth: 0.8, intensity: 2 },
  { id: "libra_warm_loop_05", elevation: 0.4, momentum: 0.3, warmth: 0.9, intensity: 2 },
  { id: "libra_mid_drive_02", elevation: 0.5, momentum: 0.6, warmth: 0.5, intensity: 3 },
  { id: "libra_tense_pad_03", elevation: 0.7, momentum: 0.4, warmth: 0.3, intensity: 4 },
  { id: "libra_climax_04", elevation: 1.0, momentum: 0.9, warmth: 0.4, intensity: 5 },
];

const DEFAULTS = {
  integratedTargetLufs: -14,
  truePeakCeilingDb: -1.5,
  fadeInSec: 2.0,
  fadeOutSec: 2.0,
  tailSec: 0.5,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildSoundtrackProgram(
  videoDurationSec: number,
  sections: LandscapeSection[],
  moves: EditMove[],
  opts: SoundtrackOptions = {},
): SoundtrackProgram {
  const { integratedTargetLufs, truePeakCeilingDb, fadeInSec, fadeOutSec, tailSec } = { ...DEFAULTS, ...opts };
  const seed = opts.seed ?? Math.round(videoDurationSec * 100);
  const totalSec = round2(videoDurationSec + tailSec);

  // AUD-06: never hard-wedge; rotate across the candidate catalog by seed.
  const bedCandidates = LIBRA_CATALOG.filter((a) => a.intensity === 2 || a.intensity === 3);
  const bed = bedCandidates[seed % bedCandidates.length];
  const padCandidates = LIBRA_CATALOG.filter((a) => a.id !== bed.id);
  const pad = padCandidates[(seed >> 3) % padCandidates.length];

  const st: SoundtrackSection[] = [
    {
      sectionIndex: 0,
      startSec: 0,
      endSec: round2(Math.min(videoDurationSec, fadeInSec)),
      role: "intro_fade",
      assetId: bed.id,
      gainDb: -20,
      cause: { gate: "video_start_fade", reason: "Bed fades in over the first 2s of the cut video (AUD-03)." },
    },
    {
      sectionIndex: 1,
      startSec: round2(Math.min(videoDurationSec, fadeInSec)),
      endSec: round2(Math.max(fadeInSec, videoDurationSec - fadeOutSec)),
      role: "bed",
      assetId: pad.id,
      gainDb: -12,
      cause: { gate: "section_role", reason: "Bed sustains under dialogue across the body of the video.", timeSec: fadeInSec },
    },
    {
      sectionIndex: 2,
      startSec: round2(Math.max(fadeInSec, videoDurationSec - fadeOutSec)),
      endSec: totalSec,
      role: "outro_fade",
      assetId: bed.id,
      gainDb: -18,
      cause: { gate: "video_end_fade", reason: "Bed fades out over the last 2s plus tail (AUD-05)." },
    },
  ];

  const payoff = sections.find((s) => s.role === "payoff");
  const thesis = moves.find((m) => m.moveId === "thesis_punctuation");
  if (payoff) {
    const emotional = LIBRA_CATALOG.filter((a) => a.intensity >= 4);
    const pick = emotional[seed % emotional.length];
    const insertAt = thesis ? thesis.startSec : payoff.startSec;
    st.push({
      sectionIndex: 3,
      startSec: insertAt,
      endSec: round2(insertAt + 8),
      role: "emotional_insert",
      assetId: pick.id,
      gainDb: -16,
      cause: {
        gate: "section_role",
        reason: `Emotional insert pad during ${payoff.sectionId}.`,
        sectionId: payoff.sectionId,
        timeSec: insertAt,
      },
    });
  }

  st.sort((a, b) => a.startSec - b.startSec);
  return {
    videoDurationSec,
    fadeInSec,
    fadeOutSec,
    totalSec,
    integratedTargetLufs,
    truePeakCeilingDb,
    bedId: bed.id,
    padId: pad.id,
    sections: st,
    voiceDucking: { enabled: true, reductionDb: -6, attackSec: 0.04, releaseSec: 0.25 },
  };
}
