/**
 * Distributed Remotion Lambda fan-out for the landscape bake.
 *
 * Pipeline (identical contract to the local NVENC spine, swapped compute):
 *   1. getOrCreateBucket + deploySite(landscape-entry) — the bundled site that
 *      serves the JosephLandscapeEdit composition to Lambda workers.
 *   2. renderMediaOnLambda — headless-Chrome frame extraction fan-out across
 *      Lambda; emits a silent h264 MP4 (no audio track, no hum).
 *   3. mixAndMuxManifest — the exact same mixAudio + AAC mux used by the local
 *      spine, so Lambda output is audio-identical to a local bake.
 *
 * Function deployment is done once via the Remotion CLI:
 *   npx remotion lambda functions deploy --memory 3008
 * (see docs/mini_landscape_runs/README.md).
 *
 * Prereq for source media: the composition renders via staticFile(), so the
 * landscape source video must live under remotion-app/public at bundle time
 * (the same rule as the local spine). Copy it in before deployLandscapeLambdaInfra.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {UnifiedRenderManifest, UnifiedRenderManifestSchema} from '@prometheus/shared-types';
import {
  LANDSCAPE_ENTRY_POINT,
  LANDSCAPE_HEIGHT,
  LANDSCAPE_WIDTH,
  mixAndMuxManifest,
} from './index.js';

const DEFAULT_REGION = process.env.REMOTION_LAMBDA_REGION ?? 'us-east-1';
const DEFAULT_FUNCTION_NAME = process.env.REMOTION_LAMBDA_FUNCTION ?? 'remotion-render-joseph';
const DEFAULT_SITE_NAME = process.env.REMOTION_LAMBDA_SITE ?? 'landscape-studio';

export interface LandscapeLambdaInfra {
  region: string;
  functionName: string;
  bucketName: string;
  serveUrl: string;
}

let cachedInfra: LandscapeLambdaInfra | null = null;

/**
 * Idempotent infra bootstrap: S3 bucket + deployed site. Safe to call on every
 * bake; the site overwrite is a single upload.
 */
export async function deployLandscapeLambdaInfra(
  options: {region?: string; functionName?: string; siteName?: string} = {},
): Promise<LandscapeLambdaInfra> {
  const region = options.region ?? DEFAULT_REGION;
  const functionName = options.functionName ?? DEFAULT_FUNCTION_NAME;
  const siteName = options.siteName ?? DEFAULT_SITE_NAME;

  if (cachedInfra) {
    return cachedInfra;
  }

  const lambda = await import('@remotion/lambda');
  const {bucketName} = await lambda.getOrCreateBucket({region});
  const {serveUrl} = await lambda.deploySite({
    entryPoint: LANDSCAPE_ENTRY_POINT,
    bucketName,
    region,
    siteName,
  });

  cachedInfra = {region, functionName, bucketName, serveUrl};
  console.log(`[Lambda] infra ready: bucket=${bucketName} site=${serveUrl} function=${functionName}`);
  return cachedInfra;
}


export interface RenderLandscapeLambdaOptions {
  region?: string;
  functionName?: string;
  siteName?: string;
  serveUrl?: string;
  /** Frames rendered per Lambda invocation. Lower = more workers, better fan-out. */
  framesPerLambda?: number;
  concurrencyPerLambda?: number;
  outName?: string;
  tempDir?: string;
  sfxDir?: string;
  pollIntervalMs?: number;
}

/**
 * Distributed landscape bake. Renders the JosephLandscapeEdit composition on
 * Lambda (silent frames, software h264), then runs the shared mix+mux stage
 * locally. Returns the absolute path of the finished MP4.
 */
export async function renderLandscapeLambda(
  manifest: UnifiedRenderManifest,
  options: RenderLandscapeLambdaOptions = {},
): Promise<string> {
  const parseResult = UnifiedRenderManifestSchema.safeParse(manifest);
  if (!parseResult.success) {
    throw new Error(`renderLandscapeLambda: invalid unified manifest: ${parseResult.error.message}`);
  }
  const validatedManifest = parseResult.data;

  if (
    validatedManifest.width !== LANDSCAPE_WIDTH ||
    validatedManifest.height !== LANDSCAPE_HEIGHT ||
    validatedManifest.output.width !== LANDSCAPE_WIDTH ||
    validatedManifest.output.height !== LANDSCAPE_HEIGHT
  ) {
    throw new Error(
      `renderLandscapeLambda requires a 1920x1080 landscape manifest; got ${validatedManifest.width}x${validatedManifest.height}.`,
    );
  }

  const lambda = await import('@remotion/lambda');
  const region = options.region ?? DEFAULT_REGION;
  const functionName = options.functionName ?? DEFAULT_FUNCTION_NAME;
  const infra =
    options.serveUrl !== undefined
      ? {region, functionName, serveUrl: options.serveUrl, bucketName: ''}
      : await deployLandscapeLambdaInfra({region, functionName, siteName: options.siteName});

  const tmpDir = options.tempDir ?? os.tmpdir();
  fs.mkdirSync(tmpDir, {recursive: true});
  const outName = options.outName ?? `landscape-${validatedManifest.jobId}.mp4`;
  const silentVideoPath = path.join(tmpDir, `${validatedManifest.jobId}_lambda_silent.mp4`);
  const finalVideoPath = path.join(tmpDir, `${validatedManifest.jobId}_lambda_final.mp4`);

  console.log(
    `[Lambda] starting render composition=JosephLandscapeEdit frames=${validatedManifest.durationFrames} fps=${validatedManifest.fps} framesPerLambda=${options.framesPerLambda ?? 'auto'}`,
  );

  const {renderId, bucketName} = await lambda.renderMediaOnLambda({
    region,
    functionName,
    serveUrl: infra.serveUrl,
    composition: 'JosephLandscapeEdit',
    codec: 'h264',
    inputProps: {manifest: validatedManifest, audioPreviewEnabled: false},
    framesPerLambda: options.framesPerLambda ?? null,
    concurrencyPerLambda: options.concurrencyPerLambda ?? 2,
    outName,
    downloadBehavior: {type: 'download', fileName: outName},
  });

  console.log(`[Lambda] render ${renderId} launched (bucket ${bucketName})`);

  // Poll until the render completes, then download the silent video.
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  let lastLoggedPct = -1;
  for (;;) {
    const progress = await lambda.getRenderProgress({renderId, bucketName, functionName, region});
    const pct = Math.round(progress.overallProgress * 100);
    if (pct >= lastLoggedPct + 10) {
      console.log(`[Lambda] render ${renderId}: ${pct}%`);
      lastLoggedPct = pct;
    }
    if (progress.overallProgress >= 1 && progress.outputFile) {
      const response = await fetch(progress.outputFile);
      if (!response.ok) {
        throw new Error(`Failed to download Lambda render output (HTTP ${response.status}): ${progress.outputFile}`);
      }
      await fs.promises.writeFile(silentVideoPath, Buffer.from(await response.arrayBuffer()));
      console.log(`[Lambda] silent render downloaded to ${silentVideoPath} (${progress.renderSize} bytes)`);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return mixAndMuxManifest(validatedManifest, silentVideoPath, finalVideoPath, {
    sfxDir: options.sfxDir,
    tempDir: tmpDir,
  });
}
