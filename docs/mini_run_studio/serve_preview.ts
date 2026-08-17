import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";

const studioDir = __dirname;
const repoRoot = path.resolve(studioDir, "../..");
const PORT = parseInt(process.env.PORT || "8080", 10);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".md": "text/markdown; charset=utf-8",
  ".ico": "image/x-icon",
};

/**
 * Resolve requested URL to disk file path across studioDir and repoRoot.
 */
function resolveFilePath(reqUrl: string): { filePath: string; contentType: string } | null {
  let cleanPath = reqUrl.split("?")[0].split("#")[0];
  if (cleanPath === "/" || cleanPath === "") {
    cleanPath = "/typography_treatment_presentation.html";
  }

  const normalized = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, "");
  
  // Try in studioDir first
  const studioCandidate = path.join(studioDir, normalized);
  if (fs.existsSync(studioCandidate) && fs.statSync(studioCandidate).isFile()) {
    const ext = path.extname(studioCandidate).toLowerCase();
    return {
      filePath: studioCandidate,
      contentType: MIME_TYPES[ext] || "application/octet-stream",
    };
  }

  // Try in repoRoot
  const repoCandidate = path.join(repoRoot, normalized);
  if (fs.existsSync(repoCandidate) && fs.statSync(repoCandidate).isFile()) {
    const ext = path.extname(repoCandidate).toLowerCase();
    return {
      filePath: repoCandidate,
      contentType: MIME_TYPES[ext] || "application/octet-stream",
    };
  }

  return null;
}

// 1. Create HTTP Server
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const resolved = resolveFilePath(req.url || "/");
  if (!resolved) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <html>
        <body style="font-family: sans-serif; background: #070913; color: #fff; padding: 40px; text-align: center;">
          <h2 style="color: #00F0FF;">404 — Not Found</h2>
          <p>Requested: <code>${req.url}</code></p>
          <p><a href="/typography_treatment_presentation.html" style="color: #FFD700;">Open Typography Treatment Presentation Studio</a></p>
        </body>
      </html>
    `);
    return;
  }

  try {
    const stream = fs.createReadStream(resolved.filePath);
    res.writeHead(200, {
      "Content-Type": resolved.contentType,
      "Cache-Control": "no-cache",
    });
    stream.pipe(res);
  } catch (err: any) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(`Internal Server Error: ${err.message}`);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("================================================================================");
  console.log(`  🚀 MINI-RUN STUDIO LOCAL HTTP SERVER LISTENING ON PORT ${PORT}`);
  console.log("================================================================================");
  console.log(`  Local URL:  http://localhost:${PORT}/typography_treatment_presentation.html`);
  console.log(`  Binding:    http://0.0.0.0:${PORT}`);
  console.log("================================================================================");
  console.log("  Opening Cloudflare HTTPS Mobile Tunnel...");

  startTunnel(PORT);
});

/**
 * Start Cloudflare Tunnel with fallback to localtunnel.
 */
function startTunnel(port: number) {
  let tunnelUrlFound = false;

  // Try Cloudflared
  const cfProcess = spawn("npx", ["-y", "cloudflared", "tunnel", "--url", `http://127.0.0.1:${port}`], {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const onData = (data: Buffer) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/i);
    if (match && !tunnelUrlFound) {
      tunnelUrlFound = true;
      const baseTunnelUrl = match[0];
      const presentationUrl = `${baseTunnelUrl}/typography_treatment_presentation.html`;

      printBanner(baseTunnelUrl, presentationUrl);
    }
  };

  cfProcess.stdout?.on("data", onData);
  cfProcess.stderr?.on("data", onData);

  cfProcess.on("error", (err) => {
    console.warn(`[TUNNEL_NOTICE] Cloudflared error: ${err.message}. Trying localtunnel fallback...`);
    if (!tunnelUrlFound) startLocaltunnel(port);
  });

  // Fallback timer if Cloudflare doesn't respond within 12 seconds
  setTimeout(() => {
    if (!tunnelUrlFound) {
      console.log("[TUNNEL_NOTICE] Cloudflare taking longer than usual, initiating localtunnel parallel probe...");
      startLocaltunnel(port);
    }
  }, 12000);
}

function startLocaltunnel(port: number) {
  const ltProcess = spawn("npx", ["-y", "localtunnel", "--port", `${port}`], {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  ltProcess.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.loca\.lt/i);
    if (match) {
      const baseTunnelUrl = match[0];
      const presentationUrl = `${baseTunnelUrl}/typography_treatment_presentation.html`;
      printBanner(baseTunnelUrl, presentationUrl, "Localtunnel");
    }
  });
}

function printBanner(baseTunnelUrl: string, presentationUrl: string, provider = "Cloudflare Tunnel") {
  console.log("\n================================================================================");
  console.log(`  📱 LIVE PHONE BROWSER LINK READY (${provider})`);
  console.log("================================================================================");
  console.log(`  Direct Studio Link: \x1b[36m\x1b[1m${presentationUrl}\x1b[0m`);
  console.log(`  Base Tunnel:        ${baseTunnelUrl}`);
  console.log("--------------------------------------------------------------------------------");
  console.log("  👉 Open the link above on your phone browser (iOS Safari, Chrome, Android)");
  console.log("  👉 Works seamlessly over 4G/5G/Wi-Fi without AWS Security Group modifications!");
  console.log("================================================================================\n");
}

process.on("SIGINT", () => {
  console.log("\nStopping server...");
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});
