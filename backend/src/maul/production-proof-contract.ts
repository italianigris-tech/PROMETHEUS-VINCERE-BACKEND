import {createHash} from "node:crypto";
import {performance} from "node:perf_hooks";

import type {ShortsTextChunkPlan} from "@prometheus/shared-types";
import {z} from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);

export const maulProductionLayerPolicySchema = z.object({
  baseVideo: z.literal("required"),
  typography: z.literal("required"),
  sourceTreatment: z.literal("disabled"),
  sourceLegibilityOverlay: z.literal("disabled"),
  editorialCuts: z.literal("disabled"),
  transitions: z.literal("disabled"),
  backgroundAnimation: z.literal("disabled"),
  motionGraphics: z.literal("disabled"),
  audioTreatment: z.literal("disabled"),
}).strict();

export type MaulProductionLayerPolicy = z.infer<
  typeof maulProductionLayerPolicySchema
>;

export const PRODUCTION_PROOF_REQUIRED_STAGES = [
  "media_segment",
  "assemblyai_transcription",
  "llm_chunking",
  "media_observation",
  "deterministic_planning",
  "remotion_bundle_render_encode",
  "artifact_persistence",
] as const;

const productionStageNameSchema = z.enum(PRODUCTION_PROOF_REQUIRED_STAGES);

export const maulProductionStageReceiptSchema = z.object({
  stage: productionStageNameSchema,
  startedAt: z.string().datetime({offset: true}),
  endedAt: z.string().datetime({offset: true}),
  durationMs: z.number().finite().nonnegative(),
  cache: z.enum(["hit", "miss", "not_applicable"]),
  inputSha256: sha256Schema,
  outputSha256: sha256Schema.nullable(),
  providerRequestId: z.string().trim().min(1).nullable(),
  bytesRead: z.number().int().nonnegative().nullable(),
  bytesWritten: z.number().int().nonnegative().nullable(),
  warnings: z.array(z.string().trim().min(1)),
  failure: z
    .object({
      code: z.string().trim().min(1),
      message: z.string().trim().min(1),
    })
    .strict()
    .nullable(),
}).strict();

export type MaulProductionStageReceipt = z.infer<
  typeof maulProductionStageReceiptSchema
>;

export const maulProductionRunDiagnosticsSchema = z
  .object({
    schemaVersion: z.literal("maul-production-run-diagnostics/v1"),
    layerPolicy: maulProductionLayerPolicySchema,
    stages: z.array(maulProductionStageReceiptSchema),
  })
  .strict()
  .superRefine((diagnostics, ctx) => {
    const seen = new Set<string>();
    diagnostics.stages.forEach((stage, index) => {
      if (seen.has(stage.stage)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stages", index, "stage"],
          message: `Production proof stage ${stage.stage} is duplicated.`,
        });
      }
      seen.add(stage.stage);
    });
    for (const requiredStage of PRODUCTION_PROOF_REQUIRED_STAGES) {
      if (!seen.has(requiredStage)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stages"],
          message: `Production proof required stage is missing: ${requiredStage}.`,
        });
      }
    }
  });

export type MaulProductionRunDiagnostics = z.infer<
  typeof maulProductionRunDiagnosticsSchema
>;

export const assertInvokedProductionChunkPlan = (
  plan: ShortsTextChunkPlan,
): ShortsTextChunkPlan => {
  if (plan.strategy !== "llm_assisted" || plan.inference.status !== "invoked") {
    throw new Error(
      `Production typography proof requires invoked LLM chunking; received ${plan.inference.status}.`,
    );
  }
  if (!plan.inference.requestHash || !plan.inference.responseHash) {
    throw new Error(
      "Production typography proof requires request and response hashes for invoked chunking.",
    );
  }
  return plan;
};

export type ProductionProofClock = {
  monotonicNow: () => number;
  isoNow: () => string;
};

const defaultClock: ProductionProofClock = {
  monotonicNow: () => performance.now(),
  isoNow: () => new Date().toISOString(),
};

export type ProductionStageTimer = {
  complete: (input: {
    cache: "hit" | "miss" | "not_applicable";
    inputSha256: string;
    outputSha256: string | null;
    providerRequestId: string | null;
    bytesRead: number | null;
    bytesWritten: number | null;
    warnings: string[];
  }) => MaulProductionStageReceipt;
  fail: (input: {
    cache: "hit" | "miss" | "not_applicable";
    inputSha256: string;
    providerRequestId: string | null;
    bytesRead: number | null;
    bytesWritten: number | null;
    warnings: string[];
    code: string;
    message: string;
  }) => MaulProductionStageReceipt;
};

export const createProductionStageTimer = (
  stage: (typeof PRODUCTION_PROOF_REQUIRED_STAGES)[number],
  clock: ProductionProofClock = defaultClock,
): ProductionStageTimer => {
  const startedAtMonotonic = clock.monotonicNow();
  const startedAt = clock.isoNow();
  let settled = false;

  const finish = ({
    cache,
    inputSha256,
    outputSha256,
    providerRequestId,
    bytesRead,
    bytesWritten,
    warnings,
    failure,
  }: {
    cache: "hit" | "miss" | "not_applicable";
    inputSha256: string;
    outputSha256: string | null;
    providerRequestId: string | null;
    bytesRead: number | null;
    bytesWritten: number | null;
    warnings: string[];
    failure: MaulProductionStageReceipt["failure"];
  }): MaulProductionStageReceipt => {
    if (settled) {
      throw new Error(`Production proof stage ${stage} was settled twice.`);
    }
    settled = true;
    return maulProductionStageReceiptSchema.parse({
      stage,
      startedAt,
      endedAt: clock.isoNow(),
      durationMs: Number(
        Math.max(0, clock.monotonicNow() - startedAtMonotonic).toFixed(3),
      ),
      cache,
      inputSha256,
      outputSha256,
      providerRequestId,
      bytesRead,
      bytesWritten,
      warnings,
      failure,
    });
  };

  return {
    complete: (input) => finish({...input, failure: null}),
    fail: ({code, message, ...input}) => finish({
      ...input,
      outputSha256: null,
      failure: {code, message},
    }),
  };
};

export const sha256Text = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
