import type {
  MaulMinimumLegibilityPrimitive,
  MaulNormalizedBox,
} from "@prometheus/shared-types";
import type {CaptionChunk, TranscribedWord, VideoMetadata} from "../lib/types";
import type {MatteManifest} from "../lib/types";
import {deterministicChunkWords, mapWordChunksToCaptionChunks} from "../lib/caption-chunker";
import {buildCreativePreviewCaptionChunks} from "../creative-orchestration/preview";
import {
  buildMotionCompositionModel,
  type MotionCompositionModel
} from "../lib/motion-platform/scene-engine";

export const SANDBOX_ASSET_URLS = {
  videoSrc: "/test-video.mp4",
  matteSrc: "/test-matte.mp4"
} as const;

export const SANDBOX_CAPTION_PROFILE_ID = "longform_svg_typography_v1" as const;
export const SANDBOX_MOTION_TIER = "premium" as const;
export const SANDBOX_FPS = 30;
export const SANDBOX_FALLBACK_DURATION_SECONDS = 10;
export const SANDBOX_SOURCE_VIDEO_METADATA: VideoMetadata = {
  width: 1280,
  height: 720,
  fps: SANDBOX_FPS,
  durationSeconds: 61.094367,
  durationInFrames: 1833
};

export const SANDBOX_WORDS: TranscribedWord[] = [
  {text: "Stop", startMs: 0, endMs: 220, confidence: 0.99},
  {text: "scrolling", startMs: 220, endMs: 620, confidence: 0.99},
  {text: "for", startMs: 620, endMs: 760, confidence: 0.99},
  {text: "a", startMs: 760, endMs: 820, confidence: 0.99},
  {text: "second", startMs: 820, endMs: 1180, confidence: 0.99},
  {text: "This", startMs: 1400, endMs: 1620, confidence: 0.99},
  {text: "is", startMs: 1620, endMs: 1720, confidence: 0.99},
  {text: "the", startMs: 1720, endMs: 1820, confidence: 0.99},
  {text: "visual", startMs: 1820, endMs: 2160, confidence: 0.99},
  {text: "proof", startMs: 2160, endMs: 2520, confidence: 0.99},
  {text: "that", startMs: 3000, endMs: 3160, confidence: 0.99},
  {text: "the", startMs: 3160, endMs: 3260, confidence: 0.99},
  {text: "hook", startMs: 3260, endMs: 3460, confidence: 0.99},
  {text: "can", startMs: 3460, endMs: 3600, confidence: 0.99},
  {text: "feel", startMs: 3600, endMs: 3860, confidence: 0.99},
  {text: "premium", startMs: 3860, endMs: 4240, confidence: 0.99},
  {text: "without", startMs: 4700, endMs: 5080, confidence: 0.99},
  {text: "backend", startMs: 5080, endMs: 5480, confidence: 0.99},
  {text: "plumbing", startMs: 5480, endMs: 5980, confidence: 0.99},
  {text: "getting", startMs: 6300, endMs: 6520, confidence: 0.99},
  {text: "in", startMs: 6520, endMs: 6600, confidence: 0.99},
  {text: "the", startMs: 6600, endMs: 6700, confidence: 0.99},
  {text: "way", startMs: 6700, endMs: 6940, confidence: 0.99}
];

export type WebPreviewRootRoute =
  | "sandbox"
  | "preview-app"
  | "joseph-study"
  | "maul-reference-review"
  | "maul-review"
  | "maul-placement-tracer";

export type MaulPlacementTracerFixture = {
  probeId: string;
  frame: number;
  family: "measured" | "editorial" | "personal";
  variantId: string;
  fallbackCode: string | null;
  text: string;
  alignment: "left" | "center" | "right";
  box: MaulNormalizedBox;
  fontSizePx: number;
  primitive: MaulMinimumLegibilityPrimitive;
};

export const resolveMaulPlacementTracerCropCenterX = (frame: number): number =>
  frame < 15 ? 0.25 : 0.75;

export const MAUL_PLACEMENT_TRACER_FIXTURES: readonly MaulPlacementTracerFixture[] = [
  {
    probeId: "measured",
    frame: 8,
    family: "measured",
    variantId: "measured.centered_statement_v1",
    fallbackCode: null,
    text: "Measured proof",
    alignment: "center",
    box: {x: 0.1, y: 0.16, width: 0.8, height: 0.14},
    fontSizePx: 72,
    primitive: {kind: "outline", widthPx: 2, color: "#101316"},
  },
  {
    probeId: "editorial",
    frame: 8,
    family: "editorial",
    variantId: "editorial.subject_opposite_v1",
    fallbackCode: null,
    text: "Editorial contrast",
    alignment: "left",
    box: {x: 0.08, y: 0.4, width: 0.58, height: 0.16},
    fontSizePx: 68,
    primitive: {
      kind: "shadow",
      blurPx: 12,
      offsetXPx: 0,
      offsetYPx: 4,
      color: "#000000",
      minimumOpacity: 0.8,
    },
  },
  {
    probeId: "personal",
    frame: 8,
    family: "personal",
    variantId: "personal.lower_dialogue_v1",
    fallbackCode: "caption_safe_fallback",
    text: "Personal voice",
    alignment: "center",
    box: {x: 0.12, y: 0.7, width: 0.76, height: 0.12},
    fontSizePx: 60,
    primitive: {
      kind: "solid_plate",
      paddingXPx: 20,
      paddingYPx: 12,
      cornerRadiusPx: 4,
      backgroundColor: "#111417",
      minimumOpacity: 0.82,
    },
  },
  {
    probeId: "crop-before",
    frame: 14,
    family: "personal",
    variantId: "personal.crop_hard_cut_v1",
    fallbackCode: "caption_safe_fallback",
    text: "Crop left",
    alignment: "center",
    box: {x: 0.12, y: 0.7, width: 0.76, height: 0.12},
    fontSizePx: 60,
    primitive: {
      kind: "solid_plate",
      paddingXPx: 20,
      paddingYPx: 12,
      cornerRadiusPx: 4,
      backgroundColor: "#111417",
      minimumOpacity: 0.82,
    },
  },
  {
    probeId: "crop-after",
    frame: 15,
    family: "personal",
    variantId: "personal.crop_hard_cut_v1",
    fallbackCode: "caption_safe_fallback",
    text: "Crop right",
    alignment: "center",
    box: {x: 0.12, y: 0.7, width: 0.76, height: 0.12},
    fontSizePx: 60,
    primitive: {
      kind: "solid_plate",
      paddingXPx: 20,
      paddingYPx: 12,
      cornerRadiusPx: 4,
      backgroundColor: "#111417",
      minimumOpacity: 0.82,
    },
  },
];

