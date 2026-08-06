import path from "node:path";
import {createHash} from "node:crypto";
import {mkdir, readFile, rm, stat, writeFile} from "node:fs/promises";

import AdmZip from "adm-zip";

import {FONT_SERVE_PATH, resolveRetrievedFontsDir} from "../config/font-assets";

export type MaterializedRetrievedFontAsset = {
  fileName: string;
  filePath: string;
  browserUrl: string;
  format: "ttf" | "otf" | "woff" | "woff2";
  sha256: string;
};

const fontFilePattern = /\.(ttf|otf|woff|woff2)$/i;

const normalizePosixPath = (value: string): string => value.replace(/\\/g, "/");

export const sanitizeFontPathSegment = (value: string): string => {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "font";
};

const inferFontFormat = (fileName: string): MaterializedRetrievedFontAsset["format"] => {
  const match = fileName.toLowerCase().match(/\.(ttf|otf|woff|woff2)$/);
  if (!match) {
    throw new Error(`Unsupported font format for worker: ${fileName}. Provide a static .ttf, .otf, .woff, or .woff2 file.`);
  }

  return match[1] as MaterializedRetrievedFontAsset["format"];
};

const buildBrowserUrl = ({
  familyDir,
  fileName,
  servePath
}: {
  familyDir: string;
  fileName: string;
  servePath: string;
}): string => {
  const normalizedServePath = normalizePosixPath(servePath).replace(/\/+$/, "");
  return `${normalizedServePath}/${encodeURIComponent(familyDir)}/${encodeURIComponent(fileName)}`;
};

const assertMaterializedFontExists = async (filePath: string, sourceLabel: string): Promise<void> => {
  const fileStats = await stat(filePath).catch(() => null);
  if (!fileStats?.isFile() || fileStats.size <= 0) {
    throw new Error(`TypographyMaterializerError: materialized font file does not exist after extraction/copy (${sourceLabel} -> ${filePath}).`);
  }
};

const inferRemoteFileName = (sourceUrl: string): string => {
  try {
    const parsed = new URL(sourceUrl);
    const candidate = path.basename(parsed.pathname);
    return candidate || "font.ttf";
  } catch {
    return path.basename(sourceUrl) || "font.ttf";
  }
};

const sha256 = (bytes: Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");

const materializeFontBytes = async ({
  bytes,
  fileName,
  sourceLabel,
  targetRootDir,
  servePath,
}: {
  bytes: Buffer;
  fileName: string;
  sourceLabel: string;
  targetRootDir: string;
  servePath: string;
}): Promise<MaterializedRetrievedFontAsset> => {
  const format = inferFontFormat(fileName);
  const contentHash = sha256(bytes);
  const targetDir = path.join(targetRootDir, contentHash);
  const outputPath = path.join(targetDir, fileName);

  await mkdir(targetDir, {recursive: true});
  await writeFile(outputPath, bytes);
  await assertMaterializedFontExists(outputPath, sourceLabel);

  return {
    fileName,
    filePath: normalizePosixPath(outputPath),
    browserUrl: buildBrowserUrl({
      familyDir: contentHash,
      fileName,
      servePath,
    }),
    format,
    sha256: contentHash,
  };
};

export const resetRetrievedFontsDir = async (targetRootDir = resolveRetrievedFontsDir()): Promise<void> => {
  await rm(targetRootDir, {recursive: true, force: true});
  await mkdir(targetRootDir, {recursive: true});
};

export const materializeLocalFontAsset = async ({
  family,
  filePath,
  targetRootDir = resolveRetrievedFontsDir(),
  servePath = FONT_SERVE_PATH
}: {
  family: string;
  filePath: string;
  targetRootDir?: string;
  servePath?: string;
}): Promise<MaterializedRetrievedFontAsset> => {
  const fileName = path.basename(filePath);
  void family;
  return materializeFontBytes({
    bytes: await readFile(filePath),
    fileName,
    sourceLabel: filePath,
    targetRootDir,
    servePath,
  });
};

export const materializeRetrievedFontAsset = async ({
  family,
  sourceUrl,
  targetRootDir = resolveRetrievedFontsDir(),
  servePath = FONT_SERVE_PATH,
  fetchImpl = fetch
}: {
  family: string;
  sourceUrl: string;
  targetRootDir?: string;
  servePath?: string;
  fetchImpl?: typeof fetch;
}): Promise<MaterializedRetrievedFontAsset[]> => {
  const response = await fetchImpl(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download retrieved font asset from ${sourceUrl} (${response.status}).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  void family;

  const isZipArchive = sourceUrl.toLowerCase().endsWith(".zip") || buffer.subarray(0, 4).toString("hex") === "504b0304";

  if (isZipArchive) {
    const zip = new AdmZip(buffer);

    const entries = zip.getEntries().filter((entry) => !entry.isDirectory && fontFilePattern.test(entry.entryName));
    if (entries.length === 0) {
      throw new Error(`Retrieved ZIP ${sourceUrl} did not contain any worker-compatible .ttf, .otf, .woff, or .woff2 font files.`);
    }

    const materializedEntries = await Promise.all(entries.map(async (entry) => {
      const fileName = path.basename(entry.entryName);
      return materializeFontBytes({
        bytes: entry.getData(),
        fileName,
        sourceLabel: `${sourceUrl}#${entry.entryName}`,
        targetRootDir,
        servePath,
      });
    }));

    return materializedEntries.sort((left, right) => left.fileName.localeCompare(right.fileName));
  }

  const sourceFileName = inferRemoteFileName(sourceUrl);
  const normalizedFileName = fontFilePattern.test(sourceFileName) ? sourceFileName : `${sourceFileName}.ttf`;
  return [await materializeFontBytes({
    bytes: buffer,
    fileName: normalizedFileName,
    sourceLabel: sourceUrl,
    targetRootDir,
    servePath,
  })];
};
