declare module "@react-three/postprocessing" {
  import type {ComponentType, ReactNode} from "react";
  import type {Vector2} from "three";

  export const EffectComposer: ComponentType<{
    children?: ReactNode;
  }>;

  export const SelectiveBloom: ComponentType<{
    intensity?: number;
    luminanceThreshold?: number;
    luminanceSmoothing?: number;
    mipmapBlur?: boolean;
    selectionLayer?: number;
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
}
