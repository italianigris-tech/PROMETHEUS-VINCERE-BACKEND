import {loadEditorialCaptionFonts} from "../lib/cinematic-typography/editorial-fonts";
import {
  getBundledRuntimeFontRegistry,
  getRuntimeFontCssFamily,
  getRuntimeFontFormatLabel,
  type RuntimeFontAssetRecord
} from "../lib/font-intelligence/font-runtime-registry";

export const FONT_SYSTEM_READY = "FONT_SYSTEM_READY";

type FontPreloadSource = "editorial-google" | "runtime-family" | "runtime-alias";

export type FontPreloadCheck = {
  family: string;
  spec: string;
  source: FontPreloadSource;
  ready: boolean;
};

export type FontPreloadFailure = {
  family: string;
  source: FontPreloadSource;
  reason: string;
};

export type FontPreloadBootstrapResult = {
  stage: typeof FONT_SYSTEM_READY;
  ready: boolean;
  timestamp: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  checkedFonts: FontPreloadCheck[];
  failures: FontPreloadFailure[];
  preloadedFamilies: string[];
  runtimeRecordCount: number;
};

declare global {
  interface Window {
    __RENDER_DEBUG__?: boolean;
    __PROMETHEUS_FONT_SYSTEM_READY__?: FontPreloadBootstrapResult;
  }
}

type FontFaceSetLike = {
  add?: (fontFace: FontFace) => void;
  load?: (font: string, text?: string) => Promise<FontFace[]>;
  check?: (font: string, text?: string) => boolean;
  ready?: Promise<FontFaceSet>;
};

const EDITORIAL_CAPTION_FAMILIES = [
  "DM Sans",
  "Fraunces",
  "Playfair Display",
  "Cormorant Garamond",
  "Crimson Pro",
  "Lora",
  "Instrument Serif",
  "Noto Serif Display"
] as const;

const EDITORIAL_CAPTION_WEIGHTS = [400, 500, 600, 700, 800] as const;
const loadedRuntimeFontFaceKeys = new Set<string>();
let latestFontSystemReady: FontPreloadBootstrapResult | null = null;

const getTimestamp = (now?: () => number): number => (
  now ? now() : typeof performance !== "undefined" ? performance.now() : Date.now()
);

const getFontFaceSet = (): FontFaceSetLike | null => {
  if (typeof document === "undefined" || !document.fonts) {
    return null;
  }

  return document.fonts as FontFaceSetLike;
};

const quoteFontFamily = (family: string): string =>
  `"${family.replace(/(["\\])/g, "\\$1")}"`;

const buildFontSpec = (family: string, weight = 400, style = "normal"): string =>
  `${style === "normal" ? "" : `${style} `}${weight} 1em ${quoteFontFamily(family)}`.trim();

const addUnique = (values: Set<string>, value: string): void => {
  const normalized = value.trim();
  if (normalized) {
    values.add(normalized);
  }
};

const isRenderDebugEnabled = (): boolean =>
  typeof window !== "undefined" && window.__RENDER_DEBUG__ === true;

const logFontSystemGroup = (label: string, payload: unknown, level: "info" | "warn" = "info"): void => {
  if (!isRenderDebugEnabled()) {
    return;
  }

  console.groupCollapsed(`[FONT_SYSTEM] ${label}`);
  console[level](payload);
  console.groupEnd();
};

