import {execFileSync} from "node:child_process";
import {cp, mkdir, opendir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import type {
  MotionSoundAsset,
  MotionSoundIntensity,
  MotionSoundLibrarySection
} from "../src/lib/types.ts";

type DownloaderCatalogEntry = {
  id: string;
  title: string;
  category: string;
  categorySlug: string;
  originalObjectKey: string;
  duration?: number | null;
  fileSizeBytes?: number | null;
};

type AudioSourceFile = {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  stemSlug: string;
  categorySlug: string;
  sizeBytes: number;
};

type CliOptions = {
  musicSourceRoot: string;
  musicCatalogPath: string;
  musicTracksPerCategory: number;
  maxMusicTracks: number;
  sfxSourceDir: string;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appRoot, "..");
const defaultMusicSourceRoot = path.join(repoRoot, "YOUTUBE MUSIC DOWNLOADER -THRAGG", "downloads");
const publicRoot = path.join(appRoot, "public");
const dataRoot = path.join(appRoot, "src", "data");
const artifactsRoot = path.join(repoRoot, "artifacts", "visual-smoke");
const supportedAudioExtensions = new Set([".mp3", ".wav", ".m4a", ".aac"]);

const readArgValue = (flag: string): string | undefined => {
  const args = process.argv.slice(2);
  const direct = args.find((arg) => arg.startsWith(`${flag}=`));
  if (direct) {
    return direct.slice(flag.length + 1);
  }

  const index = args.indexOf(flag);
  if (index < 0) {
    return undefined;
  }

  return args[index + 1];
};

const readPositiveInteger = (flag: string, fallback: number): number => {
  const raw = readArgValue(flag);
  if (raw === undefined) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
};

const readOptions = (): CliOptions => {
  const musicSourceRoot = path.resolve(readArgValue("--music-source-root") ?? defaultMusicSourceRoot);

  return {
    musicSourceRoot,
    musicCatalogPath: path.resolve(
      readArgValue("--music-catalog") ?? path.join(musicSourceRoot, "music-catalog.json")
    ),
    musicTracksPerCategory: readPositiveInteger("--music-tracks-per-category", 1),
    maxMusicTracks: readPositiveInteger("--max-music-tracks", 12),
    sfxSourceDir: path.resolve(readArgValue("--sfx-source-dir") ?? path.join(publicRoot, "sfx"))
  };
};

const toSlug = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .replace(/-{2,}/g, "-");

const toTitle = (value: string): string => value
  .split("-")
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ");

const walkAudioFiles = async (root: string): Promise<AudioSourceFile[]> => {
  const files: AudioSourceFile[] = [];

  const walk = async (directory: string): Promise<void> => {
    const dir = await opendir(directory);
    for await (const entry of dir) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!supportedAudioExtensions.has(extension)) {
        continue;
      }

      const relativePath = path.relative(root, absolutePath);
      const [topLevel] = relativePath.split(path.sep);
      const stat = await import("node:fs/promises").then((fs) => fs.stat(absolutePath));
      files.push({
        absolutePath,
        relativePath,
        fileName: entry.name,
        stemSlug: toSlug(path.parse(entry.name).name),
        categorySlug: toSlug(topLevel ?? ""),
        sizeBytes: stat.size
      });
    }
  };

  await walk(root);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
};

const probeDurationSeconds = (filePath: string, fallback?: number | null): number => {
  try {
    const stdout = execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath
    ], {encoding: "utf8"});
    const parsed = Number(stdout.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  } catch {
    // Fall back to catalog metadata when probing is unavailable.
  }

  return Number.isFinite(fallback) && Number(fallback) > 0 ? Number(fallback) : 60;
};

const buildFileIndexes = (files: AudioSourceFile[]): {
  byCategoryAndSlug: Map<string, AudioSourceFile>;
  bySlug: Map<string, AudioSourceFile[]>;
} => {
  const byCategoryAndSlug = new Map<string, AudioSourceFile>();
  const bySlug = new Map<string, AudioSourceFile[]>();

  files.forEach((file) => {
    byCategoryAndSlug.set(`${file.categorySlug}/${file.stemSlug}`, file);
    const entries = bySlug.get(file.stemSlug) ?? [];
    entries.push(file);
    bySlug.set(file.stemSlug, entries);
  });

  return {byCategoryAndSlug, bySlug};
};

