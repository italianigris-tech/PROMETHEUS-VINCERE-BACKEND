import React, {useMemo} from "react";
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from "remotion";

import {
  resolveCaptionEditorialDecision,
  type CaptionEditorialContext
} from "../lib/motion-platform/caption-editorial-engine";
import {sanitizeRenderableOverlayText, shouldRenderOverlayText} from "../lib/motion-platform/render-text-safety";
import type {CaptionChunk, CaptionVerticalBias} from "../lib/types";
import {
  LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID,
  SVG_TYPOGRAPHY_PROFILE_ID,
  getSvgVariantsForSlotSchema,
  getSvgSlotSchemaForWordCount,
  getSvgTypographyVariantFromStyleKey,
  isSvgTypographyStyleKey,
  mapWordsToSvgSlots,
  type SvgTypographyVariant
} from "../lib/stylebooks/svg-typography-v1";

const VIEWBOX_W = 1000;
const VIEWBOX_H = 1000;
const DEFAULT_MIN_SCALE = 0.35;
const TYPING_CURSOR_VARIANT_ID = "cinematic_text_preset_11";
const MAX_ADAPTIVE_TIME_SCALE = 2.4;
type SvgFrameConfig = {
  safeBox: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  transformOrigin: {
    x: number;
    y: number;
  };
};

const SVG_FRAME_CONFIGS: Record<CaptionVerticalBias, SvgFrameConfig> = {
  top: {
    safeBox: {
      minX: 96,
      maxX: 904,
      minY: 176,
      maxY: 850
    },
    transformOrigin: {
      x: VIEWBOX_W / 2,
      y: 500
    }
  },
  middle: {
    safeBox: {
      minX: 96,
      maxX: 904,
      minY: 200,
      maxY: 872
    },
    transformOrigin: {
      x: VIEWBOX_W / 2,
      y: 530
    }
  },
  bottom: {
    safeBox: {
      minX: 96,
      maxX: 904,
      minY: 230,
      maxY: 900
    },
    transformOrigin: {
      x: VIEWBOX_W / 2,
      y: 558
    }
  }
};
const SVG_MIN_PROGRAM_SCALE = 0.72;

type SvgCaptionOverlayProps = {
  chunks: CaptionChunk[];
  captionBias?: CaptionVerticalBias;
  editorialContext?: Omit<CaptionEditorialContext, "chunk" | "currentTimeMs">;
};

type EasingToken =
  | "linear"
  | "none"
  | "power1.inOut"
  | "power2.in"
  | "power2.out"
  | "power2.inOut"
  | "power3.out"
  | "power3.inOut"
  | "power4.out"
  | "power4.inOut"
  | "back.out(1.8)"
  | "back.out(2.2)"
  | "back.out(2.5)"
  | "back.out(3)";

type TimelineNumberStep = {
  at: number;
  duration: number;
  from: number;
  to: number;
  ease?: EasingToken;
};

type TimelineDiscreteStep<T> = {
  at: number;
  value: T;
};

type MeasuredWord = {
  text: string;
  width: number;
  charX: number[];
  fontSize: number;
};

type ProgramBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type ProgramTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

type FontSpec = {
  family: string;
  weight?: string;
  style?: string;
  letterSpacing?: number;
};

type SvgEffectFamily =
  | "chromatic-reveal"
  | "char-stagger"
  | "script-plus-bold"
  | "slit-reveal"
  | "dual-wipe"
  | "split-impact"
  | "char-drop-pair"
  | "script-big-small-blur"
  | "script-big-small-elastic"
  | "script-plus-fog"
  | "triple-script-plus-bold"
  | "cursor-sweep";

export type SvgMotionState = {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  blur: number;
  clipProgress: number;
};

export const isSvgCaptionChunk = (chunk: CaptionChunk): boolean => {
  if (
    chunk.profileId === SVG_TYPOGRAPHY_PROFILE_ID ||
    chunk.profileId === LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID
  ) {
    return true;
  }
  return isSvgTypographyStyleKey(chunk.styleKey);
};

const GENERIC_FONT_FAMILY_TOKENS = new Set([
  "serif",
  "sans-serif",
  "cursive",
  "monospace",
  "system-ui"
]);

const extractConcreteFontFamilies = (fontStack: string): string[] => {
  return fontStack
    .split(",")
    .map((segment) => segment.trim().replace(/^['"]|['"]$/g, ""))
    .filter((segment) => segment.length > 0)
    .filter((segment) => !GENERIC_FONT_FAMILY_TOKENS.has(segment.toLowerCase()));
};

export const getSvgCaptionChunkFontFamilies = (chunk?: CaptionChunk | null): string[] => {
  if (!chunk) {
    return [];
  }

  const variant = getSvgTypographyVariantFromStyleKey(chunk.styleKey);
  if (!variant) {
    return [];
  }

  const requestedFamilies = Object.values(variant.fontProfile).flatMap((fontSpec) =>
    extractConcreteFontFamilies(fontSpec.family)
  );

  return Array.from(new Set(requestedFamilies));
};

export const resolveSvgSlotSchemaForChunkWords = (words: string[]): ReturnType<typeof getSvgSlotSchemaForWordCount> => {
  return getSvgSlotSchemaForWordCount(words.filter(Boolean).length);
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

const easeOutPower = (t: number, power: number): number => 1 - (1 - t) ** power;
const easeInPower = (t: number, power: number): number => t ** power;
const easeInOutPower = (t: number, power: number): number => {
  if (t < 0.5) {
    return 0.5 * (2 * t) ** power;
  }
  return 1 - 0.5 * (2 * (1 - t)) ** power;
};
const easeBackOut = (t: number, overshoot: number): number => {
  const p = t - 1;
  return p * p * ((overshoot + 1) * p + overshoot) + 1;
};

const resolveEase = (token: EasingToken | undefined, t: number): number => {
  const p = clamp01(t);
  switch (token) {
    case "none":
    case "linear":
      return p;
    case "power1.inOut":
      return easeInOutPower(p, 1);
    case "power2.in":
      return easeInPower(p, 2);
    case "power2.out":
      return easeOutPower(p, 2);
    case "power2.inOut":
      return easeInOutPower(p, 2);
    case "power3.out":
      return easeOutPower(p, 3);
    case "power3.inOut":
      return easeInOutPower(p, 3);
    case "power4.out":
      return easeOutPower(p, 4);
    case "power4.inOut":
      return easeInOutPower(p, 4);
    case "back.out(1.8)":
      return easeBackOut(p, 1.8);
    case "back.out(2.2)":
      return easeBackOut(p, 2.2);
    case "back.out(2.5)":
      return easeBackOut(p, 2.5);
    case "back.out(3)":
      return easeBackOut(p, 3);
    default:
      return easeOutPower(p, 3);
  }
};

const sampleNumberTimeline = (timeSec: number, initial: number, steps: TimelineNumberStep[]): number => {
  const sorted = [...steps].sort((a, b) => a.at - b.at);
  let value = initial;

  for (const step of sorted) {
    if (timeSec < step.at) {
      break;
    }
    if (step.duration <= 0) {
      value = step.to;
      continue;
    }
    const progress = (timeSec - step.at) / step.duration;
    if (progress >= 1) {
      value = step.to;
      continue;
    }
    value = lerp(step.from, step.to, resolveEase(step.ease, progress));
    break;
  }
  return value;
};

const sampleDiscreteTimeline = <T,>(timeSec: number, initial: T, steps: TimelineDiscreteStep<T>[]): T => {
  const sorted = [...steps].sort((a, b) => a.at - b.at);
  let value = initial;
  sorted.forEach((step) => {
    if (timeSec >= step.at) {
      value = step.value;
    }
  });
  return value;
};

const measureTextWidth = (text: string, size: number, spec: FontSpec): number => {
  if (!text) {
    return 0;
  }
  const letterSpacing = spec.letterSpacing ?? 0;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const style = spec.style ? `${spec.style} ` : "";
      const weight = spec.weight ? `${spec.weight} ` : "";
      ctx.font = `${style}${weight}${size}px ${spec.family}`;
      const measured = ctx.measureText(text).width;
      return measured + letterSpacing * Math.max(0, text.length - 1);
    }
  }

  const family = spec.family.toLowerCase();
  const base = family.includes("bebas")
    ? 0.52
    : family.includes("great vibes")
      ? 0.5
      : family.includes("playfair")
        ? 0.62
        : family.includes("dm serif")
          ? 0.56
          : 0.58;
  return text.length * size * base + letterSpacing * Math.max(0, text.length - 1);
};

const measureWord = (
  text: string,
  baseSize: number,
  maxWidth: number,
  minScale: number,
  spec: FontSpec
): MeasuredWord => {
  const normalized = text || "";
  const minSize = baseSize * minScale;
  const rawWidth = measureTextWidth(normalized, baseSize, spec);
  const fittedSize = rawWidth > maxWidth ? Math.max(minSize, Math.floor(baseSize * (maxWidth / rawWidth))) : baseSize;
  const width = measureTextWidth(normalized, fittedSize, spec);
  const charX: number[] = [];
  for (let index = 0; index < normalized.length; index += 1) {
    const before = normalized.slice(0, index);
    charX.push(measureTextWidth(before, fittedSize, spec));
  }
  return {
    text: normalized,
    width,
    charX,
    fontSize: fittedSize
  };
};

const createTextBounds = ({
  measured,
  x,
  y,
  baseline = "alphabetic",
  padX = Math.max(20, measured.fontSize * 0.08),
  padTop = Math.max(18, measured.fontSize * 0.1),
  padBottom = Math.max(12, measured.fontSize * 0.08)
}: {
  measured: MeasuredWord;
  x: number;
  y: number;
  baseline?: "alphabetic" | "middle";
  padX?: number;
  padTop?: number;
  padBottom?: number;
}): ProgramBounds => {
  const ascent = baseline === "middle" ? measured.fontSize * 0.58 : measured.fontSize * 0.84;
  const descent = baseline === "middle" ? measured.fontSize * 0.42 : measured.fontSize * 0.22;
  return {
    minX: x - padX,
    maxX: x + measured.width + padX,
    minY: y - ascent - padTop,
    maxY: y + descent + padBottom
  };
};

const mergeProgramBounds = (...bounds: Array<ProgramBounds | null>): ProgramBounds | null => {
  const valid = bounds.filter((bound): bound is ProgramBounds => bound !== null);
  if (valid.length === 0) {
    return null;
  }
  return valid.slice(1).reduce<ProgramBounds>((acc, bound) => ({
    minX: Math.min(acc.minX, bound.minX),
    maxX: Math.max(acc.maxX, bound.maxX),
    minY: Math.min(acc.minY, bound.minY),
    maxY: Math.max(acc.maxY, bound.maxY)
  }), valid[0]);
};

const scaleBoundsAroundOrigin = ({
  bounds,
  scale,
  originX,
  originY
}: {
  bounds: ProgramBounds;
  scale: number;
  originX: number;
  originY: number;
}): ProgramBounds => {
  return {
    minX: originX + (bounds.minX - originX) * scale,
    maxX: originX + (bounds.maxX - originX) * scale,
    minY: originY + (bounds.minY - originY) * scale,
    maxY: originY + (bounds.maxY - originY) * scale
  };
};

const getProgramSafeTransform = (
  bounds: ProgramBounds | null,
  frameConfig: SvgFrameConfig
): ProgramTransform => {
  if (!bounds) {
    return {
      scale: 1,
      translateX: 0,
      translateY: 0
    };
  }

  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const safeWidth = frameConfig.safeBox.maxX - frameConfig.safeBox.minX;
  const safeHeight = frameConfig.safeBox.maxY - frameConfig.safeBox.minY;
  const scale = Math.max(
    SVG_MIN_PROGRAM_SCALE,
    Math.min(1, safeWidth / width, safeHeight / height)
  );
  const scaledBounds = scaleBoundsAroundOrigin({
    bounds,
    scale,
    originX: frameConfig.transformOrigin.x,
    originY: frameConfig.transformOrigin.y
  });

  let translateX = 0;
  if (scaledBounds.minX < frameConfig.safeBox.minX) {
    translateX = frameConfig.safeBox.minX - scaledBounds.minX;
  } else if (scaledBounds.maxX > frameConfig.safeBox.maxX) {
    translateX = frameConfig.safeBox.maxX - scaledBounds.maxX;
  }

  let translateY = 0;
  if (scaledBounds.minY < frameConfig.safeBox.minY) {
    translateY = frameConfig.safeBox.minY - scaledBounds.minY;
  } else if (scaledBounds.maxY > frameConfig.safeBox.maxY) {
    translateY = frameConfig.safeBox.maxY - scaledBounds.maxY;
  }

  return {
    scale,
    translateX,
    translateY
  };
};

const familyByVariantId: Record<string, SvgEffectFamily> = {
  cinematic_text_preset: "chromatic-reveal",
  cinematic_text_preset_1: "char-stagger",
  cinematic_text_preset_2: "script-plus-bold",
  cinematic_text_preset_3: "slit-reveal",
  cinematic_text_preset_4: "dual-wipe",
  cinematic_text_preset_5: "split-impact",
  cinematic_text_preset_6: "char-drop-pair",
  cinematic_text_preset_7: "script-big-small-blur",
  cinematic_text_preset_8: "script-big-small-elastic",
  cinematic_text_preset_9: "script-plus-fog",
  cinematic_text_preset_10: "triple-script-plus-bold",
  cinematic_text_preset_11: "cursor-sweep"
};

export const resolveSvgEffectFamily = (variant: SvgTypographyVariant): SvgEffectFamily => {
  return familyByVariantId[variant.id] ?? "char-stagger";
};

export const computeSvgMotionState = ({
  variant,
  entryProgress,
  exitProgress,
  slotIndex,
  charIndex
}: {
  variant: SvgTypographyVariant;
  entryProgress: number;
  exitProgress: number;
  slotIndex: number;
  charIndex: number;
}): SvgMotionState => {
  const family = resolveSvgEffectFamily(variant);
  const inP = clamp01(entryProgress);
  const outP = clamp01(exitProgress);
  const slotBias = slotIndex * 0.07;
  const charBias = charIndex * 0.05;

  if (family === "split-impact") {
    const side = slotIndex === 2 ? 1 : -1;
    return {
      opacity: clamp01(inP * (1 - outP)),
      translateX: lerp(side * 200, 0, resolveEase("power4.out", inP + charBias * 0.65)),
      translateY: lerp(0, 5, resolveEase("power2.out", outP)),
      scale: lerp(0.95, 1, resolveEase("power3.out", inP)),
      blur: lerp(5, 0, resolveEase("power3.out", inP)),
      clipProgress: 1
    };
  }

  if (family === "cursor-sweep") {
    return {
      opacity: clamp01(1 - outP),
      translateX: 0,
      translateY: 0,
      scale: 1,
      blur: lerp(4, 0, resolveEase("power3.out", inP)),
      clipProgress: clamp01(inP)
    };
  }

  return {
    opacity: clamp01(inP * (1 - outP)),
    translateX: 0,
    translateY: lerp(18 + slotBias * 6 + charBias * 10, 0, resolveEase("power4.out", inP)),
    scale: lerp(0.975, 1, resolveEase("power4.out", inP)),
    blur: lerp(5.2, 0, resolveEase("power3.out", inP)),
    clipProgress: clamp01(inP)
  };
};

const getChunkWords = (chunk: CaptionChunk): string[] => {
  if (!shouldRenderOverlayText(chunk.text)) {
    return [];
  }

  const fromWords = chunk.words
    .map((word) => sanitizeRenderableOverlayText(word.text))
    .filter(Boolean);
  if (fromWords.length > 0) {
    return fromWords;
  }
  return chunk.text
    .split(/\s+/)
    .map((word) => sanitizeRenderableOverlayText(word))
    .filter(Boolean);
};

const msToFrame = (ms: number, fps: number): number => Math.round((ms / 1000) * fps);

const chunkVisibleAtFrame = (chunk: CaptionChunk, frame: number, fps: number): boolean => {
  const start = msToFrame(chunk.startMs, fps);
  const end = msToFrame(chunk.endMs, fps);
  return frame >= start && frame <= end + 2;
};

const getVariantForChunk = (chunk: CaptionChunk): SvgTypographyVariant | null => {
  return getSvgTypographyVariantFromStyleKey(chunk.styleKey);
};

const wordOpacityRamp = (timeSec: number, startSec: number, durSec: number, ease: EasingToken = "power3.out"): number => {
  if (timeSec <= startSec) {
    return 0;
  }
  if (durSec <= 0) {
    return 1;
  }
  const progress = clamp01((timeSec - startSec) / durSec);
  return resolveEase(ease, progress);
};

const getExitFade = (timeSec: number, chunkDurationSec: number): number => {
  const exitLead = 0.18;
  const start = Math.max(0, chunkDurationSec - exitLead);
  if (timeSec <= start) {
    return 1;
  }
  return 1 - clamp01((timeSec - start) / exitLead);
};

const cursiveStyle = {family: "'Great Vibes', cursive", weight: "400"} as const;
const bebasStyle = {family: "'Bebas Neue', sans-serif", weight: "400"} as const;
const playfairStyle = {family: "'Playfair Display', serif", weight: "900"} as const;
const dmSansStyle = {family: "'DM Sans', sans-serif", weight: "700"} as const;
const dmSerifStyle = {family: "'DM Serif Display', serif", weight: "400", style: "italic"} as const;

const baseSvgStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  overflow: "visible"
};

const overlayContainerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 9,
  pointerEvents: "none"
};

const transparentBackdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0
};

type ProgramRenderContext = {
  variant: SvgTypographyVariant;
  chunk: CaptionChunk;
  words: string[];
  slots: Record<string, string>;
  localSec: number;
  chunkDurationSec: number;
};

type ProgramRenderer = (ctx: ProgramRenderContext) => React.ReactElement;

const toSafeId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, "_");

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const textShadowForGlow = (amount: number): string => {
  if (amount <= 0) {
    return "none";
  }
  const a = clamp01(amount);
  const core = 4 + a * 8;
  const wide = 10 + a * 20;
  return `0 0 ${core}px rgba(255,255,255,${(0.34 + a * 0.28).toFixed(3)}), 0 0 ${wide}px rgba(175,205,255,${(0.14 + a * 0.18).toFixed(3)})`;
};

const toChunkProgress = (chunk: CaptionChunk, frame: number, fps: number): {localSec: number; chunkDurationSec: number} => {
  const startFrame = msToFrame(chunk.startMs, fps);
  const endFrame = msToFrame(chunk.endMs, fps);
  const localFrames = Math.max(0, frame - startFrame);
  const durationFrames = Math.max(1, endFrame - startFrame);
  return {
    localSec: localFrames / fps,
    chunkDurationSec: durationFrames / fps
  };
};

const getFastestCompatibleVariant = ({
  slotSchema,
  intent,
  excludeIds = []
}: {
  slotSchema: SvgTypographyVariant["slotSchema"];
  intent: NonNullable<CaptionChunk["semantic"]>["intent"];
  excludeIds?: string[];
}): SvgTypographyVariant | null => {
  const candidates = getSvgVariantsForSlotSchema(slotSchema)
    .filter((candidate) => !excludeIds.includes(candidate.id))
    .filter((candidate) => candidate.compatibility.intents.includes(intent));

  const pool = candidates.length > 0
    ? candidates
    : getSvgVariantsForSlotSchema(slotSchema).filter((candidate) => !excludeIds.includes(candidate.id));

  if (pool.length === 0) {
    return null;
  }

  return [...pool].sort((a, b) => a.timingProfile.total_seconds - b.timingProfile.total_seconds)[0] ?? null;
};

const resolveRenderableVariant = ({
  chunk,
  variant,
  allowTypingCursor
}: {
  chunk: CaptionChunk;
  variant: SvgTypographyVariant;
  allowTypingCursor: boolean;
}): SvgTypographyVariant => {
  const intent = chunk.semantic?.intent ?? "default";
  const chunkDurationSec = Math.max(0.2, (chunk.endMs - chunk.startMs) / 1000);

  if (variant.id === TYPING_CURSOR_VARIANT_ID && !allowTypingCursor) {
    return (
      getFastestCompatibleVariant({
        slotSchema: variant.slotSchema,
        intent,
        excludeIds: [TYPING_CURSOR_VARIANT_ID]
      }) ?? variant
    );
  }

  const requiredScale = variant.timingProfile.total_seconds / Math.max(0.55, chunkDurationSec);
  if (requiredScale <= MAX_ADAPTIVE_TIME_SCALE) {
    return variant;
  }

  return (
    getFastestCompatibleVariant({
      slotSchema: variant.slotSchema,
      intent,
      excludeIds: variant.id === TYPING_CURSOR_VARIANT_ID ? [TYPING_CURSOR_VARIANT_ID] : []
    }) ?? variant
  );
};

const adaptProgramTiming = ({
  localSec,
  chunkDurationSec,
  variant
}: {
  localSec: number;
  chunkDurationSec: number;
  variant: SvgTypographyVariant;
}): {localSec: number; chunkDurationSec: number} => {
  const availableSec = Math.max(0.55, chunkDurationSec);
  const requiredScale = variant.timingProfile.total_seconds / availableSec;
  const timeScale = Math.min(MAX_ADAPTIVE_TIME_SCALE, Math.max(1, requiredScale));

  return {
    localSec: localSec * timeScale,
    chunkDurationSec: chunkDurationSec * timeScale
  };
};

const getSlotText = (slots: Record<string, string>, key: string, fallback: string): string => {
  const value = slots[key];
  if (value && value.trim().length > 0) {
    return value;
  }
  return fallback;
};

