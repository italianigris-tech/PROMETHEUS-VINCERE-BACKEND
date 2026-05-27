import type {CSSProperties} from "react";

import {
  buildLongformSemanticSidecallPresentation,
  hasLongformSemanticGraphicAsset,
  type LongformSemanticSidecallPresentation
} from "../longform-semantic-sidecall";
import {
  classifyTypographyContentEnergy,
  classifyTypographySpeechPacing,
  selectTypographyTreatment,
  type TypographySelection,
  type TypographyTextRole
} from "../typography-policy";
import {
  resolveSelectedRuntimeFont,
  type ManualSelectedRuntimeFont,
  type RuntimeFontLookupDiagnostic,
  type RuntimeFontAssetRecord,
  type SelectedRuntimeFont
} from "../font-intelligence/font-runtime-registry";
import {getEditorialFontPalette, type EditorialFontPaletteId} from "../cinematic-typography/editorial-fonts";
import {
  selectRuntimeFontSelection,
  type RuntimeFontSelection
} from "../cinematic-typography/runtime-font-selector";
import {
  resolveRenderableTypographyFontForRole,
  resolveRenderableTypographyFont,
  type ResolvedRenderableTypographyFont
} from "../font-intelligence/runtime-font-bridge";
import {selectActiveMotionBackgroundOverlayCueAtTime} from "./background-overlay-planner";
import type {
  CaptionChunk,
  CaptionStyleProfileId,
  CaptionVerticalBias,
  GradeProfile,
  MotionCompositionCombatPlan,
  MotionBackgroundOverlayCue,
  MotionBackgroundOverlayPlan,
  MotionMoodTag,
  MotionTier,
  PresentationMode,
  TranscribedWord
} from "../types";

import {
  normalizeLongformWord,
  splitLongformWordsIntoLines,
  semanticSplitLongformWords,
  type LongformWordLine,
  type LongformLineRole
} from "../longform-word-layout";
import {generateSemanticDecision, type SemanticToken} from "../semantic-emphasis-engine";
import {orchestrateVisualField, type VisualOrchestrationResult, type PlacementPlan} from "../visual-field-engine";
import { resolveStylePhysics, type StylePhysicsState } from "../style-physics";
import {orchestrateTimelineRhythm, type TimelineRhythmState} from "../timeline-rhythm";
import type {SequenceDirectorPlan} from "../sequence-director-engine";

export type CaptionSurfaceTone = "light" | "dark" | "neutral";

export type CaptionEditorialMode = "normal" | "escalated" | "keyword-only";
export type CaptionKeywordAnimation = "fade" | "burst" | "letter-by-letter";
export type CaptionAssetBias = "minimal" | "semantic" | "structured";

export type CaptionEditorialContext = {
  chunk: CaptionChunk;
  captionProfileId?: CaptionStyleProfileId | null;
  gradeProfile?: GradeProfile | null;
  backgroundOverlayPlan?: MotionBackgroundOverlayPlan | null;
  currentTimeMs?: number;
  surfaceToneHint?: CaptionSurfaceTone | null;
  captionBias?: CaptionVerticalBias | null;
  presentationMode?: PresentationMode | null;
  motionTier?: MotionTier | null;
  forceMode?: CaptionEditorialMode | null;
  readabilityPressure?: number | null;
  compositionCombatPlan?: MotionCompositionCombatPlan | null;
  semanticReductionAllowed?: boolean;
  sequencePlan?: SequenceDirectorPlan | null;
  isSilenced?: boolean;
  pauseDurationMs?: number;
  debugSelectedFontId?: string | null;
  debugSelectedFont?: ManualSelectedRuntimeFont | RuntimeFontAssetRecord | null;
  selectedFontId?: string | null;
  selectedFont?: ManualSelectedRuntimeFont | RuntimeFontAssetRecord | null;
  allowAutomaticManifestRuntimeFont?: boolean;
};

export type CaptionEditorialLineStyle = {
  fontSizeScale: number;
  fontWeight: number | string;
  lineHeight: number;
  letterSpacing: string;
};

