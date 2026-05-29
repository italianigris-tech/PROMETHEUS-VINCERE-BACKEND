import {
  resolveIntervalOpacityAtFrame,
  resolveIntervalTransformAtFrame
} from "./driver";
import {getRenderIntervalResolver} from "./resolver";
import type {CompiledRenderGraph, GPUFrameData, RenderInterval} from "./types";

const isGPULayerInterval = (
  interval: RenderInterval
): interval is RenderInterval & {type: "text" | "video" | "overlay"} => interval.type !== "camera";

export const getGPUFramePayload = (
  graph: CompiledRenderGraph,
  frame: number
): GPUFrameData => {
  const intervals = getRenderIntervalResolver(graph).resolveFrame(frame);
  const cameraInterval = intervals.find((interval) => interval.type === "camera") ?? null;

  return {
    frame: Math.round(frame),
    layers: intervals
      .filter(isGPULayerInterval)
      .map((interval) => ({
        sourceLayerId: interval.sourceLayerId,
        type: interval.type,
        depth: interval.zIndex,
        transform: resolveIntervalTransformAtFrame(interval, frame),
        opacity: resolveIntervalOpacityAtFrame({interval, frame})
      })),
    camera: cameraInterval
      ? {
        sourceLayerId: cameraInterval.sourceLayerId,
        transform: resolveIntervalTransformAtFrame(cameraInterval, frame),
        opacity: resolveIntervalOpacityAtFrame({
          interval: cameraInterval,
          frame
        })
      }
      : null
  };
};
