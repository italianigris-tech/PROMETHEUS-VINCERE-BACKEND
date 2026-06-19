import type {CreativeDecisionManifest} from "../../contracts/creative-decision-manifest";
import type {RenderManifestBridge} from "../manifest-bridge";

export type CurrentCreativeDecisionManifest = CreativeDecisionManifest;
export type CurrentRenderManifest = RenderManifestBridge;

export type PrometheusSchemaAdapterIssueCode =
  | "missing_field"
  | "invalid_type"
  | "invalid_time_range"
  | "normalization_applied";

export type PrometheusSchemaAdapterIssueSeverity = "info" | "warning" | "error";

export type PrometheusSchemaAdapterIssue = {
  code: PrometheusSchemaAdapterIssueCode;
  severity: PrometheusSchemaAdapterIssueSeverity;
  path: string;
  message: string;
};

export type PrometheusSchemaAdapterDiagnostics = {
  issues: PrometheusSchemaAdapterIssue[];
};

export type Milliseconds = number;
export type Frames = number;
export type FramesPerSecond = number;

export type AdapterTranscriptWord = {
  text: string;
  startMs: Milliseconds;
  endMs: Milliseconds;
  confidence?: number;
  semanticTag?: string;
};

export type AdapterSceneTimebase = {
  durationMs: Milliseconds;
  fps: FramesPerSecond;
  durationInFrames: Frames;
};

export type AdapterSourceSnapshot = {
  manifestVersion: string;
  jobId: string;
  sceneId: string;
  transcript: string;
  timebase: AdapterSceneTimebase;
  words: AdapterTranscriptWord[];
  diagnostics: PrometheusSchemaAdapterDiagnostics;
};

export type SpecVersion = "1.0.0";

export type SpecSourceVideo = {
  url: string;
  transcript?: string;
  words?: AdapterTranscriptWord[];
};

export type SpecEditPlanSegment = {
  id: string;
  startMs: Milliseconds;
  endMs: Milliseconds;
  text: string;
};

export type SpecEditPlan = {
  segments: SpecEditPlanSegment[];
};

export type SpecPacingProfile = {
  rhetoricalIntent?: string;
  emotionalTone?: string;
  intensity?: number;
};

export type SpecCDM = {
  version: SpecVersion;
  sourceVideo: SpecSourceVideo;
  editPlan: SpecEditPlan;
  pacingProfile: SpecPacingProfile;
  diagnostics: PrometheusSchemaAdapterDiagnostics;
};

export type SpecSfxEvent = {
  id: string;
  cueId: string;
  startMs: Milliseconds;
  visualEventId?: string;
};

export type SpecAudioPlan = {
  musicTrackUrl?: string;
  musicTrackId?: string;
  sfxEvents: SpecSfxEvent[];
};

export type SpecPostProcessingPass = {
  type: "bloom" | "chromatic_aberration" | "motion_blur" | "grayscale" | "vignette" | string;
  enabled: boolean;
};

export type SpecPostProcessingPlan = {
  passes: SpecPostProcessingPass[];
};

export type SpecRenderManifest = {
  version: SpecVersion;
  jobId: string;
  frameRate: FramesPerSecond;
  durationInFrames: Frames;
  sourceVideo: Pick<SpecSourceVideo, "url">;
  transcript: string;
  transcriptWords: AdapterTranscriptWord[];
  audio: SpecAudioPlan;
  postProcessing: SpecPostProcessingPlan;
  diagnostics: PrometheusSchemaAdapterDiagnostics;
};