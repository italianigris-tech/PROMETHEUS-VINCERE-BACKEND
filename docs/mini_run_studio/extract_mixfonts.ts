import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Mixfont Lens API keys. Credentials are ROTATED automatically: on an HTTP 402
// (team credits exhausted) the script advances to the next key and never
// retries an exhausted key for the rest of the run. Order = priority.
//
// KEY INVENTORY (for future reference). All four were valid; the Mixfont
// team credits are now DEPLETED (each returned ~1 credit / shared team balance
// that my validation calls consumed). Keys remain valid — only top-up needed.
//   mix_live_a83c1a45624149ccc1749afac17b2ec26a51dfe645642ed8   ✅ key valid, team credits ⏹
//   mix_live_3a4bc238912b393faee16fe60ebfba44e554829f0c867119   ✅ key valid, team credits ⏹
//   mix_live_a78d4ade13fe2ff906ade0478e03a5544d7bf25121965209   ✅ key valid, team credits ⏹
//   mix_live_d0b669c17843c336252e36c05ee82b1c1d70fad2d2a5418c   ✅ key valid, team credits ⏹ (original)
// ---------------------------------------------------------------------------
const API_KEYS: string[] = [
  "mix_live_a83c1a45624149ccc1749afac17b2ec26a51dfe645642ed8",
  "mix_live_3a4bc238912b393faee16fe60ebfba44e554829f0c867119",
  "mix_live_a78d4ade13fe2ff906ade0478e03a5544d7bf25121965209",
  "mix_live_d0b669c17843c336252e36c05ee82b1c1d70fad2d2a5418c",
];

const BASE_URL = "https://api.mixfont.com/v1/lens";
// Raw new screenshots are served from the uploads folder; the curated
// "font pairing and placement" crops are served under /font_pairs/.
const UPLOAD_HOST = "http://16.192.95.115:8080/uploaded_screenshots";
const PAIRS_HOST = "http://16.192.95.115:8080/font_pairs";
const studioDir = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(studioDir, "fonts");

if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// CLI arg `--pairs` switches to the curated crops; default is raw uploads.
const usePairs = process.argv.includes("--pairs");
const PUBLIC_HOST = usePairs ? PAIRS_HOST : UPLOAD_HOST;

interface FontFile {
  full_name: string;
  style: string;
  weight: number;
  url: string;
}

interface FontMatch {
  name: string;
  score: number;
  fonts: FontFile[];
}

interface LensResponse {
  word: string | null;
  word_box: { left: number; top: number; width: number; height: number } | null;
  input_image: { width: number; height: number; image_url: string };
  font_matches: FontMatch[];
  requestId?: string;
  error?: string;
}

// Keys observed to be out of credits; skipped for the remainder of the run.
const exhaustedKeys = new Set<string>();

async function apiCallWithKey(
  apiKey: string,
  body: string,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      BASE_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 45000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode || 0, text: data }));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.write(body);
    req.end();
  });
}

interface LensCallResult {
  data: LensResponse | null;
  keyUsed: string | null;
  exhausted: string[];
}

