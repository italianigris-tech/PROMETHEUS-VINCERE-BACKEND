import {
  joinShortsTextTokens,
  MAUL_TEXT_ANIMATION_TREATMENTS,
  maulAdapterDecisionPayloadSchema,
  maulArtDirectionPlanPayloadSchema,
  maulCandidateNarrativePayloadSchema,
  maulCapabilitySelectionPayloadSchema,
  maulContextAssemblyPlanPayloadSchema,
  maulDialogueAudioPlanPayloadSchema,
  maulEditorialBeatMapPayloadSchema,
  maulFramingCameraPlanPayloadSchema,
  maulObservationSnapshotPayloadSchema,
  maulPlanningBundlePayloadSchema,
  maulPlanningBundleV1PayloadSchema,
  maulRevisionPlanPayloadSchema,
  maulShotIntentMatrixPayloadSchema,
  maulTextChunkPlanPayloadSchema,
  maulTextAnimationPlanPayloadSchema,
  maulTextOpportunityPlanPayloadSchema,
  maulTextPlacementPlanPayloadSchema,
  maulTypographyMotionPlanPayloadSchema,
  maulTypographyMotionPlanV1PayloadSchema,
  maulUnifiedShortRenderManifestSchema,
  maulVisualPlanPayloadSchema,
  type MaulRenderLayerPolicy,
  type MaulArtifactRecord,
  type MaulChunkTypographyBinding,
  type MaulPlanningBundlePayload,
  type MaulPlanningBundleV1Payload,
  type MaulProject,
  type MaulShortRenderRequest,
  type MaulUnifiedShortRenderManifest,
  type MaulVisualAssetPack,
  type MaulVisualTrack,
  type MaulShortsTextChunkPlanV2Core,
  type MaulTextChunkPlanPayload,
  type MaulTextAnimationPlanPayload,
  type MaulTextAnimationProgram,
  type MaulTextAnimationTreatment,
  type MaulTextPlacementPlanCore,
  type MaulTextPlacementPlanPayload,
  type MaulTypographyMotionPlanV1Payload,
  type ShortsTextChunkPlan,
} from "@prometheus/shared-types";

import type {ReferenceEditorialRhythm} from "./reference-editorial-rhythm.js";

import type { VideoAwareAudioPlan } from "../music/index.js";
import type { MaulRenderCaption } from "./render-engine.js";
import {
  hashMaulPlanPayload,
  materializeMaulTextChunkPlanV2,
  type MaulMappedTranscriptWord,
} from "./text-chunk-plan.js";
import {
  assertMaulTypographyPlacementCompatibility,
  buildMaulTextPlacementPlan,
  type MaulPlacementObservationInterval,
} from "./shorts-text-placement.js";
import {assertTypographyProfileManifestLineage} from "./typography-profile-manifest-contract.js";
import {buildMaulVisualTrack} from "./visual-track.js";
import {
  compileMaulWordMotion,
  getMaulMotionCapability,
} from "./frame-motion-compiler.js";

export {hashMaulPlanPayload} from "./text-chunk-plan.js";

export const MAUL_V3_NATIVE_RENDER_BRANCHES = {
  textAnimation: "MaulPlannedTextLayer.governedTransforms",
  camera: "MaulShort.SourceSegment.globalCameraScale",
} as const;

type SourceArtifact = Extract<
  MaulArtifactRecord,
  { artifactType: "source_asset" }
>;
type AnalysisArtifact = Extract<
  MaulArtifactRecord,
  { artifactType: "analysis" }
>;
type TimelineArtifact = Extract<
  MaulArtifactRecord,
  { artifactType: "editorial_timeline" }
>;
type CandidateArtifact = Extract<
  MaulArtifactRecord,
  { artifactType: "candidate" }
>;
type TreatmentArtifact = Extract<
  MaulArtifactRecord,
  { artifactType: "treatment_genome" }
>;
type ReferenceCorpusArtifact = Extract<
  MaulArtifactRecord,
  { artifactType: "reference_corpus_item" }
>;
type TextChunkPlanArtifact = Extract<
  MaulArtifactRecord,
  {artifactType: "text_chunk_plan"}
>;
type TextPlacementPlanArtifact = Extract<
  MaulArtifactRecord,
  {artifactType: "text_placement_plan"}
>;

export type MaulPlanningInputs = {
  project: MaulProject;
  source: SourceArtifact;
  analysis: AnalysisArtifact;
  timeline: TimelineArtifact;
  candidate: CandidateArtifact;
  treatment: TreatmentArtifact;
  referenceCorpus?: ReferenceCorpusArtifact[];
  textChunkPlan: ShortsTextChunkPlan | null;
  visualAssetPack?: MaulVisualAssetPack | null;
};

export type MaulTypographyPlanningResolution = {
  fontResolution: {
    requestedRole: "display" | "editorial" | "utility";
    selectedFamily: string;
    selectedAssetId: string | null;
    status: "eligible_loaded" | "governed_fallback" | "blocked";
    reason: string;
  };
  chunkTypographyBindings?: MaulChunkTypographyBinding[];
  measurementEvidenceIds: string[];
  warnings?: string[];
};

const stableHash = hashMaulPlanPayload;

const executionNative = (
  nativeBranch: string,
  evidenceRequirement: string,
) => ({
  executionStatus: "native" as const,
  nativeBranch,
  fallback: null,
  evidenceRequirement,
});

const executionFallback = (fallback: string, evidenceRequirement: string) => ({
  executionStatus: "governed_fallback" as const,
  nativeBranch: null,
  fallback,
  evidenceRequirement,
});

const basePlan = (inputs: MaulPlanningInputs, planVersion: string) => ({
  sourceAssetId: inputs.source.artifactId,
  analysisArtifactId: inputs.analysis.artifactId,
  timelineArtifactId: inputs.timeline.artifactId,
  candidateArtifactId: inputs.candidate.artifactId,
  treatmentGenomeArtifactId: inputs.treatment.artifactId,
  planVersion,
  replayKey: stableHash({
    planVersion,
    sourceSha256: inputs.source.payload.sha256,
    timelineArtifactId: inputs.timeline.artifactId,
    candidateArtifactId: inputs.candidate.artifactId,
    treatmentReplayKey: inputs.treatment.payload.replayKey,
    textChunkPlanHash: inputs.textChunkPlan
      ? stableHash(inputs.textChunkPlan)
      : null,
  }),
  authority: {
    authorityClass: "deterministic" as const,
    stageId: planVersion.replaceAll("/", "_"),
    confidence: 0.72,
    inferenceReceiptId: null,
  },
  warnings: [] as string[],
  fallbacks: [
    {
      condition: "A richer mandatory dependency is unavailable or unverified.",
      action:
        "Use the named restrained fallback and keep the release quality gate closed.",
      status: "available" as const,
    },
  ],
});

export const buildMaulTextChunkPlanPayload = ({
  inputs,
  core,
}: {
  inputs: MaulPlanningInputs;
  core: MaulShortsTextChunkPlanV2Core;
}): MaulTextChunkPlanPayload =>
  maulTextChunkPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-shorts-text-chunk-plan/v2"),
    ...core,
  });

export const buildMaulTextPlacementPlanPayload = ({
  inputs,
  core,
}: {
  inputs: MaulPlanningInputs;
  core: MaulTextPlacementPlanCore;
}): MaulTextPlacementPlanPayload =>
  maulTextPlacementPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-text-placement-plan/v1"),
    ...core,
  });

const identityTransform = {
  opacity: 1,
  translateXPx: 0,
  translateYPx: 0,
  scale: 1,
} as const;

const MAUL_POSITION_LOCKED_SOURCE_TREATMENTS = MAUL_TEXT_ANIMATION_TREATMENTS.filter(
  (treatment) =>
    treatment !== "position_locked_word_reveal" &&
    treatment !== "position_locked_letter_reveal" &&
    getMaulMotionCapability(treatment) !== null,
);
const selectEditorialTreatment = ({candidates, seed}: {candidates: readonly MaulTextAnimationTreatment[]; seed: string}): MaulTextAnimationTreatment => {
  if (candidates.length === 0) {
    throw new Error("MAUL animation selection requires at least one treatment.");
  }
  return candidates[Number.parseInt(stableHash(seed).slice(0, 8), 16) % candidates.length]!;
};

const treatmentsForWordCount = ({
  candidates,
  wordCount,
}: {
  candidates: readonly MaulTextAnimationTreatment[];
  wordCount: number;
}): readonly MaulTextAnimationTreatment[] => {
  const prefix =
    wordCount === 1
      ? "generic_single_word"
      : wordCount === 2
        ? "two_word_"
        : wordCount === 3
          ? "three_word_"
          : wordCount === 4
            ? "four_word_"
            : "six_word_";
  const compatible = candidates.filter((candidate) =>
    prefix === "generic_single_word"
      ? candidate === "generic_single_word" || candidate === "single-word-elastic-emphasis"
      : candidate.startsWith(prefix),
  );
  return compatible.length > 0 ? compatible : candidates;
};

const referenceTraitText = (inputs: MaulPlanningInputs): string =>
  (inputs.referenceCorpus ?? [])
    .flatMap((reference) => [
      ...(reference.payload.approvedTraits?.typography ?? []),
      ...(reference.payload.approvedTraits?.motion ?? []),
      ...(reference.payload.approvedTraits?.captions ?? []),
    ])
    .join(" ")
    .toLowerCase();

const preferredReferenceTreatment = ({
  inputs,
  wordCount,
  candidates,
}: {
  inputs: MaulPlanningInputs;
  wordCount: number;
  candidates: readonly MaulTextAnimationTreatment[];
}): MaulTextAnimationTreatment | null => {
  if (wordCount !== 3) return null;
  const traits = referenceTraitText(inputs);
  if (/script|calligraph/.test(traits) && candidates.includes("three_word_script_glide")) {
    return "three_word_script_glide";
  }
  if (/tall|condensed|blade/.test(traits) && candidates.includes("three_word_tall_blade")) {
    return "three_word_tall_blade";
  }
  return null;
};