const sourceForCatalogEntry = (
  entry: DownloaderCatalogEntry,
  indexes: ReturnType<typeof buildFileIndexes>
): AudioSourceFile | null => {
  const objectSlug = toSlug(path.parse(path.basename(entry.originalObjectKey)).name);
  const categoryMatch = indexes.byCategoryAndSlug.get(`${entry.categorySlug}/${objectSlug}`);
  if (categoryMatch) {
    return categoryMatch;
  }

  return indexes.bySlug.get(objectSlug)?.[0] ?? null;
};

const tagsForMusicEntry = (entry: DownloaderCatalogEntry): string[] => {
  const source = `${entry.title} ${entry.category} ${entry.categorySlug}`.toLowerCase();
  const tags = new Set<string>([
    "music",
    "song",
    ...toSlug(entry.category).split("-").filter(Boolean),
    ...toSlug(entry.title).split("-").filter((token) => token.length > 2)
  ]);

  if (/cinematic|trailer|epic|orchestral/.test(source)) {
    tags.add("cinematic");
    tags.add("tension");
  }
  if (/classical|piano|chopin|vivaldi|bach/.test(source)) {
    tags.add("classical");
    tags.add("calm");
  }
  if (/hip-hop|trap|urban|beats/.test(source)) {
    tags.add("drive");
    tags.add("trap");
  }
  if (/lo-fi|chill|soft|focus/.test(source)) {
    tags.add("calm");
    tags.add("speech-friendly");
  }
  if (/motivational|uplift|inspiration|triumph/.test(source)) {
    tags.add("uplift");
  }
  if (/tech|futuristic|ai/.test(source)) {
    tags.add("tech");
  }

  return [...tags].slice(0, 16);
};

const intensityForMusicEntry = (entry: DownloaderCatalogEntry): MotionSoundIntensity => {
  const source = `${entry.title} ${entry.category}`.toLowerCase();
  if (/trap|urban|action|vengeance|intense|disaster|epic|trailer/.test(source)) {
    return "hard";
  }
  if (/lo-fi|chill|classical|piano|soft|relax|focus/.test(source)) {
    return "soft";
  }
  return "medium";
};

