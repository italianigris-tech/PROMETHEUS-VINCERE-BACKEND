import path from "node:path";
import {fileURLToPath} from "node:url";

export const FONT_SERVE_PATH = "/fonts/retrieved";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRemotionPublicDir = path.resolve(
  currentDir,
  "../../../remotion-app/public",
);

export const resolveRetrievedFontsDir = (remotionAssetsDir?: string | null): string => {
  const configuredRoot = typeof remotionAssetsDir === "string" ? remotionAssetsDir.trim() : "";
  if (configuredRoot) {
    return path.resolve(configuredRoot, "fonts", "retrieved");
  }

  return path.join(defaultRemotionPublicDir, "fonts", "retrieved");
};
