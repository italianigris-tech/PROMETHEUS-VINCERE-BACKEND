import {describe, expect, it} from "vitest";

import {
  resolveMaulRenderConcurrency,
  resolveMaulRenderFrameRange,
  resolveMaulMartinStageAssets,
} from "./render-engine.js";

describe("MAUL local render engine", () => {
  it("serializes a constrained proof render with an explicit Remotion concurrency flag", () => {
    expect(resolveMaulRenderConcurrency(1)).toEqual(["--concurrency=1"]);
  });

  it("preserves Remotion defaults when no render concurrency is requested", () => {
    expect(resolveMaulRenderConcurrency(undefined)).toEqual([]);
  });

  it("renders only the declared evidence window when a frame range is supplied", () => {
    expect(resolveMaulRenderFrameRange({startFrame: 0, endFrame: 119})).toEqual([
      "--frames=0-119",
    ]);
  });

  it("stages every verified Martin alpha foreground before Remotion starts", () => {
    expect(resolveMaulMartinStageAssets({
      martinDepth: {windows: [
        {windowId: "w1", foregroundAsset: {storagePath: "C:/mattes/w1.webm", sha256: "a".repeat(64)}},
        {windowId: "w2", foregroundAsset: {storagePath: "C:/mattes/w2.webm", sha256: "b".repeat(64)}},
      ]},
    } as any)).toEqual([
      {windowId: "w1", storagePath: "C:/mattes/w1.webm", sha256: "a".repeat(64)},
      {windowId: "w2", storagePath: "C:/mattes/w2.webm", sha256: "b".repeat(64)},
    ]);
  });
});
