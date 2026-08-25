/**
 * MINI LANDSCAPE RUNS — STAGE 5: LANDSCAPE SFX ENGINE
 *
 * Lifecycle-aware, deterministically rotated SFX cues derived causally from
 * edit moves and transitions. No cue is orphaned: each traces to a move or a
 * transition, and intentional omissions are real cues (family "none") per
 * SFX-03 — restraint is a premium signal, not an absence.
 */

import type { EditMove, LifecycleEvent, SfxCue, TransitionTreatment } from "./types.js";

export interface SfxEngineOptions {
  minFamilyGapSec?: number; // SFX-04 default 0.9s
}

const MOVE_SFX: Record<
  EditMove["moveId"],
  { family: SfxCue["family"]; lifecycle: LifecycleEvent; depthPlane: 10 | 20 | 30 }
> = {
  emphasize_keyword: { family: "click", lifecycle: "asset_entry", depthPlane: 30 },
  return_to_authority: { family: "whoosh", lifecycle: "speaker_return", depthPlane: 20 },
  explain_workflow: { family: "ui", lifecycle: "asset_entry", depthPlane: 30 },
  value_contrast: { family: "impact", lifecycle: "number_lock", depthPlane: 30 },
  cta_pressure: { family: "ui", lifecycle: "cta_hit", depthPlane: 30 },
  fatigue_relief: { family: "none", lifecycle: "intentional_silence", depthPlane: 10 },
  focus_handoff: { family: "whoosh", lifecycle: "transition", depthPlane: 20 },
  proof_insert: { family: "shutter", lifecycle: "asset_entry", depthPlane: 10 },
  thesis_punctuation: { family: "impact", lifecycle: "section_boundary", depthPlane: 30 },
  momentum_death: { family: "none", lifecycle: "intentional_silence", depthPlane: 10 },
};

/**
 * Per-effect SFX family mapping for transitions (TRN-05).
 * Every effect in the cinematic tier gets a distinctive family so the
 * audio bed reflects the visual intent.
 */
const TRANSITION_SFX_FAMILY: Record<string, SfxCue["family"]> = {
  light_burn: "impact",
  hot_burn: "impact",
  edge_glow_bloom: "impact",
  soft_flash: "whoosh",
  hard_flash: "whoosh",
  light_sweep: "whoosh",
  luma_wash: "whoosh",
  push_in_zoom: "whoosh",
  camera_pass_by: "whoosh",
  match_cut: "click",
  lens_flare_bleed: "riser",
  light_leak: "riser",
  defocus_bokeh: "riser",
};

/** Nephew-family alternates for semblance rotation (SFX-06). */
const FAMILY_ALTERNATES: Record<Exclude<SfxCue["family"], "none">, SfxCue["family"][]> = {
  click: ["ui", "gear"],
  ui: ["click", "shutter"],
  whoosh: ["shutter", "riser"],
  impact: ["riser", "whoosh"],
  riser: ["impact", "whoosh"],
  shutter: ["click", "ui"],
  gear: ["click", "telemetry"],
  telemetry: ["gear", "click"],
};

const GAIN_BY_DEPTH: Record<10 | 20 | 30, number> = { 10: -14, 20: -10, 30: -7 };
const DURATION_BY_FAMILY: Record<SfxCue["family"], number> = {
  click: 0.18, ui: 0.25, gear: 0.5, whoosh: 0.7, shutter: 0.3,
  impact: 0.5, riser: 1.2, telemetry: 0.5, none: 0,
};

const sectionIndex = (sectionId: string) => {
  const m = sectionId.match(/^sec_(\d+)_/);
  return m ? Number(m[1]) : 0;
};

