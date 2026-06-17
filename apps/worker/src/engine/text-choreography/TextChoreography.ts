import type {TextAnimationGrammar, TextSyncMode} from "@prometheus/shared-types";
import {textAnimationGrammarSchema} from "@prometheus/shared-types";

export type TextChoreographyWordInput = {
  text: string;
  startMs: number;
  endMs: number;
};

export type TextChoreographyAudioTimeline = {
  beatsMs?: readonly number[];
  onsetsMs?: readonly number[];
  phrasesMs?: readonly number[];
};

export type TextSelectiveEffectState = {
  bloom: boolean;
  motionBlur: boolean;
  chromaticAberration: boolean;
};

export type TextChoreographyEvent = {
  unit: "word" | "letter";
  text: string;
  wordText: string;
  wordIndex: number;
  letterIndex?: number;
  globalIndex: number;
  sourceStartMs: number;
  sourceEndMs: number;
  enterStartMs: number;
  enterEndMs: number;
  holdStartMs: number;
  holdEndMs: number;
  exitStartMs: number;
  exitEndMs: number;
  entrance: TextAnimationGrammar["entrance"];
  hold: TextAnimationGrammar["hold"];
  exit: TextAnimationGrammar["exit"];
  selectiveEffects: TextSelectiveEffectState;
  syncAnchorMs?: number;
};

export type TextChoreographyPlan = {
  words: TextChoreographyEvent[];
  letters: TextChoreographyEvent[];
  syncCoverage: {
    requested: TextSyncMode;
    matchedEvents: number;
    totalEvents: number;
  };
};

export type PlanTextChoreographyInput = {
  words: readonly TextChoreographyWordInput[];
  grammar: TextAnimationGrammar;
  durationMs: number;
  audioTimeline?: TextChoreographyAudioTimeline;
};

export type TextTimingMetricsInput = {
  intendedEventTimesMs: readonly number[];
  actualEventTimesMs: readonly number[];
  beatTimesMs: readonly number[];
};

export type TextTimingMetrics = {
  eventCount: number;
  meanAbsoluteErrorMs: number;
  rhythmSyncWithin50MsPercent: number;
};

export type TextOnlyCompositionTemplate = {
  name: string;
  description: string;
  grammar: TextAnimationGrammar;
};

const NO_EFFECTS: TextSelectiveEffectState = {
  bloom: false,
  motionBlur: false,
  chromaticAberration: false
};

const orderIndexFor = (index: number, total: number, order: TextAnimationGrammar["stagger"]["order"]): number => {
  switch (order) {
    case "reverse":
      return Math.max(total - index - 1, 0);
    case "center-out": {
      const center = (total - 1) / 2;
      return Math.round(Math.abs(index - center) * 2);
    }
    case "random":
      return (index * 7) % Math.max(total, 1);
    case "forward":
    default:
      return index;
  }
};

const anchorTimelineFor = (
  mode: TextSyncMode,
  audioTimeline: TextChoreographyAudioTimeline | undefined
): readonly number[] => {
  switch (mode) {
    case "toBeat":
      return audioTimeline?.beatsMs ?? [];
    case "toOnset":
      return audioTimeline?.onsetsMs ?? [];
    case "toPhrase":
      return audioTimeline?.phrasesMs ?? [];
    case "none":
    default:
      return [];
  }
};

const phaseEvent = ({
  unit,
  text,
  wordText,
  wordIndex,
  letterIndex,
  globalIndex,
  sourceStartMs,
  sourceEndMs,
  startMs,
  syncAnchorMs,
  grammar,
  selectiveEffects
}: {
  unit: "word" | "letter";
  text: string;
  wordText: string;
  wordIndex: number;
  letterIndex?: number;
  globalIndex: number;
  sourceStartMs: number;
  sourceEndMs: number;
  startMs: number;
  syncAnchorMs?: number;
  grammar: TextAnimationGrammar;
  selectiveEffects: TextSelectiveEffectState;
}): TextChoreographyEvent => {
  const enterStartMs = Math.max(0, Math.round(startMs));
  const enterEndMs = enterStartMs + grammar.entrance.durationMs;
  const holdStartMs = enterEndMs;
  const holdEndMs = holdStartMs + grammar.hold.durationMs;
  const exitStartMs = holdEndMs;
  const exitEndMs = exitStartMs + grammar.exit.durationMs;

  return {
    unit,
    text,
    wordText,
    wordIndex,
    letterIndex,
    globalIndex,
    sourceStartMs,
    sourceEndMs,
    enterStartMs,
    enterEndMs,
    holdStartMs,
    holdEndMs,
    exitStartMs,
    exitEndMs,
    entrance: grammar.entrance,
    hold: grammar.hold,
    exit: grammar.exit,
    selectiveEffects,
    syncAnchorMs
  };
};

