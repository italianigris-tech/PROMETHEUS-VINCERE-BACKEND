import path from "node:path";

export const FONT_SERVE_PATH = "/fonts/retrieved";

export const resolveRetrievedFontsDir = (remotionAssetsDir?: string | null): string => {
  const configuredRoot = typeof remotionAssetsDir === "string" ? remotionAssetsDir.trim() : "";
  if (configuredRoot) {
    return path.resolve(configuredRoot, "fonts", "retrieved");
  }

  return path.resolve(process.cwd(), "public", "fonts", "retrieved");
};
