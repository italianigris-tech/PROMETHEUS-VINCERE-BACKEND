import path from "node:path";
import {mkdir, writeFile} from "node:fs/promises";

import type {FastifyInstance} from "fastify";
import {z} from "zod";

import type {BackendEnv} from "./config";
import {QueueBacklogLimitError, QueueConfigurationError, type JobQueue} from "./queue";
import {asyncJobEnvelopeSchema} from "@prometheus/shared-types";
import {editTypographyStyleIdSchema} from "./edit-sessions/types";
import type {EditSessionManager} from "./edit-sessions/service";
import type {EditSessionStore} from "./edit-sessions/store";
import type {R2TransferService} from "./integrations/r2";
import {createJosephUploadPipeline, type JosephUploadPipeline} from "./upload/joseph-upload-pipeline";
import type {JosephProfile} from "./director/orchestrator";

type UploadUrlRequest = {
  filename: string;
  contentType: string;
  userId?: string;
};

const uploadUrlRequestSchema = z.object({
  filename: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  userId: z.string().trim().optional()
});

const processRequestSchema = z.object({
  bucket: z.string().trim().optional(),
  key: z.string().trim().min(1),
  filename: z.string().trim().optional(),
  contentType: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  mediaUrl: z.string().trim().optional(),
  josephProfile: z.enum(["joseph_aggressive", "joseph_cinematic", "joseph_minimal"]).optional(),
  promptText: z.string().trim().optional(),
  retryIndex: z.number().int().nonnegative().optional(),
  matteUrl: z.string().trim().optional(),
  matteFilePath: z.string().trim().optional(),
  captionProfileId: editTypographyStyleIdSchema.optional(),
  motionTier: z.string().trim().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  autoStartPreview: z.boolean().optional()
});

const sanitizeFileName = (value: string): string => {
  const fileName = path.basename(value.trim());
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "upload.bin";
};

const buildSessionUrls = (sessionId: string): {
  status: string;
  previewManifest: string;
  preview: string;
  render: string;
  events: string;
} => {
  return {
    status: `/api/edit-sessions/${sessionId}/status`,
    previewManifest: `/api/edit-sessions/${sessionId}/preview-manifest`,
    preview: `/api/edit-sessions/${sessionId}/preview`,
    render: `/api/edit-sessions/${sessionId}/render`,
    events: `/api/edit-sessions/${sessionId}/events`
  };
};

const createProcessErrorResponse = (error: unknown): {statusCode: number; body: {error: string}} => {
  const message = error instanceof Error ? error.message : String(error);
  const statusCode = error instanceof QueueBacklogLimitError || error instanceof QueueConfigurationError || /not configured/i.test(message) ? 503 : 400;
  return {
    statusCode,
    body: {
      error: message
    }
  };
};

const isJosephProfile = (value: JosephProfile | undefined): value is JosephProfile => Boolean(value);

