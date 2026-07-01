import type {
  CameraMove,
  CutEvent,
  TextEvent,
  TextOverlay,
  TimelineEvent,
  Transition,
  TransitionEvent,
  UnifiedRenderManifest,
} from "@prometheus/shared-types";

export type SequenceRepetitionMetrics = {
  maxTypographyRun: number;
  maxMotionRun: number;
  repeatedCutCadenceRun: number;
  highEnergyRun: number;
  breatheFrameCount: number;
  blockedEffectFrames: number;
  repetitionPressure: number;
};

export type SequenceDensityMetrics = {
  durationSeconds: number;
  visualEventsPerSecond: number;
  textCoverage: number;
  sfxPerCut: number;
  densityScore: number;
};

export type ClimaxBudgetMetrics = {
  highEnergyShare: number;
  highEnergyWindowCount: number;
  maxDeclaredClimaxBudget: number;
  breatheFrameCount: number;
  pressure: number;
  overspent: boolean;
};

export type ReadabilityRiskMetrics = {
  maxTextOverlap: number;
  tightSpacingCount: number;
  belowSafeZoneCount: number;
  textCoverage: number;
  riskScore: number;
};

export type PrimitiveCollisionMetrics = {
  failureTags: string[];
  warnings: string[];
  collisionCount: number;
  maxConcurrentPrimitives: number;
};

export type JosephNegativeGrammarEvaluation = {
  failures: string[];
  warnings: string[];
  penalty: number;
  metrics: {
    repetition: SequenceRepetitionMetrics;
    density: SequenceDensityMetrics;
    climaxBudget: ClimaxBudgetMetrics;
    readability: ReadabilityRiskMetrics;
    primitiveCollisions: PrimitiveCollisionMetrics;
  };
};

type ManifestWithSequenceMemory = UnifiedRenderManifest & {
  _sequenceMemory?: {
    finalState?: string;
    highEnergy20sWindows?: number;
    breatheFrames?: number[];
    blockedEffectFrames?: number;
  };
};

type TimedSignature = {
  startMs: number;
  signature: string;
};

type NormalizedText = {
  startMs: number;
  endMs: number;
  style?: string;
  y?: number;
  text: string;
};

type TimedPrimitive = NonNullable<TextOverlay["microAnimation"]> & {
  startFrame: number;
  endFrame: number;
};

const HIGH_ENERGY_THRESHOLD = 0.72;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const isCutEvent = (event: TimelineEvent): event is CutEvent => event.type === "cut";
const isTextEvent = (event: TimelineEvent): event is TextEvent => event.type === "text";
const isTransitionEvent = (event: TimelineEvent): event is TransitionEvent => event.type === "transition";

const frameToMs = (frame: number, fps: number): number => Math.round((frame / fps) * 1000);
const durationMsOf = (manifest: UnifiedRenderManifest): number =>
  Math.max(1, manifest.source?.durationMs ?? Math.round((manifest.durationFrames / manifest.fps) * 1000));

const cutsOf = (manifest: UnifiedRenderManifest): CutEvent[] =>
  manifest.timeline.filter(isCutEvent).sort((left, right) => left.atMs - right.atMs);

const transitionCountOf = (manifest: UnifiedRenderManifest): number =>
  manifest.transitions.length + manifest.timeline.filter(isTransitionEvent).length;

const textFromTimeline = (manifest: UnifiedRenderManifest): NormalizedText[] =>
  manifest.timeline.filter(isTextEvent).map((event) => ({
    startMs: event.startMs,
    endMs: event.endMs,
    style: event.style,
    y: event.position?.y,
    text: event.word,
  }));

const textFromOverlays = (manifest: UnifiedRenderManifest): NormalizedText[] =>
  manifest.textOverlays.map((overlay) => ({
    startMs: frameToMs(overlay.startFrame, manifest.fps),
    endMs: frameToMs(overlay.endFrame, manifest.fps),
    style: overlay.animation,
    text: overlay.text,
  }));

const textsOf = (manifest: UnifiedRenderManifest): NormalizedText[] => {
  const timelineTexts = textFromTimeline(manifest);
  return (timelineTexts.length > 0 ? timelineTexts : textFromOverlays(manifest))
    .sort((left, right) => left.startMs - right.startMs);
};