const buildPrimaryWord = (ctx: ProgramRenderContext, baseSize: number, maxWidthRatio: number, style: FontSpec): MeasuredWord => {
  const primary = getSlotText(ctx.slots, "primary", ctx.words.join(" ") || "KNOW");
  return measureWord(primary.toUpperCase(), baseSize, VIEWBOX_W * maxWidthRatio, DEFAULT_MIN_SCALE, style);
};

const toTextAnchorX = (measured: MeasuredWord): number => (VIEWBOX_W - measured.width) / 2;

const renderSingleChromaticProgram: ProgramRenderer = (ctx) => {
  const measured = buildPrimaryWord(ctx, 500, 0.86, bebasStyle);
  const mainX = VIEWBOX_W / 2;
  const mainY = 490;

  const bracketTl = wordOpacityRamp(ctx.localSec, 0, 0.3, "back.out(3)");
  const bracketBr = wordOpacityRamp(ctx.localSec, 0.07, 0.3, "back.out(3)");
  const bracketTr = wordOpacityRamp(ctx.localSec, 0.14, 0.3, "back.out(3)");
  const bracketBl = wordOpacityRamp(ctx.localSec, 0.2, 0.3, "back.out(3)");
  const sweepOpacity = sampleNumberTimeline(ctx.localSec, 0, [
    {at: 0.38, duration: 0.03, from: 0, to: 1, ease: "linear"},
    {at: 0.75, duration: 0.22, from: 1, to: 0, ease: "power2.out"}
  ]);
  const sweepX2 = sampleNumberTimeline(ctx.localSec, 0, [{at: 0.38, duration: 0.4, from: 0, to: 1000, ease: "power4.out"}]);
  const mainOpacity = wordOpacityRamp(ctx.localSec, 0.4, 0.01, "linear");
  const mainYShift = sampleNumberTimeline(ctx.localSec, 12, [{at: 0.4, duration: 0.7, from: 12, to: 0, ease: "power3.out"}]);
  const ghostOpacity = sampleNumberTimeline(ctx.localSec, 0, [
    {at: 0.42, duration: 0.06, from: 0, to: 0.95, ease: "linear"},
    {at: 0.55, duration: 0.6, from: 0.95, to: 0, ease: "power2.out"}
  ]);
  const ghostRX = sampleNumberTimeline(ctx.localSec, -16, [{at: 0.55, duration: 0.6, from: -16, to: -4, ease: "power2.out"}]);
  const ghostBX = sampleNumberTimeline(ctx.localSec, 16, [{at: 0.55, duration: 0.6, from: 16, to: 4, ease: "power2.out"}]);
  const exitFade = getExitFade(ctx.localSec, ctx.chunkDurationSec);

  return (
    <svg style={baseSvgStyle} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet">
      <g opacity={exitFade}>
        <text
          x={mainX + ghostRX}
          y={mainY}
          fill="rgba(255,70,70,0.55)"
          fontFamily={bebasStyle.family}
          fontSize={measured.fontSize}
          textAnchor="middle"
          dominantBaseline="middle"
          opacity={ghostOpacity}
          style={{textShadow: textShadowForGlow(0.4)}}
        >
          {measured.text}
        </text>
        <text
          x={mainX + ghostBX}
          y={mainY}
          fill="rgba(70,130,255,0.55)"
          fontFamily={bebasStyle.family}
          fontSize={measured.fontSize}
          textAnchor="middle"
          dominantBaseline="middle"
          opacity={ghostOpacity}
          style={{textShadow: textShadowForGlow(0.4)}}
        >
          {measured.text}
        </text>
        <text
          x={mainX}
          y={mainY + mainYShift}
          fill="#fff"
          fontFamily={bebasStyle.family}
          fontSize={measured.fontSize}
          textAnchor="middle"
          dominantBaseline="middle"
          opacity={mainOpacity}
          style={{textShadow: textShadowForGlow(1)}}
        >
          {measured.text}
        </text>
        <line
          x1={0}
          y1={mainY}
          x2={sweepX2}
          y2={mainY}
          stroke="rgba(255,255,255,0.92)"
          strokeWidth={2.5}
          opacity={sweepOpacity}
        />
        <g opacity={bracketTl} stroke="rgba(255,255,255,0.4)" strokeWidth={2.5} fill="none">
          <polyline points="55,55 55,115 115,115" />
        </g>
        <g opacity={bracketBr} stroke="rgba(255,255,255,0.4)" strokeWidth={2.5} fill="none">
          <polyline points="945,945 945,885 885,885" />
        </g>
        <g opacity={bracketTr} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} fill="none">
          <polyline points="945,55 945,115 885,115" />
        </g>
        <g opacity={bracketBl} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} fill="none">
          <polyline points="55,945 55,885 115,885" />
        </g>
      </g>
    </svg>
  );
};

const renderSingleStaggerProgram: ProgramRenderer = (ctx) => {
  const measured = buildPrimaryWord(ctx, 320, 0.86, bebasStyle);
  const xStart = toTextAnchorX(measured);
  const y = 660;
  const stagger = 0.12;
  const charDur = 1.18;
  const endT = (Math.max(1, measured.text.length) - 1) * stagger + charDur;
  const glowProgress = wordOpacityRamp(ctx.localSec, endT, 0.01, "linear");
  const exitFade = getExitFade(ctx.localSec, ctx.chunkDurationSec);

  return (
    <svg style={baseSvgStyle} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet">
      <g opacity={exitFade}>
        {measured.text.split("").map((char, index) => {
          const start = index * stagger;
          const opacity = wordOpacityRamp(ctx.localSec, start, charDur, "power3.out");
          const yOffset = sampleNumberTimeline(ctx.localSec, 16, [{at: start, duration: charDur, from: 16, to: 0, ease: "power4.out"}]);
          const blur = sampleNumberTimeline(ctx.localSec, 5.2, [{at: start, duration: charDur, from: 5.2, to: 0, ease: "power3.out"}]);
          return (
            <text
              key={`${ctx.chunk.id}-${index}`}
              x={xStart + measured.charX[index]}
              y={y + yOffset}
              fill="#fff"
              fontFamily={bebasStyle.family}
              fontSize={measured.fontSize}
              opacity={opacity}
              style={{
                filter: `blur(${blur.toFixed(2)}px)`,
                textShadow: textShadowForGlow(glowProgress)
              }}
            >
              {char}
            </text>
          );
        })}
      </g>
    </svg>
  );
};

const renderScriptPlusBoldProgram: ProgramRenderer = (ctx) => {
  const scriptText = getSlotText(ctx.slots, "script", ctx.words[0] ?? "designer");
  const primaryText = getSlotText(ctx.slots, "primary", ctx.words.slice(1).join(" ") || "portfolio");
  const script = measureWord(scriptText, 175, VIEWBOX_W * 0.72, DEFAULT_MIN_SCALE, cursiveStyle);
  const primary = measureWord(primaryText.toUpperCase(), 260, VIEWBOX_W * 0.92, DEFAULT_MIN_SCALE, bebasStyle);
  const scriptX = toTextAnchorX(script) - script.width * 0.08;
  const primaryX = toTextAnchorX(primary);
  const scriptY = 430;
  const primaryY = 640;
  const scriptOpacity = wordOpacityRamp(ctx.localSec, 0, 1.15, "power4.out");
  const scriptXOffset = sampleNumberTimeline(ctx.localSec, -24, [{at: 0, duration: 1.15, from: -24, to: 0, ease: "power4.out"}]);
  const scriptBlur = sampleNumberTimeline(ctx.localSec, 7.2, [{at: 0, duration: 1.15, from: 7.2, to: 0, ease: "power3.out"}]);
  const charDur = 1.12;
  const stagger = 0.1;
  const endT = 0.25 + (Math.max(1, primary.text.length) - 1) * stagger + charDur;
  const glow = wordOpacityRamp(ctx.localSec, endT, 0.01, "linear");
  const exitFade = getExitFade(ctx.localSec, ctx.chunkDurationSec);

  return (
    <svg style={baseSvgStyle} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet">
      <g opacity={exitFade}>
        <text
          x={scriptX + scriptXOffset}
          y={scriptY}
          fill="rgba(255,255,255,0.82)"
          fontFamily={cursiveStyle.family}
          fontSize={script.fontSize}
          opacity={scriptOpacity}
          style={{filter: `blur(${scriptBlur.toFixed(2)}px)`}}
        >
          {script.text}
        </text>
        {primary.text.split("").map((char, index) => {
          const start = 0.25 + index * stagger;
          const opacity = wordOpacityRamp(ctx.localSec, start, charDur, "power3.out");
          const yOffset = sampleNumberTimeline(ctx.localSec, 14, [{at: start, duration: charDur, from: 14, to: 0, ease: "power4.out"}]);
          const blur = sampleNumberTimeline(ctx.localSec, 5.2, [{at: start, duration: charDur, from: 5.2, to: 0, ease: "power3.out"}]);
          return (
            <text
              key={`${ctx.chunk.id}-p2-${index}`}
              x={primaryX + primary.charX[index]}
              y={primaryY + yOffset}
              fill="#fff"
              fontFamily={bebasStyle.family}
              fontSize={primary.fontSize}
              opacity={opacity}
              style={{
                filter: `blur(${blur.toFixed(2)}px)`,
                textShadow: textShadowForGlow(glow)
              }}
            >
              {char}
            </text>
          );
        })}
      </g>
    </svg>
  );
};

