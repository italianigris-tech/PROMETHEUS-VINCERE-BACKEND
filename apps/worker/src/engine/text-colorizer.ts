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

const resolveColor = (token: string): string | null => {
  const named = COLOR_MAP[token.toLowerCase()];
  if (named) {
    return named;
  }
  return HEX_COLOR.test(token) ? token.toUpperCase() : null;
};

const normalizeTag = (token: string): string =>
  HEX_COLOR.test(token) ? token.toUpperCase() : token.toLowerCase();

const findUnescapedTagEnd = (text: string, start: number): number => {
  for (let index = start; index < text.length; index++) {
    if (text[index] === "}") {
      return index;
    }
  }
  return -1;
};

const hasMatchingClose = (text: string, from: number, token: string): boolean => {
  const normalized = normalizeTag(token);
  for (let index = from; index < text.length; index++) {
    if (text[index] !== "{") {
      continue;
    }

    const end = findUnescapedTagEnd(text, index + 1);
    if (end === -1) {
      return false;
    }

    const candidate = text.slice(index + 1, end);
    if (candidate.startsWith("/") && normalizeTag(candidate.slice(1)) === normalized) {
      return true;
    }

    index = end;
  }
  return false;
};

const findLastStackIndex = (
  stack: ReadonlyArray<{token: string; color: string}>,
  token: string
): number => {
  for (let index = stack.length - 1; index >= 0; index--) {
    if (stack[index]?.token === token) {
      return index;
    }
  }
  return -1;
};

export const parseColorAnnotations = (text: string): ParsedColorText => {
  if (text.length === 0) {
    return {plainText: "", colorRanges: []};
  }

  const colorRanges: ColorRange[] = [];
  let plainText = "";
  let currentColor: string | null = null;
  let currentRangeStart = 0;
  const stack: Array<{token: string; color: string}> = [];

  const setColor = (color: string | null): void => {
    if (color === currentColor) {
      return;
    }
    if (currentColor && currentRangeStart < plainText.length) {
      colorRanges.push({
        start: currentRangeStart,
        end: plainText.length,
        color: currentColor
      });
    }
    currentColor = color;
    currentRangeStart = plainText.length;
  };

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === "\\" && text[index + 1] === "{") {
      plainText += "{";
      index++;
      continue;
    }

    if (character !== "{") {
      plainText += character;
      continue;
    }

    const tagEnd = findUnescapedTagEnd(text, index + 1);
    if (tagEnd === -1) {
      continue;
    }

    const rawToken = text.slice(index + 1, tagEnd);
    const isClosingTag = rawToken.startsWith("/");
    const token = isClosingTag ? rawToken.slice(1) : rawToken;
    const color = resolveColor(token);
    if (!color) {
      index = tagEnd;
      continue;
    }

    if (isClosingTag) {
      const normalized = normalizeTag(token);
      const stackIndex = findLastStackIndex(stack, normalized);
      if (stackIndex !== -1) {
        stack.splice(stackIndex, 1);
        setColor(stack[stack.length - 1]?.color ?? null);
      }
      index = tagEnd;
      continue;
    }

    if (hasMatchingClose(text, tagEnd + 1, token)) {
      stack.push({token: normalizeTag(token), color});
      setColor(color);
    }
    index = tagEnd;
  }

  setColor(null);
  return {plainText, colorRanges};
};

export const hasColorAnnotations = (text: string): boolean =>
  parseColorAnnotations(text).colorRanges.length > 0;

export const applyColorRanges = (
  textMesh: {colorRanges?: Record<number, THREE.Color | string | number> | null},
  colorRanges: readonly ColorRange[],
  fallbackColor = "#FFFFFF"
): void => {
  if (colorRanges.length === 0) {
    textMesh.colorRanges = null;
    return;
  }

  const fallback = new THREE.Color(fallbackColor);
  const sortedRanges = [...colorRanges].sort((a, b) => a.start - b.start || a.end - b.end);
  textMesh.colorRanges = {0: fallback};
  for (const range of sortedRanges) {
    textMesh.colorRanges[range.start] = new THREE.Color(range.color);
    textMesh.colorRanges[range.end] = fallback;
  }
};
