import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, execSync } from "node:child_process";

const studioDir = __dirname;
const repoRoot = path.resolve(studioDir, "../..");

const uploadsDir = path.join(studioDir, "uploaded_screenshots");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadedVideosDir = path.join(studioDir, "uploaded_videos");
if (!fs.existsSync(uploadedVideosDir)) {
  fs.mkdirSync(uploadedVideosDir, { recursive: true });
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
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".md": "text/markdown; charset=utf-8",
  ".ico": "image/x-icon",
};

/**
 * Probe video metadata using ffprobe if available
 */
function probeVideoFile(filePath: string): any {
  try {
    const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
    const result = execSync(cmd, { encoding: "utf8" });
    const parsed = JSON.parse(result);
    const videoStream = parsed.streams?.find((s: any) => s.codec_type === "video");
    const audioStream = parsed.streams?.find((s: any) => s.codec_type === "audio");
    
    let fps = 30;
    if (videoStream?.r_frame_rate) {
      const parts = videoStream.r_frame_rate.split("/");
      if (parts.length === 2 && parseFloat(parts[1]) > 0) {
        fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
      }
    }

    return {
      durationSeconds: parseFloat(parsed.format?.duration || videoStream?.duration || "0"),
      width: videoStream?.width || 1080,
      height: videoStream?.height || 1920,
      fps: fps,
      videoCodec: videoStream?.codec_name || "unknown",
      hasAudio: Boolean(audioStream),
      audioCodec: audioStream?.codec_name || null,
      fileSizeBytes: parseInt(parsed.format?.size || "0", 10) || fs.statSync(filePath).size,
    };
  } catch (e) {
    const stats = fs.statSync(filePath);
    return {
      durationSeconds: 0,
      width: 1080,
      height: 1920,
      fps: 30,
      videoCodec: "unknown",
      hasAudio: false,
      audioCodec: null,
      fileSizeBytes: stats.size,
    };
  }
}

/**
 * Resolve requested URL to disk file path safely with URL decoding.
 */
