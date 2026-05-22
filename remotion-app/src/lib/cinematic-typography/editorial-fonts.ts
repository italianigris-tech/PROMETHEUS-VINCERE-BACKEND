import {
  getInfo as getCormorantGaramondInfo,
  loadFont as loadCormorantGaramond
} from "@remotion/google-fonts/CormorantGaramond";
import {
  getInfo as getCrimsonProInfo,
  loadFont as loadCrimsonPro
} from "@remotion/google-fonts/CrimsonPro";
import {
  getInfo as getDMSansInfo,
  loadFont as loadDMSans
} from "@remotion/google-fonts/DMSans";
import {
  getInfo as getFrauncesInfo,
  loadFont as loadFraunces
} from "@remotion/google-fonts/Fraunces";
import {
  getInfo as getInstrumentSerifInfo,
  loadFont as loadInstrumentSerif
} from "@remotion/google-fonts/InstrumentSerif";
import {
  getInfo as getLoraInfo,
  loadFont as loadLora
} from "@remotion/google-fonts/Lora";
import {
  getInfo as getNotoSerifDisplayInfo,
  loadFont as loadNotoSerifDisplay
} from "@remotion/google-fonts/NotoSerifDisplay";
import {
  getInfo as getPlayfairDisplayInfo,
  loadFont as loadPlayfairDisplay
} from "@remotion/google-fonts/PlayfairDisplay";
import {
  EDITORIAL_FONT_PALETTES,
  getEditorialFontPalette,
  getEditorialFontPalettesForRole,
  type EditorialFontPalette,
  type EditorialFontPaletteId
} from "./font-runtime-registry";

export {
  EDITORIAL_FONT_PALETTES,
  getEditorialFontPalette,
  getEditorialFontPalettesForRole
};

export type {
  EditorialFontPalette,
  EditorialFontPaletteId
};

const FONT_LOAD_OPTIONS = {
  subsets: ["latin"] as ("latin")[],
  ignoreTooManyRequestsWarning: true
};

const CORE_WEIGHTS = ["400", "500", "600", "700", "800"] as const;
const CORE_STYLES = ["normal", "italic"] as const;

type LegacyGoogleFontStyle = typeof CORE_STYLES[number];

type LegacyGoogleFontInfo = {
  fontFamily: string;
  fonts: Record<string, Record<string, Record<string, string>>>;
  subsets: string[];
};

type LegacyGoogleFontLoader = (
  style?: string,
  options?: {
    weights?: string[];
    subsets?: string[];
    document?: Document;
    ignoreTooManyRequestsWarning?: boolean;
  }
) => unknown;

type LegacyGoogleFontDefinition = {
  getInfo: () => LegacyGoogleFontInfo;
  loadFont: LegacyGoogleFontLoader;
};

let editorialFontsLoaded = false;
const editorialFontWarningKeys = new Set<string>();

const warnEditorialFontIssue = (key: string, message: string, details?: Record<string, unknown>): void => {
  if (editorialFontWarningKeys.has(key)) {
    return;
  }

  editorialFontWarningKeys.add(key);
  if (details) {
    console.warn("[editorial-font-loader]", message, details);
    return;
  }

  console.warn("[editorial-font-loader]", message);
};

const resolveNearestWeight = (
  requestedWeight: string,
  availableWeights: string[]
): string | null => {
  if (availableWeights.length === 0) {
    return null;
  }

  if (availableWeights.includes(requestedWeight)) {
    return requestedWeight;
  }

  const requested = Number.parseInt(requestedWeight, 10);
  if (!Number.isFinite(requested)) {
    return availableWeights[0] ?? null;
  }

  return [...availableWeights]
    .sort((left, right) => {
      const leftWeight = Number.parseInt(left, 10);
      const rightWeight = Number.parseInt(right, 10);
      const delta = Math.abs(leftWeight - requested) - Math.abs(rightWeight - requested);
      if (delta !== 0) {
        return delta;
      }

      return leftWeight - rightWeight;
    })[0] ?? null;
};

