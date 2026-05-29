import {useEffect, useRef} from "react";

import type {CompiledRenderGraph, EngineDriverFrameSource, GPUFrameData} from "../lib/render-graph";
import {buildGPUFrameData} from "./bridge";
import {createGPUAugmentationRenderer, type GPUAugmentationRenderer} from "./renderer";

type GPUFrameRenderer = {
  renderFrame: (frameData: GPUFrameData) => void;
};

export type CreateGPUAugmenterFrameHandlerInput = {
  graph: CompiledRenderGraph;
  renderer: GPUFrameRenderer;
};

export type UseGPUAugmenterInput = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  enabled: boolean;
  graph: CompiledRenderGraph;
  frameSource: EngineDriverFrameSource;
};

export const createGPUAugmenterFrameHandler = ({
  graph,
  renderer
}: CreateGPUAugmenterFrameHandlerInput): ((frame: number) => void) => {
  return (frame) => {
    renderer.renderFrame(buildGPUFrameData({
      graph,
      frame
    }));
  };
};

const resizeRendererToCanvas = (
  canvas: HTMLCanvasElement,
  renderer: GPUAugmentationRenderer
): void => {
  const width = canvas.clientWidth || canvas.width || 1;
  const height = canvas.clientHeight || canvas.height || 1;
  renderer.resize(width, height);
};

export const useGPUAugmenter = ({
  canvasRef,
  enabled,
  graph,
  frameSource
}: UseGPUAugmenterInput): void => {
  const rendererRef = useRef<GPUAugmentationRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) {
      return;
    }

    const renderer = rendererRef.current ?? createGPUAugmentationRenderer();
    rendererRef.current = renderer;
    renderer.init(canvas);
    resizeRendererToCanvas(canvas, renderer);

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
        resizeRendererToCanvas(canvas, renderer);
      });

    resizeObserver?.observe(canvas);

    return () => {
      resizeObserver?.disconnect();
      renderer.dispose();
    };
  }, [canvasRef, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const renderer = rendererRef.current ?? createGPUAugmentationRenderer();
    rendererRef.current = renderer;
    const handleFrame = createGPUAugmenterFrameHandler({
      graph,
      renderer
    });

    handleFrame(frameSource.getFrame());
    return frameSource.subscribe(handleFrame);
  }, [enabled, frameSource, graph]);
};