export function buildSfxCues(
  moves: EditMove[],
  transitions: TransitionTreatment[],
  opts: SfxEngineOptions = {},
): SfxCue[] {
  const { minFamilyGapSec = 0.9 } = opts;
  const lastFamilyTime: Partial<Record<SfxCue["family"], number>> = {};

  const resolveFamily = (family: SfxCue["family"], timeSec: number): SfxCue["family"] | null => {
    if (family === "none") return "none";
    const last = lastFamilyTime[family];
    if (last !== undefined && timeSec - last < minFamilyGapSec) {
      const alt = (FAMILY_ALTERNATES[family] ?? []).find((a) => {
        const la = lastFamilyTime[a];
        return la === undefined || timeSec - la >= minFamilyGapSec;
      });
      if (!alt) return null; // SFX-04: skip rather than invent a collision
      lastFamilyTime[alt] = timeSec;
      return alt;
    }
    lastFamilyTime[family] = timeSec;
    return family;
  };

  interface PlannedCue {
    timeSec: number;
    family: SfxCue["family"];
    label: string;
    gainDb: number;
    spatialPan: number;
    depthPlane: 10 | 20 | 30;
    intentionalOmission: boolean;
    cause: SfxCue["cause"];
  }

  const planned: PlannedCue[] = [];
  for (const move of moves) {
    const spec = MOVE_SFX[move.moveId];
    const timeSec = round2(move.startSec + 0.15);
    const idx = sectionIndex(move.sectionId);

    // SFX-03: fatigue_relief / momentum_death / quiet returns are intentional silence.
    const isQuietReturn =
      move.moveId === "return_to_authority" &&
      moves.some((m) => m.allowMacroAsset && m !== move && move.startSec - m.endSec >= 0 && move.startSec - m.endSec < 2.0);

    const intentionalOmission = !move.allowSfx || isQuietReturn;
    planned.push({
      timeSec,
      family: intentionalOmission ? "none" : spec.family,
      label: `${move.moveId}@${timeSec.toFixed(1)}s`,
      gainDb: GAIN_BY_DEPTH[spec.depthPlane],
      spatialPan: round2(((idx % 3) - 1) * 0.35),
      depthPlane: spec.depthPlane,
      intentionalOmission,
      cause: {
        gate: spec.lifecycle,
        reason: `Move ${move.moveId} in ${move.sectionId} triggers ${spec.lifecycle}.`,
        moveId: move.moveId,
        sectionId: move.sectionId,
        timeSec,
      },
    });
  }

  for (const t of transitions) {
    planned.push({
      timeSec: t.timeSec,
      family: TRANSITION_SFX_FAMILY[t.effectId] ?? "whoosh",
      label: `transition ${t.effectId}`,
      gainDb: GAIN_BY_DEPTH[30],
      spatialPan: 0,
      depthPlane: 30,
      intentionalOmission: false,
      cause: { ...t.cause },
    });
  }

  // W1 fix: resolve the shared family ledger in strictly chronological order
  // across moves AND transitions. The old split (all moves, then all
  // transitions) compared every transition against move-ledger stamps from the
  // ENTIRE video, so a later move (e.g. value_contrast@151s) produced negative
  // deltas against an earlier transition and always tripped the collision
  // guard — intended impact/whoosh families silently rotated to "riser".
  // Sorting before resolution means the ledger only ever holds timestamps ≤ the
  // cue being resolved, so the guard is chronological as designed (SFX-04).
  planned.sort((a, b) => a.timeSec - b.timeSec);

  const cues: SfxCue[] = [];
  let id = 0;
  for (const p of planned) {
    const family = resolveFamily(p.family, p.timeSec);
    if (!family) continue; // collision skip (SFX-04)
    id += 1;
    cues.push({
      id: `cue_${id}`,
      timeSec: p.timeSec,
      durationSec: DURATION_BY_FAMILY[family],
      family,
      label: p.label,
      gainDb: p.gainDb,
      spatialPan: p.spatialPan,
      depthPlane: p.depthPlane,
      intentionalOmission: p.intentionalOmission,
      cause: p.cause,
    });
  }

  // Already chronological from the planned sort.
  return cues;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
