import {z} from "zod";

const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;
const POSIX_ABSOLUTE_PATH = /^\//;
const UNC_ABSOLUTE_PATH = /^\\\\[^\\]+\\[^\\]+/;

export const isBrowserSafeMediaUrl = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  if (/^file:\/\//i.test(normalized)) {
    return false;
  }
  if (WINDOWS_ABSOLUTE_PATH.test(normalized) || UNC_ABSOLUTE_PATH.test(normalized)) {
    return false;
  }
  if (/^https?:\/\//i.test(normalized)) {
    return true;
  }
  return normalized.startsWith("/") && !normalized.startsWith("//");
};

export const isAbsoluteMediaFilePath = (value: string): boolean => {
  const normalized = value.trim();
  return WINDOWS_ABSOLUTE_PATH.test(normalized)
    || POSIX_ABSOLUTE_PATH.test(normalized)
    || UNC_ABSOLUTE_PATH.test(normalized);
};

export const MediaReferenceSchema = z.object({
  assetId: z.string().min(1),
  browserUrl: z.string().min(1).refine(isBrowserSafeMediaUrl, {
    message: "browserUrl must be an HTTP(S) URL or root-relative URL, not file:// or a local filesystem path",
  }),
  filePath: z.string().min(1).refine(isAbsoluteMediaFilePath, {
    message: "filePath must be absolute for FFmpeg",
  }),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
});

export type MediaReference = z.infer<typeof MediaReferenceSchema>;

export interface AssetResolver {
  registerUpload(sourcePath: string, jobId: string): Promise<MediaReference> | MediaReference;
  resolveBrowser(assetId: string): string;
  resolveFile(assetId: string): string;
}