const textSignaturesOf = (manifest: UnifiedRenderManifest): TimedSignature[] =>
  textsOf(manifest).map((text) => ({
    startMs: text.startMs,
    signature: text.style ?? "text",
  }));

const cameraSignaturesOf = (manifest: UnifiedRenderManifest): TimedSignature[] =>
  manifest.cameraMoves
    .map((move: CameraMove) => ({
      startMs: frameToMs(move.startFrame, manifest.fps),
      signature: move.type,
    }))
    .sort((left, right) => left.startMs - right.startMs);

const maxConsecutiveSignatureRun = (items: readonly TimedSignature[], maxGapMs: number): number => {
  let maxRun = 0;
  let currentRun = 0;
  let previous: TimedSignature | undefined;

  for (const item of items) {
    const continues = previous !== undefined &&
      previous.signature === item.signature &&
      item.startMs - previous.startMs <= maxGapMs;
    currentRun = continues ? currentRun + 1 : 1;
    maxRun = Math.max(maxRun, currentRun);
    previous = item;
  }

  return maxRun;
};

const maxHighEnergyRun = (energyCurve: readonly number[] = []): number => {
  let maxRun = 0;
  let currentRun = 0;

  for (const energy of energyCurve) {
    if (energy >= HIGH_ENERGY_THRESHOLD) {
      currentRun += 1;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 0;
    }
  }

  return maxRun;
};

const maxRepeatedCutCadenceRun = (cuts: readonly CutEvent[]): number => {
  if (cuts.length < 3) {
    return 0;
  }

  const intervals = cuts.slice(1).map((cut, index) => Math.round((cut.atMs - cuts[index]!.atMs) / 100));
  let maxRun = 0;
  let currentRun = 0;
  let previous: number | undefined;

  for (const interval of intervals) {
    const continues = previous !== undefined && Math.abs(interval - previous) <= 1;
    currentRun = continues ? currentRun + 1 : 1;
    maxRun = Math.max(maxRun, currentRun);
    previous = interval;
  }

  return maxRun;
};

const textCoverageOf = (texts: readonly NormalizedText[], durationMs: number): number => {
  const coveredMs = texts.reduce(
    (sum, text) => sum + Math.max(0, Math.min(text.endMs, durationMs) - Math.max(0, text.startMs)),
    0,
  );
  return clamp01(coveredMs / durationMs);
};

const maxDeclaredClimaxBudgetOf = (manifest: UnifiedRenderManifest): number =>
  Math.max(0, ...(manifest.josephChoreography?.segments.map((segment) => segment.climaxBudget) ?? []));

const timedPrimitivesOf = (manifest: UnifiedRenderManifest): TimedPrimitive[] =>
  manifest.textOverlays.flatMap((overlay) =>
    overlay.microAnimation
      ? [{
          ...overlay.microAnimation,
          startFrame: overlay.startFrame,
          endFrame: overlay.endFrame,
        }]
      : [],
  ).sort((left, right) => left.startFrame - right.startFrame);

const primitiveOverlaps = (left: TimedPrimitive, right: TimedPrimitive): boolean =>
  left.startFrame <= right.endFrame && right.startFrame <= left.endFrame;

export const measureSequenceRepetition = (manifest: UnifiedRenderManifest): SequenceRepetitionMetrics => {
  const sequenceMemory = (manifest as ManifestWithSequenceMemory)._sequenceMemory;
  const maxTypographyRun = maxConsecutiveSignatureRun(textSignaturesOf(manifest), 2_200);
  const maxMotionRun = maxConsecutiveSignatureRun(cameraSignaturesOf(manifest), 4_500);
  const repeatedCutCadenceRun = maxRepeatedCutCadenceRun(cutsOf(manifest));
  const highEnergyRun = maxHighEnergyRun(manifest.audio.energyCurve);
  const breatheFrameCount = sequenceMemory?.breatheFrames?.length ?? 0;
  const blockedEffectFrames = sequenceMemory?.blockedEffectFrames ?? 0;
  const repetitionPressure = clamp01(
    Math.max(0, maxTypographyRun - 1) * 0.12 +
      Math.max(0, maxMotionRun - 1) * 0.13 +
      Math.max(0, repeatedCutCadenceRun - 1) * 0.09 +
      Math.max(0, highEnergyRun - 3) * 0.08 +
      blockedEffectFrames * 0.05,
  );

  return {
    maxTypographyRun,
    maxMotionRun,
    repeatedCutCadenceRun,
    highEnergyRun,
    breatheFrameCount,
    blockedEffectFrames,
    repetitionPressure,
  };
};

