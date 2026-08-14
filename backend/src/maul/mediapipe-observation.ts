import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync} from "node:fs";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {z} from "zod";

import {
  createProductionStageTimer,
  maulProductionStageReceiptSchema,
} from "./production-proof-contract.js";
import {resolveRepositoryMediaTool} from "./repository-media-tools.js";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);

const normalizedBoxSchema = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().positive().max(1),
    height: z.number().finite().positive().max(1),
  })
  .strict()
  .superRefine((box, ctx) => {
    if (box.x + box.width > 1.000001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["width"],
        message: "Normalized observation boxes cannot exceed frame width.",
      });
    }
    if (box.y + box.height > 1.000001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["height"],
        message: "Normalized observation boxes cannot exceed frame height.",
      });
    }
  });

const luminanceGridSchema = z
  .object({
    columns: z.literal(12),
    rows: z.literal(20),
    samples: z.array(z.number().finite().min(0).max(1)).length(240),
  })
  .strict();

export const maulMediaObservationPayloadSchema = z
  .object({
    schemaVersion: z.literal("maul-media-observation/v1"),
    sourceSha256: sha256Schema,
    detector: z
      .object({
        providerId: z.literal("mediapipe_opencv"),
        mediapipeVersion: z.string().trim().min(1),
        opencvVersion: z.string().trim().min(1),
        configurationSha256: sha256Schema,
        performance: z.object({
          sampledFrameCount: z.number().int().positive(),
          poseInferenceFrameCount: z.number().int().positive(),
          ffmpegReadMs: z.number().nonnegative(),
          faceInferenceMs: z.number().nonnegative(),
          poseInferenceMs: z.number().nonnegative(),
          postProcessMs: z.number().nonnegative(),
          totalStageMs: z.number().nonnegative(),
        }).strict().optional(),
      })
      .strict(),
    frames: z
      .array(
        z
          .object({
            sourceMs: z.number().int().nonnegative(),
            faceBox: normalizedBoxSchema.nullable(),
            poseLandmarks: z.array(
              z
                .object({
                  name: z.string().trim().min(1),
                  x: z.number().finite().min(0).max(1),
                  y: z.number().finite().min(0).max(1),
                  confidence: z.number().finite().min(0).max(1),
                })
                .strict(),
            ),
            subjectBox: normalizedBoxSchema.nullable(),
            luminanceGrid: luminanceGridSchema,
          })
          .strict(),
      )
      .min(1),
    missingSpans: z.array(
      z
        .object({
          startMs: z.number().int().nonnegative(),
          endMs: z.number().int().positive(),
          reason: z.string().trim().min(1),
        })
        .strict()
        .refine((span) => span.endMs > span.startMs, {
          message: "Observation missing spans require positive duration.",
        }),
    ),
  })
  .strict()
  .superRefine((observation, ctx) => {
    observation.frames.forEach((frame, index) => {
      const previous = observation.frames[index - 1];
      if (previous && frame.sourceMs <= previous.sourceMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["frames", index, "sourceMs"],
          message: "Observation frames must have ordered unique timestamps.",
        });
      }
    });
  });

export const maulMediaObservationResultSchema =
  maulMediaObservationPayloadSchema.extend({
    receipt: maulProductionStageReceiptSchema,
  });

export type MaulMediaObservationPayload = z.infer<
  typeof maulMediaObservationPayloadSchema
>;
export type MaulMediaObservationResult = z.infer<
  typeof maulMediaObservationResultSchema
>;

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDirectory, "../../..");
const defaultObservationScript = path.resolve(
  currentDirectory,
  "../../../packages/trajectory-extractor/maul_observe.py",
);

const installedWindowsVisionPython = process.env.LOCALAPPDATA
  ? path.join(
      process.env.LOCALAPPDATA,
      "Prometheus",
      "maul-vision-py311",
      "Scripts",
      "python.exe",
    )
  : null;

export const isMaulMediaObservationRuntimeConfigured = (): boolean =>
  Boolean(process.env.MAUL_MEDIAPIPE_PYTHON_BIN?.trim()) ||
  Boolean(installedWindowsVisionPython && existsSync(installedWindowsVisionPython));

export const resolveMaulMediaObservationPythonBin = (): string =>
  process.env.MAUL_MEDIAPIPE_PYTHON_BIN?.trim() ||
  (installedWindowsVisionPython && existsSync(installedWindowsVisionPython)
    ? installedWindowsVisionPython
    : process.platform === "win32"
      ? "python"
      : "python3");

const sha256 = (value: Buffer | string): string =>
  createHash("sha256").update(value).digest("hex");