const positionLockedRevealFor = ({
  sourceTreatment,
  choreographyMode,
  tokenCount,
  entryDurationMs,
}: {
  sourceTreatment: MaulTextAnimationTreatment;
  choreographyMode?: string;
  tokenCount: number;
  entryDurationMs: number;
}) => {
  const treatment = sourceTreatment.toLowerCase();
  const unit =
    choreographyMode === "position_locked_letter_reveal" ||
    sourceTreatment === "position_locked_letter_reveal" ||
    /letter|tracking|typewriter|scramble|shimmer|rain/.test(treatment)
      ? "letter" as const
      : "word" as const;
  const primitive = /tracking|compression|typewriter|scramble/.test(treatment)
    ? "blur_tracking" as const
    : /blur|focus|whisper|depth|bloom/.test(treatment)
      ? "blur" as const
      : /mask|slit|crop|underline|highlight|sweep|push|slide|drift|arc|orbit|parallax/.test(treatment)
        ? "clip" as const
        : /pop|punch|impact|elastic|emphasis|lock/.test(treatment)
          ? "scale_focus" as const
          : "opacity" as const;
  const safeTokenCount = Math.max(1, tokenCount);
  const tokenStaggerMs = safeTokenCount === 1
    ? 0
    : Math.min(
        unit === "letter" ? 52 : 72,
        Math.max(0, Math.floor((entryDurationMs - 1) / (safeTokenCount - 1))),
      );
  const durationMs = Math.max(
    1,
    entryDurationMs - tokenStaggerMs * (safeTokenCount - 1),
  );
  return {
    unit,
    primitive,
    sourceTreatment,
    tokenStaggerMs,
    letterStaggerMs: unit === "letter" ? Math.min(24, Math.floor(durationMs / 4)) : 0,
    durationMs,
    blurPx: primitive === "blur" || primitive === "blur_tracking" ? 8 : 0,
    trackingEm: primitive === "blur_tracking" ? 0.08 : 0,
    startScale: primitive === "scale_focus" ? 0.94 : unit === "letter" ? 0.98 : 1,
  };
};

const positionLockedTransforms = {
  entry: {from: identityTransform, to: identityTransform},
  hold: {from: identityTransform, to: identityTransform},
  exit: {from: identityTransform, to: {...identityTransform, opacity: 0}},
} as const;

export const buildMaulTextAnimationPlanPayload = ({
  inputs,
  textChunkPlan,
  textPlacementPlan,
  treatment,
  referenceEditorialRhythm,
  selectionSeed,
  outputDurationMs,
  fps = 30,
}: {
  inputs: MaulPlanningInputs;
  textChunkPlan: TextChunkPlanArtifact;
  textPlacementPlan: TextPlacementPlanArtifact;
  treatment?: MaulTextAnimationTreatment;
  referenceEditorialRhythm?: ReferenceEditorialRhythm;
  selectionSeed?: string;
  outputDurationMs: number;
  fps?: number;
}): MaulTextAnimationPlanPayload => {
  if (textPlacementPlan.payload.status === "blocked") {
    throw new Error(
      `Text placement is blocked: ${
        textPlacementPlan.payload.blockingReason ?? "unknown_placement_failure"
      }`,
    );
  }
  const chunkById = new Map(
    textChunkPlan.payload.chunks.map((chunk) => [chunk.chunkId, chunk]),
  );
  const tokenById = new Map(
    textChunkPlan.payload.tokens.map((token) => [token.tokenId, token]),
  );
  const rhythmBySegmentId = new Map(
    referenceEditorialRhythm?.segments.map((segment) => [
      segment.segmentId,
      segment,
    ]) ?? [],
  );
  let previousSupportingTreatment: MaulTextAnimationTreatment | null = null;
  const programs = textPlacementPlan.payload.segments.flatMap<MaulTextAnimationProgram>((segment) => {
    const durationMs = segment.outputEndMs - segment.outputStartMs;
    const chunk = chunkById.get(segment.chunkId);
    if (!chunk) {
      throw new Error(
        `Placement ${segment.segmentId} references missing chunk ${segment.chunkId}.`,
      );
    }
    const rhythmSegment = referenceEditorialRhythm
      ? rhythmBySegmentId.get(segment.segmentId)
      : undefined;
    if (referenceEditorialRhythm && !rhythmSegment) {
      throw new Error(
        `Reference editorial rhythm does not cover placement ${segment.segmentId}.`,
      );
    }
    const supportingCandidates = treatmentsForWordCount({
      candidates: MAUL_POSITION_LOCKED_SOURCE_TREATMENTS.filter(
        (candidate) => candidate !== previousSupportingTreatment,
      ),
      wordCount: segment.tokenIds.length,
    });
    const preferredTreatment = rhythmSegment?.treatment ?? treatment ??
      preferredReferenceTreatment({
        inputs,
        wordCount: segment.tokenIds.length,
        candidates: supportingCandidates,
      }) ??
      selectEditorialTreatment({
        candidates: supportingCandidates,
        seed: `${selectionSeed ?? inputs.project.id}:${segment.segmentId}:supporting`,
      });
    const timedTokens = segment.tokenIds.map((tokenId) => tokenById.get(tokenId));
    const hasAuthoritativeTokenTiming = timedTokens.every((token) =>
      token !== undefined &&
      typeof token.text === "string" &&
      typeof token.sourceStartMs === "number" &&
      typeof token.sourceEndMs === "number" &&
      Array.isArray(token.outputSpans) &&
      token.outputSpans.length > 0
    );
    const selectedTreatment = hasAuthoritativeTokenTiming &&
      getMaulMotionCapability(preferredTreatment) === null
      ? selectEditorialTreatment({
          candidates: supportingCandidates,
          seed: `${selectionSeed ?? inputs.project.id}:${segment.segmentId}:executable-motion`,
        })
      : preferredTreatment;
    const treatmentSelectionNote = selectedTreatment !== preferredTreatment
      ? ` Requested treatment ${preferredTreatment} is not an executable frame source; selected ${selectedTreatment} from the governed capability registry.`
      : "";
    previousSupportingTreatment = selectedTreatment;
    if (hasAuthoritativeTokenTiming) {
      return timedTokens.flatMap((token) => {
        if (!token) return [];
        const relevantSpans = token.outputSpans.flatMap((span, spanIndex) => {
          const outputStartMs = Math.max(segment.outputStartMs, span.outputStartMs);
          const outputEndMs = Math.min(segment.outputEndMs, span.outputEndMs);
          return outputEndMs > outputStartMs
            ? [{outputStartMs, outputEndMs, spanIndex}]
            : [];
        });
        if (relevantSpans.length === 0) {
          throw new Error(
            `Animation ${segment.segmentId} has no output span for stable token ${token.tokenId}.`,
          );
        }
        return relevantSpans.map(({outputStartMs, outputEndMs, spanIndex}) => {
          const frameMotion = compileMaulWordMotion({
            treatmentId: selectedTreatment,
            token: {
              tokenId: token.tokenId,
              text: token.text,
              sourceStartMs: token.sourceStartMs,
              sourceEndMs: token.sourceEndMs,
            },
            outputStartMs,
            outputEndMs,
            fps,
            placementSegmentId: segment.segmentId,
          });
          const toOutputMs = (frame: number) => Math.round((frame / fps) * 1000);
          return {
            animationId: `maul_text_animation_${segment.segmentId}_${token.tokenId}_${spanIndex}`,
            treatment: selectedTreatment,
            executorId: frameMotion.executorId,
            frameMotion,
            target: {
              scope: "tokens" as const,
              placementSegmentId: segment.segmentId,
              tokenIds: [token.tokenId],
            },
            phases: {
              entry: {
                outputStartMs: toOutputMs(frameMotion.phases.entry.startFrame),
                outputEndMs: toOutputMs(frameMotion.phases.entry.endFrame),
                easing: frameMotion.phases.entry.easing,
                from: identityTransform,
                to: identityTransform,
              },
              hold: {
                outputStartMs: toOutputMs(frameMotion.phases.hold.startFrame),
                outputEndMs: toOutputMs(frameMotion.phases.hold.endFrame),
                easing: frameMotion.phases.hold.easing,
                from: identityTransform,
                to: identityTransform,
              },
              exit: {
                outputStartMs: toOutputMs(frameMotion.phases.exit.startFrame),
                outputEndMs: toOutputMs(frameMotion.phases.exit.endFrame),
                easing: frameMotion.phases.exit.easing,
                from: identityTransform,
                to: identityTransform,
              },
            },
            rationale: `Execute ${selectedTreatment} for stable token ${token.tokenId} from its authoritative transcript interval.${treatmentSelectionNote}`,
          };
        });
      });
    }
    if (durationMs < 3) {
      throw new Error(
        `Placement ${segment.segmentId} is too short for explicit entry, hold, and exit intervals.`,
      );
    }
    const phaseRatio = rhythmSegment?.preserveReadableHold ? 0.15 : 0.2;
    const entryDurationMs = Math.max(1, Math.floor(durationMs * phaseRatio));
    const exitDurationMs = Math.max(1, Math.floor(durationMs * phaseRatio));
    const entryEndMs = segment.outputStartMs + entryDurationMs;
    const exitStartMs = segment.outputEndMs - exitDurationMs;
    if (entryEndMs >= exitStartMs) {
      throw new Error(
        `Placement ${segment.segmentId} cannot fit non-overlapping animation phases.`,
      );
    }
    const tokenIds = segment.tokenIds;
    if (tokenIds.length === 0) {
      throw new Error(
        `Animation ${segment.segmentId} has no stable target tokens.`,
      );
    }
    const localReveal = positionLockedRevealFor({
      sourceTreatment: selectedTreatment,
      choreographyMode: segment.editorialLockup?.choreography.mode,
      tokenCount: tokenIds.length,
      entryDurationMs,
    });
    const lockedTreatment = localReveal.unit === "letter"
      ? "position_locked_letter_reveal" as const
      : "position_locked_word_reveal" as const;
    const transforms = positionLockedTransforms;
    const entryEasing = {
      type: "cubic_bezier" as const,
      x1: 0.16,
      y1: 1,
      x2: 0.3,
      y2: 1,
    };
    const exitEasing = {
      type: "cubic_bezier" as const,
      x1: 0.4,
      y1: 0,
      x2: 1,
      y2: 1,
    };
    return [{
      animationId: `maul_text_animation_${segment.segmentId}`,
      treatment: lockedTreatment,
      target: {
        scope: "tokens" as const,
        placementSegmentId: segment.segmentId,
        tokenIds,
      },
      localReveal,
      phases: {
        entry: {
          outputStartMs: segment.outputStartMs,
          outputEndMs: entryEndMs,
          easing: entryEasing,
          ...transforms.entry,
        },
        hold: {
          outputStartMs: entryEndMs,
          outputEndMs: exitStartMs,
          easing: {type: "linear" as const},
          ...transforms.hold,
        },
        exit: {
          outputStartMs: exitStartMs,
          outputEndMs: segment.outputEndMs,
          easing: exitEasing,
          ...transforms.exit,
        },
      },
      rationale: `${rhythmSegment
        ? `Resolve the reference-derived ${selectedTreatment} rhythm inside fixed ${localReveal.unit} boxes.`
        : `Resolve the governed ${selectedTreatment} treatment inside fixed ${localReveal.unit} boxes.`}${treatmentSelectionNote}`,
    }];
  });
  const editorialPrograms = programs;
  const references = {
    textChunkPlanArtifactId: textChunkPlan.artifactId,
    textChunkPlanHash: stableHash(textChunkPlan.payload),
    textPlacementPlanArtifactId: textPlacementPlan.artifactId,
    textPlacementPlanHash: stableHash(textPlacementPlan.payload),
  };
  const treatmentGenomeHash = stableHash(inputs.treatment.payload);
  const plan = {
    ...basePlan(inputs, "maul-text-animation-plan/v1"),
    schemaVersion: "maul-text-animation-plan/v1" as const,
    ...references,
    treatmentGenomeArtifactId: inputs.treatment.artifactId,
    treatmentGenomeHash,
    outputDurationMs,
    programs: editorialPrograms,
    inputHashes: {
      textChunkPlan: references.textChunkPlanHash,
      textPlacementPlan: references.textPlacementPlanHash,
      treatmentGenome: treatmentGenomeHash,
    },
  };
  return maulTextAnimationPlanPayloadSchema.parse({
    ...plan,
    replayKey: stableHash(plan),
  });
};

