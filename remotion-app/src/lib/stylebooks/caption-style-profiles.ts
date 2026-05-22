import {captionPolicy} from "../caption-policy";
import {resolveCaptionEditorialDecision, type CaptionEditorialContext} from "../motion-platform/caption-editorial-engine";
import {
  buildLongformSemanticSidecallPresentation,
  hasLongformSemanticGraphicAsset
} from "../longform-semantic-sidecall";
import type {CaptionChunk, CaptionStyleProfileId, CaptionVerticalBias} from "../types";
import {HORMOZI_WORD_LOCK_PROFILE_ID, hormoziWordLockV1} from "./hormozi-word-lock-v1";
import {
  LONGFORM_EVE_TYPOGRAPHY_DISPLAY_NAME,
  LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID,
  LONGFORM_SVG_TYPOGRAPHY_DISPLAY_NAME,
  LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID,
  SVG_TYPOGRAPHY_DISPLAY_NAME,
  SVG_TYPOGRAPHY_PROFILE_ID
} from "./svg-typography-v1";

export const CAPTION_STYLE_PROFILE_IDS = [
  "slcp",
  HORMOZI_WORD_LOCK_PROFILE_ID,
  SVG_TYPOGRAPHY_PROFILE_ID,
  LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID,
  LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID,
  "longform_docked_inverse_v1",
  "longform_semantic_sidecall_v1"
] as const;
export const DEFAULT_CAPTION_STYLE_PROFILE_ID: CaptionStyleProfileId = "slcp";
export const LONGFORM_DOCKED_INVERSE_PROFILE_ID: CaptionStyleProfileId = "longform_docked_inverse_v1";
export const LONGFORM_DOCKED_INVERSE_DISPLAY_NAME = "Long-form Docked Inverse v1";
export const LONGFORM_SEMANTIC_SIDECALL_PROFILE_ID: CaptionStyleProfileId = "longform_semantic_sidecall_v1";
export const LONGFORM_SEMANTIC_SIDECALL_DISPLAY_NAME = "Long-form Semantic Sidecall v1";
export type LongformCaptionRenderMode =
  | "word-by-word"
  | "svg"
  | "docked-inverse"
  | "semantic-sidecall"
  | "standard";

const LONGFORM_WORD_BY_WORD_SPARSE_WORD_LIMIT = 4;
const LONGFORM_WORD_BY_WORD_SPARSE_CHAR_LIMIT = 28;

export type CaptionStyleGroupingPolicy = {
  hardMinWords: number;
  hardMaxWords: number;
  softMinWords: number;
  softMaxWords: number;
  pauseBreakMs: number;
  strongPauseMs: number;
  maxLineChars: number;
  hardMaxLineChars: number;
};

export type CaptionStyleProfileConfig = {
  id: CaptionStyleProfileId;
  displayName: string;
  strictWordLockHighlight: boolean;
  groupingPolicy: CaptionStyleGroupingPolicy;
  defaultCaptionBias?: CaptionVerticalBias;
};

const SLCP_PROFILE_CONFIG: CaptionStyleProfileConfig = {
  id: "slcp",
  displayName: "Speaker-Locked Contrast Pairing",
  strictWordLockHighlight: false,
  defaultCaptionBias: "bottom",
  groupingPolicy: {
    hardMinWords: captionPolicy.chunking.hardMinWords,
    hardMaxWords: 3,
    softMinWords: 2,
    softMaxWords: 3,
    pauseBreakMs: captionPolicy.chunking.pauseBreakMs,
    strongPauseMs: captionPolicy.chunking.strongPauseMs,
    maxLineChars: captionPolicy.chunking.maxLineChars,
    hardMaxLineChars: captionPolicy.chunking.hardMaxLineChars
  }
};

const HORMOZI_PROFILE_CONFIG: CaptionStyleProfileConfig = {
  id: HORMOZI_WORD_LOCK_PROFILE_ID,
  displayName: hormoziWordLockV1.displayName,
  strictWordLockHighlight: true,
  defaultCaptionBias: "middle",
  groupingPolicy: {
    hardMinWords: hormoziWordLockV1.grouping.hardMinWords,
    hardMaxWords: hormoziWordLockV1.grouping.hardMaxWords,
    softMinWords: hormoziWordLockV1.grouping.softMinWords,
    softMaxWords: hormoziWordLockV1.grouping.softMaxWords,
    pauseBreakMs: hormoziWordLockV1.grouping.pauseBreakMs,
    strongPauseMs: hormoziWordLockV1.grouping.strongPauseMs,
    maxLineChars: hormoziWordLockV1.grouping.maxLineChars,
    hardMaxLineChars: hormoziWordLockV1.grouping.hardMaxLineChars
  }
};

