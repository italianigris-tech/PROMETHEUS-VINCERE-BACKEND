import {
  type CameraMove,
  type CutEvent,
  type SFXEvent,
  type TextEvent,
  type TextOverlay,
  type Transition,
  type TransitionEvent,
  type UnifiedRenderManifest,
  type VideoTrack,
  type Word,
} from "@prometheus/shared-types";
import {randomUUID} from "crypto";
import {canUseEffect, createMemory, shouldBreathe, updateMemory, useEffect} from "./sequence-memory";

export interface DirectorInput {
  videoUrl: string;
  musicTrackUrl?: string;
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

const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const seededChance = (rng: () => number, probability: number) => rng() < probability;

const seededPick = <T>(rng: () => number, items: readonly T[]): T => {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list.");
  }
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
};

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const MAX_INT_31 = 2147483647;
const HOOK_MAX_MS = 3000;
const CTA_WINDOW_MS = 3000;
const MAX_DURATION_MS = 90_000;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "if", "in", "into", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "we", "with", "you", "your",
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

const msToFrame = (ms: number) => Math.max(0, Math.round((ms / 1000) * FPS));
const frameToMs = (frame: number) => Math.round((frame / FPS) * 1000);

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
      .map((word) => ({
        ...word,
        endMs: Math.min(word.endMs, durationMs),
      })),
    beats: input.beats.filter((beat) => beat <= durationMs),
    onsets: input.onsets.filter((onset) => onset <= durationMs),
  };
};

const clampFrameRange = (startFrame: number, endFrame: number, durationFrames: number) => ({
  startFrame: Math.max(0, Math.min(startFrame, durationFrames - 1)),
  endFrame: Math.max(0, Math.min(Math.max(endFrame, startFrame + 1), durationFrames - 1)),
});

const energyAtMs = (energyCurve: number[], durationMs: number, ms: number): number => {
  if (energyCurve.length === 0 || durationMs <= 0) {
    return 0;
  }
  const idx = Math.min(energyCurve.length - 1, Math.max(0, Math.floor((ms / durationMs) * energyCurve.length)));
  return energyCurve[idx] ?? 0;
};

