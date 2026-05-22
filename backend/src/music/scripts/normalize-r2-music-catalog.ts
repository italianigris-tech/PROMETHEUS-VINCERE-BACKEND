import path from "node:path";
import {readFile} from "node:fs/promises";

import {loadEnv} from "../../config";
import {
  getDefaultR2MusicCatalogArtifactPath,
  normalizeR2MusicCatalog,
  writeR2MusicCatalogArtifact
} from "../index";

const readArg = (flag: string): string | undefined => {
  const directMatch = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (directMatch) {
    return directMatch.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
};

const main = async (): Promise<void> => {
  const inputPathArg = readArg("--input");
  if (!inputPathArg) {
    throw new Error("Missing required --input argument.");
  }

  const env = loadEnv();
  const bucket = env.R2_BUCKET_NAME.trim();
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME must be configured before normalizing the R2 music catalog.");
  }

  const backendRoot = process.cwd();
  const inputPath = path.resolve(backendRoot, inputPathArg);
  const outputPath = path.resolve(
    backendRoot,
    readArg("--output") ?? getDefaultR2MusicCatalogArtifactPath()
  );
  const raw = await readFile(inputPath, "utf-8");
  const normalized = normalizeR2MusicCatalog({
    sourceCatalog: JSON.parse(raw),
    bucket,
    sourceCatalogPath: inputPath,
    publicBaseUrl: "",
    now: () => new Date().toISOString()
  });
  const writtenPath = await writeR2MusicCatalogArtifact({
    catalog: normalized,
    outputPath
  });

  const categories = [...new Set(normalized.entries.map((entry) => entry.category))].sort();
  const tracksWithThumbnails = normalized.entries.filter((entry) => Boolean(entry.thumbnailObjectKey)).length;
  const previewAllowedCount = normalized.entries.filter((entry) => entry.previewAllowed).length;
  const renderAllowedCount = normalized.entries.filter((entry) => entry.renderAllowed).length;

  console.log(JSON.stringify({
    totalEntries: normalized.totalTracks,
    categories,
    tracksWithThumbnails,
    previewAllowedCount,
    renderAllowedCount,
    outputPath: writtenPath
  }, null, 2));
};

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
