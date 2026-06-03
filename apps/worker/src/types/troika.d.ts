declare module "troika-three-text" {
  import type {Material, Mesh} from "three";

  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    anchorX: "left" | "center" | "right" | number | string;
    anchorY:
      | "top"
      | "top-baseline"
      | "top-cap"
      | "top-ex"
      | "middle"
      | "bottom-baseline"
      | "bottom"
      | number
      | string;
    color: string | number;
    fillOpacity: number;
    glyphGeometryDetail: number;
    letterSpacing: number;
    lineHeight: number | "normal";
    material: Material | Material[];
    maxWidth: number;
    overflowWrap: "normal" | "break-word";
    sdfGlyphSize: number;
    whiteSpace: "normal" | "nowrap";
    sync(callback?: () => void): void;
    dispose(): void;
  }

  export function preloadFont(
    options: {
      font?: string | null;
      characters?: string | string[];
      sdfGlyphSize?: number;
    },
    callback?: (info: {glyphAtlasIndices?: unknown[]}) => void
  ): void;
}

declare module "troika-three-utils" {
  import type {Material} from "three";

  export function createDerivedMaterial<TMaterial extends Material>(
    baseMaterial: TMaterial,
    options: {
      chained?: boolean;
      extensions?: Record<string, boolean>;
      uniforms?: Record<string, {value: unknown}>;
      defines?: Record<string, string | number | boolean>;
      vertexDefs?: string;
      vertexTransform?: string;
      fragmentDefs?: string;
      fragmentColorTransform?: string;
      customRewriter?: (input: {vertexShader: string; fragmentShader: string}) => {
        vertexShader: string;
        fragmentShader: string;
      };
    }
  ): TMaterial & {
    uniforms: Record<string, {value: unknown}>;
    baseMaterial: Material;
    getDepthMaterial?: () => Material;
    getDistanceMaterial?: () => Material;
  };
}

declare module "three/examples/jsm/postprocessing/EffectComposer.js" {
  import type {Camera, Scene, WebGLRenderer} from "three";

  export class EffectComposer {
    constructor(renderer: WebGLRenderer);
    addPass(pass: unknown): void;
    setSize(width: number, height: number): void;
    setPixelRatio(pixelRatio: number): void;
    render(deltaTime?: number): void;
    dispose(): void;
  }
}

declare module "three/examples/jsm/postprocessing/RenderPass.js" {
  import type {Camera, Scene} from "three";

  export class RenderPass {
    constructor(scene: Scene, camera: Camera);
  }
}

declare module "three/examples/jsm/postprocessing/UnrealBloomPass.js" {
  import type {Vector2} from "three";

  export class UnrealBloomPass {
    threshold: number;
    strength: number;
    radius: number;
    constructor(resolution: Vector2, strength?: number, radius?: number, threshold?: number);
  }
}

declare module "three/examples/jsm/postprocessing/ShaderPass.js" {
  export class ShaderPass {
    uniforms: Record<string, {value: unknown}>;
    constructor(shader: unknown);
  }
}

declare module "three/examples/jsm/postprocessing/AfterimagePass.js" {
  export class AfterimagePass {
    uniforms: Record<string, {value: unknown}>;
    constructor(damp?: number);
  }
}

declare module "three/examples/jsm/shaders/RGBShiftShader.js" {
  export const RGBShiftShader: unknown;
}