const isPhraseBoundary = (current: Word, next: Word | undefined, durationMs: number, energyCurve: number[]) => {
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
  return currentEnergy < 0.3 && nextEnergy < 0.3 && next.startMs - current.endMs > 200;
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
      const clean = candidate.text.replace(/[^a-z0-9']/gi, '').toLowerCase();
      return clean.length >= 5 && !STOP_WORDS.has(clean) && ((candidate.confidence ?? 0) > 0.9 || energyAtMs(input.energyCurve, input.durationMs, candidate.startMs) > 0.7);
    });
    const highEnergyWords = thesisWords.filter((candidate) => energyAtMs(input.energyCurve, input.durationMs, candidate.startMs) >= 0.7 && (candidate.confidence ?? 0) >= 0.9);
    const phraseEnergy = phraseWords.reduce((sum, candidate) => sum + energyAtMs(input.energyCurve, input.durationMs, candidate.startMs), 0) / Math.max(1, phraseWords.length);

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

const nearestSyncPoint = (targetMs: number, beats: number[], onsets: number[]) => {
  const points = [...beats, ...onsets].sort((a, b) => a - b);
  if (points.length === 0) {
    return targetMs;
  }
  return points.reduce((left, right) => Math.abs(right - targetMs) < Math.abs(left - targetMs) ? right : left);
};

const chooseAnimation = (rng: () => number, profile: ProfileTuning, energy: number, highEnergy: boolean): TextOverlay["animation"] => {
  if (highEnergy) {
    const energetic = profile.textStylePool.filter((style) => style === 'pop' || style === 'glitch');
    if (energetic.length > 0) {
      return seededPick(rng, energetic);
    }
  }
  if (energy < 0.4) {
    const restrained = profile.textStylePool.filter((style) => style === 'slide_up' || style === 'typewriter');
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
) => {
  const overlays: TextOverlay[] = [];
  const textEvents: TextEvent[] = [];
  const memory = createMemory();

  phrases.forEach((phrase) => {
    phrase.words.forEach((word) => {
      const frame = msToFrame(word.startMs);
      updateMemory(memory, phrase.energy, frame, word.startMs >= ctaStartMs);
      const textCoverage = shouldBreathe(memory, frame) && word.startMs < ctaStartMs ? profile.textCoverage * 0.25 : profile.textCoverage;
      const isThesis = phrase.thesisWords.includes(word);
      const isHighEnergy = phrase.highEnergyWords.includes(word);
      if (!isThesis && !seededChance(rng, textCoverage)) {
        return;
      }

      const startFrame = frame;
      const duration = isHighEnergy ? 18 : 12;
      const {startFrame: clampedStart, endFrame: clampedEnd} = clampFrameRange(startFrame, startFrame + duration, durationFrames);
      const animation = chooseAnimation(rng, profile, phrase.energy, isHighEnergy);
      const color = isHighEnergy ? '#FF0040' : '#FFFFFF';
      const overlay: TextOverlay = {
        text: word.text.replace(/[.!?]$/, '').toUpperCase(),
        startFrame: clampedStart,
        endFrame: clampedEnd,
        animation,
        color,
      };
      overlays.push(overlay);
      textEvents.push({
        type: 'text',
        word: overlay.text,
        startMs: frameToMs(clampedStart),
        endMs: frameToMs(clampedEnd),
        style: overlay.animation,
        color: overlay.color,
        position: {x: 0.5, y: isHighEnergy ? 0.5 : 0.15, z: 0.1},
        scale: isHighEnergy ? 1.3 : 1,
        cameraPush: isHighEnergy ? 0.85 : 0,
        shake: overlay.animation === 'glitch' ? 0.5 : 0,
      });
    });
  });

  const ctaPhrase = phrases[phrases.length - 1];
  if (ctaPhrase) {
    const ctaWords = (ctaPhrase.highEnergyWords.length > 0 ? ctaPhrase.highEnergyWords : ctaPhrase.words).slice(0, 2);
    ctaWords.forEach((word, index) => {
      const startFrame = msToFrame(ctaStartMs) + index * 12;
      const {startFrame: clampedStart, endFrame: clampedEnd} = clampFrameRange(startFrame, startFrame + 18, durationFrames);
      overlays.push({
        text: word.text.replace(/[.!?]$/, '').toUpperCase(),
        startFrame: clampedStart,
        endFrame: clampedEnd,
        animation: 'pop',
        color: '#FF0040',
      });
    });
  }

  return {textOverlays: overlays, textEvents};
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

const buildCuts = (input: DirectorInput, phrases: Phrase[], profile: ProfileTuning, hookEndMs: number) => {
  const cuts: CutEvent[] = [];
  const memory = createMemory();
  const hookCandidates = [...new Set([...input.beats, ...input.onsets].filter((point) => point <= hookEndMs))].sort((a, b) => a - b);
  const selectedHookPoints = pickEvenly(hookCandidates, profile.hookCutCount);

  selectedHookPoints.forEach((point, index) => {
    const frame = msToFrame(point);
    const preferredStyle: CutEvent["style"] = index % 2 === 0 ? 'hard' : 'zoom_blur';
    const style: CutEvent["style"] = canUseEffect(memory, preferredStyle, frame) ? preferredStyle : 'hard';
    useEffect(memory, style, frame);
    cuts.push({
      type: 'cut',
      atMs: point,
      toMs: point,
      style,
      intensity: 1,
    });
  });

  const postHookBoundaries = phrases.slice(0, -1).map((phrase) => phrase.endMs).filter((boundary) => boundary > hookEndMs);
  postHookBoundaries.forEach((boundary, index) => {
    if (index % profile.postHookStride !== 0) {
      return;
    }
    const frame = msToFrame(boundary);
    const energy = energyAtMs(input.energyCurve, input.durationMs, boundary);
    updateMemory(memory, energy, frame, false);
    if (shouldBreathe(memory, frame)) {
      return;
    }
    const synced = nearestSyncPoint(boundary, input.beats, input.onsets);
    const preferredStyle: CutEvent["style"] = energy > 0.6 ? 'zoom_blur' : 'hard';
    const style: CutEvent["style"] = canUseEffect(memory, preferredStyle, frame) ? preferredStyle : 'hard';
    useEffect(memory, style, frame);
    cuts.push({
      type: 'cut',
      atMs: synced,
      toMs: synced,
      style,
      intensity: 0.8,
    });
  });

  return cuts.sort((a, b) => a.atMs - b.atMs);
};

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
    if (highEnergyWord && phrase.startMs - lastCameraMs >= profile.cameraMoveMs) {
      const startFrame = msToFrame(highEnergyWord.startMs);
      const range = clampFrameRange(startFrame, startFrame + 30, durationFrames);
      moves.push({type: 'push_in', startFrame: range.startFrame, endFrame: range.endFrame});
      lastCameraMs = phrase.startMs;
    }

    const beatDrop = input.beats.find((beat) => beat >= phrase.startMs && beat <= phrase.endMs && energyAtMs(input.energyCurve, input.durationMs, beat) > 0.8);
    if (beatDrop) {
      const type: CameraMove['type'] = seededChance(rng, 0.5) ? 'dutch' : 'shake';
      const duration = type === 'dutch' ? 18 : 12;
      const range = clampFrameRange(msToFrame(beatDrop), msToFrame(beatDrop) + duration, durationFrames);
      moves.push({type, startFrame: range.startFrame, endFrame: range.endFrame});
    }
  });

  const ctaStartFrame = msToFrame(ctaStartMs);
  if (!moves.some((move) => move.type === 'push_in' && move.startFrame >= ctaStartFrame)) {
    const range = clampFrameRange(ctaStartFrame, ctaStartFrame + 30, durationFrames);
    moves.push({type: 'push_in', startFrame: range.startFrame, endFrame: range.endFrame});
  }

  return moves.sort((a, b) => a.startFrame - b.startFrame);
};

