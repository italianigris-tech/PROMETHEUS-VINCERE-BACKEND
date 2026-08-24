/**
 * Local single-node landscape bake — the validation gate before Lambda fan-out.
 * Usage: npm run render:landscape -- <manifest.json> [outputDir]
 *
 * Same render spine as the portrait bake (bundle -> selectComposition ->
 * silent frames -> h264_nvenc -> mixAudio -> mux), pinned to the
 * JosephLandscapeEdit composition via renderLandscapeFromManifest.
 */
import fs from 'node:fs';
import path from 'node:path';

import {UnifiedRenderManifestSchema} from '@prometheus/shared-types';

import {renderLandscapeFromManifest} from '../src/index.js';

const manifestPath = path.resolve(process.argv[2] ?? '');
const outputDir = path.resolve(process.argv[3] ?? path.join('artifacts', 'landscape-render'));

if (!manifestPath || !fs.existsSync(manifestPath)) {
  throw new Error(`UnifiedRenderManifest JSON not found: ${manifestPath}`);
}

const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')) as {
  manifest?: unknown;
};
const manifest = UnifiedRenderManifestSchema.parse(raw.manifest ?? raw);

fs.mkdirSync(outputDir, {recursive: true});
const outputPath = await renderLandscapeFromManifest(manifest, {tempDir: outputDir});

console.log(JSON.stringify({
  jobId: manifest.jobId,
  width: manifest.width,
  height: manifest.height,
  durationFrames: manifest.durationFrames,
  fps: manifest.fps,
  outputPath,
  encoder: 'h264_nvenc',
}));
