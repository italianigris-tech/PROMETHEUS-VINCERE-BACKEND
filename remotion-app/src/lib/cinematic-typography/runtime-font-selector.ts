import type {
  TypographyAnimationUnit,
  TypographyContentEnergy,
  TypographyMood,
  TypographyTextRole
} from "../typography-policy";
import {getDynamicManifestTypographyCandidates} from "../font-intelligence/runtime-font-bridge";
import type {MotionTier, PresentationMode} from "../types";
import {
  getEditorialFontPalette,
  getRuntimePaletteIdForTypographyCandidate,
  type EditorialFontPalette,
  type EditorialFontPaletteId
} from "./font-runtime-registry";
import {rankTypographyCandidatesForRole} from "./font-compatibility-graph";
import {
  TYPOGRAPHY_DOCTRINE_V1,
  type TypographyFontCandidate,
  type TypographyIntensityBand,
  type TypographyRoleSlotId
} from "./typography-doctrine";

export type RuntimeFontMotionDemand = "low" | "medium" | "high";
export type RuntimeFontSelectionMode = "normal" | "escalated" | "keyword-only";

export type RuntimeFontSelectionInput = {
  typographyRole: TypographyTextRole;
  contentEnergy: TypographyContentEnergy;
  patternMood: TypographyMood;
  targetMoods: TypographyMood[];
  patternUnit: TypographyAnimationUnit;
  wordCount: number;
  emphasisCount: number;
  mode: RuntimeFontSelectionMode;
  surfaceTone: "light" | "dark" | "neutral";
  motionTier?: MotionTier | null;
  semanticIntent?: string | null;
  presentationMode?: PresentationMode | null;
  treatmentFontProfileHint?: EditorialFontPaletteId | null;
  treatmentFallbackFontProfileHint?: EditorialFontPaletteId | null;
  treatmentFontProfileBucket?: string | null;
};

export type RuntimeFontSelection = {
  requestedRoleId: TypographyRoleSlotId;
  selectedRoleId: TypographyRoleSlotId;
  fontCandidateId: string;
  fontPaletteId: EditorialFontPaletteId;
  palette: EditorialFontPalette;
  intensityBand: TypographyIntensityBand;
  motionDemand: RuntimeFontMotionDemand;
  requestedWeight?: number;
  resolvedWeight?: number;
  rationale: string[];
};

const candidateById = new Map(
  [
    ...TYPOGRAPHY_DOCTRINE_V1.candidates,
    ...getDynamicManifestTypographyCandidates()
  ].map((candidate) => [candidate.id, candidate] as const)
);

const toNumericBand = (value: RuntimeFontMotionDemand | TypographyIntensityBand | TypographyFontCandidate["motionTolerance"]): number => {
  if (value === "high") {
    return 2;
  }
  if (value === "medium") {
    return 1;
  }
  return 0;
};

const inferRequestedRoleId = (input: RuntimeFontSelectionInput): TypographyRoleSlotId => {
  if (input.treatmentFontProfileBucket === "hero_impact") {
    return "hero_serif_primary";
  }
  if (input.treatmentFontProfileBucket === "editorial_authority") {
    return "hero_serif_alternate";
  }
  if (input.treatmentFontProfileBucket === "neutral_reading") {
    return "neutral_sans_core";
  }
  if (input.treatmentFontProfileBucket === "accent_script_or_italic") {
    return "script_accent_rare";
  }
  if (input.treatmentFontProfileBucket === "kinetic_display") {
    return "display_sans_pressure_release";
  }

  if (input.typographyRole === "tech-overlay") {
    return "neutral_sans_core";
  }

  if (input.typographyRole === "subtitle") {
    return "neutral_sans_core";
  }

  if (input.typographyRole === "quote" || input.typographyRole === "emotional-quote") {
    return "editorial_serif_support";
  }

  if (
    input.patternMood === "aggressive" &&
    input.wordCount <= 3 &&
    (input.motionTier === "hero" || input.mode === "keyword-only")
  ) {
    return "display_sans_pressure_release";
  }

  if (
    (input.typographyRole === "headline" ||
      input.typographyRole === "hook" ||
      input.typographyRole === "transition-card" ||
      input.typographyRole === "keyword" ||
      input.typographyRole === "cta") &&
    input.contentEnergy === "high" &&
    input.wordCount <= 4 &&
    input.patternMood !== "documentary"
  ) {
    return "hero_serif_alternate";
  }

  if (input.patternMood === "documentary" || input.patternMood === "emotional") {
    return "editorial_serif_support";
  }

  if (
    input.typographyRole === "headline" ||
    input.typographyRole === "hook" ||
    input.typographyRole === "transition-card" ||
    input.typographyRole === "keyword" ||
    input.typographyRole === "cta"
  ) {
    return input.mode === "normal" ? "neutral_sans_core" : "editorial_serif_support";
  }

  return "editorial_serif_support";
};

