import {useMemo} from "react";

export type WordWrapOptions = {
  maxWidth: number;
  fontSize: number;
  fontFamily?: string;
  maxLines?: number;
  measureText?: (text: string) => number;
};

/**
 * Internal canvas-based text measurement.
 * Works in both browser (canvas) and worker (OffscreenCanvas) environments.
 */
function measureTextWidthInternal(text: string, fontSize: number, fontFamily: string = "sans-serif"): number {
  try {
    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(1, 1)
      : document.createElement("canvas");

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return text.length * fontSize * 0.6;
    }

    ctx.font = `${fontSize}px ${fontFamily}`;
    return ctx.measureText(text).width;
  } catch {
    return text.length * fontSize * 0.6;
  }
}

// Kept for backward compatibility with existing tests and callers.
// New code should rely on the internal canvas measurement.
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

/**
 * Measures text width using canvas measurement, with optional injected measureText override.
 * @param text - The text to measure
 * @param options - Word wrap options containing fontSize, fontFamily, and optional measureText
 * @returns The measured width of the text
 */
const measureTextWidth = (text: string, options: WordWrapOptions): number => {
  if (options.measureText) {
    return options.measureText(text);
  }
  return measureTextWidthInternal(text, options.fontSize, options.fontFamily);
};

const splitOversizedToken = (token: string, options: WordWrapOptions): string[] => {
  const chunks: string[] = [];
  let current = "";

  for (const glyph of Array.from(token)) {
    const candidate = `${current}${glyph}`;
    if (current && measureTextWidth(candidate, options) > options.maxWidth) {
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
    const pieces = measureTextWidth(rawWord, options) > options.maxWidth
      ? splitOversizedToken(rawWord, options)
      : [rawWord];

    for (const piece of pieces) {
      const candidate = current ? `${current} ${piece}` : piece;
      if (current && measureTextWidth(candidate, options) > options.maxWidth) {
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
  useMemo(
    () => wrapTranscriptIntoLines(text, options),
    [options.fontSize, options.maxLines, options.maxWidth, options.measureText, text]
  );
