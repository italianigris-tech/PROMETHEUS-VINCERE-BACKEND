import {z} from "zod";

const failureTagSchema = z.string().min(1);

export const pairwisePreferenceSchema = z.object({
  winnerCandidateId: z.string().min(1),
  loserCandidateId: z.string().min(1),
  failureTags: z.array(failureTagSchema).min(1),
  frameProofIds: z.array(z.string().min(1)),
  capturedAt: z.string().datetime()
});

export const pairwiseReviewLedgerExportSchema = z.object({
  version: z.literal("joseph-study-review-export-v1"),
  generatedAt: z.string().datetime(),
  schema: z.object({
    reviewLedgerVersion: z.literal("joseph-study.review-ledger.v1"),
    failureTaxonomyVersion: z.string().min(1),
    frameProofVersion: z.string().min(1)
  }),
  ledger: z.array(z.unknown()),
  gallery: z.object({
    source: z.object({
      sourceId: z.string().min(1),
      manifestUrls: z.array(z.string())
    }),
    candidates: z.array(
      z.object({
        candidateId: z.string().min(1),
        candidateLabel: z.string().min(1),
        verdict: z.enum(["winner", "loser"]),
        reviewedAt: z.string().datetime(),
        failureTags: z.array(failureTagSchema),
        frameProofIds: z.array(z.string().min(1))
      })
    ),
    pairwisePreferences: z.array(pairwisePreferenceSchema).min(1)
  })
});

export type PairwiseReviewLedgerExport = z.infer<typeof pairwiseReviewLedgerExportSchema>;

export type PairwisePreferenceRewardModel = {
  modelVersion: "pairwise-preference-failure-tag-linear-v1";
  failureTagWeights: Record<string, number>;
  baselineWinnerScore: number;
};

export type PairwisePreferenceTrainingReport = {
  reportVersion: "pairwise-preference-training-report-v1";
  source: {
    schemaVersion: PairwiseReviewLedgerExport["version"];
    failureTaxonomyVersion: string;
    sourceId: string;
  };
  labels: {
    preferenceLabelKind: "pairwise_winner_loser";
    pairwisePreferenceCount: number;
    absoluteDemonstrationCount: 0;
    absoluteDemonstrationsUsed: false;
  };
  model: PairwisePreferenceRewardModel;
};

export type PairwisePreferenceEvaluation = {
  evaluationVersion: "pairwise-preference-evaluation-v1";
  heldOutPreferenceCount: number;
  accuracy: number;
  predictions: Array<{
    winnerCandidateId: string;
    loserCandidateId: string;
    predictedWinnerCandidateId: string;
    margin: number;
    matchedFailureTags: string[];
  }>;
};

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].sort();

const scoreLoserPenalty = (model: PairwisePreferenceRewardModel, failureTags: readonly string[]): number =>
  uniqueSorted(failureTags).reduce((score, tag) => score + (model.failureTagWeights[tag] ?? 0), 0);

export function trainPairwisePreferenceRewardModel(
  exportArtifact: PairwiseReviewLedgerExport
): PairwisePreferenceTrainingReport {
  const tagCounts = new Map<string, number>();
  for (const preference of exportArtifact.gallery.pairwisePreferences) {
    for (const tag of uniqueSorted(preference.failureTags)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const failureTagWeights = Object.fromEntries(
    [...tagCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([tag, count]) => [tag, -count])
  );

  return {
    reportVersion: "pairwise-preference-training-report-v1",
    source: {
      schemaVersion: exportArtifact.version,
      failureTaxonomyVersion: exportArtifact.schema.failureTaxonomyVersion,
      sourceId: exportArtifact.gallery.source.sourceId
    },
    labels: {
      preferenceLabelKind: "pairwise_winner_loser",
      pairwisePreferenceCount: exportArtifact.gallery.pairwisePreferences.length,
      absoluteDemonstrationCount: 0,
      absoluteDemonstrationsUsed: false
    },
    model: {
      modelVersion: "pairwise-preference-failure-tag-linear-v1",
      failureTagWeights,
      baselineWinnerScore: 0
    }
  };
}

export function evaluatePairwisePreferenceRewardModel(
  model: PairwisePreferenceRewardModel,
  heldOutExport: PairwiseReviewLedgerExport
): PairwisePreferenceEvaluation {
  const predictions = heldOutExport.gallery.pairwisePreferences.map((preference) => {
    const matchedFailureTags = uniqueSorted(preference.failureTags).filter((tag) => model.failureTagWeights[tag] !== undefined);
    const loserScore = scoreLoserPenalty(model, preference.failureTags);
    const winnerScore = model.baselineWinnerScore;
    const predictedWinnerCandidateId = winnerScore >= loserScore
      ? preference.winnerCandidateId
      : preference.loserCandidateId;

    return {
      winnerCandidateId: preference.winnerCandidateId,
      loserCandidateId: preference.loserCandidateId,
      predictedWinnerCandidateId,
      margin: Math.abs(winnerScore - loserScore),
      matchedFailureTags
    };
  });

  const correct = predictions.filter((prediction) => prediction.predictedWinnerCandidateId === prediction.winnerCandidateId).length;

  return {
    evaluationVersion: "pairwise-preference-evaluation-v1",
    heldOutPreferenceCount: predictions.length,
    accuracy: predictions.length === 0 ? 0 : correct / predictions.length,
    predictions
  };
}
