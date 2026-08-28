import {describe, expect, test} from "vitest";

import {
  normalizeRuntimePreset,
  resolveBehindSubjectTypographyMetrics,
  resolveTypographyZIndex,
  resolveSafeStageScaleX,
  resolveChunkEntranceFrame,
  resolvePanScanMediaStyle,
  resolveSceneVisualState,
  resolveTypographyContainerBlendMode,
  resolveTypographyContainerFilter,
  resolveTypographyPaintStyle,
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

describe("resolvePanScanMediaStyle", () => {
  test("gives source and Martin foreground one shared spatial transform", () => {
    const state = resolveSceneVisualState({
      durationMs: 3000,
      scenes: [
        {id: "scene-1", startMs: 0, endMs: 3000, layout: "pan_scan", focalPoint: {xPercent: 43, yPercent: 42}},
      ],
      backgrounds: [],
      pip: [],
      transitions: [],
      cameraMoves: [],
    }, 30, 30);

    expect(resolvePanScanMediaStyle(state)).toEqual({
      objectPosition: "43% 50%",
      transform: "scale(1)",
      transformOrigin: "center",
    });
  });
});

describe("resolveTypographyPaintStyle", () => {
  test("uses neutral white difference paint without decorative effects", () => {
    expect(resolveTypographyPaintStyle({
      blendMode: "difference",
      color: "#FF334B",
      textFillColor: "#FF334B",
      gradient: "linear-gradient(90deg, #fff, #f00)",
      glow: "0 0 10px red",
      shadow: "0 2px 8px black",
      hasGradient: true,
    })).toEqual({
      color: "#FFFFFF",
      backgroundImage: undefined,
      WebkitBackgroundClip: undefined,
      WebkitTextFillColor: undefined,
      filter: undefined,
      textShadow: undefined,
      mixBlendMode: "difference",
    });
  });

  test("preserves the normal clipped-gradient paint path", () => {
    expect(resolveTypographyPaintStyle({
      color: "#FF334B",
      textFillColor: "#FF334B",
      gradient: "linear-gradient(90deg, #fff, #f00)",
      glow: "rgba(255,255,255,0.4)",
      shadow: "0 2px 8px black",
      hasGradient: true,
    })).toEqual({
      color: undefined,
      backgroundImage: "linear-gradient(90deg, #fff, #f00)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 4px 18px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 10px rgba(255,255,255,0.4))",
      textShadow: undefined,
      mixBlendMode: undefined,
    });
  });

  test("removes the ancestor filter that would isolate difference blending", () => {
    expect(resolveTypographyContainerFilter([{blendMode: "difference"}])).toBeUndefined();
    expect(resolveTypographyContainerFilter([{blendMode: undefined}])).toBe("drop-shadow(0 4px 20px rgba(0, 0, 0, 0.85))");
    expect(resolveTypographyContainerBlendMode([{blendMode: "difference"}])).toBe("difference");
    expect(resolveTypographyContainerBlendMode([{blendMode: undefined}])).toBeUndefined();
  });
});

describe("resolveBehindSubjectTypographyMetrics", () => {
  test("dynamically scales font and proportions for generous headroom", () => {
    const metrics = resolveBehindSubjectTypographyMetrics({
      charLength: 7,
      availableHeightRatio: 0.25,
    });
    expect(metrics.fontSize).toBe(220);
    expect(metrics.scaleY).toBe(1.25);
    expect(metrics.scaleX).toBe(1.02);
  });

  test("tightens font size and vertical scale when headroom is constrained", () => {
    const metrics = resolveBehindSubjectTypographyMetrics({
      charLength: 7,
      availableHeightRatio: 0.10,
    });
    expect(metrics.fontSize).toBe(155);
    expect(metrics.scaleY).toBe(1.15);
    expect(metrics.scaleX).toBe(1.08);
  });

  test("handles short impact words with wide kerning and balanced scaling", () => {
    const metrics = resolveBehindSubjectTypographyMetrics({
      charLength: 4,
      availableHeightRatio: 0.15,
    });
    expect(metrics.fontSize).toBe(220);
    expect(metrics.scaleY).toBe(1.25);
    expect(metrics.scaleX).toBe(1.10);
    expect(metrics.letterSpacing).toBe("0.07em");
  });
});
