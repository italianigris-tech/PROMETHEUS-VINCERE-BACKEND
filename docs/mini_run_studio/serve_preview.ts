import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";

const studioDir = __dirname;
const repoRoot = path.resolve(studioDir, "../..");

const uploadsDir = path.join(studioDir, "uploaded_screenshots");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const animPreviewDir = path.resolve(repoRoot, "Yuan Prometheus Screenshots/prometheus_animations_preview");
const screenshotsDir = path.resolve(repoRoot, "Yuan Prometheus Screenshots");
const fontPairingScreenshotsDir = path.resolve(repoRoot, "Yuan Prometheus Screenshots/font pairing and placement");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".md": "text/markdown; charset=utf-8",
  ".ico": "image/x-icon",
};

/**
 * Resolve requested URL to disk file path safely with URL decoding.
 */
function resolveFilePath(reqUrl: string): { filePath: string; contentType: string } | null {
  let cleanPath = reqUrl.split("?")[0].split("#")[0];
  try {
    cleanPath = decodeURIComponent(cleanPath);
  } catch {}

  if (cleanPath === "/" || cleanPath === "") {
    cleanPath = "/typography_treatment_presentation.html";
  }

  // Explicit route for uploaded screenshots
  if (cleanPath.startsWith("/uploaded_screenshots/")) {
    const rawName = cleanPath.replace(/^\/uploaded_screenshots\//, "");
    const safeName = path.basename(rawName);
    const target = path.join(uploadsDir, safeName);
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      const ext = path.extname(target).toLowerCase();
      return {
        filePath: target,
        contentType: MIME_TYPES[ext] || "image/png",
      };
    }
  }

  // Explicit route for font pairing corpus screenshots
  if (cleanPath.startsWith("/corpus_screenshots/")) {
    const rawName = cleanPath.replace(/^\/corpus_screenshots\//, "");
    const safeName = path.basename(rawName);
    const target = path.join(fontPairingScreenshotsDir, safeName);
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      const ext = path.extname(target).toLowerCase();
      return {
        filePath: target,
        contentType: MIME_TYPES[ext] || "image/png",
      };
    }
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
  
  // 1. Try in studioDir / uploadsDir first
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

const pasteHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Batch Screenshot Dropzone & Multi-Image Gallery</title>
  <style>
    :root {
      --bg-dark: #070913;
      --card-bg: rgba(15, 23, 42, 0.85);
      --accent-cyan: #00F0FF;
      --accent-yellow: #FFE600;
      --accent-purple: #8B5CF6;
      --accent-pink: #EC4899;
      --accent-green: #10B981;
      --text-muted: #94A3B8;
      --panel-border: rgba(255, 255, 255, 0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-dark);
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      line-height: 1.5;
    }
    .container {
      width: 100%;
      max-width: 1000px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .header-card {
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 20px;
      padding: 28px 24px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
      text-align: center;
      position: relative;
    }
    .header-card h1 {
      font-size: clamp(20px, 4vw, 26px);
      font-weight: 900;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
      letter-spacing: -0.02em;
    }
    .header-card p {
      color: var(--text-muted);
      font-size: 13.5px;
    }
    .dropzone {
      border: 3px dashed var(--accent-cyan);
      border-radius: 16px;
      padding: 36px 20px;
      margin-top: 18px;
      background: rgba(7, 9, 19, 0.6);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 0 30px rgba(0, 240, 255, 0.15);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .dropzone:hover, .dropzone.dragover {
      border-color: var(--accent-yellow);
      background: rgba(7, 9, 19, 0.95);
      box-shadow: 0 0 40px rgba(255, 230, 0, 0.35);
      transform: scale(1.01);
    }
    .dropzone-icon { font-size: 44px; margin-bottom: 8px; }
    .dropzone-title { font-size: 17px; font-weight: 800; color: #FFF; margin-bottom: 4px; }
    .dropzone-sub { color: #64748B; font-size: 12.5px; }

    .status-bar {
      margin-top: 14px;
      font-size: 14px;
      font-weight: 700;
      min-height: 24px;
    }

    /* GALLERY TABS */
    .gallery-card {
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    }
    .gallery-nav-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 18px;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 12px;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
    }
    .tab-group {
      display: flex;
      gap: 8px;
    }
    .tab-button {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      color: var(--text-muted);
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-button.active {
      background: var(--accent-cyan);
      color: #070913;
      border-color: var(--accent-cyan);
      box-shadow: 0 2px 10px rgba(0, 240, 255, 0.3);
    }

    .gallery-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-action {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--panel-border);
      color: #FFF;
      border-radius: 12px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-action:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: var(--accent-cyan);
    }
    .btn-danger { color: #FF3366; }
    .btn-danger:hover { background: rgba(255, 51, 102, 0.15); border-color: #FF3366; }

    /* IMAGE GRID */
    .image-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .image-item {
      background: rgba(7, 9, 19, 0.85);
      border: 1px solid var(--panel-border);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
    }
    .image-item:hover {
      transform: translateY(-3px);
      border-color: var(--accent-cyan);
      box-shadow: 0 8px 24px rgba(0, 240, 255, 0.2);
    }
    .image-thumb-wrap {
      width: 100%;
      height: 180px;
      background: #04050a;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      cursor: pointer;
    }
    .image-thumb-wrap img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      transition: transform 0.3s;
    }
    .image-item:hover .image-thumb-wrap img { transform: scale(1.05); }
    .image-meta {
      padding: 10px;
      font-size: 11px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .image-name {
      font-weight: 700;
      color: #FFF;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .image-info {
      color: var(--text-muted);
      font-size: 10px;
      display: flex;
      justify-content: space-between;
    }
    .btn-delete-item {
      position: absolute;
      top: 6px;
      right: 6px;
      background: rgba(0, 0, 0, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #FFF;
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      z-index: 10;
    }
    .btn-delete-item:hover { background: #FF3366; border-color: #FF3366; transform: scale(1.1); }

    .nav-links {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-top: 10px;
    }
    .nav-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 600;
      transition: color 0.2s;
    }
    .nav-link:hover { color: var(--accent-cyan); }
  </style>
</head>
<body>
  <div class="container">
    
    <div class="header-card">
      <h1>📸 Batch Screenshot Upload & Multi-Image Dropzone</h1>
      <p>
        Drop <b>multiple screenshots</b> at once, select a batch of files, or press <b style="color: var(--accent-yellow);">Ctrl+V / Cmd+V</b> repeatedly to paste a ton of images!
      </p>

      <div class="dropzone" id="dropzone">
        <div class="dropzone-icon">📥</div>
        <div class="dropzone-title">Drop Multiple Images or Click to Browse Batch</div>
        <div class="dropzone-sub">Supports multi-paste (Ctrl+V) & bulk file uploads (PNG, JPG, WebP)</div>
        <input type="file" id="fileInput" accept="image/*" multiple style="display: none;">
      </div>

      <div id="statusBar" class="status-bar"></div>
    </div>

    <!-- LIVE UPLOADED GALLERY -->
    <div class="gallery-card">
      <div class="gallery-nav-tabs">
        <div class="tab-group">
          <button class="tab-button active" id="tabUploads" onclick="switchGalleryTab('uploads')">
            📥 Newly Uploaded Screenshots (<span id="uploadsCount">0</span>)
          </button>
          <button class="tab-button" id="tabCorpus" onclick="switchGalleryTab('corpus')">
            📚 Prometheus Font Pairing Corpus (<span id="corpusCount">45</span>)
          </button>
        </div>
        <div class="gallery-actions" id="galleryActionsWrap">
          <button class="btn-action" onclick="refreshCurrentTab()">🔄 Refresh</button>
          <button class="btn-action btn-danger" onclick="clearAllUploads()">🗑️ Clear Uploads</button>
        </div>
      </div>

      <div id="imageGrid" class="image-grid">
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 30px;">
          Loading gallery...
        </div>
      </div>
    </div>

    <div class="nav-links">
      <a href="/typography_treatment_presentation.html" class="nav-link">🎬 Presentation Studio</a>
      <a href="/typography.html" class="nav-link">⚡ Kinetic Presets Suite</a>
    </div>

  </div>

  <script>
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const statusBar = document.getElementById('statusBar');
    const imageGrid = document.getElementById('imageGrid');
    const uploadsCountBadge = document.getElementById('uploadsCount');
    const corpusCountBadge = document.getElementById('corpusCount');

    let currentTab = 'uploads';
    let localUploadedImages = [];

    dropzone.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleBatchFiles(Array.from(e.target.files));
      }
    };

    // Global Clipboard Paste Support
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;
      const imageFiles = [];
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        handleBatchFiles(imageFiles);
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
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleBatchFiles(Array.from(e.dataTransfer.files));
      }
    });

    // Handle batch files with INSTANT optimistic local preview + background server upload
    async function handleBatchFiles(files) {
      if (files.length === 0) return;
      statusBar.innerText = '⏳ Uploading ' + files.length + ' image(s)...';
      statusBar.style.color = '#FFE600';

      files.forEach((file, idx) => {
        const localUrl = URL.createObjectURL(file);
        const optimisticName = file.name || ('screenshot_' + Date.now() + '_' + (idx+1) + '.png');
        localUploadedImages.unshift({
          name: optimisticName,
          size: file.size,
          mtime: Date.now(),
          url: localUrl,
          isLocal: true
        });
      });

      if (currentTab === 'uploads') {
        renderGallery(localUploadedImages, true);
      }

      let successCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const dataUrl = await readFileAsDataUrl(file);
          const res = await fetch('/api/upload_screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataUrl: dataUrl,
              filename: file.name || ('screenshot_' + Date.now() + '_' + (i+1) + '.png')
            })
          });
          const json = await res.json();
          if (json.success) successCount++;
        } catch (err) {
          console.error("Upload error for file:", file.name, err);
        }
      }

      statusBar.innerText = '✅ ' + successCount + ' of ' + files.length + ' image(s) uploaded successfully!';
      statusBar.style.color = '#10B981';
      fetchUploadsGallery();
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function switchGalleryTab(tab) {
      currentTab = tab;
      document.getElementById('tabUploads').classList.toggle('active', tab === 'uploads');
      document.getElementById('tabCorpus').classList.toggle('active', tab === 'corpus');
      refreshCurrentTab();
    }

    function refreshCurrentTab() {
      if (currentTab === 'uploads') {
        fetchUploadsGallery();
      } else {
        fetchCorpusGallery();
      }
    }

    async function fetchUploadsGallery() {
      try {
        const res = await fetch('/api/list_uploaded_screenshots?t=' + Date.now());
        const data = await res.json();
        localUploadedImages = data.images || [];
        uploadsCountBadge.innerText = localUploadedImages.length;
        if (currentTab === 'uploads') {
          renderGallery(localUploadedImages, true);
        }
      } catch (err) {
        console.error("Failed to fetch uploads gallery:", err);
      }
    }

    async function fetchCorpusGallery() {
      try {
        const res = await fetch('/api/list_corpus_screenshots?t=' + Date.now());
        const data = await res.json();
        corpusCountBadge.innerText = data.images.length;
        if (currentTab === 'corpus') {
          renderGallery(data.images || [], false);
        }
      } catch (err) {
        console.error("Failed to fetch corpus gallery:", err);
      }
    }

    function renderGallery(images, allowDelete) {
      if (images.length === 0) {
        imageGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 30px;">No screenshots in this gallery yet. Paste or drop images above!</div>';
        return;
      }

      imageGrid.innerHTML = '';
      images.forEach(img => {
        const item = document.createElement('div');
        item.className = 'image-item';

        const sizeKb = Math.round((img.size || 0) / 1024);
        const dateStr = img.mtime ? new Date(img.mtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

        if (allowDelete) {
          const delBtn = document.createElement('button');
          delBtn.className = 'btn-delete-item';
          delBtn.innerText = '✕';
          delBtn.title = 'Delete screenshot';
          delBtn.onclick = (e) => { e.stopPropagation(); deleteImage(img.name); };
          item.appendChild(delBtn);
        }

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'image-thumb-wrap';
        thumbWrap.onclick = () => window.open(img.url, '_blank');

        const imgEl = document.createElement('img');
        imgEl.src = img.url;
        imgEl.alt = img.name;
        imgEl.loading = 'lazy';
        thumbWrap.appendChild(imgEl);

        const meta = document.createElement('div');
        meta.className = 'image-meta';
        meta.innerHTML = 
          '<div class="image-name" title="' + img.name + '">' + img.name + '</div>' +
          '<div class="image-info"><span>' + sizeKb + ' KB</span><span>' + dateStr + '</span></div>';

        item.appendChild(thumbWrap);
        item.appendChild(meta);
        imageGrid.appendChild(item);
      });
    }

    async function deleteImage(name) {
      if (!confirm('Delete ' + name + '?')) return;
      try {
        await fetch('/api/delete_uploaded_screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: name })
        });
        fetchUploadsGallery();
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    }

    async function clearAllUploads() {
      if (!confirm('Clear all uploaded screenshots?')) return;
      try {
        await fetch('/api/clear_uploaded_screenshots', { method: 'POST' });
        localUploadedImages = [];
        fetchUploadsGallery();
      } catch (err) {
        alert('Clear failed: ' + err.message);
      }
    }

    // Initial Gallery Load
    fetchUploadsGallery();
    fetchCorpusGallery();
  </script>
</body>
</html>`;

function createServerInstance(port: number) {
  const s = http.createServer((req, res) => {
    // CORS Headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Serve Interactive Multi-Screenshot Clipboard Paste & Upload Dropzone Page
    if ((req.method === "GET" || req.method === "HEAD") && (req.url === "/paste" || req.url === "/upload" || req.url === "/paste/")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(pasteHtmlContent);
      return;
    }

    // API 1: Upload Screenshot (Handles Single or Batch)
    if (req.method === "POST" && req.url === "/api/upload_screenshot") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (json.dataUrl) {
            const base64Data = json.dataUrl.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, "base64");
            
            const ext = (path.extname(json.filename || ".png") || ".png").toLowerCase();
            const baseName = path.basename(json.filename || "screenshot", ext).replace(/[^a-zA-Z0-9_-]/g, "_");
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 6);
            const safeFilename = `${baseName}_${timestamp}_${randomId}${ext}`;
            const targetUploadPath = path.join(uploadsDir, safeFilename);
            
            fs.writeFileSync(targetUploadPath, buffer);
            
            const legacyPath = path.join(studioDir, "user_clipboard_screenshot.png");
            fs.writeFileSync(legacyPath, buffer);
            
            console.log(`\n📸 [BATCH_UPLOAD_SAVED] Saved image (${buffer.length} bytes): ${safeFilename}`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, filename: safeFilename, savedPath: targetUploadPath }));
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

    // API 2: List Uploaded Screenshots
    if (req.method === "GET" && req.url?.startsWith("/api/list_uploaded_screenshots")) {
      try {
        const files = fs.readdirSync(uploadsDir);
        const images = files.map(file => {
          const filePath = path.join(uploadsDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            mtime: stats.mtimeMs,
            url: `/uploaded_screenshots/${encodeURIComponent(file)}`
          };
        }).sort((a, b) => b.mtime - a.mtime);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, images }));
        return;
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    // API 3: List Corpus Screenshots (All 45 Font Pairing Screenshots)
    if (req.method === "GET" && req.url?.startsWith("/api/list_corpus_screenshots")) {
      try {
        const files = fs.readdirSync(fontPairingScreenshotsDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
        const images = files.map(file => {
          const filePath = path.join(fontPairingScreenshotsDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            mtime: stats.mtimeMs,
            url: `/corpus_screenshots/${encodeURIComponent(file)}`
          };
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, images }));
        return;
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    // API 4: Delete Specific Uploaded Screenshot
    if (req.method === "POST" && req.url === "/api/delete_uploaded_screenshot") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (json.filename) {
            const safeFilename = path.basename(json.filename);
            const targetPath = path.join(uploadsDir, safeFilename);
            if (fs.existsSync(targetPath)) {
              fs.unlinkSync(targetPath);
              console.log(`🗑️ [IMAGE_DELETED] Deleted: ${safeFilename}`);
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
            return;
          }
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing filename" }));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // API 5: Clear All Uploaded Screenshots
    if (req.method === "POST" && req.url === "/api/clear_uploaded_screenshots") {
      try {
        const files = fs.readdirSync(uploadsDir);
        files.forEach(f => {
          try { fs.unlinkSync(path.join(uploadsDir, f)); } catch {}
        });
        console.log(`🗑️ [ALL_IMAGES_CLEARED] Cleared all uploaded screenshots.`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
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

  s.listen(port, "0.0.0.0", () => {
    console.log(`  🚀 EC2 Live HTTP Server on Port ${port}: http://16.192.95.115:${port}/typography_treatment_presentation.html`);
  });
  s.on("error", (e) => {
    console.warn(`[PORT_BIND_WARN] Port ${port} could not be bound (${e.message})`);
  });
  return s;
}

