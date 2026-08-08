import {describe, expect, it} from "vitest";

import {
  MAUL_TEXT_ANIMATION_TREATMENTS,
  maulReferenceCorpusItemPayloadSchema,
  maulReferenceTraitsSchema,
  type MaulShortsTextChunkPlanV2Core,
  type MaulTextAnimationProgram,
  type MaulTextAnimationTreatment,
} from "@prometheus/shared-types";

import {
  buildMaulConservativePlacementInputs,
  buildMaulTextAnimationPlanPayload,
} from "./planning.js";
import {
  buildMaulTextPlacementPlan,
  type MaulPlacementObservationInterval,
} from "./shorts-text-placement.js";

const sha = (character: string) => character.repeat(64);

const makePlanningInputs = ({
  approvedReference,
}: {
  approvedReference?: ReturnType<
    typeof maulReferenceCorpusItemPayloadSchema.parse
  >;
} = {}) =>
  ({
    project: {id: "maul_project_launch_contract"},
    source: {
      artifactId: "artifact_source",
      payload: {sha256: sha("1")},
    },
    analysis: {artifactId: "artifact_analysis"},
    timeline: {artifactId: "artifact_timeline"},
    candidate: {artifactId: "artifact_candidate"},
    treatment: {
      artifactId: "artifact_treatment",
      payload: {
        treatmentId: "cinematic_launch",
        replayKey: sha("2"),
        referenceCorpusArtifactIds: approvedReference
          ? ["artifact_reference"]
          : [],
      },
    },
    referenceCorpus: approvedReference
      ? [
          {
            artifactId: "artifact_reference",
            artifactType: "reference_corpus_item",
            payload: approvedReference,
          },
        ]
      : [],
    textChunkPlan: null,
  }) as never;

const makeAnimationArtifacts = (wordCount: number) => {
  const tokenIds = Array.from(
    {length: wordCount},
    (_value, index) => `token_${index + 1}`,
  );
  return {
    textChunkPlan: {
      artifactId: "artifact_text_chunk",
      payload: {
        tokens: tokenIds.map((tokenId) => ({tokenId})),
        chunks: [
          {
            chunkId: "chunk_phrase",
            tokenIds,
            wordCount,
            emphasis: {tokenIds},
          },
        ],
      },
    },
    textPlacementPlan: {
      artifactId: "artifact_text_placement",
      payload: {
        segments: [
          {
            segmentId: "placement_phrase",
            chunkId: "chunk_phrase",
            tokenIds,
            outputStartMs: 100,
            outputEndMs: 1100,
          },
        ],
      },
    },
  } as never;
};

const planAnimation = ({
  wordCount,
  treatment,
  approvedReference,
}: {
  wordCount: number;
  treatment?: MaulTextAnimationTreatment;
  approvedReference?: ReturnType<
    typeof maulReferenceCorpusItemPayloadSchema.parse
  >;
}) => {
  const {textChunkPlan, textPlacementPlan} =
    makeAnimationArtifacts(wordCount);
  return buildMaulTextAnimationPlanPayload({
    inputs: makePlanningInputs({approvedReference}),
    textChunkPlan,
    textPlacementPlan,
    ...(treatment ? {treatment} : {}),
    selectionSeed: "same-seed-must-not-erase-editorial-compatibility",
    outputDurationMs: 1200,
  });
};

const executableFingerprint = (program: MaulTextAnimationProgram): string => {
  const {
    animationId: _animationId,
    treatment: _treatment,
    rationale: _rationale,
    target,
    ...executable
  } = program;
  return JSON.stringify({targetScope: target.scope, ...executable});
};

const makeReferenceTraits = ({
  typography,
  motion,
}: {
  typography: string[];
  motion: string[];
}) =>
  maulReferenceTraitsSchema.parse({
    pacing: ["measured phrase cadence"],
    framing: ["subject-aware negative-space composition"],
    captions: ["phrase-level cinematic lockup"],
    typography,
    color: ["high-contrast editorial neutral"],
    motion,
    bRoll: [],
    music: [],
    sfx: [],
  });

const makeApprovedReference = (
  traits: ReturnType<typeof makeReferenceTraits>,
) =>
  maulReferenceCorpusItemPayloadSchema.parse({
    supersedesArtifactId: null,
    source: {kind: "url", url: "https://example.com/owned-reference"},
    rightsStatus: "owned",
    reviewStatus: "approved",
    attribution: "Owned launch-contract fixture",
    media: {
      mediaType: "image",
      durationMs: null,
      platform: "instagram_reels",
      language: "en",
      sourceQuality: "high",
    },
    annotations: {
      hook: [],
      escalation: [],
      proof: [],
      reveal: [],
      payoff: [],
      cta: [],
      pauseBehavior: [],
    },
    observedTraits: traits,
    traitDraft: {
      traits,
      confidence: 1,
      extractorVersion: "maul-reference-traits/v1",
    },
    approvedTraits: traits,
    forbiddenElements: [],
    nonTransferableIdentityMarkers: [],
    reviewerId: "reviewer_launch_contract",
    reviewNotes: "Approved abstract traits only.",
    reviewedAt: "2026-08-03T00:00:00.000Z",
  });

