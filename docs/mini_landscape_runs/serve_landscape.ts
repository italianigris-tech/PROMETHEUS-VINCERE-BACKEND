import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { saveAndProcessImage } from "./cli_image_uploader.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const studioDir = __dirname;
const repoRoot = path.resolve(studioDir, "../..");
const outDir = path.join(studioDir, "out");
const uploadDir = path.join(studioDir, "uploaded_assets");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
};

export function createServerInstance(port: number = 8085): http.Server {
  const server = http.createServer(async (req, res) => {
    // CORS headers for isolated studio communication
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;

    // Health / root route: serve landscape presentation
    if ((req.method === "GET" || req.method === "HEAD") && (pathname === "/" || pathname === "/landscape" || pathname === "/landscape_treatment_presentation.html")) {
      const templatePath = path.join(studioDir, "landscape_treatment_presentation.html");
      let htmlPath = templatePath;

      // Prefer the newest built presentation if present
      if (pathname !== "/landscape_treatment_presentation.html" && fs.existsSync(outDir)) {
        const built = fs.readdirSync(outDir)
          .filter((f) => /^landscape_presentation_.*\.html$/i.test(f))
          .map((f) => path.join(outDir, f))
          .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        if (built.length) htmlPath = built[0];
      }

      if (fs.existsSync(htmlPath)) {
        const stat = fs.statSync(htmlPath);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache",
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(htmlPath).pipe(res);
        return;
      }
    }

    // Specific landscape run by ID: /landscape_p/:id or /p/:id
    const runMatch = pathname.match(/^\/(?:landscape_p|p)\/([A-Za-z0-9_-]+)\/?$/);
    if ((req.method === "GET" || req.method === "HEAD") && runMatch) {
      const runId = decodeURIComponent(runMatch[1]);
      const p = path.join(outDir, `landscape_presentation_${runId}.html`);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        const stat = fs.statSync(p);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache",
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(p).pipe(res);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Run presentation not found");
      return;
    }

    // Landscape media: /media/:name or /landscape_media/:name
    const mediaMatch = pathname.match(/^\/(?:media|landscape_media)\/([^/]+)$/);
    if ((req.method === "GET" || req.method === "HEAD") && mediaMatch) {
      const name = path.basename(decodeURIComponent(mediaMatch[1]));
      const fullPath = path.join(outDir, name);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        const stat = fs.statSync(fullPath);
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "video/mp4",
          "Content-Length": stat.size,
          "Cache-Control": "public, max-age=3600",
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Media not found");
      return;
    }

    // Uploaded assets: /uploaded_assets/:name
    const assetMatch = pathname.match(/^\/uploaded_assets\/([^/]+)$/);
    if ((req.method === "GET" || req.method === "HEAD") && assetMatch) {
      const name = path.basename(decodeURIComponent(assetMatch[1]));
      const fullPath = path.join(uploadDir, name);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        const stat = fs.statSync(fullPath);
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "image/png",
          "Content-Length": stat.size,
          "Cache-Control": "public, max-age=3600",
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Asset not found");
      return;
    }

    // API: Current Manifest
    if ((req.method === "GET" || req.method === "HEAD") && pathname === "/api/manifest") {
      const manifestPath = path.join(outDir, "landscape_treatment_manifest.json");
      if (fs.existsSync(manifestPath)) {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(manifestPath).pipe(res);
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No manifest generated yet" }));
      return;
    }

    // API: List runs
    if ((req.method === "GET" || req.method === "HEAD") && pathname === "/api/runs") {
      const runs = fs.existsSync(outDir)
        ? fs.readdirSync(outDir)
            .filter((f) => /^landscape_presentation_.*\.html$/i.test(f))
            .map((f) => {
              const runId = f.replace(/^landscape_presentation_|\.html$/g, "");
              const stat = fs.statSync(path.join(outDir, f));
              return { runId, file: f, mtime: stat.mtime };
            })
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
        : [];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ runs }));
      return;
    }

    // API: Dedicated Upload for Landscape Assets
    if (req.method === "POST" && (pathname === "/upload" || pathname === "/api/upload")) {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const body = Buffer.concat(chunks);
          let imageBuffer: Buffer;
          let filenameHint = parsedUrl.searchParams.get("filename") || "uploaded_image.png";

          const contentType = req.headers["content-type"] || "";
          if (contentType.includes("application/json")) {
            const parsed = JSON.parse(body.toString("utf8"));
            if (parsed.data) {
              const base64Data = parsed.data.replace(/^data:image\/\w+;base64,/, "");
              imageBuffer = Buffer.from(base64Data, "base64");
            } else {
              throw new Error("Missing 'data' field with base64 content in request body");
            }
            if (parsed.filename) filenameHint = parsed.filename;
          } else {
            imageBuffer = body;
          }

          const processed = await saveAndProcessImage(imageBuffer, filenameHint);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            status: "success",
            filename: processed.filename,
            path: processed.primaryPath,
            url: `/uploaded_assets/${processed.filename}`,
            blueprint: processed.blueprint,
          }));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "error", message: err.message }));
        }
      });
      return;
    }

    // Health check
    if (pathname === "/health" || pathname === "/upload") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", studio: "mini_landscape_runs" }));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`🌄 [LANDSCAPE_STUDIO] Isolated landscape server listening at http://127.0.0.1:${port}`);
  });

  return server;
}

if (process.argv[1] && (process.argv[1].endsWith("serve_landscape.ts") || process.argv[1].endsWith("serve_landscape.js"))) {
  const port = parseInt(process.env.LANDSCAPE_PORT || "8085", 10);
  createServerInstance(port);
}
