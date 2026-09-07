#!/usr/bin/env node
/**
 * Cross-platform script to open the Paste & Dropzone studio.
 * Starts the server if not already running, then launches the browser.
 */

import * as http from "node:http";
import * as path from "node:path";
import * as url from "node:url";
import { spawn, exec } from "node:child_process";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const studioDir = path.join(repoRoot, "docs", "mini_run_studio");
const serverScript = path.join(studioDir, "serve_preview.ts");
const standaloneHtml = path.join(repoRoot, "paste.html");
const port = Number(process.env.PORT) || 8080;
const targetUrl = `http://localhost:${port}/paste`;

function checkHealth(portNum) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${portNum}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function openBrowser(target) {
  console.log(`🌐 Launching: ${target}`);
  const startCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  exec(`${startCmd} "${target}"`);
}

async function main() {
  console.log("===============================================================================");
  console.log("  PROMETHEUS PASTE STUDIO LAUNCHER");
  console.log("===============================================================================\n");

  const isHealthy = await checkHealth(port);
  if (isHealthy) {
    console.log(`✅ Server is already running on ${targetUrl}`);
    openBrowser(targetUrl);
    return;
  }

  console.log(`⏳ Starting Prometheus Studio server on port ${port}...`);
  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npxCmd, ["tsx", serverScript], {
    cwd: repoRoot,
    detached: true,
    stdio: "ignore",
    shell: true,
  });
  child.unref();

  let ready = false;
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 400));
    if (await checkHealth(port)) {
      ready = true;
      break;
    }
  }

  if (ready) {
    console.log(`✅ Server is ready! Opening ${targetUrl}...`);
    openBrowser(targetUrl);
  } else {
    console.log(`⚠️ Server start timeout, opening standalone paste.html directly...`);
    openBrowser(standaloneHtml);
  }
}

main().catch((err) => {
  console.error("Launcher error:", err);
  openBrowser(standaloneHtml);
});
