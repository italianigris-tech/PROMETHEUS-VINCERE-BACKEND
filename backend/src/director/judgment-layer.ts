import {
  type CameraMove,
  type CutEvent,
  type SFXEvent,
  type TextEvent,
  type TextOverlay,
  type TimelineEvent,
  type Transition,
  type TransitionEvent,
  type UnifiedRenderManifest,
} from "@prometheus/shared-types";
import type {ReplayLedger, ReplayLedgerEntry} from "../ledger/replay-ledger";
import type {JudgmentVerdict} from "../ledger/evidence-preservation";
import type {GovernedPrompt} from "./prompt-governance";
import {fingerprintString} from "./prompt-governance";
import type {VariationKey} from "./variation-key";
import {evaluateManifestMicroAnimationQuality} from "./micro-animation-primitives";
import {evaluateManifestTypographyQuality} from "./joseph-typography-intelligence";
import {evaluateJosephSequenceDiscipline, type SequenceDisciplineEvaluation} from "./joseph-sequence-discipline";
import {rankJosephSequenceObjective, type JosephSequenceObjectiveRanking} from "./joseph-sequence-objective";

export interface CandidateScore {
  manifest: UnifiedRenderManifest;
  qualityScore: number;
  similarityScore: number;
  passedFloor: boolean;
  floorFailures: string[];
  sequenceDiscipline: SequenceDisciplineEvaluation;
}

export interface JudgmentResult {
  selected: UnifiedRenderManifest;
  rejected: UnifiedRenderManifest[];
  scores: CandidateScore[];
  sequenceObjective: JosephSequenceObjectiveRanking;
  verdict: JudgmentVerdict;
}

export interface JudgmentLayerOptions {
  similarityThresholdSamePrompt?: number;
  similarityThresholdDiffPrompt?: number;
  sequenceDisciplineEnabled?: boolean;
}

type ManifestWithExtensions = UnifiedRenderManifest & {
  cuts?: Array<number | CutEvent>;
  sfxEvents?: SFXEvent[];
  profile?: string;
  _sequenceMemory?: {
    highEnergy20sWindows?: number;
    breatheFrames?: number[];
  };
};

type NormalizedText = {
  startMs: number;
  endMs: number;
  style?: string;
  color?: string;
  y?: number;
};

type EffectRange = {
  type: string;
  startFrame: number;
  endFrame: number;
};

type SimilarityEvaluation = {
  score: CandidateScore;
  samePromptSimilarity: number;
  differentPromptSimilarity: number;
};

const PROFILE_BODY_STRIDE_MS: Record<string, number> = {
  joseph_aggressive: 2_000,
  joseph_cinematic: 4_000,
  joseph_minimal: 6_000,
};

const PROFILE_TEXT_COVERAGE_MAX: Record<string, number> = {
  joseph_aggressive: 0.8,
  joseph_cinematic: 0.45,
  joseph_minimal: 0.2,
};

