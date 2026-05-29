import {useEffect, useMemo, useRef, useState} from "react";

import {
  compileRenderGraphForWindow,
  compileRenderGraphIncrementally,
  type CompiledRenderGraph,
  type RenderGraphCompilationJob,
  type RenderGraphTimelineLayer
} from "../../lib/render-graph";
import type {PreviewFrameSource} from "../frame-store";

type UseHyperframesRenderGraphInput = {
  layers: RenderGraphTimelineLayer[];
  fps: number;
  durationInFrames: number;
  frameSource: PreviewFrameSource;
  resetKey: string;
  windowSeconds?: number;
};

const WINDOW_SECONDS = 10;
const RECENTER_THRESHOLD_SECONDS = 4;
const INCREMENTAL_CHUNK_SIZE = 48;

export const useHyperframesRenderGraph = ({
  layers,
  fps,
  durationInFrames,
  frameSource,
  resetKey,
  windowSeconds = WINDOW_SECONDS
}: UseHyperframesRenderGraphInput): CompiledRenderGraph => {
  const stableLayers = useMemo(() => layers, [layers]);
  const [graph, setGraph] = useState<CompiledRenderGraph>(() => compileRenderGraphForWindow({
    fps,
    durationInFrames,
    layers: stableLayers,
    focusFrame: frameSource.getFrame(),
    windowSeconds
  }));
  const graphRef = useRef(graph);
  const jobRef = useRef<RenderGraphCompilationJob | null>(null);
  const lastFocusFrameRef = useRef(frameSource.getFrame());

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    const startCompilation = (focusFrame: number): void => {
      lastFocusFrameRef.current = focusFrame;
      jobRef.current?.cancel();
      jobRef.current = compileRenderGraphIncrementally({
        fps,
        durationInFrames,
        layers: stableLayers,
        focusFrame,
        windowSeconds,
        chunkSize: INCREMENTAL_CHUNK_SIZE,
        onGraph: (nextGraph) => {
          graphRef.current = nextGraph;
          setGraph(nextGraph);
        }
      });
    };

    startCompilation(frameSource.getFrame());

    const unsubscribe = frameSource.subscribe((frame) => {
      const currentWindow = graphRef.current.window;
      if (!currentWindow) {
        return;
      }

      const thresholdFrames = Math.round(Math.max(1, fps) * RECENTER_THRESHOLD_SECONDS);
      const nearStart = frame <= currentWindow.startFrame + thresholdFrames;
      const nearEnd = frame >= currentWindow.endFrame - thresholdFrames;
      const farEnoughFromLastFocus = Math.abs(frame - lastFocusFrameRef.current) >= thresholdFrames;
      if ((nearStart || nearEnd) && farEnoughFromLastFocus) {
        startCompilation(frame);
      }
    });

    return () => {
      unsubscribe();
      jobRef.current?.cancel();
      jobRef.current = null;
    };
  }, [durationInFrames, fps, frameSource, resetKey, stableLayers, windowSeconds]);

  return graph;
};
