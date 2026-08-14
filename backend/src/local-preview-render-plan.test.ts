import {describe, expect, it} from "vitest";

import {resolveLocalPreviewRenderPlan} from "./local-preview-runner";

describe("local preview render plan", () => {
  it("uses browser preview without baking a draft MP4", () => {
    expect(resolveLocalPreviewRenderPlan("speed-draft")).toEqual({
      renderDraft: false,
      renderMaster: false
    });
  });

  it("renders exactly one MP4 for master delivery", () => {
    expect(resolveLocalPreviewRenderPlan("master-render")).toEqual({
      renderDraft: false,
      renderMaster: true
    });
  });
});
