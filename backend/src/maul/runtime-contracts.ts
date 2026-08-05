import {
  maulRuntimeContractsSchema,
  type MaulPlacementOutcome,
  type MaulRuntimeContracts,
} from "@prometheus/shared-types";

export type MaulVisualDirectionReleaseResult = {
  corpusCaseId: string;
  sourceEvidenceStatus: "verified" | "pending" | "rejected";
  placementOutcome: MaulPlacementOutcome;
  referenceParityClaimed: boolean;
  minCompositionHoldMs: number;
  finalFontVerified: boolean;
  perceptualStatus: "pass" | "blocked" | "unavailable";
  blindedReview: {completed: boolean; candidateWon: boolean};
};

export type MaulVisualDirectionLaunchGate = {
  launchEligible: boolean;
  blindedPreference: number;
  blockers: string[];
};

export const evaluateVisualDirectionLaunchGate = (
  results: readonly MaulVisualDirectionReleaseResult[],
): MaulVisualDirectionLaunchGate => {
  const blockers = new Set<string>();
  if (results.length !== 30) blockers.add("held_out_corpus_incomplete");
  if (new Set(results.map((result) => result.corpusCaseId)).size !== results.length) {
    blockers.add("held_out_corpus_duplicate_case");
  }
  if (results.some((result) => result.sourceEvidenceStatus !== "verified")) {
    blockers.add("source_evidence_unverified");
  }
  if (results.some((result) =>
    result.placementOutcome === "SAFE_CAPTION_FALLBACK" &&
    result.referenceParityClaimed,
  )) {
    blockers.add("fallback_reference_parity_claim");
  }
  if (results.some((result) => result.minCompositionHoldMs < 850)) {
    blockers.add("composition_hold_below_perceptual_minimum");
  }
  if (results.some((result) => !result.finalFontVerified)) {
    blockers.add("final_font_unverified");
  }
  if (results.some((result) =>
    result.placementOutcome === "ART_DIRECTED" &&
    result.perceptualStatus !== "pass",
  )) {
    blockers.add("art_direction_without_perceptual_truth");
  }
  if (results.some((result) => !result.blindedReview.completed)) {
    blockers.add("blinded_review_incomplete");
  }
  const completedReviews = results.filter((result) => result.blindedReview.completed);
  const blindedPreference = completedReviews.length === 0
    ? 0
    : completedReviews.filter((result) => result.blindedReview.candidateWon).length /
      completedReviews.length;
  if (blindedPreference < 0.8) {
    blockers.add("blinded_preference_below_80_percent");
  }
  return {
    launchEligible: blockers.size === 0,
    blindedPreference: Number(blindedPreference.toFixed(3)),
    blockers: [...blockers].sort(),
  };
};

export const MAUL_RUNTIME_CONTRACTS: MaulRuntimeContracts =
  maulRuntimeContractsSchema.parse({
    schemaVersion: "maul-runtime-contracts/v1",
    sourceScope: {
      schemaVersion: "maul-v1-source-scope/v1",
      acceptedModes: ["single_speaker_talking_head", "single_speaker_podcast"],
      supportedPrimaryLanguages: ["en"],
      principalSpeakerCount: 1,
      requiresAudio: true,
      requiresVideo: true,
      excludedModes: [
        "multi_speaker_panel",
        "gameplay_first",
        "music_video_montage",
        "fiction_continuity",
      ],
      unsupportedOutcome: "reject_before_upload",
      postUploadVerificationRequired: true,
    },
    s4: {
      schemaVersion: "maul-s4-release-contract/v1",
      displayLabel: "S4",
      goldenCorpusTier: "elite",
      derivedOnly: true,
      goodOrNoExport: true,
      technicalSuccessIsQualitySuccess: false,
      zeroErrorsPromise: false,
      minimumWeightedScore: 85,
      mandatoryDimensions: [
        "editorial_selection_structure",
        "cuts_pauses_camera",
        "typography_writing_layout_motion",
        "subject_evidence_background_composition",
        "color_pipeline",
        "dialogue_music_sfx",
        "treatment_coherence_originality",
        "encoded_temporal_stability",
        "source_fidelity",
        "rights_provenance_auditability",
        "accessibility_intelligibility",
      ],
      hardFailureIds: [
        "critical_quality_gate_failure",
        "mandatory_dependency_unverified",
        "source_limitation_blocks_s4",
        "authenticated_human_approval_missing",
        "rights_or_provenance_unverified",
        "accessibility_or_intelligibility_failure",
        "encoded_stability_failure",
        "source_fidelity_failure",
        "independent_critic_evidence_missing",
        "held_out_reference_parity_missing",
      ],
      requiresAuthenticatedPostRenderHumanApproval: true,
      sourceLimitationPreventsLabel: true,
      minimumImplementationLabel: "held-out-reference-parity-passed",
    },
    plannerAuthority: {
      maulLiveEditorialAuthority: "deterministic",
      josephLiveEditorialAuthority: "deterministic_seeded",
      textChunkingAuthority:
        "model_assisted_with_deterministic_validation_and_fallback",
      textChunkingDecisionScope:
        "semantic_boundaries_roles_and_emphasis_only",
      configuredRouteIsInvocation: false,
      inferenceReceiptRequiredForModelAuthority: true,
      currentVisualPlanningAuthority: "unavailable",
      textPlacementAuthority: "deterministic_placement_planner",
      rendererHandoffAuthority: "manifest_compiler",
    },
  });
