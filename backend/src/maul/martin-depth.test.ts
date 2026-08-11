import {describe, expect, it} from "vitest";

import {buildMartinDepthRequest} from "./martin-depth.js";

describe("Martin selective depth planning", () => {
  it("selects only bold tokens with meaningful subject overlap", () => {
    const plan = buildMartinDepthRequest({
      jobId: "martin-job",
      source: {inputUrl: "https://example.com/talking-head.mp4", sha256: "a".repeat(64), durationMs: 20_000},
      candidates: [
        {
          segmentId: "segment-1",
          tokenId: "ive",
          outputStartMs: 2_000,
          outputEndMs: 3_000,
          sourceStartMs: 2_000,
          sourceEndMs: 3_000,
          fontWeight: 800,
          tokenBox: {x: 0.3, y: 0.2, width: 0.4, height: 0.2},
          subjectBox: {x: 0.45, y: 0.1, width: 0.3, height: 0.7},
        },
        {
          segmentId: "segment-1",
          tokenId: "done",
          outputStartMs: 2_000,
          outputEndMs: 3_000,
          sourceStartMs: 2_000,
          sourceEndMs: 3_000,
          fontWeight: 500,
          tokenBox: {x: 0.3, y: 0.2, width: 0.4, height: 0.2},
          subjectBox: {x: 0.45, y: 0.1, width: 0.3, height: 0.7},
        },
        {
          segmentId: "segment-2",
          tokenId: "all",
          outputStartMs: 6_000,
          outputEndMs: 7_000,
          sourceStartMs: 6_000,
          sourceEndMs: 7_000,
          fontWeight: 900,
          tokenBox: {x: 0.05, y: 0.1, width: 0.2, height: 0.1},
          subjectBox: {x: 0.5, y: 0.1, width: 0.3, height: 0.7},
        },
      ],
    });

    expect(plan.selections.map((selection) => selection.tokenId)).toEqual(["ive"]);
    expect(plan.selections[0]?.overlapRatio).toBeCloseTo(0.625, 3);
  });

  it("buffers then merges nearby windows into one Modal request", () => {
    const plan = buildMartinDepthRequest({
      jobId: "martin-job",
      source: {inputUrl: "https://example.com/talking-head.mp4", sha256: "a".repeat(64), durationMs: 20_000},
      bufferMs: 1_000,
      mergeGapMs: 250,
      candidates: [
        {
          segmentId: "segment-1", tokenId: "one", outputStartMs: 2_000, outputEndMs: 3_000,
          sourceStartMs: 2_000, sourceEndMs: 3_000, fontWeight: 700,
          tokenBox: {x: 0.3, y: 0.2, width: 0.4, height: 0.2}, subjectBox: {x: 0.4, y: 0.1, width: 0.3, height: 0.7},
        },
        {
          segmentId: "segment-2", tokenId: "two", outputStartMs: 4_100, outputEndMs: 5_000,
          sourceStartMs: 4_100, sourceEndMs: 5_000, fontWeight: 700,
          tokenBox: {x: 0.3, y: 0.2, width: 0.4, height: 0.2}, subjectBox: {x: 0.4, y: 0.1, width: 0.3, height: 0.7},
        },
      ],
    });

    expect(plan.windows).toEqual([{windowId: "martin-window-1", sourceStartMs: 1_000, sourceEndMs: 6_000, outputStartMs: 1_000, outputEndMs: 6_000}]);
    expect(plan.requestKind).toBe("martin_matte_batch");
  });

  it("accepts profile-proven visual boldness when nominal font weight is 400", () => {
    const plan = buildMartinDepthRequest({
      jobId: "profile-bold", source: {inputUrl: "https://example.com/source.mp4", sha256: "a".repeat(64), durationMs: 5000},
      candidates: [{segmentId: "s", tokenId: "all", outputStartMs: 1000, outputEndMs: 1500,
        sourceStartMs: 1000, sourceEndMs: 1500, fontWeight: 400, visualWeightClass: "bold",
        tokenBox: {x: 0.3, y: 0.2, width: 0.4, height: 0.2}, subjectBox: {x: 0.4, y: 0.1, width: 0.3, height: 0.7}}],
    });
    expect(plan.selections[0]).toMatchObject({tokenId: "all", fontWeight: 400, boldEvidence: "profile_visual_weight"});
  });
});
