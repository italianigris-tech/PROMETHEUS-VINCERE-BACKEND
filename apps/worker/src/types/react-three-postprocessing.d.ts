declare module "@react-three/postprocessing" {
  import type {ComponentType, ReactNode} from "react";
  import type {Effect} from "postprocessing";
  import type {Vector2} from "three";

  export const EffectComposer: ComponentType<{
    children?: ReactNode;
    multisampling?: number;
    resolutionScale?: number;
  }>;

  export const SelectiveBloom: ComponentType<{
    intensity?: number;
    luminanceThreshold?: number;
    luminanceSmoothing?: number;
    mipmapBlur?: boolean;
    radius?: number;
    resolutionScale?: number;
    selectionLayer?: number;
  }>;

  export const Bloom: ComponentType<{
    intensity?: number;
    luminanceThreshold?: number;
    luminanceSmoothing?: number;
    mipmapBlur?: boolean;
    radius?: number;
  }>;

  export const ChromaticAberration: ComponentType<{
    offset?: Vector2;
    radialModulation: boolean;
    modulationOffset: number;
  }>;

  export const Vignette: ComponentType<{
    darkness?: number;
    offset?: number;
  }>;

  export function wrapEffect(effect: new () => Effect): ComponentType<Record<string, never>>;
}