const resolveSafeLegacyFontVariant = (
  info: LegacyGoogleFontInfo,
  requestedStyle: LegacyGoogleFontStyle,
  requestedWeight: string
): {style: string; weight: string} | null => {
  const availableStyles = Object.keys(info.fonts).filter((style) => {
    const weights = info.fonts[style];
    return Boolean(weights && Object.keys(weights).length > 0);
  });

  if (availableStyles.length === 0) {
    return null;
  }

  const resolvedStyle = availableStyles.includes(requestedStyle)
    ? requestedStyle
    : (availableStyles.includes("normal") ? "normal" : availableStyles[0]!);
  const styleWeights = Object.keys(info.fonts[resolvedStyle] ?? {});
  const resolvedWeight = resolveNearestWeight(requestedWeight, styleWeights);

  if (!resolvedWeight) {
    return null;
  }

  return {
    style: resolvedStyle,
    weight: resolvedWeight
  };
};

const loadLegacyGoogleFontSafely = (
  definition: LegacyGoogleFontDefinition,
  requestedStyle: LegacyGoogleFontStyle,
  requestedWeight: string
): void => {
  const info = definition.getInfo();
  const resolvedVariant = resolveSafeLegacyFontVariant(info, requestedStyle, requestedWeight);

  if (!resolvedVariant) {
    warnEditorialFontIssue(
      `${info.fontFamily}:skip:${requestedStyle}:${requestedWeight}`,
      `Skipped legacy Google font '${info.fontFamily}' because no compatible style/weight could be resolved.`,
      {requestedStyle, requestedWeight}
    );
    return;
  }

  if (resolvedVariant.style !== requestedStyle || resolvedVariant.weight !== requestedWeight) {
    warnEditorialFontIssue(
      `${info.fontFamily}:fallback:${requestedStyle}:${requestedWeight}`,
      `Legacy Google font '${info.fontFamily}' fell back during preview bootstrap.`,
      {
        requestedStyle,
        requestedWeight,
        resolvedStyle: resolvedVariant.style,
        resolvedWeight: resolvedVariant.weight
      }
    );
  }

  try {
    definition.loadFont(resolvedVariant.style, {
      weights: [resolvedVariant.weight],
      subsets: FONT_LOAD_OPTIONS.subsets as string[],
      ignoreTooManyRequestsWarning: FONT_LOAD_OPTIONS.ignoreTooManyRequestsWarning
    });
  } catch (error) {
    warnEditorialFontIssue(
      `${info.fontFamily}:error:${requestedStyle}:${requestedWeight}`,
      `Legacy Google font '${info.fontFamily}' failed to load during preview bootstrap and was skipped.`,
      {
        requestedStyle,
        requestedWeight,
        resolvedStyle: resolvedVariant.style,
        resolvedWeight: resolvedVariant.weight,
        error: error instanceof Error ? error.message : String(error)
      }
    );
  }
};

const LEGACY_EDITORIAL_GOOGLE_FONTS: LegacyGoogleFontDefinition[] = [
  {getInfo: getFrauncesInfo, loadFont: loadFraunces as unknown as LegacyGoogleFontLoader},
  {getInfo: getPlayfairDisplayInfo, loadFont: loadPlayfairDisplay as unknown as LegacyGoogleFontLoader},
  {getInfo: getCormorantGaramondInfo, loadFont: loadCormorantGaramond as unknown as LegacyGoogleFontLoader},
  {getInfo: getCrimsonProInfo, loadFont: loadCrimsonPro as unknown as LegacyGoogleFontLoader},
  {getInfo: getLoraInfo, loadFont: loadLora as unknown as LegacyGoogleFontLoader},
  {getInfo: getInstrumentSerifInfo, loadFont: loadInstrumentSerif as unknown as LegacyGoogleFontLoader},
  {getInfo: getNotoSerifDisplayInfo, loadFont: loadNotoSerifDisplay as unknown as LegacyGoogleFontLoader},
  {getInfo: getDMSansInfo, loadFont: loadDMSans as unknown as LegacyGoogleFontLoader}
];

export const loadEditorialCaptionFonts = (): void => {
  if (editorialFontsLoaded) {
    return;
  }

  editorialFontsLoaded = true;

  for (const definition of LEGACY_EDITORIAL_GOOGLE_FONTS) {
    for (const weight of CORE_WEIGHTS) {
      for (const style of CORE_STYLES) {
        loadLegacyGoogleFontSafely(definition, style, weight);
      }
    }
  }
};
