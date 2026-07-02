import {
  type CameraMove,
  type CutEvent,
  type SFXEvent,
  type TextEvent,
  type TextOverlay,
  type Transition,
  type TransitionEvent,
  type UnifiedRenderManifest,
  type JosephBackgroundPlan,
  type JosephChoreographyPlan,
  type JosephMacroRigPlan,
  type JosephPiPPlan,
  type JosephTypographyIntelligencePlan,
  type Word,
  seededChance,
  seededPick,
  seededRandom,
} from "@prometheus/shared-types";
import { randomUUID } from "crypto";
import {
  buildMicroAnimationAudit,
  JOSEPH_MICRO_ANIMATION_TAXONOMY,
  selectMicroAnimationPrimitive,
} from "./micro-animation-primitives";
import {buildJosephBackgroundPrimitivePlan} from "./joseph-background-primitives";
import {buildJosephPiPCompositionPlan} from "./joseph-pip-composition";
import {buildJosephTalkingHeadMacroRig} from "./joseph-macro-rig";
import {buildJosephTypographyIntelligencePlan, JOSEPH_TYPOGRAPHY_STYLEBOOKS} from "./joseph-typography-intelligence";
import {buildJosephAudioVisualChoreographyPlan} from "./joseph-audio-visual-choreography";
export interface DirectorInput {
  videoUrl: string;
  musicTrackUrl?: string;
  matteUrl?: string;
  matteFilePath?: string;
  mattePremultipliedAlpha?: boolean;
  transcript: Word[];
  beats: number[];
  onsets: number[];
  energyCurve: number[];
  durationMs: number;
  seed: number;
  profile: "joseph_aggressive" | "joseph_cinematic" | "joseph_minimal";
}
type ProfileTuning = {
  textCoverage: number;
  cameraMoveMs: number;
  sfxDensity: number;
  textStylePool: readonly TextOverlay["animation"][];
  hookCutCount: number;
  postHookStride: number;
};
type Phrase = {
  words: Word[];
  startMs: number;
  endMs: number;
  energy: number;
  thesisWords: Word[];
  highEnergyWords: Word[];
};
export type JosephSemanticSummary = {
  intent: string;
  rhetoricalArc: string;
  tone: string;
};
export type JosephVisualPlan = {
  emotionalArc: string[];
  visualDensityPlan: string;
  primitiveComposition: string[];
  microAnimationTaxonomy: string[];
  microAnimationPrimitives: string[];
  pipComposition: string[];
  typographyStylebooks: string[];
  typographyRules: string[];
  typographyHierarchy: string[];
  attentionAnchors: string[];
};
export type JosephTemporalChoreography = {
  cuts: number[];
  cameraMoves: string[];
  sfx: string[];
  transitions: string[];
  doctrines: string[];
  segmentScores: string[];
  backgroundWindows: string[];
  pacingFailures: string[];
};
export type JosephOrchestrationPlan = {
  semanticSummary: JosephSemanticSummary;
  visualPlan: JosephVisualPlan;
  temporalChoreography: JosephTemporalChoreography;
  llmAuthority: Array<"semantic-extraction" | "rhetorical-labeling">;
  directorialAuthority: Array<
    "primitive-composition" | "temporal-choreography" | "final-manifest"
  >;
  candidateCount: number;
  doctrineBranch: DoctrineBranch;
  observationSnapshot: JosephObservationSnapshot;
};
/** Deterministic facts about the source the planner is not allowed to rewrite. */
export type JosephObservationSnapshot = {
  durationMs: number;
  transcriptWordCount: number;
  hookPhrase: string;
  ctaPhrase: string;
  peakEnergyMs: number;
  beatCount: number;
  onsetCount: number;
};

/** A bounded alternative editorial doctrine the planner may explore. */
export type DoctrineBranch = {
  id: string;
  label: string;
  textEntryFamily: string;
  motionDoctrine: string;
  primitiveComposition: string[];
  microAnimationFocus: string[];
  pipDoctrine: string[];
  tune: DoctrineTune;
};
export type DoctrineTune = {
  textCoverageMultiplier: number;
  textStylePool: readonly TextOverlay["animation"][];
  cameraAggression: number;
  cutDensity: number;
};
/** A planning snapshot built from the observation for one doctrine branch. */
export type DoctrinePlan = {
  doctrineBranch: DoctrineBranch;
  observationSnapshot: JosephObservationSnapshot;
  semanticSummary: JosephSemanticSummary;
  visualPlan: JosephVisualPlan;
  temporalChoreography: JosephTemporalChoreography;
  llmAuthority: Array<"semantic-extraction" | "rhetorical-labeling">;
  directorialAuthority: Array<
    "primitive-composition" | "temporal-choreography" | "final-manifest"
  >;
};
const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const MAX_INT_31 = 2147483647;
const HOOK_MAX_MS = 3000;
const CTA_WINDOW_MS = 3000;
const MAX_DURATION_MS = 90_000;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "we",
  "with",
  "you",
  "your",
]);
const PROFILES: Record<DirectorInput["profile"], ProfileTuning> = {
  joseph_aggressive: {
    textCoverage: 0.8,
    cameraMoveMs: 1500,
    sfxDensity: 1,
    textStylePool: ["pop", "glitch", "elastic_scale"],
    hookCutCount: 5,
    postHookStride: 1,
  },
  joseph_cinematic: {
    textCoverage: 0.45,
    cameraMoveMs: 3000,
    sfxDensity: 0.5,
    textStylePool: ["slide_up", "pop", "typewriter"],
    hookCutCount: 4,
    postHookStride: 2,
  },
  joseph_minimal: {
    textCoverage: 0.2,
    cameraMoveMs: 5000,
    sfxDensity: 0,
    textStylePool: ["slide_up", "typewriter"],
    hookCutCount: 3,
    postHookStride: 99,
  },
};
/**
 * Doctrine Branch catalog (CONTEXT.md: Doctrine Branch).
 *
 * Each branch is a bounded alternative editorial doctrine. The planner explores
 * these branches for the same observation so that candidates share semantics
 * but differ meaningfully in visual planning. Branches never grant the LLM
 * directorial authority; they only reshape primitive composition, motion, and
 * text-entry bias within the deterministic planner.
 */
