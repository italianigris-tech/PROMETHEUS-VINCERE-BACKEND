import net from "net";
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
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const ultraLightStudioHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Prometheus — Interactive Micro-Looping & Sound Variant Studio</title>
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
      max-width: 1280px;
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
      grid-template-columns: minmax(320px, 440px) 1fr;
      gap: 16px;
    }
    @media (max-width: 920px) {
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
      position: relative;
    }
    .player-wrap video { width: 100%; height: 100%; object-fit: contain; display: block; }

    /* FRAME & TIME READOUT */
    .frame-readout-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0,0,0,0.5);
      border: 1px solid var(--panel-border);
      padding: 6px 12px;
      border-radius: 8px;
      margin-top: 10px;
      font-family: monospace;
      font-size: 12px;
    }
    .frame-readout-bar strong { color: var(--accent-cyan); }

    /* LOOP BADGE BANNER */
    .loop-banner {
      display: none;
      background: rgba(0, 240, 255, 0.15);
      border: 1px solid var(--accent-cyan);
      color: #FFF;
      padding: 8px 12px;
      border-radius: 10px;
      font-size: 11.5px;
      font-weight: 700;
      margin-top: 8px;
      justify-content: space-between;
      align-items: center;
      animation: pulseGlow 2s infinite alternate;
    }
    @keyframes pulseGlow {
      from { box-shadow: 0 0 8px rgba(0, 240, 255, 0.2); }
      to { box-shadow: 0 0 16px rgba(0, 240, 255, 0.6); }
    }
    .btn-decouple {
      background: rgba(255, 0, 85, 0.25);
      border: 1px solid #FF0055;
      color: #FF0055;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10.5px;
      font-weight: 800;
      cursor: pointer;
    }
    .btn-decouple:hover { background: #FF0055; color: #FFF; }

    .controls-row {
      margin-top: 10px;
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
    .tab-btn-group { display: flex; gap: 8px; align-items: center; }
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
    
    .loop-toggle-wrap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.06);
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      color: var(--accent-cyan);
    }
    .loop-toggle-wrap input { cursor: pointer; }

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
    tr { cursor: pointer; transition: background 0.15s; }
    tr:hover td { background: rgba(255, 255, 255, 0.08); color: #FFF; }
    tr.active-row td { background: rgba(0, 240, 255, 0.22); color: #FFF; font-weight: 700; }
    tr.loop-locked td { background: rgba(255, 0, 85, 0.25); border-left: 4px solid #FF0055; color: #FFF; font-weight: 700; }

    .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .tag-text { background: rgba(255, 230, 0, 0.2); color: #FFE600; border: 1px solid rgba(255, 230, 0, 0.4); }
    .tag-whoosh { background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.4); }
    .tag-ui { background: rgba(139, 92, 246, 0.2); color: #8B5CF6; border: 1px solid rgba(139, 92, 246, 0.4); }

    .variant-select {
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #FFF;
      padding: 4px 6px;
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
      padding: 3px 8px;
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
      <h1>Prometheus Discrete Sound Design & Micro-Looping Studio</h1>
      <p>HTTP 206 Byte-Range Streaming Enabled • Click Any Cue to Auto-Scrub & Micro-Loop</p>
    </div>

    <div class="studio-grid">
      
      <!-- LEFT: VIDEO PLAYER -->
      <div class="card">
        <div class="player-wrap">
          <video id="studioVideo" src="/video_with_real_sfx.mp4" controls playsinline preload="auto"></video>
        </div>

        <!-- FRAME & TIME READOUT -->
        <div class="frame-readout-bar">
          <div>TIME: <strong id="lblTime">00:00.00</strong></div>
          <div>FRAME: <strong id="lblFrame">#0</strong> (23.98 FPS)</div>
        </div>
        
        <!-- MICRO-LOOP STATUS BANNER -->
        <div class="loop-banner" id="loopBanner">
          <div>
            🔁 <strong>Micro-Loop Active:</strong> <span id="loopRangeText">00:00.00 - 00:00.00</span>
            <div style="font-size:10px; color:#A5F3FC;" id="loopCueName">Visual Trigger Name</div>
          </div>
          <button class="btn-decouple" onclick="decoupleLoop()">✕ Decouple Loop</button>
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

          <div style="font-size: 11px; color: #10B981; font-weight: 700;">
            ✓ HTTP 206 Range Enabled
          </div>
        </div>
      </div>

      <!-- RIGHT: SCRUBBABLE TABLE & VARIANT CONTROLS -->
      <div class="card">
        
        <div class="tab-bar">
          <div class="tab-btn-group">
            <button class="tab-btn active" id="tabTableBtn" onclick="showTab('table')">📊 Sound Treatments (282 Cues)</button>
            <button class="tab-btn" id="tabJsonBtn" onclick="showTab('json')">{ } Authoritative JSON</button>
            
            <label class="loop-toggle-wrap" title="Auto-loop video section when clicking on any cue">
              <input type="checkbox" id="chkAutoLoop" checked> Auto-Loop on Click
            </label>
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
    const chkAutoLoop = document.getElementById('chkAutoLoop');
    const loopBanner = document.getElementById('loopBanner');
    const loopRangeText = document.getElementById('loopRangeText');
    const loopCueName = document.getElementById('loopCueName');
    const lblTime = document.getElementById('lblTime');
    const lblFrame = document.getElementById('lblFrame');

    let soundManifest = null;
    let lastActiveIdx = -1;
    let activeLoopRange = null; // { start: number, end: number, cueIndex: number } | null
    let isSeekingTarget = false;

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
          <tr id="row-\${idx}" onclick="handleRowClick(event, \${idx})">
            <td><strong style="color:#FFF;">\${t.timestampSeconds.toFixed(2)}s</strong></td>
            <td><span class="tag \${tagClass}">\${t.soundDesign.category}</span></td>
            <td><strong>\${t.visualTrigger.elementName}</strong><br><span style="font-size:10px; color:#64748B;">\${t.visualTrigger.description}</span></td>
            <td>
              <select class="variant-select" onclick="event.stopPropagation()" onchange="changeVariant(\${idx}, this.value)">
                \${optionsHtml}
              </select>
            </td>
            <td>\${panStr}</td>
            <td><button class="btn-audition" onclick="event.stopPropagation(); auditionCurrentVariant(\${idx})">▶ Play</button></td>
          </tr>
        \`;
      }).join('');
    }

    function handleRowClick(event, cueIndex) {
      seekAndLoopCue(cueIndex);
    }

    function seekAndLoopCue(cueIndex) {
      if (!soundManifest || !soundManifest.treatments) return;
      const t = soundManifest.treatments[cueIndex];
      const cueTime = t.timestampSeconds;
      const dur = t.soundDesign.durationEstimateSec || 0.35;

      const preRoll = 0.20;
      const postRoll = 0.40;
      const start = Math.max(0, cueTime - preRoll);
      const end = Math.min(video.duration || 60.1, cueTime + dur + postRoll);

      // Instantly update the loop range
      activeLoopRange = { start, end, cueIndex };

      if (chkAutoLoop.checked) {
        loopBanner.style.display = 'flex';
        loopRangeText.innerText = start.toFixed(2) + 's ➔ ' + end.toFixed(2) + 's';
        loopCueName.innerText = t.visualTrigger.elementName + ' (' + t.soundDesign.soundName + ')';
      } else {
        decoupleLoop();
      }

      // Highlight active loop row
      document.querySelectorAll('tr.loop-locked').forEach(r => r.classList.remove('loop-locked'));
      const row = document.getElementById('row-' + cueIndex);
      if (row) {
        row.classList.add('loop-locked');
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Force video seek to new target
      isSeekingTarget = true;
      video.currentTime = start;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          video.muted = true;
          video.play();
        });
      }
    }

    video.addEventListener('seeked', () => {
      isSeekingTarget = false;
    });

    function decoupleLoop() {
      activeLoopRange = null;
      loopBanner.style.display = 'none';
      document.querySelectorAll('tr.loop-locked').forEach(r => r.classList.remove('loop-locked'));
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

      // Automatically scrub video to this cue and start micro-looping
      seekAndLoopCue(cueIndex);

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

      // Automatically scrub video to this cue and start micro-looping
      seekAndLoopCue(cueIndex);

      // Audition single audio asset
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

    function auditionSingleAudio(url) {
      auditionPlayer.src = url;
      auditionPlayer.play().catch(() => {});
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

    // High performance O(1) row highlighting & Seamless Micro-Looping
    video.addEventListener('timeupdate', () => {
      if (video.seeking || isSeekingTarget) return;

      const cur = video.currentTime;
      const min = Math.floor(cur / 60);
      const sec = (cur % 60).toFixed(2);
      lblTime.innerText = (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;
      lblFrame.innerText = '#' + Math.floor(cur * 23.976);

      // Handle Active Micro-Looping (Only loop forward when reaching end of window)
      if (activeLoopRange) {
        if (cur >= activeLoopRange.end) {
          video.currentTime = activeLoopRange.start;
          return;
        }
      }

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
          if (!activeLoopRange) {
            newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
        lastActiveIdx = bestIdx;
      }
    });

    loadData();
  </script>
</body>
</html>`;

async function extractBinaryPayload(buffer: Buffer, contentType?: string): Promise<{ data: Buffer; filename?: string; mime?: string }> {
  if (!buffer || buffer.length === 0) {
    return { data: Buffer.alloc(0) };
  }

  // Case 1: JSON payload with base64 data URI or raw base64
  if (contentType && contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(buffer.toString("utf8"));
      const rawData = parsed.image || parsed.data || parsed.file || "";
      let filename = parsed.filename || parsed.name || undefined;
      if (typeof rawData === "string" && rawData.startsWith("data:")) {
        const matches = rawData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches) {
          return {
            data: Buffer.from(matches[2], "base64"),
            filename,
            mime: matches[1]
          };
        }
      } else if (typeof rawData === "string" && (rawData.startsWith("http://") || rawData.startsWith("https://"))) {
        try {
          const fetchRes = await fetch(rawData);
          const ab = await fetchRes.arrayBuffer();
          return { data: Buffer.from(ab), filename };
        } catch (e: any) {
          console.error("Failed to fetch image from URL:", e.message);
        }
      } else if (typeof rawData === "string" && rawData.length > 0) {
        return {
          data: Buffer.from(rawData, "base64"),
          filename
        };
      }
    } catch {}
  }

  // Case 2: Multipart Form Data
  if (contentType && contentType.includes("multipart/form-data")) {
    const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1].trim().replace(/^["']|["']$/g, "");
      const boundaryBuffer = Buffer.from(`--${boundary}`);
      const headerEndIndex = buffer.indexOf(Buffer.from("\r\n\r\n"));
      if (headerEndIndex !== -1) {
        const headerText = buffer.subarray(0, headerEndIndex).toString("utf8");
        const filenameMatch = headerText.match(/filename="([^"]+)"/i) || headerText.match(/filename=([^;\r\n]+)/i);
        const parsedFilename = filenameMatch ? filenameMatch[1].trim() : undefined;
        const fileStart = headerEndIndex + 4;
        const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, fileStart);
        const fileEnd = nextBoundaryIndex !== -1 ? nextBoundaryIndex - 2 : buffer.length;
        return {
          data: buffer.subarray(fileStart, fileEnd),
          filename: parsedFilename
        };
      }
    }
  }

  // Case 3: Raw string starting with data:image/
  const textSample = buffer.subarray(0, 100).toString("utf8");
  if (textSample.startsWith("data:image/")) {
    const fullText = buffer.toString("utf8");
    const matches = fullText.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches) {
      return {
        data: Buffer.from(matches[2], "base64"),
        mime: matches[1]
      };
    }
  }

  // Default: Direct binary buffer
  return { data: buffer };
}

