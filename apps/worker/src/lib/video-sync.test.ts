import {describe, expect, it} from "vitest";

import {resolveImageSequenceFrameUrl} from "./video-sync.js";

describe("image sequence frame URLs", () => {
  it("expands frame tokens using one-based, zero-padded frame numbers", () => {
    expect(resolveImageSequenceFrameUrl("/frames/frame_[frame].png", 0)).toBe("/frames/frame_0001.png");
    expect(resolveImageSequenceFrameUrl("/frames/frame_[frame].png", 24)).toBe("/frames/frame_0025.png");
  });
});