const renderSlitRevealProgram: ProgramRenderer = (ctx) => {
  const prefix = `svg-${toSafeId(ctx.chunk.id)}-p3`;
  const scriptText = getSlotText(ctx.slots, "script", ctx.words[0] ?? "designer");
  const primaryText = getSlotText(ctx.slots, "primary", ctx.words.slice(1).join(" ") || "portfolio");
  const script = measureWord(scriptText, 140, VIEWBOX_W * 0.68, DEFAULT_MIN_SCALE, cursiveStyle);
  const primary = measureWord(primaryText.toUpperCase(), 200, VIEWBOX_W * 0.92, DEFAULT_MIN_SCALE, bebasStyle);
  const primaryX = toTextAnchorX(primary);
  const scriptX = toTextAnchorX(script) - script.width * 0.06;
  const slitHeight = sampleNumberTimeline(ctx.localSec, 0, [{at: 0, duration: 0.55, from: 0, to: 190, ease: "power4.inOut"}]);
  const primaryOpacity = wordOpacityRamp(ctx.localSec, 0.1, 0.8, "power3.out");
  const primaryYOffset = sampleNumberTimeline(ctx.localSec, 60, [{at: 0.1, duration: 0.8, from: 60, to: 0, ease: "power3.out"}]);
  const boldGlow = wordOpacityRamp(ctx.localSec, 0.85, 0.01, "linear");
  const beamOpacity = sampleNumberTimeline(ctx.localSec, 0, [
    {at: 0.5, duration: 0.05, from: 0, to: 1, ease: "linear"},
    {at: 1.1, duration: 0.15, from: 1, to: 0, ease: "power2.out"}
  ]);
  const beamX = sampleNumberTimeline(ctx.localSec, -200, [{at: 0.5, duration: 0.65, from: -200, to: 1200, ease: "power2.in"}]);
  const lineOpacity = wordOpacityRamp(ctx.localSec, 0.75, 0.1, "linear");
  const leftX1 = sampleNumberTimeline(ctx.localSec, 500, [{at: 0.75, duration: 0.5, from: 500, to: 30, ease: "power2.out"}]);
  const rightX2 = sampleNumberTimeline(ctx.localSec, 500, [{at: 0.75, duration: 0.5, from: 500, to: 970, ease: "power2.out"}]);
  const strokeVisible = wordOpacityRamp(ctx.localSec, 0.9, 0.01, "linear");
  const fillOpacity = sampleNumberTimeline(ctx.localSec, 0, [{at: 1.6, duration: 0.6, from: 0, to: 1, ease: "power2.out"}]);
  const strokeFade = sampleNumberTimeline(ctx.localSec, 1, [{at: 1.9, duration: 0.4, from: 1, to: 0, ease: "power2.out"}]);
  const scriptGlow = wordOpacityRamp(ctx.localSec, 2.1, 0.01, "linear");
  const exitFade = getExitFade(ctx.localSec, ctx.chunkDurationSec);

  return (
    <svg style={baseSvgStyle} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${prefix}-sweep-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="50%" stopColor="#fff" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g opacity={exitFade}>
        <text
          x={primaryX}
          y={620 + primaryYOffset}
          fill="#fff"
          fontFamily={bebasStyle.family}
          fontSize={primary.fontSize}
          opacity={primaryOpacity}
          style={{textShadow: textShadowForGlow(boldGlow)}}
        >
          {primary.text}
        </text>
        <rect
          x={beamX}
          y={460 - slitHeight * 0.03}
          width={200}
          height={220 + slitHeight * 0.08}
          opacity={beamOpacity}
          fill={`url(#${prefix}-sweep-grad)`}
        />
        <line x1={leftX1} y1={645} x2={500} y2={645} opacity={lineOpacity} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
        <line x1={500} y1={645} x2={rightX2} y2={645} opacity={lineOpacity} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
        <text
          x={scriptX}
          y={420}
          fill="rgba(255,255,255,0.75)"
          fontFamily={cursiveStyle.family}
          fontSize={script.fontSize}
          opacity={fillOpacity}
          style={{textShadow: textShadowForGlow(scriptGlow)}}
        >
          {script.text}
        </text>
        <text
          x={scriptX}
          y={420}
          fill="none"
          stroke="#fff"
          strokeWidth={1.5}
          fontFamily={cursiveStyle.family}
          fontSize={script.fontSize}
          opacity={strokeVisible * strokeFade}
        >
          {script.text}
        </text>
      </g>
    </svg>
  );
};

type PairLayout = {
  script: MeasuredWord;
  primary: MeasuredWord;
  secondary: MeasuredWord;
  primaryX: number;
  secondaryX: number;
  scriptX: number;
};

const buildPairLayout = (ctx: ProgramRenderContext): PairLayout => {
  const scriptText = getSlotText(ctx.slots, "script", ctx.words[0] ?? "but");
  const leftText = getSlotText(ctx.slots, "primary", ctx.words[1] ?? "WHO");
  const rightText = getSlotText(ctx.slots, "secondary", ctx.words.slice(2).join(" ") || "CARES");
  const script = measureWord(scriptText, 130, VIEWBOX_W * 0.45, DEFAULT_MIN_SCALE, cursiveStyle);
  const primary = measureWord(leftText.toUpperCase(), 230, VIEWBOX_W * 0.5, DEFAULT_MIN_SCALE, bebasStyle);
  const secondary = measureWord(rightText.toUpperCase(), 230, VIEWBOX_W * 0.5, DEFAULT_MIN_SCALE, bebasStyle);

  const gap = 22;
  const total = primary.width + gap + secondary.width;
  const primaryX = (VIEWBOX_W - total) / 2;
  const secondaryX = primaryX + primary.width + gap;
  const scriptX = primaryX;

  return {script, primary, secondary, primaryX, secondaryX, scriptX};
};