const SVG_TYPOGRAPHY_PROFILE_CONFIG: CaptionStyleProfileConfig = {
  id: SVG_TYPOGRAPHY_PROFILE_ID,
  displayName: SVG_TYPOGRAPHY_DISPLAY_NAME,
  strictWordLockHighlight: false,
  defaultCaptionBias: "middle",
  groupingPolicy: {
    hardMinWords: 1,
    hardMaxWords: 4,
    softMinWords: 2,
    softMaxWords: 3,
    pauseBreakMs: 260,
    strongPauseMs: 480,
    maxLineChars: 22,
    hardMaxLineChars: 26
  }
};

const LONGFORM_SVG_TYPOGRAPHY_PROFILE_CONFIG: CaptionStyleProfileConfig = {
  id: LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID,
  displayName: LONGFORM_SVG_TYPOGRAPHY_DISPLAY_NAME,
  strictWordLockHighlight: false,
  defaultCaptionBias: "middle",
  groupingPolicy: {
    hardMinWords: 2,
    hardMaxWords: 6,
    softMinWords: 4,
    softMaxWords: 5,
    pauseBreakMs: 320,
    strongPauseMs: 560,
    maxLineChars: 36,
    hardMaxLineChars: 48
  }
};

const LONGFORM_EVE_TYPOGRAPHY_PROFILE_CONFIG: CaptionStyleProfileConfig = {
  id: LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID,
  displayName: LONGFORM_EVE_TYPOGRAPHY_DISPLAY_NAME,
  strictWordLockHighlight: false,
  defaultCaptionBias: "bottom",
  groupingPolicy: {
    hardMinWords: 1,
    hardMaxWords: 4,
    softMinWords: 2,
    softMaxWords: 3,
    pauseBreakMs: 250,
    strongPauseMs: 480,
    maxLineChars: 26,
    hardMaxLineChars: 32
  }
};

const LONGFORM_DOCKED_INVERSE_PROFILE_CONFIG: CaptionStyleProfileConfig = {
  id: LONGFORM_DOCKED_INVERSE_PROFILE_ID,
  displayName: LONGFORM_DOCKED_INVERSE_DISPLAY_NAME,
  strictWordLockHighlight: false,
  defaultCaptionBias: "bottom",
  groupingPolicy: {
    hardMinWords: 2,
    hardMaxWords: 7,
    softMinWords: 4,
    softMaxWords: 6,
    pauseBreakMs: 340,
    strongPauseMs: 580,
    maxLineChars: 44,
    hardMaxLineChars: 58
  }
};

const LONGFORM_SEMANTIC_SIDECALL_PROFILE_CONFIG: CaptionStyleProfileConfig = {
  id: LONGFORM_SEMANTIC_SIDECALL_PROFILE_ID,
  displayName: LONGFORM_SEMANTIC_SIDECALL_DISPLAY_NAME,
  strictWordLockHighlight: false,
  defaultCaptionBias: "middle",
  groupingPolicy: {
    hardMinWords: 3,
    hardMaxWords: 7,
    softMinWords: 4,
    softMaxWords: 6,
    pauseBreakMs: 360,
    strongPauseMs: 620,
    maxLineChars: 42,
    hardMaxLineChars: 56
  }
};

const CAPTION_STYLE_PROFILE_CONFIGS = {
  slcp: SLCP_PROFILE_CONFIG,
  hormozi_word_lock_v1: HORMOZI_PROFILE_CONFIG,
  svg_typography_v1: SVG_TYPOGRAPHY_PROFILE_CONFIG,
  longform_svg_typography_v1: LONGFORM_SVG_TYPOGRAPHY_PROFILE_CONFIG,
  longform_eve_typography_v1: LONGFORM_EVE_TYPOGRAPHY_PROFILE_CONFIG,
  longform_docked_inverse_v1: LONGFORM_DOCKED_INVERSE_PROFILE_CONFIG,
  longform_semantic_sidecall_v1: LONGFORM_SEMANTIC_SIDECALL_PROFILE_CONFIG
} as const satisfies Record<CaptionStyleProfileId, CaptionStyleProfileConfig>;