type MaulV3TextAnimationReferenceSet = {
  textChunk: {artifactId: string; payload: unknown};
  textPlacement: {artifactId: string; payload: unknown};
  treatmentGenome: {artifactId: string; payload: unknown};
  textAnimation: {
    artifactId: string;
    payload: {
      textChunkPlanArtifactId: string;
      textChunkPlanHash: string;
      textPlacementPlanArtifactId: string;
      textPlacementPlanHash: string;
      treatmentGenomeArtifactId: string;
      treatmentGenomeHash: string;
    };
  };
  typographyMotion: {
    payload: {
      textChunkPlanArtifactId: string;
      textChunkPlanHash: string;
      textPlacementPlanArtifactId: string;
      textPlacementPlanHash: string;
      textAnimationPlanArtifactId: string;
      textAnimationPlanHash: string;
    };
  };
};

export const assertMaulV3TextAnimationReferences = (
  artifacts: MaulV3TextAnimationReferenceSet,
): void => {
  const textChunkPlanHash = stableHash(artifacts.textChunk.payload);
  const textPlacementPlanHash = stableHash(artifacts.textPlacement.payload);
  const treatmentGenomeHash = stableHash(artifacts.treatmentGenome.payload);
  const textAnimationPlanHash = stableHash(artifacts.textAnimation.payload);
  const typography = artifacts.typographyMotion.payload;
  const animation = artifacts.textAnimation.payload;
  if (
    typography.textChunkPlanArtifactId !== artifacts.textChunk.artifactId ||
    typography.textChunkPlanHash !== textChunkPlanHash ||
    typography.textPlacementPlanArtifactId !==
      artifacts.textPlacement.artifactId ||
    typography.textPlacementPlanHash !== textPlacementPlanHash ||
    typography.textAnimationPlanArtifactId !==
      artifacts.textAnimation.artifactId ||
    typography.textAnimationPlanHash !== textAnimationPlanHash ||
    animation.textChunkPlanArtifactId !== artifacts.textChunk.artifactId ||
    animation.textChunkPlanHash !== textChunkPlanHash ||
    animation.textPlacementPlanArtifactId !==
      artifacts.textPlacement.artifactId ||
    animation.textPlacementPlanHash !== textPlacementPlanHash ||
    animation.treatmentGenomeArtifactId !==
      artifacts.treatmentGenome.artifactId ||
    animation.treatmentGenomeHash !== treatmentGenomeHash
  ) {
    throw new Error(
      "V3 manifest compilation rejected a stale parent hash or mismatched animation reference.",
    );
  }
};

export type MaulPlanningV2References = {
  textChunkPlanArtifactId: string;
  textChunkPlanHash: string;
  textPlacementPlanArtifactId: string;
  textPlacementPlanHash: string;
};

export type MaulPlanningV3References = MaulPlanningV2References & {
  textAnimationPlanArtifactId: string;
  textAnimationPlanHash: string;
};

const wordsForCandidate = (inputs: MaulPlanningInputs) =>
  inputs.analysis.payload.transcript.words.filter(
    (word) =>
      word.endMs > inputs.candidate.payload.sourceStartMs &&
      word.startMs < inputs.candidate.payload.sourceEndMs,
  );

const textOf = (words: ReturnType<typeof wordsForCandidate>): string =>
  words
    .map((word) => word.text)
    .join(" ")
    .trim();

export const mapMaulSourceMsToOutput = (
  timestampMap: TimelineArtifact["payload"]["timestampMap"],
  sourceMs: number,
): number | null => {
  for (const segment of timestampMap) {
    if (
      segment.mode !== "cut" &&
      sourceMs >= segment.sourceStartMs &&
      sourceMs <= segment.sourceEndMs
    ) {
      return Math.round(
        segment.outputStartMs +
          (sourceMs - segment.sourceStartMs) *
            ((segment.outputEndMs - segment.outputStartMs) /
              (segment.sourceEndMs - segment.sourceStartMs)),
      );
    }
  }
  return null;
};

export const mapMaulTranscriptWordsToOutput = ({
  timestampMap,
  words,
}: {
  timestampMap: TimelineArtifact["payload"]["timestampMap"];
  words: readonly (AnalysisArtifact["payload"]["transcript"]["words"][number] & {
    transcriptWordIndex?: number;
  })[];
}): MaulMappedTranscriptWord[] => {
  if (words.length === 0) {
    throw new Error("The selected transcript contains no words to chunk.");
  }

  let previousSourceEndMs = -1;
  let previousOutputEndMs = -1;
  return words.map((word, wordIndex) => {
    if (!word.text.trim()) {
      throw new Error(`Transcript word ${wordIndex} is empty.`);
    }
    if (word.endMs <= word.startMs) {
      throw new Error(
        `Transcript word ${wordIndex} must have positive duration.`,
      );
    }
    if (word.startMs < previousSourceEndMs) {
      throw new Error(
        `Transcript word ${wordIndex} overlaps the preceding source word.`,
      );
    }

    const outputSpans = timestampMap
      .filter((segment) => segment.mode !== "cut")
      .map((segment) => {
        const sourceStartMs = Math.max(word.startMs, segment.sourceStartMs);
        const sourceEndMs = Math.min(word.endMs, segment.sourceEndMs);
        if (sourceEndMs <= sourceStartMs) return null;
        const sourceDurationMs = segment.sourceEndMs - segment.sourceStartMs;
        const outputDurationMs = segment.outputEndMs - segment.outputStartMs;
        const outputStartMs = Math.round(
          segment.outputStartMs +
            (sourceStartMs - segment.sourceStartMs) *
              (outputDurationMs / sourceDurationMs),
        );
        const outputEndMs = Math.round(
          segment.outputStartMs +
            (sourceEndMs - segment.sourceStartMs) *
              (outputDurationMs / sourceDurationMs),
        );
        return outputEndMs > outputStartMs
          ? {outputStartMs, outputEndMs}
          : null;
      })
      .filter(
        (span): span is {outputStartMs: number; outputEndMs: number} =>
          span !== null,
      );
    const firstSpan = outputSpans[0];
    const lastSpan = outputSpans.at(-1);
    if (!firstSpan || !lastSpan) {
      throw new Error(
        `Transcript word ${wordIndex} does not intersect the kept output timeline.`,
      );
    }
    const startMs = firstSpan.outputStartMs;
    const endMs = lastSpan.outputEndMs;
    if (endMs <= startMs) {
      throw new Error(
        `Transcript word ${wordIndex} has no positive output duration.`,
      );
    }
    if (startMs < previousOutputEndMs) {
      throw new Error(
        `Transcript word ${wordIndex} overlaps the preceding output word.`,
      );
    }

    previousSourceEndMs = word.endMs;
    previousOutputEndMs = endMs;
    return {
      transcriptWordIndex:
        "transcriptWordIndex" in word &&
        typeof word.transcriptWordIndex === "number"
          ? word.transcriptWordIndex
          : wordIndex,
      text: word.text,
      confidence: word.confidence,
      sourceStartMs: word.startMs,
      sourceEndMs: word.endMs,
      outputSpans,
      startMs,
      endMs,
    };
  });
};

export const buildMaulConservativePlacementInputs = (
  timeline: TimelineArtifact["payload"],
  observedIntervals: readonly MaulPlacementObservationInterval[] = [],
): {
  compositionIntervals: MaulTextPlacementPlanCore["compositionIntervals"];
  observationIntervals: MaulPlacementObservationInterval[];
  geometryResetOutputMs: number[];
} => {
  const fallbackBand = {x: 0.08, y: 0.74, width: 0.84, height: 0.14};
  const keptIntervals = timeline.timestampMap.filter(
    (segment) => segment.mode !== "cut",
  );
  const observationFor = (sceneId: string, segment: (typeof keptIntervals)[number]) =>
    observedIntervals.find(
      (observation) =>
        observation.sceneId === sceneId &&
        observation.outputStartMs <= segment.outputStartMs &&
        observation.outputEndMs >= segment.outputEndMs &&
        observation.cutEvidenceStatus === "known" &&
        (observation.trackingState === "tracked" ||
          observation.trackingState === "held" ||
          observation.trackingState === "absent_confirmed"),
    ) ?? null;
  const compositionIntervals = keptIntervals.map((segment, index) => {
    const cropTrack = timeline.speakerCropTracks.find(
      (track) =>
        track.outputStartMs <= segment.outputStartMs &&
        track.outputEndMs >= segment.outputEndMs,
    );
    const sceneId = `maul_scene_${index + 1}`;
    const discontinuityId = `maul_discontinuity_${index + 1}`;
    const observation = observationFor(sceneId, segment);
    const subjectBox = observation?.subjectBox ?? null;
    const subjectCenter = subjectBox ? subjectBox.x + subjectBox.width / 2 : 0.5;
    const hasKnownSourceEvidence = Boolean(observation);
    const textBox = hasKnownSourceEvidence
      ? {
          x: subjectCenter <= 0.5 ? 0.52 : 0.08,
          y: 0.18,
          width: 0.4,
          height: 0.26,
        }
      : null;
    const transform = {
      sceneId,
      discontinuityId,
      sourceStartMs: segment.sourceStartMs,
      sourceEndMs: segment.sourceEndMs,
      outputStartMs: segment.outputStartMs,
      outputEndMs: segment.outputEndMs,
      crop: cropTrack?.crop ?? {x: 0, y: 0, width: 1, height: 1},
      paddingMode: hasKnownSourceEvidence
        ? "governed_subject_relative_source_placement"
        : "caption_safe_non_source_band",
    };
    return {
      intervalId: hasKnownSourceEvidence
        ? `maul_observed_subject_interval_${index + 1}`
        : `maul_caption_safe_interval_${index + 1}`,
      sceneId,
      discontinuityId,
      variantId: hasKnownSourceEvidence
        ? "governed_observation.editorial_asymmetry"
        : "caption_safe_fallback",
      outputStartMs: segment.outputStartMs,
      outputEndMs: segment.outputEndMs,
      transformHash: hashMaulPlanPayload(transform),
      sourceViewport: {x: 0, y: 0, width: 1, height: 1},
      sourceOccupancy: [{x: 0, y: 0, width: 1, height: 0.72}],
      paddedNonSourceRegions: hasKnownSourceEvidence ? [] : [fallbackBand],
      compositionDirection: hasKnownSourceEvidence
        ? ("editorial_asymmetry" as const)
        : null,
      textAnchor: textBox
        ? {
            box: textBox,
            maximumEnvelope: {
              x: textBox.x - 0.02,
              y: textBox.y - 0.02,
              width: textBox.width + 0.04,
              height: textBox.height + 0.04,
            },
            alignment: subjectCenter <= 0.5 ? ("left" as const) : ("right" as const),
          }
        : null,
      crop: transform.crop,
      scale: {x: 1, y: 1},
    };
  });
  return {
    compositionIntervals,
    observationIntervals: compositionIntervals.map((interval) =>
      observedIntervals.find(
        (observation) =>
          observation.sceneId === interval.sceneId &&
          observation.outputStartMs <= interval.outputStartMs &&
          observation.outputEndMs >= interval.outputEndMs,
      ) ?? {
        evidenceId: `${interval.intervalId}_unknown_evidence`,
        sceneId: interval.sceneId,
        outputStartMs: interval.outputStartMs,
        outputEndMs: interval.outputEndMs,
        trackingState: "unknown" as const,
        subjectBox: null,
        cutEvidenceStatus: "unknown" as const,
        existingTextRegions: [],
      },
    ),
    geometryResetOutputMs: keptIntervals
      .slice(1)
      .map((segment) => segment.outputStartMs),
  };
};

