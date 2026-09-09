import http from "node:http";
import { URL } from "node:url";
import { handleMcpMessage } from "./mcp-protocol.js";
import { generateOpenApiSpec } from "./openapi-spec.js";
import { resolveAuthScope, sanitizeDto, SecurityViolationError } from "./security.js";
import { REGISTERED_TOOLS } from "./tools.js";
import type { McpJsonRpcRequest } from "./types.js";

const PORT = Number(process.env.PORT || process.env.GATEWAY_PORT || 3100);

export function createGatewayServer() {
  const server = http.createServer(async (req, res) => {
    // Enable CORS for web clients, ChatGPT actions, and Claude
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;

    // 1. Healthcheck for Cloud Deployments (Railway, Render, Fly.io, etc.)
    if (pathname === "/healthz" || pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy", service: "prometheus-vincere-gateway" }));
      return;
    }

    // 2. OpenAPI 3.1.0 Specification for ChatGPT Custom GPT Actions
    if (pathname === "/openapi.json") {
      const hostUrl = `${parsedUrl.protocol}//${req.headers.host}`;
      const spec = generateOpenApiSpec(hostUrl);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(spec, null, 2));
      return;
    }

    // 3. Model Context Protocol (MCP) Endpoint over HTTP & SSE (for Claude / Remote MCP)
    if (pathname === "/mcp") {
      // SSE transport handshake for Claude
      if (req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive"
        });
        res.write(`event: endpoint\ndata: ${pathname}\n\n`);
        return;
      }

      // JSON-RPC 2.0 message handler for MCP
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const authCtx = resolveAuthScope(req.headers.authorization);
            const rpcRequest = JSON.parse(body) as McpJsonRpcRequest;
            const rpcResponse = await handleMcpMessage(rpcRequest, authCtx);

            if (!rpcResponse) {
              // Notification acknowledgement
              res.writeHead(204);
              res.end();
              return;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(rpcResponse));
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Internal error";
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message }
            }));
          }
        });
        return;
      }
    }

    // 4. REST Action Endpoints for ChatGPT Custom GPT Actions (/api/v1/actions/:toolName)
    if (pathname.startsWith("/api/v1/actions/")) {
      const toolName = pathname.replace("/api/v1/actions/", "");
      const tool = REGISTERED_TOOLS.find((t) => t.name === toolName);

      if (!tool) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Action '${toolName}' does not exist.` }));
        return;
      }

      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed. Use POST." }));
        return;
      }

      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const authCtx = resolveAuthScope(req.headers.authorization);
          const parsedBody = body ? JSON.parse(body) : {};

          // Execute atomic tool
          const rawResult = await tool.execute(parsedBody, authCtx);
          const safeResult = sanitizeDto(rawResult);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(safeResult));
        } catch (err: unknown) {
          const isSecurity = err instanceof SecurityViolationError;
          const status = isSecurity ? 403 : 400;
          const message = err instanceof Error ? err.message : String(err);

          res.writeHead(status, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            error: message,
            type: isSecurity ? "SECURITY_VIOLATION" : "VALIDATION_ERROR"
          }));
        }
      });
      return;
    }

    // 5. Root Live Inspector Dashboard (Prompt vs Output & Security Sandbox)
    if (pathname === "/" || pathname === "/dashboard") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderDashboardHtml());
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route not found" }));
  });

  return server;
}

function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prometheus Vincere Gateway | MCP & ChatGPT Bridge</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #131b2e;
      --border: #22304d;
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.2);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success: #34d399;
      --danger: #f87171;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 32px 20px; min-height: 100vh; }
    .container { max-width: 1100px; margin: 0 auto; }
    header { margin-bottom: 28px; border-bottom: 1px solid var(--border); padding-bottom: 18px; }
    h1 { font-size: 24px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }
    .subtitle { color: var(--text-muted); font-size: 14px; margin-top: 6px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
    .card h2 { font-size: 16px; margin-bottom: 14px; color: var(--accent); display: flex; justify-content: space-between; align-items: center; }
    .badge { background: #1e293b; color: #38bdf8; font-size: 11px; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border); }
    .badge.success { color: var(--success); border-color: rgba(52, 211, 153, 0.3); }
    label { display: block; font-size: 13px; color: var(--text-muted); margin: 12px 0 6px; }
    select, input, textarea { width: 100%; background: #0b0f19; border: 1px solid var(--border); border-radius: 8px; color: #fff; padding: 10px; font-size: 13px; }
    textarea { height: 100px; resize: vertical; font-family: monospace; }
    button { margin-top: 16px; width: 100%; background: #0284c7; color: #fff; font-weight: 600; border: none; padding: 12px; border-radius: 8px; cursor: pointer; transition: 0.2s; }
    button:hover { background: #38bdf8; color: #000; }
    pre { background: #070a10; border: 1px solid var(--border); border-radius: 8px; padding: 14px; overflow-x: auto; font-size: 12px; color: #a5f3fc; max-height: 480px; }
    .status-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--success); margin-bottom: 12px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); }
    .checklist { font-size: 12px; color: var(--text-muted); line-height: 1.6; margin-top: 14px; }
    .checklist li { margin-bottom: 4px; }
    .checklist strong { color: var(--text); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>⚡ Prometheus Vincere AI Gateway</h1>
      <p class="subtitle">Cloud-callable MCP (Claude) and OpenAPI Actions (ChatGPT) Adapter with Strict 7-Point Security Isolation</p>
    </header>

    <div class="grid">
      <!-- Left Column: Interactive Test Console -->
      <div class="card">
        <h2>Interactive Client Tester <span class="badge success">Live</span></h2>
        <div class="status-pill"><span class="status-dot"></span> Endpoints Ready: /mcp (Claude) & /openapi.json (GPT)</div>
        
        <label for="toolSelect">Select Tool / Action</label>
        <select id="toolSelect" onchange="updateDefaultPayload()">
          <option value="create_editorial_render_job">create_editorial_render_job</option>
          <option value="get_render_job_status">get_render_job_status</option>
          <option value="search_audio_catalog">search_audio_catalog</option>
          <option value="plan_kinetic_captions">plan_kinetic_captions</option>
          <option value="get_asset_metadata">get_asset_metadata</option>
        </select>

        <label for="payloadInput">Input Payload (JSON Prompt Data)</label>
        <textarea id="payloadInput"></textarea>

        <label for="tokenInput">Bearer Authorization Token</label>
        <input type="text" id="tokenInput" value="Bearer pat_customer42_user99_securehash" />

        <button onclick="executeAction()">Execute Action Call</button>

        <div style="margin-top: 20px;">
          <h3 style="font-size: 13px; color: #cbd5e1; margin-bottom: 8px;">Security Guarantees Active:</h3>
          <ul class="checklist">
            <li>✔ <strong>Anti-IDOR:</strong> Tenant scope derived strictly from Bearer token</li>
            <li>✔ <strong>Eager Serializer Defense:</strong> Stripping DB IDs, internal hashes & cloud keys</li>
            <li>✔ <strong>Sandbox Shield:</strong> Path traversal characters automatically rejected</li>
            <li>✔ <strong>Secret Preservation:</strong> Docstrings stripped of mathematical weights</li>
          </ul>
        </div>
      </div>

      <!-- Right Column: Live Output & Inspector -->
      <div class="card">
        <h2>Prompt Output & Clean DTO Inspector <span class="badge" id="latencyBadge">Idle</span></h2>
        <pre id="outputPre">// Click "Execute Action Call" to test the tool output and verify DTO whitelisting.</pre>

        <div style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
          <h3 style="font-size: 13px; color: #cbd5e1; margin-bottom: 8px;">Integration URLs:</h3>
          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">
            <strong>Claude Desktop / Remote MCP:</strong> <code>/mcp</code>
          </p>
          <p style="font-size: 12px; color: var(--text-muted);">
            <strong>ChatGPT Custom GPT Schema:</strong> <a href="/openapi.json" target="_blank" style="color: var(--accent);">/openapi.json</a>
          </p>
        </div>
      </div>
    </div>
  </div>

  <script>
    const samplePayloads = {
      create_editorial_render_job: {
        scriptText: "The secret to relentless momentum is eliminating trivial decisions before breakfast.",
        aspectRatio: "9:16",
        stylePreset: "cinematic",
        title: "Morning Momentum Short"
      },
      get_render_job_status: {
        jobId: "job_sample_12345"
      },
      search_audio_catalog: {
        query: "cinematic tension",
        limit: 3
      },
      plan_kinetic_captions: {
        scriptText: "Unstoppable progress requires extreme focus and consistent execution every single day.",
        wordsPerChunk: 3
      },
      get_asset_metadata: {
        relativeAssetPath: "broll/talking_head_01.mp4"
      }
    };

    function updateDefaultPayload() {
      const tool = document.getElementById("toolSelect").value;
      document.getElementById("payloadInput").value = JSON.stringify(samplePayloads[tool] || {}, null, 2);
    }

    updateDefaultPayload();

    async function executeAction() {
      const tool = document.getElementById("toolSelect").value;
      const payloadStr = document.getElementById("payloadInput").value;
      const token = document.getElementById("tokenInput").value;
      const outputPre = document.getElementById("outputPre");
      const badge = document.getElementById("latencyBadge");

      outputPre.textContent = "Executing request...";
      badge.textContent = "Calling...";
      badge.className = "badge";

      const startTime = performance.now();
      try {
        const payload = JSON.parse(payloadStr);
        const res = await fetch('/api/v1/actions/' + tool, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token
          },
          body: JSON.stringify(payload)
        });
        const duration = Math.round(performance.now() - startTime);
        const data = await res.json();

        badge.textContent = duration + 'ms (' + res.status + ')';
        badge.className = res.ok ? "badge success" : "badge";
        outputPre.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        badge.textContent = "Error";
        outputPre.textContent = "Error executing request: " + e.message;
      }
    }
  </script>
</body>
</html>`;
}

if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  const server = createGatewayServer();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Prometheus Gateway] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[Prometheus Gateway] MCP (Claude) Endpoint: http://localhost:${PORT}/mcp`);
    console.log(`[Prometheus Gateway] ChatGPT OpenAPI Spec: http://localhost:${PORT}/openapi.json`);
    console.log(`[Prometheus Gateway] Live Inspector Dashboard: http://localhost:${PORT}/`);
  });
}
