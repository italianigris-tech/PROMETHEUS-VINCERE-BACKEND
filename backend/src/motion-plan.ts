import path from "node:path";
import {readFile} from "node:fs/promises";

import {z} from "zod";

import type {ClipSelection, EditPlan, MetadataProfile, TranscribedWord} from "./schemas";
import {buildPatternMemorySignalTerms, buildPatternMemorySummary, readPatternMemorySnapshot} from "./pattern-memory";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const REMOTION_DATA_DIR = path.join(WORKSPACE_ROOT, "remotion-app", "src", "data");
const PROTOTYPE_CATALOG_PATH = path.join(REMOTION_DATA_DIR, "animation-prototypes.generated.json");
const AUTHORING_CATALOG_PATH = path.join(REMOTION_DATA_DIR, "motion-assets.authoring.generated.json");
const GOD_CATALOG_PATH = path.join(REMOTION_DATA_DIR, "god-assets.generated.json");

const EFFECT_IDS = {
  targetFocusZoom: "target-focus-zoom",
  coreReplaceableWord: "core-replaceable-word",
  highlightWord: "highlight-word",
  circleReveal: "circle-reveal",
  blurUnderline: "blur-underline",
  typewriter: "typewriter",
  blurReveal: "blur-reveal"
} as const;

export const motionPlanArtifactSchema = z.object({
  job_id: z.string(),
  plan_version: z.string(),
  generated_at: z.string(),
  pattern_memory_fingerprint: z.string().nullable().optional(),
  pattern_memory_summary: z.object({
    fingerprint: z.string(),
    version: z.string(),
    rulesVersion: z.string(),
    active_entries: z.number().int().nonnegative(),
    top_patterns: z.array(z.object({
      id: z.string(),
      semantic_intent: z.string(),
      scene_type: z.string(),
      success_score: z.number(),
      confidence_score: z.number()
    }))
  }).optional(),
  pattern_memory_signal_terms: z.array(z.string()).optional(),
  source_summary: z.record(z.string(), z.unknown()),
  policy: z.record(z.string(), z.unknown()),
  catalog_summary: z.record(z.string(), z.unknown()),
  selected_assets: z.array(z.record(z.string(), z.unknown())),
  asset_assignments: z.array(z.record(z.string(), z.unknown())),
  timeline_events: z.array(z.record(z.string(), z.unknown())),
  paired_effects: z.array(z.record(z.string(), z.unknown())),
  validation: z.object({
    warnings: z.array(z.string()),
    errors: z.array(z.string()),
    rejected_assets: z.array(z.record(z.string(), z.unknown()))
  }),
  notes: z.array(z.string())
});

export type MotionPlanArtifact = z.infer<typeof motionPlanArtifactSchema>;

export type MotionPlanBuilderInput = {
  jobId: string;
  prompt: string;
  metadata: MetadataProfile;
  editPlan: EditPlan;
  clipSelection: ClipSelection;
  transcriptWords: TranscribedWord[];
  videoMetadata: {
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    durationInFrames: number;
  };
  generatedAt?: string;
};

type CatalogRecord = Record<string, unknown> & {id: string};

const loadJsonIfExists = async <T>(filePath: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
};