// Bind to multiple candidate ports simultaneously
const candidatePorts = [8080, 3000, 5000, 8000, 9000];
const activeServers = candidatePorts.map(p => createServerInstance(p));

console.log("================================================================================");
console.log("  🚀 MINI-RUN STUDIO MULTI-PORT EC2 SERVER RUNNING");
console.log("================================================================================");
console.log("  Presentation:  http://16.192.95.115:8080/typography_treatment_presentation.html");
console.log("  Batch Paste:   http://16.192.95.115:8080/paste");
console.log("  Binding:       0.0.0.0 across ports 8080, 3000, 5000, 8000, 9000");
console.log("================================================================================");

startAllTunnels(8080);

/**
 * Start all tunnel options.
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
  console.log(`  2. Direct EC2 Permanent IP:    \x1b[36m\x1b[1m${directEc2Url}\x1b[0m`);
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
      console.log(`\n  ⚡ Cloudflare HTTPS Studio: \x1b[35m\x1b[1m${cfBase}/typography_treatment_presentation.html\x1b[0m`);
      console.log(`  ⚡ Cloudflare HTTPS Paste:  \x1b[33m\x1b[1m${cfBase}/paste\x1b[0m`);
    }
  };
  cfProcess.stdout?.on("data", onData);
  cfProcess.stderr?.on("data", onData);

  // 3. Launch Pinggy Tunnel
  const pinggyProcess = spawn("ssh", ["-o", "StrictHostKeyChecking=no", "-p", "443", "-R0:localhost:8080", "a.pinggy.io"], {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  pinggyProcess.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.free\.pinggy\.net/i) || text.match(/https:\/\/[a-zA-Z0-9-]+\.run\.pinggy-free\.link/i);
    if (match) {
      const pinggyUrl = `${match[0]}/typography_treatment_presentation.html`;
      const pasteUrl = `${match[0]}/paste`;
      console.log(`  🌐 Pinggy HTTPS Studio:     \x1b[36m\x1b[1m${pinggyUrl}\x1b[0m`);
      console.log(`  🌐 Pinggy HTTPS Paste:      \x1b[33m\x1b[1m${pasteUrl}\x1b[0m\n`);
    }
  });
}

process.on("SIGINT", () => {
  console.log("\nStopping server...");
  activeServers.forEach(s => s.close());
  process.exit(0);
});

process.on("SIGTERM", () => {
  activeServers.forEach(s => s.close());
  process.exit(0);
});
