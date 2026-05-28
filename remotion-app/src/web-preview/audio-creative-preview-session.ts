import {buildCreativePreviewCaptionChunks} from "../creative-orchestration/preview";
import type {CreativeOrchestrationDebugReport, CreativeTimeline} from "../creative-orchestration/types";
import type {CreativeRenderMode} from "../creative-orchestration/render/creative-timeline-to-remotion";
import {deterministicChunkWords, mapWordChunksToCaptionChunks} from "../lib/caption-chunker";
import {buildMotionCompositionModel, type MotionCompositionModel} from "../lib/motion-platform/scene-engine";
import {getDefaultVideoMetadataForPresentationMode} from "../lib/presentation-presets";
import {normalizeCaptionStyleProfileId} from "../lib/stylebooks/caption-style-profiles";
import type {
  CaptionChunk,
  CaptionStyleProfileId,
  MotionTier,
  PresentationMode,
  PresentationModeSetting,
  TranscribedWord,
  VideoMetadata
} from "../lib/types";

export type AudioCreativePreviewState = "idle" | "building-timeline" | "ready" | "playing" | "error";
export type AudioCreativePreviewAudioStatus = "missing" | "loading" | "ready" | "error";

export type AudioCreativePreviewSession = {
  captionChunks: CaptionChunk[];
  creativeTimeline: CreativeTimeline;
  debugReport: CreativeOrchestrationDebugReport;
  motionModel: MotionCompositionModel;
  videoMetadata: VideoMetadata;
  durationMs: number;
  renderMode: CreativeRenderMode;
};

export type BackendPreviewPlan = {
  previewText?: string | null;
  previewLines?: string[];
  previewMotionSequence?: LivePreviewMotionCue[];
  transcriptWords?: LivePreviewBackendWord[];
  motionModel?: MotionCompositionModel | null;
};

type ProjectionSessionInput = {
  jobId: string;
  captionProfileId: CaptionStyleProfileId;
  motionTier: MotionTier | "auto";
  presentationMode?: PresentationModeSetting | null;
  baseVideoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> | null;
  transcriptWords?: LivePreviewBackendWord[];
  previewLines?: string[];
  previewMotionSequence?: LivePreviewMotionCue[];
  allowFallbackDemoData?: boolean;
  backendPreviewPlan?: BackendPreviewPlan | null;
};

const DEFAULT_AUDIO_PREVIEW_FALLBACK_LINES = [
  "Build the message first",
  "Then scale the motion"
];

const createEmptyCreativeTimeline = ({
  jobId,
  durationMs
}: {
  jobId: string;
  durationMs: number;
}): CreativeTimeline => ({
  id: `${jobId}-lite-preview-timeline`,
  sourceJobId: jobId,
  durationMs,
  moments: [],
  decisions: [],
  tracks: [],
  diagnostics: {
    proposalCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    renderCost: "low",
    mattingWindows: [],
    warnings: ["Preview Governor selected the lite preview path."]
  }
});

const createLiteDebugReport = ({
  jobId,
  timeline
}: {
  jobId: string;
  timeline: CreativeTimeline;
}): CreativeOrchestrationDebugReport => ({
  jobId,
  moments: [],
  allProposals: [],
  directorDecisions: [],
  editDecisionPlans: [],
  judgmentAuditTrail: [],
  feedbackSignals: [],
  criticReview: {status: "approved", score: 100, issues: []},
  finalCreativeTimeline: timeline
});

export type LivePreviewBackendWord = {
  text: string;
  start_ms: number;
  end_ms: number;
  confidence?: number;
};

export type LivePreviewMotionCue = {
  cueId: string;
  text: string;
  startMs: number;
  durationMs: number;
  lineIndex: number;
};

type ResolveAudioCreativePreviewDurationInput = {
  providedDurationMs?: number | null;
  creativeTimelineDurationMs?: number | null;
  lastTrackEndMs?: number | null;
  lastCaptionEndMs?: number | null;
  fallbackDurationMs?: number | null;
};