export const measureSequenceDensity = (manifest: UnifiedRenderManifest): SequenceDensityMetrics => {
  const durationMs = durationMsOf(manifest);
  const cuts = cutsOf(manifest);
  const texts = textsOf(manifest);
  const durationSeconds = durationMs / 1000;
  const visualEventCount = cuts.length + texts.length + manifest.cameraMoves.length + transitionCountOf(manifest);
  const visualEventsPerSecond = visualEventCount / durationSeconds;
  const textCoverage = textCoverageOf(texts, durationMs);
  const sfxPerCut = cuts.length > 0 ? (manifest.audio?.sfx.length ?? 0) / cuts.length : (manifest.audio?.sfx.length ?? 0);
  const densityScore = clamp01(
    visualEventsPerSecond / 2.4 +
      textCoverage * 0.42 +
      Math.max(0, sfxPerCut - 1) * 0.12,
  );

  return {
    durationSeconds,
    visualEventsPerSecond,
    textCoverage,
    sfxPerCut,
    densityScore,
  };
};

export const measureClimaxBudget = (manifest: UnifiedRenderManifest): ClimaxBudgetMetrics => {
  const sequenceMemory = (manifest as ManifestWithSequenceMemory)._sequenceMemory;
  const energyCurve = manifest.audio.energyCurve ?? [];
  const highEnergyShare = energyCurve.length === 0
    ? 0
    : energyCurve.filter((energy) => energy >= HIGH_ENERGY_THRESHOLD).length / energyCurve.length;
  const highEnergyWindowCount = sequenceMemory?.highEnergy20sWindows ?? 0;
  const maxDeclaredClimaxBudget = maxDeclaredClimaxBudgetOf(manifest);
  const breatheFrameCount = sequenceMemory?.breatheFrames?.length ?? 0;
  const pressure = clamp01(
    highEnergyShare * 0.74 +
      Math.min(1, highEnergyWindowCount / 3) * 0.2 +
      maxDeclaredClimaxBudget * 0.3 -
      Math.min(0.3, breatheFrameCount * 0.08),
  );
  const overspent = pressure >= 0.72 &&
    breatheFrameCount === 0 &&
    (highEnergyWindowCount > 0 || maxDeclaredClimaxBudget >= 0.86);

  return {
    highEnergyShare,
    highEnergyWindowCount,
    maxDeclaredClimaxBudget,
    breatheFrameCount,
    pressure,
    overspent,
  };
};

export const measureReadabilityRisk = (manifest: UnifiedRenderManifest): ReadabilityRiskMetrics => {
  const durationMs = durationMsOf(manifest);
  const texts = textsOf(manifest);
  const maxTextOverlap = texts.reduce((maxOverlap, text) => {
    const activeAtStart = texts.filter((candidate) => candidate.startMs <= text.startMs && candidate.endMs >= text.startMs).length;
    return Math.max(maxOverlap, activeAtStart);
  }, 0);
  const tightSpacingCount = texts.reduce((count, text, index) => {
    const previous = index > 0 ? texts[index - 1] : undefined;
    return previous && text.startMs - previous.startMs < 200 ? count + 1 : count;
  }, 0);
  const belowSafeZoneCount = texts.filter((text) => text.y !== undefined && text.y > 0.4).length;
  const textCoverage = textCoverageOf(texts, durationMs);
  const riskScore = clamp01(
    (maxTextOverlap > 3 ? 0.45 : Math.max(0, maxTextOverlap - 1) * 0.08) +
      Math.min(0.22, tightSpacingCount * 0.08) +
      Math.min(0.28, belowSafeZoneCount * 0.08) +
      textCoverage * 0.28,
  );

  return {
    maxTextOverlap,
    tightSpacingCount,
    belowSafeZoneCount,
    textCoverage,
    riskScore,
  };
};

