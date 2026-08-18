import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

const studioDir = __dirname;
const repoRoot = path.resolve(studioDir, "../..");
const sfxVideoPath = path.join(studioDir, "video_with_real_sfx.mp4");
const mutedVideoPath = path.join(studioDir, "uploaded_input_video.mp4");
const soundJsonPath = path.join(studioDir, "authoritative_sound_treatment.json");
const soundFxDir = path.join(repoRoot, "SOUND FX");
const renderScript = path.join(studioDir, "render_video_with_sfx.ts");

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
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
};

const ultraLightStudioHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Prometheus — Discrete Sound Design & Variant Control Studio</title>
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
      padding: 16px;
    }
    .container {
      width: 100%;
      max-width: 1240px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .header-card {
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 18px;
      padding: 16px 24px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    }
    .header-card h1 {
      font-size: clamp(20px, 3.5vw, 25px);
      font-weight: 900;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 2px;
    }
    .header-card p { color: var(--text-muted); font-size: 12.5px; }

    .studio-grid {
      display: grid;
      grid-template-columns: minmax(320px, 420px) 1fr;
      gap: 16px;
    }
    @media (max-width: 900px) {
      .studio-grid { grid-template-columns: 1fr; }
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
    }

    .player-wrap {
      background: #000;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--panel-border);
      aspect-ratio: 9 / 16;
      max-height: 520px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.9);
      margin: 0 auto;
    }
    .player-wrap video { width: 100%; height: 100%; object-fit: contain; display: block; }

    .controls-row {
      margin-top: 12px;
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .mode-switch-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--panel-border);
      color: #FFF;
      padding: 6px 12px;
      border-radius: 10px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .mode-switch-btn.active {
      background: rgba(16, 185, 129, 0.2);
      border-color: #10B981;
      color: #10B981;
      font-weight: 800;
    }

    /* TABS */
    .tab-bar {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 10px;
      margin-bottom: 12px;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
    }
    .tab-btn-group { display: flex; gap: 8px; }
    .tab-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      color: var(--text-muted);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
    }
    .tab-btn.active {
      background: var(--accent-cyan);
      color: #070913;
      border-color: var(--accent-cyan);
      font-weight: 900;
    }
    .btn-rebake {
      background: linear-gradient(135deg, var(--accent-yellow), var(--accent-pink));
      color: #070913;
      border: none;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 900;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: transform 0.1s;
    }
    .btn-rebake:hover { transform: scale(1.03); }

    /* TABLE */
    .table-scroll {
      max-height: 480px;
      overflow-y: auto;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0, 0, 0, 0.4);
      contain: content;
    }
    table { width: 100%; border-collapse: collapse; font-size: 11px; font-family: monospace; }
    th { background: rgba(0, 240, 255, 0.08); color: var(--accent-cyan); padding: 8px 10px; text-align: left; position: sticky; top: 0; z-index: 2; border-bottom: 1px solid rgba(255,255,255,0.1); }
    td { padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--text-muted); vertical-align: middle; }
    tr:hover td { background: rgba(255, 255, 255, 0.05); color: #FFF; }
    tr.active-row td { background: rgba(0, 240, 255, 0.22); color: #FFF; font-weight: 700; }

    .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .tag-text { background: rgba(255, 230, 0, 0.2); color: #FFE600; border: 1px solid rgba(255, 230, 0, 0.4); }
    .tag-whoosh { background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.4); }
    .tag-ui { background: rgba(139, 92, 246, 0.2); color: #8B5CF6; border: 1px solid rgba(139, 92, 246, 0.4); }

    .variant-select {
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #FFF;
      padding: 3px 6px;
      border-radius: 6px;
      font-size: 10px;
      font-family: monospace;
      max-width: 180px;
      cursor: pointer;
    }
    .variant-select:focus { border-color: var(--accent-cyan); outline: none; }

    .btn-audition {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--panel-border);
      color: var(--accent-cyan);
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 10px;
      cursor: pointer;
      font-weight: 700;
    }
    .btn-audition:hover { background: var(--accent-cyan); color: #070913; }

    /* JSON CODE VIEW */
    #jsonView {
      display: none;
      max-height: 480px;
      overflow-y: auto;
      background: #02040A;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 14px;
      font-family: monospace;
      font-size: 11px;
      color: #A5B4FC;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>

  <div class="container">
    
    <div class="header-card">
      <h1>Prometheus Discrete Sound Design & Variant Studio</h1>
      <p>Zero Background Clutter • Discrete Text Clicks, Whooshes & UI Pops • Interactive Variant Switching</p>
    </div>

    <div class="studio-grid">
      
      <!-- LEFT: VIDEO PLAYER -->
      <div class="card">
        <div class="player-wrap">
          <video id="studioVideo" src="/video_with_real_sfx.mp4" controls playsinline preload="auto"></video>
        </div>
        
        <div class="controls-row">
          <div style="display:flex; gap:6px;">
            <button class="mode-switch-btn active" id="btnSfxMode" onclick="setAudioTrack('sfx')">
              🔊 Real SFX Audio
            </button>
            <button class="mode-switch-btn" id="btnMuteMode" onclick="setAudioTrack('mute')">
              🔇 Muted
            </button>
          </div>

          <div style="font-size: 11.5px; color: var(--text-muted);">
            <strong id="lblTime">00:00.00</strong> / 01:00.10
          </div>
        </div>
      </div>

      <!-- RIGHT: SCRUBBABLE TABLE & VARIANT CONTROLS -->
      <div class="card">
        
        <div class="tab-bar">
          <div class="tab-btn-group">
            <button class="tab-btn active" id="tabTableBtn" onclick="showTab('table')">📊 Sound Treatments (282 Cues)</button>
            <button class="tab-btn" id="tabJsonBtn" onclick="showTab('json')">{ } Authoritative JSON</button>
          </div>
          
          <button class="btn-rebake" id="btnRebake" onclick="rebakeAudioTrack()">
            ⚡ Re-Bake Master Audio
          </button>
        </div>

        <!-- TAB 1: SCRUBBABLE TABLE WITH VARIANT SELECTORS -->
        <div class="table-scroll" id="tableView">
          <table>
            <thead>
              <tr>
                <th>TIME</th>
                <th>CATEGORY</th>
                <th>VISUAL TRIGGER</th>
                <th>SOUND VARIANT SELECTOR</th>
                <th>PAN</th>
                <th>AUDITION</th>
              </tr>
            </thead>
            <tbody id="treatmentTbody">
              <tr><td colspan="6" style="text-align:center; padding:20px;">Loading sound treatment manifest...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- TAB 2: RAW JSON CODE VIEW -->
        <pre id="jsonView">Loading JSON data...</pre>

      </div>

    </div>

  </div>

  <audio id="auditionPlayer" preload="none"></audio>

  <script>
    const video = document.getElementById('studioVideo');
    const auditionPlayer = document.getElementById('auditionPlayer');
    let soundManifest = null;
    let lastActiveIdx = -1;

    async function loadData() {
      try {
        const res = await fetch('/api/authoritative_sound_treatment');
        soundManifest = await res.json();
        renderTable();
        document.getElementById('jsonView').innerText = JSON.stringify(soundManifest, null, 2);
      } catch (e) {}
    }

    function renderTable() {
      const tbody = document.getElementById('treatmentTbody');
      if (!soundManifest || !soundManifest.treatments) return;

      tbody.innerHTML = soundManifest.treatments.map((t, idx) => {
        let tagClass = 'tag-ui';
        if (t.soundDesign.category === 'TEXT') tagClass = 'tag-text';
        else if (t.soundDesign.category === 'WHOOSHES' || t.soundDesign.category === 'SWOOSHES' || t.soundDesign.category === 'TRANSITIONS') tagClass = 'tag-whoosh';

        const panStr = t.soundDesign.stereoPan >= 0 ? '+' + t.soundDesign.stereoPan.toFixed(2) : t.soundDesign.stereoPan.toFixed(2);

        const optionsHtml = (t.soundDesign.variants || []).map((v, vIdx) => \`
          <option value="\${vIdx}" \${vIdx === t.soundDesign.selectedVariantIndex ? 'selected' : ''}>\${v.label}</option>
        \`).join('');

        return \`
          <tr id="row-\${idx}">
            <td><strong style="color:#FFF; cursor:pointer;" onclick="seekVideo(\${t.timestampSeconds})">\${t.timestampSeconds.toFixed(2)}s</strong></td>
            <td><span class="tag \${tagClass}">\${t.soundDesign.category}</span></td>
            <td><strong>\${t.visualTrigger.elementName}</strong><br><span style="font-size:10px; color:#64748B;">\${t.visualTrigger.description}</span></td>
            <td>
              <select class="variant-select" onchange="changeVariant(\${idx}, this.value)">
                \${optionsHtml}
              </select>
            </td>
            <td>\${panStr}</td>
            <td><button class="btn-audition" onclick="auditionCurrentVariant(\${idx})">▶ Play</button></td>
          </tr>
        \`;
      }).join('');
    }

    function changeVariant(cueIndex, variantIndex) {
      const t = soundManifest.treatments[cueIndex];
      const v = t.soundDesign.variants[variantIndex];
      t.soundDesign.selectedVariantIndex = parseInt(variantIndex, 10);
      t.soundDesign.soundName = v.label;
      t.soundDesign.soundFile = v.soundFile;
      t.soundDesign.audioUrl = v.audioUrl;
      t.soundDesign.category = v.category;
      t.soundDesign.gainDb = v.gainDb;
      t.soundDesign.durationEstimateSec = v.durationSec;

      // Audition immediately
      auditionSingleAudio(v.audioUrl);

      // Save to server
      fetch('/api/update_variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cueIndex, variantIndex: parseInt(variantIndex, 10) })
      });
      document.getElementById('jsonView').innerText = JSON.stringify(soundManifest, null, 2);
    }

    function auditionCurrentVariant(cueIndex) {
      const t = soundManifest.treatments[cueIndex];
      const v = t.soundDesign.variants[t.soundDesign.selectedVariantIndex || 0];
      auditionSingleAudio(v.audioUrl);
    }

    async function rebakeAudioTrack() {
      const btn = document.getElementById('btnRebake');
      btn.innerText = '⏳ Mixing...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/rebake_audio', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          btn.innerText = '✓ Re-Baked!';
          const cur = video.currentTime;
          video.src = '/video_with_real_sfx.mp4?v=' + Date.now();
          video.currentTime = cur;
          video.play();
        } else {
          btn.innerText = '❌ Failed';
        }
      } catch (e) {
        btn.innerText = '❌ Error';
      }

      setTimeout(() => {
        btn.innerText = '⚡ Re-Bake Master Audio';
        btn.disabled = false;
      }, 2000);
    }

    function showTab(tab) {
      if (tab === 'table') {
        document.getElementById('tableView').style.display = 'block';
        document.getElementById('jsonView').style.display = 'none';
        document.getElementById('tabTableBtn').classList.add('active');
        document.getElementById('tabJsonBtn').classList.remove('active');
      } else {
        document.getElementById('tableView').style.display = 'none';
        document.getElementById('jsonView').style.display = 'block';
        document.getElementById('tabTableBtn').classList.remove('active');
        document.getElementById('tabJsonBtn').classList.add('active');
      }
    }

    function seekVideo(sec) {
      video.currentTime = sec;
      video.play();
    }

    function auditionSingleAudio(url) {
      auditionPlayer.src = url;
      auditionPlayer.play();
    }

    function setAudioTrack(mode) {
      const curTime = video.currentTime;
      const wasPlaying = !video.paused;

      if (mode === 'sfx') {
        video.src = '/video_with_real_sfx.mp4';
        document.getElementById('btnSfxMode').classList.add('active');
        document.getElementById('btnMuteMode').classList.remove('active');
      } else {
        video.src = '/uploaded_input_video.mp4';
        document.getElementById('btnMuteMode').classList.add('active');
        document.getElementById('btnSfxMode').classList.remove('active');
      }

      video.currentTime = curTime;
      if (wasPlaying) video.play();
    }

    // High performance O(1) row highlighting
    video.addEventListener('timeupdate', () => {
      const cur = video.currentTime;
      const min = Math.floor(cur / 60);
      const sec = (cur % 60).toFixed(2);
      document.getElementById('lblTime').innerText = (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;

      if (!soundManifest || !soundManifest.treatments) return;

      const trs = soundManifest.treatments;
      let low = 0, high = trs.length - 1, bestIdx = 0;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (trs[mid].timestampSeconds <= cur) {
          bestIdx = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (bestIdx !== lastActiveIdx) {
        if (lastActiveIdx >= 0) {
          const prevRow = document.getElementById('row-' + lastActiveIdx);
          if (prevRow) prevRow.classList.remove('active-row');
        }
        const newRow = document.getElementById('row-' + bestIdx);
        if (newRow) {
          newRow.classList.add('active-row');
          newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        lastActiveIdx = bestIdx;
      }
    });

    loadData();
  </script>
</body>
</html>`;

function createServerInstance(port: number) {
  const s = http.createServer((req, res) => {
    let decodedUrl = req.url || "";
    try { decodedUrl = decodeURIComponent(req.url || ""); } catch {}

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Main Studio App
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url === "/" || req.url === "/studio" || req.url === "/video")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (req.method === "HEAD") { res.end(); return; }
      res.end(ultraLightStudioHtml);
      return;
    }

    // API: Authoritative Sound Treatment JSON
    if ((req.method === "GET" || req.method === "HEAD") && req.url === "/api/authoritative_sound_treatment") {
      if (fs.existsSync(soundJsonPath)) {
        const stat = fs.statSync(soundJsonPath);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache"
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(soundJsonPath).pipe(res);
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ treatments: [] }));
      }
      return;
    }

    // API: Update Specific Variant
    if (req.method === "POST" && req.url === "/api/update_variant") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          const { cueIndex, variantIndex } = JSON.parse(body);
          const manifest = JSON.parse(fs.readFileSync(soundJsonPath, "utf8"));
          const t = manifest.treatments[cueIndex];
          if (t && t.soundDesign.variants[variantIndex]) {
            const v = t.soundDesign.variants[variantIndex];
            t.soundDesign.selectedVariantIndex = variantIndex;
            t.soundDesign.soundName = v.label;
            t.soundDesign.soundFile = v.soundFile;
            t.soundDesign.audioUrl = v.audioUrl;
            t.soundDesign.category = v.category;
            t.soundDesign.gainDb = v.gainDb;
            t.soundDesign.durationEstimateSec = v.durationSec;
            fs.writeFileSync(soundJsonPath, JSON.stringify(manifest, null, 2), "utf8");
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (e: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // API: Re-Bake Video Audio Stream
    if (req.method === "POST" && req.url === "/api/rebake_audio") {
      try {
        console.log("⚡ [REBAKE_REQUEST] Re-mixing master audio with selected variants...");
        execSync(`npx tsx "${renderScript}"`, { stdio: "inherit" });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (e: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // Baked Video with Real SFX Audio
    if (req.url?.startsWith("/video_with_real_sfx.mp4")) {
      if (fs.existsSync(sfxVideoPath)) {
        const stat = fs.statSync(sfxVideoPath);
        res.writeHead(200, {
          "Content-Type": "video/mp4",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache"
        });
        fs.createReadStream(sfxVideoPath).pipe(res);
        return;
      }
    }

    // Muted Raw Video
    if (req.url?.startsWith("/uploaded_input_video.mp4")) {
      if (fs.existsSync(mutedVideoPath)) {
        const stat = fs.statSync(mutedVideoPath);
        res.writeHead(200, {
          "Content-Type": "video/mp4",
          "Content-Length": stat.size,
          "Cache-Control": "public, max-age=3600"
        });
        fs.createReadStream(mutedVideoPath).pipe(res);
        return;
      }
    }

    // Typography Treatment Presentation Studio
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url?.startsWith("/typography_treatment_presentation.html") || req.url === "/presentation" || req.url === "/typo")) {
      const presentationHtmlPath = path.join(studioDir, "typography_treatment_presentation.html");
      if (fs.existsSync(presentationHtmlPath)) {
        const stat = fs.statSync(presentationHtmlPath);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache"
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(presentationHtmlPath).pipe(res);
        return;
      }
    }

    // Screenshot Dropzone & Reference Comparison Gallery (/paste)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url === "/paste" || req.url === "/dropzone" || req.url === "/screenshots")) {
      const dropzoneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Screenshot Dropzone & Reference Gallery</title>
  <style>
    :root { --bg-dark: #070913; --card-bg: rgba(14, 19, 38, 0.95); --accent-cyan: #00F0FF; --panel-border: rgba(255, 255, 255, 0.1); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg-dark); color: #FFF; font-family: -apple-system, sans-serif; padding: 20px; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 24px; color: var(--accent-cyan); }
    .nav-links { display: flex; justify-content: center; gap: 12px; margin-top: 10px; }
    .nav-links a { color: #8E9BAE; text-decoration: none; padding: 6px 12px; background: rgba(255,255,255,0.05); border-radius: 6px; font-size: 13px; }
    .nav-links a:hover { color: #FFF; background: rgba(255,255,255,0.1); }
    .dropzone { border: 2px dashed var(--accent-cyan); border-radius: 12px; padding: 40px 20px; text-align: center; margin-bottom: 24px; background: rgba(0, 240, 255, 0.03); cursor: pointer; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .item-card { background: var(--card-bg); border: 1px solid var(--panel-border); border-radius: 12px; overflow: hidden; padding: 12px; }
    .item-card img { width: 100%; height: auto; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📸 Screenshot Dropzone & Review Gallery</h1>
    <div class="nav-links">
      <a href="/">🎵 Sound Design Studio</a>
      <a href="/typography_treatment_presentation.html">🔤 Typography Presentation</a>
      <a href="/paste" style="color: var(--accent-cyan); font-weight: bold;">📸 Review Screenshots</a>
    </div>
  </div>
  <div class="dropzone" id="dropzone">
    <h3>📋 Paste Screenshot (Ctrl+V) or Drag & Drop Images Here</h3>
    <p style="color: #8E9BAE; font-size: 12px; margin-top: 6px;">Instantly uploads and logs to server for automated analysis</p>
  </div>
  <div class="gallery" id="gallery"></div>
  <script>
    async function loadGallery() {
      const res = await fetch('/api/list_uploaded_screenshots');
      const files = await res.json();
      const gal = document.getElementById('gallery');
      gal.innerHTML = '';
      files.forEach(f => {
        const d = document.createElement('div');
        d.className = 'item-card';
        d.innerHTML = '<img src="/uploaded_screenshots/' + f + '" /><div style="font-size:11px; color:#8E9BAE; margin-top:6px; word-break:break-all;">' + f + '</div>';
        gal.appendChild(d);
      });
    }
    window.addEventListener('paste', async (e) => {
      const items = e.clipboardData.items;
      for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          const fd = new FormData();
          fd.append('file', blob, 'paste_' + Date.now() + '.png');
          await fetch('/api/upload-paste', { method: 'POST', body: fd });
          loadGallery();
        }
      }
    });
    loadGallery();
  </script>
</body>
</html>`;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (req.method === "HEAD") { res.end(); return; }
      res.end(dropzoneHtml);
      return;
    }

    // API: Upload Paste Screenshot
    if (req.method === "POST" && req.url === "/api/upload-paste") {
      const chunks: Buffer[] = [];
      req.on("data", chunk => chunks.push(chunk));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        const uploadDir = path.join(studioDir, "uploaded_screenshots");
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const fn = "paste_" + Date.now() + ".png";
        fs.writeFileSync(path.join(uploadDir, fn), body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "success", filename: fn }));
      });
      return;
    }

    // API: List Uploaded Screenshots
    if (req.method === "GET" && req.url === "/api/list_uploaded_screenshots") {
      const uploadDir = path.join(studioDir, "uploaded_screenshots");
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir).filter(f => f.endsWith(".png") || f.endsWith(".jpg"));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(files));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
      }
      return;
    }

    // Static Assets in uploaded_screenshots/
    if (decodedUrl.startsWith("/uploaded_screenshots/")) {
      const relPath = decodedUrl.replace(/^\/uploaded_screenshots\//, "");
      const fullPath = path.join(studioDir, "uploaded_screenshots", relPath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        const stat = fs.statSync(fullPath);
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "image/png",
          "Content-Length": stat.size,
          "Cache-Control": "public, max-age=3600"
        });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
    }

    // Static Assets in authoritative_font_corpus_45/
    if (decodedUrl.startsWith("/authoritative_font_corpus_45/")) {
      const relPath = decodedUrl.replace(/^\/authoritative_font_corpus_45\//, "");
      const fullPath = path.join(repoRoot, "authoritative_font_corpus_45", relPath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        const stat = fs.statSync(fullPath);
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "image/png",
          "Content-Length": stat.size,
          "Cache-Control": "public, max-age=3600"
        });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
    }

    // General Static Assets in studioDir (matted_speaker_male.png, etc.)
    const localStaticPath = path.join(studioDir, decodedUrl.replace(/^\//, ""));
    if (fs.existsSync(localStaticPath) && fs.statSync(localStaticPath).isFile()) {
      const ext = path.extname(localStaticPath).toLowerCase();
      const stat = fs.statSync(localStaticPath);
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Content-Length": stat.size,
        "Cache-Control": "public, max-age=3600"
      });
      fs.createReadStream(localStaticPath).pipe(res);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  s.listen(port, "0.0.0.0", () => {
    console.log(`  🚀 Discrete Sound Design & Variant Studio on Port ${port}: http://16.192.95.115:${port}/`);
  });
  s.on("error", (e) => {
    console.warn(`[PORT_WARN] Port ${port} (${e.message})`);
  });
  return s;
}

const server = createServerInstance(8080);
process.on("SIGINT", () => { server.close(); process.exit(0); });
process.on("SIGTERM", () => { server.close(); process.exit(0); });

// Keep event loop alive
setInterval(() => {}, 60000);
