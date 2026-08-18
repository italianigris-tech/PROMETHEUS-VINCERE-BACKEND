import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, execSync } from "node:child_process";
import { buildVideoAudioPlan } from "./video_audio_orchestrator";

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

const canonicalVideoPath = path.join(studioDir, "uploaded_input_video.mp4");
const manifestPath = path.join(studioDir, "extracted_temporal_manifest.json");

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
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".md": "text/markdown; charset=utf-8",
  ".ico": "image/x-icon",
};

/**
 * Probe video metadata using ffprobe bundled in Remotion
 */
function probeVideoFile(filePath: string): any {
  try {
    const ffprobeBin = path.join(repoRoot, "remotion-app/node_modules/@remotion/compositor-linux-x64-gnu/ffprobe");
    const cmd = `"${ffprobeBin}" -v quiet -print_format json -show_format -show_streams "${filePath}"`;
    const result = execSync(cmd, { encoding: "utf8" });
    const parsed = JSON.parse(result);
    const videoStream = parsed.streams?.find((s: any) => s.codec_type === "video");
    const audioStream = parsed.streams?.find((s: any) => s.codec_type === "audio");
    
    let fps = 23.98;
    if (videoStream?.r_frame_rate) {
      const parts = videoStream.r_frame_rate.split("/");
      if (parts.length === 2 && parseFloat(parts[1]) > 0) {
        fps = Math.round((parseFloat(parts[0]) / parseFloat(parts[1])) * 100) / 100;
      }
    }

    return {
      durationSeconds: parseFloat(parsed.format?.duration || videoStream?.duration || "60.1"),
      width: videoStream?.width || 720,
      height: videoStream?.height || 1280,
      fps: fps,
      videoCodec: videoStream?.codec_name || "h264",
      hasAudio: Boolean(audioStream),
      audioCodec: audioStream?.codec_name || null,
      fileSizeBytes: parseInt(parsed.format?.size || "0", 10) || fs.statSync(filePath).size,
    };
  } catch (e) {
    const stats = fs.statSync(filePath);
    return {
      durationSeconds: 60.1,
      width: 720,
      height: 1280,
      fps: 23.98,
      videoCodec: "h264",
      hasAudio: true,
      audioCodec: "aac",
      fileSizeBytes: stats.size,
    };
  }
}

