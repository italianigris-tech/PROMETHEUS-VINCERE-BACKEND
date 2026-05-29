import type {
  CompiledRenderGraph,
  RenderGraphCompileInput,
  RenderGraphCompilationJob,
  RenderGraphIncrementalCompileInput,
  RenderGraphSchedule,
  RenderGraphTimelineLayer,
  RenderGraphWindow,
  RenderInterval,
  RenderIntervalType,
  RenderScalarInstruction
} from "./types";

const DEFAULT_WINDOW_SECONDS = 10;
const DEFAULT_CHUNK_SIZE = 32;
const ENTRY_TRANSLATE_Y_PX = 22;
const ENTRY_SCALE = 0.94;

const normalizeFps = (fps: number): number => Number.isFinite(fps) && fps > 0 ? fps : 30;

const msToFrame = (ms: number, fps: number): number => Math.max(0, Math.round((ms / 1000) * normalizeFps(fps)));

const sortIntervals = (intervals: RenderInterval[]): RenderInterval[] => {
  return [...intervals].sort((left, right) => {
    if (left.startFrame !== right.startFrame) {
      return left.startFrame - right.startFrame;
    }
    if (left.zIndex !== right.zIndex) {
      return left.zIndex - right.zIndex;
    }
    return left.id.localeCompare(right.id);
  });
};

const getWindow = ({
  focusFrame,
  fps,
  windowSeconds
}: {
  focusFrame: number;
  fps: number;
  windowSeconds: number;
}): RenderGraphWindow => {
  const radiusFrames = Math.round(normalizeFps(fps) * windowSeconds);
  return {
    startFrame: Math.max(0, Math.round(focusFrame) - radiusFrames),
    endFrame: Math.max(0, Math.round(focusFrame) + radiusFrames)
  };
};

const layerOverlapsWindow = ({
  layer,
  fps,
  window
}: {
  layer: RenderGraphTimelineLayer;
  fps: number;
  window: RenderGraphWindow;
}): boolean => {
  const startFrame = msToFrame(layer.startMs, fps);
  const endFrame = Math.max(startFrame, msToFrame(layer.endMs, fps));
  return endFrame >= window.startFrame && startFrame <= window.endFrame;
};

const getTrackType = (layer: RenderGraphTimelineLayer): string => {
  const value = layer.styleMetadata?.["trackType"];
  return typeof value === "string" ? value : "";
};

const getRenderIntervalType = (layer: RenderGraphTimelineLayer): RenderIntervalType => {
  if (layer.kind === "motion-scene") {
    return "camera";
  }
  if (layer.mediaKind === "video") {
    return "video";
  }
  if (layer.kind === "caption" || getTrackType(layer) === "text" || layer.mediaKind === "none") {
    return "text";
  }
  return "overlay";
};

const shouldCompileLayer = (layer: RenderGraphTimelineLayer): boolean => {
  return layer.visual || layer.kind === "motion-scene";
};

const scalar = (from: number, to: number, easing: string): RenderScalarInstruction => ({
  from,
  to,
  easing
});

const compileLayerToInterval = ({
  layer,
  fps
}: {
  layer: RenderGraphTimelineLayer;
  fps: number;
}): RenderInterval | null => {
  if (!shouldCompileLayer(layer)) {
    return null;
  }

  const startFrame = msToFrame(layer.startMs, fps);
  const endFrame = Math.max(startFrame, msToFrame(layer.endMs, fps));
  const type = getRenderIntervalType(layer);
  const easing = layer.easing?.enter ?? "linear";
  const translateX = layer.transform?.translateX ?? 0;
  const translateY = layer.transform?.translateY ?? 0;
  const scaleTo = layer.transform?.scale ?? 1;
  const rotateDeg = layer.transform?.rotateDeg ?? 0;
  const opacity = layer.opacity ?? 1;
  const entryOffset = type === "text" || type === "overlay" || type === "video" ? ENTRY_TRANSLATE_Y_PX : 0;
  const entryScale = type === "camera" ? scaleTo : ENTRY_SCALE;

  return {
    id: `${type}:${layer.id}:${startFrame}-${endFrame}`,
    sourceLayerId: layer.id,
    startFrame,
    endFrame,
    type,
    zIndex: layer.zIndex,
    label: layer.label,
    state: {
      transform: {
        translateX: scalar(translateX, translateX, easing),
        translateY: scalar(translateY + entryOffset, translateY, easing),
        scale: scalar(entryScale, scaleTo, easing),
        rotateDeg: scalar(rotateDeg, rotateDeg, easing),
        transformOrigin: "center center",
        easing
      },
      opacity,
      scale: scaleTo,
      motionPreset: easing,
      opacityRange: type === "camera" ? opacity : scalar(0, opacity, easing),
      sharpOpacityRange: type === "text" ? scalar(0, 1, easing) : undefined,
      blurredOpacityRange: type === "text" ? scalar(1, 0, easing) : undefined
    },
    metadata: {
      mediaKind: layer.mediaKind,
      kind: layer.kind,
      styleMetadata: layer.styleMetadata ?? {},
      exportMetadata: layer.exportMetadata ?? {}
    }
  };
};

