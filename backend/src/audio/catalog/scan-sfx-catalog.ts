import {execFile} from "node:child_process";
import {writeFile} from "node:fs/promises";
import {promisify} from "node:util";
import path from "node:path";

import {JOSEPH_TRACER_CURATION, fileSha256, verifySfxCatalogFiles} from "./sfx-catalog.js";

const execFileAsync = promisify(execFile);
const backendRoot = process.cwd();
const args = process.argv.slice(2);
const verify = args[0] === "--verify";
const output = path.resolve(backendRoot, args.at(-1) ?? "src/audio/catalog/joseph-tracer-sfx.json");
const sourceRoot = path.resolve(backendRoot, "..", "SOUND FX");
const ffprobe = path.resolve(backendRoot, "..", "remotion-app", "node_modules", "@remotion", "compositor-linux-x64-gnu", "ffprobe");

const probe = async (filePath: string) => {
  const {stdout} = await execFileAsync(ffprobe, ["-v", "error", "-show_entries", "format=duration,format_name", "-of", "json", filePath]);
  const format = JSON.parse(stdout).format as {duration?: string; format_name?: string};
  const durationMs = Math.round(Number(format.duration) * 1000);
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error(`Invalid duration for ${filePath}.`);
  return {durationMs, format: filePath.toLowerCase().endsWith(".wav") ? "wav" as const : "mp3" as const};
};

const buildCatalog = async () => ({
  schemaVersion: "joseph-sfx-catalog/v1" as const,
  catalogId: "joseph-tracer-30",
  assets: await Promise.all(JOSEPH_TRACER_CURATION.map(async ([objectKey, assetId, lifecycleRoles, material, direction, intensity, semanticTags]) => {
    const filePath = path.resolve(sourceRoot, objectKey);
    const sha256 = await fileSha256(filePath);
    const {durationMs, format} = await probe(filePath);
    return {
      assetId,
      sha256,
      objectKey,
      durationMs,
      format,
      analysis: {provider: "ffprobe" as const, inputHash: sha256, durationStatus: "measured" as const, loudnessLufs: null, truePeakDbtp: null, onsetMs: null, tailMs: null, status: "metadata_only" as const},
      lifecycleRoles: [...lifecycleRoles], material, direction, intensity, semanticTags: [...semanticTags],
      rights: {state: "unknown" as const, usage: "preview_only" as const, sourceEvidence: null, licenseEvidence: null},
    };
  })).then((assets) => assets.sort((left, right) => left.assetId.localeCompare(right.assetId))),
});

const catalog = verify ? JSON.parse(await (await import("node:fs/promises")).readFile(output, "utf8")) : await buildCatalog();
await verifySfxCatalogFiles({catalog, root: sourceRoot});
if (catalog.assets.length !== 30) throw new Error("Joseph tracer catalog must contain exactly 30 assets.");
if (!verify) await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`${verify ? "verified" : "generated"} ${catalog.assets.length} SFX assets`);
