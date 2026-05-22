import {describe, expect, it} from "vitest";

import {isSvgCaptionChunk} from "../../components/SvgCaptionOverlay";
import {toSvgTypographyStyleKey} from "../stylebooks/svg-typography-v1";
import type {CaptionChunk} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "TEXT",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1000,
  words: partial.words ?? [],
  styleKey: partial.styleKey ?? "tall_generic_default",
  motionKey: partial.motionKey ?? "cinematic_focus_lock",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [],
  profileId: partial.profileId
});

describe("svg overlay integration guards", () => {
  it("recognizes explicit svg profile chunks", () => {
    const chunk = makeChunk({
      profileId: "svg_typography_v1",
      styleKey: toSvgTypographyStyleKey("cinematic_text_preset_4")
    });

    expect(isSvgCaptionChunk(chunk)).toBe(true);
  });

  it("keeps classic profile chunks on cinematic renderer path", () => {
    const chunk = makeChunk({
      profileId: "slcp",
      styleKey: "tall_interesting_medium"
    });

    expect(isSvgCaptionChunk(chunk)).toBe(false);
  });

  it("supports svg style-key detection even if profileId is missing", () => {
    const chunk = makeChunk({
      profileId: undefined,
      styleKey: toSvgTypographyStyleKey("cinematic_text_preset_8")
    });

    expect(isSvgCaptionChunk(chunk)).toBe(true);
  });

  it("treats longform svg profile chunks as svg-capable even before a variant key is resolved", () => {
    const chunk = makeChunk({
      profileId: "longform_svg_typography_v1",
      styleKey: "longform-generic-fallback"
    });

    expect(isSvgCaptionChunk(chunk)).toBe(true);
  });
});
