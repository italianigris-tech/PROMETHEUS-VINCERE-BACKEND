import type {ReferenceMotionSample, ReferenceMotionTrace} from "./types";

export type ResolvedReferenceMotionTransform = Required<Omit<ReferenceMotionSample, "frame">>;

const IDENTITY_TRANSFORM: ResolvedReferenceMotionTransform = {
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotateDeg: 0,
  depth: 0,
  opacity: 1,
  blurPx: 0,
  velocityX: 0,
  velocityY: 0
};

const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;
const round = (value: number): number => Number(value.toFixed(4));

const normalizeSample = (sample: ReferenceMotionSample): ResolvedReferenceMotionTransform => ({
  translateX: sample.translateX,
  translateY: sample.translateY,
  scale: sample.scale,
  rotateDeg: sample.rotateDeg,
  depth: sample.depth,
  opacity: sample.opacity,
  blurPx: sample.blurPx ?? 0,
  velocityX: sample.velocityX ?? 0,
  velocityY: sample.velocityY ?? 0
});

const interpolateSamples = (
  left: ReferenceMotionSample,
  right: ReferenceMotionSample,
  frame: number,
  fps: number
): ResolvedReferenceMotionTransform => {
  const span = Math.max(1, right.frame - left.frame);
  const progress = Math.max(0, Math.min(1, (frame - left.frame) / span));
  const durationSeconds = span / Math.max(1, fps);
  const inferredVelocityX = (right.translateX - left.translateX) / durationSeconds;
  const inferredVelocityY = (right.translateY - left.translateY) / durationSeconds;

  return {
    translateX: round(lerp(left.translateX, right.translateX, progress)),
    translateY: round(lerp(left.translateY, right.translateY, progress)),
    scale: round(lerp(left.scale, right.scale, progress)),
    rotateDeg: round(lerp(left.rotateDeg, right.rotateDeg, progress)),
    depth: round(lerp(left.depth, right.depth, progress)),
    opacity: round(lerp(left.opacity, right.opacity, progress)),
    blurPx: round(lerp(left.blurPx ?? 0, right.blurPx ?? 0, progress)),
    velocityX: round(lerp(left.velocityX ?? inferredVelocityX, right.velocityX ?? inferredVelocityX, progress)),
    velocityY: round(lerp(left.velocityY ?? inferredVelocityY, right.velocityY ?? inferredVelocityY, progress))
  };
};

export const resolveReferenceMotionAtFrame = ({
  trace,
  targetId,
  frame,
  fps
}: {
  trace?: ReferenceMotionTrace | null;
  targetId: string;
  frame: number;
  fps: number;
}): ResolvedReferenceMotionTransform | null => {
  if (!trace || trace.fps <= 0 || fps <= 0) {
    return null;
  }
  const targetTrace = trace.targetTraces.find((candidate) => candidate.targetId === targetId);
  if (!targetTrace || targetTrace.samples.length === 0) {
    return null;
  }

  const traceFrame = (frame / fps) * trace.fps;
  const samples = [...targetTrace.samples].sort((left, right) => left.frame - right.frame);
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) {
    return IDENTITY_TRANSFORM;
  }
  if (traceFrame <= first.frame) {
    return normalizeSample(first);
  }
  if (traceFrame >= last.frame) {
    return normalizeSample(last);
  }

  for (let index = 1; index < samples.length; index += 1) {
    const right = samples[index];
    const left = samples[index - 1];
    if (left && right && traceFrame <= right.frame) {
      return interpolateSamples(left, right, traceFrame, trace.fps);
    }
  }

  return normalizeSample(last);
};

export const buildReferenceMotionCssTransform = (
  transform?: ResolvedReferenceMotionTransform | null
): string => {
  if (!transform) {
    return "";
  }

  return [
    `translate3d(${transform.translateX.toFixed(2)}px, ${transform.translateY.toFixed(2)}px, ${transform.depth.toFixed(2)}px)`,
    `scale(${transform.scale.toFixed(4)})`,
    `rotate(${transform.rotateDeg.toFixed(3)}deg)`
  ].join(" ");
};

export const mixReferenceMotionIntoCssTransform = (
  baseTransform: string | undefined,
  transform?: ResolvedReferenceMotionTransform | null
): string | undefined => {
  const referenceTransform = buildReferenceMotionCssTransform(transform);
  if (!referenceTransform) {
    return baseTransform;
  }
  return baseTransform ? `${baseTransform} ${referenceTransform}` : referenceTransform;
};