export type CaptionEditorialDecision = {
  mode: CaptionEditorialMode;
  surfaceTone: CaptionSurfaceTone;
  textColor: string;
  textShadow: string;
  textStroke: string;
  fontFamily: string;
  fontWeight: number | string;
  fontSizeScale: number;
  opacityMultiplier: number;
  uppercaseBias: boolean;
  letterSpacing: string;
  keywordPhrases: string[];
  keywordAnimation: CaptionKeywordAnimation;
  assetBias: CaptionAssetBias;
  backgroundScaleCap: number;
  rationale: string[];
  cssVariables: Record<string, string>;
  typography: TypographySelection;
  lineStyles: Partial<Record<LongformLineRole, CaptionEditorialLineStyle>>;
  hierarchyMetadata: {
    lines: Array<{text: string; role: LongformLineRole; importanceScore: number}>;
    aggressionLevel: number;
    hookType?: string;
    emotionalWeight: number;
    tokens: SemanticToken[];
  };
  motionProfile: {
    easing: string;
    snapDurationMs: number;
    axis: "x" | "y" | "scale";
  };
  visualOrchestration: VisualOrchestrationResult;
  stylePhysics: StylePhysicsState;
  timelineRhythm: TimelineRhythmState;
  fontSelection: RuntimeFontSelection & {
    requestedWeight?: number;
    resolvedWeight?: number;
    availableWeights?: number[];
    fauxBoldRisk?: boolean;
    fauxItalicRisk?: boolean;
    graphUsageScore?: number;
    genericFallbackRisk?: boolean;
    runtimeFontId?: string;
    runtimeFamilyId?: string;
    runtimeCssFamily?: string;
    manifestBacked?: boolean;
    runtimeDiagnostics?: RuntimeFontLookupDiagnostic[];
  };
  runtimeFont?: {
    source: SelectedRuntimeFont["source"];
    fontId: string;
    familyId: string;
    familyName: string;
    cssFamily: string;
    diagnostics: RuntimeFontLookupDiagnostic[];
  } | null;
  qualityGate?: {
    fontLoadScore: number;
    fauxBoldRisk: boolean;
    graphUsageScore: number;
    genericFallbackRisk: boolean;
    renderSharpnessRisk: boolean;
    motionJitterRisk: boolean;
    layoutPremiumScore: number;
    finalTypographyQualityScore: number;
  };
};

const DEFAULT_KEYWORD_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "because", "but", "by", "for", "from", "give", "go", "got", "have", "he", "her", "hers", "him", "his", "i", "if", "in", "into", "is", "it", "its", "let", "lets", "me", "my", "of", "on", "or", "our", "out", "that", "the", "their", "them", "this", "to", "too", "up", "we", "what", "when", "where", "who", "why", "with", "you", "your"
]);

const SAFE_EDITORIAL_FONT_STACK = "\"Fraunces\", \"Times New Roman\", serif";
const warnedInvalidFontFamilies = new Set<string>();

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const isUsableFontStack = (value: string | null | undefined): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return Boolean(
    normalized &&
    !normalized.includes("undefined") &&
    !normalized.includes("null") &&
    !normalized.includes("nan")
  );
};

const warnInvalidFontFamilyOnce = (warningKey: string, invalidValue: string | null | undefined): void => {
  if (warnedInvalidFontFamilies.has(warningKey)) {
    return;
  }

  warnedInvalidFontFamilies.add(warningKey);
  console.warn("[caption-editorial-engine] Invalid font family fallback applied.", {
    warningKey,
    invalidValue
  });
};

const parseRgbaAlpha = (value: string | undefined | null): number => {
  if (!value) return 0;
  const match = value.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\s*\)/i);
  if (!match) return 0;
  const alpha = Number.parseFloat(match[1] ?? "");
  return Number.isFinite(alpha) ? clamp01(alpha) : 0;
};

const resolveBackgroundToneFromCue = (cue: MotionBackgroundOverlayCue | null | undefined): CaptionSurfaceTone => {
  if (!cue) return "neutral";
  const tags = new Set(cue.asset.themeTags ?? []);
  if (tags.has("authority") || tags.has("heroic")) return "dark";
  if (tags.has("calm") || tags.has("neutral")) return "light";
  if (tags.has("warm") && cue.asset.width >= cue.asset.height) return "light";
  return "neutral";
};

const resolveBackgroundToneFromGradeProfile = (gradeProfile: GradeProfile | null | undefined): CaptionSurfaceTone => {
  if (!gradeProfile) return "neutral";
  const shadowAlpha = parseRgbaAlpha(gradeProfile.shadowTint);
  const highlightAlpha = parseRgbaAlpha(gradeProfile.highlightTint);
  if (gradeProfile.brightness <= 0.985 || gradeProfile.contrast >= 1.12 || gradeProfile.vignette >= 0.24 || shadowAlpha >= 0.2) return "dark";
  if (gradeProfile.brightness >= 0.995 && (highlightAlpha >= 0.08 || gradeProfile.bloom >= 0.14)) return "light";
  return "neutral";
};

export const deriveCaptionSurfaceTone = ({
  gradeProfile,
  backgroundOverlayPlan,
  currentTimeMs,
  surfaceToneHint
}: {
  gradeProfile?: GradeProfile | null;
  backgroundOverlayPlan?: MotionBackgroundOverlayPlan | null;
  currentTimeMs?: number | null;
  surfaceToneHint?: CaptionSurfaceTone | null;
}): CaptionSurfaceTone => {
  if (surfaceToneHint) return surfaceToneHint;
  const activeCue = backgroundOverlayPlan && typeof currentTimeMs === "number"
    ? selectActiveMotionBackgroundOverlayCueAtTime({
      cues: backgroundOverlayPlan.cues,
      currentTimeMs
    })
    : null;
  const cueTone = resolveBackgroundToneFromCue(activeCue);
  if (cueTone !== "neutral") return cueTone;
  return resolveBackgroundToneFromGradeProfile(gradeProfile);
};

