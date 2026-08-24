/**
 * bake-landscape.ts — Modal GPU landscape bake.
 *
 * Consumes the Stage-7 treatment manifest (landscape_treatment_manifest.json),
 * bridges it to a UnifiedRenderManifest via landscapeTreatmentToUnifiedManifest,
 * copies the source media under remotion-app/public (staticFile prerequisite),
 * then runs the shared NVENC render spine (renderLandscapeFromManifest) and
 * writes the finished MP4 to the artifacts volume (out/).
 *
 * Called from the Modal GPU function (bake_landscape_mp4 in modal_landscape.py).
 *
 * Usage:
 *   npx tsx docs/mini_landscape_runs/bake-landscape.ts \
 *     --manifest <path> [--run-id <id>] [--out <dir>]
 *
 * Prints a JSON receipt as the last line of stdout.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {landscapeTreatmentToUnifiedManifest} from './landscape-to-unified.js';
import type {LandscapeTreatmentManifest} from './types.js';
import {renderLandscapeFromManifest} from '../../apps/worker/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, 'out');
const REMOTION_PUBLIC = path.resolve(__dirname, '../../remotion-app/public');
const SFX_DIR = path.join(REMOTION_PUBLIC, 'sfx');
const SOURCE_COPY_NAME = 'landscape-source.mp4';
const DEFAULT_AUDIO_TRACK = path.join(OUT_DIR, 'src_track.wav');

/* ------------------------------------------------------------------ *
 * Arg parsing
 * ------------------------------------------------------------------ */

function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const map: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i]?.startsWith('--') && args[i + 1] && !args[i + 1]?.startsWith('--')) {
      map[args[i]!.replace(/^--/, '')] = args[i + 1]!;
      i++;
    }
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * Source video resolution
 * ------------------------------------------------------------------ */

/**
 * Resolve the source video path for the bake.
 *
 * Priority:
 *  1. silenceCut.outputPath if it exists (silence-cut MP4 written by pipeline).
 *  2. --source CLI arg if provided and exists.
 *  3. silenceCut.sourcePath if it exists (original input — uncommon in container).
 *  4. Scan out/ for the most recent `*_cut.mp4` (fallback for pre-cut media).
 *  5. Scan out/ for the most recent non-bake `*.mp4`.
 */
function resolveSourceVideo(
  manifest: LandscapeTreatmentManifest,
  cliSource: string | undefined,
): string {
  const candidates: string[] = [];

  // 1. Pipeline silence-cut output (absolute path, set when --render was passed).
  if (manifest.silenceCut.outputPath) {
    candidates.push(manifest.silenceCut.outputPath);
  }

  // 2. CLI override.
  if (cliSource) {
    candidates.push(cliSource);
  }

  // 3. Original source path (unlikely in container but check).
  if (manifest.silenceCut.sourcePath) {
    candidates.push(manifest.silenceCut.sourcePath);
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }

  // 4. Scan out/ for the most recent _cut.mp4
  if (fs.existsSync(OUT_DIR)) {
    const cutMp4s = fs
      .readdirSync(OUT_DIR)
      .filter((f) => f.endsWith('_cut.mp4'))
      .map((f) => path.join(OUT_DIR, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

    if (cutMp4s[0]) {
      return cutMp4s[0];
    }

    // 5. Any non-bake mp4.
    const mp4s = fs
      .readdirSync(OUT_DIR)
      .filter((f) => f.endsWith('.mp4') && !f.includes('_bake'))
      .map((f) => path.join(OUT_DIR, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

    if (mp4s[0]) {
      return mp4s[0];
    }
  }

  throw new Error(
    `Cannot find source video for bake. Pass --source <path> or ensure the pipeline ` +
      `ran with --render so the silence-cut MP4 exists in ${OUT_DIR}.`,
  );
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const args = parseArgs();
  const manifestPath = args.manifest ?? path.join(OUT_DIR, 'landscape_treatment_manifest.json');
  const cliRunId = args['run-id'];
  const outDir = args.out ?? OUT_DIR;

  // 1. Read treatment manifest.
  const raw = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');
  const manifest = JSON.parse(raw) as LandscapeTreatmentManifest;
  const runId = cliRunId ?? manifest.generatedAtIso ?? `landscape-${crypto.randomUUID()}`;

  // 2. Resolve source video (silence-cut MP4 or original input).
  const sourceVideo = resolveSourceVideo(manifest, args.source);
  console.log(`[Bake] source video: ${sourceVideo}`);

  // 3. Copy source video into remotion-app/public/ so staticFile resolves it at bundle time.
  fs.mkdirSync(REMOTION_PUBLIC, {recursive: true});
  const publicSource = path.join(REMOTION_PUBLIC, SOURCE_COPY_NAME);
  fs.copyFileSync(sourceVideo, publicSource);
  console.log(`[Bake] copied to remotion-app/public/${SOURCE_COPY_NAME}`);

  // 4. Resolve audio track: prefer extracted voice track (hum-free), else source video.
  const audioUrl = fs.existsSync(DEFAULT_AUDIO_TRACK) ? DEFAULT_AUDIO_TRACK : sourceVideo;

  // 5. Bridge → UnifiedRenderManifest.
  const unified = landscapeTreatmentToUnifiedManifest(manifest, {
    videoUrl: `/${SOURCE_COPY_NAME}`,
    audioUrl,
    jobId: crypto.randomUUID(),
    createdAt: manifest.generatedAtIso,
  });
  console.log(
    `[Bake] bridged to unified manifest: ${unified.durationFrames}frames @ ${unified.fps}fps` +
      ` (${(unified.source.durationMs / 1000).toFixed(1)}s)`,
  );

  // 6. Render on the GPU spine.
  //    bundle → selectComposition → silent frames → h264_nvenc → mixAudio → AAC mux.
  const outputMp4 = await renderLandscapeFromManifest(unified, {
    tempDir: outDir,
    sfxDir: SFX_DIR,
    sourceVideoPath: publicSource, // cleanup after render (public copy is disposable)
  });
  console.log(`[Bake] render completed: ${outputMp4}`);

  // 7. Copy to a stable run-scoped name on the artifacts volume.
  const safeRunId = runId.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120);
  const bakePath = path.join(outDir, `landscape_${safeRunId}_bake.mp4`);
  fs.copyFileSync(outputMp4, bakePath);
  console.log(`[Bake] final bake: ${bakePath}`);

  // 8. Write receipt to the volume (read by the Python caller).
  const receipt = {
    ok: true,
    jobId: unified.jobId,
    sourceVideo,
    bakePath,
    durationFrames: unified.durationFrames,
    fps: unified.fps,
    width: unified.width,
    height: unified.height,
    encoder: 'h264_nvenc',
    audioTrack: audioUrl,
    generatedAtIso: unified.createdAt,
  };
  const receiptPath = path.join(outDir, `landscape_${safeRunId}_bake_receipt.json`);
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), 'utf8');
  console.log(`[Bake] receipt: ${receiptPath}`);

  // Final stdout line: JSON receipt for the Python caller.
  console.log(JSON.stringify(receipt));
}

main().catch((err) => {
  console.error(`[Bake] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

