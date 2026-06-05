import {useEffect, useMemo, useState} from "react";
import {continueRender, delayRender} from "remotion";
import {preloadFont} from "troika-three-text";

export const DEFAULT_SDF_GLYPH_SIZE = 256;
export const FONT_PRELOAD_TIMEOUT_MS = 10000;

type TroikaTextRenderInfo = {
  glyphAtlasIndices?: unknown[];
};

export const toExactCharacterSet = (text: string): string => {
  const seen = new Set<string>();
  const characters: string[] = [];

  for (const character of Array.from(text)) {
    if (!seen.has(character)) {
      seen.add(character);
      characters.push(character);
    }
  }

  return characters.join("");
};

const fontPathname = (font: string): string => {
  try {
    return new URL(font, "http://localhost").pathname;
  } catch {
    return font.split(/[?#]/, 1)[0] ?? font;
  }
};

export const isTroikaCompatibleFontUrl = (font: string | null | undefined): boolean => {
  const pathname = fontPathname(String(font ?? "")).toLowerCase();
  if (!pathname || pathname.includes("variable")) {
    return false;
  }

  return pathname.endsWith(".ttf") || pathname.endsWith(".woff");
};

export const resolveTroikaFontUrl = (
  font: string | null | undefined,
  fallbackFont: string | null = null
): string | null => {
  if (isTroikaCompatibleFontUrl(font)) {
    return font ?? null;
  }

  return fallbackFont;
};

export type UseFontPreloadInput = {
  font: string;
  characters: string;
  sdfGlyphSize?: number;
};

export const useFontPreload = ({
  font,
  characters,
  sdfGlyphSize = DEFAULT_SDF_GLYPH_SIZE
}: UseFontPreloadInput): boolean => {
  const exactCharacters = useMemo(() => toExactCharacterSet(characters), [characters]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let settled = false;
    const handle = delayRender("font-preload");
    const timeout = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      console.error(`Font load timed out after ${FONT_PRELOAD_TIMEOUT_MS}ms: ${font}`);
      setReady(true);
      continueRender(handle);
    }, FONT_PRELOAD_TIMEOUT_MS);

    const release = () => {
      window.clearTimeout(timeout);
      continueRender(handle);
    };

    setReady(false);
    if (!isTroikaCompatibleFontUrl(font)) {
      settled = true;
      console.warn(`Font ${font} is not Troika-compatible; continuing with fallback text rendering.`);
      setReady(true);
      release();
      return () => undefined;
    }

    try {
      preloadFont({font, characters: exactCharacters, sdfGlyphSize}, (info: TroikaTextRenderInfo) => {
        if (settled) {
          return;
        }

        const glyphCount = info.glyphAtlasIndices?.length ?? 0;
        if (glyphCount <= 0) {
          settled = true;
          console.error(`Font atlas for ${font} generated 0 glyphs; continuing with fallback text rendering.`);
          setReady(true);
          release();
          return;
        }

        settled = true;
        console.log(`[font-preload] atlas glyph count: ${glyphCount}`);
        setReady(true);
        release();
      });
    } catch (error) {
      settled = true;
      console.error(`Font load failed: ${font}`, error);
      setReady(true);
      release();
    }

    return () => {
      if (!settled) {
        settled = true;
        release();
      }
    };
  }, [exactCharacters, font, sdfGlyphSize]);

  return ready;
};
