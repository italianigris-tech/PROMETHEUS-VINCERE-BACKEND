export type ResolveStaticAsset = (assetPath: string) => string;

export const resolveMaulFontAssetUrl = (
  browserUrl: string,
  resolveStaticAsset: ResolveStaticAsset,
): string => {
  const normalized = browserUrl.trim();
  if (!normalized) {
    throw new Error("MAUL renderer requires a non-empty root-relative font asset.");
  }
  if (/^(?:https?:|file:)/iu.test(normalized) || normalized.startsWith("//")) {
    throw new Error("MAUL renderer only accepts offline root-relative font assets.");
  }
  if (!normalized.startsWith("/")) {
    throw new Error("MAUL renderer requires root-relative font assets.");
  }
  if (normalized.includes("?") || normalized.includes("#")) {
    throw new Error("MAUL renderer font assets cannot contain query strings or fragments.");
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {
    throw new Error("MAUL renderer font asset URL contains invalid encoding.");
  }
  const segments = decoded.split(/[\\/]+/u);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("MAUL renderer font asset URL contains path traversal.");
  }
  const assetPath = decoded.replace(/^\/+/, "");
  if (!assetPath) {
    throw new Error("MAUL renderer requires a non-empty root-relative font asset.");
  }
  return resolveStaticAsset(assetPath);
};