export const isLiveAudioPreviewLane = (deliveryMode: "speed-draft" | "master-render"): boolean => {
  return deliveryMode === "speed-draft";
};

export const resolveAudioCreativePreviewDurationMs = (input: ResolveAudioCreativePreviewDurationInput): number => {
  const allDurationInputsUndefined = Object.values(input).every((value) => typeof value === "undefined");
  let sawZeroDurationProbe = false;

  const normalizeDurationCandidate = (value?: number | null): number | null => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return null;
    }

    const rounded = Math.round(value);
    if (rounded === 0) {
      sawZeroDurationProbe = true;
      return null;
    }

    return rounded;
  };

  const candidate =
    normalizeDurationCandidate(input.providedDurationMs) ??
    normalizeDurationCandidate(input.creativeTimelineDurationMs) ??
    normalizeDurationCandidate(input.lastTrackEndMs) ??
    normalizeDurationCandidate(input.lastCaptionEndMs) ??
    normalizeDurationCandidate(input.fallbackDurationMs);
  if (candidate !== null) {
    return candidate;
  }

  if (sawZeroDurationProbe) {
    return 60000;
  }

  if (allDurationInputsUndefined) {
    return 30000;
  }

  return 60000;
};

export const resolveAudioCreativePreviewVideoMetadata = (input: {
  presentationMode?: PresentationModeSetting | null;
  durationMs?: number | null;
  baseVideoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> | null;
}): VideoMetadata => {
  const resolvedPresentationMode: PresentationMode =
    input.presentationMode && input.presentationMode !== "auto" ? input.presentationMode : "long-form";
  const baseVideoMetadata =
    input.baseVideoMetadata ?? getDefaultVideoMetadataForPresentationMode(resolvedPresentationMode);
  const durationMs = resolveAudioCreativePreviewDurationMs({
    providedDurationMs: input.durationMs ?? (baseVideoMetadata.durationSeconds ? baseVideoMetadata.durationSeconds * 1000 : null)
  });
  const durationSeconds = durationMs / 1000;
  const fps = baseVideoMetadata.fps;

  if (!fps || fps < 1) {
    throw new Error("Invalid FPS configuration");
  }

  return {
    ...baseVideoMetadata,
    durationSeconds,
    durationInFrames: Math.round((durationMs / 1000) * fps)
  };
};

export const resolveCreativePreviewRenderMode = (input: {
  baseVideoMetadata?: Pick<VideoMetadata, "width" | "height"> | null;
}): CreativeRenderMode => {
  const width = input.baseVideoMetadata?.width ?? 0;
  const height = input.baseVideoMetadata?.height ?? 0;
  return width > 0 && height > 0 ? "overlay-preview" : "audio-preview";
};

export const resolveAudioCreativePreviewState = (input: {
  buildState: AudioCreativePreviewState;
  isPlayerPlaying: boolean;
}): AudioCreativePreviewState => {
  if (input.buildState === "error") {
    return "error";
  }

  if (input.buildState === "building-timeline") {
    return "building-timeline";
  }

  if (input.isPlayerPlaying) {
    return "playing";
  }

  if (input.buildState === "ready") {
    return "ready";
  }

  return "idle";
};

const normalizeBackendWords = (words: LivePreviewBackendWord[]): TranscribedWord[] => {
  return words
    .filter((word) => word.text.trim().length > 0)
    .map((word) => ({
      text: word.text.trim(),
      startMs: Math.max(0, Math.round(word.start_ms)),
      endMs: Math.max(Math.round(word.start_ms), Math.round(word.end_ms)),
      confidence: word.confidence
    }));
};

const buildSyntheticWordsFromText = ({
  text,
  startMs,
  endMs
}: {
  text: string;
  startMs: number;
  endMs: number;
}): TranscribedWord[] => {
  const tokens = text.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const durationMs = Math.max(320, endMs - startMs);
  const sliceMs = Math.max(90, Math.round(durationMs / tokens.length));

  return tokens.map((word, index) => {
    const wordStartMs = startMs + index * sliceMs;
    const wordEndMs = index === tokens.length - 1 ? endMs : Math.min(endMs, wordStartMs + sliceMs);
    return {
      text: word,
      startMs: wordStartMs,
      endMs: Math.max(wordStartMs + 40, wordEndMs)
    };
  });
};