const runObservationProcess = async ({
  pythonBin,
  observationScript,
  args,
}: {
  pythonBin: string;
  observationScript: string;
  args: string[];
}): Promise<{stdout: string; stderr: string}> =>
  new Promise((resolve, reject) => {
    execFile(
      pythonBin,
      [observationScript, ...args],
      {
        windowsHide: true,
        timeout: 60_000,
        maxBuffer: 16 * 1024 * 1024,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = (stderr || error.message).trim().slice(0, 2_000);
          reject(
            new Error(
              `MAUL MediaPipe observation subprocess failed: ${detail || "unknown failure"}`,
            ),
          );
          return;
        }
        resolve({stdout, stderr});
      },
    );
  });

export const runMaulMediaObservation = async ({
  sourcePath,
  durationMs,
  outputWidth,
  outputHeight,
  sampleEveryFrames,
  poseEverySamples = 2,
  pythonBin = resolveMaulMediaObservationPythonBin(),
  observationScript = defaultObservationScript,
  ffmpegBin,
}: {
  sourcePath: string;
  durationMs: number;
  outputWidth: number;
  outputHeight: number;
  sampleEveryFrames: number;
  poseEverySamples?: number;
  pythonBin?: string;
  observationScript?: string;
  ffmpegBin?: string;
}): Promise<MaulMediaObservationResult> => {
  if (!Number.isInteger(durationMs) || durationMs <= 0) {
    throw new Error("MAUL MediaPipe observation requires positive integer durationMs.");
  }
  if (!Number.isInteger(outputWidth) || outputWidth <= 0) {
    throw new Error("MAUL MediaPipe observation requires positive integer outputWidth.");
  }
  if (!Number.isInteger(outputHeight) || outputHeight <= 0) {
    throw new Error("MAUL MediaPipe observation requires positive integer outputHeight.");
  }
  if (!Number.isInteger(sampleEveryFrames) || sampleEveryFrames <= 0) {
    throw new Error("MAUL MediaPipe observation requires positive sampleEveryFrames.");
  }
  if (!Number.isInteger(poseEverySamples) || poseEverySamples <= 0) {
    throw new Error("MAUL MediaPipe observation requires positive poseEverySamples.");
  }

  const ffmpegReceipt = ffmpegBin?.trim()
    ? {status: "available" as const, executablePath: ffmpegBin.trim()}
    : await resolveRepositoryMediaTool({
        tool: "ffmpeg",
        repoRoot,
        preferGlobalPath: true,
      });
  if (ffmpegReceipt.status !== "available") {
    throw new Error(ffmpegReceipt.reason);
  }

  const sourceBytes = await readFile(sourcePath);
  if (sourceBytes.length === 0) {
    throw new Error("MAUL MediaPipe observation source media is empty.");
  }
  const sourceSha256 = sha256(sourceBytes);
  const configuration = {
    durationMs,
    outputWidth,
    outputHeight,
    sampleEveryFrames,
    poseEverySamples,
  };
  const inputSha256 = sha256(
    JSON.stringify({sourceSha256, configuration}),
  );
  const timer = createProductionStageTimer("media_observation");
  const {stdout} = await runObservationProcess({
    pythonBin,
    observationScript,
    args: [
      "--source",
      sourcePath,
      "--duration-ms",
      String(durationMs),
      "--output-width",
      String(outputWidth),
      "--output-height",
      String(outputHeight),
      "--sample-every-frames",
      String(sampleEveryFrames),
      "--pose-every-samples",
      String(poseEverySamples),
      "--ffmpeg-bin",
      ffmpegReceipt.executablePath,
    ],
  });

  let parsedJson: unknown;
  try {
    const payloadLine = stdout.trim().split(/\r?\n/u).at(-1) ?? "";
    parsedJson = JSON.parse(payloadLine);
  } catch (error) {
    throw new Error(
      `MAUL MediaPipe observation output was not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const payload = maulMediaObservationPayloadSchema.parse(parsedJson);
  if (payload.sourceSha256.toLowerCase() !== sourceSha256) {
    throw new Error(
      "MAUL MediaPipe observation source hash does not match the inspected media.",
    );
  }
  const outputSha256 = sha256(JSON.stringify(payload));
  return maulMediaObservationResultSchema.parse({
    ...payload,
    receipt: timer.complete({
      cache: "miss",
      inputSha256,
      outputSha256,
      providerRequestId: null,
      bytesRead: sourceBytes.length,
      bytesWritten: Buffer.byteLength(stdout),
      warnings: payload.missingSpans.map(
        (span) =>
          `Missing MediaPipe observation from ${span.startMs}ms to ${span.endMs}ms: ${span.reason}`,
      ),
    }),
  });
};