const inferIntensityBand = (input: RuntimeFontSelectionInput): TypographyIntensityBand => {
  if (
    input.contentEnergy === "high" ||
    (input.mode === "keyword-only" && input.wordCount <= 4) ||
    input.motionTier === "hero"
  ) {
    return "high";
  }

  if (
    input.contentEnergy === "low" &&
    input.mode === "normal" &&
    input.wordCount >= 4
  ) {
    return "low";
  }

  return "medium";
};

const inferMotionDemand = (input: RuntimeFontSelectionInput): RuntimeFontMotionDemand => {
  let demand = 0;

  if (input.motionTier === "premium") {
    demand = 1;
  }
  if (input.motionTier === "hero") {
    demand = 2;
  }
  if (input.patternUnit === "word") {
    demand = Math.max(demand, 1);
  }
  if (input.patternUnit === "letter" || input.patternUnit === "phrase" || input.mode === "keyword-only") {
    demand = Math.max(demand, 2);
  }
  if (input.presentationMode === "long-form" && input.typographyRole === "subtitle") {
    demand = Math.min(demand, 1);
  }

  if (demand >= 2) {
    return "high";
  }
  if (demand === 1) {
    return "medium";
  }
  return "low";
};

const getRuntimeCandidatesForRole = (roleId: TypographyRoleSlotId): TypographyFontCandidate[] => {
  const rankedStaticCandidates = rankTypographyCandidatesForRole(roleId)
    .map((node) => candidateById.get(node.id) ?? null)
    .filter((candidate): candidate is TypographyFontCandidate => {
      return Boolean(
        candidate &&
          candidate.stage !== "legacy" &&
          candidate.stage !== "rejected" &&
          getRuntimePaletteIdForTypographyCandidate(candidate.id)
      );
    });

  const rankedStaticCandidateIds = new Set(rankedStaticCandidates.map((candidate) => candidate.id));
  const dynamicCandidates = getDynamicManifestTypographyCandidates()
    .filter((candidate) => {
      return candidate.eligibleRoles.includes(roleId) &&
        !rankedStaticCandidateIds.has(candidate.id) &&
        candidate.stage !== "legacy" &&
        candidate.stage !== "rejected" &&
        getRuntimePaletteIdForTypographyCandidate(candidate.id);
    })
    .sort((left, right) => {
      const scoreDelta = (right.premiumSignal + right.restraintSignal) - (left.premiumSignal + left.restraintSignal);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    });

  return [...rankedStaticCandidates, ...dynamicCandidates];
};

export const TYPOGRAPHY_ROLE_FALLBACK_ORDER: Record<TypographyRoleSlotId, TypographyRoleSlotId[]> = {
  hero_serif_primary: ["hero_serif_alternate", "editorial_serif_support", "neutral_sans_core"],
  hero_serif_alternate: ["editorial_serif_support", "neutral_sans_core"],
  editorial_serif_support: ["neutral_sans_core"],
  neutral_sans_core: [],
  script_accent_rare: ["editorial_serif_support", "neutral_sans_core"],
  display_sans_pressure_release: ["neutral_sans_core", "editorial_serif_support"]
};

const resolveOperationalRoleId = (requestedRoleId: TypographyRoleSlotId): TypographyRoleSlotId => {
  if (getRuntimeCandidatesForRole(requestedRoleId).length > 0) {
    return requestedRoleId;
  }

  for (const fallbackRoleId of TYPOGRAPHY_ROLE_FALLBACK_ORDER[requestedRoleId]) {
    if (getRuntimeCandidatesForRole(fallbackRoleId).length > 0) {
      return fallbackRoleId;
    }
  }

  return "neutral_sans_core";
};

const resolveNearestAvailableWeight = (requested: number, available: number[]): {resolved: number; fauxBoldRisk: boolean} => {
  if (available.length === 0) {
    return {resolved: requested, fauxBoldRisk: true};
  }

  const sorted = [...available].sort((left, right) => Math.abs(left - requested) - Math.abs(right - requested));
  const nearest = sorted[0];
  const fauxBoldRisk = nearest !== requested && requested > Math.max(...available);

  return {resolved: nearest, fauxBoldRisk};
};