/**
 * Resolve requested URL to disk file path safely.
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
      return { filePath: target, contentType: MIME_TYPES[ext] || "video/mp4" };
    }
  }

  if (cleanPath === "/uploaded_input_video.mp4") {
    if (fs.existsSync(canonicalVideoPath)) {
      return { filePath: canonicalVideoPath, contentType: "video/mp4" };
    }
  }

  if (cleanPath === "/studio" || cleanPath === "/presentation") {
    const presHtml = path.join(studioDir, "typography_treatment_presentation.html");
    if (fs.existsSync(presHtml)) {
      return { filePath: presHtml, contentType: MIME_TYPES[".html"] };
    }
  }

  const normalized = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, "");
  const studioCandidate = path.join(studioDir, normalized);
  if (fs.existsSync(studioCandidate) && fs.statSync(studioCandidate).isFile()) {
    const ext = path.extname(studioCandidate).toLowerCase();
    return { filePath: studioCandidate, contentType: MIME_TYPES[ext] || "application/octet-stream" };
  }

  return null;
}

// =========================================================================
// HTML: DEDICATED SPATIO-TEMPORAL VIDEO STUDIO & DROPZONE
// =========================================================================
const videoPlatformHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Prometheus — Spatio-Temporal Video Audio Studio</title>
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
      max-width: 1100px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .header-card {
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 24px;
      padding: 24px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
      position: relative;
    }
    .header-card h1 {
      font-size: clamp(22px, 4vw, 30px);
      font-weight: 900;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
    }
    .header-card p { color: var(--text-muted); font-size: 13.5px; }

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

    /* STUDIO LAYOUT */
    .studio-grid {
      display: grid;
      grid-template-columns: minmax(320px, 420px) 1fr;
      gap: 20px;
    }
    @media (max-width: 850px) {
      .studio-grid { grid-template-columns: 1fr; }
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 24px;
      padding: 22px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    }

    /* VIDEO PLAYER */
    .player-wrap {
      background: #000;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid var(--panel-border);
      position: relative;
      aspect-ratio: 9 / 16;
      max-height: 580px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.9);
      margin: 0 auto;
    }
    .player-wrap video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    /* AUDIO CONTROLS & TELEMETRY */
    .audio-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 10px;
    }
    .audio-header h2 { font-size: 16px; font-weight: 800; color: var(--accent-cyan); text-transform: uppercase; }
    .badge-live {
      background: rgba(16, 185, 129, 0.15);
      color: #10B981;
      border: 1px solid #10B981;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
    }

    .master-switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(0, 240, 255, 0.08);
      border: 1px solid rgba(0, 240, 255, 0.3);
      padding: 12px 16px;
      border-radius: 14px;
      margin-bottom: 16px;
    }
    .btn-toggle-audio {
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      color: #070913;
      border: none;
      padding: 8px 16px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
    }

    .sliders-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .slider-box {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.05);
      padding: 10px 14px;
      border-radius: 12px;
    }
    .slider-box label { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); font-weight: 700; margin-bottom: 4px; }
    .slider-box input[type="range"] { width: 100%; accent-color: var(--accent-cyan); cursor: pointer; }

    /* OSCILLOSCOPE & VU METERS */
    .scope-wrap {
      background: #02040A;
      border: 1px solid rgba(0, 240, 255, 0.3);
      border-radius: 14px;
      padding: 10px;
      margin-bottom: 16px;
      position: relative;
    }
    .scope-header {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: var(--accent-cyan);
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    canvas#scopeCanvas { width: 100%; height: 60px; display: block; }

    .vu-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 6px;
    }
    .vu-bar-bg { flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; }
    .vu-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #10B981, #FFE600, #FF0055); transition: width 0.05s; }

    /* REALTIME EVENT TICKER */
    .ticker-card {
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 12px;
      max-height: 180px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 11px;
    }
    .ticker-header { color: var(--accent-yellow); font-weight: 800; margin-bottom: 6px; font-size: 10.5px; text-transform: uppercase; }
    .ticker-log-item { padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--text-muted); }
    .ticker-log-item.active { color: var(--accent-cyan); font-weight: 700; }
  </style>
