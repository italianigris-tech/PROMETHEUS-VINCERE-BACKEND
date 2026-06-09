import * as THREE from "three";

export type ColorRange = {
  start: number;
  end: number;
  color: string;
};

export type ParsedColorText = {
  plainText: string;
  colorRanges: ColorRange[];
};

const COLOR_MAP: Record<string, string> = {
  red: "#FF0040",
  blue: "#0080FF",
  green: "#00FF80",
  yellow: "#FFFF00"
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const OPEN_TAG = /\{([^}/]+)\}/g;

const resolveColor = (token: string): string | null => {
  const named = COLOR_MAP[token];
  if (named) {
    return named;
  }
  return HEX_COLOR.test(token) ? token.toUpperCase() : null;
};

export const parseColorAnnotations = (text: string): ParsedColorText => {
  if (text.length === 0) {
    return {plainText: "", colorRanges: []};
  }

  const colorRanges: ColorRange[] = [];
  let plainText = "";
  let cursor = 0;
  const annotation = /\{([^}]+)\}([\s\S]*?)\{\/\1\}/g;
  let match: RegExpExecArray | null;

  while ((match = annotation.exec(text)) !== null) {
    const color = resolveColor(match[1] ?? "");
    if (!color) {
      plainText += stripMalformedTags(text.slice(cursor, match.index));
      plainText += match[2] ?? "";
      cursor = annotation.lastIndex;
      continue;
    }

    plainText += stripMalformedTags(text.slice(cursor, match.index));
    const start = plainText.length;
    const coloredText = match[2] ?? "";
    plainText += coloredText;
    colorRanges.push({start, end: start + coloredText.length, color});
    cursor = annotation.lastIndex;
  }

  plainText += stripMalformedTags(text.slice(cursor));
  return {plainText, colorRanges};
};

export const hasColorAnnotations = (text: string): boolean =>
  parseColorAnnotations(text).colorRanges.length > 0;

const stripMalformedTags = (text: string): string => text
  .replace(OPEN_TAG, "")
  .replace(/\{\/[^}]+\}/g, "");

export const applyColorRanges = (
  textMesh: {colorRanges?: Record<number, THREE.Color | null>},
  colorRanges: readonly ColorRange[]
): void => {
  textMesh.colorRanges = {};
  for (const range of colorRanges) {
    textMesh.colorRanges[range.start] = new THREE.Color(range.color);
    textMesh.colorRanges[range.end] = null;
  }
};
