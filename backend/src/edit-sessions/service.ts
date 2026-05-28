import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {mkdir, readFile, stat, writeFile} from "node:fs/promises";
import path from "node:path";

import type {FastifyRequest} from "fastify";

import type {BackendEnv} from "../config";
import {resolveRenderConfigFromEnv, type RenderConfig} from "../config/render-flags";
import {transcribeWithAssemblyAI, streamAudioBufferWithAssemblyAI} from "../integrations/assemblyai";
import {probeVideoMetadata} from "../integrations/ffprobe";
import {runFfmpegBufferCommand} from "../sound-engine/ffmpeg";
import {InProcessQueue} from "../queue";
import {LocalPreviewRunner} from "../local-preview-runner";
import {createEditSessionId} from "../utils/ids";
import {renderDiagnosticsSchema, type RenderDiagnostics} from "../contracts/render-diagnostics";
import {type CreativeDecisionManifest} from "../contracts/creative-decision-manifest";
import {generateTypographyDecision} from "../typography/typography-decision-engine";
import {resolveLocalFontPairByVibe} from "../typography/font-file-resolver";
import {ZillizFontResolver} from "../typography/zilliz-font-resolver";
import {buildMotionDialectPlan} from "../typography/motion-dialect-engine";
import {selectTextAnimation} from "../animation/animation-retrieval-engine";
import {PreviewRenderService} from "../render/preview-render-service";
import {resolveRenderAuthority} from "../render/render-authority";
import {
  editSessionCreateRequestSchema,
  editSessionPreviewManifestSchema,
  editSessionPlaceholderSchema,
  editSessionPreviewStartRequestSchema,
  type EditSessionPreviewManifest,
  type EditSessionPreviewManifestSourceKind,
  editSessionPublicStateSchema,
  editSessionRenderStartRequestSchema,
  editSessionStateSchema,
  editSessionUploadCompleteRequestSchema,
  type EditSessionMotionCue,
  type EditSessionPlaceholder,
  type EditSessionPublicState,
  type EditSessionRenderStartRequest,
  type EditSessionLiveActivity,
  type EditSessionState,
  type EditSessionUploadCompleteRequest
} from "./types";
import {EditSessionStore} from "./store";
import type {ResolvedVibeFont} from "../typography/zilliz-font-resolver";

const PREVIEW_AUDIO_SAMPLE_RATE = 16000;
const PREVIEW_AUDIO_CHUNK_MS = 50;
const DEFAULT_PREVIEW_SECONDS = 8;
const PREVIEW_PROMOTION_DEBOUNCE_MS = 180;
const SESSION_INACTIVITY_EVICTION_MS = 60 * 60 * 1000;
const SESSION_EVICTION_SWEEP_MS = Math.max(5 * 60 * 1000, SESSION_INACTIVITY_EVICTION_MS / 4);
const PREVIEW_PLACEHOLDER_COPY = "Loading the first typographic beat.";
const PREVIEW_PLACEHOLDER_LINE_2 = "Keep the motion lane warm.";
const PREVIEW_CAPTION_PROFILE_ID = "longform_svg_typography_v1";
const ACTIVITY_HEARTBEAT_INTERVAL_MS = 5000;
const RENDER_STAGE_PROGRESS: Record<string, number> = {
  idle: 0,
  cleaning: 5,
  ingesting: 20,
  drafting: 55,
  mastering: 85,
  completed: 100,
  failed: 100
};

const resolvePreviewCompositionFps = (env: BackendEnv): 24 | 30 => {
  const fps = env.PREVIEW_COMPOSITION_FPS;
  if (fps !== 24 && fps !== 30) {
    throw new Error("Invalid FPS configuration");
  }
  return fps;
};

const nowIso = (deps: EditSessionDependencies): string => {
  return deps.now ? deps.now() : new Date().toISOString();
};

const buildLiveActivity = ({
  deps,
  activityCode,
  detail
}: {
  deps: EditSessionDependencies;
  activityCode: string;
  detail: string;
}): EditSessionLiveActivity => {
  const stamp = nowIso(deps);
  return {
    activityCode,
    detail,
    heartbeat: stamp,
    lastActiveAt: stamp
  };
};

type PreparedCreativeDecisionManifest = {
  manifest: CreativeDecisionManifest;
  previewManifestTypography?: EditSessionPreviewManifest["typography"];
};

const normalizeText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const buildPlaceholder = (
  styleId: EditSessionPlaceholder["styleId"] = PREVIEW_CAPTION_PROFILE_ID
): EditSessionPlaceholder => {
  return editSessionPlaceholderSchema.parse({
    active: true,
    styleId,
    copy: PREVIEW_PLACEHOLDER_COPY,
    reason: "waiting_for_audio",
    line1: PREVIEW_PLACEHOLDER_COPY,
    line2: PREVIEW_PLACEHOLDER_LINE_2
  });
};

const buildMotionCue = ({
  sessionId,
  text,
  lineIndex,
  source,
  createdAt,
  phase,
  animation,
  emphasisWords
}: {
  sessionId: string;
  text: string;
  lineIndex: number;
  source: EditSessionMotionCue["source"];
  createdAt: string;
  phase: EditSessionMotionCue["phase"];
  animation: EditSessionMotionCue["animation"];
  emphasisWords: string[];
}): EditSessionMotionCue => {
  const trimmed = normalizeText(text);

  return {
    cueId: `${sessionId}_${source}_${lineIndex}_${createdAt}`,
    phase,
    animation,
    text: trimmed,
    lineIndex,
    startMs: lineIndex * 180,
    durationMs: lineIndex === 0 ? 760 : 640,
    emphasisWords,
    source,
    createdAt
  };
};

const inferRhetoricalIntent = (text: string): "authority" | "emphasis" | "premium_explain" | "neutral" => {
  const normalized = normalizeText(text).toLowerCase();
  if (/\bmust|never|always|rule|authority|proof\b/.test(normalized)) {
    return "authority";
  }
  if (/\bnow|important|key|focus|core|critical\b/.test(normalized)) {
    return "emphasis";
  }
  if (/\bexplain|because|how|why\b/.test(normalized)) {
    return "premium_explain";
  }
  return "neutral";
};

const buildMotionSequenceFromEngines = async ({
  sessionId,
  text,
  source,
  createdAt,
  renderConfig
}: {
  sessionId: string;
  text: string;
  source: EditSessionMotionCue["source"];
  createdAt: string;
  renderConfig: RenderConfig;
}): Promise<{lines: string[]; motionSequence: EditSessionMotionCue[]}> => {
  const rhetoricalIntent = inferRhetoricalIntent(text);
  const localFontPair = resolveLocalFontPairByVibe(`${rhetoricalIntent} ${text}`, 2);
  const typographyDecision = generateTypographyDecision({
    text,
    rhetoricalIntent,
    availableFonts: localFontPair
      ? [
          {family: localFontPair.primary.family, source: "custom_ingested" as const},
          ...(localFontPair.secondary
            ? [{family: localFontPair.secondary.family, source: "custom_ingested" as const}]
            : [])
        ]
      : [],
    renderConfig,
    maxLines: 3,
    maxCharsPerLine: 28,
    pairingThreshold: 0.8
  });
  const lines = typographyDecision.linePlan.lines;
  if (lines.length === 0) {
    return {
      lines: [PREVIEW_PLACEHOLDER_COPY],
      motionSequence: [
      buildMotionCue({
        sessionId,
        text: PREVIEW_PLACEHOLDER_COPY,
        lineIndex: 0,
        source: "placeholder",
        createdAt,
        phase: "placeholder",
        animation: "fade_up",
        emphasisWords: []
      })
      ]
    };
  }

  const animationDecision = await selectTextAnimation({
    rhetoricalIntent,
    motionIntensity: rhetoricalIntent === "emphasis" ? 0.7 : 0.5,
    typographyMode: "svg_longform_typography_v1",
    renderConfig
  });

  const emphasisWords = typographyDecision.coreWords;
  const motionSequence = lines.map((line, index) =>
    buildMotionCue({
      sessionId,
      text: line,
      lineIndex: index,
      source,
      createdAt,
      phase: index === 0 ? "reveal" : "lock",
      animation: animationDecision.family,
      emphasisWords
    })
  );
  return {lines, motionSequence};
};

const buildAnalysisSummary = ({
  session,
  source
}: {
  session: EditSessionState;
  source: "placeholder" | "preview" | "transcript";
}): Record<string, unknown> => {
  return {
    styleId: session.captionProfileId,
    source,
    previewLineCount: session.previewLines.length,
    previewTextReady: session.previewStatus === "preview_text_ready",
    transcriptReady: session.transcriptStatus === "full_transcript_ready",
    guardrail: "debounce_motion_updates_on_turn_boundaries"
  };
};

const buildMotionGraphicsSummary = ({
  session,
  source
}: {
  session: EditSessionState;
  source: "placeholder" | "preview" | "transcript";
}): Record<string, unknown> => {
  return {
    styleId: session.captionProfileId,
    source,
    motionCueCount: session.previewMotionSequence.length,
    minimalStyle: true,
    avoidedStyleFamily: "alex-mozzie",
    renderReady: session.previewStatus === "preview_text_ready" || session.previewStatus === "preview_placeholder_ready"
  };
};

