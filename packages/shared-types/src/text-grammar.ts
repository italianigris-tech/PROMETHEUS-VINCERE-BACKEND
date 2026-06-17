import {z} from "zod";

export const textAnimationUnitSchema = z.enum(["word", "letter", "line"]);
export const textAnimationOrderSchema = z.enum(["forward", "reverse", "center-out", "random"]);

export const textEntranceTypeSchema = z.enum([
  "fade",
  "slide",
  "scale",
  "rotate",
  "blur",
  "typewriter",
  "decode"
]);

export const textExitTypeSchema = z.enum([
  "fade",
  "slide",
  "scale",
  "rotate",
  "blur",
  "explode",
  "scatter"
]);

export const textSyncModeSchema = z.enum(["none", "toBeat", "toOnset", "toPhrase"]);

const textTransformStateSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  z: z.number().optional(),
  scale: z.number().positive().optional(),
  scaleX: z.number().positive().optional(),
  scaleY: z.number().positive().optional(),
  rotation: z.number().optional(),
  rotationX: z.number().optional(),
  rotationY: z.number().optional(),
  rotationZ: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  blur: z.number().nonnegative().optional()
});

export const textAnimationStaggerSchema = z.object({
  unit: textAnimationUnitSchema.default("word"),
  delayMs: z.number().nonnegative().default(0),
  order: textAnimationOrderSchema.default("forward")
}).default({});

export const textEntranceSchema = z.object({
  type: textEntranceTypeSchema.default("fade"),
  durationMs: z.number().nonnegative().default(450),
  from: textTransformStateSchema.default({})
}).default({});

export const textHoldSchema = z.object({
  durationMs: z.number().nonnegative().default(0),
  breathingPulse: z.boolean().default(false),
  pulseAmount: z.number().min(0).max(1).default(0.04)
}).default({});

export const textExitSchema = z.object({
  type: textExitTypeSchema.default("fade"),
  durationMs: z.number().nonnegative().default(300),
  to: textTransformStateSchema.default({})
}).default({});

export const textTransformKeyframeSchema = z.object({
  atMs: z.number().nonnegative(),
  state: textTransformStateSchema
});

export const textStyleKeyframeSchema = z.object({
  atMs: z.number().nonnegative(),
  color: z.string().min(1).optional(),
  outline: z.string().min(1).optional(),
  stroke: z.string().min(1).optional(),
  blur: z.number().nonnegative().optional()
});

export const textSyncSchema = z.object({
  mode: textSyncModeSchema.default("none"),
  offsetMs: z.number().default(0)
}).default({});

export const textSelectiveEffectSelectorSchema = z.object({
  text: z.string().min(1).optional(),
  wordIndex: z.number().int().nonnegative().optional(),
  letterRange: z.tuple([
    z.number().int().nonnegative(),
    z.number().int().nonnegative()
  ]).optional()
}).refine((selector) => (
  selector.text !== undefined ||
  selector.wordIndex !== undefined ||
  selector.letterRange !== undefined
), {
  message: "Selective text effect selector must target text, wordIndex, or letterRange"
});

export const textSelectiveEffectsSchema = z.object({
  selector: textSelectiveEffectSelectorSchema,
  effects: z.object({
    bloom: z.boolean().default(false),
    motionBlur: z.boolean().default(false),
    chromaticAberration: z.boolean().default(false)
  }).default({}),
  layer: z.number().int().nonnegative().optional()
});

export const textAnimationGrammarSchema = z.object({
  version: z.literal("prometheus-text-grammar/v1"),
  stagger: textAnimationStaggerSchema,
  entrance: textEntranceSchema,
  hold: textHoldSchema,
  exit: textExitSchema,
  transform: z.object({
    keyframes: z.array(textTransformKeyframeSchema).default([])
  }).default({}),
  style: z.object({
    keyframes: z.array(textStyleKeyframeSchema).default([])
  }).default({}),
  sync: textSyncSchema,
  selectiveEffects: z.array(textSelectiveEffectsSchema).default([])
});

export type TextAnimationUnit = z.infer<typeof textAnimationUnitSchema>;
export type TextAnimationOrder = z.infer<typeof textAnimationOrderSchema>;
export type TextEntranceType = z.infer<typeof textEntranceTypeSchema>;
export type TextExitType = z.infer<typeof textExitTypeSchema>;
export type TextSyncMode = z.infer<typeof textSyncModeSchema>;
export type TextAnimationGrammar = z.infer<typeof textAnimationGrammarSchema>;
export type TextSelectiveEffects = z.infer<typeof textSelectiveEffectsSchema>;
