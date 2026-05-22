import {describe, expect, it} from "vitest";

import {
  getLongformCaptionRenderModeForChunk,
  getCaptionStyleProfile,
  getDefaultCaptionBiasForProfile,
  getLongformWordByWordFallbackModeForProfile,
  normalizeCaptionStyleProfileId
} from "../stylebooks/caption-style-profiles";
import type {CaptionChunk} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1000,
  words: partial.words ?? [],
  styleKey: partial.styleKey ?? "style",
  motionKey: partial.motionKey ?? "motion",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [],
  semantic:
    partial.semantic ?? {
      intent: "default",
      nameSpans: [],
      isVariation: false,
      suppressDefault: false
    }
});

describe("caption style profiles", () => {
  it("defaults to slcp when profile id is missing or unknown", () => {
    expect(normalizeCaptionStyleProfileId(undefined)).toBe("slcp");
    expect(normalizeCaptionStyleProfileId("unknown")).toBe("slcp");
  });

  it("loads SLCP profile with capped 1-3 grouping policy", () => {
    const profile = getCaptionStyleProfile("slcp");
    expect(profile.id).toBe("slcp");
    expect(profile.groupingPolicy.hardMinWords).toBe(1);
    expect(profile.groupingPolicy.hardMaxWords).toBe(3);
    expect(profile.groupingPolicy.softMinWords).toBe(2);
    expect(profile.groupingPolicy.softMaxWords).toBe(3);
    expect(profile.strictWordLockHighlight).toBe(false);
  });

  it("loads Hormozi profile with 1-4 grouping policy", () => {
    const profile = getCaptionStyleProfile("hormozi_word_lock_v1");
    expect(profile.id).toBe("hormozi_word_lock_v1");
    expect(profile.groupingPolicy.hardMinWords).toBe(1);
    expect(profile.groupingPolicy.hardMaxWords).toBe(4);
    expect(profile.strictWordLockHighlight).toBe(true);
  });

  it("loads SVG typography profile with tuned 1-4 grouping policy", () => {
    const profile = getCaptionStyleProfile("svg_typography_v1");
    expect(profile.id).toBe("svg_typography_v1");
    expect(profile.groupingPolicy.hardMinWords).toBe(1);
    expect(profile.groupingPolicy.hardMaxWords).toBe(4);
    expect(profile.groupingPolicy.softMinWords).toBe(2);
    expect(profile.groupingPolicy.softMaxWords).toBe(3);
    expect(profile.strictWordLockHighlight).toBe(false);
  });

  it("keeps the caption bias defaults aligned with each profile", () => {
    expect(getDefaultCaptionBiasForProfile("slcp")).toBe("bottom");
    expect(getDefaultCaptionBiasForProfile("hormozi_word_lock_v1")).toBe("middle");
    expect(getDefaultCaptionBiasForProfile("svg_typography_v1")).toBe("middle");
    expect(getDefaultCaptionBiasForProfile("longform_svg_typography_v1")).toBe("middle");
    expect(getDefaultCaptionBiasForProfile("longform_eve_typography_v1")).toBe("bottom");
  });

  it("keeps longform SVG typography in the SVG renderer while EVE hybrid routing can fall back to semantic overlays", () => {
    const sparseChunk = makeChunk({
      text: "Gary Vee",
      words: [
        {text: "Gary", startMs: 0, endMs: 160},
        {text: "Vee", startMs: 180, endMs: 360}
      ],
      semantic: {
        intent: "name-callout",
        nameSpans: [{startWord: 0, endWord: 1, text: "Gary Vee"}],
        isVariation: true,
        suppressDefault: true
      }
    });

    const genericSparseChunk = makeChunk({
      text: "Making money",
      words: [
        {text: "Making", startMs: 0, endMs: 220},
        {text: "money", startMs: 240, endMs: 520}
      ]
    });

    const eveChunk = makeChunk({
      text: "Give it a name right now",
      words: [
        {text: "Give", startMs: 0, endMs: 150},
        {text: "it", startMs: 180, endMs: 260},
        {text: "a", startMs: 280, endMs: 340},
        {text: "name", startMs: 360, endMs: 580},
        {text: "right", startMs: 620, endMs: 780},
        {text: "now", startMs: 800, endMs: 980}
      ]
    });

    const graphicChunk = makeChunk({
      text: "Give it a name",
      words: [
        {text: "Give", startMs: 0, endMs: 150},
        {text: "it", startMs: 180, endMs: 260},
        {text: "a", startMs: 280, endMs: 340},
        {text: "name", startMs: 360, endMs: 580}
      ]
    });

    expect(getLongformCaptionRenderModeForChunk("longform_svg_typography_v1", sparseChunk)).toBe("svg");
    expect(getLongformCaptionRenderModeForChunk("longform_svg_typography_v1", genericSparseChunk)).toBe("svg");
    expect(getLongformCaptionRenderModeForChunk("longform_eve_typography_v1", sparseChunk)).toBe("word-by-word");
    expect(getLongformCaptionRenderModeForChunk("longform_eve_typography_v1", eveChunk)).toBe("semantic-sidecall");
    expect(getLongformCaptionRenderModeForChunk("longform_eve_typography_v1", graphicChunk)).toBe("semantic-sidecall");
    expect(getLongformCaptionRenderModeForChunk("longform_docked_inverse_v1", genericSparseChunk)).toBe("docked-inverse");
    expect(getLongformCaptionRenderModeForChunk("longform_semantic_sidecall_v1", sparseChunk)).toBe("semantic-sidecall");
    expect(getLongformWordByWordFallbackModeForProfile("longform_eve_typography_v1", eveChunk)).toBe("semantic-sidecall");
    expect(getLongformWordByWordFallbackModeForProfile("longform_eve_typography_v1", graphicChunk)).toBe("semantic-sidecall");
  });
});
