import {createHash, randomUUID} from "crypto";
import * as fs from "fs";
import {fileURLToPath} from "url";

export interface VariationKey {
  sourceFingerprint: string;
  promptFingerprint: string;
  uploadInstanceId: string;
  retryIndex: number;
  seed: number;
}

export interface BuildVariationKeyInput {
  sourcePath: string;
  prompt: string;
  uploadInstanceId?: string;
  retryIndex?: number;
}

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

const normalizeSourcePath = (filePath: string) => {
  if (filePath.startsWith("file://")) {
    try {
      return fileURLToPath(filePath);
    } catch {
      return filePath;
    }
  }

  return filePath;
};

export function fingerprintString(value: string): string {
  return sha256(value);
}

export function hashFileFingerprint(filePath: string): string {
  const normalizedPath = normalizeSourcePath(filePath);

  if (fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isFile()) {
    return sha256(fs.readFileSync(normalizedPath));
  }

  return fingerprintString(normalizedPath);
}

export function generateVariationKey(
  sourceVideoPath: string,
  prompt: string,
  uploadInstanceId: string = randomUUID(),
  retryIndex: number = 0,
): VariationKey {
  const sourceFingerprint = hashFileFingerprint(sourceVideoPath);
  const promptFingerprint = fingerprintString(prompt);
  const combined = fingerprintString([
    sourceFingerprint,
    promptFingerprint,
    uploadInstanceId,
    String(retryIndex),
  ].join("|"));

  return {
    sourceFingerprint,
    promptFingerprint,
    uploadInstanceId,
    retryIndex,
    seed: parseInt(combined.slice(0, 8), 16),
  };
}

export function buildVariationKey(input: BuildVariationKeyInput): VariationKey {
  return generateVariationKey(
    input.sourcePath,
    input.prompt,
    input.uploadInstanceId,
    input.retryIndex ?? 0,
  );
}
