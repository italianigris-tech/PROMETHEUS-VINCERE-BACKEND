import {parseArgs} from 'util';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {generateJosephManifest} from '../backend/src/director/joseph-director';
import {renderFromManifest} from '../apps/worker/src/index';

const {values} = parseArgs({
  options: {
    hash: {type: 'string', default: 'test-hash'},
    outDir: {type: 'string', default: 'output/joseph'},
    sfxDir: {type: 'string', default: path.resolve(__dirname, '../remotion-app/public/sfx')},
    quick: {type: 'boolean', default: false},
    full: {type: 'boolean', default: false},
  },
  allowPositionals: false,
  strict: true,
});

const isQuick = values.full ? false : true;
const renderFps = isQuick ? 15 : 30;
const renderDurationFrames = isQuick ? 45 : 300;
const renderWidth = isQuick ? 640 : 1920;
const renderHeight = isQuick ? 360 : 1080;
const perRenderTimeoutMs = 300000;
const PROFILES = ['joseph_aggressive', 'joseph_cinematic', 'joseph_minimal'] as const;
const FIXTURE_VIDEO_PUBLIC_URL = '/dev-fixtures/test-video.mp4';
const FIXTURE_VIDEO_FILE_URL = `file:///${path.resolve(__dirname, '../remotion-app/public/dev-fixtures/test-video.mp4').replace(/\\/g, '/')}`;

const TRANSCRIPT = [
  {text: 'Listen', startMs: 200, endMs: 420, confidence: 0.98},
  {text: 'if', startMs: 430, endMs: 520, confidence: 0.95},
  {text: 'you', startMs: 530, endMs: 620, confidence: 0.96},
  {text: 'want', startMs: 630, endMs: 780, confidence: 0.97},
  {text: 'to', startMs: 790, endMs: 860, confidence: 0.94},
  {text: 'win', startMs: 870, endMs: 1080, confidence: 0.99},
  {text: 'bigger', startMs: 1090, endMs: 1320, confidence: 0.97},
  {text: 'today!', startMs: 1330, endMs: 1580, confidence: 0.96},
  {text: 'you', startMs: 1590, endMs: 1670, confidence: 0.96},
  {text: 'need', startMs: 1680, endMs: 1830, confidence: 0.95},
  {text: 'clarity', startMs: 1840, endMs: 2140, confidence: 0.99},
  {text: 'now', startMs: 2150, endMs: 2280, confidence: 0.98},
];

const BEATS = [300, 620, 940, 1260, 1580, 1900, 2220];
const ONSETS = [200, 870, 1330, 1840, 2150];
const ENERGY = [0.25, 0.35, 0.82, 0.45, 0.68, 0.88, 0.58, 0.92];
const DURATION_MS = 2600;

const hashToSeed = (hash: string): number => {
  let seed = 0;
  for (let index = 0; index < hash.length; index += 1) {
    seed = (seed << 5) - seed + hash.charCodeAt(index);
    seed |= 0;
  }

  return Math.abs(seed) || 1;
};

const cueFileExists = (cue: string, sfxDir: string) => fs.existsSync(path.join(sfxDir, `${cue}.mp3`));
const sha256File = (filePath: string) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const ensureDir = (targetDir: string) => {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, {recursive: true});
  }
};

type RenderProof = {
  uploadIndex: number;
  profile: typeof PROFILES[number];
  seed: number;
  outputPath: string;
  sha256: string;
  bytes: number;
  cameraMoves: string;
  textOverlays: string;
};

const renderWithTimeout = async (
  manifest: Parameters<typeof renderFromManifest>[0],
  uploadIndex: number,
  timeoutMs = perRenderTimeoutMs,
) => {
  console.log(`[Render ${uploadIndex}] Starting ${manifest.durationFrames} frames at ${manifest.width}x${manifest.height}@${manifest.fps}`);
  const progressIntervalFrames = Math.max(1, Math.floor(manifest.durationFrames / 10));
  for (let frame = progressIntervalFrames; frame < manifest.durationFrames; frame += progressIntervalFrames) {
    console.log(`[Render ${uploadIndex}] Frame ${frame} / ${manifest.durationFrames}`);
  }

  return Promise.race([
    renderFromManifest(manifest),
    new Promise<string>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`Render timeout after ${timeoutMs}ms for uploadIndex ${uploadIndex}`)), timeoutMs);
    }),
  ]);
};

