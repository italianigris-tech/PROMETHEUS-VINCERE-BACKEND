import type {
  CameraMove,
  CutEvent,
  JosephBackgroundPlan,
  JosephChoreographyDoctrine,
  JosephChoreographyDoctrineId,
  JosephChoreographyPacingFailure,
  JosephChoreographyPlan,
  JosephChoreographyQualityAudit,
  JosephChoreographySegment,
  JosephChoreographySegmentRole,
  JosephChoreographySyncKind,
  JosephChoreographyTimingPlan,
  JosephChoreographyTimingWindow,
  SFXEvent,
  TextOverlay,
  TransitionEvent,
  Word,
} from "@prometheus/shared-types";

type JosephProfile = "joseph_aggressive" | "joseph_cinematic" | "joseph_minimal";

export type JosephChoreographyPhrase = {
  words: readonly Word[];
  startMs: number;
  endMs: number;
  energy: number;
  thesisWords: readonly Word[];
  highEnergyWords: readonly Word[];
};

export type JosephAudioVisualChoreographyPlanInput = {
  profile: JosephProfile;
  durationMs: number;
  fps: number;
  phrases: readonly JosephChoreographyPhrase[];
  cuts: readonly CutEvent[];
  textOverlays: readonly TextOverlay[];
  cameraMoves: readonly CameraMove[];
  sfx: readonly SFXEvent[];
  transitions: readonly TransitionEvent[];
  beats: readonly number[];
  onsets: readonly number[];
  energyCurve: readonly number[];
  backgroundPlan?: JosephBackgroundPlan;
  doctrineId?: string;
};

export type JosephChoreographyQualityInput = {
  durationMs: number;
  beats: readonly number[];
  onsets: readonly number[];
  segments: readonly JosephChoreographySegment[];
  timingPlan: JosephChoreographyTimingPlan;
};

const ROLE_ORDER: readonly JosephChoreographySegmentRole[] = [
  "hook",
  "setup",
  "revelation",
  "escalation",
  "release",
  "cta",
];

const ROLE_DOCTRINE: Record<JosephChoreographySegmentRole, JosephChoreographyDoctrineId> = {
  hook: "punch",
  setup: "hold",
  revelation: "bloom",
  escalation: "ratchet",
  release: "glide",
  cta: "detonate",
};

const ROLE_BUDGET: Record<JosephChoreographySegmentRole, number> = {
  hook: 0.24,
  setup: 0.16,
  revelation: 0.48,
  escalation: 0.72,
  release: 0.34,
  cta: 0.92,
};

const ROLE_MOMENTUM: Record<JosephChoreographySegmentRole, number> = {
  hook: 0.78,
  setup: 0.42,
  revelation: 0.68,
  escalation: 0.84,
  release: 0.36,
  cta: 0.94,
};

