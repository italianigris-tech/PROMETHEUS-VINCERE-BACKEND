import {describe, expect, it} from "vitest";

import {
  MAUL_RENDERER_FONT_CATALOG,
  maulAuditEventSchema,
  maulArtDirectionPlanPayloadSchema,
  maulRenderShortOperationPayloadSchema,
  maulArtifactCreateRequestSchema,
  maulArtifactRecordSchema,
  maulArtifactTypeSchema,
  maulEditorialTimelinePayloadSchema,
  maulPlanningBundlePayloadSchema,
  maulPlanningBundleV1PayloadSchema,
  maulPlanningBundleV2PayloadSchema,
  maulProjectSchema,
  maulQualityEvidenceBundlePayloadSchema,
  maulQualityTruthProofSchema,
  maulQualityTruthProofV2Schema,
  maulQualityTruthResultSchema,
  maulCreativeResultSchema,
  maulTextChunkPlanPayloadSchema,
  maulTextPlacementPlanPayloadSchema,
  maulTextAnimationPlanPayloadSchema,
  maulPlanningBundleV3PayloadSchema,
  maulUnifiedShortRenderManifestV3Schema,
  maulTypographyMotionPlanPayloadSchema,
  maulTypographyMotionPlanV1PayloadSchema,
  maulTypographyMotionPlanV2PayloadSchema,
  maulUnifiedShortRenderManifestSchema,
  maulUnifiedShortRenderManifestV1Schema,
  maulUnifiedShortRenderManifestV2Schema,
  maulVisualAssetPackSchema,
  maulVisualTrackSchema,
} from "./maul.js";
import {maulTextAnimationPlanCoreSchema} from "./maul-text-animation.js";
import * as runtimeSharedTypes from "../dist/index.js";

const createdAt = "2026-07-28T12:00:00.000Z";
const sha = (character: string) => character.repeat(64);
const creativeTreatmentPlanFixture = {
  schemaVersion: 'maul-art-direction-plan/v1',
  audienceIntent: 'Stop the scroll.',
  emotionalTemperature: 'urgent_confident',
  sourceRespectStance: 'Preserve source meaning.',
  theme: 'Visual hook',
  paletteIntent: ['ivory', 'amber'],
  typeRoles: [
    {role: 'primary', intent: 'neutral grotesk'},
    {role: 'accent', intent: 'editorial italic'},
  ],
  layoutAndNegativeSpaceLogic: 'Subject-safe lockups.',
  imageryAndBackgroundLanguage: 'Dark warm/cool contrast.',
  cameraBehavior: 'Stable framing.',
  motionPhysics: 'Restrained motion.',
  annotationGrammar: 'No annotation.',
  soundWorld: 'Source dialogue.',
  motifArc: {introduction: 'Lockup.', development: 'Hinge.', recall: 'Return.'},
  treatmentVariation: 'Vary hierarchy.',
  explicitProhibitions: ['No bottom captions.'],
  creativeTreatment: {
    schemaVersion: 'maul-creative-treatment-proposal/v1',
    profileId: 'aspire_visual_hook',
    compositionDirection: 'subject_integrated',
    primaryTypeRole: 'neutral_grotesk',
    accentTypeRole: 'editorial_italic',
    palette: {
      primary: '#F7F3EA',
      accent: '#F06424',
      sourceTreatment: 'dark_warm_cool_contrast',
    },
    textDensity: 'medium',
    emphasisMode: 'selective_accent_phrase',
    motionMode: 'restrained_phrase_lockup',
    rationale: ['Keep the speaker dominant.'],
  },
  creativeTreatmentInference: {
    status: 'invoked',
    provider: 'openai_compatible',
    model: 'gpt-5.6-terra',
    reasoningEffort: 'high',
    requestHash: sha('7'),
    responseHash: sha('8'),
    inferenceReceiptId: 'maul_creative_receipt_a',
    fallbackReason: null,
  },
} as const;

describe("MAUL worker operation payload", () => {
  it("requires verified timeline evidence and licensed render audio", () => {
    expect(maulRenderShortOperationPayloadSchema).toBeDefined();
    expect(() => maulRenderShortOperationPayloadSchema.parse({})).toThrow();
  });
});

describe("MAUL governed visual track contracts", () => {
  const sourceAsset = {
    assetId: "source_asset",
    projectId: "project_a",
    rootSourceAssetId: "source_asset",
    mediaKind: "video",
    storagePath: "uploads/source.mp4",
    sha256: "a".repeat(64),
    width: 1920,
    height: 1080,
    durationMs: 20_000,
    rights: {verified: true, receiptId: "source_receipt"},
    provenance: {kind: "source", provenanceReceiptId: null},
    permittedRoles: ["speaker_hero", "quiet_hold", "split_proof"],
  };
  const bRoll = {
    ...sourceAsset,
    assetId: "b_roll_a",
    storagePath: "approved/b-roll.mp4",
    sha256: "b".repeat(64),
    width: 1080,
    height: 1920,
    provenance: {kind: "project_owned", provenanceReceiptId: "b_roll_receipt"},
    permittedRoles: ["b_roll"],
  };
  const evidence = {
    ...sourceAsset,
    assetId: "evidence_a",
    mediaKind: "image",
    storagePath: "approved/evidence.png",
    sha256: "c".repeat(64),
    width: 1600,
    height: 900,
    durationMs: null,
    provenance: {kind: "licensed", provenanceReceiptId: "evidence_receipt"},
    permittedRoles: ["evidence_image", "split_proof"],
  };

  it("requires governed asset rights and lineage", () => {
    expect(
      maulVisualAssetPackSchema.parse({
        schemaVersion: "maul-visual-asset-pack/v1",
        projectId: "project_a",
        rootSourceAssetId: "source_asset",
        sourceAssetId: "source_asset",
        assets: [sourceAsset, bRoll, evidence],
      }).assets,
    ).toHaveLength(3);

    expect(() =>
      maulVisualAssetPackSchema.parse({
        schemaVersion: "maul-visual-asset-pack/v1",
        projectId: "project_a",
        rootSourceAssetId: "source_asset",
        sourceAssetId: "source_asset",
        assets: [{...bRoll, rights: {verified: false, receiptId: null}}],
      }),
    ).toThrow(/source|asset|lineage/i);
  });

  it("rejects overlapping, unsafe, and incompatible visual intervals", () => {
    const base = {
      schemaVersion: "maul-visual-track/v1",
      projectId: "project_a",
      rootSourceAssetId: "source_asset",
      sourceAssetId: "source_asset",
      outputDurationMs: 10_000,
      assets: [sourceAsset, bRoll, evidence],
    };
    expect(() =>
      maulVisualTrackSchema.parse({
        ...base,
        intervals: [
          {
            intervalId: "a",
            outputStartMs: 0,
            outputEndMs: 6_000,
            mode: "b_roll",
            assetId: "b_roll_a",
            secondaryAssetId: null,
            crop: {x: 0, y: 0, width: 1, height: 1},
            purpose: "Show the approved coverage.",
            evidenceRationale: "Directly supports the proof beat.",
            transition: {type: "hard_cut", durationMs: 0},
          },
          {
            intervalId: "b",
            outputStartMs: 5_000,
            outputEndMs: 10_000,
            mode: "evidence_image",
            assetId: "b_roll_a",
            secondaryAssetId: null,
            crop: {x: 0, y: 0, width: 1.1, height: 1},
            purpose: "Invalid evidence.",
            evidenceRationale: "Invalid.",
            transition: {type: "hard_cut", durationMs: 0},
          },
        ],
      }),
    ).toThrow(/overlap|crop|media/i);
  });

  it("rejects direct tracks containing foreign or reference-corpus assets", () => {
    expect(() =>
      maulVisualTrackSchema.parse({
        schemaVersion: "maul-visual-track/v1",
        projectId: "project_a",
        rootSourceAssetId: "source_asset",
        sourceAssetId: "source_asset",
        outputDurationMs: 1_000,
        assets: [
          sourceAsset,
          {
            ...evidence,
            assetId: "reference_pixels",
            projectId: "other_project",
            provenance: {
              kind: "reference_corpus",
              provenanceReceiptId: "reference_receipt",
            },
            permittedRoles: ["evidence_image"],
          },
        ],
        intervals: [
          {
            intervalId: "reference_interval",
            outputStartMs: 0,
            outputEndMs: 1_000,
            mode: "evidence_image",
            assetId: "reference_pixels",
            secondaryAssetId: null,
            crop: {x: 0, y: 0, width: 1, height: 1},
            purpose: "Invalid reference pixels.",
            evidenceRationale: "Must be blocked.",
            transition: {type: "hard_cut", durationMs: 0},
          },
        ],
      }),
    ).toThrow(/lineage|reference/i);
  });

  it("requires canonical source identity and measured B-roll duration", () => {
    expect(() =>
      maulVisualAssetPackSchema.parse({
        schemaVersion: "maul-visual-asset-pack/v1",
        projectId: "project_a",
        rootSourceAssetId: "source_asset",
        sourceAssetId: "alternate_source",
        assets: [
          {...sourceAsset, assetId: "alternate_source"},
          {...bRoll, durationMs: null},
        ],
      }),
    ).toThrow(/canonical|source/i);

    expect(() =>
      maulVisualTrackSchema.parse({
        schemaVersion: "maul-visual-track/v1",
        projectId: "project_a",
        rootSourceAssetId: "source_asset",
        sourceAssetId: "source_asset",
        outputDurationMs: 1_000,
        assets: [sourceAsset, {...bRoll, durationMs: null}],
        intervals: [{
          intervalId: "broll_interval",
          outputStartMs: 0,
          outputEndMs: 1_000,
          mode: "b_roll",
          assetId: "b_roll_a",
          secondaryAssetId: null,
          crop: {x: 0, y: 0, width: 1, height: 1},
          purpose: "B-roll duration must be known.",
          evidenceRationale: "Must be blocked.",
          transition: {type: "hard_cut", durationMs: 0},
        }],
      }),
    ).toThrow(/duration/i);
  });
});

