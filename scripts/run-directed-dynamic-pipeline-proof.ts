import {createHash} from "node:crypto";
import {createReadStream, existsSync} from "node:fs";
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {probeVideoMetadata} from "../backend/src/integrations/ffprobe.js";
import {createJosephUploadPipeline} from "../backend/src/upload/joseph-upload-pipeline.js";
import {buildDeterministicShortsTextChunkPlan} from "../backend/src/maul/shorts-text-chunking.js";
import {renderFromManifest} from "../apps/worker/src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const defaultTalkingHeadVideoPath = String.raw`C:\Users\HomePC\Downloads\ALL BUT BACKEND\TALKIN  HEAD VIDEO S\Talking Head Video Raw - akimbosd (1080p, h264).mp4`;
const fallbackTalkingHeadVideoPath = String.raw`C:\Users\HomePC\Downloads\ALL BUT BACKEND\TALKIN  HEAD VIDEO S\MALE Head Video Raw.mp4`;

const sourcePath = path.resolve(
  process.argv[2] ||
    (existsSync(defaultTalkingHeadVideoPath)
      ? defaultTalkingHeadVideoPath
      : fallbackTalkingHeadVideoPath),
);

const outputDir = path.join(repoRoot, "artifacts", "directed-dynamic-proof");
const sfxDir = path.join(repoRoot, "remotion-app", "public", "sfx");
const storageDir = path.join(repoRoot, "backend", "data");

const hashFile = async (filePath: string): Promise<string> => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
};

async function main() {
  console.log("=== RUNNING DIRECTED DYNAMIC SEMANTIC CHUNKING E2E PIPELINE ===");
  console.log(`Source Video: ${sourcePath}`);

  if (!existsSync(sourcePath)) {
    throw new Error(`Source video not found at: ${sourcePath}`);
  }

  const metadata = await probeVideoMetadata(sourcePath);
  const sourceSha256 = await hashFile(sourcePath);
  const videoDurationMs = Math.round(metadata.duration_seconds * 1000);
  console.log(`Video Probed: ${metadata.width}x${metadata.height} @ ${metadata.fps}fps, Duration: ${metadata.duration_seconds.toFixed(2)}s`);

  // 1. Initialize Joseph Upload Pipeline
  const pipeline = createJosephUploadPipeline({
    storageDir,
    requireSpeechTranscript: false,
  });

  const sessionId = `directed_dynamic_proof_${Date.now()}`;
  console.log(`Pipeline Session ID: ${sessionId}`);

  // 2. Execute Render Job Creation (Transcription, Audio Planning, Font Selection)
  const jobResult = await pipeline.createRenderJob({
    sessionId,
    sourcePath,
    sourceFilename: path.basename(sourcePath),
    sourceDurationMs: videoDurationMs,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    sourceFps: metadata.fps,
    profile: "joseph_cinematic",
    retryIndex: 0,
    promptText: "Execute dynamic directed semantic chunking e2e pipeline on unedited talking head video",
  });

  console.log(`Render Job Created: ${jobResult.renderJobId}`);

  // 3. Extract Transcript & Run Directed Dynamic Semantic Mathematical Chunking
  const transcriptData = JSON.parse(
    await (await import("node:fs/promises")).readFile(jobResult.transcript.path, "utf8")
  );

  console.log(`Transcript Loaded: ${transcriptData.words.length} words`);

  const chunkPlan = buildDeterministicShortsTextChunkPlan({
    request: {
      transcript: transcriptData,
      videoDurationMs: jobResult.manifest.source.durationMs,
      pacing: "fast",
      style: "cinematic",
      constraints: {
        minWordsPerChunk: 1,
        maxWordsPerChunk: 5,
        preserveEveryWord: true,
      },
    },
    inference: {
      status: "skipped_missing_credentials",
      provider: "openai_compatible",
      baseUrl: "https://codex-everywhere.com",
      model: "gpt-5.6-terra",
      requestHash: null,
      responseHash: null,
      fallbackReason: "MAUL chunking API key is not configured; directed dynamic semantic policy applied.",
    },
  });

  console.log(`Directed Dynamic Semantic Chunks Generated: ${chunkPlan.chunks.length} chunks`);
  chunkPlan.chunks.forEach((chunk, index) => {
    console.log(`  [Chunk ${index + 1}] (${chunk.wordCount} words, role: ${chunk.semanticRole}): "${chunk.text}"`);
  });

  // 4. Output Artifacts (Chunk Plan, Font JSON, Render Manifest)
  await mkdir(outputDir, {recursive: true});

  const chunkPlanPath = path.join(outputDir, "text-chunk-plan.json");
  const fontJsonPath = path.join(outputDir, "font-typography-manifest.json");
  const manifestPath = path.join(outputDir, "unified-render-manifest.json");
  const summaryPath = path.join(outputDir, "pipeline-summary.json");

  await writeFile(chunkPlanPath, JSON.stringify(chunkPlan, null, 2), "utf8");
  await writeFile(fontJsonPath, JSON.stringify(jobResult.manifest.typography, null, 2), "utf8");
  await writeFile(manifestPath, JSON.stringify(jobResult.manifest, null, 2), "utf8");

  console.log(`Saved Chunk Plan JSON to: ${chunkPlanPath}`);
  console.log(`Saved Font Typography JSON to: ${fontJsonPath}`);
  console.log(`Saved Unified Render Manifest to: ${manifestPath}`);

  // 5. Render Final MP4 Video
  console.log("Rendering final MP4 video via Remotion / FFmpeg...");
  const finalVideoPath = await renderFromManifest(jobResult.manifest, {
    sfxDir,
    tempDir: outputDir,
  });

  const finalVideoStats = await (await import("node:fs/promises")).stat(finalVideoPath);
  console.log(`FINAL MP4 RENDER SUCCESSFUL! Output Video: ${finalVideoPath} (${finalVideoStats.size} bytes)`);

  const summary = {
    status: "success",
    sessionId,
    sourceVideo: {
      path: sourcePath,
      sha256: sourceSha256,
      durationSeconds: metadata.duration_seconds,
      resolution: `${metadata.width}x${metadata.height}`,
    },
    directedSemanticChunking: {
      totalWords: transcriptData.words.length,
      chunkCount: chunkPlan.chunks.length,
      chunks: chunkPlan.chunks.map((c) => ({
        text: c.text,
        wordCount: c.wordCount,
        semanticRole: c.semanticRole,
        emphasis: c.emphasis.text,
      })),
    },
    artifacts: {
      chunkPlanJson: chunkPlanPath,
      fontTypographyJson: fontJsonPath,
      renderManifestJson: manifestPath,
      finalMp4Video: finalVideoPath,
    },
  };

  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(`Pipeline Summary saved to: ${summaryPath}`);
  console.log("=== ALL STEPS COMPLETED SUCCESSFULLY ===");
}

main().catch((error) => {
  console.error("PIPELINE ERROR:", error);
  process.exit(1);
});
