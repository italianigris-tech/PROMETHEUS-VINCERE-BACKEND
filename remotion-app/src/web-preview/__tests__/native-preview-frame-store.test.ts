import {readFileSync} from "node:fs";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {useFrameStore} from "../frame-store";

const readPreviewSource = (relativePath: string): string => {
  return readFileSync(path.resolve("src/web-preview", relativePath), "utf8");
};

describe("native preview frame store", () => {
  it("exposes only the frame source of truth and an imperative setter", () => {
    useFrameStore.getState().setFrame(0);

    expect(useFrameStore.getState()).toMatchObject({
      frame: 0
    });
    expect(Object.keys(useFrameStore.getState()).sort()).toEqual(["frame", "setFrame"]);

    useFrameStore.getState().setFrame(42.8);
    expect(useFrameStore.getState().frame).toBe(43);
  });

  it("keeps NativePreviewStage off the per-frame React state path", () => {
    const source = readPreviewSource("NativePreviewStage.tsx");
    const nativeStageSource = source.slice(source.indexOf("export const NativePreviewStage"));

    expect(nativeStageSource).not.toContain("setCurrentTimeMs");
    expect(nativeStageSource).not.toMatch(/currentTimeMs=\{/);
    expect(nativeStageSource).toContain("useFrameStore.getState().setFrame");
  });

  it("does not pass currentTimeMs into NativePreviewOverlayStage callers", () => {
    const creativeAudioSource = readPreviewSource("CreativeLiveAudioPreview.tsx");
    const hyperframesSource = readPreviewSource("HyperframesPreview.tsx");

    expect(creativeAudioSource).not.toMatch(/<NativePreviewOverlayStage[\s\S]*?currentTimeMs=/);
    expect(hyperframesSource).not.toMatch(/<NativePreviewOverlayStage[\s\S]*?currentTimeMs=/);
  });
});
