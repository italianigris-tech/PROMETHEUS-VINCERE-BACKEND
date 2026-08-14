import * as fs from 'fs';
import * as path from 'path';

import {maulUnifiedShortRenderManifestSchema} from '@prometheus/shared-types';

import {renderMaulManifest} from '../src/maul-render.js';

const [manifestArg, outputArg, startArg, endArg, encoderArg = 'h264_nvenc'] = process.argv.slice(2);
if (!manifestArg || !outputArg || !startArg || !endArg) {
  throw new Error('Usage: render-maul-slice.ts <manifest.json> <output-dir> <start-frame> <end-frame> [encoder]');
}
if (encoderArg !== 'h264_nvenc' && encoderArg !== 'libx264') {
  throw new Error("MAUL slice encoder must be 'h264_nvenc' or 'libx264'.");
}
const startFrame = Number(startArg);
const endFrame = Number(endArg);
const manifest = maulUnifiedShortRenderManifestSchema.parse(
  JSON.parse(fs.readFileSync(path.resolve(manifestArg), 'utf8')),
);
const outputPath = await renderMaulManifest(manifest, {
  outputDir: path.resolve(outputArg),
  mode: 'video-slice',
  frameRange: [startFrame, endFrame],
  videoEncoder: encoderArg,
  renderConcurrency: 1,
});
console.log(JSON.stringify({outputPath, startFrame, endFrame, encoder: encoderArg}));
