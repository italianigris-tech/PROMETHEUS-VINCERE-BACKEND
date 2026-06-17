import React from "react";
import {describe, expect, it} from "vitest";

import {
  DeviceMockup,
  normalizeDeviceMockupConfig,
  estimateDeviceMockupCost,
  type DeviceMockupConfig
} from "./DeviceMockup.js";

const phoneConfig = {
  id: "hero-phone",
  deviceType: "phone",
  position: [1, 2, 3],
  rotation: [0.1, 0.2, 0.3],
  scale: 1.25,
  screen: {
    color: "#2563eb",
    label: "PROMETHEUS"
  }
} satisfies DeviceMockupConfig;

describe("DeviceMockup primitive", () => {
  it("normalizes phone geometry and screen content without touching WebGL", () => {
    const resolved = normalizeDeviceMockupConfig(phoneConfig);

    expect(resolved).toMatchObject({
      id: "hero-phone",
      deviceType: "phone",
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
      scale: 1.25,
      dimensions: {
        width: 2.15,
        height: 4.35,
        depth: 0.18
      },
      screen: {
        color: "#2563eb",
        label: "PROMETHEUS"
      }
    });
  });

  it("rejects unsupported device types at the primitive seam", () => {
    expect(() => normalizeDeviceMockupConfig({
      ...phoneConfig,
      deviceType: "watch"
    } as unknown as DeviceMockupConfig)).toThrow(/Unsupported device mockup type: watch/);
  });

  it("exports a React component that renders through the primitive interface", () => {
    const element = React.createElement(DeviceMockup, {config: phoneConfig});

    expect(element.type).toBe(DeviceMockup);
    expect(element.props.config).toBe(phoneConfig);
  });

  it("estimates render cost for the planner and RenderProbe", () => {
    expect(estimateDeviceMockupCost(phoneConfig)).toEqual({
      drawCalls: 5,
      geometries: 5,
      materials: 5,
      textureTargets: 0,
      estimatedFillPixels: 304920
    });
  });
});
