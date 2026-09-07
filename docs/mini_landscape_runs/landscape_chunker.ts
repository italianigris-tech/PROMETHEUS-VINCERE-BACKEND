/**
 * MINI LANDSCAPE RUNS — LANDSCAPE CHUNKER ENGINE
 *
 * Implements 16:9 Landscape-optimized text segmentation.
 * Unlike 9:16 short-form mini-runs (which target 3-4 word snippets), 16:9 Landscape
 * requires longer, syntactically coherent phrases:
 * - Target sweet spot: 5-word, 7-word, and 8-word chunks.
 * - Chunks with > 8 words are classified as Quotes (isQuote: true) and receive
 *   specialized quote kinetic animation treatment.
 * - Strict orphan prevention: avoids dangling 1-word or 2-word snippets by
 *   equitably balancing remainders across adjacent chunks.
 * - Word-by-word and character-by-character decomposition with precise timing offsets.
 */

export const LANDSCAPE_KINETIC_WHITELIST = [
  "apple_pro_display_hero_revealer",
  "pixel_blur_mask",
  "gaussian_blur_reveal_sweep",
  "compound_word_glitch_blur_reveal",
  "masked_dual_axis_text_reveal",
  "dynamic_3d_letter_flicker",
  "dual_kinetic_phrase_convergence",
  "rise_and_deblur_compression",
  "quote_kinetic_treatment",
] as const;

export type LandscapeKineticPreset = (typeof LANDSCAPE_KINETIC_WHITELIST)[number];

export interface LandscapeWordItem {
  text: string;
  charCount: number;
  wordIndex: number;
  startSec: number;
  endSec: number;
}

export interface LandscapeChunk {
  chunkIndex: number;
  startSec: number;
  endSec: number;
  timestamp: string;
  text: string;
  wordCount: number;
  isQuote: boolean;
  heroWord: string;
  animationPreset: LandscapeKineticPreset;
  words: LandscapeWordItem[];
}

export interface ChunkerOptions {
  minWords?: number; // default: 5
  targetWords?: number; // default: 7
  maxWords?: number; // default: 8
  forceQuoteAbove?: number; // default: 8
  startSec?: number;
  durationSec?: number;
}

function formatTimestamp(sec: number): string {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const tenth = Math.floor((safe % 1) * 10);
  return (
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    "." +
    tenth
  );
}

/**
 * Partitions an array of words into groups of sizes strictly within [minWords, maxWords],
 * unless the group is explicitly preserved as a quote (> forceQuoteAbove words).
 * Balances remaining items to guarantee no 1-word or 2-word hanging orphans.
 */
export function partitionWords(
  rawWords: string[],
  options: ChunkerOptions = {}
): string[][] {
  const {
    minWords = 5,
    maxWords = 8,
  } = options;

  if (rawWords.length === 0) return [];
  if (rawWords.length <= maxWords) {
    return [rawWords];
  }

  const groups: string[][] = [];
  let remaining = [...rawWords];

  while (remaining.length > 0) {
    const remLen = remaining.length;

    // If remaining fits in a single chunk
    if (remLen <= maxWords) {
      // If it's too small (orphan check, < minWords) and we have a previous group, rebalance
      if (remLen < minWords && groups.length > 0) {
        const prev = groups.pop()!;
        const combined = [...prev, ...remaining];
        const half = Math.ceil(combined.length / 2);
        groups.push(combined.slice(0, half));
        groups.push(combined.slice(half));
      } else {
        groups.push(remaining);
      }
      break;
    }

    // Determine target size for next slice:
    // Try 8 words, but check what would remain
    let take = maxWords;
    let leftover = remLen - take;

    // If taking 8 leaves an orphan (1 or 2 words), take 5 or 6 or 7 instead
    if (leftover > 0 && leftover < minWords) {
      take = Math.max(minWords, Math.floor(remLen / 2));
    } else if (remLen >= 14 && remLen <= 16) {
      // 14 -> 7 + 7; 15 -> 8 + 7; 16 -> 8 + 8
      take = Math.ceil(remLen / 2);
    } else if (remLen >= 10 && remLen <= 12) {
      // 10 -> 5 + 5; 11 -> 6 + 5; 12 -> 6 + 6
      take = Math.ceil(remLen / 2);
    }

    groups.push(remaining.slice(0, take));
    remaining = remaining.slice(take);
  }

  return groups;
}

