import {useEffect, useMemo, useState} from "react";
import {cancelRender, continueRender, delayRender} from "remotion";
import {preloadFont} from "troika-three-text";

export const DEFAULT_SDF_GLYPH_SIZE = 256;
const FONT_PRELOAD_TIMEOUT_MS = 15000;

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
      cancelRender(new Error(`Timed out preloading font atlas for ${font}`));
    }, FONT_PRELOAD_TIMEOUT_MS);

    const release = () => {
      window.clearTimeout(timeout);
      continueRender(handle);
    };

    setReady(false);
    try {
      preloadFont({font, characters: exactCharacters, sdfGlyphSize}, (info: TroikaTextRenderInfo) => {
        if (settled) {
          return;
        }

        const glyphCount = info.glyphAtlasIndices?.length ?? 0;
        if (glyphCount <= 0) {
          settled = true;
          release();
          cancelRender(new Error(`Font atlas for ${font} generated 0 glyphs`));
          return;
        }

        settled = true;
        console.log(`[font-preload] atlas glyph count: ${glyphCount}`);
        setReady(true);
        release();
      });
    } catch (error) {
      settled = true;
      release();
      cancelRender(error instanceof Error ? error : new Error(String(error)));
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
