import {longformCaptionSafeZone, upperSafeZone, type CaptionSafeZone} from "../caption-layout";
import type {
  CaptionChunk,
  GradeProfile,
  MatteManifest,
  MotionAssetManifest,
  MotionAssetFamily,
  MotionCameraCue,
  MotionCaptionMode,
  MotionChoreographyPlan,
  MotionChoreographyPresetId,
  Motion3DMode,
  Motion3DPlan,
  MotionGradeProfileId,
  MotionIntensity,
  MotionMatteMode,
  MotionMoodTag,
  MotionPrimitiveId,
  MotionSceneSpec,
  MotionSceneKind,
  MotionTimelineInstruction,
  MotionTier,
  CaptionStyleProfileId,
  CaptionVerticalBias,
  VideoMetadata,
  TransitionPreset,
  TransitionOverlayMode,
  MotionCompositionCombatPlan,
  ReferenceMotionTrace
} from "../types";
import {getMotionAssetCatalog} from "./asset-catalog";
import {resolveMotionAssets} from "./asset-manifests";
import {getDefaultGradeProfileIdForTier, resolveGradeProfile} from "./grade-profiles";
import {resolveMatteManifest, shouldUseMatte} from "./matte-manifests";
import {resolveMotionPlan, type MotionPlan} from "./motion-determinator";
import {buildMotionShowcasePlan} from "./showcase-motion-planner";
import type {MotionShowcaseIntelligencePlan} from "./showcase-intelligence";
import {
  getTargetCameraCueCount,
  selectSemanticCameraCueMap
} from "./semantic-camera-trigger-engine";
import {pickTransitionPresetId, resolveTransitionPreset} from "./transition-presets";
import {buildMotionBackgroundOverlayPlan} from "./background-overlay-planner";
import {buildMotionCompositionCombatPlan} from "./composition-combat-planner";
import type {TransitionOverlayRules} from "./transition-overlay-config";
import {buildTransitionOverlayPlan} from "./transition-overlay-planner";
import {buildMotionSoundDesignPlan} from "./sound-design-brain";
import {
  buildZoomEnvelope,
  buildZoomTimingFamilyOrder
} from "./zoom-timing";
import {resolveMotion3DConfig, type Motion3DConfig} from "../motion-3d/motion-3d-config";
import {buildMotion3DPlan} from "../motion-3d/motion-3d-planner";
import {buildMotionChoreographyPlan} from "./choreography-planner";
import {applyPatternMemoryGovernance} from "./pattern-memory/pattern-memory-hooks";
import {isLongformCaptionStyleProfile} from "../stylebooks/caption-style-profiles";
import {buildMotionGraphicsPlan} from "../motion-graphics-agent/planner";
import type {MotionGraphicsPlan} from "../motion-graphics-agent/types";

export type ResolvedMotionScene = MotionSceneSpec & {
  assets: MotionAssetManifest[];
  transitionInPreset: TransitionPreset;
  transitionOutPreset: TransitionPreset;
  transitionBudgetFrames: number;
  sceneKind?: MotionSceneKind;
  choreographyPresetId?: MotionChoreographyPresetId;
  focusTargetId?: string;
  timelineInstructions?: MotionTimelineInstruction[];
  previewStageInstructions?: MotionTimelineInstruction[];
  primitiveIds?: MotionPrimitiveId[];
  headlineText?: string;
  subtextText?: string;
};

export type MotionCompositionModel = {
  chunks: CaptionChunk[];
  tier: MotionTier;
  captionBias: CaptionVerticalBias;
  gradeProfile: GradeProfile;
  scenes: ResolvedMotionScene[];
  cameraCues: MotionCameraCue[];
  matteManifest: MatteManifest | null;
  matteEnabled: boolean;
  transitionPresetId: string;
  captionSafeZone: CaptionSafeZone;
  captionMode: MotionCaptionMode;
  motionPlan: MotionPlan;
  compositionCombatPlan: MotionCompositionCombatPlan;
  showcasePlan: ReturnType<typeof buildMotionShowcasePlan>;
  showcaseIntelligencePlan: MotionShowcaseIntelligencePlan;
  backgroundOverlayPlan: ReturnType<typeof buildMotionBackgroundOverlayPlan>;
  transitionOverlayPlan: ReturnType<typeof buildTransitionOverlayPlan>;
  choreographyPlan: MotionChoreographyPlan;
  motionGraphicsPlan: MotionGraphicsPlan;
  motion3DPlan: Motion3DPlan;
  motion3DConfig: Motion3DConfig;
  soundDesignPlan: ReturnType<typeof buildMotionSoundDesignPlan>;
  referenceMotionTrace?: ReferenceMotionTrace | null;
  patternMemory?: {
    fingerprint: string;
    summary: Record<string, unknown>;
    matches: Array<Record<string, unknown>>;
  };
};