/**
 * Main function: segments text or word transcript points into 16:9 Landscape chunks.
 */
export function chunkLandscapeText(
  textOrWords: string | Array<{ text: string; startSec?: number; endSec?: number }>,
  options: ChunkerOptions = {}
): LandscapeChunk[] {
  const {
    startSec = 0,
    durationSec = 6.0,
    forceQuoteAbove = 8,
  } = options;

  let rawWords: Array<{ text: string; startSec?: number; endSec?: number }> = [];

  if (typeof textOrWords === "string") {
    const tokens = textOrWords.trim().split(/\s+/).filter((w) => w.length > 0);
    rawWords = tokens.map((text) => ({ text }));
  } else {
    rawWords = textOrWords.filter((w) => w.text && w.text.trim().length > 0);
  }

  if (rawWords.length === 0) return [];

  // Check if caller explicitly passed a full sentence marked or quoted with quotation marks
  const fullRawText = rawWords.map((w) => w.text).join(" ");
  const isExplicitQuote =
    (fullRawText.startsWith('"') && fullRawText.endsWith('"')) ||
    (fullRawText.startsWith('“') && fullRawText.endsWith('”')) ||
    (rawWords.length > forceQuoteAbove && fullRawText.includes('"'));

  // If text is an explicit long quote, treat it as a single quote chunk
  let partitions: string[][];
  if (isExplicitQuote && rawWords.length > forceQuoteAbove) {
    partitions = [rawWords.map((w) => w.text)];
  } else {
    partitions = partitionWords(
      rawWords.map((w) => w.text),
      options
    );
  }

  const chunkDuration = partitions.length > 0 ? durationSec / partitions.length : durationSec;
  const nonQuotePresets: LandscapeKineticPreset[] = [
    "dual_kinetic_phrase_convergence",
    "rise_and_deblur_compression",
    "apple_pro_display_hero_revealer",
    "pixel_blur_mask",
    "gaussian_blur_reveal_sweep",
    "compound_word_glitch_blur_reveal",
    "masked_dual_axis_text_reveal",
    "dynamic_3d_letter_flicker",
  ];

  let currentWordOffset = 0;

  return partitions.map((wordTokens, chunkIdx): LandscapeChunk => {
    const chunkStart = startSec + chunkIdx * chunkDuration;
    const chunkEnd = chunkStart + chunkDuration;
    const chunkText = wordTokens.join(" ");
    const wordCount = wordTokens.length;
    const isQuote = wordCount > forceQuoteAbove || isExplicitQuote;

    const animationPreset: LandscapeKineticPreset = isQuote
      ? "quote_kinetic_treatment"
      : nonQuotePresets[chunkIdx % nonQuotePresets.length];

    const wordDuration = wordCount > 0 ? chunkDuration / wordCount : 0.3;

    const words: LandscapeWordItem[] = wordTokens.map((wText, wIdx) => {
      const wStart = chunkStart + wIdx * wordDuration;
      const wEnd = wStart + wordDuration;
      return {
        text: wText,
        charCount: wText.length,
        wordIndex: currentWordOffset + wIdx,
        startSec: Math.round(wStart * 100) / 100,
        endSec: Math.round(wEnd * 100) / 100,
      };
    });

    currentWordOffset += wordCount;
    const heroWord = wordTokens[wordTokens.length - 1] || "";

    return {
      chunkIndex: chunkIdx + 1,
      startSec: Math.round(chunkStart * 100) / 100,
      endSec: Math.round(chunkEnd * 100) / 100,
      timestamp: formatTimestamp(chunkStart) + " — " + formatTimestamp(chunkEnd),
      text: chunkText,
      wordCount,
      isQuote,
      heroWord,
      animationPreset,
      words,
    };
  });
}

export const chunkLandscapeTranscript = chunkLandscapeText;
