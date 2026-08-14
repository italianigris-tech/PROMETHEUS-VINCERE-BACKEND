import {createWriteStream} from "node:fs";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {pipeline as streamPipeline} from "node:stream/promises";
import {createReadStream} from "node:fs";

import {UnifiedRenderManifestSchema} from "@prometheus/shared-types";
import type {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";

import type {EditSessionEvent, EditSessionManager} from "./service";
import type {EditSessionStore} from "./store";
import type {JosephProfile} from "../director/orchestrator";
import type {JosephUploadPipeline} from "../upload/joseph-upload-pipeline";

const writeSseEvent = (reply: FastifyReply, event: EditSessionEvent): void => {
  reply.raw.write(`event: ${event.type}\n`);
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
};

export const resolveSseAccessControlOrigin = (originHeader?: string | null): string | null => {
  const trimmed = originHeader?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

export const registerEditSessionRoutes = async (
  app: FastifyInstance,
  manager: EditSessionManager,
  store: EditSessionStore,
  josephUploadPipeline?: JosephUploadPipeline
): Promise<void> => {
  const livePreviewUploadCacheDir = path.join(store.sessionsRootDir(), "_live-preview-upload-cache");
  const sanitizeFileName = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, "-");
  const parseOptionalNumber = (value: string | undefined): number | undefined => {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const parseJosephProfile = (value: string | undefined): JosephProfile | null => {
    if (value === "joseph_aggressive" || value === "joseph_cinematic" || value === "joseph_minimal") {
      return value;
    }
    return null;
  };
  const parsePipeline = (value: string | undefined): "maul" | "joseph" => {
    if (!value || value === "maul") return "maul";
    if (value === "joseph") return "joseph";
    throw new Error("pipeline must be 'maul' or 'joseph'.");
  };
  const resolveRequestOrigin = (req: FastifyRequest): string | null => {
    const hostHeader = typeof req.headers.host === "string" ? req.headers.host.trim() : "";
    if (!hostHeader) {
      return null;
    }

    const forwardedProto = typeof req.headers["x-forwarded-proto"] === "string"
      ? req.headers["x-forwarded-proto"].split(",")[0]?.trim()
      : "";
    const protocol = forwardedProto || "http";
    return `${protocol}://${hostHeader}`;
  };

  app.post("/api/edit-sessions/live-preview", async (req, reply) => {
    try {
      const fields: Record<string, string> = {};
      let uploadedFilePath: string | null = null;
      let uploadedFileName: string | null = null;

      if (req.isMultipart()) {
        await mkdir(livePreviewUploadCacheDir, {recursive: true});

        for await (const part of req.parts()) {
          if (part.type === "file") {
            if (part.fieldname !== "source_video") {
              await part.toBuffer();
              continue;
            }

            const safeFileName = sanitizeFileName(part.filename || `upload-${Date.now()}.bin`);
            const targetPath = path.join(livePreviewUploadCacheDir, `${Date.now()}-${safeFileName}`);
            const writeStream = createWriteStream(targetPath);
            await streamPipeline(part.file, writeStream);
            uploadedFilePath = targetPath;
            uploadedFileName = part.filename || safeFileName;
            continue;
          }

          fields[part.fieldname] = String(part.value ?? "").trim();
        }
      } else {
        const body = (req.body as Record<string, unknown> | null | undefined) ?? {};
        for (const [key, value] of Object.entries(body)) {
          if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            fields[key] = String(value).trim();
          }
        }
      }

      const sourcePath = uploadedFilePath ?? fields.sourcePath ?? "";
      if (!sourcePath) {
        throw new Error("Choose an audio/media file or provide a local source path before starting a live preview.");
      }

      const sourceFilename = uploadedFileName ?? path.basename(sourcePath);
      const runNonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const pipeline = parsePipeline(fields.pipeline);
      const josephProfile = parseJosephProfile(fields.josephProfile);
      if (pipeline === "maul" && josephProfile) {
        throw new Error("josephProfile is only valid when pipeline='joseph'.");
      }
      if (pipeline === "joseph" && !josephProfile) {
        throw new Error("pipeline='joseph' requires an explicit josephProfile.");
      }
      const pipelineJobId = `${pipeline}:${runNonce}`;
      const session = await manager.createSession({
        sourceFilename,
        captionProfileId: fields.captionProfileId,
        motionTier: fields.motionTier,
        metadata: {
          livePreviewLane: true,
          forceFreshTranscript: true,
          runNonce,
          uploadedFromBrowser: Boolean(uploadedFilePath),
          sourceDisplayName: sourceFilename,
          pipeline,
          pipelineJobId
        }
      });

      const completed = await manager.completeUpload(session.id, {
        sourcePath,
        sourceFilename,
        metadata: {
          livePreviewLane: true,
          forceFreshTranscript: true,
          runNonce,
          uploadedFromBrowser: Boolean(uploadedFilePath),
          sourceDisplayName: sourceFilename,
          pipeline,
          pipelineJobId
        },
        autoStartPreview: false
      });

      const started = await manager.startPreview(session.id, {
        previewSeconds: parseOptionalNumber(fields.previewSeconds)
      });

      let resolvedSession = started;
      if (pipeline === "joseph" && josephProfile) {
        if (!josephUploadPipeline) {
          throw new Error("Joseph upload pipeline is unavailable for this backend instance.");
        }

        const josephResult = await josephUploadPipeline.createRenderJob({
          sessionId: session.id,
          sourcePath,
          sourceFilename,
          sourceDurationMs: completed.sourceDurationMs,
          sourceWidth: completed.sourceWidth,
          sourceHeight: completed.sourceHeight,
          sourceFps: completed.sourceFps,
          profile: josephProfile,
          promptText: fields.promptText,
          retryIndex: parseOptionalNumber(fields.retryIndex),
          matteUrl: fields.matteUrl,
          matteFilePath: fields.matteFilePath,
        });
        const josephSessionDir = path.join(store.sessionDir(session.id), "joseph");
        const josephManifestPath = path.join(josephSessionDir, "unified-render-manifest.json");
        await mkdir(josephSessionDir, {recursive: true});
        await writeFile(josephManifestPath, `${JSON.stringify(josephResult.manifest, null, 2)}\n`, "utf8");
        resolvedSession = await manager.mergeSessionMetadata(session.id, {
          josephProfile,
          josephRenderJobId: josephResult.renderJobId,
          josephReplayLedgerEntryId: josephResult.replayLedgerEntryId,
          josephEvidencePath: josephResult.evidencePath,
          josephVariationKey: josephResult.variationKey,
          josephManifestPath,
          josephStudioManifestPath: josephResult.studioManifestPath ?? null,
          josephStudioManifestUrl: josephResult.studioManifestUrl ?? null,
        }, {
          status: "render_pending",
          renderStatus: "render_pending",
          renderProgress: 0,
        });
      }

      reply.code(202);
      return {
        ...resolvedSession,
        urls: {
          status: `/api/edit-sessions/${session.id}/status`,
          previewManifest: `/api/edit-sessions/${session.id}/preview-manifest`,
          josephManifest: `/api/edit-sessions/${session.id}/joseph-manifest`,
          josephRenderJob: `/api/edit-sessions/${session.id}/joseph-render-job`,
          previewArtifact: `/api/edit-sessions/${session.id}/preview-artifact`,
          preview: `/api/edit-sessions/${session.id}/preview`,
          render: `/api/edit-sessions/${session.id}/render`,
          events: `/api/edit-sessions/${session.id}/events`
        }
      };
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.post("/api/edit-sessions", async (req, reply) => {
    try {
      const session = await manager.createSession(req.body);
      reply.code(201);
      return {
        ...session,
        urls: {
          status: `/api/edit-sessions/${session.id}/status`,
          previewManifest: `/api/edit-sessions/${session.id}/preview-manifest`,
          previewArtifact: `/api/edit-sessions/${session.id}/preview-artifact`,
          preview: `/api/edit-sessions/${session.id}/preview`,
          render: `/api/edit-sessions/${session.id}/render`,
          events: `/api/edit-sessions/${session.id}/events`
        }
      };
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.post("/api/edit-sessions/:id/upload-complete", async (req, reply) => {
    try {
      const params = req.params as {id: string};
      const session = await manager.completeUpload(params.id, req.body);
      reply.code(202);
      return session;
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.post("/api/edit-sessions/:id/preview/start", async (req, reply) => {
    try {
      const params = req.params as {id: string};
      const session = await manager.startPreview(params.id, req.body);
      reply.code(202);
      return session;
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/edit-sessions/:id/preview", async (req, reply) => {
    try {
      const params = req.params as {id: string};
      return await manager.getPreview(params.id);
    } catch (error) {
      reply.code(404);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/edit-sessions/:id/preview-manifest", async (req, reply) => {
    try {
      const params = req.params as {id: string};
      return await manager.getPreviewManifest(params.id, {
        fontBaseUrl: resolveRequestOrigin(req)
      });
    } catch (error) {
      reply.code(404);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/edit-sessions/:id/joseph-manifest", async (req, reply) => {
    try {
      const params = req.params as {id: string};
      const session = await manager.getSession(params.id);
      const manifestPath = typeof session.metadata.josephManifestPath === "string"
        ? session.metadata.josephManifestPath.trim()
        : "";
      if (!manifestPath) {
        throw new Error("Joseph manifest is not ready for this session.");
      }

      const manifest = UnifiedRenderManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
      const sourceRoute = `/api/edit-sessions/${params.id}/source`;
      const requestOrigin = resolveRequestOrigin(req);
      const browserSourceUrl = requestOrigin ? `${requestOrigin}${sourceRoute}` : sourceRoute;
      const previewManifest = UnifiedRenderManifestSchema.parse({
        ...manifest,
        videoTracks: manifest.videoTracks.map((track, index) => index === 0
          ? {...track, sourcePath: browserSourceUrl}
          : track),
        source: {
          ...manifest.source,
          videoUrl: browserSourceUrl,
          audioUrl: browserSourceUrl,
        },
      });

      reply.header("Cache-Control", "no-store");
      return previewManifest;
    } catch (error) {
      reply.code(404);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/edit-sessions/:id/joseph-render-job", async (req, reply) => {
    try {
      const params = req.params as {id: string};
      const session = await manager.getSession(params.id);
      const renderJobId = typeof session.metadata.josephRenderJobId === "string"
        ? session.metadata.josephRenderJobId.trim()
        : "";
      if (!renderJobId) {
        throw new Error("Joseph render job is not ready for this session.");
      }
      return reply.redirect(`/api/v1/render/jobs/${encodeURIComponent(renderJobId)}`);
    } catch (error) {
      reply.code(404);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/edit-sessions/:id/preview-artifact", async (req, reply) => {
    try {
      const params = req.params as {id: string};
      const asset = await manager.getPreviewArtifact(params.id);
      reply.header("Content-Type", asset.contentType);
      reply.header("Cache-Control", "no-store");
      return reply.send(createReadStream(asset.filePath));
    } catch (error) {
      reply.code(404);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/edit-sessions/:id/status", async (req, reply) => {
    try {
      const params = req.params as {id: string};
      return await manager.getSession(params.id);
    } catch (error) {
      reply.code(404);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.post("/api/edit-sessions/:id/render", async (req, reply) => {
    try {
      const params = req.params as {id: string};
      const session = await manager.startRender(params.id, req.body);
      reply.code(202);
      return session;
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/edit-sessions/:id/render-status", async (req, reply) => {
    try {
      const params = req.params as {id: string};
      return await manager.getRenderStatus(params.id);
    } catch (error) {
      reply.code(404);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/edit-sessions/:id/events", async (req: FastifyRequest, reply) => {
    const params = req.params as {id: string};
    try {
      await manager.getSession(params.id);
    } catch {
      reply.code(404);
      return {
        error: "Session not found."
      };
    }

    const corsOrigin = resolveSseAccessControlOrigin(
      typeof req.headers.origin === "string" ? req.headers.origin : null
    );

    reply.hijack();
    const headers: Record<string, string> = {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    };

    if (corsOrigin) {
      headers["access-control-allow-origin"] = corsOrigin;
      headers["access-control-allow-credentials"] = "true";
      headers.vary = "Origin";
    }

    reply.raw.writeHead(200, headers);
    reply.raw.write("\n");

    const unsubscribe = manager.subscribe(params.id, (event) => {
      writeSseEvent(reply, event);
    });

    const heartbeat = setInterval(() => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(": heartbeat\n\n");
      }
    }, 15000);

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      try {
        reply.raw.end();
      } catch {
        // Ignore transport cleanup failures.
      }
    });
  });
};
