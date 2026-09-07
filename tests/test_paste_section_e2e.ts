/**
 * Test Suite: Paste Section & Dropzone End-to-End Test
 */

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { createServerInstance } from "../docs/mini_run_studio/serve_preview";

const repoRoot = path.resolve(__dirname, "..");
const studioDir = path.join(repoRoot, "docs", "mini_run_studio");
const standaloneHtml = path.join(repoRoot, "paste.html");
const studioHtml = path.join(studioDir, "paste.html");

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`✅ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${msg}`);
    failed++;
  }
}

async function request(url: string, options: http.RequestOptions = {}, body?: Buffer | string): Promise<{ statusCode: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 0,
          body: Buffer.concat(chunks).toString("utf8"),
          headers: res.headers,
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runSuite() {
  console.log("===============================================================================");
  console.log("TEST SUITE: PROMETHEUS PASTE SECTION & DROPZONE VERIFICATION");
  console.log("===============================================================================\n");

  // 1. Verify Standalone Files Exist
  console.log("--- 1. Standalone HTML Artifacts Check ---");
  assert(fs.existsSync(standaloneHtml), "Root standalone paste.html exists");
  assert(fs.existsSync(studioHtml), "docs/mini_run_studio/paste.html exists");
  const htmlContent = fs.readFileSync(standaloneHtml, "utf8");
  assert(htmlContent.includes("btnPasteClipboard"), "paste.html contains clipboard paste trigger");
  assert(htmlContent.includes("offlineQueue") || htmlContent.includes("offlineScreenshots"), "paste.html contains offline memory queue fallback");
  assert(htmlContent.includes("probeBackend"), "paste.html contains dynamic backend health prober");

  // 2. Start Studio Server on test port 8089
  console.log("\n--- 2. Studio Server Lifecycle on Port 8089 ---");
  const testPort = 8089;
  const server = createServerInstance(testPort);

  // Wait a moment for server to listen
  await new Promise((r) => setTimeout(r, 400));
  const healthCheck = await request(`http://127.0.0.1:${testPort}/health`);
  assert(healthCheck.statusCode === 200, `Studio server booted and responded on http://127.0.0.1:${testPort}/health`);

  try {
    // 3. Test HTTP Routes
    console.log("\n--- 3. HTTP Endpoints & Dropzone Routes ---");
    const rPaste = await request(`http://127.0.0.1:${testPort}/paste`);
    assert(rPaste.statusCode === 200, "GET /paste returns HTTP 200");
    assert(rPaste.body.includes("dropzone"), "GET /paste returns dropzone HTML markup");

    const rDropzone = await request(`http://127.0.0.1:${testPort}/dropzone`);
    assert(rDropzone.statusCode === 200, "GET /dropzone alias returns HTTP 200");

    const rUpload = await request(`http://127.0.0.1:${testPort}/upload`);
    assert(rUpload.statusCode === 200, "GET /upload alias returns HTTP 200");

    const rPasteHtml = await request(`http://127.0.0.1:${testPort}/paste.html`);
    assert(rPasteHtml.statusCode === 200, "GET /paste.html alias returns HTTP 200");

    // 4. Test Image Upload API (/api/upload-paste)
    console.log("\n--- 4. Direct Upload API & Dual-Folder Ingestion ---");
    // 1x1 transparent PNG base64
    const samplePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const testFileName = `test_e2e_paste_${Date.now()}.png`;

    const uploadRes = await request(`http://127.0.0.1:${testPort}/api/upload-paste?filename=${testFileName}`, {
      method: "POST",
      headers: { "Content-Type": "image/png", "Content-Length": String(samplePng.length) },
    }, samplePng);

    assert(uploadRes.statusCode === 200, "POST /api/upload-paste returns HTTP 200");
    const uploadData = JSON.parse(uploadRes.body);
    assert(uploadData.status === "success", "Upload response status is 'success'");
    const savedName = uploadData.filename;

    const primarySavedPath = path.join(studioDir, "uploaded_screenshots", savedName);
    assert(fs.existsSync(primarySavedPath), "Uploaded screenshot saved in uploaded_screenshots/");

    // 5. Test Listing API (/api/list_uploaded_screenshots)
    console.log("\n--- 5. Screenshot Gallery Listing API ---");
    const listRes = await request(`http://127.0.0.1:${testPort}/api/list_uploaded_screenshots`);
    assert(listRes.statusCode === 200, "GET /api/list_uploaded_screenshots returns HTTP 200");
    const listData = JSON.parse(listRes.body);
    assert(listData.some((item: any) => item.name === savedName), "Uploaded image appears in /api/list_uploaded_screenshots");

    // 6. Test Delete API (/api/delete_screenshot)
    console.log("\n--- 6. Screenshot Delete API ---");
    const delRes = await request(`http://127.0.0.1:${testPort}/api/delete_screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, JSON.stringify({ filename: savedName }));

    assert(delRes.statusCode === 200, "POST /api/delete_screenshot returns HTTP 200");
    assert(!fs.existsSync(primarySavedPath), "Screenshot removed from disk after deletion");

  } finally {
    server.close();
  }

  console.log(`\n===============================================================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`===============================================================================\n`);

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runSuite().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