const renderDualWipeProgram: ProgramRenderer = (ctx) => {
  const prefix = `svg-${toSafeId(ctx.chunk.id)}-p4`;
  const pair = buildPairLayout(ctx);
  const primaryY = 660;
  const scriptY = 500;
  const primaryTop = primaryY - pair.primary.fontSize * 0.82;
  const ruleY = primaryY - pair.primary.fontSize * 0.42;
  const ruleX2 = sampleNumberTimeline(ctx.localSec, pair.primaryX, [
    {at: 0.55, duration: 0.65, from: pair.primaryX, to: pair.secondaryX + pair.secondary.width, ease: "power3.inOut"}
  ]);
  const scriptOpacity = wordOpacityRamp(ctx.localSec, 0, 0.9, "power3.out");
  const scriptXOffset = sampleNumberTimeline(ctx.localSec, -20, [{at: 0, duration: 0.9, from: -20, to: 0, ease: "power3.out"}]);
  const scriptBlur = sampleNumberTimeline(ctx.localSec, 8, [{at: 0, duration: 0.9, from: 8, to: 0, ease: "power3.out"}]);
  const primaryOpacity = wordOpacityRamp(ctx.localSec, 0.5, 0.5, "power4.inOut");
  const secondaryOpacity = wordOpacityRamp(ctx.localSec, 0.72, 0.5, "power4.inOut");
  const sweepOpacity = sampleNumberTimeline(ctx.localSec, 0, [
    {at: 0.9, duration: 0.04, from: 0, to: 1, ease: "linear"},
    {at: 1.4, duration: 0.1, from: 1, to: 0, ease: "power2.out"}
  ]);
  const sweepX = sampleNumberTimeline(ctx.localSec, -220, [{at: 0.9, duration: 0.55, from: -220, to: 1400, ease: "power2.in"}]);
  const exitFade = getExitFade(ctx.localSec, ctx.chunkDurationSec);

  return (
    <svg style={baseSvgStyle} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${prefix}-sweep`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="50%" stopColor="#fff" stopOpacity={0.75} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g opacity={exitFade}>
        <text
          x={pair.scriptX + scriptXOffset}
          y={scriptY}
          fill="#fff"
          fontFamily={cursiveStyle.family}
          fontSize={pair.script.fontSize}
          opacity={scriptOpacity}
          style={{filter: `blur(${scriptBlur.toFixed(2)}px)`}}
        >
          {pair.script.text}
        </text>
        <text
          x={pair.primaryX}
          y={primaryY}
          fill="#fff"
          fontFamily={bebasStyle.family}
          fontSize={pair.primary.fontSize}
          opacity={primaryOpacity}
          style={{textShadow: textShadowForGlow(0.9)}}
        >
          {pair.primary.text}
        </text>
        <text
          x={pair.secondaryX}
          y={primaryY}
          fill="#fff"
          fontFamily={bebasStyle.family}
          fontSize={pair.secondary.fontSize}
          opacity={secondaryOpacity}
          style={{textShadow: textShadowForGlow(0.9)}}
        >
          {pair.secondary.text}
        </text>
        <line
          x1={pair.primaryX}
          y1={ruleY}
          x2={ruleX2}
          y2={ruleY}
          stroke="#fff"
          strokeWidth={1.5}
          opacity={wordOpacityRamp(ctx.localSec, 0.55, 0.08, "linear")}
        />
        <rect
          x={sweepX}
          y={primaryTop - 20}
          width={220}
          height={pair.primary.fontSize + 60}
          opacity={sweepOpacity}
          fill={`url(#${prefix}-sweep)`}
        />
      </g>
    </svg>
  );
};

const renderSplitImpactProgram: ProgramRenderer = (ctx) => {
  const prefix = `svg-${toSafeId(ctx.chunk.id)}-p5`;
  const pair = buildPairLayout(ctx);
  const primaryY = 660;
  const scriptY = 500;
  const primaryTop = primaryY - pair.primary.fontSize * 0.82;
  const ruleY = primaryY - pair.primary.fontSize * 0.42;
  const ruleX1 = pair.primaryX;
  const ruleX2 = pair.secondaryX + pair.secondary.width;
  const ruleMid = (ruleX1 + ruleX2) / 2;
  const scriptOpacity = wordOpacityRamp(ctx.localSec, 0, 0.85, "power3.out");
  const scriptXOffset = sampleNumberTimeline(ctx.localSec, -30, [{at: 0, duration: 0.85, from: -30, to: 0, ease: "power3.out"}]);
  const scriptBlur = sampleNumberTimeline(ctx.localSec, 8, [{at: 0, duration: 0.85, from: 8, to: 0, ease: "power3.out"}]);
  const leftX = sampleNumberTimeline(ctx.localSec, -500, [
    {at: 0.4, duration: 0.65, from: -500, to: 0, ease: "power4.out"},
    {at: 1.02, duration: 0.12, from: 0, to: 6, ease: "power2.in"},
    {at: 1.14, duration: 0.25, from: 6, to: 0, ease: "power2.out"}
  ]);
  const rightX = sampleNumberTimeline(ctx.localSec, 500, [
    {at: 0.4, duration: 0.65, from: 500, to: 0, ease: "power4.out"},
    {at: 1.02, duration: 0.12, from: 0, to: -6, ease: "power2.in"},
    {at: 1.14, duration: 0.25, from: -6, to: 0, ease: "power2.out"}
  ]);
  const wordOpacity = wordOpacityRamp(ctx.localSec, 0.4, 0.65, "power4.out");
  const flash = sampleNumberTimeline(ctx.localSec, 1, [
    {at: 1.02, duration: 0.06, from: 1, to: 0.6, ease: "linear"},
    {at: 1.08, duration: 0.06, from: 0.6, to: 1, ease: "linear"}
  ]);
  const ruleLeft = sampleNumberTimeline(ctx.localSec, ruleX1, [{at: 0.85, duration: 0.45, from: ruleX1, to: ruleMid, ease: "power3.inOut"}]);
  const ruleRight = sampleNumberTimeline(ctx.localSec, ruleX1, [{at: 0.85, duration: 0.45, from: ruleX1, to: ruleMid, ease: "power3.inOut"}]);
  const sweepOpacity = sampleNumberTimeline(ctx.localSec, 0, [
    {at: 1.1, duration: 0.03, from: 0, to: 1, ease: "linear"},
    {at: 1.55, duration: 0.1, from: 1, to: 0, ease: "power2.out"}
  ]);
  const sweepX = sampleNumberTimeline(ctx.localSec, -220, [{at: 1.1, duration: 0.5, from: -220, to: 1400, ease: "power2.in"}]);
  const exitFade = getExitFade(ctx.localSec, ctx.chunkDurationSec);

  return (
    <svg style={baseSvgStyle} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${prefix}-sweep`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="50%" stopColor="#fff" stopOpacity={0.75} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g opacity={exitFade}>
        <text
          x={pair.scriptX + scriptXOffset}
          y={scriptY}
          fill="#fff"
          fontFamily={cursiveStyle.family}
          fontSize={pair.script.fontSize}
          opacity={scriptOpacity}
          style={{filter: `blur(${scriptBlur.toFixed(2)}px)`}}
        >
          {pair.script.text}
        </text>
        <text
          x={pair.primaryX + leftX}
          y={primaryY}
          fill="#fff"
          fontFamily={bebasStyle.family}
          fontSize={pair.primary.fontSize}
          opacity={wordOpacity * flash}
          style={{textShadow: textShadowForGlow(1)}}
        >
          {pair.primary.text}
        </text>
        <text
          x={pair.secondaryX + rightX}
          y={primaryY}
          fill="#fff"
          fontFamily={bebasStyle.family}
          fontSize={pair.secondary.fontSize}
          opacity={wordOpacity * flash}
          style={{textShadow: textShadowForGlow(1)}}
        >
          {pair.secondary.text}
        </text>
        <line
          x1={ruleLeft}
          y1={ruleY}
          x2={ctx.localSec > 1.31 ? ruleX2 : ruleRight}
          y2={ruleY}
          stroke="#fff"
          strokeWidth={1.5}
          opacity={wordOpacityRamp(ctx.localSec, 0.85, 0.08, "linear")}
        />
        <rect
          x={sweepX}
          y={primaryTop - 20}
          width={220}
          height={pair.primary.fontSize + 60}
          opacity={sweepOpacity}
          fill={`url(#${prefix}-sweep)`}
        />
      </g>
    </svg>
  );
};

const renderCharDropPairProgram: ProgramRenderer = (ctx) => {
  const pair = buildPairLayout(ctx);
  const primaryY = 660;
  const scriptY = 480;
  const scriptOpacity = wordOpacityRamp(ctx.localSec, 0, 1, "power3.out");
  const scriptYOffset = sampleNumberTimeline(ctx.localSec, -18, [{at: 0, duration: 1, from: -18, to: 0, ease: "power3.out"}]);
  const scriptBlur = sampleNumberTimeline(ctx.localSec, 6, [{at: 0, duration: 1, from: 6, to: 0, ease: "power3.out"}]);
  const whoChars = pair.primary.text.split("");
  const caresChars = pair.secondary.text.split("");
  const caresStart = 0.55 + whoChars.length * 0.09 + 0.05;
  const exitFade = getExitFade(ctx.localSec, ctx.chunkDurationSec);

  return (
    <svg style={baseSvgStyle} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet">
      <g opacity={exitFade}>
        <text
          x={pair.scriptX}
          y={scriptY + scriptYOffset}
          fill="#fff"
          fontFamily={cursiveStyle.family}
          fontSize={pair.script.fontSize}
          opacity={scriptOpacity}
          style={{filter: `blur(${scriptBlur.toFixed(2)}px)`}}
        >
          {pair.script.text}
        </text>
        {whoChars.map((char, index) => {
          const start = 0.55 + index * 0.09;
          const opacity = wordOpacityRamp(ctx.localSec, start, 0.75, "power4.out");
          const yOffset = sampleNumberTimeline(ctx.localSec, -40, [{at: start, duration: 0.75, from: -40, to: 0, ease: "power4.out"}]);
          return (
            <text
              key={`${ctx.chunk.id}-p6-a-${index}`}
              x={pair.primaryX + pair.primary.charX[index]}
              y={primaryY + yOffset}
              fill="#fff"
              fontFamily={bebasStyle.family}
              fontSize={pair.primary.fontSize}
              opacity={opacity}
              style={{textShadow: textShadowForGlow(0.8)}}
            >
              {char}
            </text>
          );
        })}
        {caresChars.map((char, index) => {
          const start = caresStart + index * 0.09;
          const opacity = wordOpacityRamp(ctx.localSec, start, 0.75, "power4.out");
          const yOffset = sampleNumberTimeline(ctx.localSec, -40, [{at: start, duration: 0.75, from: -40, to: 0, ease: "power4.out"}]);
          return (
            <text
              key={`${ctx.chunk.id}-p6-b-${index}`}
              x={pair.secondaryX + pair.secondary.charX[index]}
              y={primaryY + yOffset}
              fill="#fff"
              fontFamily={bebasStyle.family}
              fontSize={pair.secondary.fontSize}
              opacity={opacity}
              style={{textShadow: textShadowForGlow(0.8)}}
            >
              {char}
            </text>
          );
        })}
      </g>
    </svg>
  );
};

type HierarchyLayout = {
  script: MeasuredWord;
  primary: MeasuredWord;
  secondary: MeasuredWord;
  scriptX: number;
  scriptY: number;
  primaryX: number;
  primaryY: number;
  secondaryX: number;
  secondaryY: number;
};

type HierarchyLayoutInput = {
  scriptText: string;
  primaryText: string;
  secondaryText: string;
};

function measureHierarchyLayout({
  scriptText,
  primaryText,
  secondaryText
}: HierarchyLayoutInput): HierarchyLayout {
  const primary = measureWord(primaryText.toUpperCase(), 240, VIEWBOX_W * 0.84, DEFAULT_MIN_SCALE, playfairStyle);
  const secondary = measureWord(secondaryText.toUpperCase(), 64, VIEWBOX_W * 0.3, DEFAULT_MIN_SCALE, bebasStyle);
  const script = measureWord(scriptText, 96, VIEWBOX_W * 0.34, DEFAULT_MIN_SCALE, cursiveStyle);
  const primaryX = toTextAnchorX(primary);
  const primaryY = 632;
  const primaryTop = primaryY - primary.fontSize * 0.84;
  const hierarchyGap = Math.max(28, Math.round(primary.fontSize * 0.1));
  const secondaryX = primaryX + Math.max(0, primary.width - secondary.width - 12);
  const secondaryY = primaryY + primary.fontSize * 0.22 + hierarchyGap + secondary.fontSize * 0.84;
  const scriptX = primaryX;
  const scriptY = primaryTop - hierarchyGap - script.fontSize * 0.22;
  return {
    script,
    primary,
    secondary,
    scriptX,
    scriptY,
    primaryX,
    primaryY,
    secondaryX,
    secondaryY
  };
}

function buildHierarchyLayout(ctx: ProgramRenderContext): HierarchyLayout {
  const scriptText = getSlotText(ctx.slots, "script", ctx.words[0] ?? "you're");
  const primaryText = getSlotText(ctx.slots, "primary", ctx.words[1] ?? "MAYBE");
  const secondaryText = getSlotText(ctx.slots, "secondary", ctx.words.slice(2).join(" ") || "GOING");
  return measureHierarchyLayout({
    scriptText,
    primaryText,
    secondaryText
  });
}

export const __svgTypographyLayoutTestUtils = {
  measureWord,
  measureHierarchyLayout
};

const renderScriptBigSmallBlurProgram: ProgramRenderer = (ctx) => {
  const layout = buildHierarchyLayout(ctx);
  const chars = layout.primary.text.split("");
  const scriptOpacity = wordOpacityRamp(ctx.localSec, 0, 1, "power3.out");
  const scriptXOffset = sampleNumberTimeline(ctx.localSec, -15, [{at: 0, duration: 1, from: -15, to: 0, ease: "power3.out"}]);
  const scriptBlur = sampleNumberTimeline(ctx.localSec, 8, [{at: 0, duration: 1, from: 8, to: 0, ease: "power3.out"}]);
  const maybeEnd = 0.3 + (Math.max(1, chars.length) - 1) * 0.1 + 0.8;
  const glow = wordOpacityRamp(ctx.localSec, maybeEnd, 0.01, "linear");
  const secondaryOpacity = wordOpacityRamp(ctx.localSec, maybeEnd + 0.1, 0.7, "power3.out") * 0.85;
  const secondaryYOffset = sampleNumberTimeline(ctx.localSec, 12, [{at: maybeEnd + 0.1, duration: 0.7, from: 12, to: 0, ease: "power3.out"}]);
  const secondaryBlur = sampleNumberTimeline(ctx.localSec, 8, [{at: maybeEnd + 0.1, duration: 0.7, from: 8, to: 0, ease: "power3.out"}]);
  const exitFade = getExitFade(ctx.localSec, ctx.chunkDurationSec);

  return (
    <svg style={baseSvgStyle} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet">
      <g opacity={exitFade}>
        <text
          x={layout.scriptX + scriptXOffset}
          y={layout.scriptY}
          fill="#fff"
          fontFamily={cursiveStyle.family}
          fontSize={layout.script.fontSize}
          opacity={scriptOpacity}
          style={{filter: `blur(${scriptBlur.toFixed(2)}px)`}}
        >
          {layout.script.text}
        </text>
        {chars.map((char, index) => {
          const start = 0.3 + index * 0.1;
          const opacity = wordOpacityRamp(ctx.localSec, start, 0.8, "power4.out");
          const yOffset = sampleNumberTimeline(ctx.localSec, -35, [{at: start, duration: 0.8, from: -35, to: 0, ease: "power4.out"}]);
          const blur = sampleNumberTimeline(ctx.localSec, 10, [{at: start, duration: 0.8, from: 10, to: 0, ease: "power3.out"}]);
          return (
            <text
              key={`${ctx.chunk.id}-p7-${index}`}
              x={layout.primaryX + layout.primary.charX[index]}
              y={layout.primaryY + yOffset}
              fill="#fff"
              fontFamily={playfairStyle.family}
              fontWeight={playfairStyle.weight}
              fontSize={layout.primary.fontSize}
              opacity={opacity}
              style={{filter: `blur(${blur.toFixed(2)}px)`, textShadow: textShadowForGlow(glow)}}
            >
              {char}
            </text>
          );
        })}
        <text
          x={layout.secondaryX}
          y={layout.secondaryY + secondaryYOffset}
          fill="#fff"
          fontFamily={bebasStyle.family}
          fontSize={layout.secondary.fontSize}
          letterSpacing={6}
          opacity={secondaryOpacity}
          style={{filter: `blur(${secondaryBlur.toFixed(2)}px)`}}
        >
          {layout.secondary.text}
        </text>
      </g>
    </svg>
  );
};

const renderScriptBigSmallElasticProgram: ProgramRenderer = (ctx) => {
  const layout = buildHierarchyLayout(ctx);
  const chars = layout.primary.text.split("");
  const scriptOpacity = wordOpacityRamp(ctx.localSec, 0, 0.65, "back.out(1.8)");
  const scriptScale = sampleNumberTimeline(ctx.localSec, 0, [{at: 0, duration: 0.65, from: 0, to: 1, ease: "back.out(1.8)"}]);
  const maybeEnd = 0.25 + (Math.max(1, chars.length) - 1) * 0.08 + 0.55;
  const groupScale = sampleNumberTimeline(ctx.localSec, 1, [
    {at: maybeEnd, duration: 0.12, from: 1, to: 1.04, ease: "power2.in"},
    {at: maybeEnd + 0.12, duration: 0.25, from: 1.04, to: 1, ease: "power2.out"}
  ]);
  const glow = wordOpacityRamp(ctx.localSec, maybeEnd + 0.1, 0.01, "linear");
  const secondaryOpacity = wordOpacityRamp(ctx.localSec, maybeEnd + 0.15, 0.45, "back.out(3)") * 0.9;
  const secondaryScale = sampleNumberTimeline(ctx.localSec, 0, [
    {at: maybeEnd + 0.15, duration: 0.45, from: 0, to: 1, ease: "back.out(3)"}
  ]);
  const exitFade = getExitFade(ctx.localSec, ctx.chunkDurationSec);

  return (
    <svg style={baseSvgStyle} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet">
      <g opacity={exitFade}>
        <text
          x={layout.scriptX}
          y={layout.scriptY}
          fill="#fff"
          fontFamily={cursiveStyle.family}
          fontSize={layout.script.fontSize}
          opacity={scriptOpacity}
          transform={`translate(${layout.scriptX}, ${layout.scriptY}) scale(${scriptScale}) translate(${-layout.scriptX}, ${-layout.scriptY})`}
          style={{transformOrigin: `${layout.scriptX}px ${layout.scriptY}px`}}
        >
          {layout.script.text}
        </text>
        {chars.map((char, index) => {
          const start = 0.25 + index * 0.08;
          const opacity = wordOpacityRamp(ctx.localSec, start, 0.55, "back.out(2.5)");
          const scale = sampleNumberTimeline(ctx.localSec, 0, [{at: start, duration: 0.55, from: 0, to: 1, ease: "back.out(2.5)"}]);
          const x = layout.primaryX + layout.primary.charX[index];
          const y = layout.primaryY;
          return (
            <text
              key={`${ctx.chunk.id}-p8-${index}`}
              x={x}
              y={y}
              fill="#fff"
              fontFamily={playfairStyle.family}
              fontWeight={playfairStyle.weight}
              fontSize={layout.primary.fontSize}
              opacity={opacity}
              transform={`translate(${x}, ${y}) scale(${scale * groupScale}, ${scale * groupScale}) translate(${-x}, ${-y})`}
              style={{textShadow: textShadowForGlow(glow)}}
            >
              {char}
            </text>
          );
        })}
        <text
          x={layout.secondaryX}
          y={layout.secondaryY}
          fill="#fff"
          fontFamily={bebasStyle.family}
          fontSize={layout.secondary.fontSize}
          letterSpacing={6}
          opacity={secondaryOpacity}
          transform={`translate(${layout.secondaryX}, ${layout.secondaryY}) scale(${secondaryScale}) translate(${-layout.secondaryX}, ${-layout.secondaryY})`}
        >
          {layout.secondary.text}
        </text>
      </g>
    </svg>
  );
};

const renderScriptFogProgram: ProgramRenderer = (ctx) => {
  const scriptText = getSlotText(ctx.slots, "script", ctx.words[0] ?? "and");
  const primaryText = getSlotText(ctx.slots, "primary", ctx.words.slice(1).join(" ") || "SOMETIMES");
  const primary = measureWord(primaryText.toUpperCase(), 220, VIEWBOX_W * 0.94, DEFAULT_MIN_SCALE, playfairStyle);
  const script = measureWord(scriptText, 105, VIEWBOX_W * 0.32, DEFAULT_MIN_SCALE, cursiveStyle);
  const primaryX = toTextAnchorX(primary);
  const primaryY = 640;
  const primaryTop = primaryY - primary.fontSize * 0.85;
  const scriptX = primaryX;
  const scriptY = primaryTop;
  const scriptOpacity = wordOpacityRamp(ctx.localSec, 0, 1.1, "power2.out");
  const scriptYOffset = sampleNumberTimeline(ctx.localSec, 10, [{at: 0, duration: 1.1, from: 10, to: 0, ease: "power2.out"}]);
  const scriptBlur = sampleNumberTimeline(ctx.localSec, 10, [{at: 0, duration: 1.1, from: 10, to: 0, ease: "power2.out"}]);
  const chars = primary.text.split("");
  const charDur = 1.2;
  const stagger = 0.11;
  const endT = 0.4 + (Math.max(1, chars.length) - 1) * stagger + charDur;
  const glow = wordOpacityRamp(ctx.localSec, endT, 0.01, "linear");
  const breatheScaleY = sampleNumberTimeline(ctx.localSec, 1, [
    {at: endT + 0.1, duration: 0.4, from: 1, to: 1.008, ease: "power1.inOut"},
    {at: endT + 0.5, duration: 0.4, from: 1.008, to: 1, ease: "power1.inOut"}
  ]);
  const exitFade = getExitFade(ctx.localSec, ctx.chunkDurationSec);

  return (
    <svg style={baseSvgStyle} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet">
      <g opacity={exitFade}>
        <text
          x={scriptX}
          y={scriptY + scriptYOffset}
          fill="#fff"
          fontFamily={cursiveStyle.family}
          fontSize={script.fontSize}
          opacity={scriptOpacity}
          style={{filter: `blur(${scriptBlur.toFixed(2)}px)`}}
        >
          {script.text}
        </text>
        {chars.map((char, index) => {
          const start = 0.4 + index * stagger;
          const opacity = wordOpacityRamp(ctx.localSec, start, charDur, "power3.out");
          const yOffset = sampleNumberTimeline(ctx.localSec, 8, [{at: start, duration: charDur, from: 8, to: 0, ease: "power3.out"}]);
          const blur = sampleNumberTimeline(ctx.localSec, 14, [{at: start, duration: charDur, from: 14, to: 0, ease: "power3.out"}]);
          const x = primaryX + primary.charX[index];
          const y = primaryY + yOffset;
          return (
            <text
              key={`${ctx.chunk.id}-p9-${index}`}
              x={x}
              y={y}
              fill="#fff"
              fontFamily={playfairStyle.family}
              fontWeight={playfairStyle.weight}
              fontSize={primary.fontSize}
              opacity={opacity}
              transform={`translate(${x}, ${y}) scale(1, ${breatheScaleY}) translate(${-x}, ${-y})`}
              style={{filter: `blur(${blur.toFixed(2)}px)`, textShadow: textShadowForGlow(glow)}}
            >
              {char}
            </text>
          );
        })}
      </g>
    </svg>
  );
};

const renderTripleScriptProgram: ProgramRenderer = (ctx) => {
  const scriptWords = [
    getSlotText(ctx.slots, "script_1", ctx.words[0] ?? "If"),
    getSlotText(ctx.slots, "script_2", ctx.words[1] ?? "you"),
    getSlotText(ctx.slots, "script_3", ctx.words[2] ?? "really")
  ];
  const primaryText = getSlotText(ctx.slots, "primary", ctx.words.slice(3).join(" ") || "WANNA");
  let scriptSize = 160;
  const gap = 22;
  const measureAt = (size: number): MeasuredWord[] => scriptWords.map((word) => measureWord(word, size, VIEWBOX_W, DEFAULT_MIN_SCALE, cursiveStyle));
  let measuredScripts = measureAt(scriptSize);
  let total = measuredScripts.reduce((acc, word, index) => acc + word.width + (index < measuredScripts.length - 1 ? gap : 0), 0);
  const target = VIEWBOX_W * 0.9;
  if (total > 0) {
    scriptSize = Math.max(scriptSize * DEFAULT_MIN_SCALE, Math.floor(scriptSize * (target / total)));
    measuredScripts = measureAt(scriptSize);
    total = measuredScripts.reduce((acc, word, index) => acc + word.width + (index < measuredScripts.length - 1 ? gap : 0), 0);
  }

  const scriptY = 530;
  const scriptXStart = (VIEWBOX_W - total) / 2;
  const scriptX = [
    scriptXStart,
    scriptXStart + measuredScripts[0].width + gap,
    scriptXStart + measuredScripts[0].width + gap + measuredScripts[1].width + gap
  ];

  const primary = measureWord(primaryText.toUpperCase(), 110, VIEWBOX_W * 0.38, DEFAULT_MIN_SCALE, bebasStyle);
  const primaryX = toTextAnchorX(primary);
  const primaryY = scriptY + measuredScripts[0].fontSize * 0.15 + 60;
  const chars = primary.text.split("");
  const scriptEnd = (measuredScripts.length - 1) * 0.22 + 1.1;
  const primaryStagger = 0.1;
  const primaryDur = 1.1;
  const endT = scriptEnd - 0.3 + (Math.max(1, chars.length) - 1) * primaryStagger + primaryDur;
  const primaryGlow = wordOpacityRamp(ctx.localSec, endT, 0.01, "linear");
  const breatheScaleY = sampleNumberTimeline(ctx.localSec, 1, [
    {at: endT + 0.1, duration: 0.35, from: 1, to: 1.01, ease: "power1.inOut"},
    {at: endT + 0.45, duration: 0.35, from: 1.01, to: 1, ease: "power1.inOut"}
  ]);
  const exitFade = getExitFade(ctx.localSec, ctx.chunkDurationSec);

  return (
    <svg style={baseSvgStyle} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet">
      <g opacity={exitFade}>
        {measuredScripts.map((word, index) => {
          const start = index * 0.22;
          const opacity = wordOpacityRamp(ctx.localSec, start, 1.1, "power2.out");
          const yOffset = sampleNumberTimeline(ctx.localSec, 14, [{at: start, duration: 1.1, from: 14, to: 0, ease: "power2.out"}]);
          const blur = sampleNumberTimeline(ctx.localSec, 14, [{at: start, duration: 1.1, from: 14, to: 0, ease: "power2.out"}]);
          const glow = wordOpacityRamp(ctx.localSec, scriptEnd, 0.01, "linear");
          return (
            <text
              key={`${ctx.chunk.id}-p10-s-${index}`}
              x={scriptX[index]}
              y={scriptY + yOffset}
              fill="#fff"
              fontFamily={cursiveStyle.family}
              fontSize={word.fontSize}
              opacity={opacity}
              style={{filter: `blur(${blur.toFixed(2)}px)`, textShadow: textShadowForGlow(glow)}}
            >
              {word.text}
            </text>
          );
        })}
        {chars.map((char, index) => {
          const start = scriptEnd - 0.3 + index * primaryStagger;
          const opacity = wordOpacityRamp(ctx.localSec, start, primaryDur, "power3.out");
          const yOffset = sampleNumberTimeline(ctx.localSec, 8, [{at: start, duration: primaryDur, from: 8, to: 0, ease: "power3.out"}]);
          const blur = sampleNumberTimeline(ctx.localSec, 14, [{at: start, duration: primaryDur, from: 14, to: 0, ease: "power3.out"}]);
          const x = primaryX + primary.charX[index];
          const y = primaryY + yOffset;
          return (
            <text
              key={`${ctx.chunk.id}-p10-p-${index}`}
              x={x}
              y={y}
              fill="#fff"
              fontFamily={bebasStyle.family}
              fontSize={primary.fontSize}
              opacity={opacity}
              transform={`translate(${x}, ${y}) scale(1, ${breatheScaleY}) translate(${-x}, ${-y})`}
              style={{filter: `blur(${blur.toFixed(2)}px)`, textShadow: textShadowForGlow(primaryGlow)}}
            >
              {char}
            </text>
          );
        })}
      </g>
    </svg>
  );
};

const getBlinkOpacity = (timeSec: number, start: number, pulseDuration: number, pulses: number): number => {
  if (timeSec < start) {
    return 1;
  }
  const fullDuration = pulseDuration * pulses * 2;
  if (timeSec > start + fullDuration) {
    return 1;
  }
  const phase = Math.floor((timeSec - start) / pulseDuration);
  return phase % 2 === 0 ? 0 : 1;
};

const getTypedCharacters = (timeSec: number, start: number, charDuration: number, text: string): number => {
  if (timeSec <= start) {
    return 0;
  }
  if (charDuration <= 0) {
    return text.length;
  }
  return Math.min(text.length, Math.floor((timeSec - start) / charDuration));
};

const getCursorColor = (chunkId: string): string => {
  const bucket = hashString(chunkId) % 10;
  if (bucket < 4) {
    return "#ffffff";
  }
  if (bucket < 7) {
    return "#111111";
  }
  return "#3b5bdb";
};

const renderCursorSweepProgram: ProgramRenderer = (ctx) => {
  const firstText = getSlotText(ctx.slots, "script", ctx.words[0] ?? "Hi");
  const secondText = getSlotText(ctx.slots, "primary", ctx.words[1] ?? "I'm");
  const thirdTextFull = getSlotText(ctx.slots, "secondary", ctx.words.slice(2).join(" ") || ctx.words[2] || "Valerio");
  const base = 90;
  const primary = measureWord(firstText, base, VIEWBOX_W, DEFAULT_MIN_SCALE, dmSansStyle);
  const secondary = measureWord(secondText, base, VIEWBOX_W, DEFAULT_MIN_SCALE, dmSerifStyle);
  const tertiary = measureWord(thirdTextFull, base, VIEWBOX_W, DEFAULT_MIN_SCALE, dmSansStyle);
  const gap = base * 0.18;
  const total = primary.width + secondary.width + tertiary.width + gap * 2;
  const fitScale = total > VIEWBOX_W * 0.92 ? (VIEWBOX_W * 0.92) / total : 1;
  const x0 = (VIEWBOX_W - total * fitScale) / 2;
  const y = 540;
  const p1End = x0 + primary.width * fitScale;
  const p2End = p1End + gap * fitScale + secondary.width * fitScale;
  const p3End = p2End + gap * fitScale + tertiary.width * fitScale;

  const typingStart = 0.16;
  const firstCharDuration = 0.07;
  const secondCharDuration = 0.075;
  const thirdCharDuration = 0.065;
  const betweenWords = 0.18;
  const firstStart = typingStart;
  const secondStart = firstStart + primary.text.length * firstCharDuration + betweenWords;
  const thirdStart = secondStart + secondary.text.length * secondCharDuration + betweenWords;

  const firstTypedChars = getTypedCharacters(ctx.localSec, firstStart, firstCharDuration, primary.text);
  const secondTypedChars = getTypedCharacters(ctx.localSec, secondStart, secondCharDuration, secondary.text);
  const thirdTypedChars = getTypedCharacters(ctx.localSec, thirdStart, thirdCharDuration, tertiary.text);

  const firstRenderedText = primary.text.slice(0, firstTypedChars);
  const secondRenderedText = secondary.text.slice(0, secondTypedChars);
  const thirdRenderedText = tertiary.text.slice(0, thirdTypedChars);

  const firstRenderedWidth = measureTextWidth(firstRenderedText, base, dmSansStyle) * fitScale;
  const secondRenderedWidth = measureTextWidth(secondRenderedText, base, dmSerifStyle) * fitScale;
  const thirdRenderedWidth = measureTextWidth(thirdRenderedText, base, dmSansStyle) * fitScale;

  let cursorX = x0;
  if (ctx.localSec >= secondStart) {
    cursorX = p1End + gap * fitScale + secondRenderedWidth;
  } else if (ctx.localSec >= firstStart) {
    cursorX = x0 + firstRenderedWidth;
  }
  if (ctx.localSec >= thirdStart) {
    cursorX = p2End + gap * fitScale + thirdRenderedWidth;
  }

  let cursorOpacity = 1;
  cursorOpacity *= getBlinkOpacity(ctx.localSec, 0, 0.12, 2);
  const tailStart = thirdStart + tertiary.text.length * thirdCharDuration + 0.12;
  cursorOpacity *= getBlinkOpacity(ctx.localSec, tailStart, 0.15, 4);
  cursorOpacity *= sampleNumberTimeline(ctx.localSec, 1, [{at: tailStart + 0.3, duration: 0.3, from: 1, to: 0, ease: "power2.out"}]);
  const exitFade = getExitFade(ctx.localSec, ctx.chunkDurationSec);
  const cursorColor = getCursorColor(ctx.chunk.id);

  return (
    <svg style={baseSvgStyle} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet">
      <g opacity={exitFade}>
        <text x={x0} y={y} fill="#111" fontFamily={dmSansStyle.family} fontWeight={700} fontSize={base * fitScale}>
          {firstRenderedText}
        </text>
        <text
          x={x0 + primary.width * fitScale + gap * fitScale}
          y={y}
          fill="#111"
          fontFamily={dmSerifStyle.family}
          fontStyle="italic"
          fontWeight={400}
          fontSize={base * fitScale}
        >
          {secondRenderedText}
        </text>
        <text
          x={x0 + (primary.width + secondary.width) * fitScale + gap * fitScale * 2}
          y={y}
          fill="#111"
          fontFamily={dmSansStyle.family}
          fontWeight={700}
          fontSize={base * fitScale}
        >
          {thirdRenderedText}
        </text>
        <rect x={cursorX} y={y - base * fitScale * 0.92} width={14 * fitScale} height={base * fitScale * 1.1} fill={cursorColor} rx={2} opacity={cursorOpacity} />
      </g>
    </svg>
  );
};

const estimatePrimaryProgramBounds = ({
  ctx,
  baseSize,
  maxWidthRatio,
  style,
  y,
  baseline = "alphabetic",
  padX,
  padTop,
  padBottom
}: {
  ctx: ProgramRenderContext;
  baseSize: number;
  maxWidthRatio: number;
  style: FontSpec;
  y: number;
  baseline?: "alphabetic" | "middle";
  padX?: number;
  padTop?: number;
  padBottom?: number;
}): ProgramBounds => {
  const measured = buildPrimaryWord(ctx, baseSize, maxWidthRatio, style);
  return createTextBounds({
    measured,
    x: toTextAnchorX(measured),
    y,
    baseline,
    padX,
    padTop,
    padBottom
  });
};

const estimateProgramBounds = (ctx: ProgramRenderContext): ProgramBounds | null => {
  switch (ctx.variant.id) {
    case "cinematic_text_preset": {
      const measured = buildPrimaryWord(ctx, 500, 0.86, bebasStyle);
      return createTextBounds({
        measured,
        x: VIEWBOX_W / 2 - measured.width / 2,
        y: 490,
        baseline: "middle",
        padX: 34,
        padTop: 32,
        padBottom: 28
      });
    }
    case "cinematic_text_preset_1":
      return estimatePrimaryProgramBounds({
        ctx,
        baseSize: 320,
        maxWidthRatio: 0.86,
        style: bebasStyle,
        y: 660,
        padX: 28,
        padTop: 28,
        padBottom: 24
      });
    case "cinematic_text_preset_2": {
      const scriptText = getSlotText(ctx.slots, "script", ctx.words[0] ?? "designer");
      const primaryText = getSlotText(ctx.slots, "primary", ctx.words.slice(1).join(" ") || "portfolio");
      const script = measureWord(scriptText, 175, VIEWBOX_W * 0.72, DEFAULT_MIN_SCALE, cursiveStyle);
      const primary = measureWord(primaryText.toUpperCase(), 260, VIEWBOX_W * 0.92, DEFAULT_MIN_SCALE, bebasStyle);
      const scriptX = toTextAnchorX(script) - script.width * 0.08;
      return mergeProgramBounds(
        createTextBounds({measured: script, x: scriptX, y: 430, padX: 26, padTop: 24, padBottom: 20}),
        createTextBounds({measured: primary, x: toTextAnchorX(primary), y: 640, padX: 30, padTop: 30, padBottom: 24})
      );
    }
    case "cinematic_text_preset_3": {
      const scriptText = getSlotText(ctx.slots, "script", ctx.words[0] ?? "designer");
      const primaryText = getSlotText(ctx.slots, "primary", ctx.words.slice(1).join(" ") || "portfolio");
      const script = measureWord(scriptText, 140, VIEWBOX_W * 0.68, DEFAULT_MIN_SCALE, cursiveStyle);
      const primary = measureWord(primaryText.toUpperCase(), 200, VIEWBOX_W * 0.92, DEFAULT_MIN_SCALE, bebasStyle);
      const scriptX = toTextAnchorX(script) - script.width * 0.06;
      return mergeProgramBounds(
        createTextBounds({measured: script, x: scriptX, y: 420, padX: 24, padTop: 24, padBottom: 20}),
        createTextBounds({measured: primary, x: toTextAnchorX(primary), y: 620, padX: 28, padTop: 30, padBottom: 24})
      );
    }
    case "cinematic_text_preset_4":
    case "cinematic_text_preset_5":
    case "cinematic_text_preset_6": {
      const pair = buildPairLayout(ctx);
      const scriptY = ctx.variant.id === "cinematic_text_preset_6" ? 480 : 500;
      return mergeProgramBounds(
        createTextBounds({measured: pair.script, x: pair.scriptX, y: scriptY, padX: 24, padTop: 22, padBottom: 18}),
        createTextBounds({measured: pair.primary, x: pair.primaryX, y: 660, padX: 28, padTop: 28, padBottom: 24}),
        createTextBounds({measured: pair.secondary, x: pair.secondaryX, y: 660, padX: 28, padTop: 28, padBottom: 24})
      );
    }
    case "cinematic_text_preset_7":
    case "cinematic_text_preset_8": {
      const layout = buildHierarchyLayout(ctx);
      return mergeProgramBounds(
        createTextBounds({measured: layout.script, x: layout.scriptX, y: layout.scriptY, padX: 24, padTop: 22, padBottom: 18}),
        createTextBounds({measured: layout.primary, x: layout.primaryX, y: layout.primaryY, padX: 30, padTop: 32, padBottom: 24}),
        createTextBounds({measured: layout.secondary, x: layout.secondaryX, y: layout.secondaryY, padX: 24, padTop: 20, padBottom: 18})
      );
    }
    case "cinematic_text_preset_9": {
      const scriptText = getSlotText(ctx.slots, "script", ctx.words[0] ?? "and");
      const primaryText = getSlotText(ctx.slots, "primary", ctx.words.slice(1).join(" ") || "SOMETIMES");
      const primary = measureWord(primaryText.toUpperCase(), 220, VIEWBOX_W * 0.94, DEFAULT_MIN_SCALE, playfairStyle);
      const script = measureWord(scriptText, 105, VIEWBOX_W * 0.32, DEFAULT_MIN_SCALE, cursiveStyle);
      const primaryX = toTextAnchorX(primary);
      return mergeProgramBounds(
        createTextBounds({measured: script, x: primaryX, y: 453, padX: 22, padTop: 20, padBottom: 16}),
        createTextBounds({measured: primary, x: primaryX, y: 640, padX: 28, padTop: 30, padBottom: 24})
      );
    }
    case "cinematic_text_preset_10": {
      const scriptWords = [
        getSlotText(ctx.slots, "script_1", ctx.words[0] ?? "If"),
        getSlotText(ctx.slots, "script_2", ctx.words[1] ?? "you"),
        getSlotText(ctx.slots, "script_3", ctx.words[2] ?? "really")
      ];
      const primaryText = getSlotText(ctx.slots, "primary", ctx.words.slice(3).join(" ") || "WANNA");
      let scriptSize = 160;
      const gap = 22;
      const measureAt = (size: number): MeasuredWord[] => scriptWords.map((word) => measureWord(word, size, VIEWBOX_W, DEFAULT_MIN_SCALE, cursiveStyle));
      let measuredScripts = measureAt(scriptSize);
      let total = measuredScripts.reduce((acc, word, index) => acc + word.width + (index < measuredScripts.length - 1 ? gap : 0), 0);
      const target = VIEWBOX_W * 0.9;
      if (total > 0) {
        scriptSize = Math.max(scriptSize * DEFAULT_MIN_SCALE, Math.floor(scriptSize * (target / total)));
        measuredScripts = measureAt(scriptSize);
        total = measuredScripts.reduce((acc, word, index) => acc + word.width + (index < measuredScripts.length - 1 ? gap : 0), 0);
      }

      const scriptY = 530;
      const scriptXStart = (VIEWBOX_W - total) / 2;
      const scriptX = [
        scriptXStart,
        scriptXStart + measuredScripts[0].width + gap,
        scriptXStart + measuredScripts[0].width + gap + measuredScripts[1].width + gap
      ];
      const primary = measureWord(primaryText.toUpperCase(), 110, VIEWBOX_W * 0.38, DEFAULT_MIN_SCALE, bebasStyle);
      const primaryX = toTextAnchorX(primary);
      const primaryY = scriptY + measuredScripts[0].fontSize * 0.15 + 60;

      return mergeProgramBounds(
        createTextBounds({measured: measuredScripts[0], x: scriptX[0], y: scriptY, padX: 22, padTop: 20, padBottom: 16}),
        createTextBounds({measured: measuredScripts[1], x: scriptX[1], y: scriptY, padX: 22, padTop: 20, padBottom: 16}),
        createTextBounds({measured: measuredScripts[2], x: scriptX[2], y: scriptY, padX: 22, padTop: 20, padBottom: 16}),
        createTextBounds({measured: primary, x: primaryX, y: primaryY, padX: 24, padTop: 24, padBottom: 20})
      );
    }
    case "cinematic_text_preset_11": {
      const firstText = getSlotText(ctx.slots, "script", ctx.words[0] ?? "Hi");
      const secondText = getSlotText(ctx.slots, "primary", ctx.words[1] ?? "I'm");
      const thirdText = getSlotText(ctx.slots, "secondary", ctx.words.slice(2).join(" ") || ctx.words[2] || "Valerio");
      const base = 90;
      const primary = measureWord(firstText, base, VIEWBOX_W, DEFAULT_MIN_SCALE, dmSansStyle);
      const secondary = measureWord(secondText, base, VIEWBOX_W, DEFAULT_MIN_SCALE, dmSerifStyle);
      const tertiary = measureWord(thirdText, base, VIEWBOX_W, DEFAULT_MIN_SCALE, dmSansStyle);
      const gap = base * 0.18;
      const total = primary.width + secondary.width + tertiary.width + gap * 2;
      const fitScale = total > VIEWBOX_W * 0.92 ? (VIEWBOX_W * 0.92) / total : 1;
      const x0 = (VIEWBOX_W - total * fitScale) / 2;
      const y = 540;
      return mergeProgramBounds(
        createTextBounds({measured: primary, x: x0, y, padX: 20, padTop: 20, padBottom: 16}),
        createTextBounds({measured: secondary, x: x0 + primary.width * fitScale + gap * fitScale, y, padX: 20, padTop: 20, padBottom: 16}),
        createTextBounds({measured: tertiary, x: x0 + (primary.width + secondary.width) * fitScale + gap * fitScale * 2, y, padX: 20, padTop: 20, padBottom: 16})
      );
    }
    default:
      return null;
  }
};

const applyProgramSafeTransform = (
  rendered: React.ReactElement,
  transform: ProgramTransform,
  chunkId: string,
  frameConfig: SvgFrameConfig
): React.ReactElement => {
  if (
    Math.abs(transform.scale - 1) < 0.001 &&
    Math.abs(transform.translateX) < 0.01 &&
    Math.abs(transform.translateY) < 0.01
  ) {
    return rendered;
  }

  const defsChildren: React.ReactNode[] = [];
  const contentChildren: React.ReactNode[] = [];
  const renderedElement = rendered as React.ReactElement<{children?: React.ReactNode}>;
  React.Children.forEach(renderedElement.props.children, (child) => {
    if (React.isValidElement(child) && child.type === "defs") {
      defsChildren.push(child);
      return;
    }
    contentChildren.push(child);
  });

  return React.cloneElement(
    renderedElement,
    renderedElement.props,
    ...defsChildren,
    (
      <g key={`${chunkId}-safe-translate`} transform={`translate(${transform.translateX} ${transform.translateY})`}>
        <g
          transform={
            `translate(${frameConfig.transformOrigin.x} ${frameConfig.transformOrigin.y}) ` +
            `scale(${transform.scale}) ` +
            `translate(${-frameConfig.transformOrigin.x} ${-frameConfig.transformOrigin.y})`
          }
        >
          {contentChildren}
        </g>
      </g>
    )
  );
};

const renderersByVariantId: Record<string, ProgramRenderer> = {
  cinematic_text_preset: renderSingleChromaticProgram,
  cinematic_text_preset_1: renderSingleStaggerProgram,
  cinematic_text_preset_2: renderScriptPlusBoldProgram,
  cinematic_text_preset_3: renderSlitRevealProgram,
  cinematic_text_preset_4: renderDualWipeProgram,
  cinematic_text_preset_5: renderSplitImpactProgram,
  cinematic_text_preset_6: renderCharDropPairProgram,
  cinematic_text_preset_7: renderScriptBigSmallBlurProgram,
  cinematic_text_preset_8: renderScriptBigSmallElasticProgram,
  cinematic_text_preset_9: renderScriptFogProgram,
  cinematic_text_preset_10: renderTripleScriptProgram,
  cinematic_text_preset_11: renderCursorSweepProgram
};

const renderChunkProgram = (ctx: ProgramRenderContext): React.ReactElement | null => {
  const renderer = renderersByVariantId[ctx.variant.id];
  if (!renderer) {
    return null;
  }
  return renderer(ctx);
};

const getSlotValuesForChunk = (words: string[], variant: SvgTypographyVariant): Record<string, string> => {
  const slotSchema = variant.slotSchema ?? getSvgSlotSchemaForWordCount(words.length);
  return mapWordsToSvgSlots(words, slotSchema);
};

export const SvgCaptionOverlay: React.FC<SvgCaptionOverlayProps> = ({
  chunks,
  captionBias = "middle",
  editorialContext
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;
  const frameConfig = useMemo(() => SVG_FRAME_CONFIGS[captionBias] ?? SVG_FRAME_CONFIGS.middle, [captionBias]);
  const typingCursorChunkId = useMemo(() => {
    return (
      chunks.find((chunk) => {
        const variant = getVariantForChunk(chunk);
        if (!variant || variant.id !== TYPING_CURSOR_VARIANT_ID) {
          return false;
        }
        return (chunk.endMs - chunk.startMs) / 1000 >= 1.2;
      })?.id ?? null
    );
  }, [chunks]);

  const visibleChunks = useMemo(() => {
    return chunks.filter((chunk) => isSvgCaptionChunk(chunk) && chunkVisibleAtFrame(chunk, frame, fps));
  }, [chunks, frame, fps]);

  return (
    <AbsoluteFill
      className="dg-svg-caption"
      style={{
        ...overlayContainerStyle,
        color: "var(--dg-svg-caption-fill, #fff)",
        ["--dg-svg-caption-fill" as string]: "#fff"
      }}
      data-animation-registry-ref="host:svg-caption-overlay"
      data-animation-tags="svg caption typography focus-target"
    >
      <div style={transparentBackdropStyle} />
      {visibleChunks.map((chunk) => {
        const editorialDecision = resolveCaptionEditorialDecision({
          chunk,
          ...editorialContext,
          currentTimeMs
        });
        const originalVariant = getVariantForChunk(chunk);
        if (!originalVariant) {
          return null;
        }
        const words = getChunkWords(chunk);
        const variant = resolveRenderableVariant({
          chunk,
          variant: originalVariant,
          allowTypingCursor: chunk.id === typingCursorChunkId
        });
        const slots = getSlotValuesForChunk(words, variant);
        const progress = toChunkProgress(chunk, frame, fps);
        const {localSec, chunkDurationSec} = adaptProgramTiming({
          localSec: progress.localSec,
          chunkDurationSec: progress.chunkDurationSec,
          variant
        });
        const rendered = renderChunkProgram({
          variant,
          chunk,
          words,
          slots,
          localSec,
          chunkDurationSec
        });
        if (!rendered) {
          return null;
        }
        const safeTransform = getProgramSafeTransform(
          estimateProgramBounds({
            variant,
            chunk,
            words,
            slots,
            localSec,
            chunkDurationSec
          }),
          frameConfig
        );
        return (
          <div
            key={chunk.id}
            style={{
              color: editorialDecision.textColor,
              ["--dg-svg-caption-fill" as string]: editorialDecision.textColor
            }}
          >
            {applyProgramSafeTransform(rendered, safeTransform, chunk.id, frameConfig)}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
