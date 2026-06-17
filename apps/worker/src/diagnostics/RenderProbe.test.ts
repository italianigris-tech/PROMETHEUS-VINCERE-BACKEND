import {describe, expect, it} from "vitest";

import {
  RenderProbe,
  type RenderGraphNode
} from "./RenderProbe.js";

const deviceNode: RenderGraphNode = {
  id: "device-hero",
  type: "device-mockup",
  payload: {
    deviceType: "phone",
    screen: {
      kind: "solid",
      color: "#2563eb"
    }
  }
};

describe("RenderProbe", () => {
  it("downgrades a device mockup when the worker cannot render the primitive", () => {
    const probe = new RenderProbe({capabilities: ["background-video"]});

    const result = probe.probe(deviceNode);

    expect(result.canRender).toBe(false);
    expect(result.missingCapabilities).toEqual(["device-mockup-primitive"]);
    expect(result.suggestedDowngrade).toMatchObject({
      type: "background-video",
      payload: {
        downgradeReason: "missing:device-mockup-primitive",
        originalType: "device-mockup"
      }
    });
    expect(result.estimatedCost.drawCalls).toBeGreaterThan(0);
  });

  it("accepts a device mockup when the worker advertises the primitive", () => {
    const probe = new RenderProbe({capabilities: ["device-mockup-primitive"]});

    const result = probe.probe(deviceNode);

    expect(result).toMatchObject({
      canRender: true,
      missingCapabilities: [],
      suggestedDowngrade: null
    });
  });
});
