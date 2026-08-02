import {describe, expect, it} from "vitest";

import {
  adaptMaulLegacyPlanningBundleV1,
  mapMaulSourceMsToOutput,
  mapMaulTranscriptWordsToOutput,
} from "./planning.js";

const sha = (character: string) => character.repeat(64);

describe("MAUL planning timestamp mapping", () => {
  it("applies the timestamp-map scale for non-1x kept segments", () => {
    expect(
      mapMaulSourceMsToOutput(
        [
          {
            sourceStartMs: 0,
            sourceEndMs: 1000,
            outputStartMs: 0,
            outputEndMs: 500,
            mode: "keep",
          },
        ],
        750,
      ),
    ).toBe(375);
  });

  it("does not map source time inside a cut", () => {
    expect(
      mapMaulSourceMsToOutput(
        [
          {
            sourceStartMs: 1000,
            sourceEndMs: 1500,
            outputStartMs: 500,
            outputEndMs: 500,
            mode: "cut",
          },
        ],
        1200,
      ),
    ).toBeNull();
  });

  it("rejects malformed legacy transcript words instead of silently dropping them", () => {
    expect(() =>
      mapMaulTranscriptWordsToOutput({
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 1000,
            outputStartMs: 0,
            outputEndMs: 1000,
            mode: "keep",
          },
        ],
        words: [
          {text: "Valid", startMs: 0, endMs: 300, confidence: 0.99},
          {text: "", startMs: 320, endMs: 500, confidence: 0.99},
        ],
      }),
    ).toThrow(/word 1.*empty|empty.*word 1/i);
  });

  it("preserves a word portion that remains before a source cut", () => {
    expect(
      mapMaulTranscriptWordsToOutput({
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 500,
            outputStartMs: 0,
            outputEndMs: 500,
            mode: "keep",
          },
          {
            sourceStartMs: 500,
            sourceEndMs: 700,
            outputStartMs: 500,
            outputEndMs: 500,
            mode: "cut",
          },
          {
            sourceStartMs: 700,
            sourceEndMs: 1000,
            outputStartMs: 500,
            outputEndMs: 800,
            mode: "keep",
          },
        ],
        words: [{
          transcriptWordIndex: 11,
          text: "straddles",
          startMs: 450,
          endMs: 550,
          confidence: 0.99,
        }],
      }),
    ).toEqual([
      expect.objectContaining({
        transcriptWordIndex: 11,
        sourceStartMs: 450,
        sourceEndMs: 550,
        startMs: 450,
        endMs: 500,
        outputSpans: [{outputStartMs: 450, outputEndMs: 500}],
      }),
    ]);
  });

  it("keeps one logical word with multiple output spans when a cut crosses it", () => {
    const mapped = mapMaulTranscriptWordsToOutput({
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 500,
            outputStartMs: 0,
            outputEndMs: 500,
            mode: "keep",
          },
          {
            sourceStartMs: 500,
            sourceEndMs: 700,
            outputStartMs: 500,
            outputEndMs: 500,
            mode: "cut",
          },
          {
            sourceStartMs: 700,
            sourceEndMs: 1000,
            outputStartMs: 500,
            outputEndMs: 800,
            mode: "keep",
          },
        ],
        words: [{
          transcriptWordIndex: 12,
          text: "straddles",
          startMs: 450,
          endMs: 750,
          confidence: 0.99,
        }],
      });

    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toEqual(
      expect.objectContaining({
        transcriptWordIndex: 12,
        sourceStartMs: 450,
        sourceEndMs: 750,
        startMs: 450,
        endMs: 550,
        outputSpans: [
          {outputStartMs: 450, outputEndMs: 500},
          {outputStartMs: 500, outputEndMs: 550},
        ],
      }),
    );
  });
});

