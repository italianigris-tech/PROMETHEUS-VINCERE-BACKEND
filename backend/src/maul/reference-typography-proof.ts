import {
  COMPOSITION_EXPERIMENT_FIXTURES,
  REFERENCE_TYPOGRAPHY_PARAGRAPH,
} from "./composition-experiment-fixtures.js";
import {materializeShortsTextChunkProposal} from "./shorts-text-chunking.js";

export const REFERENCE_TYPOGRAPHY_PROOF_SAMPLE_TIMES_MS = [
  1000,
  2000,
  3000,
] as const;

export const REFERENCE_TYPOGRAPHY_SOURCE_TREATMENT_PROFILE_ID =
  "subject_focus_grade_v1" as const;

export const validateReferenceTypographyProofRequest = ({
  fixture,
  text,
}: {
  fixture: string;
  text: string;
}) => {
  if (fixture !== "female") {
    throw new Error("Reference typography proof supports only the named female fixture.");
  }
  if (text !== REFERENCE_TYPOGRAPHY_PARAGRAPH) {
    throw new Error("Reference typography proof text must equal the exact supplied paragraph.");
  }
  return {
    fixtureId: COMPOSITION_EXPERIMENT_FIXTURES.sceneA.fixtureId,
    text,
    sampleTimesMs: [...REFERENCE_TYPOGRAPHY_PROOF_SAMPLE_TIMES_MS],
    sourceTreatmentProfileId: REFERENCE_TYPOGRAPHY_SOURCE_TREATMENT_PROFILE_ID,
  };
};

const canPartitionIntoMeasuredLockups = (wordCount: number): boolean => {
  if (wordCount === 0) return true;
  return [3, 4].some((size) =>
    wordCount >= size && canPartitionIntoMeasuredLockups(wordCount - size),
  );
};

type ProofBox = {x: number; y: number; width: number; height: number};

const assertEnvelopeContainsBox = ({
  segmentId,
  box,
  maximumEnvelope,
}: {
  segmentId: string;
  box: ProofBox;
  maximumEnvelope: ProofBox;
}): void => {
  const envelopeRight = maximumEnvelope.x + maximumEnvelope.width;
  const envelopeBottom = maximumEnvelope.y + maximumEnvelope.height;
  const boxRight = box.x + box.width;
  const boxBottom = box.y + box.height;
  if (
    maximumEnvelope.x > box.x ||
    maximumEnvelope.y > box.y ||
    envelopeRight < boxRight ||
    envelopeBottom < boxBottom
  ) {
    throw new Error(`Reference typography proof segment ${segmentId} has an incomplete measured envelope.`);
  }
  if (
    maximumEnvelope.x < 0 ||
    maximumEnvelope.y < 0 ||
    envelopeRight > 1 ||
    envelopeBottom > 1
  ) {
    throw new Error(`Reference typography proof segment ${segmentId} escapes the normalized output frame.`);
  }
};

export const assertReferenceTypographyProofPlan = ({
  chunks,
  placementSegments,
  animationPrograms,
  rankedFontAssetIds,
}: {
  chunks: Array<{chunkId: string}>;
  placementSegments: Array<{
    chunkId: string;
    segmentId: string;
    box: ProofBox;
    maximumEnvelope: ProofBox;
    fallbackCode: string | null;
    editorialLockup?: {
      placement: {mode: string; finalTransformIdentity: boolean};
      tokenStyles: Array<{fontAssetId: string}>;
    };
  }>;
  animationPrograms: Array<{
    target: {placementSegmentId: string; scope: string};
    treatment: string;
    phases: {
      hold: {
        from: {translateXPx: number; translateYPx: number};
        to: {translateXPx: number; translateYPx: number};
      };
    };
  }>;
  rankedFontAssetIds: string[];
}): void => {
  const rankedFontIds = new Set(rankedFontAssetIds);
  if (rankedFontIds.size !== rankedFontAssetIds.length || rankedFontIds.size < 2) {
    throw new Error("Reference typography proof requires exactly the governed primary and accent font assets.");
  }
  if (placementSegments.length !== chunks.length) {
    throw new Error("Reference typography proof must compile every paragraph chunk into one placement segment.");
  }
  const segmentsByChunkId = new Map(placementSegments.map((segment) => [segment.chunkId, segment]));
  if (segmentsByChunkId.size !== placementSegments.length || chunks.some((chunk) => !segmentsByChunkId.has(chunk.chunkId))) {
    throw new Error("Reference typography proof placement segments do not cover every source chunk exactly once.");
  }

  for (const segment of placementSegments) {
    if (segment.fallbackCode) {
      throw new Error(`Reference typography proof segment ${segment.segmentId} used fallback ${segment.fallbackCode}.`);
    }
    if (!segment.editorialLockup) {
      throw new Error(`Reference typography proof segment ${segment.segmentId} has no editorial lockup.`);
    }
    if (
      segment.editorialLockup.placement.mode !== "position_locked" ||
      !segment.editorialLockup.placement.finalTransformIdentity
    ) {
      throw new Error(`Reference typography proof segment ${segment.segmentId} is not position locked.`);
    }
    if (segment.editorialLockup.tokenStyles.length === 0) {
      throw new Error(`Reference typography proof segment ${segment.segmentId} has no measured font styles.`);
    }
    if (segment.editorialLockup.tokenStyles.some((style) => !rankedFontIds.has(style.fontAssetId))) {
      throw new Error(`Reference typography proof segment ${segment.segmentId} uses an unranked font asset.`);
    }
    assertEnvelopeContainsBox(segment);

    const animation = animationPrograms.find(
      (program) => program.target.placementSegmentId === segment.segmentId,
    );
    if (!animation) {
      throw new Error(`Reference typography proof segment ${segment.segmentId} has no token animation program.`);
    }
    if (
      animation.target.scope !== "tokens" ||
      (animation.treatment !== "position_locked_word_reveal" &&
        animation.treatment !== "position_locked_letter_reveal")
    ) {
      throw new Error(`Reference typography proof segment ${segment.segmentId} has a non-local animation treatment.`);
    }
    const holdTransforms = [animation.phases.hold.from, animation.phases.hold.to];
    if (holdTransforms.some((transform) => transform.translateXPx !== 0 || transform.translateYPx !== 0)) {
      throw new Error(`Reference typography proof segment ${segment.segmentId} drifts during its hold.`);
    }
  }
};

