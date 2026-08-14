import path from "node:path";
import fs from "node:fs/promises";

export const basenameAnyPlatform = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.at(-1) ?? "";
};

export const extnameAnyPlatform = (filePath: string): string => {
  const fileName = basenameAnyPlatform(filePath);
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index) : "";
};

/**
 * Converts a path to an extended-length UNC path on Windows (\\\\?\\C:\\...)
 * Bypasses Win32 260-character MAX_PATH limit and Windows path parsing locks.
 */
export const toUncPath = (filePath: string): string => {
  if (!filePath || process.platform !== "win32") return filePath;
  const resolved = path.resolve(filePath);
  if (resolved.startsWith("\\\\?\\")) return resolved;
  if (resolved.startsWith("\\\\")) {
    return `\\\\?\\UNC\\${resolved.slice(2)}`;
  }
  return `\\\\?\\${resolved}`;
};

/**
 * Removes a file or directory with exponential backoff retries to handle Windows EBUSY / EPERM file locks.
 */
export const rmWithRetry = async (
  targetPath: string,
  maxRetries = 6,
  initialDelayMs = 200
): Promise<void> => {
  const safePath = toUncPath(targetPath);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.rm(safePath, { recursive: true, force: true });
      return;
    } catch (error: any) {
      const isLockError =
        error?.code === "EBUSY" ||
        error?.code === "EPERM" ||
        error?.code === "ENOTEMPTY" ||
        error?.code === "EACCES";
      if (!isLockError || attempt === maxRetries) {
        throw error;
      }
      const delay = initialDelayMs * Math.pow(1.8, attempt - 1);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

