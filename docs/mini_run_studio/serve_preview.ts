import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

const studioDir = __dirname;
const repoRoot = path.resolve(studioDir, "../..");
const canonicalVideoPath = path.join(studioDir, "uploaded_input_video.mp4");
const cuesJsonPath = path.join(studioDir, "authoritative_video_cues.json");
const soundJsonPath = path.join(studioDir, "authoritative_sound_treatment.json");
const soundFxDir = path.join(repoRoot, "SOUND FX");
const uploadsDir = path.join(studioDir, "uploaded_screenshots");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const fontPairingScreenshotsDir = path.join(repoRoot, "Yuan Prometheus Screenshots/font pairing and placement");

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
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
};

const studioHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Prometheus — Authoritative Sound Design & JSON Inspector</title>
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
      max-width: 1200px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .header-card {
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 20px;
      padding: 18px 24px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    }
    .header-card h1 {
      font-size: clamp(20px, 3.5vw, 26px);
      font-weight: 900;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 4px;
    }
    .header-card p { color: var(--text-muted); font-size: 13px; }

    .studio-grid {
      display: grid;
      grid-template-columns: minmax(320px, 420px) 1fr;
      gap: 20px;
    }
    @media (max-width: 900px) {
      .studio-grid { grid-template-columns: 1fr; }
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
    }

    .player-wrap {
      background: #000;
      border-radius: 16px;
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

    /* CONTROLS ROW */
    .controls-row {
      margin-top: 14px;
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .btn-audio-toggle {
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      color: #070913;
      border: none;
      padding: 8px 14px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-audio-toggle.active {
      background: linear-gradient(135deg, #10B981, #00F0FF);
      color: #070913;
    }

    /* TABS */
    .tab-bar {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 10px;
      margin-bottom: 14px;
      justify-content: space-between;
      align-items: center;
    }
    .tab-btn-group { display: flex; gap: 8px; }
    .tab-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      color: var(--text-muted);
      padding: 6px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .tab-btn.active {
      background: var(--accent-cyan);
      color: #070913;
      border-color: var(--accent-cyan);
      font-weight: 900;
    }
    .btn-download-json {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--panel-border);
      color: #FFF;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      text-decoration: none;
    }
    .btn-download-json:hover { background: rgba(255, 255, 255, 0.16); }

    /* TABLE */
    .table-scroll {
      max-height: 480px;
      overflow-y: auto;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0, 0, 0, 0.4);
    }
    table { width: 100%; border-collapse: collapse; font-size: 11px; font-family: monospace; }
    th { background: rgba(0, 240, 255, 0.08); color: var(--accent-cyan); padding: 8px 10px; text-align: left; position: sticky; top: 0; z-index: 2; border-bottom: 1px solid rgba(255,255,255,0.1); }
    td { padding: 7px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--text-muted); vertical-align: middle; }
    tr:hover td { background: rgba(255, 255, 255, 0.05); color: #FFF; }
    tr.active-row td { background: rgba(0, 240, 255, 0.18); color: #FFF; font-weight: 700; }

    .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .tag-text { background: rgba(255, 230, 0, 0.2); color: #FFE600; border: 1px solid rgba(255, 230, 0, 0.4); }
    .tag-whoosh { background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.4); }
    .tag-hit { background: rgba(255, 0, 85, 0.2); color: #FF0055; border: 1px solid rgba(255, 0, 85, 0.4); }
    .tag-sweep { background: rgba(0, 240, 255, 0.2); color: #00F0FF; border: 1px solid rgba(0, 240, 255, 0.4); }
    .tag-ui { background: rgba(139, 92, 246, 0.2); color: #8B5CF6; border: 1px solid rgba(139, 92, 246, 0.4); }

    .btn-audition {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--panel-border);
      color: var(--accent-cyan);
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      cursor: pointer;
      font-weight: 700;
      white-space: nowrap;
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
      <h1>Prometheus Sound Design & Authoritative JSON Studio</h1>
      <p>100% Real Audio Samples • 282 Visual-to-Audio Mappings • Sub-Frame Synchronized</p>
    </div>

    <div class="studio-grid">
      
      <!-- LEFT: VIDEO PLAYER -->
      <div class="card">
        <div class="player-wrap">
          <video id="studioVideo" src="/uploaded_input_video.mp4" controls playsinline></video>
        </div>
        
        <div class="controls-row">
          <button class="btn-audio-toggle" id="btnAudioToggle" onclick="toggleRealAudioPlayback()">
            🔊 Enable Real SFX Audio (282 Cues)
          </button>
          <div style="font-size: 11.5px; color: var(--text-muted);">
            <strong id="lblTime">00:00.00</strong> / 01:00.10
          </div>
        </div>
      </div>

      <!-- RIGHT: DUAL TABS (SCRUBBABLE TABLE & JSON EXPLORER) -->
      <div class="card">
        
        <div class="tab-bar">
          <div class="tab-btn-group">
            <button class="tab-btn active" id="tabTableBtn" onclick="showTab('table')">📊 Sound Treatment (282 Cues)</button>
            <button class="tab-btn" id="tabJsonBtn" onclick="showTab('json')">{ } Authoritative JSON</button>
          </div>
          <a href="/api/authoritative_sound_treatment" target="_blank" class="btn-download-json">📥 Raw JSON API</a>
        </div>

        <!-- TAB 1: TABLE -->
        <div class="table-scroll" id="tableView">
          <table>
            <thead>
              <tr>
                <th>TIME</th>
                <th>CATEGORY</th>
                <th>VISUAL TRIGGER</th>
                <th>ASSIGNED REAL SFX</th>
                <th>PAN</th>
                <th>AUDITION</th>
              </tr>
            </thead>
            <tbody id="treatmentTbody">
              <tr><td colspan="6" style="text-align:center; padding:20px;">Loading sound treatment manifest...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- TAB 2: JSON CODE VIEW -->
        <pre id="jsonView">Loading JSON data...</pre>

      </div>

    </div>

  </div>

  <script>
    const video = document.getElementById('studioVideo');
    let soundManifest = null;
    let audioCtx = null;
    let audioBuffers = new Map();
    let isRealAudioActive = false;
    let firedSet = new Set();

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
        else if (t.soundDesign.category === 'WHOOSHES' || t.soundDesign.category === 'SWOOSHES') tagClass = 'tag-whoosh';
        else if (t.soundDesign.category === 'IMPACT HITS' || t.soundDesign.category === 'CINEMATIC HITS') tagClass = 'tag-hit';
        else if (t.soundDesign.category === 'SWEEPS' || t.soundDesign.category === 'RISERS') tagClass = 'tag-sweep';

        const panStr = t.soundDesign.stereoPan >= 0 ? '+' + t.soundDesign.stereoPan.toFixed(2) : t.soundDesign.stereoPan.toFixed(2);

        return \`
          <tr id="row-\${idx}">
            <td><strong style="color:#FFF; cursor:pointer;" onclick="seekVideo(\${t.timestampSeconds})">\${t.timestampSeconds.toFixed(2)}s</strong></td>
            <td><span class="tag \${tagClass}">\${t.soundDesign.category}</span></td>
            <td><strong>\${t.visualTrigger.elementName}</strong><br><span style="font-size:10px; color:#64748B;">\${t.visualTrigger.description}</span></td>
            <td><strong>\${t.soundDesign.soundName}</strong><br><span style="font-size:9.5px; color:#38BDF8;">\${t.soundDesign.soundFile.replace('SOUND FX/', '')}</span></td>
            <td>\${panStr}</td>
            <td><button class="btn-audition" onclick="auditionSound('\${t.soundDesign.audioUrl}', \${t.soundDesign.stereoPan}, \${t.soundDesign.lowpassCutoffHz}, \${t.soundDesign.gainDb})">▶ Play</button></td>
          </tr>
        \`;
      }).join('');
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

    function initAudio() {
      if (audioCtx) return;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    async function getAudioBuffer(url) {
      initAudio();
      if (audioBuffers.has(url)) return audioBuffers.get(url);
      try {
        const res = await fetch(url);
        const arrayBuf = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        audioBuffers.set(url, decoded);
        return decoded;
      } catch (e) { return null; }
    }

    async function auditionSound(url, pan = 0, cutoff = 18000, gainDb = -3.0) {
      initAudio();
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const buf = await getAudioBuffer(url);
      if (!buf) return;

      const source = audioCtx.createBufferSource();
      source.buffer = buf;

      const gain = audioCtx.createGain();
      const linGain = Math.pow(10, gainDb / 20);
      gain.gain.setValueAtTime(linGain, audioCtx.currentTime);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, audioCtx.currentTime);

      const panner = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
      if (panner) panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), audioCtx.currentTime);

      source.connect(gain);
      gain.connect(filter);
      if (panner) {
        filter.connect(panner);
        panner.connect(audioCtx.destination);
      } else {
        filter.connect(audioCtx.destination);
      }

      source.start();
    }

    function toggleRealAudioPlayback() {
      initAudio();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      isRealAudioActive = !isRealAudioActive;
      const btn = document.getElementById('btnAudioToggle');
      if (isRealAudioActive) {
        btn.classList.add('active');
        btn.innerText = '✓ Real SFX Audio Active (282 Cues)';
      } else {
        btn.classList.remove('active');
        btn.innerText = '🔊 Enable Real SFX Audio (282 Cues)';
      }
    }

    video.addEventListener('timeupdate', () => {
      const cur = video.currentTime;
      const min = Math.floor(cur / 60);
      const sec = (cur % 60).toFixed(2);
      document.getElementById('lblTime').innerText = (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;

      if (!soundManifest) return;

      soundManifest.treatments.forEach((t, idx) => {
        const row = document.getElementById('row-' + idx);
        if (Math.abs(cur - t.timestampSeconds) < 0.25) {
          if (row) row.classList.add('active-row');
          if (isRealAudioActive && !firedSet.has(t.id)) {
            firedSet.add(t.id);
            auditionSound(t.soundDesign.audioUrl, t.soundDesign.stereoPan, t.soundDesign.lowpassCutoffHz, t.soundDesign.gainDb);
          }
        } else {
          if (row) row.classList.remove('active-row');
        }
      });
    });

    video.addEventListener('seeked', () => {
      const cur = video.currentTime;
      firedSet = new Set(soundManifest?.treatments?.filter(t => t.timestampSeconds < cur).map(t => t.id) || []);
    });

    loadData();
  </script>
</body>
</html>`;

// =========================================================================
// HTML: DEDICATED SCREENSHOT DROPZONE & COMPARISON GALLERY (/paste)
// =========================================================================
const pasteHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Prometheus — Screenshot Gallery & Comparison Portal</title>
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px 60px;
    }
    .header {
      width: 100%;
      max-width: 1100px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--panel-border);
      flex-wrap: wrap;
      gap: 12px;
    }
    .header h1 {
      font-size: 22px;
      font-weight: 800;
      background: linear-gradient(135deg, #00F0FF 0%, #8B5CF6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .nav-links {
      display: flex;
      gap: 10px;
    }
    .nav-btn {
      background: rgba(255,255,255,0.06);
      color: #FFF;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid var(--panel-border);
      transition: all 0.2s ease;
    }
    .nav-btn:hover {
      background: var(--accent-cyan);
      color: #000;
      border-color: var(--accent-cyan);
    }
    .container {
      width: 100%;
      max-width: 1100px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .dropzone-card {
      background: var(--card-bg);
      border: 2px dashed rgba(0, 240, 255, 0.35);
      border-radius: 16px;
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }
    .dropzone-card:hover, .dropzone-card.drag-over {
      border-color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.04);
      transform: translateY(-2px);
    }
    .dropzone-icon {
      font-size: 42px;
      margin-bottom: 12px;
    }
    .dropzone-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .dropzone-subtitle {
      font-size: 13px;
      color: var(--text-muted);
    }
    .status-bar {
      margin-top: 12px;
      font-size: 13px;
      font-weight: 600;
      min-height: 20px;
    }
    .tabs-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .tab-group {
      display: flex;
      gap: 8px;
    }
    .tab-btn {
      background: rgba(255,255,255,0.05);
      color: var(--text-muted);
      border: 1px solid var(--panel-border);
      padding: 8px 18px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
      transition: all 0.2s;
    }
    .tab-btn.active {
      background: var(--accent-cyan);
      color: #000;
      border-color: var(--accent-cyan);
    }
    .action-group {
      display: flex;
      gap: 8px;
    }
    .btn-action {
      background: rgba(255, 0, 85, 0.12);
      color: #FF0055;
      border: 1px solid rgba(255, 0, 85, 0.3);
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      transition: all 0.2s;
    }
    .btn-action:hover {
      background: #FF0055;
      color: #FFF;
    }
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
    }
    .gallery-item {
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: all 0.2s;
    }
    .gallery-item:hover {
      border-color: rgba(0, 240, 255, 0.5);
      transform: translateY(-2px);
    }
    .thumb-wrap {
      width: 100%;
      height: 240px;
      background: #02040A;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      cursor: pointer;
    }
    .thumb-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      transition: transform 0.2s;
    }
    .gallery-item:hover .thumb-img {
      transform: scale(1.03);
    }
    .item-meta {
      padding: 10px 12px;
      font-size: 12px;
      background: rgba(0,0,0,0.3);
      border-top: 1px solid var(--panel-border);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .item-name {
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-main);
    }
    .item-info {
      display: flex;
      justify-content: space-between;
      color: var(--text-muted);
      font-size: 11px;
    }
    .btn-delete-item {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #FFF;
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
      z-index: 5;
    }
    .btn-delete-item:hover {
      background: #FF0055;
      border-color: #FF0055;
    }
    /* Lightbox Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.92);
      z-index: 9999;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal-overlay.active {
      display: flex;
    }
    .modal-img {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 0 40px rgba(0, 240, 255, 0.2);
    }
    .modal-close {
      position: absolute;
      top: 20px;
      right: 24px;
      background: rgba(255,255,255,0.1);
      border: none;
      color: #FFF;
      font-size: 28px;
      cursor: pointer;
      padding: 4px 14px;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📸 Prometheus — Screenshot Dropzone & Comparison Gallery</h1>
    <div class="nav-links">
      <a href="/" class="nav-btn">🎵 Sound Studio</a>
      <a href="/typography_treatment_presentation.html" class="nav-btn">✨ Presentation Studio</a>
    </div>
  </div>

  <div class="container">
    <div class="dropzone-card" id="dropzone" onclick="document.getElementById('fileInput').click()">
      <div class="dropzone-icon">📋</div>
      <div class="dropzone-title">Click to Upload, Drag & Drop, or Press <kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">Ctrl+V</kbd> to Paste</div>
      <div class="dropzone-subtitle">Drop screenshots of typography, layout violations, or reference alignments</div>
      <div class="status-bar" id="statusBar"></div>
      <input type="file" id="fileInput" multiple accept="image/*" style="display: none;">
    </div>

    <div class="tabs-bar">
      <div class="tab-group">
        <button class="tab-btn active" id="tabUploads" onclick="switchTab('uploads')">Uploaded Screenshots (<span id="uploadsCount">0</span>)</button>
        <button class="tab-btn" id="tabCorpus" onclick="switchTab('corpus')">Font Corpus 45 References (<span id="corpusCount">45</span>)</button>
      </div>
      <div class="action-group">
        <button class="btn-action" onclick="clearAllUploads()">🗑️ Clear All Uploads</button>
      </div>
    </div>

    <div class="gallery-grid" id="galleryGrid"></div>
  </div>

  <div class="modal-overlay" id="modalOverlay" onclick="closeModal()">
    <button class="modal-close" onclick="closeModal()">✕</button>
    <img src="" class="modal-img" id="modalImg" onclick="event.stopPropagation()">
  </div>

  <script>
    let currentTab = 'uploads';
    let localUploads = [];
    let localCorpus = [];

    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const statusBar = document.getElementById('statusBar');
    const galleryGrid = document.getElementById('galleryGrid');
    const uploadsCount = document.getElementById('uploadsCount');
    const corpusCount = document.getElementById('corpusCount');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalImg = document.getElementById('modalImg');

    // Clipboard Paste Listener
    window.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      const files = [];
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          files.push(blob);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        await uploadFiles(files);
      }
    });

    // Drag & Drop
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) await uploadFiles(files);
    });

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) await uploadFiles(files);
      fileInput.value = '';
    });

    async function uploadFiles(files) {
      statusBar.innerText = '⏳ Uploading ' + files.length + ' image(s)...';
      statusBar.style.color = 'var(--accent-cyan)';

      const payloadFiles = [];
      for (const f of files) {
        const dataUrl = await readFileAsDataUrl(f);
        payloadFiles.push({ filename: f.name || 'pasted_image.png', dataUrl: dataUrl });
      }

      try {
        const res = await fetch('/api/upload-paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: payloadFiles })
        });
        const data = await res.json();
        if (data.success) {
          statusBar.innerText = '✔ Successfully uploaded ' + (data.count || files.length) + ' image(s)!';
          statusBar.style.color = 'var(--accent-green)';
          await fetchUploads();
          switchTab('uploads');
        } else {
          statusBar.innerText = '✖ Upload failed: ' + (data.error || 'Unknown error');
          statusBar.style.color = 'var(--accent-pink)';
        }
      } catch (err) {
        statusBar.innerText = '✖ Upload error: ' + err.message;
        statusBar.style.color = 'var(--accent-pink)';
      }
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function switchTab(tab) {
      currentTab = tab;
      document.getElementById('tabUploads').classList.toggle('active', tab === 'uploads');
      document.getElementById('tabCorpus').classList.toggle('active', tab === 'corpus');
      renderCurrentTab();
    }

    function renderCurrentTab() {
      if (currentTab === 'uploads') {
        renderGrid(localUploads, true);
      } else {
        renderGrid(localCorpus, false);
      }
    }

    async function fetchUploads() {
      try {
        const res = await fetch('/api/list_uploaded_screenshots?t=' + Date.now());
        const data = await res.json();
        localUploads = data.images || [];
        uploadsCount.innerText = localUploads.length;
        if (currentTab === 'uploads') renderCurrentTab();
      } catch (err) {
        console.error('Fetch uploads failed:', err);
      }
    }

    async function fetchCorpus() {
      try {
        const res = await fetch('/api/list_corpus_screenshots?t=' + Date.now());
        const data = await res.json();
        localCorpus = data.images || [];
        corpusCount.innerText = localCorpus.length;
        if (currentTab === 'corpus') renderCurrentTab();
      } catch (err) {
        console.error('Fetch corpus failed:', err);
      }
    }

    function renderGrid(images, allowDelete) {
      galleryGrid.innerHTML = '';
      if (images.length === 0) {
        galleryGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No images in this gallery yet. Paste or drop images above!</div>';
        return;
      }

      images.forEach(img => {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        if (allowDelete) {
          const delBtn = document.createElement('button');
          delBtn.className = 'btn-delete-item';
          delBtn.innerText = '✕';
          delBtn.title = 'Delete screenshot';
          delBtn.onclick = (e) => { e.stopPropagation(); deleteImage(img.name); };
          item.appendChild(delBtn);
        }

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'thumb-wrap';
        thumbWrap.onclick = () => openModal(img.url);

        const imgEl = document.createElement('img');
        imgEl.src = img.url;
        imgEl.className = 'thumb-img';
        imgEl.loading = 'lazy';
        thumbWrap.appendChild(imgEl);

        const meta = document.createElement('div');
        meta.className = 'item-meta';
        const sizeKb = Math.round((img.size || 0) / 1024);
        const dateStr = img.mtime ? new Date(img.mtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
        meta.innerHTML = 
          '<div class="item-name" title="' + img.name + '">' + img.name + '</div>' +
          '<div class="item-info"><span>' + sizeKb + ' KB</span><span>' + dateStr + '</span></div>';

        item.appendChild(thumbWrap);
        item.appendChild(meta);
        galleryGrid.appendChild(item);
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
        await fetchUploads();
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    }

    async function clearAllUploads() {
      if (!confirm('Clear all uploaded screenshots?')) return;
      try {
        await fetch('/api/clear_uploaded_screenshots', { method: 'POST' });
        localUploads = [];
        uploadsCount.innerText = '0';
        renderCurrentTab();
      } catch (err) {
        alert('Clear failed: ' + err.message);
      }
    }

    function openModal(url) {
      modalImg.src = url;
      modalOverlay.classList.add('active');
    }

    function closeModal() {
      modalOverlay.classList.remove('active');
      modalImg.src = '';
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Boot
    fetchUploads();
    fetchCorpus();
    setInterval(fetchUploads, 3000);
  </script>
</body>
</html>`;

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

    // Main Sound Design Studio App
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url === "/" || req.url === "/sound" || req.url === "/video")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (req.method === "HEAD") { res.end(); return; }
      res.end(studioHtml);
      return;
    }

    // Route 2: Screenshot Dropzone & Comparison Gallery (/paste)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url === "/paste" || req.url === "/paste/")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (req.method === "HEAD") { res.end(); return; }
      res.end(pasteHtmlContent);
      return;
    }

    // Route 3: Typography Treatment Presentation Studio
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url === "/typography_treatment_presentation.html" || req.url === "/presentation" || req.url === "/studio")) {
      const presPath = path.join(studioDir, "typography_treatment_presentation.html");
      if (fs.existsSync(presPath)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(presPath).pipe(res);
        return;
      }
    }

    // API: Batch Upload Pasted Screenshots
    if (req.method === "POST" && req.url === "/api/upload-paste") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          const incomingFiles = Array.isArray(parsed.files) ? parsed.files : [parsed];
          const savedResults = [];

          for (const item of incomingFiles) {
            const dataUrl = item.dataUrl || item.base64 || item.image;
            if (!dataUrl) continue;
            const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9\+\-]+);base64,(.+)$/);
            if (!matches) continue;

            const format = matches[1].toLowerCase().replace("jpeg", "jpg");
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, "base64");

            const rawOriginal = item.filename || item.name || "screenshot";
            const ext = path.extname(rawOriginal) || `.${format}`;
            const base = path.basename(rawOriginal, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(2, 6);
            const safeName = `${base}_${timestamp}_${randomSuffix}${ext}`;
            const targetPath = path.join(uploadsDir, safeName);

            fs.writeFileSync(targetPath, buffer);
            console.log(`\n📸 [BATCH_UPLOAD_SAVED] Saved screenshot (${buffer.length} bytes): ${safeName}`);
            savedResults.push({ name: safeName, size: buffer.length, url: `/uploaded_screenshots/${encodeURIComponent(safeName)}` });
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, count: savedResults.length, files: savedResults }));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // API: List Uploaded Screenshots
    if (req.method === "GET" && req.url?.startsWith("/api/list_uploaded_screenshots")) {
      try {
        const files = fs.readdirSync(uploadsDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
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

    // API: List Corpus Reference Screenshots (45 Font Pairings)
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
        }).sort((a, b) => {
          const numA = parseInt(a.name.match(/\d+/)?.[0] || "0", 10);
          const numB = parseInt(b.name.match(/\d+/)?.[0] || "0", 10);
          return numA - numB;
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

    // API: Delete Specific Uploaded Screenshot
    if (req.method === "POST" && req.url === "/api/delete_uploaded_screenshot") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          const { filename } = JSON.parse(body);
          if (!filename) throw new Error("Filename missing");
          const safeName = path.basename(filename);
          const target = path.join(uploadsDir, safeName);
          if (fs.existsSync(target)) {
            fs.unlinkSync(target);
            console.log(`\n🗑️ [IMAGE_DELETED] Deleted: ${safeName}`);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // API: Clear All Uploaded Screenshots
    if (req.method === "POST" && req.url === "/api/clear_uploaded_screenshots") {
      try {
        const files = fs.readdirSync(uploadsDir);
        files.forEach(f => {
          try { fs.unlinkSync(path.join(uploadsDir, f)); } catch {}
        });
        console.log(`\n🗑️ [ALL_IMAGES_CLEARED] Cleared all uploaded screenshots.`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    // API: Authoritative Sound Treatment JSON
    if (req.method === "GET" && req.url === "/api/authoritative_sound_treatment") {
      if (fs.existsSync(soundJsonPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        fs.createReadStream(soundJsonPath).pipe(res);
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ treatments: [] }));
      }
      return;
    }

    // API: Authoritative Video Cues
    if (req.method === "GET" && req.url === "/api/authoritative_cues") {
      if (fs.existsSync(cuesJsonPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        fs.createReadStream(cuesJsonPath).pipe(res);
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ cues: [] }));
      }
      return;
    }

    // Static Route for Uploaded Screenshots
    let decodedUrl = req.url || "";
    try { decodedUrl = decodeURIComponent(req.url || ""); } catch {}

    if (decodedUrl.startsWith("/uploaded_screenshots/")) {
      const relPath = decodedUrl.replace(/^\/uploaded_screenshots\//, "");
      const fullPath = path.join(uploadsDir, path.basename(relPath));
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "image/png",
          "Cache-Control": "no-cache"
        });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
    }

    // Static Route for Font Pairing Corpus Screenshots
    if (decodedUrl.startsWith("/corpus_screenshots/")) {
      const relPath = decodedUrl.replace(/^\/corpus_screenshots\//, "");
      const fullPath = path.join(fontPairingScreenshotsDir, path.basename(relPath));
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "image/png",
          "Cache-Control": "public, max-age=3600"
        });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
    }

    // Static Video File
    if (req.url === "/uploaded_input_video.mp4") {
      if (fs.existsSync(canonicalVideoPath)) {
        const stat = fs.statSync(canonicalVideoPath);
        res.writeHead(200, {
          "Content-Type": "video/mp4",
          "Content-Length": stat.size,
          "Cache-Control": "no-cache"
        });
        fs.createReadStream(canonicalVideoPath).pipe(res);
        return;
      }
    }

    // Static Audio Routing for SOUND FX Library
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

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  s.listen(port, "0.0.0.0", () => {
    console.log(`  🚀 Authoritative Sound Design Studio running on Port ${port}: http://16.192.95.115:${port}/`);
  });
  s.on("error", (e) => {
    console.warn(`[PORT_WARN] Port ${port} (${e.message})`);
  });
  return s;
}

const server = createServerInstance(8080);


process.on("SIGINT", () => { server.close(); process.exit(0); });
process.on("SIGTERM", () => { server.close(); process.exit(0); });

// Strongly referenced keepalive timer
setInterval(() => {}, 60000);