const compileLayers = ({
  fps,
  durationInFrames,
  layers,
  window
}: {
  fps: number;
  durationInFrames?: number;
  layers: RenderGraphTimelineLayer[];
  window: RenderGraphWindow | null;
}): CompiledRenderGraph => {
  const intervals = layers
    .map((layer) => compileLayerToInterval({layer, fps}))
    .filter((interval): interval is RenderInterval => interval !== null);

  return {
    schemaVersion: "render-graph/v1",
    fps: normalizeFps(fps),
    durationInFrames,
    intervals: sortIntervals(intervals),
    window
  };
};

export const compileRenderGraphForWindow = ({
  fps,
  durationInFrames,
  layers,
  focusFrame,
  windowSeconds = DEFAULT_WINDOW_SECONDS
}: RenderGraphCompileInput): CompiledRenderGraph => {
  const window = getWindow({focusFrame, fps, windowSeconds});
  const focusedLayers = layers.filter((layer) => layerOverlapsWindow({layer, fps, window}));

  return compileLayers({
    fps,
    durationInFrames,
    layers: focusedLayers,
    window
  });
};

const mergeRenderGraphs = (
  left: CompiledRenderGraph,
  right: CompiledRenderGraph
): CompiledRenderGraph => {
  const intervalById = new Map<string, RenderInterval>();
  [...left.intervals, ...right.intervals].forEach((interval) => {
    intervalById.set(interval.id, interval);
  });

  return {
    ...left,
    intervals: sortIntervals([...intervalById.values()])
  };
};

const requestIdleSchedule: RenderGraphSchedule = (work) => {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(() => {
      work();
    });
    return () => {
      window.cancelIdleCallback(handle);
    };
  }

  const handle = setTimeout(work, 0);
  return () => {
    clearTimeout(handle);
  };
};

export const compileRenderGraphIncrementally = ({
  fps,
  durationInFrames,
  layers,
  focusFrame,
  windowSeconds = DEFAULT_WINDOW_SECONDS,
  chunkSize = DEFAULT_CHUNK_SIZE,
  schedule = requestIdleSchedule,
  onGraph
}: RenderGraphIncrementalCompileInput): RenderGraphCompilationJob => {
  const window = getWindow({focusFrame, fps, windowSeconds});
  let cancelled = false;
  let cancelScheduled: (() => void) | null = null;
  let compiledGraph = compileRenderGraphForWindow({
    fps,
    durationInFrames,
    layers,
    focusFrame,
    windowSeconds
  });
  const remainingLayers = layers.filter((layer) => !layerOverlapsWindow({layer, fps, window}));
  let nextIndex = 0;

  onGraph(compiledGraph);

  const scheduleNext = (): void => {
    if (cancelled || nextIndex >= remainingLayers.length) {
      return;
    }

    cancelScheduled = schedule(() => {
      cancelScheduled = null;
      if (cancelled) {
        return;
      }

      const chunk = remainingLayers.slice(nextIndex, nextIndex + Math.max(1, chunkSize));
      nextIndex += chunk.length;
      const chunkGraph = compileLayers({
        fps,
        durationInFrames,
        layers: chunk,
        window: null
      });
      compiledGraph = mergeRenderGraphs(compiledGraph, chunkGraph);
      onGraph(compiledGraph);
      scheduleNext();
    });
  };

  scheduleNext();

  return {
    cancel: () => {
      cancelled = true;
      cancelScheduled?.();
      cancelScheduled = null;
    }
  };
};
