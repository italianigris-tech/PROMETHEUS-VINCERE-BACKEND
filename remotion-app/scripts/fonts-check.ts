import path from "node:path";
import {existsSync, readdirSync, statSync} from "node:fs";

const retrievedFontsRoot = path.resolve("public", "fonts", "retrieved");

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

if (!existsSync(retrievedFontsRoot)) {
  console.log("No retrieved font directory exists yet. Materialized fonts will appear here on demand.");
  process.exitCode = 0;
} else {
  const zipFiles = collectZipFiles(retrievedFontsRoot);
  if (zipFiles.length > 0) {
    console.error("Materialized font directory still contains ZIP archives:");
    zipFiles.forEach((filePath) => {
      console.error(`- ${filePath}`);
    });
    process.exitCode = 1;
  } else {
    console.log("No ZIP archives remain in the retrieved font directory.");
    process.exitCode = 0;
  }
}
