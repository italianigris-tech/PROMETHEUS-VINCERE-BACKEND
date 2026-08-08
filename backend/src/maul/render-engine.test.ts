import {describe, expect, it} from "vitest";

import {
  resolveMaulRenderConcurrency,
  resolveMaulRenderFrameRange,
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
});
