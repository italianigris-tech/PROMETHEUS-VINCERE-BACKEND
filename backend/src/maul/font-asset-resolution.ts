import {createHash} from "node:crypto";
import {readFileSync, statSync} from "node:fs";
import path from "node:path";

import {
  maulResolvedFontAssetSchema,
  type MaulResolvedFontAsset,
} from "@prometheus/shared-types";

const allowedFontFormats = new Set<MaulResolvedFontAsset["format"]>([
  "ttf",
  "otf",
  "woff",
  "woff2",
]);

const hashFile = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const fail = (assetId: string, reason: string): never => {
  throw new Error(`MAUL font asset ${assetId} ${reason}.`);
};

const normalizeBrowserPath = (asset: MaulResolvedFontAsset): string => {
  const browserUrl = asset.browserUrl.trim();
  if (!browserUrl || !browserUrl.startsWith("/") || browserUrl.startsWith("//")) {
    return fail(asset.assetId, "requires a single root-relative browser URL");
  }
  if (/^(?:https?:|file:)/iu.test(browserUrl)) {
    return fail(asset.assetId, "does not accept remote or file browser URLs");
  }
  if (browserUrl.includes("?") || browserUrl.includes("#")) {
    return fail(asset.assetId, "browser URL must not contain a query or fragment");
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(browserUrl);
  } catch {
    return fail(asset.assetId, "browser URL contains invalid encoding");
  }
  const segments = decoded.split(/[\\/]+/u);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return fail(asset.assetId, "browser URL contains path traversal");
  }
  const normalized = decoded.replace(/^\/+/, "");
  if (!normalized) {
    return fail(asset.assetId, "browser URL is empty");
  }
  return normalized;
};

const resolvePublicFile = ({
  asset,
  remotionPublicDir,
}: {
  asset: MaulResolvedFontAsset;
  remotionPublicDir: string;
}): string => {
  const normalizedBrowserPath = normalizeBrowserPath(asset);
  const publicRoot = path.resolve(remotionPublicDir);
  const publicFilePath = path.resolve(publicRoot, normalizedBrowserPath);
  const relativeToPublicRoot = path.relative(publicRoot, publicFilePath);
  if (
    relativeToPublicRoot.startsWith("..") ||
    path.isAbsolute(relativeToPublicRoot)
  ) {
    return fail(asset.assetId, "browser URL escapes the Remotion public root");
  }
  let stats;
  try {
    stats = statSync(publicFilePath);
  } catch {
    return fail(asset.assetId, `public asset is missing at ${publicFilePath}`);
  }
  if (!stats.isFile() || stats.size === 0) {
    return fail(asset.assetId, `public asset is not a non-empty file at ${publicFilePath}`);
  }
  return publicFilePath;
};

export const resolveMaulFontReceipt = (
  input: MaulResolvedFontAsset,
  {
    remotionPublicDir,
  }: {
    remotionPublicDir: string;
  },
): MaulResolvedFontAsset => {
  let asset: MaulResolvedFontAsset;
  try {
    asset = maulResolvedFontAssetSchema.parse(input);
  } catch (error) {
    const assetId = typeof input?.assetId === "string" && input.assetId.trim()
      ? input.assetId.trim()
      : "<unknown>";
    const reason = error instanceof Error ? error.message : "receipt schema validation failed";
    return fail(assetId, `has an invalid receipt: ${reason}`);
  }
  if (!allowedFontFormats.has(asset.format)) {
    return fail(asset.assetId, `uses unsupported format ${asset.format}`);
  }
  const publicFilePath = resolvePublicFile({asset, remotionPublicDir});
  let localStats;
  try {
    localStats = statSync(asset.localFilePath);
  } catch {
    return fail(asset.assetId, `local asset is missing at ${asset.localFilePath}`);
  }
  if (!localStats.isFile() || localStats.size === 0) {
    return fail(asset.assetId, `local asset is not a non-empty file at ${asset.localFilePath}`);
  }

  const expectedHash = asset.localFileSha256.toLowerCase();
  const localHash = hashFile(asset.localFilePath);
  if (localHash !== expectedHash) {
    return fail(asset.assetId, `local asset hash does not match ${asset.localFilePath}`);
  }
  const publicHash = hashFile(publicFilePath);
  if (publicHash !== expectedHash) {
    return fail(asset.assetId, `public asset hash does not match ${asset.browserUrl}`);
  }
  return {...asset, localFileSha256: expectedHash};
};

export const assertMaulFontReceiptsRenderable = (
  assets: readonly MaulResolvedFontAsset[],
  options: {remotionPublicDir: string},
): void => {
  for (const asset of assets) {
    resolveMaulFontReceipt(asset, options);
  }
};