const buildCaptionChunksFromLiveSource = ({
  captionProfileId,
  presentationMode,
  transcriptWords,
  previewLines,
  previewMotionSequence,
  allowFallbackDemoData
}: {
  captionProfileId: CaptionStyleProfileId;
  presentationMode?: PresentationModeSetting | null;
  transcriptWords?: LivePreviewBackendWord[];
  previewLines?: string[];
  previewMotionSequence?: LivePreviewMotionCue[];
  allowFallbackDemoData?: boolean;
}): CaptionChunk[] => {
  const normalizedProfileId = normalizeCaptionStyleProfileId(captionProfileId);
  const liveWords = normalizeBackendWords(transcriptWords ?? []);

  if (liveWords.length > 0) {
    const deterministicChunks = deterministicChunkWords(liveWords, {
      profileId: normalizedProfileId
    });
    const mappedChunks = mapWordChunksToCaptionChunks(deterministicChunks, undefined, {
      profileId: normalizedProfileId
    });
    return buildCreativePreviewCaptionChunks(mappedChunks, {
      profileId: normalizedProfileId,
      presentationMode
    });
  }

  const motionChunks = (previewMotionSequence ?? [])
    .map((cue) => {
      const cueText = cue.text.trim();
      if (!cueText) {
        return null;
      }

      return {
        id: cue.cueId,
        text: cueText,
        startMs: Math.max(0, cue.startMs),
        endMs: Math.max(cue.startMs + 240, cue.startMs + cue.durationMs),
        words: buildSyntheticWordsFromText({
          text: cueText,
          startMs: Math.max(0, cue.startMs),
          endMs: Math.max(cue.startMs + 240, cue.startMs + cue.durationMs)
        })
      };
    })
    .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk));

  if (motionChunks.length > 0) {
    const deterministicChunks = deterministicChunkWords(
      motionChunks.flatMap((chunk) => chunk.words),
      {
        profileId: normalizedProfileId
      }
    );
    const mappedChunks = mapWordChunksToCaptionChunks(deterministicChunks, undefined, {
      profileId: normalizedProfileId
    });
    return buildCreativePreviewCaptionChunks(mappedChunks, {
      profileId: normalizedProfileId,
      presentationMode
    });
  }

  const requestedPreviewLines = (previewLines ?? []).map((line) => line.trim()).filter(Boolean);
  const effectivePreviewLines = requestedPreviewLines.length > 0
    ? requestedPreviewLines
    : allowFallbackDemoData === false
      ? []
      : DEFAULT_AUDIO_PREVIEW_FALLBACK_LINES;
  if (effectivePreviewLines.length > 0) {
    const previewWords = effectivePreviewLines.flatMap((line, index) => {
      const startMs = index * 900;
      return buildSyntheticWordsFromText({
        text: line,
        startMs,
        endMs: startMs + 760
      });
    });
    const deterministicChunks = deterministicChunkWords(previewWords, {
      profileId: normalizedProfileId
    });
    const mappedChunks = mapWordChunksToCaptionChunks(deterministicChunks, undefined, {
      profileId: normalizedProfileId
    });
    return buildCreativePreviewCaptionChunks(mappedChunks, {
      profileId: normalizedProfileId,
      presentationMode
    });
  }

  return [];
};

const hasBackendPreviewPlan = (plan?: BackendPreviewPlan | null): boolean => {
  if (!plan) {
    return false;
  }

  const hasMotionModel = Boolean(plan.motionModel);
  const hasTranscriptWords = (plan.transcriptWords?.length ?? 0) > 0;
  const hasPreviewLines = (plan.previewLines?.length ?? 0) > 0;
  const hasPreviewMotionSequence = (plan.previewMotionSequence?.length ?? 0) > 0;

  return hasMotionModel || hasTranscriptWords || hasPreviewLines || hasPreviewMotionSequence;
};

