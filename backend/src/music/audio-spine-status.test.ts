import {describe, expect, it} from "vitest";

import {isLiveJosephAudioModule, JOSEPH_AUDIO_SPINE_STATUS} from "./audio-spine-status";

describe("Joseph audio spine status", () => {
  it("promotes the video-aware DJ planner into the Joseph production path", () => {
    expect(JOSEPH_AUDIO_SPINE_STATUS.livePath.every((lane) => lane.status === "live")).toBe(true);
    expect(JOSEPH_AUDIO_SPINE_STATUS.livePath.map((lane) => lane.module)).toEqual([
      "backend/src/upload/joseph-upload-pipeline.ts",
      "backend/src/music/video-aware-planner/build-video-aware-audio-plan.ts",
      "backend/src/audio/mix-audio.ts",
    ]);
    expect(JOSEPH_AUDIO_SPINE_STATUS.dryRunOnly.map((lane) => lane.module)).not.toContain(
      "backend/src/music/video-aware-planner/build-video-aware-audio-plan.ts",
    );
    expect(JOSEPH_AUDIO_SPINE_STATUS.dryRunOnly.every((lane) => lane.status === "dry_run_only")).toBe(true);
    expect(isLiveJosephAudioModule("backend/src/upload/joseph-upload-pipeline.ts")).toBe(true);
    expect(isLiveJosephAudioModule("backend/src/music/video-aware-planner/build-video-aware-audio-plan.ts")).toBe(true);
    expect(isLiveJosephAudioModule("backend/src/audio/mix-audio.ts")).toBe(true);
    expect(isLiveJosephAudioModule("backend/src/music/renderer/mix-renderer.ts")).toBe(false);
  });
});
