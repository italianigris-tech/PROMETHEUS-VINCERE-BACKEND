import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {UnifiedRenderManifestSchema} from '@prometheus/shared-types';
import {mixAudio} from '@prometheus/backend';

const manifestPath = path.resolve(process.argv[2] ?? '');
const silentVideoPath = path.resolve(process.argv[3] ?? '');
const outputPath = path.resolve(process.argv[4] ?? '');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sfxDir = path.join(repoRoot, 'remotion-app', 'public', 'sfx');

if (!manifestPath || !fs.existsSync(manifestPath)) {
  throw new Error(`Manifest JSON not found: ${manifestPath}`);
}
if (!silentVideoPath || !fs.existsSync(silentVideoPath)) {
  throw new Error(`Silent video not found: ${silentVideoPath}`);
}
if (!outputPath) {
  throw new Error('Output MP4 path is required.');
}

const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')) as {manifest?: unknown};
const manifest = UnifiedRenderManifestSchema.parse(raw.manifest ?? raw);
const outputDir = path.dirname(outputPath);
const audioPath = path.join(outputDir, `${manifest.jobId}_production-audio.m4a`);

fs.mkdirSync(outputDir, {recursive: true});
await mixAudio(manifest, audioPath, {sfxDir, tempDir: outputDir});

await new Promise<void>((resolve, reject) => {
  const child = spawn('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    silentVideoPath,
    '-i',
    audioPath,
    '-map_metadata',
    '-1',
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '320k',
    '-shortest',
    '-movflags',
    '+faststart',
    '-y',
    outputPath,
  ]);
  let stderr = '';
  child.stderr.on('data', (data) => {
    stderr += data.toString();
  });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(`FFmpeg mux failed with code ${code}: ${stderr}`));
  });
});

console.log(JSON.stringify({manifestJobId: manifest.jobId, audioPath, outputPath}));
