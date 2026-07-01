import type {UnifiedRenderManifest} from '@prometheus/shared-types';

export type MatteRenderContract = {
  available: boolean;
  matteUrl: string | null;
  fps: number;
  durationFrames: number;
  planeZ: number;
  planeHeight: number;
  premultipliedAlpha: boolean;
  fallbackTags: string[];
};

const isLocalFileUrl = (value: string) => /^file:\/\//i.test(value);
const isLocalAbsolutePath = (value: string) => /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value);
const isBrowserSafeMatteUrl = (value: string): boolean =>
  (/^https?:\/\//i.test(value) || value.startsWith('/')) && !isLocalFileUrl(value) && !isLocalAbsolutePath(value);

export const resolveMatteRenderContract = (
  manifest: Pick<UnifiedRenderManifest, 'source' | 'fps' | 'durationFrames' | 'matte'> & {jobId?: string},
): MatteRenderContract => {
  const matteUrl = manifest.source.matteUrl;
  const available = Boolean(matteUrl && isBrowserSafeMatteUrl(matteUrl));

  return {
    available,
    matteUrl: available ? matteUrl ?? null : null,
    fps: manifest.matte?.fps ?? manifest.fps,
    durationFrames: manifest.matte?.durationInFrames ?? manifest.durationFrames,
    planeZ: manifest.matte?.planeZ ?? 0,
    planeHeight: manifest.matte?.planeHeight ?? 9,
    premultipliedAlpha: manifest.matte?.premultipliedAlpha ?? true,
    fallbackTags: available ? [] : ['compiler_matte_unavailable'],
  };
};

export const matteLumaToAlpha = (rgba: Uint8ClampedArray, offset: number): number => {
  const red = rgba[offset] ?? 0;
  const green = rgba[offset + 1] ?? 0;
  const blue = rgba[offset + 2] ?? 0;
  return Math.max(0, Math.min(255, Math.round(red * 0.299 + green * 0.587 + blue * 0.114)));
};

export const applyMatteAlphaToRgba = ({
  source,
  matte,
}: {
  source: Uint8ClampedArray;
  matte?: Uint8ClampedArray;
}): Uint8ClampedArray => {
  const output = new Uint8ClampedArray(source);
  if (!matte) {
    return output;
  }

  for (let offset = 0; offset < output.length; offset += 4) {
    output[offset + 3] = matteLumaToAlpha(matte, offset);
  }

  return output;
};