const selectorMatches = (
  selector: TextAnimationGrammar["selectiveEffects"][number]["selector"],
  event: Pick<TextChoreographyEvent, "wordText" | "wordIndex" | "letterIndex">
): boolean => {
  if (selector.text !== undefined && selector.text !== event.wordText) {
    return false;
  }

  if (selector.wordIndex !== undefined && selector.wordIndex !== event.wordIndex) {
    return false;
  }

  if (selector.letterRange !== undefined) {
    if (event.letterIndex === undefined) {
      return false;
    }
    const [start, end] = selector.letterRange;
    if (event.letterIndex < start || event.letterIndex >= end) {
      return false;
    }
  }

  return true;
};

const selectiveEffectsFor = (
  grammar: TextAnimationGrammar,
  event: Pick<TextChoreographyEvent, "wordText" | "wordIndex" | "letterIndex">
): TextSelectiveEffectState => {
  const effects = {...NO_EFFECTS};
  for (const rule of grammar.selectiveEffects) {
    if (!selectorMatches(rule.selector, event)) {
      continue;
    }
    effects.bloom = effects.bloom || rule.effects.bloom;
    effects.motionBlur = effects.motionBlur || rule.effects.motionBlur;
    effects.chromaticAberration = effects.chromaticAberration || rule.effects.chromaticAberration;
  }
  return effects;
};

export const planTextChoreography = ({
  words,
  grammar: inputGrammar,
  durationMs,
  audioTimeline
}: PlanTextChoreographyInput): TextChoreographyPlan => {
  const grammar = textAnimationGrammarSchema.parse(inputGrammar);
  const anchors = anchorTimelineFor(grammar.sync.mode, audioTimeline);
  const syncOffset = grammar.sync.offsetMs;
  const wordCount = words.length;
  let matchedEvents = 0;

  const wordStarts = words.map((word, index) => {
    const syncAnchor = anchors[index];
    if (syncAnchor !== undefined) {
      matchedEvents += 1;
      return {
        startMs: syncAnchor + syncOffset,
        syncAnchorMs: syncAnchor
      };
    }

    return {
      startMs: (wordCount > 0 ? words[0]?.startMs ?? 0 : 0) +
        orderIndexFor(index, wordCount, grammar.stagger.order) * grammar.stagger.delayMs,
      syncAnchorMs: undefined
    };
  });

  const wordEvents = words.map((word, index) => {
    const start = wordStarts[index] ?? {startMs: word.startMs, syncAnchorMs: undefined};
    return phaseEvent({
      unit: "word",
      text: word.text,
      wordText: word.text,
      wordIndex: index,
      globalIndex: index,
      sourceStartMs: word.startMs,
      sourceEndMs: Math.min(word.endMs, durationMs),
      startMs: start.startMs,
      syncAnchorMs: start.syncAnchorMs,
      grammar,
      selectiveEffects: selectiveEffectsFor(grammar, {
        wordText: word.text,
        wordIndex: index
      })
    });
  });

  const letterSeed = words.flatMap((word, wordIndex) =>
    Array.from(word.text).map((letter, letterIndex) => ({
      text: letter,
      wordText: word.text,
      wordIndex,
      letterIndex,
      sourceStartMs: word.startMs,
      sourceEndMs: Math.min(word.endMs, durationMs)
    }))
  );

  const letterEvents = letterSeed.map((letter, globalIndex) => {
    const syncAnchor = grammar.stagger.unit === "letter" ? anchors[globalIndex] : undefined;
    const hasSyncAnchor = syncAnchor !== undefined;
    if (hasSyncAnchor && globalIndex >= words.length) {
      matchedEvents += 1;
    }
    const parentStart = wordStarts[letter.wordIndex]?.startMs ?? letter.sourceStartMs;
    const startMs = hasSyncAnchor
      ? syncAnchor + syncOffset
      : grammar.stagger.unit === "letter"
        ? parentStart + orderIndexFor(globalIndex, letterSeed.length, grammar.stagger.order) * grammar.stagger.delayMs
        : parentStart;

    return phaseEvent({
      unit: "letter",
      text: letter.text,
      wordText: letter.wordText,
      wordIndex: letter.wordIndex,
      letterIndex: letter.letterIndex,
      globalIndex,
      sourceStartMs: letter.sourceStartMs,
      sourceEndMs: letter.sourceEndMs,
      startMs,
      syncAnchorMs: hasSyncAnchor ? syncAnchor : wordStarts[letter.wordIndex]?.syncAnchorMs,
      grammar,
      selectiveEffects: selectiveEffectsFor(grammar, letter)
    });
  });

  return {
    words: wordEvents,
    letters: letterEvents,
    syncCoverage: {
      requested: grammar.sync.mode,
      matchedEvents,
      totalEvents: grammar.stagger.unit === "letter" ? letterEvents.length : wordEvents.length
    }
  };
};

