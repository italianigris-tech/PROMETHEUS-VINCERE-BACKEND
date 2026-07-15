import {describe, expect, it} from "vitest";

import {
  evaluatePairwisePreferenceRewardModel,
  pairwiseReviewLedgerExportSchema,
  trainPairwisePreferenceRewardModel
} from "./pairwise-preference";

const makeReviewExport = () => ({
  version: "joseph-study-review-export-v1",
  generatedAt: "2026-07-03T12:00:00.000Z",
  schema: {
    reviewLedgerVersion: "joseph-study.review-ledger.v1",
    failureTaxonomyVersion: "joseph-failure-taxonomy-v1",
    frameProofVersion: "joseph-study-frame-proof-v1"
  },
  ledger: [],
  gallery: {
    source: {
      sourceId: "joseph-study",
      manifestUrls: ["/joseph-study/candidate-a.json", "/joseph-study/candidate-b.json"]
    },
    candidates: [
      {
        candidateId: "winner-readable",
        candidateLabel: "Winner Readable",
        verdict: "winner",
        reviewedAt: "2026-07-03T12:00:00.000Z",
        failureTags: [],
        frameProofIds: []
      },
      {
        candidateId: "loser-template",
        candidateLabel: "Loser Template",
        verdict: "loser",
        reviewedAt: "2026-07-03T12:00:00.000Z",
        failureTags: ["cheap-template-motion", "readability-sacrifice"],
        frameProofIds: ["proof-1"]
      }
    ],
    pairwisePreferences: [
      {
        winnerCandidateId: "winner-readable",
        loserCandidateId: "loser-template",
        failureTags: ["cheap-template-motion", "readability-sacrifice"],
        frameProofIds: ["proof-1"],
        capturedAt: "2026-07-03T12:00:00.000Z"
      },
      {
        winnerCandidateId: "winner-readable-2",
        loserCandidateId: "loser-template-2",
        failureTags: ["cheap-template-motion"],
        frameProofIds: ["proof-2"],
        capturedAt: "2026-07-03T12:01:00.000Z"
      }
    ]
  }
});

describe("pairwise preference reward model", () => {
  it("trains from schema-versioned Studio review exports and failure tags", () => {
    const exportArtifact = pairwiseReviewLedgerExportSchema.parse(makeReviewExport());

    const report = trainPairwisePreferenceRewardModel(exportArtifact);

    expect(report.reportVersion).toBe("pairwise-preference-training-report-v1");
    expect(report.source.schemaVersion).toBe("joseph-study-review-export-v1");
    expect(report.labels.preferenceLabelKind).toBe("pairwise_winner_loser");
    expect(report.labels.pairwisePreferenceCount).toBe(2);
    expect(report.labels.absoluteDemonstrationCount).toBe(0);
    expect(report.labels.absoluteDemonstrationsUsed).toBe(false);
    expect(report.model.failureTagWeights["cheap-template-motion"]).toBeLessThan(0);
    expect(report.model.failureTagWeights["readability-sacrifice"]).toBeLessThan(0);
  });

  it("compares model predictions against held-out Studio reviews", () => {
    const trainingReport = trainPairwisePreferenceRewardModel(pairwiseReviewLedgerExportSchema.parse(makeReviewExport()));
    const heldOut = pairwiseReviewLedgerExportSchema.parse({
      ...makeReviewExport(),
      gallery: {
        ...makeReviewExport().gallery,
        pairwisePreferences: [
          {
            winnerCandidateId: "heldout-winner",
            loserCandidateId: "heldout-loser",
            failureTags: ["cheap-template-motion"],
            frameProofIds: ["proof-heldout"],
            capturedAt: "2026-07-03T12:05:00.000Z"
          }
        ]
      }
    });

    const evaluation = evaluatePairwisePreferenceRewardModel(trainingReport.model, heldOut);

    expect(evaluation.evaluationVersion).toBe("pairwise-preference-evaluation-v1");
    expect(evaluation.heldOutPreferenceCount).toBe(1);
    expect(evaluation.accuracy).toBe(1);
    expect(evaluation.predictions).toEqual([
      {
        winnerCandidateId: "heldout-winner",
        loserCandidateId: "heldout-loser",
        predictedWinnerCandidateId: "heldout-winner",
        margin: expect.any(Number),
        matchedFailureTags: ["cheap-template-motion"]
      }
    ]);
  });

  it("rejects pairwise preferences without failure tags", () => {
    const artifact = makeReviewExport();
    artifact.gallery.pairwisePreferences[0] = {
      winnerCandidateId: "winner",
      loserCandidateId: "loser",
      frameProofIds: [],
      capturedAt: "2026-07-03T12:00:00.000Z"
    } as never;

    expect(pairwiseReviewLedgerExportSchema.safeParse(artifact).success).toBe(false);
  });
});
