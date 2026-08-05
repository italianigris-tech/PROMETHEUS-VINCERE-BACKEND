import {
  maulPerceptualFailureLabelSchema,
  type MaulPerceptualFailureLabel,
  type MaulPlacementOutcome,
  type MaulUnifiedShortRenderManifest,
} from "@prometheus/shared-types";

export type MaulPerceptualPreview = {
  previewArtifactId: string;
  manifestReplayKey: string;
  bytes: Buffer;
  sha256: string;
  width: 540;
  height: 960;
  durationMs: number;
  frameSamples: Array<{
    frameId: string;
    outputMs: number;
    bytes: Buffer;
    sha256: string;
    contentType: "image/png";
  }>;
};

export type MaulPerceptualEvaluatorReceipt = {
  authorityClass: "invoked_model" | "unavailable";
  provider: string | null;
  model: string | null;
  inferenceReceiptId: string | null;
};

export type MaulPerceptualEvaluatorResult = {
  status: "pass" | "blocked" | "unavailable";
  failureLabels: MaulPerceptualFailureLabel[];
  evidenceIds: string[];
  receipt: MaulPerceptualEvaluatorReceipt;
  rationale?: string;
};

export interface MaulPerceptualTruthProvider {
  evaluate(input: {
    manifest: MaulUnifiedShortRenderManifest;
    preview: MaulPerceptualPreview;
  }): Promise<MaulPerceptualEvaluatorResult>;
}

export type MaulPerceptualTruthResult = {
  status: "pass" | "blocked" | "unavailable";
  placementOutcome: MaulPlacementOutcome;
  failureLabels: MaulPerceptualFailureLabel[];
  evidenceArtifactIds: string[];
  renderedFrameIds: string[];
  evaluator: MaulPerceptualEvaluatorReceipt;
  rationale: string;
};

const uniqueLabels = (
  labels: MaulPerceptualFailureLabel[],
): MaulPerceptualFailureLabel[] =>
  [...new Set(labels)].sort((left, right) => left.localeCompare(right));

const hasSafeCaptionFallback = (manifest: MaulUnifiedShortRenderManifest) =>
  "textPlacement" in manifest.plans &&
  manifest.plans.textPlacement.segments.some(
    (segment) => segment.fallbackCode === "caption_safe_fallback",
  );

const hasExcessivePlate = (manifest: MaulUnifiedShortRenderManifest) =>
  "textPlacement" in manifest.plans &&
  manifest.plans.textPlacement.segments.some((segment) => {
    const primitive = segment.minimumLegibilityPrimitive;
    return primitive.kind === "solid_plate" && primitive.minimumOpacity >= 0.7;
  });

const sceneEvidenceAvailable = (manifest: MaulUnifiedShortRenderManifest) =>
  manifest.plans.artDirection.sceneEvidence.status === "available";

const assertProviderResult = (
  result: MaulPerceptualEvaluatorResult,
  frameIds: readonly string[],
): void => {
  maulPerceptualFailureLabelSchema.array().parse(result.failureLabels);
  const invoked =
    result.receipt.authorityClass === "invoked_model" &&
    result.receipt.provider !== null &&
    result.receipt.model !== null &&
    result.receipt.inferenceReceiptId !== null;
  if (result.status === "pass" && (!invoked || result.evidenceIds.length === 0)) {
    throw new Error(
      "A Perceptual Truth pass requires an invoked frame evaluator and evidence IDs.",
    );
  }
  if (result.evidenceIds.some((evidenceId) => !frameIds.includes(evidenceId))) {
    throw new Error(
      "Perceptual evaluator evidence must reference retained preview frame IDs.",
    );
  }
  if (result.status === "blocked" && result.failureLabels.length === 0) {
    throw new Error(
      "A blocked Perceptual Truth result requires named rendered-frame failure labels.",
    );
  }
  if (
    result.status === "unavailable" &&
    result.receipt.authorityClass !== "unavailable"
  ) {
    throw new Error(
      "Unavailable Perceptual Truth requires an unavailable evaluator receipt.",
    );
  }
};

export const evaluatePerceptualTruth = ({
  manifest,
  preview,
  providerResult,
}: {
  manifest: MaulUnifiedShortRenderManifest;
  preview: MaulPerceptualPreview;
  providerResult: MaulPerceptualEvaluatorResult;
}): MaulPerceptualTruthResult => {
  if (preview.manifestReplayKey !== manifest.replayKey) {
    throw new Error("Perceptual preview does not belong to the compiled render manifest.");
  }
  if (preview.frameSamples.length === 0) {
    throw new Error("Perceptual Truth requires retained rendered frame samples.");
  }
  const frameIds = preview.frameSamples.map((sample) => sample.frameId);
  assertProviderResult(providerResult, frameIds);
  const evidenceArtifactIds = [preview.previewArtifactId];
  const fallback = hasSafeCaptionFallback(manifest);
  const labels = uniqueLabels([
    ...providerResult.failureLabels,
    ...(fallback ? (["GENERIC_BOTTOM_CAPTION"] as const) : []),
    ...(hasExcessivePlate(manifest) ? (["EXCESSIVE_BLACK_PLATE"] as const) : []),
  ]);

  if (fallback) {
    return {
      status: "blocked",
      placementOutcome: "SAFE_CAPTION_FALLBACK",
      failureLabels: labels,
      evidenceArtifactIds,
      renderedFrameIds: frameIds,
      evaluator: providerResult.receipt,
      rationale:
        "A safe-caption fallback is a usable accessibility result, never an art-directed rendered result.",
    };
  }

  if (!sceneEvidenceAvailable(manifest) || providerResult.status === "unavailable") {
    return {
      status: "unavailable",
      placementOutcome: "VISUAL_EVIDENCE_UNAVAILABLE",
      failureLabels: labels,
      evidenceArtifactIds,
      renderedFrameIds: frameIds,
      evaluator: providerResult.receipt,
      rationale:
        "Rendered-frame art direction cannot be claimed without both source scene evidence and an available perceptual evaluator.",
    };
  }

  if (providerResult.status === "blocked" || labels.length > 0) {
    return {
      status: "blocked",
      placementOutcome: "PLACEMENT_UNRESOLVED",
      failureLabels: labels,
      evidenceArtifactIds,
      renderedFrameIds: frameIds,
      evaluator: providerResult.receipt,
      rationale:
        providerResult.rationale ??
        "Rendered-frame evaluation rejected the selected composition.",
    };
  }

  return {
    status: "pass",
    placementOutcome: "ART_DIRECTED",
    failureLabels: [],
    evidenceArtifactIds,
    renderedFrameIds: frameIds,
    evaluator: providerResult.receipt,
    rationale:
      providerResult.rationale ??
      "Scene-backed rendered-frame evaluation found no named perceptual failures.",
  };
};

export const createUnavailableMaulPerceptualTruthProvider = (
  reason: string,
): MaulPerceptualTruthProvider => ({
  async evaluate() {
    return {
      status: "unavailable",
      failureLabels: [],
      evidenceIds: [],
      receipt: {
        authorityClass: "unavailable",
        provider: null,
        model: null,
        inferenceReceiptId: null,
      },
      rationale: reason,
    };
  },
});
