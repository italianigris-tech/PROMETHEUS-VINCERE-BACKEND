import {constants} from "node:fs";
import {access} from "node:fs/promises";
import path from "node:path";

export type RepositoryMediaTool = "ffmpeg" | "ffprobe";

export type RepositoryMediaToolReceipt =
  | {
      status: "available";
      tool: RepositoryMediaTool;
      executablePath: string;
      source: "configured" | "remotion_bundle" | "global_path";
      degraded: boolean;
      checkedPaths: string[];
      reason: null;
    }
  | {
      status: "unavailable";
      tool: RepositoryMediaTool;
      executablePath: null;
      source: "configured" | "repository_and_path";
      degraded: true;
      checkedPaths: string[];
      reason: string;
    };

type ResolveRepositoryMediaToolInput = {
  tool: RepositoryMediaTool;
  repoRoot: string;
  configuredPath?: string | null;
  platform?: NodeJS.Platform;
  arch?: string;
  pathValue?: string;
};

const compositorPackageNames = (
  platform: NodeJS.Platform,
  arch: string,
): string[] => {
  if (platform === "linux" && (arch === "x64" || arch === "arm64")) {
    return [
      `compositor-linux-${arch}-gnu`,
      `compositor-linux-${arch}-musl`,
    ];
  }
  if (platform === "darwin" && (arch === "x64" || arch === "arm64")) {
    return [`compositor-darwin-${arch}`];
  }
  if (platform === "win32" && arch === "x64") {
    return ["compositor-win32-x64-msvc"];
  }
  return [];
};

const executableName = (
  tool: RepositoryMediaTool,
  platform: NodeJS.Platform,
): string => platform === "win32" ? `${tool}.exe` : tool;

const isExecutable = async (
  filePath: string,
  platform: NodeJS.Platform,
): Promise<boolean> => {
  try {
    await access(
      filePath,
      platform === "win32" ? constants.F_OK : constants.F_OK | constants.X_OK,
    );
    return true;
  } catch {
    return false;
  }
};

export const resolveRepositoryMediaTool = async ({
  tool,
  repoRoot,
  configuredPath = tool === "ffmpeg"
    ? process.env.FFMPEG_PATH ?? null
    : process.env.FFPROBE_PATH ?? null,
  platform = process.platform,
  arch = process.arch,
  pathValue = process.env.PATH ?? "",
}: ResolveRepositoryMediaToolInput): Promise<RepositoryMediaToolReceipt> => {
  const checkedPaths: string[] = [];
  if (configuredPath) {
    const absoluteConfiguredPath = path.resolve(configuredPath);
    checkedPaths.push(absoluteConfiguredPath);
    if (await isExecutable(absoluteConfiguredPath, platform)) {
      return {
        status: "available",
        tool,
        executablePath: absoluteConfiguredPath,
        source: "configured",
        degraded: false,
        checkedPaths,
        reason: null,
      };
    }
    return {
      status: "unavailable",
      tool,
      executablePath: null,
      source: "configured",
      degraded: true,
      checkedPaths,
      reason: `Configured ${tool} path is not executable: ${absoluteConfiguredPath}`,
    };
  }

  const binaryName = executableName(tool, platform);
  for (const packageName of compositorPackageNames(platform, arch)) {
    const candidate = path.join(
      repoRoot,
      "remotion-app",
      "node_modules",
      "@remotion",
      packageName,
      binaryName,
    );
    checkedPaths.push(candidate);
    if (await isExecutable(candidate, platform)) {
      return {
        status: "available",
        tool,
        executablePath: candidate,
        source: "remotion_bundle",
        degraded: false,
        checkedPaths,
        reason: null,
      };
    }
  }

  const delimiter = platform === "win32" ? ";" : ":";
  for (const entry of pathValue.split(delimiter).filter(Boolean)) {
    const candidate = path.join(entry, binaryName);
    checkedPaths.push(candidate);
    if (await isExecutable(candidate, platform)) {
      return {
        status: "available",
        tool,
        executablePath: candidate,
        source: "global_path",
        degraded: true,
        checkedPaths,
        reason: null,
      };
    }
  }

  return {
    status: "unavailable",
    tool,
    executablePath: null,
    source: "repository_and_path",
    degraded: true,
    checkedPaths,
    reason: `${tool} is unavailable in configured repository bundles and PATH.`,
  };
};