</head>
<body>

  <div class="container">
    
    <!-- HEADER -->
    <div class="header-card">
      <h1>Prometheus Spatio-Temporal Video Studio</h1>
      <p>Autonomous 5-Layer Sound Design Synthesizer locked to Real Ingested Video Dynamics (96 Cues @ 120 BPM)</p>
      
      <div class="top-nav">
        <a href="/typography_treatment_presentation.html" class="nav-btn">🎬 9:16 Typography Presentation</a>
        <a href="/paste" class="nav-btn">📸 Screenshot Dropzone</a>
        <a href="/video" class="nav-btn nav-btn-highlight">📹 Re-upload Video</a>
      </div>
    </div>

    <!-- MAIN STUDIO GRID -->
    <div class="studio-grid">
      
      <!-- LEFT: VIDEO PLAYER -->
      <div class="card" style="text-align: center;">
        <div class="player-wrap">
          <video id="studioVideo" src="/uploaded_input_video.mp4" controls playsinline></video>
        </div>
        <div style="margin-top: 12px; font-size: 12px; color: var(--text-muted);">
          <strong style="color:#FFF;">JATHO__DEVIN.mp4</strong> (720x1280 • 60.1s • 23.98 FPS)
        </div>
      </div>

      <!-- RIGHT: LIVE SPATIO-TEMPORAL AUDIO ENGINE -->
      <div class="card">
        <div class="audio-header">
          <h2>Spatio-Temporal Audio Engine</h2>
          <span class="badge-live" id="lblAudioStatus">Web Audio Active</span>
        </div>

        <div class="master-switch-row">
          <div>
            <div style="font-weight: 800; font-size: 13px;">Orchestral Sound Treatment</div>
            <div style="font-size: 11px; color: var(--text-muted);">96 Cues • 120 BPM Beat Pulse • 3D Panning</div>
          </div>
          <button class="btn-toggle-audio" id="btnAudioToggle" onclick="toggleAudioEngine()">
            🔊 Enable Live Audio
          </button>
        </div>

        <!-- VOLUME STEM SLIDERS -->
        <div class="sliders-grid">
          <div class="slider-box">
            <label><span>MUSIC BED (120 BPM)</span><span id="lblMusicVol">75%</span></label>
            <input type="range" min="0" max="100" value="75" oninput="setMusicVolume(this.value)">
          </div>
          <div class="slider-box">
            <label><span>SFX STEMS (3D SPATIAL)</span><span id="lblSfxVol">90%</span></label>
            <input type="range" min="0" max="100" value="90" oninput="setSfxVolume(this.value)">
          </div>
        </div>

        <!-- OSCILLOSCOPE & STEREO METERS -->
        <div class="scope-wrap">
          <div class="scope-header">
            <span>LIVE OSCILLOSCOPE & ACOUSTIC TELEMETRY</span>
            <span id="lblCurrentTime">00:00.00 / 01:00.10</span>
          </div>
          <canvas id="scopeCanvas" width="500" height="60"></canvas>

          <div class="vu-row" style="margin-top:8px;">
            <span style="font-size:10px; font-weight:800; width:14px; color:var(--accent-cyan);">L</span>
            <div class="vu-bar-bg"><div class="vu-fill" id="vuLeft"></div></div>
            <span style="font-size:10px; font-weight:800; width:14px; color:var(--accent-pink);">R</span>
            <div class="vu-bar-bg"><div class="vu-fill" id="vuRight"></div></div>
          </div>
        </div>

        <!-- REALTIME SPATIAL CUE LOG -->
        <div class="ticker-card">
          <div class="ticker-header">⚡ Real-Time Spatio-Temporal Cue Dispatcher</div>
          <div id="tickerList">
            <div class="ticker-log-item">Ready. Press Play on the video to trigger live spatial audio.</div>
          </div>
        </div>

      </div>

    </div>

  </div>

  <script>
    let audioPlan = null;
    let audioCtx = null;
    let masterGain = null;
    let musicGain = null;
    let sfxGain = null;
    let compressor = null;
    let analyser = null;
    let isAudioActive = false;
    let firedCues = new Set();

    const video = document.getElementById('studioVideo');
    const scopeCanvas = document.getElementById('scopeCanvas');
    const scopeCtx = scopeCanvas.getContext('2d');
    const tickerList = document.getElementById('tickerList');
    const vuLeft = document.getElementById('vuLeft');
    const vuRight = document.getElementById('vuRight');

    async function initAudioEngine() {
      if (audioCtx) return;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.85;

      musicGain = audioCtx.createGain();
      musicGain.gain.value = 0.75;

      sfxGain = audioCtx.createGain();
      sfxGain.gain.value = 0.90;

      compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;

      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(audioCtx.destination);

      isAudioActive = true;
      document.getElementById('btnAudioToggle').innerText = '✓ Audio Engine Active';
      document.getElementById('lblAudioStatus').innerText = 'Orchestra Synthesizing';

      startOscilloscope();
      startMusicMetronome();
    }

    async function fetchPlan() {
      try {
        const res = await fetch('/api/video_audio_plan');
        audioPlan = await res.json();
      } catch (e) {}
    }
    fetchPlan();

    function toggleAudioEngine() {
      if (!audioCtx) {
        initAudioEngine();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      video.play();
    }

    video.addEventListener('play', () => {
      if (!audioCtx) initAudioEngine();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    });

    video.addEventListener('seeked', () => {
      const cur = video.currentTime;
      firedCues = new Set([...audioPlan?.cues || []].filter(c => c.triggerTimestampSec < cur).map(c => c.id));
    });

    video.addEventListener('timeupdate', () => {
      const cur = video.currentTime;
      const min = Math.floor(cur / 60);
      const sec = (cur % 60).toFixed(2);
      document.getElementById('lblCurrentTime').innerText = (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec + ' / 01:00.10';

      if (!audioPlan || !audioCtx) return;

      audioPlan.cues.forEach(cue => {
        if (Math.abs(cur - cue.triggerTimestampSec) < 0.25 && !firedCues.has(cue.id)) {
          firedCues.add(cue.id);
          triggerSpatialSound(cue);
        }
      });
    });

    function triggerSpatialSound(cue) {
      if (!audioCtx) return;
      const now = audioCtx.currentTime;

      // Create Stem Routing Graph
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      const panner = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;

      // Filter settings based on depth plane
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cue.lowpassCutoffHz || 16000, now);

      // Stereo pan
      if (panner) panner.pan.setValueAtTime(Math.max(-1, Math.min(1, cue.pan || 0)), now);

      // Category Synthesizer Logic
      if (cue.category === 'IMPACT HITS' || cue.category === 'CINEMATIC HITS') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (cue.durationSec || 1.0));
      } else if (cue.category === 'WHOOSHES' || cue.category === 'SWEEPS') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(650, now + (cue.durationSec || 0.5));

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.35, now + (cue.durationSec * 0.4));
        gain.gain.exponentialRampToValueAtTime(0.001, now + (cue.durationSec || 0.5));
      } else if (cue.category === 'RISERS') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + (cue.durationSec || 0.45));

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.4, now + (cue.durationSec || 0.45));
        gain.gain.exponentialRampToValueAtTime(0.001, now + (cue.durationSec || 0.45) + 0.05);
      } else {
        // Telemetry chirp
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.setValueAtTime(1800, now + 0.04);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      }

      // Connect Node Chain
      osc.connect(gain);
      gain.connect(filter);
      if (panner) {
        filter.connect(panner);
        panner.connect(sfxGain);
      } else {
        filter.connect(sfxGain);
      }

      osc.start(now);
      osc.stop(now + (cue.durationSec || 1.0));

      logCue(cue);
    }

    function logCue(cue) {
      const row = document.createElement('div');
      row.className = 'ticker-log-item active';
      const panStr = cue.pan >= 0 ? '+' + cue.pan.toFixed(2) : cue.pan.toFixed(2);
      row.innerText = '[' + cue.triggerTimestampSec.toFixed(2) + 's] ' + cue.category + ' "' + cue.cueName + '" (Pan: ' + panStr + ', Z:' + cue.depthPlane + ')';
      tickerList.prepend(row);
      if (tickerList.children.length > 25) tickerList.removeChild(tickerList.lastChild);
    }

    function setMusicVolume(val) {
      document.getElementById('lblMusicVol').innerText = val + '%';
      if (musicGain) musicGain.gain.value = val / 100;
    }

    function setSfxVolume(val) {
      document.getElementById('lblSfxVol').innerText = val + '%';
      if (sfxGain) sfxGain.gain.value = val / 100;
    }

    function startMusicMetronome() {
      // 120 BPM Pulse Bed
      setInterval(() => {
        if (!video.paused && audioCtx && isAudioActive) {
          const now = audioCtx.currentTime;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(55, now);
          osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.connect(gain);
          gain.connect(musicGain);
          osc.start(now);
          osc.stop(now + 0.15);
        }
      }, 500); // 120 BPM = 500ms
    }

    function startOscilloscope() {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      function draw() {
        requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        scopeCtx.fillStyle = '#02040A';
        scopeCtx.fillRect(0, 0, scopeCanvas.width, scopeCanvas.height);

        scopeCtx.lineWidth = 2;
        scopeCtx.strokeStyle = '#00F0FF';
        scopeCtx.beginPath();

        const sliceWidth = scopeCanvas.width * 1.0 / bufferLength;
        let x = 0;
        let sum = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * scopeCanvas.height / 2;
          sum += Math.abs(dataArray[i] - 128);

          if (i === 0) scopeCtx.moveTo(x, y);
          else scopeCtx.lineTo(x, y);

          x += sliceWidth;
        }

        scopeCtx.lineTo(scopeCanvas.width, scopeCanvas.height / 2);
        scopeCtx.stroke();

        // VU meter update
        const avgLvl = Math.min(100, Math.round((sum / bufferLength) * 3.5));
        vuLeft.style.width = avgLvl + '%';
        vuRight.style.width = Math.min(100, Math.round(avgLvl * 0.95)) + '%';
      }

      draw();
    }
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

    // Route 1: Spatio-Temporal Video Studio (Root / or /video)
    if ((req.method === "GET" || req.method === "HEAD") && 
        (req.url === "/" || req.url === "/video" || req.url === "/studio")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(videoPlatformHtml);
      return;
    }

    // API: Return Video Audio Orchestral Plan (96 Cues)
    if (req.method === "GET" && req.url === "/api/video_audio_plan") {
      try {
        const plan = buildVideoAudioPlan();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(plan));
        return;
      } catch (e: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
        return;
      }
    }

    // API: Stream Large Video Upload to Disk
    if (req.method === "POST" && req.url === "/api/upload_video") {
      const rawHeaderName = req.headers["x-file-name"];
      let filename = "uploaded_video.mp4";
      if (typeof rawHeaderName === "string" && rawHeaderName) {
        try { filename = decodeURIComponent(rawHeaderName); } catch { filename = rawHeaderName; }
      }

      const ext = (path.extname(filename) || ".mp4").toLowerCase();
      const baseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
      const timestamp = Date.now();
      const safeFilename = `${baseName}_${timestamp}${ext}`;
      const targetPath = path.join(uploadedVideosDir, safeFilename);

      const fileWriteStream = fs.createWriteStream(targetPath);
      req.pipe(fileWriteStream);

      fileWriteStream.on("finish", () => {
        try {
          fs.copyFileSync(targetPath, canonicalVideoPath);
          const metadata = probeVideoFile(targetPath);
          console.log(`\n📹 [VIDEO_UPLOAD_SAVED] Saved video: ${safeFilename} (${(metadata.fileSizeBytes / 1024 / 1024).toFixed(2)} MB)`);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            filename: safeFilename,
            savedPath: targetPath,
            canonicalPath: canonicalVideoPath,
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

    // Serve Static Files
    const resolved = resolveFilePath(req.url || "/");
    if (!resolved) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<html><body style="background:#070913;color:#fff;padding:40px;text-align:center;"><h2>404 — Not Found</h2><p><a href="/" style="color:#00F0FF;">Open Spatio-Temporal Video Studio</a></p></body></html>`);
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
    console.log(`  🚀 EC2 Video & Audio Studio on Port ${port}: http://16.192.95.115:${port}/`);
  });
  s.on("error", (e) => {
    console.warn(`[PORT_BIND_WARN] Port ${port} could not be bound (${e.message})`);
  });
  return s;
}

// Kill zombie previous server instance to cleanly bind port 8080
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

const candidatePorts = [8080, 3000, 5000, 8000, 9000];
const activeServers = candidatePorts.map(p => createServerInstance(p));

console.log("================================================================================");
console.log("  🚀 PROMETHEUS SPATIO-TEMPORAL VIDEO STUDIO RUNNING");
console.log("================================================================================");
console.log("  Video Studio:   http://16.192.95.115:8080/");
console.log("  Presentation:   http://16.192.95.115:8080/typography_treatment_presentation.html");
console.log("  Binding:        0.0.0.0 across ports 8080, 3000, 5000, 8000, 9000");
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
  ltProcess.on("error", (e) => console.warn("[TUNNEL_WARN] Localtunnel error:", e.message));

  // 2. Launch Cloudflare Tunnel
  const cfProcess = spawn("npx", ["-y", "cloudflared", "tunnel", "--url", `http://127.0.0.1:${port}`], {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  cfProcess.on("error", (e) => console.warn("[TUNNEL_WARN] Cloudflare error:", e.message));

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

process.on("SIGINT", () => { activeServers.forEach(s => s.close()); process.exit(0); });
process.on("SIGTERM", () => { activeServers.forEach(s => s.close()); process.exit(0); });
process.on("uncaughtException", (err) => {
  console.error("[SERVER_UNCAUGHT_EXCEPTION]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[SERVER_UNHANDLED_REJECTION]", reason);
});

// Strongly referenced heartbeat to keep Node event loop alive 24/7
setInterval(() => {
  // 30s heartbeat
}, 30000);