const preloadEditorialGoogleFonts = async (
  fontFaceSet: FontFaceSetLike,
  failures: FontPreloadFailure[]
): Promise<void> => {
  loadEditorialCaptionFonts();

  if (!fontFaceSet.load) {
    failures.push({
      family: "editorial-google",
      source: "editorial-google",
      reason: "document.fonts.load is unavailable"
    });
    return;
  }

  await Promise.all(EDITORIAL_CAPTION_FAMILIES.flatMap((family) => (
    EDITORIAL_CAPTION_WEIGHTS.map(async (weight) => {
      const spec = buildFontSpec(family, weight);
      try {
        await fontFaceSet.load?.(spec);
      } catch (error) {
        failures.push({
          family,
          source: "editorial-google",
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    })
  )));
};

const buildRuntimeFontFaceKey = (
  family: string,
  record: RuntimeFontAssetRecord
): string => [
  family,
  record.publicUrl,
  record.weight ?? 400,
  record.style
].join(":");

const loadRuntimeRecordForFamily = async ({
  family,
  record,
  fontFaceSet,
  source,
  failures
}: {
  family: string;
  record: RuntimeFontAssetRecord;
  fontFaceSet: FontFaceSetLike;
  source: FontPreloadSource;
  failures: FontPreloadFailure[];
}): Promise<void> => {
  if (typeof FontFace !== "function") {
    failures.push({
      family,
      source,
      reason: "FontFace API is unavailable"
    });
    return;
  }

  const key = buildRuntimeFontFaceKey(family, record);
  if (loadedRuntimeFontFaceKeys.has(key)) {
    return;
  }

  try {
    const fontFace = new FontFace(
      family,
      `url("${record.publicUrl}") format("${getRuntimeFontFormatLabel(record.format)}")`,
      {
        weight: String(record.weight ?? 400),
        style: record.style,
        display: "block"
      }
    );
    const loadedFace = await fontFace.load();
    fontFaceSet.add?.(loadedFace);
    loadedRuntimeFontFaceKeys.add(key);
  } catch (error) {
    failures.push({
      family,
      source,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
};

const preloadRuntimeRegistryFonts = async (
  fontFaceSet: FontFaceSetLike,
  failures: FontPreloadFailure[]
): Promise<Set<string>> => {
  const families = new Set<string>();
  const registry = getBundledRuntimeFontRegistry();

  await Promise.all(registry.records.flatMap((record) => {
    const rawFamily = record.familyName;
    const aliasFamily = getRuntimeFontCssFamily(record);
    addUnique(families, rawFamily);
    addUnique(families, aliasFamily);

    return [
      loadRuntimeRecordForFamily({
        family: rawFamily,
        record,
        fontFaceSet,
        source: "runtime-family",
        failures
      }),
      loadRuntimeRecordForFamily({
        family: aliasFamily,
        record,
        fontFaceSet,
        source: "runtime-alias",
        failures
      })
    ];
  }));

  return families;
};

const buildFontChecks = (
  runtimeFamilies: Set<string>,
  fontFaceSet: FontFaceSetLike | null
): FontPreloadCheck[] => {
  if (!fontFaceSet?.check) {
    return [];
  }

  const editorialChecks: FontPreloadCheck[] = EDITORIAL_CAPTION_FAMILIES.map((family) => {
    const spec = buildFontSpec(family, family === "DM Sans" ? 700 : 400);
    return {
      family,
      spec,
      source: "editorial-google",
      ready: fontFaceSet.check?.(spec) === true
    };
  });

  const runtimeChecks: FontPreloadCheck[] = [...runtimeFamilies].map((family) => {
    const spec = buildFontSpec(family);
    return {
      family,
      spec,
      source: family.startsWith("__prometheus_font_") ? "runtime-alias" : "runtime-family",
      ready: fontFaceSet.check?.(spec) === true
    };
  });

  return [...editorialChecks, ...runtimeChecks];
};

const emitFontSystemReady = (result: FontPreloadBootstrapResult): void => {
  latestFontSystemReady = result;

  if (typeof window === "undefined") {
    return;
  }

  window.__PROMETHEUS_FONT_SYSTEM_READY__ = result;
  window.dispatchEvent(new CustomEvent(FONT_SYSTEM_READY, {detail: result}));
};

const scheduleDocumentFontsReadyValidation = (
  fontFaceSet: FontFaceSetLike | null,
  checkedFonts: FontPreloadCheck[]
): void => {
  if (!fontFaceSet?.ready) {
    return;
  }

  void fontFaceSet.ready
    .then(() => {
      logFontSystemGroup("document.fonts.ready validation", {
        stage: "FONT_SYSTEM_READY_VALIDATION",
        checkedFonts
      });
    })
    .catch((error) => {
      logFontSystemGroup("document.fonts.ready validation failed", {
        stage: "FONT_SYSTEM_READY_VALIDATION",
        error: error instanceof Error ? error.message : String(error)
      }, "warn");
    });
};

export const getLatestFontSystemReady = (): FontPreloadBootstrapResult | null =>
  latestFontSystemReady ?? (
    typeof window !== "undefined" ? window.__PROMETHEUS_FONT_SYSTEM_READY__ ?? null : null
  );

export const subscribeToFontSystemReady = (
  listener: (result: FontPreloadBootstrapResult) => void,
  options: {replay?: boolean} = {}
): (() => void) => {
  if (options.replay) {
    const latest = getLatestFontSystemReady();
    if (latest) {
      listener(latest);
    }
  }

  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event): void => {
    listener((event as CustomEvent<FontPreloadBootstrapResult>).detail);
  };

  window.addEventListener(FONT_SYSTEM_READY, handler);
  return () => {
    window.removeEventListener(FONT_SYSTEM_READY, handler);
  };
};

export const preloadFontSystem = async ({
  now
}: {
  now?: () => number;
} = {}): Promise<FontPreloadBootstrapResult> => {
  const startedAt = getTimestamp(now);
  const failures: FontPreloadFailure[] = [];
  const preloadedFamilies = new Set<string>();
  const fontFaceSet = getFontFaceSet();
  const runtimeRecordCount = getBundledRuntimeFontRegistry().records.length;

  try {
    if (!fontFaceSet) {
      failures.push({
        family: "font-face-set",
        source: "editorial-google",
        reason: "document.fonts is unavailable"
      });
    } else {
      await preloadEditorialGoogleFonts(fontFaceSet, failures);
      EDITORIAL_CAPTION_FAMILIES.forEach((family) => addUnique(preloadedFamilies, family));

      const runtimeFamilies = await preloadRuntimeRegistryFonts(fontFaceSet, failures);
      runtimeFamilies.forEach((family) => addUnique(preloadedFamilies, family));
    }
  } catch (error) {
    failures.push({
      family: "font-system",
      source: "editorial-google",
      reason: error instanceof Error ? error.message : String(error)
    });
  }

  const checkedFonts = buildFontChecks(preloadedFamilies, fontFaceSet);
  const failedChecks = checkedFonts
    .filter((check) => !check.ready)
    .map((check): FontPreloadFailure => ({
      family: check.family,
      source: check.source,
      reason: `document.fonts.check failed for ${check.spec}`
    }));
  const completedAt = getTimestamp(now);
  const result: FontPreloadBootstrapResult = {
    stage: FONT_SYSTEM_READY,
    ready: failures.length === 0 && failedChecks.length === 0,
    timestamp: completedAt,
    startedAt,
    completedAt,
    durationMs: Math.max(0, completedAt - startedAt),
    checkedFonts,
    failures: [...failures, ...failedChecks],
    preloadedFamilies: [...preloadedFamilies].sort(),
    runtimeRecordCount
  };

  if (!result.ready) {
    console.error("FONT_SYSTEM_NOT_READY_AT_BOOTSTRAP", result);
  }

  logFontSystemGroup(FONT_SYSTEM_READY, result, result.ready ? "info" : "warn");
  scheduleDocumentFontsReadyValidation(fontFaceSet, checkedFonts);
  emitFontSystemReady(result);

  return result;
};
