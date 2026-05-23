import path from "node:path";
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

const DEFAULT_DURATION_MS = 60000;

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

const parseTimeTag = (timeStr: string | null | undefined): number | null => {
  // Handles HH:MM:SS.ms or simple seconds
  if (!timeStr || timeStr === "N/A") {
    return null;
  }

  if (timeStr.includes(":")) {
    const parts = timeStr.split(":").map(Number);
    if (parts.length === 3) {
      return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
  }

  const seconds = parseFloat(timeStr);
  return isNaN(seconds) ? null : seconds * 1000;
};

const extractRegexMatch = (value: string, pattern: RegExp): string | null => {
  const match = value.match(pattern);
  return match?.[1] ?? null;
};

export const resolveDurationMsFromFfprobeJson = (ffprobeJson: string): number => {
  const raw = JSON.parse(ffprobeJson) as {
    format?: {duration?: unknown};
    streams?: unknown[];
  };
  const parsed = ffprobeSchema.parse(raw);

  const formatDurationMs = parseTimeTag(parsed.format.duration);
  if (formatDurationMs && formatDurationMs > 0) {
    return formatDurationMs;
  }

  const firstStreamJson = Array.isArray(raw.streams) && raw.streams.length > 0
    ? JSON.stringify(raw.streams[0] ?? {})
    : "";
  const streamDurationMs = parseTimeTag(
    extractRegexMatch(firstStreamJson, /"duration"\s*:\s*"([^"]+)"/)
  );
  if (streamDurationMs && streamDurationMs > 0) {
    return streamDurationMs;
  }

  const streamTagDurationMs = parseTimeTag(
    extractRegexMatch(firstStreamJson, /"tags"\s*:\s*{[\s\S]*?"duration"\s*:\s*"([^"]+)"/)
  );
  if (streamTagDurationMs && streamTagDurationMs > 0) {
    return streamTagDurationMs;
  }

  return DEFAULT_DURATION_MS;
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
  const durationMs = resolveDurationMsFromFfprobeJson(stdout);

  if (durationMs === DEFAULT_DURATION_MS) {
    console.warn(`[FFPROBE] Duration resolved to N/A. Forcing 60s fallback for ${path.basename(videoPath)}`);
  }

  const durationSeconds = durationMs / 1000;

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