export const detectPrimitiveCollisions = (manifest: UnifiedRenderManifest): PrimitiveCollisionMetrics => {
  const selections = timedPrimitivesOf(manifest);
  const failures = new Set(manifest.microAnimationAudit?.failures ?? []);
  const warnings = new Set(manifest.microAnimationAudit?.warnings ?? []);
  let collisionCount = failures.size;
  let maxConcurrentPrimitives = 0;

  for (const selection of selections) {
    if (
      selection.semanticRole === "support" &&
      selection.parameters.intensity > 0.72 &&
      (selection.role === "emphasis" || selection.role === "mutation")
    ) {
      failures.add("micro_animation_semantic_mismatch");
    }

    const overlapping = selections.filter((candidate) => primitiveOverlaps(selection, candidate));
    maxConcurrentPrimitives = Math.max(maxConcurrentPrimitives, overlapping.length);
    const overlappingIntensity = overlapping.reduce((sum, candidate) => sum + candidate.parameters.intensity, 0);
    const hotOverlaps = overlapping.filter((candidate) => candidate.parameters.intensity > 0.6).length;
    if (overlapping.length > 3 && (overlappingIntensity > 2.1 || hotOverlaps >= 3)) {
      failures.add("micro_animation_visual_chaos");
    }

    const sameGroup = overlapping.filter(
      (candidate) =>
        candidate !== selection &&
        candidate.combinationGroup === selection.combinationGroup,
    );
    if (sameGroup.length === 0) {
      continue;
    }

    collisionCount += sameGroup.length;
    if (selection.combinationGroup === "entry") {
      const sameStartEntry = sameGroup.some((candidate) => candidate.startFrame === selection.startFrame);
      if (sameStartEntry) {
        failures.add("micro_entry_collision");
      } else {
        warnings.add("micro_entry_overlap");
      }
    }
    if (selection.combinationGroup === "emphasis-mark") {
      failures.add("micro_emphasis_collision");
    }
    if (selection.combinationGroup === "semantic-mutation") {
      failures.add("micro_mutation_collision");
    }
  }

  return {
    failureTags: [...failures].sort(),
    warnings: [...warnings].sort(),
    collisionCount,
    maxConcurrentPrimitives,
  };
};

export const evaluateJosephNegativeGrammar = (manifest: UnifiedRenderManifest): JosephNegativeGrammarEvaluation => {
  const repetition = measureSequenceRepetition(manifest);
  const density = measureSequenceDensity(manifest);
  const climaxBudget = measureClimaxBudget(manifest);
  const readability = measureReadabilityRisk(manifest);
  const primitiveCollisions = detectPrimitiveCollisions(manifest);
  const failures = new Set<string>(primitiveCollisions.failureTags);
  const warnings = new Set<string>(primitiveCollisions.warnings);

  if (primitiveCollisions.failureTags.length > 0) {
    failures.add("primitive-collision");
  }
  if (readability.riskScore >= 0.6) {
    failures.add("readability-sacrifice");
  }
  if (climaxBudget.overspent) {
    failures.add("climax-overspend");
  }
  if (repetition.repetitionPressure >= 0.34) {
    warnings.add("repetition-fatigue");
  }
  if (density.densityScore >= 0.65) {
    warnings.add("visual-density-overload");
  }

  const penalty = clamp01(
    repetition.repetitionPressure * 0.22 +
      density.densityScore * 0.18 +
      climaxBudget.pressure * 0.2 +
      readability.riskScore * 0.24 +
      Math.min(0.16, primitiveCollisions.failureTags.length * 0.05),
  );

  return {
    failures: [...failures].sort(),
    warnings: [...warnings].sort(),
    penalty,
    metrics: {
      repetition,
      density,
      climaxBudget,
      readability,
      primitiveCollisions,
    },
  };
};