const normalizeKeyword = (value: string): string => normalizeLongformWord(value).trim();

const toDisplayKeyword = (value: string, uppercaseBias: boolean): string => {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return uppercaseBias ? trimmed.toUpperCase() : trimmed;
};

const collectKeywordPhrases = (chunk: CaptionChunk): string[] => {
  const semanticPresentation: LongformSemanticSidecallPresentation = buildLongformSemanticSidecallPresentation({
    chunk
  });
  const candidatePhrases = [
    ...semanticPresentation.keywords,
    semanticPresentation.leadLabel,
    semanticPresentation.supportingLabel ?? ""
  ];
  const emphasisWords = chunk.emphasisWordIndices
    .map((index) => chunk.words[index]?.text ?? "")
    .filter(Boolean);
  const fallbackWords = chunk.words
    .map((word) => word.text)
    .filter((word) => {
      const normalized = normalizeKeyword(word);
      return normalized.length > 0 && !DEFAULT_KEYWORD_STOP_WORDS.has(normalized);
    });
  return dedupeDisplayValues([...candidatePhrases, ...emphasisWords, ...fallbackWords]);
};

const buildDecisionRationale = (entries: Array<string | null | undefined>): string[] => entries.filter((entry): entry is string => Boolean(entry));

const dedupeDisplayValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
  }
  return output;
};

const resolveTypographyRole = ({
  chunk,
  mode,
  emphasisCount,
  combinedKeywordPhrases,
  hasGraphicAsset
}: {
  chunk: CaptionChunk;
  mode: CaptionEditorialMode;
  emphasisCount: number;
  combinedKeywordPhrases: string[];
  hasGraphicAsset: boolean;
}): TypographyTextRole => {
  const text = chunk.text;
  if (/\b(ai|data|system|workflow|prompt|code|command|agent|model|render|dashboard)\b/i.test(text)) return "tech-overlay";
  if (chunk.semantic?.intent === "name-callout") return "headline";
  if (mode === "keyword-only") {
    if (chunk.words.length <= 2) return "keyword";
    if (/[!?]/.test(text) || emphasisCount >= 2) return "hook";
    return "headline";
  }
  if (mode === "escalated") {
    if (!hasGraphicAsset && (combinedKeywordPhrases.length <= 2 || chunk.words.length >= 6 || chunk.endMs - chunk.startMs >= 2200)) return "quote";
    return "headline";
  }
  return "subtitle";
};

const resolveTypographyEnergyScore = ({
  mode,
  emphasisCount,
  punctuationWeight,
  hasGraphicAsset,
  combatStrongHierarchy,
  combatNeedsEscalation,
  semanticKeywordCount
}: {
  mode: CaptionEditorialMode;
  emphasisCount: number;
  punctuationWeight: number;
  hasGraphicAsset: boolean;
  combatStrongHierarchy: boolean;
  combatNeedsEscalation: boolean;
  semanticKeywordCount: number;
}): number => {
  const score = 0.22 +
    (mode === "keyword-only" ? 0.36 : mode === "escalated" ? 0.16 : 0) +
    Math.min(emphasisCount, 3) * 0.12 +
    punctuationWeight * 0.1 +
    (hasGraphicAsset ? 0.1 : 0) +
    (combatStrongHierarchy ? 0.14 : 0) +
    (combatNeedsEscalation ? 0.08 : 0) +
    Math.min(semanticKeywordCount, 3) * 0.06;
  return clamp01(score);
};

