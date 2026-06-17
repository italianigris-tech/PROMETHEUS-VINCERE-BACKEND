import React from "react";
import {describe, expect, it} from "vitest";
import {renderManifestSchema} from "@prometheus/shared-types";

import {DeviceMockup} from "../primitives/DeviceMockup.js";
import {Scene} from "./Scene.js";

const manifest = renderManifestSchema.parse({
  jobId: "scene-device",
  transcript: "PROMETHEUS",
  matteUrl: "https://example.com/matte.webm",
  audioUrl: "https://example.com/audio.m4a",
  fontUrl: "https://example.com/font.ttf",
  durationInFrames: 120,
  deviceMockup: {
    id: "hero-phone",
    deviceType: "phone",
    screen: {
      color: "#111827",
      label: "PROMETHEUS"
    }
  }
});

describe("Scene", () => {
  it("mounts a device mockup when the render manifest asks for one", () => {
    const scene = Scene({manifest, frame: 0, fps: 60});

    expect(React.isValidElement(scene)).toBe(true);
    const children = React.Children.toArray((scene as React.ReactElement).props.children);
    expect(children.some((child) => (
      React.isValidElement(child) && child.type === DeviceMockup
    ))).toBe(true);
  });
});
