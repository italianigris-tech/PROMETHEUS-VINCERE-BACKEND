import type {DeformationConfig} from "../engine/vertex-deformation.js";

export type TextRenderMode = "troika-glyph" | "canvas-raster";

export type RenderEngineConfig = {
  renderMode: TextRenderMode;
  deformation: DeformationConfig;
};

export type RenderEngineManifestExtension = {
  renderEngine?: Partial<RenderEngineConfig>;
  textRenderMode?: TextRenderMode;
  textDeformation?: Partial<DeformationConfig>;
};

export const DEFAULT_TEXT_DEFORMATION: DeformationConfig = {
  type: "explode",
  intensity: 0.35,
  frequency: 1,
  speed: 1.25,
  seed: 101
};

export const getRenderEngineConfig = (
  manifest: RenderEngineManifestExtension
): RenderEngineConfig => {
  const renderEngine = manifest.renderEngine;
  return {
    renderMode: renderEngine?.renderMode ?? manifest.textRenderMode ?? "troika-glyph",
    deformation: {
      ...DEFAULT_TEXT_DEFORMATION,
      ...manifest.textDeformation,
      ...renderEngine?.deformation
    }
  };
};
