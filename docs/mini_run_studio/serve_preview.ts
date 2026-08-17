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

  startAllTunnels(PORT);
});

/**
 * Start all tunnel options (Fixed Subdomain Localtunnel, Cloudflare Tunnel, and Direct EC2 IP).
 */
async function startAllTunnels(port: number) {
  let publicIp = "16.192.95.115";
  try {
    const res = await fetch("http://checkip.amazonaws.com", { signal: AbortSignal.timeout(3000) });
    if (res.ok) publicIp = (await res.text()).trim();
  } catch {}

  const fixedSubdomain = process.env.TUNNEL_SUBDOMAIN || "prometheus-kinetic-studio";
  const permanentLocaltunnelUrl = `https://${fixedSubdomain}.loca.lt/typography_treatment_presentation.html`;
  const directEc2Url = `http://${publicIp}:${port}/typography_treatment_presentation.html`;

  console.log("\n================================================================================");
  console.log("  🌐 PERMANENT ACCESS URLS FOR MOBILE & DESKTOP");
  console.log("================================================================================");
  console.log(`  1. Permanent Fixed Subdomain: \x1b[32m\x1b[1m${permanentLocaltunnelUrl}\x1b[0m`);
  console.log(`     (Fixed URL that never changes! On first prompt, endpoint IP is: \x1b[33m${publicIp}\x1b[0m)`);
  console.log(`  2. Direct EC2 Permanent IP:    \x1b[36m\x1b[1m${directEc2Url}\x1b[0m`);
  console.log(`     (Requires AWS Security Group Inbound Port ${port} open to 0.0.0.0/0)`);
  console.log("--------------------------------------------------------------------------------");
  console.log("  Establishing Cloudflare Zero-Config HTTPS Tunnel...");

  // 1. Launch Fixed Subdomain Localtunnel
  const ltProcess = spawn("npx", ["-y", "localtunnel", "--port", `${port}`, "--subdomain", fixedSubdomain], {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  ltProcess.stdout?.on("data", () => {});
  ltProcess.stderr?.on("data", () => {});

  // 2. Launch Cloudflare Tunnel
  const cfProcess = spawn("npx", ["-y", "cloudflared", "tunnel", "--url", `http://127.0.0.1:${port}`], {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const onData = (data: Buffer) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/i);
    if (match) {
      const cfBase = match[0];
      const cfPresentation = `${cfBase}/typography_treatment_presentation.html`;
      console.log(`\n  ⚡ Cloudflare HTTPS: \x1b[35m\x1b[1m${cfPresentation}\x1b[0m`);
    }
  };
  cfProcess.stdout?.on("data", onData);
  cfProcess.stderr?.on("data", onData);

  // 3. Launch Pinggy Tunnel (Parallel High-Reliability HTTPS)
  const pinggyProcess = spawn("ssh", ["-o", "StrictHostKeyChecking=no", "-p", "443", "-R0:localhost:8080", "a.pinggy.io"], {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  pinggyProcess.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.free\.pinggy\.net/i) || text.match(/https:\/\/[a-zA-Z0-9-]+\.run\.pinggy-free\.link/i);
    if (match) {
      const pinggyUrl = `${match[0]}/typography_treatment_presentation.html`;
      console.log(`  🌐 Pinggy HTTPS:    \x1b[36m\x1b[1m${pinggyUrl}\x1b[0m\n`);
    }
  });
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
