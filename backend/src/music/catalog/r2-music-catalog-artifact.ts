import path from "node:path";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

import {r2MusicCatalogSchema, type R2MusicCatalog} from "./r2-music-catalog.schema";

const backendRootDir = (): string => {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
};

export const getDefaultR2MusicCatalogArtifactPath = (): string => {
  return path.join(backendRootDir(), ".cache", "music", "r2-music-catalog.normalized.json");
};

export const writeR2MusicCatalogArtifact = async ({
  catalog,
  outputPath
}: {
  catalog: R2MusicCatalog;
  outputPath?: string;
}): Promise<string> => {
  const parsedCatalog = r2MusicCatalogSchema.parse(catalog);
  const targetPath = path.resolve(outputPath ?? getDefaultR2MusicCatalogArtifactPath());

  await mkdir(path.dirname(targetPath), {recursive: true});
  await writeFile(targetPath, `${JSON.stringify(parsedCatalog, null, 2)}\n`, "utf-8");
  return targetPath;
};

export const readR2MusicCatalogArtifact = async ({
  inputPath
}: {
  inputPath?: string;
} = {}): Promise<R2MusicCatalog> => {
  const targetPath = path.resolve(inputPath ?? getDefaultR2MusicCatalogArtifactPath());
  const raw = await readFile(targetPath, "utf-8");
  return r2MusicCatalogSchema.parse(JSON.parse(raw));
};