describe("MAUL legacy planning adapter", () => {
  it("projects an unchanged V1 bundle through an explicit padded placement", () => {
    const planBase = {
      sourceAssetId: "artifact_source",
      analysisArtifactId: "artifact_analysis",
      timelineArtifactId: "artifact_timeline",
      candidateArtifactId: "artifact_candidate",
      treatmentGenomeArtifactId: "artifact_treatment",
      planVersion: "fixture/v1",
      replayKey: sha("1"),
      authority: {
        authorityClass: "deterministic",
        stageId: "fixture_stage",
        confidence: 1,
        inferenceReceiptId: null,
      },
      warnings: [],
      fallbacks: [{condition: "Missing V2 plan.", action: "Adapt V1.", status: "available"}],
    } as const;
    const textChunkPlan = {
      schemaVersion: "maul-shorts-text-chunk-plan/v1",
      transcriptHash: sha("a"),
      videoDurationMs: 1000,
      pacing: "measured",
      style: "editorial",
      strategy: "deterministic_fallback",
      chunks: [{
        chunkId: "chunk_legacy",
        startWordIndex: 0,
        endWordIndex: 0,
        wordCount: 1,
        text: "Legacy",
        startMs: 0,
        endMs: 1000,
        semanticRole: "proof",
        emphasis: {wordIndices: [0], text: "Legacy", level: "key"},
        rationale: "Preserve the legacy token.",
        confidence: 1,
      }],
      coverage: {totalWordCount: 1, coveredWordCount: 1, omittedWordIndices: [], duplicatedWordIndices: [], exact: true},
      inference: {
        status: "skipped_missing_credentials",
        provider: "openai_compatible",
        baseUrl: "https://example.com/v1",
        model: "fixture-model",
        requestHash: null,
        responseHash: null,
        fallbackReason: "Fixture uses deterministic fallback.",
      },
      validationFindings: [],
    } as const;
    const planningBundle = {
      ...planBase,
      schemaVersion: "maul-planning-bundle/v1",
      planArtifactIds: {
        observationSnapshot: "observation",
        candidateNarrative: "narrative",
        beatMap: "beat",
        typographyMotion: "typography",
        camera: "camera",
        visual: "visual",
        audio: "audio",
        capabilitySelection: "capability",
        adapterDecision: "adapter",
        artDirection: "art",
        contextAssembly: "context",
        shotIntentMatrix: "shot",
        textOpportunity: "opportunity",
        revision: "revision",
      },
      rendererReadiness: "governed_with_explicit_fallbacks",
      blockingReasons: [],
    } as const;
    const typographyMotion = {
      ...planBase,
      schemaVersion: "maul-typography-motion-plan/v1",
      textChunkPlan,
      textChunkAuthority: {
        authorityClass: "governed_fallback",
        decisionScope: "semantic_boundaries_roles_and_emphasis_only",
        decisionFields: [
          "textChunkPlan.chunks[].startWordIndex",
          "textChunkPlan.chunks[].endWordIndex",
          "textChunkPlan.chunks[].semanticRole",
          "textChunkPlan.chunks[].emphasis.wordIndices",
          "textChunkPlan.chunks[].emphasis.level",
        ],
        inferenceReceiptPath: "textChunkPlan.inference",
      },
      captionGroups: [{text: "Legacy", outputStartMs: 0, outputEndMs: 1000, sourceGrounded: true, role: "dialogue_caption"}],
      editorialStatements: [],
      editorialTextWithheldReason: "Legacy adapter creates no editorial copy.",
      fontResolution: {requestedRole: "utility", selectedFamily: "Arial", selectedAssetId: null, status: "governed_fallback", reason: "Legacy font resolution."},
      motionPrograms: [],
    } as const;

    const adapted = adaptMaulLegacyPlanningBundleV1({
      planningBundle,
      typographyMotion,
      mappedWords: [{
        transcriptWordIndex: 9,
        text: "Legacy",
        confidence: 1,
        sourceStartMs: 0,
        sourceEndMs: 1000,
        outputSpans: [{outputStartMs: 0, outputEndMs: 1000}],
        startMs: 0,
        endMs: 1000,
      }],
      editorialTimeline: {outputDurationMs: 1000},
    });

    expect(adapted.adapterProvenance).toEqual({
      adapterId: "adapt-maul-legacy-planning-bundle-v1",
      sourceSchemaVersion: "maul-planning-bundle/v1",
      mode: "explicit_conservative_projection",
    });
    expect(adapted.textChunkPlan.tokens[0]).toEqual(
      expect.objectContaining({transcriptWordIndex: 9, text: "Legacy"}),
    );
    expect(adapted.textPlacementPlan).toEqual(
      expect.objectContaining({
        status: "planned",
        segments: [
          expect.objectContaining({
            selectedCompositionVariantId: "caption_safe_fallback",
            variantId: "caption_safe_fallback.padded_band_v1",
            fallbackCode: "caption_safe_fallback",
          }),
        ],
      }),
    );
  });
});
