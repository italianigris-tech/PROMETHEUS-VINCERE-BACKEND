import {describe, expect, it} from "vitest";
import {textAnimationGrammarSchema} from "@prometheus/shared-types";

import {
  computeTextTimingMetrics,
  planTextChoreography,
  textOnlyCompositionTemplates
} from "./TextChoreography.js";

const baseWords = [
  {text: "Hello", startMs: 0, endMs: 900},
  {text: "World", startMs: 900, endMs: 1800}
];

describe("planTextChoreography", () => {
  it("applies word-level micro-stagger timing", () => {
    const grammar = textAnimationGrammarSchema.parse({
      version: "prometheus-text-grammar/v1",
      stagger: {
        unit: "word",
        delayMs: 200
      },
      entrance: {
        type: "slide",
        durationMs: 300
      }
    });

    const plan = planTextChoreography({
      words: baseWords,
      grammar,
      durationMs: 2400
    });

    expect(plan.words.map((word) => word.enterStartMs)).toEqual([0, 200]);
    expect(plan.words[1]?.entrance.type).toBe("slide");
  });

  it("expands letter-level choreography with per-letter stagger", () => {
    const grammar = textAnimationGrammarSchema.parse({
      version: "prometheus-text-grammar/v1",
      stagger: {
        unit: "letter",
        delayMs: 50
      },
      entrance: {
        type: "decode",
        durationMs: 200
      }
    });

    const plan = planTextChoreography({
      words: [{text: "Hello", startMs: 0, endMs: 1000}],
      grammar,
      durationMs: 1400
    });

    expect(plan.letters.map((letter) => letter.enterStartMs)).toEqual([0, 50, 100, 150, 200]);
    expect(plan.letters.map((letter) => letter.text).join("")).toBe("Hello");
  });

  it("aligns text entrances to beat timestamps with offset", () => {
    const grammar = textAnimationGrammarSchema.parse({
      version: "prometheus-text-grammar/v1",
      stagger: {
        unit: "word",
        delayMs: 200
      },
      sync: {
        mode: "toBeat",
        offsetMs: -30
      }
    });

    const plan = planTextChoreography({
      words: baseWords,
      grammar,
      durationMs: 2400,
      audioTimeline: {
        beatsMs: [1000, 2000]
      }
    });

    expect(plan.words.map((word) => word.enterStartMs)).toEqual([970, 1970]);
    expect(plan.syncCoverage).toEqual({
      requested: "toBeat",
      matchedEvents: 2,
      totalEvents: 2
    });
  });

  it("assigns selective effects only to matching words and letters", () => {
    const grammar = textAnimationGrammarSchema.parse({
      version: "prometheus-text-grammar/v1",
      stagger: {
        unit: "letter",
        delayMs: 40
      },
      selectiveEffects: [{
        selector: {
          text: "Hello"
        },
        effects: {
          bloom: true,
          motionBlur: true,
          chromaticAberration: false
        }
      }]
    });

    const plan = planTextChoreography({
      words: baseWords,
      grammar,
      durationMs: 2400
    });

    expect(plan.words[0]?.selectiveEffects).toEqual({
      bloom: true,
      motionBlur: true,
      chromaticAberration: false
    });
    expect(plan.words[1]?.selectiveEffects).toEqual({
      bloom: false,
      motionBlur: false,
      chromaticAberration: false
    });
    expect(plan.letters.filter((letter) => letter.wordIndex === 0).every((letter) => letter.selectiveEffects.bloom)).toBe(true);
    expect(plan.letters.filter((letter) => letter.wordIndex === 1).every((letter) => !letter.selectiveEffects.bloom)).toBe(true);
  });
});

describe("text choreography metrics and templates", () => {
  it("reports timing accuracy and beat-sync coverage", () => {
    const metrics = computeTextTimingMetrics({
      intendedEventTimesMs: [1000, 2000, 3000],
      actualEventTimesMs: [990, 2030, 3070],
      beatTimesMs: [1000, 2000, 3000]
    });

    expect(metrics.meanAbsoluteErrorMs).toBeCloseTo(36.667, 3);
    expect(metrics.rhythmSyncWithin50MsPercent).toBeCloseTo(66.667, 3);
    expect(metrics.eventCount).toBe(3);
  });

  it("ships named text-only composition templates as grammar presets", () => {
    expect(textOnlyCompositionTemplates.map((template) => template.name)).toEqual([
      "Kinetic Typography Reveal",
      "Beat-Synced Title Sequence",
      "Cinematic Lower Third",
      "Text Morph Transition"
    ]);
  });
});
