import type {
  MaulResolvedFontAsset,
  MaulUnifiedShortRenderManifest,
} from "@prometheus/shared-types";

import {resolveMaulFontReceipt} from "./font-asset-resolution.js";

type PlannedTextRecordWithFonts = {
  font?: {
    assetId?: string;
    browserUrl?: string;
    localFileSha256?: string;
    localFilePath?: string;
  };
  accentFont?: MaulResolvedFontAsset | null;
};

const isCompleteFontReceipt = (
  value: PlannedTextRecordWithFonts["font"] | null | undefined,
): value is MaulResolvedFontAsset => Boolean(
  value &&
  value.assetId &&
  value.browserUrl &&
  value.localFileSha256 &&
  value.localFilePath,
);

const plannedTextRecordsFor = (
  manifest: MaulUnifiedShortRenderManifest,
): readonly PlannedTextRecordWithFonts[] => {
  if (manifest.schemaVersion === "maul-unified-short-render-manifest/v1") {
    return [];
  }
  const typography = manifest.plans.typographyMotion.fontResolution;
  return [{
    font: typography.selectedAsset ?? undefined,
    accentFont: typography.accentAsset ?? undefined,
  }];
};

export const validateMaulRenderFontReceipts = (
  manifest: MaulUnifiedShortRenderManifest,
  {remotionPublicDir}: {remotionPublicDir: string},
): void => {
  const uniqueAssets = new Map<string, MaulResolvedFontAsset>();
  for (const record of plannedTextRecordsFor(manifest)) {
    if (isCompleteFontReceipt(record.font)) {
      uniqueAssets.set(record.font.assetId, record.font);
    }
    if (record.accentFont) {
      uniqueAssets.set(record.accentFont.assetId, record.accentFont);
    }
  }
  for (const asset of uniqueAssets.values()) {
    try {
      resolveMaulFontReceipt(asset, {remotionPublicDir});
    } catch (error) {
      throw new Error(
        `MAUL render font preflight failed for ${asset.assetId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
};