export const buildMaulArtDirectionPlanPayload = (
  inputs: MaulPlanningInputs,
) => maulArtDirectionPlanPayloadSchema.parse({
  ...basePlan(inputs, "maul-art-direction-plan/v1"),
  schemaVersion: "maul-art-direction-plan/v1",
  audienceIntent: `Help ${inputs.project.intake.platform} viewers understand the selected idea immediately while preserving the speaker's authority.`,
  emotionalTemperature:
    inputs.treatment.payload.treatmentId === "premium_direct_response"
      ? "urgent_confident"
      : inputs.treatment.payload.treatmentId === "founder_podcast"
        ? "warm_intimate"
        : "calm_authoritative",
  sourceRespectStance:
    "Treat the principal speaker as the factual and visual anchor; never manufacture emotion, claims, or evidence.",
  theme: `${inputs.treatment.payload.catalogEntryName}: one clear idea moving from hook to earned payoff.`,
  paletteIntent: [
    "Warm neutral source image",
    "High-contrast ivory typography",
    "Restrained amber accent reserved for hierarchy",
  ],
  typeRoles: [
    {
      role: "dialogue_caption",
      intent: "Fast, legible transcription that remains subordinate to the speaker.",
    },
    {
      role: "editorial_hero",
      intent: "Withheld until a governed editorial-writing capability can support it.",
    },
    {role: "utility", intent: "Quiet provenance and platform-safe information only."},
  ],
  layoutAndNegativeSpaceLogic:
    "Keep the speaker in the dominant portrait field and reserve a stable lower-third safe region; never fill negative space merely to create activity.",
  imageryAndBackgroundLanguage:
    "Use only authoritative source pixels in this pass, with restrained tonal shaping and no unlicensed B-roll or reference-image pixels.",
  cameraBehavior:
    "Continuous, motivated portrait reframing with small pushes at rhetorical turns and settled motion through protected pauses.",
  motionPhysics:
    "Critically damped caption entry, continuous camera state, and no decorative overshoot that competes with speech.",
  annotationGrammar:
    "Annotations are unavailable and therefore withheld; any future mark must point to source-supported evidence.",
  soundWorld:
    "Dialogue-first mix with restrained licensed music and sparse event-specific SFX only when a verified timing intent exists.",
  motifArc: {
    introduction: "Introduce the amber accent once as the hook establishes the idea.",
    development: "Reduce the accent while the speaker carries proof and context.",
    recall: "Return the same accent at the payoff without adding a new motif.",
  },
  treatmentVariation: `Apply the ${inputs.treatment.payload.treatmentId} treatment through governed framing, pacing, audio, and hierarchy inputs, not through silent intent changes.`,
  explicitProhibitions: [
    "No reference-image pixels in the render.",
    "No unlicensed evidence, B-roll, music, or SFX.",
    "No kinetic typography spam or word-by-word novelty motion.",
    "No unsupported factual, emotional, or causal claim.",
  ],
});

