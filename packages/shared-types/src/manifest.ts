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

export const renderManifestSchema = z.object({
  manifestVersion: z.literal("prometheus-render-manifest/v1").default("prometheus-render-manifest/v1"),
  jobId: z.string().min(1),
  transcript: z.string().min(1),
  transcriptWords: z.array(transcriptWordSchema).default([]),
  sourceVideoUrl: mediaReferenceSchema.optional(),
  matteUrl: mediaReferenceSchema,
  audioUrl: mediaReferenceSchema,
  fontUrl: mediaReferenceSchema,
  durationInFrames: z.number().int().positive(),
  fps: z.number().positive().default(60),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  animationPreset: animationPresetSchema.default("cinematic"),
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
    depthZ: z.number().default(-2.2)
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