export const JOSEPH_CHOREOGRAPHY_DOCTRINES: readonly JosephChoreographyDoctrine[] = [
  {
    id: "punch",
    label: "Punch",
    momentumRole: "release",
    cutBehavior: "short hard emphasis on strong sync points",
    textBehavior: "hero word lands at the accent with minimal pre-roll",
    cameraBehavior: "fast push or snap-shake resolves inside the beat",
    sfxBehavior: "single impact or whoosh with tight ducking",
    backgroundBehavior: "brief contrast kick without stealing focus",
  },
  {
    id: "hold",
    label: "Hold",
    momentumRole: "restraint",
    cutBehavior: "withhold cuts across a breath window",
    textBehavior: "text arrives late and stays calm",
    cameraBehavior: "slow or absent camera drift",
    sfxBehavior: "no accent unless a phrase needs support",
    backgroundBehavior: "low-speed support surface protects readability",
  },
  {
    id: "bloom",
    label: "Bloom",
    momentumRole: "carry_through",
    cutBehavior: "cut after the idea opens rather than on first contact",
    textBehavior: "phrase expands from support to hero emphasis",
    cameraBehavior: "ease-out push carries the revelation",
    sfxBehavior: "soft riser or rounded impact follows the phrase",
    backgroundBehavior: "light or atmosphere opens behind the focal layer",
  },
  {
    id: "ratchet",
    label: "Ratchet",
    momentumRole: "escalation",
    cutBehavior: "successive cuts shorten spacing as tension rises",
    textBehavior: "successive words increase hierarchy and urgency",
    cameraBehavior: "push, dutch, or shake stacks with rising intensity",
    sfxBehavior: "riser, whoosh, and impact cadence escalates in order",
    backgroundBehavior: "motion density increases but remains below text",
  },
  {
    id: "glide",
    label: "Glide",
    momentumRole: "carry_through",
    cutBehavior: "favor continuity over abrupt resets",
    textBehavior: "support copy moves with the camera instead of popping",
    cameraBehavior: "long ease-in-out move preserves flow",
    sfxBehavior: "soft whoosh supports carry-through only",
    backgroundBehavior: "background cycle continues through the release",
  },
  {
    id: "suspend",
    label: "Suspend",
    momentumRole: "anticipation",
    cutBehavior: "delay the next cut to create tension",
    textBehavior: "hold or reduce text before the next accent",
    cameraBehavior: "freeze or nearly freeze the frame",
    sfxBehavior: "silence, low riser, or sub pressure before release",
    backgroundBehavior: "lower movement and pull contrast inward",
  },
  {
    id: "detonate",
    label: "Detonate",
    momentumRole: "detonation",
    cutBehavior: "spend the strongest cut at the final release",
    textBehavior: "CTA or thesis word lands as a decisive hero",
    cameraBehavior: "push-in resolves at peak intensity",
    sfxBehavior: "impact and sub-drop spend the climax budget",
    backgroundBehavior: "background accent peaks then clears for readability",
  },
] as const;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const average = (values: readonly number[], fallback = 0): number => {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const energyAtMs = (
  energyCurve: readonly number[],
  durationMs: number,
  ms: number,
): number => {
  if (energyCurve.length === 0 || durationMs <= 0) {
    return 0.5;
  }
  const index = Math.min(
    energyCurve.length - 1,
    Math.max(0, Math.floor((ms / durationMs) * energyCurve.length)),
  );
  return energyCurve[index] ?? 0.5;
};

const averageEnergyBetween = (
  energyCurve: readonly number[],
  durationMs: number,
  startMs: number,
  endMs: number,
): number => {
  const sampleCount = 5;
  const samples = Array.from({length: sampleCount}, (_, index) => {
    const ratio = index / (sampleCount - 1);
    return energyAtMs(energyCurve, durationMs, startMs + (endMs - startMs) * ratio);
  });
  return average(samples, 0.5);
};

const overlaps = (startMs: number, endMs: number, candidateStartMs: number, candidateEndMs: number): boolean =>
  candidateStartMs < endMs && candidateEndMs > startMs;

const countPoints = (points: readonly number[], startMs: number, endMs: number): number =>
  points.filter((point) => point >= startMs && point < endMs).length;

const nearestDistance = (targetMs: number, points: readonly number[]): number => {
  if (points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return points.reduce(
    (best, point) => Math.min(best, Math.abs(point - targetMs)),
    Number.POSITIVE_INFINITY,
  );
};

const syncKindFor = (
  triggerMs: number,
  beats: readonly number[],
  onsets: readonly number[],
  fallback: JosephChoreographySyncKind,
): JosephChoreographySyncKind => {
  const onsetDistance = nearestDistance(triggerMs, onsets);
  const beatDistance = nearestDistance(triggerMs, beats);
  if (onsetDistance <= 120 && onsetDistance <= beatDistance) {
    return "onset";
  }
  if (beatDistance <= 140) {
    return "beat";
  }
  return fallback;
};

const segmentForTime = (
  segments: readonly JosephChoreographySegment[],
  triggerMs: number,
): JosephChoreographySegment =>
  segments.find((segment) => triggerMs >= segment.startMs && triggerMs < segment.endMs) ??
  segments[segments.length - 1] ?? {
    id: "segment-hook-0",
    role: "hook",
    doctrineId: "punch",
    startMs: 0,
    endMs: Math.max(1, triggerMs + 1),
    score: 0.5,
    momentum: 0.5,
    intensity: 0.5,
    breathWindowMs: 200,
    climaxBudget: 0.2,
  };

const roleScoreBoost = (role: JosephChoreographySegmentRole, energy: number): number => {
  if (role === "hook" || role === "cta") {
    return 0.22;
  }
  if (role === "revelation") {
    return energy >= 0.58 ? 0.2 : 0.08;
  }
  if (role === "escalation") {
    return energy >= 0.5 ? 0.18 : 0.06;
  }
  if (role === "release") {
    return energy <= 0.55 ? 0.14 : 0.04;
  }
  return 0.08;
};

export const scoreJosephChoreographySegments = (
  input: JosephAudioVisualChoreographyPlanInput,
): JosephChoreographySegment[] => {
  const durationMs = Math.max(1, input.durationMs);
  const boundaries = [0, 0.18, 0.36, 0.52, 0.72, 0.84, 1].map((ratio) =>
    Math.round(durationMs * ratio),
  );
  return ROLE_ORDER.map((role, index) => {
    const startMs = Math.min(durationMs - 1, boundaries[index] ?? 0);
    const endMs = Math.max(startMs + 1, boundaries[index + 1] ?? durationMs);
    const boundedEndMs = Math.min(durationMs, endMs);
    const segmentDurationSec = Math.max(0.25, (boundedEndMs - startMs) / 1000);
    const phrases = input.phrases.filter((phrase) => overlaps(startMs, boundedEndMs, phrase.startMs, phrase.endMs));
    const words = phrases.flatMap((phrase) => phrase.words);
    const thesisWords = phrases.flatMap((phrase) => phrase.thesisWords);
    const highEnergyWords = phrases.flatMap((phrase) => phrase.highEnergyWords);
    const phraseEnergy = average(phrases.map((phrase) => phrase.energy), undefined as never);
    const energy = Number.isFinite(phraseEnergy)
      ? phraseEnergy
      : averageEnergyBetween(input.energyCurve, durationMs, startMs, boundedEndMs);
    const syncDensity = clamp01(countPoints([...input.beats, ...input.onsets], startMs, boundedEndMs) / Math.max(1, segmentDurationSec * 3));
    const wordDensity = clamp01(words.length / Math.max(1, segmentDurationSec * 4));
    const semanticWeight = clamp01((thesisWords.length * 0.16 + highEnergyWords.length * 0.24) / Math.max(1, words.length || 1));
    const score = clamp01(
      energy * 0.38 + syncDensity * 0.18 + wordDensity * 0.14 + semanticWeight + roleScoreBoost(role, energy),
    );
    const baseDoctrine = ROLE_DOCTRINE[role];
    const doctrineId = role === "release" && energy < 0.36 ? "suspend" : baseDoctrine;
    const intensity = clamp01(score * 0.58 + energy * 0.42);
    const breathWindowMs = Math.round(
      doctrineId === "hold" || doctrineId === "suspend"
        ? 320 - intensity * 90
        : doctrineId === "ratchet" || doctrineId === "detonate"
          ? 160 - intensity * 50
          : 230 - intensity * 70,
    );

    return {
      id: `segment-${role}-${index}`,
      role,
      doctrineId,
      startMs,
      endMs: boundedEndMs,
      score,
      momentum: clamp01(ROLE_MOMENTUM[role] * 0.65 + intensity * 0.35),
      intensity,
      breathWindowMs: Math.max(80, breathWindowMs),
      climaxBudget: ROLE_BUDGET[role],
    };
  });
};

const windowFor = (
  lane: JosephChoreographyTimingWindow["lane"],
  eventId: string,
  triggerMs: number,
  startMs: number,
  endMs: number,
  intensity: number,
  segment: JosephChoreographySegment,
  sync: JosephChoreographySyncKind,
): JosephChoreographyTimingWindow => ({
  lane,
  eventId,
  segmentId: segment.id,
  segmentRole: segment.role,
  doctrineId: segment.doctrineId,
  startMs: Math.max(0, Math.round(startMs)),
  endMs: Math.max(Math.round(startMs) + 1, Math.round(endMs)),
  triggerMs: Math.max(0, Math.round(triggerMs)),
  intensity: clamp01(intensity),
  sync,
});

const overlayStartMs = (overlay: TextOverlay, fps: number): number => Math.round((overlay.startFrame / fps) * 1000);
const overlayEndMs = (overlay: TextOverlay, fps: number): number => Math.round((overlay.endFrame / fps) * 1000);
const cameraStartMs = (move: CameraMove, fps: number): number => Math.round((move.startFrame / fps) * 1000);
const cameraEndMs = (move: CameraMove, fps: number): number => Math.round((move.endFrame / fps) * 1000);

const timingPlanFor = (
  input: JosephAudioVisualChoreographyPlanInput,
  segments: readonly JosephChoreographySegment[],
): JosephChoreographyTimingPlan => {
  const cutWindows = input.cuts.map((cut, index) => {
    const segment = segmentForTime(segments, cut.atMs);
    return windowFor(
      "cut",
      `cut-${index}`,
      cut.atMs,
      Math.max(0, cut.atMs - 70),
      cut.atMs + 70,
      Math.max(cut.intensity, segment.intensity),
      segment,
      syncKindFor(cut.atMs, input.beats, input.onsets, "phrase"),
    );
  });

  const textWindows = input.textOverlays.map((overlay, index) => {
    const startMs = overlayStartMs(overlay, input.fps);
    const endMs = overlayEndMs(overlay, input.fps);
    const segment = segmentForTime(segments, startMs);
    const isHero = overlay.color.toUpperCase() === "#FF0040";
    const animatedBoost = overlay.animation === "glitch" || overlay.animation === "elastic_scale" ? 0.12 : 0;
    return windowFor(
      "text",
      `text-${index}-${overlay.text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      startMs,
      startMs,
      endMs,
      clamp01(segment.intensity + (isHero ? 0.16 : 0) + animatedBoost),
      segment,
      syncKindFor(startMs, input.beats, input.onsets, "phrase"),
    );
  });

  const cameraWindows = input.cameraMoves.map((move, index) => {
    const startMs = cameraStartMs(move, input.fps);
    const endMs = cameraEndMs(move, input.fps);
    const segment = segmentForTime(segments, startMs);
    const moveBoost = move.type === "shake" ? 0.2 : move.type === "dutch" ? 0.12 : 0.06;
    return windowFor(
      "camera",
      `camera-${index}-${move.type}`,
      startMs,
      startMs,
      endMs,
      clamp01(segment.intensity + moveBoost),
      segment,
      syncKindFor(startMs, input.beats, input.onsets, "phrase"),
    );
  });

  const sfxWindows = input.sfx.map((event, index) => {
    const segment = segmentForTime(segments, event.triggerMs);
    const accentBoost = event.cue === "sub_drop" || event.cue.startsWith("impact") ? 0.18 : 0.08;
    return windowFor(
      "sfx",
      `sfx-${index}-${event.cue}`,
      event.triggerMs,
      event.triggerMs,
      event.triggerMs + event.durationMs,
      clamp01(segment.intensity + accentBoost),
      segment,
      syncKindFor(event.triggerMs, input.beats, input.onsets, "phrase"),
    );
  });

  const primitiveIds = input.backgroundPlan?.selectedPrimitiveIds ?? [];
  const backgroundWindows = segments.map((segment, index) => {
    const primitiveId = primitiveIds[index % Math.max(1, primitiveIds.length)] ?? `background-cycle-${segment.role}`;
    return windowFor(
      "background",
      `background-${index}-${primitiveId}`,
      segment.startMs,
      segment.startMs,
      segment.endMs,
      clamp01(segment.intensity * 0.72 + segment.climaxBudget * 0.18),
      segment,
      "background_cycle",
    );
  });

  return {
    cutWindows,
    textWindows,
    cameraWindows,
    sfxWindows,
    backgroundWindows,
  };
};

const activeWindows = (timingPlan: JosephChoreographyTimingPlan): JosephChoreographyTimingWindow[] => [
  ...timingPlan.cutWindows,
  ...timingPlan.textWindows,
  ...timingPlan.cameraWindows,
  ...timingPlan.sfxWindows,
];

const hasDeadZone = (durationMs: number, windows: readonly JosephChoreographyTimingWindow[]): boolean => {
  if (durationMs <= 2400) {
    return false;
  }
  if (windows.length === 0) {
    return true;
  }
  const thresholdMs = durationMs >= 12_000 ? 3600 : 2600;
  const times = [0, ...windows.map((window) => window.triggerMs).sort((left, right) => left - right), durationMs];
  return times.some((time, index) => index > 0 && time - (times[index - 1] ?? 0) > thresholdMs);
};

export const evaluateJosephChoreographyQuality = (
  input: JosephChoreographyQualityInput,
): JosephChoreographyQualityAudit => {
  const failures = new Set<JosephChoreographyPacingFailure>();
  const warnings = new Set<string>();
  const windows = activeWindows(input.timingPlan);
  const durationSec = Math.max(1, input.durationMs / 1000);
  const intensities = input.segments.map((segment) => segment.intensity);
  const scoreSpread = Math.max(...intensities, 0) - Math.min(...intensities, 1);
  const hook = input.segments.find((segment) => segment.role === "hook");
  const cta = input.segments.find((segment) => segment.role === "cta");

  if (scoreSpread < 0.16 || (hook && cta && cta.intensity < hook.intensity + 0.06)) {
    failures.add("flat_pacing");
  }

  const cutsPerSecond = input.timingPlan.cutWindows.length / durationSec;
  const burstCut = input.timingPlan.cutWindows.some((window, index, list) => {
    const next = list.slice(index, index + 5);
    return next.length >= 5 && (next[next.length - 1]?.triggerMs ?? 0) - window.triggerMs <= 1400;
  });
  if (cutsPerSecond > 1.65 || burstCut) {
    failures.add("overcutting");
  }

  const highIntensity = windows.filter((window) => window.intensity >= 0.78);
  const earlyHighIntensity = highIntensity.filter((window) => window.triggerMs < input.durationMs * 0.64);
  if (highIntensity.length >= 4 && earlyHighIntensity.length / highIntensity.length > 0.55) {
    failures.add("climax_overspend");
  }

  if (hasDeadZone(input.durationMs, windows)) {
    failures.add("dead_zone");
  }

  const musicPoints = [...input.beats, ...input.onsets];
  const majorWindows = windows.filter((window) => window.intensity >= 0.74);
  const offMusic = majorWindows.filter((window) => nearestDistance(window.triggerMs, musicPoints) > 180);
  if (majorWindows.length > 0 && (musicPoints.length === 0 || offMusic.length / majorWindows.length > 0.34)) {
    failures.add("non_musical_emphasis");
  }

  if (input.timingPlan.backgroundWindows.length === 0) {
    warnings.add("background_choreography_missing");
  }
  if (!input.segments.some((segment) => segment.role === "cta" && segment.doctrineId === "detonate")) {
    warnings.add("cta_detonation_missing");
  }
  if (input.timingPlan.textWindows.length === 0) {
    warnings.add("text_choreography_sparse");
  }

  return {
    score: clamp01(1 - failures.size * 0.15 - warnings.size * 0.03),
    failures: [...failures].sort(),
    warnings: [...warnings].sort(),
  };
};

export const buildJosephAudioVisualChoreographyPlan = (
  input: JosephAudioVisualChoreographyPlanInput,
): JosephChoreographyPlan => {
  const segments = scoreJosephChoreographySegments(input);
  const timingPlan = timingPlanFor(input, segments);
  const qualityAudit = evaluateJosephChoreographyQuality({
    durationMs: input.durationMs,
    beats: input.beats,
    onsets: input.onsets,
    segments,
    timingPlan,
  });

  return {
    version: "joseph-choreography-v1",
    vocabulary: JOSEPH_CHOREOGRAPHY_DOCTRINES.map((doctrine) => ({...doctrine})),
    segments,
    timingPlan,
    qualityAudit,
  };
};