import {z} from "zod";

import {maulFrameMotionProgramSchema} from "./maul-frame-motion.js";

const idSchema = z.string().trim().min(1);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);

export const MAUL_TEXT_ANIMATION_TREATMENTS = [
  "fade_rise",
  "keyword_pop",
  "continuous_push",
  "position_locked_word_reveal",
  "position_locked_letter_reveal",
  "softSlideLeft", "softSlideRight", "arcRise", "dropSettle", "whipIn", "parallaxCross",
  "agentic_split_rise", "interesting_blur_lift", "cinematic_focus_lock", "generic_single_word", "two_word_cinematic_pair", "two_word_stagger_punch", "two_word_arc_sweep", "two_word_dual_rise", "two_word_focus_pivot", "three_word_serif_orbit", "three_word_tall_blade", "three_word_script_glide", "three_word_ref_lockup", "three_word_ref_last_punch", "three_word_ref_through_column", "three_word_ref_script_tag", "three_word_ref_dream_big_now_v1", "three_word_ref_your_master_mind_v1", "three_word_ref_take_action_now_v1", "three_word_ref_build_legacy_your_v1", "four_word_banner_drift", "four_word_split_stagger", "four_word_serif_pivot", "four_word_outline_whip", "six_word_quad_duo_depth", "two_word_script_caption_lock", "hormozi_word_lock_snap",
  "cinematic_text_preset", "cinematic_text_preset_1", "cinematic_text_preset_2", "cinematic_text_preset_3", "cinematic_text_preset_4", "cinematic_text_preset_5", "cinematic_text_preset_6", "cinematic_text_preset_7", "cinematic_text_preset_8", "cinematic_text_preset_9", "cinematic_text_preset_10", "cinematic_text_preset_11",
  "word-rise-blur-resolve", "letter-float-overshoot", "tracking-collapse", "vertical-slit-reveal", "horizontal-mask-sweep", "depth-pop-letter", "glitch-stabilize", "whisper-fade-up", "impact-punch", "drift-from-depth", "letter-shimmer-pass", "baseline-wave", "split-convergence", "scramble-to-clarity", "heavy-subtitle-rise", "documentary-soft-lock", "kinetic-cascade", "flash-exposure", "bottom-crop-drift", "single-word-elastic-emphasis", "stepped-dramatic-build", "ghost-trail-letter", "compression-release", "skew-unbend", "rise-glow-settle", "cinematic-typewriter", "phrase-inhale", "pulse-emphasis", "long-shadow-sweep", "word-ladder-build", "letter-rain-settle", "delayed-bloom",
  "animated-quote-reveal", "blur-underline", "core-replaceable-word", "cursor-highlight-text-animation", "highlight-word", "main-word-inside-a-glow-box", "number-for-steps-counting-animation", "text-underlining-effect", "three-steps-pyramid", "word-cross-out",
  "text-entry.word-riser", "text-entry.letter-riser", "text-entry.soft-letter-tracking", "text-entry.velocity-slide-reveal", "text-entry.clipped-mask-reveal",
  "text-emphasis.underline-reveal", "text-emphasis.sweep-highlight", "text-emphasis.capsule-highlight", "text-emphasis.marker-stroke", "text-emphasis.semantic-glow",
  "text-mutation.weight-escalation", "text-mutation.emphasis-handoff", "accent-motion.bracket-lock", "accent-motion.caption-rail", "spatial-motion.anchored-drift",
] as const;

export const maulTextAnimationTreatmentSchema = z.enum(
  MAUL_TEXT_ANIMATION_TREATMENTS,
);

export const maulPositionLockedRevealSchema = z.object({
  unit: z.enum(["word", "letter"]),
  primitive: z.enum([
    "opacity",
    "clip",
    "blur",
    "blur_tracking",
    "scale_focus",
  ]),
  sourceTreatment: maulTextAnimationTreatmentSchema,
  tokenStaggerMs: z.number().int().min(0).max(500),
  letterStaggerMs: z.number().int().min(0).max(120),
  durationMs: z.number().int().positive().max(1000),
  blurPx: z.number().min(0).max(24),
  trackingEm: z.number().min(0).max(0.3),
  startScale: z.number().min(0.8).max(1),
}).strict();

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
    localReveal: maulPositionLockedRevealSchema.optional(),
    executorId: idSchema.optional(),
    frameMotion: maulFrameMotionProgramSchema.optional(),
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

    const lockedTreatment =
      program.treatment === "position_locked_word_reveal" ||
      program.treatment === "position_locked_letter_reveal";
    if (lockedTreatment) {
      if (program.target.scope !== "tokens" || !program.localReveal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["localReveal"],
          message: "Position-locked reveals require a token target and local reveal policy.",
        });
      }
      const expectedUnit = program.treatment === "position_locked_letter_reveal"
        ? "letter"
        : "word";
      if (program.localReveal && program.localReveal.unit !== expectedUnit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["localReveal", "unit"],
          message: "Position-locked reveal treatment and unit must match.",
        });
      }
      const transforms = [
        program.phases.entry.from,
        program.phases.entry.to,
        program.phases.hold.from,
        program.phases.hold.to,
        program.phases.exit.from,
        program.phases.exit.to,
      ];
      if (transforms.some((transform) =>
        transform.translateXPx !== 0 || transform.translateYPx !== 0
      )) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phases"],
          message: "Position-locked reveal programs cannot translate token anchors.",
        });
      }
      if (
        program.phases.hold.from.opacity !== 1 ||
        program.phases.hold.to.opacity !== 1 ||
        program.phases.hold.from.scale !== 1 ||
        program.phases.hold.to.scale !== 1
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phases", "hold"],
          message: "Position-locked reveal holds require identity geometry and full opacity.",
        });
      }
    }

    if ((program.executorId === undefined) !== (program.frameMotion === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frameMotion"],
        message: "Frame motion programs require an executor ID and compiled frame motion together.",
      });
    }
    if (program.frameMotion) {
      if (
        program.executorId !== program.frameMotion.executorId ||
        program.target.placementSegmentId !== program.frameMotion.placementSegmentId ||
        program.target.scope !== "tokens" ||
        program.target.tokenIds.length !== 1 ||
        program.target.tokenIds[0] !== program.frameMotion.tokenId
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["frameMotion"],
          message: "Compiled frame motion must match its executor, placement segment, and single token target.",
        });
      }
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

    const programTargetKeys = plan.programs.map((program) =>
      program.target.scope === "segment"
        ? `${program.target.placementSegmentId}:segment`
        : [
            program.target.placementSegmentId,
            "tokens",
            program.target.tokenIds.join(","),
            program.frameMotion?.phases.entry.startFrame ?? "legacy",
          ].join(":"),
    );
    if (new Set(programTargetKeys).size !== programTargetKeys.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["programs"],
        message: "Each placement segment may have one segment program; token targets must be unique within each frame interval.",
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
export type MaulPositionLockedReveal = z.infer<
  typeof maulPositionLockedRevealSchema
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
