import {describe, expect, it, vi} from "vitest";

const execFileMock = vi.fn((_: string, __: string[], callback: (error: Error | null, stdout: string, stderr: string) => void) => {
  callback(null, JSON.stringify({
    streams: [
      {
        codec_type: "video",
        width: 1920,
        height: 1080,
        avg_frame_rate: "30/1"
      }
    ],
    format: {
      duration: "10"
    }
  }), "");
});

vi.mock("node:child_process", () => ({
  execFile: execFileMock
}));

describe("ffprobe arg safety", () => {
  it("uses execFile with an array argument list", async () => {
    const {probeVideoMetadata} = await import("../ffprobe");

    await probeVideoMetadata("C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING\\clip with spaces, commas.mp4");

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock).toHaveBeenCalledWith(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        "C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING\\clip with spaces, commas.mp4"
      ],
      expect.any(Function)
    );
  });
});