export const normalizeCaptionStyleProfileId = (
  profileId: string | undefined | null
): CaptionStyleProfileId => {
  if (!profileId) {
    return DEFAULT_CAPTION_STYLE_PROFILE_ID;
  }

  const normalized = profileId.trim().toLowerCase();
  if (normalized === HORMOZI_WORD_LOCK_PROFILE_ID) {
    return HORMOZI_WORD_LOCK_PROFILE_ID;
  }
  if (normalized === SVG_TYPOGRAPHY_PROFILE_ID) {
    return SVG_TYPOGRAPHY_PROFILE_ID;
  }
  if (normalized === LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID) {
    return LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID;
  }
  if (normalized === LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID) {
    return LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID;
  }
  if (normalized === LONGFORM_DOCKED_INVERSE_PROFILE_ID) {
    return LONGFORM_DOCKED_INVERSE_PROFILE_ID;
  }
  if (normalized === LONGFORM_SEMANTIC_SIDECALL_PROFILE_ID) {
    return LONGFORM_SEMANTIC_SIDECALL_PROFILE_ID;
  }

  return DEFAULT_CAPTION_STYLE_PROFILE_ID;
};

export const getCaptionStyleProfile = (
  profileId: string | undefined | null
): CaptionStyleProfileConfig => {
  return CAPTION_STYLE_PROFILE_CONFIGS[normalizeCaptionStyleProfileId(profileId)];
};

const getChunkText = (chunk: CaptionChunk): string => {
  return `${chunk.text} ${chunk.words.map((word) => word.text).join(" ")}`
    .replace(/\s+/g, " ")
    .trim();
};

const isSparseLongformWordByWordChunk = (chunk: CaptionChunk): boolean => {
  if (chunk.words.length === 0) {
    return true;
  }

  const combinedText = getChunkText(chunk);
  return chunk.words.length <= LONGFORM_WORD_BY_WORD_SPARSE_WORD_LIMIT ||
    (chunk.words.length <= 6 && combinedText.length <= LONGFORM_WORD_BY_WORD_SPARSE_CHAR_LIMIT);
};

const resolveLongformWordByWordFallbackMode = (
  chunk: CaptionChunk,
  editorialContext?: Omit<CaptionEditorialContext, "chunk" | "currentTimeMs">
): Exclude<LongformCaptionRenderMode, "word-by-word" | "standard"> => {
  if (resolveCaptionEditorialDecision({chunk, ...editorialContext}).mode !== "normal") {
    return "semantic-sidecall";
  }

  if (hasLongformSemanticGraphicAsset(chunk)) {
    return "semantic-sidecall";
  }

  const presentation = buildLongformSemanticSidecallPresentation({chunk});
  return presentation.keywords.length > 0 ? "semantic-sidecall" : "docked-inverse";
};

const isShortLongformWordByWordChunk = (chunk: CaptionChunk): boolean => {
  if (chunk.words.length === 0) {
    return true;
  }

  const combinedText = getChunkText(chunk);
  return chunk.words.length <= 4 ||
    (chunk.words.length <= 5 && combinedText.length <= LONGFORM_WORD_BY_WORD_SPARSE_CHAR_LIMIT);
};

const isShortEveWordByWordChunk = (chunk: CaptionChunk): boolean => {
  if (chunk.words.length === 0) {
    return true;
  }

  const combinedText = getChunkText(chunk);
  return chunk.words.length <= 3 && combinedText.length <= 26;
};

export const getDefaultCaptionBiasForProfile = (
  profileId: string | undefined | null
): CaptionVerticalBias => {
  return getCaptionStyleProfile(profileId).defaultCaptionBias ?? "middle";
};

export const isHormoziCaptionStyleProfile = (
  profileId: string | undefined | null
): boolean => {
  return normalizeCaptionStyleProfileId(profileId) === HORMOZI_WORD_LOCK_PROFILE_ID;
};