const normalizeText = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const tokenize = (value: string): string[] => normalizeText(value).split(" ").filter(Boolean);
const stringifyValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map((entry) => stringifyValue(entry)).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map((entry) => stringifyValue(entry)).join(" ");
  }
  return String(value);
};
const collectTerms = (...values: unknown[]): string[] => [...new Set(values.flatMap((value) => tokenize(stringifyValue(value))))];
const unique = (values: Array<string | undefined | null>): string[] => [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round = (value: number, digits = 3): number => Math.round(value * 10 ** digits) / 10 ** digits;

const loadCatalogs = async (): Promise<{prototypeAssets: CatalogRecord[]; authoringAssets: CatalogRecord[]; godAssets: CatalogRecord[]}> => {
  const [prototypeAssets, authoringAssets, godAssets] = await Promise.all([
    loadJsonIfExists<CatalogRecord[]>(PROTOTYPE_CATALOG_PATH),
    loadJsonIfExists<CatalogRecord[]>(AUTHORING_CATALOG_PATH),
    loadJsonIfExists<CatalogRecord[]>(GOD_CATALOG_PATH)
  ]);

  return {
    prototypeAssets: prototypeAssets ?? [],
    authoringAssets: authoringAssets ?? [],
    godAssets: godAssets ?? []
  };
};

const resolveMotionMode = (input: MotionPlanBuilderInput): "quiet" | "balanced" | "aggressive" => {
  const explicit = String(input.editPlan.motion_plan.motion_mode ?? input.metadata.motion_graphics.motion_mode ?? "");
  if (explicit === "quiet" || explicit === "balanced" || explicit === "aggressive") {
    return explicit;
  }
  const intensity = String(input.editPlan.motion_plan.intensity ?? input.metadata.motion_graphics.motion_graphics_intensity ?? "");
  if (intensity === "minimal") return "quiet";
  if (intensity === "high") return "aggressive";
  return "balanced";
};

const resolveIntensity = (input: MotionPlanBuilderInput): "minimal" | "restrained" | "medium" | "high" => {
  const value = String(input.editPlan.motion_plan.intensity ?? input.metadata.motion_graphics.motion_graphics_intensity ?? "restrained");
  return value === "minimal" || value === "restrained" || value === "medium" || value === "high" ? value : "restrained";
};

const buildPolicy = (input: MotionPlanBuilderInput): Record<string, unknown> => ({
  max_assets_per_minute: Number(input.metadata.motion_graphics.motion_asset_density_target ?? 2.4),
  repetition_penalty: Number(input.metadata.motion_graphics.motion_repetition_penalty ?? 0.72),
  emphasis_threshold: Number(input.metadata.motion_graphics.motion_emphasis_threshold ?? 0.74),
  clutter_threshold: Number(input.metadata.motion_graphics.motion_clutter_threshold ?? 0.24),
  min_spacing_between_heavy_assets_ms: Number(input.metadata.motion_graphics.motion_min_spacing_between_heavy_assets_ms ?? 12000),
  subtitle_protection_margin_px: Number(input.metadata.layout_collision.subtitle_protection_margin_px ?? 112),
  face_safe_margin_px: Number(input.metadata.layout_collision.face_safe_margin_px ?? 120),
  motion_mode: resolveMotionMode(input)
});

const scoreRecord = (record: CatalogRecord, queryTerms: Set<string>): number => {
  const corpus = collectTerms(
    record.id,
    record.label as string,
    record.canonicalLabel as string,
    record.family as string,
    record.category as string,
    record.type as string,
    record.notes as string,
    record.sourceFile as string,
    record.sourceHtml as string,
    ...((record.graphTags as string[] | undefined) ?? []),
    ...((record.aliases as string[] | undefined) ?? []),
    ...((record.searchTerms as string[] | undefined) ?? []),
    ...((record.themeTags as string[] | undefined) ?? []),
    ...((record.functionalTags as string[] | undefined) ?? []),
    ...((record.semanticTriggers as string[] | undefined) ?? []),
    ...((record.placementPreference as string[] | undefined) ?? []),
    ...((record.conflictRules as string[] | undefined) ?? [])
  );
  return corpus.reduce((score, term) => score + (queryTerms.has(term) ? 1 : 0), 0);
};

const buildQueryTerms = (input: MotionPlanBuilderInput): Set<string> => {
  return new Set(
    collectTerms(
      input.prompt,
      input.metadata.user_intent.content_type,
      input.metadata.user_intent.tone_target,
      input.metadata.user_intent.pace_target,
      ...((input.metadata.user_intent.editing_style_keywords ?? []) as string[]),
      input.metadata.typography.caption_style_profile,
      input.metadata.motion_graphics.motion_graphics_style_family,
      input.metadata.motion_graphics.motion_mode,
      input.editPlan.motion_plan.style_family,
      input.editPlan.motion_plan.selection_mode,
      input.editPlan.motion_plan.safe_area_rules,
      input.clipSelection.selected_clips.map((clip) => [clip.hook_line, clip.suggested_title, clip.suggested_caption].filter(Boolean).join(" ")).join(" "),
      (input.metadata.enrichment_candidates ?? []).map((candidate) => candidate.entity_text).join(" ")
    )
  );
};

const buildSelectedAssets = (catalogs: Awaited<ReturnType<typeof loadCatalogs>>, queryTerms: Set<string>): Record<string, unknown>[] => {
  const authoringPool = [...catalogs.authoringAssets, ...catalogs.godAssets];
  const effectAssets: Record<string, unknown>[] = [
    {id: EFFECT_IDS.targetFocusZoom, label: "Target Focus Zoom + Dynamic Vignette", kind: "focus-effect", category: "camera-focus", source_kind: "registry-contract", compatible_with: ["composite:core-replaceable-word", "primitive:highlight-word", "primitive:circle-reveal", "primitive:blur-underline"]},
    {id: EFFECT_IDS.coreReplaceableWord, label: "CORE Replaceable Word", kind: "motion-composite", category: "emphasis", source_kind: "registry-contract", compatible_with: ["primitive:highlight-word", "primitive:circle-reveal", "primitive:blur-underline", "primitive:typewriter"]},
    {id: EFFECT_IDS.highlightWord, label: "Highlight Word", kind: "motion-primitive", category: "highlight", source_kind: "registry-contract", compatible_with: ["primitive:blur-underline", "primitive:circle-reveal", "composite:core-replaceable-word"]},
    {id: EFFECT_IDS.circleReveal, label: "Circle Reveal", kind: "motion-primitive", category: "highlight", source_kind: "registry-contract", compatible_with: ["primitive:highlight-word", "primitive:blur-underline", "composite:core-replaceable-word"]},
    {id: EFFECT_IDS.blurUnderline, label: "Blur Underline", kind: "motion-primitive", category: "emphasis", source_kind: "registry-contract", compatible_with: ["primitive:highlight-word", "primitive:circle-reveal", "composite:core-replaceable-word"]}
  ];

  const topPrototype = catalogs.prototypeAssets
    .map((record) => ({record, score: scoreRecord(record, queryTerms)}))
    .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id))[0]?.record;

  const topAuthoring = authoringPool
    .map((record) => ({record, score: scoreRecord(record, queryTerms)}))
    .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id))[0]?.record;

  const extras: Record<string, unknown>[] = [];
  if (topPrototype) {
    extras.push({
      id: topPrototype.id,
      label: String(topPrototype.label ?? topPrototype.id),
      kind: "prototype",
      category: String(topPrototype.category ?? topPrototype.type ?? "prototype"),
      source_kind: "html-prototype",
      source_file: topPrototype.fileName ?? null,
      source_html: topPrototype.relativePath ?? null,
      source_root: topPrototype.sourceRoot ?? null,
      compatible_with: topPrototype.compatibleWith ?? [],
      graph_tags: topPrototype.graphTags ?? [],
      functional_tags: topPrototype.functionalTags ?? [],
      semantic_triggers: topPrototype.semanticTriggers ?? [],
      visual_weight: topPrototype.visualWeight ?? null,
      ideal_duration_ms: topPrototype.idealDurationMs ?? null,
      placement_preference: topPrototype.placementPreference ?? [],
      reuse_frequency_limit: topPrototype.reuseFrequencyLimit ?? null,
      conflict_rules: topPrototype.conflictRules ?? [],
      redundancy_risk_score: topPrototype.redundancyRiskScore ?? null,
      structural_regions: topPrototype.structuralRegions ?? [],
      partial_reveal_supported: topPrototype.partialRevealSupported ?? null,
      replaceable_text_slots: topPrototype.replaceableTextSlots ?? null,
      replaceable_numeric_slots: topPrototype.replaceableNumericSlots ?? null,
      show_mode: topPrototype.showMode ?? null,
      metadata_confidence: topPrototype.metadataConfidence ?? null,
      coverage_status: topPrototype.coverageStatus ?? null,
      aliases: unique([topPrototype.id, String(topPrototype.label ?? ""), ...((topPrototype.aliases as string[] | undefined) ?? [])]),
      layering_rules: topPrototype.layeringRules ?? [],
      notes: topPrototype.notes ?? null
    });
  }
  if (topAuthoring) {
    extras.push({
      id: topAuthoring.id,
      label: String(topAuthoring.canonicalLabel ?? topAuthoring.id),
      kind: String(topAuthoring.assetRole ?? "motion-asset"),
      category: String(topAuthoring.family ?? "motion-asset"),
      source_kind: String(topAuthoring.sourceKind ?? "authoring-batch"),
      source_file: topAuthoring.sourceFile ?? null,
      source_html: topAuthoring.sourceHtml ?? null,
      source_root: null,
      placement_zone: topAuthoring.placementZone ?? null,
      safe_area: topAuthoring.safeArea ?? null,
      duration_policy: topAuthoring.durationPolicy ?? null,
      loopable: topAuthoring.loopable ?? null,
      compatible_with: topAuthoring.compatibleWith ?? [],
      graph_tags: topAuthoring.graphTags ?? [],
      functional_tags: topAuthoring.functionalTags ?? [],
      semantic_triggers: topAuthoring.semanticTriggers ?? [],
      visual_weight: topAuthoring.visualWeight ?? null,
      ideal_duration_ms: topAuthoring.idealDurationMs ?? null,
      placement_preference: topAuthoring.placementPreference ?? [],
      reuse_frequency_limit: topAuthoring.reuseFrequencyLimit ?? null,
      conflict_rules: topAuthoring.conflictRules ?? [],
      redundancy_risk_score: topAuthoring.redundancyRiskScore ?? null,
      structural_regions: topAuthoring.structuralRegions ?? [],
      partial_reveal_supported: topAuthoring.partialRevealSupported ?? null,
      replaceable_text_slots: topAuthoring.replaceableTextSlots ?? null,
      replaceable_numeric_slots: topAuthoring.replaceableNumericSlots ?? null,
      show_mode: topAuthoring.showMode ?? null,
      metadata_confidence: topAuthoring.metadataConfidence ?? null,
      coverage_status: topAuthoring.coverageStatus ?? null,
      aliases: unique([topAuthoring.id, String(topAuthoring.canonicalLabel ?? ""), ...((topAuthoring.aliases as string[] | undefined) ?? [])]),
      layering_rules: topAuthoring.layeringRules ?? [],
      notes: null
    });
  }

  return [...effectAssets, ...extras];
};

