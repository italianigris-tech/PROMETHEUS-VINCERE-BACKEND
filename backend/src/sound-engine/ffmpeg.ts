import {spawn} from "node:child_process";
import path from "node:path";
import {promisify} from "node:util";

import {execFile} from "node:child_process";

import type {SoundDesignCapabilityFlags} from "./types";

const execFileAsync = promisify(execFile);

export type FfmpegExecutionOptions = {
  cwd?: string;
  logCommand?: (command: string) => void;
  binary?: string;
};

export type FfmpegExecutionResult = {
  stdout: string;
  stderr: string;
  code: number;
};

export type FfmpegBufferExecutionResult = {
  stdout: Buffer;
  stderr: string;
  code: number;
};

let cachedCapabilitiesPromise: Promise<SoundDesignCapabilityFlags> | null = null;

const quoteArg = (value: string): string => {
  if (value.length === 0) {
    return '""';
  }
  if (!/[\s"'`]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
};

export const formatFfmpegCommand = (args: string[], binary = "ffmpeg"): string => {
  return [binary, ...args].map(quoteArg).join(" ");
};

export const resolveFfmpegPath = (filePath: string): string => {
  return path.resolve(filePath);
};

export const runFfmpegCommand = async (
  args: string[],
  options: FfmpegExecutionOptions = {}
): Promise<FfmpegExecutionResult> => {
  const binary = options.binary ?? "ffmpeg";
  options.logCommand?.(formatFfmpegCommand(args, binary));

  return await new Promise<FfmpegExecutionResult>((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          stdout,
          stderr,
          code: 0
        });
        return;
      }

      reject(new Error(`${binary} exited with code ${code ?? -1}.\n${stderr}`));
    });
  });
};

export const runFfmpegBufferCommand = async (
  args: string[],
  options: FfmpegExecutionOptions = {}
): Promise<FfmpegBufferExecutionResult> => {
  const binary = options.binary ?? "ffmpeg";
  options.logCommand?.(formatFfmpegCommand(args, binary));

  return await new Promise<FfmpegBufferExecutionResult>((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdoutChunks: Buffer[] = [];
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutChunks.push(Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          stdout: Buffer.concat(stdoutChunks),
          stderr,
          code: 0
        });
        return;
      }

      reject(new Error(`${binary} exited with code ${code ?? -1}.\n${stderr}`));
    });
  });
};

export const probeFfmpegCapabilities = async (): Promise<SoundDesignCapabilityFlags> => {
  if (!cachedCapabilitiesPromise) {
    cachedCapabilitiesPromise = (async () => {
      const {stdout} = await execFileAsync("ffmpeg", ["-hide_banner", "-filters"], {
        maxBuffer: 4 * 1024 * 1024
      });

      const hasFilter = (name: string): boolean => new RegExp(`\\b${name}\\b`).test(stdout);
      return {
        afir: hasFilter("afir"),
        rubberband: hasFilter("rubberband"),
        loudnorm: hasFilter("loudnorm"),
        alimiter: hasFilter("alimiter"),
        sidechaincompress: hasFilter("sidechaincompress"),
        showwavespic: hasFilter("showwavespic")
      };
    })();
  }

  return cachedCapabilitiesPromise;
};

export const probeMediaDurationSeconds = async (filePath: string): Promise<number | null> => {
  try {
    const {stdout} = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=nokey=1:noprint_wrappers=1",
      filePath
    ], {
      maxBuffer: 1024 * 1024
    });
    const value = Number(stdout.trim());
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};