const buildTransitions = (phrases: Phrase[], input: DirectorInput, durationFrames: number) => {
  const transitions: Transition[] = [];
  const transitionEvents: TransitionEvent[] = [];

  phrases.slice(0, -1).forEach((phrase) => {
    const synced = nearestSyncPoint(phrase.endMs, input.beats, input.onsets);
    const range = clampFrameRange(msToFrame(synced), msToFrame(synced) + 12, durationFrames);
    transitions.push({startFrame: range.startFrame, endFrame: range.endFrame});
    transitionEvents.push({
      type: 'transition',
      style: phrase.energy > 0.6 ? 'zoom_blur' : 'glitch_flash',
      atMs: synced,
      durationMs: 400,
      intensity: phrase.energy > 0.6 ? 0.9 : 0.7,
    });
  });

  return {transitions, transitionEvents};
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
  const memory = createMemory();
  cuts.forEach((cut, index) => {
    if (profile.sfxDensity >= 1 || index % 2 === 0) {
      const frame = msToFrame(cut.atMs);
      const cue = cut.style === 'zoom_blur' ? 'whoosh_slow' : 'whoosh_fast';
      if (!canUseEffect(memory, cue, frame)) {
        return;
      }
      useEffect(memory, cue, frame);
      sfx.push({
        id: `cut-${index}`,
        cue,
        triggerMs: Math.round(cut.atMs),
        durationMs: 250,
        volumeDb: -12,
        duckMusicDb: -6,
      });
    }
  });

  textEvents.filter((event) => event.color === '#FF0040').forEach((event, index) => {
    const frame = msToFrame(event.startMs);
    updateMemory(memory, event.cameraPush > 0 ? 0.9 : 0.7, frame, event.startMs >= ctaStartMs);
    if (shouldBreathe(memory, frame) && event.startMs < ctaStartMs) {
      return;
    }
    const cue = event.startMs >= ctaStartMs ? 'impact_sharp' : 'impact_deep';
    if (!canUseEffect(memory, cue, frame)) {
      return;
    }
    useEffect(memory, cue, frame);
    sfx.push({
      id: `red-${index}`,
      cue,
      triggerMs: event.startMs,
      durationMs: 300,
      volumeDb: -10,
      duckMusicDb: -9,
    });
    if (event.style === 'glitch' && canUseEffect(memory, 'glitch_digital', frame)) {
      useEffect(memory, 'glitch_digital', frame);
      sfx.push({id: `glitch-${index}`, cue: 'glitch_digital', triggerMs: event.startMs, durationMs: 250, volumeDb: -12, duckMusicDb: -6});
    }
    if (event.style === 'pop' && canUseEffect(memory, 'pop_text', frame)) {
      useEffect(memory, 'pop_text', frame);
      sfx.push({id: `pop-${index}`, cue: 'pop_text', triggerMs: event.startMs, durationMs: 180, volumeDb: -12, duckMusicDb: -6});
    }
  });

  input.beats.filter((beat) => energyAtMs(input.energyCurve, input.durationMs, beat) > 0.85).forEach((beat, index) => {
    if (seededChance(rng, profile.sfxDensity)) {
      const frame = msToFrame(beat);
      updateMemory(memory, energyAtMs(input.energyCurve, input.durationMs, beat), frame, false);
      if (!canUseEffect(memory, 'sub_drop', frame) || shouldBreathe(memory, frame)) {
        return;
      }
      useEffect(memory, 'sub_drop', frame);
      sfx.push({id: `drop-${index}`, cue: 'sub_drop', triggerMs: beat, durationMs: 500, volumeDb: -8, duckMusicDb: -9});
    }
  });

  return sfx.sort((a, b) => a.triggerMs - b.triggerMs);
};

