import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import type {MaulUnifiedShortRenderManifest} from "@prometheus/shared-types";

export type MaulRenderCaption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
};

export type MaulShortRenderEngineInput = {
  workRoot: string;
  manifest: MaulUnifiedShortRenderManifest;
};

export type MaulShortRenderEngineResult = {
  bytes: Buffer;
  sha256: string;
  durationMs: number;
  width: number;
  height: number;
  evidence: {
    compositionId: "MaulShort";
    renderer: "remotion";
    sourceMappingPreserved: boolean;
    audioMixed: boolean;
  };
};

export type MaulShortRenderEngine = (
  input: MaulShortRenderEngineInput
) => Promise<MaulShortRenderEngineResult>;

const executableName = process.platform === "win32" ? "remotion.cmd" : "remotion";

const runRemotion = async ({
  executable,
  args,
  cwd
}: {
  executable: string;
  args: string[];
  cwd: string;
}): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    execFile(
      executable,
      args,
      {cwd, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 8 * 1024 * 1024},
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`MAUL Remotion render failed: ${stderr.trim() || error.message}`));
          return;
        }
        resolve();
      }
    );
  });
};

export const renderMaulShortLocally: MaulShortRenderEngine = async (input) => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const remotionRoot = path.join(repoRoot, "remotion-app");
  const publicStageRoot = path.join(remotionRoot, "public", ".maul-renders");
  await mkdir(publicStageRoot, {recursive: true});
  // Resolve to absolute paths up front: the caller may hand us a relative
  // workRoot, but the Remotion CLI runs with remotion-app as its cwd and
  // would resolve relative props/output paths against the wrong directory.
  const workRoot = path.resolve(input.workRoot);
  await mkdir(workRoot, {recursive: true});
  const publicStageDir = await mkdtemp(path.join(publicStageRoot, "render-"));
  const workDir = await mkdtemp(path.join(workRoot, "render-"));
  const stageName = path.basename(publicStageDir);
  const sourceExtension = path.extname(input.manifest.source.storagePath) || ".mp4";
  const stagedSource = path.join(publicStageDir, `source${sourceExtension}`);
  const stagedMusic = path.join(publicStageDir, `music${path.extname(input.manifest.audio.musicTrack.storagePath) || ".wav"}`);
  const outputPath = path.join(workDir, "maul-short.mp4");
  const propsPath = path.join(workDir, "props.json");

  try {
    await copyFile(input.manifest.source.storagePath, stagedSource);
    await copyFile(input.manifest.audio.musicTrack.storagePath, stagedMusic);
    const stagedSfx = await Promise.all(input.manifest.audio.sfxAssets.map(async (asset, index) => {
      const filename = `sfx-${index}${path.extname(asset.storagePath) || ".wav"}`;
      await copyFile(asset.storagePath, path.join(publicStageDir, filename));
      return {
        ...asset,
        storagePath: `.maul-renders/${stageName}/${filename}`
      };
    }));
    const runtimeManifest: MaulUnifiedShortRenderManifest = {
      ...input.manifest,
      source: {
        ...input.manifest.source,
        storagePath: `.maul-renders/${stageName}/${path.basename(stagedSource)}`
      },
      audio: {
        ...input.manifest.audio,
        musicTrack: {
          ...input.manifest.audio.musicTrack,
          storagePath: `.maul-renders/${stageName}/${path.basename(stagedMusic)}`
        },
        sfxAssets: stagedSfx
      }
    };
    await writeFile(
      propsPath,
      JSON.stringify({manifest: runtimeManifest}),
      "utf8"
    );

    // Node ≥18.20 refuses to execFile .cmd shims without a shell (spawn EINVAL)
    // on win32, so there we invoke the Remotion CLI entry directly with node.
    const executable = process.platform === "win32"
      ? process.execPath
      : path.join(remotionRoot, "node_modules", ".bin", executableName);
    await runRemotion({
      executable,
      cwd: remotionRoot,
      args: [
        ...(process.platform === "win32"
          ? [path.join(remotionRoot, "node_modules", "@remotion", "cli", "remotion-cli.js")]
          : []),
        "render",
        "src/index.ts",
        "MaulShort",
        outputPath,
        `--props=${propsPath}`,
        "--codec=h264",
        "--audio-codec=aac",
        "--overwrite"
      ]
    });
    const bytes = await readFile(outputPath);
    if (bytes.length === 0) {
      throw new Error("MAUL Remotion render produced an empty MP4.");
    }
    return {
      bytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      durationMs: input.manifest.timeline.outputDurationMs,
      width: input.manifest.output.width,
      height: input.manifest.output.height,
      evidence: {
        compositionId: "MaulShort",
        renderer: "remotion",
        sourceMappingPreserved: true,
        audioMixed: true
      }
    };
  } finally {
    await rm(publicStageDir, {recursive: true, force: true});
    await rm(workDir, {recursive: true, force: true});
  }
};
