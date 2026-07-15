import type {CutEvent} from "@prometheus/shared-types";
import {
  findCutPoints,
  findNearest,
  type DynamicBoundaryProfile,
  type Phrase as BoundaryPhrase,
} from "./dynamic-boundaries";

export const JOSEPH_SYNTHETIC_PACING_VERSION = "joseph-synthetic-pacing-v1" as const;

export type JosephSyntheticPacingSyncKind = "phrase" | "breath" | "beat" | "visual_reset";
export type JosephSyntheticPacingProposalKind = "artificial_jump_cut" | "zoom_reset" | "breathe_window" | "emphasis_cut";
export type JosephSyntheticPacingRejectionTag = "illegal_sync_window" | "mid_word_cut" | "climax_budget_reserved" | "jump_cut_spam";

export interface JosephSyntheticPacingInput {
  phrases: BoundaryPhrase[];
  beats: number[];
  onsets: number[];
  energyCurve: number[];
  durationMs: number;
  profile: DynamicBoundaryProfile;
}

export interface JosephSyntheticPacingProposal {
  id: string;
  kind: JosephSyntheticPacingProposalKind;
  atMs: number;
  toMs: number;
  style: CutEvent["style"];
  intensity: number;
  sync: JosephSyntheticPacingSyncKind;
  legalSyncWindow: true;
  reason: string;
  climaxSpend: number;
}

export interface JosephSyntheticPacingRejection {
  atMs: number;
  tag: JosephSyntheticPacingRejectionTag;
  sync: JosephSyntheticPacingSyncKind;
  reason: string;
}

export interface JosephSyntheticPacingPlan {
  version: typeof JOSEPH_SYNTHETIC_PACING_VERSION;
  legalWindowCount: number;
  proposals: JosephSyntheticPacingProposal[];
  rejectedCandidates: JosephSyntheticPacingRejection[];
  climaxBudget: {
    reservedUntilMs: number;
    earlyImpactLimit: number;
    earlyImpactUsed: number;
    earlyImpactRejectedCount: number;
    totalProposalSpend: number;
    remainingEarlyImpactSlots: number;
  };
  studioDiagnostics: {
    visibleProposalCount: number;
    nextProposalMs: number | null;
    syncKinds: JosephSyntheticPacingSyncKind[];
    warnings: string[];
  };
}

const CLIMAX_RESERVE_RATIO = 0.64;
const EARLY_IMPACT_THRESHOLD = 0.72;
const WORD_EDGE_TOLERANCE_MS = 1;
const SYNC_TOLERANCE_MS = 90;
const BREATH_GAP_MS = 300;

const EARLY_IMPACT_LIMIT: Record<DynamicBoundaryProfile, number> = {
  joseph_aggressive: 2,
  joseph_cinematic: 1,
  joseph_minimal: 1,
};

const MIN_GAP_MS: Record<DynamicBoundaryProfile, number> = {
  joseph_aggressive: 280,
  joseph_cinematic: 520,
  joseph_minimal: 760,
};

const round = (value: number, places = 3): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const sortedUnique = (points: number[]): number[] =>
  [...new Set(points.map((point) => Math.round(point)).filter((point) => Number.isFinite(point)))]
    .sort((left, right) => left - right);

const isInsideWord = (point: number, phrases: BoundaryPhrase[]): boolean =>
  phrases.some((phrase) =>
    phrase.words.some((word) => point > word.startMs + WORD_EDGE_TOLERANCE_MS && point < word.endMs - WORD_EDGE_TOLERANCE_MS)
  );

const isPhraseBoundary = (point: number, phrases: BoundaryPhrase[]): boolean =>
  phrases.some((phrase) => Math.abs(point - phrase.startMs) <= WORD_EDGE_TOLERANCE_MS || Math.abs(point - phrase.endMs) <= WORD_EDGE_TOLERANCE_MS);