describe("MAUL creative outcome contracts", () => {
  it("rejects a reference-parity claim for a safe caption fallback", () => {
    expect(() => maulCreativeResultSchema.parse({
      schemaVersion: "maul-creative-result/v1",
      placementOutcome: "SAFE_CAPTION_FALLBACK",
      structuralStatus: "pass",
      perceptualStatus: "pass",
      humanReviewStatus: "approved",
      referenceParityClaimed: true,
      failureLabels: [],
      evidenceArtifactIds: ["artifact_structural"],
    })).toThrow(/reference parity/i);
  });

  it("requires perceptual proof and human approval for an art-directed claim", () => {
    expect(() => maulCreativeResultSchema.parse({
      schemaVersion: "maul-creative-result/v1",
      placementOutcome: "ART_DIRECTED",
      structuralStatus: "pass",
      perceptualStatus: "unavailable",
      humanReviewStatus: "approved",
      referenceParityClaimed: false,
      failureLabels: [],
      evidenceArtifactIds: ["artifact_structural"],
    })).toThrow(/perceptual/i);
  });
});

const planBase = {
  sourceAssetId: "artifact_source",
  analysisArtifactId: "artifact_analysis",
  timelineArtifactId: "artifact_timeline",
  candidateArtifactId: "artifact_candidate",
  treatmentGenomeArtifactId: "artifact_treatment",
  planVersion: "fixture/v1",
  replayKey: sha("a"),
  authority: {
    authorityClass: "deterministic",
    stageId: "fixture_stage",
    confidence: 1,
    inferenceReceiptId: null,
  },
  warnings: [],
  fallbacks: [
    {
      condition: "A required input is unavailable.",
      action: "Block the plan.",
      status: "available",
    },
  ],
} as const;

describe('MAUL creative treatment contract', () => {
  it('retains a bounded treatment and inference receipt', () => {
    const result = maulArtDirectionPlanPayloadSchema.parse({
      ...planBase,
      ...creativeTreatmentPlanFixture,
    });
    expect(result.creativeTreatment.compositionDirection).toBe(
      'subject_integrated',
    );
    expect(result.creativeTreatmentInference).toMatchObject({
      status: 'invoked',
      model: 'gpt-5.6-terra',
      reasoningEffort: 'high',
    });
  });

  it('persists only renderer-safe reference editorial rhythm programs', () => {
    const rhythm = {
      schemaVersion: 'maul-reference-editorial-rhythm/v1',
      fontSystemId: 'condensed_kinetic_hinge',
      traitReceipt: [
        'cut_led_tempo',
        'deliberate_readable_holds',
        'editorial_serif_hinge',
        'phrase_hierarchy',
        'semantic_hinge_emphasis',
      ],
    } as const;
    const result = maulArtDirectionPlanPayloadSchema.parse({
      ...planBase,
      ...creativeTreatmentPlanFixture,
      referenceEditorialRhythm: rhythm,
    });

    expect(result.referenceEditorialRhythm).toEqual(rhythm);
    expect(MAUL_RENDERER_FONT_CATALOG).toEqual(expect.arrayContaining([
      expect.objectContaining({
        assetId: 'font_google_playfair_display_italic_700',
        family: 'Playfair Display',
        weight: 700,
      }),
    ]));

    expect(() => maulArtDirectionPlanPayloadSchema.parse({
      ...planBase,
      ...creativeTreatmentPlanFixture,
      referenceEditorialRhythm: {...rhythm, fontSystemId: 'unhydrated-library-font'},
    })).toThrow(/fontSystemId|invalid/i);
  });
});

const textChunkCore = {
  schemaVersion: "maul-shorts-text-chunk-plan/v2",
  transcriptHash: sha("b"),
  timelineHash: sha("c"),
  chunkProposalHash: sha("d"),
  outputDurationMs: 1000,
  pacing: "measured",
  style: "editorial",
  strategy: "deterministic_fallback",
  tokens: [
    {
      tokenId: "token_a",
      transcriptWordIndex: 0,
      text: "Proof",
      sourceStartMs: 0,
      sourceEndMs: 800,
      outputSpans: [{outputStartMs: 0, outputEndMs: 800}],
      outputStartMs: 0,
      outputEndMs: 800,
    },
  ],
  chunks: [
    {
      chunkId: "chunk_a",
      tokenIds: ["token_a"],
      text: "Proof",
      outputStartMs: 0,
      outputEndMs: 800,
      semanticRole: "proof",
      emphasis: {tokenIds: ["token_a"], text: "Proof", level: "key"},
      holdAcrossProtectedPause: false,
      rationale: "One source-grounded proof token.",
      confidence: 1,
    },
  ],
  protectedEntities: [],
  protectedPauses: [],
  inference: {
    status: "skipped_missing_credentials",
    provider: "openai_compatible",
    baseUrl: "https://example.com/v1",
    model: "fixture-model",
    requestHash: null,
    responseHash: null,
    fallbackReason: "The fixture uses the governed deterministic fallback.",
  },
  inputHashes: {
    transcript: sha("b"),
    editorialTimeline: sha("c"),
    chunkProposal: sha("d"),
  },
} as const;

const textChunkPayload = {...planBase, ...textChunkCore} as const;