export const isSvgCaptionStyleProfile = (
  profileId: string | undefined | null
): boolean => {
  const normalized = normalizeCaptionStyleProfileId(profileId);
  return normalized === SVG_TYPOGRAPHY_PROFILE_ID || normalized === LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID;
};

export const isLongformCaptionStyleProfile = (
  profileId: string | undefined | null
): boolean => {
  const normalized = normalizeCaptionStyleProfileId(profileId);
  return normalized === LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID ||
    normalized === LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID ||
    normalized === LONGFORM_DOCKED_INVERSE_PROFILE_ID ||
    normalized === LONGFORM_SEMANTIC_SIDECALL_PROFILE_ID;
};

export const getLongformCaptionRenderMode = (
  profileId: string | undefined | null
): LongformCaptionRenderMode => {
  const normalized = normalizeCaptionStyleProfileId(profileId);

  if (normalized === LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID) {
    return "word-by-word";
  }
  if (normalized === LONGFORM_DOCKED_INVERSE_PROFILE_ID) {
    return "docked-inverse";
  }
  if (normalized === LONGFORM_SEMANTIC_SIDECALL_PROFILE_ID) {
    return "semantic-sidecall";
  }
  if (normalized === LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID) {
    return "svg";
  }

  return "standard";
};

export const getLongformCaptionRenderModeForChunk = (
  profileId: string | undefined | null,
  chunk?: CaptionChunk | null,
  editorialContext?: Omit<CaptionEditorialContext, "chunk" | "currentTimeMs">
): LongformCaptionRenderMode => {
  const normalized = normalizeCaptionStyleProfileId(profileId);
  if (normalized === LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID) {
    if (chunk && hasLongformSemanticGraphicAsset(chunk)) {
      return "semantic-sidecall";
    }

    if (!chunk || isShortEveWordByWordChunk(chunk)) {
      return "word-by-word";
    }

    return resolveLongformWordByWordFallbackMode(chunk, editorialContext);
  }

  if (!chunk || isShortLongformWordByWordChunk(chunk)) {
    return getLongformCaptionRenderMode(profileId);
  }

  if (normalized === LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID) {
    return "svg";
  }

  return getLongformCaptionRenderMode(profileId);
};

export const getLongformWordByWordFallbackMode = (
  chunk?: CaptionChunk | null
): Exclude<LongformCaptionRenderMode, "word-by-word" | "standard"> | null => {
  if (!chunk || !isSparseLongformWordByWordChunk(chunk)) {
    return null;
  }

  return resolveLongformWordByWordFallbackMode(chunk);
};

export const getLongformWordByWordFallbackModeForProfile = (
  profileId: string | undefined | null,
  chunk?: CaptionChunk | null,
  editorialContext?: Omit<CaptionEditorialContext, "chunk" | "currentTimeMs">
): Exclude<LongformCaptionRenderMode, "word-by-word" | "standard"> | null => {
  if (!chunk) {
    return null;
  }

  if (resolveCaptionEditorialDecision({chunk, ...editorialContext}).mode !== "normal") {
    return "semantic-sidecall";
  }

  const normalized = normalizeCaptionStyleProfileId(profileId);
  if (normalized === LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID) {
    if (hasLongformSemanticGraphicAsset(chunk)) {
      return "semantic-sidecall";
    }

    if (isShortEveWordByWordChunk(chunk)) {
      return null;
    }
    return resolveLongformWordByWordFallbackMode(chunk);
  }

  if (!isSparseLongformWordByWordChunk(chunk)) {
    return null;
  }

  if (normalized === LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID) {
    return null;
  }

  return resolveLongformWordByWordFallbackMode(chunk);
};

export const isLongformDockedInverseCaptionStyleProfile = (
  profileId: string | undefined | null
): boolean => {
  return normalizeCaptionStyleProfileId(profileId) === LONGFORM_DOCKED_INVERSE_PROFILE_ID;
};

export const isLongformSemanticSidecallCaptionStyleProfile = (
  profileId: string | undefined | null
): boolean => {
  return normalizeCaptionStyleProfileId(profileId) === LONGFORM_SEMANTIC_SIDECALL_PROFILE_ID;
};

export const isLongformEveTypographyCaptionStyleProfile = (
  profileId: string | undefined | null
): boolean => {
  return normalizeCaptionStyleProfileId(profileId) === LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID;
};
