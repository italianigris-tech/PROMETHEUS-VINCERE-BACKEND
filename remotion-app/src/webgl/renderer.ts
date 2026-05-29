import * as THREE from "three";

import type {GPUFrameData, GPUFrameLayerData} from "../lib/render-graph";
import {
  GPU_AUGMENTATION_FRAGMENT_SHADER,
  GPU_AUGMENTATION_VERTEX_SHADER
} from "./shaders";

const MAX_GPU_AUGMENTATION_LAYERS = 32;
const TRANSFORM_STRIDE = 4;
const OPACITY_DEPTH_STRIDE = 4;

export type GPUUniform<TValue> = {
  value: TValue;
};

export type GPUUniformState = {
  layerCount: GPUUniform<number>;
  layerTransforms: GPUUniform<Float32Array>;
  layerOpacityDepth: GPUUniform<Float32Array>;
  cameraTransform: GPUUniform<Float32Array>;
  glowStrength: GPUUniform<number>;
  blurRadius: GPUUniform<number>;
  lightingStrength: GPUUniform<number>;
  resolution: GPUUniform<Float32Array>;
};

export type GPUAugmentationBackend = {
  initialize: (canvas: HTMLCanvasElement, uniforms: GPUUniformState) => void;
  resize: (width: number, height: number, uniforms: GPUUniformState) => void;
  render: (uniforms: GPUUniformState) => void;
  dispose: () => void;
};

export type GPUAugmentationRenderer = {
  init: (canvas: HTMLCanvasElement) => void;
  resize: (width: number, height: number) => void;
  renderFrame: (frameData: GPUFrameData) => void;
  dispose: () => void;
  getUniforms: () => GPUUniformState;
};

export const createGPUUniformState = (): GPUUniformState => ({
  layerCount: {value: 0},
  layerTransforms: {value: new Float32Array(MAX_GPU_AUGMENTATION_LAYERS * TRANSFORM_STRIDE)},
  layerOpacityDepth: {value: new Float32Array(MAX_GPU_AUGMENTATION_LAYERS * OPACITY_DEPTH_STRIDE)},
  cameraTransform: {value: new Float32Array(TRANSFORM_STRIDE)},
  glowStrength: {value: 0},
  blurRadius: {value: 0.12},
  lightingStrength: {value: 0.42},
  resolution: {value: new Float32Array([1, 1])}
});

const layerTypeCode = (layer: GPUFrameLayerData): number => {
  if (layer.type === "video") {
    return 2;
  }

  if (layer.type === "overlay") {
    return 3;
  }

  return 1;
};

export const updateGPUUniformsFromFrameData = (
  uniforms: GPUUniformState,
  frameData: GPUFrameData
): void => {
  const layerCount = Math.min(frameData.layers.length, MAX_GPU_AUGMENTATION_LAYERS);
  const layerTransforms = uniforms.layerTransforms.value;
  const layerOpacityDepth = uniforms.layerOpacityDepth.value;
  let opacityTotal = 0;

  layerTransforms.fill(0);
  layerOpacityDepth.fill(0);

  for (let index = 0; index < layerCount; index += 1) {
    const layer = frameData.layers[index];
    const transformOffset = index * TRANSFORM_STRIDE;
    const opacityDepthOffset = index * OPACITY_DEPTH_STRIDE;

    layerTransforms[transformOffset] = layer.transform.translateX;
    layerTransforms[transformOffset + 1] = layer.transform.translateY;
    layerTransforms[transformOffset + 2] = layer.transform.scale;
    layerTransforms[transformOffset + 3] = layer.transform.rotateDeg;
    layerOpacityDepth[opacityDepthOffset] = layer.opacity;
    layerOpacityDepth[opacityDepthOffset + 1] = layer.depth;
    layerOpacityDepth[opacityDepthOffset + 2] = layerTypeCode(layer);
    layerOpacityDepth[opacityDepthOffset + 3] = 1;
    opacityTotal += layer.opacity;
  }

  uniforms.layerCount.value = layerCount;
  uniforms.glowStrength.value = layerCount > 0 ? Math.min(1.4, 0.36 + opacityTotal / layerCount) : 0;

  const cameraTransform = uniforms.cameraTransform.value;
  if (frameData.camera) {
    cameraTransform[0] = frameData.camera.transform.translateX;
    cameraTransform[1] = frameData.camera.transform.translateY;
    cameraTransform[2] = frameData.camera.transform.scale;
    cameraTransform[3] = frameData.camera.transform.rotateDeg;
  } else {
    cameraTransform[0] = 0;
    cameraTransform[1] = 0;
    cameraTransform[2] = 1;
    cameraTransform[3] = 0;
  }
};

type ThreeUniformBag = {
  uResolution: {value: THREE.Vector2};
  uLayerCount: {value: number};
  uLayerTransforms: {value: THREE.Vector4[]};
  uLayerOpacityDepth: {value: THREE.Vector4[]};
  uCameraTransform: {value: THREE.Vector4};
  uGlowStrength: {value: number};
  uBlurRadius: {value: number};
  uLightingStrength: {value: number};
};

