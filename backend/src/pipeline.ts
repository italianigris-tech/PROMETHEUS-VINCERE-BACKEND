import path from "node:path";
import {access, mkdir, readFile, stat, writeFile} from "node:fs/promises";
import {constants as fsConstants} from "node:fs";

import {z} from "zod";

import type {BackendEnv} from "./config";
import {maybeCallGroqJson} from "./groq";
import {transcribeWithAssemblyAI} from "./integrations/assemblyai";
import {probeVideoMetadata, type VideoProbeResult} from "./integrations/ffprobe";
import {METADATA_CATALOG_BY_PATH} from "./metadata-catalog";
import {
  buildCentralEditPlannerPrompt,
  buildEnrichmentPlannerPrompt,
  buildExecutionPlannerPrompt,
  buildMetadataSynthesizerPrompt,
  PROMPT_TEMPLATE_VERSIONS
} from "./prompts";
import {FileJobRepository} from "./repository";
import {renderMasterTrack} from "./sound-engine";
import {readPatternMemorySnapshot, recordPatternMemoryOutcome} from "./pattern-memory";
import {
  type ClipCandidate,
  clipCandidateSchema,
  type ClipHeuristicSignals,
  type ClipScore,
  type ClipSelection,
  clipSelectionSchema,
  type EditPlan,
  editPlanSchema,
  type EnrichmentCandidate,
  enrichmentCandidateSchema,
  type ExecutionPlan,
  executionPlanSchema,
  type FallbackEvent,
  fallbackEventSchema,
  type JobRecord,
  jobRecordSchema,
  type ClipPortraitFocus,
  clipPortraitFocusSchema,
  type MetadataProfile,
  metadataProfileSchema,
  type NormalizedJobRequest,
  normalizedJobRequestSchema,
  type TargetPlatform,
  type TranscribedWord,
  type SelectedClip,
  selectedClipSchema
} from "./schemas";
import {buildMotionPlanArtifact} from "./motion-plan";
import {sha256File} from "./utils/hash";
import {getNestedValue, setNestedValue, flattenRecord} from "./utils/object-path";

type FetchLike = typeof fetch;

export type PipelineDependencies = {
  fetchImpl?: FetchLike;
  probeVideoMetadata?: (videoPath: string) => Promise<VideoProbeResult>;
  transcribeWithAssemblyAI?: typeof transcribeWithAssemblyAI;
  now?: () => string;
};

export type SourceAnalysis = {
  source_path: string | null;
  source_exists: boolean;
  source_filename: string | null;
  source_storage_uri: string | null;
  source_filesize_bytes: number | null;
  probe: VideoProbeResult | null;
  warnings: string[];
  fallback_events: FallbackEvent[];
  source_file_hash: string | null;
};

export type TranscriptResolution = {
  words: TranscribedWord[];
  source: "provided" | "cache" | "assemblyai" | "missing";
  warnings: string[];
  fallback_events: FallbackEvent[];
};

const PIPELINE_STEP_INDEX = {
  received: 0,
  analyzing: 1,
  metadata_ready: 2,
  plan_ready: 3,
  execution_ready: 4,
  audio_render: 5,
  ranking: 6,
  completed: 7,
  failed: 7
} as const;

const TOTAL_STEPS = 7;

const safeReadJson = async <T>(filePath: string): Promise<T | null> => {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const nowIso = (deps?: PipelineDependencies): string => {
  return deps?.now ? deps.now() : new Date().toISOString();
};

const toPromptExcerpt = (prompt: string): string => {
  return prompt.trim().slice(0, 180);
};

const createFallbackEvent = (
  stage: string,
  code: string,
  severity: "info" | "warning" | "error",
  message: string,
  details: Record<string, unknown>,
  deps?: PipelineDependencies
): FallbackEvent => {
  return fallbackEventSchema.parse({
    code,
    stage,
    severity,
    message,
    details,
    created_at: nowIso(deps)
  });
};

const createEmptyMetadataProfile = (): MetadataProfile => {
  return metadataProfileSchema.parse({
    job: {},
    source_media: {},
    derived_technical: {},
    user_intent: {},
    output: {},
    timing_pacing: {},
    transcript_language: {},
    entity_enrichment: {},
    uploaded_assets: {},
    typography: {},
    motion_graphics: {},
    layout_collision: {},
    audio: {},
    color_finish: {},
    transitions: {},
    execution_orchestration: {},
    fallback: {},
    search_sourcing: {},
    field_source_map: {},
    ambiguity_notes: [],
    recommended_defaults: [],
    warnings: [],
    transcript_words: [],
    enrichment_candidates: []
  });
};

const setMetadataField = (
  profile: MetadataProfile,
  keyPath: string,
  value: unknown,
  source: MetadataProfile["field_source_map"][string]
): void => {
  const [group, ...rest] = keyPath.split(".");
  if (!group || rest.length === 0) {
    return;
  }
  const groupRecord = profile[group as keyof MetadataProfile];
  if (!groupRecord || typeof groupRecord !== "object" || Array.isArray(groupRecord)) {
    return;
  }
  setNestedValue(groupRecord as Record<string, unknown>, rest.join("."), value);
  profile.field_source_map[keyPath] = source;
};

const getMetadataField = (profile: MetadataProfile, keyPath: string): unknown => {
  const [group, ...rest] = keyPath.split(".");
  if (!group || rest.length === 0) {
    return undefined;
  }
  const groupRecord = profile[group as keyof MetadataProfile];
  if (!groupRecord || typeof groupRecord !== "object" || Array.isArray(groupRecord)) {
    return undefined;
  }
  return getNestedValue(groupRecord as Record<string, unknown>, rest.join("."));
};

const applyFlattenedFields = (
  profile: MetadataProfile,
  flattened: Record<string, unknown>,
  source: MetadataProfile["field_source_map"][string],
  warnings: string[]
): void => {
  for (const [keyPath, value] of Object.entries(flattened)) {
    if (!METADATA_CATALOG_BY_PATH.has(keyPath)) {
      warnings.push(`Ignored unknown metadata override: ${keyPath}`);
      continue;
    }
    setMetadataField(profile, keyPath, value, source);
  }
};

const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const inferAspectRatio = (width: number | null, height: number | null): string | null => {
  if (!width || !height) {
    return null;
  }
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) < 0.08) {
    return "9:16";
  }
  if (Math.abs(ratio - 16 / 9) < 0.08) {
    return "16:9";
  }
  if (Math.abs(ratio - 1) < 0.08) {
    return "1:1";
  }
  return `${width}:${height}`;
};

