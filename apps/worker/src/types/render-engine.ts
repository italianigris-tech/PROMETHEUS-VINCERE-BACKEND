import type {DeformationConfig, DeformationType} from "../engine/vertex-deformation.js";

export type TextRenderMode = "troika-glyph";

export type RenderEngineConfig = {
  renderMode: TextRenderMode;
  deformation: DeformationConfig;
  chrome: boolean;
};

export type RenderEngineManifestExtension = {
  renderEngine?: Partial<Omit<RenderEngineConfig, "renderMode">> & {renderMode?: string};
  textRenderMode?: string;
  textDeformation?: Partial<DeformationConfig>;
  chrome?: boolean;
};

export const DEFAULT_TEXT_DEFORMATION: DeformationConfig = {
  type: "explode",
  intensity: 0.35,
  frequency: 1,
  speed: 1.25,
  seed: 101
};

export const TEXT_DEFORMATION_EXAMPLES: Record<Exclude<DeformationType, "none">, DeformationConfig> = {
  explode: DEFAULT_TEXT_DEFORMATION,
  wave: {type: "wave", intensity: 0.25, frequency: 2.4, speed: 1.1, seed: 17},
  ripple: {type: "ripple", intensity: 0.3, frequency: 1.7, speed: 1.4, seed: 29},
  shatter: {type: "shatter", intensity: 0.45, frequency: 1, speed: 1.8, seed: 43}
};

export const normalizeTextRenderMode = (_mode?: string): TextRenderMode => "troika-glyph";

export const getRenderEngineConfig = (
  manifest: RenderEngineManifestExtension
): RenderEngineConfig => {
  const renderEngine = manifest.renderEngine;
  return {
    renderMode: normalizeTextRenderMode(renderEngine?.renderMode ?? manifest.textRenderMode),
    chrome: renderEngine?.chrome ?? manifest.chrome ?? false,
    deformation: {
      ...DEFAULT_TEXT_DEFORMATION,
      ...manifest.textDeformation,
      ...renderEngine?.deformation
    }
  };
};
