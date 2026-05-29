import type {CompiledRenderGraph, RenderInterval, RenderIntervalResolver} from "./types";

type IntervalTreeNode = {
  center: number;
  byStart: RenderInterval[];
  byEnd: RenderInterval[];
  left: IntervalTreeNode | null;
  right: IntervalTreeNode | null;
};

const sortResolved = (intervals: RenderInterval[]): RenderInterval[] => {
  return intervals.sort((left, right) => {
    if (left.zIndex !== right.zIndex) {
      return left.zIndex - right.zIndex;
    }
    if (left.startFrame !== right.startFrame) {
      return left.startFrame - right.startFrame;
    }
    return left.id.localeCompare(right.id);
  });
};

const getMedianCenter = (intervals: RenderInterval[]): number => {
  const centers = intervals
    .map((interval) => (interval.startFrame + interval.endFrame) / 2)
    .sort((left, right) => left - right);
  return centers[Math.floor(centers.length / 2)] ?? 0;
};

const buildIntervalTree = (intervals: RenderInterval[]): IntervalTreeNode | null => {
  if (intervals.length === 0) {
    return null;
  }

  const center = getMedianCenter(intervals);
  const left: RenderInterval[] = [];
  const right: RenderInterval[] = [];
  const spanning: RenderInterval[] = [];

  intervals.forEach((interval) => {
    if (interval.endFrame < center) {
      left.push(interval);
      return;
    }
    if (interval.startFrame > center) {
      right.push(interval);
      return;
    }
    spanning.push(interval);
  });

  return {
    center,
    byStart: [...spanning].sort((leftInterval, rightInterval) => leftInterval.startFrame - rightInterval.startFrame),
    byEnd: [...spanning].sort((leftInterval, rightInterval) => rightInterval.endFrame - leftInterval.endFrame),
    left: buildIntervalTree(left),
    right: buildIntervalTree(right)
  };
};

const queryTree = (
  node: IntervalTreeNode | null,
  frame: number,
  results: RenderInterval[]
): void => {
  if (!node) {
    return;
  }

  if (frame < node.center) {
    for (const interval of node.byStart) {
      if (interval.startFrame > frame) {
        break;
      }
      if (interval.endFrame >= frame) {
        results.push(interval);
      }
    }
    queryTree(node.left, frame, results);
    return;
  }

  if (frame > node.center) {
    for (const interval of node.byEnd) {
      if (interval.endFrame < frame) {
        break;
      }
      if (interval.startFrame <= frame) {
        results.push(interval);
      }
    }
    queryTree(node.right, frame, results);
    return;
  }

  results.push(...node.byStart);
};

const resolverCache = new WeakMap<CompiledRenderGraph, RenderIntervalResolver>();

export const createRenderIntervalResolver = (graph: CompiledRenderGraph): RenderIntervalResolver => {
  const tree = buildIntervalTree(graph.intervals);

  return {
    resolveFrame: (frame: number) => {
      const results: RenderInterval[] = [];
      queryTree(tree, Math.round(frame), results);
      return sortResolved(results);
    }
  };
};

export const getRenderIntervalResolver = (graph: CompiledRenderGraph): RenderIntervalResolver => {
  const cached = resolverCache.get(graph);
  if (cached) {
    return cached;
  }

  const resolver = createRenderIntervalResolver(graph);
  resolverCache.set(graph, resolver);
  return resolver;
};

export const resolveRenderIntervalForLayer = ({
  graph,
  sourceLayerId,
  frame
}: {
  graph: CompiledRenderGraph;
  sourceLayerId: string;
  frame: number;
}): RenderInterval | null => {
  return getRenderIntervalResolver(graph).resolveFrame(frame).find((interval) => interval.sourceLayerId === sourceLayerId) ?? null;
};