const resolveCaptionEditorialTypeface = ({
  mode,
  typography,
  uppercaseBias,
  fontSelection,
  selectedRuntimeFont,
  manifestRuntimeFont
}: {
  mode: CaptionEditorialMode;
  typography: TypographySelection;
  uppercaseBias: boolean;
  fontSelection: RuntimeFontSelection;
  selectedRuntimeFont?: SelectedRuntimeFont | null;
  manifestRuntimeFont?: ResolvedRenderableTypographyFont | null;
}): {
  fontFamily: string;
  fontWeight: number | string;
  letterSpacing: string;
} => {
  const paletteId: EditorialFontPaletteId = fontSelection.fontPaletteId;
  const palette = getEditorialFontPalette(paletteId);
  let fontWeight: number | string = 600;
  let letterSpacing = uppercaseBias ? "-0.012em" : "-0.016em";
  switch (paletteId) {
    case "dm-sans-core":
      fontWeight = mode === "keyword-only" ? 700 : 600;
      letterSpacing = uppercaseBias ? "-0.015em" : "-0.012em";
      break;
    case "noto-display":
      fontWeight = 700;
      letterSpacing = uppercaseBias ? "-0.022em" : "-0.022em";
      break;
    case "playfair-contrast":
      fontWeight = 700;
      letterSpacing = uppercaseBias ? "-0.018em" : "-0.018em";
      break;
    case "instrument-nocturne":
      fontWeight = 400;
      letterSpacing = uppercaseBias ? "-0.014em" : "-0.014em";
      break;
    case "crimson-voice":
    case "lora-documentary":
      fontWeight = 600;
      letterSpacing = uppercaseBias ? "-0.012em" : "-0.012em";
      break;
    case "cormorant-salon":
      fontWeight = 600;
      letterSpacing = uppercaseBias ? "-0.016em" : "-0.016em";
      break;
    case "fraunces-editorial":
    default:
      fontWeight = typography.role === "headline" || typography.role === "hook" || typography.role === "transition-card" || typography.role === "cta" || mode === "keyword-only" ? 650 : 600;
      letterSpacing = uppercaseBias ? "-0.016em" : "-0.016em";
      break;
  }

  if (selectedRuntimeFont) {
    const requestedWeight = typeof fontSelection.resolvedWeight === "number" ? fontSelection.resolvedWeight : Number(fontWeight);
    const selectedRuntimeRecord = [...selectedRuntimeFont.records].sort((left, right) => {
      return Math.abs((left.weight ?? 400) - requestedWeight) - Math.abs((right.weight ?? 400) - requestedWeight);
    })[0] ?? selectedRuntimeFont.primaryRecord;

    return {
      fontFamily: selectedRuntimeFont.cssFamily,
      fontWeight: selectedRuntimeRecord.weight ?? fontSelection.resolvedWeight ?? fontWeight,
      letterSpacing
    };
  }

  if (manifestRuntimeFont) {
    const manifestRuntimeFontStack = `"${manifestRuntimeFont.palette.cssFamily}", ${manifestRuntimeFont.palette.displayFamily}`;

    return {
      fontFamily: manifestRuntimeFontStack,
      fontWeight: manifestRuntimeFont.resolvedWeight,
      letterSpacing
    };
  }

  const runtimeFontStack = palette.runtimeFontStack;
  if (isUsableFontStack(runtimeFontStack)) {
    return {
      fontFamily: runtimeFontStack,
      fontWeight: fontSelection.resolvedWeight ?? fontWeight,
      letterSpacing
    };
  }

  if (isUsableFontStack(palette.displayFamily)) {
    if (runtimeFontStack && runtimeFontStack !== palette.displayFamily) {
      warnInvalidFontFamilyOnce(`runtime:${palette.id}`, runtimeFontStack);
    }

    return {
      fontFamily: palette.displayFamily,
      fontWeight: fontSelection.resolvedWeight ?? fontWeight,
      letterSpacing
    };
  }

  warnInvalidFontFamilyOnce(`display:${palette.id}`, palette.displayFamily);

  return {
    fontFamily: SAFE_EDITORIAL_FONT_STACK,
    fontWeight: fontSelection.resolvedWeight ?? fontWeight,
    letterSpacing
  };
};

export const validateTypographyDecision = (decision: CaptionEditorialDecision, availableFonts: string[]): void => {
  const diagnostics: string[] = [];
  if (!decision.fontSelection.fontCandidateId) diagnostics.push("Missing font candidate ID.");
  else if (!availableFonts.includes(decision.fontSelection.fontCandidateId)) diagnostics.push(`Selected font candidate '${decision.fontSelection.fontCandidateId}' does not exist in manifest.`);
  if (decision.fontSelection.fauxBoldRisk) diagnostics.push(`Faux bold risk detected for weight ${decision.fontWeight} on font ${decision.fontFamily}. Real weight must be resolved.`);
  if (!decision.mode) diagnostics.push("Moment is missing a typography mode.");
  if (decision.fontFamily.includes("placeholder") || decision.fontFamily.includes("undefined")) diagnostics.push(`Placeholder or undefined style name leaked into final render: ${decision.fontFamily}`);
  if (diagnostics.length > 0) {
    console.error("[Typography Validation Failed]", diagnostics);
    throw new Error(`Typography Validation Failed: ${diagnostics.join(" | ")}`);
  }
};

