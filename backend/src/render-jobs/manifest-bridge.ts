import {randomUUID} from "node:crypto";

import {z} from "zod";

const urlLikeSchema = z.string().min(1).refine((value) => {
  if (value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return ["http:", "https:", "file:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}, {
  message: "Expected an http(s), file, absolute, or relative media reference"
});

const defaultCameraKeyframes = [
  {position: {x: 0, y: 0, z: 50}, lookAt: {x: 0, y: 0, z: 0}, roll: 0},
  {position: {x: 0, y: 0, z: 5}, lookAt: {x: 0, y: 0, z: 0}, roll: 0},
  {position: {x: 15, y: 5, z: 10}, lookAt: {x: 0, y: 0, z: 0}, roll: 0.2},
  {position: {x: 0, y: 0, z: 50}, lookAt: {x: 0, y: 0, z: 0}, roll: 0}
];

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

export const renderTranscriptWordSchema = z.object({
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

export const renderManifestBridgeSchema = z.object({
  manifestVersion: z.literal("prometheus-render-manifest/v1").default("prometheus-render-manifest/v1"),
  jobId: z.string().min(1),
  transcript: z.string().min(1),
  transcriptWords: z.array(renderTranscriptWordSchema).default([]),
  sourceVideoUrl: urlLikeSchema.optional(),
  backgroundVideoUrl: urlLikeSchema.optional(),
  rvmMatteUrl: urlLikeSchema.optional(),
  matteUrl: urlLikeSchema,
  audioUrl: urlLikeSchema,
  fontUrl: urlLikeSchema,
  durationInFrames: z.number().int().positive(),
  fps: z.number().positive().default(60),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  animationPreset: z.enum(["cinematic", "kinetic", "minimal"]).default("cinematic"),
  matteZ: z.number().optional().default(3),
  wordStagger: z.number().optional().default(0.1),
  extrudeDepth: z.number().optional().default(0.1),
  bevelEnabled: z.boolean().optional().default(true),
  bevelSize: z.number().optional().default(0.02),
  bevelThickness: z.number().optional().default(0.02),
  gradientColors: z.array(z.string()).optional().default(["#ffffff"]),
  envMapIntensity: z.number().optional().default(0),
  cameraKeyframes: z.array(cameraKeyframeSchema).optional().default(defaultCameraKeyframes),
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
  }).default({
    planeZ: 0,
    planeHeight: 9,
    premultipliedAlpha: true
  }),
  camera: z.object({
    startZ: z.number().default(10),
    endZ: z.number().default(5.4),
    parallaxStrength: z.number().default(0.3),
    fov: z.number().positive().default(46)
  }).default({
    startZ: 10,
    endZ: 5.4,
    parallaxStrength: 0.3,
    fov: 46
  }),
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
  }).default({
    color: "#f8fbff",
    emissive: "#8bd8ff",
    size: 0.84,
    maxWidth: 8,
    lineHeight: 1.08,
    stagger: 0.72,
    revealSoftness: 0.16,
    depthTravel: 2.4,
    depthZ: -2.2,
    sdfGlyphSize: 96
  })
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

export type RenderManifestBridge = z.infer<typeof renderManifestBridgeSchema>;

export type BuildRenderManifestInput = {
  creativeManifest: Record<string, unknown>;
  fontUrl: string;
  backgroundVideoUrl: string;
  rvmMatteUrl: string;
  audioUrl?: string | null;
  baseUrl?: string;
};

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

export const absolutizeManifestAssetUrl = (candidate: string, baseUrl: string): string => {
  if (isHttpUrl(candidate)) {
    return candidate;
  }
  return `${baseUrl.replace(/\/+$/, "")}/${candidate.replace(/^[/\\]+/, "")}`;
};

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const readString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const readNumber = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const readBoolean = (record: Record<string, unknown>, key: string): boolean | null => {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
};

const readStringArray = (record: Record<string, unknown>, key: string): string[] | null => {
  const value = record[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return null;
  }
  return value as string[];
};

const readNestedRecord = (record: Record<string, unknown>, key: string): Record<string, unknown> =>
  readRecord(record[key]) ?? {};

const readVector3 = (value: unknown): {x: number; y: number; z: number} | null => {
  const record = readRecord(value);
  if (!record) {
    return null;
  }

  const x = readNumber(record, "x");
  const y = readNumber(record, "y");
  const z = readNumber(record, "z");
  if (x === null || y === null || z === null) {
    return null;
  }

  return {x, y, z};
};

const readCameraKeyframesFrom = (value: unknown): z.infer<typeof cameraKeyframeSchema>[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const keyframes = value.flatMap((entry) => {
    const record = readRecord(entry);
    if (!record) {
      return [];
    }

    const position = readVector3(record.position);
    const lookAt = readVector3(record.lookAt);
    if (!position || !lookAt) {
      return [];
    }

    return [{
      position,
      lookAt,
      roll: readNumber(record, "roll") ?? 0
    }];
  });

  return keyframes.length > 0 ? keyframes : null;
};

const readCameraKeyframes = (creativeManifest: Record<string, unknown>): z.infer<typeof cameraKeyframeSchema>[] => {
  const camera = readNestedRecord(creativeManifest, "camera");
  const cameraPath = readNestedRecord(creativeManifest, "cameraPath");

  return readCameraKeyframesFrom(creativeManifest.cameraKeyframes) ??
    readCameraKeyframesFrom(camera.keyframes) ??
    readCameraKeyframesFrom(cameraPath.keyframes) ??
    defaultCameraKeyframes;
};

const readEffectBoolean = (
  creativeManifest: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean => {
  const postProcessing = readNestedRecord(creativeManifest, "postProcessing");
  const effects = readNestedRecord(creativeManifest, "effects");
  return readBoolean(creativeManifest, key) ??
    readBoolean(postProcessing, key) ??
    readBoolean(effects, key) ??
    fallback;
};

const readEffectNumber = (
  creativeManifest: Record<string, unknown>,
  key: string,
  fallback: number
): number => {
  const postProcessing = readNestedRecord(creativeManifest, "postProcessing");
  const effects = readNestedRecord(creativeManifest, "effects");
  return readNumber(creativeManifest, key) ??
    readNumber(postProcessing, key) ??
    readNumber(effects, key) ??
    fallback;
};

const readEffectString = (
  creativeManifest: Record<string, unknown>,
  key: string
): string | null => {
  const postProcessing = readNestedRecord(creativeManifest, "postProcessing");
  const effects = readNestedRecord(creativeManifest, "effects");
  return readString(creativeManifest, key) ??
    readString(postProcessing, key) ??
    readString(effects, key);
};

const normalizeTranscriptWords = ({
  creativeManifest,
  transcript,
  durationInFrames,
  fps
}: {
  creativeManifest: Record<string, unknown>;
  transcript: string;
  durationInFrames: number;
  fps: number;
}): Array<z.infer<typeof renderTranscriptWordSchema>> => {
  const source = readNestedRecord(creativeManifest, "source");
  const transcriptSegment = readNestedRecord(source, "transcriptSegment");
  const explicitWords = Array.isArray(creativeManifest.transcriptWords)
    ? creativeManifest.transcriptWords
    : Array.isArray(transcriptSegment.words)
      ? transcriptSegment.words
      : [];

  const normalized = explicitWords.flatMap((entry) => {
    const record = readRecord(entry);
    if (!record) {
      return [];
    }

    const text = readString(record, "text") ?? readString(record, "word");
    const startMs = readNumber(record, "startMs") ?? readNumber(record, "start");
    const endMs = readNumber(record, "endMs") ?? readNumber(record, "end");
    if (!text || startMs === null || endMs === null) {
      return [];
    }

    return [{
      text,
      startMs,
      endMs,
      confidence: readNumber(record, "confidence") ?? undefined
    }];
  });

  if (normalized.length > 0) {
    return normalized;
  }

  const words = transcript.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const durationMs = (durationInFrames / fps) * 1000;
  const chunkMs = durationMs / words.length;
  return words.map((text, index) => ({
    text,
    startMs: Math.round(index * chunkMs),
    endMs: Math.max(Math.round((index + 1) * chunkMs), Math.round(index * chunkMs) + 1)
  }));
};

export const buildRenderManifest = ({
  creativeManifest,
  fontUrl,
  backgroundVideoUrl,
  rvmMatteUrl,
  audioUrl,
  baseUrl = "http://localhost:8000"
}: BuildRenderManifestInput): RenderManifestBridge => {
  const source = readNestedRecord(creativeManifest, "source");
  const transcriptSegment = readNestedRecord(source, "transcriptSegment");
  const scene = readNestedRecord(creativeManifest, "scene");
  const animation = readNestedRecord(creativeManifest, "animation");

  const transcript = readString(creativeManifest, "transcript") ??
    readString(transcriptSegment, "text") ??
    readString(creativeManifest, "text") ??
    readString(creativeManifest, "content") ??
    "";
  const fps = readNumber(creativeManifest, "fps") ?? readNumber(scene, "fps") ?? 30;
  const durationSeconds = readNumber(creativeManifest, "duration") ??
    ((readNumber(scene, "durationMs") ?? 10000) / 1000);
  const durationInFrames = Math.max(
    1,
    Math.round(
      readNumber(creativeManifest, "durationInFrames") ??
      (durationSeconds * fps)
    )
  );
  const width = Math.round(readNumber(creativeManifest, "width") ?? readNumber(scene, "width") ?? 1920);
  const height = Math.round(readNumber(creativeManifest, "height") ?? readNumber(scene, "height") ?? 1080);
  const sourceVideoUrl = readString(source, "videoUrl");
  const staggerSeconds = readNumber(creativeManifest, "stagger") ??
    ((readNumber(animation, "staggerMs") ?? 100) / 1000);

  const manifest = {
    jobId: randomUUID(),
    transcript: transcript || " ",
    transcriptWords: normalizeTranscriptWords({
      creativeManifest,
      transcript,
      durationInFrames,
      fps
    }),
    sourceVideoUrl: sourceVideoUrl
      ? absolutizeManifestAssetUrl(sourceVideoUrl, baseUrl)
      : undefined,
    backgroundVideoUrl: absolutizeManifestAssetUrl(backgroundVideoUrl, baseUrl),
    rvmMatteUrl: absolutizeManifestAssetUrl(rvmMatteUrl, baseUrl),
    matteUrl: absolutizeManifestAssetUrl(rvmMatteUrl, baseUrl),
    audioUrl: absolutizeManifestAssetUrl(audioUrl ?? rvmMatteUrl, baseUrl),
    fontUrl: absolutizeManifestAssetUrl(fontUrl, baseUrl),
    durationInFrames,
    fps,
    width,
    height,
    animationPreset: "cinematic" as const,
    matteZ: readNumber(creativeManifest, "matteZ") ?? 3,
    wordStagger: readNumber(creativeManifest, "wordStagger") ?? 0.1,
    extrudeDepth: readNumber(creativeManifest, "extrudeDepth") ?? 0.1,
    bevelEnabled: readBoolean(creativeManifest, "bevelEnabled") ?? true,
    bevelSize: readNumber(creativeManifest, "bevelSize") ?? 0.02,
    bevelThickness: readNumber(creativeManifest, "bevelThickness") ?? 0.02,
    gradientColors: readStringArray(creativeManifest, "gradientColors") ?? ["#ffffff"],
    envMapIntensity: readNumber(creativeManifest, "envMapIntensity") ?? 0,
    cameraKeyframes: readCameraKeyframes(creativeManifest),
    autoRoll: readBoolean(creativeManifest, "autoRoll") ?? true,
    autoRollIntensity: readNumber(creativeManifest, "autoRollIntensity") ?? 0.3,
    matteSafeZone: {
      minX: readNumber(readNestedRecord(creativeManifest, "matteSafeZone"), "minX") ?? -0.45,
      maxX: readNumber(readNestedRecord(creativeManifest, "matteSafeZone"), "maxX") ?? 0.45,
      minY: readNumber(readNestedRecord(creativeManifest, "matteSafeZone"), "minY") ?? -0.4,
      maxY: readNumber(readNestedRecord(creativeManifest, "matteSafeZone"), "maxY") ?? 0.4
    },
    depthOfFieldEnabled: readBoolean(creativeManifest, "depthOfFieldEnabled") ?? false,
    depthOfFieldFocusDistance: readNumber(creativeManifest, "depthOfFieldFocusDistance") ?? 10,
    depthOfFieldFalloff: readNumber(creativeManifest, "depthOfFieldFalloff") ?? 5,
    bloomEnabled: readEffectBoolean(creativeManifest, "bloomEnabled", true),
    bloomStrength: readEffectNumber(creativeManifest, "bloomStrength", 1.5),
    bloomRadius: readEffectNumber(creativeManifest, "bloomRadius", 0.4),
    bloomThreshold: readEffectNumber(creativeManifest, "bloomThreshold", 0.85),
    motionBlurEnabled: readEffectBoolean(creativeManifest, "motionBlurEnabled", true),
    motionBlurStrength: readEffectNumber(creativeManifest, "motionBlurStrength", 0.5),
    chromaticAberrationEnabled: readEffectBoolean(creativeManifest, "chromaticAberrationEnabled", true),
    chromaticAberrationOffset: readEffectNumber(creativeManifest, "chromaticAberrationOffset", 0.003),
    vignetteEnabled: readEffectBoolean(creativeManifest, "vignetteEnabled", true),
    vignetteDarkness: readEffectNumber(creativeManifest, "vignetteDarkness", 0.5),
    vignetteOffset: readEffectNumber(creativeManifest, "vignetteOffset", 0.5),
    lutEnabled: readEffectBoolean(creativeManifest, "lutEnabled", false),
    lutUrl: readEffectString(creativeManifest, "lutUrl"),
    matte: {
      fps,
      durationInFrames,
      planeZ: 0,
      planeHeight: 9,
      premultipliedAlpha: true
    },
    camera: {
      startZ: 10,
      endZ: 5.4,
      parallaxStrength: 0.3,
      fov: 46
    },
    text: {
      color: "#f8fbff",
      emissive: "#8bd8ff",
      size: 0.84,
      maxWidth: 8,
      lineHeight: 1.08,
      stagger: staggerSeconds,
      revealSoftness: readNumber(creativeManifest, "revealSoftness") ?? 0.5,
      depthTravel: readNumber(creativeManifest, "depthTravel") ?? 10,
      depthZ: readNumber(creativeManifest, "depthZ") ?? -2.2,
      sdfGlyphSize: Math.round(readNumber(creativeManifest, "sdfGlyphSize") ?? 96)
    }
  };

  return renderManifestBridgeSchema.parse(manifest);
};