export const buildMaulPlanningPayloads = (
  inputs: MaulPlanningInputs,
  v2References?: MaulPlanningV2References | MaulPlanningV3References,
  typographyResolution?: MaulTypographyPlanningResolution,
) => {
  const isV3 =
    v2References !== undefined &&
    "textAnimationPlanArtifactId" in v2References;
  const candidateWords = wordsForCandidate(inputs);
  const midpoint = Math.max(1, Math.ceil(candidateWords.length / 2));
  const narrativeGroups = [
    { role: "hook" as const, words: candidateWords.slice(0, midpoint) },
    { role: "payoff" as const, words: candidateWords.slice(midpoint) },
  ].filter((group) => group.words.length > 0);
  const nonCutSegments = inputs.timeline.payload.timestampMap.filter(
    (segment) => segment.mode !== "cut",
  );
  const beatRecords = nonCutSegments.map((segment, index) => {
    const segmentWords = candidateWords.filter(
      (word) =>
        word.endMs > segment.sourceStartMs &&
        word.startMs < segment.sourceEndMs,
    );
    const role =
      index === 0
        ? ("hook" as const)
        : index === nonCutSegments.length - 1
          ? ("payoff" as const)
          : ("proof" as const);
    return {
      beatId: `maul_beat_${index + 1}`,
      role,
      sourceStartMs: segment.sourceStartMs,
      sourceEndMs: segment.sourceEndMs,
      outputStartMs: segment.outputStartMs,
      outputEndMs: segment.outputEndMs,
      spokenIdea: textOf(segmentWords) || "Protected source-grounded pause",
      intensity: role === "hook" ? 0.82 : role === "payoff" ? 0.9 : 0.66,
      informationDensity: Math.min(1, segmentWords.length / 8),
      dominantFocus:
        segment.mode === "protected_pause"
          ? ("deliberate_stillness" as const)
          : ("speaker" as const),
      allowedEvents:
        segment.mode === "protected_pause"
          ? (["music"] as const)
          : (["caption", "camera", "music"] as const),
      protectedPause: segment.mode === "protected_pause",
      rationale:
        segment.mode === "protected_pause"
          ? "Preserve the verified rhetorical pause without visual competition."
          : `Carry the ${role} through source-faithful speech and one dominant focus.`,
      confidence: 0.78,
    };
  });
  const firstCrop = inputs.timeline.payload.speakerCropTracks[0]?.crop;
  const observationSnapshot = maulObservationSnapshotPayloadSchema.parse({
    ...basePlan(inputs, "maul-observation-snapshot/v1"),
    schemaVersion: "maul-observation-snapshot/v1",
    facts: {
      language: inputs.analysis.payload.transcript.language,
      transcriptWordCount: inputs.analysis.payload.transcript.words.length,
      verifiedVoiceSpanCount: inputs.analysis.payload.voiceSpans.filter(
        (span) => span.verified,
      ).length,
      verifiedSilenceSpanCount: inputs.analysis.payload.silenceSpans.filter(
        (span) => span.verified,
      ).length,
      shotCount: inputs.analysis.payload.shots.length,
      speakerTrackCount: inputs.analysis.payload.speakerTracks.length,
      sourceDurationMs: inputs.source.payload.durationMs,
      sourceWidth: inputs.source.payload.width,
      sourceHeight: inputs.source.payload.height,
      sourceFps: inputs.source.payload.fps,
    },
    unavailableSignals: [
      "prosody",
      "gesture",
      "motion",
      "source_quality_grade",
      "temporal_visual_probe",
    ],
    warnings: [
      "Current MAUL analysis does not provide multimodal prosody, gesture, motion, or temporal visual authority.",
    ],
  });
  const candidateNarrative = maulCandidateNarrativePayloadSchema.parse({
    ...basePlan(inputs, "maul-candidate-narrative/v1"),
    schemaVersion: "maul-candidate-narrative/v1",
    coherentThesis: inputs.candidate.payload.transcriptText,
    segments: narrativeGroups.map((group) => ({
      role: group.role,
      claim: textOf(group.words),
      sourceStartMs: group.words[0]!.startMs,
      sourceEndMs: group.words.at(-1)!.endMs,
      sourceSupported: true,
      transcriptWordStartIndex:
        inputs.analysis.payload.transcript.words.indexOf(group.words[0]!),
      transcriptWordEndIndex: inputs.analysis.payload.transcript.words.indexOf(
        group.words.at(-1)!,
      ),
    })),
    unsupportedClaims: [],
  });
  const beatMap = maulEditorialBeatMapPayloadSchema.parse({
    ...basePlan(inputs, "maul-editorial-beat-map/v1"),
    schemaVersion: "maul-editorial-beat-map/v1",
    beats: beatRecords,
    sharedAttentionBudget: {
      maxConcurrentDominantEvents: 1,
      collisionPolicy:
        "Camera, editorial type, evidence, and SFX may not compete for dominant attention.",
    },
  });
  const chunkCaptionGroups = inputs.textChunkPlan?.chunks.flatMap((chunk) => {
    if (chunk.endMs <= chunk.startMs) {
      return [];
    }
    return [
      {
        text: chunk.text,
        outputStartMs: chunk.startMs,
        outputEndMs: chunk.endMs,
        sourceGrounded: true as const,
        role: "dialogue_caption" as const,
      },
    ];
  });
  const typographyCommon = {
    captionGroups:
      chunkCaptionGroups && chunkCaptionGroups.length > 0
        ? chunkCaptionGroups
        : beatRecords
            .filter(
              (beat) => beat.spokenIdea !== "Protected source-grounded pause",
            )
            .map((beat) => ({
              text: beat.spokenIdea,
              outputStartMs: beat.outputStartMs,
              outputEndMs: beat.outputEndMs,
              sourceGrounded: true as const,
              role: "dialogue_caption" as const,
            })),
    editorialStatements: [],
    editorialTextWithheldReason:
      "The current deterministic planner has no governed editorial-writing authority; it will not relabel dialogue as authored hero copy.",
    motionPrograms: [
      {
        capabilityId: isV3
          ? "maul_governed_text_animation"
          : v2References
            ? "maul_planned_text_static"
            : "maul_caption_fade_rise",
        semanticRole:
          "Execute readable dialogue text without inventing timing, placement, or emphasis.",
        outputStartMs: 0,
        outputEndMs: inputs.timeline.payload.outputDurationMs,
        execution: executionNative(
          isV3
            ? MAUL_V3_NATIVE_RENDER_BRANCHES.textAnimation
            : v2References
              ? "MaulPlannedTextLayer.staticPlacement"
              : "MaulShort.CaptionCard.fadeRise",
          isV3
            ? "Rendered frame probes must match every governed transform phase."
            : "Rendered frame probes must match the named static or fade-rise text path.",
        ),
      },
    ],
  };
  const typographyMotion = maulTypographyMotionPlanPayloadSchema.parse(
    isV3
      ? {
          ...basePlan(inputs, "maul-typography-motion-plan/v3"),
          schemaVersion: "maul-typography-motion-plan/v3",
          ...v2References,
          ...typographyCommon,
          fontResolution: typographyResolution?.fontResolution ?? {
            requestedRole: "utility",
            selectedFamily: "DM Sans",
            selectedAssetId: "font_google_dm_sans_700",
            status: "governed_fallback",
            reason:
              "Measured typography is unavailable; the explicit safe-caption fallback blocks art-directed output.",
          },
          chunkTypographyBindings:
            typographyResolution?.chunkTypographyBindings ?? [],
          measurementEvidenceIds: typographyResolution?.measurementEvidenceIds ?? [],
          warnings: typographyResolution?.warnings ?? [
            "Measured typography is unavailable; this plan cannot claim art-directed output.",
          ],
        }
      : v2References
      ? {
          ...basePlan(inputs, "maul-typography-motion-plan/v2"),
          schemaVersion: "maul-typography-motion-plan/v2",
          ...v2References,
          ...typographyCommon,
          fontResolution: typographyResolution?.fontResolution ?? {
            requestedRole: "utility",
            selectedFamily: "DM Sans",
            selectedAssetId: "font_google_dm_sans_700",
            status: "governed_fallback",
            reason:
              "Measured typography is unavailable; the explicit safe-caption fallback blocks art-directed output.",
          },
          chunkTypographyBindings:
            typographyResolution?.chunkTypographyBindings ?? [],
          measurementEvidenceIds: typographyResolution?.measurementEvidenceIds ?? [],
          warnings: typographyResolution?.warnings ?? [
            "Measured typography is unavailable; this plan cannot claim art-directed output.",
          ],
        }
      : {
          ...basePlan(inputs, "maul-typography-motion-plan/v1"),
          schemaVersion: "maul-typography-motion-plan/v1",
          textChunkPlan: inputs.textChunkPlan,
          textChunkAuthority: inputs.textChunkPlan
            ? {
                authorityClass:
                  inputs.textChunkPlan.inference.status === "invoked"
                    ? ("invoked_model" as const)
                    : ("governed_fallback" as const),
                decisionScope:
                  "semantic_boundaries_roles_and_emphasis_only" as const,
                decisionFields: [
                  "textChunkPlan.chunks[].startWordIndex" as const,
                  "textChunkPlan.chunks[].endWordIndex" as const,
                  "textChunkPlan.chunks[].semanticRole" as const,
                  "textChunkPlan.chunks[].emphasis.wordIndices" as const,
                  "textChunkPlan.chunks[].emphasis.level" as const,
                ],
                inferenceReceiptPath: "textChunkPlan.inference" as const,
              }
            : null,
          ...typographyCommon,
          fontResolution: {
            requestedRole: "utility",
            selectedFamily: "Arial",
            selectedAssetId: null,
            status: "governed_fallback",
            reason:
              "The Stage 4 eligible font runtime bridge is not yet connected; fallback is explicit and blocks a cinematic release label.",
          },
          measurementEvidenceIds: [],
          warnings: [
            "Eligible custom-font loading and measured final-pixel typography are not yet available.",
          ],
        },
  );
  const camera = maulFramingCameraPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-framing-camera-plan/v1"),
    schemaVersion: "maul-framing-camera-plan/v1",
    events: (() => {
      let previousEndScale = 1;
      return beatRecords.map((beat, index) => {
        const startScale = isV3 ? previousEndScale : 1;
        const endScale = Math.min(
          inputs.treatment.payload.rendererInputs.framing.maxPunchInScale,
          startScale +
            (inputs.treatment.payload.treatmentId === "minimal_expert"
              ? 0.008
              : 0.018),
        );
        previousEndScale = endScale;
        return {
          eventId: `maul_camera_${index + 1}`,
          outputStartMs: beat.outputStartMs,
          outputEndMs: beat.outputEndMs,
          cropCenterX: firstCrop ? firstCrop.x + firstCrop.width / 2 : 0.5,
          cropCenterY: firstCrop ? firstCrop.y + firstCrop.height / 2 : 0.5,
          startScale,
          endScale,
          motivatedByBeatId: beat.beatId,
          rationale: beat.protectedPause
            ? "Settle rather than restart motion across the protected pause."
            : "Use one restrained continuous push to support the spoken beat.",
          execution: isV3
            ? executionNative(
                MAUL_V3_NATIVE_RENDER_BRANCHES.camera,
                "Encoded crop and scale probes must show continuity without segment resets.",
              )
            : executionFallback(
                "Legacy and V2 renderers retain their local per-sequence motion fallback.",
                "Frame probes must not claim global camera continuity before V3.",
              ),
        };
      });
    })(),
    continuityPolicy: isV3
      ? "Camera state carries across kept source segments; protected pauses settle instead of pumping."
      : "Legacy and V2 renderers retain local per-sequence motion without a global continuity claim.",
    maxScale: inputs.treatment.payload.rendererInputs.framing.maxPunchInScale,
  });
  const visualTrack = inputs.visualAssetPack
    ? buildMaulVisualTrack({
        projectId: inputs.project.id,
        rootSourceAssetId: inputs.source.payload.sha256 ? inputs.source.artifactId : inputs.project.rootSourceAssetId,
        sourceAssetId: inputs.source.artifactId,
        outputDurationMs: inputs.timeline.payload.outputDurationMs,
        beats: beatRecords.map((beat) => ({
          beatId: beat.beatId,
          outputStartMs: beat.outputStartMs,
          outputEndMs: beat.outputEndMs,
          sourceStartMs: beat.sourceStartMs,
          sourceEndMs: beat.sourceEndMs,
          role: beat.role,
          spokenIdea: beat.spokenIdea,
          protectedPause: beat.protectedPause,
        })),
        assets: inputs.visualAssetPack.assets,
        treatment: {
          maxInsertsPerMinute: inputs.treatment.payload.rendererInputs.bRoll.maxInsertsPerMinute,
        },
      })
    : null;
  const visual = maulVisualPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-visual-plan/v1"),
    schemaVersion: "maul-visual-plan/v1",
    ...(visualTrack ? {visualTrack} : {}),
    scenes: [
      {
        sceneId: "maul_scene_speaker_source",
        outputStartMs: 0,
        outputEndMs: inputs.timeline.payload.outputDurationMs,
        mode: "speaker_only",
        purpose:
          "Preserve source fidelity while no licensed evidence or B-roll has been selected.",
        assetArtifactId: inputs.source.artifactId,
        provenanceStatus: "source",
        referencePixelsExcluded: true,
        execution: executionNative(
          "MaulShort.SourceSegment.video",
          "Contact sheets must prove that only the authoritative source pixels entered the scene.",
        ),
      },
    ],
    neededButUnavailable: visualTrack
      ? []
      : ["No governed evidence/B-roll retrieval result exists for this deterministic planning pass."],
    warnings: [
      "Speaker-only visual mode is an explicit restrained fallback, not evidence of cinematic visual planning.",
    ],
  });
  const audio = maulDialogueAudioPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-dialogue-audio-plan/v1"),
    schemaVersion: "maul-dialogue-audio-plan/v1",
    dialoguePriority: true,
    targetLufs: -14,
    musicPolicy: inputs.treatment.payload.rendererInputs.audio.musicBehavior,
    duckingDb: inputs.treatment.payload.rendererInputs.audio.duckingDb,
    sfxIntents: [],
    execution: executionFallback(
      "Static dialogue-first source/music/SFX nodes; treatment ducking automation remains unimplemented.",
      "Decoded-audio probes must verify dialogue dominance and disclose missing automation.",
    ),
    warnings: [
      "The current native MAUL composition does not execute the full ducking envelope from the video-aware audio plan.",
    ],
  });
  const capabilitySelection = maulCapabilitySelectionPayloadSchema.parse({
    ...basePlan(inputs, "maul-capability-selection/v1"),
    schemaVersion: "maul-capability-selection/v1",
    selections: [
      {
        capabilityId: "maul_source_timestamp_mapping",
        semanticRole: "Execute factual source-to-output mapping.",
        selected: true,
        execution: executionNative(
          "MaulShort.SourceSegment.video",
          "Frame probes must match the Authoritative Editorial Timeline.",
        ),
      },
      {
        capabilityId: isV3
          ? "maul_governed_text_animation"
          : v2References
            ? "maul_planned_text_static"
            : "maul_caption_fade_rise",
        semanticRole: "Present dialogue captions with a stable readable hold.",
        selected: true,
        execution: executionNative(
          isV3
            ? MAUL_V3_NATIVE_RENDER_BRANCHES.textAnimation
            : v2References
              ? "MaulPlannedTextLayer.staticPlacement"
              : "MaulShort.CaptionCard.fadeRise",
          isV3
            ? "Governed entry, hold, and exit frames must be visually distinct and safe."
            : "The named static or fade-rise text path must remain readable and safe.",
        ),
      },
    ],
    unknownCapabilityIds: [],
  });
  const adapterDecision = maulAdapterDecisionPayloadSchema.parse({
    ...basePlan(inputs, "maul-adapter-decision/v1"),
    schemaVersion: "maul-adapter-decision/v1",
    adapterId: "maul-portrait-format-adapter/v1",
    platform: inputs.project.intake.platform,
    canvas: { width: 1080, height: 1920, fps: 30 },
    safeRegion: { topPx: 120, rightPx: 72, bottomPx: 330, leftPx: 72 },
    preservedIntent: [
      "Source claims",
      "Selected clip window",
      "Protected pauses",
      "Narrative roles",
      "Dialogue priority",
    ],
    adaptedConstraints: [
      {
        field: "canvas",
        from: "format-neutral",
        to: "1080x1920 portrait",
        reason:
          "Resolve the shared intent for the selected short-form platform.",
      },
      {
        field: "caption_safe_region",
        from: "format-neutral",
        to: "platform-reserved lower-third region",
        reason: "Protect mobile reading and platform UI clearance.",
      },
    ],
    silentIntentMutations: [],
  });
  const artDirection = buildMaulArtDirectionPlanPayload(inputs);
  const candidateStartMs = inputs.candidate.payload.sourceStartMs;
  const candidateEndMs = inputs.candidate.payload.sourceEndMs;
  const precedingWords = inputs.analysis.payload.transcript.words.filter(
    (word) => word.endMs <= candidateStartMs,
  );
  const followingWords = inputs.analysis.payload.transcript.words.filter(
    (word) => word.startMs >= candidateEndMs,
  );
  const contextAssembly = maulContextAssemblyPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-context-assembly-plan/v1"),
    schemaVersion: "maul-context-assembly-plan/v1",
    wholeSourceSynopsis:
      inputs.analysis.payload.transcript.text.trim() ||
      "Transcript text is unavailable; only timed candidate words can be assembled.",
    narrativePhases: [
      {
        phase: "available_transcript",
        sourceStartMs: 0,
        sourceEndMs: inputs.source.payload.durationMs,
        summary:
          inputs.analysis.payload.transcript.text.trim() ||
          "No full-source transcript synopsis is available.",
      },
    ],
    candidateNeighborhood: {
      sourceStartMs: candidateStartMs,
      sourceEndMs: candidateEndMs,
      precedingContext: textOf(precedingWords.slice(-24)),
      followingContext: textOf(followingWords.slice(0, 24)),
    },
    localTranscript: inputs.candidate.payload.transcriptText,
    namedFacts: [],
    callbacks: [],
    setupPayoffDependencies: [
      "The selected hook and payoff must remain in their source chronology.",
    ],
    chronologyConstraints: [
      "Do not reorder words inside a kept source segment.",
      "Preserve the Authoritative Editorial Timeline timestamp map.",
    ],
    sourceQualityChanges: [],
    unresolvedUncertainty: [
      "Prosody, gesture, gaze, and temporal visual quality are not present in the current analysis contract.",
    ],
    omissionReports: [
      {
        contextClass: "multimodal_whole_source_context",
        reason:
          "The current analysis supplies transcript and structural spans but no governed temporal visual/prosody interpretation.",
        effect: "degraded_authority",
      },
    ],
  });
  const textOpportunities = beatRecords.map((beat, index) => ({
    opportunityId: `maul_text_opportunity_${index + 1}`,
    beatId: beat.beatId,
    kind: beat.protectedPause
      ? ("deliberate_absence" as const)
      : ("dialogue_caption" as const),
    communicationBenefit: beat.protectedPause
      ? "Protect the rhetorical pause from competing reading demand."
      : "Make the source-grounded spoken idea readable on mobile.",
    sourceSupport: beat.protectedPause
      ? "Authoritative timeline marks a protected pause."
      : beat.spokenIdea,
    viewerReadingLoad: Math.min(1, beat.informationDensity),
    availableNegativeSpace: "unknown" as const,
    subjectOcclusionRisk: "unknown" as const,
    speechRate: "unknown" as const,
    concurrentImagery: "Authoritative principal-speaker source video",
    durationMs: beat.outputEndMs - beat.outputStartMs,
    hierarchyOwner: beat.protectedPause
      ? ("speaker" as const)
      : ("caption" as const),
    decision: beat.protectedPause ? ("withhold" as const) : ("use" as const),
    rationale: beat.protectedPause
      ? "Silence and stillness are the intended communication event."
      : "Dialogue captions are source-supported; authored editorial copy is not yet authorized.",
  }));
  const textOpportunity = maulTextOpportunityPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-text-opportunity-plan/v1"),
    schemaVersion: "maul-text-opportunity-plan/v1",
    opportunities: textOpportunities,
    quotaUsed: false,
  });
  const shotIntentMatrix = maulShotIntentMatrixPayloadSchema.parse({
    ...basePlan(inputs, "maul-shot-intent-matrix/v1"),
    schemaVersion: "maul-shot-intent-matrix/v1",
    shots: beatRecords.map((beat, index) => ({
      shotId: `maul_shot_${index + 1}`,
      sourceStartMs: beat.sourceStartMs,
      sourceEndMs: beat.sourceEndMs,
      outputStartMs: beat.outputStartMs,
      outputEndMs: beat.outputEndMs,
      editorialPurpose: beat.rationale,
      rhetoricalRole: beat.role,
      inReason:
        index === 0
          ? "Enter on the selected hook."
          : "Continue into the next governed rhetorical beat.",
      outReason:
        index === beatRecords.length - 1
          ? "Exit after the selected payoff completes."
          : "Yield to the next governed rhetorical beat.",
      continuityRelationship:
        "Preserve source chronology and carry camera state across the implementation boundary.",
      screenDirection: "unknown",
      poseAndGestureState:
        "Unavailable in the current analysis contract; do not infer.",
      eyeLine: "unknown",
      cropAndCameraTarget:
        "Track the verified principal speaker using the governed portrait crop and restrained continuous push.",
      evidenceBackgroundDockingState:
        "Speaker-only fallback; no evidence panel or background asset is authorized.",
      textOpportunityId: textOpportunities[index]!.opportunityId,
      audioHandlesMs: { pre: 0, post: 0 },
      colorMatchIntent:
        "Maintain one continuous source treatment without synthetic shot-to-shot color discontinuity.",
      transition:
        index === 0 ? "Direct source entry" : "Continuous cutless source carry",
      confidence: 0.72,
      fallback:
        "If governed crop execution is unavailable, render the source-fit portrait without inventing a new crop.",
    })),
    implementationSegmentsAreShots: false,
  });
  const revision = maulRevisionPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-revision-plan/v1"),
    schemaVersion: "maul-revision-plan/v1",
    immutableFields: [
      "Source claims and transcript wording",
      "Authoritative Editorial Timeline source mapping",
      "Rights and provenance state",
      "Approved candidate and treatment identity",
      "S4 release thresholds",
    ],
    allowedMutations: [
      "Caption line grouping within the governed safe region",
      "Camera scale within treatment maximums",
      "Audio mix levels without weakening dialogue priority",
      "Explicit fallback selection",
    ],
    repairOptions: [
      {
        failureClass: "caption_safety_or_legibility",
        permittedAction:
          "Regroup captions or reduce caption scale within the safe region.",
        affectedGates: ["typography", "composition_and_hierarchy"],
      },
      {
        failureClass: "camera_continuity",
        permittedAction:
          "Reduce or remove the governed push without changing source timing.",
        affectedGates: ["framing_and_camera", "continuity"],
      },
      {
        failureClass: "dialogue_masking",
        permittedAction:
          "Lower music or SFX gain while retaining the licensed assets.",
        affectedGates: ["dialogue_and_audio"],
      },
    ],
    maximumAttempts: 2,
    maximumWallClockMs: 300000,
    maximumCostUsd: 1,
    criticMustBeIndependent: true,
    noProgressDetection:
      "Stop when a retry does not improve every failing gate targeted by that repair.",
    oscillationDetection:
      "Stop when a later attempt recreates a previously observed gate score and failure signature.",
    humanCheckpoint:
      "Require human review before changing immutable source, rights, timeline, candidate, treatment, or threshold fields.",
    stopReasons: [
      "Attempt, wall-clock, or cost budget exhausted.",
      "No-progress or oscillation detected.",
      "A repair would require immutable-field mutation or threshold reduction.",
    ],
    thresholdReductionAllowed: false,
  });

  return {
    observationSnapshot,
    candidateNarrative,
    beatMap,
    typographyMotion,
    camera,
    visual,
    audio,
    capabilitySelection,
    adapterDecision,
    artDirection,
    contextAssembly,
    shotIntentMatrix,
    textOpportunity,
    revision,
  };
};