const readStringMetadata = (metadata: Record<string, unknown>, candidates: string[]): string | null => {
  for (const candidate of candidates) {
    const value = metadata[candidate];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const readNumberMetadata = (metadata: Record<string, unknown>, candidates: string[]): number | null => {
  for (const candidate of candidates) {
    const value = metadata[candidate];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
};

const inferManifestFontFormat = (publicPath: string): "ttf" | "otf" | "woff" | "woff2" | null => {
  const normalized = publicPath.trim().replace(/[?#].*$/, "");
  const match = normalized.toLowerCase().match(/\.(ttf|otf|woff2|woff)$/);
  if (!match) {
    return null;
  }

  return match[1] as "ttf" | "otf" | "woff" | "woff2";
};

const absolutizeManifestFontUrl = (candidate: string, fontBaseUrl?: string | null): string => {
  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  if (!fontBaseUrl || !candidate.startsWith("/")) {
    return candidate;
  }

  return `${fontBaseUrl.replace(/\/+$/, "")}${candidate}`;
};

const buildPreviewManifestTypography = (
  session: EditSessionState,
  {fontBaseUrl}: {fontBaseUrl?: string | null} = {}
) => {
  const metadata = session.metadata as Record<string, unknown>;
  const typography = (metadata.previewManifestTypography ?? null) as Record<string, unknown> | null;
  if (!typography) {
    return undefined;
  }

  const mapFont = (candidate: unknown) => {
    if (!candidate || typeof candidate !== "object") {
      return null;
    }

    const record = candidate as Record<string, unknown>;
    const family = typeof record.family === "string" ? record.family.trim() : "";
    if (!family) {
      return null;
    }

    const browserUrl = typeof record.browserUrl === "string" && record.browserUrl.trim()
      ? absolutizeManifestFontUrl(record.browserUrl.trim(), fontBaseUrl)
      : undefined;
    const sources = Array.isArray(record.sources)
      ? record.sources.flatMap((entry) => {
          if (!entry || typeof entry !== "object") {
            return [];
          }

          const sourceRecord = entry as Record<string, unknown>;
          const publicPath = typeof sourceRecord.publicPath === "string" && sourceRecord.publicPath.trim()
            ? absolutizeManifestFontUrl(sourceRecord.publicPath.trim(), fontBaseUrl)
            : "";
          const format = inferManifestFontFormat(publicPath);
          if (!publicPath || !format) {
            return [];
          }

          return [{
            publicPath,
            format,
            weight: typeof sourceRecord.weight === "number" ? sourceRecord.weight : 400,
            style: typeof sourceRecord.style === "string" ? sourceRecord.style : "normal"
          }];
        })
      : [];

    return {
      family,
      browserUrl,
      sources
    };
  };

  const primaryFont = mapFont(typography.primaryFont);
  const secondaryFont = mapFont(typography.secondaryFont);
  if (!primaryFont) {
    return undefined;
  }

  return {
    primaryFont,
    secondaryFont: secondaryFont ?? undefined
  };
};

const buildPreviewManifestFont = (
  font: Pick<ResolvedVibeFont, "family" | "browserUrl" | "sources"> | undefined
) => {
  if (!font) {
    return undefined;
  }

  const browserUrl = font.browserUrl.trim();
  const sources = font.sources.map((source) => ({
    publicPath: source.browserUrl,
    format: source.format,
    weight: 400,
    style: "normal"
  }));

  if (!browserUrl && sources.length === 0) {
    return undefined;
  }

  return {
    family: font.family,
    browserUrl: browserUrl || undefined,
    sources
  };
};

const buildPreviewDiagnostics = ({
  session,
  renderConfig,
  artifactAvailable,
  artifactUrl
}: {
  session: EditSessionState;
  renderConfig: RenderConfig;
  artifactAvailable: boolean;
  artifactUrl?: string | null;
}): RenderDiagnostics => {
  const previewUrl = artifactUrl ?? session.renderOutputUrl ?? null;
  const remotionUsed = renderConfig.PREVIEW_ENGINE === "remotion" && renderConfig.ENABLE_REMOTION_PREVIEW;
  const warnings: string[] = [];
  if (!renderConfig.ENABLE_REMOTION_PREVIEW) {
    warnings.push("Remotion interactive preview disabled by feature flag.");
  }
  if (!renderConfig.ENABLE_LIVE_BROWSER_OVERLAY) {
    warnings.push("Live browser overlay disabled by feature flag.");
  }

  const pipelineTrace = renderConfig.ENABLE_PREVIEW_PIPELINE_TRACE
    ? resolveRenderAuthority({
      jobId: session.id,
      previewModeRequested: session.sourceHasVideo ? "video_preview" : "audio_only_preview",
      renderConfig,
      artifactAvailable
    })
    : undefined;
  const fallbackReasons: string[] = [];
  if (pipelineTrace?.oldFallbackTriggered) {
    fallbackReasons.push(pipelineTrace.fallbackReason ?? "preview_artifact_unavailable");
  }
  const metadata = session.metadata as Record<string, unknown>;
  const fontProofFromMetadata = (metadata.previewFontProof ?? null) as Record<string, unknown> | null;
  const animationProofFromMetadata = (metadata.previewAnimationProof ?? null) as Record<string, unknown> | null;
  const featureDiagnosticsFromMetadata = (metadata.previewFeatureDiagnostics ?? null) as Record<string, unknown> | null;
  const styleAuthorityFromMetadata = (metadata.previewStyleAuthority ?? null) as Record<string, unknown> | null;
  const previewArtifactKind =
    metadata.previewArtifactKind === "html_composition" || metadata.previewArtifactKind === "video"
      ? metadata.previewArtifactKind
      : null;
  const previewArtifactContentType =
    typeof metadata.previewArtifactContentType === "string" && metadata.previewArtifactContentType.trim()
      ? metadata.previewArtifactContentType.trim()
      : null;
  const previewArtifactWarnings = Array.isArray(metadata.previewArtifactWarnings)
    ? metadata.previewArtifactWarnings.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const gsapFeatureFromMetadata = (
    featureDiagnosticsFromMetadata && typeof featureDiagnosticsFromMetadata.gsap === "object"
      ? featureDiagnosticsFromMetadata.gsap
      : null
  ) as Record<string, unknown> | null;
  const kineticFeatureFromMetadata = (
    featureDiagnosticsFromMetadata && typeof featureDiagnosticsFromMetadata.kineticTypography === "object"
      ? featureDiagnosticsFromMetadata.kineticTypography
      : null
  ) as Record<string, unknown> | null;
  const fontFeatureFromMetadata = (
    featureDiagnosticsFromMetadata && typeof featureDiagnosticsFromMetadata.fonts === "object"
      ? featureDiagnosticsFromMetadata.fonts
      : null
  ) as Record<string, unknown> | null;

  if (typeof gsapFeatureFromMetadata?.fallbackReason === "string" && gsapFeatureFromMetadata.fallbackReason.trim()) {
    fallbackReasons.push(gsapFeatureFromMetadata.fallbackReason.trim());
  }
  if (typeof kineticFeatureFromMetadata?.fallbackReason === "string" && kineticFeatureFromMetadata.fallbackReason.trim()) {
    fallbackReasons.push(kineticFeatureFromMetadata.fallbackReason.trim());
  }

  return renderDiagnosticsSchema.parse({
    jobId: session.id,
    previewEngine: renderConfig.PREVIEW_ENGINE,
    previewUrl,
    previewArtifactKind,
    previewArtifactContentType,
    manifestVersion: "hyperframes-preview-manifest/v1",
    renderTimeMs: null,
    compositionGenerationTimeMs: null,
    fontsUsed: Array.isArray(fontProofFromMetadata?.fontsRequestedFromManifest)
      ? fontProofFromMetadata.fontsRequestedFromManifest as string[]
      : [],
    fontGraphUsed: renderConfig.ENABLE_FONT_GRAPH,
    customFontsUsed: Boolean(fontProofFromMetadata && Array.isArray(fontProofFromMetadata.fontFilesLoadedIntoComposition)
      && (fontProofFromMetadata.fontFilesLoadedIntoComposition as unknown[]).length > 0),
    milvusUsed: renderConfig.ENABLE_MILVUS_ANIMATION_RETRIEVAL,
    retrievedAnimationId: typeof animationProofFromMetadata?.retrievedAnimationId === "string"
      ? animationProofFromMetadata.retrievedAnimationId
      : null,
    animationFamily: typeof animationProofFromMetadata?.animationRequestedFromManifest === "string"
      ? animationProofFromMetadata.animationRequestedFromManifest
      : null,
    fallbackUsed: fallbackReasons.length > 0,
    fallbackReasons: [...new Set(fallbackReasons)],
    degradedStages: fallbackReasons.length > 0 ? ["preview-render"] : [],
    visibleFailureCount: fallbackReasons.length,
    cognitiveConfidence: fallbackReasons.length > 0 ? 0.78 : 0.96,
    temporalConfidence: 0.9,
    legacyOverlayUsed: renderConfig.ENABLE_LEGACY_OVERLAY,
    remotionUsed,
    hyperframesUsed: renderConfig.PREVIEW_ENGINE === "hyperframes",
    overlapCheckPassed: null,
    fontProof: {
      fontsRequestedFromManifest: Array.isArray(fontProofFromMetadata?.fontsRequestedFromManifest)
        ? fontProofFromMetadata.fontsRequestedFromManifest as string[]
        : [],
      fontFilesResolved: Array.isArray(fontProofFromMetadata?.fontFilesResolved)
        ? fontProofFromMetadata.fontFilesResolved as string[]
        : [],
      fontFilesLoadedIntoComposition: Array.isArray(fontProofFromMetadata?.fontFilesLoadedIntoComposition)
        ? fontProofFromMetadata.fontFilesLoadedIntoComposition as string[]
        : [],
      fontCssGenerated: Boolean(fontProofFromMetadata?.fontCssGenerated),
      fallbackFontsUsed: Array.isArray(fontProofFromMetadata?.fallbackFontsUsed)
        ? fontProofFromMetadata.fallbackFontsUsed as string[]
        : [],
      fallbackReasons: Array.isArray(fontProofFromMetadata?.fallbackReasons)
        ? fontProofFromMetadata.fallbackReasons as string[]
        : []
    },
    animationProof: {
      animationRequestedFromManifest: typeof animationProofFromMetadata?.animationRequestedFromManifest === "string"
        ? animationProofFromMetadata.animationRequestedFromManifest
        : null,
      animationRetrievedFromMilvus: Boolean(animationProofFromMetadata?.animationRetrievedFromMilvus),
      retrievedAnimationId: typeof animationProofFromMetadata?.retrievedAnimationId === "string"
        ? animationProofFromMetadata.retrievedAnimationId
        : null,
      gsapTimelineGenerated: Boolean(animationProofFromMetadata?.gsapTimelineGenerated),
      fallbackAnimationUsed: Boolean(animationProofFromMetadata?.fallbackAnimationUsed),
      fallbackReasons: Array.isArray(animationProofFromMetadata?.fallbackReasons)
        ? animationProofFromMetadata.fallbackReasons as string[]
        : []
    },
    features: {
      gsap: {
        requested: Boolean(gsapFeatureFromMetadata?.requested),
        activated: Boolean(gsapFeatureFromMetadata?.activated),
        fallbackUsed: Boolean(gsapFeatureFromMetadata?.fallbackUsed),
        fallbackReason: typeof gsapFeatureFromMetadata?.fallbackReason === "string"
          ? gsapFeatureFromMetadata.fallbackReason
          : undefined,
        artifactPath: typeof gsapFeatureFromMetadata?.artifactPath === "string"
          ? gsapFeatureFromMetadata.artifactPath
          : undefined,
        evidence: Array.isArray(gsapFeatureFromMetadata?.evidence)
          ? gsapFeatureFromMetadata.evidence as string[]
          : []
      },
      kineticTypography: {
        requested: Boolean(kineticFeatureFromMetadata?.requested),
        activated: Boolean(kineticFeatureFromMetadata?.activated),
        fallbackUsed: Boolean(kineticFeatureFromMetadata?.fallbackUsed),
        fallbackReason: typeof kineticFeatureFromMetadata?.fallbackReason === "string"
          ? kineticFeatureFromMetadata.fallbackReason
          : undefined,
        artifactPath: typeof kineticFeatureFromMetadata?.artifactPath === "string"
          ? kineticFeatureFromMetadata.artifactPath
          : undefined,
        evidence: Array.isArray(kineticFeatureFromMetadata?.evidence)
          ? kineticFeatureFromMetadata.evidence as string[]
          : []
      },
      fonts: {
        requested: Boolean(fontFeatureFromMetadata?.requested),
        activated: Boolean(fontFeatureFromMetadata?.activated),
        fallbackUsed: Boolean(fontFeatureFromMetadata?.fallbackUsed),
        fallbackReason: typeof fontFeatureFromMetadata?.fallbackReason === "string"
          ? fontFeatureFromMetadata.fallbackReason
          : undefined,
        artifactPath: typeof fontFeatureFromMetadata?.artifactPath === "string"
          ? fontFeatureFromMetadata.artifactPath
          : undefined,
        evidence: Array.isArray(fontFeatureFromMetadata?.evidence)
          ? fontFeatureFromMetadata.evidence as string[]
          : []
      }
    },
    styleAuthority: styleAuthorityFromMetadata ? {
      requestedStyle: typeof styleAuthorityFromMetadata.requestedStyle === "string"
        ? styleAuthorityFromMetadata.requestedStyle
        : null,
      appliedStyle: typeof styleAuthorityFromMetadata.appliedStyle === "string"
        ? styleAuthorityFromMetadata.appliedStyle
        : null,
      motionPreset: typeof styleAuthorityFromMetadata.motionPreset === "string"
        ? styleAuthorityFromMetadata.motionPreset
        : null,
      typographyMode: typeof styleAuthorityFromMetadata.typographyMode === "string"
        ? styleAuthorityFromMetadata.typographyMode
        : null,
      speechRateEstimate: typeof styleAuthorityFromMetadata.speechRateEstimate === "number"
        ? styleAuthorityFromMetadata.speechRateEstimate
        : null,
      materialChangesVerified: Boolean(styleAuthorityFromMetadata.materialChangesVerified),
      deviations: Array.isArray(styleAuthorityFromMetadata.deviations)
        ? styleAuthorityFromMetadata.deviations as string[]
        : [],
      styleDeviationWarnings: Array.isArray(styleAuthorityFromMetadata.styleDeviationWarnings)
        ? styleAuthorityFromMetadata.styleDeviationWarnings as string[]
        : [],
      evidence: Array.isArray(styleAuthorityFromMetadata.evidence)
        ? styleAuthorityFromMetadata.evidence as string[]
        : []
    } : undefined,
    warnings: [
      ...warnings,
      ...previewArtifactWarnings,
      ...(previewArtifactKind === "html_composition"
        ? ["Preview artifact is currently an HTML composition, not a rendered video file."]
        : [])
    ],
    pipelineTrace
  });
};

const buildSessionRoutes = (sessionId: string, sourceMedia: string | null) => ({
  status: `/api/edit-sessions/${sessionId}/status`,
  previewManifest: `/api/edit-sessions/${sessionId}/preview-manifest`,
  previewArtifact: `/api/edit-sessions/${sessionId}/preview-artifact`,
  preview: `/api/edit-sessions/${sessionId}/preview`,
  render: `/api/edit-sessions/${sessionId}/render`,
  renderStatus: `/api/edit-sessions/${sessionId}/render-status`,
  sourceMedia,
  events: `/api/edit-sessions/${sessionId}/events`
});

const buildSessionLanes = (renderConfig: RenderConfig) => {
  const interactive = renderConfig.ENABLE_REMOTION_PREVIEW
    ? ["hyperframes", "remotion"] as const
    : ["hyperframes"] as const;

  return {
    defaultInteractive:
      renderConfig.PREVIEW_ENGINE === "remotion" && renderConfig.ENABLE_REMOTION_PREVIEW
        ? "remotion"
        : "hyperframes",
    interactive: [...interactive],
    export: "remotion" as const
  };
};

const resolvePublicPreviewArtifact = (session: EditSessionState): {
  previewArtifactUrl: string | null;
  previewArtifactKind: "html_composition" | "video" | null;
  previewArtifactContentType: string | null;
} => {
  return {
    previewArtifactUrl:
      typeof session.metadata.previewArtifactUrl === "string" && session.metadata.previewArtifactUrl.trim()
        ? session.metadata.previewArtifactUrl
        : session.renderOutputUrl ?? null,
    previewArtifactKind:
      session.metadata.previewArtifactKind === "html_composition" || session.metadata.previewArtifactKind === "video"
        ? session.metadata.previewArtifactKind
        : null,
    previewArtifactContentType:
      typeof session.metadata.previewArtifactContentType === "string" && session.metadata.previewArtifactContentType.trim()
        ? session.metadata.previewArtifactContentType.trim()
        : null
  };
};

const toPublicSession = (session: EditSessionState, renderConfig: RenderConfig): EditSessionPublicState => {
  const sourceMediaUrl = resolvePreviewManifestSourceUrl(session);
  const {previewArtifactUrl, previewArtifactKind, previewArtifactContentType} = resolvePublicPreviewArtifact(session);

  return editSessionPublicStateSchema.parse({
    ...session,
    routes: buildSessionRoutes(session.id, sourceMediaUrl),
    lanes: buildSessionLanes(renderConfig),
    sourceMediaUrl,
    sourceMediaKind: resolvePreviewManifestSourceKind(session),
    sourceLabel:
      typeof session.metadata.sourceDisplayName === "string" && session.metadata.sourceDisplayName.trim()
        ? session.metadata.sourceDisplayName.trim()
        : session.sourceFilename,
    previewArtifactUrl,
    previewArtifactKind,
    previewArtifactContentType,
    previewDiagnostics: buildPreviewDiagnostics({
      session,
      renderConfig,
      artifactAvailable: Boolean(previewArtifactUrl),
      artifactUrl: previewArtifactUrl
    })
  });
};

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "video/webm"
};

const inferMediaContentType = (filePath: string): string => {
  return CONTENT_TYPE_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
};

const inferMaybeVideoSource = ({
  sourcePath,
  sourceFilename
}: {
  sourcePath: string | null;
  sourceFilename: string | null;
}): boolean => {
  const candidate = sourcePath ?? sourceFilename ?? "";
  if (!candidate) {
    return false;
  }

  return inferMediaContentType(candidate).startsWith("video/");
};

const sourcePathExists = async (candidatePath: string | null): Promise<boolean> => {
  if (!candidatePath) {
    return false;
  }

  try {
    await stat(candidatePath);
    return true;
  } catch {
    return false;
  }
};

const resolveLocalSourcePath = (session: EditSessionState): string | null => {
  const candidate = session.sourcePath?.trim();
  if (candidate) {
    return path.resolve(candidate);
  }

  const storageKey = session.storageKey?.trim();
  if (!storageKey) {
    return null;
  }

  if (storageKey.startsWith("file://")) {
    try {
      return path.resolve(new URL(storageKey).pathname);
    } catch {
      return null;
    }
  }

  if (path.isAbsolute(storageKey)) {
    return path.resolve(storageKey);
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(storageKey)) {
    return null;
  }

  return path.resolve(storageKey);
};

const resolvePreviewManifestSourceKind = (session: EditSessionState): EditSessionPreviewManifestSourceKind => {
  const metadataSource = typeof session.metadata.source === "string" ? session.metadata.source.trim().toLowerCase() : "";
  const hasDirectMediaUrl = Boolean(session.mediaUrl?.trim());
  const uploadedFromBrowser = session.metadata.uploadedFromBrowser === true;

  if (metadataSource === "r2") {
    return "r2_asset";
  }

  if (hasDirectMediaUrl) {
    return "remote_url";
  }

  if (uploadedFromBrowser) {
    return "session_source_stream";
  }

  if (resolveLocalSourcePath(session)) {
    return "local_test_asset";
  }

  return "none";
};

const resolvePreviewManifestSourceUrl = (session: EditSessionState): string | null => {
  const mediaUrl = session.mediaUrl?.trim();
  if (mediaUrl) {
    return mediaUrl;
  }

  const sourceKind = resolvePreviewManifestSourceKind(session);
  if (sourceKind === "session_source_stream" || sourceKind === "local_test_asset" || sourceKind === "r2_asset") {
    return `/api/edit-sessions/${session.id}/source`;
  }

  return null;
};

type TranscriptCacheEntry = {
  fingerprint: string;
  transcriptWords: EditSessionState["transcriptWords"];
  transcriptText: string;
  cachedAt: string;
  sourceFilename: string | null;
};

const hashFileSha1 = async (filePath: string): Promise<string> => {
  const hash = createHash("sha1");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  return hash.digest("hex");
};

const extractPreviewAudioBuffer = async ({
  sourcePath,
  previewSeconds
}: {
  sourcePath: string;
  previewSeconds: number;
}): Promise<Buffer> => {
  const {stdout} = await runFfmpegBufferCommand([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourcePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(PREVIEW_AUDIO_SAMPLE_RATE),
    "-t",
    String(previewSeconds),
    "-f",
    "s16le",
    "pipe:1"
  ]);
  return stdout;
};

type RenderDriverSnapshot = {
  state: "idle" | "running" | "completed" | "failed";
  stage: string;
  outputUrl: string | null;
  outputPath: string | null;
  errorMessage: string | null;
  progress: number;
};

export type EditSessionSourceMediaAsset = {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  hasVideo: boolean;
};

export type EditSessionPreviewArtifactAsset = {
  filePath: string;
  contentType: string;
};

export type EditSessionRenderDriver = {
  startRender: (input: {
    sourcePath: string;
    captionProfileId: string;
    motionTier: string;
    cleanRun: boolean;
    deliveryMode: "speed-draft" | "master-render";
  }) => Promise<void>;
  getStatus: () => Promise<RenderDriverSnapshot>;
};

const createDefaultRenderDriver = (): EditSessionRenderDriver => {
  const runner = new LocalPreviewRunner();
  return {
    startRender: async (input) => {
      const fakeRequest = {
        isMultipart: () => false,
        body: {
          sourcePath: input.sourcePath,
          cleanRun: input.cleanRun,
          captionProfileId: input.captionProfileId,
          motionTier: input.motionTier,
          transcriptionMode: "assemblyai",
          deliveryMode: input.deliveryMode
        }
      } as unknown as FastifyRequest;
      const normalized = await runner.parseRunRequest(fakeRequest);
      await runner.startRun(normalized);
    },
    getStatus: async () => {
      const status = await runner.getStatus();
      const progress = RENDER_STAGE_PROGRESS[status.stage] ?? 0;
      return {
        state:
          status.state === "completed"
            ? "completed"
            : status.state === "failed"
              ? "failed"
              : status.state === "running"
                ? "running"
                : "idle",
        stage: status.stage,
        outputUrl: status.outputUrl,
        outputPath: status.outputPath,
        errorMessage: status.errorMessage,
        progress
      };
    }
  };
};

export type EditSessionEvent = {
  type:
    | "session_snapshot"
    | "preview_initializing"
    | "preview_placeholder_ready"
    | "preview_text_ready"
    | "transcript_started"
    | "transcript_progress"
    | "transcript_ready"
    | "analysis_ready"
    | "motion_graphics_ready"
    | "render_started"
    | "render_progress"
    | "render_complete"
    | "failed";
  at: string;
  session: EditSessionPublicState;
  detail?: Record<string, unknown>;
};

export type EditSessionDependencies = {
  now?: () => string;
  fetchImpl?: typeof fetch;
  probeVideoMetadata?: typeof probeVideoMetadata;
  extractPreviewAudioBuffer?: (input: {sourcePath: string; previewSeconds: number}) => Promise<Buffer>;
  streamPreviewAudio?: typeof streamAudioBufferWithAssemblyAI;
  transcribeMedia?: typeof transcribeWithAssemblyAI;
  renderDriver?: EditSessionRenderDriver;
  previewRenderService?: PreviewRenderService;
};

export class EditSessionManager {
  private readonly store: EditSessionStore;
  private readonly env: BackendEnv;
  private readonly renderConfig: RenderConfig;
  private readonly deps: EditSessionDependencies;
  private readonly sessions = new Map<string, EditSessionState>();
  private readonly sessionLastAccessAt = new Map<string, number>();
  private readonly subscribers = new Map<string, Set<(event: EditSessionEvent) => void>>();
  private readonly mutationChains = new Map<string, Promise<EditSessionState>>();
  private readonly activeMutationCounts = new Map<string, number>();
  private readonly artifactRefreshChains = new Map<string, Promise<void>>();
  private readonly renderQueue = new InProcessQueue(1);
  private readonly renderDriver: EditSessionRenderDriver;
  private readonly previewRenderService: PreviewRenderService;
  private readonly zillizFontResolver: ZillizFontResolver;
  private evictionTimer: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();

  public constructor({
    store,
    env,
    deps
  }: {
    store: EditSessionStore;
    env: BackendEnv;
    deps?: EditSessionDependencies;
  }) {
    this.store = store;
    this.env = env;
    this.renderConfig = resolveRenderConfigFromEnv(env);
    this.deps = deps ?? {};
    this.renderDriver = this.deps.renderDriver ?? createDefaultRenderDriver();
    this.previewRenderService = this.deps.previewRenderService ?? new PreviewRenderService();
    this.zillizFontResolver = new ZillizFontResolver(env);
  }

  public async initialize(): Promise<void> {
    await this.store.initialize();
    if (!this.evictionTimer) {
      this.evictionTimer = setInterval(() => {
        void this.evictInactiveSessions();
      }, SESSION_EVICTION_SWEEP_MS);
      this.evictionTimer.unref?.();
    }
  }

  public destroy(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
    this.heartbeatTimers.forEach((timer) => clearInterval(timer));
    this.heartbeatTimers.clear();
  }

  private startActivityHeartbeat(sessionId: string, detail: string): void {
    this.stopActivityHeartbeat(sessionId);
    const timer = setInterval(() => {
      void this.updateLiveActivity(sessionId, "TASK_HEARTBEAT", detail).catch(() => undefined);
    }, ACTIVITY_HEARTBEAT_INTERVAL_MS);
    timer.unref?.();
    this.heartbeatTimers.set(sessionId, timer);
  }

  private stopActivityHeartbeat(sessionId: string): void {
    const timer = this.heartbeatTimers.get(sessionId);
    if (!timer) {
      return;
    }
    clearInterval(timer);
    this.heartbeatTimers.delete(sessionId);
  }

  private async updateLiveActivity(sessionId: string, activityCode: string, detail: string): Promise<void> {
    await this.updateSession(sessionId, () => ({
      liveActivity: buildLiveActivity({
        deps: this.deps,
        activityCode,
        detail
      })
    }));
  }

  private transcriptCacheDir(): string {
    return path.join(this.store.sessionsRootDir(), "_transcript-cache");
  }

  private transcriptCacheFilePath(fingerprint: string): string {
    return path.join(this.transcriptCacheDir(), `${fingerprint}.json`);
  }

  private async resolveTranscriptFingerprint(session: EditSessionState, sourcePath: string): Promise<string> {
    const existing = typeof session.metadata.sourceFingerprint === "string" ? session.metadata.sourceFingerprint.trim() : "";
    if (existing) {
      return existing;
    }

    return hashFileSha1(sourcePath);
  }

  private async readTranscriptCache(fingerprint: string): Promise<TranscriptCacheEntry | null> {
    try {
      const raw = await readFile(this.transcriptCacheFilePath(fingerprint), "utf-8");
      return JSON.parse(raw) as TranscriptCacheEntry;
    } catch {
      return null;
    }
  }

  private async writeTranscriptCache(entry: TranscriptCacheEntry): Promise<void> {
    await mkdir(this.transcriptCacheDir(), {recursive: true});
    await writeFile(this.transcriptCacheFilePath(entry.fingerprint), `${JSON.stringify(entry, null, 2)}\n`, "utf-8");
  }

  private logPreviewStage(sessionId: string, stage: string, detail: Record<string, unknown> = {}): void {
    const session = this.sessions.get(sessionId);
    const createdAtMs = session?.createdAt ? Date.parse(session.createdAt) : Number.NaN;
    const elapsedMs = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs : null;
    console.info("[edit-session-preview]", {
      sessionId,
      stage,
      elapsedMs,
      previewStatus: session?.previewStatus ?? null,
      transcriptStatus: session?.transcriptStatus ?? null,
      transcriptWords: session?.transcriptWords.length ?? 0,
      ...detail
    });
  }

  private touchSession(sessionId: string): void {
    this.sessionLastAccessAt.set(sessionId, Date.now());
  }

  private async evictInactiveSessions(): Promise<void> {
    const cutoff = Date.now() - SESSION_INACTIVITY_EVICTION_MS;
    for (const [sessionId, lastAccessAt] of this.sessionLastAccessAt.entries()) {
      if (lastAccessAt > cutoff) {
        continue;
      }

      if ((this.subscribers.get(sessionId)?.size ?? 0) > 0) {
        continue;
      }

      if ((this.activeMutationCounts.get(sessionId) ?? 0) > 0) {
        continue;
      }

      this.sessions.delete(sessionId);
      this.sessionLastAccessAt.delete(sessionId);
      this.mutationChains.delete(sessionId);
      this.artifactRefreshChains.delete(sessionId);
    }
  }

  private queuePreviewArtifactRefresh(sessionId: string): void {
    const previous = this.artifactRefreshChains.get(sessionId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const session = await this.loadSession(sessionId);
        await this.ensurePreviewArtifact(session);
      })
      .catch(() => undefined);
    this.artifactRefreshChains.set(sessionId, next);
  }

  public async createSession(payload: unknown): Promise<EditSessionPublicState> {
    const input = editSessionCreateRequestSchema.parse(payload ?? {});
    const now = nowIso(this.deps);
    const sessionId = createEditSessionId();
    const session = editSessionStateSchema.parse({
      id: sessionId,
      status: "uploaded",
      mediaUrl: input.mediaUrl ?? null,
      storageKey: input.storageKey ?? null,
      sourcePath: null,
      sourceFilename: input.sourceFilename ?? null,
      sourceDurationMs: null,
      sourceAspectRatio: null,
      sourceWidth: null,
      sourceHeight: null,
      sourceFps: null,
      sourceHasVideo: false,
      captionProfileId: input.captionProfileId ?? PREVIEW_CAPTION_PROFILE_ID,
      motionTier: input.motionTier ?? "minimal",
      previewStatus: "idle",
      previewText: null,
      previewPlaceholder: buildPlaceholder(input.captionProfileId ?? PREVIEW_CAPTION_PROFILE_ID),
      previewLines: [],
      previewMotionSequence: [],
      transcriptStatus: "idle",
      transcriptProgress: 0,
      transcriptWords: [],
      transcriptText: null,
      analysisStatus: "idle",
      analysisSummary: {},
      motionGraphicsStatus: "idle",
      motionGraphicsSummary: {},
      renderStatus: "idle",
      renderProgress: 0,
      renderOutputUrl: null,
      renderOutputPath: null,
      liveActivity: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      previewStartedAt: null,
      transcriptStartedAt: null,
      transcriptCompletedAt: null,
      analysisStartedAt: null,
      analysisCompletedAt: null,
      motionGraphicsStartedAt: null,
      motionGraphicsCompletedAt: null,
      renderStartedAt: null,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      metadata: input.metadata ?? {},
      streamSessionId: null,
      lastEventType: null,
      lastPreviewUpdateAt: null,
      lastTranscriptUpdateAt: null
    });

    this.sessions.set(sessionId, session);
    this.touchSession(sessionId);
    await this.store.writeSession(session);
    return toPublicSession(session, this.renderConfig);
  }

  public async getSession(sessionId: string): Promise<EditSessionPublicState> {
    return toPublicSession(await this.loadSession(sessionId), this.renderConfig);
  }

  public async getPreview(sessionId: string): Promise<Record<string, unknown>> {
    const session = await this.loadSession(sessionId);
    const {previewArtifactUrl: artifactUrl, previewArtifactKind, previewArtifactContentType} = resolvePublicPreviewArtifact(session);
    const diagnostics = buildPreviewDiagnostics({
      session,
      renderConfig: this.renderConfig,
      artifactAvailable: Boolean(artifactUrl),
      artifactUrl
    });
    return {
      id: session.id,
      status: session.previewStatus,
      styleId: session.captionProfileId,
      text: session.previewText,
      lines: session.previewLines,
      placeholder: session.previewPlaceholder,
      motionSequence: session.previewMotionSequence,
      lastTranscriptFragment: session.previewText ?? session.transcriptText,
      lastTurnAt: session.lastPreviewUpdateAt,
      readyAt: session.previewStatus === "preview_text_ready" ? session.lastPreviewUpdateAt : null,
      analysisStatus: session.analysisStatus,
      motionGraphicsStatus: session.motionGraphicsStatus,
      previewArtifactUrl: artifactUrl,
      previewArtifactKind,
      previewArtifactContentType,
      diagnostics
    };
  }

  public async getPreviewManifest(
    sessionId: string,
    options?: {
      fontBaseUrl?: string | null;
    }
  ): Promise<EditSessionPreviewManifest> {
    const session = await this.loadSession(sessionId);
    const {previewArtifactUrl: artifactUrl, previewArtifactKind, previewArtifactContentType} = resolvePublicPreviewArtifact(session);
    const sourceUrl = resolvePreviewManifestSourceUrl(session);
    const sourceKind = resolvePreviewManifestSourceKind(session);
    const sourceLabel =
      typeof session.metadata.sourceDisplayName === "string" && session.metadata.sourceDisplayName.trim()
        ? session.metadata.sourceDisplayName.trim()
        : session.sourceFilename;
    const hasVideo = session.sourceHasVideo === true;
    const baseVideoSrc = hasVideo ? sourceUrl : null;
    const separateAudioSrc = hasVideo ? null : sourceUrl;

    const sessionLanes = buildSessionLanes(this.renderConfig);
    const sessionRoutes = buildSessionRoutes(session.id, sourceUrl);

    return editSessionPreviewManifestSchema.parse({
      schemaVersion: "hyperframes-preview-manifest/v1",
      sessionId: session.id,
      captionProfileId: session.captionProfileId,
      motionTier: session.motionTier,
      lanes: sessionLanes,
      routes: {
        status: sessionRoutes.status,
        preview: sessionRoutes.preview,
        render: sessionRoutes.render,
        renderStatus: sessionRoutes.renderStatus,
        sourceMedia: sessionRoutes.sourceMedia
      },
      baseVideo: {
        src: baseVideoSrc,
        sourceKind,
        sourceLabel: sourceLabel ?? null,
        hasVideo,
        width: session.sourceWidth,
        height: session.sourceHeight,
        fps: session.sourceFps,
        durationMs: session.sourceDurationMs
      },
      audio: {
        src: separateAudioSrc,
        source: hasVideo ? "video-element" : separateAudioSrc ? "separate-audio" : "none"
      },
      session: toPublicSession(session, this.renderConfig),
      overlayPlan: {
        previewText: session.previewText,
        previewLines: session.previewLines,
        previewMotionSequence: session.previewMotionSequence,
        transcriptWords: session.transcriptWords,
        placeholder: session.previewPlaceholder
      },
      typography: buildPreviewManifestTypography(session, {
        fontBaseUrl: options?.fontBaseUrl
      }),
      diagnostics: buildPreviewDiagnostics({
        session,
        renderConfig: this.renderConfig,
        artifactAvailable: Boolean(artifactUrl),
        artifactUrl
      }),
      export: {
        remotion: {
          available: true,
          renderStatus: session.renderStatus,
          outputUrl: session.renderOutputUrl,
          outputPath: session.renderOutputPath
        }
      },
      previewArtifactUrl: artifactUrl,
      previewArtifactKind,
      previewArtifactContentType
    });
  }

  public async getPreviewArtifact(sessionId: string): Promise<EditSessionPreviewArtifactAsset> {
    const session = await this.loadSession(sessionId);
    const {previewArtifactUrl: artifactUrl, previewArtifactContentType} = resolvePublicPreviewArtifact(session);
    if (!artifactUrl) {
      throw new Error("Preview artifact not available.");
    }

    const relativePath = String(session.metadata.previewArtifactRelativePath ?? "").trim();
    if (!relativePath) {
      throw new Error("Preview artifact path missing.");
    }
    const filePath = path.join(this.store.renderDir(session.id), relativePath);
    await stat(filePath);
    return {
      filePath,
      contentType:
        typeof previewArtifactContentType === "string" && previewArtifactContentType.trim()
          ? previewArtifactContentType
          : "application/octet-stream"
    };
  }

  public async getRenderStatus(sessionId: string): Promise<Record<string, unknown>> {
    const session = await this.loadSession(sessionId);
    return {
      id: session.id,
      status: session.renderStatus,
      progress: session.renderProgress,
      outputUrl: session.renderOutputUrl,
      outputPath: session.renderOutputPath,
      startedAt: session.renderStartedAt,
      completedAt: session.completedAt,
      errorCode: session.errorCode,
      errorMessage: session.errorMessage
    };
  }

  public async completeUpload(
    sessionId: string,
    payload: unknown
  ): Promise<EditSessionPublicState> {
    const input = editSessionUploadCompleteRequestSchema.parse(payload ?? {});
    const updated = await this.updateSession(sessionId, (current) => {
      const resolvedSourcePath = input.sourcePath ? path.resolve(input.sourcePath) : resolveLocalSourcePath(current);
      return {
        mediaUrl: input.mediaUrl ?? current.mediaUrl,
        storageKey: input.storageKey ?? current.storageKey,
        sourcePath: resolvedSourcePath,
        sourceFilename:
          input.sourceFilename ??
          current.sourceFilename ??
          (resolvedSourcePath ? path.basename(resolvedSourcePath) : null),
        sourceDurationMs: input.sourceDurationMs ?? current.sourceDurationMs,
        sourceAspectRatio: input.sourceAspectRatio ?? current.sourceAspectRatio,
        sourceWidth: input.sourceWidth ?? current.sourceWidth,
        sourceHeight: input.sourceHeight ?? current.sourceHeight,
        sourceFps: input.sourceFps ?? current.sourceFps,
        sourceHasVideo: input.sourceHasVideo ?? current.sourceHasVideo,
        metadata: {
          ...current.metadata,
          ...(input.metadata ?? {})
        },
        status: current.status
      };
    });

    const resolvedSourcePath = resolveLocalSourcePath(updated);
    if (
      resolvedSourcePath &&
      (
        updated.sourceDurationMs === null ||
        updated.sourceAspectRatio === null ||
        updated.sourceWidth === null ||
        updated.sourceHeight === null ||
        updated.sourceFps === null ||
        updated.sourceHasVideo === false
      )
    ) {
      const probe = this.deps.probeVideoMetadata ?? probeVideoMetadata;
      try {
        await this.updateLiveActivity(sessionId, "MEDIA_PROBE_RUNNING", "Probing uploaded media for deterministic duration.");
        const metadata = await probe(resolvedSourcePath);
        await this.updateSession(sessionId, (current) => ({
          sourceDurationMs: Math.round(metadata.duration_seconds * 1000),
          sourceAspectRatio: current.sourceAspectRatio ?? `${metadata.width}:${metadata.height}`,
          sourceWidth: metadata.width,
          sourceHeight: metadata.height,
          sourceFps: metadata.fps,
          sourceHasVideo: true,
          sourceFilename: current.sourceFilename ?? path.basename(resolvedSourcePath)
        }));
        await this.updateLiveActivity(
          sessionId,
          "MEDIA_PROBE_READY",
          `Duration ${Math.round(metadata.duration_seconds * 1000)}ms at ${metadata.fps.toFixed(2)}fps.`
        );
      } catch (error) {
        const rawReason = error instanceof Error ? error.message : String(error);
        const reason = updated.metadata.livePreviewLane === true
          ? "Live compositor requires a video file with a real video track. Audio-only sources are not allowed in this lane."
          : rawReason;
        await this.failSession(sessionId, {
          errorCode: "media_probe_failed",
          errorMessage: reason
        });
        throw new Error(reason);
      }
    }

    if (input.autoStartPreview ?? true) {
      void this.startPreview(sessionId).catch(() => undefined);
    }

    return this.getSession(sessionId);
  }

  public async getSourceMediaAsset(sessionId: string): Promise<EditSessionSourceMediaAsset> {
    const session = await this.loadSession(sessionId);
    const resolvedSourcePath = resolveLocalSourcePath(session);
    if (!resolvedSourcePath || !(await sourcePathExists(resolvedSourcePath))) {
      throw new Error("Source media not found.");
    }

    const details = await stat(resolvedSourcePath);
    if (!details.isFile()) {
      throw new Error("Source media not found.");
    }

    return {
      filePath: resolvedSourcePath,
      fileName: session.sourceFilename ?? path.basename(resolvedSourcePath),
      fileSizeBytes: details.size,
      contentType: inferMediaContentType(resolvedSourcePath),
      hasVideo: session.sourceHasVideo
    };
  }

  public async startRender(
    sessionId: string,
    payload: unknown = {}
  ): Promise<EditSessionPublicState> {
    const input = editSessionRenderStartRequestSchema.parse(payload ?? {});
    const current = await this.loadSession(sessionId);
    if (current.renderStartedAt || current.renderStatus === "render_complete") {
      return toPublicSession(current, this.renderConfig);
    }

    const resolvedSourcePath = resolveLocalSourcePath(current);
    if (!resolvedSourcePath || !(await sourcePathExists(resolvedSourcePath))) {
      const failed = await this.updateSession(sessionId, (session) => ({
        renderStatus: "failed",
        status: "failed",
        errorCode: session.errorCode ?? "render_source_missing",
        errorMessage: session.errorMessage ?? "Render could not start because the source media is unavailable."
      }), "failed");
      return toPublicSession(failed, this.renderConfig);
    }

    const now = nowIso(this.deps);
    await this.updateSession(sessionId, () => ({
      renderStartedAt: now,
      renderStatus: "render_pending",
      status: "render_pending",
      renderProgress: 0
    }), "render_started");

    this.renderQueue.enqueue(async () => {
      try {
        await this.updateSession(sessionId, () => ({
          renderStatus: "rendering",
          status: "rendering",
          renderProgress: 0
        }), "render_progress");

        await this.renderDriver.startRender({
          sourcePath: resolvedSourcePath,
          captionProfileId: current.captionProfileId,
          motionTier: current.motionTier,
          cleanRun: input.cleanRun ?? true,
          deliveryMode: input.deliveryMode ?? "master-render"
        });

        while (true) {
          const snapshot = await this.renderDriver.getStatus();
          const progress = Number.isFinite(snapshot.progress) ? snapshot.progress : RENDER_STAGE_PROGRESS[snapshot.stage] ?? 0;
          await this.updateSession(sessionId, (session) => ({
            renderStatus:
              snapshot.state === "completed"
                ? "render_complete"
                : snapshot.state === "failed"
                  ? "failed"
                  : "rendering",
            status:
              snapshot.state === "completed"
                ? "render_complete"
                : snapshot.state === "failed"
                  ? "failed"
                  : "rendering",
            renderProgress: progress,
            renderOutputUrl: snapshot.outputUrl ?? session.renderOutputUrl,
            renderOutputPath: snapshot.outputPath ?? session.renderOutputPath,
            errorMessage: snapshot.errorMessage ?? session.errorMessage,
            completedAt: snapshot.state === "completed" ? nowIso(this.deps) : session.completedAt
          }), snapshot.state === "completed" ? "render_complete" : "render_progress");

          if (snapshot.state === "completed" || snapshot.state === "failed") {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        await this.updateSession(sessionId, (session) => ({
          renderStatus: "failed",
          status: "failed",
          errorCode: session.errorCode ?? "render_failed",
          errorMessage: session.errorMessage ?? (error instanceof Error ? error.message : String(error))
        }), "failed");
      }
    });

    return this.getSession(sessionId);
  }

  public async failSession(
    sessionId: string,
    payload: {
      errorCode?: string;
      errorMessage: string;
    }
  ): Promise<EditSessionPublicState> {
    this.stopActivityHeartbeat(sessionId);
    const failed = await this.updateSession(sessionId, (current) => {
      const previewResolved = current.previewStatus === "preview_text_ready";
      const previewPlaceholder = editSessionPlaceholderSchema.parse(
        previewResolved
          ? {
              ...current.previewPlaceholder,
              active: false,
              reason: "waiting_for_audio",
              copy: current.previewText ?? current.previewPlaceholder.copy,
              line1: current.previewLines[0] ?? current.previewPlaceholder.line1,
              line2: current.previewLines[1] ?? current.previewPlaceholder.line2
            }
          : {
              ...current.previewPlaceholder,
              active: true,
              reason: current.previewText ? "transcript_delayed" : "transcript_failed",
              copy: current.previewText ?? PREVIEW_PLACEHOLDER_COPY,
              line1: current.previewLines[0] ?? PREVIEW_PLACEHOLDER_COPY,
              line2: current.previewLines[1] ?? PREVIEW_PLACEHOLDER_LINE_2
            }
      );

      return {
        status: "failed",
        previewStatus: previewResolved ? "preview_text_ready" : "preview_placeholder_ready",
        transcriptStatus:
          current.transcriptStatus === "full_transcript_ready"
            ? current.transcriptStatus
            : "failed",
        analysisStatus:
          current.analysisStatus === "analysis_ready"
            ? current.analysisStatus
            : "failed",
        motionGraphicsStatus:
          current.motionGraphicsStatus === "motion_graphics_ready"
            ? current.motionGraphicsStatus
            : "failed",
        renderStatus:
          current.renderStatus === "render_complete"
            ? current.renderStatus
            : "failed",
        previewPlaceholder,
        errorCode: current.errorCode ?? payload.errorCode ?? "session_failed",
        errorMessage: current.errorMessage ?? payload.errorMessage,
        completedAt: current.completedAt ?? nowIso(this.deps)
      };
    }, "failed");

    return toPublicSession(failed, this.renderConfig);
  }

  public subscribe(sessionId: string, listener: (event: EditSessionEvent) => void): () => void {
    const listeners = this.subscribers.get(sessionId) ?? new Set<(event: EditSessionEvent) => void>();
    listeners.add(listener);
    this.subscribers.set(sessionId, listeners);

    void this.loadSession(sessionId)
      .then((session) => {
        listener({
          type: "session_snapshot",
          at: nowIso(this.deps),
          session: toPublicSession(session, this.renderConfig)
        });
      })
      .catch(() => undefined);

    return () => {
      const current = this.subscribers.get(sessionId);
      if (!current) {
        return;
      }
      current.delete(listener);
      if (current.size === 0) {
        this.subscribers.delete(sessionId);
      }
    };
  }

  private async buildCreativeDecisionManifest(session: EditSessionState): Promise<PreparedCreativeDecisionManifest | null> {
    const sourceUrl = resolvePreviewManifestSourceUrl(session);
    const transcriptText = normalizeText(session.previewText ?? session.transcriptText ?? "");
    const fallbackPlaceholder = normalizeText(session.previewPlaceholder.copy || PREVIEW_PLACEHOLDER_COPY);
    const sceneText = transcriptText || fallbackPlaceholder || PREVIEW_PLACEHOLDER_COPY;
    if (!sourceUrl) {
      return null;
    }

    const words = session.transcriptWords.map((word) => ({
      text: word.text,
      startMs: word.start_ms,
      endMs: word.end_ms,
      confidence: word.confidence
    }));
    const sceneWidth = session.sourceWidth ?? 1920;
    const sceneHeight = session.sourceHeight ?? 1080;
    const isPortrait = sceneHeight > sceneWidth;
    const isSquare = sceneWidth === sceneHeight;
    const sceneAspectRatio = isSquare ? "1:1" : isPortrait ? "9:16" : "16:9";
    const safeArea = isPortrait
      ? {top: 112, right: 72, bottom: 144, left: 72}
      : {top: 72, right: 96, bottom: 84, left: 96};
    const maxWidthPercent = isPortrait ? 58 : isSquare ? 64 : 72;
    const metadata = session.metadata as Record<string, unknown>;
    const requestedStyle = readStringMetadata(metadata, [
      "user_intent.tone_target",
      "toneTarget",
      "style.requestedStyle"
    ]) ?? (session.motionTier.includes("premium") ? "cinematic-premium-clean" : session.motionTier);
    const pacingStyle = readStringMetadata(metadata, [
      "timing_pacing.pacing_style",
      "pacingStyle"
    ]);
    const speechRateEstimate = readNumberMetadata(metadata, [
      "timing_pacing.speech_rate_estimate",
      "speechRateEstimate"
    ]);
    const motionDialect = buildMotionDialectPlan({
      metadata: session.metadata as any,
      transcriptWords: session.transcriptWords
    });
    const fontVibeDescriptor = [
      requestedStyle,
      pacingStyle ?? "",
      String(readStringMetadata(metadata, ["user_intent.intent_summary", "intentSummary"]) ?? ""),
      String(readStringMetadata(metadata, ["user_intent.tone_target", "toneTarget"]) ?? "")
    ].filter(Boolean).join(" | ");
    const fontFallbackReasons: string[] = [];
    type ResolvedManifestFont = Pick<ResolvedVibeFont, "family" | "filePath" | "browserUrl" | "sources"> & {
      readabilityScore: number;
      expressivenessScore: number;
      roles: string[];
    };
    let primaryFont: ResolvedManifestFont = {
      family: "HyperframesPrimary",
      filePath: "",
      browserUrl: "",
      sources: [],
      readabilityScore: 0,
      expressivenessScore: 0,
      roles: []
    };
    let secondaryFont: typeof primaryFont | undefined = {
      family: "HyperframesSecondary",
      filePath: "",
      browserUrl: "",
      sources: [],
      readabilityScore: 0,
      expressivenessScore: 0,
      roles: []
    };
    let fontPairReason = "Could not resolve requested Zilliz-backed font pair during manifest bridge phase.";
    try {
      const resolvedFontPair = await this.zillizFontResolver.resolveFontsByVibe(
        fontVibeDescriptor || "premium editorial restraint",
        2
      );
      fontPairReason = resolvedFontPair.query;
      primaryFont = {
        family: resolvedFontPair.primary.family,
        filePath: resolvedFontPair.primary.filePath,
        browserUrl: resolvedFontPair.primary.browserUrl,
        sources: resolvedFontPair.primary.sources,
        readabilityScore: resolvedFontPair.primary.score,
        expressivenessScore: resolvedFontPair.primary.confidence,
        roles: [resolvedFontPair.primary.recommendedUsage]
      };
      secondaryFont = resolvedFontPair.secondary ? {
        family: resolvedFontPair.secondary.family,
        filePath: resolvedFontPair.secondary.filePath,
        browserUrl: resolvedFontPair.secondary.browserUrl,
        sources: resolvedFontPair.secondary.sources,
        readabilityScore: resolvedFontPair.secondary.score,
        expressivenessScore: resolvedFontPair.secondary.confidence,
        roles: [resolvedFontPair.secondary.recommendedUsage]
        } : undefined;
      fontFallbackReasons.push(...resolvedFontPair.fallbackReasons);
    } catch (error) {
      console.error("[ZILLIZ] Cluster unreachable — falling back to system fonts.", error);
      fontFallbackReasons.push(error instanceof Error ? error.message : String(error));
      const localFallback = resolveLocalFontPairByVibe(fontVibeDescriptor, 2);
      if (localFallback) {
        fontPairReason = localFallback.reason;
        primaryFont = {
          family: localFallback.primary.family,
          filePath: localFallback.primary.filePath,
          browserUrl: localFallback.primary.browserUrl,
          sources: [],
          readabilityScore: localFallback.primary.readabilityScore,
          expressivenessScore: localFallback.primary.expressivenessScore,
          roles: localFallback.primary.roles
        };
        secondaryFont = localFallback.secondary
          ? {
              family: localFallback.secondary.family,
              filePath: localFallback.secondary.filePath,
              browserUrl: localFallback.secondary.browserUrl,
              sources: [],
              readabilityScore: localFallback.secondary.readabilityScore,
              expressivenessScore: localFallback.secondary.expressivenessScore,
              roles: localFallback.secondary.roles
            }
          : undefined;
        fontFallbackReasons.push(...localFallback.fallbackReasons);
      }
    }
    const fallbackUsed = transcriptText.length === 0 || fontFallbackReasons.length > 0;
    const previewPrimaryFont = buildPreviewManifestFont(primaryFont);
    const previewSecondaryFont = buildPreviewManifestFont(secondaryFont);
    const previewManifestTypography = previewPrimaryFont
      ? {
          primaryFont: previewPrimaryFont,
          secondaryFont: previewSecondaryFont
        }
      : undefined;
    const previewCompositionFps = resolvePreviewCompositionFps(this.env);
    const sceneFps = session.sourceFps ?? previewCompositionFps;

    return {
      manifest: {
        manifestVersion: "1.0.0",
        jobId: session.id,
        sceneId: `${session.id}-scene-1`,
        source: {
          videoUrl: sourceUrl,
          transcriptSegment: {
            text: sceneText,
            startMs: 0,
            endMs: session.sourceDurationMs ?? 8000,
            words
          }
        },
        scene: {
          durationMs: session.sourceDurationMs ?? 8000,
          aspectRatio: sceneAspectRatio,
          width: sceneWidth,
          height: sceneHeight,
          fps: sceneFps
        },
        intent: {
          rhetoricalIntent: "premium_explain",
          emotionalTone: "cinematic",
          intensity: 0.62
        },
        typography: {
          mode: "svg_longform_typography_v1",
          primaryFont: {
            family: primaryFont.family,
            source: primaryFont.filePath ? "custom_ingested" : "fallback",
            fileUrl: primaryFont.filePath || undefined,
            role: "headline"
          },
          secondaryFont: secondaryFont ? {
            family: secondaryFont.family,
            source: secondaryFont.filePath ? "custom_ingested" : "fallback",
            fileUrl: secondaryFont.filePath || undefined,
            role: "support"
          } : undefined,
          fontPairing: {
            graphUsed: this.renderConfig.ENABLE_FONT_GRAPH,
            score: 0.9,
            reason: fontPairReason
          },
          coreWords: [],
          linePlan: {
            lines: session.previewLines.length > 0 ? session.previewLines : [sceneText],
            maxLines: 3,
            maxCharsPerLine: 28,
            allowWidows: false
          }
        },
        animation: {
          engine: "gsap",
          family: "svg_longform_typography_v1",
          retrievedFromMilvus: this.renderConfig.ENABLE_MILVUS_ANIMATION_RETRIEVAL,
          easing: "power3.out",
          staggerMs: 50,
          entryMs: 300,
          holdMs: 700,
          exitMs: 250,
          motionIntensity: 0.55,
          avoid: []
        },
        layout: {
          region: "center",
          safeArea,
          maxWidthPercent,
          alignment: "center",
          preventOverlap: true,
          zIndexPlan: [
            {layer: "video", zIndex: 1},
            {layer: "typography", zIndex: 20}
          ]
        },
        renderBudget: {
          previewResolution: "720p",
          previewFps: previewCompositionFps,
          finalResolution: "1080p",
          allowHeavyEffectsInPreview: false,
          finalOnlyEffects: []
        },
        motionDialect,
        style: {
          requestedStyle,
          motionTier: session.motionTier,
          captionProfileId: session.captionProfileId,
          pacingStyle: pacingStyle ?? undefined,
          speechRateEstimate
        },
        diagnostics: {
          manifestCreatedAt: nowIso(this.deps),
          milvusUsed: this.renderConfig.ENABLE_MILVUS_ANIMATION_RETRIEVAL,
          fontGraphUsed: this.renderConfig.ENABLE_FONT_GRAPH,
          customFontsUsed: Boolean(primaryFont.filePath),
          fallbackUsed,
          fallbackReasons: [
            ...(transcriptText.length === 0 ? ["Transcript not ready; using placeholder typography copy."] : []),
            ...fontFallbackReasons
          ],
          legacyOverlayUsed: this.renderConfig.ENABLE_LEGACY_OVERLAY,
          remotionUsed: false,
          hyperframesUsed: true,
          overlapCheckPassed: undefined,
          warnings: [
            ...(transcriptText.length === 0 ? ["Preview built from placeholder copy while transcript resolves."] : []),
            ...(fontFallbackReasons.length > 0 ? ["Preview typography requested unavailable families and used explicit ingested fallback files."] : [])
          ],
          degradedStages: fallbackUsed ? ["preview-manifest"] : [],
          visibleFailureCount: fallbackUsed ? 1 : 0,
          cognitiveConfidence: fallbackUsed ? 0.78 : 0.96,
          temporalConfidence: 0.9
        },
        authority: {
          authorityVersion: "prometheus-preview-authority/v1",
          solePreviewTruth: true,
          timingTruth: {
            durationMs: session.sourceDurationMs ?? 8000,
            startMs: 0,
            endMs: session.sourceDurationMs ?? 8000,
            fps: sceneFps
          },
          typographyTruth: {
            mode: "svg_longform_typography_v1",
            primaryFamily: primaryFont.family,
            fallbackAllowed: true
          },
          cameraTruth: {},
          transitionTruth: {},
          assetTruth: {
            requiredAssetIds: [],
            missingAssetIds: []
          },
          pacingTruth: {
            intensity: 0.62,
            rhythmContinuityScore: 0.9,
            pacingConfidenceScore: 0.9
          },
          diagnosticsTruth: {
            degradedStages: fallbackUsed ? ["preview-manifest"] : [],
            visibleFailureCount: fallbackUsed ? 1 : 0,
            fallbackVisible: fallbackUsed
          },
          confidenceTruth: {
            cognitiveConfidence: fallbackUsed ? 0.78 : 0.96,
            renderConfidence: 0.9,
            temporalConfidence: 0.9
          },
          temporalTruth: {
            source: "single-preview-scene",
            sequenceMemoryAvailable: false
          },
          stageTruth: {
            currentStage: "preview-manifest",
            allowedAdapters: ["hyperframes", "remotion"],
            frontendMayPlan: false
          }
        }
      },
      previewManifestTypography
    };
  }

  private async ensurePreviewArtifact(session: EditSessionState): Promise<string | null> {
    if (!this.renderConfig.ENABLE_SERVER_RENDERED_PREVIEW) {
      return null;
    }
    const preparedManifest = await this.buildCreativeDecisionManifest(session);
    if (!preparedManifest) {
      return null;
    }
    const {manifest, previewManifestTypography} = preparedManifest;

    const signature = JSON.stringify({
      previewText: session.previewText ?? "",
      previewLines: session.previewLines,
      transcriptWords: session.transcriptWords.length,
      sourceDurationMs: session.sourceDurationMs ?? null
    });
    const existingSignature = typeof session.metadata.previewArtifactSignature === "string"
      ? session.metadata.previewArtifactSignature
      : "";
    const existingUrl = typeof session.metadata.previewArtifactUrl === "string"
      ? session.metadata.previewArtifactUrl
      : "";
    if (existingSignature === signature && existingUrl) {
      return existingUrl;
    }

    const rendered = await this.previewRenderService.createPreviewArtifact({
      manifest,
      sessionRenderDir: this.store.renderDir(session.id),
      sourceMediaPath: resolveLocalSourcePath(session),
      enableGsapMotion: manifest.animation.engine === "gsap",
      enableKineticTypography: (manifest.source.transcriptSegment.words?.length ?? 0) > 0,
      preferHtmlComposition: manifest.animation.engine === "gsap" && this.renderConfig.ENABLE_MANIFEST_TYPOGRAPHY
    });

    const relativePath = path.relative(this.store.renderDir(session.id), rendered.localPath);
    await this.updateSession(session.id, (current) => ({
      metadata: {
        ...current.metadata,
        previewArtifactUrl: rendered.previewUrl,
        previewArtifactRelativePath: relativePath,
        previewArtifactSignature: signature,
        previewArtifactKind: rendered.artifactKind,
        previewArtifactContentType: rendered.contentType,
        previewArtifactWarnings: rendered.diagnostics.warnings,
        previewCompositionGenerationTimeMs: rendered.compositionGenerationTimeMs,
        previewRenderTimeMs: rendered.renderTimeMs,
        previewManifestTypography,
        previewFontProof: rendered.diagnostics.fontProof,
        previewAnimationProof: rendered.diagnostics.animationProof,
        previewFeatureDiagnostics: rendered.diagnostics.features,
        previewStyleAuthority: rendered.diagnostics.styleAuthority
      }
    }));
    return rendered.previewUrl;
  }

  private async runPreviewWorker(
    sessionId: string,
    previewSeconds: number,
    resolvedSourcePath: string | null
  ): Promise<void> {
    this.startActivityHeartbeat(sessionId, "Preview worker active.");
    const session = await this.loadSession(sessionId);
    if (!resolvedSourcePath || !(await sourcePathExists(resolvedSourcePath))) {
      this.stopActivityHeartbeat(sessionId);
      return;
    }

    let publishedPreviewText = session.previewText ?? null;
    let lastPromotedAt = 0;
    let streamSessionId: string | null = session.streamSessionId;
    const createdAt = nowIso(this.deps);
    const streamImpl = this.deps.streamPreviewAudio ?? streamAudioBufferWithAssemblyAI;

    try {
      const audioExtractor = this.deps.extractPreviewAudioBuffer ?? extractPreviewAudioBuffer;
      const audioBuffer = await audioExtractor({
        sourcePath: resolvedSourcePath,
        previewSeconds
      });
      await this.updateLiveActivity(sessionId, "PREVIEW_AUDIO_EXTRACTED", `Buffered ${previewSeconds}s preview audio.`);

      await streamImpl({
        audioBuffer,
        apiKey: this.env.ASSEMBLYAI_API_KEY,
        fetchImpl: this.deps.fetchImpl,
        sampleRate: PREVIEW_AUDIO_SAMPLE_RATE,
        speechModel: "u3-rt-pro",
        chunkMs: PREVIEW_AUDIO_CHUNK_MS,
        chunkDelayMs: 0,
        formatTurns: true,
        inactivityTimeoutSeconds: 20,
        endOfTurnConfidenceThreshold: 0.35,
        callbacks: {
          onBegin: ({sessionId: incomingSessionId}) => {
            void this.updateLiveActivity(
              sessionId,
              "ASSEMBLYAI_STREAM_CONNECTED",
              `Streaming session ${incomingSessionId} connected.`
            );
            streamSessionId = incomingSessionId;
            void this.updateSession(sessionId, () => ({
              streamSessionId: incomingSessionId
            }));
          },
          onTurn: async (turn) => {
            await this.updateLiveActivity(
              sessionId,
              "ASSEMBLYAI_STREAM_TURN",
              `Turn ${turn.turnOrder ?? 0}${turn.endOfTurn ? " completed" : " partial"}`
            );
            const candidate = normalizeText(turn.utterance || turn.transcript);
            if (!candidate) {
              return;
            }

            const now = Date.now();
            const shouldPromote =
              !publishedPreviewText ||
              turn.endOfTurn ||
              candidate.length >= publishedPreviewText.length + 12 ||
              now - lastPromotedAt >= PREVIEW_PROMOTION_DEBOUNCE_MS;

            if (!shouldPromote) {
              return;
            }

            publishedPreviewText = candidate;
            lastPromotedAt = now;
            const previewPlan = await buildMotionSequenceFromEngines({
              sessionId,
              text: candidate,
              source: turn.endOfTurn ? "final_transcript" : "streaming_turn",
              createdAt,
              renderConfig: this.renderConfig
            });
            const lines = previewPlan.lines;
            const motionSequence = previewPlan.motionSequence;
            let shouldLogPreviewReady = false;

            void this.updateSession(sessionId, (current) => {
              shouldLogPreviewReady = current.previewStatus !== "preview_text_ready";
              return {
                previewStatus: "preview_text_ready",
                status: "preview_text_ready",
                previewText: lines.join("\n"),
                previewLines: lines,
                previewMotionSequence: motionSequence,
                previewPlaceholder: {
                  ...current.previewPlaceholder,
                  active: false,
                  reason: "waiting_for_audio",
                  copy: lines.join("\n"),
                  line1: lines[0] ?? current.previewPlaceholder.line1,
                  line2: lines[1] ?? null
                },
                lastPreviewUpdateAt: nowIso(this.deps),
                analysisStatus: "analysis_ready",
                motionGraphicsStatus: "motion_graphics_ready",
                analysisCompletedAt: nowIso(this.deps),
                motionGraphicsCompletedAt: nowIso(this.deps),
                analysisSummary: buildAnalysisSummary({
                  session: {
                    ...current,
                    previewStatus: "preview_text_ready",
                    previewText: lines.join("\n"),
                    previewLines: lines,
                    previewMotionSequence: motionSequence
                  },
                  source: "preview"
                }),
                motionGraphicsSummary: buildMotionGraphicsSummary({
                  session: {
                    ...current,
                    previewStatus: "preview_text_ready",
                    previewText: lines.join("\n"),
                    previewLines: lines,
                    previewMotionSequence: motionSequence
                  },
                  source: "preview"
                }),
                lastEventType: "preview_text_ready"
              };
            }, "preview_text_ready", {
              turnOrder: turn.turnOrder,
              endOfTurn: turn.endOfTurn
            }).then(() => {
              if (shouldLogPreviewReady) {
                this.logPreviewStage(sessionId, "preview_text_ready", {
                  source: turn.endOfTurn ? "final_transcript" : "streaming_turn"
                });
                this.queuePreviewArtifactRefresh(sessionId);
              }
            });
          },
          onTermination: ({audioDurationSeconds}) => {
            void this.updateLiveActivity(
              sessionId,
              "ASSEMBLYAI_STREAM_TERMINATED",
              `Preview audio duration ${audioDurationSeconds ?? 0}s received.`
            );
            void this.updateSession(sessionId, (current) => ({
              previewPlaceholder: {
                ...current.previewPlaceholder,
                active: current.previewStatus !== "preview_text_ready",
                reason: current.previewStatus === "preview_text_ready" ? "waiting_for_audio" : "transcript_delayed",
                copy: current.previewText ?? current.previewPlaceholder.copy,
                line1: current.previewLines[0] ?? current.previewPlaceholder.line1,
                line2: current.previewLines[1] ?? current.previewPlaceholder.line2
              },
              metadata: {
                ...current.metadata,
                previewAudioDurationSeconds: audioDurationSeconds ?? current.metadata.previewAudioDurationSeconds ?? null
              }
            }));
          },
          onError: (error) => {
            void this.updateLiveActivity(sessionId, "ASSEMBLYAI_STREAM_ERROR", error.message);
            void this.updateSession(sessionId, (current) => ({
              previewPlaceholder: {
                ...current.previewPlaceholder,
                active: true,
                reason: current.previewText ? "transcript_delayed" : "transcript_failed",
                copy: current.previewText ?? PREVIEW_PLACEHOLDER_COPY,
                line1: current.previewLines[0] ?? PREVIEW_PLACEHOLDER_COPY,
                line2: current.previewLines[1] ?? PREVIEW_PLACEHOLDER_LINE_2
              },
              errorCode: current.errorCode ?? "preview_stream_error",
              errorMessage: current.errorMessage ?? error.message
            }), "failed");
          }
        }
      });

      if (!publishedPreviewText) {
        await this.updateSession(sessionId, (current) => ({
          previewPlaceholder: {
            ...current.previewPlaceholder,
            active: true,
            reason: "transcript_delayed",
            copy: PREVIEW_PLACEHOLDER_COPY,
            line1: PREVIEW_PLACEHOLDER_COPY,
            line2: PREVIEW_PLACEHOLDER_LINE_2
          },
          previewStatus: "preview_placeholder_ready",
          status: "preview_placeholder_ready"
        }), "preview_placeholder_ready");
      }
    } catch (error) {
      this.stopActivityHeartbeat(sessionId);
      await this.updateSession(sessionId, (current) => ({
        previewPlaceholder: {
          ...current.previewPlaceholder,
          active: true,
          reason: current.previewText ? "transcript_delayed" : "transcript_failed",
          copy: current.previewText ?? PREVIEW_PLACEHOLDER_COPY,
          line1: current.previewLines[0] ?? PREVIEW_PLACEHOLDER_COPY,
          line2: current.previewLines[1] ?? PREVIEW_PLACEHOLDER_LINE_2
        },
        previewStatus: current.previewText ? "preview_text_ready" : "preview_placeholder_ready",
        status: current.previewText ? "preview_text_ready" : current.status,
        errorCode: current.errorCode ?? "preview_stream_failed",
        errorMessage: current.errorMessage ?? (error instanceof Error ? error.message : String(error)),
        streamSessionId: streamSessionId
      }), "failed");
      return;
    }
    this.stopActivityHeartbeat(sessionId);
  }

  private async runTranscriptWorker(sessionId: string, sourcePath: string): Promise<void> {
    if (!(await sourcePathExists(sourcePath))) {
      await this.updateSession(sessionId, (current) => ({
        transcriptStatus: "failed",
        errorCode: current.errorCode ?? "transcript_source_missing",
        errorMessage: current.errorMessage ?? "The transcript source file is missing."
      }), "failed");
      return;
    }

    const startedAt = nowIso(this.deps);
    this.startActivityHeartbeat(sessionId, "Transcript worker active.");
    await this.updateSession(sessionId, (current) => ({
      transcriptStartedAt: current.transcriptStartedAt ?? startedAt,
      transcriptStatus: "full_transcript_pending",
      transcriptProgress: Math.max(current.transcriptProgress, 1)
    }), "transcript_started");
    this.logPreviewStage(sessionId, "transcript_started");
    await this.updateLiveActivity(sessionId, "ASSEMBLYAI_UPLOAD_PENDING", "Uploading source media for transcript extraction.");

    const applyTranscriptResult = async (
      words: EditSessionState["transcriptWords"],
      source: "assemblyai" | "cache"
    ): Promise<void> => {
      const currentSessionCheck = await this.loadSession(sessionId);
      if (currentSessionCheck.status === "failed") {
        console.warn(`[edit-session] Session ${sessionId} already failed, ignoring delayed transcript result from ${source}.`);
        return;
      }

      const transcriptText = normalizeText(words.map((word) => word.text).join(" "));
      const previewPlan = await buildMotionSequenceFromEngines({
        sessionId,
        text: transcriptText,
        source: "final_transcript",
        createdAt: nowIso(this.deps),
        renderConfig: this.renderConfig
      });
      await this.updateSession(sessionId, (current) => {
        const previewLines =
          current.previewStatus === "preview_text_ready" && current.previewLines.length > 0
            ? current.previewLines
            : previewPlan.lines;
        const previewText = current.previewText ?? previewLines.join("\n");
        const previewMotionSequence =
          current.previewMotionSequence.length > 0
            ? current.previewMotionSequence
            : previewPlan.motionSequence;
        const sessionSnapshot = {
          ...current,
          previewText,
          previewLines,
          previewMotionSequence
        };

        return {
          transcriptStatus: "full_transcript_ready",
          transcriptProgress: 100,
          transcriptWords: words,
          transcriptText,
          transcriptCompletedAt: nowIso(this.deps),
          previewStatus: "preview_text_ready",
          previewText,
          previewLines,
          previewMotionSequence,
          previewPlaceholder: {
            ...current.previewPlaceholder,
            active: current.previewStatus !== "preview_text_ready",
            reason: "waiting_for_audio",
            copy: previewText,
            line1: previewLines[0] ?? current.previewPlaceholder.line1,
            line2: previewLines[1] ?? null
          },
          analysisStatus: "analysis_ready",
          motionGraphicsStatus: "motion_graphics_ready",
          analysisCompletedAt: nowIso(this.deps),
          motionGraphicsCompletedAt: nowIso(this.deps),
          analysisSummary: buildAnalysisSummary({
            session: sessionSnapshot,
            source: "transcript"
          }),
          motionGraphicsSummary: buildMotionGraphicsSummary({
            session: sessionSnapshot,
            source: "transcript"
          }),
          status: "full_transcript_ready"
        };
      }, "transcript_ready", {
        source
      });
      this.logPreviewStage(sessionId, "transcript_ready", {
        source,
        transcriptWords: words.length
      });
      this.queuePreviewArtifactRefresh(sessionId);
    };

    const session = await this.loadSession(sessionId);
    const fingerprint = await this.resolveTranscriptFingerprint(session, sourcePath);
    await this.updateSession(sessionId, (current) => ({
      metadata: {
        ...current.metadata,
        sourceFingerprint: fingerprint
      }
    }));

    const forceFreshTranscript = session.metadata.forceFreshTranscript === true;
    const cachedTranscript = forceFreshTranscript ? null : await this.readTranscriptCache(fingerprint);
    if (cachedTranscript && cachedTranscript.transcriptWords.length > 0) {
      this.logPreviewStage(sessionId, "transcript_cache_hit", {
        fingerprint,
        transcriptWords: cachedTranscript.transcriptWords.length
      });
      await applyTranscriptResult(cachedTranscript.transcriptWords, "cache");
      return;
    }

    const transcribeImpl = this.deps.transcribeMedia ?? transcribeWithAssemblyAI;
    try {
      const words = await transcribeImpl({
        filePath: sourcePath,
        apiKey: this.env.ASSEMBLYAI_API_KEY,
        fetchImpl: this.deps.fetchImpl,
        timeoutMs: this.env.PROVIDER_TIMEOUT_MS,
        onActivity: async (detail) => {
          await this.updateLiveActivity(sessionId, "ASSEMBLYAI_IO", detail);
        },
        onPoll: ({attempt, maxPollAttempts, status}) => {
          const progress = status === "completed" ? 100 : Math.min(95, Math.round((attempt / Math.max(1, maxPollAttempts)) * 100));
          void this.updateLiveActivity(sessionId, "ASSEMBLYAI_POLLING", `Attempt ${attempt}/${maxPollAttempts}`);
          void this.updateSession(sessionId, () => ({
            transcriptProgress: progress,
            transcriptStatus: status === "error" ? "failed" : "full_transcript_pending",
            lastTranscriptUpdateAt: nowIso(this.deps)
          }), "transcript_progress", {
            attempt,
            status
          });
        }
      });
      if (!forceFreshTranscript) {
        await this.writeTranscriptCache({
          fingerprint,
          transcriptWords: words,
          transcriptText: normalizeText(words.map((word) => word.text).join(" ")),
          cachedAt: nowIso(this.deps),
          sourceFilename: session.sourceFilename
        });
      }
      await applyTranscriptResult(words, "assemblyai");
      await this.updateLiveActivity(sessionId, "TRANSCRIPT_READY", `Transcript ready with ${words.length} words.`);
    } catch (error) {
      this.stopActivityHeartbeat(sessionId);
      await this.updateSession(sessionId, (current) => ({
        transcriptStatus: "failed",
        errorCode: current.errorCode ?? "transcript_failed",
        errorMessage: current.errorMessage ?? (error instanceof Error ? error.message : String(error)),
        previewPlaceholder: {
          ...current.previewPlaceholder,
          active: current.previewStatus !== "preview_text_ready",
          reason: current.previewText ? "transcript_delayed" : "transcript_failed",
          copy: current.previewText ?? PREVIEW_PLACEHOLDER_COPY,
          line1: current.previewLines[0] ?? PREVIEW_PLACEHOLDER_COPY,
          line2: current.previewLines[1] ?? PREVIEW_PLACEHOLDER_LINE_2
        }
      }), "failed");
      return;
    }
    this.stopActivityHeartbeat(sessionId);
  }

  private async emitDerivedReadiness(sessionId: string): Promise<void> {
    await this.updateSession(sessionId, (current) => ({
      analysisStatus: "analysis_ready",
      motionGraphicsStatus: "motion_graphics_ready",
      analysisSummary: buildAnalysisSummary({
        session: current,
        source: "placeholder"
      }),
      motionGraphicsSummary: buildMotionGraphicsSummary({
        session: current,
        source: "placeholder"
      })
    }), "analysis_ready");

    await this.updateSession(sessionId, (current) => ({
      analysisStatus: "analysis_ready",
      motionGraphicsStatus: "motion_graphics_ready"
    }), "motion_graphics_ready");
  }

  private async loadSession(sessionId: string): Promise<EditSessionState> {
    const cached = this.sessions.get(sessionId);
    if (cached) {
      this.touchSession(sessionId);
      return cached;
    }

    const session = await this.store.readSession(sessionId);
    this.sessions.set(sessionId, session);
    this.touchSession(sessionId);
    return session;
  }

  private async updateSession(
    sessionId: string,
    updater: (current: EditSessionState) => Partial<EditSessionState>,
    eventType?: EditSessionEvent["type"],
    detail?: Record<string, unknown>
  ): Promise<EditSessionState> {
    const previous = this.mutationChains.get(sessionId) ?? Promise.resolve(this.loadSession(sessionId));
    const next = previous
      .catch(() => this.loadSession(sessionId))
      .then(async () => {
        const activeCount = this.activeMutationCounts.get(sessionId) ?? 0;
        this.activeMutationCounts.set(sessionId, activeCount + 1);
        try {
          const current = await this.loadSession(sessionId);
          const now = nowIso(this.deps);
          const merged = editSessionStateSchema.parse({
            ...current,
            ...updater(current),
            updatedAt: now,
            lastEventType: eventType ?? current.lastEventType
          });
          this.sessions.set(sessionId, merged);
          this.touchSession(sessionId);

          if (eventType) {
            this.broadcast(sessionId, {
              type: eventType,
              at: now,
              session: toPublicSession(merged, this.renderConfig),
              detail
            });
          }

          await this.store.writeSession(merged);
          return merged;
        } finally {
          const remaining = Math.max(0, (this.activeMutationCounts.get(sessionId) ?? 1) - 1);
          if (remaining === 0) {
            this.activeMutationCounts.delete(sessionId);
          } else {
            this.activeMutationCounts.set(sessionId, remaining);
          }
        }
      });

    this.mutationChains.set(sessionId, next.catch(() => this.loadSession(sessionId)));
    return next;
  }

  private broadcast(sessionId: string, event: EditSessionEvent): void {
    const listeners = this.subscribers.get(sessionId);
    if (!listeners || listeners.size === 0) {
      return;
    }

    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        listeners.delete(listener);
      }
    }

    if (listeners.size === 0) {
      this.subscribers.delete(sessionId);
    }
  }
  public async startPreview(
    sessionId: string,
    payload: unknown = {}
  ): Promise<EditSessionPublicState> {
    const input = editSessionPreviewStartRequestSchema.parse(payload ?? {});
    const current = await this.loadSession(sessionId);
    const maybeVideoSource = inferMaybeVideoSource({
      sourcePath: current.sourcePath,
      sourceFilename: current.sourceFilename
    });
    if (current.sourceHasVideo !== true && !maybeVideoSource) {
      throw new Error("Live compositor requires a video file with a real video track. Audio-only sources are not allowed in this lane.");
    }
    if (current.previewStartedAt) {
      return toPublicSession(current, this.renderConfig);
    }

    const now = nowIso(this.deps);
    await this.updateSession(sessionId, (session) => ({
      previewStartedAt: now,
      startedAt: session.startedAt ?? now,
      status: "preview_pending",
      previewStatus: "preview_pending",
      previewPlaceholder: {
        ...session.previewPlaceholder,
        active: true,
        copy: PREVIEW_PLACEHOLDER_COPY,
        reason: "waiting_for_audio",
        line1: PREVIEW_PLACEHOLDER_COPY,
        line2: PREVIEW_PLACEHOLDER_LINE_2
      },
      transcriptStatus: session.sourcePath ? "full_transcript_pending" : session.transcriptStatus,
      analysisStatus: "analysis_pending",
      motionGraphicsStatus: "motion_graphics_pending",
      analysisStartedAt: now,
      motionGraphicsStartedAt: now
    }), "preview_initializing");

    await this.updateSession(sessionId, (session) => ({
      previewStatus: "preview_placeholder_ready",
      status: "preview_placeholder_ready",
      previewPlaceholder: {
        ...session.previewPlaceholder,
        active: true,
        copy: PREVIEW_PLACEHOLDER_COPY,
        reason: "waiting_for_audio",
        line1: PREVIEW_PLACEHOLDER_COPY,
        line2: PREVIEW_PLACEHOLDER_LINE_2
      },
      analysisStatus: "analysis_ready",
      motionGraphicsStatus: "motion_graphics_ready",
      analysisCompletedAt: nowIso(this.deps),
      motionGraphicsCompletedAt: nowIso(this.deps),
      analysisSummary: buildAnalysisSummary({
        session,
        source: "placeholder"
      }),
      motionGraphicsSummary: buildMotionGraphicsSummary({
        session,
        source: "placeholder"
      })
    }), "preview_placeholder_ready");
    this.logPreviewStage(sessionId, "preview_placeholder_ready");

    await this.updateSession(sessionId, (session) => ({
      analysisStatus: "analysis_ready",
      motionGraphicsStatus: "motion_graphics_ready"
    }), "analysis_ready");

    await this.updateSession(sessionId, (session) => ({
      analysisStatus: "analysis_ready",
      motionGraphicsStatus: "motion_graphics_ready"
    }), "motion_graphics_ready");

    const latest = await this.loadSession(sessionId);
    const resolvedSourcePath = resolveLocalSourcePath(latest);
    void this.runPreviewWorker(sessionId, input.previewSeconds ?? DEFAULT_PREVIEW_SECONDS, resolvedSourcePath).catch((error) => {
      void this.updateSession(sessionId, (session) => ({
        previewPlaceholder: {
          ...session.previewPlaceholder,
          active: true,
          reason: session.previewText ? "transcript_delayed" : "transcript_failed",
          copy: session.previewText ?? PREVIEW_PLACEHOLDER_COPY,
          line1: session.previewText ? session.previewLines[0] ?? session.previewText : PREVIEW_PLACEHOLDER_COPY,
          line2: session.previewText && session.previewLines.length > 1 ? session.previewLines[1] ?? null : PREVIEW_PLACEHOLDER_LINE_2
        },
        previewStatus: session.previewText ? "preview_text_ready" : "preview_placeholder_ready",
        status: session.previewText ? "preview_text_ready" : session.status,
        errorCode: session.errorCode ?? "preview_stream_failed",
        errorMessage: session.errorMessage ?? (error instanceof Error ? error.message : String(error))
      }), "failed");
    });

    if (latest.sourcePath) {
      void this.runTranscriptWorker(sessionId, latest.sourcePath).catch((error) => {
        void this.updateSession(sessionId, (session) => ({
          transcriptStatus: "failed",
          errorCode: session.errorCode ?? "transcript_failed",
          errorMessage: session.errorMessage ?? (error instanceof Error ? error.message : String(error)),
          previewPlaceholder: {
            ...session.previewPlaceholder,
            active: session.previewStatus !== "preview_text_ready",
            reason: session.previewStatus === "preview_text_ready" ? "waiting_for_audio" : "transcript_failed",
            copy: session.previewText ?? PREVIEW_PLACEHOLDER_COPY,
            line1: session.previewText?.split("\n")[0] ?? PREVIEW_PLACEHOLDER_COPY,
            line2: session.previewText && session.previewLines.length > 1 ? session.previewLines[1] ?? null : PREVIEW_PLACEHOLDER_LINE_2
          }
        }), "failed");
      });
    } else {
      void this.updateSession(sessionId, (session) => ({
        transcriptStatus: "failed",
        errorCode: session.errorCode ?? "missing_source_path",
        errorMessage: session.errorMessage ?? "No local source path is available for transcript streaming."
      }), "failed");
    }

    return this.getSession(sessionId);
  }
}
