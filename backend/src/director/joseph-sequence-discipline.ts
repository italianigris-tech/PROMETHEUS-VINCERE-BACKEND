import type {
  CameraMove,
  CutEvent,
  TextEvent,
  TextOverlay,
  TimelineEvent,
  UnifiedRenderManifest,
} from "@prometheus/shared-types";

export type SequenceDisciplineSeverity = "medium" | "high" | "critical";

export type SequenceDisciplineViolation = {
  ruleId: string;
  message: string;
  severity: SequenceDisciplineSeverity;
  blocking: boolean;
  penalty: number;
};

export type SequenceDisciplineMetrics = {
  maxTypographyRun: number;
  maxMotionRun: number;
  highEnergyRun: number;
  repeatedCutCadenceRun: number;
  breatheFrameCount: number;
  blockedEffectFrames: number;
  finalSequenceState: string;
};

export type SequenceDisciplineEvaluation = {
  enabled: boolean;
  penalty: number;
  violations: SequenceDisciplineViolation[];
  metrics: SequenceDisciplineMetrics;
};

type ManifestWithSequenceMemory = UnifiedRenderManifest & {
  _sequenceMemory?: {
    finalState?: string;
    breatheFrames?: number[];
    blockedEffectFrames?: number;
  };
};

type TimedSignature = {
  startMs: number;
  signature: string;
};

const HIGH_ENERGY_THRESHOLD = 0.72;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const isCutEvent = (event: TimelineEvent): event is CutEvent => event.type === "cut";
const isTextEvent = (event: TimelineEvent): event is TextEvent => event.type === "text";

const frameToMs = (frame: number, fps: number): number => Math.round((frame / fps) * 1000);

const textSignature = (text: TextEvent): TimedSignature => ({
  startMs: text.startMs,
  signature: text.style,
});

const overlaySignature = (overlay: TextOverlay, fps: number): TimedSignature => ({
  startMs: frameToMs(overlay.startFrame, fps),
  signature: overlay.microAnimation?.primitiveId ?? overlay.animation,
});

const textSignaturesOf = (manifest: UnifiedRenderManifest): TimedSignature[] => {
  const timelineText = manifest.timeline.filter(isTextEvent).map(textSignature);
  const signatures = timelineText.length > 0
    ? timelineText
    : manifest.textOverlays.map((overlay) => overlaySignature(overlay, manifest.fps));
  return signatures.sort((left, right) => left.startMs - right.startMs);
};

const cameraSignaturesOf = (manifest: UnifiedRenderManifest): TimedSignature[] =>
  manifest.cameraMoves
    .map((move: CameraMove) => ({
      startMs: frameToMs(move.startFrame, manifest.fps),
      signature: move.type,
    }))
    .sort((left, right) => left.startMs - right.startMs);

const cutsOf = (manifest: UnifiedRenderManifest): CutEvent[] =>
  manifest.timeline.filter(isCutEvent).sort((left, right) => left.atMs - right.atMs);

const maxConsecutiveSignatureRun = (items: TimedSignature[], maxGapMs: number): number => {
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

const buildMetrics = (manifest: UnifiedRenderManifest): SequenceDisciplineMetrics => {
  const sequenceMemory = (manifest as ManifestWithSequenceMemory)._sequenceMemory;
  return {
    maxTypographyRun: maxConsecutiveSignatureRun(textSignaturesOf(manifest), 2_200),
    maxMotionRun: maxConsecutiveSignatureRun(cameraSignaturesOf(manifest), 4_500),
    highEnergyRun: maxHighEnergyRun(manifest.audio.energyCurve),
    repeatedCutCadenceRun: maxRepeatedCutCadenceRun(cutsOf(manifest)),
    breatheFrameCount: sequenceMemory?.breatheFrames?.length ?? 0,
    blockedEffectFrames: sequenceMemory?.blockedEffectFrames ?? 0,
    finalSequenceState: sequenceMemory?.finalState ?? "unknown",
  };
};

const violation = (
  ruleId: string,
  message: string,
  severity: SequenceDisciplineSeverity,
  penalty: number,
): SequenceDisciplineViolation => ({
  ruleId,
  message,
  severity,
  blocking: false,
  penalty,
});

const evaluateViolations = (metrics: SequenceDisciplineMetrics): SequenceDisciplineViolation[] => {
  const violations: SequenceDisciplineViolation[] = [];

  if (metrics.maxTypographyRun >= 3) {
    violations.push(violation(
      "avoid-repeating-typography-signature",
      "The same typography signature is repeating across adjacent beats.",
      metrics.maxTypographyRun >= 4 ? "high" : "medium",
      0.18,
    ));
  }

  if (metrics.maxMotionRun >= 3) {
    violations.push(violation(
      "avoid-repeating-motion-signature",
      "The same camera or motion signature is repeating too often.",
      "high",
      0.17,
    ));
  }

  if (metrics.highEnergyRun >= 4 && metrics.breatheFrameCount === 0) {
    violations.push(violation(
      "prefer-restraint-after-loud-run",
      "A sustained high-energy run should restore breathing room before another loud beat.",
      "medium",
      0.16,
    ));
  }

  if (
    metrics.repeatedCutCadenceRun >= 3 ||
    (metrics.maxTypographyRun >= 3 && metrics.maxMotionRun >= 2)
  ) {
    violations.push(violation(
      "avoid-flattening-pacing-rhythm",
      "The beat rhythm needs a pacing correction instead of another identical visual cadence.",
      "medium",
      0.16,
    ));
  }

  if (metrics.blockedEffectFrames > 0) {
    violations.push(violation(
      "avoid-effect-cooldown-collision",
      "An effect repeated before its live sequence-memory cooldown elapsed.",
      "medium",
      0.12,
    ));
  }

  return violations;
};

export const evaluateJosephSequenceDiscipline = (
  manifest: UnifiedRenderManifest,
  options: {enabled?: boolean} = {},
): SequenceDisciplineEvaluation => {
  const metrics = buildMetrics(manifest);
  if (options.enabled === false) {
    return {
      enabled: false,
      penalty: 0,
      violations: [],
      metrics,
    };
  }

  const violations = evaluateViolations(metrics);
  return {
    enabled: true,
    penalty: clamp01(violations.reduce((sum, item) => sum + item.penalty, 0)),
    violations,
    metrics,
  };
};