function streamVideoWithRange(req: http.IncomingMessage, res: http.ServerResponse, filePath: string, contentType?: string) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(filePath).toLowerCase();
  const resolvedContentType = contentType || MIME_TYPES[ext] || "video/mp4";

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": resolvedContentType,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": resolvedContentType,
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
}

function formatBytesHelper(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

function formatTimeHelper(timestamp: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function renderDropzonePageHtml(studioDir: string): string {
  const uploadDir = path.join(studioDir, "uploaded_screenshots");
  let items: Array<{ name: string; size: number; mtimeMs: number; url: string }> = [];
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir)
      .filter(f => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".webp") || f.endsWith(".gif") || f.endsWith(".svg"));
    items = files.map(name => {
      const fp = path.join(uploadDir, name);
      let size = 0, mtimeMs = 0;
      try {
        const st = fs.statSync(fp);
        size = st.size;
        mtimeMs = st.mtimeMs;
      } catch {}
      return { name, size, mtimeMs, url: `/uploaded_screenshots/${name}` };
    }).sort((a, b) => b.mtimeMs - a.mtimeMs);
  }

  const videoUploadDir = path.join(studioDir, "uploaded_videos");
  let videoItems: Array<{ name: string; size: number; mtimeMs: number; url: string }> = [];
  if (fs.existsSync(videoUploadDir)) {
    const files = fs.readdirSync(videoUploadDir)
      .filter(f => /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(f));
    videoItems = files.map(name => {
      const fp = path.join(videoUploadDir, name);
      let size = 0, mtimeMs = 0;
      try {
        const st = fs.statSync(fp);
        size = st.size;
        mtimeMs = st.mtimeMs;
      } catch {}
      return { name, size, mtimeMs, url: `/uploaded_videos/${name}` };
    }).sort((a, b) => b.mtimeMs - a.mtimeMs);
  }

  const totalBytes = items.reduce((acc, cur) => acc + (cur.size || 0), 0);
  const totalCount = items.length;
  const formattedSize = formatBytesHelper(totalBytes);

  let videoCardsHtml = "";
  if (videoItems.length === 0) {
    videoCardsHtml = `<div style="grid-column: 1/-1; text-align: center; color: #8E9BAE; padding: 40px 20px; background: rgba(255,255,255,0.02); border: 1px dashed var(--panel-border); border-radius: 14px;">
      No matted video assets uploaded yet.<br><br><span style="color:var(--accent-cyan); font-weight:bold; font-size:15px;">Use the 🎭 Upload Matted Video button above</span> to add your alpha-matted principal speaker video.
    </div>`;
  } else {
    videoCardsHtml = videoItems.map(item => `
      <div class="item-card" id="video-card-${item.name.replace(/[^a-zA-Z0-9_-]/g, '_')}">
        <div class="vid-wrap" onclick="openVideoLightbox('${item.url}', '${item.name}')">
          <video src="${item.url}?t=${item.mtimeMs}" muted loop playsinline preload="metadata"></video>
          <div class="expand-badge">▶ Preview</div>
        </div>
        <div class="item-details">
          <div class="item-name" title="${item.name}">${item.name}</div>
          <div class="item-meta">
            <span>${formatBytesHelper(item.size)}</span>
            <span>${formatTimeHelper(item.mtimeMs)}</span>
          </div>
        </div>
        <div class="item-btn-bar">
          <button class="btn-item" type="button" onclick="event.stopPropagation(); copyToClipboard(window.location.origin + '${item.url}', 'Copied video link!')">📋 Copy Link</button>
          <button class="btn-item" type="button" onclick="event.stopPropagation(); openVideoLightbox('${item.url}', '${item.name}')">👁️ View</button>
          <button class="btn-item btn-item-del" type="button" onclick="event.stopPropagation(); deleteVideoAsset('${item.name}', this.closest('.item-card'))">🗑️ Delete</button>
        </div>
      </div>
    `).join("\n");
  }

  let initialCardsHtml = "";
  if (items.length === 0) {
    initialCardsHtml = `<div style="grid-column: 1/-1; text-align: center; color: #8E9BAE; padding: 60px 20px; background: rgba(255,255,255,0.02); border: 1px dashed var(--panel-border); border-radius: 14px;">
      No screenshots uploaded yet.<br><br><span style="color:var(--accent-cyan); font-weight:bold; font-size:15px;">Press Ctrl+V (or ⌘V on Mac) anywhere</span> to paste directly from your clipboard.
    </div>`;
  } else {
    initialCardsHtml = items.map(item => `
      <div class="item-card">
        <div class="img-wrap" onclick="openLightbox('${item.url}', '${item.name}')">
          <img src="${item.url}?t=${item.mtimeMs}" alt="${item.name}" />
          <div class="expand-badge">🔍 Expand</div>
        </div>
        <div class="item-details">
          <div class="item-name" title="${item.name}">${item.name}</div>
          <div class="item-meta">
            <span>${formatBytesHelper(item.size)}</span>
            <span>${formatTimeHelper(item.mtimeMs)}</span>
          </div>
        </div>
        <div class="item-btn-bar">
          <button class="btn-item" type="button" onclick="event.stopPropagation(); copyToClipboard(window.location.origin + '${item.url}', 'Copied image link!')">📋 Copy Link</button>
          <button class="btn-item" type="button" onclick="event.stopPropagation(); openLightbox('${item.url}', '${item.name}')">👁️ View</button>
          <button class="btn-item btn-item-del" type="button" onclick="event.stopPropagation(); deleteSingleImage('${item.name}', this.closest('.item-card'))">🗑️ Delete</button>
        </div>
      </div>
    `).join("\n");
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Screenshot Dropzone & Reference Gallery — Prometheus</title>
  <style>
    :root { 
      --bg-dark: #070913; 
      --card-bg: rgba(14, 19, 38, 0.95); 
      --card-hover: rgba(22, 29, 58, 0.98);
      --accent-cyan: #00F0FF; 
      --accent-pink: #FF0055;
      --accent-purple: #8B5CF6;
      --accent-green: #10B981;
      --accent-yellow: #F59E0B;
      --accent-red: #EF4444;
      --panel-border: rgba(255, 255, 255, 0.1); 
      --panel-border-glow: rgba(0, 240, 255, 0.4);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      background: var(--bg-dark); 
      color: #FFF; 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif; 
      padding: 20px; 
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .container {
      width: 100%;
      max-width: 1360px;
    }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { 
      font-size: clamp(22px, 4vw, 28px); 
      font-weight: 900;
      background: linear-gradient(135deg, var(--accent-cyan), #C084FC);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }
    .header p { color: #8E9BAE; font-size: 13.5px; }

    .nav-links { display: flex; justify-content: center; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    .nav-links a { 
      color: #8E9BAE; 
      text-decoration: none; 
      padding: 7px 16px; 
      background: rgba(255,255,255,0.05); 
      border: 1px solid var(--panel-border);
      border-radius: 9px; 
      font-size: 12.5px; 
      font-weight: 600;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .nav-links a:hover { color: #FFF; background: rgba(255,255,255,0.12); border-color: var(--accent-cyan); }
    .nav-links a.active { color: var(--accent-cyan); border-color: var(--accent-cyan); background: rgba(0, 240, 255, 0.1); }
    
    #toastContainer {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      min-width: 280px;
      max-width: 440px;
      padding: 12px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      animation: slideInRight 0.3s ease-out;
      backdrop-filter: blur(8px);
    }
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .toast-success { background: rgba(16, 185, 129, 0.95); color: #FFF; border: 1px solid #34D399; }
    .toast-uploading { background: rgba(0, 240, 255, 0.95); color: #070913; border: 1px solid #FFF; font-weight: 700; }
    .toast-error { background: rgba(239, 68, 68, 0.95); color: #FFF; border: 1px solid #F87171; }
    .toast-info { background: rgba(139, 92, 246, 0.95); color: #FFF; border: 1px solid #A78BFA; }

    .dropzone { 
      border: 2px dashed var(--accent-cyan); 
      border-radius: 18px; 
      padding: 36px 24px; 
      text-align: center; 
      margin-bottom: 24px; 
      background: rgba(0, 240, 255, 0.03); 
      cursor: pointer; 
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      outline: none;
    }
    .dropzone:focus-within, .dropzone.active-focus {
      border-color: #FFF;
      box-shadow: 0 0 24px rgba(0, 240, 255, 0.4);
      background: rgba(0, 240, 255, 0.09);
    }
    .dropzone.dragover { 
      background: rgba(0, 240, 255, 0.18); 
      border-color: #FFF;
      transform: scale(1.01); 
      box-shadow: 0 0 30px rgba(0, 240, 255, 0.6);
    }
    .dropzone-icon {
      font-size: 40px;
      margin-bottom: 12px;
      display: inline-block;
      animation: floatIcon 3s ease-in-out infinite;
    }
    @keyframes floatIcon {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    .dropzone h3 { font-size: 20px; color: #FFF; margin-bottom: 6px; font-weight: 800; }
    .dropzone p { color: #8E9BAE; font-size: 13.5px; margin-bottom: 18px; max-width: 600px; margin-left: auto; margin-right: auto; }

    .dropzone-buttons {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .btn-action-primary {
      background: linear-gradient(135deg, var(--accent-cyan), #38BDF8);
      border: none;
      color: #070913;
      padding: 10px 22px;
      border-radius: 9px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
      box-shadow: 0 4px 14px rgba(0, 240, 255, 0.3);
    }
    .btn-action-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 240, 255, 0.5);
      background: #FFF;
    }
    .btn-action-secondary {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--panel-border);
      color: #FFF;
      padding: 10px 18px;
      border-radius: 9px;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-action-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .url-input-wrap {
      margin-top: 16px;
      display: none;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--panel-border);
      padding: 12px;
      border-radius: 10px;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
      gap: 8px;
    }
    .url-input-wrap.open { display: flex; }
    .url-input-wrap input {
      flex: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 8px 12px;
      color: #FFF;
      font-size: 12.5px;
      outline: none;
    }
    .url-input-wrap input:focus { border-color: var(--accent-cyan); }
    .url-input-wrap button {
      background: var(--accent-cyan);
      color: #070913;
      border: none;
      font-weight: 700;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
    }

    .gallery-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      flex-wrap: wrap;
      gap: 12px;
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      padding: 12px 20px;
      border-radius: 14px;
    }
    .gallery-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .gallery-title-group h2 { font-size: 16px; color: #FFF; font-weight: 800; }
    .gallery-badge {
      background: rgba(0, 240, 255, 0.15);
      color: var(--accent-cyan);
      border: 1px solid rgba(0, 240, 255, 0.3);
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 11.5px;
      font-weight: 700;
      font-family: monospace;
    }

    .gallery-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .search-box {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--panel-border);
      color: #FFF;
      padding: 7px 12px;
      border-radius: 8px;
      font-size: 12px;
      outline: none;
      width: 170px;
      transition: all 0.2s;
    }
    .search-box:focus { border-color: var(--accent-cyan); width: 230px; }
    
    .btn-tool {
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--panel-border);
      color: #FFF;
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-tool:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.25); }
    .btn-danger {
      background: rgba(239, 68, 68, 0.15) !important;
      border: 1px solid rgba(239, 68, 68, 0.4) !important;
      color: #FCA5A5 !important;
      font-weight: 700;
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.35) !important;
      border-color: #EF4444 !important;
      color: #FFF !important;
      box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
    }

    .gallery { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); 
      gap: 20px; 
    }
    .item-card { 
      background: var(--card-bg); 
      border: 1px solid var(--panel-border); 
      border-radius: 14px; 
      overflow: hidden; 
      padding: 14px; 
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }
    .item-card:hover { 
      transform: translateY(-3px); 
      border-color: var(--panel-border-glow); 
      background: var(--card-hover);
      box-shadow: 0 14px 35px rgba(0, 0, 0, 0.65);
    }
    
    /* High-contrast image container with transparent checkerboard backing */
    .img-wrap {
      width: 100%;
      height: 240px;
      background-color: #0c101c;
      background-image: 
        linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%), 
        linear-gradient(-45deg, rgba(255,255,255,0.03) 25%, transparent 25%), 
        linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.03) 75%), 
        linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.03) 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .img-wrap img { 
      max-width: 100%; 
      max-height: 100%; 
      width: auto;
      height: auto;
      object-fit: contain; 
      display: block;
      transition: transform 0.25s;
    }
    .img-wrap:hover img { transform: scale(1.02); }
    /* Matted video asset preview card */
    .vid-wrap {
      width: 100%;
      height: 240px;
      background-color: #0c101c;
      background-image: 
        linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%), 
        linear-gradient(-45deg, rgba(255,255,255,0.03) 25%, transparent 25%), 
        linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.03) 75%), 
        linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.03) 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .vid-wrap video { 
      max-width: 100%; 
      max-height: 100%; 
      width: auto;
      height: auto;
      object-fit: contain; 
      display: block;
      transition: transform 0.25s;
      background: transparent;
    }
    .vid-wrap:hover video { transform: scale(1.02); }
    /* Video lightbox uses a <video> element */
    .lightbox-video-wrap {
      max-width: 94vw;
      max-height: 82vh;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.2);
      background: #030712;
    }
    .lightbox-video-wrap video {
      max-width: 94vw;
      max-height: 82vh;
      object-fit: contain;
      display: block;
      background: transparent;
    }
    .video-section-divider {
      margin-top: 34px;
      padding-top: 24px;
      border-top: 1px solid rgba(236, 72, 153, 0.25);
    }
    .video-section-divider .gallery-title-group h2 { color: #F0ABFC; }
    .video-section-divider .gallery-badge {
      background: rgba(236, 72, 153, 0.15);
      color: #F0ABFC;
      border: 1px solid rgba(236, 72, 153, 0.35);
    }
    .btn-video-upload {
      background: linear-gradient(135deg, rgba(236,72,153,0.9), rgba(168,85,247,0.9));
      border: none;
      color: #FFF;
    }
    .btn-video-upload:hover {
      background: linear-gradient(135deg, #EC4899, #A855F7);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(236, 72, 153, 0.5);
    }
    .expand-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(7, 9, 19, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #FFF;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      backdrop-filter: blur(4px);
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 4px;
      opacity: 0.8;
      transition: all 0.2s;
    }
    .img-wrap:hover .expand-badge {
      opacity: 1;
      border-color: var(--accent-cyan);
      color: var(--accent-cyan);
    }

    .item-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .item-name {
      font-size: 12.5px;
      color: #E2E8F0;
      font-family: monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 600;
    }
    .item-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #8E9BAE;
      font-family: monospace;
    }

    .item-btn-bar {
      display: flex;
      gap: 8px;
      margin-top: 2px;
    }
    .btn-item {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--panel-border);
      color: #CBD5E1;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.15s;
    }
    .btn-item:hover { background: rgba(255,255,255,0.12); color: #FFF; border-color: rgba(255,255,255,0.25); }
    .btn-item-del {
      background: rgba(239, 68, 68, 0.1);
      border-color: rgba(239, 68, 68, 0.25);
      color: #F87171;
    }
    .btn-item-del:hover {
      background: #EF4444;
      border-color: #EF4444;
      color: #FFF;
    }

    #lightboxModal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.92);
      z-index: 100000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      backdrop-filter: blur(12px);
    }
    #lightboxModal.open { display: flex; }
    .lightbox-content {
      max-width: 94vw;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      position: relative;
    }
    .lightbox-img-wrap {
      max-width: 100%;
      max-height: 82vh;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.2);
      background: #030712;
    }
    .lightbox-img-wrap img {
      max-width: 100%;
      max-height: 82vh;
      object-fit: contain;
      display: block;
    }
    .lightbox-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 12px;
      color: #FFF;
      font-size: 13px;
      font-family: monospace;
    }
    .lightbox-close {
      position: absolute;
      top: -38px;
      right: 0;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: #FFF;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .lightbox-close:hover { background: #EF4444; border-color: #EF4444; }

    /* CUSTOM CONFIRMATION MODAL */
    .confirm-modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 100001;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(8px);
    }
    .confirm-modal.open { display: flex; }
    .confirm-box {
      background: rgba(18, 24, 48, 0.98);
      border: 1px solid rgba(239, 68, 68, 0.4);
      border-radius: 16px;
      padding: 28px 30px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(239, 68, 68, 0.2);
      animation: modalPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes modalPop {
      from { transform: scale(0.92); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .confirm-icon { font-size: 38px; margin-bottom: 12px; }
    .confirm-box h3 { font-size: 18px; color: #FFF; font-weight: 800; margin-bottom: 8px; }
    .confirm-box p { font-size: 13.5px; color: #94A3B8; margin-bottom: 22px; line-height: 1.5; }
    .confirm-btn-bar { display: flex; gap: 12px; justify-content: center; }
    .btn-confirm-danger {
      background: linear-gradient(135deg, #EF4444, #DC2626) !important;
      color: #FFF !important;
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4) !important;
    }
    .btn-confirm-danger:hover {
      background: #F87171 !important;
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6) !important;
    }
  </style>
</head>
<body>
  <div id="toastContainer"></div>

  <div class="container">
    <div class="header">
      <h1>📸 Screenshot Dropzone & Reference Gallery</h1>
      <p>Instant paste (Ctrl+V / ⌘V), drag & drop, and automated screenshot ingestion hub</p>
      <div class="nav-links">
        <a href="/typo">🎬 /typo Kinetic & Video Studio</a>
        <a href="/">🎥 / Video SFX Player</a>
        <a href="/mixfont">🎨 /mixfont Testing Hub</a>
        <a href="/anima">✨ /anima ANIMA Studio</a>
        <a href="/paste" class="active">📸 /paste Gallery</a>
      </div>
    </div>

    <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Dropzone for screenshot uploads">
      <div class="dropzone-icon">📋</div>
      <h3>Paste Anywhere (Ctrl+V / ⌘V) or Drag & Drop Images</h3>
      <p>Works with Snipping Tool, Mac Screen Capture (Shift+Cmd+4), browser image copies, and files.</p>
      
      <div class="dropzone-buttons">
        <button class="btn-action-primary" id="btnPasteClipboard" type="button">
          📋 Paste from Clipboard (Ctrl+V)
        </button>
        <button class="btn-action-secondary" id="btnBrowseFiles" type="button">
          📂 Select Image File...
        </button>
        <button class="btn-action-secondary" id="btnToggleUrl" type="button">
          🔗 Paste URL / Base64
        </button>
        <button class="btn-action-secondary btn-video-upload" id="btnUploadVideo" type="button" title="Upload your alpha-matted principal speaker video asset (MP4/WebM/MOV)">
          🎭 Upload Matted Video
        </button>
      </div>

      <div class="url-input-wrap" id="urlInputWrap">
        <input type="text" id="manualInput" placeholder="Paste image URL or data:image/... base64 string" />
        <button type="button" id="btnSubmitManual">Ingest</button>
      </div>

      <input type="file" id="filePicker" multiple accept="image/*" style="display: none;" />
      <input type="file" id="videoFilePicker" accept="video/mp4,video/webm,video/quicktime,video/*" style="display: none;" />
    </div>

    <div class="gallery-bar">
      <div class="gallery-title-group">
        <h2>Uploaded Screenshots</h2>
        <span class="gallery-badge" id="galleryBadge">${totalCount} Images</span>
        <span id="gallerySizeReadout" style="color: #8E9BAE; font-size: 11.5px; font-family: monospace;">Total: ${formattedSize}</span>
      </div>
      <div class="gallery-actions">
        <input type="text" class="search-box" id="searchBox" placeholder="🔍 Search images..." />
        <button class="btn-tool" id="btnRefresh" type="button" title="Refresh Gallery">🔄 Refresh</button>
        <button class="btn-tool btn-danger" id="btnDeleteAll" type="button" onclick="deleteAllImages()" title="Delete All Images">🗑️ Delete All</button>
      </div>
    </div>

    <div class="gallery" id="gallery">${initialCardsHtml}</div>

    <!-- MATTED VIDEO ASSET LIBRARY -->
    <div class="gallery-bar video-section-divider">
      <div class="gallery-title-group">
        <h2>🎭 Matted Video Assets (Principal Speaker)</h2>
        <span class="gallery-badge" id="videoGalleryBadge">${videoItems.length} Videos</span>
        <span id="videoSizeReadout" style="color: #8E9BAE; font-size: 11.5px; font-family: monospace;">${formatBytesHelper(videoItems.reduce((a, c) => a + (c.size || 0), 0))}</span>
      </div>
      <div class="gallery-actions">
        <button class="btn-tool" id="btnRefreshVideos" type="button" title="Refresh Matted Videos">🔄 Refresh</button>
        <button class="btn-tool btn-danger" id="btnDeleteAllVideos" type="button" onclick="deleteAllVideoAssets()" title="Delete All Matted Videos">🗑️ Delete All</button>
      </div>
    </div>
    <div class="gallery" id="videoGallery">${videoCardsHtml}</div>
  </div>

  <!-- LIGHTBOX MODAL -->
  <div id="lightboxModal">
    <div class="lightbox-content">
      <button class="lightbox-close" id="lightboxClose" title="Close (Esc)">✕</button>
      <div class="lightbox-img-wrap">
        <img id="lightboxImg" src="" alt="Full Preview" />
      </div>
      <div class="lightbox-bar">
        <span id="lightboxName">filename.png</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn-tool" id="lightboxCopy" type="button">📋 Copy Link</button>
          <a class="btn-tool" id="lightboxDownload" href="" download target="_blank" style="text-decoration:none;">⬇️ Download</a>
        </div>
      </div>
    </div>
  </div>

  <!-- VIDEO LIGHTBOX MODAL -->
  <div id="videoLightboxModal">
    <div class="lightbox-content">
      <button class="lightbox-close" id="videoLightboxClose" title="Close (Esc)">✕</button>
      <div class="lightbox-video-wrap">
        <video id="videoLightboxVideo" src="" controls autoplay playsinline></video>
      </div>
      <div class="lightbox-bar">
        <span id="videoLightboxName">filename.mp4</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn-tool" id="videoLightboxCopy" type="button">📋 Copy Link</button>
          <a class="btn-tool" id="videoLightboxDownload" href="" download target="_blank" style="text-decoration:none;">⬇️ Download</a>
        </div>
      </div>
    </div>
  </div>

  <!-- CONFIRMATION MODAL -->
  <div id="confirmModal" class="confirm-modal">
    <div class="confirm-box">
      <div class="confirm-icon" id="confirmIcon">⚠️</div>
      <h3 id="confirmTitle">Confirm Action</h3>
      <p id="confirmMessage">Are you sure you want to proceed?</p>
      <div class="confirm-btn-bar">
        <button type="button" class="btn-action-secondary" id="confirmCancelBtn">Cancel</button>
        <button type="button" class="btn-action-primary btn-confirm-danger" id="confirmOkBtn">Yes, Delete</button>
      </div>
    </div>
  </div>

  <script>
    let allScreenshots = ${JSON.stringify(items)};
    let allVideos = ${JSON.stringify(videoItems)};
    const toastContainer = document.getElementById('toastContainer');
    const dropzone = document.getElementById('dropzone');
    const filePicker = document.getElementById('filePicker');
    const searchBox = document.getElementById('searchBox');
    const urlInputWrap = document.getElementById('urlInputWrap');
    const manualInput = document.getElementById('manualInput');

    function showToast(message, type = 'info', duration = 3500) {
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.innerHTML = '<span>' + message + '</span>';
      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
      }, duration);
      return toast;
    }

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }

    function formatTime(timestamp) {
      if (!timestamp) return '';
      const d = new Date(timestamp);
      const now = Date.now();
      const diff = Math.floor((now - d.getTime()) / 1000);
      if (diff < 60) return 'Just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }

    async function loadGallery() {
      try {
        const res = await fetch('/api/list_uploaded_screenshots?t=' + Date.now());
        const data = await res.json();
        
        allScreenshots = data.map(item => {
          if (typeof item === 'string') {
            return { name: item, url: '/uploaded_screenshots/' + item, size: 0, mtimeMs: 0 };
          }
          return item;
        });

        renderGallery();
      } catch (err) {
        console.error('Failed to load gallery:', err);
      }
    }

    function renderGallery() {
      const q = (searchBox.value || '').trim().toLowerCase();
      const filtered = allScreenshots.filter(item => item.name.toLowerCase().includes(q));
      
      const badge = document.getElementById('galleryBadge');
      const sizeReadout = document.getElementById('gallerySizeReadout');
      badge.innerText = allScreenshots.length + ' Images';
      
      const totalBytes = allScreenshots.reduce((acc, cur) => acc + (cur.size || 0), 0);
      if (totalBytes > 0) {
        sizeReadout.innerText = 'Total: ' + formatBytes(totalBytes);
      } else {
        sizeReadout.innerText = '';
      }

      const gal = document.getElementById('gallery');
      gal.innerHTML = '';

      if (filtered.length === 0) {
        gal.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #8E9BAE; padding: 60px 20px; background: rgba(255,255,255,0.02); border: 1px dashed var(--panel-border); border-radius: 14px;">' +
          (q ? 'No screenshots match your search query "' + q + '".' : 'No screenshots uploaded yet.<br><br><span style="color:var(--accent-cyan); font-weight:bold; font-size:15px;">Press Ctrl+V (or ⌘V on Mac) anywhere</span> to paste directly from your clipboard.') +
          '</div>';
        return;
      }

      filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';

        const imgSrc = item.url + '?t=' + (item.mtimeMs || Date.now());
        
        const imgWrap = document.createElement('div');
        imgWrap.className = 'img-wrap';
        imgWrap.innerHTML = 
          '<img src="' + imgSrc + '" alt="' + item.name + '" />' +
          '<div class="expand-badge">🔍 Expand</div>';
        imgWrap.onclick = () => openLightbox(item.url, item.name);

        const details = document.createElement('div');
        details.className = 'item-details';

        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.innerText = item.name;
        nameEl.title = item.name;

        const metaEl = document.createElement('div');
        metaEl.className = 'item-meta';
        metaEl.innerHTML = 
          '<span>' + (item.size ? formatBytes(item.size) : 'Image') + '</span>' +
          '<span>' + formatTime(item.mtimeMs) + '</span>';

        details.appendChild(nameEl);
        details.appendChild(metaEl);

        const btnBar = document.createElement('div');
        btnBar.className = 'item-btn-bar';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-item';
        copyBtn.type = 'button';
        copyBtn.innerHTML = '📋 Copy Link';
        copyBtn.onclick = (e) => {
          e.stopPropagation();
          copyToClipboard(window.location.origin + item.url, 'Copied image link to clipboard!');
        };

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-item';
        viewBtn.type = 'button';
        viewBtn.innerHTML = '👁️ View';
        viewBtn.onclick = (e) => {
          e.stopPropagation();
          openLightbox(item.url, item.name);
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-item btn-item-del';
        delBtn.type = 'button';
        delBtn.innerHTML = '🗑️ Delete';
        delBtn.onclick = (e) => {
          e.stopPropagation();
          deleteSingleImage(item.name, card);
        };

        btnBar.appendChild(copyBtn);
        btnBar.appendChild(viewBtn);
        btnBar.appendChild(delBtn);

        card.appendChild(imgWrap);
        card.appendChild(details);
        card.appendChild(btnBar);

        gal.appendChild(card);
      });
    }

    // UPLOAD HELPER (Supports Blob, File, Base64 Data URL, Text URL)
    async function uploadPayload(dataOrBlob, filenameHint) {
      let previewThumb = '';
      if (dataOrBlob instanceof Blob) {
        try {
          const objUrl = URL.createObjectURL(dataOrBlob);
          previewThumb = '<img src="' + objUrl + '" style="width:28px;height:28px;border-radius:6px;object-fit:cover;border:1px solid #FFF;margin-right:6px;" />';
        } catch {}
      }
      
      const toast = showToast((previewThumb || '⏳ ') + '<span>Uploading new screenshot...</span>', 'uploading', 30000);
      
      try {
        let res;
        if (typeof dataOrBlob === 'string') {
          res = await fetch('/api/upload-paste', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataOrBlob, filename: filenameHint })
          });
        } else {
          let url = '/api/upload-paste';
          if (filenameHint) url += '?filename=' + encodeURIComponent(filenameHint);
          
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': dataOrBlob.type || 'application/octet-stream' },
            body: dataOrBlob
          });
        }

        const data = await res.json();
        toast.remove();

        if (data.status === 'success') {
          showToast('✓ Ingested: ' + data.filename + ' (' + formatBytes(data.bytes) + ')', 'success', 3500);
          await loadGallery();
        } else {
          showToast('❌ Upload failed: ' + (data.error || 'Unknown error'), 'error', 6000);
        }
      } catch (err) {
        toast.remove();
        showToast('❌ Upload error: ' + err.message, 'error', 6000);
      }
    }

    // HANDLE FILES
    async function handleFiles(fileList) {
      if (!fileList || fileList.length === 0) return;
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.type && file.type.startsWith('image/')) {
          await uploadPayload(file, file.name);
        } else if (!file.type || file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(file.name || '')) {
          await uploadVideoPayload(file, file.name || ('MattedVideo_' + Date.now() + '.mp4'));
        }
      }
    }

    // =========================================================================
    // 🎭 MATTED VIDEO ASSET UPLOAD & LIBRARY
    // =========================================================================
    const videoFilePicker = document.getElementById('videoFilePicker');
    const videoGalleryEl = document.getElementById('videoGallery');
    const videoGalleryBadge = document.getElementById('videoGalleryBadge');

    function formatVideoExt(name) {
      const ext = (name.split('.').pop() || '').toLowerCase();
      return /^(mp4|webm|mov|m4v|mkv|avi)$/.test(ext) ? ext : 'mp4';
    }

    async function uploadVideoPayload(dataOrBlob, filenameHint) {
      // String payload (base64 / data-URI / URL) → JSON buffered path
      if (typeof dataOrBlob === 'string') {
        const toast = showToast('🎭 <span>Uploading matted video asset...</span>', 'uploading', 30000);
        try {
          const res = await fetch('/api/upload-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video: dataOrBlob, filename: filenameHint })
          });
          const data = await res.json();
          toast.remove();
          if (data.status === 'success') {
            showToast('✓ Matted video ingested: ' + data.filename + ' (' + formatBytes(data.bytes) + ')', 'success', 4000);
            await loadVideoGallery();
          } else {
            showToast('❌ Video upload failed: ' + (data.error || 'Unknown error'), 'error', 8000);
          }
        } catch (err) {
          toast.remove();
          showToast('❌ Video upload error: ' + err.message, 'error', 8000);
        }
        return;
      }

      // File/Blob → XHR with live progress (works for arbitrarily large files)
      const total = dataOrBlob.size || 0;
      const toast = showToast(
        '🎭 <span>Uploading matted video asset... <strong id="vidUpPct" style="color:#FFF;">0%</strong></span>',
        'uploading',
        86400000
      );

      const xhr = new XMLHttpRequest();
      const url = '/api/upload-video' + (filenameHint ? '?filename=' + encodeURIComponent(filenameHint) : '');
      xhr.open('POST', url);
      xhr.setRequestHeader('Content-Type', dataOrBlob.type || 'video/mp4');

      xhr.upload.addEventListener('progress', (e) => {
        const pctEl = document.getElementById('vidUpPct');
        if (e.lengthComputable && total > 0 && pctEl) {
          const pct = Math.round((e.loaded / e.total) * 100);
          pctEl.innerText = pct + '% (' + formatBytes(e.loaded) + ' / ' + formatBytes(e.total) + ')';
        }
      });

      xhr.onload = () => {
        toast.remove();
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status === 200 && data.status === 'success') {
            showToast('✓ Matted video ingested: ' + data.filename + ' (' + formatBytes(data.bytes) + ')', 'success', 4000);
            loadVideoGallery();
          } else {
            showToast('❌ Video upload failed: ' + (data.error || ('HTTP ' + xhr.status)), 'error', 8000);
          }
        } catch (err) {
          showToast('❌ Video upload failed: HTTP ' + xhr.status, 'error', 8000);
        }
      };
      xhr.onerror = () => {
        toast.remove();
        showToast('❌ Video upload network error — connection dropped mid-transfer', 'error', 10000);
      };
      xhr.onabort = () => { toast.remove(); };
      xhr.send(dataOrBlob);
    }

    async function loadVideoGallery() {
      try {
        const res = await fetch('/api/list_uploaded_videos?t=' + Date.now());
        const data = await res.json();
        allVideos = Array.isArray(data) ? data.map(item => {
          if (typeof item === 'string') {
            return { name: item, url: '/uploaded_videos/' + item, size: 0, mtimeMs: 0 };
          }
          return item;
        }) : [];
        renderVideoGallery();
      } catch (err) {
        console.error('Failed to load matted video gallery:', err);
      }
    }

    function renderVideoGallery() {
      if (!videoGalleryEl) return;
      videoGalleryEl.innerHTML = '';

      if (videoGalleryBadge) videoGalleryBadge.innerText = allVideos.length + ' Videos';
      const totalBytes = allVideos.reduce((acc, cur) => acc + (cur.size || 0), 0);
      const sizeEl = document.getElementById('videoSizeReadout');
      if (sizeEl) sizeEl.innerText = totalBytes > 0 ? formatBytes(totalBytes) : '';

      if (allVideos.length === 0) {
        videoGalleryEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #8E9BAE; padding: 40px 20px; background: rgba(255,255,255,0.02); border: 1px dashed var(--panel-border); border-radius: 14px;">' +
          'No matted video assets yet. Use the <span style="color:var(--accent-cyan); font-weight:bold;">🎭 Upload Matted Video</span> button above.</div>';
        return;
      }

      allVideos.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';

        const vidWrap = document.createElement('div');
        vidWrap.className = 'vid-wrap';
        const v = document.createElement('video');
        v.src = item.url + '?t=' + (item.mtimeMs || Date.now());
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.preload = 'metadata';
        v.addEventListener('mouseenter', () => v.play().catch(() => {}));
        v.addEventListener('mouseleave', () => v.pause());
        vidWrap.appendChild(v);
        const expandBadge = document.createElement('div');
        expandBadge.className = 'expand-badge';
        expandBadge.innerText = '▶ Preview';
        vidWrap.appendChild(expandBadge);
        vidWrap.onclick = () => openVideoLightbox(item.url, item.name);
        card.appendChild(vidWrap);

        const details = document.createElement('div');
        details.className = 'item-details';

        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.innerText = item.name;
        nameEl.title = item.name;

        const metaEl = document.createElement('div');
        metaEl.className = 'item-meta';
        metaEl.innerHTML =
          '<span>' + (item.size ? formatBytes(item.size) : 'Video') + '</span>' +
          '<span>' + formatTime(item.mtimeMs) + '</span>';

        details.appendChild(nameEl);
        details.appendChild(metaEl);
        card.appendChild(details);

        const btnBar = document.createElement('div');
        btnBar.className = 'item-btn-bar';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-item';
        copyBtn.type = 'button';
        copyBtn.innerHTML = '📋 Copy Link';
        copyBtn.onclick = (e) => {
          e.stopPropagation();
          copyToClipboard(window.location.origin + item.url, 'Copied matted video link!');
        };

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-item';
        viewBtn.type = 'button';
        viewBtn.innerHTML = '👁️ View';
        viewBtn.onclick = (e) => {
          e.stopPropagation();
          openVideoLightbox(item.url, item.name);
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-item btn-item-del';
        delBtn.type = 'button';
        delBtn.innerHTML = '🗑️ Delete';
        delBtn.onclick = (e) => {
          e.stopPropagation();
          deleteVideoAsset(item.name, card);
        };

        btnBar.appendChild(copyBtn);
        btnBar.appendChild(viewBtn);
        btnBar.appendChild(delBtn);
        card.appendChild(btnBar);

        videoGalleryEl.appendChild(card);
      });
    }

    async function executeDeleteVideo(filename, cardEl) {
      const toast = showToast('⏳ Deleting ' + filename + '...', 'uploading', 8000);
      try {
        const res = await fetch('/api/delete_video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });
        const data = await res.json();
        toast.remove();
        if (data.status === 'success') {
          showToast('✓ Deleted ' + filename, 'success');
          if (cardEl) cardEl.remove();
          allVideos = allVideos.filter(item => item.name !== filename);
          renderVideoGallery();
          loadVideoGallery();
        } else {
          showToast('❌ Delete failed: ' + (data.error || 'Unknown error'), 'error');
        }
      } catch (err) {
        toast.remove();
        showToast('❌ Delete error: ' + err.message, 'error');
      }
    }

    function deleteVideoAsset(filename, cardEl) {
      showConfirmDialog(
        'Delete Matted Video?',
        'Permanently delete <b>' + filename + '</b> from server?',
        '🗑️ Delete',
        '🗑️',
        () => executeDeleteVideo(filename, cardEl)
      );
    }

    async function executeDeleteAllVideos() {
      const toast = showToast('⏳ Deleting all matted videos...', 'uploading', 10000);
      try {
        const res = await fetch('/api/delete_all_videos', { method: 'POST' });
        const data = await res.json();
        toast.remove();
        if (data.status === 'success') {
          allVideos = [];
          renderVideoGallery();
          showToast('✓ All matted videos deleted (' + data.deletedCount + ' removed)', 'success', 3000);
          loadVideoGallery();
        } else {
          showToast('❌ Delete failed: ' + (data.error || 'Server error'), 'error', 5000);
        }
      } catch (err) {
        toast.remove();
        showToast('❌ Delete error: ' + err.message, 'error', 5000);
      }
    }

    function deleteAllVideoAssets() {
      showConfirmDialog(
        'Delete ALL Matted Videos?',
        'Are you sure you want to permanently delete all matted video assets from the server? This action cannot be undone.',
        '🗑️ Delete All',
        '⚠️',
        executeDeleteAllVideos
      );
    }

    const videoLightboxModal = document.getElementById('videoLightboxModal');
    const videoLightboxVideo = document.getElementById('videoLightboxVideo');
    const videoLightboxName = document.getElementById('videoLightboxName');
    const videoLightboxDownload = document.getElementById('videoLightboxDownload');
    const videoLightboxCopy = document.getElementById('videoLightboxCopy');
    const videoLightboxClose = document.getElementById('videoLightboxClose');

    function openVideoLightbox(url, name) {
      if (!videoLightboxModal) return;
      videoLightboxVideo.src = url;
      videoLightboxVideo.play().catch(() => {});
      videoLightboxName.innerText = name;
      videoLightboxDownload.href = url;
      videoLightboxCopy.onclick = () => copyToClipboard(window.location.origin + url, 'Copied video link!');
      videoLightboxModal.classList.add('open');
    }

    if (videoLightboxClose) {
      videoLightboxClose.onclick = () => {
        videoLightboxModal.classList.remove('open');
        videoLightboxVideo.pause();
      };
      videoLightboxModal.onclick = (e) => {
        if (e.target === videoLightboxModal) {
          videoLightboxModal.classList.remove('open');
          videoLightboxVideo.pause();
        }
      };
    }

    function handleVideoFiles(fileList) {
      if (!fileList || fileList.length === 0) return;
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.type && !file.type.startsWith('video/')) continue;
        uploadVideoPayload(file, file.name || ('MattedVideo_' + Date.now() + '.mp4'));
      }
      if (videoFilePicker) videoFilePicker.value = '';
    }

    // COPY TO CLIPBOARD HELPER
    async function copyToClipboard(text, successMsg) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          showToast('✓ ' + successMsg, 'success');
          return;
        }
      } catch {}
      // Fallback
      const tempInput = document.createElement('textarea');
      tempInput.value = text;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      tempInput.remove();
      showToast('✓ ' + successMsg, 'success');
    }

    // CUSTOM MODAL CONFIRMATION HELPER (Immune to browser popup blockers)
    function showConfirmDialog(title, message, confirmText, icon, onConfirm) {
      const modal = document.getElementById('confirmModal');
      const tEl = document.getElementById('confirmTitle');
      const mEl = document.getElementById('confirmMessage');
      const iconEl = document.getElementById('confirmIcon');
      const okBtn = document.getElementById('confirmOkBtn');
      const cancelBtn = document.getElementById('confirmCancelBtn');

      tEl.innerText = title;
      mEl.innerHTML = message;
      iconEl.innerText = icon || '⚠️';
      okBtn.innerText = confirmText || 'Yes, Delete';

      modal.classList.add('open');

      const cleanup = () => {
        modal.classList.remove('open');
        okBtn.onclick = null;
        cancelBtn.onclick = null;
      };

      okBtn.onclick = (e) => {
        e.stopPropagation();
        cleanup();
        onConfirm();
      };

      cancelBtn.onclick = (e) => {
        e.stopPropagation();
        cleanup();
      };
    }

    async function executeDeleteSingle(filename, cardEl) {
      const toast = showToast('⏳ Deleting ' + filename + '...', 'uploading', 8000);
      try {
        const res = await fetch('/api/delete_screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });
        const data = await res.json();
        toast.remove();
        if (data.status === 'success') {
          showToast('✓ Deleted ' + filename, 'success');
          if (cardEl) cardEl.remove();
          allScreenshots = allScreenshots.filter(item => item.name !== filename);
          renderGallery();
          loadGallery();
        } else {
          showToast('❌ Delete failed: ' + (data.error || 'Unknown error'), 'error');
        }
      } catch (err) {
        toast.remove();
        showToast('❌ Delete error: ' + err.message, 'error');
      }
    }

    function deleteSingleImage(filename, cardEl) {
      showConfirmDialog(
        'Delete Screenshot?',
        'Permanently delete <b>' + filename + '</b> from server?',
        '🗑️ Delete',
        '🗑️',
        () => executeDeleteSingle(filename, cardEl)
      );
    }

    async function executeDeleteAll() {
      const toast = showToast('⏳ Deleting all screenshots...', 'uploading', 10000);
      try {
        const res = await fetch('/api/delete_all_screenshots', { method: 'POST' });
        const data = await res.json();
        toast.remove();
        if (data.status === 'success') {
          allScreenshots = [];
          renderGallery();
          showToast('✓ All screenshots deleted (' + data.deletedCount + ' removed)', 'success', 3000);
          loadGallery();
        } else {
          showToast('❌ Delete failed: ' + (data.error || 'Server error'), 'error', 5000);
        }
      } catch (err) {
        toast.remove();
        showToast('❌ Delete error: ' + err.message, 'error', 5000);
      }
    }

    function deleteAllImages() {
      showConfirmDialog(
        'Delete ALL Screenshots?',
        'Are you sure you want to permanently delete all screenshots from the server? This action cannot be undone.',
        '🗑️ Delete All',
        '⚠️',
        executeDeleteAll
      );
    }

    const lightboxModal = document.getElementById('lightboxModal');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxName = document.getElementById('lightboxName');
    const lightboxDownload = document.getElementById('lightboxDownload');
    const lightboxCopy = document.getElementById('lightboxCopy');
    const lightboxClose = document.getElementById('lightboxClose');

    function openLightbox(url, name) {
      lightboxImg.src = url;
      lightboxName.innerText = name;
      lightboxDownload.href = url;
      lightboxCopy.onclick = () => copyToClipboard(window.location.origin + url, 'Copied image link!');
      lightboxModal.classList.add('open');
    }

    lightboxClose.onclick = () => lightboxModal.classList.remove('open');
    lightboxModal.onclick = (e) => { if (e.target === lightboxModal) lightboxModal.classList.remove('open'); };
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (lightboxModal.classList.contains('open')) lightboxModal.classList.remove('open');
        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal && confirmModal.classList.contains('open')) confirmModal.classList.remove('open');
        if (videoLightboxModal && videoLightboxModal.classList.contains('open')) {
          videoLightboxModal.classList.remove('open');
          videoLightboxVideo.pause();
        }
      }
    });

    // SINGLE-CAPTURE ATOMIC PASTE LISTENER
    let isPasting = false;
    async function onGlobalPaste(e) {
      if (isPasting) return;

      const activeEl = document.activeElement;
      if (activeEl === searchBox && !e.clipboardData?.files?.length) {
        return;
      }

      const cd = e.clipboardData || window.clipboardData;
      if (!cd) return;

      // Extract image blob/file
      let imageBlob = null;
      let filename = '';
      let videoBlob = null;

      if (cd.files && cd.files.length > 0) {
        for (let i = 0; i < cd.files.length; i++) {
          const f = cd.files[i];
          if (f.type && f.type.startsWith('video/') && !videoBlob) {
            videoBlob = f;
          } else if (f.type && f.type.startsWith('image/')) {
            imageBlob = f;
            filename = f.name;
          }
        }
      }

      if (videoBlob) {
        e.preventDefault();
        e.stopImmediatePropagation();
        isPasting = true;
        try {
          await uploadVideoPayload(videoBlob, videoBlob.name || ('MattedVideo_' + Date.now() + '.mp4'));
        } finally {
          setTimeout(() => { isPasting = false; }, 600);
        }
        return;
      }

      if (!imageBlob && cd.items && cd.items.length > 0) {
        for (let i = 0; i < cd.items.length; i++) {
          const item = cd.items[i];
          if (item.type && item.type.startsWith('video/')) {
            videoBlob = item.getAsFile();
            if (videoBlob) break;
          }
          if (item.type && item.type.startsWith('image/')) {
            imageBlob = item.getAsFile();
          }
        }
      }

      if (videoBlob) {
        e.preventDefault();
        e.stopImmediatePropagation();
        isPasting = true;
        try {
          await uploadVideoPayload(videoBlob, videoBlob.name || ('MattedVideo_' + Date.now() + '.mp4'));
        } finally {
          setTimeout(() => { isPasting = false; }, 600);
        }
        return;
      }

      if (imageBlob) {
        e.preventDefault();
        e.stopImmediatePropagation();
        isPasting = true;
        try {
          await uploadPayload(imageBlob, filename || ('Screenshot_' + Date.now() + '.png'));
        } finally {
          setTimeout(() => { isPasting = false; }, 600);
        }
        return;
      }

      // Check text or data URL
      const text = (cd.getData('text/plain') || '').trim();
      if (text.startsWith('data:image/') || (text.startsWith('http') && ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].some(ext => text.toLowerCase().includes(ext)))) {
        e.preventDefault();
        e.stopImmediatePropagation();
        isPasting = true;
        try {
          await uploadPayload(text, 'URL_Import_' + Date.now() + '.png');
        } finally {
          setTimeout(() => { isPasting = false; }, 600);
        }
        return;
      }
    }

    // Attach SINGLE capturing listener on window only
    window.addEventListener('paste', onGlobalPaste, true);

    // BUTTON: Paste from Clipboard guidance
    document.getElementById('btnPasteClipboard').addEventListener('click', async (e) => {
      e.stopPropagation();
      dropzone.classList.add('active-focus');
      showToast('📋 Press Ctrl+V (or ⌘V on Mac) now to paste from your clipboard!', 'uploading', 4500);
      setTimeout(() => dropzone.classList.remove('active-focus'), 5000);
    });

    document.getElementById('btnBrowseFiles').addEventListener('click', (e) => {
      e.stopPropagation();
      filePicker.click();
    });

    const btnUploadVideo = document.getElementById('btnUploadVideo');
    if (btnUploadVideo) {
      btnUploadVideo.addEventListener('click', (e) => {
        e.stopPropagation();
        if (videoFilePicker) videoFilePicker.click();
      });
    }
    if (videoFilePicker) {
      videoFilePicker.addEventListener('change', (e) => handleVideoFiles(e.target.files));
    }
    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      filePicker.click();
    });
    filePicker.addEventListener('change', (e) => handleFiles(e.target.files));

    document.getElementById('btnToggleUrl').addEventListener('click', (e) => {
      e.stopPropagation();
      urlInputWrap.classList.toggle('open');
      if (urlInputWrap.classList.contains('open')) manualInput.focus();
    });

    document.getElementById('btnSubmitManual').addEventListener('click', async (e) => {
      e.stopPropagation();
      const val = manualInput.value.trim();
      if (!val) return;
      await uploadPayload(val, 'Manual_Import_' + Date.now() + '.png');
      manualInput.value = '';
      urlInputWrap.classList.remove('open');
    });

    ['dragenter', 'dragover'].forEach(name => {
      window.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(name => {
      window.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    });

    searchBox.addEventListener('input', renderGallery);
    document.getElementById('btnRefresh').addEventListener('click', (e) => {
      e.stopPropagation();
      showToast('🔄 Refreshing gallery...', 'info', 1200);
      loadGallery();
    });

    const btnDelAll = document.getElementById('btnDeleteAll');
    if (btnDelAll) {
      btnDelAll.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteAllImages();
      });
    }

    const btnRefreshVideos = document.getElementById('btnRefreshVideos');
    if (btnRefreshVideos) {
      btnRefreshVideos.addEventListener('click', (e) => {
        e.stopPropagation();
        showToast('🔄 Refreshing matted video library...', 'info', 1200);
        loadVideoGallery();
      });
    }

    const btnDelAllVideos = document.getElementById('btnDeleteAllVideos');
    if (btnDelAllVideos) {
      btnDelAllVideos.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteAllVideoAssets();
      });
    }

    setInterval(loadGallery, 3000);
    setInterval(loadVideoGallery, 5000);
    renderVideoGallery();
  </script>
