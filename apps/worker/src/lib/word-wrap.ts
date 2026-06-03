import {useMemo} from "react";

export type WordWrapOptions = {
  maxWidth: number;
  fontSize: number;
  maxLines?: number;
};

const narrowPattern = /^[\s.,:;!|'"`iIl1]+$/;
const widePattern = /^[MW@#%&Q]$/;

export const estimateGlyphWidth = (glyph: string, fontSize: number): number => {
  if (narrowPattern.test(glyph)) {
    return fontSize * 0.32;
  }
  if (widePattern.test(glyph)) {
    return fontSize * 0.9;
  }
  if (glyph === glyph.toUpperCase() && /[A-Z0-9]/.test(glyph)) {
    return fontSize * 0.68;
  }
  return fontSize * 0.56;
};

export const estimateTextWidth = (text: string, fontSize: number): number =>
  Array.from(text).reduce((width, glyph) => width + estimateGlyphWidth(glyph, fontSize), 0);

const splitOversizedToken = (token: string, options: WordWrapOptions): string[] => {
  const chunks: string[] = [];
  let current = "";

  for (const glyph of Array.from(token)) {
    const candidate = `${current}${glyph}`;
    if (current && estimateTextWidth(candidate, options.fontSize) > options.maxWidth) {
      chunks.push(current);
      current = glyph;
    } else {
      current = candidate;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
};

export const wrapTranscriptIntoLines = (text: string, options: WordWrapOptions): string[] => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const maxLines = options.maxLines ?? Number.POSITIVE_INFINITY;
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  const pushLine = (line: string) => {
    if (!line) {
      return;
    }
    if (lines.length < maxLines) {
      lines.push(line);
    }
  };

  for (const rawWord of words) {
    const pieces = estimateTextWidth(rawWord, options.fontSize) > options.maxWidth
      ? splitOversizedToken(rawWord, options)
      : [rawWord];

    for (const piece of pieces) {
      const candidate = current ? `${current} ${piece}` : piece;
      if (current && estimateTextWidth(candidate, options.fontSize) > options.maxWidth) {
        pushLine(current);
        current = piece;
      } else {
        current = candidate;
      }
    }
  }

  pushLine(current);
  return lines;
};

export const useWordWrap = (text: string, options: WordWrapOptions): string[] =>
  useMemo(() => wrapTranscriptIntoLines(text, options), [options.fontSize, options.maxLines, options.maxWidth, text]);
