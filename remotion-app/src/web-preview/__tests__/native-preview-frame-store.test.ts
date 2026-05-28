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

  it("exposes frame-source adapters without adding derived timeline state", () => {
    const source = readPreviewSource("frame-store.ts");

    expect(source).toContain("export type PreviewFrameSource");
    expect(source).toContain("export const nativePreviewFrameSource");
    expect(source).toContain("export const createPreviewFrameSource");
    expect(Object.keys(useFrameStore.getState()).sort()).toEqual(["frame", "setFrame"]);
  });

  it("keeps NativePreviewStage off the per-frame React state path", () => {
    const source = readPreviewSource("NativePreviewStage.tsx");
    const nativeStageSource = source.slice(source.indexOf("export const NativePreviewStage"));

    expect(nativeStageSource).not.toContain("setCurrentTimeMs");
    expect(nativeStageSource).not.toMatch(/currentTimeMs=\{/);
    expect(nativeStageSource).toContain("nativePreviewFrameSource.setFrame(nextFrame)");
    expect(nativeStageSource).toMatch(/Math\.round\(\s*video\.currentTime\s*\*\s*videoMetadata\.fps\s*\)/);
  });

  it("keeps the global native frame store single-writer only", () => {
    const nativeSource = readPreviewSource("NativePreviewStage.tsx");
    const creativeAudioSource = readPreviewSource("CreativeLiveAudioPreview.tsx");
    const hyperframesSource = readPreviewSource("HyperframesPreview.tsx");

    expect((nativeSource.match(/nativePreviewFrameSource\.setFrame/g) ?? []).length).toBe(2);
    expect(creativeAudioSource).not.toContain("nativePreviewFrameSource.setFrame");
    expect(hyperframesSource).not.toContain("nativePreviewFrameSource.setFrame");
    expect(creativeAudioSource).not.toContain("useFrameStore");
    expect(hyperframesSource).not.toContain("useFrameStore");
  });

  it("does not pass currentTimeMs into NativePreviewOverlayStage callers", () => {
    const creativeAudioSource = readPreviewSource("CreativeLiveAudioPreview.tsx");
    const hyperframesSource = readPreviewSource("HyperframesPreview.tsx");

    expect(creativeAudioSource).not.toMatch(/<NativePreviewOverlayStage[\s\S]*?currentTimeMs=/);
    expect(hyperframesSource).not.toMatch(/<NativePreviewOverlayStage[\s\S]*?currentTimeMs=/);
  });

  it("keeps broad overlay containers off frame subscriptions", () => {
    const source = readPreviewSource("NativePreviewStage.tsx");
    const overlayStageSource = source.slice(
      source.indexOf("export const NativePreviewOverlayStage"),
      source.indexOf("const NativeFrameDrivenVideoShell")
    );
    const shellSource = source.slice(
      source.indexOf("const NativeFrameDrivenVideoShell"),
      source.indexOf("export const NativePreviewStage")
    );

    expect(overlayStageSource).not.toContain("usePreviewCurrentTimeMs");
    expect(overlayStageSource).not.toContain("useFrameStore");
    expect(shellSource).not.toContain("usePreviewCurrentTimeMs");
    expect(shellSource).not.toContain("frameSource.useFrame");
    expect(shellSource).toContain("style.transform");
    expect(shellSource).toContain("frameSource.subscribe");
  });
});