const isBreathBoundary = (point: number, phrases: BoundaryPhrase[]): boolean =>
  phrases.some((phrase, index) => {
    const next = phrases[index + 1];
    return Boolean(
      next &&
      next.startMs - phrase.endMs >= BREATH_GAP_MS &&
      (Math.abs(point - phrase.endMs) <= WORD_EDGE_TOLERANCE_MS || Math.abs(point - next.startMs) <= WORD_EDGE_TOLERANCE_MS),
    );
  });

const isNear = (point: number, points: number[], toleranceMs = WORD_EDGE_TOLERANCE_MS): boolean =>
  points.some((candidate) => Math.abs(point - candidate) <= toleranceMs);

const energyAt = (point: number, durationMs: number, energyCurve: number[]): number => {
  if (durationMs <= 0 || energyCurve.length === 0) {
    return 0.5;
  }

  const index = Math.min(energyCurve.length - 1, Math.max(0, Math.floor((point / durationMs) * energyCurve.length)));
  return energyCurve[index] ?? 0.5;
};

const syncKindFor = (point: number, input: JosephSyntheticPacingInput): JosephSyntheticPacingSyncKind => {
  if (isBreathBoundary(point, input.phrases)) {
    return "breath";
  }

  if (isPhraseBoundary(point, input.phrases)) {
    return "phrase";
  }

  if (isNear(point, input.beats) || isNear(point, input.onsets)) {
    return "beat";
  }

  const nearestAudioSync = findNearest(point, sortedUnique([...input.beats, ...input.onsets]));
  return Math.abs(point - nearestAudioSync) <= SYNC_TOLERANCE_MS ? "visual_reset" : "phrase";
};

const proposalKindFor = (
  point: number,
  sync: JosephSyntheticPacingSyncKind,
  durationMs: number,
  index: number,
): JosephSyntheticPacingProposalKind => {
  if (sync === "breath") {
    return "breathe_window";
  }

  if (point >= durationMs * 0.72) {
    return "emphasis_cut";
  }

  if (sync === "visual_reset" || index % 3 === 1) {
    return "zoom_reset";
  }

  return "artificial_jump_cut";
};

const styleFor = (kind: JosephSyntheticPacingProposalKind, index: number): CutEvent["style"] => {
  if (kind === "zoom_reset") {
    return "zoom_blur";
  }

  if (kind === "emphasis_cut") {
    return index % 2 === 0 ? "hard" : "whip_right";
  }

  if (kind === "breathe_window") {
    return "hard";
  }

  return index % 2 === 0 ? "hard" : "whip_left";
};

const intensityFor = (
  kind: JosephSyntheticPacingProposalKind,
  point: number,
  durationMs: number,
  energy: number,
): number => {
  if (kind === "breathe_window") {
    return round(Math.max(0.34, Math.min(0.48, energy * 0.55)), 2);
  }

  if (point >= durationMs * 0.72) {
    return round(Math.max(0.84, Math.min(0.96, energy)), 2);
  }

  if (point < Math.min(3000, durationMs)) {
    return round(Math.max(0.74, Math.min(0.86, energy)), 2);
  }

  return round(Math.max(0.58, Math.min(0.78, energy)), 2);
};

const climaxSpendFor = (point: number, durationMs: number, intensity: number): number =>
  point < durationMs * CLIMAX_RESERVE_RATIO && intensity >= EARLY_IMPACT_THRESHOLD
    ? round(intensity * 0.5, 2)
    : round(intensity * 0.18, 2);

const rejection = (
  atMs: number,
  tag: JosephSyntheticPacingRejectionTag,
  sync: JosephSyntheticPacingSyncKind,
  reason: string,
): JosephSyntheticPacingRejection => ({
  atMs,
  tag,
  sync,
  reason,
});

const proposal = (
  atMs: number,
  sync: JosephSyntheticPacingSyncKind,
  kind: JosephSyntheticPacingProposalKind,
  intensity: number,
  durationMs: number,
  index: number,
): JosephSyntheticPacingProposal => ({
  id: `synthetic-pacing-${index}-${atMs}`,
  kind,
  atMs,
  toMs: atMs,
  style: styleFor(kind, index),
  intensity,
  sync,
  legalSyncWindow: true,
  reason: `${kind} aligned to ${sync} sync window`,
  climaxSpend: climaxSpendFor(atMs, durationMs, intensity),
});

