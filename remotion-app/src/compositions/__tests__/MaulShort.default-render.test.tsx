import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

vi.mock("@remotion/media", async () => {
  const ReactModule = await import("react");
  return {
    Audio: ({src}: any) => ReactModule.createElement("audio", {src}),
    Video: ({src}: any) => ReactModule.createElement("video", {src}),
  };
});

vi.mock("remotion", async () => {
  const actual = await vi.importActual<any>("remotion");
  const ReactModule = await import("react");
  const Passthrough = ({children}: any) => ReactModule.createElement("div", {}, children);

  return {
    ...actual,
    AbsoluteFill: Passthrough,
    Sequence: Passthrough,
    staticFile: (asset: string) => asset,
    useCurrentFrame: () => 0,
    useVideoConfig: () => ({fps: 30, width: 1080, height: 1920}),
  };
});

import {MAUL_SHORT_DEFAULT_PROPS, MaulShort} from "../MaulShort";

describe("MAUL registered default render", () => {
  it("renders the legacy studio fixture without requiring V3 plan fields", () => {
    const render = () =>
      renderToStaticMarkup(<MaulShort {...MAUL_SHORT_DEFAULT_PROPS} />);

    expect(render).not.toThrow();
    expect(render()).not.toContain("<audio");
  });
});
