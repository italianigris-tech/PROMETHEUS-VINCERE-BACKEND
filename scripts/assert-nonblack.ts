import {execFile} from 'child_process';
import * as path from 'path';
import {fileURLToPath} from 'url';
import {promisify} from 'util';

const execFileAsync = promisify(execFile);

export type ImagePixelStats = {
  width: number;
  height: number;
  pixelCount: number;
  nonblackPixelRatio: number;
  mean: {
    r: number;
    g: number;
    b: number;
  };
};

export type NonblackAssertion = {
  imagePath: string;
  threshold: number;
  pass: boolean;
  stats: ImagePixelStats;
};

const parseDimensions = async (imagePath: string): Promise<{width: number; height: number}> => {
  const {stdout} = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'json',
    imagePath,
  ], {maxBuffer: 1024 * 1024});
  const parsed = JSON.parse(stdout) as {streams?: Array<{width?: number; height?: number}>};
  const stream = parsed.streams?.[0];
  if (!stream?.width || !stream.height) {
    throw new Error(`Could not read image dimensions for ${imagePath}`);
  }
  return {width: stream.width, height: stream.height};
};

const readRgbaPixels = async (imagePath: string): Promise<Buffer> => {
  const {stdout} = await execFileAsync('ffmpeg', [
    '-v',
    'error',
    '-i',
    imagePath,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-',
  ], {encoding: 'buffer', maxBuffer: 96 * 1024 * 1024} as any);
  return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
};

export const readImagePixelStats = async (imagePath: string): Promise<ImagePixelStats> => {
  const {width, height} = await parseDimensions(imagePath);
  const pixels = await readRgbaPixels(imagePath);
  const expectedBytes = width * height * 4;
  if (pixels.length < expectedBytes) {
    throw new Error(`Expected ${expectedBytes} RGBA bytes for ${imagePath}, received ${pixels.length}.`);
  }

  let nonblack = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  const pixelCount = width * height;

  for (let i = 0; i < expectedBytes; i += 4) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    sumR += r;
    sumG += g;
    sumB += b;
    if (r > 16 || g > 16 || b > 16) {
      nonblack += 1;
    }
  }

  return {
    width,
    height,
    pixelCount,
    nonblackPixelRatio: nonblack / pixelCount,
    mean: {
      r: sumR / pixelCount,
      g: sumG / pixelCount,
      b: sumB / pixelCount,
    },
  };
};

export const assertNonblackImage = async (
  imagePath: string,
  threshold = 0.05,
): Promise<NonblackAssertion> => {
  const stats = await readImagePixelStats(imagePath);
  return {
    imagePath,
    threshold,
    pass: stats.nonblackPixelRatio > threshold,
    stats,
  };
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const imagePath = process.argv[2];
  const threshold = process.argv[3] ? Number(process.argv[3]) : 0.05;
  if (!imagePath) {
    console.error('Usage: npx tsx scripts/assert-nonblack.ts <imagePath> [threshold]');
    process.exit(2);
  }

  assertNonblackImage(imagePath, threshold).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.pass ? 0 : 1);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
