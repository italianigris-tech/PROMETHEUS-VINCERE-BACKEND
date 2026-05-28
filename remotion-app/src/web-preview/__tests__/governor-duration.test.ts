import {describe, expect, it} from "vitest";

import {resolveAudioCreativePreviewDurationMs} from "../audio-creative-preview-session";

describe("governor duration", () => {
  it("returns 60000ms when all duration probes fail", () => {
    expect(resolveAudioCreativePreviewDurationMs({
      providedDurationMs: null,
      creativeTimelineDurationMs: null,
      lastTrackEndMs: null,
      lastCaptionEndMs: null,
      fallbackDurationMs: null
    })).toBe(60000);
  });

  it("uses a preview-safe fallback instead of collapsing to a single-frame floor when duration is zero", () => {
    expect(resolveAudioCreativePreviewDurationMs({
      providedDurationMs: 0,
      creativeTimelineDurationMs: null,
      lastTrackEndMs: null,
      lastCaptionEndMs: null,
      fallbackDurationMs: null
    })).toBe(60000);
  });

  it("returns a valid provided duration without clamping to 1000ms", () => {
    expect(resolveAudioCreativePreviewDurationMs({
      providedDurationMs: 125000,
      creativeTimelineDurationMs: null,
      lastTrackEndMs: null,
      lastCaptionEndMs: null,
      fallbackDurationMs: null
    })).toBe(125000);
  });
});