const PROFILE_SFX_DENSITY_MAX: Record<string, number> = {
  joseph_aggressive: 1,
  joseph_cinematic: 0.5,
  joseph_minimal: 0,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const durationMsOf = (manifest: UnifiedRenderManifest): number => {
  const sourceDuration = manifest.source?.durationMs;
  if (Number.isFinite(sourceDuration) && sourceDuration > 0) {
    return sourceDuration;
  }

  return Math.round((manifest.durationFrames / manifest.fps) * 1000);
};

const profileOf = (manifest: UnifiedRenderManifest): string =>
  (manifest as ManifestWithExtensions).profile ?? manifest.creativeProfile?.name ?? "joseph_aggressive";

const isCutEvent = (event: TimelineEvent): event is CutEvent => event.type === "cut";
const isTextEvent = (event: TimelineEvent): event is TextEvent => event.type === "text";
const isTransitionEvent = (event: TimelineEvent): event is TransitionEvent => event.type === "transition";

const msToFrame = (ms: number, fps: number): number => Math.round((ms / 1000) * fps);
const frameToMs = (frame: number, fps: number): number => Math.round((frame / fps) * 1000);

const cutsOf = (manifest: UnifiedRenderManifest): CutEvent[] => {
  const timelineCuts = manifest.timeline.filter(isCutEvent);
  const legacyCuts = ((manifest as ManifestWithExtensions).cuts ?? []).map((cut, index): CutEvent => {
    if (typeof cut === "number") {
      return {type: "cut", atMs: cut, toMs: cut, style: "hard", intensity: 1};
    }

    return {...cut, type: "cut", intensity: cut.intensity ?? 1, toMs: cut.toMs ?? cut.atMs, style: cut.style ?? "hard"};
  });

  return [...timelineCuts, ...legacyCuts].sort((left, right) => left.atMs - right.atMs);
};

const sfxOf = (manifest: UnifiedRenderManifest): SFXEvent[] => [
  ...(manifest.audio?.sfx ?? []),
  ...((manifest as ManifestWithExtensions).sfxEvents ?? []),
].sort((left, right) => left.triggerMs - right.triggerMs);

const textFromTimeline = (manifest: UnifiedRenderManifest): NormalizedText[] =>
  manifest.timeline.filter(isTextEvent).map((event) => ({
    startMs: event.startMs,
    endMs: event.endMs,
    style: event.style,
    color: event.color,
    y: event.position?.y,
  }));

const textFromOverlays = (manifest: UnifiedRenderManifest): NormalizedText[] =>
  manifest.textOverlays.map((overlay: TextOverlay) => ({
    startMs: frameToMs(overlay.startFrame, manifest.fps),
    endMs: frameToMs(overlay.endFrame, manifest.fps),
    style: overlay.animation,
    color: overlay.color,
  }));

const textsOf = (manifest: UnifiedRenderManifest): NormalizedText[] => {
  const timelineTexts = textFromTimeline(manifest);
  return timelineTexts.length > 0 ? timelineTexts : textFromOverlays(manifest);
};

const transitionEffectsOf = (manifest: UnifiedRenderManifest): EffectRange[] => {
  const timelineTransitions: EffectRange[] = manifest.timeline.filter(isTransitionEvent).map((event) => ({
    type: event.style,
    startFrame: msToFrame(event.atMs, manifest.fps),
    endFrame: msToFrame(event.atMs + event.durationMs, manifest.fps),
  }));

  const rootTransitions: EffectRange[] = manifest.transitions.map((transition: Transition) => ({
    type: (transition as Transition & {style?: string}).style ?? "zoom_blur",
    startFrame: transition.startFrame,
    endFrame: transition.endFrame,
  }));

  const zoomBlurCuts: EffectRange[] = cutsOf(manifest)
    .filter((cut) => cut.style === "zoom_blur")
    .map((cut) => {
      const frame = msToFrame(cut.atMs, manifest.fps);
      return {type: "zoom_blur", startFrame: frame, endFrame: frame};
    });

  return [...timelineTransitions, ...rootTransitions, ...zoomBlurCuts];
};

const cameraEffectsOf = (manifest: UnifiedRenderManifest): EffectRange[] =>
  manifest.cameraMoves.map((move: CameraMove) => ({
    type: move.type,
    startFrame: move.startFrame,
    endFrame: move.endFrame,
  }));

const rangesOverlap = (left: EffectRange, right: EffectRange): boolean =>
  left.startFrame <= right.endFrame && right.startFrame <= left.endFrame;

const hasTooMuchTextOverlap = (texts: NormalizedText[]): boolean =>
  texts.some((text) => texts.filter((candidate) => candidate.startMs <= text.startMs && candidate.endMs >= text.startMs).length > 3);

const hasTooTightTextSpacing = (texts: NormalizedText[]): boolean => {
  const starts = texts.map((text) => text.startMs).sort((left, right) => left - right);
  return starts.some((start, index) => index > 0 && start - (starts[index - 1] ?? start) < 200);
};

const textCoverage = (texts: NormalizedText[], durationMs: number): number => {
  if (durationMs <= 0) {
    return 0;
  }

  const totalTextMs = texts.reduce((sum, text) => sum + Math.max(0, Math.min(text.endMs, durationMs) - Math.max(0, text.startMs)), 0);
  return totalTextMs / durationMs;
};

const hasCueNear = (sfx: SFXEvent[], cue: SFXEvent["cue"], ms: number, toleranceMs = 140): boolean =>
  sfx.some((event) => event.cue === cue && Math.abs(event.triggerMs - ms) <= toleranceMs);

const hasSfxAnimationDesync = (manifest: UnifiedRenderManifest, cuts: CutEvent[], texts: NormalizedText[], sfx: SFXEvent[]): boolean => {
  const profileSfxDensity = manifest.creativeProfile?.sfxDensity ?? PROFILE_SFX_DENSITY_MAX[profileOf(manifest)] ?? 1;

  if (profileSfxDensity <= 0 || sfx.length === 0) {
    return false;
  }

  if (profileSfxDensity >= 1) {
    const hardCutMissingWhoosh = cuts.some((cut) => cut.style === "hard" && !hasCueNear(sfx, "whoosh_fast", cut.atMs));
    if (hardCutMissingWhoosh) {
      return true;
    }
  }

  return texts.some((text) => {
    const highSalience = text.color?.toUpperCase() === "#FF0040" || text.style === "glitch";
    if (!highSalience) {
      return false;
    }

    if (text.style === "glitch") {
      return !hasCueNear(sfx, "glitch_digital", text.startMs);
    }

    if (text.style === "pop") {
      return !hasCueNear(sfx, "pop_text", text.startMs);
    }

    return false;
  });
};

const bodyCutDensityIsLow = (manifest: UnifiedRenderManifest, cuts: CutEvent[], durationMs: number): boolean => {
  const bodyStartMs = Math.min(3000, durationMs);
  const bodyEndMs = Math.max(bodyStartMs, durationMs - 3000);
  const bodyDurationMs = bodyEndMs - bodyStartMs;
  if (bodyDurationMs <= 0) {
    return false;
  }

  const strideMs = PROFILE_BODY_STRIDE_MS[profileOf(manifest)] ?? PROFILE_BODY_STRIDE_MS.joseph_aggressive;
  const requiredCuts = Math.max(1, Math.ceil(bodyDurationMs / strideMs));
  const bodyCuts = cuts.filter((cut) => cut.atMs > bodyStartMs && cut.atMs < bodyEndMs);
  return bodyCuts.length < requiredCuts;
};

const densityPenaltyOf = (manifest: UnifiedRenderManifest, cuts: CutEvent[], texts: NormalizedText[], sfx: SFXEvent[], durationMs: number): number => {
  const profile = profileOf(manifest);
  const textMax = PROFILE_TEXT_COVERAGE_MAX[profile] ?? PROFILE_TEXT_COVERAGE_MAX.joseph_aggressive;
  const sfxMax = PROFILE_SFX_DENSITY_MAX[profile] ?? PROFILE_SFX_DENSITY_MAX.joseph_aggressive;
  let penalty = 0;

  if (textCoverage(texts, durationMs) > textMax) {
    penalty += 1;
  }

  const sfxDensity = cuts.length > 0 ? sfx.length / cuts.length : sfx.length;
  if (sfxDensity > sfxMax) {
    penalty += 1;
  }

  return penalty;
};

export const meetsQualityFloor = (
  manifest: UnifiedRenderManifest,
  options: {sequenceDisciplineEnabled?: boolean} = {},
): CandidateScore => {
  const failures: string[] = [];
  const durationMs = durationMsOf(manifest);
  const cuts = cutsOf(manifest);
  const texts = textsOf(manifest);
  const sfx = sfxOf(manifest);

  if (durationMs > 90_000) {
    failures.push("duration_exceeds_90s");
  }

  if (manifest.width !== 1080 || manifest.height !== 1920) {
    failures.push("wrong_resolution");
  }

  if (cuts.filter((cut) => cut.atMs <= 3000).length < 2) {
    failures.push("hook_cuts < 2");
  }

  if (cuts.filter((cut) => cut.atMs >= Math.max(0, durationMs - 3000) && cut.atMs <= durationMs).length < 1) {
    failures.push("cta_cuts < 1");
  }

  if (bodyCutDensityIsLow(manifest, cuts, durationMs)) {
    failures.push("body_cut_density_low");
  }

  if (hasTooMuchTextOverlap(texts)) {
    failures.push("text_overlap > 3");
  }

  if (hasTooTightTextSpacing(texts)) {
    failures.push("text_spacing < 200ms");
  }

  if (texts.some((text) => text.y !== undefined && text.y > 0.4)) {
    failures.push("text_below_safe_zone");
  }

  const shakeEffects = cameraEffectsOf(manifest).filter((effect) => effect.type === "shake");
  const zoomBlurEffects = transitionEffectsOf(manifest).filter((effect) => effect.type === "zoom_blur");
  if (shakeEffects.some((shake) => zoomBlurEffects.some((zoomBlur) => rangesOverlap(shake, zoomBlur)))) {
    failures.push("shake_zoom_blur_collision");
  }

  const sequenceMemory = (manifest as ManifestWithExtensions)._sequenceMemory;
  if ((sequenceMemory?.highEnergy20sWindows ?? 0) > 0 && (sequenceMemory?.breatheFrames?.length ?? 0) === 0) {
    failures.push("missing_breathe_beat");
  }

  if (hasSfxAnimationDesync(manifest, cuts, texts, sfx)) {
    failures.push("sfx_animation_desync");
  }

  const microAnimationQuality = evaluateManifestMicroAnimationQuality(manifest);
  failures.push(...microAnimationQuality.failures);
  const typographyQuality = evaluateManifestTypographyQuality(manifest);
  failures.push(...typographyQuality.failures);

  const sequenceDiscipline = evaluateJosephSequenceDiscipline(manifest, {enabled: options.sequenceDisciplineEnabled});
  const densityPenalty = densityPenaltyOf(manifest, cuts, texts, sfx, durationMs);
  const microAnimationPenalty = 1 - microAnimationQuality.score;
  const typographyPenalty = 1 - typographyQuality.score;
  const qualityScore = clamp01(
    1 -
      failures.length * 0.1 -
      densityPenalty * 0.05 -
      microAnimationPenalty * 0.15 -
      typographyPenalty * 0.12 -
      sequenceDiscipline.penalty * 0.2,
  );

  return {
    manifest,
    qualityScore,
    similarityScore: 0,
    passedFloor: failures.length === 0,
    floorFailures: failures,
    sequenceDiscipline,
  };
};

export function computeSimilarityHash(manifest: UnifiedRenderManifest): string {
  const cuts = cutsOf(manifest);
  const texts = textsOf(manifest);
  const transitionTypes = [
    ...manifest.transitions.map((transition) => (transition as Transition & {style?: string}).style ?? "transition"),
    ...manifest.timeline.filter(isTransitionEvent).map((transition) => transition.style),
  ];

  const structural = {
    cutCount: cuts.length,
    cutPositions: cuts.map((cut) => Math.round(cut.atMs / 100)),
    textCount: texts.length,
    textPositions: texts.map((text) => Math.round(text.startMs / 100)),
    transitionTypes: transitionTypes.sort(),
    cameraMoves: manifest.cameraMoves.map((move) => move.type).sort(),
    profile: profileOf(manifest),
  };

  return fingerprintString(JSON.stringify(structural));
}

export function hashSimilarity(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) {
    return 0;
  }

  let diff = Math.abs(a.length - b.length);
  for (let index = 0; index < len; index += 1) {
    if (a[index] !== b[index]) {
      diff += 1;
    }
  }

  return clamp01(1 - diff / Math.max(a.length, b.length));
}