export type MaulPlanningPayloads = ReturnType<typeof buildMaulPlanningPayloads>;

export const buildMaulPlanningBundlePayload = ({
  inputs,
  planArtifactIds,
  blockingReasons = [],
}: {
  inputs: MaulPlanningInputs;
  planArtifactIds: MaulPlanningBundlePayload["planArtifactIds"];
  blockingReasons?: string[];
}): MaulPlanningBundlePayload => {
  const v3Base =
    "textAnimation" in planArtifactIds
      ? basePlan(inputs, "maul-planning-bundle/v3")
      : null;
  return maulPlanningBundlePayloadSchema.parse(
    "textAnimation" in planArtifactIds
      ? {
          ...v3Base!,
          schemaVersion: "maul-planning-bundle/v3",
          planArtifactIds,
          replayKey: stableHash({
            parentReplayKey: v3Base!.replayKey,
            planArtifactIds,
          }),
          rendererReadiness:
            blockingReasons.length > 0
              ? "blocked"
              : "governed_with_explicit_fallbacks",
          blockingReasons,
          warnings: [
            "V3 executes governed text animation; audio treatment remains a standalone unregistered contract until its later manifest version.",
          ],
        }
      : "textChunk" in planArtifactIds && "textPlacement" in planArtifactIds
      ? {
          ...basePlan(inputs, "maul-planning-bundle/v2"),
          schemaVersion: "maul-planning-bundle/v2",
          planArtifactIds,
          rendererReadiness:
            blockingReasons.length > 0
              ? "blocked"
              : "governed_with_explicit_fallbacks",
          blockingReasons,
          warnings: [
            "Planning is deterministic and carries explicit governed fallbacks; it is not an S4 or cinematic claim.",
          ],
        }
      : {
          ...basePlan(inputs, "maul-planning-bundle/v1"),
          schemaVersion: "maul-planning-bundle/v1",
          planArtifactIds,
          rendererReadiness: "governed_with_explicit_fallbacks",
          blockingReasons: [],
          warnings: [
            "Planning is deterministic and carries explicit font, visual, and audio fallbacks; it is not an S4 or cinematic claim.",
          ],
        },
  );
};

