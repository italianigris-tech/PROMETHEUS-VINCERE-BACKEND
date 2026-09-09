import type {
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  AuthContext
} from "./types.js";
import { REGISTERED_TOOLS } from "./tools.js";
import { sanitizeDto, SecurityViolationError } from "./security.js";

const PROTOCOL_VERSION = "2024-11-05";

export async function handleMcpMessage(
  request: McpJsonRpcRequest,
  ctx: AuthContext
): Promise<McpJsonRpcResponse | null> {
  const { jsonrpc, id = null, method, params } = request;

  if (jsonrpc !== "2.0") {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "Invalid Request: 'jsonrpc' must be '2.0'" }
    };
  }

  // Handle Notifications (do not send response)
  if (method === "notifications/initialized") {
    return null;
  }

  // 1. Initialize Handshake
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        serverInfo: {
          name: "prometheus-vincere-gateway",
          version: "1.0.0"
        }
      }
    };
  }

  // 2. Liveness Ping
  if (method === "ping") {
    return {
      jsonrpc: "2.0",
      id,
      result: {}
    };
  }

  // 3. Tools Discovery (tools/list)
  if (method === "tools/list") {
    const toolManifest = REGISTERED_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: toolManifest
      }
    };
  }

  // 4. Tool Execution (tools/call)
  if (method === "tools/call") {
    const toolName = params?.name as string | undefined;
    const args = (params?.arguments as Record<string, unknown>) ?? {};

    if (!toolName) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "Missing required parameter 'name'." }
      };
    }

    const tool = REGISTERED_TOOLS.find((t) => t.name === toolName);
    if (!tool) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Tool '${toolName}' not found.` }
      };
    }

    try {
      // Execute with bound security/auth context
      const rawResult = await tool.execute(args, ctx);
      const safeResult = sanitizeDto(rawResult);

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(safeResult, null, 2)
            }
          ],
          isError: false
        }
      };
    } catch (err: unknown) {
      const isSecurity = err instanceof SecurityViolationError;
      const message = err instanceof Error ? err.message : String(err);

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: message,
                classification: isSecurity ? "SECURITY_VIOLATION" : "EXECUTION_ERROR"
              })
            }
          ],
          isError: true
        }
      };
    }
  }

  // Unknown method
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Method '${method}' is not implemented.`
    }
  };
}
