import {execFile} from "node:child_process";
import {z} from "zod";

const ffprobeSchema = z.object({
  streams: z.array(
    z.object({
      codec_type: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
      avg_frame_rate: z.string().optional(),
      r_frame_rate: z.string().optional(),
      codec_name: z.string().optional()
    })
  ),
  format: z.object({
    duration: z.string().optional(),
    bit_rate: z.string().optional(),
    format_name: z.string().optional()
  })
});

export type VideoProbeResult = {
  width: number;
  height: number;
  fps: number;
  duration_seconds: number;
  duration_in_frames: number;
  codec_video?: string;
  container_format?: string;
  bitrate_video?: number;
};

const parseFps = (value: string | undefined): number => {
  if (!value) {
    return 30;
  }

  const [numRaw, denRaw] = value.split("/");
  const numerator = Number(numRaw);
  const denominator = Number(denRaw ?? "1");
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 30;
  }
  return numerator / denominator;
};

export const probeVideoMetadata = async (videoPath: string): Promise<VideoProbeResult> => {
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      videoPath
    ], (error, output) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(output);
    });
  });

  const parsed = ffprobeSchema.parse(JSON.parse(stdout) as unknown);
  const videoStream = parsed.streams.find((stream) => stream.codec_type === "video");
  if (!videoStream?.width || !videoStream?.height) {
    throw new Error("Could not resolve video stream metadata from ffprobe output.");
  }

  const fps = parseFps(videoStream.avg_frame_rate || videoStream.r_frame_rate);
  const durationSeconds = Number(parsed.format.duration ?? "0");

  return {
    width: videoStream.width,
    height: videoStream.height,
    fps,
    duration_seconds: durationSeconds,
    duration_in_frames: Math.max(1, Math.round(durationSeconds * fps)),
    codec_video: videoStream.codec_name,
    container_format: parsed.format.format_name,
    bitrate_video: parsed.format.bit_rate ? Number(parsed.format.bit_rate) : undefined
  };
};
