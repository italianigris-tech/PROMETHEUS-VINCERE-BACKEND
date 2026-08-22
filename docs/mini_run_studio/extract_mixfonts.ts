import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";

const API_KEY = "mix_live_d0b669c17843c336252e36c05ee82b1c1d70fad2d2a5418c";
const BASE_URL = "https://api.mixfont.com/v1/lens";
const PUBLIC_HOST = "http://16.192.95.115:8080";
const studioDir = __dirname;
const fontsDir = path.join(studioDir, "fonts");

if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// Specified images by user: Image 1, 3, 4, 6, 8, 33, 35, 36
const TARGET_IMAGES = [
  "image (1).png",
  "image (3).png",
  "image (4).png",
  "image (6).png",
  "image (8).png",
  "image (33).png",
  "image (35).png",
  "image (36).png",
];

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

async function callMixfontLens(imageUrl: string): Promise<LensResponse> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      image_url: imageUrl,
      top_k: 5,
    });

    const req = https.request(
      BASE_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 45000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`API HTTP ${res.statusCode}: ${body}`));
            } else {
              resolve(data);
            }
          } catch (e: any) {
            reject(new Error(`Failed to parse JSON: ${body} (${e.message})`));
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });

    req.write(payload);
    req.end();
  });
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

async function main() {
  console.log("================================================================================");
  console.log("🎨 MIXFONT LENS EXTRACTION PIPELINE (Sequential Loop)");
  console.log("================================================================================");
  console.log(`Target Images: ${TARGET_IMAGES.length}`);
  console.log(`Output Directory: ${fontsDir}`);
  console.log("--------------------------------------------------------------------------------\n");

  const results: any[] = [];

  for (let i = 0; i < TARGET_IMAGES.length; i++) {
    const imageName = TARGET_IMAGES[i];
    const encodedImageName = encodeURIComponent(imageName);
    const publicUrl = `${PUBLIC_HOST}/font_pairs/${encodedImageName}`;

    console.log(`\n[${i + 1}/${TARGET_IMAGES.length}] 🔍 Analyzing: ${imageName}`);
    console.log(`   Public URL: ${publicUrl}`);

    try {
      const response = await callMixfontLens(publicUrl);
      console.log(`   ✅ Word Detected: "${response.word || "(none)"}" (Box: ${JSON.stringify(response.word_box)})`);
      console.log(`   Matches Found: ${response.font_matches?.length || 0}`);

      const downloadedFonts: string[] = [];

      if (response.font_matches && response.font_matches.length > 0) {
        for (let m = 0; m < response.font_matches.length; m++) {
          const match = response.font_matches[m];
          const rank = m + 1;
          console.log(`     #${rank}: ${match.name} (Score: ${(match.score * 100).toFixed(1)}%)`);

          // Download fonts for the matches
          const fontsToDownload = (m === 0) ? match.fonts : match.fonts.slice(0, 1);

          for (const fontFile of fontsToDownload) {
            if (fontFile.url) {
              const ext = path.extname(new URL(fontFile.url).pathname) || ".ttf";
              const safeName = fontFile.full_name.replace(/[^a-zA-Z0-9_-]/g, "_") + ext;
              const dest = path.join(fontsDir, safeName);

              try {
                const size = await downloadFile(fontFile.url, dest);
                console.log(`        📥 Downloaded: ${safeName} (${(size / 1024).toFixed(1)} KB)`);
                downloadedFonts.push(safeName);
              } catch (dlErr: any) {
                console.warn(`        ⚠️ Failed to download ${fontFile.url}: ${dlErr.message}`);
              }
            }
          }
        }
      }

      results.push({
        image: imageName,
        word: response.word,
        word_box: response.word_box,
        font_matches: response.font_matches,
        downloaded: downloadedFonts,
        status: "success",
      });

    } catch (err: any) {
      console.error(`   ❌ Failed for ${imageName}: ${err.message}`);
      results.push({
        image: imageName,
        error: err.message,
        status: "failed",
      });
    }

    // Gentle delay between sequential requests
    if (i < TARGET_IMAGES.length - 1) {
      console.log("   ⏳ Pacing 1s delay...");
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const manifestPath = path.join(studioDir, "mixfont_extraction_manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\n📄 Saved complete extraction manifest to: ${manifestPath}`);
}

main().catch((err) => {
  console.error("Fatal pipeline error:", err);
  process.exit(1);
});