const selectMusicEntries = (
  catalog: DownloaderCatalogEntry[],
  indexes: ReturnType<typeof buildFileIndexes>,
  options: CliOptions
): Array<{entry: DownloaderCatalogEntry; source: AudioSourceFile}> => {
  const selected: Array<{entry: DownloaderCatalogEntry; source: AudioSourceFile}> = [];
  const selectedIds = new Set<string>();
  const byCategory = new Map<string, DownloaderCatalogEntry[]>();

  catalog.forEach((entry) => {
    const entries = byCategory.get(entry.categorySlug) ?? [];
    entries.push(entry);
    byCategory.set(entry.categorySlug, entries);
  });

  for (const [, entries] of [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ranked = entries
      .map((entry) => ({entry, source: sourceForCatalogEntry(entry, indexes)}))
      .filter((candidate): candidate is {entry: DownloaderCatalogEntry; source: AudioSourceFile} =>
        Boolean(candidate.source)
      )
      .sort((left, right) =>
        (left.entry.fileSizeBytes ?? left.source.sizeBytes) - (right.entry.fileSizeBytes ?? right.source.sizeBytes) ||
        left.entry.title.localeCompare(right.entry.title)
      );

    for (const candidate of ranked.slice(0, options.musicTracksPerCategory)) {
      if (selected.length >= options.maxMusicTracks || selectedIds.has(candidate.entry.id)) {
        continue;
      }
      selectedIds.add(candidate.entry.id);
      selected.push(candidate);
    }
  }

  if (selected.length < Math.min(6, options.maxMusicTracks)) {
    throw new Error(`Only found ${selected.length} materializable music tracks; expected at least 6.`);
  }

  return selected;
};

const materializeMusicCatalog = async (options: CliOptions): Promise<MotionSoundAsset[]> => {
  const rawCatalog = JSON.parse(await readFile(options.musicCatalogPath, "utf8")) as DownloaderCatalogEntry[];
  const sourceFiles = await walkAudioFiles(options.musicSourceRoot);
  const indexes = buildFileIndexes(sourceFiles);
  const selected = selectMusicEntries(rawCatalog, indexes, options);
  const outputDir = path.join(publicRoot, "audio", "music");

  await mkdir(outputDir, {recursive: true});

  const assets: MotionSoundAsset[] = [];
  for (const {entry, source} of selected) {
    const trackSlug = toSlug(path.parse(path.basename(entry.originalObjectKey)).name || entry.title);
    const extension = path.extname(source.fileName).toLowerCase() || ".mp3";
    const targetFileName = `${entry.categorySlug}--${trackSlug}${extension}`;
    const targetPath = path.join(outputDir, targetFileName);
    await cp(source.absolutePath, targetPath, {force: true});

    assets.push({
      id: `music-preview-${entry.categorySlug}-${trackSlug}`,
      label: entry.title,
      src: `audio/music/${targetFileName}`,
      sourceFileName: source.fileName,
      librarySection: "music",
      durationSeconds: probeDurationSeconds(targetPath, entry.duration),
      tags: tagsForMusicEntry(entry),
      intensity: intensityForMusicEntry(entry)
    });
  }

  return assets.sort((left, right) => left.id.localeCompare(right.id));
};

const sectionForSfxFile = (fileName: string): MotionSoundLibrarySection => {
  const slug = toSlug(path.parse(fileName).name);
  if (slug.includes("whoosh")) {
    return "whoosh";
  }
  if (slug.includes("riser")) {
    return "riser";
  }
  if (slug.includes("text") || slug.includes("typing")) {
    return "text";
  }
  if (slug.includes("glitch") || slug.includes("transition")) {
    return "transition";
  }
  if (slug.includes("impact") || slug.includes("sub-drop")) {
    return "impact-hit";
  }
  return "ui";
};

const tagsForSfx = (section: MotionSoundLibrarySection, fileName: string): string[] => {
  const tags = new Set<string>(
    toSlug(path.parse(fileName).name).split("-").filter((token) => token.length > 1)
  );
  tags.add(section);

  if (section === "whoosh" || section === "transition") {
    tags.add("movement");
    tags.add("transition");
  }
  if (section === "impact-hit") {
    tags.add("impact");
    tags.add("hit");
    tags.add("accent");
  }
  if (section === "riser") {
    tags.add("lift");
    tags.add("build");
  }
  if (section === "text") {
    tags.add("typing");
    tags.add("caption");
  }

  return [...tags].slice(0, 12);
};

const intensityForSfx = (section: MotionSoundLibrarySection): MotionSoundIntensity => {
  if (section === "impact-hit" || section === "riser") {
    return "hard";
  }
  if (section === "whoosh" || section === "transition") {
    return "medium";
  }
  return "soft";
};

const materializeSoundFxCatalog = async (options: CliOptions): Promise<MotionSoundAsset[]> => {
  const sourceFiles = await walkAudioFiles(options.sfxSourceDir);
  const outputRoot = path.join(publicRoot, "audio", "sfx");
  const assets: MotionSoundAsset[] = [];

  for (const source of sourceFiles) {
    const section = sectionForSfxFile(source.fileName);
    const slug = toSlug(path.parse(source.fileName).name);
    const extension = path.extname(source.fileName).toLowerCase() || ".mp3";
    const targetDir = path.join(outputRoot, section);
    const targetFileName = `${slug}${extension}`;
    const targetPath = path.join(targetDir, targetFileName);

    await mkdir(targetDir, {recursive: true});
    await cp(source.absolutePath, targetPath, {force: true});

    assets.push({
      id: `${section}-${slug}`,
      label: toTitle(slug),
      src: `audio/sfx/${section}/${targetFileName}`,
      sourceFileName: source.fileName,
      librarySection: section,
      durationSeconds: probeDurationSeconds(targetPath),
      tags: tagsForSfx(section, source.fileName),
      intensity: intensityForSfx(section)
    });
  }

  return assets.sort((left, right) => left.id.localeCompare(right.id));
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const main = async (): Promise<void> => {
  const options = readOptions();
  const musicCatalog = await materializeMusicCatalog(options);
  const soundFxCatalog = await materializeSoundFxCatalog(options);

  await writeJson(path.join(dataRoot, "music.local.json"), musicCatalog);
  await writeJson(path.join(dataRoot, "sound-fx.local.json"), soundFxCatalog);

  const report = {
    ok: true,
    musicCatalogPath: options.musicCatalogPath,
    musicSourceRoot: options.musicSourceRoot,
    musicTracks: musicCatalog.length,
    musicCategories: [...new Set(musicCatalog.map((asset) => asset.id.split("-").slice(2, -1).join("-")))].sort(),
    soundFxTracks: soundFxCatalog.length,
    soundFxSections: [...new Set(soundFxCatalog.map((asset) => asset.librarySection))].sort(),
    writtenManifests: [
      path.join(dataRoot, "music.local.json"),
      path.join(dataRoot, "sound-fx.local.json")
    ]
  };

  await writeJson(path.join(artifactsRoot, "audio-preview-catalog-report.json"), report);
  console.info(JSON.stringify(report, null, 2));
};

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