export const assertReferenceTypographyProofSamplePlacements = ({
  output,
  placementSegments,
  observedSamples,
}: {
  output: {width: number; height: number};
  placementSegments: Array<{
    segmentId: string;
    outputStartMs: number;
    outputEndMs: number;
    box: ProofBox;
    maximumEnvelope: ProofBox;
  }>;
  observedSamples: Array<{
    outputMs: number;
    bounds: {leftPx: number; topPx: number; rightPx: number; bottomPx: number};
  }>;
}): void => {
  for (const sample of observedSamples) {
    const segment = placementSegments.find(
      (candidate) =>
        candidate.outputStartMs <= sample.outputMs &&
        candidate.outputEndMs > sample.outputMs,
    );
    if (!segment) {
      throw new Error(`Reference typography proof has no active placement segment at ${sample.outputMs}ms.`);
    }
    const container = segment.maximumEnvelope;
    const leftPx = container.x * output.width;
    const topPx = container.y * output.height;
    const rightPx = (container.x + container.width) * output.width;
    const bottomPx = (container.y + container.height) * output.height;
    if (
      sample.bounds.leftPx < leftPx - 4 ||
      sample.bounds.topPx < topPx - 4 ||
      sample.bounds.rightPx > rightPx + 4 ||
      sample.bounds.bottomPx > bottomPx + 4
    ) {
      const formatBounds = (bounds: number[]) => bounds
        .map((value) => Math.round(value * 100) / 100)
        .join(",");
      throw new Error(
        `Reference typography proof sample at ${sample.outputMs}ms escapes planned container ${segment.segmentId} ` +
          `(declared=${formatBounds([leftPx, topPx, rightPx, bottomPx])}; ` +
          `observed=${formatBounds([
            sample.bounds.leftPx,
            sample.bounds.topPx,
            sample.bounds.rightPx,
            sample.bounds.bottomPx,
          ])}).`,
      );
    }
  }
};

export const buildReferenceTypographyProofChunkPlan = ({
  transcript,
  durationMs,
}: {
  transcript: {
    language: "en";
    text: string;
    words: Array<{text: string; startMs: number; endMs: number; confidence: number}>;
  };
  durationMs: number;
}) => {
  if (transcript.text !== REFERENCE_TYPOGRAPHY_PARAGRAPH) {
    throw new Error("Reference typography proof chunking requires the exact supplied paragraph.");
  }
  const chunks: Array<{
    startWordIndex: number;
    endWordIndex: number;
    semanticRole: "hook" | "context" | "contrast" | "payoff";
    emphasisWordIndices: number[];
    emphasisLevel: "key" | "hero";
  }> = [];
  let startWordIndex = 0;
  while (startWordIndex < transcript.words.length) {
    const remaining = transcript.words.length - startWordIndex;
    const preferredLeadSize = chunks.length < 2 ? 3 : null;
    const size = preferredLeadSize &&
      remaining >= preferredLeadSize &&
      canPartitionIntoMeasuredLockups(remaining - preferredLeadSize)
      ? preferredLeadSize
      : [4, 3].find((candidate) =>
        remaining >= candidate && canPartitionIntoMeasuredLockups(remaining - candidate),
      );
    if (!size) {
      throw new Error("Reference typography proof cannot partition the source paragraph into 3-4 word lockups.");
    }
    const endWordIndex = startWordIndex + size - 1;
    const words = transcript.words.slice(startWordIndex, endWordIndex + 1)
      .map((word) => word.text.toLowerCase()).join(" ");
    const chunkIndex = chunks.length;
    const isFinal = endWordIndex === transcript.words.length - 1;
    chunks.push({
      startWordIndex,
      endWordIndex,
      semanticRole: chunkIndex === 0
        ? "hook"
        : isFinal
          ? "payoff"
          : /\bbut\b/u.test(words)
            ? "contrast"
            : "context",
      emphasisWordIndices: [endWordIndex],
      emphasisLevel: chunkIndex === 0 || isFinal ? "hero" : "key",
    });
    startWordIndex = endWordIndex + 1;
  }
  return materializeShortsTextChunkProposal({
    request: {
      transcript,
      videoDurationMs: durationMs,
      pacing: "measured",
      style: "direct_response",
      editorialContext: {
        platform: "instagram_reels",
        objective: "brand_consistency",
        audience: null,
        notes: "Reference typography proof fixture.",
      },
      constraints: {minWordsPerChunk: 3, maxWordsPerChunk: 4, preserveEveryWord: true},
    },
    proposal: {schemaVersion: "maul-shorts-text-chunk-proposal/v1", chunks},
    inference: {
      status: "skipped_missing_credentials",
      provider: "openai_compatible",
      baseUrl: "https://maul-reference-typography.local",
      model: "reference-typography-proof/v1",
      requestHash: "9".repeat(64),
      responseHash: null,
      fallbackReason: "Measured proof lockups are deterministically partitioned at three or four source words.",
    },
  });
};