const buildTimelineEvents = (input: MotionPlanBuilderInput): Record<string, unknown>[] => {
  const words = input.transcriptWords.length > 0 ? input.transcriptWords : input.metadata.transcript_words;
  if (words.length === 0) {
    return [];
  }
  const durationMs = Math.max(1000, input.videoMetadata.durationSeconds * 1000 || words.at(-1)?.end_ms || 1000);
  const intensity = resolveIntensity(input);
  const hookWord = words[0];
  const middleWord = words[Math.floor(words.length / 2)] ?? hookWord;
  const ctaWord = [...words].reverse().find((word) => ["subscribe", "follow", "watch", "join", "click", "go", "try"].includes(normalizeText(word.text))) ?? words.at(-1) ?? hookWord;

  const makeEvent = (
    id: string,
    kind: string,
    word: TranscribedWord,
    assetId: string,
    assetLabel: string,
    placementZone: string,
    layerChannel: string,
    targetType: string,
    pairedEffectIds: string[],
    animationParameters: Record<string, unknown>,
    reason: string[]
  ): Record<string, unknown> => ({
    id,
    kind,
    asset_id: assetId,
    asset_label: assetLabel,
    target_ref: {
      type: targetType,
      value: word.text,
      registry_ref: targetType === "headline" ? "focus-effect:target-focus-zoom" : `primitive:${assetId}`,
      selector: `.word-${word.start_ms}`
    },
    source_chunk_id: null,
    source_chunk_text: word.text,
    start_ms: Math.max(0, Math.round(word.start_ms - (kind === "focus" ? 350 : 200))),
    peak_start_ms: Math.max(0, Math.round(word.start_ms)),
    peak_end_ms: Math.min(durationMs, Math.round(word.end_ms + 400)),
    end_ms: Math.min(durationMs, Math.round(word.end_ms + (kind === "focus" ? 800 : 600))),
    trigger_type: kind === "focus" ? "timeline" : "word-level",
    placement_zone: placementZone,
    placement_hint: kind,
    layer_channel: layerChannel,
    z_index: kind === "focus" ? 120 : kind === "transition" ? 60 : 90,
    order: 0,
    entry_style: kind === "focus" ? "focus-zoom-in" : kind === "transition" ? "wipe-in" : "syllabic-break-in",
    hold_style: kind === "focus" ? "vignette-hold" : kind === "transition" ? "bridge-hold" : "word-hold",
    exit_style: kind === "focus" ? "focus-return" : kind === "transition" ? "wipe-out" : "fade-out",
    easing: kind === "focus" ? "sine.out" : "ease-out",
    loop: kind === "focus",
    intensity,
    micro_motion: reason[0] ?? null,
    confidence: 0.82,
    reason,
    compatible_with: pairedEffectIds,
    paired_effect_ids: pairedEffectIds,
    animation_parameters: animationParameters
  });

  return [
    makeEvent(
      "focus-0",
      "focus",
      hookWord,
      EFFECT_IDS.targetFocusZoom,
      "Target Focus Zoom + Dynamic Vignette",
      "center",
      "host",
      "headline",
      [EFFECT_IDS.coreReplaceableWord, EFFECT_IDS.highlightWord, EFFECT_IDS.circleReveal, EFFECT_IDS.blurUnderline],
      {zoom_scale: 1.12, vignette_opacity: 0.84, vignette_softness: 0.72, vignette_radius: 0.22, easing: "sine.out", return_loop: true},
      ["hook-moment", "headline-focus", "loop-back-to-rest-scale"]
    ),
    makeEvent(
      "emphasis-1",
      "emphasis",
      middleWord,
      EFFECT_IDS.coreReplaceableWord,
      "CORE Replaceable Word",
      "upper-third",
      "accent",
      "keyword",
      [EFFECT_IDS.highlightWord, EFFECT_IDS.circleReveal, EFFECT_IDS.blurUnderline],
      {highlight_scale: 1.08, underline_strength: 0.86, circle_strength: 0.84, easing: "ease-out"},
      ["word-emphasis", "syllabic-break", "word-showcase"]
    ),
    makeEvent(
      "transition-2",
      "transition",
      ctaWord,
      EFFECT_IDS.blurReveal,
      "Blur Reveal",
      "full-frame",
      "overlay",
      "selector",
      [EFFECT_IDS.blurReveal, EFFECT_IDS.typewriter],
      {reveal_bias: 0.6, exit_bias: 0.52, easing: "ease-in-out"},
      ["cta-moment", "bridge-transition"]
    )
  ].map((event, index) => ({...event, order: index, confidence: index === 0 ? 0.94 : index === 1 ? 0.84 : 0.8}));
};

