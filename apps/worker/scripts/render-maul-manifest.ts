import * as fs from 'fs';
import * as path from 'path';

import {maulUnifiedShortRenderManifestSchema} from '@prometheus/shared-types';

import {renderMaulManifest} from '../src/maul-render.js';

const manifestPath = process.argv[2];
const outputDir = process.argv[3];
if (!manifestPath || !outputDir) {
  throw new Error('Usage: render-maul-manifest.ts <manifest.json> <output-dir>');
}

const manifest = maulUnifiedShortRenderManifestSchema.parse(
  JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8')),
);
const outputPath = await renderMaulManifest(manifest, {outputDir: path.resolve(outputDir)});
console.log(JSON.stringify({
  pipeline: 'maul',
  pipelineJobId: `maul:${manifest.replayKey}`,
  outputPath,
  encoder: 'h264_nvenc',
}));
