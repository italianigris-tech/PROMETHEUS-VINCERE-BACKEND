import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {maulUnifiedShortRenderManifestSchema} from "@prometheus/shared-types";

const [inputPath, outputPath, remoteRoot = "/data/benchmarks/maul-female-coach"] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: tsx scripts/prepare-maul-modal-manifest.ts <input> <output> [remote-root]");
}

const main = async (): Promise<void> => {
  const rawText = await readFile(path.resolve(inputPath), "utf8");
  const rawObj = JSON.parse(rawText);
  const rawManifest = rawObj.manifest ?? rawObj;
  const manifest = maulUnifiedShortRenderManifestSchema.parse(rawManifest);
  const rewritten = maulUnifiedShortRenderManifestSchema.parse({
    ...manifest,
    source: {
      ...manifest.source,
      storagePath: `${remoteRoot}/source.mp4`,
      sha256: remoteRoot.includes("maul-female-coach")
        ? "d554098a3adda2ca7af6d66bb33ed7ac616969d86468374cfd9870f4b9b880f0"
        : manifest.source.sha256,
    },
    audio: {
      ...manifest.audio,
      musicTrack: manifest.audio.musicTrack
        ? {...manifest.audio.musicTrack, storagePath: `${remoteRoot}/music.mp3`}
        : null,
      sfxAssets: manifest.audio.sfxAssets.map((asset, index) => ({
        ...asset,
        storagePath: `${remoteRoot}/sfx-${(index % 2) + 1}.wav`,
      })),
    },
  });

  const pipelineJobId = `maul:${rewritten.replayKey}`;
  await writeFile(path.resolve(outputPath), `${JSON.stringify({
    pipeline: "maul",
    pipelineJobId,
    manifest: rewritten,
  }, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    outputPath: path.resolve(outputPath),
    replayKey: rewritten.replayKey,
    pipelineJobId,
    source: rewritten.source.storagePath,
    music: rewritten.audio.musicTrack?.storagePath ?? null,
    sfx: rewritten.audio.sfxAssets.map((asset) => asset.storagePath),
  }, null, 2)}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
