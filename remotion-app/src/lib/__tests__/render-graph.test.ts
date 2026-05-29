import {describe, expect, it} from "vitest";

import {
  compileRenderGraphForWindow,
  compileRenderGraphIncrementally,
  createRenderIntervalResolver,
  getGPUFramePayload,
  type RenderGraphTimelineLayer
} from "../render-graph";

const buildLayer = (overrides: Partial<RenderGraphTimelineLayer> = {}): RenderGraphTimelineLayer => ({
  id: overrides.id ?? "layer-1",
  kind: overrides.kind ?? "creative-track",
  mediaKind: overrides.mediaKind ?? "none",
  label: overrides.label ?? "Layer 1",
  startMs: overrides.startMs ?? 0,
  endMs: overrides.endMs ?? 1000,
  zIndex: overrides.zIndex ?? 10,
  visual: overrides.visual ?? true,
  opacity: overrides.opacity ?? 1,
  transform: overrides.transform ?? {
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotateDeg: 0
  },
  easing: overrides.easing ?? {
    enter: "power2.out",
    exit: "power2.in"
  },
  styleMetadata: overrides.styleMetadata ?? {
    trackType: "text",
    title: "No frame maps"
  }
});

describe("detached render graph", () => {
  it("compiles timeline layers into interval instructions and resolves only active intervals", () => {
    const graph = compileRenderGraphForWindow({
      fps: 30,
      layers: [
        buildLayer({id: "intro", startMs: 0, endMs: 1000, zIndex: 10}),
        buildLayer({id: "later", startMs: 2000, endMs: 2600, zIndex: 20})
      ],
      focusFrame: 0,
      windowSeconds: 10
    });

    expect(graph.intervals).toHaveLength(2);
    expect(graph.intervals[0]).toMatchObject({
      sourceLayerId: "intro",
      startFrame: 0,
      endFrame: 30,
      type: "text",
      state: {
        opacity: 1,
        motionPreset: "power2.out"
      }
    });
    expect(Object.keys(graph)).not.toContain("frameMap");

    const resolver = createRenderIntervalResolver(graph);
    expect(resolver.resolveFrame(0).map((interval) => interval.sourceLayerId)).toEqual(["intro"]);
    expect(resolver.resolveFrame(45)).toEqual([]);
    expect(resolver.resolveFrame(66).map((interval) => interval.sourceLayerId)).toEqual(["later"]);
  });

  it("compiles only the focused playback window before deferred work", () => {
    const graph = compileRenderGraphForWindow({
      fps: 30,
      layers: [
        buildLayer({id: "behind", startMs: 0, endMs: 1000}),
        buildLayer({id: "focused", startMs: 12_000, endMs: 13_000}),
        buildLayer({id: "ahead", startMs: 26_000, endMs: 27_000})
      ],
      focusFrame: 12 * 30,
      windowSeconds: 10
    });

    expect(graph.intervals.map((interval) => interval.sourceLayerId)).toEqual(["focused"]);
    expect(graph.window).toEqual({
      startFrame: 60,
      endFrame: 660
    });
  });

  it("runs the current window synchronously and defers the rest through the scheduler", async () => {
    const scheduled: Array<() => void> = [];
    const snapshots: string[][] = [];

    const job = compileRenderGraphIncrementally({
      fps: 30,
      layers: [
        buildLayer({id: "focused", startMs: 12_000, endMs: 13_000}),
        buildLayer({id: "rest-1", startMs: 26_000, endMs: 27_000}),
        buildLayer({id: "rest-2", startMs: 40_000, endMs: 41_000})
      ],
      focusFrame: 12 * 30,
      windowSeconds: 10,
      chunkSize: 1,
      schedule: (work) => {
        scheduled.push(work);
        return () => undefined;
      },
      onGraph: (graph) => {
        snapshots.push(graph.intervals.map((interval) => interval.sourceLayerId));
      }
    });

    expect(snapshots).toEqual([["focused"]]);
    expect(scheduled).toHaveLength(1);

    scheduled.shift()?.();
    expect(snapshots).toEqual([["focused"], ["focused", "rest-1"]]);
    expect(scheduled).toHaveLength(1);

    scheduled.shift()?.();
    expect(snapshots).toEqual([["focused"], ["focused", "rest-1"], ["focused", "rest-1", "rest-2"]]);

    job.cancel();
  });

  it("exposes a future GPU payload without doing GPU work", () => {
    const graph = compileRenderGraphForWindow({
      fps: 30,
      layers: [
        buildLayer({
          id: "camera",
          kind: "motion-scene",
          mediaKind: "none",
          visual: false,
          startMs: 0,
          endMs: 1000,
          zIndex: 1,
          transform: {
            translateX: 10,
            translateY: -4,
            scale: 1.08,
            rotateDeg: 0
          }
        }),
        buildLayer({id: "overlay", mediaKind: "image", startMs: 0, endMs: 1000, zIndex: 5})
      ],
      focusFrame: 15,
      windowSeconds: 10
    });

    const payload = getGPUFramePayload(graph, 15);

    expect(payload.layers).toEqual([
      expect.objectContaining({
        sourceLayerId: "overlay",
        depth: 5,
        opacity: expect.any(Number),
        transform: expect.objectContaining({
          translateX: expect.any(Number),
          translateY: expect.any(Number),
          scale: expect.any(Number),
          rotateDeg: expect.any(Number)
        })
      })
    ]);
    expect(payload.camera).toEqual(expect.objectContaining({
      sourceLayerId: "camera",
      transform: expect.objectContaining({
        scale: expect.any(Number)
      })
    }));
    expect(payload).not.toHaveProperty("shader");
    expect(payload).not.toHaveProperty("canvas");
  });
});