const textPlacementCore = {
  schemaVersion: "maul-text-placement-plan/v1",
  textChunkPlanArtifactId: "artifact_text_chunk",
  textChunkPlanHash: sha("e"),
  catalog: {
    catalogId: "maul-placement-catalog-three-family-v1",
    version: "1",
    hash: sha("f"),
  },
  scorePolicy: {
    policyId: "maul-placement-score-policy-v1",
    version: "1",
    hash: sha("1"),
    dimensionWeights: {readability: 1},
    beamWidth: 3,
    planningHorizonSegments: 3,
  },
  platformProfile: {
    profileId: "maul-platform-instagram-reels-v1",
    platform: "instagram_reels",
    version: "1",
    output: {width: 1080, height: 1920, fps: 30},
    safeRegion: {x: 0.05, y: 0.05, width: 0.85, height: 0.82},
  },
  compatibilityProfiles: [
    {
      profileId: "maul-compat-dm-sans-v1",
      family: "DM Sans",
      approvedFontAssets: [
        {
          assetId: "font_google_dm_sans_700",
          family: "DM Sans",
          weights: [500, 700, 800],
        },
      ],
      loadedFallback: {
        assetId: "font_google_dm_sans_700",
        family: "DM Sans",
        weight: 700,
      },
      metrics: {
        fingerprint: sha("2"),
        maxGlyphWidthEm: 1.1,
        maxLineHeightEm: 1.25,
        minimumFontSizePx: 48,
        maximumFontSizePx: 96,
        minimumLineHeight: 1,
        maximumLineHeight: 1.25,
      },
    },
  ],
  compositionIntervals: [
    {
      intervalId: "composition_interval_a",
      sceneId: "scene_a",
      discontinuityId: "discontinuity_a",
      variantId: "primary.centered_v1",
      outputStartMs: 0,
      outputEndMs: 1000,
      transformHash: sha("3"),
      sourceViewport: {x: 0, y: 0, width: 1, height: 1},
      sourceOccupancy: [{x: 0, y: 0, width: 1, height: 1}],
      paddedNonSourceRegions: [],
      crop: {x: 0.2, y: 0, width: 0.6, height: 1},
      scale: {x: 1, y: 1},
    },
  ],
  status: "planned",
  blockingReason: null,
  segments: [
    {
      segmentId: "placement_segment_a",
      chunkId: "chunk_a",
      sceneId: "scene_a",
      discontinuityId: "discontinuity_a",
      outputStartMs: 0,
      outputEndMs: 800,
      selectedCompositionVariantId: "primary.centered_v1",
      selectedTransformHash: sha("3"),
      tokenIds: ["token_a"],
      lines: [{lineId: "line_a", tokenIds: ["token_a"], text: "Proof"}],
      family: "measured",
      variantId: "measured.centered_statement_v1",
      box: {x: 0.15, y: 0.62, width: 0.7, height: 0.12},
      maximumEnvelope: {x: 0.12, y: 0.59, width: 0.76, height: 0.18},
      alignment: "center",
      compatibility: {
        profileId: "maul-compat-dm-sans-v1",
        metricsFingerprint: sha("2"),
        nominalFontSizePx: 72,
        lineHeight: 1.1,
        hierarchyScale: 1,
      },
      depth: {
        desired: "front",
        resolved: "front",
        treatmentState: "not_requested",
      },
      minimumLegibilityPrimitive: {kind: "none"},
      hardGates: [
        {
          gateId: "exact_token_sequence",
          status: "pass",
          evidenceId: "evidence_tokens",
          rationale: "The token sequence is exact.",
        },
      ],
      scores: {readability: 1},
      rationale: "The measured fixture fits.",
      confidence: 1,
      fallbackCode: null,
      fallbackReason: null,
    },
  ],
  inputHashes: {
    textChunkPlan: sha("e"),
    outputCompositionTrack: sha("4"),
    platformProfile: sha("5"),
    compatibilityProfile: sha("6"),
    catalog: sha("f"),
    scorePolicy: sha("1"),
  },
} as const;

const textPlacementPayload = {...planBase, ...textPlacementCore} as const;

const typographyPlanCommon = {
  captionGroups: [
    {
      text: "Proof",
      outputStartMs: 0,
      outputEndMs: 800,
      sourceGrounded: true,
      role: "dialogue_caption",
    },
  ],
  editorialStatements: [],
  editorialTextWithheldReason: "No authored statement is needed.",
  fontResolution: {
    requestedRole: "utility",
    selectedFamily: "DM Sans",
    selectedAssetId: "font_google_dm_sans_700",
    status: "eligible_loaded",
    reason: "The pinned compatibility-profile asset is loaded.",
  },
  motionPrograms: [
    {
      capabilityId: "maul_caption_static",
      semanticRole: "Readable governed dialogue.",
      outputStartMs: 0,
      outputEndMs: 800,
      execution: {
        executionStatus: "native",
        nativeBranch: "MaulShort.PlannedCaptionTokens.v1",
        fallback: null,
        evidenceRequirement: "Rendered token evidence is required.",
      },
    },
  ],
} as const;

const typographyV1 = {
  ...planBase,
  schemaVersion: "maul-typography-motion-plan/v1",
  textChunkPlan: null,
  textChunkAuthority: null,
  ...typographyPlanCommon,
} as const;

const typographyV2 = {
  ...planBase,
  schemaVersion: "maul-typography-motion-plan/v2",
  textChunkPlanArtifactId: "artifact_text_chunk",
  textChunkPlanHash: sha("e"),
  textPlacementPlanArtifactId: "artifact_text_placement",
  textPlacementPlanHash: sha("7"),
  ...typographyPlanCommon,
} as const;

const textAnimationCore = {
  schemaVersion: "maul-text-animation-plan/v1",
  textChunkPlanArtifactId: "artifact_text_chunk",
  textChunkPlanHash: sha("e"),
  textPlacementPlanArtifactId: "artifact_text_placement",
  textPlacementPlanHash: sha("7"),
  treatmentGenomeArtifactId: "artifact_treatment",
  treatmentGenomeHash: sha("8"),
  outputDurationMs: 1000,
  programs: [
    {
      animationId: "animation_segment_a",
      treatment: "fade_rise",
      target: {
        scope: "segment",
        placementSegmentId: "placement_segment_a",
        tokenIds: ["token_a"],
      },
      phases: {
        entry: {
          outputStartMs: 0,
          outputEndMs: 120,
          easing: {type: "linear"},
          from: {opacity: 0, translateXPx: 0, translateYPx: 24, scale: 1},
          to: {opacity: 1, translateXPx: 0, translateYPx: 0, scale: 1},
        },
        hold: {
          outputStartMs: 120,
          outputEndMs: 700,
          easing: {type: "linear"},
          from: {opacity: 1, translateXPx: 0, translateYPx: 0, scale: 1},
          to: {opacity: 1, translateXPx: 0, translateYPx: 0, scale: 1},
        },
        exit: {
          outputStartMs: 700,
          outputEndMs: 800,
          easing: {type: "linear"},
          from: {opacity: 1, translateXPx: 0, translateYPx: 0, scale: 1},
          to: {opacity: 0, translateXPx: 0, translateYPx: -12, scale: 1},
        },
      },
      rationale: "Fixture entry and exit.",
    },
  ],
  inputHashes: {
    textChunkPlan: sha("e"),
    textPlacementPlan: sha("7"),
    treatmentGenome: sha("8"),
  },
} as const;

const textAnimationPayload = {...planBase, ...textAnimationCore} as const;

const typographyV3 = {
  ...typographyV2,
  schemaVersion: "maul-typography-motion-plan/v3",
  textAnimationPlanArtifactId: "artifact_text_animation",
  textAnimationPlanHash: sha("9"),
} as const;

const planningArtifactIdsV1 = {
  observationSnapshot: "artifact_observation",
  candidateNarrative: "artifact_narrative",
  beatMap: "artifact_beats",
  typographyMotion: "artifact_typography",
  camera: "artifact_camera",
  visual: "artifact_visual",
  audio: "artifact_audio",
  capabilitySelection: "artifact_capabilities",
  adapterDecision: "artifact_adapter",
  artDirection: "artifact_art_direction",
  contextAssembly: "artifact_context",
  shotIntentMatrix: "artifact_shots",
  textOpportunity: "artifact_text_opportunity",
  revision: "artifact_revision",
} as const;

const planningArtifactIdsV2 = {
  ...planningArtifactIdsV1,
  textChunk: "artifact_text_chunk",
  textPlacement: "artifact_text_placement",
} as const;

const planningArtifactIdsV3 = {
  ...planningArtifactIdsV2,
  textAnimation: "artifact_text_animation",
} as const;