export const adaptMaulLegacyPlanningBundleV1 = ({
  planningBundle: inputPlanningBundle,
  typographyMotion: inputTypographyMotion,
  mappedWords,
  editorialTimeline,
}: {
  planningBundle: unknown;
  typographyMotion: unknown;
  mappedWords: readonly MaulMappedTranscriptWord[];
  editorialTimeline: {outputDurationMs: number};
}) => {
  const planningBundle = maulPlanningBundleV1PayloadSchema.parse(
    inputPlanningBundle,
  );
  const typographyMotion = maulTypographyMotionPlanV1PayloadSchema.parse(
    inputTypographyMotion,
  );
  if (!typographyMotion.textChunkPlan) {
    throw new Error(
      "Legacy Planning Bundle adaptation requires its nested text chunk plan.",
    );
  }
  const mappedText = joinShortsTextTokens(
    mappedWords.map((word) => word.text),
  );
  const nestedText = joinShortsTextTokens(
    typographyMotion.textChunkPlan.chunks.map((chunk) => chunk.text),
  );
  if (mappedText !== nestedText) {
    throw new Error(
      "Legacy nested text chunk plan does not match mapped transcript words.",
    );
  }

  const textChunkPlan = materializeMaulTextChunkPlanV2({
    mappedWords,
    textChunkPlanV1: typographyMotion.textChunkPlan,
    editorialTimeline,
  });
  const textChunkPlanArtifactId = stableIdForLegacyAdapter(
    "legacy_text_chunk",
    {bundleReplayKey: planningBundle.replayKey, textChunkPlan},
  );
  const textPlacementPlanArtifactId = stableIdForLegacyAdapter(
    "legacy_text_placement",
    {bundleReplayKey: planningBundle.replayKey, textChunkPlanArtifactId},
  );
  const transformHash = hashMaulPlanPayload({
    adapterId: "adapt-maul-legacy-planning-bundle-v1",
    outputDurationMs: editorialTimeline.outputDurationMs,
    mode: "padded_non_source_band",
  });
  const fallbackBand = {x: 0.08, y: 0.74, width: 0.84, height: 0.14};
  const textPlacementPlan = buildMaulTextPlacementPlan({
    textChunkPlanArtifactId,
    textChunkPlan,
    compositionIntervals: [
      {
        intervalId: "legacy_caption_safe_interval",
        sceneId: "legacy_scene",
        discontinuityId: "legacy_discontinuity",
        variantId: "caption_safe_fallback",
        outputStartMs: 0,
        outputEndMs: editorialTimeline.outputDurationMs,
        transformHash,
        sourceViewport: {x: 0, y: 0, width: 1, height: 1},
        sourceOccupancy: [{x: 0, y: 0, width: 1, height: 0.72}],
        paddedNonSourceRegions: [fallbackBand],
        compositionDirection: null,
        textAnchor: null,
        crop: {x: 0, y: 0, width: 1, height: 1},
        scale: {x: 1, y: 1},
      },
    ],
    observationIntervals: [
      {
        evidenceId: "legacy_unknown_visual_evidence",
        sceneId: "legacy_scene",
        outputStartMs: 0,
        outputEndMs: editorialTimeline.outputDurationMs,
        trackingState: "unknown",
        subjectBox: null,
        cutEvidenceStatus: "unknown",
        existingTextRegions: [],
      },
    ],
  });

  return {
    adapterProvenance: {
      adapterId: "adapt-maul-legacy-planning-bundle-v1" as const,
      sourceSchemaVersion: planningBundle.schemaVersion,
      mode: "explicit_conservative_projection" as const,
    },
    textChunkPlanArtifactId,
    textPlacementPlanArtifactId,
    textChunkPlan,
    textPlacementPlan,
  };
};

const stableIdForLegacyAdapter = (prefix: string, value: unknown) =>
  `${prefix}_${hashMaulPlanPayload(value).slice(0, 24)}`;

type PlanningArtifacts = {
  textChunk?: Extract<MaulArtifactRecord, {artifactType: "text_chunk_plan"}>;
  textPlacement?: Extract<
    MaulArtifactRecord,
    {artifactType: "text_placement_plan"}
  >;
  textAnimation?: Extract<
    MaulArtifactRecord,
    {artifactType: "text_animation_plan"}
  >;
  observationSnapshot: Extract<
    MaulArtifactRecord,
    { artifactType: "observation_snapshot" }
  >;
  candidateNarrative: Extract<
    MaulArtifactRecord,
    { artifactType: "candidate_narrative" }
  >;
  beatMap: Extract<MaulArtifactRecord, { artifactType: "editorial_beat_map" }>;
  typographyMotion: Extract<
    MaulArtifactRecord,
    { artifactType: "typography_motion_plan" }
  >;
  camera: Extract<MaulArtifactRecord, { artifactType: "framing_camera_plan" }>;
  visual: Extract<MaulArtifactRecord, { artifactType: "visual_plan" }>;
  audio: Extract<MaulArtifactRecord, { artifactType: "dialogue_audio_plan" }>;
  capabilitySelection: Extract<
    MaulArtifactRecord,
    { artifactType: "capability_selection" }
  >;
  adapterDecision: Extract<
    MaulArtifactRecord,
    { artifactType: "adapter_decision" }
  >;
  artDirection: Extract<
    MaulArtifactRecord,
    { artifactType: "art_direction_plan" }
  >;
  contextAssembly: Extract<
    MaulArtifactRecord,
    { artifactType: "context_assembly_plan" }
  >;
  shotIntentMatrix: Extract<
    MaulArtifactRecord,
    { artifactType: "shot_intent_matrix" }
  >;
  textOpportunity: Extract<
    MaulArtifactRecord,
    { artifactType: "text_opportunity_plan" }
  >;
  revision: Extract<MaulArtifactRecord, { artifactType: "revision_plan" }>;
};

type MaulManifestPlanExecutionEntry = {
  planArtifactId: string;
  planType: string;
  executionStatus: "native" | "governed_fallback";
  nativeBranch: string | null;
  fallback: string | null;
};

export const buildMaulManifestPlanExecution = ({
  schemaVersion,
  planningArtifacts,
}: {
  schemaVersion:
    | "maul-unified-short-render-manifest/v1"
    | "maul-unified-short-render-manifest/v2"
    | "maul-unified-short-render-manifest/v3";
  planningArtifacts: PlanningArtifacts;
}): MaulManifestPlanExecutionEntry[] => {
  const plannedText = schemaVersion !== "maul-unified-short-render-manifest/v1";
  const animatedText = schemaVersion === "maul-unified-short-render-manifest/v3";
  const entries: MaulManifestPlanExecutionEntry[] = [
    {
      planArtifactId: planningArtifacts.observationSnapshot.artifactId,
      planType: "observation_snapshot",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "Observation facts remain provenance context; the thin renderer does not yet interpret multimodal observations.",
    },
    {
      planArtifactId: planningArtifacts.candidateNarrative.artifactId,
      planType: "candidate_narrative",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "Candidate narrative is executed through the source-faithful timeline and captions.",
    },
    {
      planArtifactId: planningArtifacts.beatMap.artifactId,
      planType: "editorial_beat_map",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "Beat timing is reduced to the authoritative timeline; unsupported event types remain withheld.",
    },
    {
      planArtifactId: planningArtifacts.typographyMotion.artifactId,
      planType: "typography_motion_plan",
      executionStatus: "native",
      nativeBranch: plannedText
        ? "MaulPlannedTextLayer.staticPlacement"
        : "MaulShort.CaptionCard.fadeRise",
      fallback: null,
    },
    {
      planArtifactId: planningArtifacts.camera.artifactId,
      planType: "framing_camera_plan",
      executionStatus: animatedText ? "native" : "governed_fallback",
      nativeBranch: animatedText ? MAUL_V3_NATIVE_RENDER_BRANCHES.camera : null,
      fallback: animatedText
        ? null
        : "Legacy and V2 renderers use their historical local motion fallback; the global camera plan is executed only by V3.",
    },
    {
      planArtifactId: planningArtifacts.visual.artifactId,
      planType: "visual_plan",
      executionStatus: "native",
      nativeBranch: "MaulShort.SourceSegment.video",
      fallback: null,
    },
    {
      planArtifactId: planningArtifacts.audio.artifactId,
      planType: "dialogue_audio_plan",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "Static dialogue-first source/music/SFX nodes without the unimplemented ducking envelope.",
    },
    {
      planArtifactId: planningArtifacts.capabilitySelection.artifactId,
      planType: "capability_selection",
      executionStatus: "native",
      nativeBranch: "MaulShort.capabilityDispatch.v1",
      fallback: null,
    },
    {
      planArtifactId: planningArtifacts.adapterDecision.artifactId,
      planType: "adapter_decision",
      executionStatus: "native",
      nativeBranch: "MaulShort.portrait1080x1920",
      fallback: null,
    },
    {
      planArtifactId: planningArtifacts.artDirection.artifactId,
      planType: "art_direction_plan",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "The manifest preserves the art-direction thesis, while the renderer executes only supported governed treatment inputs.",
    },
    {
      planArtifactId: planningArtifacts.contextAssembly.artifactId,
      planType: "context_assembly_plan",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "Assembled context remains planning provenance; the renderer consumes the approved timeline and source mapping.",
    },
    {
      planArtifactId: planningArtifacts.shotIntentMatrix.artifactId,
      planType: "shot_intent_matrix",
      executionStatus: "native",
      nativeBranch: "MaulShort.SourceSegment.video",
      fallback: null,
    },
    {
      planArtifactId: planningArtifacts.textOpportunity.artifactId,
      planType: "text_opportunity_plan",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback: animatedText
        ? "Text opportunities are materialized through the selected chunk, placement, and animation plans."
        : "Text opportunities remain planning provenance; V1/V2 renderers execute only their governed caption paths.",
    },
    {
      planArtifactId: planningArtifacts.revision.artifactId,
      planType: "revision_plan",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "The bounded revision policy is preserved for the quality controller; rendering performs no autonomous retry cycle.",
    },
  ];

  if (plannedText) {
    if (!planningArtifacts.textChunk || !planningArtifacts.textPlacement) {
      throw new Error("Planned text execution requires chunk and placement artifacts.");
    }
    entries.push(
      {
        planArtifactId: planningArtifacts.textChunk.artifactId,
        planType: "text_chunk_plan",
        executionStatus: "native",
        nativeBranch: animatedText
          ? "MaulPlannedTextLayer.stableTokens"
          : "MaulShort.PlannedCaptionTokens.v1",
        fallback: null,
      },
      {
        planArtifactId: planningArtifacts.textPlacement.artifactId,
        planType: "text_placement_plan",
        executionStatus: "native",
        nativeBranch: animatedText
          ? "MaulPlannedTextLayer.exactPlacement"
          : "MaulShort.PlannedPlacement.v1",
        fallback: null,
      },
    );
  }
  if (animatedText) {
    if (!planningArtifacts.textAnimation) {
      throw new Error("V3 execution requires a text animation artifact.");
    }
    entries.push({
      planArtifactId: planningArtifacts.textAnimation.artifactId,
      planType: "text_animation_plan",
      executionStatus: "native",
      nativeBranch: MAUL_V3_NATIVE_RENDER_BRANCHES.textAnimation,
      fallback: null,
    });
  }
  return entries;
};

export const buildMaulManifestReplayKey = ({
  schemaVersion,
  sourceSha256,
  timelineReplay,
  treatmentReplayKey,
  planningBundleReplayKey,
  textChunkPlan,
  textPlacementPlan,
  typographyMotionPlan,
  textAnimationPlan,
  audioPlanId,
  musicTrackId,
  sfx,
}: {
  schemaVersion:
    | "maul-planning-bundle/v1"
    | "maul-planning-bundle/v2"
    | "maul-planning-bundle/v3";
  sourceSha256: string;
  timelineReplay: unknown;
  treatmentReplayKey: string;
  planningBundleReplayKey: string;
  textChunkPlan: unknown | null;
  textPlacementPlan: unknown | null;
  typographyMotionPlan: unknown;
  textAnimationPlan: unknown | null;
  audioPlanId: string;
  musicTrackId: string;
  sfx: readonly (readonly [string, number])[];
}): string => {
  if (
    schemaVersion === "maul-planning-bundle/v3" &&
    textAnimationPlan === null
  ) {
    throw new Error("V3 replay-key compilation requires text animation.");
  }
  return stableHash({
    sourceSha256,
    timelineReplay,
    treatmentReplayKey,
    planningBundleReplayKey,
    textChunkPlanHash:
      textChunkPlan === null ? null : stableHash(textChunkPlan),
    textPlacementPlanHash:
      textPlacementPlan === null ? null : stableHash(textPlacementPlan),
    ...(schemaVersion === "maul-planning-bundle/v3"
      ? {
          typographyMotionPlanHash: stableHash(typographyMotionPlan),
          textAnimationPlanHash: stableHash(textAnimationPlan),
        }
      : {}),
    audioPlanId,
    musicTrackId,
    sfx,
  });
};

