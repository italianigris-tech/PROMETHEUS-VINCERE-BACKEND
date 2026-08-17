import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

const studioDir = __dirname;
const port = process.env.PORT || 8080;

console.log("=================================================");
console.log("🚀 STARTING PREVIEW SERVER & MOBILE TUNNEL LINKAGE");
console.log("=================================================");

if (!fs.existsSync(path.join(studioDir, "typography_treatment_presentation.html"))) {
  console.error("FAIL: typography_treatment_presentation.html missing! Run build script first.");
  process.exit(1);
}

// 1. Spawn Python HTTP Server
console.log(`[HTTP_SERVER] Serving ${studioDir} on port ${port}...`);
const httpPy = spawn("python3", ["-m", "http.server", String(port), "--directory", studioDir], {
  stdio: "inherit"
});

// 2. Spawn Cloudflare Tunnel for secure HTTPS access on phone
console.log("[TUNNEL] Requesting secure HTTPS URL for mobile browser access...");
const tunnel = spawn("npx", ["-y", "@cloudflare/cloudflared", "tunnel", "--url", `http://localhost:${port}`], {
  stdio: "inherit"
});

process.on("SIGINT", () => {
  httpPy.kill();
  tunnel.kill();
  process.exit(0);
});
