import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const studioDir = path.join(repoRoot, "docs", "mini_run_studio");
const uploadDir = path.join(studioDir, "uploaded_screenshots");
const refDir = path.join(repoRoot, "Yuan Prometheus Screenshots", "font pairing and placement");
const videoDir = path.join(studioDir, "uploaded_videos");

function getFiles(dir, filterFn) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(filterFn).map(name => {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    return { name, size: st.size, mtimeMs: st.mtimeMs };
  }).sort((a, b) => b.mtimeMs - a.mtimeMs);
}

const uploadedFiles = getFiles(uploadDir, f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f) && !f.startsWith("test_"));
const refFiles = getFiles(refDir, f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f));
const videoFiles = getFiles(videoDir, f => /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(f));

function generateHtml(isRoot) {
  const uploadPathPrefix = isRoot ? "docs/mini_run_studio/uploaded_screenshots/" : "uploaded_screenshots/";
  const refPathPrefix = isRoot ? "Yuan Prometheus Screenshots/font pairing and placement/" : "../../Yuan Prometheus Screenshots/font pairing and placement/";
  const videoPathPrefix = isRoot ? "docs/mini_run_studio/uploaded_videos/" : "uploaded_videos/";

  const uploadedData = uploadedFiles.map(f => ({
    name: f.name,
    size: f.size,
    mtimeMs: f.mtimeMs,
    localUrl: `${uploadPathPrefix}${f.name}`,
    serverUrl: `/uploaded_screenshots/${f.name}`,
    category: "uploaded"
  }));

  const refData = refFiles.map(f => ({
    name: f.name,
    size: f.size,
    mtimeMs: f.mtimeMs,
    localUrl: `${refPathPrefix}${f.name}`,
    serverUrl: `/font_pairs/${encodeURIComponent(f.name)}`,
    category: "reference"
  }));

  const videoData = videoFiles.map(f => ({
    name: f.name,
    size: f.size,
    mtimeMs: f.mtimeMs,
    localUrl: `${videoPathPrefix}${f.name}`,
    serverUrl: `/uploaded_videos/${f.name}`,
    category: "video"
  }));

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
    .container { width: 100%; max-width: 1380px; }
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
      transition: all 0.2s;
    }
    .btn-conn:hover { background: rgba(255, 255, 255, 0.15); border-color: var(--accent-cyan); }
    
    .btn-link-folder {
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.4);
      color: #C084FC;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-link-folder:hover {
      background: rgba(139, 92, 246, 0.3);
      border-color: var(--accent-purple);
      color: #FFF;
    }

    .btn-sync-offline {
      background: linear-gradient(135deg, #10B981, #059669);
      border: none;
      color: #FFF;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: none;
      animation: pulseSync 2s infinite;
    }
    @keyframes pulseSync {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(16, 185, 129, 0); }
      50% { transform: scale(1.03); box-shadow: 0 0 14px rgba(16, 185, 129, 0.6); }
    }

    .nav-links { display: flex; justify-content: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
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
      box-shadow: 0 0 30px rgba(0, 240, 255, 0.6);
    }
    .dropzone-icon {
      font-size: 44px;
      margin-bottom: 12px;
      display: inline-block;
      animation: floatIcon 3s ease-in-out infinite;
    }
    @keyframes floatIcon {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    .dropzone h3 { font-size: 20px; color: #FFF; margin-bottom: 6px; font-weight: 800; }
    .dropzone p { color: #8E9BAE; font-size: 13.5px; margin-bottom: 18px; max-width: 640px; margin-left: auto; margin-right: auto; }

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
    .btn-video-upload {
      border-color: rgba(139, 92, 246, 0.4);
      background: rgba(139, 92, 246, 0.1);
    }
    .btn-video-upload:hover {
      border-color: var(--accent-purple);
      background: rgba(139, 92, 246, 0.25);
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
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
    }

    /* INGEST DESTINATION INFO */
    .destination-info {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 10px 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-around;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: #8E9BAE;
      flex-wrap: wrap;
    }
    .destination-info code {
      color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.08);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    /* TABS BAR */
    .tabs-bar {
      display: flex;
      gap: 10px;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }
    .tab-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--panel-border);
      color: #94A3B8;
      padding: 10px 20px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .tab-btn:hover { color: #FFF; background: rgba(255, 255, 255, 0.1); }
    .tab-btn.active {
      background: rgba(0, 240, 255, 0.12);
      border-color: var(--accent-cyan);
      color: var(--accent-cyan);
      box-shadow: 0 0 15px rgba(0, 240, 255, 0.2);
    }
    .tab-count {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 7px;
      border-radius: 12px;
      font-size: 11px;
      font-family: monospace;
    }
    .tab-btn.active .tab-count {
      background: var(--accent-cyan);
      color: #070913;
      font-weight: 800;
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
    .gallery-title-group { display: flex; align-items: center; gap: 12px; }
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
      width: 180px;
      transition: all 0.2s;
    }
    .search-box:focus { border-color: var(--accent-cyan); width: 240px; }
    
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
    }
    .tag-uploaded { border-color: var(--accent-cyan); color: var(--accent-cyan); background: rgba(0, 240, 255, 0.15); }
    .tag-reference { border-color: var(--accent-purple); color: #C084FC; background: rgba(192, 132, 252, 0.15); }
    .tag-persisted { border-color: var(--accent-green); color: #34D399; background: rgba(16, 185, 129, 0.15); }

    .item-details { display: flex; flex-direction: column; gap: 4px; }
    .item-name { 
      font-size: 13.5px; 
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
    .item-btn-bar { display: flex; gap: 8px; margin-top: 4px; }
    .btn-item {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--panel-border);
      color: #D1D5DB;
      padding: 6px 0;
      border-radius: 7px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
    }
    .btn-item:hover { color: #FFF; background: rgba(255,255,255,0.12); border-color: var(--accent-cyan); }
    .btn-item-del {
      flex: 0 0 34px;
      color: #F87171;
    }
    .btn-item-del:hover { background: rgba(239, 68, 68, 0.2); border-color: #EF4444; color: #FFF; }

    /* LIGHTBOX MODAL */
    #lightboxModal, #videoLightboxModal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.92);
      z-index: 100000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      backdrop-filter: blur(10px);
    }
    #lightboxModal.open, #videoLightboxModal.open { display: flex; }
    .lightbox-content {
      position: relative;
      max-width: 92vw;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      gap: 14px;
      align-items: center;
    }
    .lightbox-img-wrap, .lightbox-video-wrap {
      max-width: 90vw;
      max-height: 80vh;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9);
      border: 1px solid var(--panel-border);
      background-color: #0c101c;
      background-image: 
        linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%), 
        linear-gradient(-45deg, rgba(255,255,255,0.04) 25%, transparent 25%), 
        linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.04) 75%), 
        linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.04) 75%);
      background-size: 20px 20px;
    }
    .lightbox-img-wrap img { max-width: 100%; max-height: 80vh; display: block; object-fit: contain; }
    .lightbox-video-wrap video { max-width: 100%; max-height: 80vh; display: block; }
    .lightbox-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      padding: 10px 18px;
      border-radius: 10px;
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
      <div>🌄 Landscape Mirror: <code>docs/mini_landscape_runs/uploaded_assets/</code></div>
      <div>🎨 Reference Bank: <code>Yuan Prometheus Screenshots/font pairing and placement/</code></div>
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
      <button class="tab-btn" id="tabRef" onclick="switchTab('reference')" type="button">
        🎨 Curated Reference Bank <span class="tab-count" id="countRef">${refData.length}</span>
      </button>
      <button class="tab-btn" id="tabVideos" onclick="switchTab('video')" type="button">
        🎭 Principal Speaker Videos <span class="tab-count" id="countVideos">${videoData.length}</span>
      </button>
      <button class="tab-btn" id="tabAll" onclick="switchTab('all')" type="button">
        🌟 All Assets <span class="tab-count" id="countAll">${uploadedData.length + refData.length + videoData.length}</span>
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
        <input type="text" class="search-box" id="searchBox" placeholder="🔍 Search assets..." />
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

  <script>
    // PRE-BAKED INITIAL ASSETS (Guaranteed to show even offline on file://)
    const BAKED_UPLOADED = ${JSON.stringify(uploadedData, null, 2)};
    const BAKED_REFERENCES = ${JSON.stringify(refData, null, 2)};
    const BAKED_VIDEOS = ${JSON.stringify(videoData, null, 2)};

    let currentTab = 'uploaded';
    let allScreenshots = [...BAKED_UPLOADED];
    let allReferences = [...BAKED_REFERENCES];
    let allVideos = [...BAKED_VIDEOS];
    let offlineQueue = [];
    let isBackendLive = false;
    let localDirHandle = null;

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
      return backendUrlInput.value.trim().replace(/\\/+$/, '') || 'http://localhost:8080';
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
      ['tabUploaded', 'tabRef', 'tabVideos', 'tabAll'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
      });
      if (tab === 'uploaded') document.getElementById('tabUploaded').classList.add('active');
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
        statusText.innerText = '🟡 Standalone Local Mode (' + (allScreenshots.length + allReferences.length) + ' assets loaded)';
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
        // Merge into offlineQueue without duplicates
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
      const rCount = allReferences.length;
      const vCount = allVideos.length;
      document.getElementById('countUploaded').innerText = uCount;
      document.getElementById('countRef').innerText = rCount;
      document.getElementById('countVideos').innerText = vCount;
      document.getElementById('countAll').innerText = uCount + rCount + vCount;
    }

    function renderGallery() {
      const q = (searchBox.value || '').trim().toLowerCase();
      let pool = [];

      if (currentTab === 'uploaded') pool = [...offlineQueue, ...allScreenshots];
      else if (currentTab === 'reference') pool = [...allReferences];
      else if (currentTab === 'video') pool = [...allVideos];
      else pool = [...offlineQueue, ...allScreenshots, ...allReferences, ...allVideos];

      const filtered = pool.filter(item => item.name.toLowerCase().includes(q));
      
      const badge = document.getElementById('galleryBadge');
      const sizeReadout = document.getElementById('gallerySizeReadout');
      const titleEl = document.getElementById('gallerySectionTitle');

      if (currentTab === 'uploaded') titleEl.innerText = 'Uploaded Screenshots';
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
        tag.className = 'item-category-tag ' + (item.isPersisted ? 'tag-persisted' : (item.category === 'reference' ? 'tag-reference' : 'tag-uploaded'));
        tag.innerText = item.isPersisted ? 'SAVED (DB)' : (item.isOffline ? 'OFFLINE' : (item.category === 'reference' ? 'REF' : 'UPLOAD'));
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

        btnBar.appendChild(copyBtn);
        btnBar.appendChild(viewBtn);
        if (item.category !== 'reference') {
          btnBar.appendChild(delBtn);
        }

        card.appendChild(mediaWrap);
        card.appendChild(details);
        card.appendChild(btnBar);

        gal.appendChild(card);
      });
    }

    async function uploadPayload(dataOrBlob, filenameHint) {
      let previewThumb = '';
      if (dataOrBlob instanceof Blob) {
        try {
          const objUrl = URL.createObjectURL(dataOrBlob);
          previewThumb = '<img src="' + objUrl + '" style="width:28px;height:28px;border-radius:6px;object-fit:cover;border:1px solid #FFF;margin-right:6px;" />';
        } catch {}
      }
      
      const targetName = filenameHint || ('Screenshot_' + Date.now() + '.png');
      const toast = showToast((previewThumb || '⏳ ') + '<span>Ingesting screenshot...</span>', 'uploading', 30000);
      const base = getBackendBase();

      // 1. Check if direct folder handle is mounted (No server needed)
      if (localDirHandle && (dataOrBlob instanceof Blob)) {
        const saved = await saveDirectToDisk(dataOrBlob, targetName);
        if (saved) {
          toast.remove();
          showToast('✓ Saved real file to hard drive: ' + targetName, 'success', 3500);
          await loadGallery();
          return;
        }
      }

      // 2. Try live HTTP server
      try {
        if (isBackendLive) {
          let res;
          if (typeof dataOrBlob === 'string') {
            res = await fetch(base + '/api/upload-paste', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: dataOrBlob, filename: targetName })
            });
          } else {
            let url = base + '/api/upload-paste?filename=' + encodeURIComponent(targetName);
            res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': dataOrBlob.type || 'application/octet-stream' },
              body: dataOrBlob
            });
          }

          const data = await res.json();
          toast.remove();

          if (data.status === 'success') {
            showToast('✓ Saved to disk: ' + data.filename + ' (' + formatBytes(data.bytes) + ')', 'success', 3500);
            await loadGallery();
            return;
          }
        }
      } catch (err) {
        console.warn('Live upload failed, saving to IndexedDB:', err);
      }

      // 3. Fallback: Save to browser IndexedDB persistent storage
      toast.remove();
      let dataUrl = '';
      let size = 0;

      if (dataOrBlob instanceof Blob) {
        size = dataOrBlob.size;
        dataUrl = await new Promise(r => {
          const reader = new FileReader();
          reader.onload = () => r(reader.result);
          reader.readAsDataURL(dataOrBlob);
        });
      } else if (typeof dataOrBlob === 'string') {
        dataUrl = dataOrBlob;
        size = Math.round(dataOrBlob.length * 0.75);
      }

      const itemRecord = {
        name: targetName,
        dataUrl,
        size,
        mtimeMs: Date.now(),
        isOffline: true,
        isPersisted: true,
        category: 'uploaded'
      };

      await saveToDB(itemRecord);
      offlineQueue.unshift(itemRecord);

      showToast('💾 Saved to persistent browser storage: ' + targetName, 'info', 4000);
      updateTabCounts();
      renderGallery();
      btnSyncOffline.style.display = 'inline-block';
      btnSyncOffline.innerText = '⚡ Sync ' + offlineQueue.length + ' Offline Items';
    }

    async function syncOfflineQueue() {
      if (offlineQueue.length === 0) return;
      const toast = showToast('⏳ Syncing ' + offlineQueue.length + ' offline screenshots...', 'uploading', 30000);
      const items = [...offlineQueue];
      let syncedCount = 0;

      for (const item of items) {
        try {
          const payload = item.dataUrl;
          await uploadPayload(payload, item.name);
          await deleteFromDB(item.name);
          offlineQueue = offlineQueue.filter(x => x.name !== item.name);
          syncedCount++;
        } catch {}
      }

      toast.remove();
      showToast('✓ Successfully synced ' + syncedCount + ' items to backend disk!', 'success', 4000);
      await loadGallery();
    }

    async function uploadVideoPayload(file, filenameHint) {
      const base = getBackendBase();
      const toast = showToast('⏳ Uploading matted video: ' + filenameHint + '...', 'uploading', 60000);
      try {
        const url = base + '/api/upload-video?filename=' + encodeURIComponent(filenameHint);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'video/mp4' },
          body: file
        });
        const data = await res.json();
        toast.remove();
        if (data.status === 'success') {
          showToast('✓ Matted video saved: ' + data.filename, 'success', 3500);
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
        } else if (!file.type || file.type.startsWith('video/') || /\\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(file.name || '')) {
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
        const res = await fetch(base + '/api/delete_screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: name })
        });
        if (res.ok) {
          showToast('✓ Deleted: ' + name, 'success');
          await loadGallery();
        }
      } catch (err) {
        showToast('❌ Delete failed: ' + err.message, 'error');
      }
    }

    async function deleteVideoAsset(name) {
      const base = getBackendBase();
      try {
        const res = await fetch(base + '/api/delete_video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: name })
        });
        if (res.ok) {
          showToast('✓ Deleted video: ' + name, 'success');
          await loadGallery();
        }
      } catch (err) {
        showToast('❌ Delete failed: ' + err.message, 'error');
      }
    }

    // UI EVENT LISTENERS
    document.getElementById('btnPasteClipboard').addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.read) {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                const blob = await item.getType(type);
                await uploadPayload(blob, 'Clipboard_' + Date.now() + '.png');
                return;
              }
            }
          }
        }
      } catch {}
      showToast('👉 Press Ctrl+V (or ⌘V) on your keyboard to paste.', 'info', 4000);
    });

    document.getElementById('btnBrowseFiles').addEventListener('click', (e) => {
      e.stopPropagation();
      filePicker.click();
    });
    filePicker.addEventListener('change', (e) => handleFiles(e.target.files));

    document.getElementById('btnUploadVideo').addEventListener('click', (e) => {
      e.stopPropagation();
      videoFilePicker.click();
    });
    videoFilePicker.addEventListener('change', (e) => handleFiles(e.target.files));

    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      filePicker.click();
    });

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
console.log(`Generated paste.html (root) and docs/mini_run_studio/paste.html with IndexedDB persistence & File System API support!`);
