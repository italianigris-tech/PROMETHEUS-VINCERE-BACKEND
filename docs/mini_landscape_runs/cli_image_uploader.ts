#!/usr/bin/env node
/**
 * DIRECT CLI IMAGE UPLOADER FOR EC2 TERMINAL
 * 
 * Supports:
 * 1. upload-image <local_file_path>
 * 2. upload-image <http_url>
 * 3. upload-image --base64 "<data:image/png;base64,...>"
 * 4. upload-image --stdin (pipes or raw stdin input)
 * 5. upload-image --paste (interactive prompt)
 * 
 * Automatically applies the Cinematic Photo Treatment Engine upon upload.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";
import * as https from "node:https";
import * as readline from "node:readline";
import { generatePhotoTreatmentBlueprint } from "./photo_treatment_engine.js";

const repoRoot = path.resolve(__dirname, "../..");
const targetUploadDir = path.join(repoRoot, "docs/mini_run_studio/uploaded_screenshots");
const targetLandscapeDir = path.join(repoRoot, "docs/mini_landscape_runs/uploaded_assets");

if (!fs.existsSync(targetUploadDir)) fs.mkdirSync(targetUploadDir, { recursive: true });
if (!fs.existsSync(targetLandscapeDir)) fs.mkdirSync(targetLandscapeDir, { recursive: true });

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function generateTargetFilename(originalNameHint: string = "image.png"): string {
  const existingCount = fs.readdirSync(targetUploadDir).filter(f => /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(f)).length;
  const nextIdx = String(existingCount + 1).padStart(2, "0");
  const now = new Date();
  const timeFormatted = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  
  let baseExt = path.extname(originalNameHint) || ".png";
  if (!/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(baseExt)) baseExt = ".png";
  
  const cleanHint = path.basename(originalNameHint, baseExt).replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!cleanHint || cleanHint === "blob" || cleanHint.startsWith("image") || cleanHint.startsWith("Screenshot_")) {
    return `Screenshot_${nextIdx}_${timeFormatted}${baseExt}`;
  }
  return `${cleanHint}_${timeFormatted}${baseExt}`;
}

export async function saveAndProcessImage(buffer: Buffer, filenameHint: string = "image.png") {
  const filename = generateTargetFilename(filenameHint);
  const primaryPath = path.join(targetUploadDir, filename);
  const landscapeCopyPath = path.join(targetLandscapeDir, filename);

  fs.writeFileSync(primaryPath, buffer);
  fs.copyFileSync(primaryPath, landscapeCopyPath);

  // Generate Photo Treatment
  const blueprint = generatePhotoTreatmentBlueprint({
    assetId: `upload_${filename.replace(/\.[^.]+$/, "")}`,
    assetSourcePath: primaryPath,
  });

  console.log("\n===============================================================================");
  console.log("✅ IMAGE SUCCESSFULLY UPLOADED & CINEMATICALLY PROCESSED");
  console.log("===============================================================================");
  console.log(`📁 File Name:          ${filename}`);
  console.log(`💾 Size:               ${formatBytes(buffer.length)}`);
  console.log(`📍 Project Path:       ${primaryPath}`);
  console.log(`🌐 Preview URL:        http://localhost:8080/uploaded_screenshots/${filename}`);
  console.log(`🎬 Photo Treatment:    ${blueprint.mood.toUpperCase()}`);
  console.log(`✨ Halation:           ${blueprint.halation.color} (${blueprint.halation.radiusPx}px radius)`);
  console.log(`🌈 Optical Fringe:     ${blueprint.chromaticAberration.colorPair} (${blueprint.chromaticAberration.fringeOffsetPx}px offset)`);
  console.log(`🌫️ Pro-Mist Diffusion:  ${blueprint.diffusionProMist.diffusionRadiusPx}px highlight bleed`);
  console.log(`🎞️ Perceived Grain:    ${blueprint.perceivedGrain.filmEmulsionType} (${blueprint.perceivedGrain.midtoneDensity} density)`);
  console.log(`📐 Gate Weave:         ${blueprint.gateWeave.rotationDeg}° rotation, (${blueprint.gateWeave.offsetXPx}px, ${blueprint.gateWeave.offsetYPx}px)`);
  console.log(`🔲 Vignette:           ${blueprint.vignette.lensHoodShape} (${Math.round(blueprint.vignette.cornerDarkeningPct * 100)}% falloff)`);
  console.log("-------------------------------------------------------------------------------");
  console.log(`🖼️ Markdown Embed:     ![${filename}](${primaryPath})`);
  console.log("===============================================================================\n");

  return { filename, primaryPath, blueprint };
}

async function downloadFromUrl(urlStr: string): Promise<{ buffer: Buffer; filename: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const client = urlObj.protocol === "https:" ? https : http;
    
    console.log(`⏳ Downloading image from: ${urlStr}...`);
    client.get(urlStr, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadFromUrl(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: Failed to download image from URL`));
      }
      const chunks: Buffer[] = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const filename = path.basename(urlObj.pathname) || "downloaded_image.png";
        resolve({ buffer, filename });
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

function parseBase64(b64Str: string): { buffer: Buffer; ext: string } {
  let clean = b64Str.trim();
  let ext = "png";
  if (clean.startsWith("data:")) {
    const match = clean.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
    if (match) {
      ext = match[1] === "jpeg" ? "jpg" : match[1];
      clean = clean.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, "");
    }
  }
  return { buffer: Buffer.from(clean, "base64"), ext };
}

async function main() {
  const args = process.argv.slice(2);

  // Stdin pipe check
  if (!process.stdin.isTTY && (args.includes("--stdin") || args.length === 0)) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const full = Buffer.concat(chunks);
    const textSample = full.toString("utf8", 0, Math.min(full.length, 100)).trim();
    if (textSample.startsWith("data:image") || /^[A-Za-z0-9+/=]{100,}/.test(textSample)) {
      const { buffer, ext } = parseBase64(full.toString("utf8"));
      await saveAndProcessImage(buffer, `pasted_image.${ext}`);
      return;
    }
    await saveAndProcessImage(full, "stdin_image.png");
    return;
  }

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    console.log(`
Direct EC2 Terminal Image Uploader
===================================
Usage:
  upload-image <file_path>              Upload local image file
  upload-image <http_url>               Download and ingest image from web URL
  upload-image --base64 "<b64_string>"  Ingest base64 encoded image string
  upload-image --paste                  Interactive prompt to paste base64 or URL
  cat image.png | upload-image          Pipe raw image or base64 stream

Web Browser Dropzone & Clipboard Paste:
  http://localhost:8080/upload
  http://localhost:8080/paste
`);
    return;
  }

  const firstArg = args[0];

  if (firstArg === "--base64") {
    const b64 = args[1];
    if (!b64) {
      console.error("❌ Error: Missing base64 string.");
      process.exit(1);
    }
    const { buffer, ext } = parseBase64(b64);
    await saveAndProcessImage(buffer, `base64_upload.${ext}`);
    return;
  }

  if (firstArg === "--paste" || firstArg === "-p") {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("📋 Paste Image URL or Base64 data string: ", async (input) => {
      rl.close();
      const val = input.trim();
      if (!val) {
        console.error("❌ Empty input.");
        return;
      }
      if (val.startsWith("http://") || val.startsWith("https://")) {
        const { buffer, filename } = await downloadFromUrl(val);
        await saveAndProcessImage(buffer, filename);
      } else {
        const { buffer, ext } = parseBase64(val);
        await saveAndProcessImage(buffer, `pasted_image.${ext}`);
      }
    });
    return;
  }

  // Check if URL
  if (firstArg.startsWith("http://") || firstArg.startsWith("https://")) {
    const { buffer, filename } = await downloadFromUrl(firstArg);
    await saveAndProcessImage(buffer, filename);
    return;
  }

  // Check if Local File
  const resolvedPath = path.resolve(process.cwd(), firstArg);
  if (fs.existsSync(resolvedPath)) {
    const buffer = fs.readFileSync(resolvedPath);
    await saveAndProcessImage(buffer, path.basename(resolvedPath));
    return;
  }

  // Check if raw base64 passed directly
  if (firstArg.startsWith("data:image") || firstArg.length > 500) {
    const { buffer, ext } = parseBase64(firstArg);
    await saveAndProcessImage(buffer, `pasted_image.${ext}`);
    return;
  }

  console.error(`❌ File not found or invalid format: ${firstArg}`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("❌ Upload failed:", err);
    process.exit(1);
  });
}
