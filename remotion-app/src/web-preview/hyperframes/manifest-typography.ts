import type {HyperframesPreviewManifest} from "./manifest-schema";

type ManifestFontDefinition = NonNullable<HyperframesPreviewManifest["typography"]>["primaryFont"];

const pendingManifestFontLoads = new Map<string, Promise<void>>();
const loadedManifestFontKeys = new Set<string>();
const warnedManifestFontKeys = new Set<string>();

const FORMAT_PRIORITY: Record<string, number> = {
  woff2: 0,
  woff: 1,
  otf: 2,
  ttf: 3
};

const getFontFaceSet = (): (FontFaceSet & {add?: (fontFace: FontFace) => void}) | null => {
  if (typeof document === "undefined" || !document.fonts) {
    return null;
  }

  return document.fonts as FontFaceSet & {
    add?: (fontFace: FontFace) => void;
  };
};

const warnManifestFontIssue = (key: string, error: unknown): void => {
  if (warnedManifestFontKeys.has(key)) {
    return;
  }

  warnedManifestFontKeys.add(key);
  console.warn(`[hyperframes-manifest-fonts] ${key}`, error);
};

const resolveManifestFontUrl = (font: ManifestFontDefinition | undefined): string | null => {
  if (!font) {
    return null;
  }

  if (typeof font.browserUrl === "string" && font.browserUrl.trim()) {
    return font.browserUrl.trim();
  }

  const bestSource = [...(Array.isArray(font.sources) ? font.sources : [])]
    .filter((source) => typeof source.publicPath === "string" && source.publicPath.trim().length > 0)
    .sort((left, right) => {
      const leftRank = FORMAT_PRIORITY[left.format] ?? 99;
      const rightRank = FORMAT_PRIORITY[right.format] ?? 99;
      return leftRank - rightRank;
    })[0];

  return bestSource?.publicPath?.trim() ?? null;
};

const toManifestFontKey = (family: string, fontUrl: string): string => {
  return `${family}:${fontUrl}`;
};

const getManifestFonts = (
  manifest?: HyperframesPreviewManifest | null
): Array<{family: string; fontUrl: string}> => {
  const primaryFont = manifest?.typography?.primaryFont;
  const secondaryFont = manifest?.typography?.secondaryFont;

  return [primaryFont, secondaryFont]
    .filter((font): font is ManifestFontDefinition => Boolean(font && font.family))
    .map((font) => ({
      family: font.family,
      fontUrl: resolveManifestFontUrl(font) ?? ""
    }))
    .filter((font) => font.fontUrl.length > 0);
};

const loadManifestFont = async ({
  family,
  fontUrl,
  fontFaceSet
}: {
  family: string;
  fontUrl: string;
  fontFaceSet: FontFaceSet & {add?: (fontFace: FontFace) => void};
}): Promise<void> => {
  const key = toManifestFontKey(family, fontUrl);
  if (loadedManifestFontKeys.has(key)) {
    return;
  }

  if (typeof FontFace !== "function") {
    loadedManifestFontKeys.add(key);
    return;
  }

  if (typeof document !== "undefined" && document.fonts?.check(`1em "${family}"`)) {
    loadedManifestFontKeys.add(key);
    return;
  }

  const fontFace = new FontFace(family, `url(${fontUrl})`);
  const loadedFace = await fontFace.load();
  fontFaceSet.add?.(loadedFace);
  loadedManifestFontKeys.add(key);
};

export const loadManifestFontsForManifest = async (
  manifest?: HyperframesPreviewManifest | null
): Promise<void> => {
  const fonts = getManifestFonts(manifest);
  if (fonts.length === 0) {
    return;
  }

  const fontFaceSet = getFontFaceSet();
  if (!fontFaceSet) {
    return;
  }

  const loadKey = fonts.map((font) => toManifestFontKey(font.family, font.fontUrl)).join("|");
  const existingLoad = pendingManifestFontLoads.get(loadKey);
  if (existingLoad) {
    await existingLoad;
    return;
  }

  const fontLoad = (async () => {
    try {
      await Promise.all(fonts.map((font) => loadManifestFont({
        family: font.family,
        fontUrl: font.fontUrl,
        fontFaceSet
      })));
    } catch (error) {
      warnManifestFontIssue(loadKey, error);
    }
  })();

  pendingManifestFontLoads.set(loadKey, fontLoad);

  try {
    await fontLoad;
  } finally {
    pendingManifestFontLoads.delete(loadKey);
  }
};

export const resolveHyperframesFontFamily = ({
  manifest,
  trackType
}: {
  manifest?: HyperframesPreviewManifest | null;
  trackType: string;
}): string => {
  const primaryFamily = manifest?.typography?.primaryFont?.family?.trim() ?? "";
  const secondaryFamily = manifest?.typography?.secondaryFont?.family?.trim() ?? "";

  if (trackType === "text") {
    return primaryFamily || secondaryFamily;
  }

  return secondaryFamily || primaryFamily;
};
