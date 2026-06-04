import {z} from "zod";

const isUrlLike = (value: string): boolean => {
  if (value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return ["http:", "https:", "file:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

export const mediaReferenceSchema = z.string().min(1).refine(isUrlLike, {
  message: "Expected an http(s), file, absolute, or relative media reference"
});

export const transcriptWordSchema = z.object({
  text: z.string().min(1),
  startMs: z.number().nonnegative(),
  endMs: z.number().positive(),
  confidence: z.number().min(0).max(1).optional()
}).superRefine((word, ctx) => {
  if (word.endMs <= word.startMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "endMs must be greater than startMs",
      path: ["endMs"]
    });
  }
});

export const animationPresetSchema = z.enum(["cinematic", "kinetic", "minimal"]);

const vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

const cameraKeyframeSchema = z.object({
  position: vector3Schema,
  lookAt: vector3Schema,
  roll: z.number().optional().default(0)
});

export const renderManifestSchema = z.object({
  manifestVersion: z.literal("prometheus-render-manifest/v1").default("prometheus-render-manifest/v1"),
  jobId: z.string().min(1),
  transcript: z.string().min(1),
  transcriptWords: z.array(transcriptWordSchema).default([]),
  sourceVideoUrl: mediaReferenceSchema.optional(),
  backgroundVideoUrl: mediaReferenceSchema.optional(),
  rvmMatteUrl: mediaReferenceSchema.optional(),
  matteUrl: mediaReferenceSchema,
  audioUrl: mediaReferenceSchema,
  fontUrl: mediaReferenceSchema,
  durationInFrames: z.number().int().positive(),
  fps: z.number().positive().default(60),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  animationPreset: animationPresetSchema.default("cinematic"),
  matteZ: z.number().optional().default(3),
  wordStagger: z.number().optional().default(0.1),
  extrudeDepth: z.number().optional().default(0.1),
  bevelEnabled: z.boolean().optional().default(true),
  bevelSize: z.number().optional().default(0.02),
  bevelThickness: z.number().optional().default(0.02),
  gradientColors: z.array(z.string()).optional().default(["#ffffff"]),
  envMapIntensity: z.number().optional().default(0),
  cameraKeyframes: z.array(cameraKeyframeSchema).optional().default([
    {position: {x: 0, y: 0, z: 50}, lookAt: {x: 0, y: 0, z: 0}, roll: 0},
    {position: {x: 0, y: 0, z: 5}, lookAt: {x: 0, y: 0, z: 0}, roll: 0},
    {position: {x: 15, y: 5, z: 10}, lookAt: {x: 0, y: 0, z: 0}, roll: 0.2},
    {position: {x: 0, y: 0, z: 50}, lookAt: {x: 0, y: 0, z: 0}, roll: 0}
  ]),
  autoRoll: z.boolean().optional().default(true),
  autoRollIntensity: z.number().optional().default(0.3),
  matteSafeZone: z.object({
    minX: z.number().optional().default(-0.45),
    maxX: z.number().optional().default(0.45),
    minY: z.number().optional().default(-0.4),
    maxY: z.number().optional().default(0.4)
  }).optional().default({
    minX: -0.45,
    maxX: 0.45,
    minY: -0.4,
    maxY: 0.4
  }),
  depthOfFieldEnabled: z.boolean().optional().default(false),
  depthOfFieldFocusDistance: z.number().optional().default(10),
  depthOfFieldFalloff: z.number().optional().default(5),
  bloomEnabled: z.boolean().optional().default(true),
  bloomStrength: z.number().optional().default(1.5),
  bloomRadius: z.number().optional().default(0.4),
  bloomThreshold: z.number().optional().default(0.85),
  motionBlurEnabled: z.boolean().optional().default(true),
  motionBlurStrength: z.number().optional().default(0.5),
  chromaticAberrationEnabled: z.boolean().optional().default(true),
  chromaticAberrationOffset: z.number().optional().default(0.003),
  vignetteEnabled: z.boolean().optional().default(true),
  vignetteDarkness: z.number().optional().default(0.5),
  vignetteOffset: z.number().optional().default(0.5),
  lutEnabled: z.boolean().optional().default(false),
  lutUrl: z.string().optional().nullable().default(null),
  matte: z.object({
    fps: z.number().positive().optional(),
    durationInFrames: z.number().int().positive().optional(),
    planeZ: z.number().default(0),
    planeHeight: z.number().positive().default(9),
    premultipliedAlpha: z.boolean().default(true)
  }).default({}),
  camera: z.object({
    startZ: z.number().default(10),
    endZ: z.number().default(5.4),
    parallaxStrength: z.number().default(0.3),
    fov: z.number().positive().default(46)
  }).default({}),
  text: z.object({
    color: z.string().default("#f8fbff"),
    emissive: z.string().default("#8bd8ff"),
    size: z.number().positive().default(0.84),
    maxWidth: z.number().positive().default(8),
    lineHeight: z.number().positive().default(1.08),
    stagger: z.number().nonnegative().default(0.72),
    revealSoftness: z.number().positive().default(0.16),
    depthTravel: z.number().default(2.4),
    depthZ: z.number().default(-2.2),
    sdfGlyphSize: z.number().int().positive().default(96)
  }).default({})
}).superRefine((manifest, ctx) => {
  if (manifest.matte.fps !== undefined && Math.abs(manifest.matte.fps - manifest.fps) > 0.001) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "matte.fps must match manifest fps for frame-locked video texture sync",
      path: ["matte", "fps"]
    });
  }

  if (
    manifest.matte.durationInFrames !== undefined &&
    manifest.matte.durationInFrames !== manifest.durationInFrames
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "matte.durationInFrames must match manifest durationInFrames",
      path: ["matte", "durationInFrames"]
    });
  }
});

export const rvmExtractionRequestSchema = z.object({
  jobId: z.string().min(1),
  inputUrl: mediaReferenceSchema,
  outputDir: z.string().min(1).optional(),
  startSeconds: z.number().nonnegative().default(0),
  maxDurationSeconds: z.number().positive().optional()
});

export const rvmExtractionResponseSchema = z.object({
  jobId: z.string().min(1),
  matteUrl: mediaReferenceSchema,
  audioUrl: mediaReferenceSchema,
  durationSeconds: z.number().positive(),
  durationInFrames: z.number().int().positive(),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});

export type TranscriptWord = z.infer<typeof transcriptWordSchema>;
export type AnimationPreset = z.infer<typeof animationPresetSchema>;
export type RenderManifest = z.infer<typeof renderManifestSchema>;
export type RvmExtractionRequest = z.infer<typeof rvmExtractionRequestSchema>;
export type RvmExtractionResponse = z.infer<typeof rvmExtractionResponseSchema>;
