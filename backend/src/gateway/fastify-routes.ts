import type { FastifyInstance } from "fastify";
import { handleMcpMessage } from "./mcp-protocol.js";
import { generateOpenApiSpec } from "./openapi-spec.js";
import { resolveAuthScope, sanitizeDto, SecurityViolationError } from "./security.js";
import { REGISTERED_TOOLS } from "./tools.js";
import type { McpJsonRpcRequest } from "./types.js";

/**
 * Fastify route registration for Modal and Core-App deployments.
 * Mounts MCP (Claude) and OpenAPI Actions (ChatGPT) directly into the main API server.
 */
export async function registerGatewayRoutes(app: FastifyInstance): Promise<void> {
  // 1. OpenAPI 3.1.0 Specification for ChatGPT Custom GPT Actions
  app.get("/openapi.json", async (request) => {
    const protocol = request.protocol || "https";
    const host = request.hostname || "localhost";
    return generateOpenApiSpec(`${protocol}://${host}`);
  });

  // 2. Model Context Protocol (MCP) Endpoint over HTTP & SSE (for Claude)
  app.get("/mcp", async (request, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    reply.raw.write("event: endpoint\ndata: /mcp\n\n");
    return reply;
  });

  app.post("/mcp", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      const authCtx = resolveAuthScope(authHeader);
      const rpcRequest = request.body as McpJsonRpcRequest;

      const rpcResponse = await handleMcpMessage(rpcRequest, authCtx);
      if (!rpcResponse) {
        reply.code(204);
        return;
      }

      return rpcResponse;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal error";
      reply.code(400);
      return {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message }
      };
    }
  });

  // 3. REST Action Endpoints for ChatGPT Custom GPT Actions (/api/v1/actions/:toolName)
  app.post<{ Params: { toolName: string } }>(
    "/api/v1/actions/:toolName",
    async (request, reply) => {
      const { toolName } = request.params;
      const tool = REGISTERED_TOOLS.find((t) => t.name === toolName);

      if (!tool) {
        reply.code(404);
        return { error: `Action '${toolName}' does not exist.` };
      }

      try {
        const authHeader = request.headers.authorization;
        const authCtx = resolveAuthScope(authHeader);
        const input = (request.body as Record<string, unknown>) || {};

        // Execute atomic tool
        const rawResult = await tool.execute(input, authCtx);
        return sanitizeDto(rawResult);
      } catch (err: unknown) {
        const isSecurity = err instanceof SecurityViolationError;
        reply.code(isSecurity ? 403 : 400);
        return {
          error: err instanceof Error ? err.message : String(err),
          type: isSecurity ? "SECURITY_VIOLATION" : "VALIDATION_ERROR"
        };
      }
    }
  );
}