export const computeTextTimingMetrics = ({
  intendedEventTimesMs,
  actualEventTimesMs,
  beatTimesMs
}: TextTimingMetricsInput): TextTimingMetrics => {
  const eventCount = Math.min(intendedEventTimesMs.length, actualEventTimesMs.length);
  if (eventCount === 0) {
    return {
      eventCount: 0,
      meanAbsoluteErrorMs: 0,
      rhythmSyncWithin50MsPercent: 0
    };
  }

  let errorTotal = 0;
  let syncedEvents = 0;
  for (let index = 0; index < eventCount; index += 1) {
    const intended = intendedEventTimesMs[index] ?? 0;
    const actual = actualEventTimesMs[index] ?? 0;
    errorTotal += Math.abs(actual - intended);

    const nearestBeatDistance = beatTimesMs.reduce(
      (best, beat) => Math.min(best, Math.abs(actual - beat)),
      Number.POSITIVE_INFINITY
    );
    if (nearestBeatDistance <= 50) {
      syncedEvents += 1;
    }
  }

  return {
    eventCount,
    meanAbsoluteErrorMs: errorTotal / eventCount,
    rhythmSyncWithin50MsPercent: syncedEvents / eventCount * 100
  };
};

export const textOnlyCompositionTemplates: TextOnlyCompositionTemplate[] = [
  {
    name: "Kinetic Typography Reveal",
    description: "Word-level slide/fade reveal for fast social copy.",
    grammar: textAnimationGrammarSchema.parse({
      version: "prometheus-text-grammar/v1",
      stagger: {unit: "word", delayMs: 120},
      entrance: {type: "slide", durationMs: 360, from: {opacity: 0, y: 18}},
      hold: {durationMs: 650, breathingPulse: true},
      exit: {type: "fade", durationMs: 240, to: {opacity: 0}}
    })
  },
  {
    name: "Beat-Synced Title Sequence",
    description: "Beat-quantized word reveals with selective glow accents.",
    grammar: textAnimationGrammarSchema.parse({
      version: "prometheus-text-grammar/v1",
      stagger: {unit: "word", delayMs: 0},
      entrance: {type: "scale", durationMs: 260, from: {opacity: 0, scale: 0.82}},
      sync: {mode: "toBeat", offsetMs: 0}
    })
  },
  {
    name: "Cinematic Lower Third",
    description: "Restrained line reveal with stable hold and soft fade.",
    grammar: textAnimationGrammarSchema.parse({
      version: "prometheus-text-grammar/v1",
      stagger: {unit: "line", delayMs: 180},
      entrance: {type: "slide", durationMs: 300, from: {opacity: 0, y: 12}},
      hold: {durationMs: 1400},
      exit: {type: "fade", durationMs: 220, to: {opacity: 0}}
    })
  },
  {
    name: "Text Morph Transition",
    description: "Letter-level decode and scatter grammar for word replacement moments.",
    grammar: textAnimationGrammarSchema.parse({
      version: "prometheus-text-grammar/v1",
      stagger: {unit: "letter", delayMs: 34},
      entrance: {type: "decode", durationMs: 260, from: {opacity: 0, blur: 6}},
      exit: {type: "scatter", durationMs: 280, to: {opacity: 0, y: -18}}
    })
  }
];