const ZOOM_CUE_MIN_GAP_MS = 9000;
const OUTRO_CAMERA_WINDOW_MS = 28000;
const CAMERA_CUE_MINUTES_CAP = 2;
const MAX_SCENE_TRANSITION_LEAD_MS = 1000;

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const findLastSceneStartingBeforeOrAt = (scenes: ResolvedMotionScene[], targetTimeMs: number): number => {
  let low = 0;
  let high = scenes.length - 1;
  let bestIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (scenes[middle].startMs <= targetTimeMs) {
      bestIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return bestIndex;
};

const uniqueTags = (tags: MotionMoodTag[]): MotionMoodTag[] => {
  return [...new Set(tags)];
};

export const inferSceneMoodTags = ({
  chunk,
  tier,
  gradeProfileId
}: {
  chunk: CaptionChunk;
  tier: MotionTier;
  gradeProfileId: MotionGradeProfileId;
}): MotionMoodTag[] => {
  const tags: MotionMoodTag[] = ["neutral"];
  if (gradeProfileId === "warm-cinematic") {
    tags.push("warm");
  }
  if (gradeProfileId === "cool-editorial") {
    tags.push("cool");
  }
  if (gradeProfileId === "premium-contrast") {
    tags.push("authority");
  }
  if (tier === "minimal") {
    tags.push("calm");
  }
  if (tier === "editorial") {
    tags.push("cool", "kinetic");
  }
  if (tier === "premium") {
    tags.push("warm", "authority");
  }
  if (tier === "hero") {
    tags.push("heroic", "authority");
  }
  if (chunk.semantic?.intent === "name-callout") {
    tags.push("authority");
  }
  if (chunk.semantic?.intent === "punch-emphasis") {
    tags.push("kinetic");
  }
  return uniqueTags(tags);
};

export const getTransitionBudgetFrames = ({
  chunk,
  fps,
  preset
}: {
  chunk: CaptionChunk;
  fps: number;
  preset: TransitionPreset;
}): number => {
  const durationFrames = Math.max(1, Math.round(((chunk.endMs - chunk.startMs) / 1000) * fps));
  const rawBudget = Math.min(preset.durationFrames, Math.max(6, Math.round(durationFrames * 0.24)));
  return preset.captionCompatibility.protectSafeZone ? rawBudget : Math.min(rawBudget + 2, preset.durationFrames);
};

const getCameraCueScore = ({
  chunk,
  contextDurationMs
}: {
  chunk: CaptionChunk;
  contextDurationMs: number;
}): number => {
  const durationSec = Math.max(0.01, (chunk.endMs - chunk.startMs) / 1000);
  const contextDurationSec = contextDurationMs / 1000;
  const textLength = chunk.text.replace(/[^a-zA-Z0-9]/g, "").length;
  let score = 0;

  if (chunk.semantic?.intent === "punch-emphasis") {
    score += 90;
  }
  if (chunk.semantic?.isVariation) {
    score += 12;
  }
  if ((chunk.emphasisWordIndices?.length ?? 0) > 0) {
    score += Math.min(18, (chunk.emphasisWordIndices?.length ?? 0) * 6);
  }
  if (/[!?]$/.test(chunk.text)) {
    score += 10;
  }
  if (chunk.words.length >= 2) {
    score += 10;
  } else {
    score -= 12;
  }
  if (durationSec >= 0.8 && durationSec <= 1.2) {
    score += 10;
  } else if (durationSec >= 0.55 && durationSec <= 1.45) {
    score += 6;
  }
  if (textLength >= 10) {
    score += Math.min(12, Math.round(textLength * 0.55));
  }
  if (contextDurationSec >= 1.6 && contextDurationSec <= 2.7) {
    score += 18;
  } else if (contextDurationSec >= 1.3 && contextDurationSec <= 3.1) {
    score += 10;
  }

  return score;
};

const buildFallbackCameraCueForChunk = (
  chunk: CaptionChunk,
  previousFamily?: MotionCameraCue["timingFamily"],
  options?: {
    preferExtendedTiming?: boolean;
    reason?: string;
  }
): MotionCameraCue => {
  const seed = `${chunk.id}|${chunk.text}|fallback-emphasis`;
  const preferredFamilies = options?.preferExtendedTiming
    ? ["bobby", "linger", "glide", "assertive", "reveal"] as const
    : chunk.semantic?.intent === "punch-emphasis"
    ? ["assertive", "bobby", "glide", "linger"] as const
    : chunk.semantic?.intent === "name-callout"
      ? ["bobby", "reveal", "glide", "linger"] as const
      : ["bobby", "glide", "linger", "assertive", "reveal"] as const;
  const timingFamily = options?.preferExtendedTiming
    ? (previousFamily === "bobby" ? "linger" : "bobby")
    : buildZoomTimingFamilyOrder({
      seed,
      preferredFamilies: [...preferredFamilies],
      previousFamily
    })[0];
  const emphasisBoost = (chunk.emphasisWordIndices?.length ?? 0) > 1 ? 0.01 : 0;
  const textBoost = chunk.text.replace(/[^a-zA-Z0-9]/g, "").length >= 14 ? 0.01 : 0.005;
  const variationBoost = chunk.semantic?.isVariation ? 0.01 : 0;
  const envelope = buildZoomEnvelope({
    family: timingFamily,
    seed,
    contentDurationMs: chunk.endMs - chunk.startMs,
    contentStartMs: chunk.startMs,
    scaleBoost: emphasisBoost + textBoost + variationBoost
  });

  return {
    id: `camera-${chunk.id}`,
    mode: "punch-in-out",
    timingFamily,
    ...envelope,
    panX: 0,
    panY: 0,
    reason: options?.reason ?? "fallback emphasis cue",
    triggerText: chunk.text,
    triggerPatternIds: [options?.preferExtendedTiming ? "fallback-outro-cadence" : "fallback-emphasis"]
  };
};

type RankedFallbackCameraCueChunk = {
  chunk: CaptionChunk;
  score: number;
  minuteBucket: number;
};

const buildRankedFallbackCameraCueChunks = (chunks: CaptionChunk[]): RankedFallbackCameraCueChunk[] => {
  return chunks
    .map((chunk) => ({
      chunk,
      score: getCameraCueScore({chunk, contextDurationMs: chunk.endMs - chunk.startMs}),
      minuteBucket: Math.floor(chunk.startMs / 60000)
    }))
    .filter((entry) => entry.chunk.words.length > 0)
    .sort((a, b) => b.score - a.score || a.chunk.startMs - b.chunk.startMs);
};

const selectFallbackCameraCueChunkIds = ({
  chunks,
  existingCues,
  remainingSlots
}: {
  chunks: CaptionChunk[];
  existingCues: MotionCameraCue[];
  remainingSlots: number;
}): Set<string> => {
  const ranked = buildRankedFallbackCameraCueChunks(chunks);
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const selected = new Set<string>();
  const minuteCounts = new Map<number, number>();
  const scorePasses: Array<(entry: RankedFallbackCameraCueChunk) => boolean> = [
    (entry) => {
      if (entry.chunk.semantic?.intent !== "default") {
        return entry.score >= 74;
      }
      if ((entry.chunk.emphasisWordIndices?.length ?? 0) > 0 || /[!?]$/.test(entry.chunk.text)) {
        return entry.score >= 82;
      }
      return entry.score >= 92;
    },
    (entry) => {
      if (entry.chunk.semantic?.intent !== "default") {
        return entry.score >= 68;
      }
      if ((entry.chunk.emphasisWordIndices?.length ?? 0) > 0 || /[!?]$/.test(entry.chunk.text)) {
        return entry.score >= 74;
      }
      return entry.score >= 84;
    },
    (entry) => entry.score >= 58
  ];

  const trySelect = (entry: RankedFallbackCameraCueChunk, ignoreMinuteCap = false): boolean => {
    if (selected.size >= remainingSlots || selected.has(entry.chunk.id)) {
      return false;
    }

    if (!ignoreMinuteCap && (minuteCounts.get(entry.minuteBucket) ?? 0) >= CAMERA_CUE_MINUTES_CAP) {
      return false;
    }

    const tooClose = [...selected].some((id) => {
      const existing = chunkById.get(id);
      return existing ? Math.abs(existing.startMs - entry.chunk.startMs) < ZOOM_CUE_MIN_GAP_MS : false;
    });
    const tooCloseToSemanticCue = existingCues.some((cue) => {
      return Math.abs(cue.startMs - Math.max(0, entry.chunk.startMs - 180)) < ZOOM_CUE_MIN_GAP_MS;
    });

    if (tooClose || tooCloseToSemanticCue) {
      return false;
    }

    selected.add(entry.chunk.id);
    minuteCounts.set(entry.minuteBucket, (minuteCounts.get(entry.minuteBucket) ?? 0) + 1);
    return true;
  };

  for (const pass of scorePasses) {
    for (const entry of ranked) {
      if (selected.size >= remainingSlots) {
        break;
      }
      if (!pass(entry)) {
        continue;
      }
      trySelect(entry);
    }
    if (selected.size >= remainingSlots) {
      break;
    }
  }

  if (selected.size < remainingSlots) {
    for (const entry of ranked) {
      if (selected.size >= remainingSlots) {
        break;
      }
      trySelect(entry);
    }
  }

  if (selected.size < remainingSlots) {
    for (const entry of ranked) {
      if (selected.size >= remainingSlots) {
        break;
      }
      trySelect(entry, true);
    }
  }

  return selected;
};

const ensureOutroFallbackCameraCueChunkId = ({
  chunks,
  existingCues,
  reservedChunkIds
}: {
  chunks: CaptionChunk[];
  existingCues: MotionCameraCue[];
  reservedChunkIds: Set<string>;
}): string | null => {
  if (chunks.length === 0) {
    return null;
  }

  const videoEndMs = chunks[chunks.length - 1].endMs;
  const outroWindowStartMs = Math.max(0, videoEndMs - OUTRO_CAMERA_WINDOW_MS);
  const hasOutroCue = existingCues.some((cue) => cue.startMs >= outroWindowStartMs);
  if (hasOutroCue) {
    return null;
  }

  const candidates = buildRankedFallbackCameraCueChunks(chunks)
    .filter((entry) => entry.chunk.startMs >= outroWindowStartMs)
    .filter((entry) => entry.score >= 56)
    .sort((a, b) => b.score - a.score || b.chunk.startMs - a.chunk.startMs);

  for (const candidate of candidates) {
    if (reservedChunkIds.has(candidate.chunk.id)) {
      continue;
    }
    const tooClose = existingCues.some((cue) => Math.abs(cue.startMs - candidate.chunk.startMs) < ZOOM_CUE_MIN_GAP_MS);
    if (!tooClose) {
      return candidate.chunk.id;
    }
  }

  return null;
};

export const buildMotionSceneSpecs = ({
  chunks,
  tier,
  fps,
  gradeProfileId,
  transitionPresetId,
  matteId,
  assetLibrary,
  suppressAmbientAssets = false,
  ambientAssetFamilies
}: {
  chunks: CaptionChunk[]; 
  tier: MotionTier;
  fps: number;
  gradeProfileId?: MotionGradeProfileId;
  transitionPresetId?: string;
  matteId?: string;
  assetLibrary?: MotionAssetManifest[];
  suppressAmbientAssets?: boolean;
  ambientAssetFamilies?: MotionAssetFamily[];
}): ResolvedMotionScene[] => {
  const sceneGradeProfileId = gradeProfileId ?? getDefaultGradeProfileIdForTier(tier);
  const semanticCameraCueMap = selectSemanticCameraCueMap(chunks);
  const targetCameraCueCount = getTargetCameraCueCount(chunks);
  const fallbackCameraCueChunkIds = semanticCameraCueMap.size < targetCameraCueCount
    ? selectFallbackCameraCueChunkIds({
      chunks,
      existingCues: [...semanticCameraCueMap.values()],
      remainingSlots: targetCameraCueCount - semanticCameraCueMap.size
    })
    : new Set<string>();
  const reservedFallbackChunkIds = new Set([
    ...semanticCameraCueMap.keys(),
    ...fallbackCameraCueChunkIds
  ]);
  const outroFallbackCameraCueChunkId = ensureOutroFallbackCameraCueChunkId({
    chunks,
    existingCues: [
      ...semanticCameraCueMap.values(),
      ...chunks
        .filter((chunk) => fallbackCameraCueChunkIds.has(chunk.id))
        .map((chunk) => ({
          startMs: chunk.startMs
        } as MotionCameraCue))
    ],
    reservedChunkIds: reservedFallbackChunkIds
  });
  if (outroFallbackCameraCueChunkId) {
    fallbackCameraCueChunkIds.add(outroFallbackCameraCueChunkId);
  }
  const fallbackCameraCueMap = new Map<string, MotionCameraCue>();
  let previousFallbackFamily = [...semanticCameraCueMap.values()]
    .sort((a, b) => a.startMs - b.startMs)
    .at(-1)?.timingFamily;
  chunks
    .filter((chunk) => fallbackCameraCueChunkIds.has(chunk.id))
    .sort((a, b) => a.startMs - b.startMs)
    .forEach((chunk) => {
      const cue = buildFallbackCameraCueForChunk(chunk, previousFallbackFamily, {
        preferExtendedTiming: chunk.id === outroFallbackCameraCueChunkId,
        reason: chunk.id === outroFallbackCameraCueChunkId
          ? "fallback outro cadence cue"
          : undefined
      });
      fallbackCameraCueMap.set(chunk.id, cue);
      previousFallbackFamily = cue.timingFamily;
    });

  return chunks.map((chunk, index) => {
    const moodTags = inferSceneMoodTags({chunk, tier, gradeProfileId: sceneGradeProfileId});
    const transitionInId = pickTransitionPresetId({
      tier,
      seed: `${chunk.id}|${index}|in|${hashString(chunk.text)}`,
      preferredPresetId: transitionPresetId
    });
    const transitionOutId = pickTransitionPresetId({
      tier,
      seed: `${chunk.id}|${index}|out|${hashString(chunk.text)}`
    });
    const transitionInPreset = resolveTransitionPreset(transitionInId);
    const transitionOutPreset = resolveTransitionPreset(transitionOutId);
    const assets = suppressAmbientAssets
      ? []
      : resolveMotionAssets({
        tier,
        moodTags,
        safeArea: "avoid-caption-region",
        families: ambientAssetFamilies,
        queryText: chunk.text,
        library: assetLibrary ?? getMotionAssetCatalog()
      });
    const baseScene: MotionSceneSpec = {
      id: `motion-${chunk.id}`,
      startMs: chunk.startMs,
      endMs: chunk.endMs,
      tier,
      assetIds: assets.map((manifest) => manifest.id),
      transitionIn: transitionInPreset.id,
      transitionOut: transitionOutPreset.id,
      gradeProfile: sceneGradeProfileId,
      captionMode: "existing-profile",
      matteId: tier === "hero" ? matteId ?? "female-coach-rvm" : undefined,
      moodTags,
      safeArea: "avoid-caption-region",
      sourceChunkId: chunk.id,
      cameraCue: semanticCameraCueMap.get(chunk.id) ?? (
        fallbackCameraCueMap.has(chunk.id)
          ? fallbackCameraCueMap.get(chunk.id)
          : undefined
      )
    };

    return {
      ...baseScene,
      assets,
      transitionInPreset,
      transitionOutPreset,
      transitionBudgetFrames: getTransitionBudgetFrames({chunk, fps, preset: transitionInPreset})
    };
  });
};

export const buildMotionCompositionModel = ({
  chunks,
  tier = "auto",
  fps,
  videoMetadata,
  captionProfileId,
  gradeProfileId,
  transitionPresetId = "auto",
  matteMode = "auto",
  matteId,
  captionBias = "auto",
  showcaseCatalog,
  suppressAmbientAssets = false,
  ambientAssetFamilies,
  transitionOverlayMode = "off",
  transitionOverlayConfig,
  motion3DMode = "off",
  motion3DConfig,
  referenceMotionTrace = null
}: {
  chunks: CaptionChunk[];
  tier?: MotionTier | "auto";
  fps: number;
  videoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  captionProfileId?: CaptionStyleProfileId;
  gradeProfileId?: MotionGradeProfileId | "auto";
  transitionPresetId?: string;
  matteMode?: MotionMatteMode | "auto";
  matteId?: string;
  captionBias?: CaptionVerticalBias | "auto";
  showcaseCatalog?: MotionAssetManifest[];
  suppressAmbientAssets?: boolean;
  ambientAssetFamilies?: MotionAssetFamily[];
  transitionOverlayMode?: TransitionOverlayMode;
  transitionOverlayConfig?: Partial<TransitionOverlayRules>;
  motion3DMode?: Motion3DMode;
  motion3DConfig?: Partial<Motion3DConfig>;
  referenceMotionTrace?: ReferenceMotionTrace | null;
}): MotionCompositionModel => {
  const resolvedVideoMetadata: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> =
    videoMetadata ?? {
      width: 1080,
      height: 1920,
      fps,
      durationSeconds: Math.max(1, chunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0) / 1000),
      durationInFrames: Math.max(1, Math.round(Math.max(1, chunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0) / 1000) * fps))
    };
  const resolveEmptyBackgroundOverlayPlan = (): ReturnType<typeof buildMotionBackgroundOverlayPlan> => ({
    enabled: false,
    aspectRatio: resolvedVideoMetadata.width > 0 && resolvedVideoMetadata.height > 0
      ? Number((resolvedVideoMetadata.width / resolvedVideoMetadata.height).toFixed(3))
      : 9 / 16,
    layoutMode: "disabled",
    targetCueCount: 0,
    minGapMs: 0,
    cues: [],
    selectedAssets: [],
    reasons: ["Disabled by motion graphics planner to prevent center-beam overlay artifacts."]
  });
  const assetCatalog = getMotionAssetCatalog();
  const motionPlan = resolveMotionPlan({
    chunks,
    videoMetadata: resolvedVideoMetadata,
    captionProfileId,
    overrides: {
      motionIntensity: tier,
      captionBias,
      gradeProfileId,
      transitionPresetId,
      matteMode,
      assetFamilies: suppressAmbientAssets ? [] : ambientAssetFamilies ?? undefined
    },
    assetLibrary: assetCatalog
  });
  const showcasePlan = buildMotionShowcasePlan({
    chunks,
    tier: motionPlan.motionIntensity,
    videoMetadata: resolvedVideoMetadata,
    captionBias: motionPlan.captionBias,
    captionProfileId,
    catalog: showcaseCatalog
  });
  const resolvedMotion3DConfig = resolveMotion3DConfig({
    enabled: motion3DMode !== "off",
    mode: motion3DMode,
    ...motion3DConfig
  });
  const transitionOverlayPlan = buildTransitionOverlayPlan({
    chunks,
    tier: motionPlan.motionIntensity,
    videoMetadata: resolvedVideoMetadata,
    mode: transitionOverlayMode,
    rulesOverrides: transitionOverlayConfig
  });
  const resolvedTier = motionPlan.motionIntensity;
  const resolvedGradeProfileId = motionPlan.gradeProfileId ?? getDefaultGradeProfileIdForTier(resolvedTier);
  const resolvedGradeProfile = resolveGradeProfile(resolvedGradeProfileId);
  const rawScenes = buildMotionSceneSpecs({
    chunks,
    tier: resolvedTier,
    fps,
    gradeProfileId: resolvedGradeProfileId,
    transitionPresetId: motionPlan.transitionPresetId,
    matteId,
    assetLibrary: assetCatalog,
    suppressAmbientAssets,
    ambientAssetFamilies
  });
  const choreographyPlan = buildMotionChoreographyPlan({
    chunks,
    scenes: rawScenes,
    videoMetadata: resolvedVideoMetadata
  });
  const scenes = rawScenes.map((scene) => {
    const choreographyScene = choreographyPlan.sceneMap[scene.id];
    if (!choreographyScene) {
      return scene;
    }
    return {
      ...scene,
      sceneKind: choreographyScene.sceneKind,
      choreographyPresetId: choreographyScene.choreographyPresetId,
      focusTargetId: choreographyScene.focusTargetId,
      timelineInstructions: choreographyScene.timelineInstructions,
      previewStageInstructions: choreographyScene.previewStageInstructions,
      primitiveIds: choreographyScene.primitiveIds,
      headlineText: choreographyScene.headlineText,
      subtextText: choreographyScene.subtextText
    };
  });
  const motionGraphicsPlan = buildMotionGraphicsPlan({
    chunks,
    scenes: scenes.map((scene) => ({
      id: scene.id,
      startMs: scene.startMs,
      endMs: scene.endMs,
      sourceChunkId: scene.sourceChunkId,
      sceneKind: scene.sceneKind,
      headlineText: scene.headlineText,
      subtextText: scene.subtextText
    })),
    tier: resolvedTier,
    fps,
    videoMetadata: resolvedVideoMetadata
  });
  const backgroundOverlayPlan = motionGraphicsPlan.disableLegacyBackgroundOverlay
    ? resolveEmptyBackgroundOverlayPlan()
    : buildMotionBackgroundOverlayPlan({
      chunks,
      tier: motionPlan.motionIntensity,
      videoMetadata: resolvedVideoMetadata
    });
  const compositionCombatPlan = buildMotionCompositionCombatPlan({
    chunks,
    tier: resolvedTier,
    gradeProfile: resolvedGradeProfile,
    captionProfileId,
    backgroundOverlayPlan,
    showcasePlan,
    transitionOverlayPlan,
    motionAssets: motionPlan.selectedAssets
  });
  const governedCoreModel = applyPatternMemoryGovernance({
    chunks,
    tier: resolvedTier,
    captionBias: motionPlan.captionBias,
    gradeProfile: resolvedGradeProfile,
    scenes,
    cameraCues: scenes
    .map((scene) => scene.cameraCue)
    .filter((cue): cue is MotionCameraCue => Boolean(cue)),
    matteManifest: resolveMatteManifest(matteId ?? scenes[0]?.matteId),
    matteEnabled: shouldUseMatte({mode: motionPlan.matteMode, tier: resolvedTier, manifest: resolveMatteManifest(matteId ?? scenes[0]?.matteId)}),
    transitionPresetId: scenes[0]?.transitionIn ?? motionPlan.transitionPresetId ?? "auto",
    captionSafeZone: isLongformCaptionStyleProfile(captionProfileId) ? longformCaptionSafeZone : upperSafeZone,
    captionMode: "existing-profile",
    motionPlan: {
      ...motionPlan,
      gradeProfileId: resolvedGradeProfileId
    },
    compositionCombatPlan,
    showcasePlan,
    showcaseIntelligencePlan: showcasePlan.intelligencePlan,
    backgroundOverlayPlan,
    transitionOverlayPlan,
    choreographyPlan,
    motionGraphicsPlan,
    motion3DConfig: resolvedMotion3DConfig
  });
  const governedScenes = governedCoreModel.scenes;
  const governedChoreographyPlan = governedCoreModel.choreographyPlan;
  const cameraCues = governedCoreModel.cameraCues;
  const finalizedMotion3DPlan = buildMotion3DPlan({
    chunks,
    scenes: governedScenes,
    videoMetadata: resolvedVideoMetadata,
    mode: motion3DMode,
    configOverrides: motion3DConfig,
    resolvedConfig: resolvedMotion3DConfig,
    choreographyPlan: governedChoreographyPlan
  });
  const soundDesignPlan = buildMotionSoundDesignPlan({
    chunks,
    tier: motionPlan.motionIntensity,
    fps,
    videoMetadata: resolvedVideoMetadata,
    showcasePlan,
    backgroundOverlayPlan,
    cameraCues
  });
  const chosenTransitionId = governedScenes[0]?.transitionIn ?? motionPlan.transitionPresetId ?? "auto";
  const matteManifest = resolveMatteManifest(matteId ?? governedScenes[0]?.matteId);

  return {
    chunks,
    tier: resolvedTier,
    captionBias: motionPlan.captionBias,
    gradeProfile: resolveGradeProfile(resolvedGradeProfileId),
    scenes: governedScenes,
    cameraCues,
    matteManifest,
    matteEnabled: shouldUseMatte({mode: motionPlan.matteMode, tier: resolvedTier, manifest: matteManifest}),
    transitionPresetId: chosenTransitionId,
    captionSafeZone: isLongformCaptionStyleProfile(captionProfileId)
      ? longformCaptionSafeZone
      : upperSafeZone,
    captionMode: "existing-profile",
    motionPlan: {
      ...motionPlan,
      gradeProfileId: resolvedGradeProfileId
    },
    compositionCombatPlan: governedCoreModel.compositionCombatPlan,
    showcasePlan,
    showcaseIntelligencePlan: showcasePlan.intelligencePlan,
    backgroundOverlayPlan,
    transitionOverlayPlan,
    choreographyPlan: governedChoreographyPlan,
    motionGraphicsPlan,
    motion3DPlan: finalizedMotion3DPlan,
    motion3DConfig: resolvedMotion3DConfig,
    soundDesignPlan,
    referenceMotionTrace,
    patternMemory: governedCoreModel.patternMemory
  };
};