export function generateJosephManifest(input: DirectorInput): UnifiedRenderManifest {
  input = clampDirectorInput(input);
  const profile = PROFILES[input.profile];
  const rng = seededRandom(input.seed);
  const durationFrames = Math.max(1, Math.ceil((input.durationMs / 1000) * FPS));
  const hookEndMs = Math.min(HOOK_MAX_MS, input.durationMs);
  const ctaStartMs = Math.max(input.durationMs * 0.78, input.durationMs - CTA_WINDOW_MS);
  const phrases = buildPhrases(input);
  const {textOverlays, textEvents} = buildTextOverlays(input, phrases, profile, durationFrames, rng, ctaStartMs);
  const cuts = buildCuts(input, phrases, profile, hookEndMs);
  const cameraMoves = buildCameraMoves(input, phrases, profile, durationFrames, ctaStartMs, rng);
  const {transitions, transitionEvents} = buildTransitions(phrases, input, durationFrames);
  const sfx = buildSfx(input, cuts, textEvents, profile, ctaStartMs, rng);
  const videoTracks: VideoTrack[] = [{sourcePath: input.videoUrl, startFrame: 0, endFrame: durationFrames - 1}];

  const timeline = [...cuts, ...textEvents, ...transitionEvents].sort((a, b) => {
    const aTime = 'atMs' in a ? a.atMs : a.startMs;
    const bTime = 'atMs' in b ? b.atMs : b.startMs;
    return aTime - bTime;
  });

  return {
    version: '2.0',
    jobId: randomUUID(),
    seed: input.seed % MAX_INT_31,
    createdAt: new Date().toISOString(),
    durationFrames,
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    videoTracks,
    cameraMoves,
    textOverlays,
    transitions,
    source: {
      videoUrl: input.videoUrl,
      audioUrl: input.musicTrackUrl,
      transcript: input.transcript,
      durationMs: input.durationMs,
      width: WIDTH,
      height: HEIGHT,
      fps: FPS,
    },
    audio: {
      beats: input.beats,
      onsets: input.onsets,
      energyCurve: input.energyCurve,
      musicTrackUrl: input.musicTrackUrl,
      sfx,
      voiceVolumeDb: 0,
      musicVolumeDb: -18,
      targetLufs: -14,
    },
    timeline,
    creativeProfile: {
      name: input.profile,
      cutDensity: input.profile === 'joseph_aggressive' ? 1 : input.profile === 'joseph_cinematic' ? 0.6 : 0.2,
      textDensity: profile.textCoverage,
      sfxDensity: profile.sfxDensity,
      cameraAggression: input.profile === 'joseph_aggressive' ? 0.9 : input.profile === 'joseph_cinematic' ? 0.6 : 0.2,
      colorIntensity: input.profile === 'joseph_minimal' ? 0.3 : 0.8,
    },
    output: {
      width: WIDTH,
      height: HEIGHT,
      fps: FPS,
      codec: 'h264',
      crf: 18,
    },
  };
}

export function generateCandidateGenomes(input: DirectorInput, count = 3): UnifiedRenderManifest[] {
  const candidateCount = Math.max(2, Math.min(6, Math.floor(count)));

  return Array.from({length: candidateCount}, (_, index) => generateJosephManifest({
    ...input,
    seed: (input.seed + index * 7919) % MAX_INT_31,
  }));
}
