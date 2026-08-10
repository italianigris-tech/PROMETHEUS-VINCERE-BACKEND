import type {
  MaulProfileTypographyRealization,
  MaulTypographyProfileColorResolution,
} from "@prometheus/shared-types";

const MINIMUM_CONTRAST_RATIO = 4.5;
const MINIMUM_LARGE_TEXT_CONTRAST_RATIO = 3;
const LARGE_TEXT_MINIMUM_SIZE_PX = 24;
const WHITE = "#FFFFFF";
const BLACK = "#111111";

export type TypographyBackgroundLuminanceGrid = {
  columns: number;
  rows: number;
  samples: readonly number[];
};

export type TypographyBackgroundBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const srgbToLinear = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const hexLuminance = (color: string): number | null => {
  const match = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const value = match[1]!;
  return (
    0.2126 * srgbToLinear(Number.parseInt(value.slice(0, 2), 16)) +
    0.7152 * srgbToLinear(Number.parseInt(value.slice(2, 4), 16)) +
    0.0722 * srgbToLinear(Number.parseInt(value.slice(4, 6), 16))
  );
};

export const contrastRatio = (
  firstLuminance: number,
  secondLuminance: number,
): number => {
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(3));
};

export const averageLuminanceForBox = ({
  grid,
  box,
}: {
  grid: TypographyBackgroundLuminanceGrid;
  box: TypographyBackgroundBox;
}): number | null => {
  if (
    grid.columns <= 0 ||
    grid.rows <= 0 ||
    grid.samples.length !== grid.columns * grid.rows
  ) {
    return null;
  }
  const samples: number[] = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const centerX = (column + 0.5) / grid.columns;
      const centerY = (row + 0.5) / grid.rows;
      if (
        centerX >= box.x &&
        centerX <= box.x + box.width &&
        centerY >= box.y &&
        centerY <= box.y + box.height
      ) {
        const sample = grid.samples[row * grid.columns + column]!;
        if (Number.isFinite(sample)) samples.push(sample);
      }
    }
  }
  if (samples.length === 0) return null;
  return Number(
    (samples.reduce((total, sample) => total + sample, 0) / samples.length).toFixed(4),
  );
};

export const resolveTypographyProfileColors = ({
  realization,
  backgroundLuminance,
}: {
  realization: MaulProfileTypographyRealization;
  backgroundLuminance: number | null | undefined;
}): MaulTypographyProfileColorResolution => {
  const resolvedBackground =
    backgroundLuminance !== undefined ? backgroundLuminance : null;
  let changedToLight = false;
  let changedToDark = false;
  const layers = realization.layers.map((layer) => {
    const minimumContrastRatio =
      layer.fontSizePx >= LARGE_TEXT_MINIMUM_SIZE_PX
        ? MINIMUM_LARGE_TEXT_CONTRAST_RATIO
        : MINIMUM_CONTRAST_RATIO;
    const requestedLuminance = hexLuminance(layer.color);
    const requestedContrast =
      resolvedBackground === null || requestedLuminance === null
        ? null
        : contrastRatio(requestedLuminance, resolvedBackground);
    if (resolvedBackground === null && requestedLuminance !== null) {
      // Default to high-visibility WHITE (#FFFFFF) for unspecified/dark studio background video proofing
      const resolvedColor = WHITE;
      if (resolvedColor !== layer.color) {
        changedToLight = true;
      }
      return {
        layerName: layer.layerName,
        requestedColor: layer.color,
        resolvedColor,
        contrastRatio: null,
      };
    }
    if (
      resolvedBackground === null ||
      requestedLuminance === null ||
      requestedContrast === null ||
      requestedContrast >= minimumContrastRatio
    ) {
      return {
        layerName: layer.layerName,
        requestedColor: layer.color,
        resolvedColor: layer.color,
        contrastRatio: requestedContrast,
      };
    }

    const lightContrast = contrastRatio(1, resolvedBackground);
    const darkContrast = contrastRatio(0.005, resolvedBackground);
    const resolvedColor = lightContrast >= darkContrast ? WHITE : BLACK;
    if (resolvedColor === WHITE) changedToLight = true;
    else changedToDark = true;
    return {
      layerName: layer.layerName,
      requestedColor: layer.color,
      resolvedColor,
      contrastRatio: Math.max(lightContrast, darkContrast),
    };
  });

  return {
    mode:
      changedToLight && !changedToDark
        ? "light_text"
        : changedToDark && !changedToLight
          ? "dark_text"
          : "profile",
    backgroundLuminance: resolvedBackground,
    layers,
  };
};

export type TypographyProfileTemporalColorResolution = {
  resolution: MaulTypographyProfileColorResolution;
  readable: boolean;
  minimumContrastRatio: number | null;
};

export const resolveTypographyProfileColorsAcrossSamples = ({
  realization,
  backgroundLuminances,
}: {
  realization: MaulProfileTypographyRealization;
  backgroundLuminances: readonly number[];
}): TypographyProfileTemporalColorResolution => {
  const samples = backgroundLuminances.filter(
    (sample) => Number.isFinite(sample) && sample >= 0 && sample <= 1,
  );
  if (samples.length === 0) {
    return {
      resolution: resolveTypographyProfileColors({
        realization,
        backgroundLuminance: null,
      }),
      readable: true,
      minimumContrastRatio: null,
    };
  }

  let changedToLight = false;
  let changedToDark = false;
  let readable = true;
  const selectedContrasts: number[] = [];
  const layers = realization.layers.map((layer) => {
    const minimumRequired =
      layer.fontSizePx >= LARGE_TEXT_MINIMUM_SIZE_PX
        ? MINIMUM_LARGE_TEXT_CONTRAST_RATIO
        : MINIMUM_CONTRAST_RATIO;
    const requestedLuminance = hexLuminance(layer.color);
    const requestedMinimum = requestedLuminance === null
      ? -1
      : Math.min(
          ...samples.map((sample) => contrastRatio(requestedLuminance, sample)),
        );
    if (requestedMinimum >= minimumRequired) {
      selectedContrasts.push(requestedMinimum);
      return {
        layerName: layer.layerName,
        requestedColor: layer.color,
        resolvedColor: layer.color,
        contrastRatio: requestedMinimum,
      };
    }

    const lightMinimum = Math.min(
      ...samples.map((sample) => contrastRatio(1, sample)),
    );
    const darkMinimum = Math.min(
      ...samples.map((sample) => contrastRatio(0.005, sample)),
    );
    const useLight = lightMinimum >= darkMinimum;
    const resolvedColor = useLight ? WHITE : BLACK;
    const selectedContrast = useLight ? lightMinimum : darkMinimum;
    if (useLight) changedToLight = true;
    else changedToDark = true;
    selectedContrasts.push(selectedContrast);
    if (selectedContrast < minimumRequired) readable = false;
    return {
      layerName: layer.layerName,
      requestedColor: layer.color,
      resolvedColor,
      contrastRatio: selectedContrast,
    };
  });
  const averageBackground = Number(
    (
      samples.reduce((total, sample) => total + sample, 0) / samples.length
    ).toFixed(4),
  );
  return {
    resolution: {
      mode:
        changedToLight && !changedToDark
          ? "light_text"
          : changedToDark && !changedToLight
            ? "dark_text"
            : "profile",
      backgroundLuminance: averageBackground,
      layers,
    },
    readable,
    minimumContrastRatio:
      selectedContrasts.length > 0 ? Math.min(...selectedContrasts) : null,
  };
};
