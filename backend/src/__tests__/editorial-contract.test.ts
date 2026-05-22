import {describe, expect, it} from "vitest";

import {
  DEFAULT_LOCAL_PREVIEW_CAPTION_PROFILE_ID,
  LOCAL_PREVIEW_CAPTION_PROFILE_IDS,
  normalizeLocalPreviewCaptionProfileId
} from "../editorial-contract";

describe("editorial contract", () => {
  it("keeps the SVG long-form profile as the default local preview and render house style", () => {
    expect(DEFAULT_LOCAL_PREVIEW_CAPTION_PROFILE_ID).toBe("longform_svg_typography_v1");
    expect(LOCAL_PREVIEW_CAPTION_PROFILE_IDS).toContain("longform_svg_typography_v1");
  });

  it("normalizes legacy and house-style aliases into supported long-form profiles", () => {
    expect(normalizeLocalPreviewCaptionProfileId("longform_eve_typography_v1")).toBe("longform_eve_typography_v1");
    expect(normalizeLocalPreviewCaptionProfileId("eve_typography_v1")).toBe("longform_eve_typography_v1");
    expect(normalizeLocalPreviewCaptionProfileId("svg_typography_v1")).toBe("longform_svg_typography_v1");
    expect(normalizeLocalPreviewCaptionProfileId("hormozi_word_lock_v1")).toBe("longform_svg_typography_v1");
    expect(normalizeLocalPreviewCaptionProfileId("unknown")).toBe("longform_svg_typography_v1");
  });
});
