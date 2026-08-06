import {describe, expect, it} from "vitest";

import {
  deriveReferenceEditorialRhythm,
} from "./reference-editorial-rhythm.js";

const referenceTraits = [
  "phrase-level typography hierarchy",
  "contrasting editorial serif hinge",
  "deliberate readable holds",
  "semantic hinge emphasis",
  "cut-led tempo",
];

const segments = [
  {
    segmentId: "hook",
    semanticRole: "hook",
    emphasisLevel: "hero",
    wordCount: 2,
    outputStartMs: 0,
    outputEndMs: 1_400,
    holdAcrossProtectedPause: false,
  },
  {
    segmentId: "proof",
    semanticRole: "explanation",
    emphasisLevel: "key",
    wordCount: 3,
    outputStartMs: 1_400,
    outputEndMs: 3_300,
    holdAcrossProtectedPause: true,
  },
  {
    segmentId: "payoff",
    semanticRole: "payoff",
    emphasisLevel: "hero",
    wordCount: 2,
    outputStartMs: 3_300,
    outputEndMs: 4_900,
    holdAcrossProtectedPause: false,
  },
] as const;

describe("MAUL reference editorial rhythm", () => {
  it("derives a replayable contrast-preserving phrase program from abstract reference traits", () => {
    const input = {
      referenceTraits,
      primaryTypeRole: "editorial_display" as const,
      selectionSeed: "project:clip:reference-editorial-v1",
      segments,
    };

    const first = deriveReferenceEditorialRhythm(input);
    const second = deriveReferenceEditorialRhythm(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      fontSystemId: "condensed_kinetic_hinge",
      traitReceipt: [
        "cut_led_tempo",
        "deliberate_readable_holds",
        "editorial_serif_hinge",
        "phrase_hierarchy",
        "semantic_hinge_emphasis",
      ],
    });
    expect(first.segments.map((segment) => segment.segmentId)).toEqual(
      segments.map((segment) => segment.segmentId),
    );
    expect(
      new Set(first.segments.map((segment) => segment.treatment)).size,
    ).toBe(first.segments.length);
    expect(first.segments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        segmentId: "proof",
        treatment: "cinematic_focus_lock",
        preserveReadableHold: true,
      }),
    ]));
  });

  it("falls back to a renderer-safe, restrained program when the reference has no recognized traits", () => {
    const rhythm = deriveReferenceEditorialRhythm({
      referenceTraits: ["colourful typography"],
      primaryTypeRole: "neutral_grotesk",
      selectionSeed: "fallback",
      segments: [segments[0]],
    });

    expect(rhythm).toMatchObject({
      fontSystemId: "grotesk_editorial_hinge",
      traitReceipt: [],
      segments: [
        expect.objectContaining({
          treatment: "documentary-soft-lock",
          preserveReadableHold: false,
        }),
      ],
    });
  });
});
