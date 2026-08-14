import fs from 'node:fs';
import path from 'node:path';

import {UnifiedRenderManifestSchema} from '@prometheus/shared-types';

import {renderFromManifest} from '../src/index.js';

const manifestPath = path.resolve(process.argv[2] ?? '');
const outputDir = path.resolve(process.argv[3] ?? path.join('artifacts', 'worker-render'));

if (!manifestPath || !fs.existsSync(manifestPath)) {
  throw new Error(`UnifiedRenderManifest JSON not found: ${manifestPath}`);
}

const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')) as {
  manifest?: unknown;
};
const manifest = UnifiedRenderManifestSchema.parse(raw.manifest ?? raw);

fs.mkdirSync(outputDir, {recursive: true});
const outputPath = await renderFromManifest(manifest, {tempDir: outputDir});

console.log(JSON.stringify({
  jobId: manifest.jobId,
  durationFrames: manifest.durationFrames,
  fps: manifest.fps,
  outputPath,
  encoder: 'h264_nvenc',
}));
