import path from "node:path";
import {copyFile, mkdir, rm, stat, writeFile} from "node:fs/promises";

import AdmZip from "adm-zip";

import {FONT_SERVE_PATH, resolveRetrievedFontsDir} from "../config/font-assets";

export type MaterializedRetrievedFontAsset = {
  fileName: string;
  filePath: string;
  browserUrl: string;
  format: "ttf" | "otf" | "woff" | "woff2";
};

const fontFilePattern = /\.(woff2?|otf|ttf)$/i;

const normalizePosixPath = (value: string): string => value.replace(/\\/g, "/");

export const sanitizeFontPathSegment = (value: string): string => {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "font";
};

const inferFontFormat = (fileName: string): MaterializedRetrievedFontAsset["format"] => {
  const match = fileName.toLowerCase().match(/\.(ttf|otf|woff2|woff)$/);
  if (!match) {
    return "woff2";
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
    return candidate || "font.woff2";
  } catch {
    return path.basename(sourceUrl) || "font.woff2";
  }
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
  const familyDir = sanitizeFontPathSegment(family);
  const fileName = path.basename(filePath);
  const targetDir = path.join(targetRootDir, familyDir);
  const outputPath = path.join(targetDir, fileName);

  await mkdir(targetDir, {recursive: true});
  await copyFile(filePath, outputPath);
  await assertMaterializedFontExists(outputPath, filePath);

  return {
    fileName,
    filePath: normalizePosixPath(outputPath),
    browserUrl: buildBrowserUrl({
      familyDir,
      fileName,
      servePath
    }),
    format: inferFontFormat(fileName)
  };
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
  const familyDir = sanitizeFontPathSegment(family);
  const targetDir = path.join(targetRootDir, familyDir);
  await rm(targetDir, {recursive: true, force: true});
  await mkdir(targetDir, {recursive: true});

  const isZipArchive = sourceUrl.toLowerCase().endsWith(".zip") || buffer.subarray(0, 4).toString("hex") === "504b0304";

  if (isZipArchive) {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().filter((entry) => !entry.isDirectory && fontFilePattern.test(entry.entryName));
    if (entries.length === 0) {
      throw new Error(`Retrieved ZIP ${sourceUrl} did not contain any browser-compatible font files.`);
    }

    const materializedEntries = await Promise.all(entries.map(async (entry) => {
      const fileName = path.basename(entry.entryName);
      const outputPath = path.join(targetDir, fileName);
      await writeFile(outputPath, entry.getData());
      await assertMaterializedFontExists(outputPath, `${sourceUrl}#${entry.entryName}`);

      return {
        fileName,
        filePath: normalizePosixPath(outputPath),
        browserUrl: buildBrowserUrl({
          familyDir,
          fileName,
          servePath
        }),
        format: inferFontFormat(fileName)
      } satisfies MaterializedRetrievedFontAsset;
    }));

    return materializedEntries.sort((left, right) => left.fileName.localeCompare(right.fileName));
  }

  const sourceFileName = inferRemoteFileName(sourceUrl);
  const normalizedFileName = fontFilePattern.test(sourceFileName) ? sourceFileName : `${sourceFileName}.woff2`;
  const outputPath = path.join(targetDir, normalizedFileName);
  await writeFile(outputPath, buffer);
  await assertMaterializedFontExists(outputPath, sourceUrl);

  return [{
    fileName: normalizedFileName,
    filePath: normalizePosixPath(outputPath),
    browserUrl: buildBrowserUrl({
      familyDir,
      fileName: normalizedFileName,
      servePath
    }),
    format: inferFontFormat(normalizedFileName)
  }];
};