const planningBundleV1 = {
  ...planBase,
  schemaVersion: "maul-planning-bundle/v1",
  planArtifactIds: planningArtifactIdsV1,
  rendererReadiness: "governed_with_explicit_fallbacks",
  blockingReasons: [],
} as const;

const planningBundleV2 = {
  ...planBase,
  schemaVersion: "maul-planning-bundle/v2",
  planArtifactIds: planningArtifactIdsV2,
  rendererReadiness: "governed_with_explicit_fallbacks",
  blockingReasons: [],
} as const;

const planningBundleV3 = {
  ...planBase,
  schemaVersion: "maul-planning-bundle/v3",
  planArtifactIds: planningArtifactIdsV3,
  rendererReadiness: "governed_with_explicit_fallbacks",
  blockingReasons: [],
} as const;

const governedNativeExecution = {
  executionStatus: "native",
  nativeBranch: "MaulShort.fixture.v1",
  fallback: null,
  evidenceRequirement: "A rendered fixture is required.",
} as const;

const manifestPlansV1 = {
  observationSnapshot: {
    ...planBase,
    schemaVersion: "maul-observation-snapshot/v1",
    facts: {
      language: "en",
      transcriptWordCount: 1,
      verifiedVoiceSpanCount: 1,
      verifiedSilenceSpanCount: 0,
      shotCount: 1,
      speakerTrackCount: 1,
      sourceDurationMs: 1000,
      sourceWidth: 1920,
      sourceHeight: 1080,
      sourceFps: 30,
    },
    unavailableSignals: [],
  },
  candidateNarrative: {
    ...planBase,
    schemaVersion: "maul-candidate-narrative/v1",
    coherentThesis: "Proof",
    segments: [
      {
        role: "proof",
        claim: "Proof",
        sourceStartMs: 0,
        sourceEndMs: 800,
        sourceSupported: true,
        transcriptWordStartIndex: 0,
        transcriptWordEndIndex: 0,
      },
    ],
    unsupportedClaims: [],
  },
  beatMap: {
    ...planBase,
    schemaVersion: "maul-editorial-beat-map/v1",
    beats: [
      {
        beatId: "beat_a",
        role: "proof",
        sourceStartMs: 0,
        sourceEndMs: 1000,
        outputStartMs: 0,
        outputEndMs: 1000,
        spokenIdea: "Proof",
        intensity: 0.5,
        informationDensity: 0.5,
        dominantFocus: "typography",
        allowedEvents: ["caption"],
        protectedPause: false,
        rationale: "Keep the proof readable.",
        confidence: 1,
      },
    ],
    sharedAttentionBudget: {
      maxConcurrentDominantEvents: 1,
      collisionPolicy: "One dominant event at a time.",
    },
  },
  typographyMotion: typographyV1,
  camera: {
    ...planBase,
    schemaVersion: "maul-framing-camera-plan/v1",
    events: [
      {
        eventId: "camera_a",
        outputStartMs: 0,
        outputEndMs: 1000,
        cropCenterX: 0.5,
        cropCenterY: 0.5,
        startScale: 1,
        endScale: 1,
        motivatedByBeatId: "beat_a",
        rationale: "Keep the fixture stable.",
        execution: governedNativeExecution,
      },
    ],
    continuityPolicy: "Remain stable for the fixture.",
    maxScale: 1,
  },
  visual: {
    ...planBase,
    schemaVersion: "maul-visual-plan/v1",
    scenes: [
      {
        sceneId: "scene_a",
        outputStartMs: 0,
        outputEndMs: 1000,
        mode: "speaker_only",
        purpose: "Render the authoritative source.",
        assetArtifactId: "artifact_source",
        provenanceStatus: "source",
        referencePixelsExcluded: true,
        execution: governedNativeExecution,
      },
    ],
    neededButUnavailable: [],
  },
  audio: {
    ...planBase,
    schemaVersion: "maul-dialogue-audio-plan/v1",
    dialoguePriority: true,
    targetLufs: -14,
    musicPolicy: "Dialogue first.",
    duckingDb: -8,
    sfxIntents: [],
    execution: governedNativeExecution,
  },
  capabilitySelection: {
    ...planBase,
    schemaVersion: "maul-capability-selection/v1",
    selections: [
      {
        capabilityId: "maul_fixture",
        semanticRole: "Execute the fixture.",
        selected: true,
        execution: governedNativeExecution,
      },
    ],
    unknownCapabilityIds: [],
  },
  adapterDecision: {
    ...planBase,
    schemaVersion: "maul-adapter-decision/v1",
    adapterId: "maul-portrait-format-adapter/v1",
    platform: "instagram_reels",
    canvas: {width: 1080, height: 1920, fps: 30},
    safeRegion: {topPx: 96, rightPx: 72, bottomPx: 320, leftPx: 72},
    preservedIntent: ["Readable source-grounded dialogue."],
    adaptedConstraints: [
      {
        field: "canvas",
        from: "source",
        to: "1080x1920",
        reason: "The governed output is portrait.",
      },
    ],
    silentIntentMutations: [],
  },
  artDirection: {
    ...planBase,
    schemaVersion: "maul-art-direction-plan/v1",
    audienceIntent: "Present one clear proof.",
    emotionalTemperature: "calm_authoritative",
    sourceRespectStance: "Keep source truth authoritative.",
    theme: "Restrained proof.",
    paletteIntent: ["Black", "White"],
    typeRoles: [
      {role: "dialogue", intent: "Readable"},
      {role: "utility", intent: "Restrained"},
    ],
    layoutAndNegativeSpaceLogic: "Use measured negative space.",
    imageryAndBackgroundLanguage: "Use source imagery only.",
    cameraBehavior: "Static.",
    motionPhysics: "Static.",
    annotationGrammar: "No annotations.",
    soundWorld: "Dialogue first.",
    motifArc: {introduction: "None", development: "None", recall: "None"},
    treatmentVariation: "Measured fixture.",
    explicitProhibitions: ["No unsupported claims."],
  },
  contextAssembly: {
    ...planBase,
    schemaVersion: "maul-context-assembly-plan/v1",
    wholeSourceSynopsis: "One source-grounded proof.",
    narrativePhases: [
      {
        phase: "proof",
        sourceStartMs: 0,
        sourceEndMs: 1000,
        summary: "Proof",
      },
    ],
    candidateNeighborhood: {
      sourceStartMs: 0,
      sourceEndMs: 1000,
      precedingContext: "",
      followingContext: "",
    },
    localTranscript: "Proof",
    namedFacts: [],
    callbacks: [],
    setupPayoffDependencies: [],
    chronologyConstraints: [],
    sourceQualityChanges: [],
    unresolvedUncertainty: [],
    omissionReports: [],
  },
  shotIntentMatrix: {
    ...planBase,
    schemaVersion: "maul-shot-intent-matrix/v1",
    shots: [
      {
        shotId: "shot_a",
        sourceStartMs: 0,
        sourceEndMs: 1000,
        outputStartMs: 0,
        outputEndMs: 1000,
        editorialPurpose: "Deliver proof.",
        rhetoricalRole: "proof",
        inReason: "Begin the proof.",
        outReason: "End the proof.",
        continuityRelationship: "Single continuous shot.",
        screenDirection: "stable",
        poseAndGestureState: "Stable.",
        eyeLine: "camera",
        cropAndCameraTarget: "Centered source crop.",
        evidenceBackgroundDockingState: "No evidence panel.",
        textOpportunityId: "text_opportunity_a",
        audioHandlesMs: {pre: 0, post: 0},
        colorMatchIntent: "Preserve source color.",
        transition: "None.",
        confidence: 1,
        fallback: "Use the source crop.",
      },
    ],
    implementationSegmentsAreShots: false,
  },
  textOpportunity: {
    ...planBase,
    schemaVersion: "maul-text-opportunity-plan/v1",
    opportunities: [
      {
        opportunityId: "text_opportunity_a",
        beatId: "beat_a",
        kind: "dialogue_caption",
        communicationBenefit: "Keep the proof readable.",
        sourceSupport: "Proof",
        viewerReadingLoad: 0.2,
        availableNegativeSpace: "high",
        subjectOcclusionRisk: "low",
        speechRate: "slow",
        concurrentImagery: "Speaker source.",
        durationMs: 1000,
        hierarchyOwner: "caption",
        decision: "use",
        rationale: "The dialogue requires a caption.",
      },
    ],
    quotaUsed: false,
  },
  revision: {
    ...planBase,
    schemaVersion: "maul-revision-plan/v1",
    immutableFields: ["source truth"],
    allowedMutations: ["placement fallback"],
    repairOptions: [
      {
        failureClass: "legibility",
        permittedAction: "Select the governed plate.",
        affectedGates: ["legibility"],
      },
    ],
    maximumAttempts: 1,
    maximumWallClockMs: 1000,
    maximumCostUsd: 0,
    criticMustBeIndependent: true,
    noProgressDetection: "Stop after no change.",
    oscillationDetection: "Stop after repeat state.",
    humanCheckpoint: "Require review.",
    stopReasons: ["Budget exhausted."],
    thresholdReductionAllowed: false,
  },
} as const;

