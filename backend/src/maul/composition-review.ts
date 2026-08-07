import {createHash} from "node:crypto";
import * as path from "node:path";

import {z} from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const reviewLabelSchema = z.enum(["a", "b"]);
const reviewChoiceSchema = z.enum(["a", "b", "tie", "no_meaningful_preference"]);

const mutationProvenanceSchema = z.object({
  parentCandidateId: z.string().min(1),
  repairId: z.string().min(1),
  targetDimension: z.string().min(1),
}).strict();

const compositionReviewCandidateSchema = z.object({
  candidateId: z.string().min(1),
  declaredFingerprint: sha256Schema,
  observedFingerprint: sha256Schema,
  videoPath: z.string().min(1),
  stillPaths: z.array(z.string().min(1)).min(1),
  mutationProvenance: mutationProvenanceSchema.nullable(),
}).strict();

const sceneContextSchema = z.object({
  fixtureId: z.string().min(1),
  phrase: z.string().min(1),
}).strict();

const publicCandidateSchema = z.object({
  label: reviewLabelSchema,
  videoPath: z.string().min(1),
  stillPaths: z.array(z.string().min(1)).min(1),
}).strict();

export const blindedCompositionReviewPackageSchema = z.object({
  schemaVersion: z.literal("maul-blinded-composition-review/v1"),
  reviewPackageId: z.string().min(1),
  sourceGroup: z.string().min(1),
  sceneContext: sceneContextSchema,
  candidates: z.array(publicCandidateSchema).length(2),
}).strict();

const privateCandidateAssignmentSchema = compositionReviewCandidateSchema.extend({
  publicVideoPath: z.string().min(1),
  publicStillPaths: z.array(z.string().min(1)).min(1),
}).strict();

export const privateCompositionReviewAssignmentSchema = z.object({
  schemaVersion: z.literal("maul-private-composition-review-assignment/v1"),
  reviewPackageId: z.string().min(1),
  publicPackageFingerprint: sha256Schema,
  reviewSeedFingerprint: sha256Schema,
  candidateIdByLabel: z.object({
    a: z.string().min(1),
    b: z.string().min(1),
  }).strict(),
  candidatesByLabel: z.object({
    a: privateCandidateAssignmentSchema,
    b: privateCandidateAssignmentSchema,
  }).strict(),
}).strict();

const failureDimensionsSchema = z.object({
  a: z.array(z.string().min(1)),
  b: z.array(z.string().min(1)),
}).strict();

export const compositionReviewResponseSchema = z.object({
  choice: reviewChoiceSchema,
  reviewerId: z.string().min(1),
  reviewerConfidence: z.number().min(0).max(1),
  failureDimensions: failureDimensionsSchema,
  note: z.string(),
  reviewedAt: z.string().datetime(),
}).strict();

export const reviewedCompositionEvidenceSchema = z.object({
  schemaVersion: z.literal("maul-reviewed-composition-evidence/v1"),
  reviewPackageId: z.string().min(1),
  sourceGroup: z.string().min(1),
  sceneContext: sceneContextSchema,
  choice: reviewChoiceSchema,
  chosenCandidateId: z.string().min(1).nullable(),
  reviewer: z.object({
    reviewerId: z.string().min(1),
    confidence: z.number().min(0).max(1),
    reviewedAt: z.string().datetime(),
  }).strict(),
  candidates: z.array(z.object({
    label: reviewLabelSchema,
    candidateId: z.string().min(1),
    declaredFingerprint: sha256Schema,
    observedFingerprint: sha256Schema,
    failureDimensions: z.array(z.string().min(1)),
    mutationProvenance: mutationProvenanceSchema.nullable(),
  }).strict()).length(2),
  note: z.string(),
  eligibility: z.literal("experiment_only"),
  promotionEligible: z.literal(false),
}).strict();

export type BlindedCompositionReviewPackage = z.infer<typeof blindedCompositionReviewPackageSchema>;
export type PrivateCompositionReviewAssignment = z.infer<typeof privateCompositionReviewAssignmentSchema>;
export type CompositionReviewResponse = z.infer<typeof compositionReviewResponseSchema>;
export type ReviewedCompositionEvidence = z.infer<typeof reviewedCompositionEvidenceSchema>;

export type CompositionReviewCandidateInput = {
  readonly candidateId: string;
  readonly declaredFingerprint: string;
  readonly observedFingerprint: string;
  readonly videoPath: string;
  readonly stillPaths: readonly string[];
  readonly mutationProvenance: {
    readonly parentCandidateId: string;
    readonly repairId: string;
    readonly targetDimension: string;
  } | null;
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
};

const fingerprint = (value: unknown): string =>
  createHash("sha256").update(stableJson(value)).digest("hex");

const publicMediaPath = ({
  label,
  kind,
  sourcePath,
  index,
}: {
  label: "a" | "b";
  kind: "video" | "still";
  sourcePath: string;
  index?: number;
}): string => {
  const extension = path.extname(sourcePath).toLowerCase() || (kind === "video" ? ".mp4" : ".png");
  const fileName = kind === "video"
    ? `video${extension}`
    : `still-${String((index ?? 0) + 1).padStart(2, "0")}${extension}`;
  return `media/${label}/${fileName}`;
};

const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();

