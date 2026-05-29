import type React from "react";

export type RenderIntervalType = "text" | "video" | "overlay" | "camera";

export type RenderScalarInstruction = number | {
  from: number;
  to: number;
  easing?: string;
};

export type TransformState = {
  translateX?: RenderScalarInstruction;
  translateY?: RenderScalarInstruction;
  scale?: RenderScalarInstruction;
  rotateDeg?: RenderScalarInstruction;
  transformOrigin?: string;
  easing?: string;
};

export type ResolvedTransformState = {
  translateX: number;
  translateY: number;
  scale: number;
  rotateDeg: number;
};

export type RenderInterval = {
  id: string;
  sourceLayerId: string;
  startFrame: number;
  endFrame: number;
  type: RenderIntervalType;
  zIndex: number;
  label: string;
  state: {
    transform?: TransformState;
    opacity?: number;
    scale?: number;
    motionPreset?: string;
    opacityRange?: RenderScalarInstruction;
    sharpOpacityRange?: RenderScalarInstruction;
    blurredOpacityRange?: RenderScalarInstruction;
  };
  metadata?: Record<string, unknown>;
};

export type RenderGraphWindow = {
  startFrame: number;
  endFrame: number;
};

export type CompiledRenderGraph = {
  schemaVersion: "render-graph/v1";
  fps: number;
  durationInFrames?: number;
  intervals: RenderInterval[];
  window: RenderGraphWindow | null;
};

export type RenderGraphTimelineLayer = {
  id: string;
  kind: string;
  mediaKind: string;
  label: string;
  startMs: number;
  endMs: number;
  zIndex: number;
  visual: boolean;
  opacity?: number;
  transform?: {
    translateX?: number;
    translateY?: number;
    scale?: number;
    rotateDeg?: number;
  };
  easing?: {
    enter?: string;
    exit?: string;
  };
  styleMetadata?: Record<string, unknown>;
  exportMetadata?: Record<string, unknown>;
};

export type RenderGraphCompileInput = {
  fps: number;
  durationInFrames?: number;
  layers: RenderGraphTimelineLayer[];
  focusFrame: number;
  windowSeconds?: number;
};

export type RenderGraphSchedule = (work: () => void) => () => void;

export type RenderGraphIncrementalCompileInput = RenderGraphCompileInput & {
  chunkSize?: number;
  schedule?: RenderGraphSchedule;
  onGraph: (graph: CompiledRenderGraph) => void;
};

export type RenderGraphCompilationJob = {
  cancel: () => void;
};

export type RenderIntervalResolver = {
  resolveFrame: (frame: number) => RenderInterval[];
};

export type EngineDriverFrameSource = {
  getFrame: () => number;
  subscribe: (listener: (frame: number) => void) => () => void;
};

export type EngineDriverMode = "preview" | "export";

export type EngineDriverIntervalState = {
  mode: EngineDriverMode;
  graph: CompiledRenderGraph;
  sourceLayerId: string;
  frame?: number;
  frameSource?: EngineDriverFrameSource;
  textLayer?: "sharp" | "blurred";
};

export type EngineDriverStyleResult = {
  interval: RenderInterval | null;
  style: React.CSSProperties;
  applyTo: (node: HTMLElement) => void;
};

export type LayoutState = {
  measured: false;
  bounds: null;
} | {
  measured: true;
  bounds: DOMRect;
};

export type GPUFrameLayerData = {
  sourceLayerId: string;
  type: Exclude<RenderIntervalType, "camera">;
  depth: number;
  transform: ResolvedTransformState;
  opacity: number;
};

export type GPUCameraData = {
  sourceLayerId: string;
  transform: ResolvedTransformState;
  opacity: number;
} | null;

export type GPUFrameData = {
  frame: number;
  layers: GPUFrameLayerData[];
  camera: GPUCameraData;
};