const manifestTimeline = {
  sourceAssetId: "artifact_source",
  analysisArtifactId: "artifact_analysis",
  sourceDurationMs: 1000,
  outputDurationMs: 1000,
  selectedClipWindows: [{sourceStartMs: 0, sourceEndMs: 1000}],
  cutCandidates: [],
  protectedRanges: [],
  timestampMap: [
    {
      sourceStartMs: 0,
      sourceEndMs: 1000,
      outputStartMs: 0,
      outputEndMs: 1000,
      mode: "keep",
    },
  ],
  speakerCropTracks: [],
  editRationale: ["Keep the full fixture."],
  qualityWarnings: [],
} as const;

const manifestTreatment = {
  treatmentId: "minimal_expert",
  timelineArtifactId: "artifact_timeline",
  catalogEntryName: "Minimal Expert",
  version: "1",
  replayKey: sha("8"),
  purpose: "Present one proof clearly.",
  targetViewerState: "Informed.",
  grammar: {
    hook: "Proof",
    escalation: "Proof",
    proof: "Proof",
    reveal: "Proof",
    payoff: "Proof",
    cta: "Proof",
  },
  pacing: {
    minCutsPerMinute: 0,
    maxCutsPerMinute: 0,
    protectedPausePolicy: "Preserve verified pauses.",
  },
  visualPolicy: {},
  audioPolicy: {},
  rendererInputs: {
    framing: {
      mode: "clarity_first",
      safeZone: "platform_ui_strict",
      maxPunchInScale: 1,
      speakerPriority: true,
    },
    caption: {
      profile: "precision_minimal",
      maxWordsPerCard: 8,
      minFontScale: 1,
      hierarchy: ["dialogue"],
      typographyGrammar: "Measured.",
    },
    motion: {
      intensity: "sparse",
      permittedPrimitives: ["none"],
      permittedTransitions: ["cut"],
    },
    bRoll: {policy: "withhold", maxInsertsPerMinute: 0},
    audio: {
      musicBehavior: "withhold",
      sfxBehavior: "withhold",
      duckingDb: -8,
    },
  },
  repetitionBudget: {
    maxRepeatedPrimitivePerClip: 1,
    maxRecentFeedReuse: 0,
    lookbackPosts: 1,
  },
  brandConstraints: [],
  accessibilityConstraints: ["Readable captions."],
  prohibitedMotifs: [],
  referenceCorpusArtifactIds: [],
  judgmentLayer: {
    minimumWeightedScore: 85,
    rubric: Array.from({length: 5}, (_, index) => ({
      id: `rubric_${index}`,
      label: `Rubric ${index}`,
      weight: 1,
      minimumScore: 80,
    })),
    failureClasses: Array.from({length: 5}, (_, index) => ({
      id: `failure_${index}`,
      label: `Failure ${index}`,
      description: `Failure class ${index}.`,
      severity: "major" as const,
    })),
  },
  renderFallbacks: ["Block when unreadable."],
  provenanceRules: ["Use source pixels only."],
} as const;

const manifestExecutionV1 = [
  ["observationSnapshot", "observation_snapshot"],
  ["candidateNarrative", "candidate_narrative"],
  ["beatMap", "editorial_beat_map"],
  ["typographyMotion", "typography_motion_plan"],
  ["camera", "framing_camera_plan"],
  ["visual", "visual_plan"],
  ["audio", "dialogue_audio_plan"],
  ["capabilitySelection", "capability_selection"],
  ["adapterDecision", "adapter_decision"],
  ["artDirection", "art_direction_plan"],
  ["contextAssembly", "context_assembly_plan"],
  ["shotIntentMatrix", "shot_intent_matrix"],
  ["textOpportunity", "text_opportunity_plan"],
  ["revision", "revision_plan"],
] as const;

const manifestV1 = {
  schemaVersion: "maul-unified-short-render-manifest/v1",
  rendererInputKind: "unified_short_render_manifest_only",
  planningBundleArtifactId: "artifact_planning_bundle",
  planArtifactIds: planningArtifactIdsV1,
  source: {
    sourceAssetId: "artifact_source",
    storagePath: "source.mp4",
    sha256: sha("9"),
  },
  timeline: manifestTimeline,
  treatment: manifestTreatment,
  captions: [
    {text: "Proof", startMs: 0, endMs: 800, timestampMs: 0, confidence: 1},
  ],
  audio: {
    planId: "audio_plan",
    planMode: "render_ready",
    musicTrack: {
      id: "music_a",
      storagePath: "music.wav",
      licenseType: "fixture",
      commercialAllowed: true,
      licenseVerified: true,
      renderSafe: true,
      title: "Fixture",
      artist: "Fixture",
      durationSec: 1,
    },
    sfxAssets: [],
  },
  plans: manifestPlansV1,
  planExecution: manifestExecutionV1.map(([key, planType]) => ({
    planArtifactId: planningArtifactIdsV1[key],
    planType,
    executionStatus: "native" as const,
    nativeBranch: "MaulShort.fixture.v1",
    fallback: null,
  })),
  output: {width: 1080, height: 1920, fps: 30, codec: "h264"},
  replayKey: sha("0"),
  createdAt,
} as const;

const manifestV2 = {
  ...manifestV1,
  schemaVersion: "maul-unified-short-render-manifest/v2",
  planArtifactIds: planningArtifactIdsV2,
  plans: {
    ...manifestPlansV1,
    typographyMotion: typographyV2,
    textChunk: textChunkPayload,
    textPlacement: textPlacementPayload,
  },
  planExecution: [
    ...manifestV1.planExecution,
    {
      planArtifactId: "artifact_text_chunk",
      planType: "text_chunk_plan",
      executionStatus: "native",
      nativeBranch: "MaulShort.PlannedCaptionTokens.v1",
      fallback: null,
    },
    {
      planArtifactId: "artifact_text_placement",
      planType: "text_placement_plan",
      executionStatus: "native",
      nativeBranch: "MaulShort.PlannedPlacement.v1",
      fallback: null,
    },
  ],
} as const;

const manifestV3 = {
  ...manifestV2,
  schemaVersion: "maul-unified-short-render-manifest/v3",
  planArtifactIds: planningArtifactIdsV3,
  plans: {
    ...manifestV2.plans,
    typographyMotion: typographyV3,
    textAnimation: textAnimationPayload,
  },
  planExecution: [
    ...manifestV2.planExecution,
    {
      planArtifactId: "artifact_text_animation",
      planType: "text_animation_plan",
      executionStatus: "native",
      nativeBranch: "MaulShort.PlannedTextAnimation.v1",
      fallback: null,
    },
  ],
} as const;