export const resolveCaptionEditorialDecision = (context: CaptionEditorialContext): CaptionEditorialDecision => {
  const activeCue = context.backgroundOverlayPlan && typeof context.currentTimeMs === "number"
    ? selectActiveMotionBackgroundOverlayCueAtTime({
      cues: context.backgroundOverlayPlan.cues,
      currentTimeMs: context.currentTimeMs
    })
    : null;

  const surfaceTone = deriveCaptionSurfaceTone({
    gradeProfile: context.gradeProfile,
    backgroundOverlayPlan: context.backgroundOverlayPlan,
    currentTimeMs: context.currentTimeMs,
    surfaceToneHint: context.surfaceToneHint
  });

  const semanticPresentation = buildLongformSemanticSidecallPresentation({
    chunk: context.chunk
  });
  const keywordPhrases = collectKeywordPhrases(context.chunk);
  const combatPlan = context.compositionCombatPlan ?? null;
  const combatChunkPlan = combatPlan?.chunkPlans.find((plan) => plan.chunkId === context.chunk.id) ?? null;
  const combinedKeywordPhrases = dedupeDisplayValues([
    combatChunkPlan?.primary?.label ?? "",
    ...(combatChunkPlan?.secondary.map((element) => element.label) ?? []),
    ...(combatChunkPlan?.supporters.map((element) => element.label) ?? []),
    ...(combatChunkPlan?.keywordPhrases ?? []),
    ...keywordPhrases
  ]);
  const emphasisCount = context.chunk.emphasisWordIndices?.length ?? 0;
  const hasGraphicAsset = hasLongformSemanticGraphicAsset(context.chunk);
  const punctuationWeight = /[!?]/.test(context.chunk.text) ? 1 : 0;
  const shortSignal = context.chunk.words.length <= 4 ? 1 : 0;
  const combatStrongHierarchy = Boolean(combatPlan && combatPlan.validity.hasPrimary && combatPlan.validity.hasSupport && combatPlan.validity.hasUtility && combatPlan.synergyScore >= 0.7 && combatPlan.hierarchyScore >= 0.62);
  const combatNeedsEscalation = Boolean(combatPlan && (combatPlan.validity.invalidReasons.length > 0 || combatPlan.supportCoverageScore < 0.54 || combatPlan.motionVarietyScore < 0.45 || combatPlan.overExecutionScore < 0.48));
  
  const highImpactSignal = context.chunk.semantic?.intent === "punch-emphasis" || context.chunk.semantic?.intent === "name-callout" || hasGraphicAsset || emphasisCount >= 2 || semanticPresentation.keywords.length >= 2 || combatStrongHierarchy;
  const mediumImpactSignal = emphasisCount >= 1 || shortSignal === 1 || punctuationWeight === 1 || combinedKeywordPhrases.length <= 2 || combatNeedsEscalation;

  let mode: CaptionEditorialMode = "normal";
  if (context.forceMode) mode = context.forceMode;
  else if (highImpactSignal) mode = "keyword-only";
  else if (surfaceTone === "light" || mediumImpactSignal) mode = "escalated";

  const isLightSurface = surfaceTone === "light";
  const isDarkSurface = surfaceTone === "dark";
  const textColor = isLightSurface ? "rgba(18, 20, 24, 0.96)" : isDarkSurface ? "rgba(255, 255, 255, 0.98)" : "rgba(243, 247, 255, 0.98)";
  const textShadow = isLightSurface ? "0 1px 3px rgba(0,0,0,0.12), 0 0 8px rgba(255,255,255,0.12)" : "0 2px 6px rgba(0,0,0,0.72), 0 0 12px rgba(193,212,255,0.18)";
  const textStroke = isLightSurface ? "0.3px rgba(255,255,255,0.2)" : "0.4px rgba(255,255,255,0.3)";

  const typographyRole = resolveTypographyRole({
    chunk: context.chunk,
    mode,
    emphasisCount,
    combinedKeywordPhrases,
    hasGraphicAsset
  });
  const typographyEnergy = classifyTypographyContentEnergy(resolveTypographyEnergyScore({
    mode,
    emphasisCount,
    punctuationWeight,
    hasGraphicAsset,
    combatStrongHierarchy,
    combatNeedsEscalation,
    semanticKeywordCount: semanticPresentation.keywords.length
  }));
  const typographySpeechPacing = classifyTypographySpeechPacing({
    durationMs: Math.max(1, context.chunk.endMs - context.chunk.startMs),
    wordCount: Math.max(1, context.chunk.words.length)
  });
  const typography = selectTypographyTreatment({
    text: context.chunk.text,
    role: typographyRole,
    contentEnergy: typographyEnergy,
    speechPacing: typographySpeechPacing,
    wordCount: context.chunk.words.length,
    emphasisWordCount: emphasisCount,
    semanticIntent: context.chunk.semantic?.intent ?? null,
    surfaceTone,
    presentationMode: context.presentationMode ?? null
  });
  const fontSelection = selectRuntimeFontSelection({
    typographyRole,
    contentEnergy: typographyEnergy,
    patternMood: typography.pattern.mood,
    targetMoods: typography.targetMoods,
    patternUnit: typography.pattern.unit,
    wordCount: context.chunk.words.length,
    emphasisCount,
    mode,
    surfaceTone,
    motionTier: context.motionTier ?? null,
    semanticIntent: context.chunk.semantic?.intent ?? null,
    presentationMode: context.presentationMode ?? null,
    treatmentFontProfileBucket: context.sequencePlan?.moments.find(m => m.chunkId === context.chunk.id)?.fontFamilyRole === "impact" 
      ? context.sequencePlan?.fontPlan.impactFontQuery.bucket 
      : context.sequencePlan?.fontPlan.readingFontQuery.bucket
  });

  const qualityGate = {
    fontLoadScore: fontSelection.fauxBoldRisk ? 0.4 : 1.0,
    fauxBoldRisk: fontSelection.fauxBoldRisk ?? false,
    graphUsageScore: fontSelection.graphUsageScore ?? 0,
    genericFallbackRisk: fontSelection.genericFallbackRisk ?? false,
    renderSharpnessRisk: fontSelection.fauxBoldRisk || mode === "keyword-only",
    motionJitterRisk: false, // motionTier turbo mismatch fixed
    layoutPremiumScore: 0.85,
    finalTypographyQualityScore: 0
  };

  qualityGate.finalTypographyQualityScore = (
    qualityGate.fontLoadScore * 0.35 +
    (1 - (qualityGate.genericFallbackRisk ? 0.35 : 0)) +
    qualityGate.graphUsageScore * 0.2 +
    qualityGate.layoutPremiumScore * 0.1
  );

  const uppercaseBias = mode !== "normal" || isLightSurface || typography.styling.preferredCase === "uppercase";

  const finalFontSelection = qualityGate.finalTypographyQualityScore < 0.65
    ? {
      ...fontSelection,
      fontPaletteId: "dm-sans-core" as const,
      palette: getEditorialFontPalette("dm-sans-core"),
      rationale: [...fontSelection.rationale, "quality-gate-force-safe-fallback"]
    }
    : fontSelection;

  const finalTypography = qualityGate.finalTypographyQualityScore < 0.65
    ? {
      ...typography,
      pattern: {
        ...typography.pattern,
        unit: "word" as const,
        mood: "editorial" as const,
        entry: {...typography.pattern.entry, blur: undefined}
      }
    }
    : typography;

  const debugRuntimeFontRequest = context.debugSelectedFontId || context.debugSelectedFont
    ? {
      selectedFontId: context.debugSelectedFontId,
      selectedFont: context.debugSelectedFont
    }
    : null;
  const selectedRuntimeFontRequest = context.selectedFontId || context.selectedFont
    ? resolveSelectedRuntimeFont({
      selectedFontId: context.selectedFontId,
      selectedFont: context.selectedFont
    })
    : null;
  const runtimeFontLookup = debugRuntimeFontRequest
    ? resolveSelectedRuntimeFont(debugRuntimeFontRequest)
    : selectedRuntimeFontRequest;
  const selectedRuntimeFont = runtimeFontLookup?.selectedFont ?? null;
  const manifestRuntimeFont = !selectedRuntimeFont && context.allowAutomaticManifestRuntimeFont
    ? resolveRenderableTypographyFont({
      candidateId: finalFontSelection.fontCandidateId,
      requestedWeight: finalFontSelection.resolvedWeight ?? finalFontSelection.requestedWeight,
      requestedStyle: "normal"
    }) ?? resolveRenderableTypographyFontForRole({
      roleId: finalFontSelection.selectedRoleId,
      requestedWeight: finalFontSelection.resolvedWeight ?? finalFontSelection.requestedWeight,
      requestedStyle: "normal"
    })
    : null;
  const runtimeFontDiagnostics = [
    ...(runtimeFontLookup?.diagnostics ?? []),
    ...(manifestRuntimeFont?.diagnostics ?? [])
  ];

  const typeface = resolveCaptionEditorialTypeface({
    mode,
    typography: finalTypography,
    uppercaseBias,
    fontSelection: finalFontSelection,
    selectedRuntimeFont,
    manifestRuntimeFont
  });

  const keywordAnimation: CaptionKeywordAnimation = mode === "keyword-only" || finalTypography.pattern.unit === "letter"
    ? "letter-by-letter"
    : finalTypography.pattern.mood === "aggressive" || finalTypography.pattern.mood === "trailer" || finalTypography.pattern.mood === "dramatic" || Boolean(finalTypography.pattern.entry.blur) || Boolean(finalTypography.pattern.entry.clipPath) || Boolean(finalTypography.pattern.entry.x) || Boolean(finalTypography.pattern.entry.y)
      ? "burst"
      : "fade";
  const assetBias: CaptionAssetBias = mode === "normal" && finalTypography.role !== "tech-overlay" ? "semantic" : "structured";

  const semantic = generateSemanticDecision(context.chunk.words);
  const lines = semanticSplitLongformWords(context.chunk.words, context.semanticReductionAllowed ?? true);
  
  const hierarchyMetadata = {
    lines: lines.map(line => ({
      text: line.words.map(w => w.text).join(" "),
      role: line.role ?? "context",
      importanceScore: line.role === "hook" ? 1.0 : 0.5
    })),
    aggressionLevel: typographyEnergy === "high" ? 1.0 : 0.5,
    hookType: context.chunk.semantic?.intent,
    emotionalWeight: (emphasisCount / Math.max(1, context.chunk.words.length)) * 2,
    tokens: semantic.tokens
  };

  const visualOrchestration = orchestrateVisualField(
    hierarchyMetadata.hookType ?? "context",
    hierarchyMetadata.emotionalWeight,
    context.chunk.words.length,
    "iman_like" // Default style profile
  );

  const durationSec = Math.max(0.1, (context.chunk.endMs - context.chunk.startMs) / 1000);
  const timelineRhythm = orchestrateTimelineRhythm({
    transcriptTiming: { startMs: context.chunk.startMs, endMs: context.chunk.endMs },
    transcriptCadence: context.chunk.words.length / durationSec,
    semanticDensity: (context.chunk.emphasisWordIndices?.length ?? 0) / Math.max(1, context.chunk.words.length),
    emotionalIntensity: hierarchyMetadata.emotionalWeight / 2,
    silenceWindows: context.isSilenced ? [{ startMs: context.chunk.startMs, endMs: context.chunk.endMs }] : [],
    speakerDeliverySpeed: context.chunk.words.length / durationSec,
    musicBeatMap: [], // TODO: Ingest from global project context
    waveformEnergy: 0.5, // TODO: Ingest from audio analysis
    cameraMotionEnergy: activeCue ? 0.8 : 0.1,
    sceneTransitions: [],
    previousRhythmHistory: [], // Ingested via rhythmMemory singleton internally if needed
    pacingFatigue: 0.2, // TODO: Ingest from style memory
    attentionFatigue: 0.1,
    visualComplexity: 0.3, // TODO: Ingest from negative space analysis
    shotContinuity: 0.9
  });

  const stylePhysics = resolveStylePhysics({
    text: context.chunk.text,
    isEmphasized: mode === "keyword-only",
    emotionalIntensity: (hierarchyMetadata.emotionalWeight / 2) * timelineRhythm.tensionCurve,
    aggression: context.chunk.governedPhysics?.aggression ?? ((mode === "keyword-only" ? 0.9 : (mode === "escalated" ? 0.6 : 0.3)) * timelineRhythm.rhythmAggression),
    restraint: context.chunk.governedPhysics?.silence ?? (isLightSurface ? 0.7 : 0.2),
    cinematicDrift: (context.motionTier === "premium" ? 0.5 : 0.1) * timelineRhythm.cadenceCompression,
    dominance: context.chunk.governedPhysics?.dominance ?? ((mode === "keyword-only" ? 0.8 : 0.5) * (1 - timelineRhythm.silencePressure)),
    anticipationDelay: 0.2 + (timelineRhythm.anticipationWindow / 1000),
    cameraMotionEnergy: "static", // TODO: Get from active background cue
    speakerEmotion: "neutral", // TODO: Get from context if available
    faceBoundingBoxes: visualOrchestration.visualFieldAnalysis.faceBoundingBoxes,
    pauseDurationMs: (context.pauseDurationMs ?? 0) + timelineRhythm.emotionalPauseDuration,
    fontFamily: typeface.fontFamily,
    expectedScale: (context.chunk.governedPhysics?.scale ?? 1.0) * visualOrchestration.typographyPlan.scaleModifier
  });

  const rationale = buildDecisionRationale([
    surfaceTone === "light" ? "surface-tone-light" : surfaceTone === "dark" ? "surface-tone-dark" : "surface-tone-neutral",
    highImpactSignal ? "high-impact-cue" : null,
    mediumImpactSignal ? "medium-impact-cue" : null,
    hasGraphicAsset ? "semantic-graphic-asset" : null,
    combatPlan ? `combat-synergy=${combatPlan.synergyScore.toFixed(2)}` : null,
    combatPlan ? `combat-hierarchy=${combatPlan.hierarchyScore.toFixed(2)}` : null,
    combatPlan ? `combat-primary=${combatPlan.chunkPlans[0]?.primary?.id ?? "none"}` : null,
    combatStrongHierarchy ? "combat-strong-hierarchy" : null,
    combatNeedsEscalation ? "combat-needs-escalation" : null,
    `typography-role=${finalTypography.role}`,
    `typography-pattern=${finalTypography.pattern.id}`,
    debugRuntimeFontRequest ? "runtime-font-source=debug-override" : null,
    !debugRuntimeFontRequest && selectedRuntimeFontRequest ? "runtime-font-source=selected-font-payload" : null,
    !debugRuntimeFontRequest && !selectedRuntimeFontRequest && manifestRuntimeFont ? "runtime-font-source=manifest-bridge-auto" : null,
    selectedRuntimeFont ? `runtime-font-id=${selectedRuntimeFont.primaryRecord.fontId}` : null,
    selectedRuntimeFont ? `runtime-font-family=${selectedRuntimeFont.cssFamily}` : null,
    manifestRuntimeFont ? `runtime-font-id=${manifestRuntimeFont.resolvedRecord.fontId}` : null,
    manifestRuntimeFont ? `runtime-font-family=${manifestRuntimeFont.palette.cssFamily}` : null,
    ...(runtimeFontDiagnostics.map((diagnostic) => `runtime-font-diagnostic=${diagnostic.code}`)),
    ...finalFontSelection.rationale,
    ...visualOrchestration.restraintPlan.reasons.map(r => `ORCHESTRATION: ${r}`),
    ...stylePhysics.rationale,
    ...timelineRhythm.rationale.map(r => `RHYTHM: ${r}`),
    context.isSilenced ? "SILENCE WINDOW DETECTED" : null
  ]);
  const baseFontSizeScale = mode === "keyword-only" ? 1.88 : mode === "escalated" ? 1.18 : 1.0;
  const physicsAmplifiedFontSizeScale = baseFontSizeScale * stylePhysics.motion.scaleInertia * 10.0;

  return {
    mode,
    surfaceTone,
    textColor,
    textShadow,
    textStroke,
    fontFamily: typeface.fontFamily,
    fontWeight: typeface.fontWeight,
    fontSizeScale: Math.max(baseFontSizeScale, physicsAmplifiedFontSizeScale),
    opacityMultiplier: stylePhysics.attention.typographyDominance * (stylePhysics.critic.revisions.scaleMultiplier ?? 1.0),
    uppercaseBias,
    letterSpacing: typeface.letterSpacing,
    keywordPhrases: combinedKeywordPhrases.map((value) => toDisplayKeyword(value, uppercaseBias)),
    keywordAnimation,
    assetBias,
    backgroundScaleCap: 1.02,
    rationale,
    cssVariables: {
      "--caption-text-color": textColor,
      "--caption-text-shadow": textShadow,
      "--caption-text-stroke": textStroke,
      "--caption-font-family": typeface.fontFamily,
      "--caption-font-weight": String(typeface.fontWeight),
      "--caption-letter-spacing": typeface.letterSpacing,
      "--caption-opacity": String(stylePhysics.attention.typographyDominance),
      "--physics-blur": `${stylePhysics.motion.blurRelease}px`,
      "--physics-velocity": String(stylePhysics.motion.velocity),
      "--physics-drag": String(stylePhysics.motion.cinematicDrag),
      "--rhythm-delay": `${timelineRhythm.impactDelayFrames}f`,
      "--rhythm-tension": String(timelineRhythm.tensionCurve)
    },
    typography: finalTypography,
    lineStyles: {}, // Can be populated based on hierarchy if needed
    hierarchyMetadata,
    motionProfile: {
      easing: stylePhysics.motion.easing,
      snapDurationMs: stylePhysics.motion.durationMs,
      axis: "y"
    },
    visualOrchestration,
    stylePhysics,
    timelineRhythm,
    fontSelection: {
      ...finalFontSelection,
      runtimeFontId: selectedRuntimeFont?.primaryRecord.fontId ?? manifestRuntimeFont?.resolvedRecord.fontId,
      runtimeFamilyId: selectedRuntimeFont?.familyId ?? manifestRuntimeFont?.palette.familyId,
      runtimeCssFamily: selectedRuntimeFont?.cssFamily ?? manifestRuntimeFont?.palette.cssFamily,
      fauxItalicRisk: manifestRuntimeFont?.fauxItalicRisk ?? false,
      manifestBacked: Boolean(manifestRuntimeFont),
      runtimeDiagnostics: runtimeFontDiagnostics
    },
    runtimeFont: selectedRuntimeFont
      ? {
        source: selectedRuntimeFont.source,
        fontId: selectedRuntimeFont.primaryRecord.fontId,
        familyId: selectedRuntimeFont.familyId,
        familyName: selectedRuntimeFont.familyName,
        cssFamily: selectedRuntimeFont.cssFamily,
        diagnostics: runtimeFontDiagnostics
      }
      : manifestRuntimeFont
        ? {
          source: "familyId",
          fontId: manifestRuntimeFont.resolvedRecord.fontId,
          familyId: manifestRuntimeFont.palette.familyId,
          familyName: manifestRuntimeFont.palette.familyName,
          cssFamily: manifestRuntimeFont.palette.cssFamily,
          diagnostics: runtimeFontDiagnostics
        }
      : null,
    qualityGate
  };
};

export const resolveControlledBackgroundScale = (
  scale: number,
  maxScale: number = 1.02
): number => {
  const upperBound = Math.max(1, maxScale);
  return Math.max(1, Math.min(scale, upperBound));
};