const buildAudioCreativePreviewSessionFromBackendPlan = async (input: {
  jobId: string;
  captionProfileId: CaptionStyleProfileId;
  motionTier: MotionTier | "auto";
  presentationMode?: PresentationModeSetting | null;
  baseVideoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> | null;
  allowFallbackDemoData?: boolean;
  backendPreviewPlan: BackendPreviewPlan;
}): Promise<AudioCreativePreviewSession> => {
  const captionChunks = buildCaptionChunksFromLiveSource({
    captionProfileId: input.captionProfileId,
    presentationMode: input.presentationMode,
    transcriptWords: input.backendPreviewPlan.transcriptWords,
    previewLines: input.backendPreviewPlan.previewLines,
    previewMotionSequence: input.backendPreviewPlan.previewMotionSequence,
    allowFallbackDemoData: input.allowFallbackDemoData
  });
  const resolvedRenderMode = resolveCreativePreviewRenderMode({
    baseVideoMetadata: input.baseVideoMetadata
  });
  const lastTrackEndMs = (input.backendPreviewPlan.previewMotionSequence ?? []).reduce(
    (max, cue) => Math.max(max, cue.startMs + cue.durationMs),
    0
  );
  const lastCaptionEndMs = captionChunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0);
  const durationMs = resolveAudioCreativePreviewDurationMs({
    lastTrackEndMs,
    lastCaptionEndMs,
    fallbackDurationMs: input.baseVideoMetadata?.durationSeconds
      ? input.baseVideoMetadata.durationSeconds * 1000
      : null
  });
  const videoMetadata = resolveAudioCreativePreviewVideoMetadata({
    presentationMode: input.presentationMode,
    durationMs,
    baseVideoMetadata: input.baseVideoMetadata
  });
  const creativeTimeline = createEmptyCreativeTimeline({
    jobId: input.jobId,
    durationMs
  });
  const motionModel = input.backendPreviewPlan.motionModel ?? buildMotionCompositionModel({
    chunks: captionChunks,
    tier: input.motionTier,
    fps: videoMetadata.fps,
    videoMetadata,
    captionProfileId: input.captionProfileId
  });

  return {
    captionChunks,
    creativeTimeline,
    debugReport: createLiteDebugReport({
      jobId: input.jobId,
      timeline: creativeTimeline
    }),
    motionModel,
    videoMetadata,
    durationMs,
    renderMode: resolvedRenderMode
  };
};

const buildProjectionOnlyPreviewSession = async (input: ProjectionSessionInput): Promise<AudioCreativePreviewSession> => {
  const captionChunks = buildCaptionChunksFromLiveSource({
    captionProfileId: input.captionProfileId,
    presentationMode: input.presentationMode,
    transcriptWords: input.backendPreviewPlan?.transcriptWords ?? input.transcriptWords,
    previewLines: input.backendPreviewPlan?.previewLines ?? input.previewLines,
    previewMotionSequence: input.backendPreviewPlan?.previewMotionSequence ?? input.previewMotionSequence,
    allowFallbackDemoData: input.allowFallbackDemoData
  });
  const resolvedRenderMode = resolveCreativePreviewRenderMode({
    baseVideoMetadata: input.baseVideoMetadata
  });
  const lastTrackEndMs = (input.backendPreviewPlan?.previewMotionSequence ?? input.previewMotionSequence ?? []).reduce(
    (max, cue) => Math.max(max, cue.startMs + cue.durationMs),
    0
  );
  const lastCaptionEndMs = captionChunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0);
  const durationMs = resolveAudioCreativePreviewDurationMs({
    lastTrackEndMs,
    lastCaptionEndMs,
    fallbackDurationMs: input.baseVideoMetadata?.durationSeconds
      ? input.baseVideoMetadata.durationSeconds * 1000
      : null
  });
  const videoMetadata = resolveAudioCreativePreviewVideoMetadata({
    presentationMode: input.presentationMode,
    durationMs,
    baseVideoMetadata: input.baseVideoMetadata
  });
  const creativeTimeline = createEmptyCreativeTimeline({
    jobId: input.jobId,
    durationMs
  });
  const motionModel = input.backendPreviewPlan?.motionModel ?? buildMotionCompositionModel({
    chunks: captionChunks,
    tier: input.motionTier,
    fps: videoMetadata.fps,
    videoMetadata,
    captionProfileId: input.captionProfileId
  });

  return {
    captionChunks,
    creativeTimeline,
    debugReport: createLiteDebugReport({
      jobId: input.jobId,
      timeline: creativeTimeline
    }),
    motionModel,
    videoMetadata,
    durationMs,
    renderMode: resolvedRenderMode
  };
};

