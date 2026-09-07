import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const uploadDir = path.join(repoRoot, "docs", "mini_run_studio", "uploaded_screenshots");
const landscapeDir = path.join(repoRoot, "docs", "mini_landscape_runs", "uploaded_assets");
const refDir = path.join(repoRoot, "Yuan Prometheus Screenshots", "font pairing and placement");

if (!fs.existsSync(landscapeDir)) fs.mkdirSync(landscapeDir, { recursive: true });

// Copy all uploaded screenshots to landscape uploaded_assets
const uploadFiles = fs.readdirSync(uploadDir).filter(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f) && !f.startsWith("test_"));
for (const file of uploadFiles) {
  const src = path.join(uploadDir, file);
  const dest = path.join(landscapeDir, file);
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
  }
}

const uploadedItems = uploadFiles.map(name => {
  const fp = path.join(uploadDir, name);
  const st = fs.statSync(fp);
  return {
    name,
    size: st.size,
    mtimeMs: st.mtimeMs,
    relRootUrl: `docs/mini_run_studio/uploaded_screenshots/${name}`,
    relStudioUrl: `uploaded_screenshots/${name}`,
    serverUrl: `/uploaded_screenshots/${name}`,
    category: "uploaded"
  };
}).sort((a, b) => b.mtimeMs - a.mtimeMs);

// Curated reference bank
let refItems = [];
if (fs.existsSync(refDir)) {
  const refFiles = fs.readdirSync(refDir).filter(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f));
  refItems = refFiles.map(name => {
    const fp = path.join(refDir, name);
    const st = fs.statSync(fp);
    return {
      name,
      size: st.size,
      mtimeMs: st.mtimeMs,
      relRootUrl: `Yuan Prometheus Screenshots/font pairing and placement/${name}`,
      relStudioUrl: `../../Yuan Prometheus Screenshots/font pairing and placement/${name}`,
      serverUrl: `/font_pairs/${encodeURIComponent(name)}`,
      category: "reference"
    };
  }).sort((a, b) => b.mtimeMs - a.mtimeMs);
}

console.log(`Synced ${uploadedItems.length} uploaded screenshots and found ${refItems.length} reference bank screenshots.`);

export { uploadedItems, refItems };
