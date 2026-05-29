import React, {useRef} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import {
  compileRenderGraphForWindow,
  resolveEngineDriverStyle,
  useEngineDriver,
  type RenderGraphTimelineLayer
} from "../../lib/render-graph";

const layer: RenderGraphTimelineLayer = {
  id: "driver-layer",
  kind: "creative-track",
  mediaKind: "none",
  label: "Driver Layer",
  startMs: 0,
  endMs: 1000,
  zIndex: 7,
  visual: true,
  opacity: 1,
  transform: {
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotateDeg: 0
  },
  easing: {
    enter: "linear"
  },
  styleMetadata: {
    trackType: "text",
    title: "Single component"
  }
};

const graph = compileRenderGraphForWindow({
  fps: 30,
  layers: [layer],
  focusFrame: 15,
  windowSeconds: 10
});

const ExportDrivenLayer: React.FC = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const style = useEngineDriver(ref, {
    mode: "export",
    graph,
    sourceLayerId: "driver-layer",
    frame: 15
  });

  return <div ref={ref} style={style} />;
};

describe("engine driver", () => {
  it("returns deterministic React styles in export mode from the same hook", () => {
    const markup = renderToStaticMarkup(<ExportDrivenLayer />);

    expect(markup).toContain("transform:");
    expect(markup).toContain("translate3d");
    expect(markup).toContain("opacity:");
  });

  it("exposes preview mutation as a separate driver action", () => {
    const style = resolveEngineDriverStyle({
      graph,
      sourceLayerId: "driver-layer",
      frame: 15
    });
    const node = {
      style: {
        transform: "",
        opacity: "",
        willChange: "",
        backfaceVisibility: ""
      }
    } as unknown as HTMLElement;

    style.applyTo(node);

    expect(node.style.transform).toContain("translate3d");
    expect(node.style.opacity).not.toBe("");
    expect(node.style.willChange).toBe("transform, opacity");
    expect(node.style.backfaceVisibility).toBe("hidden");
  });

  it("does not require separate preview and export components", () => {
    const source = useEngineDriver.toString();

    expect(source).toContain("\"preview\"");
    expect(source).toContain("\"export\"");
    expect(vi.isMockFunction(useEngineDriver)).toBe(false);
  });
});
