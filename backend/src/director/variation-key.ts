import {createHash} from "node:crypto";
import * as fs from "node:fs";

export interface VariationKeyInput {
  sourcePath: string;
  prompt: string;
  uploadInstanceId: string;
  retryIndex: number;
  profile?: string;
}

export interface VariationKey {
  key: string;
  sourceFingerprint: string;
  promptFingerprint: string;
  uploadInstanceId: string;
  retryIndex: number;
  profile?: string;
  source_fingerprint: string;
  prompt_fingerprint: string;
  upload_instance_id: string;
  retry_index: number;
}

const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

const normalizeFingerprintInput = (value: string): string => value.trim().replace(/\s+/g, " ");

const canonicalVariationPayload = (key: Omit<VariationKey, "key">): string =>
  JSON.stringify({
    profile: key.profile ?? null,
    promptFingerprint: key.promptFingerprint,
    retryIndex: key.retryIndex,
    sourceFingerprint: key.sourceFingerprint,
    uploadInstanceId: key.uploadInstanceId,
  });

const fileUrlToPath = (sourceVideoPath: string): string | null => {
  try {
    const url = new URL(sourceVideoPath);
    if (url.protocol !== "file:") {
      return null;
    }

    return decodeURIComponent(url.pathname.replace(/^\/([A-Za-z]:\/)/, "$1"));
  } catch {
    return null;
  }
};

export const fingerprintString = (value: string): string => sha256(normalizeFingerprintInput(value));

export const hashFileFingerprint = (sourceVideoPath: string): string => {
  const filePath = fileUrlToPath(sourceVideoPath) ?? sourceVideoPath;

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return sha256(fs.readFileSync(filePath));
  }

  return fingerprintString(sourceVideoPath);
};

export const generateVariationKey = (
  sourceVideoPath: string,
  prompt: string,
  uploadInstanceId: string,
  retryIndex: number,
  profile?: string,
): VariationKey => {
  if (!sourceVideoPath.trim()) {
    throw new Error("sourceVideoPath is required to generate a variation key");
  }

  if (!uploadInstanceId.trim()) {
    throw new Error("uploadInstanceId is required to generate a variation key");
  }

  if (!Number.isInteger(retryIndex) || retryIndex < 0) {
    throw new Error("retryIndex must be a non-negative integer");
  }

  const sourceFingerprint = hashFileFingerprint(sourceVideoPath);
  const promptFingerprint = fingerprintString(prompt);
  const withoutKey = {
    sourceFingerprint,
    promptFingerprint,
    uploadInstanceId,
    retryIndex,
    ...(profile ? {profile} : {}),
    source_fingerprint: sourceFingerprint,
    prompt_fingerprint: promptFingerprint,
    upload_instance_id: uploadInstanceId,
    retry_index: retryIndex,
  };

  return {
    key: sha256(canonicalVariationPayload(withoutKey)),
    ...withoutKey,
  };
};

export const buildVariationKey = (input: VariationKeyInput): VariationKey =>
  generateVariationKey(input.sourcePath, input.prompt, input.uploadInstanceId, input.retryIndex, input.profile);
