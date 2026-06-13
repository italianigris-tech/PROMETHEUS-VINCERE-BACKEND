import {execFile} from "node:child_process";
import {mkdir} from "node:fs/promises";
import path from "node:path";

import type {TranscriptChunkPlan} from "./transcript";

const seconds = (ms: number): string => (ms / 1000).toFixed(3);

export const extractAudioChunkWithFfmpeg = async ({
  sourcePath,
  outputDir,
  chunk
}: {
  sourcePath: string;
  outputDir: string;
  chunk: TranscriptChunkPlan;
}): Promise<string> => {
  await mkdir(outputDir, {recursive: true});
  const outputPath = path.join(outputDir, `${chunk.id}.wav`);
  const durationMs = Math.max(1, chunk.endMs - chunk.startMs);

  await new Promise<void>((resolve, reject) => {
    execFile(
      "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        seconds(chunk.startMs),
        "-t",
        seconds(durationMs),
        "-i",
        sourcePath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        outputPath
      ],
      {windowsHide: true},
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`Audio chunk extraction failed for ${chunk.id}: ${stderr || error.message}`));
          return;
        }
        resolve();
      }
    );
  });

  return outputPath;
};