const makeOneWordChunkPlan = (): MaulShortsTextChunkPlanV2Core => ({
  schemaVersion: "maul-shorts-text-chunk-plan/v2",
  transcriptHash: sha("a"),
  timelineHash: sha("b"),
  chunkProposalHash: sha("c"),
  outputDurationMs: 1000,
  pacing: "measured",
  style: "editorial",
  strategy: "deterministic_fallback",
  tokens: [
    {
      tokenId: "token_subject_aware",
      transcriptWordIndex: 0,
      text: "Cinematic",
      sourceStartMs: 0,
      sourceEndMs: 1000,
      outputSpans: [{outputStartMs: 0, outputEndMs: 1000}],
      outputStartMs: 0,
      outputEndMs: 1000,
    },
  ],
  chunks: [
    {
      chunkId: "chunk_subject_aware",
      tokenIds: ["token_subject_aware"],
      text: "Cinematic",
      outputStartMs: 0,
      outputEndMs: 1000,
      semanticRole: "claim",
      emphasis: {
        tokenIds: ["token_subject_aware"],
        text: "Cinematic",
        level: "key",
      },
      holdAcrossProtectedPause: false,
      rationale: "Place one source-grounded claim around the observed subject.",
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
    fallbackReason: "Fixture isolates placement observation handoff.",
  },
  inputHashes: {
    transcript: sha("a"),
    editorialTimeline: sha("b"),
    chunkProposal: sha("c"),
  },
});

describe("MAUL cinematic planning launch contract (RED)", () => {
  it("selects treatments compatible with the phrase's exact word count instead of the seed alone", () => {
    const twoWordCore = planAnimation({wordCount: 2}).programs.find(
      (program) => program.target.scope === "tokens",
    );
    const threeWordCore = planAnimation({wordCount: 3}).programs.find(
      (program) => program.target.scope === "tokens",
    );

    expect(twoWordCore?.treatment).toBe("position_locked_word_reveal");
    expect(threeWordCore?.treatment).toBe("position_locked_word_reveal");
    expect(twoWordCore?.localReveal?.sourceTreatment).toMatch(/^two_word_/);
    expect(threeWordCore?.localReveal?.sourceTreatment).toMatch(/^three_word_/);
    expect(threeWordCore?.localReveal?.sourceTreatment).not.toBe(
      twoWordCore?.localReveal?.sourceTreatment,
    );
  });

  it("requires every named treatment to have a distinct executable capability fingerprint", () => {
    const treatmentsByFingerprint = new Map<string, string[]>();
    for (const treatment of MAUL_TEXT_ANIMATION_TREATMENTS) {
      const program = planAnimation({wordCount: 3, treatment}).programs[0]!;
      const fingerprint = executableFingerprint(program);
      treatmentsByFingerprint.set(fingerprint, [
        ...(treatmentsByFingerprint.get(fingerprint) ?? []),
        treatment,
      ]);
    }
    const aliases = [...treatmentsByFingerprint.values()].filter(
      (treatments) => treatments.length > 1,
    );

    expect(aliases).toEqual([]);
  });

  it("lets approved Reference Trait Extraction change the planned cinematic treatment", () => {
    const scriptReference = makeApprovedReference(
      makeReferenceTraits({
        typography: ["editorial serif paired with a calligraphic script tag"],
        motion: ["three-word script glide with a restrained stroke reveal"],
      }),
    );
    const tallBladeReference = makeApprovedReference(
      makeReferenceTraits({
        typography: ["ultra-condensed tall display face with scale hierarchy"],
        motion: ["three-word tall-blade stagger with a decisive final lock"],
      }),
    );

    const scriptTreatments = planAnimation({
      wordCount: 3,
      approvedReference: scriptReference,
    }).programs.map((program) => program.localReveal?.sourceTreatment);
    const tallBladeTreatments = planAnimation({
      wordCount: 3,
      approvedReference: tallBladeReference,
    }).programs.map((program) => program.localReveal?.sourceTreatment);

    expect(scriptTreatments).toContain("three_word_script_glide");
    expect(tallBladeTreatments).toContain("three_word_tall_blade");
    expect(scriptTreatments).not.toEqual(tallBladeTreatments);
  });

  it("carries governed subject observations through the ordinary placement seam instead of forcing unknown fallback", () => {
    const subjectObservation: MaulPlacementObservationInterval = {
      evidenceId: "evidence_principal_speaker",
      sceneId: "maul_scene_1",
      outputStartMs: 0,
      outputEndMs: 1000,
      trackingState: "tracked",
      subjectBox: {x: 0.08, y: 0.08, width: 0.32, height: 0.72},
      cutEvidenceStatus: "known",
      existingTextRegions: [],
    };
    const timeline = {
      outputDurationMs: 1000,
      timestampMap: [
        {
          sourceStartMs: 0,
          sourceEndMs: 1000,
          outputStartMs: 0,
          outputEndMs: 1000,
          mode: "keep",
        },
      ],
      speakerCropTracks: [
        {
          speakerId: "principal_speaker",
          outputStartMs: 0,
          outputEndMs: 1000,
          crop: {x: 0.08, y: 0, width: 0.56, height: 1},
        },
      ],
    } as never;
    const placementInputBuilder = buildMaulConservativePlacementInputs as (
      timelinePayload: typeof timeline,
      observations: readonly MaulPlacementObservationInterval[],
    ) => ReturnType<typeof buildMaulConservativePlacementInputs>;

    const placementInputs = placementInputBuilder(timeline, [
      subjectObservation,
    ]);
    const placement = buildMaulTextPlacementPlan({
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: makeOneWordChunkPlan(),
      ...placementInputs,
    });

    expect(placementInputs.observationIntervals).toContainEqual(
      subjectObservation,
    );
    expect(placement.status).toBe("planned");
    expect(placement.segments[0]?.fallbackCode).toBeNull();
    expect(placement.segments[0]?.selectedCompositionVariantId).not.toBe(
      "caption_safe_fallback",
    );
  });
});
