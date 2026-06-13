import type {FastifyInstance, FastifyReply} from "fastify";
import websocketPlugin from "@fastify/websocket";
import type {WebSocket} from "ws";

import type {ProgressiveVideoContextEvent} from "./contracts";
import type {VideoContextService} from "./service";

const formatSseEvent = (event: ProgressiveVideoContextEvent): string => [
  `id: ${event.id}`,
  `event: ${event.type}`,
  `data: ${JSON.stringify(event)}`,
  ""
].join("\n");

const sendMarkdown = (reply: FastifyReply, contents: string): string => {
  reply.header("content-type", "text/markdown; charset=utf-8");
  return contents;
};

const registerWebSocket = async (
  app: FastifyInstance,
  service: VideoContextService
): Promise<void> => {
  await app.register(websocketPlugin);
  app.get<{Params: {videoId: string}}>("/api/videos/:videoId/chat", {websocket: true}, (socket, req) => {
    socket.on("message", (raw: WebSocket.RawData) => {
      void (async () => {
        try {
          const payload = JSON.parse(raw.toString()) as unknown;
          const response = await service.handleFrontendMessage(req.params.videoId, payload);
          socket.send(JSON.stringify(response));
        } catch (error) {
          socket.send(JSON.stringify({
            type: "chat_response",
            messageId: `error_${Date.now()}`,
            content: error instanceof Error ? error.message : String(error),
            contextUsed: []
          }));
        }
      })();
    });
  });
};

export const registerVideoContextRoutes = async (
  app: FastifyInstance,
  service: VideoContextService
): Promise<void> => {
  app.post("/api/videos", async (req, reply) => {
    try {
      const result = await service.createVideo(req);
      reply.code(202);
      return result;
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/videos/:videoId", async (req, reply) => {
    try {
      const params = req.params as {videoId: string};
      return await service.getStatus(params.videoId);
    } catch {
      reply.code(404);
      return {
        error: "Video context not found."
      };
    }
  });

  app.get("/api/videos/:videoId/context", async (req, reply) => {
    try {
      const params = req.params as {videoId: string};
      const {sourcePath: _sourcePath, ...snapshot} = await service.getSnapshot(params.videoId);
      return snapshot;
    } catch {
      reply.code(404);
      return {
        error: "Video context not found."
      };
    }
  });

  app.get("/api/videos/:videoId/progress", async (req, reply) => {
    const params = req.params as {videoId: string};
    const query = req.query as {replay?: string};
    const lastEventId = typeof req.headers["last-event-id"] === "string"
      ? req.headers["last-event-id"]
      : undefined;
    try {
      await service.getSnapshot(params.videoId);
    } catch {
      reply.code(404);
      return {
        error: "Video context not found."
      };
    }

    const headers = {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    };
    const replayEvents = await service.replayEvents(params.videoId, lastEventId);

    if (query.replay === "once") {
      reply.headers(headers);
      return replayEvents.map(formatSseEvent).join("\n");
    }

    reply.hijack();
    reply.raw.writeHead(200, headers);
    reply.raw.write("\n");
    for (const event of replayEvents) {
      reply.raw.write(`${formatSseEvent(event)}\n`);
    }

    const unsubscribe = service.subscribe(params.videoId, (event) => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`${formatSseEvent(event)}\n`);
      }
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

  app.get("/api/videos/:videoId/render-graph", async (req, reply) => {
    try {
      const params = req.params as {videoId: string};
      return await service.getRenderGraph(params.videoId);
    } catch {
      reply.code(404);
      return {error: "RenderGraph handoff not found."};
    }
  });

  app.get("/api/videos/:videoId/instructional-manual", async (req, reply) => {
    try {
      const params = req.params as {videoId: string};
      return sendMarkdown(reply, await service.getInstructionalManual(params.videoId));
    } catch {
      reply.code(404);
      return {error: "Instructional manual not found."};
    }
  });

  app.get("/api/videos/:videoId/configuration-delta", async (req, reply) => {
    try {
      const params = req.params as {videoId: string};
      return await service.getConfigurationDelta(params.videoId);
    } catch {
      reply.code(404);
      return {error: "Configuration delta not found."};
    }
  });

  app.get("/api/videos/:videoId/frontend-briefing", async (req, reply) => {
    try {
      const params = req.params as {videoId: string};
      return sendMarkdown(reply, await service.getFrontendBriefing(params.videoId));
    } catch {
      reply.code(404);
      return {error: "Frontend briefing not found."};
    }
  });

  app.get("/api/videos/:videoId/audio", async (req, reply) => {
    try {
      const params = req.params as {videoId: string};
      const audio = await service.getReleasedAudio(params.videoId);
      reply.header("content-type", audio.contentType);
      reply.header("content-length", audio.sizeBytes);
      reply.header("content-disposition", `inline; filename="${audio.fileName.replace(/"/g, "")}"`);
      return audio.stream;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(message.toLowerCase().includes("gated") || message.toLowerCase().includes("not released") ? 423 : 404);
      return {error: message};
    }
  });

  app.post("/api/videos/:videoId/frontend-ready", async (req, reply) => {
    try {
      const params = req.params as {videoId: string};
      return await service.markFrontendReady(params.videoId, req.body);
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  await registerWebSocket(app, service);
};