export const DOCTRINE_BRANCHES: readonly DoctrineBranch[] = [
  {
    id: "kinetic-pulse",
    label: "Kinetic Pulse",
    textEntryFamily: "elastic-pop",
    motionDoctrine: "beat-locked kinetic cuts",
    primitiveComposition: [
      "text:elastic-pop",
      "motion:glitch-accent",
      "camera:push-in",
      "sfx:beat-drop-stack",
    ],
    microAnimationFocus: [
      "text-entry.word-riser",
      "text-entry.velocity-slide-reveal",
      "text-emphasis.sweep-highlight",
      "text-emphasis.marker-stroke",
      "accent-motion.bracket-lock",
    ],
    pipDoctrine: [
      "pip:subject-dock",
      "pip:typography-coexistence",
      "pip:focus-handoff",
    ],
    tune: {
      textCoverageMultiplier: 1.1,
      textStylePool: ["pop", "elastic_scale", "glitch"],
      cameraAggression: 0.95,
      cutDensity: 1.1,
    },
  },
  {
    id: "restrained-cinematic",
    label: "Restrained Cinematic",
    textEntryFamily: "soft-letter-reveal",
    motionDoctrine: "held frames with slow push",
    primitiveComposition: [
      "text:soft-reveal",
      "motion:restrained-entry",
      "camera:slow-push-in",
      "background:depth-vignette",
    ],
    microAnimationFocus: [
      "text-entry.letter-riser",
      "text-entry.soft-letter-tracking",
      "text-entry.clipped-mask-reveal",
      "text-emphasis.underline-reveal",
      "text-emphasis.semantic-glow",
      "accent-motion.caption-rail",
      "spatial-motion.anchored-drift",
    ],
    pipDoctrine: [
      "pip:subject-dock",
      "pip:background-coexistence",
      "pip:restrained-frame",
    ],
    tune: {
      textCoverageMultiplier: 0.7,
      textStylePool: ["slide_up", "typewriter"],
      cameraAggression: 0.45,
      cutDensity: 0.7,
    },
  },
  {
    id: "spotlight-swap",
    label: "Spotlight Swap",
    textEntryFamily: "weight-escalation",
    motionDoctrine: "single-anchor spotlight handoff",
    primitiveComposition: [
      "text:weight-escalation",
      "motion:anchor-handoff",
      "sfx:impact-spotlight",
      "background:focus-tunnel",
    ],
    microAnimationFocus: [
      "text-emphasis.capsule-highlight",
      "text-mutation.weight-escalation",
      "text-mutation.emphasis-handoff",
      "accent-motion.bracket-lock",
      "text-entry.clipped-mask-reveal",
    ],
    pipDoctrine: [
      "pip:subject-dock",
      "pip:typography-coexistence",
      "pip:spotlight-handoff",
    ],
    tune: {
      textCoverageMultiplier: 0.9,
      textStylePool: ["pop", "typewriter"],
      cameraAggression: 0.6,
      cutDensity: 0.9,
    },
  },
];
const pickDoctrineBySeed = (seed: number, offset = 0): DoctrineBranch => {
  const index = Math.abs(
    Math.floor((seed + offset * 2654435761) % DOCTRINE_BRANCHES.length),
  );
  return DOCTRINE_BRANCHES[index] ?? DOCTRINE_BRANCHES[0];
};
const msToFrame = (ms: number): number =>
  Math.max(0, Math.round((ms / 1000) * FPS));