export function buildJosephSyntheticPacingPlan(input: JosephSyntheticPacingInput): JosephSyntheticPacingPlan {
  const legalWindows = findCutPoints(
    input.phrases,
    input.beats,
    input.onsets,
    input.durationMs,
    input.profile,
  );
  const reservedUntilMs = Math.round(input.durationMs * CLIMAX_RESERVE_RATIO);
  const earlyImpactLimit = EARLY_IMPACT_LIMIT[input.profile];
  const minGapMs = MIN_GAP_MS[input.profile];
  const proposals: JosephSyntheticPacingProposal[] = [];
  const rejectedCandidates: JosephSyntheticPacingRejection[] = [];
  let earlyImpactUsed = 0;
  const terminalPhrase = input.phrases.at(-1);
  const terminalPayoffPoint = terminalPhrase?.endMs === input.durationMs
    ? terminalPhrase.startMs
    : null;

  for (const point of legalWindows) {
    const sync = syncKindFor(point, input);
    if (isInsideWord(point, input.phrases)) {
      rejectedCandidates.push(rejection(point, "mid_word_cut", sync, "Cut candidate fell inside a spoken word."));
      continue;
    }

    if (
      terminalPayoffPoint !== null
      && point < terminalPayoffPoint
      && terminalPayoffPoint - point < minGapMs
    ) {
      rejectedCandidates.push(rejection(
        point,
        "jump_cut_spam",
        sync,
        "Nearby beat held back so the terminal payoff phrase can carry the emphasis cut.",
      ));
      continue;
    }

    const previous = proposals[proposals.length - 1];
    if (previous && point - previous.atMs < minGapMs) {
      rejectedCandidates.push(rejection(point, "jump_cut_spam", sync, "Cut candidate was too close to the previous accepted pacing cut."));
      continue;
    }

    const kind = proposalKindFor(point, sync, input.durationMs, proposals.length);
    const intensity = intensityFor(kind, point, input.durationMs, energyAt(point, input.durationMs, input.energyCurve));
    const isEarlyImpact = point < reservedUntilMs && intensity >= EARLY_IMPACT_THRESHOLD;
    if (isEarlyImpact && earlyImpactUsed >= earlyImpactLimit) {
      rejectedCandidates.push(rejection(point, "climax_budget_reserved", sync, "Early impact cut held back to preserve the climax budget."));
      continue;
    }

    if (isEarlyImpact) {
      earlyImpactUsed += 1;
    }
    proposals.push(proposal(point, sync, kind, intensity, input.durationMs, proposals.length));
  }

  const syncKinds = [...new Set(proposals.map((item) => item.sync))];
  const earlyImpactRejectedCount = rejectedCandidates.filter((candidate) => candidate.tag === "climax_budget_reserved").length;
  const warnings = [
    ...(earlyImpactRejectedCount > 0 ? ["climax_budget_reserved"] : []),
    ...(proposals.length === 0 && legalWindows.length > 0 ? ["all_legal_windows_rejected"] : []),
  ];

  return {
    version: JOSEPH_SYNTHETIC_PACING_VERSION,
    legalWindowCount: legalWindows.length,
    proposals,
    rejectedCandidates,
    climaxBudget: {
      reservedUntilMs,
      earlyImpactLimit,
      earlyImpactUsed,
      earlyImpactRejectedCount,
      totalProposalSpend: round(proposals.reduce((sum, item) => sum + item.climaxSpend, 0), 2),
      remainingEarlyImpactSlots: Math.max(0, earlyImpactLimit - earlyImpactUsed),
    },
    studioDiagnostics: {
      visibleProposalCount: proposals.length,
      nextProposalMs: proposals[0]?.atMs ?? null,
      syncKinds,
      warnings,
    },
  };
}