export const buildAudioCreativePreviewSession = async (input: {
  jobId: string;
  captionProfileId: CaptionStyleProfileId;
  motionTier: MotionTier | "auto";
  presentationMode?: PresentationModeSetting | null;
  baseVideoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> | null;
  transcriptWords?: LivePreviewBackendWord[];
  previewLines?: string[];
  previewMotionSequence?: LivePreviewMotionCue[];
  allowFallbackDemoData?: boolean;
  backendPreviewPlan?: BackendPreviewPlan | null;
  featureFlags?: {
    creativeOrchestrationV1?: boolean;
  };
}): Promise<AudioCreativePreviewSession> => {
  if (hasBackendPreviewPlan(input.backendPreviewPlan)) {
    return buildAudioCreativePreviewSessionFromBackendPlan({
      jobId: input.jobId,
      captionProfileId: input.captionProfileId,
      motionTier: input.motionTier,
      presentationMode: input.presentationMode,
      baseVideoMetadata: input.baseVideoMetadata,
      allowFallbackDemoData: input.allowFallbackDemoData,
      backendPreviewPlan: input.backendPreviewPlan!
    });
  }

  return buildProjectionOnlyPreviewSession(input);
};

export const buildFastAudioCreativePreviewSession = async (input: {
  jobId: string;
  captionProfileId: CaptionStyleProfileId;
  motionTier: MotionTier | "auto";
  presentationMode?: PresentationModeSetting | null;
  baseVideoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> | null;
  transcriptWords?: LivePreviewBackendWord[];
  previewLines?: string[];
  previewMotionSequence?: LivePreviewMotionCue[];
  allowFallbackDemoData?: boolean;
}): Promise<AudioCreativePreviewSession> => {
  const captionChunks = buildCaptionChunksFromLiveSource({
    captionProfileId: input.captionProfileId,
    presentationMode: input.presentationMode,
    transcriptWords: input.transcriptWords,
    previewLines: input.previewLines,
    previewMotionSequence: input.previewMotionSequence,
    allowFallbackDemoData: input.allowFallbackDemoData
  });
  const resolvedRenderMode = resolveCreativePreviewRenderMode({
    baseVideoMetadata: input.baseVideoMetadata
  });
  const lastCaptionEndMs = captionChunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0);
  const durationMs = resolveAudioCreativePreviewDurationMs({
    lastCaptionEndMs,
    fallbackDurationMs: input.baseVideoMetadata?.durationSeconds
      ? input.baseVideoMetadata.durationSeconds * 1000
      : null
  });
  const videoMetadata = resolveAudioCreativePreviewVideoMetadata({
    presentationMode: input.presentationMode,
    durationMs,
    baseVideoMetadata: input.baseVideoMetadata
  });
  const creativeTimeline = createEmptyCreativeTimeline({
    jobId: input.jobId,
    durationMs
  });
  const motionModel = buildMotionCompositionModel({
    chunks: captionChunks,
    tier: input.motionTier,
    fps: videoMetadata.fps,
    videoMetadata,
    captionProfileId: input.captionProfileId
  });

  return {
    captionChunks,
    creativeTimeline,
    debugReport: createLiteDebugReport({
      jobId: input.jobId,
      timeline: creativeTimeline
    }),
    motionModel,
    videoMetadata,
    durationMs,
    renderMode: resolvedRenderMode
  };
};