type SimilaritySignature = {
  cutPositions: number[];
  textPositions: number[];
  transitionTypes: string[];
  cameraMoves: string[];
  profile: string;
};

const similaritySignature = (manifest: UnifiedRenderManifest): SimilaritySignature => ({
  cutPositions: cutsOf(manifest).map((cut) => Math.round(cut.atMs / 100)),
  textPositions: textsOf(manifest).map((text) => Math.round(text.startMs / 100)),
  transitionTypes: [
    ...manifest.transitions.map((transition) => (transition as Transition & {style?: string}).style ?? "transition"),
    ...manifest.timeline.filter(isTransitionEvent).map((transition) => transition.style),
  ].sort(),
  cameraMoves: manifest.cameraMoves.map((move) => move.type).sort(),
  profile: profileOf(manifest),
});

const jaccard = <T>(left: T[], right: T[]): number => {
  if (left.length === 0 && right.length === 0) {
    return 1;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
};

const structuralSimilarity = (left: SimilaritySignature, right: SimilaritySignature): number => {
  const profileScore = left.profile === right.profile ? 1 : 0;
  return (
    jaccard(left.cutPositions, right.cutPositions) * 0.4 +
    jaccard(left.textPositions, right.textPositions) * 0.2 +
    jaccard(left.transitionTypes, right.transitionTypes) * 0.15 +
    jaccard(left.cameraMoves, right.cameraMoves) * 0.15 +
    profileScore * 0.1
  );
};

const parseChosenGenome = (entry: ReplayLedgerEntry): UnifiedRenderManifest | null => {
  try {
    const parsed = JSON.parse(entry.chosenGenome) as UnifiedRenderManifest;
    return parsed && typeof parsed === "object" && Array.isArray(parsed.timeline) ? parsed : null;
  } catch {
    return null;
  }
};

const replaySimilarity = (candidate: UnifiedRenderManifest, entry: ReplayLedgerEntry): number => {
  const priorManifest = parseChosenGenome(entry);
  if (priorManifest) {
    return structuralSimilarity(similaritySignature(candidate), similaritySignature(priorManifest));
  }

  return hashSimilarity(computeSimilarityHash(candidate), entry.similarityHash);
};
const skipExactReplayEntry = (entry: ReplayLedgerEntry, variationKey: VariationKey): boolean =>
  entry.uploadInstanceId === variationKey.uploadInstanceId && entry.retryIndex === variationKey.retryIndex;

const evaluateSimilarity = (
  score: CandidateScore,
  priorEntries: ReplayLedgerEntry[],
  variationKey: VariationKey,
): SimilarityEvaluation => {
  const candidateHash = computeSimilarityHash(score.manifest);
  let samePromptSimilarity = 0;
  let differentPromptSimilarity = 0;

  for (const entry of priorEntries) {
    if (skipExactReplayEntry(entry, variationKey)) {
      continue;
    }

    const similarity = replaySimilarity(score.manifest, entry);
    if (entry.promptFingerprint === variationKey.promptFingerprint) {
      samePromptSimilarity = Math.max(samePromptSimilarity, similarity);
    } else {
      differentPromptSimilarity = Math.max(differentPromptSimilarity, similarity);
    }
  }

  return {
    score: {
      ...score,
      similarityScore: Math.max(samePromptSimilarity, differentPromptSimilarity),
    },
    samePromptSimilarity,
    differentPromptSimilarity,
  };
};

const passesSimilarity = (
  evaluation: SimilarityEvaluation,
  samePromptThreshold: number,
  differentPromptThreshold: number,
): boolean =>
  evaluation.samePromptSimilarity <= samePromptThreshold &&
  evaluation.differentPromptSimilarity <= differentPromptThreshold;

const uniqueFailureTags = (scores: CandidateScore[], rejected: UnifiedRenderManifest[]): string[] => {
  const rejectedSet = new Set(rejected);
  return [...new Set(scores
    .filter((score) => rejectedSet.has(score.manifest))
    .flatMap((score) => score.floorFailures))];
};

export class JudgmentLayer {
  private readonly similarityThresholdSamePrompt: number;
  private readonly similarityThresholdDiffPrompt: number;
  private readonly sequenceDisciplineEnabled: boolean;

  constructor(
    private readonly ledger: ReplayLedger,
    options: JudgmentLayerOptions = {},
  ) {
    this.similarityThresholdSamePrompt = options.similarityThresholdSamePrompt ?? 0.85;
    this.similarityThresholdDiffPrompt = options.similarityThresholdDiffPrompt ?? 0.7;
    this.sequenceDisciplineEnabled = options.sequenceDisciplineEnabled ?? true;
  }

  async judgeCandidates(
    candidates: UnifiedRenderManifest[],
    variationKey: VariationKey,
    _prompt?: GovernedPrompt,
  ): Promise<JudgmentResult> {
    const floorScores = candidates.map((candidate) =>
      meetsQualityFloor(candidate, {sequenceDisciplineEnabled: this.sequenceDisciplineEnabled})
    );
    const floorPassed = floorScores.filter((score) => score.passedFloor);

    if (floorPassed.length === 0) {
      throw new Error("No candidates passed quality floor");
    }

    const priorEntries = this.ledger.getBySource(variationKey.sourceFingerprint);
    const evaluated = floorPassed.map((score) => evaluateSimilarity(score, priorEntries, variationKey));
    let qualified = evaluated.filter((evaluation) =>
      passesSimilarity(evaluation, this.similarityThresholdSamePrompt, this.similarityThresholdDiffPrompt)
    );

    if (qualified.length === 0) {
      qualified = evaluated.filter((evaluation) =>
        passesSimilarity(
          evaluation,
          Math.min(1, this.similarityThresholdSamePrompt + 0.1),
          Math.min(1, this.similarityThresholdDiffPrompt + 0.1),
        )
      );
    }

    if (qualified.length === 0) {
      throw new Error("No novel candidates passed judgment - all too similar to Replay Ledger");
    }

    const sequenceObjective = rankJosephSequenceObjective({
      scores: qualified.map((evaluation) => evaluation.score),
    });
    const selectedEvaluation = qualified.find((evaluation) =>
      evaluation.score.manifest.jobId === sequenceObjective.selectedCandidateId) ?? qualified[0];
    if (!selectedEvaluation) {
      throw new Error("No candidates passed judgment");
    }

    const selected = selectedEvaluation.score.manifest;
    const scores = floorScores.map((score) => {
      const evaluatedScore = evaluated.find((candidate) => candidate.score.manifest === score.manifest)?.score;
      return evaluatedScore ?? score;
    });
    const rejected = candidates.filter((candidate) => candidate !== selected);
    const rejectedTags = uniqueFailureTags(scores, rejected);
    const similarityVetoed = evaluated.some((evaluation) =>
      !qualified.some((candidate) => candidate.score.manifest === evaluation.score.manifest) &&
      evaluation.score.manifest !== selected
    );

    const verdict: JudgmentVerdict = {
      qualityScore: selectedEvaluation.score.qualityScore,
      similarityScore: selectedEvaluation.score.similarityScore,
      passedFloor: true,
      failureTags: similarityVetoed ? [...rejectedTags, "replay_similarity_veto"] : rejectedTags,
    };

    return {
      selected,
      rejected,
      scores,
      sequenceObjective,
      verdict,
    };
  }
}
