#!/usr/bin/env node
import readline from "node:readline";
import { handleMcpMessage } from "./mcp-protocol.js";
import { resolveAuthScope } from "./security.js";
import type { McpJsonRpcRequest } from "./types.js";

/**
 * Prometheus Gateway Stdio Transport for Claude Desktop.
 * Run directly via CLI or configure in claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "prometheus": {
 *       "command": "npx",
 *       "args": ["tsx", "backend/src/gateway/mcp-stdio.ts"]
 *     }
 *   }
 * }
 */

async function startStdioServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  // Default desktop authenticated context
  const authCtx = resolveAuthScope(process.env.PROMETHEUS_AUTH_TOKEN);

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const request = JSON.parse(trimmed) as McpJsonRpcRequest;
      const response = await handleMcpMessage(request, authCtx);

      if (response) {
        process.stdout.write(JSON.stringify(response) + "\n");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[MCP Stdio Error] ${errorMsg}\n`);
    }
  });

  process.stderr.write("[Prometheus MCP] Stdio server initialized and listening for Claude messages.\n");
}

startStdioServer().catch((err) => {
  process.stderr.write(`[MCP Fatal] ${err}\n`);
  process.exit(1);
});
