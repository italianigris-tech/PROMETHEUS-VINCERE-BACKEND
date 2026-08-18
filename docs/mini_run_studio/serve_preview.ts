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

const animPreviewDir = path.resolve(repoRoot, "Yuan Prometheus Screenshots/prometheus_animations_preview");
const screenshotsDir = path.resolve(repoRoot, "Yuan Prometheus Screenshots");

/**
 * Resolve requested URL to disk file path across studioDir, animPreviewDir, screenshotsDir, and repoRoot.
 */
function resolveFilePath(reqUrl: string): { filePath: string; contentType: string } | null {
  let cleanPath = reqUrl.split("?")[0].split("#")[0];
  if (cleanPath === "/" || cleanPath === "") {
    cleanPath = "/typography_treatment_presentation.html";
  }

  // Explicit shortcuts for typography animation preview
  if (cleanPath === "/typography" || cleanPath === "/typography.html" || cleanPath === "/animations" || cleanPath === "/presets") {
    const typoHtml = path.join(animPreviewDir, "typography.html");
    if (fs.existsSync(typoHtml)) {
      return { filePath: typoHtml, contentType: MIME_TYPES[".html"] };
    }
  }

  if (cleanPath === "/dashboard" || cleanPath === "/overview" || cleanPath === "/anim-index" || cleanPath === "/anim-index.html") {
    const indexHtml = path.join(animPreviewDir, "index.html");
    if (fs.existsSync(indexHtml)) {
      return { filePath: indexHtml, contentType: MIME_TYPES[".html"] };
    }
  }

  const normalized = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, "");
  
  // 1. Try in studioDir first
  const studioCandidate = path.join(studioDir, normalized);
  if (fs.existsSync(studioCandidate) && fs.statSync(studioCandidate).isFile()) {
    const ext = path.extname(studioCandidate).toLowerCase();
    return {
      filePath: studioCandidate,
      contentType: MIME_TYPES[ext] || "application/octet-stream",
    };
  }

  // 2. Try in animPreviewDir
  const animCandidate = path.join(animPreviewDir, normalized);
  if (fs.existsSync(animCandidate) && fs.statSync(animCandidate).isFile()) {
    const ext = path.extname(animCandidate).toLowerCase();
    return {
      filePath: animCandidate,
      contentType: MIME_TYPES[ext] || "application/octet-stream",
    };
  }

  // 3. Try in screenshotsDir
  const screenshotsCandidate = path.join(screenshotsDir, normalized);
  if (fs.existsSync(screenshotsCandidate) && fs.statSync(screenshotsCandidate).isFile()) {
    const ext = path.extname(screenshotsCandidate).toLowerCase();
    return {
      filePath: screenshotsCandidate,
      contentType: MIME_TYPES[ext] || "application/octet-stream",
    };
  }

  // 4. Try in repoRoot
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

  // Serve Interactive Clipboard Paste & Upload Page
  if ((req.method === "GET" || req.method === "HEAD") && (req.url === "/paste" || req.url === "/upload" || req.url === "/paste/")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Paste Screenshot Dropzone</title>
  <style>
    * { box-sizing: border-box; }
    body {
      background: #070913;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    .card {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 32px 24px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    }
    .dropzone {
      border: 3px dashed #00F0FF;
      border-radius: 14px;
      padding: 36px 20px;
      margin-top: 20px;
      background: rgba(7, 9, 19, 0.6);
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 0 25px rgba(0, 240, 255, 0.15);
    }
    .dropzone:hover, .dropzone.dragover {
      border-color: #FFE600;
      background: rgba(7, 9, 19, 0.9);
      box-shadow: 0 0 35px rgba(255, 230, 0, 0.35);
      transform: scale(1.01);
    }
    #previewImg {
      max-width: 100%;
      max-height: 380px;
      border-radius: 10px;
      margin-top: 20px;
      display: none;
      border: 2px solid #00F0FF;
      box-shadow: 0 8px 30px rgba(0, 240, 255, 0.3);
    }
    .status {
      margin-top: 18px;
      font-size: 15px;
      font-weight: 700;
    }
    .nav-link {
      display: inline-block;
      margin-top: 24px;
      color: #94A3B8;
      text-decoration: none;
      font-size: 14px;
      transition: color 0.2s;
    }
    .nav-link:hover { color: #00F0FF; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="color: #00F0FF; margin: 0 0 8px 0; font-size: 24px;">📋 Paste Clipboard Screenshot</h2>
    <p style="color: #94A3B8; font-size: 14px; margin: 0 0 16px 0; line-height: 1.5;">
      Press <b style="color: #FFE600;">Ctrl+V</b> (or <b style="color: #FFE600;">Cmd+V</b> on Mac / Long-Press Paste on phone) anywhere on this page, or tap below to upload.
    </p>

    <div class="dropzone" id="dropzone">
      <div style="font-size: 48px; margin-bottom: 10px;">📸</div>
      <div style="font-size: 18px; font-weight: 700; color: #FFF;">Tap to Upload or Press Ctrl+V</div>
      <div style="color: #64748B; font-size: 13px; margin-top: 6px;">Supports PNG, JPG, WebP, Mobile Screenshots</div>
      <input type="file" id="fileInput" accept="image/*" style="display: none;">
    </div>

    <img id="previewImg" alt="Pasted Screenshot Preview">
    <div id="status" class="status"></div>

    <a href="/typography_treatment_presentation.html" class="nav-link">← Back to Presentation Studio</a>
  </div>

  <script>
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const previewImg = document.getElementById('previewImg');
    const status = document.getElementById('status');

    dropzone.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    };

    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          handleFile(file);
          break;
        }
      }
    });

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    function handleFile(file) {
      status.innerText = '⏳ Uploading screenshot...';
      status.style.color = '#FFE600';
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        previewImg.src = dataUrl;
        previewImg.style.display = 'block';

        try {
          const res = await fetch('/api/upload_screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl })
          });
          const data = await res.json();
          if (data.success) {
            status.innerText = '✅ Screenshot received! Tell the assistant in chat to look at it.';
            status.style.color = '#38EF7D';
          } else {
            status.innerText = '❌ Upload failed: ' + (data.error || 'Unknown error');
            status.style.color = '#FF3366';
          }
        } catch (err) {
          status.innerText = '❌ Error uploading: ' + err.message;
          status.style.color = '#FF3366';
        }
      };
      reader.readAsDataURL(file);
    }
  </script>
</body>
</html>`);
    return;
  }

  // Handle Mobile/Clipboard Screenshot Upload API
  if (req.method === "POST" && req.url === "/api/upload_screenshot") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const json = JSON.parse(body);
        if (json.dataUrl) {
          const base64Data = json.dataUrl.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          const targetPath = path.join(studioDir, "user_clipboard_screenshot.png");
          fs.writeFileSync(targetPath, buffer);
          console.log("\n📸 [CLIPBOARD_SCREENSHOT_RECEIVED] Successfully saved to:", targetPath);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, savedPath: targetPath }));
          return;
        }
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing dataUrl" }));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
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
