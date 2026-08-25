import {describe, expect, test} from "vitest";

import {
  normalizeRuntimePreset,
  resolveTypographyZIndex,
  resolveSafeStageScaleX,
  resolveChunkEntranceFrame,
  resolveSceneVisualState,
  resolveWordEntranceFrames,
  unsupportedRuntimeTreatments,
} from "../PrometheusMinRun";

describe("resolveWordEntranceFrames", () => {
  test("pre-rolls each word against its own spoken timestamp", () => {
    const frames = resolveWordEntranceFrames({
      chunkStartMs: 1640,
      fps: 30,
      contentStartFrame: 8,
      leadFrames: 8,
      words: [
        {text: "videos", start_ms: 1640, end_ms: 2320},
        {text: "made", start_ms: 2400, end_ms: 2800},
        {text: "me", start_ms: 2800, end_ms: 3120},
      ],
    });

    expect(frames).toEqual([0, 23, 35]);
  });
});

describe("normalizeRuntimePreset", () => {
  test("preserves every generative typography treatment with a renderer", () => {
    expect(normalizeRuntimePreset("elegant_paraword_spring_bloom")).toBe("elegant_paraword_spring_bloom");
    expect(normalizeRuntimePreset("motion_creative_kinetic_wave_slot_engine")).toBe("motion_creative_kinetic_wave_slot_engine");
    expect(normalizeRuntimePreset("soft_pixel_blowup_mask")).toBe("soft_pixel_blowup_mask");
    expect(normalizeRuntimePreset("canva_tall_glyph_stack")).toBe("canva_tall_glyph_stack");
    expect(normalizeRuntimePreset("cinematic_distance_convergence")).toBe("cinematic_distance_convergence");
  });

  test("falls back to the restrained reveal for unknown presets", () => {
    expect(normalizeRuntimePreset("not-a-real-treatment")).toBe("subpixel_glow_mask");
  });
});

describe("runtime treatment coverage", () => {
  test("declares a realized visual variant for every selector treatment", () => {
    expect(unsupportedRuntimeTreatments()).toEqual([]);
  });
});

describe("resolveChunkEntranceFrame", () => {
  test("never emits a zero-length interpolation range for a caption with no lead-in", () => {
    expect(resolveChunkEntranceFrame(0, 1)).toBe(1);
  });
});

describe("resolveTypographyZIndex", () => {
  test("keeps a subject-safe tall stage behind the Martin foreground matte", () => {
    expect(resolveTypographyZIndex(true, "lower_right")).toBe(25);
    expect(resolveTypographyZIndex(true, undefined)).toBe(25);
    expect(resolveTypographyZIndex(false, "foreground_center")).toBe(100);
  });
});

describe("resolveSafeStageScaleX", () => {
  test("leaves safe-stage width to the selected tall-font treatment", () => {
    expect(resolveSafeStageScaleX(true, "lower_right")).toBe(1);
    expect(resolveSafeStageScaleX(true, undefined)).toBe(1);
    expect(resolveSafeStageScaleX(false, "foreground_center")).toBe(1);
  });
});

describe("resolveSceneVisualState", () => {
  const orchestration = {
    durationMs: 6000,
    scenes: [
      {id: "scene-1", startMs: 0, endMs: 3000, layout: "pan_scan" as const, focalPoint: {xPercent: 44, yPercent: 42}},
      {id: "scene-2", startMs: 3000, endMs: 6000, layout: "floating_pip" as const, focalPoint: {xPercent: 52, yPercent: 42}},
    ],
    backgrounds: [
      {id: "background-scene-2", sceneId: "scene-2", kind: "blurred_wings" as const, blurPx: 56, brightness: 0.72, counterScale: [1.05, 1] as [number, number]},
    ],
    pip: [
      {
        id: "pip-scene-2",
        sceneId: "scene-2",
        aspectRatio: 16 / 9,
        cornerRadiusPx: 22,
        microDriftScale: [1, 1.03] as [number, number],
        entryScale: [1.1, 1.055, 1] as [number, number, number],
        curve: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    ],
    transitions: [
      {id: "transition-1", startMs: 2800, endMs: 3400, peakVelocityMs: 3100, effect: "bezier_push", fromSceneId: "scene-1", toSceneId: "scene-2", causedBySceneId: "scene-2"},
    ],
    cameraMoves: [
      {id: "camera-transition-1", startMs: 2800, endMs: 3400, kind: "push_in", curve: [0.16, 1, 0.3, 1] as [number, number, number, number], overshootScale: 1.055, causedByTransitionId: "transition-1"},
    ],
  };

  test("realizes blurred wings and a bounded Bezier PiP card", () => {
    const state = resolveSceneVisualState(orchestration, 105, 30);

    expect(state.layout).toBe("floating_pip");
    expect(state.backgroundBlurPx).toBe(56);
    expect(state.pipCornerRadiusPx).toBe(22);
    expect(state.pipScale).toBeGreaterThanOrEqual(1);
    expect(state.pipScale).toBeLessThanOrEqual(1.1);
  });

  test("applies only the camera move linked to the active transition", () => {
    const state = resolveSceneVisualState(orchestration, 93, 30);

    expect(state.transitionId).toBe("transition-1");
    expect(state.cameraMoveId).toBe("camera-transition-1");
    expect(state.cameraScale).toBeGreaterThan(1);
    expect(state.cameraScale).toBeLessThanOrEqual(1.055);
  });
});
