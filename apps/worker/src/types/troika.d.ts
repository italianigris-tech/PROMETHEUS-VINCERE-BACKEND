declare module "troika-three-text" {
  import type {Color, Material, Mesh} from "three";

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
    colorRanges: Record<number, Color | number | string> | null;
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
  import type {Camera, Scene, Vector2, WebGLRenderer, WebGLRenderTarget} from "three";

  export class UnrealBloomPass {
    renderToScreen: boolean;
    threshold: number;
    strength: number;
    radius: number;
    constructor(resolution: Vector2, strength?: number, radius?: number, threshold?: number);
    setSize(width: number, height: number): void;
    render(
      renderer: WebGLRenderer,
      writeBuffer: WebGLRenderTarget,
      readBuffer: WebGLRenderTarget,
      deltaTime: number,
      maskActive: boolean
    ): void;
    dispose(): void;
  }
}

declare module "three/examples/jsm/postprocessing/ShaderPass.js" {
  import type {ShaderMaterial, WebGLRenderer, WebGLRenderTarget} from "three";

  export class ShaderPass {
    clear: boolean;
    material: ShaderMaterial;
    renderToScreen: boolean;
    uniforms: Record<string, {value: unknown}>;
    constructor(shader: unknown);
    render(
      renderer: WebGLRenderer,
      writeBuffer: WebGLRenderTarget,
      readBuffer: WebGLRenderTarget,
      deltaTime: number,
      maskActive: boolean
    ): void;
    dispose(): void;
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