const writeJosephFailureEvidence = async ({
  editSessionStore,
  sessionId,
  error,
}: {
  editSessionStore: EditSessionStore;
  sessionId: string;
  error: unknown;
}): Promise<string> => {
  const evidencePath = path.join(editSessionStore.sessionDir(sessionId), "joseph-failure");
  const errorMessage = error instanceof Error ? error.message : String(error);
  await mkdir(evidencePath, {recursive: true});
  await writeFile(path.join(evidencePath, "failure.json"), `${JSON.stringify({
    sessionId,
    failureTags: ["orchestrator_failed"],
    errorMessage,
    createdAt: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");
  return evidencePath;
};

type QueuedProcessPayload = {
  sessionId: string;
  input: z.infer<typeof processRequestSchema>;
  bucket: string;
  publicMediaUrl: string | null;
};

const queuedProcessPayloadSchema = z.object({
  sessionId: z.string().trim().min(1),
  input: processRequestSchema,
  bucket: z.string().trim().min(1),
  publicMediaUrl: z.string().trim().nullable()
});

const processQueuedUpload = async ({
  payload,
  editSessions,
  editSessionStore,
  r2Service,
  josephUploadPipeline
}: {
  payload: QueuedProcessPayload;
  editSessions: EditSessionManager;
  editSessionStore: EditSessionStore;
  r2Service: R2TransferService;
  josephUploadPipeline: JosephUploadPipeline;
}): Promise<void> => {
  const {sessionId, input, bucket, publicMediaUrl} = payload;
  try {
    await editSessionStore.ensureSessionWorkspace(sessionId);
    const sourceFileName = sanitizeFileName(input.filename ?? path.basename(input.key));
    const destinationPath = path.join(editSessionStore.sourceDir(sessionId), sourceFileName);

    await r2Service.downloadObject({bucket, key: input.key, destinationPath});
    const completed = await editSessions.completeUpload(sessionId, {
      mediaUrl: publicMediaUrl ?? undefined,
      storageKey: input.key,
      sourcePath: destinationPath,
      sourceFilename: input.filename ?? sourceFileName,
      metadata: {
        ...input.metadata,
        source: "r2",
        r2Bucket: bucket,
        r2Key: input.key,
        r2UserId: input.userId ?? null,
        r2ContentType: input.contentType ?? null,
        r2MediaUrl: publicMediaUrl
      },
      autoStartPreview: input.autoStartPreview ?? true
    });

    if (isJosephProfile(input.josephProfile)) {
      try {
        const result = await josephUploadPipeline.createRenderJob({
          sessionId,
          sourcePath: destinationPath,
          sourceFilename: input.filename ?? sourceFileName,
          sourceDurationMs: completed.sourceDurationMs,
          sourceWidth: completed.sourceWidth,
          sourceHeight: completed.sourceHeight,
          sourceFps: completed.sourceFps,
          profile: input.josephProfile,
          promptText: input.promptText,
          retryIndex: input.retryIndex,
          matteUrl: input.matteUrl,
          matteFilePath: input.matteFilePath,
        });

        await editSessions.mergeSessionMetadata(sessionId, {
          josephProfile: input.josephProfile,
          josephRenderJobId: result.renderJobId,
          josephReplayLedgerEntryId: result.replayLedgerEntryId,
          josephEvidencePath: result.evidencePath,
          josephVariationKey: result.variationKey,
          josephManifestPath: result.studioManifestPath ?? null,
          josephStudioManifestPath: result.studioManifestPath ?? null,
          josephStudioManifestUrl: result.studioManifestUrl ?? null,
        }, {
          status: "render_pending",
          renderStatus: "render_pending",
          renderProgress: 0,
        });
      } catch (error) {
        const failureEvidencePath = await writeJosephFailureEvidence({
          editSessionStore,
          sessionId,
          error,
        });
        await editSessions.mergeSessionMetadata(sessionId, {
          josephProfile: input.josephProfile,
          josephFailureTags: ["orchestrator_failed"],
          josephFailureEvidencePath: failureEvidencePath,
        });
        await editSessions.failSession(sessionId, {
          errorCode: "joseph_orchestrator_failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    await editSessions.failSession(sessionId, {
      errorCode: "r2_process_failed",
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  }
};

export const registerUploadRoutes = async (
  app: FastifyInstance,
  {
    env,
    queue,
    editSessions,
    editSessionStore,
    r2Service,
    josephUploadPipeline = createJosephUploadPipeline({storageDir: env.STORAGE_DIR})
  }: {
    env: BackendEnv;
    queue: JobQueue;
    editSessions: EditSessionManager;
    editSessionStore: EditSessionStore;
    r2Service: R2TransferService;
    josephUploadPipeline?: JosephUploadPipeline;
  }
): Promise<void> => {
  queue.registerHandler("r2-upload-process", async (envelope) => {
    const payload = queuedProcessPayloadSchema.parse(envelope.payload);
    await processQueuedUpload({
      payload,
      editSessions,
      editSessionStore,
      r2Service,
      josephUploadPipeline
    });
  });

  app.post("/api/upload-url", async (req, reply) => {
    try {
      const input = uploadUrlRequestSchema.parse((req.body ?? {}) as UploadUrlRequest);
      const result = await r2Service.createUploadUrl(input);
      reply.code(201);
      return {
        ...result,
        method: "PUT"
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(/not configured/i.test(message) ? 503 : 400);
      return {
        error: message
      };
    }
  });

  app.post("/api/process", async (req, reply) => {
    try {
      const input = processRequestSchema.parse(req.body ?? {});
      const bucket = input.bucket?.trim() || env.R2_UPLOAD_BUCKET.trim();
      if (bucket !== env.R2_UPLOAD_BUCKET.trim()) {
        throw new Error(`bucket must match the configured upload bucket (${env.R2_UPLOAD_BUCKET.trim()}).`);
      }

      const publicMediaUrl = input.mediaUrl?.trim() || null;
      const session = await editSessions.createSession({
        ...(publicMediaUrl ? {mediaUrl: publicMediaUrl} : {}),
        storageKey: input.key,
        sourceFilename: input.filename ?? path.basename(input.key),
        captionProfileId: input.captionProfileId ?? "svg_typography_v1",
        motionTier: input.motionTier ?? "minimal",
        metadata: {
          ...input.metadata,
          source: "r2",
          r2Bucket: bucket,
          r2Key: input.key,
          r2UserId: input.userId ?? null,
          r2ContentType: input.contentType ?? null,
          r2MediaUrl: publicMediaUrl
        }
      });

      try {
        await queue.enqueueEnvelope(asyncJobEnvelopeSchema.parse({
          jobId: `r2-upload:${session.id}`,
          kind: "r2-upload-process",
          correlationId: session.id,
          idempotencyKey: `r2-upload:${session.id}`,
          requestedAt: new Date().toISOString(),
          payload: {
            sessionId: session.id,
            input,
            bucket,
            publicMediaUrl
          }
        }));
      } catch (error) {
        await editSessions.failSession(session.id, {
          errorCode: "queue_backlog_limit",
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }

      reply.code(202);
      return {
        ok: true,
        jobId: session.id,
        sessionId: session.id,
        status: "queued",
        bucket,
        key: input.key,
        session,
        urls: buildSessionUrls(session.id)
      };
    } catch (error) {
      const mapped = createProcessErrorResponse(error);
      reply.code(mapped.statusCode);
      return mapped.body;
    }
  });
};
