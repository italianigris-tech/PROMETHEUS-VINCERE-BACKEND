import {describe, expect, it} from "vitest";

import {
  selectMaulSemanticSfxIntents,
  selectMaulTypographySfx,
} from "./typography-sfx.js";

const assets = [
  {id: "click", storagePath: "C:/sfx/click.wav", category: "UI INTERFACE", eventType: "typography_entry" as const},
  {id: "impact", storagePath: "C:/sfx/impact.wav", category: "IMPACT HITS", eventType: "typography_emphasis" as const},
  {id: "sweep", storagePath: "C:/sfx/sweep.wav", category: "SWEEPS", eventType: "typography_motion" as const},
];

describe("MAUL semantic SFX playbook", () => {
  it("scores semantic beats instead of sonifying every animated word", () => {
    const selected = selectMaulTypographySfx({
      programs: Array.from({length: 12}, (_, index) => ({
        animationId: `word_${index}`,
        treatment: "generic_single_word",
        frameMotion: {sourceIntervalMs: {startMs: index * 500, endMs: index * 500 + 300}},
      })),
      semanticMoments: [
        {sourceMs: 0, role: "hook", emphasisLevel: "key"},
        {sourceMs: 1_000, role: "context", emphasisLevel: "none"},
        {sourceMs: 2_000, role: "proof", emphasisLevel: "supporting"},
        {sourceMs: 4_000, role: "contrast", emphasisLevel: "key"},
        {sourceMs: 5_500, role: "payoff", emphasisLevel: "hero"},
      ],
      assets,
    });

    expect(selected).toHaveLength(4);
    expect(selected.map((cue) => cue.semanticRole)).toEqual(["hook", "proof", "contrast", "payoff"]);
    expect(selected.map((cue) => cue.eventType)).toEqual([
      "typography_motion", "typography_entry", "typography_motion", "typography_emphasis",
    ]);
    expect(selected.every((cue) => cue.reason.length > 10)).toBe(true);
  });

  it("permits one cue per semantic role and preserves a restraint gap", () => {
    const selected = selectMaulTypographySfx({
      programs: [],
      semanticMoments: [
        {sourceMs: 1_000, role: "contrast", emphasisLevel: "key"},
        {sourceMs: 1_300, role: "contrast", emphasisLevel: "hero"},
        {sourceMs: 1_600, role: "payoff", emphasisLevel: "hero"},
        {sourceMs: 3_000, role: "payoff", emphasisLevel: "hero"},
      ],
      assets,
      minimumGapMs: 900,
    });

    expect(selected.map((cue) => cue.sourceMs)).toEqual([1_300, 3_000]);
  });

  it("uses the same semantic selection before asset resolution", () => {
    const semanticMoments = [
      {sourceMs: 0, role: "hook", emphasisLevel: "key"},
      {sourceMs: 400, role: "context", emphasisLevel: "none"},
      {sourceMs: 2_000, role: "proof", emphasisLevel: "supporting"},
      {sourceMs: 4_000, role: "payoff", emphasisLevel: "hero"},
    ] as const;
    const intents = selectMaulSemanticSfxIntents({semanticMoments});
    const assetsSelected = selectMaulTypographySfx({
      programs: [],
      semanticMoments,
      assets,
    });

    expect(assetsSelected.map(({eventType, sourceMs, semanticRole, reason}) => ({
      eventType,
      sourceMs,
      semanticRole,
      reason,
    }))).toEqual(intents);
  });

  it("lets a nearby payoff displace a weaker cue under the restraint gap", () => {
    expect(selectMaulSemanticSfxIntents({
      semanticMoments: [
        {sourceMs: 1_000, role: "proof", emphasisLevel: "support"},
        {sourceMs: 1_500, role: "payoff", emphasisLevel: "hero"},
      ],
      minimumGapMs: 900,
    })).toEqual([
      expect.objectContaining({
        eventType: "typography_emphasis",
        sourceMs: 1_500,
        semanticRole: "payoff",
      }),
    ]);
  });

  it("reduces a talking-head passage to hook and payoff sound cues", () => {
    const selected = selectMaulTypographySfx({
      programs: Array.from({length: 24}, (_, index) => ({
        animationId: `word_${index}`,
        treatment: "cinematic_focus_lock",
        frameMotion: {sourceIntervalMs: {startMs: index * 400, endMs: index * 400 + 300}},
      })),
      semanticMoments: [
        {sourceMs: 320, role: "hook", emphasisLevel: "hero"},
        {sourceMs: 2_320, role: "context", emphasisLevel: "key"},
        {sourceMs: 5_440, role: "context", emphasisLevel: "key"},
        {sourceMs: 8_880, role: "payoff", emphasisLevel: "hero"},
      ],
      assets,
      maxCues: 3,
      minimumGapMs: 1_800,
    });

    expect(selected.map((cue) => cue.semanticRole)).toEqual(["hook", "payoff"]);
  });
});