const fileExists = async (filePath: string | undefined | null): Promise<boolean> => {
  if (!filePath) {
    return false;
  }
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const analyzeSourceMedia = async (
  request: NormalizedJobRequest,
  deps: PipelineDependencies,
  env: BackendEnv
): Promise<SourceAnalysis> => {
  const warnings: string[] = [];
  const fallbackEvents: FallbackEvent[] = [];
  const explicitSourcePath = request.input_source_video?.stored_path ?? request.source_media_ref ?? null;
  const sourceExists = await fileExists(explicitSourcePath);

  if (!explicitSourcePath || !sourceExists) {
    if (explicitSourcePath) {
      warnings.push(`Source media reference not found: ${explicitSourcePath}`);
      fallbackEvents.push(
        createFallbackEvent(
          "media_probe",
          "source_media_missing",
          "warning",
          "Source media reference could not be resolved; continuing with prompt and asset context.",
          {source_media_ref: explicitSourcePath},
          deps
        )
      );
    }

    return {
      source_path: explicitSourcePath,
      source_exists: false,
      source_filename: explicitSourcePath ? path.basename(explicitSourcePath) : null,
      source_storage_uri: explicitSourcePath,
      source_filesize_bytes: null,
      probe: null,
      warnings,
      fallback_events: fallbackEvents,
      source_file_hash: null
    };
  }

  const [stats, sourceFileHash] = await Promise.all([
    stat(explicitSourcePath),
    sha256File(explicitSourcePath)
  ]);

  let probe: VideoProbeResult | null = null;
  try {
    const probeImpl = deps.probeVideoMetadata ?? probeVideoMetadata;
    probe = await probeImpl(explicitSourcePath);
  } catch (error) {
    warnings.push(
      `Media probe fallback: ${error instanceof Error ? error.message : String(error)}`
    );
    fallbackEvents.push(
      createFallbackEvent(
        "media_probe",
        "media_probe_failed",
        "warning",
        "Media probing failed; backend will continue with file stats only.",
        {
          source_path: explicitSourcePath,
          reason: error instanceof Error ? error.message : String(error)
        },
        deps
      )
    );
  }

  return {
    source_path: explicitSourcePath,
    source_exists: true,
    source_filename: path.basename(explicitSourcePath),
    source_storage_uri: explicitSourcePath,
    source_filesize_bytes: stats.size,
    probe,
    warnings,
    fallback_events: fallbackEvents,
    source_file_hash: sourceFileHash
  };
};

const normalizeTranscriptWords = (words: TranscribedWord[]): TranscribedWord[] => {
  return words
    .map((word) => ({
      ...word,
      text: word.text.trim()
    }))
    .filter((word) => word.text.length > 0)
    .sort((a, b) => a.start_ms - b.start_ms);
};

const resolveTranscript = async ({
  request,
  analysis,
  repository,
  env,
  deps
}: {
  request: NormalizedJobRequest;
  analysis: SourceAnalysis;
  repository: FileJobRepository;
  env: BackendEnv;
  deps: PipelineDependencies;
}): Promise<TranscriptResolution> => {
  const warnings: string[] = [];
  const fallbackEvents: FallbackEvent[] = [];
  const fetchImpl = deps.fetchImpl ?? fetch;
  const transcribeImpl = deps.transcribeWithAssemblyAI ?? transcribeWithAssemblyAI;

  if (request.provided_transcript?.length) {
    return {
      words: normalizeTranscriptWords(request.provided_transcript),
      source: "provided",
      warnings,
      fallback_events: fallbackEvents
    };
  }

  if (analysis.source_exists && analysis.source_file_hash) {
    const cachePath = path.join(repository.transcriptCacheDir(), `${analysis.source_file_hash}.words.json`);
    const cachedWords = await safeReadJson<TranscribedWord[]>(cachePath);
    if (cachedWords?.length) {
      return {
        words: normalizeTranscriptWords(cachedWords),
        source: "cache",
        warnings,
        fallback_events: fallbackEvents
      };
    }

    if (env.ASSEMBLYAI_API_KEY.trim()) {
      try {
        const resolvedWords = await transcribeImpl({
          filePath: analysis.source_path!,
          apiKey: env.ASSEMBLYAI_API_KEY,
          fetchImpl
        });
        const normalized = normalizeTranscriptWords(resolvedWords);
        await mkdir(repository.transcriptCacheDir(), {recursive: true});
        await writeFile(cachePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
        return {
          words: normalized,
          source: "assemblyai",
          warnings,
          fallback_events: fallbackEvents
        };
      } catch (error) {
        warnings.push(
          `Transcript fallback: ${error instanceof Error ? error.message : String(error)}`
        );
        fallbackEvents.push(
          createFallbackEvent(
            "transcript_resolution",
            "assemblyai_transcription_failed",
            "warning",
            "AssemblyAI transcription failed; continuing without transcript.",
            {reason: error instanceof Error ? error.message : String(error)},
            deps
          )
        );
      }
    }
  }

  fallbackEvents.push(
    createFallbackEvent(
      "transcript_resolution",
      "transcript_missing",
      "info",
      "No transcript was available; enrichment confidence will be lowered.",
      {},
      deps
    )
  );

  return {
    words: [],
    source: "missing",
    warnings,
    fallback_events: fallbackEvents
  };
};

const detectTargetPlatform = (
  promptLower: string,
  explicitTarget?: TargetPlatform
): TargetPlatform => {
  if (explicitTarget) {
    return explicitTarget;
  }
  if (/(shorts|youtube shorts)/.test(promptLower)) {
    return "shorts";
  }
  if (/tiktok/.test(promptLower)) {
    return "tiktok";
  }
  if (/reels|instagram/.test(promptLower)) {
    return "reels";
  }
  if (/youtube/.test(promptLower)) {
    return "youtube";
  }
  return "generic";
};

const detectContentType = (promptLower: string): string => {
  if (/podcast/.test(promptLower)) {
    return "podcast";
  }
  if (/(educational|education|teach|explain|tutorial)/.test(promptLower)) {
    return "educational";
  }
  if (/(promo|promotion|ad|advert)/.test(promptLower)) {
    return "promo";
  }
  if (/documentary/.test(promptLower)) {
    return "documentary";
  }
  if (/(clip|short-form|short form)/.test(promptLower)) {
    return "social_clip";
  }
  if (/commentary/.test(promptLower)) {
    return "commentary";
  }
  return "talking_head";
};

const detectToneTarget = (promptLower: string): string => {
  if (/(long\s*form typography|longform typography|svg typography|eve typography|kinetic typography|word lock|longform_svg_typography_v1|svg_typography_v1|longform_eve_typography_v1)/.test(promptLower)) {
    return "aggressive-high-contrast";
  }
  if (/minimal/.test(promptLower)) {
    return "minimal-clean";
  }
  if (/bold/.test(promptLower)) {
    return "bold-premium";
  }
  if (/documentary/.test(promptLower)) {
    return "documentary-clean";
  }
  return "cinematic-premium-clean";
};

const detectPaceTarget = (promptLower: string, platform: string): "slow" | "medium" | "high" => {
  if (/(fast|snappy|tight|high pace|high-energy|high energy)/.test(promptLower)) {
    return "high";
  }
  if (/(slow|calm|lingering|documentary)/.test(promptLower)) {
    return "slow";
  }
  if (platform === "shorts" || platform === "tiktok" || platform === "reels") {
    return "high";
  }
  return "medium";
};

const detectEditingStyleKeywords = (promptLower: string): string[] => {
  const keywords = [
    "cinematic",
    "premium",
    "clean",
    "bold",
    "kinetic",
    "minimal",
    "modern",
    "restrained",
    "dramatic",
    "long form typography",
    "longform typography",
    "svg typography",
    "eve typography",
    "kinetic typography",
    "word lock"
  ];
  return keywords.filter((keyword) => promptLower.includes(keyword));
};

const inferIntentSummary = (prompt: string, contentType: string, platform: string): string => {
  if (prompt.trim()) {
    return prompt.trim().slice(0, 140);
  }
  return `Backend-generated ${contentType} edit plan for ${platform}.`;
};

const inferAssetTypes = (assetNames: string[]): string[] => {
  const detected = new Set<string>();
  assetNames.forEach((name) => {
    const lower = name.toLowerCase();
    if (/\.(png|jpg|jpeg|webp|gif)$/i.test(lower)) {
      detected.add("image");
    } else if (/\.(mp4|mov|m4v|webm)$/i.test(lower)) {
      detected.add("video");
    } else if (/\.(mp3|wav|aac|m4a)$/i.test(lower)) {
      detected.add("audio");
    } else {
      detected.add("other");
    }
    if (/\.png$/i.test(lower)) {
      detected.add("transparent_png");
    }
  });
  return Array.from(detected);
};

const averageTranscriptConfidence = (words: TranscribedWord[]): number => {
  const confidences = words
    .map((word) => word.confidence)
    .filter((value): value is number => typeof value === "number");
  if (confidences.length === 0) {
    return words.length > 0 ? 0.82 : 0;
  }
  return round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length);
};

export const synthesizeMetadataProfile = ({
  request,
  analysis,
  transcript,
  deps
}: {
  request: NormalizedJobRequest;
  analysis: SourceAnalysis;
  transcript: TranscriptResolution;
  deps: PipelineDependencies;
}): {profile: MetadataProfile; warnings: string[]; fallback_events: FallbackEvent[]} => {
  const profile = createEmptyMetadataProfile();
  const warnings = [...analysis.warnings, ...transcript.warnings];
  const fallbackEvents = [...analysis.fallback_events, ...transcript.fallback_events];
  const promptLower = request.prompt.toLowerCase();
  const targetPlatform = detectTargetPlatform(promptLower, request.target_platform);
  const contentType = detectContentType(promptLower);
  const toneTarget = detectToneTarget(promptLower);
  const paceTarget = detectPaceTarget(promptLower, targetPlatform);
  const editingStyleKeywords = detectEditingStyleKeywords(promptLower);
  const longformTypographyRequested =
    /(long\s*form typography|longform typography|svg typography|eve typography|kinetic typography|word lock|longform_svg_typography_v1|svg_typography_v1|longform_eve_typography_v1)/.test(promptLower) ||
    ["podcast", "educational", "talking_head", "documentary", "commentary"].includes(contentType);
  const captionStyleProfile = longformTypographyRequested ? "longform_eve_typography_v1" : "slcp";
  const transcriptConfidence = averageTranscriptConfidence(transcript.words);
  const durationMs = analysis.probe ? Math.round(analysis.probe.duration_seconds * 1000) : null;
  const aspectRatio = inferAspectRatio(analysis.probe?.width ?? null, analysis.probe?.height ?? null);
  const formatFamily =
    !analysis.probe || !analysis.probe.width || !analysis.probe.height
      ? "unknown"
      : analysis.probe.height > analysis.probe.width
        ? "vertical"
        : analysis.probe.width > analysis.probe.height
          ? "horizontal"
          : "square";
  const resolutionFamily =
    !analysis.probe
      ? "unknown"
      : Math.max(analysis.probe.width, analysis.probe.height) >= 3840
        ? "uhd"
        : Math.max(analysis.probe.width, analysis.probe.height) >= 1920
          ? "fhd"
          : Math.max(analysis.probe.width, analysis.probe.height) >= 1280
            ? "hd"
            : "sd";
  const durationBucket =
    durationMs === null
      ? "short"
      : durationMs < 30000
        ? "micro"
        : durationMs < 90000
          ? "short"
          : durationMs < 5 * 60 * 1000
            ? "medium"
            : "long";
  const sourceAssetNames = request.input_assets.map((asset) => asset.original_name);
  const assetTypes = inferAssetTypes(sourceAssetNames);
  const assetLabels = request.input_assets
    .map((asset) => asset.label)
    .filter((label): label is string => Boolean(label?.trim()));
  const speechRateEstimate =
    durationMs && durationMs > 0
      ? round((transcript.words.length / (durationMs / 1000 / 60)), 1)
      : 0;

  const defaults: Array<[string, unknown]> = [
    ["job.job_id", request.job_id],
    ["job.job_version", "1.0.0"],
    ["job.request_timestamp", nowIso(deps)],
    ["job.processing_mode", "full"],
    ["job.status", "received"],
    ["source_media.source_filename", analysis.source_filename],
    ["source_media.source_filesize_bytes", analysis.source_filesize_bytes],
    ["source_media.source_duration_ms", durationMs],
    ["source_media.source_width", analysis.probe?.width ?? null],
    ["source_media.source_height", analysis.probe?.height ?? null],
    ["source_media.source_aspect_ratio", aspectRatio],
    ["source_media.source_fps", analysis.probe?.fps ?? 30],
    ["source_media.source_has_audio", analysis.source_exists],
    ["source_media.source_storage_uri", analysis.source_storage_uri],
    ["derived_technical.format_family", formatFamily],
    ["derived_technical.resolution_family", resolutionFamily],
    ["derived_technical.duration_bucket", durationBucket],
    ["derived_technical.processing_weight_score", round(((durationMs ?? 30000) / 30000) + request.input_assets.length * 0.4, 2)],
    ["derived_technical.fast_path_eligible", (durationMs ?? 0) <= 120000 && request.input_assets.length <= 4],
    ["derived_technical.requires_caption_alignment", transcript.words.length > 0],
    ["derived_technical.requires_entity_scan", Boolean(request.prompt.trim() || transcript.words.length)],
    ["user_intent.raw_user_prompt", request.prompt],
    ["user_intent.intent_summary", inferIntentSummary(request.prompt, contentType, targetPlatform)],
    ["user_intent.content_type", contentType],
    ["user_intent.tone_target", toneTarget],
    ["user_intent.energy_target", paceTarget === "high" ? "high" : "medium"],
    ["user_intent.pace_target", paceTarget],
    ["user_intent.target_platform", targetPlatform],
    ["user_intent.creator_niche", request.creator_niche ?? null],
    ["user_intent.max_clip_count", request.max_clip_count ?? 4],
    ["user_intent.editing_style_keywords", editingStyleKeywords],
    ["user_intent.must_include_elements", []],
    ["user_intent.must_avoid_elements", []],
    ["output.output_formats_requested", ["mp4"]],
    ["output.output_primary_aspect_ratio", aspectRatio ?? (targetPlatform === "generic" ? "16:9" : "9:16")],
    ["output.output_resolution_target", analysis.probe ? `${analysis.probe.width}x${analysis.probe.height}` : "1080x1920"],
    ["output.output_fps_target", analysis.probe?.fps ?? 30],
    ["output.output_preview_required", true],
    ["output.output_final_required", true],
    ["output.output_burned_captions", true],
    ["timing_pacing.silence_removal_enabled", paceTarget === "high"],
    ["timing_pacing.silence_mode", paceTarget === "slow" ? "preserve" : "tighten"],
    ["timing_pacing.minimum_pause_ms", 120],
    ["timing_pacing.maximum_pause_after_tightening_ms", 350],
    ["timing_pacing.speech_rate_estimate", speechRateEstimate],
    ["timing_pacing.pacing_style", toneTarget === "aggressive-high-contrast" ? "sales-tight" : "premium-tight"],
    ["timing_pacing.cut_frequency_target", paceTarget === "high" ? "high" : "balanced"],
    ["transcript_language.transcript_available", transcript.words.length > 0],
    ["transcript_language.transcript_source", transcript.source],
    ["transcript_language.transcript_language", "en"],
    ["transcript_language.transcript_confidence", transcriptConfidence],
    ["transcript_language.word_timestamps_available", transcript.words.length > 0],
    ["transcript_language.speaker_diarization_available", false],
    ["transcript_language.keyword_candidates", []],
    ["transcript_language.named_entity_candidates", []],
    ["entity_enrichment.entity_scan_enabled", true],
    ["entity_enrichment.entity_detection_confidence_threshold", 0.72],
    ["entity_enrichment.entity_visual_relevance_threshold", 0.68],
    ["entity_enrichment.entity_fetch_priority_threshold", 0.7],
    ["entity_enrichment.entity_fetch_enabled", true],
    ["entity_enrichment.entity_types_allowed", ["person", "location", "organization", "event", "product"]],
    ["entity_enrichment.entity_to_fallback_mapping", {
      person: "animated_name_card",
      location: "place_name_map_pin_card",
      organization: "text_emphasis_or_logo_placeholder",
      event: "event_title_card",
      product: "product_typography_card",
      concept: "typography_only"
    }],
    ["entity_enrichment.external_visual_insertions_enabled", true],
    ["uploaded_assets.user_assets_present", request.input_assets.length > 0 || request.descriptor_assets.length > 0],
    ["uploaded_assets.user_asset_count", request.input_assets.length],
    ["uploaded_assets.user_asset_manifest", request.input_assets.map((asset) => ({
      asset_id: asset.asset_id,
      original_name: asset.original_name,
      label: asset.label ?? null,
      mime_type: asset.mime_type,
      stored_path: asset.stored_path
    }))],
    ["uploaded_assets.user_asset_types", assetTypes],
    ["uploaded_assets.user_asset_labels", assetLabels],
    ["uploaded_assets.user_asset_background_type", assetTypes.includes("transparent_png") ? "transparent" : "unknown"],
    ["uploaded_assets.user_asset_is_cutout_ready", assetTypes.includes("transparent_png")],
    ["uploaded_assets.user_asset_usage_notes", request.descriptor_assets.map((asset) => asset.usage).filter(Boolean)],
    ["typography.typography_enabled", true],
    ["typography.caption_mode", "selective"],
    ["typography.caption_style_profile", captionStyleProfile],
    ["typography.typography_default_preset", "cinematic-premium-pack"],
    ["typography.font_family_primary", "DM Sans"],
    ["typography.font_family_secondary", "DM Sans"],
    ["typography.keyword_emphasis_enabled", true],
    ["typography.kinetic_text_enabled", true],
    ["typography.fallback_text_card_style", "animated-name-card-premium"],
    ["motion_graphics.motion_graphics_enabled", true],
    ["motion_graphics.motion_graphics_intensity", "restrained"],
    ["motion_graphics.motion_graphics_style_family", "restrained-premium-accent"],
    ["motion_graphics.motion_asset_selection_mode", "preset"],
    ["motion_graphics.motion_safe_area_rules", "caption-safe-priority"],
    ["motion_graphics.motion_vs_caption_priority", "caption_first"],
    ["motion_graphics.accent_graphics_enabled", true],
    ["motion_graphics.motion_mode", paceTarget === "slow" ? "quiet" : paceTarget === "high" ? "aggressive" : "balanced"],
    ["motion_graphics.motion_asset_density_target", paceTarget === "high" ? 3.4 : paceTarget === "slow" ? 1.4 : 2.4],
    ["motion_graphics.motion_repetition_penalty", paceTarget === "high" ? 0.58 : paceTarget === "slow" ? 0.82 : 0.72],
    ["motion_graphics.motion_emphasis_threshold", paceTarget === "high" ? 0.66 : paceTarget === "slow" ? 0.82 : 0.74],
    ["motion_graphics.motion_clutter_threshold", paceTarget === "high" ? 0.36 : paceTarget === "slow" ? 0.16 : 0.24],
    ["motion_graphics.motion_min_spacing_between_heavy_assets_ms", paceTarget === "high" ? 8000 : paceTarget === "slow" ? 16000 : 12000],
    ["layout_collision.subject_safe_zones", {mode: "center_safe", padding_pct: 0.12}],
    ["layout_collision.caption_reserved_zones", {mode: "lower_third", y_pct: [0.72, 0.95]}],
    ["layout_collision.motion_reserved_zones", {mode: "peripheral_accents"}],
    ["layout_collision.overlay_collision_policy", "prioritize-captions-then-subject"],
    ["layout_collision.caption_priority_level", 100],
    ["layout_collision.reframe_enabled", false],
    ["layout_collision.visual_clutter_limit", "low"],
    ["layout_collision.subtitle_protection_margin_px", paceTarget === "high" ? 104 : paceTarget === "slow" ? 128 : 112],
    ["layout_collision.face_safe_margin_px", paceTarget === "high" ? 112 : paceTarget === "slow" ? 138 : 120],
    ["audio.audio_cleanup_enabled", analysis.source_exists],
    ["audio.noise_reduction_enabled", analysis.source_exists],
    ["audio.debreath_enabled", false],
    ["audio.loudness_normalization_enabled", analysis.source_exists],
    ["audio.target_lufs", -14],
    ["audio.music_enabled", false],
    ["audio.music_ducking_enabled", true],
    ["audio.sfx_enabled", false],
    ["color_finish.color_polish_enabled", true],
    ["color_finish.color_style_preset", "clean-cinematic-neutral"],
    ["color_finish.lut_enabled", false],
    ["color_finish.finish_intensity", "light"],
    ["transitions.transitions_enabled", true],
    ["transitions.transition_style_family", "clean-cut-premium"],
    ["transitions.transition_intensity", "low"],
    ["transitions.hard_cut_ratio", 0.85],
    ["execution_orchestration.plan_id", request.job_id],
    ["execution_orchestration.plan_version", "1.0.0"],
    ["execution_orchestration.execution_graph_version", "1.0.0"],
    ["execution_orchestration.operation_order", [
      "media_analysis",
      "transcript_alignment",
      "silence_tightening",
      "timeline_lock_v1",
      "typography_placement",
      "motion_graphics_placement",
      "external_visual_insertion",
      "audio_finish",
      "color_polish",
      "final_render_handoff"
    ]],
    ["execution_orchestration.current_stage", "metadata_ready"],
    ["execution_orchestration.stage_history", []],
    ["execution_orchestration.warnings", warnings],
    ["fallback.global_fallback_style", "cinematic-typography-fallback"],
    ["fallback.fallback_typography_preset", "animated-name-card-premium"],
    ["fallback.fallback_motion_asset_pack", "minimal-accent-pack"],
    ["fallback.fallback_on_fetch_failure", "typography-card"],
    ["fallback.fallback_on_bad_transcript", "lower-enrichment-confidence"],
    ["fallback.optional_steps_allowed_to_skip", ["external_visual_insertion", "sfx_enrichment"]],
    ["search_sourcing.keyword_extraction_enabled", true],
    ["search_sourcing.keyword_scoring_mode", "proportional-threshold"],
    ["search_sourcing.keyword_score_threshold", 0.65],
    ["search_sourcing.search_terms_generated", []],
    ["search_sourcing.search_term_to_time_map", {}],
    ["search_sourcing.asset_source_priority", ["uploaded_assets", "external_fetch", "typography_fallback"]]
  ];

  defaults.forEach(([pathKey, value]) => setMetadataField(profile, pathKey, value, "system_default"));

  if (transcript.words.length > 0) {
    const keywordCandidates = Array.from(
      new Set(
        transcript.words
          .map((word) => word.text.toLowerCase().replace(/[^a-z0-9']/g, ""))
          .filter((word) => word.length >= 5)
      )
    ).slice(0, 24);
    setMetadataField(profile, "transcript_language.keyword_candidates", keywordCandidates, "inferred_from_media");
  }

  if (analysis.probe) {
    setMetadataField(profile, "source_media.source_width", analysis.probe.width, "inferred_from_media");
    setMetadataField(profile, "source_media.source_height", analysis.probe.height, "inferred_from_media");
    setMetadataField(profile, "source_media.source_duration_ms", Math.round(analysis.probe.duration_seconds * 1000), "inferred_from_media");
    setMetadataField(profile, "source_media.source_aspect_ratio", aspectRatio, "inferred_from_media");
    setMetadataField(profile, "source_media.source_fps", analysis.probe.fps, "inferred_from_media");
  }

  if (request.input_assets.length > 0 || request.descriptor_assets.length > 0) {
    setMetadataField(profile, "uploaded_assets.user_assets_present", true, "inferred_from_asset");
    setMetadataField(profile, "uploaded_assets.user_asset_count", request.input_assets.length, "inferred_from_asset");
    setMetadataField(profile, "uploaded_assets.user_asset_types", assetTypes, "inferred_from_asset");
    setMetadataField(profile, "uploaded_assets.user_asset_labels", assetLabels, "inferred_from_asset");
    setMetadataField(
      profile,
      "uploaded_assets.user_asset_background_type",
      assetTypes.includes("transparent_png") ? "transparent" : "unknown",
      "inferred_from_asset"
    );
    setMetadataField(profile, "uploaded_assets.user_asset_is_cutout_ready", assetTypes.includes("transparent_png"), "inferred_from_asset");
  }

  if (request.prompt.trim()) {
    setMetadataField(profile, "user_intent.raw_user_prompt", request.prompt, "inferred_from_prompt");
    setMetadataField(profile, "user_intent.intent_summary", inferIntentSummary(request.prompt, contentType, targetPlatform), "inferred_from_prompt");
    setMetadataField(profile, "user_intent.content_type", contentType, "inferred_from_prompt");
    setMetadataField(profile, "user_intent.tone_target", toneTarget, "inferred_from_prompt");
    setMetadataField(profile, "user_intent.pace_target", paceTarget, "inferred_from_prompt");
    setMetadataField(profile, "user_intent.target_platform", targetPlatform, "inferred_from_prompt");
    setMetadataField(profile, "user_intent.editing_style_keywords", editingStyleKeywords, "inferred_from_prompt");
  }

  const flattenedOverrides = flattenRecord(request.metadata_overrides);
  applyFlattenedFields(profile, flattenedOverrides, "user_explicit", warnings);

  if (!longformTypographyRequested) {
    profile.recommended_defaults.push("Using cinematic premium defaults because no alternate style family was explicitly requested.");
  }
  profile.recommended_defaults.push("Caption-safe zones take priority over motion overlays.");
  profile.recommended_defaults.push("Missing source visuals fall back to typography cards instead of blocking the job.");

  if (transcriptConfidence > 0 && transcriptConfidence < 0.75) {
    warnings.push("Transcript confidence is low; enrichment thresholds were treated more conservatively.");
    fallbackEvents.push(
      createFallbackEvent(
        "metadata_synthesis",
        "low_transcript_confidence",
        "warning",
        "Transcript confidence is low; entity sourcing confidence has been reduced.",
        {transcript_confidence: transcriptConfidence},
        deps
      )
    );
  }

  profile.transcript_words = transcript.words;
  profile.warnings = warnings.slice();
  profile.execution_orchestration.warnings = warnings.slice();

  return {
    profile: metadataProfileSchema.parse(profile),
    warnings,
    fallback_events: fallbackEvents
  };
};

const TITLE_CASE_SEQUENCE = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;
const ABSTRACT_CONCEPTS = new Set([
  "freedom",
  "success",
  "mindset",
  "growth",
  "discipline",
  "purpose",
  "confidence",
  "trust",
  "motivation",
  "clarity"
]);
const TITLE_CASE_LEADING_STOPWORDS = new Set(["The", "This", "That", "When", "Why", "How"]);

const uniqueStrings = (values: string[]): string[] => {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
};

const buildCombinedText = (request: NormalizedJobRequest, transcriptWords: TranscribedWord[]): string => {
  const transcriptText = transcriptWords.map((word) => word.text).join(" ");
  const assetLabelText = request.input_assets
    .map((asset) => asset.label ?? "")
    .concat(request.descriptor_assets.map((asset) => asset.label ?? ""))
    .join(" ");
  return [request.prompt, transcriptText, assetLabelText].filter(Boolean).join(" ");
};

const detectEntityCandidates = (request: NormalizedJobRequest, transcriptWords: TranscribedWord[]): string[] => {
  const combinedText = buildCombinedText(request, transcriptWords);
  const titleCaseMatches = Array.from(combinedText.matchAll(TITLE_CASE_SEQUENCE))
    .map((match) => match[1])
    .map((candidate) => {
      const tokens = candidate.split(/\s+/);
      if (tokens.length > 1 && TITLE_CASE_LEADING_STOPWORDS.has(tokens[0])) {
        return tokens.slice(1).join(" ");
      }
      return candidate;
    });
  const abstractMatches = uniqueStrings(
    combinedText
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter((token) => ABSTRACT_CONCEPTS.has(token))
  );

  return uniqueStrings([...titleCaseMatches, ...abstractMatches]).slice(0, 24);
};

const classifyEntityType = (entityText: string, request: NormalizedJobRequest): EnrichmentCandidate["entity_type"] => {
  const lower = entityText.toLowerCase();
  if (ABSTRACT_CONCEPTS.has(lower)) {
    return "concept";
  }
  if (/\b(city|paris|london|africa|morocco|america|nigeria|california)\b/i.test(entityText)) {
    return "location";
  }
  if (/\b(inc|corp|google|apple|nike|openai)\b/i.test(entityText)) {
    return "organization";
  }
  if (/\b(iphone|product|camera|tesla model)\b/i.test(lower)) {
    return "product";
  }
  if (/\b(event|war|conference|summit)\b/i.test(lower)) {
    return "event";
  }
  if (/\s/.test(entityText) || request.prompt.includes(entityText)) {
    return "person";
  }
  return "organization";
};

const getEntityScores = (
  entityText: string,
  entityType: EnrichmentCandidate["entity_type"],
  transcriptConfidence: number
): Pick<EnrichmentCandidate, "confidence_score" | "visual_relevance_score" | "fetch_priority_score"> => {
  const confidenceBase: Record<EnrichmentCandidate["entity_type"], number> = {
    person: 0.92,
    location: 0.84,
    organization: 0.8,
    event: 0.78,
    product: 0.82,
    concept: 0.54
  };
  const relevanceBase: Record<EnrichmentCandidate["entity_type"], number> = {
    person: 0.92,
    location: 0.86,
    organization: 0.74,
    event: 0.8,
    product: 0.82,
    concept: 0.24
  };
  const transcriptModifier = transcriptConfidence > 0 && transcriptConfidence < 0.75 ? 0.9 : 1;
  const confidenceScore = round(confidenceBase[entityType] * transcriptModifier);
  const visualRelevanceScore = round(relevanceBase[entityType] * transcriptModifier);
  const fetchPriorityScore = round((confidenceScore * 0.45) + (visualRelevanceScore * 0.55));
  if (entityText.split(" ").length >= 2 && entityType === "person") {
    return {
      confidence_score: round(Math.min(0.98, confidenceScore + 0.03)),
      visual_relevance_score: visualRelevanceScore,
      fetch_priority_score: round(Math.min(0.98, fetchPriorityScore + 0.03))
    };
  }
  return {
    confidence_score: confidenceScore,
    visual_relevance_score: visualRelevanceScore,
    fetch_priority_score: fetchPriorityScore
  };
};

const countMentions = (entityText: string, haystack: string): number => {
  const escaped = entityText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = haystack.match(new RegExp(`\\b${escaped}\\b`, "gi"));
  return matches?.length ?? 1;
};

const resolveTimingWindow = (
  entityText: string,
  transcriptWords: TranscribedWord[]
): EnrichmentCandidate["timing_window"] => {
  if (transcriptWords.length === 0) {
    return null;
  }
  const entityTokens = entityText.toLowerCase().split(/\s+/).filter(Boolean);
  for (let index = 0; index < transcriptWords.length; index += 1) {
    const slice = transcriptWords
      .slice(index, index + entityTokens.length)
      .map((word) => word.text.toLowerCase().replace(/[^a-z0-9']/g, ""));
    if (slice.join(" ") === entityTokens.join(" ")) {
      return {
        start_ms: transcriptWords[index]?.start_ms ?? null,
        end_ms: transcriptWords[index + entityTokens.length - 1]?.end_ms ?? null
      };
    }
  }
  return null;
};

const fallbackStrategyForEntity = (entityType: EnrichmentCandidate["entity_type"]): string => {
  switch (entityType) {
    case "person":
      return "animated_name_card";
    case "location":
      return "place_name_map_pin_card";
    case "organization":
      return "text_emphasis_or_logo_placeholder";
    case "event":
      return "event_title_card";
    case "product":
      return "product_typography_card";
    case "concept":
      return "typography_only";
  }
};

export const buildEnrichmentCandidates = ({
  request,
  metadata
}: {
  request: NormalizedJobRequest;
  metadata: MetadataProfile;
}): EnrichmentCandidate[] => {
  const transcriptWords = metadata.transcript_words;
  const combinedText = buildCombinedText(request, transcriptWords).toLowerCase();
  const entityCandidates = detectEntityCandidates(request, transcriptWords);
  const assetLabels = request.input_assets
    .map((asset) => asset.label ?? "")
    .concat(request.descriptor_assets.map((asset) => asset.label ?? ""))
    .filter(Boolean)
    .map((label) => label.toLowerCase());
  const transcriptConfidence = Number(getMetadataField(metadata, "transcript_language.transcript_confidence") ?? 0);
  const confidenceThreshold = Number(
    getMetadataField(metadata, "entity_enrichment.entity_detection_confidence_threshold") ?? 0.72
  );
  const relevanceThreshold = Number(
    getMetadataField(metadata, "entity_enrichment.entity_visual_relevance_threshold") ?? 0.68
  );
  const priorityThreshold = Number(
    getMetadataField(metadata, "entity_enrichment.entity_fetch_priority_threshold") ?? 0.7
  );

  return entityCandidates.map((entityText) => {
    const entityType = classifyEntityType(entityText, request);
    const scores = getEntityScores(entityText, entityType, transcriptConfidence);
    const mentionCount = countMentions(entityText, combinedText);
    const thresholdPassed =
      scores.confidence_score >= confidenceThreshold &&
      scores.visual_relevance_score >= relevanceThreshold &&
      scores.fetch_priority_score >= priorityThreshold &&
      entityType !== "concept";
    const hasUploadedAsset = assetLabels.some((label) => label.includes(entityText.toLowerCase()));
    const recommendedAction: EnrichmentCandidate["recommended_action"] =
      entityType === "concept"
        ? "typography_only"
        : thresholdPassed
          ? "source_candidate"
          : scores.visual_relevance_score >= 0.4
            ? "internal_motion_asset"
            : "no_action";
    const sourceStrategy: EnrichmentCandidate["source_strategy"] =
      recommendedAction === "source_candidate"
        ? hasUploadedAsset
          ? "uploaded_asset"
          : "external_fetch"
        : recommendedAction === "typography_only" || recommendedAction === "internal_motion_asset"
          ? "typography_fallback"
          : "none";

    return {
      entity_text: entityText,
      entity_type: entityType,
      confidence_score: scores.confidence_score,
      visual_relevance_score: scores.visual_relevance_score,
      fetch_priority_score: scores.fetch_priority_score,
      mention_count: mentionCount,
      timing_window: resolveTimingWindow(entityText, transcriptWords),
      recommended_action: recommendedAction,
      source_strategy: sourceStrategy,
      fallback_strategy: fallbackStrategyForEntity(entityType),
      threshold_passed: thresholdPassed
    };
  });
};

type ClipWindowConfig = {
  label: string;
  min_duration_ms: number;
  target_duration_ms: number;
  max_duration_ms: number;
  step_ms: number;
};

type CandidateWindow = ClipWindowConfig & {
  start_index: number;
  end_index: number;
  start_ms: number;
  end_ms: number;
};

const CLIP_WINDOW_CONFIGS: ClipWindowConfig[] = [
  {
    label: "tight_hook",
    min_duration_ms: 10000,
    target_duration_ms: 16000,
    max_duration_ms: 20000,
    step_ms: 4000
  },
  {
    label: "balanced_core",
    min_duration_ms: 15000,
    target_duration_ms: 24000,
    max_duration_ms: 30000,
    step_ms: 6000
  },
  {
    label: "extended_payoff",
    min_duration_ms: 20000,
    target_duration_ms: 32000,
    max_duration_ms: 40000,
    step_ms: 8000
  }
];

const CLIP_SCORING_WEIGHTS = {
  hook: 0.22,
  clarity: 0.18,
  payoff: 0.18,
  emotion: 0.12,
  shareability: 0.12,
  curiosity: 0.08,
  clip_cleanliness: 0.06,
  platform_fit: 0.04
} as const;

const HOOK_PHRASES = [
  "here's the thing",
  "nobody talks about this",
  "the truth is",
  "this is why",
  "i was wrong",
  "what changed everything",
  "most people",
  "the biggest mistake",
  "what nobody tells you",
  "the reason",
  "you need to know",
  "this is the moment"
];

const PAYOFF_PHRASES = [
  "that's why",
  "which means",
  "the point is",
  "the lesson is",
  "the reason is",
  "so the move is",
  "so what changed",
  "here's how",
  "that's when"
];

const CURIOSITY_PHRASES = [
  "what happened next",
  "here's why",
  "the reason",
  "you won't believe",
  "wait until",
  "but then",
  "so here's",
  "and that's when"
];

const EMOTION_KEYWORDS = [
  "love",
  "hate",
  "angry",
  "furious",
  "scared",
  "terrified",
  "excited",
  "amazing",
  "insane",
  "wild",
  "crazy",
  "urgent",
  "embarrassed",
  "vulnerable",
  "shocked",
  "painful",
  "broken",
  "obsessed"
];

const CONTRAST_KEYWORDS = ["but", "however", "actually", "instead", "yet", "except", "until", "wrong"];
const EMPHASIS_KEYWORDS = [
  "never",
  "always",
  "biggest",
  "best",
  "worst",
  "truth",
  "mistake",
  "reason",
  "change",
  "important",
  "nobody",
  "everything",
  "wrong"
];

const DEPENDENT_OPENINGS = ["and", "but", "so", "because", "then", "also", "it", "they", "he", "she", "that", "this"];

const NICHE_KEYWORDS: Record<string, string[]> = {
  business: ["business", "revenue", "sales", "offer", "market", "client", "growth", "price"],
  creator: ["creator", "content", "views", "audience", "editing", "hook", "retention", "viral"],
  education: ["learn", "lesson", "teach", "explain", "why", "how", "framework", "mistake"],
  motivation: ["discipline", "mindset", "confidence", "purpose", "consistency", "focus"],
  storytelling: ["story", "moment", "remember", "when", "before", "after", "suddenly"]
};

const cleanTranscriptText = (value: string): string => {
  return value.replace(/\s+([,.!?;:])/g, "$1").replace(/\s+/g, " ").trim();
};

const sliceWordsToText = (words: TranscribedWord[]): string => {
  return cleanTranscriptText(words.map((word) => word.text).join(" "));
};

const sliceWordsInRange = (
  words: TranscribedWord[],
  startMs: number,
  endMs: number
): TranscribedWord[] => {
  return words.filter((word) => word.end_ms > startMs && word.start_ms < endMs);
};

const normalizeToken = (value: string): string => {
  return value.toLowerCase().replace(/[^a-z0-9']/g, "");
};

const tokenizeComparableText = (value: string): string[] => {
  return uniqueStrings(
    value
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4)
  );
};

const countPhraseHits = (text: string, phrases: readonly string[]): number => {
  return phrases.reduce((count, phrase) => count + (text.includes(phrase) ? 1 : 0), 0);
};

const countKeywordHits = (text: string, keywords: readonly string[]): number => {
  return keywords.reduce((count, keyword) => count + (new RegExp(`\\b${keyword}\\b`, "i").test(text) ? 1 : 0), 0);
};

const splitSentences = (text: string): string[] => {
  return cleanTranscriptText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
};

const hasTerminalPunctuation = (text: string): boolean => {
  return /[.!?]["']?$/.test(text.trim());
};

const startsWithDependentWord = (text: string): boolean => {
  const firstToken = normalizeToken(text.split(/\s+/)[0] ?? "");
  return DEPENDENT_OPENINGS.includes(firstToken);
};

const isQuoteableSentence = (sentence: string): boolean => {
  const normalized = sentence.trim();
  if (!normalized) {
    return false;
  }
  const wordCount = normalized.split(/\s+/).length;
  return wordCount >= 5 && wordCount <= 18 && /[.!?]$/.test(normalized);
};

const pickHookLine = (text: string): string => {
  const sentences = splitSentences(text);
  const preferred =
    sentences.find((sentence) => countPhraseHits(sentence.toLowerCase(), HOOK_PHRASES) > 0) ??
    sentences.find((sentence) => isQuoteableSentence(sentence)) ??
    sentences[0] ??
    cleanTranscriptText(text);
  const words = preferred.split(/\s+/);
  const compact = words.slice(0, 16).join(" ");
  return compact.length > 0 ? compact : "Strong clip moment";
};

const PERSON_REFERENCE_BLOCKLIST = new Set([
  "The",
  "This",
  "That",
  "These",
  "Those",
  "Here",
  "There",
  "What",
  "When",
  "Where",
  "Why",
  "How",
  "Most",
  "Nobody",
  "Everyone",
  "Anyone",
  "Anything",
  "Something",
  "Everything",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Reference",
  "Figure",
  "Person",
  "Named",
  "Speaker",
  "Cue",
  "Title",
  "Keyword"
]);

const normalizePersonReferencePhrase = (value: string): string => {
  return cleanTranscriptText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
};

const extractPersonReferencePhrase = (...values: Array<string | undefined>): string | null => {
  const text = cleanTranscriptText(values.filter(Boolean).join(" "));
  if (!text) {
    return null;
  }

  const matches = text.match(/\b([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*){1,3})\b/g) ?? [];
  for (const match of matches) {
    const normalizedTokens = match
      .split(/\s+/)
      .map((token) => token.replace(/[^A-Za-z0-9']/g, ""))
      .filter(Boolean);
    if (normalizedTokens.length < 2) {
      continue;
    }
    if (PERSON_REFERENCE_BLOCKLIST.has(normalizedTokens[0] ?? "")) {
      continue;
    }
    if (normalizedTokens.every((token) => PERSON_REFERENCE_BLOCKLIST.has(token))) {
      continue;
    }
    return normalizePersonReferencePhrase(match);
  }

  return null;
};

const derivePortraitFocus = ({
  candidate,
  hookLine
}: {
  candidate: ClipCandidate;
  hookLine: string;
}): ClipPortraitFocus => {
  const referenceLabel =
    extractPersonReferencePhrase(candidate.transcript_excerpt, candidate.leading_context, candidate.trailing_context, hookLine) ??
    "speaker head";
  const emphasisBoost = candidate.heuristic_signals.emphasis_words.length > 0 ? 0.05 : 0;
  const hookBoost = candidate.heuristic_signals.strong_hook_phrase || candidate.heuristic_signals.opening_question ? 0.04 : 0;
  const cleanupBoost = candidate.heuristic_signals.clean_start_boundary && candidate.heuristic_signals.clean_end_boundary ? 0.05 : 0;
  const confidence = Math.min(1, 0.58 + emphasisBoost + hookBoost + cleanupBoost);
  const focusY =
    candidate.heuristic_signals.emphasis_words.length > 0 || candidate.heuristic_signals.strong_hook_phrase
      ? 34
      : candidate.heuristic_signals.opening_question
        ? 35
        : 37;

  return clipPortraitFocusSchema.parse({
    mode: "speaker_head",
    aspect_ratio: "9:16",
    focus_x_pct: 50,
    focus_y_pct: focusY,
    confidence: round(confidence, 2),
    reference_label: referenceLabel,
    rationale:
      referenceLabel === "speaker head"
        ? "Speaker-head framing keeps the portrait crop centered without extra tracking dependencies."
        : `Named reference anchor keeps ${referenceLabel} centered in the portrait crop.`
  });
};

const getNicheAlignmentBonus = (text: string, creatorNiche?: string): number => {
  if (!creatorNiche) {
    return 0;
  }
  const nicheKey = creatorNiche.toLowerCase();
  const keywords = NICHE_KEYWORDS[nicheKey];
  if (!keywords?.length) {
    return 0;
  }
  return Math.min(0.8, countKeywordHits(text, keywords) * 0.2);
};

const buildCandidateWindows = (transcriptWords: TranscribedWord[]): CandidateWindow[] => {
  if (transcriptWords.length === 0) {
    return [];
  }

  const firstStart = transcriptWords[0].start_ms;
  const finalEnd = transcriptWords[transcriptWords.length - 1].end_ms;
  const windows: CandidateWindow[] = [];
  const seen = new Set<string>();

  for (const config of CLIP_WINDOW_CONFIGS) {
    for (
      let requestedStart = firstStart;
      requestedStart <= Math.max(firstStart, finalEnd - config.min_duration_ms);
      requestedStart += config.step_ms
    ) {
      const startIndex = transcriptWords.findIndex((word) => word.end_ms > requestedStart);
      if (startIndex === -1) {
        continue;
      }

      let endIndex = startIndex;
      while (
        endIndex < transcriptWords.length - 1 &&
        transcriptWords[endIndex].end_ms < requestedStart + config.target_duration_ms
      ) {
        endIndex += 1;
      }
      while (
        endIndex < transcriptWords.length - 1 &&
        transcriptWords[endIndex].end_ms - transcriptWords[startIndex].start_ms < config.min_duration_ms
      ) {
        endIndex += 1;
      }
      while (
        endIndex > startIndex &&
        transcriptWords[endIndex].end_ms - transcriptWords[startIndex].start_ms > config.max_duration_ms
      ) {
        endIndex -= 1;
      }

      const startMs = transcriptWords[startIndex].start_ms;
      const endMs = transcriptWords[endIndex].end_ms;
      const durationMs = endMs - startMs;
      if (durationMs < config.min_duration_ms || durationMs > config.max_duration_ms) {
        continue;
      }

      const key = `${startIndex}:${endIndex}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      windows.push({
        ...config,
        start_index: startIndex,
        end_index: endIndex,
        start_ms: startMs,
        end_ms: endMs
      });
    }
  }

  if (windows.length > 0) {
    return windows;
  }

  const durationMs = finalEnd - firstStart;
  if (durationMs < 6000) {
    return [];
  }

  return [
    {
      label: "fallback_full_context",
      min_duration_ms: 6000,
      target_duration_ms: durationMs,
      max_duration_ms: durationMs,
      step_ms: durationMs,
      start_index: 0,
      end_index: transcriptWords.length - 1,
      start_ms: firstStart,
      end_ms: finalEnd
    }
  ];
};

const clampClipScore = (value: number): number => {
  return round(Math.min(10, Math.max(0, value)), 2);
};

const buildRankingNotes = ({
  scores,
  openingQuestion,
  strongHookPhrase,
  contextDependencyPenalty,
  cleanStartBoundary,
  cleanEndBoundary,
  quoteableSentence,
  emotionalPhrase,
  matchedKeywords
}: {
  scores: ClipScore;
  openingQuestion: boolean;
  strongHookPhrase: boolean;
  contextDependencyPenalty: boolean;
  cleanStartBoundary: boolean;
  cleanEndBoundary: boolean;
  quoteableSentence: boolean;
  emotionalPhrase: boolean;
  matchedKeywords: string[];
}): string[] => {
  const notes: string[] = [];
  if (scores.hook >= 7.5) {
    notes.push("Strong opening tension lands quickly.");
  }
  if (scores.clarity >= 7.5 && !contextDependencyPenalty) {
    notes.push("The idea stands on its own without extra setup.");
  }
  if (scores.payoff >= 7.5) {
    notes.push("A concrete takeaway arrives fast enough for short-form viewing.");
  }
  if (quoteableSentence || scores.shareability >= 7.5) {
    notes.push("There is a quotable line that can anchor title and captions.");
  }
  if (emotionalPhrase || scores.emotion >= 7) {
    notes.push("Emotional language gives the clip stronger replay energy.");
  }
  if (openingQuestion) {
    notes.push("The opening question creates immediate curiosity.");
  }
  if (strongHookPhrase && matchedKeywords.length > 0) {
    notes.push(`Matched hook phrases: ${matchedKeywords.slice(0, 3).join(", ")}.`);
  }
  if (!cleanStartBoundary || !cleanEndBoundary) {
    notes.push("The clip may benefit from a little timing expansion for smoother edits.");
  }
  return uniqueStrings(notes).slice(0, 4);
};

const scoreClipCandidate = ({
  window,
  transcriptWords,
  targetPlatform,
  creatorNiche
}: {
  window: CandidateWindow;
  transcriptWords: TranscribedWord[];
  targetPlatform: TargetPlatform;
  creatorNiche?: string;
}): ClipCandidate => {
  const clipWords = transcriptWords.slice(window.start_index, window.end_index + 1);
  const transcriptExcerpt = sliceWordsToText(clipWords);
  const leadingContext = sliceWordsToText(
    sliceWordsInRange(transcriptWords, Math.max(0, window.start_ms - 5000), window.start_ms)
  );
  const trailingContext = sliceWordsToText(
    sliceWordsInRange(
      transcriptWords,
      window.end_ms,
      Math.min(transcriptWords[transcriptWords.length - 1]?.end_ms ?? window.end_ms, window.end_ms + 5000)
    )
  );
  const lowerText = transcriptExcerpt.toLowerCase();
  const openingText = sliceWordsToText(clipWords.slice(0, Math.min(12, clipWords.length)));
  const openingLower = openingText.toLowerCase();
  const sentences = splitSentences(transcriptExcerpt);
  const durationMs = window.end_ms - window.start_ms;
  const durationSeconds = durationMs / 1000;
  const wordCount = clipWords.length;
  const openingQuestion = /^\s*(why|how|what|when|who)\b/i.test(openingText) || openingText.includes("?");
  const strongHookPhrase = countPhraseHits(openingLower, HOOK_PHRASES) > 0 || /^(stop|listen|imagine)\b/i.test(openingLower);
  const contrastPhrase = countKeywordHits(lowerText, CONTRAST_KEYWORDS) > 0;
  const emotionalPhrase = countKeywordHits(lowerText, EMOTION_KEYWORDS) > 0;
  const quoteableSentence = sentences.some((sentence) => isQuoteableSentence(sentence));
  const contextDependencyPenalty = startsWithDependentWord(transcriptExcerpt);
  const cleanStartBoundary =
    window.start_index === 0 ||
    transcriptWords[window.start_index].start_ms - transcriptWords[window.start_index - 1].end_ms >= 180 ||
    /^[A-Z0-9"'(]/.test(transcriptExcerpt.trim());
  const cleanEndBoundary =
    window.end_index >= transcriptWords.length - 1 ||
    transcriptWords[window.end_index + 1].start_ms - transcriptWords[window.end_index].end_ms >= 180 ||
    hasTerminalPunctuation(transcriptExcerpt);
  const numberClaim = /(?:\b\d+\b|%|\b(one|two|three|five|ten)\b)/i.test(transcriptExcerpt);
  const payoffHits = countPhraseHits(lowerText, PAYOFF_PHRASES);
  const curiosityHits = countPhraseHits(lowerText, CURIOSITY_PHRASES);
  const emotionHits = countKeywordHits(lowerText, EMOTION_KEYWORDS);
  const nicheBonus = getNicheAlignmentBonus(lowerText, creatorNiche);
  const matchedKeywords = uniqueStrings(
    [
      ...HOOK_PHRASES.filter((phrase) => openingLower.includes(phrase) || lowerText.includes(phrase)),
      ...PAYOFF_PHRASES.filter((phrase) => lowerText.includes(phrase))
    ].map((phrase) => phrase.replace(/\s+/g, "_"))
  ).slice(0, 6);
  const emphasisWords = uniqueStrings(
    clipWords
      .map((word) => normalizeToken(word.text))
      .filter((word) => EMPHASIS_KEYWORDS.includes(word) || EMOTION_KEYWORDS.includes(word))
  ).slice(0, 8);

  const scores: ClipScore = {
    hook: clampClipScore(
      3.4 +
        (strongHookPhrase ? 2.1 : 0) +
        (openingQuestion ? 1.5 : 0) +
        (contrastPhrase ? 1.0 : 0) +
        (numberClaim ? 0.8 : 0) +
        Math.min(1.2, countPhraseHits(openingLower, HOOK_PHRASES) * 0.9) +
        nicheBonus -
        (contextDependencyPenalty ? 0.8 : 0)
    ),
    clarity: clampClipScore(
      5.1 +
        (hasTerminalPunctuation(transcriptExcerpt) ? 1.1 : -0.5) +
        (wordCount >= 25 && wordCount <= 90 ? 0.8 : -0.5) +
        (cleanStartBoundary ? 0.4 : -0.4) +
        (cleanEndBoundary ? 0.4 : -0.5) -
        (contextDependencyPenalty ? 2.2 : 0) +
        nicheBonus * 0.5
    ),
    payoff: clampClipScore(
      4.2 +
        (payoffHits * 1.2) +
        (sentences.length >= 2 ? 0.6 : 0.2) +
        (durationSeconds <= 30 ? 0.8 : 0.2) +
        (hasTerminalPunctuation(transcriptExcerpt) ? 0.7 : -0.6) -
        (contextDependencyPenalty ? 0.5 : 0)
    ),
    emotion: clampClipScore(
      3.0 +
        Math.min(3.2, emotionHits * 0.9) +
        (contrastPhrase ? 0.8 : 0) +
        (/\b(i was wrong|i thought|i learned|i almost|i nearly)\b/i.test(lowerText) ? 1.2 : 0) +
        (/[!?]/.test(transcriptExcerpt) ? 0.4 : 0)
    ),
    shareability: clampClipScore(
      4.0 +
        (quoteableSentence ? 1.8 : 0.2) +
        (strongHookPhrase ? 0.9 : 0) +
        (numberClaim ? 0.6 : 0) +
        Math.min(1.1, matchedKeywords.length * 0.25) +
        nicheBonus
    ),
    curiosity: clampClipScore(
      3.4 +
        (curiosityHits * 1.2) +
        (openingQuestion ? 0.8 : 0) +
        (contrastPhrase ? 0.8 : 0) +
        (/\b(wait|until|next|then)\b/i.test(lowerText) ? 0.8 : 0)
    ),
    clip_cleanliness: clampClipScore(
      4.8 +
        (cleanStartBoundary ? 1.6 : -0.5) +
        (cleanEndBoundary ? 1.8 : -0.6) -
        (contextDependencyPenalty ? 1.8 : 0) -
        (hasTerminalPunctuation(transcriptExcerpt) ? 0 : 0.7)
    ),
    platform_fit: clampClipScore(
      (targetPlatform === "youtube" ? 9.6 : 9.8) -
        (Math.abs(durationMs - (targetPlatform === "youtube" ? 32000 : 22000)) / 3200) -
        (durationMs < 10000 || durationMs > 45000 ? 1.2 : 0)
    )
  };

  const finalScore = clampClipScore(
    scores.hook * CLIP_SCORING_WEIGHTS.hook +
      scores.clarity * CLIP_SCORING_WEIGHTS.clarity +
      scores.payoff * CLIP_SCORING_WEIGHTS.payoff +
      scores.emotion * CLIP_SCORING_WEIGHTS.emotion +
      scores.shareability * CLIP_SCORING_WEIGHTS.shareability +
      scores.curiosity * CLIP_SCORING_WEIGHTS.curiosity +
      scores.clip_cleanliness * CLIP_SCORING_WEIGHTS.clip_cleanliness +
      scores.platform_fit * CLIP_SCORING_WEIGHTS.platform_fit
  );

  const rankingNotes = buildRankingNotes({
    scores,
    openingQuestion,
    strongHookPhrase,
    contextDependencyPenalty,
    cleanStartBoundary,
    cleanEndBoundary,
    quoteableSentence,
    emotionalPhrase,
    matchedKeywords
  });

  const heuristicSignals: ClipHeuristicSignals = {
    opening_question: openingQuestion,
    strong_hook_phrase: strongHookPhrase,
    contrast_phrase: contrastPhrase,
    emotional_phrase: emotionalPhrase,
    quoteable_sentence: quoteableSentence,
    context_dependency_penalty: contextDependencyPenalty,
    clean_start_boundary: cleanStartBoundary,
    clean_end_boundary: cleanEndBoundary,
    matched_keywords: matchedKeywords,
    emphasis_words: emphasisWords
  };

  return clipCandidateSchema.parse({
    clip_id: `clip_${window.start_index}_${window.end_index}`,
    window_label: window.label,
    start_ms: window.start_ms,
    end_ms: window.end_ms,
    duration_ms: durationMs,
    transcript_excerpt: transcriptExcerpt,
    leading_context: leadingContext,
    trailing_context: trailingContext,
    scores,
    heuristic_signals: heuristicSignals,
    final_score: finalScore,
    ranking_notes: rankingNotes,
    recommended_start_adjustment_ms: cleanStartBoundary ? -900 : -1400,
    recommended_end_adjustment_ms: cleanEndBoundary ? 1200 : 1800
  });
};

const overlapRatio = (
  left: Pick<ClipCandidate, "start_ms" | "end_ms">,
  right: Pick<ClipCandidate, "start_ms" | "end_ms">
): number => {
  const overlapMs = Math.max(0, Math.min(left.end_ms, right.end_ms) - Math.max(left.start_ms, right.start_ms));
  const shorterDuration = Math.min(left.end_ms - left.start_ms, right.end_ms - right.start_ms);
  if (shorterDuration <= 0) {
    return 0;
  }
  return overlapMs / shorterDuration;
};

const textSimilarity = (left: string, right: string): number => {
  const leftTokens = tokenizeComparableText(left);
  const rightTokens = tokenizeComparableText(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }
  const rightSet = new Set(rightTokens);
  const intersection = leftTokens.filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
};

const buildSelectedClip = ({
  candidate,
  rank,
  transcriptWords
}: {
  candidate: ClipCandidate;
  rank: number;
  transcriptWords: TranscribedWord[];
}): SelectedClip => {
  const maxEnd = transcriptWords[transcriptWords.length - 1]?.end_ms ?? candidate.end_ms;
  const exportStart = Math.max(0, candidate.start_ms + candidate.recommended_start_adjustment_ms);
  const exportEnd = Math.min(maxEnd, candidate.end_ms + candidate.recommended_end_adjustment_ms);
  const hookLine = pickHookLine(candidate.transcript_excerpt);
  const reasonSelected =
    candidate.ranking_notes[0] ??
    "Strong standalone hook with enough payoff to work as a short-form clip.";
  const portraitFocus = derivePortraitFocus({
    candidate,
    hookLine
  });
  const emphasisSet = new Set(candidate.heuristic_signals.emphasis_words);
  const punchMoments = transcriptWords
    .filter((word) => word.end_ms > candidate.start_ms && word.start_ms < candidate.end_ms)
    .filter((word) => emphasisSet.has(normalizeToken(word.text)))
    .map((word) => word.start_ms)
    .slice(0, 3);
  const fallbackPunchMoments =
    punchMoments.length > 0
      ? punchMoments
      : [
          Math.round(exportStart + ((exportEnd - exportStart) * 0.33)),
          Math.round(exportStart + ((exportEnd - exportStart) * 0.66))
        ];

  return selectedClipSchema.parse({
    ...candidate,
    rank,
    export_start_ms: exportStart,
    export_end_ms: exportEnd,
    export_duration_ms: exportEnd - exportStart,
    virality_score: candidate.final_score,
    reason_selected: reasonSelected,
    hook_line: hookLine,
    suggested_title: hookLine.replace(/[.!?]+$/, ""),
    suggested_caption: `${hookLine.replace(/[.!?]+$/, "")}. ${reasonSelected}`,
    punch_in_moments_ms: fallbackPunchMoments,
    subtitle_emphasis_words: candidate.heuristic_signals.emphasis_words.slice(0, 6),
    portrait_focus: portraitFocus
  });
};

const selectTopClips = ({
  candidates,
  transcriptWords,
  minClipCount,
  maxClipCount
}: {
  candidates: ClipCandidate[];
  transcriptWords: TranscribedWord[];
  minClipCount: number;
  maxClipCount: number;
}): SelectedClip[] => {
  const selected: SelectedClip[] = [];
  const limitedMax = Math.max(1, Math.min(4, maxClipCount));
  const boundedMin = Math.min(Math.max(1, minClipCount), limitedMax);

  for (const candidate of candidates) {
    const conflicts = selected.some(
      (entry) =>
        overlapRatio(candidate, entry) > 0.55 ||
        textSimilarity(candidate.transcript_excerpt, entry.transcript_excerpt) > 0.72
    );
    if (conflicts) {
      continue;
    }

    selected.push(
      buildSelectedClip({
        candidate,
        rank: selected.length + 1,
        transcriptWords
      })
    );

    if (selected.length >= limitedMax) {
      break;
    }
  }

  const minimumDesired = Math.min(candidates.length, boundedMin);
  if (selected.length < minimumDesired) {
    for (const candidate of candidates) {
      const exactDuplicate = selected.some(
        (entry) =>
          overlapRatio(candidate, entry) > 0.85 &&
          textSimilarity(candidate.transcript_excerpt, entry.transcript_excerpt) > 0.9
      );
      if (exactDuplicate) {
        continue;
      }

      selected.push(
        buildSelectedClip({
          candidate,
          rank: selected.length + 1,
          transcriptWords
        })
      );

      if (selected.length >= minimumDesired || selected.length >= limitedMax) {
        break;
      }
    }
  }

  return selected.map((entry, index) => selectedClipSchema.parse({...entry, rank: index + 1}));
};

export const buildClipSelection = ({
  request,
  metadata
}: {
  request: NormalizedJobRequest;
  metadata: MetadataProfile;
}): ClipSelection => {
  const transcriptWords = metadata.transcript_words;
  const targetPlatform = detectTargetPlatform(
    request.prompt.toLowerCase(),
    request.target_platform ?? (getMetadataField(metadata, "user_intent.target_platform") as TargetPlatform | undefined)
  );
  const warnings = metadata.warnings.slice();

  if (transcriptWords.length === 0) {
    warnings.push("Transcript unavailable; clip candidate generation was skipped.");
    return clipSelectionSchema.parse({
      job_id: request.job_id,
      plan_version: "1.0.0",
      source_summary: {
        transcript_available: false,
        transcript_source: String(getMetadataField(metadata, "transcript_language.transcript_source") ?? "missing"),
        target_platform: targetPlatform,
        creator_niche: request.creator_niche ?? null,
        requested_clip_count_min: request.min_clip_count ?? null,
        requested_clip_count_max: request.max_clip_count ?? null,
        candidate_count: 0,
        selected_count: 0
      },
      window_config: CLIP_WINDOW_CONFIGS,
      scoring_weights: CLIP_SCORING_WEIGHTS,
      candidate_segments: [],
      selected_clips: [],
      warnings: uniqueStrings(warnings)
    });
  }

  const candidateSegments = buildCandidateWindows(transcriptWords)
    .map((window) =>
      scoreClipCandidate({
        window,
        transcriptWords,
        targetPlatform,
        creatorNiche: request.creator_niche
      })
    )
    .sort((left, right) => right.final_score - left.final_score);

  const selectedClips = selectTopClips({
    candidates: candidateSegments,
    transcriptWords,
    minClipCount: request.min_clip_count ?? 2,
    maxClipCount: request.max_clip_count ?? 4
  });

  return clipSelectionSchema.parse({
    job_id: request.job_id,
    plan_version: "1.0.0",
    source_summary: {
      transcript_available: true,
      transcript_source: String(getMetadataField(metadata, "transcript_language.transcript_source") ?? "provided"),
      target_platform: targetPlatform,
      creator_niche: request.creator_niche ?? null,
      requested_clip_count_min: request.min_clip_count ?? null,
      requested_clip_count_max: request.max_clip_count ?? null,
      candidate_count: candidateSegments.length,
      selected_count: selectedClips.length
    },
    window_config: CLIP_WINDOW_CONFIGS,
    scoring_weights: CLIP_SCORING_WEIGHTS,
    candidate_segments: candidateSegments,
    selected_clips: selectedClips,
    warnings: uniqueStrings(warnings)
  });
};

const buildDeterministicEditPlan = ({
  request,
  metadata,
  clipSelection,
  warnings
}: {
  request: NormalizedJobRequest;
  metadata: MetadataProfile;
  clipSelection: ClipSelection;
  warnings: string[];
}): EditPlan => {
  const sourceCandidates = metadata.enrichment_candidates.filter(
    (candidate) => candidate.recommended_action === "source_candidate"
  );

  return editPlanSchema.parse({
    job_id: request.job_id,
    plan_version: "1.0.0",
    job_summary: {
      prompt_excerpt: toPromptExcerpt(request.prompt),
      has_source_video: Boolean(request.input_source_video || request.source_media_ref),
      asset_count: request.input_assets.length,
      transcript_available: metadata.transcript_words.length > 0
    },
    intent_profile: {
      content_type: getMetadataField(metadata, "user_intent.content_type"),
      tone_target: getMetadataField(metadata, "user_intent.tone_target"),
      pace_target: getMetadataField(metadata, "user_intent.pace_target"),
      target_platform: getMetadataField(metadata, "user_intent.target_platform"),
      editing_style_keywords: getMetadataField(metadata, "user_intent.editing_style_keywords")
    },
    operation_order: (getMetadataField(metadata, "execution_orchestration.operation_order") as string[]) ?? [],
    timeline_strategy: {
      authoritative_state: "shared_job_plan",
      caption_safe_priority: true,
      motion_overlay_priority: "secondary_to_captions",
      timeline_lock_stage: "timeline_lock_v1"
    },
    pacing_plan: {
      silence_removal_enabled: getMetadataField(metadata, "timing_pacing.silence_removal_enabled"),
      silence_mode: getMetadataField(metadata, "timing_pacing.silence_mode"),
      minimum_pause_ms: getMetadataField(metadata, "timing_pacing.minimum_pause_ms"),
      maximum_pause_after_tightening_ms: getMetadataField(
        metadata,
        "timing_pacing.maximum_pause_after_tightening_ms"
      ),
      pacing_style: getMetadataField(metadata, "timing_pacing.pacing_style"),
      cut_frequency_target: getMetadataField(metadata, "timing_pacing.cut_frequency_target")
    },
    typography_plan: {
      enabled: getMetadataField(metadata, "typography.typography_enabled"),
      caption_mode: getMetadataField(metadata, "typography.caption_mode"),
      caption_style_profile: getMetadataField(metadata, "typography.caption_style_profile"),
      preset: getMetadataField(metadata, "typography.typography_default_preset"),
      font_family_primary: getMetadataField(metadata, "typography.font_family_primary"),
      font_family_secondary: getMetadataField(metadata, "typography.font_family_secondary"),
      keyword_emphasis_enabled: getMetadataField(metadata, "typography.keyword_emphasis_enabled"),
      fallback_text_card_style: getMetadataField(metadata, "typography.fallback_text_card_style")
    },
    motion_plan: {
      enabled: getMetadataField(metadata, "motion_graphics.motion_graphics_enabled"),
      intensity: getMetadataField(metadata, "motion_graphics.motion_graphics_intensity"),
      style_family: getMetadataField(metadata, "motion_graphics.motion_graphics_style_family"),
      selection_mode: getMetadataField(metadata, "motion_graphics.motion_asset_selection_mode"),
      safe_area_rules: getMetadataField(metadata, "motion_graphics.motion_safe_area_rules"),
      caption_priority_respected: getMetadataField(metadata, "motion_graphics.motion_vs_caption_priority") === "caption_first",
      motion_mode: getMetadataField(metadata, "motion_graphics.motion_mode"),
      motion_asset_density_target: getMetadataField(metadata, "motion_graphics.motion_asset_density_target"),
      motion_repetition_penalty: getMetadataField(metadata, "motion_graphics.motion_repetition_penalty"),
      motion_emphasis_threshold: getMetadataField(metadata, "motion_graphics.motion_emphasis_threshold"),
      motion_clutter_threshold: getMetadataField(metadata, "motion_graphics.motion_clutter_threshold"),
      motion_min_spacing_between_heavy_assets_ms: getMetadataField(
        metadata,
        "motion_graphics.motion_min_spacing_between_heavy_assets_ms"
      ),
      subtitle_protection_margin_px: getMetadataField(metadata, "layout_collision.subtitle_protection_margin_px"),
      face_safe_margin_px: getMetadataField(metadata, "layout_collision.face_safe_margin_px")
    },
    audio_plan: {
      audio_cleanup_enabled: getMetadataField(metadata, "audio.audio_cleanup_enabled"),
      noise_reduction_enabled: getMetadataField(metadata, "audio.noise_reduction_enabled"),
      loudness_normalization_enabled: getMetadataField(metadata, "audio.loudness_normalization_enabled"),
      target_lufs: getMetadataField(metadata, "audio.target_lufs"),
      music_enabled: getMetadataField(metadata, "audio.music_enabled"),
      sfx_enabled: getMetadataField(metadata, "audio.sfx_enabled"),
      sound_design_manifest_available: Boolean(request.sound_design_manifest),
      sound_design_render_requested: Boolean(request.sound_design_manifest),
      sound_design_preview_requested: Boolean(request.sound_design_manifest),
      sound_design_stems_requested: Boolean(request.sound_design_manifest),
      sound_design_master_targets: request.sound_design_manifest?.master ?? null
    },
    clip_finder_plan: {
      enabled: metadata.transcript_words.length > 0,
      transcript_required: true,
      target_platform: clipSelection.source_summary.target_platform,
      creator_niche: clipSelection.source_summary.creator_niche,
      requested_clip_count_min: clipSelection.source_summary.requested_clip_count_min,
      requested_clip_count_max: clipSelection.source_summary.requested_clip_count_max,
      candidate_count: clipSelection.source_summary.candidate_count,
      selected_clip_count: clipSelection.source_summary.selected_count,
      selected_clip_ids: clipSelection.selected_clips.map((clip) => clip.clip_id)
    },
    enrichment_plan: {
      enabled: getMetadataField(metadata, "entity_enrichment.entity_scan_enabled") === true,
      source_candidates: sourceCandidates,
      threshold_summary: {
        confidence: getMetadataField(metadata, "entity_enrichment.entity_detection_confidence_threshold"),
        visual_relevance: getMetadataField(metadata, "entity_enrichment.entity_visual_relevance_threshold"),
        fetch_priority: getMetadataField(metadata, "entity_enrichment.entity_fetch_priority_threshold")
      },
      search_terms: uniqueStrings(sourceCandidates.map((candidate) => candidate.entity_text))
    },
    asset_usage_rules: {
      use_uploaded_assets_first: true,
      allow_external_assets: true,
      asset_source_priority: getMetadataField(metadata, "search_sourcing.asset_source_priority"),
      caption_safe_priority: true
    },
    fallback_plan: {
      global_fallback_style: getMetadataField(metadata, "fallback.global_fallback_style"),
      fetch_failure: getMetadataField(metadata, "fallback.fallback_on_fetch_failure"),
      bad_transcript: getMetadataField(metadata, "fallback.fallback_on_bad_transcript"),
      fallback_typography_preset: getMetadataField(metadata, "fallback.fallback_typography_preset"),
      fallback_motion_asset_pack: getMetadataField(metadata, "fallback.fallback_motion_asset_pack")
    },
    warnings,
    unresolved_items: sourceCandidates.length > 0 ? ["remote_fetch_worker_not_connected"] : []
  });
};

const buildDeterministicExecutionPlan = ({
  request,
  clipSelection,
  editPlan,
  fallbackEvents
}: {
  request: NormalizedJobRequest;
  clipSelection: ClipSelection;
  editPlan: EditPlan;
  fallbackEvents: FallbackEvent[];
}): ExecutionPlan => {
  const audioRenderEnabled = Boolean(request.sound_design_manifest);

  const dependencies = [
    {step: "media_preprocessing", depends_on: []},
    {step: "transcript_alignment", depends_on: ["media_preprocessing"]},
    {step: "silence_tightening", depends_on: ["transcript_alignment"]},
    {step: "clip_selection_review", depends_on: ["transcript_alignment"]},
    {step: "typography_placement", depends_on: ["silence_tightening"]},
    {step: "motion_graphics_placement", depends_on: ["typography_placement", "clip_selection_review"]},
    {step: "external_visual_insertion", depends_on: ["motion_graphics_placement"]},
    ...(audioRenderEnabled
      ? [{step: "audio_render", depends_on: ["external_visual_insertion"]}]
      : []),
    {
      step: "audio_finish",
      depends_on: [audioRenderEnabled ? "audio_render" : "external_visual_insertion"]
    },
    {step: "render_handoff", depends_on: ["audio_finish"]}
  ];

  const executionSteps = [
    {
      id: "step_media_preprocessing",
      stage: "media_preprocessing",
      action: "Prepare authoritative timeline inputs and source summaries.",
      reads: ["inputs/manifest.json"],
      writes: ["timeline_state.source_profile"],
      optional: false
    },
    {
      id: "step_transcript_alignment",
      stage: "transcript_alignment",
      action: "Align transcript-derived timing before any typography or motion placement.",
      reads: ["metadata-profile.json"],
      writes: ["timeline_state.transcript_alignment"],
      optional: !editPlan.job_summary.transcript_available
    },
    {
      id: "step_silence_tightening",
      stage: "silence_tightening",
      action: "Apply pacing cleanup prior to caption timing lock.",
      reads: ["edit-plan.json:pacing_plan"],
      writes: ["timeline_state.pacing_segments"],
      optional: false
    },
    {
      id: "step_clip_selection_review",
      stage: "clip_selection_review",
      action: "Lock the ranked short-form clip windows for downstream editing and export.",
      reads: ["clip-selection.json"],
      writes: ["timeline_state.selected_clip_windows"],
      optional: clipSelection.selected_clips.length === 0
    },
    {
      id: "step_typography_placement",
      stage: "typography_placement",
      action: "Place caption and fallback typography cards inside reserved safe zones.",
      reads: ["edit-plan.json:typography_plan"],
      writes: ["timeline_state.typography_layers"],
      optional: false
    },
    {
      id: "step_motion_graphics_placement",
      stage: "motion_graphics_placement",
      action: "Apply restrained motion accents after typography-safe zones are locked.",
      reads: ["edit-plan.json:motion_plan", "motion-plan.json", "timeline_state.typography_layers"],
      writes: ["timeline_state.motion_layers", "motion-plan.json"],
      optional: false
    },
    {
      id: "step_external_visual_insertion",
      stage: "external_visual_insertion",
      action: "Register source-candidate insertion intents and their required fallbacks.",
      reads: ["edit-plan.json:enrichment_plan"],
      writes: ["timeline_state.source_insertions"],
      optional: true
    },
    ...(audioRenderEnabled
      ? [
          {
            id: "step_audio_render",
            stage: "audio_render",
            action: "Render the cinematic soundtrack master, preview mix, stems, and waveform debug artifacts.",
            reads: ["inputs/manifest.json", "edit-plan.json:audio_plan"],
            writes: ["timeline_state.audio_render_artifacts"],
            optional: false
          }
        ]
      : []),
    {
      id: "step_audio_finish",
      stage: "audio_finish",
      action: audioRenderEnabled
        ? "Finalize the normalized soundtrack handoff after FFmpeg rendering."
        : "Prepare audio cleanup and normalization handoff.",
      reads: ["edit-plan.json:audio_plan"],
      writes: ["timeline_state.audio_finish"],
      optional: false
    },
    {
      id: "step_render_handoff",
      stage: "render_handoff",
      action: "Publish execution contract for downstream renderer.",
      reads: ["edit-plan.json", "motion-plan.json", "metadata-profile.json"],
      writes: ["execution-plan.json"],
      optional: false
    }
  ];

  return executionPlanSchema.parse({
    job_id: request.job_id,
    plan_version: editPlan.plan_version,
    validated: true,
    validation_report: {
      valid: true,
      warnings: editPlan.warnings,
      errors: []
    },
    dependencies,
    execution_steps: executionSteps,
    timeline_updates: [
      {
        step_id: "step_silence_tightening",
        mutation: "timeline_gap_compaction",
        reason: "Silence cleanup must finalize pacing before typography timing locks."
      },
      {
        step_id: "step_typography_placement",
        mutation: "caption_safe_zone_reservation",
        reason: "Caption-safe zones outrank motion accents."
      },
      {
        step_id: "step_motion_graphics_placement",
        mutation: "motion_overlay_commit",
        reason: "Motion layers are constrained by typography-safe zones."
      },
      {
        step_id: "step_motion_graphics_placement",
        mutation: "motion_plan_commit",
        reason: "The backend motion plan is persisted before execution handoff."
      }
    ],
    asset_insertions: editPlan.enrichment_plan.source_candidates.map((candidate) => ({
      entity_text: candidate.entity_text,
      strategy: candidate.source_strategy,
      fallback_strategy: candidate.fallback_strategy
    })),
    fallback_events: fallbackEvents,
    blocked_items: [],
    final_ready_state: {
      ready_for_renderer: true,
      missing_optional_components:
        editPlan.enrichment_plan.source_candidates.length > 0 ? ["remote_fetch_worker"] : [],
      next_recommended_stage: "render_handoff"
    }
  });
};

const tryLlmMetadataRefinement = async ({
  env,
  deps,
  deterministicProfile
}: {
  env: BackendEnv;
  deps: PipelineDependencies;
  deterministicProfile: MetadataProfile;
}): Promise<MetadataProfile | null> => {
  return maybeCallGroqJson({
    env,
    fetchImpl: deps.fetchImpl,
    schema: metadataProfileSchema,
    systemPrompt: "Return strict JSON only. No markdown.",
    userPrompt: buildMetadataSynthesizerPrompt(deterministicProfile)
  });
};

const tryLlmEnrichmentRefinement = async ({
  env,
  deps,
  deterministicCandidates
}: {
  env: BackendEnv;
  deps: PipelineDependencies;
  deterministicCandidates: EnrichmentCandidate[];
}): Promise<EnrichmentCandidate[] | null> => {
  return maybeCallGroqJson({
    env,
    fetchImpl: deps.fetchImpl,
    schema: z.array(enrichmentCandidateSchema),
    systemPrompt: "Return strict JSON only. No markdown.",
    userPrompt: buildEnrichmentPlannerPrompt(deterministicCandidates)
  });
};

const tryLlmEditPlanRefinement = async ({
  env,
  deps,
  deterministicPlan
}: {
  env: BackendEnv;
  deps: PipelineDependencies;
  deterministicPlan: EditPlan;
}): Promise<EditPlan | null> => {
  return maybeCallGroqJson({
    env,
    fetchImpl: deps.fetchImpl,
    schema: editPlanSchema,
    systemPrompt: "Return strict JSON only. No markdown.",
    userPrompt: buildCentralEditPlannerPrompt(deterministicPlan)
  });
};

const tryLlmExecutionPlanRefinement = async ({
  env,
  deps,
  deterministicPlan
}: {
  env: BackendEnv;
  deps: PipelineDependencies;
  deterministicPlan: ExecutionPlan;
}): Promise<ExecutionPlan | null> => {
  return maybeCallGroqJson({
    env,
    fetchImpl: deps.fetchImpl,
    schema: executionPlanSchema,
    systemPrompt: "Return strict JSON only. No markdown.",
    userPrompt: buildExecutionPlannerPrompt(deterministicPlan)
  });
};

const withGroqFallback = async <T>({
  attempt,
  warnings,
  fallbackEvents,
  deps,
  stage,
  code
}: {
  attempt: () => Promise<T | null>;
  warnings: string[];
  fallbackEvents: FallbackEvent[];
  deps: PipelineDependencies;
  stage: string;
  code: string;
}): Promise<T | null> => {
  try {
    return await attempt();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    warnings.push(`Groq fallback during ${stage}: ${reason}`);
    fallbackEvents.push(
      createFallbackEvent(
        stage,
        code,
        "warning",
        "Groq refinement failed; deterministic fallback was used.",
        {reason},
        deps
      )
    );
    return null;
  }
};

const progressForStage = (stage: JobRecord["current_stage"]): JobRecord["progress"] => {
  const currentStep = PIPELINE_STEP_INDEX[stage];
  const percent = round((currentStep / TOTAL_STEPS) * 100, 1);
  return {
    current_step: currentStep,
    total_steps: TOTAL_STEPS,
    percent
  };
};

export const createInitialJobRecord = ({
  request,
  repository,
  deps
}: {
  request: NormalizedJobRequest;
  repository: FileJobRepository;
  deps: PipelineDependencies;
}): JobRecord => {
  const now = nowIso(deps);
  return jobRecordSchema.parse({
    job_id: request.job_id,
    status: "received",
    current_stage: "received",
    created_at: now,
    updated_at: now,
    completed_at: null,
    stage_history: [{stage: "received", at: now}],
    progress: progressForStage("received"),
    request_summary: {
      prompt_excerpt: toPromptExcerpt(request.prompt),
      source_media_ref: request.source_media_ref ?? null,
      has_source_video: Boolean(request.input_source_video || request.source_media_ref),
      asset_count: request.input_assets.length,
      has_sound_design_manifest: Boolean(request.sound_design_manifest)
    },
    source_summary: {
      source_filename: request.input_source_video?.original_name ?? request.source_media_ref ?? null,
      source_storage_uri: request.input_source_video?.stored_path ?? request.source_media_ref ?? null,
      source_duration_ms: null,
      source_aspect_ratio: null
    },
    warning_list: [],
    error_message: null,
    template_versions: {...PROMPT_TEMPLATE_VERSIONS},
    artifact_paths: {
      job: repository.artifactPath(request.job_id, "job"),
      input_manifest: repository.artifactPath(request.job_id, "input_manifest"),
      metadata_profile: null,
      clip_selection: null,
      edit_plan: null,
      motion_plan: null,
      execution_plan: null,
      fallback_log: null,
      video_aware_audio_plan: null,
      video_aware_sound_manifest: null,
      video_aware_music_preflight: null,
      video_aware_audio_preview_mix: null,
      audio_render_plan: null,
      audio_master: null,
      audio_master_aac: null,
      audio_preview_mix: null,
      audio_waveform_png: null,
      audio_peaks_json: null,
      audio_stems_dir: null
    }
  });
};

const updateStage = async (
  repository: FileJobRepository,
  jobId: string,
  stage: JobRecord["current_stage"],
  deps: PipelineDependencies,
  note?: string
): Promise<void> => {
  const stamp = nowIso(deps);
  await repository.updateJobRecord(jobId, (current) => ({
    ...current,
    status: stage,
    current_stage: stage,
    updated_at: stamp,
    completed_at: stage === "completed" ? stamp : current.completed_at,
    progress: progressForStage(stage),
    stage_history: current.stage_history.concat([{stage, at: stamp, note}])
  }));
};

const mergeWarningsIntoJob = async (
  repository: FileJobRepository,
  jobId: string,
  warnings: string[],
  sourceSummary?: Partial<JobRecord["source_summary"]>,
  artifactPatch?: Partial<JobRecord["artifact_paths"]>
): Promise<void> => {
  await repository.updateJobRecord(jobId, (current) => ({
    ...current,
    warning_list: uniqueStrings(current.warning_list.concat(warnings)),
    source_summary: {
      ...current.source_summary,
      ...sourceSummary
    },
    artifact_paths: {
      ...current.artifact_paths,
      ...artifactPatch
    }
  }));
};

const buildPatternMemoryFeedbackPayload = async ({
  request,
  metadata,
  motionPlanArtifact
}: {
  request: NormalizedJobRequest;
  metadata: MetadataProfile;
  motionPlanArtifact: Awaited<ReturnType<typeof buildMotionPlanArtifact>>;
}): Promise<Parameters<typeof recordPatternMemoryOutcome>[0] | null> => {
  const snapshot = await readPatternMemorySnapshot();
  const topPatternRef = motionPlanArtifact.pattern_memory_summary?.top_patterns?.[0];
  const topEntry = topPatternRef ? snapshot.entries.find((entry) => entry.id === topPatternRef.id) ?? snapshot.entries[0] ?? null : snapshot.entries[0] ?? null;
  if (!topEntry) {
    return null;
  }

  const hasErrors = motionPlanArtifact.validation.errors.length > 0;
  const hasRedundancyWarning = motionPlanArtifact.validation.warnings.some((warning) => /redundant|duplicate|clutter|overuse|restraint/i.test(warning));
  const outcome = hasErrors ? "rejected" : hasRedundancyWarning ? "partial-success" : "success";
  const durationSeconds = Number(motionPlanArtifact.source_summary.duration_seconds ?? 0);
  const selectedAssetCount = Number(motionPlanArtifact.source_summary.selected_asset_count ?? 0);
  const timelineEventCount = Number(motionPlanArtifact.source_summary.timeline_event_count ?? 0);
  const intensityScore = Number(motionPlanArtifact.source_summary.intensity_score ?? 0);
  const emphasisScore = Number(motionPlanArtifact.source_summary.emphasis_score ?? 0);
  const emotionScore = Number(motionPlanArtifact.source_summary.emotion_score ?? 0);

  return {
    patternId: topEntry.id,
    context: {
      jobId: request.job_id,
      videoId: request.video_id,
      sourceVideoId: request.source_media_ref ?? request.input_source_video?.asset_id ?? undefined,
      semanticIntent: topEntry.semanticIntent,
      sceneType: topEntry.sceneType,
      detectedMomentType: topEntry.semanticIntent,
      semanticRole: topEntry.semanticRole,
      visualDensity: Math.min(1, selectedAssetCount / Math.max(1, timelineEventCount || 1)),
      captionDensity: Math.min(1, metadata.transcript_words.length / Math.max(1, durationSeconds || 1)),
      speakerDominance: 0.5,
      motionTier: String(metadata.motion_graphics.motion_mode ?? "editorial"),
      activeEffectIds: motionPlanArtifact.selected_assets.map((asset) => String(asset.id)),
      activeAssetIds: motionPlanArtifact.selected_assets.map((asset) => String(asset.id)),
      activeTagIds: motionPlanArtifact.pattern_memory_signal_terms ?? [],
      assetTags: motionPlanArtifact.pattern_memory_signal_terms ?? [],
      momentTags: [topEntry.semanticIntent, topEntry.sceneType],
      semanticSignals: uniqueStrings([
        ...motionPlanArtifact.notes,
        ...(motionPlanArtifact.pattern_memory_signal_terms ?? [])
      ]),
      minuteBucket: Math.floor((metadata.transcript_words[0]?.start_ms ?? 0) / 60000),
      timelinePositionMs: metadata.transcript_words[0]?.start_ms ?? 0,
      timelineWindowMs: Math.max(1000, Math.round((durationSeconds || 1) * 1000)),
      importance: intensityScore / 100,
      hasPause: motionPlanArtifact.timeline_events.some((event) => String(event.kind) === "transition"),
      isDenseScene: motionPlanArtifact.validation.warnings.length > 2,
      isLongForm: durationSeconds >= 300
    },
    outcome,
    humanApproved: false,
    rejectedReason: hasErrors ? "semantic-mismatch" : hasRedundancyWarning ? "redundancy" : undefined,
    notes: hasErrors
      ? "Motion plan failed validation and was downranked in pattern memory."
      : hasRedundancyWarning
        ? "Motion plan produced a redundancy warning and recorded a partial-success reinforcement."
        : "Motion plan was reinforced as a successful pattern selection.",
    appliedEffectIds: motionPlanArtifact.selected_assets.map((asset) => String(asset.id)),
    appliedAssetIds: motionPlanArtifact.selected_assets.map((asset) => String(asset.id)),
    visualScore: emotionScore || undefined,
    hierarchyScore: emphasisScore || undefined,
    clarityScore: intensityScore ? intensityScore / 100 : undefined
  };
};

export const processJobPipeline = async ({
  request,
  repository,
  env,
  deps
}: {
  request: NormalizedJobRequest;
  repository: FileJobRepository;
  env: BackendEnv;
  deps: PipelineDependencies;
}): Promise<void> => {
  const normalizedRequest = normalizedJobRequestSchema.parse(request);
  const warnings: string[] = [];
  const fallbackEvents: FallbackEvent[] = [];

  await updateStage(repository, normalizedRequest.job_id, "analyzing", deps, "Job worker started.");

  const sourceAnalysis = await analyzeSourceMedia(normalizedRequest, deps, env);
  warnings.push(...sourceAnalysis.warnings);
  fallbackEvents.push(...sourceAnalysis.fallback_events);

  const transcript = await resolveTranscript({
    request: normalizedRequest,
    analysis: sourceAnalysis,
    repository,
    env,
    deps
  });
  warnings.push(...transcript.warnings);
  fallbackEvents.push(...transcript.fallback_events);

  const metadataResult = synthesizeMetadataProfile({
    request: normalizedRequest,
    analysis: sourceAnalysis,
    transcript,
    deps
  });
  warnings.push(...metadataResult.warnings);
  fallbackEvents.push(...metadataResult.fallback_events);
  let metadataProfile = metadataResult.profile;

  const llmMetadata = await withGroqFallback({
    attempt: () => tryLlmMetadataRefinement({env, deps, deterministicProfile: metadataProfile}),
    warnings,
    fallbackEvents,
    deps,
    stage: "metadata_synthesis",
    code: "groq_metadata_refinement_failed"
  });
  if (llmMetadata) {
    metadataProfile = llmMetadata;
  }

  const enrichmentCandidates = buildEnrichmentCandidates({
    request: normalizedRequest,
    metadata: metadataProfile
  });

  const llmEnrichment = await withGroqFallback({
    attempt: () => tryLlmEnrichmentRefinement({env, deps, deterministicCandidates: enrichmentCandidates}),
    warnings,
    fallbackEvents,
    deps,
    stage: "entity_enrichment",
    code: "groq_enrichment_refinement_failed"
  });
  metadataProfile.enrichment_candidates = llmEnrichment ?? enrichmentCandidates;
  metadataProfile.warnings = uniqueStrings(metadataProfile.warnings.concat(warnings));
  setMetadataField(
    metadataProfile,
    "transcript_language.named_entity_candidates",
    metadataProfile.enrichment_candidates.map((candidate) => candidate.entity_text),
    "inferred_from_prompt"
  );
  setMetadataField(
    metadataProfile,
    "search_sourcing.search_terms_generated",
    metadataProfile.enrichment_candidates
      .filter((candidate) => candidate.recommended_action === "source_candidate")
      .map((candidate) => candidate.entity_text),
    "inferred_from_prompt"
  );

  const metadataPath = await repository.writeMetadataProfile(normalizedRequest.job_id, metadataProfile);
  const clipSelection = buildClipSelection({
    request: normalizedRequest,
    metadata: metadataProfile
  });
  const clipSelectionPath = await repository.writeClipSelection(normalizedRequest.job_id, clipSelection);
  await mergeWarningsIntoJob(
    repository,
    normalizedRequest.job_id,
    uniqueStrings(warnings.concat(clipSelection.warnings)),
    {
      source_filename: sourceAnalysis.source_filename,
      source_storage_uri: sourceAnalysis.source_storage_uri,
      source_duration_ms: sourceAnalysis.probe ? Math.round(sourceAnalysis.probe.duration_seconds * 1000) : null,
      source_aspect_ratio: inferAspectRatio(sourceAnalysis.probe?.width ?? null, sourceAnalysis.probe?.height ?? null)
    },
    {
      metadata_profile: metadataPath,
      clip_selection: clipSelectionPath
    }
  );
  await updateStage(repository, normalizedRequest.job_id, "metadata_ready", deps, "Metadata profile persisted.");

  let editPlan = buildDeterministicEditPlan({
    request: normalizedRequest,
    metadata: metadataProfile,
    clipSelection,
    warnings: uniqueStrings(warnings.concat(clipSelection.warnings))
  });

  const llmEditPlan = await withGroqFallback({
    attempt: () => tryLlmEditPlanRefinement({env, deps, deterministicPlan: editPlan}),
    warnings,
    fallbackEvents,
    deps,
    stage: "edit_planning",
    code: "groq_edit_plan_refinement_failed"
  });
  if (llmEditPlan) {
    editPlan = llmEditPlan;
  }

  const editPlanPath = await repository.writeEditPlan(normalizedRequest.job_id, editPlan);
  await mergeWarningsIntoJob(repository, normalizedRequest.job_id, warnings, undefined, {
    edit_plan: editPlanPath
  });
  await updateStage(repository, normalizedRequest.job_id, "plan_ready", deps, "Edit plan persisted.");

  const transcriptDurationSeconds = Math.max(1, (metadataProfile.transcript_words.at(-1)?.end_ms ?? 1000) / 1000);
  const resolvedSourceDurationSeconds = sourceAnalysis.probe?.duration_seconds ?? transcriptDurationSeconds;
  const resolvedSourceDurationInFrames = sourceAnalysis.probe?.duration_in_frames ?? Math.max(
    1,
    Math.round(resolvedSourceDurationSeconds * (sourceAnalysis.probe?.fps ?? 30))
  );

  const motionPlanArtifact = await buildMotionPlanArtifact({
    jobId: normalizedRequest.job_id,
    prompt: normalizedRequest.prompt,
    metadata: metadataProfile,
    editPlan,
    clipSelection,
    transcriptWords: metadataProfile.transcript_words,
    // Use probe metadata when available and fall back to transcript length for dry runs.
    videoMetadata: {
      width: sourceAnalysis.probe?.width ?? 1080,
      height: sourceAnalysis.probe?.height ?? 1920,
      fps: sourceAnalysis.probe?.fps ?? 30,
      durationSeconds: resolvedSourceDurationSeconds,
      durationInFrames: resolvedSourceDurationInFrames
    },
    generatedAt: nowIso(deps)
  });
  const motionPlanPath = await repository.writeMotionPlan(normalizedRequest.job_id, motionPlanArtifact);
  warnings.push(...motionPlanArtifact.validation.warnings);
  await mergeWarningsIntoJob(repository, normalizedRequest.job_id, warnings, undefined, {
    motion_plan: motionPlanPath
  });

  try {
    const feedbackPayload = await buildPatternMemoryFeedbackPayload({
      request: normalizedRequest,
      metadata: metadataProfile,
      motionPlanArtifact
    });
    if (feedbackPayload) {
      const result = await recordPatternMemoryOutcome(feedbackPayload);
      warnings.push(`Pattern memory updated: ${result.snapshot.fingerprint}`);
    }
  } catch (error) {
    warnings.push(`Pattern memory reinforcement skipped: ${error instanceof Error ? error.message : String(error)}`);
  }

  let executionPlan = buildDeterministicExecutionPlan({
    request: normalizedRequest,
    clipSelection,
    editPlan,
    fallbackEvents
  });

  const llmExecutionPlan = await withGroqFallback({
    attempt: () => tryLlmExecutionPlanRefinement({env, deps, deterministicPlan: executionPlan}),
    warnings,
    fallbackEvents,
    deps,
    stage: "execution_planning",
    code: "groq_execution_plan_refinement_failed"
  });
  if (llmExecutionPlan) {
    executionPlan = llmExecutionPlan;
  }

  const [executionPlanPath, fallbackLogPath] = await Promise.all([
    repository.writeExecutionPlan(normalizedRequest.job_id, executionPlan),
    repository.writeFallbackLog(normalizedRequest.job_id, fallbackEvents)
  ]);

  await mergeWarningsIntoJob(repository, normalizedRequest.job_id, warnings, undefined, {
    execution_plan: executionPlanPath,
    fallback_log: fallbackLogPath
  });
  await updateStage(repository, normalizedRequest.job_id, "execution_ready", deps, "Execution plan persisted.");

  const soundDesignManifest = normalizedRequest.sound_design_manifest;
  if (soundDesignManifest) {
    await updateStage(repository, normalizedRequest.job_id, "audio_render", deps, "Audio render started.");

    const audioBaseDir = repository.inputsDir(normalizedRequest.job_id);
    const audioDir = path.join(repository.jobDir(normalizedRequest.job_id), "audio");
    const audioStemsDir = path.join(audioDir, "stems");
    const audioRenderPlanPath = repository.artifactPath(normalizedRequest.job_id, "audio_render_plan");
    const audioMasterPath = path.join(audioDir, "master.wav");
    const audioMasterAacPath = path.join(audioDir, "master.m4a");
    const audioPreviewPath = path.join(audioDir, "preview.wav");
    const audioWaveformPath = path.join(audioDir, "waveform.png");
    const audioPeaksPath = path.join(audioDir, "peaks.json");

    const soundDesignResult = await renderMasterTrack(soundDesignManifest, audioMasterPath, {
      baseDir: audioBaseDir,
      aacPath: audioMasterAacPath,
      previewMixPath: audioPreviewPath,
      waveformPngPath: audioWaveformPath,
      peaksJsonPath: audioPeaksPath,
      stemsDir: audioStemsDir,
      debugPlanPath: audioRenderPlanPath,
      logCommand: () => undefined
    });

    await mergeWarningsIntoJob(repository, normalizedRequest.job_id, soundDesignResult.warnings, undefined, {
      audio_render_plan: audioRenderPlanPath,
      audio_master: soundDesignResult.masterPath,
      audio_master_aac: soundDesignResult.aacPath,
      audio_preview_mix: soundDesignResult.previewMixPath,
      audio_waveform_png: soundDesignResult.waveformPngPath,
      audio_peaks_json: soundDesignResult.peaksJsonPath,
      audio_stems_dir: audioStemsDir
    });
  }

  await updateStage(repository, normalizedRequest.job_id, "ranking", deps, "Clip ranking finalized.");
  await updateStage(repository, normalizedRequest.job_id, "completed", deps, "Job completed successfully.");
};
