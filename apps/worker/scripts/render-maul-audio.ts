import * as fs from 'fs';
import * as path from 'path';

import {maulUnifiedShortRenderManifestSchema} from '@prometheus/shared-types';

import {renderMaulManifest} from '../src/maul-render.js';

const [manifestArg, outputArg] = process.argv.slice(2);
if (!manifestArg || !outputArg) {
  throw new Error('Usage: render-maul-audio.ts <manifest.json> <output-dir>');
}
const manifest = maulUnifiedShortRenderManifestSchema.parse(
  JSON.parse(fs.readFileSync(path.resolve(manifestArg), 'utf8')),
);
const outputPath = await renderMaulManifest(manifest, {
  outputDir: path.resolve(outputArg),
  mode: 'audio-only',
});
console.log(JSON.stringify({outputPath}));
