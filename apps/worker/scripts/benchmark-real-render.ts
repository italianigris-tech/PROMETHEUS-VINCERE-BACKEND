import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {UnifiedRenderManifestSchema} from '@prometheus/shared-types';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
const manifestPath = path.resolve(process.argv[2] ?? '');
const gl = process.argv[3] ?? 'angle';
const frameStart = Number.parseInt(process.argv[4] ?? '0', 10);
const frameEnd = Number.parseInt(process.argv[5] ?? String(frameStart + 29), 10);
const timeoutInMilliseconds = Number.parseInt(process.argv[6] ?? '300000', 10);
const fontProbeUrl = process.argv[7] && process.argv[7] !== '-' ? process.argv[7] : undefined;
const localSourcePath = process.argv[8] && process.argv[8] !== '-' ? path.resolve(process.argv[8]) : undefined;
const customOutputDir = process.argv[9] && process.argv[9] !== '-' ? path.resolve(process.argv[9]) : undefined;
const reuseBundle = process.argv[10] === 'reuse';

if (!manifestPath || !fs.existsSync(manifestPath)) {
  throw new Error(`Manifest or render-job JSON not found: ${manifestPath}`);
}
if (localSourcePath && !fs.existsSync(localSourcePath)) {
  throw new Error(`Local source video not found: ${localSourcePath}`);
}

const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')) as {manifest?: unknown};
const manifest = UnifiedRenderManifestSchema.parse(raw.manifest ?? raw);
const localSourceFileName = localSourcePath ? `benchmark-source${path.extname(localSourcePath) || '.mp4'}` : undefined;
const localSourceBrowserUrl = localSourceFileName ? `/joseph-render-proof/${localSourceFileName}` : undefined;
const sourceManifest = localSourceBrowserUrl
  ? {
      ...manifest,
      videoTracks: manifest.videoTracks.map((track, index) => index === 0 ? {...track, sourcePath: localSourceBrowserUrl} : track),
      source: {...manifest.source, videoUrl: localSourceBrowserUrl},
    }
  : manifest;
const renderManifest = fontProbeUrl
  ? {
      ...sourceManifest,
      typography: {...sourceManifest.typography, fontAssetUrl: fontProbeUrl},
      josephTypography: undefined,
      josephPiP: undefined,
      textOverlays: [],
    }
  : sourceManifest;
const benchmarkDir = customOutputDir ?? path.join(repoRoot, 'artifacts', 'joseph-browser-e2e-20260713-rerun');
const bundleDir = path.join(benchmarkDir, `bundle-${gl}`);
const probeSuffix = fontProbeUrl
  ? `-${path.basename(fontProbeUrl, path.extname(fontProbeUrl))}`
  : localSourcePath ? '-local-source' : '';
const outputLocation = path.join(benchmarkDir, `benchmark-${gl}-${frameStart}-${frameEnd}${probeSuffix}.mp4`);
const entryPoint = path.join(repoRoot, 'remotion-app', 'src', 'entries', 'joseph-entry.tsx');
const browserExecutable = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const inputProps = {manifest: renderManifest, audioPreviewEnabled: false};

fs.mkdirSync(benchmarkDir, {recursive: true});
const temporaryPublicSourcePath = localSourceFileName
  ? path.join(repoRoot, 'remotion-app', 'public', 'joseph-render-proof', localSourceFileName)
  : undefined;
if (localSourcePath && temporaryPublicSourcePath) {
  fs.mkdirSync(path.dirname(temporaryPublicSourcePath), {recursive: true});
  fs.copyFileSync(localSourcePath, temporaryPublicSourcePath);
}
const bundleStartedAt = Date.now();
let serveUrl: string;
if (reuseBundle && fs.existsSync(path.join(bundleDir, 'index.html'))) {
  serveUrl = bundleDir;
} else {
  try {
    serveUrl = await bundle({entryPoint, outDir: bundleDir});
  } finally {
    if (temporaryPublicSourcePath) {
      fs.rmSync(temporaryPublicSourcePath, {force: true});
    }
  }
}
console.log(`[Benchmark] bundleMs=${Date.now() - bundleStartedAt} serveUrl=${serveUrl}`);

const composition = await selectComposition({
  serveUrl,
  id: 'JosephEdit',
  inputProps,
  browserExecutable,
  timeoutInMilliseconds,
  gl,
  chromeMode: 'chrome-for-testing',
  chromiumOptions: {gl, headless: true},
} as any);

const renderStartedAt = Date.now();
await renderMedia({
  composition,
  serveUrl,
  outputLocation,
  codec: 'h264',
  frameRange: [frameStart, frameEnd],
  inputProps,
  gl,
  concurrency: 1,
  timeoutInMilliseconds,
  browserExecutable,
  hardwareAcceleration: 'if-possible',
  chromeMode: 'chrome-for-testing',
  chromiumOptions: {gl, headless: true},
  muted: true,
  overwrite: true,
  onProgress: ({progress}: {progress: number}) => {
    const rounded = Math.round(progress * 100);
    if (rounded % 10 === 0) console.log(`[Benchmark] progress=${rounded}%`);
  },
} as any);

const renderMs = Date.now() - renderStartedAt;
const frames = frameEnd - frameStart + 1;
console.log(JSON.stringify({gl, frameStart, frameEnd, frames, fontProbeUrl, localSourcePath, renderMs, fps: frames / (renderMs / 1000), outputLocation}));
