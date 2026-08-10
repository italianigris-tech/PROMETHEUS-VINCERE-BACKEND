import {z} from "zod";

const frameId = z.number().int().nonnegative();
const frameTransformSchema = z.object({
  opacity: z.number().min(0).max(1),
  translateXPx: z.number().min(-1920).max(1920),
  translateYPx: z.number().min(-1920).max(1920),
  scale: z.number().min(0.5).max(2),
  rotationDeg: z.number().min(-180).max(180),
  blurPx: z.number().min(0).max(24),
  clipProgress: z.number().min(0).max(1),
  trackingEm: z.number().min(-0.3).max(0.3),
}).strict();

export const maulFrameMotionTransformSchema = frameTransformSchema;

export const maulFrameMotionEasingSchema = z.discriminatedUnion("type", [
  z.object({type: z.literal("linear")}).strict(),
  z.object({
    type: z.literal("cubic_bezier"),
    x1: z.number().min(0).max(1),
    y1: z.number().min(0).max(1),
    x2: z.number().min(0).max(1),
    y2: z.number().min(0).max(1),
  }).strict(),
]);

export const maulFrameMotionPhaseSchema = z.object({
  startFrame: frameId,
  endFrame: z.number().int().positive(),
  easing: maulFrameMotionEasingSchema,
  from: frameTransformSchema,
  to: frameTransformSchema,
}).strict().refine((phase) => phase.endFrame > phase.startFrame, {
  path: ["endFrame"],
  message: "Frame motion phases require positive duration.",
});

const intervalSchema = z.object({
  startMs: z.number().nonnegative(),
  endMs: z.number().positive(),
}).strict().refine((interval) => interval.endMs > interval.startMs, {
  path: ["endMs"],
  message: "Frame motion source intervals require positive duration.",
});

const envelopeSchema = z.object({
  maxTranslateXPx: z.number().nonnegative().max(1920),
  maxTranslateYPx: z.number().nonnegative().max(1920),
  maxScale: z.number().min(0.5).max(2),
  maxBlurPx: z.number().nonnegative().max(24),
}).strict();

export const maulFrameMotionProgramSchema = z.object({
  schemaVersion: z.literal("maul-frame-motion/v1"),
  executorId: z.string().trim().min(1),
  sourceTreatment: z.string().trim().min(1),
  unit: z.enum(["word", "letter"]),
  tokenId: z.string().trim().min(1),
  placementSegmentId: z.string().trim().min(1),
  fps: z.number().positive().max(240),
  sourceIntervalMs: intervalSchema,
  phases: z.object({
    entry: maulFrameMotionPhaseSchema,
    hold: maulFrameMotionPhaseSchema,
    exit: maulFrameMotionPhaseSchema,
  }).strict(),
  envelope: envelopeSchema,
}).strict().superRefine((program, ctx) => {
  const {entry, hold, exit} = program.phases;
  if (hold.startFrame < entry.endFrame || exit.startFrame < hold.endFrame) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["phases"],
      message: "Frame motion phases must be ordered and non-overlapping.",
    });
  }
  if (entry.to !== hold.from && !transformsEqual(entry.to, hold.from)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["phases", "hold", "from"],
      message: "Frame motion entry and hold transforms must be continuous.",
    });
  }
  if (hold.to !== exit.from && !transformsEqual(hold.to, exit.from)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["phases", "exit", "from"],
      message: "Frame motion hold and exit transforms must be continuous.",
    });
  }
});

export type MaulFrameMotionTransform = z.infer<typeof maulFrameMotionTransformSchema>;
export type MaulFrameMotionEasing = z.infer<typeof maulFrameMotionEasingSchema>;
export type MaulFrameMotionPhase = z.infer<typeof maulFrameMotionPhaseSchema>;
export type MaulFrameMotionProgram = z.infer<typeof maulFrameMotionProgramSchema>;

const transformsEqual = (
  left: MaulFrameMotionTransform,
  right: MaulFrameMotionTransform,
): boolean => (
  left.opacity === right.opacity &&
  left.translateXPx === right.translateXPx &&
  left.translateYPx === right.translateYPx &&
  left.scale === right.scale &&
  left.rotationDeg === right.rotationDeg &&
  left.blurPx === right.blurPx &&
  left.clipProgress === right.clipProgress &&
  left.trackingEm === right.trackingEm
);

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const cubic = (a: number, b: number, t: number): number =>
  3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;

const cubicDerivative = (a: number, b: number, t: number): number =>
  3 * (1 - t) * (1 - t) * a + 6 * (1 - t) * t * (b - a) + 3 * t * t * (1 - b);

const cubicProgress = (
  easing: Extract<MaulFrameMotionEasing, {type: "cubic_bezier"}>,
  progress: number,
): number => {
  const x = clamp01(progress);
  let t = x;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const derivative = cubicDerivative(easing.x1, easing.x2, t);
    if (Math.abs(derivative) < 1e-7) break;
    const next = t - (cubic(easing.x1, easing.x2, t) - x) / derivative;
    if (next < 0 || next > 1) break;
    t = next;
  }
  let lower = 0;
  let upper = 1;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const current = cubic(easing.x1, easing.x2, t);
    if (Math.abs(current - x) < 1e-6) break;
    if (current < x) lower = t;
    else upper = t;
    t = (lower + upper) / 2;
  }
  return clamp01(cubic(easing.y1, easing.y2, t));
};

const easedProgress = (easing: MaulFrameMotionEasing, progress: number): number =>
  easing.type === "linear" ? clamp01(progress) : cubicProgress(easing, progress);

const interpolate = (
  from: MaulFrameMotionTransform,
  to: MaulFrameMotionTransform,
  progress: number,
): MaulFrameMotionTransform => ({
  opacity: from.opacity + (to.opacity - from.opacity) * progress,
  translateXPx: from.translateXPx + (to.translateXPx - from.translateXPx) * progress,
  translateYPx: from.translateYPx + (to.translateYPx - from.translateYPx) * progress,
  scale: from.scale + (to.scale - from.scale) * progress,
  rotationDeg: from.rotationDeg + (to.rotationDeg - from.rotationDeg) * progress,
  blurPx: from.blurPx + (to.blurPx - from.blurPx) * progress,
  clipProgress: from.clipProgress + (to.clipProgress - from.clipProgress) * progress,
  trackingEm: from.trackingEm + (to.trackingEm - from.trackingEm) * progress,
});

const evaluatePhase = (phase: MaulFrameMotionPhase, frame: number): MaulFrameMotionTransform => {
  const progress = clamp01((frame - phase.startFrame) / (phase.endFrame - phase.startFrame));
  return interpolate(phase.from, phase.to, easedProgress(phase.easing, progress));
};

export const evaluateMaulFrameMotion = (
  program: MaulFrameMotionProgram,
  frame: number,
): MaulFrameMotionTransform => {
  const {entry, hold, exit} = program.phases;
  if (frame < entry.startFrame) return entry.from;
  if (frame <= entry.endFrame) return evaluatePhase(entry, frame);
  if (frame < hold.startFrame) return entry.to;
  if (frame <= hold.endFrame) return evaluatePhase(hold, frame);
  if (frame < exit.startFrame) return hold.to;
  if (frame <= exit.endFrame) return evaluatePhase(exit, frame);
  return exit.to;
};
