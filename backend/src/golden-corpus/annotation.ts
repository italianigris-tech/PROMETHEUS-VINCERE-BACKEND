import {z} from "zod";

export const GOLDEN_CORPUS_ANNOTATION_SCHEMA_VERSION = "golden-corpus-annotation-v1";

const timeRangeSecondsSchema = z
  .object({
    start: z.number().nonnegative(),
    end: z.number().positive()
  })
  .refine((range) => range.end > range.start, {
    message: "timeRangeSeconds.end must be greater than start"
  });

const failureClassSchema = z.enum([
  "boring-under-editing",
  "chaotic-over-editing",
  "cheap-template-motion",
  "premium-restraint",
  "repetition-fatigue",
  "climax-overspend",
  "weak-concept-reduction",
  "asset-treatment-mismatch",
  "sequence-rhythm-collapse",
  "readability-sacrifice"
]);

export const visibleCraftDecisionSchema = z.object({
  category: z.enum([
    "camera",
    "typography",
    "motion_graphics",
    "composition",
    "transition",
    "audio",
    "temporal_pacing",
    "pip_or_matte"
  ]),
  timeRangeSeconds: timeRangeSecondsSchema,
  observation: z.string().min(1),
  extractorFeasibility: z.enum(["direct", "heuristic", "manual_only", "rejected"])
});

export const trajectoryWindowAnnotationSchema = z.object({
  windowIndex: z.number().int().nonnegative(),
  verdict: z.enum(["usable", "needs_review", "reject"]),
  visibleDecisionRefs: z.array(z.string().min(1)).min(1),
  notes: z.string().min(1)
});

export const goldenCorpusAnnotationSchema = z.object({
  schemaVersion: z.literal(GOLDEN_CORPUS_ANNOTATION_SCHEMA_VERSION),
  registryId: z.string().min(1),
  annotator: z.object({
    reviewerId: z.string().min(1),
    reviewedAt: z.string().datetime()
  }),
  referenceEdit: z.object({
    qualityTier: z.enum(["elite", "strong", "generic", "weak", "rejected"]),
    styleFit: z.enum(["on_style", "borderline", "off_style"]),
    duplicateAssessment: z
      .object({
        isDuplicate: z.boolean(),
        duplicateOfRegistryId: z.string().min(1).optional()
      })
      .refine((value) => !value.isDuplicate || value.duplicateOfRegistryId, {
        message: "duplicateOfRegistryId is required when isDuplicate is true"
      }),
    compressionAssessment: z.enum(["clean", "minor_artifacts", "over_compressed"]),
    requiredNotes: z.string().min(1),
    visibleCraftDecisions: z.array(visibleCraftDecisionSchema).min(1),
    failureClasses: z.array(failureClassSchema)
  }),
  extractedTrajectory: z.object({
    trajectoryPath: z.string().min(1),
    featureVersion: z.string().min(1),
    validationStatus: z.enum(["not_extracted", "extracted", "validated", "rejected"]),
    trajectoryNotes: z.string().min(1),
    windowAnnotations: z.array(trajectoryWindowAnnotationSchema).min(1)
  })
});

export type GoldenCorpusAnnotation = z.infer<typeof goldenCorpusAnnotationSchema>;

export type AnnotationQaResult = {
  approved: boolean;
  rejectionReasons: string[];
};

export function evaluateAnnotationQa(annotation: GoldenCorpusAnnotation): AnnotationQaResult {
  const rejectionReasons: string[] = [];

  if (annotation.referenceEdit.qualityTier === "weak" || annotation.referenceEdit.qualityTier === "rejected") {
    rejectionReasons.push(`quality_tier_${annotation.referenceEdit.qualityTier}`);
  }
  if (annotation.referenceEdit.styleFit === "off_style") {
    rejectionReasons.push("off_style");
  }
  if (annotation.referenceEdit.duplicateAssessment.isDuplicate) {
    rejectionReasons.push("duplicate_reference");
  }
  if (annotation.referenceEdit.compressionAssessment === "over_compressed") {
    rejectionReasons.push("over_compressed_source");
  }
  if (annotation.extractedTrajectory.validationStatus === "rejected") {
    rejectionReasons.push("trajectory_rejected");
  }

  return {
    approved: rejectionReasons.length === 0,
    rejectionReasons
  };
}
