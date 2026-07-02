import {createHash} from "node:crypto";
import {mkdir, writeFile} from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import type {FastifyInstance} from "fastify";
import type {UnifiedRenderManifest} from "@prometheus/shared-types";
import {z} from "zod";

import {ReplayLedger} from "../ledger/replay-ledger";
import {orchestrateRender, type JosephProfile, type OrchestratorResult} from "./orchestrator";
import {PromptRegistry} from "./prompt-governance";

const JOSEPH_STUDY_CANDIDATES_VERSION = "joseph-study-candidates-v1" as const;

const josephProfileSchema = z.enum(["joseph_aggressive", "joseph_cinematic", "joseph_minimal"]);

const josephStudyCandidateRequestSchema = z.object({
  candidateCount: z.number().int().min(2).max(6).default(4),
  sourceVideoPath: z.string().trim().min(1).default("/dev-fixtures/test-video.mp4"),
  audioPath: z.string().trim().min(1).optional(),
  musicPath: z.string().trim().min(1).optional(),
  promptText: z.string().trim().min(1).default("Joseph study candidate generation"),
  profile: josephProfileSchema.default("joseph_aggressive"),
  uploadInstanceId: z.string().trim().min(1).optional(),
});

export type JosephStudyCandidateRequest = z.infer<typeof josephStudyCandidateRequestSchema>;

type ReadyJosephStudyLane = {
  id: string;
  label: string;
  status: "ready";
  candidateId: string;
  doctrineBranch: string;
  manifestHash: string;
  evidencePointer: string;
  manifest: UnifiedRenderManifest;
};

type FailedJosephStudyLane = {
  id: string;
  label: string;
  status: "failed";
  candidateId: string | null;
  doctrineBranch: string | null;
  manifestHash: string | null;
  evidencePointer: string;
  errorMessage: string;
  failureTags: string[];
};

export type JosephStudyCandidateLane = ReadyJosephStudyLane | FailedJosephStudyLane;

export type JosephStudyCandidateResponse = {
  version: typeof JOSEPH_STUDY_CANDIDATES_VERSION;
  requestedCount: number;
  lanes: JosephStudyCandidateLane[];
  failures: FailedJosephStudyLane[];
};

export type JosephStudyCandidateGenerator = (
  input: JosephStudyCandidateRequest,
) => Promise<JosephStudyCandidateResponse>;

const sha256Json = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const safeSegment = (value: string): string => {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "joseph-study";
};

const labelForIndex = (index: number): string => `Candidate ${String.fromCharCode(65 + index)}`;

const defaultUploadInstanceId = (input: JosephStudyCandidateRequest): string =>
  `joseph-study-${sha256Json({
    sourceVideoPath: input.sourceVideoPath,
    promptText: input.promptText,
    profile: input.profile,
    candidateCount: input.candidateCount,
  }).slice(0, 12)}`;

const doctrineBranchFor = (manifest: UnifiedRenderManifest): string =>
  manifest.plannerHandoff?.doctrineBranchIds[0] ??
  manifest.josephChoreography?.segments[0]?.doctrineId ??
  manifest.creativeProfile.name;

const laneFromResult = (
  result: OrchestratorResult,
  index: number,
): ReadyJosephStudyLane => ({
  id: `candidate-${index + 1}`,
  label: labelForIndex(index),
  status: "ready",
  candidateId: result.manifest.jobId,
  doctrineBranch: doctrineBranchFor(result.manifest),
  manifestHash: result.manifest.plannerHandoff?.compiledManifestHash ?? sha256Json(result.manifest),
  evidencePointer: result.evidencePaths.jobDir,
  manifest: result.manifest,
});

const writeFailureEvidence = async ({
  evidenceDir,
  laneId,
  errorMessage,
  input,
}: {
  evidenceDir: string;
  laneId: string;
  errorMessage: string;
  input: JosephStudyCandidateRequest;
}): Promise<string> => {
  const failureDir = path.join(evidenceDir, "failures", safeSegment(laneId));
  await mkdir(failureDir, {recursive: true});
  await writeFile(path.join(failureDir, "failure.json"), `${JSON.stringify({
    version: JOSEPH_STUDY_CANDIDATES_VERSION,
    laneId,
    errorMessage,
    failureTags: ["candidate_generation_failed"],
    request: {
      candidateCount: input.candidateCount,
      sourceVideoPath: input.sourceVideoPath,
      profile: input.profile,
    },
  }, null, 2)}\n`, "utf8");
  return failureDir;
};

export const createJosephStudyCandidateGenerator = ({
  storageDir = path.join(os.tmpdir(), "prometheus-joseph-study"),
}: {
  storageDir?: string;
} = {}): JosephStudyCandidateGenerator => {
  const evidenceDir = path.join(storageDir, "joseph-study-evidence");
  const promptRegistryPath = path.join(storageDir, "joseph-study-prompt-registry.jsonl");
  const transcriptPath = path.join(storageDir, "joseph-study-transcript.json");

  return async (input) => {
    const lanes: JosephStudyCandidateLane[] = [];
    const failures: FailedJosephStudyLane[] = [];
    const uploadBase = safeSegment(input.uploadInstanceId ?? defaultUploadInstanceId(input));

    for (let index = 0; index < input.candidateCount; index += 1) {
      const laneId = `candidate-${index + 1}`;
      try {
        const result = await orchestrateRender({
          sourceVideoPath: input.sourceVideoPath,
          transcriptPath,
          audioPath: input.audioPath ?? input.sourceVideoPath,
          musicPath: input.musicPath,
          promptText: input.promptText,
          profile: input.profile as JosephProfile,
          uploadInstanceId: `${uploadBase}-${laneId}`,
          retryIndex: index,
          evidenceDir,
        }, new ReplayLedger(":memory:"), new PromptRegistry(promptRegistryPath));
        lanes.push(laneFromResult(result, index));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const evidencePointer = await writeFailureEvidence({evidenceDir, laneId, errorMessage, input});
        const failedLane: FailedJosephStudyLane = {
          id: laneId,
          label: labelForIndex(index),
          status: "failed",
          candidateId: null,
          doctrineBranch: null,
          manifestHash: null,
          evidencePointer,
          errorMessage,
          failureTags: ["candidate_generation_failed"],
        };
        lanes.push(failedLane);
        failures.push(failedLane);
      }
    }

    return {
      version: JOSEPH_STUDY_CANDIDATES_VERSION,
      requestedCount: input.candidateCount,
      lanes,
      failures,
    };
  };
};

export const registerJosephStudyCandidateRoutes = (
  app: FastifyInstance,
  generator: JosephStudyCandidateGenerator,
): void => {
  app.post("/api/joseph-study/candidates", async (req, reply) => {
    const request = josephStudyCandidateRequestSchema.safeParse(req.body ?? {});
    if (!request.success) {
      reply.code(400);
      return {
        error: "Invalid Joseph study candidate request.",
        issues: request.error.issues.map((issue) => ({
          path: issue.path.join(".") || "(root)",
          message: issue.message,
        })),
      };
    }

    return generator(request.data);
  });
};
