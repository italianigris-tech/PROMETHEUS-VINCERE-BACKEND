import path from "node:path";

import type {MaulNormalizedBox} from "@prometheus/shared-types";

import {runFfmpegBufferCommand} from "../sound-engine/ffmpeg.js";
import {resolveRepositoryMediaTool} from "./repository-media-tools.js";

export type SceneBackgroundLuminanceGrid = {
  columns: number;
  rows: number;
  samples: readonly number[];
};

const GRID_COLUMNS = 12;
const GRID_ROWS = 20;

const srgbToLinear = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const rgbLuminance = (red: number, green: number, blue: number): number =>
  0.2126 * srgbToLinear(red) +
  0.7152 * srgbToLinear(green) +
  0.0722 * srgbToLinear(blue);

export const decodeRgbLuminanceGrid = ({
  bytes,
  columns = GRID_COLUMNS,
  rows = GRID_ROWS,
}: {
  bytes: Buffer;
  columns?: number;
  rows?: number;
}): SceneBackgroundLuminanceGrid => {
  const expectedLength = columns * rows * 3;
  if (bytes.length !== expectedLength) {
    throw new Error(
      `Background luminance sampler returned ${bytes.length} RGB bytes; expected ${expectedLength}.`,
    );
  }
  const samples = Array.from({length: columns * rows}, (_value, index) =>
    Number(
      rgbLuminance(
        bytes[index * 3]!,
        bytes[index * 3 + 1]!,
        bytes[index * 3 + 2]!,
      ).toFixed(4),
    ),
  );
  return {columns, rows, samples};
};

export const sampleSceneBackgroundLuminance = async ({
  sourcePath,
  sourceMs,
  sourceCrop,
  ffmpegBinary,
}: {
  sourcePath: string;
  sourceMs: number;
  sourceCrop: MaulNormalizedBox;
  ffmpegBinary: string;
}): Promise<SceneBackgroundLuminanceGrid> => {
  const cropFilter = [
    `crop=iw*${sourceCrop.width}:ih*${sourceCrop.height}:iw*${sourceCrop.x}:ih*${sourceCrop.y}`,
    `scale=${GRID_COLUMNS}:${GRID_ROWS}:flags=area`,
    "format=rgb24",
  ].join(",");
  const result = await runFfmpegBufferCommand(
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      (sourceMs / 1000).toFixed(3),
      "-i",
      sourcePath,
      "-frames:v",
      "1",
      "-vf",
      cropFilter,
      "-f",
      "image2pipe",
      "-vcodec",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ],
    {binary: ffmpegBinary},
  );
  return decodeRgbLuminanceGrid({bytes: result.stdout});
};

export const createRepositorySceneBackgroundLuminanceSampler = ({
  repoRoot = path.resolve(process.cwd(), ".."),
}: {
  repoRoot?: string;
} = {}) => async (input: {
  sourcePath: string;
  sourceMs: number;
  sourceCrop: MaulNormalizedBox;
}): Promise<SceneBackgroundLuminanceGrid> => {
  const receipt = await resolveRepositoryMediaTool({tool: "ffmpeg", repoRoot});
  if (receipt.status !== "available") throw new Error(receipt.reason);
  return sampleSceneBackgroundLuminance({
    ...input,
    ffmpegBinary: receipt.executablePath,
  });
};