const frameToMs = (frame: number): number => Math.round((frame / FPS) * 1000);
const clampDirectorInput = (input: DirectorInput): DirectorInput => {
  const durationMs = Math.min(input.durationMs, MAX_DURATION_MS);
  if (durationMs === input.durationMs) {
    return input;
  }
  return {
    ...input,
    durationMs,
    transcript: input.transcript
      .filter((word) => word.startMs < durationMs)
      .map((word) => ({ ...word, endMs: Math.min(word.endMs, durationMs) })),
    beats: input.beats.filter((beat) => beat <= durationMs),
    onsets: input.onsets.filter((onset) => onset <= durationMs),
  };
};
const clampFrameRange = (
  startFrame: number,
  endFrame: number,
  durationFrames: number,
) => ({
  startFrame: Math.max(0, Math.min(startFrame, durationFrames - 1)),
  endFrame: Math.max(
    0,
    Math.min(Math.max(endFrame, startFrame + 1), durationFrames - 1),
  ),
});
const energyAtMs = (
  energyCurve: number[],
  durationMs: number,
  ms: number,
): number => {
  if (energyCurve.length === 0 || durationMs <= 0) {
    return 0;
  }
  const idx = Math.min(
    energyCurve.length - 1,
    Math.max(0, Math.floor((ms / durationMs) * energyCurve.length)),
  );
  return energyCurve[idx] ?? 0;
};
const isPhraseBoundary = (
  current: Word,
  next: Word | undefined,
  durationMs: number,
  energyCurve: number[],
) => {
  if (!next) {
    return true;
  }
  if (next.startMs - current.endMs > 300) {
    return true;
  }
  if (/[.!?]$/.test(current.text)) {
    return true;
  }
  const currentEnergy = energyAtMs(energyCurve, durationMs, current.startMs);
  const nextEnergy = energyAtMs(energyCurve, durationMs, next.startMs);
  return (
    currentEnergy < 0.3 &&
    nextEnergy < 0.3 &&
    next.startMs - current.endMs > 200
  );
};
const buildPhrases = (input: DirectorInput): Phrase[] => {
  const phrases: Phrase[] = [];
  let currentWords: Word[] = [];
  input.transcript.forEach((word, index) => {
    currentWords.push(word);
    const next = input.transcript[index + 1];
    if (!isPhraseBoundary(word, next, input.durationMs, input.energyCurve)) {
      return;
    }
    const phraseWords = currentWords;
    currentWords = [];
    const thesisWords = phraseWords.filter((candidate) => {
      const clean = candidate.text.replace(/[^a-z0-9']/gi, "").toLowerCase();
      return (
        clean.length >= 5 &&
        !STOP_WORDS.has(clean) &&
        ((candidate.confidence ?? 0) > 0.9 ||
          energyAtMs(input.energyCurve, input.durationMs, candidate.startMs) >
            0.7)
      );
    });
    const highEnergyWords = thesisWords.filter(
      (candidate) =>
        energyAtMs(input.energyCurve, input.durationMs, candidate.startMs) >=
          0.7 && (candidate.confidence ?? 0) >= 0.9,
    );
    const phraseEnergy =
      phraseWords.reduce(
        (sum, candidate) =>
          sum +
          energyAtMs(input.energyCurve, input.durationMs, candidate.startMs),
        0,
      ) / Math.max(1, phraseWords.length);
    phrases.push({
      words: phraseWords,
      startMs: phraseWords[0]?.startMs ?? 0,
      endMs: phraseWords[phraseWords.length - 1]?.endMs ?? 0,
      energy: phraseEnergy,
      thesisWords,
      highEnergyWords,
    });
  });
  return phrases;
};
const nearestSyncPoint = (
  targetMs: number,
  beats: number[],
  onsets: number[],
) => {
  const points = [...beats, ...onsets].sort((a, b) => a - b);
  if (points.length === 0) {
    return targetMs;
  }
  return points.reduce((left, right) =>
    Math.abs(right - targetMs) < Math.abs(left - targetMs) ? right : left,
  );
};
const pickSfxVariant = (rng: () => number): SFXEvent["variant"] =>
  (Math.floor(rng() * 5) + 1) as SFXEvent["variant"];
const sfxEvent = (
  rng: () => number,
  event: Omit<SFXEvent, "variant">,
): SFXEvent => ({ ...event, variant: pickSfxVariant(rng) });
const chooseAnimation = (
  rng: () => number,
  profile: ProfileTuning,
  energy: number,
  highEnergy: boolean,
): TextOverlay["animation"] => {
  if (highEnergy) {
    const energetic = profile.textStylePool.filter(
      (style) => style === "pop" || style === "glitch",
    );
    if (energetic.length > 0) {
      return seededPick(rng, energetic);
    }
  }
  if (energy < 0.4) {
    const restrained = profile.textStylePool.filter(
      (style) => style === "slide_up" || style === "typewriter",
    );
    if (restrained.length > 0) {
      return seededPick(rng, restrained);
    }
  }
  return seededPick(rng, profile.textStylePool);
};
const buildTextOverlays = (
  input: DirectorInput,
  phrases: Phrase[],
  profile: ProfileTuning,
  durationFrames: number,
  rng: () => number,
  ctaStartMs: number,
  doctrine?: DoctrineBranch,
) => {
  const overlays: TextOverlay[] = [];
  const textEvents: TextEvent[] = [];
  phrases.forEach((phrase) => {
    phrase.words.forEach((word) => {
      const isThesis = phrase.thesisWords.includes(word);
      const isHighEnergy = phrase.highEnergyWords.includes(word);
      if (!isThesis && !seededChance(rng, profile.textCoverage)) {
        return;
      }
      const startFrame = msToFrame(word.startMs);
      const duration = isHighEnergy ? 18 : 12;
      const { startFrame: clampedStart, endFrame: clampedEnd } =
        clampFrameRange(startFrame, startFrame + duration, durationFrames);
      const microAnimation = selectMicroAnimationPrimitive({
        rng,
        doctrineId: doctrine?.id,
        semanticRole: isHighEnergy ? "hero" : "support",
        energy: phrase.energy,
        overlayIndex: overlays.length,
      });
      const animation = microAnimation.renderFallback;
      const color = isHighEnergy ? "#FF0040" : "#FFFFFF";
      const overlay: TextOverlay = {
        text: word.text.replace(/[.!?]$/, "").toUpperCase(),
        startFrame: clampedStart,
        endFrame: clampedEnd,
        animation,
        color,
        microAnimation,
      };
      overlays.push(overlay);
      textEvents.push({
        type: "text",
        word: overlay.text,
        startMs: frameToMs(clampedStart),
        endMs: frameToMs(clampedEnd),
        style: overlay.animation,
        color: overlay.color,
        position: { x: 0.5, y: isHighEnergy ? 0.5 : 0.15, z: 0.1 },
        scale: isHighEnergy ? 1.3 : 1,
        cameraPush: isHighEnergy ? 0.85 : 0,
        shake: overlay.animation === "glitch" ? 0.5 : 0,
      });
    });
  });
  const ctaPhrase = phrases[phrases.length - 1];
  if (ctaPhrase) {
    const ctaWords = (
      ctaPhrase.highEnergyWords.length > 0
        ? ctaPhrase.highEnergyWords
        : ctaPhrase.words
    ).slice(0, 2);
    ctaWords.forEach((word, index) => {
      const startFrame = msToFrame(ctaStartMs) + index * 12;
      const { startFrame: clampedStart, endFrame: clampedEnd } =
        clampFrameRange(startFrame, startFrame + 18, durationFrames);
      const microAnimation = selectMicroAnimationPrimitive({
        rng,
        doctrineId: doctrine?.id,
        semanticRole: "cta",
        energy: 1,
        overlayIndex: overlays.length + index,
      });
      overlays.push({
        text: word.text.replace(/[.!?]$/, "").toUpperCase(),
        startFrame: clampedStart,
        endFrame: clampedEnd,
        animation: microAnimation.renderFallback,
        color: "#FF0040",
        microAnimation,
      });
    });
  }
  return { textOverlays: overlays, textEvents };
};
const pickEvenly = (items: number[], desiredCount: number) => {
  if (items.length <= desiredCount) {
    return items;
  }
  const selected: number[] = [];
  for (let index = 0; index < desiredCount; index += 1) {
    const ratio = desiredCount === 1 ? 0 : index / (desiredCount - 1);
    const itemIndex = Math.round(ratio * (items.length - 1));
    const item = items[itemIndex];
    if (item !== undefined && !selected.includes(item)) {
      selected.push(item);
    }
  }
  return selected;
};
const buildCuts = (
  input: DirectorInput,
  phrases: Phrase[],
  profile: ProfileTuning,
  hookEndMs: number,
) => {
  const cuts: CutEvent[] = [];
  const hookCandidates = [
    ...new Set(
      [...input.beats, ...input.onsets].filter((point) => point <= hookEndMs),
    ),
  ].sort((a, b) => a - b);
  const selectedHookPoints = pickEvenly(hookCandidates, profile.hookCutCount);
  selectedHookPoints.forEach((point, index) => {
    cuts.push({
      type: "cut",
      atMs: point,
      toMs: point,
      style: index % 2 === 0 ? "hard" : "zoom_blur",
      intensity: 1,
    });
  });
  const postHookBoundaries = phrases
    .slice(0, -1)
    .map((phrase) => phrase.endMs)
    .filter((boundary) => boundary > hookEndMs);
  postHookBoundaries.forEach((boundary, index) => {
    if (index % profile.postHookStride !== 0) {
      return;
    }
    const synced = nearestSyncPoint(boundary, input.beats, input.onsets);
    cuts.push({
      type: "cut",
      atMs: synced,
      toMs: synced,
      style:
        energyAtMs(input.energyCurve, input.durationMs, boundary) > 0.6
          ? "zoom_blur"
          : "hard",
      intensity: 0.8,
    });
  });
  return cuts.sort((a, b) => a.atMs - b.atMs);
};
const cameraVelocityHints = (type: CameraMove["type"]): Pick<CameraMove, "entryVelocity" | "exitVelocity"> => {
  if (type === "push_in") {
    return { entryVelocity: 0.32, exitVelocity: 0.72 };
  }
  if (type === "dutch") {
    return { entryVelocity: 0.54, exitVelocity: 0.38 };
  }
  return { entryVelocity: 0.88, exitVelocity: 0.3 };
};
const cameraMoveWithVelocity = (
  move: Pick<CameraMove, "type" | "startFrame" | "endFrame">,
): CameraMove => ({
  ...move,
  ...cameraVelocityHints(move.type),
});
const buildCameraMoves = (
  input: DirectorInput,
  phrases: Phrase[],
  profile: ProfileTuning,
  durationFrames: number,
  ctaStartMs: number,
  rng: () => number,
): CameraMove[] => {
  const moves: CameraMove[] = [];
  let lastCameraMs = -Infinity;
  phrases.forEach((phrase) => {
    const highEnergyWord = phrase.highEnergyWords[0];
    if (
      highEnergyWord &&
      phrase.startMs - lastCameraMs >= profile.cameraMoveMs
    ) {
      const startFrame = msToFrame(highEnergyWord.startMs);
      const range = clampFrameRange(
        startFrame,
        startFrame + 30,
        durationFrames,
      );
      moves.push(cameraMoveWithVelocity({
        type: "push_in",
        startFrame: range.startFrame,
        endFrame: range.endFrame,
      }));
      lastCameraMs = phrase.startMs;
    }
    const beatDrop = input.beats.find(
      (beat) =>
        beat >= phrase.startMs &&
        beat <= phrase.endMs &&
        energyAtMs(input.energyCurve, input.durationMs, beat) > 0.8,
    );
    if (beatDrop) {
      const type: CameraMove["type"] = seededChance(rng, 0.5)
        ? "dutch"
        : "shake";
      const duration = type === "dutch" ? 18 : 12;
      const range = clampFrameRange(
        msToFrame(beatDrop),
        msToFrame(beatDrop) + duration,
        durationFrames,
      );
      moves.push(cameraMoveWithVelocity({
        type,
        startFrame: range.startFrame,
        endFrame: range.endFrame,
      }));
    }
  });
  const ctaStartFrame = msToFrame(ctaStartMs);
  if (
    !moves.some(
      (move) => move.type === "push_in" && move.startFrame >= ctaStartFrame,
    )
  ) {
    const range = clampFrameRange(
      ctaStartFrame,
      ctaStartFrame + 30,
      durationFrames,
    );
    moves.push(cameraMoveWithVelocity({
        type: "push_in",
        startFrame: range.startFrame,
        endFrame: range.endFrame,
      }));
  }
  return moves.sort((a, b) => a.startFrame - b.startFrame);
};
const buildTransitions = (
  phrases: Phrase[],
  input: DirectorInput,
  durationFrames: number,
) => {
  const transitions: Transition[] = [];
  const transitionEvents: TransitionEvent[] = [];
  phrases.slice(0, -1).forEach((phrase) => {
    const synced = nearestSyncPoint(phrase.endMs, input.beats, input.onsets);
    const range = clampFrameRange(
      msToFrame(synced),
      msToFrame(synced) + 12,
      durationFrames,
    );
    transitions.push({
      startFrame: range.startFrame,
      endFrame: range.endFrame,
    });
    transitionEvents.push({
      type: "transition",
      style: phrase.energy > 0.6 ? "zoom_blur" : "glitch_flash",
      atMs: synced,
      durationMs: 400,
      intensity: phrase.energy > 0.6 ? 0.9 : 0.7,
    });
  });
  return { transitions, transitionEvents };
};
const buildSfx = (
  input: DirectorInput,
  cuts: CutEvent[],
  textEvents: TextEvent[],
  profile: ProfileTuning,
  ctaStartMs: number,
  rng: () => number,
): SFXEvent[] => {
  if (profile.sfxDensity === 0) {
    return [];
  }
  const sfx: SFXEvent[] = [];
  cuts.forEach((cut, index) => {
    if (profile.sfxDensity >= 1 || index % 2 === 0) {
      sfx.push(
        sfxEvent(rng, {
          id: `cut-${index}`,
          cue: cut.style === "zoom_blur" ? "whoosh_slow" : "whoosh_fast",
          triggerMs: Math.round(cut.atMs),
          durationMs: 250,
          volumeDb: -12,
          duckMusicDb: -6,
        }),
      );
    }
  });
  textEvents
    .filter((event) => event.color === "#FF0040")
    .forEach((event, index) => {
      sfx.push(
        sfxEvent(rng, {
          id: `red-${index}`,
          cue: event.startMs >= ctaStartMs ? "impact_sharp" : "impact_deep",
          triggerMs: event.startMs,
          durationMs: 300,
          volumeDb: -10,
          duckMusicDb: -9,
        }),
      );
      if (event.style === "glitch") {
        sfx.push(
          sfxEvent(rng, {
            id: `glitch-${index}`,
            cue: "glitch_digital",
            triggerMs: event.startMs,
            durationMs: 250,
            volumeDb: -12,
            duckMusicDb: -6,
          }),
        );
      }
      if (event.style === "pop") {
        sfx.push(
          sfxEvent(rng, {
            id: `pop-${index}`,
            cue: "pop_text",
            triggerMs: event.startMs,
            durationMs: 180,
            volumeDb: -12,
            duckMusicDb: -6,
          }),
        );
      }
    });
  input.beats
    .filter(
      (beat) => energyAtMs(input.energyCurve, input.durationMs, beat) > 0.85,
    )
    .forEach((beat, index) => {
      if (seededChance(rng, profile.sfxDensity)) {
        sfx.push(
          sfxEvent(rng, {
            id: `drop-${index}`,
            cue: "sub_drop",
            triggerMs: beat,
            durationMs: 500,
            volumeDb: -8,
            duckMusicDb: -9,
          }),
        );
      }
    });
  return sfx.sort((a, b) => a.triggerMs - b.triggerMs);
};
const buildObservationSnapshot = (
  input: DirectorInput,
  phrases: Phrase[],
): JosephObservationSnapshot => {
  const hookPhrase = phrases[0];
  const ctaPhrase = phrases[phrases.length - 1];
  const peakEnergyIndex =
    input.energyCurve.length === 0
      ? -1
      : input.energyCurve.reduce(
          (bestIdx, value, idx) =>
            value > (input.energyCurve[bestIdx] ?? 0) ? idx : bestIdx,
          0,
        );
  const peakEnergyMs =
    peakEnergyIndex < 0
      ? 0
      : Math.round(
          (peakEnergyIndex / input.energyCurve.length) * input.durationMs,
        );
  return {
    durationMs: input.durationMs,
    transcriptWordCount: input.transcript.length,
    hookPhrase: (
      hookPhrase?.thesisWords[0]?.text ??
      hookPhrase?.words[0]?.text ??
      "hook"
    ).replace(/[.!?]$/, ""),
    ctaPhrase: (
      ctaPhrase?.thesisWords[0]?.text ??
      ctaPhrase?.words[0]?.text ??
      "cta"
    ).replace(/[.!?]$/, ""),
    peakEnergyMs,
    beatCount: input.beats.length,
    onsetCount: input.onsets.length,
  };
};
const summarizeSemantics = (
  input: DirectorInput,
  phrases: Phrase[],
): JosephSemanticSummary => {
  const hookPhrase = phrases[0];
  const thesisCount = phrases.reduce(
    (sum, phrase) => sum + phrase.thesisWords.length,
    0,
  );
  const hookWord =
    hookPhrase?.thesisWords[0]?.text ?? hookPhrase?.words[0]?.text ?? "hook";
  return {
    intent:
      thesisCount > 2
        ? `hook-driven ${input.profile} edit`
        : `${input.profile} hook edit`,
    rhetoricalArc: `open with ${hookWord}`,
    tone: input.profile.replace("joseph_", ""),
  };
};
const buildVisualPlan = (
  input: DirectorInput,
  phrases: Phrase[],
  doctrine?: DoctrineBranch,
): JosephVisualPlan => {
  const leading = phrases[0]?.thesisWords[0]?.text ?? "hook";
  const tail = phrases.at(-1)?.thesisWords[0]?.text ?? "cta";
  const baseComposition = [
    `text:${leading}`,
    `support:${tail}`,
    "camera:push-in",
    input.profile === "joseph_aggressive"
      ? "motion:glitch-accent"
      : "motion:restrained-entry",
  ];
  return {
    emotionalArc: ["hook", "escalation", "release"],
    visualDensityPlan:
      input.profile === "joseph_minimal"
        ? "low"
        : input.profile === "joseph_cinematic"
          ? "medium"
          : "high",
    primitiveComposition: doctrine
      ? [...doctrine.primitiveComposition]
      : baseComposition,
    microAnimationTaxonomy: JOSEPH_MICRO_ANIMATION_TAXONOMY.map(
      (entry) => entry.family,
    ),
    microAnimationPrimitives: doctrine
      ? [...doctrine.microAnimationFocus]
      : ["text-entry.word-riser", "text-emphasis.underline-reveal"],
    pipComposition: doctrine
      ? [...doctrine.pipDoctrine]
      : ["pip:subject-dock", "pip:typography-coexistence"],
    typographyStylebooks: JOSEPH_TYPOGRAPHY_STYLEBOOKS.map((stylebook) => stylebook.id),
    typographyRules: ["lexical-weighting", "filler-suppression", "line-rhythm", "hierarchy-contrast"],
    typographyHierarchy: ["filler", "support", "hero", "cta"],
    attentionAnchors: phrases
      .slice(0, 2)
      .flatMap((phrase) =>
        phrase.thesisWords.slice(0, 1).map((word) => word.text),
      ),
  };
};
const buildTemporalChoreography = (
  cuts: CutEvent[],
  cameraMoves: CameraMove[],
  sfx: SFXEvent[],
  transitions: TransitionEvent[],
  choreography: JosephChoreographyPlan,
): JosephTemporalChoreography => ({
  cuts: cuts.map((cut) => cut.atMs),
  cameraMoves: cameraMoves.map(
    (move) => `${move.type}:${move.startFrame}-${move.endFrame}`,
  ),
  sfx: sfx.map((event) => `${event.cue}:${event.triggerMs}`),
  transitions: transitions.map((event) => `${event.style}:${event.atMs}`),
  doctrines: choreography.vocabulary.map((doctrine) => doctrine.id),
  segmentScores: choreography.segments.map(
    (segment) => `${segment.role}:${segment.doctrineId}:${segment.score.toFixed(2)}`,
  ),
  backgroundWindows: choreography.timingPlan.backgroundWindows.map(
    (window) => `${window.segmentRole}:${window.eventId}`,
  ),
  pacingFailures: choreography.qualityAudit.failures,
});
const applyDoctrineToProfile = (
  base: ProfileTuning,
  doctrine: DoctrineBranch,
): ProfileTuning => ({
  ...base,
  textCoverage: Math.max(
    0,
    Math.min(1, base.textCoverage * doctrine.tune.textCoverageMultiplier),
  ),
  textStylePool:
    doctrine.tune.textStylePool.length > 0
      ? doctrine.tune.textStylePool
      : base.textStylePool,
  sfxDensity: Math.max(
    0,
    Math.min(1, base.sfxDensity * Math.max(0.4, doctrine.tune.cutDensity)),
  ),
});
const buildCandidatePlan = (
  input: DirectorInput,
  doctrine?: DoctrineBranch,
) => {
  input = clampDirectorInput(input);
  const baseProfile = PROFILES[input.profile];
  const profile = doctrine
    ? applyDoctrineToProfile(baseProfile, doctrine)
    : baseProfile;
  const rng = seededRandom(input.seed);
  const durationFrames = Math.max(
    1,
    Math.ceil((input.durationMs / 1000) * FPS),
  );
  const hookEndMs = Math.min(HOOK_MAX_MS, input.durationMs);
  const ctaStartMs = Math.max(
    input.durationMs * 0.78,
    input.durationMs - CTA_WINDOW_MS,
  );
  const phrases = buildPhrases(input);
  const { textOverlays, textEvents } = buildTextOverlays(
    input,
    phrases,
    profile,
    durationFrames,
    rng,
    ctaStartMs,
    doctrine,
  );
  const cuts = buildCuts(input, phrases, profile, hookEndMs);
  const cameraMoves = buildCameraMoves(
    input,
    phrases,
    profile,
    durationFrames,
    ctaStartMs,
    rng,
  );
  const { transitions, transitionEvents } = buildTransitions(
    phrases,
    input,
    durationFrames,
  );
  const sfx = buildSfx(input, cuts, textEvents, profile, ctaStartMs, rng);
  const semanticSummary = summarizeSemantics(input, phrases);
  const visualPlan = buildVisualPlan(input, phrases, doctrine);
  const observationSnapshot = buildObservationSnapshot(input, phrases);
  const microAnimationAudit = buildMicroAnimationAudit(textOverlays);
  const josephPiP: JosephPiPPlan = buildJosephPiPCompositionPlan({
    durationFrames,
    width: WIDTH,
    height: HEIGHT,
    profile: input.profile,
    sourceTrackId: "primary",
    attentionAnchors: visualPlan.attentionAnchors,
    doctrineId: doctrine?.id,
  });
  const josephMacroRig: JosephMacroRigPlan | null = buildJosephTalkingHeadMacroRig({
    semanticSummary,
    transcript: input.transcript,
    pipPlan: josephPiP,
  });
  const josephBackground: JosephBackgroundPlan = buildJosephBackgroundPrimitivePlan({
    seed: input.seed,
    profile: input.profile,
    doctrineId: doctrine?.id,
    visualDensityPlan: visualPlan.visualDensityPlan,
    hasPiP: true,
    durationFrames,
  });
  const josephTypography: JosephTypographyIntelligencePlan = buildJosephTypographyIntelligencePlan({
    words: input.transcript,
    energyCurve: input.energyCurve,
    durationMs: input.durationMs,
    profile: input.profile,
    doctrineId: doctrine?.id,
  });
  const josephChoreography: JosephChoreographyPlan = buildJosephAudioVisualChoreographyPlan({
    profile: input.profile,
    durationMs: input.durationMs,
    fps: FPS,
    phrases,
    cuts,
    textOverlays,
    cameraMoves,
    sfx,
    transitions: transitionEvents,
    beats: input.beats,
    onsets: input.onsets,
    energyCurve: input.energyCurve,
    backgroundPlan: josephBackground,
    doctrineId: doctrine?.id,
  });
  const temporalChoreography = buildTemporalChoreography(
    cuts,
    cameraMoves,
    sfx,
    transitionEvents,
    josephChoreography,
  );
  return {
    semanticSummary,
    visualPlan,
    temporalChoreography,
    observationSnapshot,
    microAnimationAudit,
    josephPiP,
    josephMacroRig,
    josephBackground,
    josephTypography,
    josephChoreography,
    textOverlays,
    cuts,
    cameraMoves,
    transitions,
    transitionEvents,
    sfx,
    durationFrames,
    phrases,
    profile,
    baseProfile,
    ctaStartMs,
  };
};
const buildManifestFromPlan = (
  input: DirectorInput,
  doctrine?: DoctrineBranch,
) => {
  const plan = buildCandidatePlan(input, doctrine);
  const videoTracks = [
    {
      id: "primary",
      sourcePath: input.videoUrl,
      startFrame: 0,
      endFrame: plan.durationFrames - 1,
    },
  ];
  const matte = input.matteUrl || input.matteFilePath
    ? {
      ...(input.matteFilePath ? {filePath: input.matteFilePath} : {}),
      fps: FPS,
      durationInFrames: plan.durationFrames,
      planeZ: 0,
      planeHeight: 9,
      premultipliedAlpha: input.mattePremultipliedAlpha ?? true,
    }
    : undefined;
  const timeline: Array<CutEvent | TextEvent | TransitionEvent> = [
    ...plan.cuts,
    ...plan.textOverlays.map(
      (overlay): TextEvent => ({
        type: "text",
        word: overlay.text,
        startMs: Math.round((overlay.startFrame / FPS) * 1000),
        endMs: Math.round((overlay.endFrame / FPS) * 1000),
        style: overlay.animation,
        color: overlay.color,
        position: { x: 0.5, y: 0.15, z: 0.1 },
        scale: 1,
        cameraPush: 0,
        shake: 0,
      }),
    ),
    ...plan.transitionEvents,
  ].sort((a, b) => {
    const aTime =
      a.type === "cut" || a.type === "transition" ? a.atMs : a.startMs;
    const bTime =
      b.type === "cut" || b.type === "transition" ? b.atMs : b.startMs;
    return aTime - bTime;
  });
  const manifest: UnifiedRenderManifest = {
    version: "2.0",
    jobId: randomUUID(),
    seed: input.seed % MAX_INT_31,
    createdAt: new Date().toISOString(),
    durationFrames: plan.durationFrames,
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    videoTracks,
    cameraMoves: plan.cameraMoves,
    textOverlays: plan.textOverlays,
    transitions: plan.transitions,
    microAnimationAudit: plan.microAnimationAudit,
    josephPiP: plan.josephPiP,
    ...(plan.josephMacroRig ? {josephMacroRig: plan.josephMacroRig} : {}),
    josephBackground: plan.josephBackground,
    josephTypography: plan.josephTypography,
    josephChoreography: plan.josephChoreography,
    source: {
      videoUrl: input.videoUrl,
      audioUrl: input.musicTrackUrl,
      ...(input.matteUrl ? {matteUrl: input.matteUrl} : {}),
      transcript: input.transcript,
      durationMs: (plan.durationFrames / FPS) * 1000,
      width: WIDTH,
      height: HEIGHT,
      fps: FPS,
    },
    ...(matte ? {matte} : {}),
    audio: {
      beats: input.beats,
      onsets: input.onsets,
      energyCurve: input.energyCurve,
      musicTrackUrl: input.musicTrackUrl,
      sfx: plan.sfx,
      voiceVolumeDb: 0,
      musicVolumeDb: -18,
      targetLufs: -14,
    },
    timeline,
    creativeProfile: {
      name: input.profile,
      cutDensity:
        input.profile === "joseph_aggressive"
          ? 1
          : input.profile === "joseph_cinematic"
            ? 0.6
            : 0.2,
      textDensity: plan.profile.textCoverage,
      sfxDensity: plan.profile.sfxDensity,
      cameraAggression:
        input.profile === "joseph_aggressive"
          ? 0.9
          : input.profile === "joseph_cinematic"
            ? 0.6
            : 0.2,
      colorIntensity: input.profile === "joseph_minimal" ? 0.3 : 0.8,
    },
    output: { width: WIDTH, height: HEIGHT, fps: FPS, codec: "h264", crf: 18 },
  };
  return { plan, manifest };
};
export function buildJosephOrchestrationPlan(
  input: DirectorInput,
): JosephOrchestrationPlan {
  const doctrine = pickDoctrineBySeed(input.seed);
  const plan = buildCandidatePlan(input, doctrine);
  return {
    semanticSummary: plan.semanticSummary,
    visualPlan: plan.visualPlan,
    temporalChoreography: plan.temporalChoreography,
    llmAuthority: ["semantic-extraction", "rhetorical-labeling"],
    directorialAuthority: [
      "primitive-composition",
      "temporal-choreography",
      "final-manifest",
    ],
    candidateCount: 3,
    doctrineBranch: doctrine,
    observationSnapshot: plan.observationSnapshot,
  };
}
/**
 * Build one planning snapshot per doctrine branch from the same observation.
 * This is the planner surface that lets two candidates share semantics but
 * differ meaningfully in visual planning (acceptance criterion 4 of #5).
 */
export function buildDoctrinePlans(input: DirectorInput): DoctrinePlan[] {
  return DOCTRINE_BRANCHES.map((doctrine) => {
    const plan = buildCandidatePlan(input, doctrine);
    return {
      doctrineBranch: doctrine,
      observationSnapshot: plan.observationSnapshot,
      semanticSummary: plan.semanticSummary,
      visualPlan: plan.visualPlan,
      temporalChoreography: plan.temporalChoreography,
      llmAuthority: ["semantic-extraction", "rhetorical-labeling"],
      directorialAuthority: [
        "primitive-composition",
        "temporal-choreography",
        "final-manifest",
      ],
    };
  });
}
export function generateJosephManifest(
  input: DirectorInput,
): UnifiedRenderManifest {
  const { manifest } = buildManifestFromPlan(input);
  return manifest;
}
/**
 * Generate candidate treatment genomes from the same observation. Candidates
 * cycle through doctrine branches while still honoring the requested count via
 * per-candidate seed variation.
 */
export function generateCandidateGenomes(
  input: DirectorInput,
  count = 3,
): Array<
  UnifiedRenderManifest & { _doctrineBranch: string; semanticIntent: string }
> {
  const clamped = clampDirectorInput(input);
  const semanticIntent = buildCandidatePlan(clamped).semanticSummary.intent;
  const candidateCount = Math.max(2, Math.min(6, Math.floor(count)));
  return Array.from({ length: candidateCount }, (_, index) => {
    const doctrine = DOCTRINE_BRANCHES[index % DOCTRINE_BRANCHES.length];
    const seed = (input.seed + index * 7919) % MAX_INT_31;
    const { manifest } = buildManifestFromPlan({ ...clamped, seed }, doctrine);
    return { ...manifest, _doctrineBranch: doctrine.id, semanticIntent };
  });
}
