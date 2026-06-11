import {describe, expect, test} from "vitest";

import {
  Badge,
  Button,
  Pill,
  buildPrimitiveAnimation,
  estimatePrimitiveRenderCost,
  resolvePrimitiveStyle,
  type PrimitiveState,
  type UiPrimitiveConfig
} from "../index.js";

const baseConfig = {
  id: "cta",
  label: "Generate",
  dimensions: {width: 3.2, height: 0.72, radius: 0.36},
  baseStyle: {
    fill: "#111827",
    stroke: "#38bdf8",
    text: "#ffffff",
    opacity: 0.92,
    strokeOpacity: 0.8,
    strokeWidth: 0.02
  },
  stateStyles: {
    hover: {fill: "#1f2937", scale: 1.04},
    active: {fill: "#0f172a", translateZ: 0.08},
    disabled: {opacity: 0.35, text: "#94a3b8"},
    loading: {text: "#bfdbfe", shimmer: 0.5},
    success: {fill: "#14532d", stroke: "#22c55e"},
    error: {fill: "#7f1d1d", stroke: "#ef4444"}
  },
  timing: {
    entranceFrame: 12,
    entranceDuration: 8,
    holdDuration: 42,
    exitDuration: 10
  },
  animation: {
    hook: "ui.primitive.pop",
    tracks: ["opacity", "scale", "position.z"]
  }
} satisfies UiPrimitiveConfig;

describe("Three.js UI primitive foundation", () => {
  test("resolves primitive styles from base and state overlays", () => {
    const style = resolvePrimitiveStyle(baseConfig, "hover");

    expect(style).toEqual({
      fill: "#1f2937",
      stroke: "#38bdf8",
      text: "#ffffff",
      opacity: 0.92,
      strokeOpacity: 0.8,
      strokeWidth: 0.02,
      scale: 1.04,
      translateZ: 0
    });
  });

  test.each<PrimitiveState>(["idle", "hover", "active", "loading", "disabled", "success", "error"])(
    "accepts %s as a typed primitive state",
    (state) => {
      const style = resolvePrimitiveStyle(baseConfig, state);

      expect(style.fill).toMatch(/^#/);
    }
  );

  test("marks disabled as dominant over interactive states", () => {
    const style = resolvePrimitiveStyle({...baseConfig, state: "hover", disabled: true});

    expect(style).toMatchObject({
      opacity: 0.35,
      text: "#94a3b8",
      fill: "#111827"
    });
  });

  test("builds deterministic frame timing metadata with entrance hold and exit phases", () => {
    const animation = buildPrimitiveAnimation(baseConfig, 20);

    expect(animation).toEqual({
      hook: "ui.primitive.pop",
      state: "idle",
      frame: 20,
      phases: {
        entrance: {from: 12, to: 20, progress: 1},
        hold: {from: 20, to: 62, progress: 0},
        exit: {from: 62, to: 72, progress: 0}
      },
      tracks: ["opacity", "scale", "position.z"]
    });
  });

  test("estimates primitive render cost without touching WebGL or the DOM", () => {
    expect(estimatePrimitiveRenderCost(baseConfig)).toEqual({
      drawCalls: 3,
      geometries: 2,
      materials: 3,
      troikaTextNodes: 1,
      transparentSurfaces: 3
    });
  });

  test("exports React Three Fiber primitive components with animation metadata defaults", () => {
    expect(Pill.uiPrimitive.kind).toBe("pill");
    expect(Badge.uiPrimitive.kind).toBe("badge");
    expect(Button.uiPrimitive.kind).toBe("button");
    expect(Button.uiPrimitive.animationHook).toBe("ui.primitive.button.press");
  });
});
