import {beforeEach, describe, expect, it, vi} from "vitest";

let mockedStdout = "";

const execFileMock = vi.fn(
  (_command: string, _args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    callback(null, mockedStdout, "");
  }
);

vi.mock("node:child_process", () => ({
  execFile: execFileMock
}));

describe("ffprobe duration fallbacks", () => {
  beforeEach(() => {
    execFileMock.mockClear();
  });

  it("falls back to the first stream tag duration when format.duration is N/A", async () => {
    mockedStdout = JSON.stringify({
      streams: [
        {
          codec_type: "video",
          width: 1920,
          height: 1080,
          avg_frame_rate: "30/1",
          tags: {
            duration: "00:00:05.500"
          }
        }
      ],
      format: {
        duration: "N/A"
      }
    });

    const {probeVideoMetadata} = await import("../ffprobe");
    const result = await probeVideoMetadata("C:\\clips\\tag-duration.mp4");

    expect(result.duration_seconds).toBe(5.5);
    expect(result.duration_in_frames).toBe(165);
  });

  it("throws when ffprobe cannot resolve a deterministic duration", async () => {
    mockedStdout = JSON.stringify({
      streams: [
        {
          codec_type: "video",
          width: 1920,
          height: 1080,
          avg_frame_rate: "30/1",
          duration: "N/A",
          tags: {
            duration: "N/A"
          }
        }
      ],
      format: {
        duration: "N/A"
      }
    });

    const {probeVideoMetadata, resolveDurationMsFromFfprobeJson} = await import("../ffprobe");

    expect(() => resolveDurationMsFromFfprobeJson(mockedStdout)).toThrow(/MEDIA_PROBE_DETERMINISM_FAILURE/i);
    await expect(probeVideoMetadata("C:\\clips\\na-only.mp4")).rejects.toThrow(/MEDIA_PROBE_DETERMINISM_FAILURE/i);
  });
});