export const resolveWebPreviewRootRoute = (pathnameOrUrl: string): WebPreviewRootRoute => {
  const rawPath = pathnameOrUrl.split("?")[0]?.split("#")[0] ?? "/";
  const normalizedPath = rawPath.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/sandbox") {
    return "sandbox";
  }

  if (normalizedPath === "/joseph-study") {
    return "joseph-study";
  }

  if (normalizedPath === "/maul/references") {
    return "maul-reference-review";
  }

  if (normalizedPath === "/maul/review") {
    return "maul-review";
  }

  if (normalizedPath === "/maul/placement-tracer") {
    return "maul-placement-tracer";
  }

  return "preview-app";
};

export const shouldPreloadWebPreviewFonts = (route: WebPreviewRootRoute): boolean =>
  route !== "joseph-study" &&
  route !== "maul-reference-review" &&
  route !== "maul-review" &&
  route !== "maul-placement-tracer";

export const resolveSandboxDurationMs = (chunks: CaptionChunk[]): number => {
  const lastChunkEndMs = chunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0);
  return Math.max(SANDBOX_FALLBACK_DURATION_SECONDS * 1000, lastChunkEndMs);
};

export const resolveSandboxDurationInFrames = (chunks: CaptionChunk[], fps = SANDBOX_FPS): number => {
  return Math.max(1, Math.round((resolveSandboxDurationMs(chunks) / 1000) * fps));
};

export const buildSandboxCaptionChunks = (words: TranscribedWord[]): CaptionChunk[] => {
  const deterministicChunks = deterministicChunkWords(words, {
    profileId: SANDBOX_CAPTION_PROFILE_ID
  });
  const mappedChunks = mapWordChunksToCaptionChunks(deterministicChunks, undefined, {
    profileId: SANDBOX_CAPTION_PROFILE_ID
  });
  return buildCreativePreviewCaptionChunks(mappedChunks, {
    profileId: SANDBOX_CAPTION_PROFILE_ID,
    presentationMode: "long-form"
  }).map((chunk) => ({
    ...chunk,
    profileId: SANDBOX_CAPTION_PROFILE_ID
  }));
};

export const buildSandboxVideoMetadata = (chunks: CaptionChunk[]): VideoMetadata => {
  return {
    ...SANDBOX_SOURCE_VIDEO_METADATA,
    durationInFrames: Math.max(
      SANDBOX_SOURCE_VIDEO_METADATA.durationInFrames,
      resolveSandboxDurationInFrames(chunks, SANDBOX_FPS)
    )
  };
};

export const buildSandboxMotionModel = (chunks: CaptionChunk[]): MotionCompositionModel => {
  const videoMetadata = buildSandboxVideoMetadata(chunks);
  const model = buildMotionCompositionModel({
    chunks,
    tier: SANDBOX_MOTION_TIER,
    fps: SANDBOX_FPS,
    videoMetadata,
    captionProfileId: SANDBOX_CAPTION_PROFILE_ID,
    matteMode: "prefer-matte"
  });

  const matteManifest: MatteManifest = {
    id: "sandbox-test-matte",
    sourceVideo: SANDBOX_ASSET_URLS.videoSrc.replace(/^\//, ""),
    alphaSrc: SANDBOX_ASSET_URLS.matteSrc,
    foregroundSrc: SANDBOX_ASSET_URLS.matteSrc,
    width: SANDBOX_SOURCE_VIDEO_METADATA.width,
    height: SANDBOX_SOURCE_VIDEO_METADATA.height,
    fps: SANDBOX_SOURCE_VIDEO_METADATA.fps,
    status: "ready",
    provider: "offline-cache",
    cacheDir: "public/test-matte",
    updatedAt: new Date("2026-05-30T00:00:00.000Z").toISOString()
  };

  return {
    ...model,
    matteManifest,
    matteEnabled: true
  };
};

export type SandboxMatteTimeInput = {
  sourceCurrentTime: number;
  sourceDuration: number;
  matteDuration: number;
};

export const resolveSandboxMatteTime = ({
  sourceCurrentTime,
  sourceDuration,
  matteDuration
}: SandboxMatteTimeInput): number => {
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) {
    return Math.max(0, Math.min(matteDuration, sourceCurrentTime));
  }

  const progress = Math.max(0, Math.min(1, sourceCurrentTime / sourceDuration));
  return Math.max(0, Math.min(matteDuration, progress * matteDuration));
};
