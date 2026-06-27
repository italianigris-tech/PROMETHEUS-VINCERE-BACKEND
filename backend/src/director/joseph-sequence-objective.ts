import type {CameraMove, CutEvent, TextEvent, TimelineEvent, UnifiedRenderManifest} from "@prometheus/shared-types";
import type {CandidateScore} from "./judgment-layer";

export const JOSEPH_SEQUENCE_OBJECTIVE_VERSION = "joseph-sequence-objective-v1" as const;

export type JosephSequenceObjectiveBreakdown = {
  sequenceConsequence: number;
  repetitionAvoidance: number;
  doctrineCoherence: number;
  surprisePreservation: number;
  climaxBudgetPreservation: number;
  retrievalPracticality: number;
  qdDiversityPressure: number;
  qualityFloor: number;
  replayNovelty: number;
  finalScore: number;
};

export type JosephArchiveCell = {
  key: string;
  intensity: "minimal" | "restrained" | "balanced" | "expressive";
  visualDensity: "sparse" | "balanced" | "dense";
  motionEnergy: "none" | "subtle" | "active";
  editorialRole: "setup" | "tension" | "payoff";
};

export type JosephQualityDiversityArchiveEntry = {
  candidateId: string;
  doctrineBranchId: string;
  archiveCell: JosephArchiveCell;
  plannerScore: number;
  source: "live-candidate";
};

export type JosephSequenceObjectiveCandidate = {
  candidateId: string;
  doctrineBranchId: string;
  archiveCell: JosephArchiveCell;
  scoreBreakdown: JosephSequenceObjectiveBreakdown;
  selected: boolean;
  reasons: string[];
};

export type JosephSequenceObjectiveRanking = {
  version: typeof JOSEPH_SEQUENCE_OBJECTIVE_VERSION;
  selectedCandidateId: string | null;
  selectedDoctrineBranchId: string | null;
  candidates: JosephSequenceObjectiveCandidate[];
  archiveEntries: JosephQualityDiversityArchiveEntry[];
  selectedPath: {
    candidateIds: string[];
    doctrineBranchIds: string[];
    finalScore: number;
  };
};

