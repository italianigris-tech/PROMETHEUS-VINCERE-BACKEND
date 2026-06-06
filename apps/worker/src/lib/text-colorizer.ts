import * as THREE from "three";

/**
 * Text Colorizer
 * Parses color annotations from text strings and produces color segments
 * for Troika text mesh colorRanges.
 *
 * Annotation format: "not your average {red}motion design{/red} guy"
 * Supported color names: red, blue, green, yellow, white, black, orange, purple, pink, cyan
 * Also supports hex: "{#FF0040}highlighted text{/#FF0040}"
 */

export interface ColorSegment {
  text: string;
  color: string;
  startIndex: number;
  endIndex: number;
}

export interface ParsedColorText {
  plainText: string;
  segments: ColorSegment[];
}

/**
 * Maps color names to hex values.
 */
const COLOR_MAP: Record<string, string> = {
  red: "#FF0040",
  blue: "#0080FF",
  green: "#00FF80",
  yellow: "#FFFF00",
  white: "#FFFFFF",
  black: "#000000",
  orange: "#FF8000",
  purple: "#8000FF",
  pink: "#FF40A0",
  cyan: "#00FFFF",
};

/**
 * Parses color annotations from a text string.
 *
 * @param text - Text with color annotations, e.g. "hello {red}world{/red}"
 * @returns Plain text and color segments
 *
 * Example:
 *   parseColorAnnotations("I love {red}motion design{/red}")
 *   // => {
 *   //   plainText: "I love motion design",
 *   //   segments: [{ text: "motion design", color: "#FF0040", startIndex: 7, endIndex: 20 }]
 *   // }
 */
export function parseColorAnnotations(text: string): ParsedColorText {
  // Match {colorName}text{/colorName} or {#hex}text{/#hex}
  const regex = /\{([^}]+)\}([\s\S]*?)\{\/\1\}/g;
  const segments: ColorSegment[] = [];
  let plainText = text;
  let offset = 0;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const colorKey = match[1];
    const coloredText = match[2];
    const fullMatch = match[0];

    if (!colorKey || !coloredText || !fullMatch) {
      continue;
    }

    const startIndex = match.index - offset;
    const endIndex = startIndex + coloredText.length;

    // Resolve color: check named map first, then treat as hex
    const color = COLOR_MAP[colorKey] ?? colorKey;

    segments.push({
      text: coloredText,
      color,
      startIndex,
      endIndex,
    });

    // Remove annotation tags from plain text
    plainText = plainText.replace(fullMatch, coloredText);
    offset += fullMatch.length - coloredText.length;
  }

  return { plainText, segments };
}

/**
 * Checks if a text string contains any color annotations.
 */
export function hasColorAnnotations(text: string): boolean {
  return /\{[^}]+\}[\s\S]*?\{\/[^}]+\}/.test(text);
}

/**
 * Applies color segments to a Troika text mesh using colorRanges.
 * Troika supports per-character color via the colorRanges property.
 *
 * @param textMesh - The Troika text mesh
 * @param segments - Color segments from parseColorAnnotations
 *
 * Note: Troika's colorRanges API uses character index → THREE.Color mapping.
 * Setting colorRanges[index] = color applies that color starting at that character.
 */
export function applyColorRanges(
  textMesh: { colorRanges?: Record<number, THREE.Color | null> },
  segments: ColorSegment[]
): void {
  if (!textMesh.colorRanges) {
    textMesh.colorRanges = {};
  }

  for (const segment of segments) {
    // Set color at start of segment
    textMesh.colorRanges[segment.startIndex] = new THREE.Color(segment.color);
    // Reset to default color at end of segment
    textMesh.colorRanges[segment.endIndex] = null;
  }
}

/**
 * Convenience function: parse and apply color annotations in one call.
 *
 * @param textMesh - The Troika text mesh
 * @param annotatedText - Text with color annotations
 * @returns The plain text (annotations stripped) to set as textMesh.text
 */
export function applyColorAnnotations(
  textMesh: { colorRanges?: Record<number, THREE.Color | null> },
  annotatedText: string
): string {
  const { plainText, segments } = parseColorAnnotations(annotatedText);

  if (segments.length > 0) {
    applyColorRanges(textMesh, segments);
  }

  return plainText;
}