</body>
</html>`;
}

function createServerInstance(port: number) {
  const s = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Reverse Proxy for Kanban UI & WebSocket Hub
    if (req.url && (
      req.url.startsWith("/kanban") ||
      req.url.startsWith("/manifest.json") ||
      req.url.startsWith("/sw.js") ||
      req.url.startsWith("/@vite") ||
      req.url.startsWith("/node_modules") ||
      req.url.startsWith("/src") ||
      req.url.startsWith("/api/workspaces") ||
      req.url.startsWith("/api/tasks") ||
      req.url.startsWith("/api/runs") ||
      req.url.startsWith("/api/settings") ||
      req.url.startsWith("/api/cron") ||
      (req.url.startsWith("/assets/") && !req.url.includes("matted_"))
    )) {
      let targetPath = req.url;
      if (targetPath.startsWith("/kanban")) {
        targetPath = targetPath.replace(/^\/kanban/, "") || "/";
      }
      const proxyReq = http.request({
        hostname: "127.0.0.1",
        port: 3484,
        path: targetPath,
        method: req.method,
        headers: { ...req.headers, host: "127.0.0.1:3484" }
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxyReq.on("error", (err) => {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Bad Gateway to Kanban: " + err.message);
      });
      req.pipe(proxyReq);
      return;
    }


    // Slot-Form Sound Design Dashboard (Served at root `/`, `/studio`, `/video`)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url === "/" || req.url === "" || req.url === "/studio" || req.url === "/video" || req.url === "/dashboard")) {
      const slotDashboardHtmlPath = path.join(studioDir, "slot_dashboard.html");
      const presentationHtmlPath = path.join(studioDir, "typography_treatment_presentation.html");
      const targetPath = fs.existsSync(slotDashboardHtmlPath) ? slotDashboardHtmlPath : presentationHtmlPath;
      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache"
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(targetPath).pipe(res);
        return;
      }
    }

    // Disposable design-study page used during the Morty live-control review.
    if ((req.method === "GET" || req.method === "HEAD") && (req.url === "/temptest" || req.url === "/temptest/")) {
      const studyPath = path.join(studioDir, "temptest.html");
      const stat = fs.statSync(studyPath);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": stat.size,
        "Cache-Control": "no-cache"
      });
      if (req.method === "HEAD") { res.end(); return; }
      fs.createReadStream(studyPath).pipe(res);
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

    // Baked Video with Real SFX Audio (HTTP 206 Partial Content Range Stream)
    if (req.url?.startsWith("/video_with_real_sfx.mp4")) {
      streamVideoWithRange(req, res, sfxVideoPath);
      return;
    }

    // Muted Raw Video (HTTP 206 Partial Content Range Stream)
    if (req.url?.startsWith("/uploaded_input_video.mp4")) {
      streamVideoWithRange(req, res, mutedVideoPath);
      return;
    }

    // Static Assets & Routing (Clean pathname without query parameters)
    const rawPathname = (req.url || "").split("?")[0];
    let decodedUrl = rawPathname;
    try { decodedUrl = decodeURIComponent(rawPathname); } catch {}

    if (decodedUrl.startsWith("/SOUND FX/")) {
      const relPath = decodedUrl.replace(/^\/SOUND FX\//, "");
      const fullPath = path.join(soundFxDir, relPath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        const stat = fs.statSync(fullPath);
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "audio/wav",
          "Content-Length": stat.size,
          "Cache-Control": "public, max-age=3600"
        });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
    }

    // Mixfont Hydration & Comparison Studio (/mixfont, /mix_font, /mixfonts)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url?.startsWith("/mixfont") || req.url?.startsWith("/mix_font") || req.url?.startsWith("/mix%20font") || req.url?.startsWith("/mixfonts") || req.url === "/mixfont_studio.html")) {
      const mixfontHtmlPath = path.join(studioDir, "mixfont_studio.html");
      if (fs.existsSync(mixfontHtmlPath)) {
        const stat = fs.statSync(mixfontHtmlPath);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache"
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(mixfontHtmlPath).pipe(res);
        return;
      }
    }

    // Typography Treatment Presentation Studio (/typo, /type, /typeo, /typing, /presentation)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url?.startsWith("/typo") || req.url?.startsWith("/type") || req.url?.startsWith("/typeo") || req.url?.startsWith("/typing") || req.url?.startsWith("/typography") || req.url?.startsWith("/typography_treatment_presentation.html") || req.url === "/presentation" || req.url?.startsWith("/presentation?"))) {
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

    // Landscape 16:9 Typography Treatment Presentation Studio (/landscape)
    // The landscape studio lives in its own sibling folder (docs/mini_landscape_runs),
    // NOT this short-form studio dir. Serve its authoritative template (kept current by
    // the Stage-8 builder's disk font-corpus refresh) and fall back to the newest built
    // presentation in out/ if the template is ever missing.
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url === "/landscape" || req.url?.startsWith("/landscape?") || req.url?.startsWith("/landscape_treatment_presentation.html"))) {
      const landscapeStudioDir = path.join(repoRoot, "docs", "mini_landscape_runs");
      const landscapeTemplatePath = path.join(landscapeStudioDir, "landscape_treatment_presentation.html");
      let landscapeHtmlPath = landscapeTemplatePath;
      // For the /landscape route, prefer the newest BUILT run (a real authored
      // presentation) over the raw demo template. The raw template is only served
      // when explicitly requested via /landscape_treatment_presentation.html.
      if (!req.url?.startsWith("/landscape_treatment_presentation.html")) {
        const landscapeOutDir = path.join(landscapeStudioDir, "out");
        const built = fs.existsSync(landscapeOutDir)
          ? fs.readdirSync(landscapeOutDir)
              .filter((f) => /^landscape_presentation_.*\.html$/i.test(f))
              .map((f) => path.join(landscapeOutDir, f))
              .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
          : [];
        if (built.length) landscapeHtmlPath = built[0];
      }
      if (!fs.existsSync(landscapeHtmlPath)) {
        const landscapeOutDir = path.join(landscapeStudioDir, "out");
        const built = fs.existsSync(landscapeOutDir)
          ? fs.readdirSync(landscapeOutDir)
              .filter((f) => /^landscape_presentation_.*\.html$/i.test(f))
              .sort()
              .map((f) => path.join(landscapeOutDir, f))
          : [];
        landscapeHtmlPath = built[built.length - 1] || "";
      }
      if (landscapeHtmlPath && fs.existsSync(landscapeHtmlPath)) {
        const stat = fs.statSync(landscapeHtmlPath);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache"
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(landscapeHtmlPath).pipe(res);
        return;
      }
    }

    // Landscape run by id: /landscape_p/<runId> → built studio HTML
    if ((req.method === "GET" || req.method === "HEAD")) {
      const lscapeRun = (req.url || "").match(/^\/landscape_p\/([A-Za-z0-9_-]+)\/?$/);
      if (lscapeRun) {
        const runId = decodeURIComponent(lscapeRun[1]);
        const p = path.join(repoRoot, "docs", "mini_landscape_runs", "out", "landscape_presentation_" + runId + ".html");
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          const stat = fs.statSync(p);
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": stat.size, "Cache-Control": "no-cache" });
          if (req.method === "HEAD") { res.end(); return; }
          fs.createReadStream(p).pipe(res);
          return;
        }
        res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not Found"); return;
      }
    }

    // Landscape media (cut MP4 base background): /landscape_media/<name>
    if ((req.method === "GET" || req.method === "HEAD")) {
      const lscapeMedia = (req.url || "").match(/^\/landscape_media\/([^/]+)$/);
      if (lscapeMedia) {
        let name = decodeURIComponent(lscapeMedia[1]);
        name = path.basename(name);
        const fullPath = path.join(repoRoot, "docs", "mini_landscape_runs", "out", name);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          const ext = path.extname(fullPath).toLowerCase();
          const stat = fs.statSync(fullPath);
          res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "video/mp4", "Content-Length": stat.size, "Cache-Control": "public, max-age=3600" });
          if (req.method === "HEAD") { res.end(); return; }
          fs.createReadStream(fullPath).pipe(res);
          return;
        }
        res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not Found"); return;
      }
    }


    // ANIMA Master 50-Component Animation Studio & Semantic Router (/anima, /router, /classify, /animations)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url?.startsWith("/anima") || req.url?.startsWith("/anim") || req.url === "/animations" || req.url === "/anima_studio.html" || req.url?.startsWith("/router") || req.url?.startsWith("/classify") || req.url?.startsWith("/semantic"))) {
      const animaHtmlPath = path.join(studioDir, "anima_studio.html");
      const fallbackPath = path.join(repoRoot, "Yuan Prometheus Screenshots/prometheus_animations_preview/anima.html");
      const targetPath = fs.existsSync(animaHtmlPath) ? animaHtmlPath : fallbackPath;
      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache"
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(targetPath).pipe(res);
        return;
      }
    }

    // 49 Visual Asset Archetypes Motion Suite (/archetypes, /archetype, /visual_archetypes, /visual_assets, /motion_suite)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url?.startsWith("/archetype") || req.url?.startsWith("/visual_archetype") || req.url?.startsWith("/visual_asset") || req.url?.startsWith("/motion_suite") || req.url === "/archetypes.html")) {
      const archetypesHtmlPath = path.join(repoRoot, "Yuan Prometheus Screenshots/prometheus_animations_preview/visual_archetypes.html");
      if (fs.existsSync(archetypesHtmlPath)) {
        const stat = fs.statSync(archetypesHtmlPath);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache"
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(archetypesHtmlPath).pipe(res);
        return;
      }
    }

    // Kinetic Typography 25 Presets Suite (/typography_preview, /kinetic_presets, /kinetics)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url?.startsWith("/typography_preview") || req.url?.startsWith("/kinetic_preset") || req.url?.startsWith("/kinetics") || req.url === "/typography.html")) {
      const typoPreviewHtmlPath = path.join(repoRoot, "Yuan Prometheus Screenshots/prometheus_animations_preview/typography.html");
      if (fs.existsSync(typoPreviewHtmlPath)) {
        const stat = fs.statSync(typoPreviewHtmlPath);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache"
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(typoPreviewHtmlPath).pipe(res);
        return;
      }
    }

    // Production GSAP Templates Suite (/gsap_templates, /production_motion)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url?.startsWith("/gsap_template") || req.url?.startsWith("/production_motion") || req.url === "/templates_preview")) {
      const gsapHtmlPath = path.join(repoRoot, "Yuan Prometheus Screenshots/prometheus_animations_preview/index.html");
      if (fs.existsSync(gsapHtmlPath)) {
        const stat = fs.statSync(gsapHtmlPath);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache"
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(gsapHtmlPath).pipe(res);
        return;
      }
    }

    // Screenshot Dropzone & Reference Comparison Gallery (/paste, /upload)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url === "/paste" || req.url === "/dropzone" || req.url === "/screenshots" || req.url === "/upload" || req.url === "/upload.html" || req.url?.startsWith("/paste?") || req.url?.startsWith("/upload?"))) {
      const dropzoneHtml = renderDropzonePageHtml(studioDir);
      res.writeHead(200, { 
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      });
      if (req.method === "HEAD") { res.end(); return; }
      res.end(dropzoneHtml);
      return;
    }

    // Matted Overlay Studio (/overlay)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url === "/overlay" || req.url === "/matted-overlay" || req.url === "/dual-video")) {
      const overlayHtmlPath = path.join(studioDir, "overlay_player.html");
      if (fs.existsSync(overlayHtmlPath)) {
        const stat = fs.statSync(overlayHtmlPath);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache"
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(overlayHtmlPath).pipe(res);
        return;
      }
    }

    // API: Upload Paste / Drag & Drop Screenshot (/api/upload-paste, /api/upload, /api/upload-image)
    if (req.method === "POST" && (req.url?.startsWith("/api/upload-paste") || req.url?.startsWith("/api/upload-image") || req.url === "/api/upload" || req.url?.startsWith("/api/upload?"))) {
      const chunks: Buffer[] = [];
      req.on("data", chunk => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const rawBuffer = Buffer.concat(chunks);
          const contentType = req.headers["content-type"] || "";
          
          let parsedFilename: string | undefined;
          try {
            const urlObj = new URL(req.url || "", "http://localhost");
            parsedFilename = urlObj.searchParams.get("filename") || undefined;
          } catch {}

          const { data, filename: multipartFilename } = await extractBinaryPayload(rawBuffer, contentType);
          if (!data || data.length === 0) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", error: "Empty image data received" }));
            return;
          }

          let candidateName = parsedFilename || multipartFilename || "";
          const uploadDir = path.join(studioDir, "uploaded_screenshots");
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

          const existingCount = fs.readdirSync(uploadDir).filter(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f)).length;
          const nextIndex = String(existingCount + 1).padStart(2, '0');

          const now = new Date();
          const timeFormatted = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
          
          let finalFilename = "";
          if (!candidateName || candidateName.startsWith("Screenshot_") || candidateName.startsWith("paste_") || candidateName.startsWith("image_") || candidateName === "image.png" || candidateName === "blob") {
            finalFilename = `Screenshot_${nextIndex}_${timeFormatted}.png`;
          } else {
            finalFilename = candidateName.replace(/[^a-zA-Z0-9._-]/g, "_");
            if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(finalFilename)) {
              finalFilename += ".png";
            }
          }

          let targetPath = path.join(uploadDir, finalFilename);
          if (fs.existsSync(targetPath)) {
            const ext = path.extname(finalFilename);
            const base = path.basename(finalFilename, ext);
            const randSuffix = Math.random().toString(36).substring(2, 6);
            finalFilename = `${base}_${randSuffix}${ext}`;
            targetPath = path.join(uploadDir, finalFilename);
          }

          fs.writeFileSync(targetPath, data);

          console.log(`📸 [UPLOAD_SUCCESS] Saved screenshot: ${finalFilename} (${data.length} bytes)`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ 
            status: "success", 
            filename: finalFilename, 
            url: `/uploaded_screenshots/${finalFilename}`,
            bytes: data.length 
          }));
        } catch (e: any) {
          console.error("❌ [UPLOAD_ERROR]", e);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "error", error: e.message }));
        }
      });
      return;
    }

    // API: Delete Single Screenshot
    if (req.method === "POST" && (req.url === "/api/delete_screenshot" || req.url?.startsWith("/api/delete_screenshot"))) {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          let filename = "";
          try {
            const parsed = JSON.parse(body);
            filename = parsed.filename;
          } catch {
            const urlObj = new URL(req.url || "", "http://localhost");
            filename = urlObj.searchParams.get("filename") || "";
          }

          if (!filename) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", error: "Missing filename" }));
            return;
          }

          const safeFilename = path.basename(filename);
          const uploadDir = path.join(studioDir, "uploaded_screenshots");
          const filePath = path.join(uploadDir, safeFilename);

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ [DELETE_SUCCESS] Deleted single screenshot: ${safeFilename}`);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "success", filename: safeFilename }));
        } catch (e: any) {
          console.error("❌ [DELETE_ERROR]", e);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "error", error: e.message }));
        }
      });
      return;
    }

    // API: Delete ALL Screenshots
    if (req.method === "POST" && (req.url === "/api/delete_all_screenshots" || req.url?.startsWith("/api/delete_all_screenshots"))) {
      try {
        const uploadDir = path.join(studioDir, "uploaded_screenshots");
        let count = 0;
        if (fs.existsSync(uploadDir)) {
          const files = fs.readdirSync(uploadDir);
          files.forEach(f => {
            if (f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".webp") || f.endsWith(".gif") || f.endsWith(".svg")) {
              fs.unlinkSync(path.join(uploadDir, f));
              count++;
            }
          });
        }
        console.log(`🗑️ [DELETE_ALL_SUCCESS] Deleted ${count} screenshots from uploaded_screenshots/`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "success", deletedCount: count }));
      } catch (e: any) {
        console.error("❌ [DELETE_ALL_ERROR]", e);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "error", error: e.message }));
      }
      return;
    }

    // API: List Uploaded Screenshots
    if (req.method === "GET" && (req.url === "/api/list_uploaded_screenshots" || req.url?.startsWith("/api/list_uploaded_screenshots"))) {
      const uploadDir = path.join(studioDir, "uploaded_screenshots");
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir)
          .filter(f => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".webp") || f.endsWith(".gif") || f.endsWith(".svg"));
        
        const detailed = files.map(name => {
          const filePath = path.join(uploadDir, name);
          let size = 0;
          let mtimeMs = 0;
          try {
            const st = fs.statSync(filePath);
            size = st.size;
            mtimeMs = st.mtimeMs;
          } catch {}
          return { name, size, mtimeMs, url: `/uploaded_screenshots/${name}` };
        }).sort((a, b) => b.mtimeMs - a.mtimeMs);

        res.writeHead(200, { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate"
        });
        res.end(JSON.stringify(detailed));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
      }
      return;
    }

    // API: Upload Matted Video Asset (streams raw binary straight to disk for arbitrary size)
    if (req.method === "POST" && req.url?.startsWith("/api/upload-video")) {
      const contentType = req.headers["content-type"] || "";

      // Fast path: raw binary body (browser fetch Blob/File) → stream directly to disk,
      // bounded memory, so arbitrarily large matted videos are accepted.
      if (!contentType.includes("application/json") && !contentType.includes("multipart/form-data")) {
        let parsedFilename = "MattedVideo.mp4";
        try {
          const urlObj = new URL(req.url || "", "http://localhost");
          parsedFilename = urlObj.searchParams.get("filename") || parsedFilename;
        } catch {}

        const uploadDir = path.join(studioDir, "uploaded_videos");
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const safeBase = path.basename(parsedFilename, path.extname(parsedFilename)).replace(/[^a-zA-Z0-9._-]/g, "_");
        const origExt = path.extname(parsedFilename).toLowerCase();
        const ext = /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(origExt) ? origExt : ".mp4";

        let finalFilename = safeBase + ext;
        let targetPath = path.join(uploadDir, finalFilename);
        if (fs.existsSync(targetPath)) {
          finalFilename = `${safeBase}_${Math.random().toString(36).substring(2, 6)}${ext}`;
          targetPath = path.join(uploadDir, finalFilename);
        }

        const tmpPath = targetPath + ".tmp-" + Date.now();
        const ws = fs.createWriteStream(tmpPath);
        let bytes = 0;

        ws.on("error", (e: any) => {
          try { fs.unlinkSync(tmpPath); } catch {}
          console.error("❌ [VIDEO_UPLOAD_ERROR]", e);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "error", error: e.message }));
        });

        ws.on("finish", () => {
          try {
            fs.renameSync(tmpPath, targetPath);
            console.log(`🎭 [VIDEO_UPLOAD_SUCCESS] Saved matted video: ${finalFilename} (${bytes} bytes)`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              status: "success",
              filename: finalFilename,
              url: `/uploaded_videos/${finalFilename}`,
              bytes
            }));
          } catch (e: any) {
            console.error("❌ [VIDEO_UPLOAD_ERROR]", e);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", error: e.message }));
          }
        });

        req.on("data", chunk => { bytes += chunk.length; });
        req.on("error", (e) => {
          try { ws.destroy(); fs.unlinkSync(tmpPath); } catch {}
          console.error("❌ [VIDEO_UPLOAD_REQ_ERROR]", e);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "error", error: e.message }));
        });
        req.pipe(ws);
        return;
      }

      // Buffered path: JSON (base64/data-URI) or multipart payloads
      const chunks: Buffer[] = [];
      req.on("data", chunk => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const rawBuffer = Buffer.concat(chunks);

          let parsedFilename: string | undefined;
          try {
            const urlObj = new URL(req.url || "", "http://localhost");
            parsedFilename = urlObj.searchParams.get("filename") || undefined;
          } catch {}

          let data = rawBuffer;
          let multipartFilename: string | undefined;
          if (contentType.includes("application/json")) {
            try {
              const parsed = JSON.parse(rawBuffer.toString("utf8"));
              const rawVideo = parsed.video || parsed.data || parsed.file || "";
              multipartFilename = parsed.filename || parsed.name;
              if (typeof rawVideo === "string" && rawVideo.startsWith("data:")) {
                const matches = rawVideo.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (matches) {
                  data = Buffer.from(matches[2], "base64");
                }
              } else if (typeof rawVideo === "string" && rawVideo.length > 0) {
                data = Buffer.from(rawVideo, "base64");
              }
            } catch {}
          } else if (contentType.includes("multipart/form-data")) {
            const extracted = await extractBinaryPayload(rawBuffer, contentType);
            data = extracted.data;
            multipartFilename = extracted.filename;
          }

          if (!data || data.length === 0) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", error: "Empty video data received" }));
            return;
          }

          let candidateName = parsedFilename || multipartFilename || "MattedVideo.mp4";
          const uploadDir = path.join(studioDir, "uploaded_videos");
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

          let finalFilename = candidateName.replace(/[^a-zA-Z0-9._-]/g, "_");
          if (!/\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(finalFilename)) {
            const ext = (finalFilename.split(".").pop() || "").toLowerCase();
            const extIsVideo = /^(mp4|webm|mov|m4v|mkv|avi)$/.test(ext);
            if (!extIsVideo) finalFilename += ".mp4";
          }

          let targetPath = path.join(uploadDir, finalFilename);
          if (fs.existsSync(targetPath)) {
            const ext = path.extname(finalFilename);
            const base = path.basename(finalFilename, ext);
            const randSuffix = Math.random().toString(36).substring(2, 6);
            finalFilename = `${base}_${randSuffix}${ext}`;
            targetPath = path.join(uploadDir, finalFilename);
          }

          fs.writeFileSync(targetPath, data);

          console.log(`🎭 [VIDEO_UPLOAD_SUCCESS] Saved matted video: ${finalFilename} (${data.length} bytes)`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            status: "success",
            filename: finalFilename,
            url: `/uploaded_videos/${finalFilename}`,
            bytes: data.length
          }));
        } catch (e: any) {
          console.error("❌ [VIDEO_UPLOAD_ERROR]", e);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "error", error: e.message }));
        }
      });
      return;
    }

    // API: Delete Single Matted Video
    if (req.method === "POST" && (req.url === "/api/delete_video" || req.url?.startsWith("/api/delete_video"))) {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          let filename = "";
          try {
            const parsed = JSON.parse(body);
            filename = parsed.filename;
          } catch {
            const urlObj = new URL(req.url || "", "http://localhost");
            filename = urlObj.searchParams.get("filename") || "";
          }

          if (!filename) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", error: "Missing filename" }));
            return;
          }

          const safeFilename = path.basename(filename);
          const uploadDir = path.join(studioDir, "uploaded_videos");
          const filePath = path.join(uploadDir, safeFilename);

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ [VIDEO_DELETE_SUCCESS] Deleted matted video: ${safeFilename}`);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "success", filename: safeFilename }));
        } catch (e: any) {
          console.error("❌ [VIDEO_DELETE_ERROR]", e);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "error", error: e.message }));
        }
      });
      return;
    }

    // API: Delete ALL Matted Videos
    if (req.method === "POST" && (req.url === "/api/delete_all_videos" || req.url?.startsWith("/api/delete_all_videos"))) {
      try {
        const uploadDir = path.join(studioDir, "uploaded_videos");
        let count = 0;
        if (fs.existsSync(uploadDir)) {
          const files = fs.readdirSync(uploadDir);
          files.forEach(f => {
            if (/\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(f)) {
              fs.unlinkSync(path.join(uploadDir, f));
              count++;
            }
          });
        }
        console.log(`🗑️ [VIDEO_DELETE_ALL_SUCCESS] Deleted ${count} matted videos from uploaded_videos/`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "success", deletedCount: count }));
      } catch (e: any) {
        console.error("❌ [VIDEO_DELETE_ALL_ERROR]", e);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "error", error: e.message }));
      }
      return;
    }

    // API: List Uploaded Matted Videos
    if (req.method === "GET" && (req.url === "/api/list_uploaded_videos" || req.url?.startsWith("/api/list_uploaded_videos"))) {
      const uploadDir = path.join(studioDir, "uploaded_videos");
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir)
          .filter(f => /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(f));

        const detailed = files.map(name => {
          const filePath = path.join(uploadDir, name);
          let size = 0;
          let mtimeMs = 0;
          try {
            const st = fs.statSync(filePath);
            size = st.size;
            mtimeMs = st.mtimeMs;
          } catch {}
          return { name, size, mtimeMs, url: `/uploaded_videos/${name}` };
        }).sort((a, b) => b.mtimeMs - a.mtimeMs);

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate"
        });
        res.end(JSON.stringify(detailed));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
      }
      return;
    }

    // Static Assets in docs/mini_run_studio/assets/
    if (decodedUrl.startsWith("/assets/")) {
      const relPath = decodedUrl.replace(/^\/assets\//, "");
      const fullPath = path.join(studioDir, "assets", relPath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        const stat = fs.statSync(fullPath);
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "image/jpeg",
          "Content-Length": stat.size,
          "Cache-Control": "public, max-age=3600"
        });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
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

    // Matted Video Assets in uploaded_videos/ (HTTP 206 Byte-Range Streaming)
    if (decodedUrl.startsWith("/uploaded_videos/")) {
      const relPath = decodedUrl.replace(/^\/uploaded_videos\//, "");
      const fullPath = path.join(studioDir, "uploaded_videos", relPath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        streamVideoWithRange(req, res, fullPath);
        return;
      }
    }

    // Static Assets in Yuan Prometheus Screenshots/font pairing and placement/
    if (decodedUrl.startsWith("/font_pairs/")) {
      const relPath = decodedUrl.replace(/^\/font_pairs\//, "");
      const fullPath = path.join(repoRoot, "Yuan Prometheus Screenshots/font pairing and placement", relPath);
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

    // Static Assets in Yuan Prometheus Screenshots/font JSON/
    if (decodedUrl.startsWith("/font_json/")) {
      const relPath = decodedUrl.replace(/^\/font_json\//, "");
      const fullPath = path.join(repoRoot, "Yuan Prometheus Screenshots/font JSON", relPath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        const stat = fs.statSync(fullPath);
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "application/json; charset=utf-8",
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
    console.log(`  🚀 Interactive Micro-Looping Studio on Port ${port}: http://16.192.95.115:${port}/`);
  });
  s.on("error", (e) => {
    console.warn(`[PORT_WARN] Port ${port} (${e.message})`);
  });
  
  s.on("upgrade", (req, socket, head) => {
    // Proxy WebSocket to Hub Daemon (25463) or Kanban UI (3484)
    const targetPort = (req.url && req.url.includes("/hub")) ? 25463 : 3484;
    const proxySocket = net.connect(targetPort, "127.0.0.1", () => {
      proxySocket.write(
        `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
        Object.entries(req.headers)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(", ") : val}\r\n`)
          .join("") +
        "\r\n"
      );
      if (head && head.length > 0) proxySocket.write(head);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });
    proxySocket.on("error", () => socket.destroy());
    socket.on("error", () => proxySocket.destroy());
  });

  return s;
}

const serverPort = Number(process.env.PORT) || 8080;
const server = createServerInstance(serverPort);
process.on("SIGINT", () => { server.close(); process.exit(0); });
process.on("SIGTERM", () => { server.close(); process.exit(0); });

// Keep event loop alive
setInterval(() => {}, 60000);
