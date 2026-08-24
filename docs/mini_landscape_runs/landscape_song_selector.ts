/**
 * MINI LANDSCAPE RUNS — SONG SELECTOR (the crux of the audio layer)
 *
 * Turns the semantic vibe (SemanticTheme) + the personal song catalog into a
 * concrete per-section song selection programme with:
 *   - a vibe→track scoring model (energy/momentum/clarity/conviction/prestige),
 *   - a VOCALS POLICY (default: instrumentals under dialogue, vocals allowed
 *     only at hook/payoff windows),
 *   - an ANTI-FATIGUE / dynamism guard (never the same track back-to-back; a
 *     same-track reuse requires a spacing gap; same-family streaks are capped),
 *   - BLENDING decisions between adjacent songs (semantic compatibility),
 *   - a dynamic USER-PREFERENCE override path (not a naive "two lines" answer),
 *   - full causal linkage back to the section + vibe that produced each pick.
 */

import type {
  CausalRef,
  SemanticTheme,
  SongBlend,
  SongBlendId,
  SongSelection,
  SongTrack,
  VibeVector,
} from "./types.js";
import { songBlendScore } from "./landscape_song_catalog.js";

export interface SongSelectionOptions {
  /** Force these tracks to appear, in order, ignoring normal ranking. */
  preferredTrackIds?: string[];
  /** Never select these tracks. */
  bannedTrackIds?: string[];
  /** When false (default), vocals tracks are allowed, but only per role policy. */
  avoidVocals?: boolean;
  /** Section roles where a vocals track is acceptable despite dialogue. */
  allowVocalsRoles?: string[];
  /** Curve: 'calm' | 'normal' | 'driving' — a user preference knob. */
  momentumBias?: "calm" | "normal" | "driving";
  /** Minimum sections a track must be away to be re-used (anti-fatigue). */
  exhaustionGap?: number;
  /** Maximum consecutive sections sharing one musical family. */
  fatigueCap?: number;
  /**
   * Short-form single-song policy (SONG-07): when the whole video is at or
   * below this duration, the entire run uses ONE best-fit song with no
   * seams — per-section stitching fatigues the viewer on short clips.
   * Set 0 to disable.
   */
  shortFormSingleSongMaxSec?: number;
  seed?: number;
}

export interface SelectSongProgramInput {
  /** Total (cut) video duration in seconds — the short-form gate (SONG-07). */
  videoDurationSec?: number;
  sections: Array<{
    sectionId: string;
    role: string;
    startSec: number;
    endSec: number;
    text?: string;
    semanticWeight?: number;
    commercialPressure?: number;
    fatigueRisk?: number;
  }>;
  theme: SemanticTheme;
  catalog: SongTrack[];
  options?: SongSelectionOptions;
}