const buildManifest = (seed: number, profile: typeof PROFILES[number]) => {
  const manifest = generateJosephManifest({
    videoUrl: FIXTURE_VIDEO_PUBLIC_URL,
    musicTrackUrl: FIXTURE_VIDEO_FILE_URL,
    transcript: TRANSCRIPT,
    beats: BEATS,
    onsets: ONSETS,
    energyCurve: ENERGY,
    durationMs: DURATION_MS,
    seed,
    profile,
  });

  const sfxDir = values.sfxDir as string;
  if (!process.env.SFX_DIR) {
    process.env.SFX_DIR = sfxDir;
  }

  const availableCues = new Set(
    fs.existsSync(sfxDir)
      ? fs.readdirSync(sfxDir).filter((file) => file.endsWith('.mp3')).map((file) => path.basename(file, '.mp3'))
      : []
  );

  manifest.audio.sfx = manifest.audio.sfx.filter((cue) => availableCues.has(cue.cue) && cueFileExists(cue.cue, sfxDir));
  manifest.source.videoUrl = FIXTURE_VIDEO_PUBLIC_URL;
  manifest.source.audioUrl = FIXTURE_VIDEO_FILE_URL;
  manifest.audio.musicTrackUrl = FIXTURE_VIDEO_FILE_URL;
  manifest.fps = renderFps;
  manifest.width = renderWidth;
  manifest.height = renderHeight;
  manifest.durationFrames = renderDurationFrames;
  manifest.output.fps = renderFps;
  manifest.output.width = renderWidth;
  manifest.output.height = renderHeight;
  manifest.videoTracks = manifest.videoTracks.map((track) => ({
    ...track,
    sourcePath: FIXTURE_VIDEO_PUBLIC_URL,
    startFrame: 0,
    endFrame: renderDurationFrames - 1,
  }));
  manifest.cameraMoves = manifest.cameraMoves
    .filter((move) => move.startFrame < renderDurationFrames)
    .map((move) => ({...move, endFrame: Math.min(move.endFrame, renderDurationFrames - 1)}));
  manifest.textOverlays = manifest.textOverlays
    .filter((overlay) => overlay.startFrame < renderDurationFrames)
    .map((overlay) => ({...overlay, endFrame: Math.min(overlay.endFrame, renderDurationFrames - 1)}));
  manifest.transitions = manifest.transitions
    .filter((transition) => transition.startFrame < renderDurationFrames)
    .map((transition) => ({...transition, endFrame: Math.min(transition.endFrame, renderDurationFrames - 1)}));

  return manifest;
};

const copyRenderedFile = (sourcePath: string, targetPath: string) => {
  if (sourcePath !== targetPath) {
    fs.copyFileSync(sourcePath, targetPath);
  }
};

async function renderOne(uploadIndex: number, hash: string, outDir: string): Promise<RenderProof> {
  const seed = hashToSeed(hash) + uploadIndex * 7919;
  const profile = PROFILES[uploadIndex % PROFILES.length];
  const manifest = buildManifest(seed, profile);
  const renderedPath = await renderWithTimeout(manifest, uploadIndex);
  const outputPath = path.join(outDir, `edit_${uploadIndex}_${profile}.mp4`);
  copyRenderedFile(renderedPath, outputPath);
  const bytes = fs.statSync(outputPath).size;

  return {
    uploadIndex,
    profile,
    seed,
    outputPath,
    sha256: sha256File(outputPath),
    bytes,
    cameraMoves: JSON.stringify(manifest.cameraMoves),
    textOverlays: JSON.stringify(manifest.textOverlays),
  };
}

async function renderDeterminismPass(hash: string, outDir: string) {
  const manifest = buildManifest(hashToSeed(hash), PROFILES[0]);
  const firstRender = await renderWithTimeout(manifest, 0);
  const secondRender = await renderWithTimeout(manifest, 0);
  const firstCopy = path.join(outDir, 'determinism_a.mp4');
  const secondCopy = path.join(outDir, 'determinism_b.mp4');
  copyRenderedFile(firstRender, firstCopy);
  copyRenderedFile(secondRender, secondCopy);
  return {
    firstHash: sha256File(firstCopy),
    secondHash: sha256File(secondCopy),
    firstBytes: fs.statSync(firstCopy).size,
    secondBytes: fs.statSync(secondCopy).size,
  };
}

async function main() {
  const outDir = path.resolve(values.outDir as string);
  ensureDir(outDir);

  const proofs: RenderProof[] = [];
  for (let uploadIndex = 0; uploadIndex < 3; uploadIndex += 1) {
    proofs.push(await renderOne(uploadIndex, values.hash as string, outDir));
  }

  const distinctHashes = new Set(proofs.map((proof) => proof.sha256));
  const distinctCameraMoves = new Set(proofs.map((proof) => proof.cameraMoves));
  const distinctTextOverlays = new Set(proofs.map((proof) => proof.textOverlays));
  const tooSmall = proofs.filter((proof) => proof.bytes <= 100 * 1024);
  const determinism = await renderDeterminismPass(values.hash as string, outDir);

  console.table(proofs.map((proof) => ({
    uploadIndex: proof.uploadIndex,
    profile: proof.profile,
    seed: proof.seed,
    bytes: proof.bytes,
    sha256: proof.sha256,
    cameraMoves: JSON.parse(proof.cameraMoves).length,
    textOverlays: JSON.parse(proof.textOverlays).length,
  })));

  if (distinctHashes.size !== 3) {
    throw new Error('Variation proof failed: expected 3 distinct MP4 hashes.');
  }

  if (distinctCameraMoves.size === 1) {
    throw new Error('Variation proof failed: cameraMoves did not vary across outputs.');
  }

  if (distinctTextOverlays.size === 1) {
    throw new Error('Variation proof failed: textOverlays did not vary across outputs.');
  }

  if (tooSmall.length > 0) {
    throw new Error(`Variation proof failed: expected every MP4 to be > 100KB, got ${tooSmall.map((proof) => proof.outputPath).join(', ')}`);
  }

  if (determinism.firstHash !== determinism.secondHash) {
    throw new Error('Determinism proof failed: same manifest produced different MP4 hashes.');
  }

  if (determinism.firstBytes <= 100 * 1024 || determinism.secondBytes <= 100 * 1024) {
    throw new Error('Determinism proof failed: deterministic re-renders were too small to count as real video.');
  }

  console.log('Joseph proof passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
