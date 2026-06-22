import {readdirSync, statSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {MusicReferenceSchema, type MusicReference} from "@prometheus/shared-types";

export type ListLocalMusicCatalogInput = {
  musicDir?: string;
  probeDurationSeconds?: (filePath: string) => number | null;
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../..");
const defaultMusicDir = path.join(repoRoot, "PROMETHEUS_SONGS");

const toTrackId = (fileName: string): string => path
  .basename(fileName, path.extname(fileName))
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  || "local-track";

const toTitle = (fileName: string): string => path.basename(fileName, path.extname(fileName)).trim();

export const listLocalMusicCatalog = ({
  musicDir = defaultMusicDir,
  probeDurationSeconds,
}: ListLocalMusicCatalogInput = {}): MusicReference[] => {
  let entries: string[];
  try {
    entries = readdirSync(musicDir);
  } catch {
    return [];
  }

  return entries
    .filter((fileName) => path.extname(fileName).toLowerCase() === ".mp3")
    .flatMap((fileName) => {
      const filePath = path.resolve(musicDir, fileName);
      const stats = statSync(filePath, {throwIfNoEntry: false});
      if (!stats?.isFile() || stats.size <= 0) {
        return [];
      }

      const durationSeconds = probeDurationSeconds?.(filePath) ?? 1;
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return [];
      }

      return [MusicReferenceSchema.parse({
        trackId: `local-${toTrackId(fileName)}`,
        title: toTitle(fileName),
        sourceKind: "local",
        localFilePath: filePath,
        browserUrl: `/music/${encodeURIComponent(fileName)}`,
        durationSeconds,
        renderSafe: true,
        licenseStatus: "local_user_supplied",
      })];
    })
    .sort((left, right) => left.title.localeCompare(right.title));
};