export const buildMotionPlanArtifact = async (input: MotionPlanBuilderInput): Promise<MotionPlanArtifact> => {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const catalogs = await loadCatalogs();
  const patternMemorySnapshot = await readPatternMemorySnapshot();
  const patternMemorySummary = buildPatternMemorySummary(patternMemorySnapshot);
  const patternMemorySignalTerms = buildPatternMemorySignalTerms(patternMemorySnapshot);
  const transcriptDurationSeconds = (input.transcriptWords.at(-1)?.end_ms ?? 1000) / 1000;
  const queryTerms = new Set(collectTerms(
    input.prompt,
    input.metadata.user_intent.content_type,
    input.metadata.user_intent.tone_target,
    input.metadata.user_intent.pace_target,
    ...((input.metadata.user_intent.editing_style_keywords ?? []) as string[]),
    input.metadata.typography.caption_style_profile,
    input.metadata.motion_graphics.motion_graphics_style_family,
    input.metadata.motion_graphics.motion_mode,
    input.editPlan.motion_plan.style_family,
    input.editPlan.motion_plan.selection_mode,
    input.editPlan.motion_plan.safe_area_rules,
    patternMemorySignalTerms
  ));

  const selectedAssets = buildSelectedAssets(catalogs, queryTerms);
  const timelineEvents = buildTimelineEvents(input);
  const intensity = resolveIntensity(input);
  const policy = buildPolicy(input);

  return motionPlanArtifactSchema.parse({
    job_id: input.jobId,
    plan_version: "2026-04-15-backend-motion-plan-v1",
    generated_at: generatedAt,
    pattern_memory_fingerprint: patternMemorySummary.fingerprint,
    pattern_memory_summary: patternMemorySummary,
    pattern_memory_signal_terms: patternMemorySignalTerms,
    source_summary: {
      duration_seconds: round(input.videoMetadata.durationSeconds > 0 ? input.videoMetadata.durationSeconds : transcriptDurationSeconds, 2),
      word_count: input.transcriptWords.length,
      transcript_available: input.transcriptWords.length > 0,
      presentation_mode: input.videoMetadata.width >= input.videoMetadata.height ? "long-form" : "reel",
      motion_mode: policy.motion_mode,
      motion_intensity: intensity,
      intensity_score: intensity === "high" ? 84 : intensity === "medium" ? 63 : intensity === "minimal" ? 21 : 48,
      emphasis_score: 0.84,
      emotion_score: 0.66,
      selected_asset_count: selectedAssets.length,
      timeline_event_count: timelineEvents.length
    },
    policy,
    catalog_summary: {
      authoring_source: AUTHORING_CATALOG_PATH,
      prototype_source: PROTOTYPE_CATALOG_PATH,
      authoring_asset_count: catalogs.authoringAssets.length,
      god_asset_count: catalogs.godAssets.length,
      prototype_count: catalogs.prototypeAssets.length,
      combined_count: catalogs.authoringAssets.length + catalogs.godAssets.length + catalogs.prototypeAssets.length,
      focus_effect_count: 1,
      emphasis_effect_count: 4
    },
    selected_assets: selectedAssets,
    asset_assignments: timelineEvents.map((event) => ({
      asset_id: String(event.asset_id),
      kind: String(event.kind),
      label: String(event.asset_label),
      source_event_ids: [String(event.id)],
      placement_zone: event.placement_zone,
      layer_channel: event.layer_channel,
      z_index: event.z_index,
      duration_policy: event.kind === "focus" ? "focus-window" : event.kind === "transition" ? "transition-window" : "scene-span",
      safe_area: event.kind === "focus" ? "avoid-caption-region" : event.kind === "emphasis" ? "caption-edge-safe" : null,
      loopable: Boolean(event.loop),
      trigger_type: event.trigger_type,
      compatible_with: event.compatible_with,
      entry_style: event.entry_style,
      exit_style: event.exit_style,
      intensity,
      confidence: event.confidence,
      reason: Array.isArray(event.reason) ? event.reason.join(" | ") : String(event.reason ?? ""),
      animation_parameters: event.animation_parameters
    })),
    timeline_events: timelineEvents,
    paired_effects: [
      {
        primary_effect_id: EFFECT_IDS.coreReplaceableWord,
        partner_effect_ids: [EFFECT_IDS.highlightWord, EFFECT_IDS.circleReveal, EFFECT_IDS.blurUnderline, EFFECT_IDS.targetFocusZoom],
        trigger_types: ["word-level", "syllable-level"],
        rationale: "CORE replaceable word chains the highlight, circle, underline, and focus stack."
      },
      {
        primary_effect_id: EFFECT_IDS.targetFocusZoom,
        partner_effect_ids: [EFFECT_IDS.coreReplaceableWord, EFFECT_IDS.highlightWord, EFFECT_IDS.blurReveal],
        trigger_types: ["timeline", "word-level"],
        rationale: "Target focus zoom pairs with highlight and reveal logic for headline and category beats."
      }
    ],
    validation: {
      warnings: [
        ...(catalogs.authoringAssets.length === 0 ? ["The authoring motion asset catalog was empty or unavailable."] : []),
        ...(catalogs.prototypeAssets.length === 0 ? ["The prototype motion catalog was empty or unavailable."] : [])
      ],
      errors: selectedAssets.length === 0 ? ["No motion assets were selected from the catalog or registry."] : [],
      rejected_assets: []
    },
    notes: unique([
      "Backend motion plan generated from transcript timing, edit-plan controls, and motion asset catalogs.",
      `Motion mode resolved to ${policy.motion_mode}.`,
      `Selected ${selectedAssets.length} motion assets and ${timelineEvents.length} motion events.`,
      `GOD catalog source: ${GOD_CATALOG_PATH}`,
      `Pattern memory fingerprint: ${patternMemorySummary.fingerprint}`,
      `Pattern memory active entries: ${patternMemorySummary.active_entries}`,
      `Prototype catalog source: ${PROTOTYPE_CATALOG_PATH}`,
      `Authoring catalog source: ${AUTHORING_CATALOG_PATH}`
    ])
  });
};