export function createBlindedCompositionReviewPackage(input: {
  reviewPackageId: string;
  sourceGroup: string;
  sceneContext: z.input<typeof sceneContextSchema>;
  candidates: readonly CompositionReviewCandidateInput[];
  reviewSeed: string;
}): {
  publicPackage: BlindedCompositionReviewPackage;
  privateAssignment: PrivateCompositionReviewAssignment;
} {
  const reviewPackageId = z.string().min(1).parse(input.reviewPackageId);
  const sourceGroup = z.string().min(1).parse(input.sourceGroup);
  const sceneContext = sceneContextSchema.parse(input.sceneContext);
  const reviewSeed = z.string().min(1).parse(input.reviewSeed);
  const candidates = z.array(compositionReviewCandidateSchema).length(2).parse(input.candidates);
  if (new Set(candidates.map((candidate) => candidate.candidateId)).size !== 2) {
    throw new Error("Blinded composition review requires two distinct candidate IDs.");
  }

  const canonicalCandidates = [...candidates].sort((left, right) =>
    left.candidateId.localeCompare(right.candidateId) ||
    left.declaredFingerprint.localeCompare(right.declaredFingerprint),
  );
  const shouldSwap = Number.parseInt(fingerprint({
    reviewPackageId,
    sourceGroup,
    reviewSeed,
    candidateIds: canonicalCandidates.map((candidate) => candidate.candidateId),
  }).slice(0, 2), 16) % 2 === 1;
  const assigned = shouldSwap ? canonicalCandidates.reverse() : canonicalCandidates;
  const first = assigned[0];
  const second = assigned[1];
  if (!first || !second) throw new Error("Blinded composition review requires exactly two candidates.");

  const privateFor = (candidate: typeof first, label: "a" | "b") => {
    const publicVideoPath = publicMediaPath({label, kind: "video", sourcePath: candidate.videoPath});
    const publicStillPaths = candidate.stillPaths.map((sourcePath, index) =>
      publicMediaPath({label, kind: "still", sourcePath, index}),
    );
    return {...candidate, publicVideoPath, publicStillPaths};
  };
  const candidateA = privateFor(first, "a");
  const candidateB = privateFor(second, "b");
  const publicPackage = blindedCompositionReviewPackageSchema.parse({
    schemaVersion: "maul-blinded-composition-review/v1",
    reviewPackageId,
    sourceGroup,
    sceneContext,
    candidates: [
      {label: "a", videoPath: candidateA.publicVideoPath, stillPaths: candidateA.publicStillPaths},
      {label: "b", videoPath: candidateB.publicVideoPath, stillPaths: candidateB.publicStillPaths},
    ],
  });
  const privateAssignment = privateCompositionReviewAssignmentSchema.parse({
    schemaVersion: "maul-private-composition-review-assignment/v1",
    reviewPackageId,
    publicPackageFingerprint: fingerprint(publicPackage),
    reviewSeedFingerprint: fingerprint(reviewSeed),
    candidateIdByLabel: {a: candidateA.candidateId, b: candidateB.candidateId},
    candidatesByLabel: {a: candidateA, b: candidateB},
  });
  return {publicPackage, privateAssignment};
}

export function buildPreferenceInferenceInput(publicPackageInput: unknown): {
  schemaVersion: "maul-composition-preference-inference/v1";
  reviewPackageId: string;
  sourceGroup: string;
  sceneContext: BlindedCompositionReviewPackage["sceneContext"];
  candidates: BlindedCompositionReviewPackage["candidates"];
} {
  const publicPackage = blindedCompositionReviewPackageSchema.parse(publicPackageInput);
  return {
    schemaVersion: "maul-composition-preference-inference/v1",
    reviewPackageId: publicPackage.reviewPackageId,
    sourceGroup: publicPackage.sourceGroup,
    sceneContext: publicPackage.sceneContext,
    candidates: [...publicPackage.candidates].sort((left, right) => left.label.localeCompare(right.label)),
  };
}

export function recordReviewedCompositionEvidence(input: {
  publicPackage: unknown;
  privateAssignment: unknown;
  response: unknown;
}): ReviewedCompositionEvidence {
  const publicPackage = blindedCompositionReviewPackageSchema.parse(input.publicPackage);
  const privateAssignment = privateCompositionReviewAssignmentSchema.parse(input.privateAssignment);
  const response = compositionReviewResponseSchema.parse(input.response);
  if (privateAssignment.reviewPackageId !== publicPackage.reviewPackageId) {
    throw new Error("Private review assignment does not belong to the public review package.");
  }
  if (privateAssignment.publicPackageFingerprint !== fingerprint(publicPackage)) {
    throw new Error("Public review package no longer matches its private assignment.");
  }

  const labels = ["a", "b"] as const;
  const candidates = labels.map((label) => {
    const candidate = privateAssignment.candidatesByLabel[label];
    if (candidate.candidateId !== privateAssignment.candidateIdByLabel[label]) {
      throw new Error(`Private candidate assignment for ${label} is inconsistent.`);
    }
    return {
      label,
      candidateId: candidate.candidateId,
      declaredFingerprint: candidate.declaredFingerprint,
      observedFingerprint: candidate.observedFingerprint,
      failureDimensions: uniqueSorted(response.failureDimensions[label]),
      mutationProvenance: candidate.mutationProvenance,
    };
  });

  return reviewedCompositionEvidenceSchema.parse({
    schemaVersion: "maul-reviewed-composition-evidence/v1",
    reviewPackageId: publicPackage.reviewPackageId,
    sourceGroup: publicPackage.sourceGroup,
    sceneContext: publicPackage.sceneContext,
    choice: response.choice,
    chosenCandidateId: response.choice === "a" || response.choice === "b"
      ? privateAssignment.candidateIdByLabel[response.choice]
      : null,
    reviewer: {
      reviewerId: response.reviewerId,
      confidence: response.reviewerConfidence,
      reviewedAt: response.reviewedAt,
    },
    candidates,
    note: response.note,
    eligibility: "experiment_only",
    promotionEligible: false,
  });
}
