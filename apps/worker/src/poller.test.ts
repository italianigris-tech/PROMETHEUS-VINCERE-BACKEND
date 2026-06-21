import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {pollOnce} from "./poller.js";
import {renderFromManifest} from "./index.js";

vi.mock("./index.js", () => ({
  renderFromManifest: vi.fn(),
}));

const validManifest = {
  version: "2.0",
  jobId: "123e4567-e89b-12d3-a456-426614174200",
  seed: 12345,
  createdAt: "2026-01-01T00:00:00.000Z",
  durationFrames: 90,
  fps: 30,
  width: 1080,
  height: 1920,
  videoTracks: [{sourcePath: "/uploads/job-1/source.mp4", startFrame: 0, endFrame: 89}],
  cameraMoves: [],
  textOverlays: [],
  transitions: [],
  source: {
    videoUrl: "/uploads/job-1/source.mp4",
    audioUrl: "C:/prometheus/uploads/job-1/source.mp4",
    transcript: [],
    durationMs: 3000,
    width: 1080,
    height: 1920,
    fps: 30,
  },
  audio: {
    beats: [],
    onsets: [],
    sfx: [],
    voiceVolumeDb: 0,
    musicVolumeDb: -18,
    targetLufs: -14,
  },
  timeline: [],
  creativeProfile: {
    name: "joseph_cinematic",
    cutDensity: 0.5,
    textDensity: 0.6,
    sfxDensity: 0.2,
    cameraAggression: 0.5,
    colorIntensity: 0.5,
  },
  output: {
    width: 1080,
    height: 1920,
    fps: 30,
    codec: "h264",
    crf: 18,
  },
};

describe("pollOnce", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(renderFromManifest).mockResolvedValue("C:/tmp/final.mp4");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a raw UnifiedRenderManifest and completes the job", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(validManifest), {
        status: 200,
        headers: {"Content-Type": "application/json"},
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({status: "completed"}), {
        status: 200,
        headers: {"Content-Type": "application/json"},
      }));

    const result = await pollOnce({apiBase: "http://backend.test"});

    expect(result).toBe("rendered");
    expect(renderFromManifest).toHaveBeenCalledWith(validManifest);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://backend.test/api/v1/render/jobs/123e4567-e89b-12d3-a456-426614174200/complete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({outputUrl: "C:/tmp/final.mp4"}),
      }),
    );
  });

  it("marks invalid leased manifests failed instead of retrying forever", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jobId: "123e4567-e89b-12d3-a456-426614174201",
        manifestVersion: "prometheus-render-manifest/v1",
      }), {
        status: 200,
        headers: {"Content-Type": "application/json"},
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({status: "failed"}), {
        status: 200,
        headers: {"Content-Type": "application/json"},
      }));

    const result = await pollOnce({apiBase: "http://backend.test"});

    expect(result).toBe("failed");
    expect(renderFromManifest).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://backend.test/api/v1/render/jobs/123e4567-e89b-12d3-a456-426614174201/failed",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("manifest_schema"),
      }),
    );
  });

  it("returns idle when no jobs are available", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, {status: 204}));

    await expect(pollOnce({apiBase: "http://backend.test"})).resolves.toBe("idle");
  });
});
