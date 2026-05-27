export type TemporalSceneInput = {
  id: string;
  startMs: number;
  endMs: number;
  energy: number;
  importance: number;
  momentType: string;
  typographyMode?: string;
  motionMode?: string;
  transitionKind?: string;
};

export type TemporalCurvePoint = {
  sceneId: string;
  atMs: number;
  energy: number;
  normalizedEnergy: number;
  tension: number;
  cooldownRequired: boolean;
};

export type TemporalGovernorReport = {
  sequenceMemory: {
    sceneCount: number;
    recentMomentTypes: string[];
    repeatedMomentTypeCount: number;
    repeatedTypographyModeCount: number;
    repeatedMotionModeCount: number;
  };
  pacingMap: TemporalCurvePoint[];
  intensityCurve: number[];
  narrativeTensionGraph: number[];
  antiRepetition: {
    enforced: boolean;
    reasons: string[];
  };
  temporalHealthScore: number;
  pacingConfidenceScore: number;
  rhythmContinuityScore: number;
  warnings: string[];
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round = (value: number): number => Number(value.toFixed(3));

const countAdjacentRepeats = <T>(items: T[]): number => {
  let count = 0;
  for (let index = 1; index < items.length; index += 1) {
    if (items[index] === items[index - 1]) {
      count += 1;
    }
  }
  return count;
};

const safeDuration = (scene: TemporalSceneInput): number => Math.max(1, scene.endMs - scene.startMs);

const normalizeScenes = (scenes: TemporalSceneInput[]): TemporalSceneInput[] => {
  return scenes
    .slice()
    .sort((left, right) => left.startMs - right.startMs || left.id.localeCompare(right.id))
    .map((scene) => ({
      ...scene,
      energy: clamp01(scene.energy),
      importance: clamp01(scene.importance),
      endMs: Math.max(scene.endMs, scene.startMs + 1)
    }));
};

export const evaluateTemporalContinuity = (
  scenes: TemporalSceneInput[]
): TemporalGovernorReport => {
  const ordered = normalizeScenes(scenes);
  const warnings: string[] = [];
  const energies = ordered.map((scene) => scene.energy);
  const momentTypes = ordered.map((scene) => scene.momentType);
  const typographyModes = ordered.map((scene) => scene.typographyMode ?? "unknown");
  const motionModes = ordered.map((scene) => scene.motionMode ?? "unknown");
  const repeatedMomentTypeCount = countAdjacentRepeats(momentTypes);
  const repeatedTypographyModeCount = countAdjacentRepeats(typographyModes);
  const repeatedMotionModeCount = countAdjacentRepeats(motionModes);
  const deltas = energies.slice(1).map((energy, index) => Math.abs(energy - energies[index]!));
  const averageDelta = deltas.length > 0
    ? deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length
    : 0.2;
  const abruptJumpCount = deltas.filter((delta) => delta >= 0.42).length;
  const repetitionPressure = ordered.length > 1
    ? (repeatedMomentTypeCount + repeatedTypographyModeCount + repeatedMotionModeCount) / Math.max(1, (ordered.length - 1) * 3)
    : 0;

  if (abruptJumpCount > 0) {
    warnings.push("Temporal governor detected abrupt intensity jumps between adjacent scenes.");
  }
  if (repetitionPressure >= 0.34) {
    warnings.push("Temporal governor detected repetition pressure across moment, typography, or motion choices.");
  }

  const pacingMap = ordered.map<TemporalCurvePoint>((scene, index) => {
    const previous = ordered[index - 1];
    const next = ordered[index + 1];
    const localAverage = [previous?.energy, scene.energy, next?.energy]
      .filter((value): value is number => typeof value === "number")
      .reduce((sum, value, _, values) => sum + value / values.length, 0);
    const durationWeight = clamp01(safeDuration(scene) / 5000);
    const tension = clamp01((scene.energy * 0.52) + (scene.importance * 0.38) + (durationWeight * 0.1));
    return {
      sceneId: scene.id,
      atMs: scene.startMs,
      energy: round(scene.energy),
      normalizedEnergy: round(localAverage),
      tension: round(tension),
      cooldownRequired: tension >= 0.82 && next ? next.energy > 0.62 : false
    };
  });

  const cooldownIssues = pacingMap.filter((point) => point.cooldownRequired).length;
  if (cooldownIssues > 0) {
    warnings.push("Temporal governor detected missing cooldown windows after high-tension scenes.");
  }

  const rhythmContinuityScore = clamp01(1 - Math.abs(averageDelta - 0.22) - abruptJumpCount * 0.12);
  const pacingConfidenceScore = clamp01(1 - repetitionPressure * 0.6 - cooldownIssues * 0.1);
  const temporalHealthScore = clamp01((rhythmContinuityScore * 0.45) + (pacingConfidenceScore * 0.35) + ((1 - repetitionPressure) * 0.2));

  return {
    sequenceMemory: {
      sceneCount: ordered.length,
      recentMomentTypes: momentTypes.slice(-5),
      repeatedMomentTypeCount,
      repeatedTypographyModeCount,
      repeatedMotionModeCount
    },
    pacingMap,
    intensityCurve: pacingMap.map((point) => point.normalizedEnergy),
    narrativeTensionGraph: pacingMap.map((point) => point.tension),
    antiRepetition: {
      enforced: repetitionPressure > 0,
      reasons: [
        repeatedMomentTypeCount > 0 ? `${repeatedMomentTypeCount} adjacent moment repeat(s)` : null,
        repeatedTypographyModeCount > 0 ? `${repeatedTypographyModeCount} adjacent typography repeat(s)` : null,
        repeatedMotionModeCount > 0 ? `${repeatedMotionModeCount} adjacent motion repeat(s)` : null
      ].filter((reason): reason is string => Boolean(reason))
    },
    temporalHealthScore: round(temporalHealthScore),
    pacingConfidenceScore: round(pacingConfidenceScore),
    rhythmContinuityScore: round(rhythmContinuityScore),
    warnings
  };
};
