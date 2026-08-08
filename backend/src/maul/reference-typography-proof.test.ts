import {describe, expect, it} from "vitest";

import {
  buildReferenceTypographyTranscript,
  REFERENCE_TYPOGRAPHY_PARAGRAPH,
} from "./composition-experiment-fixtures.js";
import {
  assertReferenceTypographyProofPlan,
  assertReferenceTypographyProofSamplePlacements,
  buildReferenceTypographyProofChunkPlan,
  validateReferenceTypographyProofRequest,
} from "./reference-typography-proof.js";

describe("reference typography proof contract", () => {
  it("binds the supplied paragraph to the female fixture and canonical retained-frame times", () => {
    expect(validateReferenceTypographyProofRequest({
      fixture: "female",
      text: REFERENCE_TYPOGRAPHY_PARAGRAPH,
    })).toEqual({
      fixtureId: "scene_a_matted_lady_hierarchy_v1",
      text: REFERENCE_TYPOGRAPHY_PARAGRAPH,
      sampleTimesMs: [1000, 2000, 3000],
      sourceTreatmentProfileId: "subject_focus_grade_v1",
    });
  });

  it("rejects a text file that is not the supplied reference paragraph", () => {
    expect(() => validateReferenceTypographyProofRequest({
      fixture: "female",
      text: `${REFERENCE_TYPOGRAPHY_PARAGRAPH} `,
    })).toThrow(/exact supplied paragraph/i);
  });

  it("partitions the whole paragraph into measured 3-4 word lockup candidates", () => {
    const transcript = buildReferenceTypographyTranscript();
    const plan = buildReferenceTypographyProofChunkPlan({
      transcript: transcript.transcript,
      durationMs: transcript.durationMs,
    });

    expect(plan.coverage).toMatchObject({
      exact: true,
      coveredWordCount: transcript.transcript.words.length,
    });
    expect(plan.chunks.every((chunk) => chunk.wordCount >= 3 && chunk.wordCount <= 4)).toBe(true);
    expect(plan.chunks.map((chunk) => chunk.text)).toContain("speed is everything.");
  });

  it("accepts a full paragraph plan only when every lockup uses the ranked measured pair", () => {
    expect(() => assertReferenceTypographyProofPlan({
      chunks: [{chunkId: "proof_chunk_0"}, {chunkId: "proof_chunk_1"}],
      placementSegments: [
        {
          chunkId: "proof_chunk_0",
          segmentId: "segment_0",
          box: {x: 0.1, y: 0.2, width: 0.3, height: 0.1},
          maximumEnvelope: {x: 0.08, y: 0.18, width: 0.34, height: 0.14},
          fallbackCode: null,
          editorialLockup: {
            placement: {mode: "position_locked", finalTransformIdentity: true},
            tokenStyles: [{fontAssetId: "primary"}, {fontAssetId: "accent"}],
          },
        },
        {
          chunkId: "proof_chunk_1",
          segmentId: "segment_1",
          box: {x: 0.5, y: 0.2, width: 0.3, height: 0.1},
          maximumEnvelope: {x: 0.48, y: 0.18, width: 0.34, height: 0.14},
          fallbackCode: null,
          editorialLockup: {
            placement: {mode: "position_locked", finalTransformIdentity: true},
            tokenStyles: [{fontAssetId: "primary"}, {fontAssetId: "accent"}],
          },
        },
      ],
      animationPrograms: [
        {
          target: {placementSegmentId: "segment_0", scope: "tokens"},
          treatment: "position_locked_word_reveal",
          phases: {hold: {from: {translateXPx: 0, translateYPx: 0}, to: {translateXPx: 0, translateYPx: 0}}},
        },
        {
          target: {placementSegmentId: "segment_1", scope: "tokens"},
          treatment: "position_locked_letter_reveal",
          phases: {hold: {from: {translateXPx: 0, translateYPx: 0}, to: {translateXPx: 0, translateYPx: 0}}},
        },
      ],
      rankedFontAssetIds: ["primary", "accent"],
    })).not.toThrow();
  });

  it("rejects a paragraph plan with an unranked font in any non-sampled lockup", () => {
    expect(() => assertReferenceTypographyProofPlan({
      chunks: [{chunkId: "proof_chunk_0"}, {chunkId: "proof_chunk_1"}],
      placementSegments: [
        {
          chunkId: "proof_chunk_0",
          segmentId: "segment_0",
          box: {x: 0.1, y: 0.2, width: 0.3, height: 0.1},
          maximumEnvelope: {x: 0.08, y: 0.18, width: 0.34, height: 0.14},
          fallbackCode: null,
          editorialLockup: {
            placement: {mode: "position_locked", finalTransformIdentity: true},
            tokenStyles: [{fontAssetId: "primary"}, {fontAssetId: "accent"}],
          },
        },
        {
          chunkId: "proof_chunk_1",
          segmentId: "segment_1",
          box: {x: 0.5, y: 0.2, width: 0.3, height: 0.1},
          maximumEnvelope: {x: 0.48, y: 0.18, width: 0.34, height: 0.14},
          fallbackCode: null,
          editorialLockup: {
            placement: {mode: "position_locked", finalTransformIdentity: true},
            tokenStyles: [{fontAssetId: "primary"}, {fontAssetId: "unranked"}],
          },
        },
      ],
      animationPrograms: [
        {
          target: {placementSegmentId: "segment_0", scope: "tokens"},
          treatment: "position_locked_word_reveal",
          phases: {hold: {from: {translateXPx: 0, translateYPx: 0}, to: {translateXPx: 0, translateYPx: 0}}},
        },
        {
          target: {placementSegmentId: "segment_1", scope: "tokens"},
          treatment: "position_locked_letter_reveal",
          phases: {hold: {from: {translateXPx: 0, translateYPx: 0}, to: {translateXPx: 0, translateYPx: 0}}},
        },
      ],
      rankedFontAssetIds: ["primary", "accent"],
    })).toThrow(/unranked font/i);
  });

  it("checks every retained frame against the planned container active at its timestamp", () => {
    expect(() => assertReferenceTypographyProofSamplePlacements({
      output: {width: 1000, height: 2000},
      placementSegments: [
        {segmentId: "segment_1", outputStartMs: 0, outputEndMs: 1500, box: {x: 0.1, y: 0.1, width: 0.2, height: 0.2}, maximumEnvelope: {x: 0.1, y: 0.1, width: 0.2, height: 0.2}},
        {segmentId: "segment_2", outputStartMs: 1500, outputEndMs: 2500, box: {x: 0.4, y: 0.2, width: 0.2, height: 0.2}, maximumEnvelope: {x: 0.4, y: 0.2, width: 0.2, height: 0.2}},
        {segmentId: "segment_3", outputStartMs: 2500, outputEndMs: 3500, box: {x: 0.6, y: 0.3, width: 0.2, height: 0.2}, maximumEnvelope: {x: 0.6, y: 0.3, width: 0.2, height: 0.2}},
      ],
      observedSamples: [
        {outputMs: 1000, bounds: {leftPx: 120, topPx: 240, rightPx: 280, bottomPx: 380}},
        {outputMs: 2000, bounds: {leftPx: 420, topPx: 440, rightPx: 580, bottomPx: 700}},
        {outputMs: 3000, bounds: {leftPx: 620, topPx: 640, rightPx: 780, bottomPx: 900}},
      ],
    })).not.toThrow();
  });

  it("accepts an editorial accent that clears its anchor but remains inside its measured envelope", () => {
    expect(() => assertReferenceTypographyProofSamplePlacements({
      output: {width: 1000, height: 2000},
      placementSegments: [
        {
          segmentId: "segment_accent",
          outputStartMs: 0,
          outputEndMs: 1200,
          box: {x: 0.1, y: 0.2, width: 0.2, height: 0.2},
          maximumEnvelope: {x: 0.08, y: 0.18, width: 0.36, height: 0.24},
        },
      ],
      observedSamples: [
        {outputMs: 1000, bounds: {leftPx: 104, topPx: 390, rightPx: 424, bottomPx: 560}},
      ],
    })).not.toThrow();
  });

  it("rejects a retained frame that escapes its active planned container", () => {
    expect(() => assertReferenceTypographyProofSamplePlacements({
      output: {width: 1000, height: 2000},
      placementSegments: [
        {
          segmentId: "segment_1",
          outputStartMs: 0,
          outputEndMs: 1500,
          box: {x: 0.1, y: 0.1, width: 0.2, height: 0.2},
          maximumEnvelope: {x: 0.1, y: 0.1, width: 0.2, height: 0.2},
        },
      ],
      observedSamples: [
        {outputMs: 1000, bounds: {leftPx: 80, topPx: 240, rightPx: 280, bottomPx: 380}},
      ],
    })).toThrow(
      "escapes planned container segment_1 (declared=100,200,300,600; observed=80,240,280,380).",
    );
  });
});