const scoreCandidate = ({
  candidate,
  roleId,
  rankIndex,
  intensityBand,
  motionDemand,
  input
}: {
  candidate: TypographyFontCandidate;
  roleId: TypographyRoleSlotId;
  rankIndex: number;
  intensityBand: TypographyIntensityBand;
  motionDemand: RuntimeFontMotionDemand;
  input: RuntimeFontSelectionInput;
}): {score: number; rationale: string[]} => {
  const paletteId = getRuntimePaletteIdForTypographyCandidate(candidate.id)!;
  const palette = getEditorialFontPalette(paletteId);
  const rationale: string[] = [];

  let score = Math.max(0, 7 - rankIndex) * 0.7;
  score += candidate.eligibleRoles.includes(roleId) ? 0.5 : 0;
  score += candidate.intensityFit.includes(intensityBand) ? 1.2 : -0.9;

  const motionDelta = toNumericBand(candidate.motionTolerance) - toNumericBand(motionDemand);
  if (motionDelta >= 0) {
    score += motionDelta === 0 ? 0.85 : 0.5;
  } else {
    score -= Math.abs(motionDelta) * 1.1;
  }

  score += palette.moodTags.includes(input.patternMood) ? 1.05 : 0;
  score += input.targetMoods.filter((mood) => palette.moodTags.includes(mood)).length * 0.3;
  score += paletteId === input.treatmentFontProfileHint ? 0.85 : 0;
  score += paletteId === input.treatmentFallbackFontProfileHint ? 0.35 : 0;

  // Balanced safety prior for DM Sans (singular neutral sans core)
  if (candidate.id === "dm-sans" && roleId === "neutral_sans_core") {
    score += 0.12; // Cap generic safety bonus to 0.12
    rationale.push("neutral-sans-safety-prior");
  }

  if (candidate.id === "crimson-pro" && (input.patternMood === "documentary" || input.patternMood === "emotional")) {
    score += 0.95;
  }
  if (candidate.id === "fraunces" && (input.patternMood === "luxury" || input.patternMood === "editorial" || input.patternMood === "cinematic")) {
    score += 0.7;
  }
  if (candidate.id === "instrument-serif" && (input.patternMood === "emotional" || input.patternMood === "luxury")) {
    score += 0.7;
  }
  if (candidate.id === "instrument-serif" && intensityBand === "high") {
    score -= 0.85;
  }
  if (candidate.id === "noto-serif-display" && intensityBand === "high" && input.wordCount <= 4) {
    score += 0.95;
  }
  if (candidate.id === "noto-serif-display" && input.surfaceTone === "light") {
    score -= 0.25;
  }
  if (candidate.id === "playfair-display" && intensityBand === "high") {
    score -= 0.45;
  }

  return {score, rationale};
};

export const selectRuntimeFontSelection = (input: RuntimeFontSelectionInput): RuntimeFontSelection & {
  requestedWeight: number;
  resolvedWeight: number;
  availableWeights: number[];
  fauxBoldRisk: boolean;
  graphUsageScore: number;
  genericFallbackRisk: boolean;
} => {
  const requestedRoleId = inferRequestedRoleId(input);
  const selectedRoleId = resolveOperationalRoleId(requestedRoleId);
  const intensityBand = inferIntensityBand(input);
  const motionDemand = inferMotionDemand(input);
  const candidates = getRuntimeCandidatesForRole(selectedRoleId);

  const rankedCandidates = candidates
    .map((candidate, rankIndex) => {
      const evaluation = scoreCandidate({
        candidate,
        roleId: selectedRoleId,
        rankIndex,
        intensityBand,
        motionDemand,
        input
      });
      return {
        candidate,
        score: evaluation.score,
        evaluationRationale: evaluation.rationale
      };
    })
    .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name));

  const selectedEntry = rankedCandidates[0];
  const selectedCandidate = selectedEntry?.candidate ?? candidateById.get("dm-sans")!;
  const fontPaletteId = getRuntimePaletteIdForTypographyCandidate(selectedCandidate.id) ?? "dm-sans-core";
  const palette = getEditorialFontPalette(fontPaletteId);

  // Phase 1: Resolve Weight
  const baseRequestedWeight = (input.mode === "keyword-only" || input.typographyRole === "headline" || input.typographyRole === "hook")
    ? palette.displayWeight
    : palette.supportWeight;
  const weightResolution = resolveNearestAvailableWeight(baseRequestedWeight, palette.availableWeights);

  const rationale = [
    `requested-role=${requestedRoleId}`,
    requestedRoleId !== selectedRoleId ? `role-fallback=${selectedRoleId}` : `selected-role=${selectedRoleId}`,
    `font-candidate=${selectedCandidate.id}`,
    `font-palette=${fontPaletteId}`,
    `font-intensity=${intensityBand}`,
    `font-motion-demand=${motionDemand}`,
    ...selectedEntry.evaluationRationale
  ];

  if (requestedRoleId === "display_sans_pressure_release" && selectedRoleId !== requestedRoleId) {
    rationale.push("pressure-release-runtime-face-missing");
  }
  if (requestedRoleId === "hero_serif_primary" && selectedRoleId !== requestedRoleId) {
    rationale.push("hero-primary-runtime-benchmark-missing");
  }

  return {
    requestedRoleId,
    selectedRoleId,
    fontCandidateId: selectedCandidate.id,
    fontPaletteId,
    palette,
    intensityBand,
    motionDemand,
    rationale,
    requestedWeight: baseRequestedWeight,
    resolvedWeight: weightResolution.resolved,
    availableWeights: palette.availableWeights,
    fauxBoldRisk: weightResolution.fauxBoldRisk,
    graphUsageScore: selectedEntry ? 1 : 0,
    genericFallbackRisk: selectedCandidate.id === "dm-sans" && requestedRoleId !== "neutral_sans_core"
  };
};