describe("MAUL shared contracts", () => {
  it("keeps the package runtime entry point in parity with source exports", () => {
    expect(typeof runtimeSharedTypes.maulResolvedFontAssetSchema).toBe("object");
    expect(runtimeSharedTypes.maulResolvedFontAssetSchema.safeParse({}).success).toBe(false);
  });
  it("keeps canonical job identity and source ownership on the project", () => {
    const project = maulProjectSchema.parse({
      schemaVersion: "maul-project/v1",
      id: "project_alpha",
      canonicalJobId: "maul_job_alpha",
      creatorId: "creator_alpha",
      status: "intake_ready",
      intake: {
        goal: "retention",
        platform: "instagram_reels",
        sourceProfile: {
          mode: "single_speaker_talking_head",
          principalSpeakerCount: 1,
          primaryLanguage: "en"
        },
        brandKitId: null,
        treatmentPreference: "founder_podcast",
        requestedShortCount: 3,
        requestedThumbnailCount: 4,
        targetDurationMs: {min: 20000, max: 45000}
      },
      rootSourceAssetId: "artifact_source",
      artifactIds: ["artifact_source"],
      activeRunId: "run_alpha",
      revision: 1,
      createdAt,
      updatedAt: createdAt
    });

    expect(project.canonicalJobId).toBe("maul_job_alpha");
    expect(project.rootSourceAssetId).toBe("artifact_source");
  });

  it("makes lineage mandatory on every typed artifact", () => {
    const source = maulArtifactRecordSchema.parse({
      schemaVersion: "maul-artifact/v1",
      artifactId: "artifact_source",
      artifactType: "source_asset",
      lineage: {
        projectId: "project_alpha",
        canonicalJobId: "maul_job_alpha",
        runId: "run_alpha",
        rootSourceAssetId: "artifact_source",
        parentArtifactIds: [],
        sequence: 1,
        producedBy: {module: "maul-project-service", version: "1"},
        createdAt
      },
      payload: {
        originalFilename: "founder-talk.mp4",
        storageKey: "uploads/founder-talk.mp4",
        mediaType: "video/mp4",
        sha256: "a".repeat(64),
        durationMs: 120000,
        width: 1920,
        height: 1080,
        fps: 30,
        hasAudio: true,
        hasVideo: true
      }
    });

    expect(source.artifactType).toBe("source_asset");
    expect(source.lineage.rootSourceAssetId).toBe(source.artifactId);
  });

  it("requires an explicit, ordered source-to-output timestamp map", () => {
    const timeline = maulEditorialTimelinePayloadSchema.parse({
      sourceAssetId: "artifact_source",
      analysisArtifactId: "artifact_analysis",
      sourceDurationMs: 120000,
      outputDurationMs: 23000,
      selectedClipWindows: [
        {sourceStartMs: 10000, sourceEndMs: 35000}
      ],
      cutCandidates: [
        {
          sourceStartMs: 17000,
          sourceEndMs: 19000,
          sentenceSafe: true,
          reason: "non_protected_silence",
          confidence: 0.98
        }
      ],
      protectedRanges: [
        {
          sourceStartMs: 24000,
          sourceEndMs: 25000,
          kind: "rhetorical_pause",
          reason: "Preserves the payoff beat."
        }
      ],
      timestampMap: [
        {
          sourceStartMs: 10000,
          sourceEndMs: 17000,
          outputStartMs: 0,
          outputEndMs: 7000,
          mode: "keep"
        },
        {
          sourceStartMs: 17000,
          sourceEndMs: 19000,
          outputStartMs: 7000,
          outputEndMs: 7000,
          mode: "cut"
        },
        {
          sourceStartMs: 19000,
          sourceEndMs: 35000,
          outputStartMs: 7000,
          outputEndMs: 23000,
          mode: "keep"
        }
      ],
      speakerCropTracks: [],
      editRationale: ["Removed dead air without touching the rhetorical pause."],
      qualityWarnings: []
    });

    expect(timeline.timestampMap).toHaveLength(3);

    expect(() => maulEditorialTimelinePayloadSchema.parse({
      ...timeline,
      timestampMap: [
        timeline.timestampMap[2],
        timeline.timestampMap[0]
      ]
    })).toThrow();
  });

  it("requires rendered probes, all mandatory dimensions, and independent authority before quality can pass", () => {
    const base = {
      schemaVersion: "maul-quality-evidence-bundle/v1",
      sourceAssetId: "artifact_source",
      candidateArtifactId: "artifact_candidate",
      timelineArtifactId: "artifact_timeline",
      treatmentGenomeArtifactId: "artifact_treatment",
      planningBundleArtifactId: "artifact_planning_bundle",
      renderManifestArtifactId: "artifact_render_manifest",
      exportArtifactId: "artifact_export",
      replayKey: "a".repeat(64),
      evidenceStatus: "unverified",
      renderedProbeIds: [],
      mandatoryDimensions: [],
      hardFailures: [{id: "rendered_evidence_missing", dimension: "encoded_temporal_stability", message: "No probe."}],
      independentCritic: {
        authorityClass: "unavailable",
        provider: null,
        model: null,
        inferenceReceiptId: null
      },
      authenticatedHumanApprovalRequired: true,
      warnings: ["Evidence has not been collected."],
      fallbacks: [{condition: "Critic unavailable", action: "Keep export held", status: "blocking"}],
      createdAt
    } as const;

    expect(maulQualityEvidenceBundlePayloadSchema.parse(base).evidenceStatus).toBe("unverified");
    expect(() => maulQualityEvidenceBundlePayloadSchema.parse({
      ...base,
      evidenceStatus: "passed",
      hardFailures: []
    })).toThrow(/passed|rendered|dimension|critic/i);
  });

  it("requires evidence for every verified Quality Truth proof", () => {
    const proof = {
      schemaVersion: "maul-quality-truth-proof/v1",
      manifestReplayKey: "b".repeat(64),
      captionLayout: {
        status: "verified",
        evidenceId: "evidence_caption_layout",
        boxes: [
          {
            captionIndex: 0,
            leftPx: 120,
            topPx: 1440,
            rightPx: 960,
            bottomPx: 1560
          }
        ]
      },
      fontRuntime: {
        status: "eligible_loaded",
        family: "Prometheus Test Sans",
        assetId: "font_asset_test_sans",
        evidenceId: "evidence_font_loaded"
      },
      cropAndMask: {
        status: "verified",
        evidenceId: "evidence_crop_mask",
        maskingRequired: false,
        maskingStatus: "not_required",
        crops: [
          {
            outputStartMs: 0,
            outputEndMs: 1000,
            x: 0.2,
            y: 0,
            width: 0.6,
            height: 1
          }
        ]
      },
      cameraContinuity: {
        status: "verified_continuous",
        evidenceId: "evidence_camera_continuity",
        resetOutputMs: []
      },
      capabilities: [
        {
          capabilityId: "maul_caption_page_spring",
          status: "native_render_safe",
          evidenceId: "evidence_caption_spring"
        }
      ],
      fallbacks: [
        {
          planType: "dialogue_audio_plan",
          selected: true,
          evidenceId: "evidence_audio_fallback"
        }
      ]
    } as const;

    expect(maulQualityTruthProofSchema.parse(proof)).toEqual(proof);
    expect(() => maulQualityTruthProofSchema.parse({
      ...proof,
      fontRuntime: {
        ...proof.fontRuntime,
        evidenceId: null
      }
    })).toThrow(/evidence/i);
  });

  it("keeps Quality Truth status consistent with its failure list", () => {
    const blocked = {
      schemaVersion: "maul-quality-truth-result/v1",
      manifestReplayKey: "c".repeat(64),
      status: "blocked",
      evidenceIds: [],
      failures: [
        {
          code: "font_fallback_forbidden",
          field: "plans.typographyMotion.fontResolution",
          outputStartMs: null,
          outputEndMs: null,
          message: "System font fallback cannot enter the MAUL renderer.",
          evidenceId: null
        }
      ]
    } as const;

    expect(maulQualityTruthResultSchema.parse(blocked).status).toBe("blocked");
    expect(() => maulQualityTruthResultSchema.parse({
      ...blocked,
      status: "pass"
    })).toThrow(/zero failures/i);
  });

  it("supports an auditable Quality Truth evaluation event", () => {
    const event = maulAuditEventSchema.parse({
      schemaVersion: "maul-audit-event/v1",
      eventId: "event_quality_truth",
      projectId: "project_alpha",
      canonicalJobId: "maul_job_alpha",
      runId: "run_alpha",
      sequence: 3,
      type: "quality_truth_evaluated",
      artifactId: "artifact_render_manifest",
      detail: {status: "blocked"},
      createdAt
    });

    expect(event.type).toBe("quality_truth_evaluated");
  });

  it("registers standalone chunk, placement, and animation payloads as governed artifacts", () => {
    expect(maulArtifactTypeSchema.parse("text_chunk_plan")).toBe(
      "text_chunk_plan",
    );
    expect(maulArtifactTypeSchema.parse("text_placement_plan")).toBe(
      "text_placement_plan",
    );
    expect(maulArtifactTypeSchema.parse("text_animation_plan")).toBe(
      "text_animation_plan",
    );
    expect(
      maulTextChunkPlanPayloadSchema.parse(textChunkPayload).chunks[0]!.chunkId,
    ).toBe("chunk_a");
    expect(
      maulTextPlacementPlanPayloadSchema.parse(textPlacementPayload).segments[0]!
        .segmentId,
    ).toBe("placement_segment_a");
    expect(
      maulTextAnimationPlanPayloadSchema.parse(textAnimationPayload).programs[0]!
        .animationId,
    ).toBe("animation_segment_a");
    expect(
      maulTextAnimationPlanCoreSchema.parse(textAnimationCore).programs[0]!
        .target.placementSegmentId,
    ).toBe("placement_segment_a");

    const lineage = {
      projectId: "project_alpha",
      canonicalJobId: "maul_job_alpha",
      runId: "run_alpha",
      rootSourceAssetId: "artifact_source",
      parentArtifactIds: ["artifact_timeline"],
      sequence: 2,
      producedBy: {module: "maul-planner", version: "2"},
      createdAt,
    } as const;
    expect(
      maulArtifactRecordSchema.parse({
        schemaVersion: "maul-artifact/v1",
        artifactId: "artifact_text_chunk",
        artifactType: "text_chunk_plan",
        lineage,
        payload: textChunkPayload,
      }).artifactType,
    ).toBe("text_chunk_plan");
    expect(
      maulArtifactRecordSchema.parse({
        schemaVersion: "maul-artifact/v1",
        artifactId: "artifact_text_placement",
        artifactType: "text_placement_plan",
        lineage,
        payload: textPlacementPayload,
      }).artifactType,
    ).toBe("text_placement_plan");
    expect(
      maulArtifactRecordSchema.parse({
        schemaVersion: "maul-artifact/v1",
        artifactId: "artifact_text_animation",
        artifactType: "text_animation_plan",
        lineage,
        payload: textAnimationPayload,
      }).artifactType,
    ).toBe("text_animation_plan");
    expect(
      maulArtifactCreateRequestSchema.parse({
        artifactType: "text_chunk_plan",
        parentArtifactIds: ["artifact_timeline"],
        payload: textChunkPayload,
      }).artifactType,
    ).toBe("text_chunk_plan");
    expect(
      maulArtifactCreateRequestSchema.parse({
        artifactType: "text_placement_plan",
        parentArtifactIds: ["artifact_text_chunk"],
        payload: textPlacementPayload,
      }).artifactType,
    ).toBe("text_placement_plan");
    expect(
      maulArtifactCreateRequestSchema.parse({
        artifactType: "text_animation_plan",
        parentArtifactIds: ["artifact_text_placement"],
        payload: textAnimationPayload,
      }).artifactType,
    ).toBe("text_animation_plan");
  });

  it("keeps Typography Motion V1 readable and adds standalone V2 references", () => {
    expect(
      maulTypographyMotionPlanV1PayloadSchema.parse(typographyV1)
        .textChunkPlan,
    ).toBeNull();
    expect(
      maulTypographyMotionPlanPayloadSchema.parse(typographyV1).schemaVersion,
    ).toBe("maul-typography-motion-plan/v1");

    const v2 = maulTypographyMotionPlanV2PayloadSchema.parse(typographyV2);
    expect(v2).toMatchObject({
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlanHash: sha("e"),
      textPlacementPlanArtifactId: "artifact_text_placement",
      textPlacementPlanHash: sha("7"),
    });
    expect(
      maulTypographyMotionPlanPayloadSchema.parse(typographyV2).schemaVersion,
    ).toBe("maul-typography-motion-plan/v2");
  });

  it("adds only the governed animation reference to Typography Motion V3", () => {
    expect(
      maulTypographyMotionPlanPayloadSchema.parse(typographyV1).schemaVersion,
    ).toBe("maul-typography-motion-plan/v1");
    expect(
      maulTypographyMotionPlanPayloadSchema.parse(typographyV2).schemaVersion,
    ).toBe("maul-typography-motion-plan/v2");
    expect(
      maulTypographyMotionPlanPayloadSchema.parse(typographyV3),
    ).toMatchObject({
      schemaVersion: "maul-typography-motion-plan/v3",
      textAnimationPlanArtifactId: "artifact_text_animation",
      textAnimationPlanHash: sha("9"),
    });
  });

  it("keeps the V1 14-plan bundle and governs exactly 16 V2 plan IDs", () => {
    const v1 = maulPlanningBundleV1PayloadSchema.parse(planningBundleV1);
    expect(Object.keys(v1.planArtifactIds)).toHaveLength(14);
    expect(
      maulPlanningBundlePayloadSchema.parse(planningBundleV1).schemaVersion,
    ).toBe("maul-planning-bundle/v1");

    const v2 = maulPlanningBundleV2PayloadSchema.parse(planningBundleV2);
    expect(Object.keys(v2.planArtifactIds)).toHaveLength(16);
    expect(v2.planArtifactIds).toMatchObject({
      textChunk: "artifact_text_chunk",
      textPlacement: "artifact_text_placement",
    });
    expect(
      maulPlanningBundlePayloadSchema.parse(planningBundleV2).schemaVersion,
    ).toBe("maul-planning-bundle/v2");
  });

  it("keeps V1/V2 bundle readers exact and adds only text animation in V3", () => {
    expect(
      maulPlanningBundleV1PayloadSchema.parse(planningBundleV1)
        .planArtifactIds,
    ).toEqual(planningArtifactIdsV1);
    expect(
      maulPlanningBundleV2PayloadSchema.parse(planningBundleV2)
        .planArtifactIds,
    ).toEqual(planningArtifactIdsV2);

    const v3 = maulPlanningBundleV3PayloadSchema.parse(planningBundleV3);
    expect(Object.keys(v3.planArtifactIds)).toHaveLength(17);
    expect(v3.planArtifactIds.textAnimation).toBe("artifact_text_animation");
    expect(
      maulPlanningBundlePayloadSchema.parse(planningBundleV3).schemaVersion,
    ).toBe("maul-planning-bundle/v3");
  });

  it("requires every V3 planning slot to reference a distinct artifact", () => {
    const aliased = structuredClone(planningBundleV3) as any;
    aliased.planArtifactIds.textAnimation =
      aliased.planArtifactIds.textPlacement;

    expect(() => maulPlanningBundleV3PayloadSchema.parse(aliased)).toThrow(
      /V3.*artifact IDs.*unique|unique.*V3.*artifact IDs/i,
    );
  });

  it("keeps the V1 14-execution manifest and governs 16 unique V2 executions", () => {
    expect(
      maulUnifiedShortRenderManifestV1Schema.parse(manifestV1).planExecution,
    ).toHaveLength(14);
    expect(
      maulUnifiedShortRenderManifestSchema.parse(manifestV1).schemaVersion,
    ).toBe("maul-unified-short-render-manifest/v1");

    const v2 = maulUnifiedShortRenderManifestV2Schema.parse(manifestV2);
    expect(v2.planExecution).toHaveLength(16);
    expect(new Set(v2.planExecution.map((entry) => entry.planType)).size).toBe(
      16,
    );
    expect(
      maulUnifiedShortRenderManifestSchema.parse(manifestV2).schemaVersion,
    ).toBe("maul-unified-short-render-manifest/v2");

    const duplicateExecution = structuredClone(manifestV2);
    duplicateExecution.planExecution[15] = {
      ...duplicateExecution.planExecution[14]!,
    };
    expect(() =>
      maulUnifiedShortRenderManifestV2Schema.parse(duplicateExecution),
    ).toThrow(/each governed plan exactly once|unique/i);

    const tokenMismatch = structuredClone(manifestV2);
    tokenMismatch.plans.textPlacement.segments[0].tokenIds = [
      "token_missing",
    ];
    tokenMismatch.plans.textPlacement.segments[0].lines[0].tokenIds = [
      "token_missing",
    ];
    expect(() =>
      maulUnifiedShortRenderManifestV2Schema.parse(tokenMismatch),
    ).toThrow(/placement.*chunk.*token|token.*placement.*chunk/i);
  });

  it("keeps V1/V2 manifest readers exact and validates V3 animation references", () => {
    expect(
      maulUnifiedShortRenderManifestV1Schema.parse(manifestV1).planExecution,
    ).toHaveLength(14);
    expect(
      maulUnifiedShortRenderManifestV2Schema.parse(manifestV2).planExecution,
    ).toHaveLength(16);

    const v3 = maulUnifiedShortRenderManifestV3Schema.parse(manifestV3);
    expect(v3.planExecution).toHaveLength(17);
    expect(v3.plans.textAnimation.programs[0]?.treatment).toBe("fade_rise");
    expect(
      maulUnifiedShortRenderManifestSchema.parse(manifestV3).schemaVersion,
    ).toBe("maul-unified-short-render-manifest/v3");

    const staleToken = structuredClone(manifestV3);
    staleToken.plans.textAnimation.programs[0].target.tokenIds = [
      "token_missing",
    ];
    expect(() =>
      maulUnifiedShortRenderManifestV3Schema.parse(staleToken),
    ).toThrow(/animation.*placement.*token|token.*animation.*placement/i);

    const partialSegment = structuredClone(manifestV3) as any;
    const firstToken = partialSegment.plans.textChunk.tokens[0];
    firstToken.sourceEndMs = 400;
    firstToken.outputEndMs = 400;
    firstToken.outputSpans[0].outputEndMs = 400;
    partialSegment.plans.textChunk.tokens.push({
      ...firstToken,
      tokenId: "token_b",
      transcriptWordIndex: 1,
      text: "Now",
      sourceStartMs: 400,
      sourceEndMs: 800,
      outputSpans: [{outputStartMs: 400, outputEndMs: 800}],
      outputStartMs: 400,
      outputEndMs: 800,
    });
    partialSegment.plans.textChunk.chunks[0].tokenIds = [
      "token_a",
      "token_b",
    ];
    partialSegment.plans.textChunk.chunks[0].text = "Proof Now";
    partialSegment.plans.textPlacement.segments[0].tokenIds = [
      "token_a",
      "token_b",
    ];
    partialSegment.plans.textPlacement.segments[0].lines = [
      {
        lineId: "line_a",
        tokenIds: ["token_a", "token_b"],
        text: "Proof Now",
      },
    ];
    expect(() =>
      maulUnifiedShortRenderManifestV3Schema.parse(partialSegment),
    ).toThrow(/segment.*token.*exact|exact.*segment.*token/i);

    const reversedTokenSubset = structuredClone(partialSegment);
    reversedTokenSubset.plans.textAnimation.programs[0].treatment =
      "keyword_pop";
    reversedTokenSubset.plans.textAnimation.programs[0].target.scope = "tokens";
    reversedTokenSubset.plans.textAnimation.programs[0].target.tokenIds = [
      "token_b",
      "token_a",
    ];
    expect(() =>
      maulUnifiedShortRenderManifestV3Schema.parse(reversedTokenSubset),
    ).toThrow(/ordered.*token.*subset|token.*subset.*ordered/i);

    const staleHash = structuredClone(manifestV3);
    staleHash.plans.textAnimation.textPlacementPlanHash = sha("0");
    expect(() =>
      maulUnifiedShortRenderManifestV3Schema.parse(staleHash),
    ).toThrow(/animation.*hash|hash.*animation/i);
  });

  it("requires placement-specific proof records in Quality Truth V2", () => {
    const proofV2 = {
      schemaVersion: "maul-quality-truth-proof/v2",
      manifestReplayKey: sha("0"),
      captionLayout: {
        status: "verified",
        evidenceId: "evidence_caption_layout",
        boxes: [
          {
            captionIndex: 0,
            leftPx: 162,
            topPx: 1190,
            rightPx: 918,
            bottomPx: 1420,
          },
        ],
      },
      fontRuntime: {
        status: "eligible_loaded",
        family: "DM Sans",
        assetId: "font_google_dm_sans_700",
        evidenceId: "evidence_font_loaded",
      },
      cropAndMask: {
        status: "verified",
        evidenceId: "evidence_crop_mask",
        maskingRequired: false,
        maskingStatus: "not_required",
        crops: [
          {
            outputStartMs: 0,
            outputEndMs: 1000,
            x: 0.2,
            y: 0,
            width: 0.6,
            height: 1,
          },
        ],
      },
      cameraContinuity: {
        status: "verified_continuous",
        evidenceId: "evidence_camera_continuity",
        resetOutputMs: [],
      },
      capabilities: [],
      fallbacks: [],
      placementSegments: [
        {
          status: "verified",
          evidenceId: "evidence_placement_segment_a",
          textPlacementPlanArtifactId: "artifact_text_placement",
          placementSegmentId: "placement_segment_a",
          compositionIntervalId: "composition_interval_a",
          compositionVariantId: "primary.centered_v1",
          compositionTransformHash: sha("3"),
          compatibilityProfileId: "maul-compat-dm-sans-v1",
          metricsFingerprint: sha("2"),
          exactFontAssetId: "font_google_dm_sans_700",
          compiledLegibilityPrimitive: {kind: "none"},
          measuredBox: {
            leftPx: 160,
            topPx: 1180,
            rightPx: 920,
            bottomPx: 1460,
          },
        },
      ],
    } as const;

    expect(
      maulQualityTruthProofV2Schema.parse(proofV2).placementSegments[0],
    ).toMatchObject({
      placementSegmentId: "placement_segment_a",
      compatibilityProfileId: "maul-compat-dm-sans-v1",
      exactFontAssetId: "font_google_dm_sans_700",
      measuredBox: {leftPx: 160, topPx: 1180, rightPx: 920, bottomPx: 1460},
    });
    expect(maulQualityTruthProofSchema.parse(proofV2).schemaVersion).toBe(
      "maul-quality-truth-proof/v2",
    );

    const missingEvidence = structuredClone(proofV2);
    missingEvidence.placementSegments[0].evidenceId = null;
    expect(() => maulQualityTruthProofV2Schema.parse(missingEvidence)).toThrow(
      /placement.*evidence|evidence.*placement/i,
    );

    const missingMeasuredBox = structuredClone(proofV2) as any;
    delete missingMeasuredBox.placementSegments[0].measuredBox;
    expect(() =>
      maulQualityTruthProofV2Schema.parse(missingMeasuredBox),
    ).toThrow(/measured|required/i);

    const alternateGovernedRuntimeFont = structuredClone(proofV2);
    alternateGovernedRuntimeFont.fontRuntime.family = "Playfair Display";
    alternateGovernedRuntimeFont.fontRuntime.assetId =
      "font_google_playfair_display_700";
    alternateGovernedRuntimeFont.placementSegments[0].compatibilityProfileId =
      "maul-compat-playfair-editorial-v1";
    alternateGovernedRuntimeFont.placementSegments[0].exactFontAssetId =
      "font_google_playfair_display_700";
    expect(
      maulQualityTruthProofV2Schema.parse(alternateGovernedRuntimeFont)
        .fontRuntime,
    ).toMatchObject({
      family: "Playfair Display",
      assetId: "font_google_playfair_display_700",
    });
  });
});