function resolveFilePath(reqUrl: string): { filePath: string; contentType: string } | null {
  let cleanPath = reqUrl.split("?")[0].split("#")[0];
  try {
    cleanPath = decodeURIComponent(cleanPath);
  } catch {}

  if (cleanPath === "/" || cleanPath === "") {
    cleanPath = "/video";
  }

  // Explicit route for uploaded videos
  if (cleanPath.startsWith("/uploaded_videos/")) {
    const rawName = cleanPath.replace(/^\/uploaded_videos\//, "");
    const safeName = path.basename(rawName);
    const target = path.join(uploadedVideosDir, safeName);
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      const ext = path.extname(target).toLowerCase();
      return {
        filePath: target,
        contentType: MIME_TYPES[ext] || "video/mp4",
      };
    }
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

  if (cleanPath === "/studio" || cleanPath === "/presentation") {
    const presHtml = path.join(studioDir, "typography_treatment_presentation.html");
    if (fs.existsSync(presHtml)) {
      return { filePath: presHtml, contentType: MIME_TYPES[".html"] };
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

  // 3. Try in repoRoot
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

// =========================================================================
// HTML: DEDICATED DRAG & DROP VIDEO RECEIVING PLATFORM
// =========================================================================
const videoPlatformHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Prometheus — Video Dropzone & Spatio-Temporal Ingestion Platform</title>
  <style>
    :root {
      --bg-dark: #070913;
      --card-bg: rgba(14, 19, 38, 0.95);
      --accent-cyan: #00F0FF;
      --accent-pink: #FF0055;
      --accent-purple: #8B5CF6;
      --accent-yellow: #FFE600;
      --accent-green: #10B981;
      --text-main: #FFFFFF;
      --text-muted: #8E9BAE;
      --panel-border: rgba(255, 255, 255, 0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-dark);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px;
    }
    .container {
      width: 100%;
      max-width: 960px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .header-card {
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 24px;
      padding: 30px 24px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
      position: relative;
      overflow: hidden;
    }
    .header-card h1 {
      font-size: clamp(22px, 4vw, 30px);
      font-weight: 900;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
    }
    .header-card p {
      color: var(--text-muted);
      font-size: 13.5px;
      max-width: 620px;
      margin: 0 auto;
    }

    /* TOP NAV LINKS */
    .top-nav {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 14px;
      flex-wrap: wrap;
    }
    .nav-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      color: #FFF;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11.5px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.15s;
    }
    .nav-btn:hover { background: rgba(255, 255, 255, 0.14); border-color: var(--accent-cyan); }
    .nav-btn-highlight { background: var(--accent-cyan); color: #070913; border: none; font-weight: 900; }

    /* DROPZONE AREA */
    .dropzone-box {
      border: 3px dashed var(--accent-cyan);
      border-radius: 20px;
      padding: 44px 20px;
      background: rgba(11, 14, 27, 0.8);
      cursor: pointer;
      text-align: center;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 0 40px rgba(0, 240, 255, 0.12);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .dropzone-box:hover, .dropzone-box.dragover {
      border-color: var(--accent-yellow);
      background: rgba(11, 14, 27, 0.98);
      box-shadow: 0 0 50px rgba(255, 230, 0, 0.3);
      transform: scale(1.01);
    }
    .drop-icon { font-size: 54px; margin-bottom: 12px; }
    .drop-title { font-size: 19px; font-weight: 800; color: #FFF; margin-bottom: 6px; }
    .drop-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
    .btn-browse {
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      color: #070913;
      border: none;
      padding: 10px 22px;
      border-radius: 24px;
      font-size: 13px;
      font-weight: 900;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-browse:hover { transform: scale(1.05); filter: brightness(1.15); }

    /* UPLOAD PROGRESS & STATUS */
    .upload-progress-container {
      display: none;
      width: 100%;
      margin-top: 20px;
    }
    .progress-bar-bg {
      width: 100%;
      height: 10px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      overflow: hidden;
      position: relative;
    }
    .progress-bar-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--accent-cyan), var(--accent-pink));
      transition: width 0.15s ease;
    }
    .progress-text-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 700;
      margin-top: 6px;
      color: var(--text-muted);
    }

    /* PREVIEW & METADATA CARD */
    .preview-card {
      display: none;
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    }
    .preview-layout {
      display: flex;
      flex-direction: row;
      gap: 24px;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .video-player-wrap {
      flex: 1;
      min-width: 280px;
      max-width: 380px;
      background: #000;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid var(--panel-border);
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      position: relative;
    }
    .video-player-wrap video {
      width: 100%;
      height: auto;
      max-height: 480px;
      display: block;
    }

    .metadata-panel {
      flex: 1.2;
      min-width: 280px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .panel-header h3 { font-size: 16px; font-weight: 800; color: var(--accent-cyan); text-transform: uppercase; }
    .badge-success { background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid #10B981; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
    }
    .meta-cell {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 8px 12px;
    }
    .meta-cell span { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
    .meta-cell strong { font-size: 13px; font-family: monospace; color: #FFF; }

    .action-row {
      display: flex;
      gap: 10px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .btn-action {
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      color: #070913;
      border: none;
      padding: 10px 18px;
      border-radius: 14px;
      font-size: 12.5px;
      font-weight: 900;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .btn-action:hover { transform: scale(1.03); filter: brightness(1.15); }
    .btn-secondary-action {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--panel-border);
      color: #FFF;
      padding: 10px 18px;
      border-radius: 14px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
    }
    .btn-secondary-action:hover { background: rgba(255, 255, 255, 0.16); }

    /* UPLOADED RECENT VIDEOS LIST */
    .history-card {
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    }
    .history-title { font-size: 14px; font-weight: 800; color: var(--accent-purple); text-transform: uppercase; margin-bottom: 12px; }
    .video-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 12px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .video-item-name { font-weight: 700; color: #FFF; font-family: monospace; }
    .video-item-meta { color: var(--text-muted); font-size: 11px; margin-top: 2px; }
  </style>
</head>
<body>

  <div class="container">
    
    <!-- HEADER CARD -->
    <div class="header-card">
      <h1>Prometheus Video Receiving Platform</h1>
      <p>Direct EC2 High-Speed Drag & Drop Ingestion for Audioless Footage & Temporal Audio Treatment</p>
      
      <div class="top-nav">
        <a href="/typography_treatment_presentation.html" class="nav-btn nav-btn-highlight">🎬 Open 9:16 Spatio-Temporal Studio</a>
        <a href="/paste" class="nav-btn">📸 Screenshot Dropzone</a>
        <a href="/typography.html" class="nav-btn">⚡ 29 Kinetic Presets Suite</a>
      </div>
    </div>

    <!-- DRAG & DROP ZONE -->
    <div class="dropzone-box" id="dropzoneBox" onclick="fileInput.click()">
      <div class="drop-icon">📹</div>
      <div class="drop-title">Drag & Drop Your Video Footage Here</div>
      <div class="drop-sub">Supports MP4, MOV, WebM, MKV, AVI (Up to 2GB+) • Direct High-Speed EC2 Stream</div>
      <button class="btn-browse" type="button" onclick="event.stopPropagation(); fileInput.click();">
        📁 Browse Video File
      </button>
      <input type="file" id="fileInput" accept="video/*,.mp4,.mov,.webm,.mkv,.avi" style="display:none;" onchange="handleFileSelected(this.files[0])">

      <!-- PROGRESS BAR -->
      <div class="upload-progress-container" id="progressContainer">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="progressBarFill"></div>
        </div>
        <div class="progress-text-row">
          <span id="lblUploadStatus">Streaming video to EC2 storage...</span>
          <span id="lblUploadPercent">0%</span>
        </div>
      </div>
    </div>

    <!-- PREVIEW & TELEMETRY DASHBOARD -->
    <div class="preview-card" id="previewCard">
      <div class="preview-layout">
        
        <!-- VIDEO PLAYER PREVIEW -->
        <div class="video-player-wrap">
          <video id="videoPlayer" controls playsinline></video>
        </div>

        <!-- METADATA & TELEMETRY PANEL -->
        <div class="metadata-panel">
          <div class="panel-header">
            <h3 id="lblUploadedFilename">video_footage.mp4</h3>
            <span class="badge-success">✓ Ingested to EC2</span>
          </div>

          <div class="meta-grid">
            <div class="meta-cell">
              <span>RESOLUTION</span>
              <strong id="lblMetaResolution">1080 x 1920</strong>
            </div>
            <div class="meta-cell">
              <span>DURATION</span>
              <strong id="lblMetaDuration">00:40.00</strong>
            </div>
            <div class="meta-cell">
              <span>FRAMERATE</span>
              <strong id="lblMetaFps">60 FPS</strong>
            </div>
            <div class="meta-cell">
              <span>FILE SIZE</span>
              <strong id="lblMetaSize">24.5 MB</strong>
            </div>
            <div class="meta-cell">
              <span>CODEC</span>
              <strong id="lblMetaCodec">h264 / yuv420p</strong>
            </div>
            <div class="meta-cell">
              <span>AUDIO TRACK</span>
              <strong id="lblMetaAudio">Audioless (Mute)</strong>
            </div>
          </div>

          <div class="action-row">
            <a href="/typography_treatment_presentation.html" class="btn-action">
              🎼 Open in Spatio-Temporal Audio Studio
            </a>
            <button class="btn-secondary-action" onclick="resetUpload()">
              ↺ Upload Another Video
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- RECENT INGESTED VIDEOS -->
    <div class="history-card" id="historyCard">
      <div class="history-title">📂 Ingested Video Staging on EC2</div>
      <div id="videoHistoryList">
        <div style="color:var(--text-muted); font-size:12px;">Loading uploaded video catalog...</div>
      </div>
    </div>

  </div>

  <script>
    const dropzone = document.getElementById('dropzoneBox');
    const fileInput = document.getElementById('fileInput');
    const progressContainer = document.getElementById('progressContainer');
    const progressBarFill = document.getElementById('progressBarFill');
    const lblUploadStatus = document.getElementById('lblUploadStatus');
    const lblUploadPercent = document.getElementById('lblUploadPercent');
    const previewCard = document.getElementById('previewCard');
    const videoPlayer = document.getElementById('videoPlayer');

    // Drag & Drop event listeners
    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFileSelected(files[0]);
      }
    });

    function handleFileSelected(file) {
      if (!file) return;
      uploadVideoFile(file);
    }

    function uploadVideoFile(file) {
      progressContainer.style.display = 'block';
      progressBarFill.style.width = '0%';
      lblUploadPercent.innerText = '0%';
      lblUploadStatus.innerText = 'Streaming ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB) to EC2...';

      // Instant local preview
      const localUrl = URL.createObjectURL(file);
      videoPlayer.src = localUrl;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload_video', true);
      xhr.setRequestHeader('x-file-name', encodeURIComponent(file.name));
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          progressBarFill.style.width = percent + '%';
          lblUploadPercent.innerText = percent + '%';
          if (percent === 100) {
            lblUploadStatus.innerText = 'Finalizing video ingestion & probing temporal metadata...';
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const res = JSON.parse(xhr.responseText);
            displayVideoResult(res);
            fetchVideoHistory();
          } catch (e) {
            lblUploadStatus.innerText = 'Uploaded successfully!';
          }
        } else {
          lblUploadStatus.innerText = 'Upload failed: ' + xhr.statusText;
        }
      };

      xhr.onerror = () => {
        lblUploadStatus.innerText = 'Network error during upload.';
      };

      xhr.send(file);
    }

    function displayVideoResult(data) {
      progressContainer.style.display = 'none';
      previewCard.style.display = 'block';
      dropzone.style.display = 'none';

      document.getElementById('lblUploadedFilename').innerText = data.filename || 'uploaded_video.mp4';
      if (data.url) videoPlayer.src = data.url;

      const meta = data.metadata || {};
      document.getElementById('lblMetaResolution').innerText = (meta.width || 1080) + ' x ' + (meta.height || 1920);
      document.getElementById('lblMetaDuration').innerText = (meta.durationSeconds || 0).toFixed(2) + 's';
      document.getElementById('lblMetaFps').innerText = (meta.fps || 30) + ' FPS';
      document.getElementById('lblMetaSize').innerText = ((meta.fileSizeBytes || 0) / 1024 / 1024).toFixed(2) + ' MB';
      document.getElementById('lblMetaCodec').innerText = (meta.videoCodec || 'h264');
      document.getElementById('lblMetaAudio').innerText = meta.hasAudio ? 'Audio Detected (' + meta.audioCodec + ')' : 'Audioless (Mute Video)';
    }

    function resetUpload() {
      previewCard.style.display = 'none';
      dropzone.style.display = 'flex';
      fileInput.value = '';
    }

    async function fetchVideoHistory() {
      try {
        const res = await fetch('/api/list_uploaded_videos');
        const json = await res.json();
        const container = document.getElementById('videoHistoryList');
        if (!json.videos || json.videos.length === 0) {
          container.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">No uploaded videos in EC2 staging yet.</div>';
          return;
        }
        container.innerHTML = json.videos.map(v => \`
          <div class="video-item-row">
            <div>
              <div class="video-item-name">\${v.name}</div>
              <div class="video-item-meta">\${(v.size / 1024 / 1024).toFixed(2)} MB • \${new Date(v.mtime).toLocaleTimeString()}</div>
            </div>
            <a href="\${v.url}" target="_blank" class="nav-btn" style="font-size:10.5px;">▶ Play</a>
          </div>
        \`).join('');
      } catch (e) {}
    }

    fetchVideoHistory();
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

    // Route 1: Video Receiving Platform (Root / or /video or /drop)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url === "/" || req.url === "/video" || req.url === "/drop" || req.url === "/upload_video")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(videoPlatformHtml);
      return;
    }

    // API: Stream Large Video Upload to Disk
    if (req.method === "POST" && req.url === "/api/upload_video") {
      const rawHeaderName = req.headers["x-file-name"];
      let filename = "uploaded_video.mp4";
      if (typeof rawHeaderName === "string" && rawHeaderName) {
        try {
          filename = decodeURIComponent(rawHeaderName);
        } catch {
          filename = rawHeaderName;
        }
      }

      const ext = (path.extname(filename) || ".mp4").toLowerCase();
      const baseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
      const timestamp = Date.now();
      const safeFilename = `${baseName}_${timestamp}${ext}`;
      const targetPath = path.join(uploadedVideosDir, safeFilename);
      const standardCanonicalPath = path.join(studioDir, "uploaded_input_video.mp4");

      const fileWriteStream = fs.createWriteStream(targetPath);
      
      req.pipe(fileWriteStream);

      fileWriteStream.on("finish", () => {
        try {
          // Also duplicate to canonical input path
          fs.copyFileSync(targetPath, standardCanonicalPath);
          
          // Probe metadata
          const metadata = probeVideoFile(targetPath);
          console.log(`\n📹 [VIDEO_UPLOAD_SAVED] Successfully ingested video (${(metadata.fileSizeBytes / 1024 / 1024).toFixed(2)} MB): ${safeFilename}`);
          console.log(`   Resolution: ${metadata.width}x${metadata.height} | Duration: ${metadata.durationSeconds.toFixed(2)}s | Audio: ${metadata.hasAudio ? 'Yes' : 'Audioless'}`);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            filename: safeFilename,
            savedPath: targetPath,
            canonicalPath: standardCanonicalPath,
            url: `/uploaded_videos/${encodeURIComponent(safeFilename)}`,
            metadata: metadata
          }));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      fileWriteStream.on("error", (err) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      });

      return;
    }

    // API: List Uploaded Videos
    if (req.method === "GET" && req.url?.startsWith("/api/list_uploaded_videos")) {
      try {
        const files = fs.readdirSync(uploadedVideosDir).filter(f => /\.(mp4|mov|webm|mkv|avi)$/i.test(f));
        const videos = files.map(file => {
          const filePath = path.join(uploadedVideosDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            mtime: stats.mtimeMs,
            url: `/uploaded_videos/${encodeURIComponent(file)}`
          };
        }).sort((a, b) => b.mtime - a.mtime);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, videos }));
        return;
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    // Serve Static File
    const resolved = resolveFilePath(req.url || "/");
    if (!resolved) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
          <body style="font-family: sans-serif; background: #070913; color: #fff; padding: 40px; text-align: center;">
            <h2 style="color: #00F0FF;">404 — Not Found</h2>
            <p>Requested: <code>${req.url}</code></p>
            <p><a href="/" style="color: #FFD700;">Open Video Receiving Platform</a> | <a href="/typography_treatment_presentation.html" style="color: #00F0FF;">Open Spatio-Temporal Studio</a></p>
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
    console.log(`  🚀 EC2 Video Ingestion Platform on Port ${port}: http://16.192.95.115:${port}/`);
  });
  s.on("error", (e) => {
    console.warn(`[PORT_BIND_WARN] Port ${port} could not be bound (${e.message})`);
  });
  return s;
}

// Kill any zombie previous server instance to cleanly bind port 8080
try {
  const currentPid = process.pid;
  const lsof = execSync(`lsof -t -i:8080 || true`, { encoding: "utf8" }).trim();
  if (lsof) {
    const pids = lsof.split("\n").map(p => parseInt(p.trim(), 10)).filter(p => p && p !== currentPid);
    pids.forEach(pid => {
      try { process.kill(pid, "SIGTERM"); } catch {}
    });
  }
} catch {}

// Bind to multiple candidate ports simultaneously
const candidatePorts = [8080, 3000, 5000, 8000, 9000];
const activeServers = candidatePorts.map(p => createServerInstance(p));

console.log("================================================================================");
console.log("  🚀 PROMETHEUS VIDEO RECEIVING PLATFORM RUNNING");
console.log("================================================================================");
console.log("  Video Dropzone:  http://16.192.95.115:8080/");
console.log("  Audio Studio:    http://16.192.95.115:8080/typography_treatment_presentation.html");
console.log("  Binding:         0.0.0.0 across ports 8080, 3000, 5000, 8000, 9000");
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
  const permanentLocaltunnelUrl = `https://${fixedSubdomain}.loca.lt/`;
  const directEc2Url = `http://${publicIp}:${port}/`;

  console.log("\n================================================================================");
  console.log("  🌐 ACCESS URLS FOR VIDEO DROPZONE PLATFORM");
  console.log("================================================================================");
  console.log(`  1. Direct EC2 IP (Port 8080):  \x1b[36m\x1b[1m${directEc2Url}\x1b[0m`);
  console.log(`  2. Fixed Subdomain Tunnel:    \x1b[32m\x1b[1m${permanentLocaltunnelUrl}\x1b[0m`);
  console.log("--------------------------------------------------------------------------------");

  // 1. Launch Fixed Subdomain Localtunnel
  const ltProcess = spawn("npx", ["-y", "localtunnel", "--port", `${port}`, "--subdomain", fixedSubdomain], {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

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
      console.log(`  ⚡ Cloudflare HTTPS Dropzone: \x1b[35m\x1b[1m${cfBase}/\x1b[0m`);
    }
  };
  cfProcess.stdout?.on("data", onData);
  cfProcess.stderr?.on("data", onData);
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