const createThreeUniformBag = (): ThreeUniformBag => ({
  uResolution: {value: new THREE.Vector2(1, 1)},
  uLayerCount: {value: 0},
  uLayerTransforms: {
    value: Array.from({length: MAX_GPU_AUGMENTATION_LAYERS}, () => new THREE.Vector4())
  },
  uLayerOpacityDepth: {
    value: Array.from({length: MAX_GPU_AUGMENTATION_LAYERS}, () => new THREE.Vector4())
  },
  uCameraTransform: {value: new THREE.Vector4(0, 0, 1, 0)},
  uGlowStrength: {value: 0},
  uBlurRadius: {value: 0.12},
  uLightingStrength: {value: 0.42}
});

const copyUniformStateToThreeUniforms = (
  source: GPUUniformState,
  target: ThreeUniformBag
): void => {
  target.uResolution.value.set(source.resolution.value[0], source.resolution.value[1]);
  target.uLayerCount.value = source.layerCount.value;
  target.uGlowStrength.value = source.glowStrength.value;
  target.uBlurRadius.value = source.blurRadius.value;
  target.uLightingStrength.value = source.lightingStrength.value;
  target.uCameraTransform.value.set(
    source.cameraTransform.value[0],
    source.cameraTransform.value[1],
    source.cameraTransform.value[2],
    source.cameraTransform.value[3]
  );

  for (let index = 0; index < MAX_GPU_AUGMENTATION_LAYERS; index += 1) {
    const transformOffset = index * TRANSFORM_STRIDE;
    const opacityDepthOffset = index * OPACITY_DEPTH_STRIDE;
    target.uLayerTransforms.value[index].set(
      source.layerTransforms.value[transformOffset],
      source.layerTransforms.value[transformOffset + 1],
      source.layerTransforms.value[transformOffset + 2],
      source.layerTransforms.value[transformOffset + 3]
    );
    target.uLayerOpacityDepth.value[index].set(
      source.layerOpacityDepth.value[opacityDepthOffset],
      source.layerOpacityDepth.value[opacityDepthOffset + 1],
      source.layerOpacityDepth.value[opacityDepthOffset + 2],
      source.layerOpacityDepth.value[opacityDepthOffset + 3]
    );
  }
};

export const createThreeGPUAugmentationBackend = (): GPUAugmentationBackend => {
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;
  let geometry: THREE.PlaneGeometry | null = null;
  let material: THREE.ShaderMaterial | null = null;
  const threeUniforms = createThreeUniformBag();

  return {
    initialize: (canvas, uniforms) => {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: false
      });
      renderer.setClearColor(0x000000, 0);
      scene = new THREE.Scene();
      camera = new THREE.Camera();
      geometry = new THREE.PlaneGeometry(2, 2);
      material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        uniforms: threeUniforms,
        vertexShader: GPU_AUGMENTATION_VERTEX_SHADER,
        fragmentShader: GPU_AUGMENTATION_FRAGMENT_SHADER
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      scene.add(mesh);
      copyUniformStateToThreeUniforms(uniforms, threeUniforms);
    },
    resize: (width, height, uniforms) => {
      uniforms.resolution.value[0] = Math.max(1, width);
      uniforms.resolution.value[1] = Math.max(1, height);
      renderer?.setSize(uniforms.resolution.value[0], uniforms.resolution.value[1], false);
      threeUniforms.uResolution.value.set(uniforms.resolution.value[0], uniforms.resolution.value[1]);
    },
    render: (uniforms) => {
      if (!renderer || !scene || !camera) {
        return;
      }

      copyUniformStateToThreeUniforms(uniforms, threeUniforms);
      renderer.render(scene, camera);
    },
    dispose: () => {
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      geometry = null;
      material = null;
      renderer = null;
      scene = null;
      camera = null;
    }
  };
};

export const createGPUAugmentationRenderer = ({
  backend = createThreeGPUAugmentationBackend()
}: {
  backend?: GPUAugmentationBackend;
} = {}): GPUAugmentationRenderer => {
  const uniforms = createGPUUniformState();
  let initialized = false;
  let unavailable = false;

  return {
    init: (canvas) => {
      if (initialized || unavailable) {
        return;
      }

      try {
        backend.initialize(canvas, uniforms);
        initialized = true;
      } catch {
        backend.dispose();
        unavailable = true;
      }
    },
    resize: (width, height) => {
      uniforms.resolution.value[0] = Math.max(1, width);
      uniforms.resolution.value[1] = Math.max(1, height);

      if (initialized) {
        backend.resize(uniforms.resolution.value[0], uniforms.resolution.value[1], uniforms);
      }
    },
    renderFrame: (frameData) => {
      updateGPUUniformsFromFrameData(uniforms, frameData);

      if (initialized) {
        backend.render(uniforms);
      }
    },
    dispose: () => {
      if (!initialized) {
        return;
      }

      backend.dispose();
      initialized = false;
      unavailable = false;
    },
    getUniforms: () => uniforms
  };
};
