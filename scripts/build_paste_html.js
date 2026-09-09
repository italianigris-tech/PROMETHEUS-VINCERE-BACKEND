import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const studioDir = path.join(repoRoot, "docs", "mini_run_studio");
const uploadDir = path.join(studioDir, "uploaded_screenshots");
const cranialDir = path.join(repoRoot, "Yuan Prometheus Screenshots", "cranial font placement");
const refDir = path.join(repoRoot, "Yuan Prometheus Screenshots", "font pairing and placement");
const videoDir = path.join(studioDir, "uploaded_videos");
const fontJsonDir = path.join(repoRoot, "Yuan Prometheus Screenshots", "font JSON");
const cranialJsonDir = path.join(repoRoot, "Yuan Prometheus Screenshots", "cranial font JSON");

function getFiles(dir, filterFn) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(filterFn).map(name => {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    return { name, size: st.size, mtimeMs: st.mtimeMs };
  }).sort((a, b) => b.mtimeMs - a.mtimeMs);
}

// ---------------------------------------------------------------------------
// Load and Index All Font JSON Profiles
// ---------------------------------------------------------------------------
function loadFontProfiles() {
  const map = {};
  const loadFrom = (dir, isCranial) => {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const fullPath = path.join(dir, file);
        const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        const stem = file.replace(/\.json$/, "");
        const layers = data.typography_layers || [];
        const firstLayer = layers[0] || {};
        const heroLayer = layers.find(l => l.role === "hero_keyword") || layers[layers.length - 1] || firstLayer;
        
        const profile = {
          id: stem,
          filename: file,
          profile_name: data.profile_name || stem,
          version: data.version || "1.0.0",
          is_cranial: isCranial || Boolean(data.cranial_spec || stem.includes("cranial")),
          paired_image: data.metadata?.paired_image || (stem + ".png"),
          overall_mood: data.metadata?.overall_mood || data.metadata?.treatment_notes || "",
          total_words: data.metadata?.total_word_count || layers.length || 0,
          total_chars: data.metadata?.total_character_count || 0,
          dominant_zone: data.cranial_spec?.dominant_zone || data.layout_rules?.vertical_position || "standard",
          primary_font: firstLayer.font_family || "Modern Sans",
          primary_weight: firstLayer.font_style?.weight || 700,
          accent_font: (heroLayer.font_family && heroLayer.font_family !== firstLayer.font_family ? heroLayer.font_family : (heroLayer.accent_font || "")) || "",
          accent_weight: heroLayer.font_style?.weight || 900,
          layer_count: layers.length,
          layers: layers.map(l => ({
            name: l.layer_name || l.role || "layer",
            role: l.role || "text",
            text: l.raw_text || l.sample_text || "",
            font: l.font_family || "Inter",
            weight: l.font_style?.weight || 400,
            style: l.font_style?.style || "normal",
            casing: l.font_style?.casing || "normal",
            color: l.font_style?.color || "#FFFFFF",
            size_px: l.font_style?.size_px_base || 48,
            behindSubject: Boolean(l.effects?.behindSubject || (l.effects?.depthZPx && l.effects.depthZPx > 0)),
            effectsDesc: Object.keys(l.effects || {}).join(", ")
          })),
          raw_data: data
        };

        map[stem] = profile;
        map[file] = profile;
        if (profile.paired_image) {
          map[profile.paired_image] = profile;
        }
      } catch (err) {
        console.warn(`Could not parse ${file}:`, err.message);
      }
    }
  };

  loadFrom(fontJsonDir, false);
  loadFrom(cranialJsonDir, true);
  return map;
}

const fontProfiles = loadFontProfiles();

// Authoritative mapping from uploaded screenshots to their canonical Font JSON profiles
const UPLOAD_TO_PROFILE_MAP = {
  "Screenshot_01_090425.png": "image (43)",
  "Screenshot_02_090446.png": "Image Landscape 1",
  "Screenshot_03_090452.png": "image (44)",
  "Screenshot_04_090459.png": "image (45)",
  "Screenshot_05_090516.png": "image (46)",
  "Screenshot_06_173946.png": "image (47)",
  "Screenshot_07_174002.png": "image (48)",
  "Screenshot_08_174018.png": "image (47)",
  "Screenshot_10_021337.png": "image (41)",
  "Screenshot_14_021413.png": "image (51)",
  "Screenshot_14_131730.png": "image (52)",
  "Screenshot_15_131737.png": "image (53)",
  "Screenshot_16_131742.png": "image (54)",
  "Screenshot_17_131749.png": "image (55)",
  "Screenshot_18_131801.png": "image (56)",
  "Screenshot_21_131943.png": "image (57)",
  "Screenshot_22_091915.png": "image (70)",
  "_B00E0CA3-D821-46BA-B0F3-9283B53992FF__vfhn.png": "image (71)"
};

const uploadedFiles = getFiles(uploadDir, f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f) && !f.startsWith("test_"));
const cranialFiles = getFiles(cranialDir, f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f));
const refFiles = getFiles(refDir, f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f));
const videoFiles = getFiles(videoDir, f => /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(f));

