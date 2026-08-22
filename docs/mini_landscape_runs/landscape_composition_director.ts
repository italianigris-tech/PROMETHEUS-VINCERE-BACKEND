/**
 * MINI LANDSCAPE RUNS — STAGE 4: COMPOSITION DIRECTOR
 *
 * Resolves placement, transitions and typography-cue selection for landscape
 * 16:9. Mirrors docs/mini_run_studio/composition_director.ts but owns the
 * landscape depth planes (Z:5 plate, Z:10 behind-speaker, Z:20 matted speaker,
 * Z:30 foreground / PiP chrome).
 */

import type {
  CompositionPlacement,
  EditMove,
  EditMoveId,
  LandscapeSection,
  LandscapeTransitionId,
  TransitionTreatment,
} from "./types.js";

export interface DirectorOptions {
  hasMattedPrincipalSpeaker?: boolean;
  transitionMinGapSec?: number;
  transitionBudget?: number; // fraction of eligible boundaries, default 0.5
  typographyTargetRate?: number; // default 0.6
}

export const TRANSITION_EFFECT_IDS: LandscapeTransitionId[] = [
  "light_burn",
  "hot_burn",
  "soft_flash",
  "hard_flash",
  "light_sweep",
  "luma_wash",
];

export function decideMovePlacement(
  move: EditMove,
  hasMattedPrincipalSpeaker: boolean,
): CompositionPlacement | null {
  const owner = "landscape_composition_director" as const;
  switch (move.moveId) {
    case "proof_insert":
      return hasMattedPrincipalSpeaker
        ? {
            owner,
            placement: "behind_principal_speaker",
            zIndex: 10,
            occludedByPrincipalSpeaker: true,
            reason: "Supporting evidence renders behind the matted speaker (MAT-01).",
          }
        : {
            owner,
            placement: "standalone",
            zIndex: 10,
            occludedByPrincipalSpeaker: false,
            reason: "No matted speaker available; evidence stands alone.",
          };
    case "explain_workflow":
      return {
        owner,
        placement: "pip_inset",
        zIndex: 30,
        occludedByPrincipalSpeaker: false,
        reason: "Workflow screen as PiP chrome, never the plate (MAT-04).",
      };
    case "value_contrast":
    case "focus_handoff":
    case "emphasize_keyword":
    case "cta_pressure":
    case "thesis_punctuation":
      return {
        owner,
        placement: "foreground_callout",
        zIndex: 30,
        occludedByPrincipalSpeaker: false,
        reason: `${move.moveId} lives on the foreground callout plane.`,
      };
    case "return_to_authority":
      return null; // no asset; attention returns to the host (MAT-03)
    default:
      return {
        owner,
        placement: "standalone",
        zIndex: 10,
        occludedByPrincipalSpeaker: false,
        reason: "Default supportive placement (no foreground interaction).",
      };
  }
}

export function selectLandscapeTransitions(
  sections: LandscapeSection[],
  opts: DirectorOptions = {},
): TransitionTreatment[] {
  const { transitionMinGapSec = 3.0, transitionBudget = 0.5 } = opts;
  const boundaries: Array<{ timeSec: number; sectionId: string; toRole: LandscapeSection["role"] }> = [];
  for (let i = 0; i < sections.length - 1; i++) {
    boundaries.push({ timeSec: sections[i].endSec, sectionId: sections[i + 1].sectionId, toRole: sections[i + 1].role });
  }
  const eligible = boundaries.filter((b, i) => b.toRole !== sections[i].role);
  const budget = Math.floor(eligible.length * transitionBudget);

  const selected: TransitionTreatment[] = [];
  for (const b of eligible) {
    if (selected.length >= budget) break;
    const last = selected[selected.length - 1];
    if (last && b.timeSec - last.timeSec < transitionMinGapSec) continue;
    selected.push({
      sectionId: b.sectionId,
      timeSec: b.timeSec,
      effectId: effectForRole(b.toRole, selected.length),
      cause: { gate: "transition", reason: `Transition into ${b.toRole} at section boundary.`, timeSec: b.timeSec },
    });
  }
  return selected;
}

const TYPOGRAPHY_MOVES = new Set<EditMoveId>(["emphasize_keyword", "cta_pressure", "thesis_punctuation"]);

/** TYP-02: typography cue rate ≤ target (default 0.6), scored by priority. */
export function selectTypographyMoveIds(moves: EditMove[], opts: DirectorOptions = {}): string[] {
  const { typographyTargetRate = 0.6 } = opts;
  const eligible = moves.filter((m) => TYPOGRAPHY_MOVES.has(m.moveId) && m.allowSfx);
  const targetCount = Math.round(eligible.length * typographyTargetRate);
  return eligible
    .map((m, i) => ({ m, score: m.priority * 100 + ((i * 37 + eligible.length * 13) % 101) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, targetCount)
    .map(({ m }) => m.moveId);
}

function effectForRole(role: LandscapeSection["role"], ordinal: number): LandscapeTransitionId {
  switch (role) {
    case "payoff":
      return "light_burn";
    case "demonstrate":
      return "light_sweep";
    case "outro":
      return "luma_wash";
    case "explain":
      return "soft_flash";
    case "hook":
      return "hot_burn";
    default:
      return TRANSITION_EFFECT_IDS[(ordinal + 1) % TRANSITION_EFFECT_IDS.length];
  }
}