export const selectActiveMotionSceneAtTime = ({
  scenes,
  currentTimeMs,
  fps
}: {
  scenes: ResolvedMotionScene[];
  currentTimeMs: number;
  fps: number;
}): ResolvedMotionScene | null => {
  const lastRelevantIndex = findLastSceneStartingBeforeOrAt(scenes, currentTimeMs + MAX_SCENE_TRANSITION_LEAD_MS);
  if (lastRelevantIndex < 0) {
    return null;
  }

  let selectedScene: ResolvedMotionScene | null = null;

  for (let index = lastRelevantIndex; index >= 0; index -= 1) {
    const scene = scenes[index];
    const budgetMs = (scene.transitionBudgetFrames / fps) * 1000;

    if (scene.endMs + budgetMs < currentTimeMs) {
      break;
    }
    if (currentTimeMs < scene.startMs - budgetMs || currentTimeMs > scene.endMs + budgetMs) {
      continue;
    }

    if (!selectedScene) {
      selectedScene = scene;
      continue;
    }

    const sceneIsActive = currentTimeMs >= scene.startMs && currentTimeMs <= scene.endMs;
    const selectedIsActive = currentTimeMs >= selectedScene.startMs && currentTimeMs <= selectedScene.endMs;

    if (sceneIsActive !== selectedIsActive) {
      if (sceneIsActive) {
        selectedScene = scene;
      }
      continue;
    }

    if (scene.startMs > selectedScene.startMs) {
      selectedScene = scene;
    }
  }

  return selectedScene;
};

export const selectActiveCameraCueAtTime = ({
  scenes,
  cameraCues,
  currentTimeMs
}: {
  scenes?: ResolvedMotionScene[];
  cameraCues?: MotionCameraCue[];
  currentTimeMs: number;
}): MotionCameraCue | null => {
  const cueList = cameraCues ?? scenes
    ?.map((scene) => scene.cameraCue)
    .filter((cue): cue is MotionCameraCue => Boolean(cue)) ?? [];

  for (let index = cueList.length - 1; index >= 0; index -= 1) {
    const cue = cueList[index];
    if (cue.mode === "none") {
      continue;
    }
    if (cue.endMs < currentTimeMs) {
      break;
    }
    if (currentTimeMs >= cue.startMs && currentTimeMs <= cue.endMs) {
      return cue;
    }
  }

  return null;
};