function generateHtml(isRoot) {
  const uploadPathPrefix = isRoot ? "docs/mini_run_studio/uploaded_screenshots/" : "uploaded_screenshots/";
  const cranialPathPrefix = isRoot ? "Yuan Prometheus Screenshots/cranial font placement/" : "../../Yuan Prometheus Screenshots/cranial font placement/";
  const refPathPrefix = isRoot ? "Yuan Prometheus Screenshots/font pairing and placement/" : "../../Yuan Prometheus Screenshots/font pairing and placement/";
  const videoPathPrefix = isRoot ? "docs/mini_run_studio/uploaded_videos/" : "uploaded_videos/";

  const uploadedData = uploadedFiles.map(f => {
    const profKey = UPLOAD_TO_PROFILE_MAP[f.name];
    const prof = profKey ? fontProfiles[profKey] : (fontProfiles[f.name] || null);
    return {
      name: f.name,
      size: f.size,
      mtimeMs: f.mtimeMs,
      localUrl: uploadPathPrefix + f.name,
      serverUrl: "/uploaded_screenshots/" + f.name,
      category: "uploaded",
      fontProfile: prof
    };
  });

  const cranialData = cranialFiles.map(f => {
    const stem = f.name.replace(/\.[^.]+$/, "");
    const prof = fontProfiles[f.name] || fontProfiles[stem] || null;
    return {
      name: f.name,
      size: f.size,
      mtimeMs: f.mtimeMs,
      localUrl: cranialPathPrefix + f.name,
      serverUrl: "/cranial_pairs/" + encodeURIComponent(f.name),
      category: "cranial",
      fontProfile: prof
    };
  });

  const refData = refFiles.map(f => {
    const stem = f.name.replace(/\.[^.]+$/, "");
    const prof = fontProfiles[f.name] || fontProfiles[stem] || null;
    const isCran = f.name.toLowerCase().startsWith("cranial");
    return {
      name: f.name,
      size: f.size,
      mtimeMs: f.mtimeMs,
      localUrl: refPathPrefix + f.name,
      serverUrl: "/font_pairs/" + encodeURIComponent(f.name),
      category: isCran ? "cranial" : "reference",
      fontProfile: prof
    };
  });

  const videoData = videoFiles.map(f => ({
    name: f.name,
    size: f.size,
    mtimeMs: f.mtimeMs,
    localUrl: videoPathPrefix + f.name,
    serverUrl: "/uploaded_videos/" + f.name,
    category: "video"
  }));

  const totalAssets = uploadedData.length + cranialData.length + refData.length + videoData.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📸 Screenshot & Reference Ingestion Dropzone — Prometheus</title>
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
      --accent-gold: #FBBF24;
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
    .container { width: 100%; max-width: 1420px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { 
      font-size: clamp(22px, 4vw, 32px); 
      font-weight: 900;
      background: linear-gradient(135deg, var(--accent-cyan), #C084FC);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }
    .header p { color: #8E9BAE; font-size: 14px; }

    /* NAVIGATION LINKS BAR */
    .nav-links {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: 14px;
      flex-wrap: wrap;
    }
    .nav-links a {
      color: #A0AEC0;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--panel-border);
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .nav-links a:hover { color: #FFF; background: rgba(255,255,255,0.12); border-color: var(--accent-cyan); }
    .nav-links a.active { color: var(--accent-cyan); border-color: var(--accent-cyan); background: rgba(0, 240, 255, 0.1); }

    /* TOAST CONTAINER */
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

    /* CONNECTION STATUS BAR */
    .connection-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: rgba(14, 19, 38, 0.85);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      padding: 10px 18px;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.05);
    }
    .status-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .status-online { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34D399; }
    .status-online .status-dot { background: #10B981; box-shadow: 0 0 10px #10B981; }
    .status-offline { background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #FBBF24; }
    .status-offline .status-dot { background: #F59E0B; box-shadow: 0 0 10px #F59E0B; }
    .connection-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .backend-input {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 5px 10px;
      color: #FFF;
      font-size: 12px;
      font-family: monospace;
      outline: none;
      width: 180px;
    }
    .backend-input:focus { border-color: var(--accent-cyan); }
    .btn-conn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--panel-border);
      color: #FFF;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-conn:hover { background: rgba(255, 255, 255, 0.15); border-color: var(--accent-cyan); }
    .btn-sync-offline {
      background: rgba(245, 158, 11, 0.2);
      border: 1px solid rgba(245, 158, 11, 0.5);
      color: #FBBF24;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: none;
    }
    .btn-sync-offline:hover { background: rgba(245, 158, 11, 0.35); }
    .btn-link-folder {
      background: rgba(0, 240, 255, 0.12);
      border: 1px solid rgba(0, 240, 255, 0.4);
      color: var(--accent-cyan);
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-link-folder:hover { background: rgba(0, 240, 255, 0.25); border-color: var(--accent-cyan); }

    /* INGEST DESTINATIONS INFO */
    .destination-info {
      display: flex;
      align-items: center;
      justify-content: space-around;
      gap: 12px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px dashed var(--panel-border);
      border-radius: 10px;
      padding: 8px 16px;
      margin-bottom: 16px;
      font-size: 11.5px;
      color: #94A3B8;
      flex-wrap: wrap;
    }
    .destination-info code {
      color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.08);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    /* DROPZONE */
    .dropzone { 
      border: 2px dashed var(--accent-cyan); 
      border-radius: 18px; 
      padding: 34px 24px; 
      text-align: center; 
      margin-bottom: 20px; 
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
      box-shadow: 0 0 35px rgba(0, 240, 255, 0.6);
    }
    .dropzone-icon { font-size: 46px; margin-bottom: 10px; }
    .dropzone h3 { font-size: 18px; font-weight: 800; margin-bottom: 6px; }
    .dropzone p { color: #8E9BAE; font-size: 13.5px; margin-bottom: 16px; }
    .dropzone-buttons { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
    .btn-action-primary {
      background: linear-gradient(135deg, var(--accent-cyan), #0099FF);
      color: #070913;
      border: none;
      padding: 9px 20px;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 240, 255, 0.35);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .btn-action-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0, 240, 255, 0.5); }
    .btn-action-secondary {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--panel-border);
      color: #FFF;
      padding: 9px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-action-secondary:hover { background: rgba(255, 255, 255, 0.15); border-color: var(--accent-cyan); }
    .btn-video-upload { border-color: var(--accent-purple); color: #C084FC; background: rgba(139, 92, 246, 0.12); }
    .btn-video-upload:hover { background: rgba(139, 92, 246, 0.25); border-color: #C084FC; color: #FFF; }

    .url-input-wrap {
      margin-top: 14px;
      display: none;
      justify-content: center;
      gap: 8px;
      max-width: 580px;
      margin-left: auto;
      margin-right: auto;
    }
    .url-input-wrap.open { display: flex; }
    .url-input-wrap input {
      flex: 1;
      background: rgba(0,0,0,0.5);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 8px 14px;
      color: #FFF;
      font-size: 13px;
      outline: none;
    }
    .url-input-wrap input:focus { border-color: var(--accent-cyan); }
    .url-input-wrap button {
      background: var(--accent-cyan);
      color: #000;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
    }

    /* TABS BAR */
    .tabs-bar {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 12px;
      flex-wrap: wrap;
    }
    .tab-btn {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--panel-border);
      color: #8E9BAE;
      padding: 9px 18px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .tab-btn:hover { color: #FFF; background: rgba(255, 255, 255, 0.09); border-color: var(--accent-cyan); }
    .tab-btn.active {
      color: #FFF;
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.18), rgba(192, 132, 252, 0.18));
      border-color: var(--accent-cyan);
      box-shadow: 0 0 16px rgba(0, 240, 255, 0.25);
    }
    .tab-count {
      background: rgba(255, 255, 255, 0.12);
      padding: 2px 7px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 800;
      color: #FFF;
    }

    /* GALLERY CONTROLS */
    .gallery-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .gallery-title-group { display: flex; align-items: center; gap: 10px; }
    .gallery-title-group h2 { font-size: 18px; font-weight: 800; }
    .gallery-badge {
      background: rgba(0, 240, 255, 0.12);
      border: 1px solid rgba(0, 240, 255, 0.35);
      color: var(--accent-cyan);
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 700;
    }
    .gallery-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .search-box {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 6px 14px;
      color: #FFF;
      font-size: 13px;
      outline: none;
      width: 260px;
    }
    .search-box:focus { border-color: var(--accent-cyan); }
    .btn-tool {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      color: #FFF;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-tool:hover { background: rgba(255, 255, 255, 0.12); border-color: var(--accent-cyan); }
    .btn-danger { color: #F87171; border-color: rgba(239, 68, 68, 0.3); }
    .btn-danger:hover { background: rgba(239, 68, 68, 0.2); border-color: #EF4444; }

    /* GALLERY GRID */
    .gallery { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); 
      gap: 16px; 
      width: 100%;
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
    
    .img-wrap, .vid-wrap {
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
    .img-wrap img, .vid-wrap video { 
      max-width: 100%; 
      max-height: 100%; 
      width: auto;
      height: auto;
      object-fit: contain; 
      display: block;
      transition: transform 0.25s;
    }
    .item-card:hover .img-wrap img { transform: scale(1.03); }
    
    .expand-badge {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid rgba(255,255,255,0.2);
      color: #FFF;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      backdrop-filter: blur(4px);
      pointer-events: none;
      opacity: 0.8;
      transition: opacity 0.2s;
    }
    .item-card:hover .expand-badge { opacity: 1; border-color: var(--accent-cyan); color: var(--accent-cyan); }

    .item-category-tag {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(14, 19, 38, 0.85);
      border: 1px solid var(--panel-border);
      color: #94A3B8;
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      backdrop-filter: blur(4px);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      z-index: 2;
    }
    .tag-uploaded { border-color: var(--accent-cyan); color: var(--accent-cyan); background: rgba(0, 240, 255, 0.15); }
    .tag-cranial { border-color: var(--accent-gold); color: #FBBF24; background: rgba(245, 158, 11, 0.18); font-weight: 800; }
    .tag-reference { border-color: var(--accent-purple); color: #C084FC; background: rgba(192, 132, 252, 0.15); }
    .tag-persisted { border-color: var(--accent-green); color: #34D399; background: rgba(16, 185, 129, 0.15); }

    .item-details { display: flex; flex-direction: column; gap: 6px; }
    .item-name { 
      font-size: 13px; 
      font-weight: 700; 
      color: #FFF; 
      white-space: nowrap; 
      overflow: hidden; 
      text-overflow: ellipsis; 
      font-family: monospace;
    }
    .item-meta { 
      display: flex; 
      justify-content: space-between; 
      color: #8E9BAE; 
      font-size: 11.5px; 
      font-family: monospace;
    }

    /* FONT JSON SPEC DISPLAY ON CARDS */
    .item-font-spec {
      display: flex;
      flex-direction: column;
      gap: 5px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 7px 10px;
    }
    .font-spec-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .font-chip {
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .primary-chip { background: rgba(0, 240, 255, 0.12); color: var(--accent-cyan); border: 1px solid rgba(0, 240, 255, 0.3); }
    .accent-chip { background: rgba(192, 132, 252, 0.12); color: #C084FC; border: 1px solid rgba(192, 132, 252, 0.3); }
    .layers-chip { background: rgba(255, 255, 255, 0.08); color: #E2E8F0; border: 1px solid rgba(255, 255, 255, 0.15); }
    .cranial-chip { background: rgba(245, 158, 11, 0.18); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.4); font-weight: 800; }
    .font-spec-mood {
      font-size: 11px;
      color: #94A3B8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-style: italic;
    }

    .item-btn-bar { display: flex; gap: 6px; margin-top: 4px; }
    .btn-item {
      flex: 1;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      color: #FFF;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
      text-align: center;
    }
    .btn-item:hover { background: rgba(255, 255, 255, 0.14); border-color: var(--accent-cyan); }
    .btn-item-json {
      background: rgba(139, 92, 246, 0.15);
      border-color: rgba(139, 92, 246, 0.4);
      color: #C084FC;
    }
    .btn-item-json:hover {
      background: rgba(139, 92, 246, 0.3);
      border-color: #C084FC;
      color: #FFF;
    }
    .btn-item-del {
      flex: 0 0 32px;
      color: #F87171;
      border-color: rgba(239, 68, 68, 0.3);
    }
    .btn-item-del:hover { background: rgba(239, 68, 68, 0.25); border-color: #EF4444; }

    /* LIGHTBOX MODALS */
    #lightboxModal, #videoLightboxModal, #fontJsonModal {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(10px);
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    #lightboxModal.open, #videoLightboxModal.open, #fontJsonModal.open { display: flex; }
    .lightbox-content {
      position: relative;
      max-width: 90vw;
      max-height: 90vh;
      background: #0E1326;
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 60px rgba(0,0,0,0.9);
    }
    .lightbox-img-wrap, .lightbox-video-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #05070e;
      overflow: hidden;
      min-height: 200px;
    }
    .lightbox-img-wrap img {
      max-width: 100%;
      max-height: 75vh;
      object-fit: contain;
    }
    .lightbox-video-wrap video {
      max-width: 100%;
      max-height: 75vh;
    }
    .lightbox-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 18px;
      background: #090C1A;
      border-top: 1px solid var(--panel-border);
      font-size: 13px;
      font-family: monospace;
    }
    .lightbox-close {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(0,0,0,0.65);
      border: 1px solid rgba(255,255,255,0.25);
      color: #FFF;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .lightbox-close:hover { background: #EF4444; border-color: #EF4444; }

    /* FONT JSON MODAL SPECIFICS */
    .font-json-content {
      width: 860px;
      max-width: 95vw;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
    }
    .font-modal-header {
      padding: 18px 22px;
      background: #090C1A;
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
    }
    .font-modal-header h2 { font-size: 17px; font-weight: 800; color: #FFF; }
    .modal-subnav {
      display: flex;
      gap: 6px;
      padding: 10px 22px;
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid var(--panel-border);
    }
    .modal-subnav-btn {
      background: transparent;
      border: 1px solid transparent;
      color: #8E9BAE;
      font-size: 12.5px;
      font-weight: 700;
      padding: 5px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .modal-subnav-btn:hover { color: #FFF; background: rgba(255, 255, 255, 0.06); }
    .modal-subnav-btn.active {
      color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.1);
      border-color: rgba(0, 240, 255, 0.3);
    }
    .font-modal-body {
      padding: 18px 22px;
      overflow-y: auto;
      flex: 1;
      background: #070913;
    }
    .layers-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    .layers-table th, .layers-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }
    .layers-table th {
      color: #8E9BAE;
      font-weight: 700;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .layer-sample-text {
      font-size: 14px;
      font-weight: 800;
      color: #FFF;
      max-width: 220px;
    }
    .font-family-badge {
      background: rgba(0, 240, 255, 0.1);
      color: var(--accent-cyan);
      border: 1px solid rgba(0, 240, 255, 0.25);
      padding: 2px 7px;
      border-radius: 4px;
      font-family: monospace;
      font-weight: 700;
    }
    .color-swatch {
      display: inline-block;
      width: 14px;
      height: 14px;
      border-radius: 3px;
      border: 1px solid #FFF;
      vertical-align: middle;
      margin-right: 6px;
    }
    .tag-depth-behind {
      background: rgba(245, 158, 11, 0.15);
      color: #FBBF24;
      border: 1px solid rgba(245, 158, 11, 0.4);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: 800;
    }
    .tag-depth-fore {
      background: rgba(16, 185, 129, 0.15);
      color: #34D399;
      border: 1px solid rgba(16, 185, 129, 0.4);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: 800;
    }
    pre code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 12px;
      line-height: 1.5;
      color: #38BDF8;
    }
  </style>
</head>
<body>
  <div id="toastContainer"></div>

  <div class="container">
    <div class="header">
      <h1>📸 Screenshot & Reference Ingestion Dropzone</h1>
      <p>Instant clipboard paste (Ctrl+V / ⌘V), direct disk linking, and persistent multi-asset inspection</p>
      <div class="nav-links">
        <a href="/typo">🎬 /typo Kinetic & Video Studio</a>
        <a href="/">🎥 / Video SFX Player</a>
        <a href="/mixfont">🎨 /mixfont Testing Hub</a>
        <a href="/anima">✨ /anima ANIMA Studio</a>
        <a href="/paste" class="active">📸 /paste Gallery</a>
      </div>
    </div>

    <!-- CONNECTION STATUS BAR -->
    <div class="connection-bar">
      <div class="status-pill status-offline" id="statusPill">
        <span class="status-dot"></span>
        <span id="statusText">Checking Mode...</span>
      </div>
      <div class="connection-controls">
        <button class="btn-link-folder" id="btnLinkFolder" type="button" title="Mount docs/mini_run_studio/uploaded_screenshots directly to save pastes to disk with zero server">
          📁 Direct Folder Link (No Server)
        </button>
        <button class="btn-sync-offline" id="btnSyncOffline" type="button">⚡ Sync Queued Assets</button>
        <input type="text" class="backend-input" id="backendUrlInput" value="http://localhost:8080" placeholder="Backend URL" title="Target Prometheus Backend Endpoint" />
        <button class="btn-conn" id="btnTestConn" type="button">🔄 Test Connection</button>
      </div>
    </div>

    <!-- INGEST DESTINATIONS INFO -->
    <div class="destination-info">
      <div>📁 Screenshots Target: <code>docs/mini_run_studio/uploaded_screenshots/</code></div>
      <div>👑 Head Section: <code>Yuan Prometheus Screenshots/cranial font placement/</code></div>
      <div>🎨 Reference Bank: <code>Yuan Prometheus Screenshots/font pairing and placement/</code></div>
      <div>🔤 Font JSON Spec: <code>Yuan Prometheus Screenshots/font JSON/</code></div>
    </div>

    <!-- DROPZONE -->
    <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Dropzone for screenshot and video uploads">
      <div class="dropzone-icon">📋</div>
      <h3>Paste Anywhere (Ctrl+V / ⌘V) or Drag & Drop Files</h3>
      <p>Works with Snipping Tool, Windows PrintScreen, Mac Shift+Cmd+4, browser copied images, URLs, and video files.</p>
      
      <div class="dropzone-buttons">
        <button class="btn-action-primary" id="btnPasteClipboard" type="button">
          📋 Paste from Clipboard (Ctrl+V)
        </button>
        <button class="btn-action-secondary" id="btnBrowseFiles" type="button">
          📂 Select Image Files...
        </button>
        <button class="btn-action-secondary" id="btnToggleUrl" type="button">
          🔗 Paste URL / Base64
        </button>
        <button class="btn-action-secondary btn-video-upload" id="btnUploadVideo" type="button" title="Upload principal speaker alpha video asset">
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

    <!-- TABS BAR -->
    <div class="tabs-bar">
      <button class="tab-btn active" id="tabUploaded" onclick="switchTab('uploaded')" type="button">
        📸 Uploaded Screenshots <span class="tab-count" id="countUploaded">${uploadedData.length}</span>
      </button>
      <button class="tab-btn" id="tabCranial" onclick="switchTab('cranial')" type="button">
        👑 Cranial Head Section <span class="tab-count" id="countCranial">${cranialData.length}</span>
      </button>
      <button class="tab-btn" id="tabRef" onclick="switchTab('reference')" type="button">
        🎨 Curated Reference Bank <span class="tab-count" id="countRef">${refData.length}</span>
      </button>
      <button class="tab-btn" id="tabVideos" onclick="switchTab('video')" type="button">
        🎭 Principal Speaker Videos <span class="tab-count" id="countVideos">${videoData.length}</span>
      </button>
      <button class="tab-btn" id="tabAll" onclick="switchTab('all')" type="button">
        🌟 All Assets <span class="tab-count" id="countAll">${totalAssets}</span>
      </button>
    </div>

    <!-- GALLERY BAR -->
    <div class="gallery-bar">
      <div class="gallery-title-group">
        <h2 id="gallerySectionTitle">Uploaded Screenshots</h2>
        <span class="gallery-badge" id="galleryBadge">${uploadedData.length} Items</span>
        <span id="gallerySizeReadout" style="color: #8E9BAE; font-size: 11.5px; font-family: monospace;"></span>
      </div>
      <div class="gallery-actions">
        <input type="text" class="search-box" id="searchBox" placeholder="🔍 Search by file, font, layer text..." />
        <button class="btn-tool" id="btnRefresh" type="button" title="Refresh Gallery">🔄 Refresh</button>
        <button class="btn-tool btn-danger" id="btnDeleteAll" type="button" title="Delete Ingested Images">🗑️ Clear Ingested</button>
      </div>
    </div>

    <div class="gallery" id="gallery"></div>
  </div>

  <!-- IMAGE LIGHTBOX MODAL -->
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

  <!-- FONT JSON INSPECTOR MODAL -->
  <div id="fontJsonModal">
    <div class="lightbox-content font-json-content">
      <button class="lightbox-close" id="fontJsonClose" title="Close (Esc)">✕</button>
      <div class="font-modal-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 26px;">🔤</span>
          <div>
            <h2 id="fontModalTitle">Profile Name</h2>
            <p id="fontModalSubtitle" style="color: #8E9BAE; font-size: 11.5px; font-family: monospace;"></p>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-tool" id="btnCopyFontJson" type="button">📋 Copy JSON</button>
          <a class="btn-tool" id="btnDownloadFontJson" download href="" style="text-decoration:none;">⬇️ Download JSON</a>
        </div>
      </div>
      <div class="modal-subnav">
        <button class="modal-subnav-btn active" id="btnSubnavLayers" type="button" onclick="showFontModalTab('layers')">Visual Layers</button>
        <button class="modal-subnav-btn" id="btnSubnavRaw" type="button" onclick="showFontModalTab('raw')">Raw JSON Source</button>
      </div>
      <div id="fontModalLayersView" class="font-modal-body"></div>
      <div id="fontModalRawView" class="font-modal-body" style="display: none;">
        <pre><code id="fontModalCodeBlock"></code></pre>
      </div>
    </div>
  </div>

  <script>
    // PRE-BAKED INITIAL ASSETS
    const BAKED_UPLOADED = ${JSON.stringify(uploadedData, null, 2)};
    const BAKED_CRANIAL = ${JSON.stringify(cranialData, null, 2)};
    const BAKED_REFERENCES = ${JSON.stringify(refData, null, 2)};
    const BAKED_VIDEOS = ${JSON.stringify(videoData, null, 2)};

    let currentTab = 'uploaded';
    let allScreenshots = [...BAKED_UPLOADED];
    let allCranial = [...BAKED_CRANIAL];
    let allReferences = [...BAKED_REFERENCES];
    let allVideos = [...BAKED_VIDEOS];
    let offlineQueue = [];
    let isBackendLive = false;
    let localDirHandle = null;
    let activeFontProfile = null;

    const DB_NAME = 'PrometheusStudioDB';
    const STORE_NAME = 'pasted_assets';

    const toastContainer = document.getElementById('toastContainer');
    const dropzone = document.getElementById('dropzone');
    const filePicker = document.getElementById('filePicker');
    const videoFilePicker = document.getElementById('videoFilePicker');
    const searchBox = document.getElementById('searchBox');
    const urlInputWrap = document.getElementById('urlInputWrap');
    const manualInput = document.getElementById('manualInput');
    const statusPill = document.getElementById('statusPill');
    const statusText = document.getElementById('statusText');
    const backendUrlInput = document.getElementById('backendUrlInput');
    const btnSyncOffline = document.getElementById('btnSyncOffline');
    const btnLinkFolder = document.getElementById('btnLinkFolder');

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    /* INDEXED DB ENGINE (Persistent Storage without Server) */
    function openDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'name' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async function loadFromDB() {
      try {
        const db = await openDB();
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
      } catch {
        return [];
      }
    }

    async function saveToDB(item) {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(item);
      } catch (e) {
        console.warn('IndexedDB save error:', e);
      }
    }

    async function deleteFromDB(name) {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(name);
      } catch (e) {
        console.warn('IndexedDB delete error:', e);
      }
    }

    /* DIRECT FOLDER ACCESS (Native Chrome / Edge Disk File Writing) */
    async function linkLocalFolder() {
      if (!('showDirectoryPicker' in window)) {
        showToast('⚠️ Directory Picker is supported in Chrome & Edge. To sync across all browsers, run launch_paste_studio.bat.', 'info', 5000);
        return;
      }
      try {
        localDirHandle = await window.showDirectoryPicker({
          id: 'prometheus-screenshots-dir',
          mode: 'readwrite'
        });
        statusPill.className = 'status-pill status-online';
        statusText.innerText = '📁 Folder Mounted (' + localDirHandle.name + ')';
        btnLinkFolder.innerText = '✓ Folder Mounted';
        btnLinkFolder.style.borderColor = 'var(--accent-green)';
        btnLinkFolder.style.color = '#34D399';
        showToast('✓ Mounted folder "' + localDirHandle.name + '"! Pastes now write real files directly to disk without a server.', 'success', 5000);
      } catch (err) {
        if (err.name !== 'AbortError') {
          showToast('Could not mount folder: ' + err.message, 'error');
        }
      }
    }

    async function saveDirectToDisk(blob, filename) {
      if (!localDirHandle) return false;
      try {
        const fileHandle = await localDirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (e) {
        console.warn('Direct disk save error:', e);
        return false;
      }
    }

    function isHttpProtocol() {
      return window.location.protocol === 'http:' || window.location.protocol === 'https:';
    }

    function getBackendBase() {
      if (isHttpProtocol()) return window.location.origin;
      return backendUrlInput.value.trim().replace(/\/+$/, '') || 'http://localhost:8080';
    }

    if (isHttpProtocol()) {
      backendUrlInput.value = window.location.origin;
    }

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

    function resolveItemSrc(item) {
      if (item.dataUrl) return item.dataUrl;
      if (isHttpProtocol() || isBackendLive) {
        const base = getBackendBase();
        if (item.serverUrl) return base + item.serverUrl;
      }
      return item.localUrl || item.serverUrl;
    }

    function switchTab(tab) {
      currentTab = tab;
      ['tabUploaded', 'tabCranial', 'tabRef', 'tabVideos', 'tabAll'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
      });
      if (tab === 'uploaded') document.getElementById('tabUploaded').classList.add('active');
      if (tab === 'cranial') document.getElementById('tabCranial').classList.add('active');
      if (tab === 'reference') document.getElementById('tabRef').classList.add('active');
      if (tab === 'video') document.getElementById('tabVideos').classList.add('active');
      if (tab === 'all') document.getElementById('tabAll').classList.add('active');

      renderGallery();
    }

    async function probeBackend() {
      const base = getBackendBase();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(base + '/health', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          isBackendLive = true;
          statusPill.className = 'status-pill status-online';
          statusText.innerText = '🟢 Backend Live (' + base + ')';
          if (offlineQueue.length > 0) {
            btnSyncOffline.style.display = 'inline-block';
            btnSyncOffline.innerText = '⚡ Sync ' + offlineQueue.length + ' Offline Items';
          } else {
            btnSyncOffline.style.display = 'none';
          }
          return true;
        }
      } catch {}

      isBackendLive = false;
      if (!localDirHandle) {
        statusPill.className = 'status-pill status-offline';
        statusText.innerText = '🟡 Standalone Local Mode (' + (allScreenshots.length + allCranial.length + allReferences.length) + ' assets loaded)';
      }
      btnSyncOffline.style.display = 'none';
      return false;
    }

    async function loadGallery() {
      const isLive = await probeBackend();
      if (isLive) {
        try {
          const base = getBackendBase();
          const res = await fetch(base + '/api/list_uploaded_screenshots?t=' + Date.now());
          if (res.ok) {
            const data = await res.json();
            allScreenshots = data.map(item => {
              if (typeof item === 'string') {
                return { name: item, localUrl: '${uploadPathPrefix}' + item, serverUrl: '/uploaded_screenshots/' + item, size: 0, mtimeMs: 0, category: 'uploaded' };
              }
              return { ...item, localUrl: '${uploadPathPrefix}' + item.name, serverUrl: item.url || ('/uploaded_screenshots/' + item.name), category: 'uploaded' };
            });
          }

          const vidRes = await fetch(base + '/api/list_uploaded_videos?t=' + Date.now());
          if (vidRes.ok) {
            const vData = await vidRes.json();
            allVideos = vData.map(item => ({
              ...item,
              localUrl: '${videoPathPrefix}' + item.name,
              serverUrl: item.url || ('/uploaded_videos/' + item.name),
              category: 'video'
            }));
          }
        } catch (e) {
          console.warn('Could not fetch server gallery:', e);
        }
      }

      // Load persistent items from IndexedDB
      const persisted = await loadFromDB();
      if (persisted && persisted.length > 0) {
        const existingNames = new Set(offlineQueue.map(x => x.name));
        persisted.forEach(p => {
          if (!existingNames.has(p.name)) {
            offlineQueue.push(p);
          }
        });
      }

      updateTabCounts();
      renderGallery();
    }

    function updateTabCounts() {
      const uCount = allScreenshots.length + offlineQueue.length;
      const cCount = allCranial.length;
      const rCount = allReferences.length;
      const vCount = allVideos.length;
      document.getElementById('countUploaded').innerText = uCount;
      document.getElementById('countCranial').innerText = cCount;
      document.getElementById('countRef').innerText = rCount;
      document.getElementById('countVideos').innerText = vCount;
      document.getElementById('countAll').innerText = uCount + cCount + rCount + vCount;
    }

    function renderGallery() {
      const q = (searchBox.value || '').trim().toLowerCase();
      let pool = [];

      if (currentTab === 'uploaded') pool = [...offlineQueue, ...allScreenshots];
      else if (currentTab === 'cranial') pool = [...allCranial];
      else if (currentTab === 'reference') pool = [...allReferences];
      else if (currentTab === 'video') pool = [...allVideos];
      else pool = [...offlineQueue, ...allScreenshots, ...allCranial, ...allReferences, ...allVideos];

      const filtered = pool.filter(item => {
        if (!q) return true;
        if (item.name.toLowerCase().includes(q)) return true;
        if (item.fontProfile) {
          const p = item.fontProfile;
          if (p.profile_name && p.profile_name.toLowerCase().includes(q)) return true;
          if (p.primary_font && p.primary_font.toLowerCase().includes(q)) return true;
          if (p.accent_font && p.accent_font.toLowerCase().includes(q)) return true;
          if (p.overall_mood && p.overall_mood.toLowerCase().includes(q)) return true;
          if (p.layers && p.layers.some(l => (l.text && l.text.toLowerCase().includes(q)) || (l.font && l.font.toLowerCase().includes(q)))) return true;
        }
        return false;
      });
      
      const badge = document.getElementById('galleryBadge');
      const sizeReadout = document.getElementById('gallerySizeReadout');
      const titleEl = document.getElementById('gallerySectionTitle');

      if (currentTab === 'uploaded') titleEl.innerText = 'Uploaded Screenshots';
      else if (currentTab === 'cranial') titleEl.innerText = '👑 Cranial Head Section (Crown & Headroom)';
      else if (currentTab === 'reference') titleEl.innerText = 'Curated Reference Bank';
      else if (currentTab === 'video') titleEl.innerText = 'Principal Speaker Videos';
      else titleEl.innerText = 'All Assets';

      badge.innerText = filtered.length + ' Items';
      const totalBytes = filtered.reduce((acc, cur) => acc + (cur.size || 0), 0);
      sizeReadout.innerText = totalBytes > 0 ? 'Total: ' + formatBytes(totalBytes) : '';

      const gal = document.getElementById('gallery');
      gal.innerHTML = '';

      if (filtered.length === 0) {
        gal.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #8E9BAE; padding: 60px 20px; background: rgba(255,255,255,0.02); border: 1px dashed var(--panel-border); border-radius: 14px;">' +
          (q ? 'No assets match "' + q + '".' : 'No items in this section.<br><br><span style="color:var(--accent-cyan); font-weight:bold; font-size:15px;">Press Ctrl+V (or ⌘V) anywhere</span> to paste directly.') +
          '</div>';
        return;
      }

      filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';

        const isVideo = item.category === 'video' || /\.(mp4|webm|mov)$/i.test(item.name);
        const itemSrc = resolveItemSrc(item);

        const mediaWrap = document.createElement('div');
        mediaWrap.className = isVideo ? 'vid-wrap' : 'img-wrap';
        
        if (isVideo) {
          mediaWrap.innerHTML = 
            '<video src="' + itemSrc + '" muted loop playsinline preload="metadata"></video>' +
            '<div class="expand-badge">▶ Preview</div>';
          mediaWrap.onclick = () => openVideoLightbox(itemSrc, item.name);
        } else {
          mediaWrap.innerHTML = 
            '<img src="' + itemSrc + '" alt="' + item.name + '" loading="lazy" />' +
            '<div class="expand-badge">🔍 Expand</div>';
          mediaWrap.onclick = () => openLightbox(itemSrc, item.name);
        }

        const tag = document.createElement('span');
        let tagClass = 'tag-uploaded';
        let tagText = 'UPLOAD';
        if (item.isPersisted) { tagClass = 'tag-persisted'; tagText = 'SAVED (DB)'; }
        else if (item.isOffline) { tagClass = 'tag-offline'; tagText = 'OFFLINE'; }
        else if (item.category === 'cranial') { tagClass = 'tag-cranial'; tagText = '👑 CRANIAL'; }
        else if (item.category === 'reference') { tagClass = 'tag-reference'; tagText = 'REF'; }
        else if (item.category === 'video') { tagClass = 'tag-reference'; tagText = 'VIDEO'; }

        tag.className = 'item-category-tag ' + tagClass;
        tag.innerText = tagText;
        card.appendChild(tag);

        const details = document.createElement('div');
        details.className = 'item-details';

        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.innerText = item.name;
        nameEl.title = item.name;

        const metaEl = document.createElement('div');
        metaEl.className = 'item-meta';
        metaEl.innerHTML = 
          '<span>' + (item.size ? formatBytes(item.size) : (isVideo ? 'Video' : 'Image')) + '</span>' +
          '<span>' + formatTime(item.mtimeMs) + '</span>';

        details.appendChild(nameEl);
        details.appendChild(metaEl);

        // FONT JSON SPEC DISPLAY
        if (item.fontProfile) {
          const p = item.fontProfile;
          const specDiv = document.createElement('div');
          specDiv.className = 'item-font-spec';
          
          let chipsHtml = '<div class="font-spec-row">';
          chipsHtml += '<span class="font-chip primary-chip" title="Primary Font">🔤 ' + escapeHtml(p.primary_font) + ' ' + (p.primary_weight || '') + '</span>';
          if (p.accent_font) {
            chipsHtml += '<span class="font-chip accent-chip" title="Accent Font">✨ ' + escapeHtml(p.accent_font) + '</span>';
          }
          chipsHtml += '<span class="font-chip layers-chip" title="Layer Count">' + p.layer_count + 'L</span>';
          if (p.is_cranial) {
            chipsHtml += '<span class="font-chip cranial-chip" title="Cranial Crown / Headroom">👑 Head</span>';
          }
          chipsHtml += '</div>';

          if (p.overall_mood) {
            chipsHtml += '<div class="font-spec-mood" title="' + escapeHtml(p.overall_mood) + '">' + escapeHtml(p.overall_mood) + '</div>';
          }

          specDiv.innerHTML = chipsHtml;
          details.appendChild(specDiv);
        }

        const btnBar = document.createElement('div');
        btnBar.className = 'item-btn-bar';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-item';
        copyBtn.type = 'button';
        copyBtn.innerHTML = '📋 Copy';
        copyBtn.onclick = (e) => {
          e.stopPropagation();
          copyToClipboard(itemSrc, 'Copied asset path to clipboard!');
        };

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-item';
        viewBtn.type = 'button';
        viewBtn.innerHTML = '👁️ View';
        viewBtn.onclick = (e) => {
          e.stopPropagation();
          if (isVideo) openVideoLightbox(itemSrc, item.name);
          else openLightbox(itemSrc, item.name);
        };

        btnBar.appendChild(copyBtn);
        btnBar.appendChild(viewBtn);

        // INSPECT FONT JSON BUTTON
        if (item.fontProfile) {
          const jsonBtn = document.createElement('button');
          jsonBtn.className = 'btn-item btn-item-json';
          jsonBtn.type = 'button';
          jsonBtn.innerHTML = '{ } JSON';
          jsonBtn.title = 'Inspect Font JSON Profile';
          jsonBtn.onclick = (e) => {
            e.stopPropagation();
            openFontJsonModal(item);
          };
          btnBar.appendChild(jsonBtn);
        }

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-item btn-item-del';
        delBtn.type = 'button';
        delBtn.innerHTML = '🗑️';
        delBtn.title = 'Delete';
        delBtn.onclick = (e) => {
          e.stopPropagation();
          if (isVideo) deleteVideoAsset(item.name);
          else deleteSingleImage(item.name, item.isOffline || item.isPersisted);
        };

        if (item.category !== 'reference' && item.category !== 'cranial') {
          btnBar.appendChild(delBtn);
        }

        card.appendChild(mediaWrap);
        card.appendChild(details);
        card.appendChild(btnBar);

        gal.appendChild(card);
      });
    }

    function openFontJsonModal(item) {
      const p = item.fontProfile;
      if (!p) return;
      activeFontProfile = p;

      document.getElementById('fontModalTitle').innerText = p.profile_name || p.id;
      document.getElementById('fontModalSubtitle').innerText = p.filename + ' • Zone: ' + p.dominant_zone + ' • ' + p.layer_count + ' Layers • ' + p.total_words + ' Words • ' + (p.casing_strategy || 'mixed');

      // Render Visual Layers
      const layersView = document.getElementById('fontModalLayersView');
      let layersHtml = '<table class="layers-table">' +
        '<thead>' +
          '<tr>' +
            '<th>Layer / Role</th>' +
            '<th>Sample Text</th>' +
            '<th>Font Family</th>' +
            '<th>Weight</th>' +
            '<th>Color</th>' +
            '<th>Depth / Occlusion</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>';

      (p.layers || []).forEach(l => {
        layersHtml += '<tr>' +
          '<td><strong>' + escapeHtml(l.name) + '</strong><br><small style="color:#8E9BAE">' + escapeHtml(l.role) + '</small></td>' +
          '<td class="layer-sample-text">' + escapeHtml(l.text) + '</td>' +
          '<td><span class="font-family-badge">' + escapeHtml(l.font) + '</span></td>' +
          '<td>' + l.weight + '</td>' +
          '<td><span class="color-swatch" style="background:' + l.color + ';"></span> <small>' + l.color + '</small></td>' +
          '<td>' + (l.behindSubject ? '<span class="tag-depth-behind">BEHIND HEAD</span>' : '<span class="tag-depth-fore">FOREGROUND</span>') + '</td>' +
        '</tr>';
      });
      layersHtml += '</tbody></table>';
      layersView.innerHTML = layersHtml;

      // Render Raw JSON
      const codeBlock = document.getElementById('fontModalCodeBlock');
      codeBlock.textContent = JSON.stringify(p.raw_data, null, 2);

      // Setup Download Link
      const dlBtn = document.getElementById('btnDownloadFontJson');
      const blob = new Blob([JSON.stringify(p.raw_data, null, 2)], { type: 'application/json' });
      dlBtn.href = URL.createObjectURL(blob);
      dlBtn.download = p.filename || (p.id + '.json');

      showFontModalTab('layers');
      document.getElementById('fontJsonModal').classList.add('open');
    }

    function showFontModalTab(tab) {
      const btnLayers = document.getElementById('btnSubnavLayers');
      const btnRaw = document.getElementById('btnSubnavRaw');
      const viewLayers = document.getElementById('fontModalLayersView');
      const viewRaw = document.getElementById('fontModalRawView');

      if (tab === 'layers') {
        btnLayers.classList.add('active');
        btnRaw.classList.remove('active');
        viewLayers.style.display = 'block';
        viewRaw.style.display = 'none';
      } else {
        btnRaw.classList.add('active');
        btnLayers.classList.remove('active');
        viewRaw.style.display = 'block';
        viewLayers.style.display = 'none';
      }
    }

    document.getElementById('btnCopyFontJson').addEventListener('click', () => {
      if (!activeFontProfile) return;
      copyToClipboard(JSON.stringify(activeFontProfile.raw_data, null, 2), 'Copied Font JSON specification!');
    });

    document.getElementById('fontJsonClose').addEventListener('click', () => {
      document.getElementById('fontJsonModal').classList.remove('open');
    });

    async function uploadPayload(dataOrBlob, filenameHint) {
      let previewThumb = '';
      if (dataOrBlob instanceof Blob) {
        try {
          const objUrl = URL.createObjectURL(dataOrBlob);
          previewThumb = '<img src="' + objUrl + '" style="width:28px;height:28px;border-radius:6px;object-fit:cover;border:1px solid #FFF;margin-right:6px;" />';
        } catch {}
      }
      
      const toast = showToast(previewThumb + 'Ingesting image to docs/mini_run_studio/uploaded_screenshots...', 'uploading', 15000);

      const targetName = filenameHint || ('Screenshot_' + Date.now() + '.png');
      const fallbackLocalUrl = '${uploadPathPrefix}' + targetName;
      const fallbackServerUrl = '/uploaded_screenshots/' + targetName;

      let directSuccess = false;
      if (dataOrBlob instanceof Blob && localDirHandle) {
        directSuccess = await saveDirectToDisk(dataOrBlob, targetName);
      }

      if (directSuccess) {
        toast.remove();
        showToast('✓ Saved directly to disk: <code>' + targetName + '</code>', 'success');
        const newItem = {
          name: targetName,
          size: dataOrBlob.size,
          mtimeMs: Date.now(),
          localUrl: fallbackLocalUrl,
          serverUrl: fallbackServerUrl,
          category: 'uploaded'
        };
        allScreenshots.unshift(newItem);
        updateTabCounts();
        renderGallery();
        return;
      }

      if (isBackendLive) {
        try {
          let res;
          if (dataOrBlob instanceof Blob) {
            const formData = new FormData();
            formData.append('image', dataOrBlob, targetName);
            res = await fetch(getBackendBase() + '/api/upload_screenshot', {
              method: 'POST',
              body: formData
            });
          } else {
            res = await fetch(getBackendBase() + '/api/upload_screenshot', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: dataOrBlob, filename: targetName })
            });
          }

          toast.remove();
          if (res.ok) {
            const data = await res.json();
            showToast('✓ Ingested to disk: <code>' + (data.filename || targetName) + '</code>', 'success');
            await loadGallery();
          } else {
            throw new Error('Server returned ' + res.status);
          }
          return;
        } catch (err) {
          console.warn('Live server upload failed, falling back to persistent DB:', err);
        }
      }

      toast.remove();
      let dataUrl = '';
      let itemSize = 0;
      if (dataOrBlob instanceof Blob) {
        itemSize = dataOrBlob.size;
        dataUrl = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = (ev) => res(ev.target.result);
          reader.readAsDataURL(dataOrBlob);
        });
      } else {
        dataUrl = dataOrBlob;
      }

      const offlineItem = {
        name: targetName,
        size: itemSize,
        mtimeMs: Date.now(),
        dataUrl: dataUrl,
        localUrl: fallbackLocalUrl,
        serverUrl: fallbackServerUrl,
        isOffline: true,
        isPersisted: true,
        category: 'uploaded'
      };

      await saveToDB(offlineItem);
      offlineQueue.unshift(offlineItem);
      updateTabCounts();
      renderGallery();

      showToast('⚡ Ingested & Persisted in Local DB (Will sync to disk when backend is started)', 'info', 5000);
    }

    async function syncOfflineQueue() {
      if (offlineQueue.length === 0) return;
      showToast('⚡ Syncing ' + offlineQueue.length + ' assets to server disk...', 'uploading', 10000);

      const toSync = [...offlineQueue];
      for (const item of toSync) {
        try {
          const res = await fetch(getBackendBase() + '/api/upload_screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: item.dataUrl, filename: item.name })
          });
          if (res.ok) {
            await deleteFromDB(item.name);
            offlineQueue = offlineQueue.filter(x => x.name !== item.name);
          }
        } catch (e) {
          console.warn('Failed to sync item:', item.name, e);
        }
      }

      updateTabCounts();
      renderGallery();
      showToast('✓ Synced offline items to backend disk storage!', 'success');
    }

    async function uploadVideoPayload(dataOrBlob, filenameHint) {
      const toast = showToast('Uploading matted video asset...', 'uploading', 25000);
      try {
        const formData = new FormData();
        formData.append('video', dataOrBlob, filenameHint);
        const res = await fetch(getBackendBase() + '/api/upload_video', {
          method: 'POST',
          body: formData
        });
        toast.remove();
        if (res.ok) {
          const data = await res.json();
          showToast('✓ Video ingested: <code>' + (data.filename || filenameHint) + '</code>', 'success');
          await loadGallery();
        } else {
          showToast('❌ Video upload failed: ' + (data.error || 'Error'), 'error', 6000);
        }
      } catch (err) {
        toast.remove();
        showToast('❌ Video upload error: ' + err.message, 'error', 6000);
      }
    }

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

    // GLOBAL CLIPBOARD PASTE
    window.addEventListener('paste', async (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items || items.length === 0) return;
      let handled = false;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            handled = true;
            await uploadPayload(blob, 'Clipboard_' + Date.now() + '.png');
          }
        }
      }

      if (!handled) {
        const text = e.clipboardData.getData('text/plain');
        if (text && (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('data:image/'))) {
          e.preventDefault();
          await uploadPayload(text.trim(), 'Pasted_URL_' + Date.now() + '.png');
        }
      }
    });

    function copyToClipboard(text, msg = 'Copied to clipboard!') {
      navigator.clipboard.writeText(text).then(() => {
        showToast('📋 ' + msg, 'success', 2500);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast('📋 ' + msg, 'success', 2500);
      });
    }

    function openLightbox(url, name) {
      document.getElementById('lightboxImg').src = url;
      document.getElementById('lightboxName').innerText = name;
      document.getElementById('lightboxDownload').href = url;
      document.getElementById('lightboxDownload').download = name;
      document.getElementById('lightboxCopy').onclick = () => copyToClipboard(url, 'Copied image link!');
      document.getElementById('lightboxModal').classList.add('open');
    }

    function openVideoLightbox(url, name) {
      const vid = document.getElementById('videoLightboxVideo');
      vid.src = url;
      vid.play().catch(() => {});
      document.getElementById('videoLightboxName').innerText = name;
      document.getElementById('videoLightboxDownload').href = url;
      document.getElementById('videoLightboxDownload').download = name;
      document.getElementById('videoLightboxCopy').onclick = () => copyToClipboard(url, 'Copied video link!');
      document.getElementById('videoLightboxModal').classList.add('open');
    }

    document.getElementById('lightboxClose').onclick = () => {
      document.getElementById('lightboxModal').classList.remove('open');
    };
    document.getElementById('videoLightboxClose').onclick = () => {
      const vid = document.getElementById('videoLightboxVideo');
      vid.pause();
      vid.src = '';
      document.getElementById('videoLightboxModal').classList.remove('open');
    };

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.getElementById('lightboxModal').classList.remove('open');
        document.getElementById('videoLightboxModal').classList.remove('open');
        document.getElementById('fontJsonModal').classList.remove('open');
      }
    });

    async function deleteSingleImage(name, isOfflineOrPersisted) {
      if (isOfflineOrPersisted) {
        offlineQueue = offlineQueue.filter(x => x.name !== name);
        await deleteFromDB(name);
        showToast('Deleted item: ' + name, 'info');
        updateTabCounts();
        renderGallery();
        return;
      }
      const base = getBackendBase();
      try {
        const res = await fetch(base + '/api/delete_uploaded_screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: name })
        });
        if (res.ok) {
          showToast('Deleted item: ' + name, 'info');
          await loadGallery();
        } else {
          showToast('Could not delete ' + name, 'error');
        }
      } catch (err) {
        showToast('Delete error: ' + err.message, 'error');
      }
    }

    async function deleteVideoAsset(name) {
      const base = getBackendBase();
      try {
        const res = await fetch(base + '/api/delete_uploaded_video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: name })
        });
        if (res.ok) {
          showToast('Deleted video: ' + name, 'info');
          await loadGallery();
        } else {
          showToast('Could not delete ' + name, 'error');
        }
      } catch (err) {
        showToast('Delete error: ' + err.message, 'error');
      }
    }

    document.getElementById('btnDeleteAll').addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete all ingested screenshots?')) return;
      if (offlineQueue.length > 0) {
        for (const item of offlineQueue) {
          await deleteFromDB(item.name);
        }
        offlineQueue = [];
      }
      const base = getBackendBase();
      try {
        const res = await fetch(base + '/api/clear_uploaded_screenshots', { method: 'POST' });
        if (res.ok) {
          showToast('Ingested screenshots cleared!', 'success');
        }
      } catch {}
      await loadGallery();
    });

    // UI BUTTON EVENT LISTENERS
    document.getElementById('btnPasteClipboard').addEventListener('click', async () => {
      try {
        const clipItems = await navigator.clipboard.read();
        let handled = false;
        for (const item of clipItems) {
          const imageType = item.types.find(t => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            await uploadPayload(blob, 'Clipboard_' + Date.now() + '.png');
            handled = true;
            break;
          }
        }
        if (!handled) {
          const text = await navigator.clipboard.readText();
          if (text && (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('data:image/'))) {
            await uploadPayload(text.trim(), 'Pasted_URL_' + Date.now() + '.png');
          } else {
            showToast('No image or image URL found in system clipboard.', 'info');
          }
        }
      } catch (err) {
        showToast('Press Ctrl+V (or ⌘V) on your keyboard to paste.', 'info', 4000);
      }
    });

    document.getElementById('btnBrowseFiles').addEventListener('click', () => filePicker.click());
    filePicker.addEventListener('change', (e) => handleFiles(e.target.files));

    document.getElementById('btnUploadVideo').addEventListener('click', () => videoFilePicker.click());
    videoFilePicker.addEventListener('change', (e) => handleFiles(e.target.files));

    document.getElementById('btnToggleUrl').addEventListener('click', () => {
      urlInputWrap.classList.toggle('open');
      if (urlInputWrap.classList.contains('open')) manualInput.focus();
    });

    document.getElementById('btnSubmitManual').addEventListener('click', () => {
      const val = manualInput.value.trim();
      if (!val) return;
      uploadPayload(val, 'Manual_' + Date.now() + '.png');
      manualInput.value = '';
      urlInputWrap.classList.remove('open');
    });

    btnLinkFolder.addEventListener('click', linkLocalFolder);

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
    document.getElementById('btnRefresh').addEventListener('click', loadGallery);
    document.getElementById('btnTestConn').addEventListener('click', async () => {
      showToast('Probing ' + getBackendBase() + '...', 'info', 1500);
      await loadGallery();
    });
    btnSyncOffline.addEventListener('click', syncOfflineQueue);

    // Initial Load & Auto-Poll
    loadGallery();
    setInterval(loadGallery, 4000);
  </script>
</body>
</html>`;
}

fs.writeFileSync(path.join(repoRoot, "paste.html"), generateHtml(true), "utf8");
fs.writeFileSync(path.join(studioDir, "paste.html"), generateHtml(false), "utf8");
console.log("Successfully generated paste.html (root) and docs/mini_run_studio/paste.html with Font JSON Support & Cranial Head Section!");
