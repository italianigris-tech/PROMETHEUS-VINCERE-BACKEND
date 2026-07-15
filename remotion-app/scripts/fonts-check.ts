import path from "node:path";
import {existsSync, readFileSync, readdirSync, statSync} from "node:fs";

const retrievedFontsRoot = path.resolve("public", "fonts", "retrieved");
const heroFontsRoot = path.resolve("public", "fonts", "hero");
const heroManifestPath = path.join(heroFontsRoot, "hero-fonts.json");
const supportedSignatures = new Set(["OTTO", "wOFF", "wOF2", "ttcf", "true", "typ1"]);

type HeroFontManifest = {
  fonts?: Array<{fontId?: string; publicUrl?: string}>;
};

const hasSupportedFontSignature = (filePath: string): boolean => {
  if (!existsSync(filePath)) {
    return false;
  }
  const bytes = readFileSync(filePath);
  if (bytes.length < 12) {
    return false;
  }
  const signature = bytes.subarray(0, 4).toString("latin1");
  return supportedSignatures.has(signature) || bytes.readUInt32BE(0) === 0x00010000;
};

const collectZipFiles = (rootDir: string): string[] => {
  if (!existsSync(rootDir)) {
    return [];
  }

  const entries = readdirSync(rootDir);
  const zipFiles: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry);
    const entryStats = statSync(absolutePath);
    if (entryStats.isDirectory()) {
      zipFiles.push(...collectZipFiles(absolutePath));
      continue;
    }

    if (/\.zip$/i.test(entry)) {
      zipFiles.push(path.relative(process.cwd(), absolutePath));
    }
  }

  return zipFiles;
};

console.log("Retrieved Font Asset Check");
console.log("==========================");
console.log("House font registry removed. Active preview typography now comes only from manifest-declared materialized fonts.");

let failed = false;

if (!existsSync(heroManifestPath)) {
  console.error(`Hero font manifest is missing: ${heroManifestPath}`);
  failed = true;
} else {
  const manifest = JSON.parse(readFileSync(heroManifestPath, "utf8")) as HeroFontManifest;
  const invalidFonts = (manifest.fonts ?? []).flatMap((font) => {
    const publicUrl = font.publicUrl?.trim() ?? "";
    const filePath = publicUrl.startsWith("/fonts/hero/")
      ? path.join(heroFontsRoot, path.basename(publicUrl))
      : "";
    return filePath && hasSupportedFontSignature(filePath)
      ? []
      : [`${font.fontId ?? "unknown"}: ${publicUrl || "missing publicUrl"}`];
  });
  if (invalidFonts.length > 0) {
    console.error("Hero font manifest contains missing or invalid font binaries:");
    invalidFonts.forEach((font) => console.error(`- ${font}`));
    failed = true;
  } else {
    console.log(`Validated ${(manifest.fonts ?? []).length} hero font binaries.`);
  }
}

if (!existsSync(retrievedFontsRoot)) {
  console.log("No retrieved font directory exists yet. Materialized fonts will appear here on demand.");
} else {
  const zipFiles = collectZipFiles(retrievedFontsRoot);
  if (zipFiles.length > 0) {
    console.error("Materialized font directory still contains ZIP archives:");
    zipFiles.forEach((filePath) => {
      console.error(`- ${filePath}`);
    });
    failed = true;
  } else {
    console.log("No ZIP archives remain in the retrieved font directory.");
  }
}

process.exitCode = failed ? 1 : 0;
