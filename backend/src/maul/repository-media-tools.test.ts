import {chmod, mkdir, mkdtemp, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {resolveRepositoryMediaTool} from "./repository-media-tools.js";

const makeExecutable = async (filePath: string): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, "fixture", "utf8");
  await chmod(filePath, 0o755);
};

describe("repository media tools", () => {
  it("resolves bundled Remotion FFmpeg when the global PATH has no ffmpeg", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "maul-media-tools-"));
    const bundledFfmpeg = path.join(
      repoRoot,
      "remotion-app",
      "node_modules",
      "@remotion",
      "compositor-linux-x64-gnu",
      "ffmpeg",
    );
    await makeExecutable(bundledFfmpeg);

    const receipt = await resolveRepositoryMediaTool({
      tool: "ffmpeg",
      repoRoot,
      configuredPath: null,
      platform: "linux",
      arch: "x64",
      pathValue: "",
    });

    expect(receipt).toMatchObject({
      status: "available",
      source: "remotion_bundle",
      executablePath: bundledFfmpeg,
    });
    expect(receipt.checkedPaths).toContain(bundledFfmpeg);
  });

  it("uses and validates an explicitly configured executable first", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "maul-media-tools-"));
    const configuredFfmpeg = path.join(repoRoot, "configured", "ffmpeg-custom");
    const bundledFfmpeg = path.join(
      repoRoot,
      "remotion-app",
      "node_modules",
      "@remotion",
      "compositor-linux-x64-gnu",
      "ffmpeg",
    );
    await Promise.all([
      makeExecutable(configuredFfmpeg),
      makeExecutable(bundledFfmpeg),
    ]);

    await expect(
      resolveRepositoryMediaTool({
        tool: "ffmpeg",
        repoRoot,
        configuredPath: configuredFfmpeg,
        platform: "linux",
        arch: "x64",
        pathValue: "",
      }),
    ).resolves.toMatchObject({
      status: "available",
      source: "configured",
      executablePath: configuredFfmpeg,
    });

    await expect(
      resolveRepositoryMediaTool({
        tool: "ffmpeg",
        repoRoot,
        configuredPath: path.join(repoRoot, "missing-ffmpeg"),
        platform: "linux",
        arch: "x64",
        pathValue: "",
      }),
    ).resolves.toMatchObject({
      status: "unavailable",
      source: "configured",
      executablePath: null,
      reason: expect.stringMatching(/configured.*not executable/i),
    });
  });

  it("names global PATH resolution as a degraded fallback", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "maul-media-tools-"));
    const pathDir = path.join(repoRoot, "path-bin");
    const globalFfprobe = path.join(
      pathDir,
      process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
    );
    await makeExecutable(globalFfprobe);

    const receipt = await resolveRepositoryMediaTool({
      tool: "ffprobe",
      repoRoot,
      configuredPath: null,
      platform: process.platform,
      arch: process.arch,
      pathValue: pathDir,
    });

    expect(receipt).toMatchObject({
      status: "available",
      source: "global_path",
      executablePath: globalFfprobe,
      degraded: true,
    });
  });
});
