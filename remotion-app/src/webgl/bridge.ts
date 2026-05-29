import {getGPUFramePayload, type CompiledRenderGraph, type GPUFrameData} from "../lib/render-graph";

export type BuildGPUFrameDataInput = {
  graph: CompiledRenderGraph;
  frame: number;
};

const freezeGPUFrameData = (frameData: GPUFrameData): GPUFrameData => {
  for (const layer of frameData.layers) {
    Object.freeze(layer.transform);
    Object.freeze(layer);
  }

  if (frameData.camera) {
    Object.freeze(frameData.camera.transform);
    Object.freeze(frameData.camera);
  }

  Object.freeze(frameData.layers);
  return Object.freeze(frameData);
};

export const buildGPUFrameData = ({
  graph,
  frame
}: BuildGPUFrameDataInput): GPUFrameData => {
  return freezeGPUFrameData(getGPUFramePayload(graph, frame));
};
