import {copyFile, mkdir, readFile, readdir, stat, writeFile} from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const extractedRoot = path.join(repoRoot, "font-intelligence", "extracted-fonts");
const libraryRoot = path.join(repoRoot, "remotion-app", "public", "fonts", "library");
const manifestPath = path.join(repoRoot, "font-intelligence", "outputs", "font-manifest.json");
const remappedManifestPath = path.join(repoRoot, "font-intelligence", "outputs", "font-manifest-remapped.json");
const libraryManifestPath = path.join(libraryRoot, "font-manifest-urls.json");
const hydrationReportPath = path.join(libraryRoot, "font-hydration-report.json");
const acceptedExtensions = new Set([".ttf", ".otf", ".woff", ".woff2"]);

const toPosix = (value) => value.replace(/\\/g, "/");
const windowsAbsolutePathPattern = /(^|[^a-zA-Z0-9])([a-zA-Z]:[\\/])/;

const containsWindowsAbsolutePath = (value) => windowsAbsolutePathPattern.test(value);

const stripRepoPrefix = (value) => {
  const normalizedValue = toPosix(String(value ?? ""));
  const normalizedRepoRoot = toPosix(repoRoot).replace(/\/+$/, "");
  if (normalizedValue.toLowerCase().startsWith(`${normalizedRepoRoot.toLowerCase()}/`)) {
    return normalizedValue.slice(normalizedRepoRoot.length + 1);
  }
  return normalizedValue;
};

const scrubAbsoluteLocalPaths = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => scrubAbsoluteLocalPaths(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, scrubAbsoluteLocalPaths(entry)])
    );
  }
  if (typeof value === "string" && containsWindowsAbsolutePath(value)) {
    return stripRepoPrefix(value);
  }
  return value;
};

const slugify = (value) => {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "font";
};

const walkFonts = async (root) => {
  const results = [];
  const entries = await readdir(root, {withFileTypes: true});
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkFonts(fullPath));
      continue;
    }
    if (entry.isFile() && acceptedExtensions.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results.sort((left, right) => toPosix(path.relative(root, left)).localeCompare(toPosix(path.relative(root, right))));
};

const derivePublicPathFromObserved = (observed) => {
  const sourcePath = String(observed?.extractedRelativePath ?? observed?.extractedAbsolutePath ?? observed?.filename ?? "");
  const relativeParts = toPosix(stripRepoPrefix(sourcePath)).split("/").filter(Boolean);
  const familyName = relativeParts.length > 1
    ? relativeParts.at(-2)
    : observed?.familyName ?? "font";
  const familyDir = slugify(familyName);
  const fileName = path.basename(sourcePath);
  return `/fonts/library/${familyDir}/${fileName}`;
};

const deriveDestinationForFile = (filePath) => {
  const relative = path.relative(extractedRoot, filePath);
  const familyDir = relative.split(path.sep)[0] ?? "font";
  return path.join(libraryRoot, slugify(familyDir), path.basename(filePath));
};