export const compileMaulUnifiedShortRenderManifest = ({
  inputs,
  planningBundle,
  planningArtifacts,
  captions,
  audioPlan,
  request,
  createdAt,
}: {
  inputs: MaulPlanningInputs;
  planningBundle: Extract<
    MaulArtifactRecord,
    { artifactType: "planning_bundle" }
  >;
  planningArtifacts: PlanningArtifacts;
  captions: MaulRenderCaption[];
  audioPlan: VideoAwareAudioPlan;
  request: MaulShortRenderRequest;
  createdAt: string;
}): MaulUnifiedShortRenderManifest => {
  const isV2 = planningBundle.payload.schemaVersion === "maul-planning-bundle/v2";
  const isV3 = planningBundle.payload.schemaVersion === "maul-planning-bundle/v3";
  const isPlanned = isV2 || isV3;
  const textChunkArtifact = planningArtifacts.textChunk;
  const textPlacementArtifact = planningArtifacts.textPlacement;
  const textAnimationArtifact = planningArtifacts.textAnimation;
  if (isPlanned) {
    if (
      !textChunkArtifact ||
      !textPlacementArtifact ||
      planningArtifacts.typographyMotion.payload.schemaVersion !==
        (isV3
          ? "maul-typography-motion-plan/v3"
          : "maul-typography-motion-plan/v2")
    ) {
      throw new Error(
        `${isV3 ? "V3" : "V2"} manifest compilation requires chunk, placement, and matching Typography Motion artifacts.`,
      );
    }
    const textChunkPlanHash = hashMaulPlanPayload(textChunkArtifact.payload);
    const textPlacementPlanHash = hashMaulPlanPayload(
      textPlacementArtifact.payload,
    );
    if (
      textPlacementArtifact.payload.textChunkPlanArtifactId !==
        textChunkArtifact.artifactId ||
      textPlacementArtifact.payload.textChunkPlanHash !== textChunkPlanHash ||
      planningArtifacts.typographyMotion.payload.textChunkPlanArtifactId !==
        textChunkArtifact.artifactId ||
      planningArtifacts.typographyMotion.payload.textChunkPlanHash !==
        textChunkPlanHash ||
      planningArtifacts.typographyMotion.payload.textPlacementPlanArtifactId !==
        textPlacementArtifact.artifactId ||
      planningArtifacts.typographyMotion.payload.textPlacementPlanHash !==
        textPlacementPlanHash
    ) {
      throw new Error(
        `${isV3 ? "V3" : "V2"} manifest compilation rejected a stale hash or mismatched placement reference.`,
      );
    }
    const typographyPayload = planningArtifacts.typographyMotion.payload;
    if (typographyPayload.chunkTypographyBindings.length > 0) {
      const bindingByChunkId = new Map(
        typographyPayload.chunkTypographyBindings.map((binding) => [
          binding.chunkId,
          binding,
        ]),
      );
      const placedChunkIds = new Set(
        textPlacementArtifact.payload.segments.map((segment) => segment.chunkId),
      );
      if (
        bindingByChunkId.size !==
          typographyPayload.chunkTypographyBindings.length ||
        bindingByChunkId.size !== placedChunkIds.size
      ) {
        throw new Error(
          "Manifest compilation requires exactly one typography binding for every placed chunk.",
        );
      }
      for (const segment of textPlacementArtifact.payload.segments) {
        const binding = bindingByChunkId.get(segment.chunkId);
        const primaryLayer = binding?.layers.find(
          (layer) => layer.layerName === binding.primaryLayerName,
        );
        if (
          !binding ||
          !primaryLayer ||
          binding.compatibilityProfile.profileId !==
            segment.compatibility.profileId ||
          binding.compatibilityProfile.metrics.fingerprint !==
            segment.compatibility.metricsFingerprint
        ) {
          throw new Error(
            `Typography binding for ${segment.chunkId} does not match its placement profile.`,
          );
        }
        assertMaulTypographyPlacementCompatibility({
          placementPlan: textPlacementArtifact.payload,
          profileId: segment.compatibility.profileId,
          selectedFamily: primaryLayer.selectedAsset.family,
          selectedAssetId: primaryLayer.selectedAsset.assetId,
          compiledMetrics: {
            maxGlyphWidthEm:
              binding.compatibilityProfile.metrics.maxGlyphWidthEm,
            maxLineHeightEm:
              binding.compatibilityProfile.metrics.maxLineHeightEm,
          },
        });
        assertTypographyProfileManifestLineage({binding, segment});
      }
    } else {
      const compatibility =
        textPlacementArtifact.payload.compatibilityProfiles[0]!;
      assertMaulTypographyPlacementCompatibility({
        placementPlan: textPlacementArtifact.payload,
        selectedFamily: typographyPayload.fontResolution.selectedFamily,
        selectedAssetId: typographyPayload.fontResolution.selectedAssetId,
        compiledMetrics: {
          maxGlyphWidthEm: compatibility.metrics.maxGlyphWidthEm,
          maxLineHeightEm: compatibility.metrics.maxLineHeightEm,
        },
      });
    }
    if (isV3) {
      if (!textAnimationArtifact) {
        throw new Error(
          "V3 manifest compilation requires a text animation artifact.",
        );
      }
      if (!("textAnimationPlanArtifactId" in typographyPayload)) {
        throw new Error(
          "V3 manifest compilation requires Typography Motion V3 references.",
        );
      }
      assertMaulV3TextAnimationReferences({
        textChunk: textChunkArtifact,
        textPlacement: textPlacementArtifact,
        treatmentGenome: inputs.treatment,
        textAnimation: textAnimationArtifact,
        typographyMotion: {payload: typographyPayload},
      });
    }
  }

  const planExecution = buildMaulManifestPlanExecution({
    schemaVersion:
      planningBundle.payload.schemaVersion === "maul-planning-bundle/v1"
        ? "maul-unified-short-render-manifest/v1"
        : planningBundle.payload.schemaVersion === "maul-planning-bundle/v2"
          ? "maul-unified-short-render-manifest/v2"
          : "maul-unified-short-render-manifest/v3",
    planningArtifacts,
  });
  const replayKey = buildMaulManifestReplayKey({
    schemaVersion: planningBundle.payload.schemaVersion,
    sourceSha256: inputs.source.payload.sha256,
    timelineReplay: inputs.timeline.payload.timestampMap,
    treatmentReplayKey: inputs.treatment.payload.replayKey,
    planningBundleReplayKey: planningBundle.payload.replayKey,
    textChunkPlan: textChunkArtifact?.payload ?? null,
    textPlacementPlan: textPlacementArtifact?.payload ?? null,
    typographyMotionPlan: planningArtifacts.typographyMotion.payload,
    textAnimationPlan: textAnimationArtifact?.payload ?? null,
    audioPlanId: audioPlan.id,
    musicTrackId: request.musicTrack.id,
    sfx: request.sfxAssets.map((asset) => [asset.id, asset.sourceMs] as const),
  });
  return maulUnifiedShortRenderManifestSchema.parse({
    schemaVersion: isV3
      ? "maul-unified-short-render-manifest/v3"
      : isV2
        ? "maul-unified-short-render-manifest/v2"
        : "maul-unified-short-render-manifest/v1",
    rendererInputKind: "unified_short_render_manifest_only",
    planningBundleArtifactId: planningBundle.artifactId,
    planArtifactIds: planningBundle.payload.planArtifactIds,
    source: {
      sourceAssetId: inputs.source.artifactId,
      storagePath: inputs.source.payload.storageKey,
      sha256: inputs.source.payload.sha256,
    },
    timeline: inputs.timeline.payload,
    treatment: inputs.treatment.payload,
    layerPolicy: (request as { layerPolicy?: MaulRenderLayerPolicy }).layerPolicy ?? {
      baseVideo: "required",
      typography: "required",
      sourceTreatment: "enabled",
      sourceLegibilityOverlay: "enabled",
      editorialCuts: "disabled",
      transitions: "disabled",
      backgroundAnimation: "disabled",
      motionGraphics: "enabled",
      audioTreatment: "enabled",
    },
    captions,
    audio: {
      planId: audioPlan.id,
      planMode: "render_ready",
      musicTrack: request.musicTrack,
      sfxAssets: request.sfxAssets.flatMap((sfx) => {
        const outputMs = mapMaulSourceMsToOutput(
          inputs.timeline.payload.timestampMap,
          sfx.sourceMs,
        );
        return outputMs === null
          ? []
          : [
              {
                id: sfx.id,
                storagePath: sfx.storagePath,
                licenseType: sfx.licenseType,
                commercialAllowed: sfx.commercialAllowed,
                licenseVerified: sfx.licenseVerified,
                renderSafe: sfx.renderSafe,
                eventType: sfx.eventType,
                outputMs,
              },
            ];
      }),
    },
    plans: {
      observationSnapshot: planningArtifacts.observationSnapshot.payload,
      candidateNarrative: planningArtifacts.candidateNarrative.payload,
      beatMap: planningArtifacts.beatMap.payload,
      typographyMotion: planningArtifacts.typographyMotion.payload,
      camera: planningArtifacts.camera.payload,
      visual: planningArtifacts.visual.payload,
      audio: planningArtifacts.audio.payload,
      capabilitySelection: planningArtifacts.capabilitySelection.payload,
      adapterDecision: planningArtifacts.adapterDecision.payload,
      artDirection: planningArtifacts.artDirection.payload,
      contextAssembly: planningArtifacts.contextAssembly.payload,
      shotIntentMatrix: planningArtifacts.shotIntentMatrix.payload,
      textOpportunity: planningArtifacts.textOpportunity.payload,
      revision: planningArtifacts.revision.payload,
      ...(isPlanned && textChunkArtifact && textPlacementArtifact
        ? {
            textChunk: textChunkArtifact.payload,
            textPlacement: textPlacementArtifact.payload,
          }
        : {}),
      ...(isV3 && textAnimationArtifact
        ? {textAnimation: textAnimationArtifact.payload}
        : {}),
    },
    planExecution,
    output: { width: 1080, height: 1920, fps: 30, codec: "h264" },
    replayKey,
    createdAt,
  });
};
