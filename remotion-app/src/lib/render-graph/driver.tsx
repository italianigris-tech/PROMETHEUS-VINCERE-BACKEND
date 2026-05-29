import React, {useEffect, useMemo, useState} from "react";

import {resolveRenderScalar} from "./easing";
import {resolveRenderIntervalForLayer} from "./resolver";
import type {
  CompiledRenderGraph,
  EngineDriverIntervalState,
  EngineDriverStyleResult,
  LayoutState,
  RenderInterval,
  ResolvedTransformState
} from "./types";

const EMPTY_LAYOUT_STATE: LayoutState = {
  measured: false,
  bounds: null
};

const clampProgress = (interval: RenderInterval, frame: number): number => {
  const duration = Math.max(1, interval.endFrame - interval.startFrame);
  return Math.max(0, Math.min(1, (frame - interval.startFrame) / duration));
};

export const resolveIntervalTransformAtFrame = (
  interval: RenderInterval,
  frame: number
): ResolvedTransformState => {
  const progress = clampProgress(interval, frame);
  const transform = interval.state.transform;
  const easing = transform?.easing ?? interval.state.motionPreset;

  return {
    translateX: resolveRenderScalar({
      instruction: transform?.translateX,
      progress,
      fallback: 0,
      defaultEasing: easing
    }),
    translateY: resolveRenderScalar({
      instruction: transform?.translateY,
      progress,
      fallback: 0,
      defaultEasing: easing
    }),
    scale: resolveRenderScalar({
      instruction: transform?.scale ?? interval.state.scale,
      progress,
      fallback: 1,
      defaultEasing: easing
    }),
    rotateDeg: resolveRenderScalar({
      instruction: transform?.rotateDeg,
      progress,
      fallback: 0,
      defaultEasing: easing
    })
  };
};

export const resolveIntervalOpacityAtFrame = ({
  interval,
  frame,
  textLayer
}: {
  interval: RenderInterval;
  frame: number;
  textLayer?: "sharp" | "blurred";
}): number => {
  const progress = clampProgress(interval, frame);
  const transform = interval.state.transform;
  const easing = transform?.easing ?? interval.state.motionPreset;

  if (textLayer === "sharp") {
    return resolveRenderScalar({
      instruction: interval.state.sharpOpacityRange,
      progress,
      fallback: interval.state.opacity ?? 1,
      defaultEasing: easing
    });
  }

  if (textLayer === "blurred") {
    return resolveRenderScalar({
      instruction: interval.state.blurredOpacityRange,
      progress,
      fallback: 0,
      defaultEasing: easing
    });
  }

  return resolveRenderScalar({
    instruction: interval.state.opacityRange ?? interval.state.opacity,
    progress,
    fallback: interval.state.opacity ?? 1,
    defaultEasing: easing
  });
};

const buildCssTransform = (transform: ResolvedTransformState): string => {
  return `translate3d(${transform.translateX.toFixed(2)}px, ${transform.translateY.toFixed(2)}px, 0) scale(${transform.scale.toFixed(4)}) rotate(${transform.rotateDeg.toFixed(3)}deg)`;
};

const applyStyleToNode = (
  node: HTMLElement,
  style: React.CSSProperties
): void => {
  if (typeof style.transform === "string") {
    node.style.transform = style.transform;
  }
  if (typeof style.opacity === "number" || typeof style.opacity === "string") {
    node.style.opacity = String(style.opacity);
  }
  if (typeof style.transformOrigin === "string") {
    node.style.transformOrigin = style.transformOrigin;
  }
  node.style.willChange = "transform, opacity";
  node.style.backfaceVisibility = "hidden";
};

export const resolveEngineDriverStyle = ({
  graph,
  sourceLayerId,
  frame,
  textLayer
}: {
  graph: CompiledRenderGraph;
  sourceLayerId: string;
  frame: number;
  textLayer?: "sharp" | "blurred";
}): EngineDriverStyleResult => {
  const interval = resolveRenderIntervalForLayer({
    graph,
    sourceLayerId,
    frame
  });

  if (!interval) {
    const hiddenStyle: React.CSSProperties = {
      opacity: 0,
      pointerEvents: "none"
    };

    return {
      interval: null,
      style: hiddenStyle,
      applyTo: (node) => {
        applyStyleToNode(node, hiddenStyle);
      }
    };
  }

  const transform = resolveIntervalTransformAtFrame(interval, frame);
  const opacity = resolveIntervalOpacityAtFrame({
    interval,
    frame,
    textLayer
  });
  const style: React.CSSProperties = {
    transform: buildCssTransform(transform),
    transformOrigin: interval.state.transform?.transformOrigin ?? "center center",
    opacity,
    pointerEvents: "none",
    willChange: "transform, opacity",
    backfaceVisibility: "hidden"
  };

  return {
    interval,
    style,
    applyTo: (node) => {
      applyStyleToNode(node, style);
    }
  };
};

export const useEngineDriver = <TElement extends HTMLElement>(
  ref: React.RefObject<TElement | null>,
  intervalState: EngineDriverIntervalState
): React.CSSProperties => {
  const {mode, graph, sourceLayerId, frame = 0, frameSource, textLayer} = intervalState;
  const exportDriver = useMemo(() => {
    if (mode !== "export") {
      return null;
    }

    return resolveEngineDriverStyle({
      graph,
      sourceLayerId,
      frame,
      textLayer
    });
  }, [frame, graph, mode, sourceLayerId, textLayer]);

  useEffect(() => {
    if (mode !== "preview" || !frameSource) {
      return;
    }

    const applyFrame = (nextFrame: number): void => {
      const node = ref.current;
      if (!node) {
        return;
      }

      resolveEngineDriverStyle({
        graph,
        sourceLayerId,
        frame: nextFrame,
        textLayer
      }).applyTo(node);
    };

    applyFrame(frameSource.getFrame());
    return frameSource.subscribe(applyFrame);
  }, [frameSource, graph, mode, ref, sourceLayerId, textLayer]);

  if (mode === "export") {
    return exportDriver?.style ?? {};
  }

  return {};
};

export const useMeasuredLayoutState = <TElement extends HTMLElement>(
  ref: React.RefObject<TElement | null>,
  enabled = true
): LayoutState => {
  const [layoutState, setLayoutState] = useState<LayoutState>(EMPTY_LAYOUT_STATE);

  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) {
      setLayoutState(EMPTY_LAYOUT_STATE);
      return;
    }

    const measure = (): void => {
      setLayoutState({
        measured: true,
        bounds: node.getBoundingClientRect()
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [enabled, ref]);

  return layoutState;
};