const hydrateFonts = async () => {
  await mkdir(libraryRoot, {recursive: true});
  const fonts = await walkFonts(extractedRoot);
  const report = {
    sourceRoot: toPosix(path.relative(repoRoot, extractedRoot)),
    targetRoot: toPosix(path.relative(repoRoot, libraryRoot)),
    totalSourceFonts: fonts.length,
    hydratedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    totalBytes: 0,
    hydratedBytes: 0,
    skippedBytes: 0,
    errors: [],
  };

  for (const sourcePath of fonts) {
    const sourceStats = await stat(sourcePath);
    report.totalBytes += sourceStats.size;
    const targetPath = deriveDestinationForFile(sourcePath);
    const existingStats = await stat(targetPath).catch(() => null);
    if (existingStats?.isFile() && existingStats.size > 0) {
      report.skippedCount += 1;
      report.skippedBytes += existingStats.size;
      continue;
    }

    try {
      await mkdir(path.dirname(targetPath), {recursive: true});
      await copyFile(sourcePath, targetPath);
      const targetStats = await stat(targetPath);
      if (targetStats.size <= 0) {
        throw new Error("copied file is zero bytes");
      }
      report.hydratedCount += 1;
      report.hydratedBytes += targetStats.size;
    } catch (error) {
      report.errorCount += 1;
      report.errors.push({
        sourcePath: toPosix(path.relative(repoRoot, sourcePath)),
        targetPath: toPosix(path.relative(repoRoot, targetPath)),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await writeFile(hydrationReportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (report.errorCount > 0) {
    throw new Error(`Font hydration failed for ${report.errorCount} file(s). See ${hydrationReportPath}.`);
  }
  return report;
};

const remapManifest = async () => {
  const rawManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!Array.isArray(rawManifest)) {
    throw new Error(`Expected ${manifestPath} to contain an array.`);
  }

  const remapped = rawManifest.map((record) => {
    const observed = record.observed ?? {};
    const newPublicPath = derivePublicPathFromObserved(observed);
    const oldPath = toPosix(String(
      observed.extractedRelativePath
        ?? stripRepoPrefix(observed.extractedAbsolutePath ?? "")
    )).replace(/^font-intelligence\//, "");
    const localPublicPath = `public${newPublicPath}`;
    return scrubAbsoluteLocalPaths({
      ...record,
      oldPath,
      newPublicPath,
      publicPath: newPublicPath,
      observed: {
        ...observed,
        sourceZipPath: observed.sourceFilename ?? null,
        extractedAbsolutePath: oldPath,
        publicPath: newPublicPath,
        localPublicPath,
      },
      specimenPath: record.specimenPath ? toPosix(path.relative(repoRoot, record.specimenPath)) : null,
    });
  });

  if (containsWindowsAbsolutePath(JSON.stringify(remapped))) {
    throw new Error("Remapped font manifest still contains an absolute Windows path.");
  }

  const missingPublicPaths = [];
  for (const record of remapped) {
    const publicPath = record.newPublicPath ?? record.publicPath;
    const localPath = path.join(repoRoot, "remotion-app", "public", String(publicPath).replace(/^\/+/, ""));
    const localStats = await stat(localPath).catch(() => null);
    if (!localStats?.isFile() || localStats.size <= 0) {
      missingPublicPaths.push({fontId: record.fontId, publicPath});
    }
  }
  if (missingPublicPaths.length > 0) {
    throw new Error(`Remapped font manifest contains ${missingPublicPaths.length} path(s) that do not resolve to hydrated files: ${JSON.stringify(missingPublicPaths.slice(0, 10))}`);
  }

  await writeFile(remappedManifestPath, `${JSON.stringify(remapped, null, 2)}\n`);

  const libraryManifest = remapped.map((record) => {
    const observed = record.observed ?? {};
    const localPublicPath = String(observed.localPublicPath ?? `public${record.newPublicPath}`);
    return {
      fontId: record.fontId,
      familyName: observed.familyName ?? record.fontId,
      publicUrl: record.newPublicPath,
      localPublicPath,
      format: String(observed.extension ?? path.extname(record.newPublicPath)).replace(/^\./, "").toLowerCase(),
      renderable: true,
      needsManualLicenseReview: Boolean(record.needsManualLicenseReview),
      license: {
        licenseTexts: observed.licenseTexts ?? [],
      },
      warnings: record.metadataWarnings ?? [],
    };
  });
  await writeFile(libraryManifestPath, `${JSON.stringify(libraryManifest, null, 2)}\n`);

  return {
    remappedCount: remapped.length,
    remappedManifestPath: toPosix(path.relative(repoRoot, remappedManifestPath)),
    libraryManifestPath: toPosix(path.relative(repoRoot, libraryManifestPath)),
  };
};

const verifyLibrary = async () => {
  const fonts = await walkFonts(libraryRoot);
  const zeroByteFiles = [];
  for (const fontPath of fonts) {
    const stats = await stat(fontPath);
    if (stats.size <= 0) {
      zeroByteFiles.push(toPosix(path.relative(repoRoot, fontPath)));
    }
  }
  if (fonts.length <= 500) {
    throw new Error(`Expected hydrated library to contain >500 fonts; found ${fonts.length}.`);
  }
  if (zeroByteFiles.length > 0) {
    throw new Error(`Hydrated library contains zero-byte fonts: ${zeroByteFiles.join(", ")}`);
  }
  return {
    libraryFontCount: fonts.length,
    zeroByteCount: zeroByteFiles.length,
  };
};

const main = async () => {
  const hydration = await hydrateFonts();
  const remap = await remapManifest();
  const verification = await verifyLibrary();
  console.log(JSON.stringify({
    hydratedCount: hydration.hydratedCount,
    skippedCount: hydration.skippedCount,
    totalSourceFonts: hydration.totalSourceFonts,
    totalBytes: hydration.totalBytes,
    ...remap,
    ...verification,
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