type ManifestWithDoctrine = UnifiedRenderManifest & {
  _doctrineBranch?: string;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const isCutEvent = (event: TimelineEvent): event is CutEvent => event.type === "cut";
const isTextEvent = (event: TimelineEvent): event is TextEvent => event.type === "text";

const doctrineBranchOf = (manifest: UnifiedRenderManifest): string =>
  (manifest as ManifestWithDoctrine)._doctrineBranch ??
  manifest.josephBackground?.primitives[0]?.primitiveId ??
  manifest.creativeProfile.name;

const cutsOf = (manifest: UnifiedRenderManifest): CutEvent[] =>
  manifest.timeline.filter(isCutEvent).sort((left, right) => left.atMs - right.atMs);

const textsOf = (manifest: UnifiedRenderManifest): TextEvent[] =>
  manifest.timeline.filter(isTextEvent).sort((left, right) => left.startMs - right.startMs);

const motionEnergyOf = (manifest: UnifiedRenderManifest): JosephArchiveCell["motionEnergy"] => {
  if (manifest.cameraMoves.length === 0) {
    return "none";
  }

  const active = manifest.cameraMoves.some((move: CameraMove) => move.type === "shake" || move.type === "dutch");
  return active || manifest.cameraMoves.length >= 3 ? "active" : "subtle";
};

const intensityOf = (manifest: UnifiedRenderManifest): JosephArchiveCell["intensity"] => {
  const profile = manifest.creativeProfile;
  const combined = profile.cutDensity * 0.3 + profile.textDensity * 0.25 + profile.sfxDensity * 0.2 + profile.cameraAggression * 0.25;
  if (combined < 0.3) {
    return "minimal";
  }
  if (combined < 0.52) {
    return "restrained";
  }
  if (combined < 0.76) {
    return "balanced";
  }
  return "expressive";
};

const visualDensityOf = (manifest: UnifiedRenderManifest): JosephArchiveCell["visualDensity"] => {
  const durationMs = Math.max(1, manifest.source.durationMs);
  const visualEventsPerSecond = (cutsOf(manifest).length + textsOf(manifest).length + manifest.cameraMoves.length) / (durationMs / 1000);
  if (visualEventsPerSecond < 0.8) {
    return "sparse";
  }
  if (visualEventsPerSecond < 1.7) {
    return "balanced";
  }
  return "dense";
};

const editorialRoleOf = (manifest: UnifiedRenderManifest): JosephArchiveCell["editorialRole"] => {
  const choreographyRoles = manifest.josephChoreography?.segments.map((segment) => segment.role) ?? [];
  if (choreographyRoles.includes("cta") || choreographyRoles.includes("release")) {
    return "payoff";
  }
  if (choreographyRoles.includes("escalation") || manifest.audio.energyCurve?.some((energy) => energy >= 0.82)) {
    return "tension";
  }
  return "setup";
};

const buildArchiveCell = (manifest: UnifiedRenderManifest): JosephArchiveCell => {
  const intensity = intensityOf(manifest);
  const visualDensity = visualDensityOf(manifest);
  const motionEnergy = motionEnergyOf(manifest);
  const editorialRole = editorialRoleOf(manifest);
  return {
    key: `${intensity}|${visualDensity}|${motionEnergy}|${editorialRole}`,
    intensity,
    visualDensity,
    motionEnergy,
    editorialRole,
  };
};

const retrievalPracticalityOf = (manifest: UnifiedRenderManifest): number => {
  const backgroundGoverned = manifest.josephBackground?.parameterAudit.governed ? 0.08 : 0;
  const hasCuratedBackground = (manifest.josephBackground?.primitives.length ?? 0) > 0 ? 0.08 : 0;
  const hasPiPPlan = manifest.josephPiP ? 0.04 : 0;
  return clamp01(0.74 + backgroundGoverned + hasCuratedBackground + hasPiPPlan);
};

const qdPlannerScore = (candidate: {
  score: CandidateScore;
  archiveCell: JosephArchiveCell;
}): number => {
  const {score, archiveCell} = candidate;
  const balanceBonus = archiveCell.intensity !== "expressive" || archiveCell.visualDensity !== "dense" ? 0.07 : 0;
  const motionBonus = archiveCell.motionEnergy === "active" && score.sequenceDiscipline.penalty > 0.18 ? -0.08 : 0.04;
  return clamp01(
    score.qualityScore * 0.44 +
      (1 - score.sequenceDiscipline.penalty) * 0.28 +
      (1 - score.similarityScore) * 0.12 +
      retrievalPracticalityOf(score.manifest) * 0.1 +
      balanceBonus +
      motionBonus,
  );
};

const buildArchiveEntries = (scores: CandidateScore[]): JosephQualityDiversityArchiveEntry[] => {
  const elites = new Map<string, JosephQualityDiversityArchiveEntry>();

  for (const score of scores) {
    const archiveCell = buildArchiveCell(score.manifest);
    const candidate = {
      candidateId: score.manifest.jobId,
      doctrineBranchId: doctrineBranchOf(score.manifest),
      archiveCell,
      plannerScore: qdPlannerScore({score, archiveCell}),
      source: "live-candidate" as const,
    };
    const current = elites.get(archiveCell.key);
    if (!current || candidate.plannerScore > current.plannerScore) {
      elites.set(archiveCell.key, candidate);
    }
  }

  return [...elites.values()].sort(
    (left, right) => right.plannerScore - left.plannerScore || left.candidateId.localeCompare(right.candidateId),
  );
};

const scoreCandidate = (
  score: CandidateScore,
  archiveEntries: JosephQualityDiversityArchiveEntry[],
): JosephSequenceObjectiveBreakdown => {
  const metrics = score.sequenceDiscipline.metrics;
  const manifest = score.manifest;
  const archiveCell = buildArchiveCell(manifest);
  const isArchiveElite = archiveEntries.some(
    (entry) => entry.candidateId === manifest.jobId && entry.archiveCell.key === archiveCell.key,
  );
  const sequenceConsequence = clamp01(
    0.72 -
      score.sequenceDiscipline.penalty * 0.9 -
      (metrics.highEnergyRun >= 4 && metrics.breatheFrameCount === 0 ? 0.18 : 0) -
      Math.min(0.16, metrics.blockedEffectFrames * 0.04),
  );
  const repetitionAvoidance = clamp01(
    0.78 -
      Math.max(0, metrics.maxTypographyRun - 1) * 0.07 -
      Math.max(0, metrics.maxMotionRun - 1) * 0.08 -
      Math.max(0, metrics.repeatedCutCadenceRun - 1) * 0.06,
  );
  const branch = doctrineBranchOf(manifest);
  const intensity = archiveCell.intensity;
  const doctrineCoherence = clamp01(
    0.62 +
      (branch === "restrained-cinematic" && intensity !== "expressive" ? 0.18 : 0) +
      (branch === "kinetic-pulse" && intensity === "expressive" && score.sequenceDiscipline.penalty <= 0.18 ? 0.14 : 0) +
      (branch === "spotlight-swap" && visualDensityOf(manifest) !== "dense" ? 0.12 : 0),
  );
  const surprisePreservation = clamp01(
    0.58 +
      (motionEnergyOf(manifest) === "active" ? 0.11 : 0.04) -
      (metrics.highEnergyRun >= 4 && intensity === "expressive" ? 0.18 : 0),
  );
  const climaxBudgetPreservation = clamp01(
    0.66 -
      (metrics.highEnergyRun >= 4 && intensity === "expressive" ? 0.18 : 0) -
      (metrics.repeatedCutCadenceRun >= 3 ? 0.12 : 0) +
      (editorialRoleOf(manifest) === "payoff" && metrics.breatheFrameCount > 0 ? 0.08 : 0),
  );
  const retrievalPracticality = retrievalPracticalityOf(manifest);
  const qdDiversityPressure = isArchiveElite ? 0.12 : 0;
  const qualityFloor = clamp01(score.qualityScore);
  const replayNovelty = clamp01(1 - score.similarityScore);
  const finalScore = clamp01(
    sequenceConsequence * 0.22 +
      repetitionAvoidance * 0.18 +
      doctrineCoherence * 0.16 +
      surprisePreservation * 0.12 +
      climaxBudgetPreservation * 0.12 +
      retrievalPracticality * 0.08 +
      qdDiversityPressure * 0.05 +
      qualityFloor * 0.05 +
      replayNovelty * 0.02,
  );

  return {
    sequenceConsequence,
    repetitionAvoidance,
    doctrineCoherence,
    surprisePreservation,
    climaxBudgetPreservation,
    retrievalPracticality,
    qdDiversityPressure,
    qualityFloor,
    replayNovelty,
    finalScore,
  };
};

const reasonsFor = (breakdown: JosephSequenceObjectiveBreakdown, score: CandidateScore): string[] => [
  `Sequence Objective scored ${breakdown.finalScore.toFixed(3)} for ${score.manifest.jobId}.`,
  `Sequence consequence ${breakdown.sequenceConsequence.toFixed(3)} after penalty ${score.sequenceDiscipline.penalty.toFixed(3)}.`,
  breakdown.qdDiversityPressure > 0
    ? "Quality-Diversity Archive preserved this candidate as an elite for its behavior cell."
    : "Quality-Diversity Archive did not select this candidate as its cell elite.",
];

export const rankJosephSequenceObjective = ({
  scores,
}: {
  scores: CandidateScore[];
}): JosephSequenceObjectiveRanking => {
  const archiveEntries = buildArchiveEntries(scores);
  const candidates = scores
    .map((score): JosephSequenceObjectiveCandidate => {
      const archiveCell = buildArchiveCell(score.manifest);
      const scoreBreakdown = scoreCandidate(score, archiveEntries);
      return {
        candidateId: score.manifest.jobId,
        doctrineBranchId: doctrineBranchOf(score.manifest),
        archiveCell,
        scoreBreakdown,
        selected: false,
        reasons: reasonsFor(scoreBreakdown, score),
      };
    })
    .sort(
      (left, right) =>
        right.scoreBreakdown.finalScore - left.scoreBreakdown.finalScore ||
        left.candidateId.localeCompare(right.candidateId),
    );

  const selected = candidates[0] ?? null;
  const markedCandidates = candidates.map((candidate) => ({
    ...candidate,
    selected: selected?.candidateId === candidate.candidateId,
  }));

  return {
    version: JOSEPH_SEQUENCE_OBJECTIVE_VERSION,
    selectedCandidateId: selected?.candidateId ?? null,
    selectedDoctrineBranchId: selected?.doctrineBranchId ?? null,
    candidates: markedCandidates,
    archiveEntries,
    selectedPath: {
      candidateIds: selected ? [selected.candidateId] : [],
      doctrineBranchIds: selected ? [selected.doctrineBranchId] : [],
      finalScore: selected?.scoreBreakdown.finalScore ?? 0,
    },
  };
};
