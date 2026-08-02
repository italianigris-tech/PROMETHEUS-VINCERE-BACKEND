import {
  maulRuntimeContractsSchema,
  type MaulRuntimeContracts,
} from "@prometheus/shared-types";

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
    },
  });
