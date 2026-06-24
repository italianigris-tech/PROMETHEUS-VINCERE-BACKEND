import * as path from 'path';
import {fileURLToPath} from 'url';

import {readImagePixelStats} from './assert-nonblack';

export type SourceVisibilityAssertion = {
  renderedFramePath: string;
  sourceFramePath: string;
  maxMeanDistance: number;
  pass: boolean;
  renderedNonblackRatio: number;
  sourceNonblackRatio: number;
  meanDistance: number;
  renderedMean: {
    r: number;
    g: number;
    b: number;
  };
  sourceMean: {
    r: number;
    g: number;
    b: number;
  };
};

const channelMeanDistance = (
  first: {r: number; g: number; b: number},
  second: {r: number; g: number; b: number},
) => {
  const dr = first.r - second.r;
  const dg = first.g - second.g;
  const db = first.b - second.b;
  return Math.sqrt((dr * dr + dg * dg + db * db) / 3);
};

export const assertSourceVisible = async ({
  renderedFramePath,
  sourceFramePath,
  maxMeanDistance = 55,
}: {
  renderedFramePath: string;
  sourceFramePath: string;
  maxMeanDistance?: number;
}): Promise<SourceVisibilityAssertion> => {
  const rendered = await readImagePixelStats(renderedFramePath);
  const source = await readImagePixelStats(sourceFramePath);
  const meanDistance = channelMeanDistance(rendered.mean, source.mean);
  const pass =
    rendered.nonblackPixelRatio > 0.05 &&
    source.nonblackPixelRatio > 0.05 &&
    meanDistance <= maxMeanDistance;

  return {
    renderedFramePath,
    sourceFramePath,
    maxMeanDistance,
    pass,
    renderedNonblackRatio: rendered.nonblackPixelRatio,
    sourceNonblackRatio: source.nonblackPixelRatio,
    meanDistance,
    renderedMean: rendered.mean,
    sourceMean: source.mean,
  };
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const renderedFramePath = process.argv[2];
  const sourceFramePath = process.argv[3];
  const maxMeanDistance = process.argv[4] ? Number(process.argv[4]) : 55;
  if (!renderedFramePath || !sourceFramePath) {
    console.error('Usage: npx tsx scripts/assert-source-visible.ts <renderedFramePath> <sourceFramePath> [maxMeanDistance]');
    process.exit(2);
  }

  assertSourceVisible({renderedFramePath, sourceFramePath, maxMeanDistance}).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.pass ? 0 : 1);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