async function callMixfontLens(imageUrl: string): Promise<LensCallResult> {
  const payload = JSON.stringify({ image_url: imageUrl, top_k: 5 });
  for (const key of API_KEYS) {
    if (exhaustedKeys.has(key)) continue;
    try {
      const { status, text } = await apiCallWithKey(key, payload);
      if (status === 402) {
        exhaustedKeys.add(key);
        console.warn(`   ⚠️  Key ${key.slice(0, 24)}… exhausted (402) — rotating.`);
        continue;
      }
      let data: LensResponse;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Failed to parse JSON (HTTP ${status}): ${text}`);
      }
      if (status >= 400) {
        throw new Error(`API HTTP ${status}: ${text}`);
      }
      return { data, keyUsed: key, exhausted: [...exhaustedKeys] };
    } catch (err: any) {
      console.warn(`   ⚠️  Key ${key.slice(0, 24)}… failed: ${err.message}`);
    }
  }
  return { data: null, keyUsed: null, exhausted: [...exhaustedKeys] };
}

async function downloadFile(url: string, destPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(() => {
          const stats = fs.statSync(destPath);
          resolve(stats.size);
        });
      });
    }).on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Batching: targets come from CLI args (screenshot filenames) or from an
// optional --file <path> (one name per line). --start N / --limit N slice the
// ordered list so we can run the pipeline in safe, punctuated batches.
// ---------------------------------------------------------------------------
function resolveTargets(): string[] {
  const fileIdx = process.argv.indexOf("--file");
  let names: string[] = [];
  if (fileIdx !== -1 && process.argv[fileIdx + 1]) {
    const contents = fs.readFileSync(process.argv[fileIdx + 1], "utf8");
    names = contents
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } else {
    names = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  }
  const startIdx = process.argv.indexOf("--start");
  const sliceStart = startIdx !== -1 ? parseInt(process.argv[startIdx + 1], 10) || 0 : 0;
  const limitIdx = process.argv.indexOf("--limit");
  const sliceLen = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) || Infinity : Infinity;
  return names.slice(sliceStart, sliceStart + sliceLen);
}

async function main() {
  const targets = resolveTargets();
  if (targets.length === 0) {
    console.log(
      "No targets. Usage: node extract_mixfonts.ts <name.png> [more...] | --file batch.txt [--start N --limit N] [--pairs]",
    );
    return;
  }
  console.log("=================================================================================");
  console.log("🎨 MIXFONT LENS EXTRACTION PIPELINE (multi-key rotation, batched)");
  console.log("=================================================================================");
  console.log(`Target Images: ${targets.length}`);
  console.log(`Public Host:   ${PUBLIC_HOST}`);
  console.log(`Output:        ${fontsDir}`);
  console.log("--------------------------------------------------------------------------------\n");

  const results: any[] = [];

  for (let i = 0; i < targets.length; i++) {
    const imageName = targets[i];
    const publicUrl = `${PUBLIC_HOST}/${encodeURIComponent(imageName)}`;

    console.log(`\n[${i + 1}/${targets.length}] 🔍 ${imageName}`);
    console.log(`   URL: ${publicUrl}`);

    const { data, keyUsed, exhausted } = await callMixfontLens(publicUrl);
    if (!data) {
      console.error(`   ❌ All API keys exhausted for ${imageName}.`);
      results.push({ image: imageName, error: "All API keys exhausted", status: "no_credits", exhausted });
      break;
    }
    console.log(`   Key: ${(keyUsed || "").slice(0, 24)}…`);
    console.log(`   ✅ Word: "${data.word || "(none)"}" Box: ${JSON.stringify(data.word_box)}`);
    console.log(`   Matches: ${data.font_matches?.length || 0} (Exhausted: ${exhausted.length})`);

    const downloadedFonts: string[] = [];
    if (data.font_matches && data.font_matches.length > 0) {
      for (let m = 0; m < data.font_matches.length; m++) {
        const match = data.font_matches[m];
        const rank = m + 1;
        console.log(`     #${rank}: ${match.name} (Score: ${(match.score * 100).toFixed(1)}%)`);
        const fontsToDownload = m === 0 ? match.fonts : match.fonts.slice(0, 1);
        for (const fontFile of fontsToDownload) {
          if (fontFile.url) {
            const ext = path.extname(new URL(fontFile.url).pathname) || ".ttf";
            const safeName = fontFile.full_name.replace(/[^a-zA-Z0-9_-]/g, "_") + ext;
            const dest = path.join(fontsDir, safeName);
            try {
              const size = await downloadFile(fontFile.url, dest);
              console.log(`        📥 ${safeName} (${(size / 1024).toFixed(1)} KB)`);
              downloadedFonts.push(safeName);
            } catch {
              console.warn(`        ⚠️  Failed to download ${fontFile.url}`);
            }
          }
        }
      }
    }

    results.push({
      image: imageName,
      word: data.word,
      word_box: data.word_box,
      font_matches: data.font_matches,
      downloaded: downloadedFonts,
      key_used: keyUsed,
      exhausted,
      status: "success",
    });

    if (i < targets.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const manifestPath = path.join(studioDir, `mixfont_extraction_manifest_${Date.now()}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\n📄 Saved manifest: ${manifestPath}`);
  if (exhaustedKeys.size > 0) {
    console.log(`ℹ️  Exhausted keys this run: ${[...exhaustedKeys].map((k) => k.slice(0, 24)).join(", ")}`);
  }
}

main().catch((err) => {
  console.error("Fatal pipeline error:", err);
  process.exit(1);
});