export interface SongSelectionProgram {
  selections: SongSelection[];
  blends: SongBlend[];
  governance: {
    allSectionsSelected: boolean;
    fatigueSafe: boolean;
    blendsOrphanFree: boolean;
    vocalsPolicyApplied: boolean;
    checks: Array<{ check: string; pass: boolean; detail: string }>;
  };
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const round2 = (n: number): number => Math.round(n * 100) / 100;
const overlap = (a: string[], b: string[]): number => {
  const set = new Set(a);
  const hits = b.filter((x) => set.has(x));
  return hits.length / Math.max(1, Math.min(a.length, b.length));
};

const DEFAULT = {
  avoidVocals: false,
  allowVocalsRoles: ["payoff", "hook"],
  exhaustionGap: 3,
  fatigueCap: 2,
  shortFormSingleSongMaxSec: 90,
};

type VibeTarget = VibeVector & { themeLabels?: string[]; role?: string };

const scoreTrack = (
  track: SongTrack,
  target: VibeTarget,
  role: string,
  opts: Required<SongSelectionOptions>,
): { score: number; reasons: string[] } => {
  const reasons: string[] = [];
  const energyFit = 1 - Math.abs(track.fingerprint.energy - target.energy);
  const momentumFit = 1 - Math.abs(track.fingerprint.momentum - target.momentum);
  const warmthFit = 1 - Math.abs(track.fingerprint.warmth - target.warmth);
  const clarityFit = 1 - Math.abs(track.fingerprint.clarity - target.clarity);
  const convictionFit = 1 - Math.abs(track.fingerprint.conviction - target.conviction);
  const prestigeFit = 1 - Math.abs(track.fingerprint.prestige - target.prestige);
  const speechFit = track.speechFriendliness;

  if (energyFit > 0.75) reasons.push(`energy ${round2(track.fingerprint.energy)} matches drive ${round2(target.energy)}`);
  if (clarityFit > 0.75) reasons.push("analytically clean under dialogue");
  if (convictionFit > 0.75) reasons.push("carries conviction for the sell");

  const clarifyWeight = role === "explain" || role === "demonstrate" ? 0.22 : 0.12;
  let score =
    energyFit * 0.28 +
    momentumFit * 0.18 +
    warmthFit * 0.12 +
    clarityFit * clarifyWeight +
    convictionFit * 0.14 +
    prestigeFit * 0.1 +
    speechFit * 0.1;
  let labelFit = overlap(track.moodTags, target.themeLabels ?? []);
  if (labelFit <= 0) labelFit = overlap(track.useCaseTags, target.themeLabels ?? []);
  score += labelFit * 0.1;
  score += track.renderSafe ? 0 : -0.5; // non-render-safe deprioritized, never removed
  return { score: round2(clamp01(score)), reasons };
};

const findVibe = (theme: SemanticTheme, sectionId: string): (SemanticTheme["perSection"][number] & { role?: string }) | undefined =>
  theme.perSection.find((s) => s.sectionId === sectionId);
export function selectSongProgram(input: SelectSongProgramInput): SelectSongProgram {
  const opts: Required<SongSelectionOptions> = {
    avoidVocals: input.options?.avoidVocals ?? DEFAULT.avoidVocals,
    allowVocalsRoles: input.options?.allowVocalsRoles ?? DEFAULT.allowVocalsRoles,
    exhaustionGap: input.options?.exhaustionGap ?? DEFAULT.exhaustionGap,
    fatigueCap: input.options?.fatigueCap ?? DEFAULT.fatigueCap,
    shortFormSingleSongMaxSec: input.options?.shortFormSingleSongMaxSec ?? DEFAULT.shortFormSingleSongMaxSec,
    momentumBias: input.options?.momentumBias ?? "normal",
    preferredTrackIds: input.options?.preferredTrackIds ?? [],
    bannedTrackIds: input.options?.bannedTrackIds ?? [],
    seed: input.options?.seed ?? 0,
  };

  const banned = new Set(opts.bannedTrackIds);
  const lastUsed = new Map<string, number>();   // trackId -> most recent section index
  const familyStreak = new Map<string, number>();
  const preferredOrder = opts.preferredTrackIds.filter((id) => input.catalog.some((t) => t.id === id));
  const selections: SongSelection[] = [];

  const momentumShifts: Record<string, number> = { calm: -0.15, normal: 0, driving: 0.2 };
  const biasMomentum = momentumShifts[opts.momentumBias] ?? 0;

  // SONG-07: short-form single-song mode. When the whole clip is short, one
  // ideal song carries the run end-to-end; per-section stitching on a ~1
  // minute video fatigues the viewer and fights the voice. The one song is
  // chosen against the VIDEO-LEVEL vibe so it arcs the whole clip.
  const videoDurationSec = input.videoDurationSec ?? Math.max(0, ...input.sections.map((s) => s.endSec));
  const singleSong =
    opts.shortFormSingleSongMaxSec > 0 &&
    videoDurationSec > 0 &&
    videoDurationSec <= opts.shortFormSingleSongMaxSec;

  if (singleSong) {
    const forcedId = preferredOrder[0];
    const target: VibeTarget = {
      ...input.theme.video,
      momentum: clamp01(input.theme.video.momentum + biasMomentum),
      themeLabels: input.theme.values.length > 0 ? input.theme.values : [input.theme.dominantTheme],
      role: "bed",
    };
    const vocalsAllowed = !opts.avoidVocals || opts.allowVocalsRoles.includes("payoff");
    const ranked = input.catalog
      .filter((t) => !banned.has(t.id))
      .filter((t) => vocalsAllowed || !t.hasVocals)
      .map((t) => ({ track: t, ...scoreTrack(t, target, "bed", opts) }));
    const pick = forcedId ? ranked.find((r) => r.track.id === forcedId) ?? ranked[0] : ranked[0];
    if (pick) {
      const reason = forcedId
        ? `SONG-07 short-form single song (${videoDurationSec.toFixed(1)}s <= ${opts.shortFormSingleSongMaxSec}s): caller-preferred track ${pick.track.id} carries the whole run.`
        : `SONG-07 short-form single song (${videoDurationSec.toFixed(1)}s <= ${opts.shortFormSingleSongMaxSec}s): one ideal song (${pick.track.title}) runs end-to-end instead of per-section stitching.`;
      const selections = input.sections.map((sec, idx) =>
        selectionFor(sec, pick.track, pick.score, [reason, ...pick.reasons], sec.role, idx),
      );
      const governance = governSongProgram(selections, [], input.sections, opts, { singleSong: true });
      return { selections, blends: [], governance };
    }
    // Fall through to the per-section path only if the catalog is empty.
  }

  input.sections.forEach((sec, idx) => {
    const vibe = findVibe(input.theme, sec.sectionId);
    const target: VibeTarget = vibe ?? {
      energy: 0.5, momentum: 0.5 + biasMomentum, warmth: 0.5,
      clarity: 0.5, conviction: 0.5, prestige: 0.5,
      themeLabels: [sec.role],
    };
    if (vibe) target.momentum = clamp01(vibe.momentum + biasMomentum);
    const role = sec.role;

    // Dynamic user-preference override (not a naive "boom" answer): a caller can
    // force specific tracks into the run in sequence.
    if (preferredOrder.length > 0) {
      const pick = preferredOrder[Math.min(idx, preferredOrder.length - 1)];
      const track = input.catalog.find((t) => t.id === pick);
      if (track) {
        selections.push(selectionFor(sec, track, 1, ["caller preference override"], role, idx));
        lastUsed.set(track.id, idx);
        return;
      }
    }

    const vocalsAllowed = !opts.avoidVocals || opts.allowVocalsRoles.includes(role);
    let ranked = input.catalog
      .filter((t) => !banned.has(t.id))
      .filter((t) => vocalsAllowed || !t.hasVocals)
      .map((t) => ({ track: t, ...scoreTrack(t, target, role, opts) }));

    // Anti-fatigue: the same track twice in a row is never allowed.
    ranked = ranked.filter((r) => lastUsed.get(r.track.id) !== idx - 1);
    // Same-family streak cap.  When the cap eliminates *all* candidates the
    // fallback relaxes the family cap for this section only.
    ranked = ranked.filter((r) => {
      const fam = famOf(r.track.id);
      return opts.fatigueCap <= 0 || (familyStreak.get(fam) ?? 0) < opts.fatigueCap;
    });
    if (ranked.length === 0) {
      // Fallback: relax the family cap entirely for this section.
      ranked = input.catalog
        .filter((t) => !banned.has(t.id))
        .filter((t) => vocalsAllowed || !t.hasVocals)
        .map((t) => ({ track: t, ...scoreTrack(t, target, role, opts) }))
        .filter((r) => lastUsed.get(r.track.id) !== idx - 1)
        .filter((r) => {
          const usedAt = lastUsed.get(r.track.id);
          return usedAt === undefined || idx - usedAt >= opts.exhaustionGap;
        });
    }
    // Exhaustion gap: a recently used track sits out for N sections.
    ranked = ranked.filter((r) => {
      const usedAt = lastUsed.get(r.track.id);
      return usedAt === undefined || idx - usedAt >= opts.exhaustionGap;
    });

    // Prefer highest score; tie-break deterministically by id (seed-stable).
    ranked.sort((a, b) => b.score - a.score || a.track.id.localeCompare(b.track.id));
    const top = ranked[0];
    if (!top) return;

    const family = famOf(top.track.id);
    familyStreak.set(family, (familyStreak.get(family) ?? 0) + 1);
    for (const [fam] of familyStreak) if (fam !== family) familyStreak.set(fam, 0);

    selections.push(selectionFor(sec, top.track, top.score, top.reasons, role, idx));
    lastUsed.set(top.track.id, idx);
  });

  const blends = planSongBlends(selections, input.catalog, input.sections);
  const governance = governSongProgram(selections, blends, input.sections, opts);
  return { selections, blends, governance };
}

function selectionFor(
  sec: SelectSongProgramInput["sections"][number],
  track: SongTrack,
  score: number,
  reasons: string[],
  role: string,
  idx: number,
): SongSelection {
  return {
    sectionId: sec.sectionId,
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    score,
    reasons,
    hasVocals: track.hasVocals,
    vibe: { ...track.fingerprint },
    cause: {
      gate: "song_choice",
      reason: `Song ${track.id} selected for ${sec.sectionId} (${role}) at score ${round2(score)}.`,
      sectionId: sec.sectionId,
      timeSec: round2(sec.startSec),
    },
  };
}

function planSongBlends(
  selections: SongSelection[],
  catalog: SongTrack[],
  sections: SelectSongProgramInput["sections"],
): SongBlend[] {
  const blends: SongBlend[] = [];
  if (selections.length < 2) return blends;
  const byId = new Map(catalog.map((t) => [t.id, t]));

  const startSecOf = (sectionId: string): number =>
    sections.find((s) => s.sectionId === sectionId)?.startSec ?? 0;
  const ordered = [...selections].sort((a, b) => startSecOf(a.sectionId) - startSecOf(b.sectionId));

  for (let i = 0; i < ordered.length - 1; i++) {
    const from = ordered[i];
    const to = ordered[i + 1];
    const toSec = sections.find((s) => s.sectionId === to.sectionId)?.startSec ?? 0;
    const fromTrack = byId.get(from.trackId);
    const toTrack = byId.get(to.trackId);
    if (!fromTrack || !toTrack) continue;

    const blendScore = songBlendScore(fromTrack, toTrack);
    const energyGap = Math.abs(fromTrack.fingerprint.energy - toTrack.fingerprint.energy);
    const blendId = blendFor(blendScore, energyGap, fromTrack.id === toTrack.id);

    blends.push({
      boundarySec: round2(toSec),
      fromSectionId: from.sectionId,
      toSectionId: to.sectionId,
      fromTrackId: fromTrack.id,
      toTrackId: toTrack.id,
      blendId,
      blendScore: round2(blendScore),
      justification: `Songs ${fromTrack.title} -> ${toTrack.title} blend as ${blendId}: affinity ${round2(blendScore)} (delta ${round2(energyGap)}).`,
      cause: {
        gate: "song_segue",
        reason: `Song segue ${fromTrack.id} -> ${toTrack.id} at ${round2(toSec)}s.`,
        sectionId: to.sectionId,
        timeSec: round2(toSec),
      },
    });
  }
  return blends;
}

function blendFor(blendScore: number, energyGap: number, sameTrack: boolean): SongBlendId {
  if (sameTrack) return "none";                  // continuation, not a blend
  if (blendScore >= 0.8) return "beat_crossfade";
  if (blendScore >= 0.6) return "lowpass_sweep";
  if (energyGap >= 0.45) return "riser_into_impact";
  return "hard_cut";
}

const famOf = (trackId: string): string => trackId.split("_").slice(0, 3).join("_") || "other";

function governSongProgram(
  selections: SongSelection[],
  blends: SongBlend[],
  sections: SelectSongProgramInput["sections"],
  opts: Required<SongSelectionOptions>,
  flags: { singleSong?: boolean } = {},
): SelectSongProgram["governance"] {
  const checks: Array<{ check: string; pass: boolean; detail: string }> = [];

  const allSectionsSelected = sections.length === selections.length;
  checks.push({
    check: "Every section receives exactly one song",
    pass: allSectionsSelected,
    detail: `${selections.length}/${sections.length} sections`,
  });

  // Fatigue guard: no immediate same-track repeat; no same-family streak over
  // cap. In single-song short-form mode (SONG-07) the same track across the
  // whole run is the point, so the anti-fatigue guard is intentionally lifted.
  let fatigueSafe = true;
  let fatigueDetail = flags.singleSong
    ? "single-song short-form mode (SONG-07): repetition is the point"
    : "no same-track back-to-back";
  const famSeries = selections.map((s) => famOf(s.trackId));
  let streak = 1;
  for (let i = 1; i < famSeries.length && fatigueSafe && !flags.singleSong; i++) {
    if (famSeries[i] === famSeries[i - 1]) {
      streak++;
      if (opts.fatigueCap > 0 && streak > opts.fatigueCap) {
        fatigueSafe = false;
        fatigueDetail = `family streak ${famSeries[i]} x${streak}`;
      }
    } else {
      streak = 1;
    }
  }
  checks.push({
    check: "Song order is fatigue-safe (no family streak over cap)",
    pass: fatigueSafe,
    detail: fatigueDetail,
  });

  // Blends orphan-free: a blend never pairs a track with itself on both sides.
  let blendsOrphanFree = true;
  let orphanDetail = "all blends pair distinct tracks";
  for (let i = 0; i < blends.length; i++) {
    if (blends[i].fromTrackId === blends[i].toTrackId) {
      blendsOrphanFree = false;
      orphanDetail = `blend ${i} uses one song both sides`;
      break;
    }
  }
  checks.push({ check: "Every blend connects two distinct selected songs", pass: blendsOrphanFree, detail: orphanDetail });

  // Vocals policy applied when avoidVocals is on.
  let vocalsPolicyApplied = true;
  let vocalsDetail = "vocals policy respected";
  if (opts.avoidVocals) {
    for (const s of selections) {
      const role = sections.find((x) => x.sectionId === s.sectionId)?.role ?? "";
      if (s.hasVocals && !opts.allowVocalsRoles.includes(role)) {
        vocalsPolicyApplied = false;
        vocalsDetail = `vocals track in ${role} (${s.trackId})`;
        break;
      }
    }
  }
  checks.push({ check: "Vocals track excluded where dialogue clarity matters", pass: vocalsPolicyApplied, detail: vocalsDetail });

  return {
    allSectionsSelected,
    fatigueSafe,
    blendsOrphanFree,
    vocalsPolicyApplied,
    checks,
  };
}