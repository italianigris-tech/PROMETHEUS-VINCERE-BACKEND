import {z} from "zod";

const idSchema = z.string().trim().min(1);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);

export const maulTextAnimationTreatmentSchema = z.enum([
  "fade_rise",
  "keyword_pop",
  "continuous_push",
]);

export const maulTextAnimationEasingSchema = z.discriminatedUnion("type", [
  z.object({type: z.literal("linear")}).strict(),
  z
    .object({
      type: z.literal("cubic_bezier"),
      x1: z.number().min(0).max(1),
      y1: z.number().min(0).max(1),
      x2: z.number().min(0).max(1),
      y2: z.number().min(0).max(1),
    })
    .strict(),
]);

export const maulTextAnimationTransformSchema = z
  .object({
    opacity: z.number().min(0).max(1),
    translateXPx: z.number().min(-1920).max(1920),
    translateYPx: z.number().min(-1920).max(1920),
    scale: z.number().min(0.5).max(2),
  })
  .strict();

const textAnimationTransformsEqual = (
  left: z.infer<typeof maulTextAnimationTransformSchema>,
  right: z.infer<typeof maulTextAnimationTransformSchema>,
) =>
  left.opacity === right.opacity &&
  left.translateXPx === right.translateXPx &&
  left.translateYPx === right.translateYPx &&
  left.scale === right.scale;

export const maulTextAnimationPhaseSchema = z
  .object({
    outputStartMs: z.number().int().nonnegative(),
    outputEndMs: z.number().int().positive(),
    easing: maulTextAnimationEasingSchema,
    from: maulTextAnimationTransformSchema,
    to: maulTextAnimationTransformSchema,
  })
  .refine((phase) => phase.outputEndMs > phase.outputStartMs, {
    path: ["outputEndMs"],
    message: "Text animation phases require positive duration.",
  });

export const maulTextAnimationProgramSchema = z
  .object({
    animationId: idSchema,
    treatment: maulTextAnimationTreatmentSchema,
    target: z
      .object({
        scope: z.enum(["segment", "tokens"]),
        placementSegmentId: idSchema,
        tokenIds: z.array(idSchema).min(1),
      })
      .strict(),
    phases: z
      .object({
        entry: maulTextAnimationPhaseSchema,
        hold: maulTextAnimationPhaseSchema,
        exit: maulTextAnimationPhaseSchema,
      })
      .strict(),
    rationale: z.string().trim().min(1),
  })
  .strict()
  .superRefine((program, ctx) => {
    if (new Set(program.target.tokenIds).size !== program.target.tokenIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target", "tokenIds"],
        message: "Animation token references must be unique.",
      });
    }

    if (
      program.phases.hold.outputStartMs <
        program.phases.entry.outputEndMs ||
      program.phases.exit.outputStartMs < program.phases.hold.outputEndMs
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phases"],
        message:
          "Animation entry, hold, and exit phases must be ordered and non-overlapping.",
      });
    }

    if (
      !textAnimationTransformsEqual(
        program.phases.entry.to,
        program.phases.hold.from,
      ) ||
      !textAnimationTransformsEqual(
        program.phases.hold.to,
        program.phases.exit.from,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phases"],
        message:
          "Text animation phase transforms must remain continuous at every boundary.",
      });
    }

    if (program.treatment === "keyword_pop" && program.target.scope !== "tokens") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target", "scope"],
        message: "keyword_pop must target stable token references.",
      });
    }
    if (program.treatment !== "keyword_pop" && program.target.scope !== "segment") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target", "scope"],
        message: `${program.treatment} must target its stable placement segment.`,
      });
    }
  });

export const maulTextAnimationPlanCoreSchema = z
  .object({
    schemaVersion: z.literal("maul-text-animation-plan/v1"),
    textChunkPlanArtifactId: idSchema,
    textChunkPlanHash: sha256Schema,
    textPlacementPlanArtifactId: idSchema,
    textPlacementPlanHash: sha256Schema,
    treatmentGenomeArtifactId: idSchema,
    treatmentGenomeHash: sha256Schema,
    outputDurationMs: z.number().int().positive(),
    programs: z.array(maulTextAnimationProgramSchema).min(1),
    inputHashes: z
      .object({
        textChunkPlan: sha256Schema,
        textPlacementPlan: sha256Schema,
        treatmentGenome: sha256Schema,
      })
      .strict(),
  })
  .superRefine((plan, ctx) => {
    const animationIds = plan.programs.map((program) => program.animationId);
    if (new Set(animationIds).size !== animationIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["programs"],
        message: "Text animation IDs must be unique.",
      });
    }

    const placementSegmentIds = plan.programs.map(
      (program) => program.target.placementSegmentId,
    );
    if (new Set(placementSegmentIds).size !== placementSegmentIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["programs"],
        message: "Each placement segment may have only one animation program.",
      });
    }

    plan.programs.forEach((program, index) => {
      if (program.phases.exit.outputEndMs > plan.outputDurationMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["programs", index, "phases", "exit", "outputEndMs"],
          message: "Animation phases must stay inside the output duration.",
        });
      }
    });

    if (
      plan.textChunkPlanHash !== plan.inputHashes.textChunkPlan ||
      plan.textPlacementPlanHash !== plan.inputHashes.textPlacementPlan ||
      plan.treatmentGenomeHash !== plan.inputHashes.treatmentGenome
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inputHashes"],
        message:
          "Animation input hashes must match their authoritative parent hashes.",
      });
    }
  });

export type MaulTextAnimationTreatment = z.infer<
  typeof maulTextAnimationTreatmentSchema
>;
export type MaulTextAnimationEasing = z.infer<
  typeof maulTextAnimationEasingSchema
>;
export type MaulTextAnimationTransform = z.infer<
  typeof maulTextAnimationTransformSchema
>;
export type MaulTextAnimationPhase = z.infer<
  typeof maulTextAnimationPhaseSchema
>;
export type MaulTextAnimationProgram = z.infer<
  typeof maulTextAnimationProgramSchema
>;
export type MaulTextAnimationPlanCore = z.infer<
  typeof maulTextAnimationPlanCoreSchema
>;
