import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
// All fonts are loaded via local CSS font-face definitions in all_fonts_dynamic.css and mixfonts.css
import { renderAnimationArchetype, ALL_ARCHETYPE_FX_NAMES } from "./AnimationArchetypes";
import type {
  TypographyProfileV2,
  TypographyOcclusion,
  TypographyStaggerOffset,
  TypographySubjectZone,
  TypographyAnnotation,
  TypographyInlineTokenSwap,
  TypographyFrameTreatment,
} from "@prometheus/shared-types";


// ---------------------------------------------------------------------------
// Typography Types
// ---------------------------------------------------------------------------
export type WordTiming = {
  text: string;
  start_ms: number;
  end_ms: number;
};

export type TypographyLayer = {
  layerIndex: number;
  layerName: string;
  role: string;
  rawText: string;
  text: string;
  words?: WordTiming[];
  fontFamily: string;
  accentFont?: string;
  fontWeight: number;
  fontStyle: string;
  fontSizePx: number;
  color: string;
  casing: string;
  letterSpacingEm: number;
  lineHeight: number;
  isHero: boolean;
  fxPreset?: string;
  entryLeadMs?: number;
  effectiveEntryLeadMs?: number;
  behindSubject?: boolean;
  treatmentOverlay?: string;
  frontalTreatment?: string;
  opticalBloom?: boolean | { blurRadius?: number; opacity?: number; color?: string };
  edgeFeatherPx?: number;
  backplateShadow?: string;
  atmosphericBlend?: "screen" | "add" | "normal";
  gradient?: string;
  verticalGradient?: string;
  glow?: string;
  shadow?: string;
  textFillColor?: string;
  hasGradient?: boolean;
  doubleUnderline?: boolean;
  marginTopPx?: number;
  blendMode?: "difference" | "screen";
  isOverlapping?: boolean;
  isUnderlapping?: boolean;
  isOverlayAtop?: boolean;
  zIndex?: number;
  depthZPx?: number;
  focusPriority?: number;
  specularChamfer?: boolean;
  specularSheen?: boolean;
  specularAngle?: number;
  volumetricShading?: boolean;
  contactShadow?: string;
  ambientShadow?: string;
  opticalBleed?: string;
  fill?: {
    type?: "solid" | "linear_gradient" | "radial_gradient";
    color?: string;
    stops?: Array<{ color: string; offsetPercent: number }>;
    angleDeg?: number;
  };
  stroke?: {
    enabled?: boolean;
    color?: string;
    widthPx?: number;
    style?: "solid" | "dashed" | "dotted";
    opacity?: number;
  };
  materiality?: {
    opacity?: number;
    blendMode?: string;
    dropShadow?: { offsetX: number; offsetY: number; blur: number; color: string };
    multiShadows?: Array<{ offsetX: number; offsetY: number; blur: number; spread?: number; color: string }>;
    glow?: { radiusPx: number; color: string; intensity?: number };
    bevel?: {
      enabled?: boolean;
      depthPx?: number;
      softnessPx?: number;
      angleDeg?: number;
      highlightColor?: string;
      shadowColor?: string;
      specularAngleDeg?: number;
      specularColor?: string;
    };
  };
  occlusion?: TypographyOcclusion;
  stagger?: TypographyStaggerOffset;
  inlineTokenSwaps?: TypographyInlineTokenSwap[];
  profileV2?: TypographyProfileV2;
};

type TypographyPaintInput = Pick<TypographyLayer, "color"> & Partial<Pick<
  TypographyLayer,
  "blendMode" | "textFillColor" | "gradient" | "verticalGradient" | "glow" | "shadow" | "hasGradient" | "behindSubject" | "isHero" | "isUnderlapping" | "isOverlayAtop" | "treatmentOverlay" | "frontalTreatment" | "opticalBloom" | "edgeFeatherPx" | "backplateShadow" | "atmosphericBlend" | "specularChamfer" | "specularSheen" | "specularAngle" | "volumetricShading" | "contactShadow" | "ambientShadow" | "opticalBleed"
>>;

const isDarkColor = (colorStr?: string): boolean => {
  if (!colorStr) return false;
  const c = colorStr.trim().toLowerCase();
  if (c === "#000000" || c === "#111111" || c === "#1a1a1a" || c === "#222222" || c === "#0f172a" || c === "#1e1e1e") {
    return true;
  }
  if (c.startsWith("#")) {
    const hex = c.replace("#", "");
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 90;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 90;
    }
  }
  if (c.startsWith("rgb")) {
    const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 90;
    }
  }
  return false;
};

const isDarkGradient = (gradStr?: string): boolean => {
  if (!gradStr || gradStr === "none") return false;
  const matches = gradStr.match(/#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)/g);
  if (!matches || matches.length === 0) return false;
  return matches.every((m) => isDarkColor(m));
};

export const parseColorToRgb = (colorVal?: string): [number, number, number] | null => {
  if (!colorVal) return null;
  const raw = colorVal.trim().toLowerCase();
  if (raw === "none" || raw === "transparent") return null;
  const named: Record<string, [number, number, number]> = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    blue: [0, 0, 255],
    green: [0, 128, 0],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
  };
  if (named[raw]) return named[raw];

  if (raw.startsWith("#")) {
    let hex = raw.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split("").map((c) => c + c).join("");
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return [r, g, b];
      }
    }
    return null;
  }

  if (raw.startsWith("rgb")) {
    const match = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      return [r, g, b];
    }
  }

  return null;
};

export const deriveVolumetricGradient = (colorVal?: string, angleDeg = 180): string => {
  if (!colorVal) {
    return "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)";
  }
  const rgb = parseColorToRgb(colorVal);
  if (!rgb) {
    return "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)";
  }
  const [r, g, b] = rgb;
  if (r >= 235 && g >= 235 && b >= 235) {
    return `linear-gradient(${angleDeg}deg, #FFFFFF 0%, #FAFBFD 20%, #F1F5F9 45%, #E2E8F0 72%, #CBD5E1 100%)`;
  }

  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0").toUpperCase();

  const rim = `#${toHex(255 * 0.88 + r * 0.12)}${toHex(255 * 0.88 + g * 0.12)}${toHex(255 * 0.88 + b * 0.12)}`;
  const key = `#${toHex(255 * 0.58 + r * 0.42)}${toHex(255 * 0.58 + g * 0.42)}${toHex(255 * 0.58 + b * 0.42)}`;
  const crown = `#${toHex(255 * 0.28 + r * 0.72)}${toHex(255 * 0.28 + g * 0.72)}${toHex(255 * 0.28 + b * 0.72)}`;
  const core = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  const shadow = `#${toHex(r * 0.50)}${toHex(g * 0.50)}${toHex(b * 0.50)}`;
  const bounce = `#${toHex(r * 0.62)}${toHex(g * 0.62)}${toHex(b * 0.62)}`;

  return `linear-gradient(${angleDeg}deg, #FFFFFF 0%, ${rim} 10%, ${key} 24%, ${crown} 40%, ${core} 58%, ${shadow} 88%, ${bounce} 100%)`;
};

export const buildPhysicalLightingFilter = (options: {
  specularChamfer?: boolean;
  contactShadow?: string;
  ambientShadow?: string;
  glow?: string;
}): string => {
  const parts: string[] = [];
  if (options.specularChamfer !== false) {
    parts.push("drop-shadow(-0.8px -1.2px 0.4px rgba(255, 255, 255, 0.85))");
    parts.push("drop-shadow(1.0px 1.4px 0.5px rgba(0, 0, 0, 0.78))");
  }
  const toDropShadow = (val?: string, fallback = ""): string => {
    if (!val || val === "none") return fallback ? `drop-shadow(${fallback})` : "";
    const t = val.trim();
    if (t === "none") return "";
    if (t.startsWith("drop-shadow(")) return t;
    return `drop-shadow(${t})`;
  };
  parts.push(toDropShadow(options.contactShadow, "0 2px 10px rgba(0, 0, 0, 0.55)"));
  if (options.ambientShadow && options.ambientShadow !== "none") {
    parts.push(toDropShadow(options.ambientShadow));
  }
  if (options.glow && options.glow !== "none") {
    const g = options.glow.trim();
    if (g.startsWith("drop-shadow(")) {
      parts.push(g);
    } else if (g.startsWith("0 0")) {
      parts.push(`drop-shadow(${g})`);
    } else {
      parts.push(`drop-shadow(0 0 16px ${g})`);
    }
  }
  return parts.join(" ");
};

export const resolveTypographyPaintStyle = (layer: TypographyPaintInput): React.CSSProperties => {
  if (layer.blendMode === "difference" || (layer as any).blendMode === "exclusion") {
    if ((layer as any).knockoutVariant || (layer as any).boundaryStroke) {
      const variant = (layer as any).knockoutVariant || "difference_exclusion";
      if (variant === "frosted_glass_stencil") {
        // Frosted backdropFilter REMOVED: a blur+contrast backdrop on a text span
        // renders as a visible frosted rectangle ("invisible box") around the words.
        return {
          color: "#FFFFFF",
          backgroundImage: undefined,
          WebkitBackgroundClip: undefined,
          WebkitTextFillColor: "#FFFFFF",
          WebkitTextStroke: "0.95px rgba(255, 255, 255, 0.80)",
          textShadow: "-0.8px 0px 1.2px rgba(255, 0, 75, 0.70), 0.8px 0px 1.2px rgba(0, 225, 255, 0.70), 0 0 12px rgba(255, 255, 255, 0.45)",
          mixBlendMode: "difference",
        };
      }
      if (variant === "luma_inversion") {
        return {
          color: "#EEEEEE",
          backgroundImage: undefined,
          WebkitBackgroundClip: undefined,
          WebkitTextFillColor: "#EEEEEE",
          WebkitTextStroke: "0.80px rgba(255, 255, 255, 0.80)",
          filter: "contrast(145%) brightness(1.12)",
          textShadow: "-0.85px 0px 1px rgba(255, 0, 80, 0.65), 0.85px 0px 1px rgba(0, 220, 255, 0.65), 0 0 1px rgba(0, 0, 0, 0.90)",
          mixBlendMode: "difference",
        };
      }
      if (variant === "negative_space_cutout") {
        return {
          color: "#FFFFFF",
          backgroundImage: undefined,
          WebkitBackgroundClip: undefined,
          WebkitTextFillColor: "#FFFFFF",
          WebkitTextStroke: "1px rgba(255, 255, 255, 0.90)",
          textShadow: "-0.9px 0px 1.2px rgba(255, 0, 75, 0.80), 0.9px 0px 1.2px rgba(0, 225, 255, 0.80), 0 0 2px rgba(255, 255, 255, 0.95)",
          mixBlendMode: "difference",
        };
      }
      // Default Difference / Exclusion Mode: Pure inversion (|255 - BG|) with razor-thin boundary stroke & chromatic aberration dispersion
      return {
        color: "#FFFFFF",
        backgroundImage: undefined,
        WebkitBackgroundClip: undefined,
        WebkitTextFillColor: "#FFFFFF",
        WebkitTextStroke: (layer as any).boundaryStroke || "0.85px rgba(255, 255, 255, 0.75)",
        filter: undefined,
        textShadow: "-0.9px 0px 1.2px rgba(255, 0, 75, 0.75), 0.9px 0px 1.2px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)",
        mixBlendMode: (layer as any).blendMode === "exclusion" ? "exclusion" : "difference",
      };
    }
    return {
      color: "#FFFFFF",
      backgroundImage: undefined,
      WebkitBackgroundClip: undefined,
      WebkitTextFillColor: undefined,
      filter: undefined,
      textShadow: undefined,
      mixBlendMode: "difference",
    };
  }

  if (layer.treatmentOverlay === "air_frontal_optical_bloom" || layer.frontalTreatment === "air_frontal_optical_bloom") {
    const vGrad = layer.verticalGradient || (layer.gradient && layer.gradient !== "none" ? layer.gradient : "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)");
    return {
      backgroundImage: vGrad,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 10px rgba(255, 255, 255, 0.60)) drop-shadow(0 0 22px rgba(255, 250, 240, 0.35)) blur(0.35px)",
      textShadow: "0 0 28px rgba(0, 0, 0, 0.45), 0 2px 14px rgba(0, 0, 0, 0.38), 0 0 6px rgba(0, 0, 0, 0.30)",
      mixBlendMode: layer.blendMode === "screen" ? "screen" : undefined,
    };
  }

  const rawColor = layer.textFillColor || layer.color || (layer.isHero ? "#FF453A" : "#FFFFFF");
  // Anti-Chameleon safeguard: never render dark/black text over video scenes without difference mode
  const textColor = isDarkColor(rawColor) ? (layer.isHero ? "#FF453A" : "#FFFFFF") : rawColor;
  const effectiveGradient = (layer.hasGradient && layer.gradient && layer.gradient !== "none")
    ? layer.gradient
    : (layer.verticalGradient || (layer.isUnderlapping
      ? "linear-gradient(180deg, #FFFFFF 0%, rgba(255, 255, 255, 0.85) 45%, rgba(255, 255, 255, 0.15) 85%, transparent 100%)"
      : undefined));
  const hasGradient = Boolean(effectiveGradient);
  const glowActive = Boolean(layer.glow) && layer.glow !== "none";
  const glowFilter = (glowActive && layer.isHero !== false) ? ` drop-shadow(0 0 10px ${layer.glow})` : "";
  const shadowSuppressed = layer.shadow === "none";
  const bloomOnly = shadowSuppressed && glowActive;
  return {
    color: hasGradient ? undefined : textColor,
    backgroundImage: hasGradient ? effectiveGradient : undefined,
    WebkitBackgroundClip: hasGradient ? "text" : undefined,
    WebkitTextFillColor: hasGradient ? "transparent" : undefined,
    filter: hasGradient
      ? (shadowSuppressed
        ? (glowActive
          ? `drop-shadow(0 0 16px ${layer.glow})`
          : undefined)
        : (layer.specularChamfer
          ? buildPhysicalLightingFilter({
              specularChamfer: true,
              contactShadow: layer.contactShadow,
              ambientShadow: layer.ambientShadow,
              glow: layer.glow || (layer.opticalBleed as string),
            })
          : `drop-shadow(0 4px 18px rgba(0, 0, 0, 0.95))${glowFilter}`))
      : undefined,
    textShadow: hasGradient
      ? (shadowSuppressed ? "none" : undefined)
      : (layer.shadow === "none"
        ? "none"
        : (layer.shadow || (layer.behindSubject
          ? "0 2px 10px rgba(0, 0, 0, 0.55)"
          : (layer.isHero
            ? "0 2px 10px rgba(0, 0, 0, 0.55)"
            : "0 2px 10px rgba(0, 0, 0, 0.55)")))),
    mixBlendMode: undefined,
  };
};

export const resolveTypographyContainerFilter = (
  layers: Array<Pick<TypographyLayer, "blendMode">>,
): string | undefined => layers.some((layer) => layer.blendMode === "difference" || (layer as any).blendMode === "exclusion")
  ? undefined
  : "drop-shadow(0 4px 20px rgba(0, 0, 0, 0.85))";

export const resolveTypographyContainerBlendMode = (
  layers: Array<Pick<TypographyLayer, "blendMode">>,
): React.CSSProperties["mixBlendMode"] =>
  layers.some((layer) => layer.blendMode === "difference" || (layer as any).blendMode === "exclusion")
    ? (layers.some((l) => (l as any).blendMode === "exclusion") ? "exclusion" : "difference")
    : undefined;

export const resolveWordEntranceFrames = ({
  chunkStartMs,
  contentStartFrame,
  fps,
  leadFrames,
  words,
}: {
  chunkStartMs: number;
  contentStartFrame: number;
  fps: number;
  leadFrames: number;
  words: WordTiming[];
}): number[] => words.map((word) => Math.max(
  0,
  contentStartFrame + Math.round(((word.start_ms - chunkStartMs) / 1000) * fps) - leadFrames,
));

export const resolveChunkEntranceFrame = (
  contentStartFrame: number,
  totalFrames: number,
  lastWordStartFrame?: number
): number => {
  if (lastWordStartFrame !== undefined && lastWordStartFrame > 0) {
    return Math.max(1, Math.min(lastWordStartFrame, totalFrames));
  }
  return Math.max(1, Math.min(contentStartFrame, totalFrames));
};

export type CaptionChunk = {
  chunkIndex?: number;
  text: string;
  startMs?: number;
  endMs?: number;
  outputStartMs?: number;
  outputEndMs?: number;
  displayStartMs?: number;
  displayEndMs?: number;
  acceleratedExit?: boolean;
  fontProfile?: string;
  profileFilename?: string;
  pairedImage?: string;
  fxPreset?: string;
  hookPlan?: {
    hookEnabled: boolean;
    hookType: string;
    durationMs?: number;
    intensity?: number;
    camera?: {
      kind: string;
      startScale: number;
      endScale: number;
      overshootScale?: number;
      rotateXDeg?: number;
      rotateYDeg?: number;
      translateY?: number;
      translateZ?: number;
      curve: [number, number, number, number];
      durationMs: number;
    };
    optical?: {
      kind: string;
      startBlurPx: number;
      endBlurPx: number;
      flashIntensity?: number;
      flashDecayFrames?: number;
      specularGlow?: string;
      brightnessRamp?: number;
      whipAngle?: number;
      flareColor?: string;
      burnColor?: string;
      pulseCount?: number;
      curve: [number, number, number, number];
      durationMs: number;
    };
    artifact?: {
      kind: string;
      intensity: number;
      rgbDisplacePx?: number;
      jitterFrequency?: number;
      scanlineDensity?: number;
      phosphorGlow?: string;
      sliceJitterPx?: number;
      gradient?: string;
      specularSpeed?: number;
    };
    typography?: {
      preset: string;
      staggerMs?: number;
      motionBlurSamples?: number;
      maskExpansion?: boolean;
    };
    audioCue?: {
      sfxType: string;
      gainDb: number;
      triggerMs: number;
    };
    zoom?: {
      kind: string;
      startScale: number;
      endScale: number;
      overshootScale: number;
      curve: [number, number, number, number];
      durationMs: number;
    };
    lensBlur?: {
      kind: string;
      startBlurPx: number;
      endBlurPx: number;
      curve: [number, number, number, number];
      durationMs: number;
    };
    directionalBlur?: {
      kind: string;
      startBlurPx: number;
      peakBlurPx: number;
      endBlurPx: number;
      angle: number;
      curve: [number, number, number, number];
      durationMs: number;
    };
    motionBlur?: {
      enabled: boolean;
      sampleCount: number;
      velocityScale: number;
    };
    brandGlow?: string;
  };
  placement?: {
    xPercent?: string;
    yPercent?: string;
    anchor?: string;
    safeRegionId?: string;
    availableHeightRatio?: number;
  };
  layers?: TypographyLayer[];
  words?: WordTiming[];
  palette?: {
    hero_color?: string;
    companion_color?: string;
    accent_border?: string;
    glow?: string;
    shadow?: string;
  };
  listicle?: {
    isListicle?: boolean;
    mode?: "teaser_blur" | "step_item";
    itemNumber?: number;
    itemNumberFormatted?: string;
    totalCount?: number;
    treatment?: string;
    badgeText?: string;
    numberStyle?: {
      fontFamily?: string;
      fontSizePx?: number;
      stroke?: boolean;
      strokeWidthPx?: number;
      maskBottomFade?: boolean;
      blurOblivion?: boolean;
    };
    teaserItems?: Array<{
      itemNumber: number;
      indexFormatted: string;
      label: string;
      blurred: boolean;
    }>;
  };
  profile?: TypographyProfileV2;
  profileV2?: TypographyProfileV2;
  annotations?: TypographyAnnotation[];
  subjectZone?: TypographySubjectZone;
  frameTreatment?: TypographyFrameTreatment;
};

export type MiniRunScene = {
  id: string;
  startMs: number;
  endMs: number;
  layout: "pan_scan" | "floating_pip" | "split_stack";
  focalPoint?: {xPercent: number; yPercent: number};
};

export type MiniRunOrchestration = {
  durationMs: number;
  scenes: MiniRunScene[];
  backgrounds: Array<{
    id: string;
    sceneId: string;
    chunkIndex?: number;
    kind: "blurred_wings" | "texture_canvas" | "brand_canvas" | "editorial_glass" | "gradient_atmosphere" | "defocus_depth";
    blurPx: number;
    brightness: number;
    counterScale: [number, number];
    transition?: {
      kind: string;
      durationMs: number;
    };
    entry?: {
      startMs: number;
      endMs: number;
    };
    exit?: {
      startMs: number;
      endMs: number;
    };
    code?: string;
    texture?: {
      assetId?: string;
      fileName?: string;
      family?: string;
      width?: number;
      height?: number;
      aspectRatio?: number;
      portraitCover?: any;
      blendMode?: string;
      intensity?: number;
      coverScale?: number;
      brandTint?: string;
    };
    glass?: {
      blurPx?: number;
      tint?: string;
      borderColor?: string;
      borderWidthPx?: number;
      specularHighlight?: boolean;
    };
    atmosphere?: {
      glowRgb?: string;
      primary?: string;
      accent?: string;
      focalCenter?: { xPercent: number; yPercent: number };
      pulseIntensity?: number;
    };
    defocus?: {
      blurPx?: number;
      brightnessDip?: number;
      vignetteStrength?: number;
    };
    cause?: {
      gate: string;
      sceneId?: string;
      chunkIds?: string[];
      chunkIndex?: number;
      trigger?: string;
      candidate?: string;
      reason: string;
      causedByTransitionId?: string;
    };
  }>;
  pip: Array<{
    id: string;
    sceneId: string;
    aspectRatio: number;
    cornerRadiusPx: number;
    microDriftScale: [number, number];
    entryScale: [number, number, number];
    curve: [number, number, number, number];
  }>;
  transitions: Array<{
    id: string;
    startMs: number;
    endMs: number;
    peakVelocityMs: number;
    effect: string;
    fromSceneId: string;
    toSceneId: string;
    causedBySceneId: string;
  }>;
  cameraMoves: Array<{
    id: string;
    startMs: number;
    endMs: number;
    kind: string;
    curve: [number, number, number, number];
    overshootScale: number;
    startScale?: number;
    endScale?: number;
    anchorPoint?: { xPercent: number; yPercent: number };
    rotationDeg?: number;
    cutbackAtEnd?: boolean;
    instantJump?: boolean;
    dollyParallax?: { backgroundScale: number; subjectScale: number };
    causedByTransitionId?: string | null;
    causedBySceneId?: string | null;
  }>;
  spatialCamera3D?: {
    enabled?: boolean;
    mode?: "spline_orbit" | "pan_tilt" | "dolly_zoom";
    perspectivePx?: number;
    smoothingFactor?: number;
    nodes?: Array<{
      nodeId: string;
      chunkIndex: number;
      startMs: number;
      endMs: number;
      dominantZone?: string;
      alignment?: string;
      position: { x: number; y: number; z: number };
      rotation: { pitchDeg: number; yawDeg: number; rollDeg: number };
      scale?: number;
    }>;
  };
};

export type SceneVisualState = {
  layout: MiniRunScene["layout"];
  sceneId?: string;
  focalXPercent: number;
  backgroundBlurPx: number;
  backgroundBrightness: number;
  backgroundScale: number;
  pipCornerRadiusPx: number;
  pipScale: number;
  cameraScale: number;
  cameraRotationDeg: number;
  anchorXPercent: number;
  anchorYPercent: number;
  dollyBackgroundScale?: number;
  transitionId?: string;
  transitionProgress: number;
  transitionStrength: number;
  cameraMoveId?: string;
};

const clampedProgress = (nowMs: number, startMs: number, endMs: number): number => {
  if (endMs <= startMs) return 1;
  return Math.max(0, Math.min(1, (nowMs - startMs) / (endMs - startMs)));
};

export const resolveSceneVisualState = (
  orchestration: MiniRunOrchestration | undefined,
  frame: number,
  fps: number,
): SceneVisualState => {
  const nowMs = (frame / fps) * 1000;
  const scenes = orchestration?.scenes || [];
  const scene = scenes.find((candidate) => nowMs >= candidate.startMs && nowMs < candidate.endMs)
    ?? scenes.at(-1);
  const background = orchestration?.backgrounds?.find((candidate) => candidate.sceneId === scene?.id);
  const pip = orchestration?.pip?.find((candidate) => candidate.sceneId === scene?.id);
  const transition = orchestration?.transitions?.find((candidate) => nowMs >= candidate.startMs && nowMs <= candidate.endMs);
  const camera = orchestration?.cameraMoves?.find((candidate) => nowMs >= candidate.startMs && nowMs <= candidate.endMs);
  const sceneProgress = scene ? clampedProgress(nowMs, scene.startMs, scene.endMs) : 0;
  const transitionProgress = transition ? clampedProgress(nowMs, transition.startMs, transition.endMs) : 0;
  const transitionStrength = transition ? Math.sin(transitionProgress * Math.PI) : 0;

  let cameraProgress = 0;
  let cameraScale = 1;
  let cameraRotationDeg = 0;
  let dollyBackgroundScale: number | undefined = undefined;

  if (camera) {
    if (camera.cutbackAtEnd && nowMs >= camera.endMs) {
      // Joseph Edit: sharp hard cut-back to 1.00x at the scene cut
      cameraScale = 1;
      cameraProgress = 1;
    } else if (camera.instantJump) {
      // Punch zoom: instant 0ms jump step
      cameraProgress = 1;
      cameraScale = camera.endScale ?? camera.overshootScale;
    } else {
      cameraProgress = Easing.bezier(...camera.curve)(clampedProgress(nowMs, camera.startMs, camera.endMs));
      const start = camera.startScale ?? 1;
      const end = camera.dollyParallax ? camera.dollyParallax.subjectScale : (camera.endScale ?? camera.overshootScale);
      cameraScale = interpolate(cameraProgress, [0, 1], [start, end], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
    }

    if (camera.rotationDeg) {
      cameraRotationDeg = interpolate(cameraProgress, [0, 1], [camera.rotationDeg, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
    }

    if (camera.dollyParallax) {
      dollyBackgroundScale = interpolate(
        cameraProgress,
        [0, 1],
        [1, camera.dollyParallax.backgroundScale],
        {extrapolateLeft: "clamp", extrapolateRight: "clamp"}
      );
    }
  }

  // Hard editorial framing cuts on scene boundaries (instant crop cut, zero sliding pan across live footage):
  let focalXPercent = scene?.focalPoint?.xPercent ?? 50;

  const anchorXPercent = camera?.anchorPoint?.xPercent ?? scene?.focalPoint?.xPercent ?? 50;
  const anchorYPercent = camera?.anchorPoint?.yPercent ?? scene?.focalPoint?.yPercent ?? 40;

  let pipScale = 1;
  if (pip && scene) {
    const entryProgress = Easing.bezier(...pip.curve)(clampedProgress(nowMs, scene.startMs, Math.min(scene.endMs, scene.startMs + 650)));
    const entryScale = entryProgress < 0.78
      ? interpolate(entryProgress, [0, 0.78], [pip.entryScale[0], pip.entryScale[1]], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})
      : interpolate(entryProgress, [0.78, 1], [pip.entryScale[1], pip.entryScale[2]], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
    const drift = interpolate(sceneProgress, [0, 1], pip.microDriftScale, {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
    pipScale = Math.max(1, Math.min(pip.entryScale[0], entryScale * drift));
  }

  return {
    layout: scene?.layout ?? "pan_scan",
    sceneId: scene?.id,
    focalXPercent: Number(focalXPercent.toFixed(2)),
    backgroundBlurPx: background?.blurPx ?? 0,
    backgroundBrightness: background?.brightness ?? 1,
    backgroundScale: background?.counterScale
      ? interpolate(sceneProgress, [0, 1], background.counterScale, {extrapolateLeft: "clamp", extrapolateRight: "clamp"})
      : 1,
    pipCornerRadiusPx: pip?.cornerRadiusPx ?? 0,
    pipScale,
    cameraScale,
    cameraRotationDeg,
    anchorXPercent,
    anchorYPercent,
    dollyBackgroundScale,
    transitionId: transition?.id,
    transitionProgress,
    transitionStrength,
    cameraMoveId: camera?.id,
  };
};

export const resolvePanScanMediaStyle = (state: SceneVisualState, baseOverscan: number = 1.0) => {
  const totalScale = state.cameraScale * baseOverscan;
  const rot = state.cameraRotationDeg ? ` rotate(${state.cameraRotationDeg.toFixed(2)}deg)` : "";
  const transformOrigin = state.cameraMoveId
    ? `${state.anchorXPercent}% ${state.anchorYPercent}%`
    : "center";
  return {
    objectPosition: `${state.focalXPercent}% 50%`,
    transform: `scale(${totalScale})${rot}`,
    transformOrigin,
  };
};

export type PrometheusMinRunProps = {
  videoSrc: string;
  matteSrc?: string;
  chunks: CaptionChunk[];
  durationMs: number;
  orchestration?: MiniRunOrchestration;
  audioTrackSrc?: string;
  soundtrackSrc?: string;
  profile?: TypographyProfileV2;
};

export const RUNTIME_TREATMENT_IDS = new Set([
  "subpixel_glow_mask",
  "focus_hunting_bokeh_shimmer",
  "gaussian_blur_reveal_sweep",
  "stagger_blur_word_reveal",
  "spring_blur_physics_engine",
  "elegant_paraword_spring_bloom",
  "kinetic_slot_character_reel",
  "motion_creative_kinetic_wave_slot_engine",
  "apple_keynote_headline_punch",
  "apple_pro_display_hero_revealer",
  "dynamic_staggered_character_cascade",
  "cinematic_viewport_mask_sweep",
  "soft_pixel_blowup_mask",
  "obsidian_heavy_grotesque",
  "textrotate_kinetic_word_cycler",
  "typewriter_ghost_cursor",
  "vercel_kinetic_highlight_box",
  "isometric_kinetic_perspective_stack",
  "hand_drawn_kinetic_underline",
  "horizontal_gradient_sweep_fade",
  "liquid_gooey_ink_morph",
  "cyber_matrix_text_scramble",
  "metallic_chrome_countup_hero",
  "lavender_highlight_selection",
  "electric_blue_emoji_line_revealer",
  "vector_stroke_sparkle",
  "figma_collaborative_frame_expansion",
  "hybrid_figma_kinetic_slot",
  "glow_search_pulsing_caret",
  "dotted_grid_shimmer_wave",
  "top_down_staggered_character_drop",
  "dotted_grid_elastic_word_pull",
  "led_dot_matrix_scanline",
  "geometric_circle_inversion",
  "sandstorm_grain_dissolve",
  "canva_tall_glyph_stack",
  "hightech_chromatic_brands",
  "kinetic_cyber_phrase_expansion",
  "kinetic_glow_sweep",
  "kinetic_word_fast_pulse",
  "kinetic_dynamic_slant",
  "kinetic_chromatic_typewriter",
  "metallic_chrome_counter",
  "apple_gaussian_chrome",
  "cinematic_apple_word_bounce",
  "cinematic_distance_convergence",
  "see_through_glass_letterform",
  "hook_bokeh_defocus_bloom",
  "hook_gaussian_lens_reveal",
  "hook_directional_whip_blur",
  "hook_radial_zoom_blur",
  "hook_sharp_white_flash_cut",
  "hook_anamorphic_flare_burst",
  "hook_vintage_film_burn_strobe",
  "hook_luma_strobe_pulse",
  "hook_cinematic_dolly_zoom",
  "hook_crash_zoom_snap",
  "hook_isometric_3d_slam",
  "hook_vertical_kinetic_pedestal",
  "hook_smooth_zoom_in",
  "hook_full_zoom_up",
  "hook_crt_scanline_matrix_decode",
  "hook_vhs_tape_tracking_tear",
  "hook_metallic_chrome_reflection",
  "hook_liquid_ink_metaball_reveal",
  "hook_zora_aperture_mask_bloom",
  "hook_motion_blur_word",
  "hook_camera_lens_blur_reveal",
  "hook_directional_blur_sweep",
  "zora_mask_reveal",
  "blue_lantern_magnetic",
  "cyber_acid_lime_glitch",
  ...ALL_ARCHETYPE_FX_NAMES,
]);

export const normalizeRuntimePreset = (preset: string | undefined): string => {
  // Banned two-coloration treatments (split-word + RGB channel split) never
  // render in mini runs: legacy manifests route to the standard fallback.
  if (preset === "syllabic_split_word" || preset === "hook_rgb_chromatic_split_glitch") {
    return "subpixel_glow_mask";
  }
  return preset && RUNTIME_TREATMENT_IDS.has(preset) ? preset : "subpixel_glow_mask";
};

export const resolveTypographyZIndex = (
  behindSubject: boolean,
  safeRegionId: string | undefined,
): number => {
  return behindSubject ? 25 : 100;
};

export const resolveSafeStageScaleX = (
  behindSubject: boolean,
  safeRegionId: string | undefined,
): number => 1;


// The selector may only emit treatments represented in this set. Every member
// has an explicit renderer branch or an intentional named Anima variant below.
export const unsupportedRuntimeTreatments = (): string[] => [
  ...RUNTIME_TREATMENT_IDS,
].filter((preset) => !REALIZED_RUNTIME_TREATMENTS.has(preset));

const EXTENDED_ANIMA_TREATMENTS = new Set([
  "textrotate_kinetic_word_cycler", "typewriter_ghost_cursor", "vercel_kinetic_highlight_box",
  "isometric_kinetic_perspective_stack", "hand_drawn_kinetic_underline", "horizontal_gradient_sweep_fade",
  "liquid_gooey_ink_morph", "cyber_matrix_text_scramble", "metallic_chrome_countup_hero",
  "lavender_highlight_selection", "electric_blue_emoji_line_revealer", "vector_stroke_sparkle",
  "figma_collaborative_frame_expansion", "hybrid_figma_kinetic_slot", "glow_search_pulsing_caret",
  "dotted_grid_shimmer_wave", "top_down_staggered_character_drop", "dotted_grid_elastic_word_pull",
  "led_dot_matrix_scanline", "geometric_circle_inversion", "sandstorm_grain_dissolve",
  "hightech_chromatic_brands", "kinetic_cyber_phrase_expansion", "kinetic_glow_sweep",
  "kinetic_word_fast_pulse", "kinetic_dynamic_slant", "kinetic_chromatic_typewriter",
  "metallic_chrome_counter", "apple_gaussian_chrome", "cinematic_apple_word_bounce",
  "cyber_acid_lime_glitch",
]);

const REALIZED_RUNTIME_TREATMENTS = new Set([
  "subpixel_glow_mask", "focus_hunting_bokeh_shimmer", "gaussian_blur_reveal_sweep",
  "spring_blur_physics_engine", "elegant_paraword_spring_bloom", "kinetic_slot_character_reel",
  "motion_creative_kinetic_wave_slot_engine", "apple_keynote_headline_punch",
  "apple_pro_display_hero_revealer", "dynamic_staggered_character_cascade",
  "cinematic_viewport_mask_sweep", "soft_pixel_blowup_mask", "obsidian_heavy_grotesque",
  "canva_tall_glyph_stack", "cinematic_distance_convergence", "see_through_glass_letterform",
  "hook_bokeh_defocus_bloom", "hook_gaussian_lens_reveal", "hook_directional_whip_blur",
  "hook_radial_zoom_blur", "hook_sharp_white_flash_cut", "hook_anamorphic_flare_burst",
  "hook_vintage_film_burn_strobe", "hook_luma_strobe_pulse", "hook_cinematic_dolly_zoom",
  "hook_crash_zoom_snap", "hook_isometric_3d_slam", "hook_vertical_kinetic_pedestal",
  "hook_smooth_zoom_in", "hook_full_zoom_up",
  "hook_crt_scanline_matrix_decode", "hook_vhs_tape_tracking_tear", "hook_metallic_chrome_reflection",
  "hook_liquid_ink_metaball_reveal", "hook_zora_aperture_mask_bloom", "hook_motion_blur_word",
  "hook_camera_lens_blur_reveal", "hook_directional_blur_sweep", "zora_mask_reveal",
  "blue_lantern_magnetic",
  ...EXTENDED_ANIMA_TREATMENTS,
  ...ALL_ARCHETYPE_FX_NAMES,
]);

// ---------------------------------------------------------------------------
// Behind-Subject Typography Metrics Resolver
// ---------------------------------------------------------------------------
export const resolveBehindSubjectTypographyMetrics = ({
  charLength,
  availableHeightRatio = 0.16,
  isTallFont = false,
}: {
  charLength: number;
  availableHeightRatio?: number;
  isTallFont?: boolean;
}): {
  fontSize: number;
  scaleX: number;
  scaleY: number;
  letterSpacing: string;
} => {
  const len = Math.max(1, charLength);
  
  let fontSize: number;
  let scaleX: number;
  let scaleY: number;
  let letterSpacing: string;

  if (len <= 4) {
    fontSize = availableHeightRatio >= 0.13 ? 210 : 170;
    scaleX = 1.05;
    scaleY = isTallFont ? 1.50 : 1.22;
    letterSpacing = "0.06em";
  } else if (len <= 6) {
    fontSize = availableHeightRatio >= 0.13 ? 175 : 145;
    scaleX = 1.02;
    scaleY = isTallFont ? 1.45 : 1.18;
    letterSpacing = "0.04em";
  } else if (len <= 8) {
    fontSize = availableHeightRatio >= 0.13 ? (isTallFont ? 150 : 140) : 120;
    scaleX = 1.0;
    scaleY = isTallFont ? 1.35 : 1.14;
    letterSpacing = "0.03em";
  } else if (len <= 11) {
    fontSize = availableHeightRatio >= 0.13 ? 110 : 95;
    scaleX = 0.98;
    scaleY = isTallFont ? 1.25 : 1.10;
    letterSpacing = "0.02em";
  } else {
    // 12+ characters (e.g. "unsure poster" = 13 chars): safe responsive bounds so it never clips 1080px frame
    fontSize = Math.max(68, Math.min(90, Math.round(820 / (len * 0.72))));
    scaleX = 0.96;
    scaleY = isTallFont ? 1.15 : 1.05;
    letterSpacing = "0.01em";
  }
  return { fontSize, scaleX, scaleY, letterSpacing };
};

// ---------------------------------------------------------------------------
// Auto-Fit Scale Calculator (Clamp viewport-safe scale down to 0.35 floor)
// ---------------------------------------------------------------------------
export interface AutoFitScaleParams {
  charLength: number;
  fontSizePx: number;
  isUppercase?: boolean;
  isScript?: boolean;
  isBehindSubject?: boolean;
  behindSubjectScaleX?: number;
  isFlank?: boolean;
}

export const resolveAutoFitScale = ({
  charLength,
  fontSizePx,
  isUppercase = false,
  isScript = false,
  isBehindSubject = false,
  behindSubjectScaleX = 1.0,
  isFlank = false,
}: AutoFitScaleParams): number => {
  const maxAllowedWidthPx = isFlank ? 340 : (isBehindSubject ? 860 : 830);
  const charAspectEstimate = isUppercase ? 0.74 : 0.54;
  const effectiveFontSize = isScript ? Math.max(80, fontSizePx) : fontSizePx;
  const estimatedWidthPx = charLength * effectiveFontSize * charAspectEstimate * (isBehindSubject ? behindSubjectScaleX : 1.0);
  if (estimatedWidthPx > maxAllowedWidthPx) {
    return Math.max(0.35, maxAllowedWidthPx / estimatedWidthPx);
  }
  return 1.0;
};

// ---------------------------------------------------------------------------
// Numeric Count-Up Resolver (True numeric count-up with perceptibility floor)
// ---------------------------------------------------------------------------
export interface NumericCountUpParams {
  text: string;
  localFrame: number;
  durationFrames?: number;
  floorFrames?: number;
}

export const resolveNumericCountUpValue = ({
  text,
  localFrame,
  durationFrames = 18,
  floorFrames = 12,
}: NumericCountUpParams): string => {
  if (!text || !/\d/.test(text)) {
    return text;
  }

  const match = text.match(/^([^\d]*)([\d,]+(?:\.\d+)?)([^\d]*)$/);
  if (!match) {
    return text;
  }

  const prefix = match[1];
  const rawDigitsWithCommas = match[2];
  const suffix = match[3];

  const cleanDigits = rawDigitsWithCommas.replace(/,/g, "");
  const hasDecimal = cleanDigits.includes(".");
  const targetNum = hasDecimal ? parseFloat(cleanDigits) : parseInt(cleanDigits, 10);
  if (isNaN(targetNum)) {
    return text;
  }

  const effectiveDuration = Math.max(floorFrames, durationFrames);

  if (localFrame <= 0) {
    const zeroFormatted = hasDecimal ? (0).toFixed(cleanDigits.split(".")[1]?.length || 1) : "0";
    return `${prefix}${zeroFormatted}${suffix}`;
  }

  if (localFrame >= effectiveDuration) {
    return text;
  }

  // Cubic ease-out: 1 - (1 - p)^3 for rapid initial velocity + silky settle
  const p = Math.min(1, Math.max(0, localFrame / effectiveDuration));
  const easedProgress = 1 - Math.pow(1 - p, 3);

  if (hasDecimal) {
    const decimalPlaces = cleanDigits.split(".")[1]?.length || 1;
    const currentVal = (easedProgress * targetNum).toFixed(decimalPlaces);
    return `${prefix}${currentVal}${suffix}`;
  }

  const currentNum = Math.round(easedProgress * targetNum);
  const formattedNum = rawDigitsWithCommas.includes(",")
    ? currentNum.toLocaleString("en-US")
    : String(currentNum);

  return `${prefix}${formattedNum}${suffix}`;
};

const KineticLayerRenderer: React.FC<{
  layer: TypographyLayer;
  frame: number;
  chunkStartMs: number;
  chunkEndMs: number;
  fps: number;
  totalFrames: number;
  contentStartFrame: number;
  hookPlan?: NonNullable<CaptionChunk["hookPlan"]>;
  placement?: CaptionChunk["placement"];
  tierExitFrame?: number;
}> = ({ layer, frame, chunkStartMs, chunkEndMs, fps, totalFrames, contentStartFrame, hookPlan, placement, tierExitFrame }) => {
  // Tier Exit Choreography: Companion tier animates OUT when hero layer lands
  const isTierExiting = tierExitFrame !== undefined && frame >= tierExitFrame;
  const tierExitElapsed = isTierExiting ? frame - tierExitFrame : 0;
  if (isTierExiting && tierExitElapsed >= 10) {
    return null;
  }
  const tierExitP = isTierExiting
    ? interpolate(tierExitElapsed, [0, 10], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
      })
    : 0;
  const tierExitOpacity = 1 - tierExitP;
  const tierExitScale = interpolate(tierExitP, [0, 1], [1.0, 0.92]);
  const tierExitY = interpolate(tierExitP, [0, 1], [0, -18]);
  const tierExitBlur = tierExitP * 8;
  const fx = normalizeRuntimePreset(layer.fxPreset || (layer.isHero ? "focus_hunting_bokeh_shimmer" : "subpixel_glow_mask"));
  const words = layer.text.split(" ").filter((word) => word.length > 0);
  // Mention-sync: entrance lead stays within ~100ms before the word is spoken.
  const leadFrames = Math.round(
    (((layer.effectiveEntryLeadMs ?? layer.entryLeadMs) ?? (layer.isHero ? 100 : 60)) / 1000) * fps,
  );
  const timedWords = layer.words?.length === words.length ? layer.words : words.map((text, index) => ({
    text,
    start_ms: chunkStartMs + Math.round((index / Math.max(1, words.length)) * (chunkEndMs - chunkStartMs)),
    end_ms: chunkEndMs,
  }));
  const wordEntranceFrames = resolveWordEntranceFrames({
    chunkStartMs,
    contentStartFrame,
    fps,
    leadFrames,
    words: timedWords,
  });
  const overlayProgress = interpolate(frame - wordEntranceFrames[0], [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const isBehindSubject = Boolean(layer.behindSubject);
  const isTallProfile = Boolean(
    (layer as any).isTallProfile ||
    (layer.fontFamily && /teko|six caps|asgard|anton|bebas|saira|oswald/i.test(layer.fontFamily))
  );
  const rawString = words.join(" ");
  const charLength = Math.max(1, rawString.length);
  const behindMetrics = resolveBehindSubjectTypographyMetrics({
    charLength,
    availableHeightRatio: placement?.availableHeightRatio,
    isTallFont: isTallProfile,
  });
  const behindSubjectFontSize = behindMetrics.fontSize;
  const behindSubjectScaleX = behindMetrics.scaleX;
  const behindSubjectScaleY = behindMetrics.scaleY;

  const rawColor = layer.textFillColor || layer.color || (layer.isHero ? "#FF453A" : "#FFFFFF");
  const textColor = isDarkColor(rawColor) ? (layer.isHero ? "#FF453A" : "#FFFFFF") : rawColor;

  // Universal dark gradient sanitization: dark gradients from light-mode design exemplars
  // must never render dark-on-dark on top of video footage.
  const isDarkGradient = (grad?: string): boolean => {
    if (!grad) return false;
    const gLow = grad.toLowerCase();
    return (
      gLow.includes("#000000") ||
      gLow.includes("#111111") ||
      gLow.includes("#0f172a") ||
      gLow.includes("#1e293b") ||
      gLow.includes("rgba(0, 0, 0") ||
      gLow.includes("rgba(17, 17, 17") ||
      gLow.includes("rgb(0, 0, 0") ||
      gLow.includes("rgb(17, 17, 17")
    );
  };

  const isAirFrontal = layer.treatmentOverlay === "air_frontal_optical_bloom"
    || layer.frontalTreatment === "air_frontal_optical_bloom"
    || fx === "air_frontal_optical_bloom"
    || fx === "in_the_air_diffusion_bloom";

  const safeVerticalGradient = (layer.verticalGradient && !isDarkGradient(layer.verticalGradient))
    ? layer.verticalGradient
    : (isAirFrontal ? "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)" : undefined);

  const isDiffMode = layer.blendMode === "difference" || (layer as any).blendMode === "exclusion";

  const fallbackVolumetric = (!isDiffMode && layer.volumetricShading !== false && layer.specularChamfer !== false)
    ? deriveVolumetricGradient(textColor)
    : undefined;

  const underlapFade = safeVerticalGradient || (layer.isUnderlapping
    ? `linear-gradient(180deg, ${textColor} 0%, ${textColor} 35%, rgba(255, 255, 255, 0.20) 80%, transparent 100%)`
    : (layer.marginTopPx !== undefined && layer.marginTopPx < 0 && !layer.isHero && !layer.isOverlayAtop
      ? `linear-gradient(180deg, ${textColor} 0%, ${textColor} 35%, rgba(255, 255, 255, 0.25) 80%, transparent 100%)`
      : undefined));
  const activeGradient = underlapFade || ((layer.hasGradient && layer.gradient && layer.gradient !== "none" && !isDarkGradient(layer.gradient))
    ? layer.gradient
    : (isAirFrontal
        ? "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)"
        : fallbackVolumetric));
  const hasGrad = Boolean(activeGradient);

  const physicalFilter = buildPhysicalLightingFilter({
    specularChamfer: layer.specularChamfer !== false,
    contactShadow: layer.contactShadow,
    ambientShadow: layer.ambientShadow,
    glow: layer.glow || (layer.opticalBleed as string),
  });

  // Materiality: 3D Bevel, Multi-Shadows, and Drop Shadows from V2
  const bevel = layer.materiality?.bevel;
  const bevelFilter = bevel?.enabled
    ? `drop-shadow(-${bevel.depthPx ?? 2}px -${bevel.depthPx ?? 2}px 0px ${bevel.highlightColor || bevel.specularColor || "rgba(255,255,255,0.75)"}) drop-shadow(${bevel.depthPx ?? 2}px ${bevel.depthPx ?? 2}px ${(bevel.softnessPx ?? 1) + 1}px ${bevel.shadowColor || "rgba(0,0,0,0.85)"})`
    : "";

  const multiShadows = layer.materiality?.multiShadows;
  const v2MultiShadowStr = (multiShadows && multiShadows.length > 0)
    ? multiShadows.map((s) => `${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.color}`).join(", ")
    : undefined;

  const dropShadow = layer.materiality?.dropShadow;
  const v2DropShadowStr = dropShadow
    ? `${dropShadow.offsetX}px ${dropShadow.offsetY}px ${dropShadow.blur}px ${dropShadow.color}`
    : undefined;

  const customStroke = (layer.stroke?.enabled && layer.stroke.widthPx && layer.stroke.color)
    ? `${layer.stroke.widthPx}px ${layer.stroke.color}`
    : undefined;

  const wordPaintStyle: React.CSSProperties = isDiffMode
    ? resolveTypographyPaintStyle(layer)
    : isAirFrontal
    ? {
        backgroundImage: activeGradient,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        filter: `${bevelFilter ? `${bevelFilter} ` : ""}drop-shadow(0 0 10px rgba(255, 255, 255, 0.60)) drop-shadow(0 0 22px rgba(255, 250, 240, 0.35)) blur(0.35px)`,
      }
    : hasGrad
    ? {
        backgroundImage: activeGradient,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        filter: `${bevelFilter ? `${bevelFilter} ` : ""}${physicalFilter || ""}`.trim() || undefined,
      }
    : {
        color: textColor,
        WebkitTextFillColor: textColor,
        WebkitTextStroke: customStroke || (isBehindSubject
          ? "1.5px rgba(0, 0, 0, 0.9)"
          : (layer.fontStyle === "italic" || (layer.fontFamily && /script|brush|vibes|pinyon|alex/i.test(layer.fontFamily)) ? undefined : "1.0px rgba(0, 0, 0, 0.75)")),
        filter: bevelFilter || undefined,
      };

  const kineticTextShadow = (value?: string): string | undefined => {
    if (isDiffMode) {
      return (wordPaintStyle.textShadow as string) || "-0.9px 0px 1.2px rgba(255, 0, 75, 0.75), 0.9px 0px 1.2px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)";
    }
    if (v2MultiShadowStr) return v2MultiShadowStr;
    if (v2DropShadowStr) return v2DropShadowStr;
    if (hasGrad && !isAirFrontal) return undefined;
    if (isAirFrontal) {
      return "0 0 28px rgba(0, 0, 0, 0.45), 0 2px 14px rgba(0, 0, 0, 0.38), 0 0 6px rgba(0, 0, 0, 0.30)";
    }
    if (layer.shadow !== undefined) {
      return layer.shadow === "none" ? undefined : layer.shadow;
    }
    return value || (isBehindSubject
      ? "0 2px 10px rgba(0, 0, 0, 0.55)"
      : "0 2px 10px rgba(0, 0, 0, 0.55)");
  };

  const composeFilter = (blurPx: number, extraFilter?: string): string | undefined => {
    const base = extraFilter || (wordPaintStyle.filter as string) || "";
    if (blurPx > 0.1) {
      return `blur(${blurPx.toFixed(1)}px) ${base}`.trim();
    }
    return base || undefined;
  };

  // Rock-solid typography framing: zero camera drift, zero text wobble/vibration
  const currentLetterSpacing = isBehindSubject
    ? behindMetrics.letterSpacing
    : `${layer.letterSpacingEm || 0}em`;

  const isScript = Boolean(layer.fontFamily && /script|brush|vibes|pinyon|alex|brotherhood|bromello|exmouth|champignon|bucklane|formale|cavas/i.test(layer.fontFamily));
  const isOrnateLigatureDisplay = Boolean(layer.fontFamily && /foglihten|petitecaps/i.test(layer.fontFamily));
  // Script short-word safeguard: if word length <= 3 (e.g. "Do.", "is", "to"), Spencerian script flourishes are illegible.
  // Fall back to clean modern serif / geometric sans.
  const isTooShortForScript = isScript && words.length === 1 && words[0].replace(/[^a-zA-Z]/g, "").length <= 3;
  // Ornate display safeguard: Ornate ligature fonts (such as Foglihten-068 where 'P' has a loop that reads as 'Q')
  // must NEVER be applied to secondary/subordinate/companion layers, nor when uppercase is used.
  // When inappropriate, fall back to high-readability serif/sans.
  const isDisallowedOrnate = isOrnateLigatureDisplay && (!layer.isHero || layer.casing === "uppercase");

  const effectiveFontFamily = isTooShortForScript
    ? (layer.isHero ? "Playfair Display" : "Outfit")
    : isDisallowedOrnate
      ? (layer.isHero ? "Cinzel" : "Outfit")
      : layer.fontFamily;
  const effectiveIsScript = isScript && !isTooShortForScript;

  const resolvedTextTransform = effectiveIsScript
    ? (layer.casing === "lowercase" ? "lowercase" : "none") // Script fonts NEVER uppercase
    : (layer.casing === "uppercase" ? "uppercase" : (layer.casing === "lowercase" ? "lowercase" : (layer.casing === "title" || layer.casing === "capitalize" ? "capitalize" : undefined)));

  // Viewport-safe auto-fit clamp against canvas boundaries (1080x1920 portrait)
  const isFlank =
    (placement as any)?.dominantZone === "flank_right_column" ||
    (placement as any)?.dominantZone === "flank_left_column" ||
    Boolean(placement?.safeRegionId?.includes("flank"));

  const isUppercase = resolvedTextTransform === "uppercase" || layer.casing === "uppercase";
  const rawSize = isBehindSubject ? behindSubjectFontSize : layer.fontSizePx;
  const autoFitScale = resolveAutoFitScale({
    charLength,
    fontSizePx: rawSize,
    isUppercase,
    isScript: effectiveIsScript,
    isBehindSubject,
    behindSubjectScaleX,
    isFlank,
  });

  const fitScale = (s: number = 1.0): number => (autoFitScale < 1.0 ? s * autoFitScale : s);
  const fitTransform = (extraTransform: string): string => {
    if (autoFitScale < 1.0) {
      return `scale(${autoFitScale}) ${extraTransform}`.trim();
    }
    return extraTransform;
  };

  const effectiveFontSizePx = Math.max(
    isBehindSubject ? behindSubjectFontSize : (layer.fontSizePx || 48),
    36,
  );

  const stagger = layer.stagger;
  const staggerScaleX = (stagger?.scaleX ?? 1.0) * (stagger?.stretchRatio ?? 1.0);
  const staggerScaleY = stagger?.scaleY ?? 1.0;
  const staggerSkewX = stagger?.skewXDeg ? `skewX(${stagger.skewXDeg}deg)` : "";
  const staggerSkewY = stagger?.skewYDeg ? `skewY(${stagger.skewYDeg}deg)` : "";
  const staggerRot = stagger?.rotationDeg ? `rotate(${stagger.rotationDeg}deg)` : "";
  const staggerArc = stagger?.arcWarpDeg ? `rotate(${stagger.arcWarpDeg}deg)` : "";
  const staggerTransforms = [
    staggerScaleX !== 1.0 ? `scaleX(${staggerScaleX})` : "",
    staggerScaleY !== 1.0 ? `scaleY(${staggerScaleY})` : "",
    staggerSkewX,
    staggerSkewY,
    staggerRot,
    staggerArc,
  ].filter(Boolean).join(" ");

  const isPartialHeadClip = layer.occlusion?.mode === "partial_head_clip";
  const occlusionDepthZ = layer.occlusion?.depthPlane ? -Math.abs(layer.occlusion.depthPlane) : undefined;

  const baseTextStyle: React.CSSProperties = {
    fontFamily: `"${effectiveFontFamily}", "${layer.accentFont || "sans-serif"}", sans-serif`,
    fontWeight: isBehindSubject ? 900 : layer.fontWeight,
    fontStyle: layer.fontStyle as any,
    fontSize: `${effectiveFontSizePx}px`,
    textTransform: resolvedTextTransform as any,
    letterSpacing: currentLetterSpacing,
    lineHeight: isBehindSubject ? 0.85 : layer.lineHeight,
    marginTop: layer.marginTopPx !== undefined ? `${layer.marginTopPx}px` : undefined,
    marginLeft: (layer as any).marginLeftPx !== undefined ? `${(layer as any).marginLeftPx}px` : undefined,
    alignSelf: ((layer as any).alignSelf as any) || "center",
    position: "relative",
    zIndex: isPartialHeadClip ? 4 : (layer.zIndex !== undefined
      ? layer.zIndex
      : (layer.isOverlayAtop
        ? 10
        : (layer.isUnderlapping
          ? 2
          : (layer.marginTopPx && layer.marginTopPx < 0 ? ((layer.layerIndex || 0) + 1) * 2 : (layer.layerIndex || 0) + 1)))),
    maxWidth: isBehindSubject ? "880px" : "840px",
    borderBottom: layer.doubleUnderline ? `3px double ${textColor}` : "none",
    paddingBottom: layer.doubleUnderline ? "6px" : "0px",
    paddingRight: "0.25em",
    boxSizing: "content-box",
    display: "inline-flex",
    flexWrap: "nowrap",
    whiteSpace: "nowrap",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    overflow: "visible",
    fontVariantLigatures: "none",
    fontFeatureSettings: '"liga" 0, "dlig" 0, "calt" 0, "hlig" 0',
    color: textColor,
    WebkitTextFillColor: hasGrad ? undefined : textColor,
    transform: isBehindSubject
      ? `scaleY(${behindSubjectScaleY * staggerScaleY}) scaleX(${behindSubjectScaleX * autoFitScale * staggerScaleX}) ${staggerSkewX} ${staggerSkewY} ${staggerRot} ${staggerArc} translateZ(${layer.depthZPx || occlusionDepthZ || -100}px)`
      : (autoFitScale < 1.0
          ? `translateY(${tierExitY.toFixed(1)}px) scale(${autoFitScale * tierExitScale}) ${staggerTransforms} translate3d(${stagger?.dxPercent ? `${stagger.dxPercent}%` : "0px"}, ${stagger?.dyPercent ? `${stagger.dyPercent}%` : "0px"}, ${layer.depthZPx || occlusionDepthZ || (layer.isHero ? 140 : 0)}px)`
          : `translateY(${tierExitY.toFixed(1)}px) scale(${tierExitScale.toFixed(3)}) ${staggerTransforms ? `${staggerTransforms} ` : ""}translate3d(${stagger?.dxPercent ? `${stagger.dxPercent}%` : "0px"}, ${stagger?.dyPercent ? `${stagger.dyPercent}%` : "0px"}, ${layer.depthZPx || occlusionDepthZ || (layer.isHero ? 140 : 0)}px)`),
    transformStyle: "preserve-3d",
    opacity: (((!layer.isHero && !isBehindSubject) ? 0.92 : 1.0) * tierExitOpacity),
    filter: tierExitBlur > 0.1 ? `blur(${tierExitBlur.toFixed(1)}px)` : undefined,
    mixBlendMode: isDiffMode ? undefined : (((layer as any).blendMode || undefined) as any),
    clipPath: isPartialHeadClip
      ? "polygon(0 0, 100% 0, 100% 92%, 0 92%)"
      : (layer.treatmentOverlay === "cinematic_viewport_mask_sweep"
        ? `polygon(0 0, ${overlayProgress * 100}% 0, ${overlayProgress * 100}% 100%, 0 100%)`
        : undefined),
  };

  // Transpiled Structured Animation & Text SVG Archetypes
  const archetypeEl = renderAnimationArchetype(fx, {
    frame,
    fps,
    text: layer.text,
    words,
    color: textColor,
    accentColor: layer.isHero ? "#00F0FF" : "#FFC107",
    fontFamily: layer.fontFamily,
    fontSizePx: isBehindSubject ? behindSubjectFontSize : layer.fontSizePx,
    fontWeight: layer.fontWeight,
    letterSpacingEm: layer.letterSpacingEm || 0,
    gradient: layer.gradient,
    glow: layer.glow,
    durationFrames: totalFrames,
    wordEntranceFrames,
    casing: layer.casing,
    fontStyle: layer.fontStyle,
    blendMode: (layer as any).blendMode,
    isSeeThrough: (layer as any).isSeeThrough,
  });
  if (archetypeEl) {
    return <div style={baseTextStyle}>{archetypeEl}</div>;
  }

  // 0a. TYPEWRITER GHOST CURSOR — Letter-by-letter rhythmic typewriter with blinking accent cursor
  if (fx === "typewriter_ghost_cursor" || fx === "kinetic_chromatic_typewriter") {
    const rawString = words.join(" ");
    const totalChars = rawString.length;
    const charsPerSec = 24;
    const charInterval = Math.max(1, Math.round(fps / charsPerSec));
    const charsVisible = Math.min(totalChars, Math.max(0, Math.floor(frame / charInterval)));
    const cursorBlink = Math.floor(frame / 6) % 2 === 0;

    return (
      <div style={baseTextStyle}>
        <span style={{
          display: "inline-block",
          whiteSpace: "pre-wrap",
          textShadow: kineticTextShadow("0 4px 20px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
        }}>
          {rawString.slice(0, charsVisible)}
        </span>
        {charsVisible <= totalChars && (
          <span style={{
            display: "inline-block",
            marginLeft: "2px",
            opacity: cursorBlink ? 1 : 0,
            color: textColor,
            fontWeight: 300,
            textShadow: `0 0 14px ${textColor}`,
          }}>
            |
          </span>
        )}
      </div>
    );
  }

  // 0b. CYBER MATRIX TEXT SCRAMBLE — Letter-by-letter random glyph decode into final characters
  if (fx === "cyber_matrix_text_scramble" || fx === "kinetic_cyber_grid_decode") {
    const glyphs = "01#@$%&*!?/<>~[]+";
    let globalCharIdx = 0;
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const charSpans = Array.from(word).map((ch) => {
            const charIdx = globalCharIdx++;
            const charStart = charIdx * 0.8;
            const localFrame = Math.max(0, frame - charStart);
            const isSettled = localFrame >= 7;
            const displayedChar = isSettled ? ch : glyphs[(charIdx + Math.floor(frame * 2)) % glyphs.length];
            const p = interpolate(localFrame, [0, 5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={`matrix-ch-${charIdx}`}
                style={{
                  display: "inline-block",
                  opacity: p,
                  color: isSettled ? undefined : textColor,
                  textShadow: kineticTextShadow(isSettled
                    ? "0 4px 20px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"
                    : `0 0 16px ${textColor}, 0 2px 8px rgba(0,0,0,0.95)`),
                  padding: "0 0.01em",
                }}
              >
                {displayedChar}
              </span>
            );
          });
          return (
            <span key={`matrix-w-${wIdx}`} style={{display: "inline-flex", whiteSpace: "nowrap", margin: "0 0.15em"}}>
              {charSpans}
            </span>
          );
        })}
      </div>
    );
  }

  // 0c. TOP-DOWN STAGGERED CHARACTER DROP — Elastic spring-dropped characters from above
  if (fx === "top_down_staggered_character_drop" || fx === "spring_character_drop") {
    let globalCharIdx = 0;
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const charSpans = Array.from(word).map((ch) => {
            const charIdx = globalCharIdx++;
            const charStart = charIdx * 0.75;
            const localFrame = Math.max(0, frame - charStart);
            const spr = spring({
              fps,
              frame: localFrame,
              config: { mass: 0.65, damping: 11, stiffness: 210 },
            });
            const translateY = interpolate(spr, [0, 1], [-42, 0]);
            const opacity = interpolate(spr, [0, 0.3, 1], [0, 0.9, 1]);
            const blur = interpolate(spr, [0, 0.7, 1], [8, 0, 0]);
            return (
              <span
                key={`drop-ch-${charIdx}`}
                style={{
                  display: "inline-block",
                  opacity,
                  transform: `translateY(${translateY}px)`,
                  filter: `blur(${blur}px)`,
                  padding: "0 0.01em",
                }}
              >
                {ch}
              </span>
            );
          });
          return (
            <span
              key={`drop-w-${wIdx}`}
              style={{
                display: "inline-flex",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                textShadow: kineticTextShadow("0 4px 20px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
              }}
            >
              {charSpans}
            </span>
          );
        })}
      </div>
    );
  }

  if (fx === "see_through_glass_letterform") {
    // Cinematic Difference-Mode Inversion & Frosted Glass Stencil:
    // Dynamically inverts underlying visual data (|255 - Background|) with razor-thin boundary stroke
    // to preserve glyph legibility across midtones and high-frequency borders.
    return (
      <div
        style={{
          ...baseTextStyle,
          fontSize: `${Math.max(140, layer.fontSizePx)}px`,
          fontWeight: 900,
          mixBlendMode: "difference",
          color: "#FFFFFF",
          WebkitTextFillColor: "#FFFFFF",
          backgroundImage: "none",
          WebkitBackgroundClip: "border-box",
          WebkitTextStroke: "0.85px rgba(255, 255, 255, 0.80)",
          textShadow: "-0.9px 0px 1.2px rgba(255, 0, 75, 0.75), 0.9px 0px 1.2px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)",
          letterSpacing: "-0.025em",
          whiteSpace: "nowrap",
          display: "inline-block",
        }}
      >
        {layer.text}
      </div>
    );
  }




  // Canva Tall Glyph Stack: Colossal, towering vertical display typography
  if (fx === "canva_tall_glyph_stack") {
    const entranceP = interpolate(frame, [0, 16], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
    });
    const blur = interpolate(entranceP, [0, 0.7, 1], [32, 2, 0]);
    const effectiveSize = isBehindSubject ? behindSubjectFontSize : layer.fontSizePx;
    const effScaleY = isBehindSubject ? behindSubjectScaleY : 1.15;
    const effScaleX = isBehindSubject ? behindSubjectScaleX : 1.0;
    return (
      <div
        style={{
          ...baseTextStyle,
          fontSize: `${effectiveSize}px`,
          transform: `scaleY(${effScaleY}) scaleX(${effScaleX * autoFitScale}) scale(${interpolate(entranceP, [0, 1], [0.94, 1.0])})`,
          filter: composeFilter(blur),
          letterSpacing: isBehindSubject ? behindMetrics.letterSpacing : (layer.letterSpacingEm ? `${layer.letterSpacingEm}em` : "-0.01em"),
          lineHeight: 0.85,
          flexDirection: "row",
          flexWrap: "nowrap",
          opacity: entranceP,
          position: "relative",
          maxWidth: "840px",
          width: "auto",
          boxSizing: "border-box",
          padding: "0 8px",
          justifyContent: "center",
          overflow: "visible",
        }}
      >
        {words.map((w, wIdx) => (
          <span
            key={`tall-word-${wIdx}`}
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              wordBreak: "keep-all",
              margin: "0 0.04em",
              ...wordPaintStyle,
              textShadow: kineticTextShadow(),
            }}
          >
            {w}
          </span>
        ))}
      </div>
    );
  }

  if (fx === "cinematic_distance_convergence") {
    return (
      <div
        style={{
          ...baseTextStyle,
          display: "inline-flex",
          flexWrap: "nowrap",
          whiteSpace: "nowrap",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {words.map((w, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
          const p = interpolate(localFrame, [0, 13], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
          });
          const blurPx = interpolate(p, [0, 1], [20, 0]);
          const filterVal = blurPx > 0.1
            ? `blur(${blurPx.toFixed(1)}px) ${wordPaintStyle.filter || ""}`.trim()
            : (wordPaintStyle.filter || undefined);
          return (
            <span
              key={`dist-conv-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.12em",
                ...wordPaintStyle,
                color: hasGrad ? undefined : textColor,
                WebkitTextFillColor: hasGrad ? "transparent" : textColor,
                opacity: p,
                letterSpacing: `${interpolate(p, [0, 1], [0.15, layer.letterSpacingEm || 0])}em`,
                transform: `scale(${interpolate(p, [0, 1], [1.12, 1])})`,
                filter: filterVal,
                textShadow: kineticTextShadow(),
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // HOOKS — Full Cinematic Hook Lingua Library (21 forms across 5 families)
  // Dynamic parameters are read from chunk.hookPlan (never hardcoded).
  // -------------------------------------------------------------------------
  const hookZoom = hookPlan?.zoom || hookPlan?.camera;
  const hookLensBlur = hookPlan?.lensBlur || hookPlan?.optical;
  const hookDirBlur = hookPlan?.directionalBlur;
  const hookOptical = hookPlan?.optical;
  const hookGlow = hookPlan?.brandGlow || hookPlan?.optical?.specularGlow || "255, 255, 255";
  const hookCurve = (curve: [number, number, number, number] | undefined): [number, number, number, number] => (curve ?? [0.16, 1.0, 0.3, 1.0]);

  // Family A: Optical Defocus, Bokeh & Bloom
  if (fx === "hook_bokeh_defocus_bloom") {
    const durationFrames = Math.max(1, Math.round(((hookLensBlur?.durationMs ?? 1100) / 1000) * fps));
    const p = Easing.bezier(...hookCurve(hookLensBlur?.curve))(interpolate(frame, [0, durationFrames], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }));
    const blur = interpolate(p, [0, 1], [hookLensBlur?.startBlurPx ?? 28, 0]);
    const scale = interpolate(p, [0, 1], [1.14, 1.0]);
    return (
      <div style={{
        ...baseTextStyle,
        transform: `scale(${fitScale(scale)})`,
        filter: `blur(${blur}px)`,
        textShadow: kineticTextShadow(`0 0 32px rgba(${hookGlow}, ${interpolate(p, [0, 0.5, 1], [0.9, 0.45, 0.15])}), 0 0 60px rgba(${hookGlow}, ${interpolate(p, [0, 1], [0.6, 0.0])})`),
        opacity: interpolate(p, [0, 0.25, 1], [0, 0.85, 1]),
      }}>
        {words.map((word, wIdx) => (
          <span key={`hook-bokeh-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  if (fx === "hook_gaussian_lens_reveal" || fx === "hook_camera_lens_blur_reveal") {
    const durationFrames = Math.max(1, Math.round(((hookLensBlur?.durationMs ?? 1200) / 1000) * fps));
    const p = Easing.bezier(...hookCurve(hookLensBlur?.curve))(interpolate(frame, [0, durationFrames], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }));
    const blur = interpolate(p, [0, 1], [hookLensBlur?.startBlurPx ?? 24, 0]);
    const brightness = interpolate(p, [0, 0.5, 1], [1.4, 1.15, 1.0]);
    const scale = interpolate(p, [0, 1], [1.08, 1.0]);
    return (
      <div style={{
        ...baseTextStyle,
        filter: `blur(${blur}px) brightness(${brightness})`,
        transform: `scale(${fitScale(scale)})`,
        opacity: interpolate(p, [0, 0.3, 1], [0, 0.85, 1]),
        textShadow: kineticTextShadow(`0 0 24px rgba(${hookGlow}, ${interpolate(p, [0, 0.6, 1], [0.7, 0.3, 0.1])})`),
      }}>
        {words.map((word, wIdx) => (
          <span key={`hook-gauss-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  if (fx === "hook_directional_whip_blur" || fx === "hook_directional_blur_sweep") {
    const durationFrames = Math.max(1, Math.round(((hookOptical?.durationMs ?? hookDirBlur?.durationMs ?? 900) / 1000) * fps));
    const p = Easing.bezier(...hookCurve(hookOptical?.curve ?? hookDirBlur?.curve ?? [0.08, 0.95, 0.2, 1.0]))(interpolate(frame, [0, durationFrames], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }));
    const blurX = interpolate(p, [0, 1], [hookOptical?.startBlurPx ?? 36, 0]);
    const tx = interpolate(p, [0, 1], [-60, 0]);
    const skewX = interpolate(p, [0, 1], [8, 0]);
    return (
      <div style={{
        ...baseTextStyle,
        transform: fitTransform(`translateX(${tx}px) skewX(${skewX}deg)`),
        filter: `blur(${blurX}px)`,
        opacity: interpolate(p, [0, 0.3, 1], [0, 0.9, 1]),
        textShadow: kineticTextShadow(`0 0 22px rgba(${hookGlow}, ${interpolate(p, [0, 0.5, 1], [0.6, 0.3, 0.1])})`),
      }}>
        {words.map((word, wIdx) => (
          <span key={`hook-whip-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  if (fx === "hook_radial_zoom_blur") {
    const durationFrames = Math.max(1, Math.round(((hookOptical?.durationMs ?? 800) / 1000) * fps));
    const p = Easing.bezier(...hookCurve(hookOptical?.curve ?? [0.34, 1.56, 0.64, 1.0]))(interpolate(frame, [0, durationFrames], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }));
    const scale = interpolate(p, [0, 1], [1.32, 1.0]);
    const blur = interpolate(p, [0, 0.8, 1], [20, 2, 0]);
    return (
      <div style={{
        ...baseTextStyle,
        transform: `scale(${fitScale(scale)})`,
        filter: `blur(${blur}px)`,
        opacity: interpolate(p, [0, 0.2, 1], [0, 0.85, 1]),
        textShadow: kineticTextShadow(`0 0 28px rgba(${hookGlow}, ${interpolate(p, [0, 0.5, 1], [0.75, 0.35, 0.1])})`),
      }}>
        {words.map((word, wIdx) => (
          <span key={`hook-rad-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  // Family B: Light, Flash & Optical Flares
  if (fx === "hook_sharp_white_flash_cut") {
    const flashFrames = Math.max(3, hookOptical?.flashDecayFrames ?? 8);
    const flashP = interpolate(frame, [0, flashFrames], [1, 0], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad),
    });
    const entranceP = interpolate(frame, [0, 7], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.4)),
    });
    const scale = interpolate(entranceP, [0, 1], [0.92, 1.0]);
    return (
      <div style={{
        ...baseTextStyle,
        transform: `scale(${scale})`,
        filter: `brightness(${1 + flashP * 1.8}) contrast(${1 + flashP * 0.4})`,
        opacity: entranceP,
        textShadow: kineticTextShadow(`0 0 ${interpolate(flashP, [0, 1], [12, 45])}px rgba(255,255,255,${flashP * 0.9 + 0.1})`),
      }}>
        {words.map((word, wIdx) => (
          <span key={`hook-flash-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  if (fx === "hook_anamorphic_flare_burst") {
    const durationFrames = Math.max(1, Math.round(((hookOptical?.durationMs ?? 1000) / 1000) * fps));
    const p = interpolate(frame, [0, durationFrames], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
    });
    const flareX = interpolate(p, [0, 1], [-120, 140]);
    return (
      <div style={{
        ...baseTextStyle,
        position: "relative",
        opacity: interpolate(p, [0, 0.25, 1], [0, 0.9, 1]),
        textShadow: kineticTextShadow(`0 0 24px rgba(0, 220, 255, 0.6), 0 0 45px rgba(255, 200, 50, 0.4)`),
      }}>
        <div style={{
          position: "absolute",
          top: "50%",
          left: `${flareX}%`,
          width: "220%",
          height: "3px",
          transform: "translate(-50%, -50%)",
          background: "linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.9) 45%, #FFFFFF 50%, rgba(255,215,0,0.9) 55%, transparent 100%)",
          filter: "blur(1px) drop-shadow(0 0 8px rgba(0,229,255,0.8))",
          pointerEvents: "none",
          zIndex: 2,
        }} />
        {words.map((word, wIdx) => (
          <span key={`hook-flare-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  if (fx === "hook_vintage_film_burn_strobe") {
    const p = interpolate(frame, [0, 16], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
    });
    const burnJitter = Math.sin(frame * 1.8) * 0.15 + 0.85;
    const warmBurn = hookOptical?.burnColor || "#FF8A00";
    return (
      <div style={{
        ...baseTextStyle,
        opacity: p,
        filter: `brightness(${interpolate(p, [0, 0.4, 1], [1.5, 1.2, 1.0]) * burnJitter})`,
        textShadow: kineticTextShadow(`0 0 26px ${warmBurn}, 0 2px 10px rgba(0,0,0,0.8)`),
      }}>
        {words.map((word, wIdx) => (
          <span key={`hook-burn-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  if (fx === "hook_luma_strobe_pulse") {
    const pulseIndex = Math.min(2, Math.floor(frame / 4));
    const isPulseFrame = (frame % 4) === 0 || (frame % 4) === 1;
    const lumaBoost = frame < 12 && isPulseFrame ? 1.6 : 1.0;
    const p = interpolate(frame, [0, 10], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
    });
    return (
      <div style={{
        ...baseTextStyle,
        opacity: p,
        filter: `brightness(${lumaBoost}) contrast(${lumaBoost > 1 ? 1.3 : 1.0})`,
        textShadow: kineticTextShadow(`0 0 ${lumaBoost > 1 ? 30 : 16}px rgba(${hookGlow}, 0.5)`),
      }}>
        {words.map((word, wIdx) => (
          <span key={`hook-luma-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  // Family C: Camera Dynamics & Spatial Motion
  if (fx === "hook_cinematic_dolly_zoom") {
    const durationFrames = Math.max(1, Math.round(((hookZoom?.durationMs ?? 900) / 1000) * fps));
    const zoomProgress = Easing.bezier(...hookCurve(hookZoom?.curve))(interpolate(frame, [0, durationFrames], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }));
    const startScale = hookZoom?.startScale ?? 0.94;
    const endScale = hookZoom?.endScale ?? 1.0;
    const scale = interpolate(zoomProgress, [0, 1], [startScale, endScale]);
    const blurPx = hookLensBlur
      ? interpolate(zoomProgress, [0, 1], [hookLensBlur.startBlurPx, hookLensBlur.endBlurPx], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})
      : 0;
    return (
      <div style={{...baseTextStyle, transform: `scale(${fitScale(scale)})`, filter: `blur(${blurPx}px)`, textShadow: kineticTextShadow(`0 0 20px rgba(${hookGlow}, ${interpolate(zoomProgress, [0, 0.4, 1], [0.6, 0.25, 0.12])})`)}}>
        {words.map((word, wIdx) => {
          const wp = interpolate(frame, [(wIdx * 2), (wIdx * 2) + 6], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic)});
          return <span key={`hook-dolly-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", opacity: wp, ...wordPaintStyle}}>{word}</span>;
        })}
      </div>
    );
  }

  if (fx === "hook_crash_zoom_snap") {
    const durationFrames = Math.max(1, Math.round(((hookZoom?.durationMs ?? 600) / 1000) * fps));
    const p = Easing.bezier(...hookCurve(hookZoom?.curve ?? [0.2, 1.8, 0.4, 1.0]))(interpolate(frame, [0, durationFrames], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }));
    const scale = interpolate(p, [0, 0.7, 1], [hookZoom?.startScale ?? 1.45, 0.97, 1.0]);
    const blur = interpolate(p, [0, 0.6, 1], [14, 2, 0]);
    return (
      <div style={{
        ...baseTextStyle,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
        opacity: interpolate(p, [0, 0.2, 1], [0, 0.9, 1]),
        textShadow: kineticTextShadow(`0 0 24px rgba(${hookGlow}, 0.45), 0 4px 18px rgba(0,0,0,0.9)`),
      }}>
        {words.map((word, wIdx) => (
          <span key={`hook-crash-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  if (fx === "hook_isometric_3d_slam") {
    const durationFrames = Math.max(1, Math.round(800 / 1000 * fps));
    const p = Easing.bezier(...hookCurve(hookZoom?.curve ?? [0.34, 1.56, 0.64, 1.0]))(interpolate(frame, [0, durationFrames], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }));
    const rotX = interpolate(p, [0, 1], [-38, 0]);
    const rotY = interpolate(p, [0, 1], [22, 0]);
    const scale = interpolate(p, [0, 1], [0.85, 1.0]);
    return (
      <div style={{
        ...baseTextStyle,
        transform: `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${scale})`,
        opacity: interpolate(p, [0, 0.3, 1], [0, 0.9, 1]),
        textShadow: kineticTextShadow(`0 12px 32px rgba(0,0,0,0.9), 0 0 20px rgba(${hookGlow}, 0.3)`),
      }}>
        {words.map((word, wIdx) => (
          <span key={`hook-iso-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  if (fx === "hook_vertical_kinetic_pedestal" || fx === "hook_full_zoom_up" || fx === "hook_smooth_zoom_in") {
    const durationFrames = Math.max(1, Math.round(900 / 1000 * fps));
    const progress = Easing.bezier(...hookCurve(hookZoom?.curve))(interpolate(frame, [0, durationFrames], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }));
    const scale = interpolate(progress, [0, 1], [fx === "hook_smooth_zoom_in" ? 0.92 : 0.82, 1.0]);
    const translateY = (fx === "hook_vertical_kinetic_pedestal" || fx === "hook_full_zoom_up")
      ? interpolate(progress, [0, 1], [32, 0])
      : 0;
    return (
      <div style={{
        ...baseTextStyle,
        transform: `translateY(${translateY}px) scale(${scale})`,
        opacity: interpolate(progress, [0, 0.3, 1], [0, 0.92, 1]),
        filter: `blur(${interpolate(progress, [0, 1], [8, 0])}px)`,
        textShadow: kineticTextShadow(`0 0 18px rgba(${hookGlow}, 0.35)`),
      }}>
        {words.map((word, wIdx) => (
          <span key={`hook-ped-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  // Family D: Digital Distortion, Glitch & Signal Artifacts
  // hook_rgb_chromatic_split_glitch branch removed: RGB channel-split
  // two-coloration treatment is banned from mini-run output.

  if (fx === "hook_crt_scanline_matrix_decode") {
    const p = interpolate(frame, [0, 14], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
    const revealedChars = Math.floor(interpolate(p, [0, 1], [0, layer.text.length]));
    const matrixChars = "!<>-_\\/[]{}—=+*^?#________";
    const displayText = layer.text.split("").map((char, cIdx) => {
      if (cIdx <= revealedChars) return char;
      if (char === " ") return " ";
      return matrixChars[(frame + cIdx * 3) % matrixChars.length];
    }).join("");
    return (
      <div style={{
        ...baseTextStyle,
        fontFamily: "Courier New, monospace, sans-serif",
        color: "#00FF88",
        textShadow: kineticTextShadow("0 0 16px rgba(0,255,136,0.8), 0 0 32px rgba(0,255,136,0.4)"),
        opacity: interpolate(p, [0, 0.2, 1], [0, 0.8, 1]),
      }}>
        {displayText}
      </div>
    );
  }

  if (fx === "hook_vhs_tape_tracking_tear") {
    const p = interpolate(frame, [0, 10], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
    const sliceDisplace = (frame < 8 && frame % 2 === 0) ? (Math.sin(frame * 6) * 12) : 0;
    return (
      <div style={{
        ...baseTextStyle,
        transform: `translateX(${sliceDisplace}px)`,
        filter: `contrast(${1.2 + (frame < 6 ? 0.3 : 0)})`,
        textShadow: kineticTextShadow("0 2px 10px rgba(0,0,0,0.8), -2px 0 #FF0055, 2px 0 #00FFFF"),
        opacity: p,
        ...wordPaintStyle,
      }}>
        {layer.text}
      </div>
    );
  }

  // Family E: Material, Luxury & Surface Shaders
  if (fx === "hook_metallic_chrome_reflection") {
    const p = interpolate(frame, [0, 18], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
    });
    const sweepPercent = interpolate(p, [0, 1], [-100, 200]);
    return (
      <div style={{
        ...baseTextStyle,
        background: `linear-gradient(135deg, #A1A1AA 0%, #FFFFFF 35%, #71717A 70%, #FFFFFF 100%)`,
        backgroundSize: "200% 200%",
        backgroundPosition: `${sweepPercent}% 50%`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.95)) drop-shadow(0 0 25px rgba(255,255,255,0.4))",
        transform: `scale(${interpolate(p, [0, 1], [0.92, 1.0])})`,
        opacity: p,
      }}>
        {layer.text}
      </div>
    );
  }

  if (fx === "hook_liquid_ink_metaball_reveal") {
    const p = interpolate(frame, [0, 15], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.2)),
    });
    const blur = interpolate(p, [0, 0.7, 1], [16, 2, 0]);
    const scale = interpolate(p, [0, 1], [0.86, 1.0]);
    return (
      <div style={{
        ...baseTextStyle,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
        opacity: interpolate(p, [0, 0.3, 1], [0, 0.88, 1]),
        textShadow: kineticTextShadow("0 4px 20px rgba(0,0,0,0.95), 0 0 16px rgba(255,255,255,0.2)"),
      }}>
        {words.map((word, wIdx) => (
          <span key={`hook-ink-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  if (fx === "hook_zora_aperture_mask_bloom" || fx === "zora_mask_reveal") {
    const p = interpolate(frame, [0, 14], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
    });
    const maskRadius = interpolate(p, [0, 1], [0, 100]);
    const maskShift = interpolate(p, [0, 1], [0, 30]);
    return (
      <div
        style={{
          ...baseTextStyle,
          WebkitMaskImage: `radial-gradient(circle at 50% 50%, black ${maskRadius}%, transparent ${maskRadius + 8}%)`,
          maskImage: `radial-gradient(circle at 50% 50%, black ${maskRadius}%, transparent ${maskRadius + 8}%)`,
          WebkitMaskPosition: `${maskShift}px 0`,
          maskPosition: `${maskShift}px 0`,
          textShadow: kineticTextShadow("0 2px 10px rgba(0,0,0,0.5), 0 0 22px rgba(255,255,255,0.15)"),
          opacity: interpolate(p, [0, 0.4, 1], [0, 0.85, 1]),
        }}
      >
        {words.map((word, wIdx) => (
          <span key={`zora-mask-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>{word}</span>
        ))}
      </div>
    );
  }

  if (fx === "hook_motion_blur_word") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
          const p = interpolate(localFrame, [0, 9], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
          });
          const blur = interpolate(p, [0, 0.8, 1], [18, 1.5, 0]);
          const tx = interpolate(p, [0, 1], [26, 0]);
          return (
            <span key={`hook-mblur-${wIdx}`} style={{
              display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em",
              opacity: p, transform: `translateX(${tx}px)`, filter: `blur(${blur}px)`,
              ...wordPaintStyle,
              textShadow: kineticTextShadow(`0 2px 10px rgba(0,0,0,0.45), 0 0 18px rgba(${hookGlow}, ${interpolate(p, [0, 0.5, 1], [0.5, 0.3, 0.1])})`),
            }}>
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated A: Pure Kinetic Optical Sparkle Entrance
  if (fx === "hand_drawn_kinetic_underline" || fx === "vector_stroke_sparkle") {
    return (
      <div style={{...baseTextStyle, display: "inline-flex", flexDirection: "column", alignItems: "center"}}>
        <div style={{display: "flex", flexDirection: "row", flexWrap: "nowrap", whiteSpace: "nowrap", justifyContent: "center"}}>
          {words.map((word, wIdx) => {
            const wordStart = wordEntranceFrames[wIdx] ?? 0;
            const localFrame = Math.max(0, frame - wordStart);
            const p = interpolate(localFrame, [0, 8], [0, 1], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
            });
            const translateY = interpolate(p, [0, 1], [8, 0]);
            const opacity = interpolate(p, [0, 0.4, 1], [0, 0.85, 1]);
            return (
              <span
                key={`sparkle-word-${wIdx}`}
                style={{
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  margin: "0 0.15em",
                  opacity,
                  transform: `translateY(${translateY}px)`,
                  ...wordPaintStyle,
                  textShadow: kineticTextShadow(),
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // Dedicated B: Metallic Chrome Counter & Countup Hero
  if (fx === "metallic_chrome_countup_hero" || fx === "metallic_chrome_counter" || fx === "apple_gaussian_chrome") {
    const isCounter = fx === "metallic_chrome_countup_hero" || fx === "metallic_chrome_counter";
    const sweepPercent = interpolate(frame, [0, 24], [-50, 150], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
          const p = interpolate(localFrame, [0, 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          });
          const scale = interpolate(p, [0, 0.65, 1], [0.92, 1.03, 1.0]);
          const translateY = interpolate(p, [0, 1], [20, 0]);
          const blur = interpolate(p, [0, 0.7, 1], [24, 2, 0]);

          const countDuration = Math.max(12, Math.min(Math.max(14, totalFrames - wordStart), Math.round(fps * 0.65)));
          const displayWord = isCounter && /\d/.test(word)
            ? resolveNumericCountUpValue({
                text: word,
                localFrame,
                durationFrames: countDuration,
                floorFrames: 12,
              })
            : word;

          return (
            <span
              key={`chrome-word-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                transform: `translateY(${translateY}px) scale(${scale})`,
                backgroundImage: `linear-gradient(135deg, #A1A1AA 0%, #FFFFFF 35%, ${layer.color || "#FF453A"} 50%, #FFFFFF 65%, #71717A 100%)`,
                backgroundSize: "200% 200%",
                backgroundPosition: `${sweepPercent}% 50%`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                WebkitTextStroke: "1.2px rgba(255, 255, 255, 0.8)",
                filter: composeFilter(blur, (layer.isHero && layer.glow) ? `drop-shadow(0 0 14px ${layer.glow})` : undefined),
              }}
            >
              {displayWord}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated C: Electric Neon Line Revealer & Horizontal Gradient Sweep
  if (fx === "electric_blue_emoji_line_revealer" || fx === "horizontal_gradient_sweep_fade" || fx === "sandstorm_grain_dissolve") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = frame >= wordStart && frame < nextStart;
          const p = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const sweepMask = `linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${p * 100}%, rgba(0,0,0,0) ${Math.min(100, p * 100 + 25)}%)`;
          return (
            <span
              key={`electric-word-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                maskImage: sweepMask,
                WebkitMaskImage: sweepMask,
                opacity: p,
                transform: `scale(${interpolate(p, [0, 1], [0.92, isActive ? 1.05 : 1.0])})`,
                filter: `drop-shadow(0 0 ${interpolate(p, [0, 0.5, 1], [18, 8, isActive ? 12 : 0])}px rgba(0, 240, 255, ${isActive ? 0.9 : 0.4}))`,
                ...wordPaintStyle,
                textShadow: kineticTextShadow(),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated D: Cinematic Apple Word Bounce
  if (fx === "cinematic_apple_word_bounce") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = frame >= wordStart && frame < nextStart;
          const p = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.8)),
          });
          const scale = interpolate(p, [0, 0.7, 1], [0.65, 1.12, isActive ? 1.06 : 1.0]);
          const translateY = interpolate(p, [0, 0.6, 1], [-22, 3, 0]);
          const blur = interpolate(p, [0, 0.5, 1], [10, 0, 0]);
          return (
            <span
              key={`apple-bounce-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                transform: `translateY(${translateY}px) scale(${scale})`,
                filter: `blur(${blur}px)`,
                ...wordPaintStyle,
                textShadow: kineticTextShadow("0 4px 20px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.90)"),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated E: Isometric Kinetic Perspective Stack
  if (fx === "isometric_kinetic_perspective_stack") {
    return (
      <div style={{...baseTextStyle, perspective: "800px"}}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = frame >= wordStart && frame < nextStart;
          const p = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.4)),
          });
          const rotX = interpolate(p, [0, 1], [28, 0]);
          const rotY = interpolate(p, [0, 1], [-16, 0]);
          const tz = interpolate(p, [0, 1], [60, isActive ? 30 : 0]);
          return (
            <span
              key={`iso-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                transform: `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(${tz}px) scale(${isActive ? 1.06 : 1.0})`,
                ...wordPaintStyle,
                textShadow: kineticTextShadow(
                  "1px 1px 0px rgba(255,255,255,0.4), 2px 2px 0px rgba(180,180,180,0.3), 3px 3px 0px rgba(120,120,120,0.2), 0 8px 24px rgba(0,0,0,0.95)"
                ),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated F: Textrotate Kinetic Word Cycler
  if (fx === "textrotate_kinetic_word_cycler") {
    return (
      <div style={{...baseTextStyle, perspective: "600px"}}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = frame >= wordStart && frame < nextStart;
          const p = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
          });
          const rotateX = interpolate(p, [0, 1], [90, 0]);
          const blur = interpolate(p, [0, 0.7, 1], [8, 0, 0]);
          return (
            <span
              key={`cycler-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                transform: `perspective(600px) rotateX(${rotateX}deg) scale(${isActive ? 1.06 : 1.0})`,
                transformOrigin: "center bottom",
                filter: `blur(${blur}px)`,
                ...wordPaintStyle,
                textShadow: kineticTextShadow(),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated G: Liquid Gooey Ink Morph
  if (fx === "liquid_gooey_ink_morph") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = frame >= wordStart && frame < nextStart;
          const p = interpolate(localFrame, [0, 9], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.5)),
          });
          const scale = interpolate(p, [0, 0.6, 1], [0.72, 1.08, isActive ? 1.06 : 1.0]);
          const blur = interpolate(p, [0, 0.5, 1], [16, 3, 0]);
          return (
            <span
              key={`gooey-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                transform: `scale(${scale})`,
                ...wordPaintStyle,
                filter: composeFilter(blur),
                textShadow: kineticTextShadow(`0 0 20px ${layer.glow || "rgba(255, 69, 58, 0.7)"}, 0 4px 18px rgba(0,0,0,0.95)`),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated H: Figma Collaborative Frame Expansion & Hybrid Slot
  if (fx === "figma_collaborative_frame_expansion" || fx === "hybrid_figma_kinetic_slot") {
    const p = interpolate(frame, [0, 9], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.25)),
    });
    return (
      <div
        style={{
          ...baseTextStyle,
          position: "relative",
          display: "inline-flex",
          padding: "8px 16px",
          border: `1.5px dashed rgba(168, 85, 247, ${interpolate(p, [0, 0.4, 1], [0, 0.8, 0.6])})`,
          borderRadius: "8px",
          boxShadow: `0 0 16px rgba(168, 85, 247, ${interpolate(p, [0, 1], [0.6, 0.2])})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-12px",
            left: "8px",
            background: "#A855F7",
            color: "#FFFFFF",
            fontSize: "11px",
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            opacity: interpolate(p, [0, 0.3, 1], [0, 1, 0.9]),
            transform: `translateY(${interpolate(p, [0, 1], [10, 0])}px)`,
          }}
        >
          Editor
        </div>
        {words.map((w, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const isActive = frame >= wordStart && frame < nextStart;
          const wp = interpolate(Math.max(0, frame - wordStart), [0, 6], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          return (
            <span
              key={`figma-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: wp,
                transform: `scale(${isActive ? 1.05 : 1.0})`,
                ...wordPaintStyle,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated I: Glow Search Pulsing Caret
  if (fx === "glow_search_pulsing_caret") {
    const caretBlink = Math.floor(frame / 6) % 2 === 0;
    return (
      <div
        style={{
          ...baseTextStyle,
          display: "inline-flex",
          alignItems: "center",
          background: "rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(12px)",
          border: "1.5px solid rgba(255, 255, 255, 0.25)",
          borderRadius: "32px",
          padding: "6px 20px",
          boxShadow: `0 0 24px ${layer.glow || "rgba(0, 240, 255, 0.4)"}, 0 4px 20px rgba(0,0,0,0.85)`,
        }}
      >
        {words.map((w, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const isActive = frame >= wordStart && frame < nextStart;
          const wp = interpolate(Math.max(0, frame - wordStart), [0, 6], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          return (
            <span
              key={`caret-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.12em",
                opacity: wp,
                transform: `scale(${isActive ? 1.05 : 1.0})`,
                ...wordPaintStyle,
              }}
            >
              {w}
            </span>
          );
        })}
        <span style={{opacity: caretBlink ? 1 : 0, color: layer.color || "#00F0FF", marginLeft: "4px", fontWeight: 300}}>|</span>
      </div>
    );
  }

  // Dedicated J: Dotted Grid Shimmer Wave & Elastic Pull
  if (fx === "dotted_grid_shimmer_wave" || fx === "dotted_grid_elastic_word_pull") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = frame >= wordStart && frame < nextStart;
          const p = interpolate(localFrame, [0, 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          });
          const scale = interpolate(p, [0, 0.65, 1], [0.92, isActive ? 1.04 : 1.02, 1.0]);
          const translateY = interpolate(p, [0, 1], [24, 0]);
          const blur = interpolate(p, [0, 0.7, 1], [24, 2, 0]);
          const shimmer = 0.5 + Math.sin(localFrame * 0.35 + wIdx) * 0.5;
          return (
            <span
              key={`dotgrid-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                transform: `translateY(${translateY}px) scale(${scale})`,
                filter: composeFilter(blur),
                ...wordPaintStyle,
                textShadow: kineticTextShadow(`0 0 16px rgba(255, 215, 0, ${shimmer * 0.8}), 0 4px 18px rgba(0,0,0,0.95)`),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated K: Geometric Circle Inversion
  if (fx === "geometric_circle_inversion") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = frame >= wordStart && frame < nextStart;
          const p = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
          });
          return (
            <span
              key={`circle-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                clipPath: `circle(${p * 75}% at 50% 50%)`,
                opacity: p,
                transform: `scale(${interpolate(p, [0, 1], [0.88, isActive ? 1.05 : 1.0])})`,
                ...wordPaintStyle,
                textShadow: kineticTextShadow(),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated L: High-Tech Chromatic Brands & Phrase Expansion
  if (fx === "hightech_chromatic_brands" || fx === "kinetic_cyber_phrase_expansion") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = frame >= wordStart && frame < nextStart;
          const p = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
          });
          const rgbOffset = interpolate(p, [0, 0.7, 1], [6, 1, isActive ? 2 : 0]);
          return (
            <span
              key={`hightech-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                transform: `scale(${interpolate(p, [0, 1], [0.92, isActive ? 1.06 : 1.0])})`,
                textShadow: kineticTextShadow(
                  `-${rgbOffset}px 0px rgba(255, 0, 50, 0.8), ${rgbOffset}px 0px rgba(0, 240, 255, 0.8), 0 4px 18px rgba(0,0,0,0.95)`
                ),
                ...wordPaintStyle,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated M: Cyber Acid Lime Glitch with Matrix Chromatic Displacement
  if (fx === "cyber_acid_lime_glitch" || fx === "kinetic_dynamic_slant") {
    const limeColor = "#CCFF00";
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = frame >= wordStart && frame < nextStart;
          const p = interpolate(localFrame, [0, 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.back(1.5)),
          });
          // High-cadence micro-glitch during entrance and periodic sync pulses
          const isGlitching = (localFrame < 8 && localFrame % 2 === 1) || (isActive && (frame + wIdx * 3) % 17 === 0);
          const jitterX = isGlitching ? Math.sin(localFrame * 4.2 + wIdx) * 6 : 0;
          const jitterY = isGlitching ? Math.cos(localFrame * 3.1 + wIdx) * 2 : 0;
          const skewX = isGlitching ? Math.sin(localFrame) * 12 : interpolate(p, [0, 1], [-14, 0]);
          const rgbOffset = isGlitching ? 4 : interpolate(p, [0, 0.5, 1], [6, 2, 0]);

          return (
            <span
              key={`lime-glitch-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                color: isGlitching ? limeColor : undefined,
                transform: `translate3d(${jitterX}px, ${jitterY}px, 0) skewX(${skewX}deg) scale(${interpolate(p, [0, 1], [0.90, isActive ? 1.05 : 1.0])})`,
                ...wordPaintStyle,
                textShadow: kineticTextShadow(
                  rgbOffset > 0
                    ? `-${rgbOffset}px 0px rgba(255, 0, 50, 0.85), ${rgbOffset}px 0px rgba(0, 240, 255, 0.85), 0 0 12px ${limeColor}`
                    : `0 0 14px ${limeColor}, 0 4px 18px rgba(0,0,0,0.95)`
                ),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated N: Kinetic Glow Sweep & Word Fast Pulse
  if (fx === "kinetic_glow_sweep" || fx === "kinetic_word_fast_pulse") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = frame >= wordStart && frame < nextStart;
          const p = interpolate(localFrame, [0, 6], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.6)),
          });
          const pulse = isActive ? (1.0 + Math.sin(localFrame * 0.5) * 0.05) : 1.0;
          return (
            <span
              key={`pulse-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                transform: `scale(${interpolate(p, [0, 1], [0.82, 1.0]) * pulse})`,
                textShadow: kineticTextShadow(`0 0 ${isActive ? 28 : 16}px ${layer.glow || "rgba(255, 69, 58, 0.85)"}, 0 4px 18px rgba(0,0,0,0.95)`),
                ...wordPaintStyle,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated O: LED Dot Matrix Scanline
  if (fx === "led_dot_matrix_scanline") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = frame >= wordStart && frame < nextStart;
          const p = interpolate(localFrame, [0, 7], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          return (
            <span
              key={`led-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                color: layer.color || "#00FF78",
                letterSpacing: "0.08em",
                transform: `scale(${isActive ? 1.05 : 1.0})`,
                textShadow: kineticTextShadow(`0 0 ${isActive ? 18 : 10}px rgba(0, 255, 120, 0.85), 0 4px 18px rgba(0, 0, 0, 0.95)`),
                filter: "contrast(1.2) brightness(1.1)",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated P: Lavender & Vercel Highlight Selection Badges
  if (fx === "lavender_highlight_selection" || fx === "vercel_kinetic_highlight_box") {
    const isVercel = fx === "vercel_kinetic_highlight_box";
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const swap = layer.inlineTokenSwaps?.find((s) => s.wordIndex === wIdx);
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = swap ? true : (frame >= wordStart && frame < nextStart);
          const p = interpolate(localFrame, [0, 7], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
          });
          const targetScale = (swap as any)?.scaleMultiplier ?? (isActive ? 1.05 : 1.0);
          const isHighlightTarget = Boolean(swap?.highlightBox || isActive);
          return (
            <span
              key={`highlight-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                transform: `scale(${interpolate(p, [0, 1], [0.92, isHighlightTarget ? targetScale : 1.0])})`,
                backgroundColor: isHighlightTarget
                  ? (isVercel ? "rgba(255, 255, 255, 0.20)" : "rgba(168, 85, 247, 0.25)")
                  : "transparent",
                border: isHighlightTarget
                  ? (isVercel ? "1px solid rgba(255, 255, 255, 0.35)" : "1px solid rgba(192, 132, 252, 0.35)")
                  : "1px solid transparent",
                borderRadius: "8px",
                padding: "2px 8px",
                boxShadow: isHighlightTarget
                  ? (isVercel ? "0 4px 16px rgba(255, 255, 255, 0.25)" : "0 0 20px rgba(168, 85, 247, 0.50)")
                  : "none",
                ...wordPaintStyle,
                WebkitBackgroundClip: undefined,
                WebkitTextFillColor: undefined,
                color: isHighlightTarget ? "#FFFFFF" : "rgba(255, 255, 255, 0.88)",
                textShadow: isHighlightTarget
                  ? (isVercel ? "0 0 14px rgba(255, 255, 255, 0.7)" : "0 0 18px rgba(192, 132, 252, 0.85), 0 2px 8px rgba(0, 0, 0, 0.9)")
                  : kineticTextShadow("0 2px 10px rgba(0, 0, 0, 0.85)"),
              }}
            >
              {(swap as any)?.token || swap?.pattern || word}
            </span>
          );
        })}
      </div>
    );
  }

  // 1. FOCUS HUNTING BOKEH SHIMMER (Soft optical defocus hunt & crisp lock)
  if (fx === "focus_hunting_bokeh_shimmer" || fx === "camera_rack_focus_hunt") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
          
          const blur = interpolate(localFrame, [0, 10], [24, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          });
          const scale = interpolate(localFrame, [0, 10], [0.95, 1.0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          });
          const translateY = interpolate(localFrame, [0, 10], [14, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          });
          const opacity = interpolate(localFrame, [0, 7], [0, 1.0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const shimmerGlow = interpolate(localFrame, [5, 8, 12], [0, 0.45, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <span
              key={`focus-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.14em",
                opacity,
                transform: `translateY(${translateY}px) scale(${scale})`,
                ...wordPaintStyle,
                filter: composeFilter(blur),
                textShadow: kineticTextShadow(`0 4px 18px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.90), 0 0 16px rgba(245,230,196,${shimmerGlow})`),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // 2. GAUSSIAN BLUR LETTER-BY-LETTER SWEEP & BUTTERY EDITORIAL REVEALER
  // Realizes the buttery, deep Gaussian blur dissipation from the reference design:
  // - Deep Gaussian blur: 28px-32px smoothly melting to 0px
  // - Subtle vertical lift: 16px -> 0px on cubic-bezier(0.16, 1.0, 0.3, 1.0)
  // - Zero clipping (overflow: visible) preserving full serif ascenders/descenders
  if (
    fx === "gaussian_blur_reveal_sweep" ||
    fx === "blur_reveal_sweep" ||
    fx === "gaussian_blur_letter_reveal" ||
    fx === "letter_gaussian_blur_sweep" ||
    fx === "royal_gaussian_blur_letter_sweep" ||
    fx === "royal_behind_subject_sweep" ||
    fx === "apple_pro_display_hero_revealer" ||
    fx === "pro_revealer" ||
    fx === "apple_mask_blur_revealer" ||
    fx === "apple_slide_up_reveal" ||
    fx === "stagger_blur_word_reveal"
  ) {
    const isRoyal = fx.includes("royal") || Boolean(layer.behindSubject);
    // Cursive script letters must NEVER be split into individual character spans as it breaks ligatures.
    // Whole-word animation ensures script glyphs remain continuous and unbroken.
    const isWordLevel = fx === "stagger_blur_word_reveal" || effectiveIsScript;
    let globalCharIndex = 0;
    // Dynamic duration scaling: ensure animations finish in the first 55% of the chunk window,
    // guaranteeing no late words or characters get truncated on unmount.
    const durationFrames = Math.max(
      4,
      Math.min(
        Math.round((isRoyal ? 0.85 : 0.75) * fps),
        Math.floor(totalFrames * 0.55)
      )
    );
    const staggerFrames = Math.max(
      0.3,
      Math.min(fps * 0.035, (totalFrames * 0.35) / Math.max(1, words.length * 4))
    );

    if (isWordLevel) {
      return (
        <div
          style={{
            ...baseTextStyle,
            display: "inline-flex",
            flexWrap: "nowrap",
            whiteSpace: "nowrap",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {words.map((word, wIdx) => {
            const wordStart = wordEntranceFrames[wIdx] ?? 0;
            const localFrame = Math.max(0, frame - wordStart);
            const p = interpolate(localFrame, [0, durationFrames], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
            });
            const translateY = interpolate(p, [0, 1], [16, 0]);
            const scale = interpolate(p, [0, 1], [0.95, 1.0]);
            const blur = interpolate(p, [0, 0.7, 1], [28, 3.5, 0]);
            const opacity = interpolate(p, [0, 0.45, 1], [0, 0.9, 1]);

            return (
              <span
                key={`stagger-blur-word-${wIdx}`}
                style={{
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  margin: "0 0.16em",
                  opacity,
                  transform: `translateY(${translateY}px) scale(${scale})`,
                  willChange: "transform, opacity, filter",
                  ...wordPaintStyle,
                  filter: blur > 0.05 ? composeFilter(blur) : wordPaintStyle.filter,
                  textShadow: kineticTextShadow(
                    isRoyal
                      ? "0 6px 28px rgba(0, 0, 0, 0.98), 0 2px 10px rgba(0, 0, 0, 0.92)"
                      : "0 4px 20px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.90)"
                  ),
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      );
    }

    return (
      <div
        style={{
          ...baseTextStyle,
          display: "inline-flex",
          flexWrap: "nowrap",
          whiteSpace: "nowrap",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const letters = Array.from(word);
          const wordCharStartIndex = globalCharIndex;
          globalCharIndex += letters.length + 1;

          const charSpans = letters.map((char, cIdx) => {
            const charStagger = (wordCharStartIndex + cIdx) * staggerFrames;
            const localFrame = Math.max(0, frame - (wordStart + charStagger));
            const p = interpolate(localFrame, [0, durationFrames], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
            });

            const translateY = interpolate(p, [0, 1], [16, 0]);
            const scale = interpolate(p, [0, 1], [isRoyal ? 0.92 : 0.94, 1.0]);
            const blur = interpolate(p, [0, 0.7, 1], [isRoyal ? 32 : 28, 4, 0]);
            const opacity = interpolate(p, [0, 0.45, 1], [0, 0.9, 1]);

            return (
              <span
                key={`char-mask-${wIdx}-${cIdx}`}
                style={{
                  display: "inline-block",
                  overflow: "visible",
                  verticalAlign: "bottom",
                  padding: "0 0.015em",
                  lineHeight: "inherit",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    opacity,
                    transform: `translateY(${translateY}px) scale(${scale})`,
                    letterSpacing: isRoyal ? "0.08em" : undefined,
                    willChange: "transform, opacity, filter",
                    ...wordPaintStyle,
                    filter: blur > 0.05 ? composeFilter(blur) : wordPaintStyle.filter,
                    textShadow: kineticTextShadow(
                      isRoyal
                        ? "0 6px 28px rgba(0, 0, 0, 0.98), 0 2px 10px rgba(0, 0, 0, 0.92)"
                        : "0 4px 20px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.90)"
                    ),
                  }}
                >
                  {char}
                </span>
              </span>
            );
          });

          return (
            <span
              key={`blur-word-${wIdx}`}
              style={{
                display: "inline-flex",
                whiteSpace: "nowrap",
                margin: "0 0.16em",
              }}
            >
              {charSpans}
            </span>
          );
        })}
      </div>
    );
  }

  // 3. ELEGANT PER-WORD SPRING BLUR PHYSICS ENGINE (Remotion spring physics)
  if (fx === "spring_blur_physics_engine" || fx === "elegant_paraword_spring_bloom" || fx === "spring_physics") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
          const spr = spring({
            fps,
            frame: localFrame,
            config: fx === "elegant_paraword_spring_bloom"
              ? { mass: 1.05, damping: 18, stiffness: 105 }
              : { mass: 0.7, damping: 12, stiffness: 170 },
          });
          const scale = interpolate(spr, [0, 1], [0.84, 1.0]);
          const translateY = interpolate(spr, [0, 1], [18, 0]);
          const blur = interpolate(spr, [0, 0.8, 1], [16, 1, 0]);
          const opacity = interpolate(spr, [0, 0.3, 1], [0, 0.9, 1]);

          return (
            <span
              key={`spring-word-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity,
                transform: `translateY(${translateY}px) scale(${scale})`,
                ...wordPaintStyle,
                filter: composeFilter(blur),
                textShadow: kineticTextShadow("0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // 3b. MOTION CREATIVE KINETIC WAVE SLOT ENGINE (Measured word wave)
  if (fx === "motion_creative_kinetic_wave_slot_engine") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const localFrame = Math.max(0, frame - (wordEntranceFrames[wIdx] ?? 0));
          const p = interpolate(localFrame, [0, 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const wave = Math.sin(Math.min(localFrame, 18) * 0.45 + wIdx * 0.9) * (1 - p) * 18;
          return (
            <span
              key={`wave-slot-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                transform: `translateY(${wave}px) scale(${interpolate(p, [0, 1], [0.9, 1])})`,
                ...wordPaintStyle,
                filter: composeFilter(interpolate(p, [0, 1], [12, 0])),
                textShadow: kineticTextShadow("0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // 4. KINETIC SLOT / FIGMA CHARACTER REEL ENGINE (Vertical character reel odometer slot)
  if (fx === "kinetic_slot_character_reel" || fx === "staggered_glyph_slot") {
    let globalCharIdx = 0;
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const charSpans = Array.from(word).map((ch) => {
            const charIdx = globalCharIdx++;
            const charStart = charIdx * 0.9;
            const localFrame = Math.max(0, frame - charStart);
            const spr = spring({
              fps,
              frame: localFrame,
              config: { mass: 0.6, damping: 11, stiffness: 190 },
            });
            const translateY = interpolate(spr, [0, 1], [100, 0]);
            const blur = interpolate(spr, [0, 0.7, 1], [8, 0, 0]);
            const opacity = interpolate(spr, [0, 0.3, 1], [0, 0.9, 1]);

            return (
              <span
                key={`slot-ch-${charIdx}`}
                style={{
                  display: "inline-block",
                  overflow: "hidden",
                  height: "1.15em",
                  verticalAlign: "bottom",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    opacity,
                    transform: `translateY(${translateY}%)`,
                    padding: "0 0.01em",
                    ...wordPaintStyle,
                    filter: composeFilter(blur),
                  }}
                >
                  {ch}
                </span>
              </span>
            );
          });

          return (
            <span
              key={`slot-word-${wIdx}`}
              style={{
                display: "inline-flex",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                textShadow: kineticTextShadow("0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
              }}
            >
              {charSpans}
            </span>
          );
        })}
      </div>
    );
  }

  // 5. APPLE KEYNOTE HEADLINE PUNCH (Per-word scale bounce + blur dissipation)
  if (fx === "apple_keynote_headline_punch" || fx === "keynote_punch") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
          const p = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.back(1.4)),
          });
          const scale = interpolate(p, [0, 0.7, 1], [0.88, 1.04, 1.0]);
          const blur = interpolate(p, [0, 0.6, 1], [10, 0, 0]);
          const opacity = interpolate(p, [0, 0.3, 1], [0, 0.9, 1]);

          return (
            <span
              key={`keynote-word-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity,
                transform: `scale(${scale})`,
                ...wordPaintStyle,
                filter: composeFilter(blur),
                textShadow: kineticTextShadow("0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }


  // 7. DYNAMIC STAGGERED CHARACTER CASCADE (Gentle 3D spring cascade)
  if (fx === "dynamic_staggered_character_cascade" || fx === "spring_character_cascade") {
    let charCounter = 0;
    return (
      <div style={{ ...baseTextStyle, perspective: "500px" }}>
        {words.map((w, wIdx) => {
          const charSpans = Array.from(w).map((ch) => {
            const charIdx = charCounter++;
            const charStart = charIdx * 0.8;
            const p = interpolate(frame - charStart, [0, 7], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.back(1.5)),
            });
            const translateY = interpolate(p, [0, 0.7, 1], [18, -2, 0]);
            const scale = interpolate(p, [0, 0.7, 1], [0.80, 1.03, 1.0]);
            const rotateX = interpolate(p, [0, 0.7, 1], [30, -3, 0]);
            const blur = interpolate(p, [0, 0.6, 1], [6, 0, 0]);

            return (
              <span
                key={`cascade-${charIdx}`}
                style={{
                  display: "inline-block",
                  opacity: p,
                  transform: `translateY(${translateY}px) scale(${scale}) perspective(400px) rotateX(${rotateX}deg)`,
                  padding: "0 0.02em",
                  ...wordPaintStyle,
                  filter: composeFilter(blur),
                }}
              >
                {ch}
              </span>
            );
          });

          return (
            <span
              key={`cascade-word-${wIdx}`}
              style={{
                display: "inline-flex",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                textShadow: kineticTextShadow("0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
              }}
            >
              {charSpans}
            </span>
          );
        })}
      </div>
    );
  }

  // 8. CINEMATIC VIEWPORT MASK SWEEP / APPLE SLIDE UP REVEAL (Smooth word-by-word upward slide reveal)
  if (fx === "cinematic_viewport_mask_sweep" || fx === "viewport_mask_sweep" || fx === "apple_slide_up_reveal") {
    return (
      <div
        style={{
          ...baseTextStyle,
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          whiteSpace: "nowrap",
          justifyContent: ((layer as any).alignSelf === "flex-start" || (layer as any).alignSelf === "left") ? "flex-start" : (((layer as any).alignSelf === "flex-end" || (layer as any).alignSelf === "right") ? "flex-end" : "center"),
          textShadow: kineticTextShadow("0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
        }}
      >
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
          const p = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const translateY = interpolate(p, [0, 1], [14, 0]);
          const opacity = interpolate(p, [0, 0.35, 1], [0, 0.75, 1]);
          const clipP = interpolate(p, [0, 1], [0, 100]);

          return (
            <span
              key={`mask-sweep-word-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.16em",
                opacity,
                transform: `translateY(${translateY.toFixed(1)}px)`,
                clipPath: `polygon(0 0, 100% 0, 100% ${clipP}%, 0 ${clipP}%)`,
                ...wordPaintStyle,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // 8b. SOFT PIXEL BLOW-UP MASK (Defocused pixel bloom resolves to type)
  if (fx === "soft_pixel_blowup_mask") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const localFrame = Math.max(0, frame - (wordEntranceFrames[wIdx] ?? 0));
          const p = interpolate(localFrame, [0, 11], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          return (
            <span
              key={`pixel-bloom-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: interpolate(p, [0, 0.25, 1], [0, 0.75, 1]),
                transform: `scale(${interpolate(p, [0, 0.72, 1], [1.28, 0.96, 1])})`,
                ...wordPaintStyle,
                filter: composeFilter(interpolate(p, [0, 0.65, 1], [20, 3, 0])),
                textShadow: kineticTextShadow(`0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90), 0 0 ${interpolate(p, [0, 1], [30, 8])}px rgba(245,230,196,${interpolate(p, [0, 1], [0.85, 0.28])})`),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // 9. OBSIDIAN HEAVY GROTESQUE PUNCH
  if (fx === "obsidian_heavy_grotesque") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const nextStart = wordEntranceFrames[wIdx + 1] ?? (totalFrames + 10);
          const localFrame = Math.max(0, frame - wordStart);
          const isActive = frame >= wordStart && frame < nextStart;
          const p = interpolate(localFrame, [0, 7], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.back(1.4)),
          });
          const scale = interpolate(p, [0, 0.7, 1], [0.88, 1.04, isActive ? 1.06 : 1.0]);
          const blur = interpolate(p, [0, 0.5, 1], [8, 0, 0]);
          return (
            <span
              key={`obsidian-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity: p,
                transform: `scale(${scale})`,
                ...wordPaintStyle,
                filter: composeFilter(blur),
                textShadow: kineticTextShadow("0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // 10. SUBPIXEL GLOW MASK (Companion layer clean per-word entrance)
  if (fx === "subpixel_glow_mask") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
          // Cinematic deblur rise ~0.6s on the reference expo-out curve.
          const p = interpolate(localFrame, [0, 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          });
          const translateY = interpolate(p, [0, 1], [14, 0]);
          const scale = interpolate(p, [0, 1], [0.96, 1.0]);
          const blur = interpolate(p, [0, 0.7, 1], [24, 3, 0]);
          const opacity = interpolate(p, [0, 0.45, 1], [0, 0.9, 1]);

          return (
            <span
              key={`subpixel-word-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity,
                transform: `translateY(${translateY}px) scale(${scale})`,
                ...wordPaintStyle,
                filter: composeFilter(blur),
                textShadow: kineticTextShadow("0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // BLUE LANTERN MAGNETIC — faithful port of blue-lantern-magnetic.html.
  //   single word : rise+deblur 1.1s cubic-bezier(0.16,1,0.3,1) (48px, blur 16px)
  //                 char compression 2.0s cubic-bezier(0.12,1,0.22,1) (22px -> -1.5px)
  //   multi word  : per-word fast rise 0.65s (36px, blur 14px), micro char squeeze
  //                 1.4s cubic-bezier(0.12,1,0.22,1) (0.14em -> -0.025em), macro word
  //                 squeeze 2.2s cubic-bezier(0.1,0.95,0.2,1) (+-1.8em -> -+0.06em),
  //                 0.12s per-word stagger.
  // Durations are fps-scaled and clamped so short chunks still complete the move.
  if (fx === "blue_lantern_magnetic") {
    const singleWord = words.length <= 1;
    const centerWordIndex = (words.length - 1) / 2;
    const lanternBlue = "rgba(0, 162, 255, 0.55)";
    const easeRise: [number, number, number, number] = [0.16, 1.0, 0.3, 1.0];
    const easeSqueeze: [number, number, number, number] = [0.12, 1.0, 0.22, 1.0];
    const easeMacro: [number, number, number, number] = [0.1, 0.95, 0.2, 1.0];
    const staggerFrames = Math.max(1, Math.round(fps * 0.12));
    const clampDur = (ms: number): number => Math.max(1, Math.min((ms / 1000) * fps, totalFrames));
    const singleRiseFrames = clampDur(1100);
    const singleSqueezeFrames = clampDur(2000);
    const multiRiseFrames = clampDur(650);
    const microSqueezeFrames = clampDur(1400);
    const macroSqueezeFrames = clampDur(2200);
    const glyphEm = Math.max(80, layer.fontSizePx);

    const wordWraps = words.map((word, wIdx) => {
      const wordStart = wordEntranceFrames[wIdx] ?? 0;
      const localFrame = Math.max(0, frame - wordStart);
      const wordOffset = wIdx - centerWordIndex;
      const wordDelayFrames = wIdx * staggerFrames;

      // Phase 1 (rise + deblur): expo-out elevation, rack focus.
      const riseP = interpolate(
        localFrame,
        [0, (singleWord ? singleRiseFrames : multiRiseFrames) + wordDelayFrames],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(...easeRise),
        },
      );
      const translateY = interpolate(riseP, [0, 1], singleWord ? [48, 0] : [36, 0]);
      const blurPx = interpolate(riseP, [0, 1], singleWord ? [16, 0] : [14, 0]);

      // Phase 2 (squeeze): magnetic inward compression on the reference curves.
      // single word: char compression 2.0s ease-squeeze · multi: macro 2.2s ease-macro
      const squeezeT = Easing.bezier(...(singleWord ? easeSqueeze : easeMacro))(interpolate(
        localFrame,
        [0, (singleWord ? singleSqueezeFrames : macroSqueezeFrames) + wordDelayFrames],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      ));
      const microSqueezeT = Easing.bezier(...easeSqueeze)(interpolate(
        localFrame,
        [0, microSqueezeFrames + wordDelayFrames],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      ));
      const macroStartX = singleWord ? 0 : wordOffset * 1.8;
      const macroEndX = singleWord ? 0 : wordOffset * -0.06;
      const macroX = macroStartX + (macroEndX - macroStartX) * squeezeT;

      const charWraps = Array.from(word).map((char, cIdx) => {
        const charOffset = cIdx - (word.length - 1) / 2;
        const microStartX = singleWord ? (charOffset * 22) / glyphEm : charOffset * 0.14;
        const microEndX = singleWord ? (charOffset * -1.5) / glyphEm : charOffset * -0.025;
        const microX = microStartX + (microEndX - microStartX) * (singleWord ? squeezeT : microSqueezeT);
        return (
          <span
            key={`blm-char-${wIdx}-${cIdx}`}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              transform: `translate3d(${(microX + macroX).toFixed(3)}em, 0, 0)`,
              opacity: riseP,
            }}
          >
            {char}
          </span>
        );
      });

      return (
        <span
          key={`blm-word-${wIdx}`}
          style={{
            display: "inline-block",
            whiteSpace: "nowrap",
            margin: "0 0.10em",
            transform: `translateY(${translateY.toFixed(2)}px)`,
            ...wordPaintStyle,
            filter: composeFilter(blurPx),
            color: layer.isHero ? "#00A2FF" : wordPaintStyle.color,
            WebkitTextFillColor: layer.isHero ? "#00A2FF" : wordPaintStyle.WebkitTextFillColor,
            textShadow: layer.isHero
              ? `0 0 30px ${lanternBlue}, 0 4px 14px rgba(0, 0, 0, 0.95)`
              : kineticTextShadow("0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
          }}
        >
          {charWraps}
        </span>
      );
    });

    return (
      <div style={baseTextStyle}>
        {wordWraps}
      </div>
    );
  }

  // Universal Fallback Return
  return (
    <div style={baseTextStyle}>
      {words.map((word, wIdx) => {
        const swap = layer.inlineTokenSwaps?.find((s) => s.wordIndex === wIdx);
        const tokenText = (swap as any)?.token || swap?.pattern || word;
        const spanStyle: React.CSSProperties = {
          display: "inline-block",
          whiteSpace: "nowrap",
          margin: "0 0.15em",
          ...wordPaintStyle,
          textShadow: kineticTextShadow(),
        };

        if (swap) {
          if (swap.fontFamily) spanStyle.fontFamily = `"${swap.fontFamily}", sans-serif`;
          if (swap.fontWeight) spanStyle.fontWeight = swap.fontWeight as any;
          if (swap.fontStyle) spanStyle.fontStyle = swap.fontStyle as any;
          if (swap.color) {
            spanStyle.color = swap.color;
            spanStyle.WebkitTextFillColor = swap.color;
          }
          const scaleMult = (swap as any).scaleMultiplier;
          const yOff = (swap as any).yOffsetPx;
          if (scaleMult || yOff) {
            spanStyle.transform = `scale(${scaleMult ?? 1.0}) translateY(${yOff ?? 0}px)`;
          }
          const isHighlightBox = Boolean(swap.highlightBox);
          if (isHighlightBox) {
            const boxColor = (typeof swap.highlightBox === "object" && (swap.highlightBox as any)?.color) || swap.color || "#EF4444";
            const boxRadius = (typeof swap.highlightBox === "object" && (swap.highlightBox as any)?.borderRadiusPx) ?? 6;
            const boxPadding = (typeof swap.highlightBox === "object" && (swap.highlightBox as any)?.paddingPx) ?? 4;
            spanStyle.backgroundColor = boxColor;
            spanStyle.borderRadius = `${boxRadius}px`;
            spanStyle.padding = `${boxPadding}px 8px`;
            spanStyle.boxDecorationBreak = "clone";
            spanStyle.WebkitBoxDecorationBreak = "clone";
          }
        }

        return (
          <span
            key={`default-word-${wIdx}`}
            style={spanStyle}
          >
            {tokenText}
          </span>
        );
      })}
    </div>
  );

};
// ---------------------------------------------------------------------------
const ListicleRenderer: React.FC<{
  listicle: NonNullable<CaptionChunk["listicle"]>;
  frame: number;
  fps: number;
  palette?: CaptionChunk["palette"];
}> = ({ listicle, frame, fps, palette }) => {
  const brandPrimary = palette?.hero_color || "#C084FC";
  const brandAccent = palette?.accent_border || "#A78BFA";
  const brandGlow = palette?.glow || `0 0 20px ${brandPrimary}88`;

  // Mode A: "List & Blur" Retention Teaser
  if (listicle.mode === "teaser_blur" && listicle.teaserItems && listicle.teaserItems.length > 0) {
    const listEntrance = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
          maxWidth: "760px",
          marginBottom: "16px",
          transform: `scale(${interpolate(listEntrance, [0, 1], [0.92, 1.0])})`,
          opacity: listEntrance,
        }}
      >
        {listicle.badgeText && (
          <div
            style={{
              alignSelf: "center",
              padding: "4px 14px",
              borderRadius: "999px",
              background: `linear-gradient(90deg, ${brandPrimary}, ${brandAccent})`,
              color: "#FFFFFF",
              fontSize: "20px",
              fontWeight: 900,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              boxShadow: brandGlow,
              marginBottom: "8px",
            }}
          >
            {listicle.badgeText}
          </div>
        )}
        {listicle.teaserItems.map((item, idx) => {
          const itemSpring = spring({
            frame: Math.max(0, frame - idx * 2),
            fps,
            config: { damping: 14, stiffness: 140 },
          });
          return (
            <div
              key={`teaser-item-${idx}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "8px 18px",
                borderRadius: "12px",
                background: item.blurred
                  ? "rgba(15, 23, 42, 0.45)"
                  : `linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(${brandPrimary}, 0.25) 100%)`,
                backdropFilter: item.blurred ? "blur(14px)" : "blur(4px)",
                border: item.blurred ? "1px solid rgba(255,255,255,0.1)" : `1.5px solid ${brandPrimary}`,
                transform: `translateX(${interpolate(itemSpring, [0, 1], [-25, 0])}px)`,
                opacity: itemSpring,
              }}
            >
              <span
                style={{
                  fontFamily: '"Anton", "Montserrat", sans-serif',
                  fontSize: "32px",
                  fontWeight: 900,
                  color: item.blurred ? "#94A3B8" : brandPrimary,
                  letterSpacing: "0.05em",
                }}
              >
                {item.indexFormatted}
              </span>
              <span
                style={{
                  fontFamily: '"Montserrat", sans-serif',
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  filter: item.blurred ? "blur(7px)" : "none",
                  userSelect: "none",
                }}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Mode B: Step-by-Step Giant Numeral Treatment
  const numFormatted = listicle.itemNumberFormatted || `${listicle.itemNumber || 1}`;
  const numStyle = listicle.numberStyle || {};
  const numFont = numStyle.fontFamily || "Anton";
  const numSize = numStyle.fontSizePx || 310;
  const treatmentId = listicle.treatment || "gradient_fade_oblivion";

  const numEntrance = spring({ frame, fps, config: { damping: 16, stiffness: 130 } });
  const flickerOpacity = treatmentId === "glitch_flicker_counter" && frame < 6
    ? (frame % 2 === 0 ? 0.35 : 1.0)
    : 1.0;
  const bokehBlur = treatmentId === "cinematic_slide_blur"
    ? interpolate(frame, [0, 8], [28, 0], { extrapolateRight: "clamp" })
    : 0;

  const isOutline = Boolean(numStyle.stroke || treatmentId === "outline_cutout_glow");
  const isGradientOblivion = Boolean(numStyle.maskBottomFade || treatmentId === "gradient_fade_oblivion");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "-35px",
        zIndex: 1,
        transform: `scale(${interpolate(numEntrance, [0, 1], [0.85, 1.0])}) translateY(${interpolate(numEntrance, [0, 1], [30, 0])}px)`,
        opacity: numEntrance * flickerOpacity,
        filter: bokehBlur > 0.1 ? `blur(${bokehBlur.toFixed(1)}px)` : undefined,
      }}
    >
      {listicle.badgeText && (
        <span
          style={{
            fontFamily: '"Montserrat", sans-serif',
            fontSize: "18px",
            fontWeight: 900,
            letterSpacing: "0.2em",
            color: brandAccent,
            textTransform: "uppercase",
            marginBottom: "-12px",
            textShadow: brandGlow,
          }}
        >
          {listicle.badgeText}
        </span>
      )}
      <div
        style={{
          fontFamily: `"${numFont}", "Anton", sans-serif`,
          fontSize: `${numSize}px`,
          fontWeight: 900,
          lineHeight: 0.82,
          letterSpacing: "-0.04em",
          color: isOutline ? "transparent" : (isGradientOblivion ? "#FFFFFF" : brandPrimary),
          WebkitTextStroke: isOutline ? `3px ${brandPrimary}` : undefined,
          backgroundImage: isGradientOblivion
            ? `linear-gradient(180deg, #FFFFFF 0%, ${brandPrimary} 65%, rgba(0,0,0,0) 100%)`
            : undefined,
          WebkitBackgroundClip: isGradientOblivion ? "text" : undefined,
          WebkitTextFillColor: isGradientOblivion ? "transparent" : (isOutline ? "transparent" : undefined),
          WebkitMaskImage: isGradientOblivion
            ? "linear-gradient(180deg, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 95%)"
            : undefined,
          maskImage: isGradientOblivion
            ? "linear-gradient(180deg, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 95%)"
            : undefined,
          textShadow: isOutline ? brandGlow : `0 4px 24px rgba(0,0,0,0.6), ${brandGlow}`,
        }}
      >
        {numFormatted}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Multi-Layer Editorial Graphic Typography Component
// ---------------------------------------------------------------------------
// Pivot-satellite composition (Bug B): the core/pivot word is centered and
// enlarged (hero treatment), while the satellite words are shrunk and anchored
// to the pivot's first/last letters (first satellite at the upper-left of the
// pivot, last satellite at the lower-right). Animation still runs in utterance
// order (pivot first, then satellites left-to-right).
const PivotSatelliteComposition: React.FC<{
  pivot: TypographyLayer;
  satellites: TypographyLayer[];
  frame: number;
  totalFrames: number;
  contentStartFrame: number;
  chunkStartMs: number;
  chunkEndMs: number;
  fps: number;
}> = ({ pivot, satellites, frame, totalFrames, contentStartFrame, chunkStartMs, chunkEndMs, fps }) => {
  const pivotSize = pivot.fontSizePx ?? 120;
  // Satellites retain their designed companion size (legible floor), never the
  // aggressive pivot*0.30 shrink that made caption text unreadable.
  const satSizeFor = (sat: TypographyLayer) =>
    Math.max(sat.fontSizePx ?? Math.round(pivotSize * 0.5), 44);

  const renderSat = (sat: TypographyLayer, si: number, lane: "above" | "below") => {
    const words = sat.words && sat.words.length ? sat.words : [{ text: sat.text ?? "", start_ms: 0 } as WordTiming];
    const isSatDiff = sat.blendMode === "difference" || (sat as any).blendMode === "exclusion";
    const casing = sat.casing === "uppercase" ? "uppercase" : sat.casing === "lowercase" ? "lowercase" : "none";
    const satColor = isDarkColor(sat.color) ? "#FFFFFF" : (sat.color ?? "#FFFFFF");
    const baseStyle: React.CSSProperties = {
      fontSize: satSizeFor(sat),
      fontFamily: sat.fontFamily,
      fontWeight: (sat.fontWeight as number) ?? "bold",
      fontStyle: sat.fontStyle ?? "normal",
      letterSpacing: `${sat.letterSpacingEm ?? 0}em`,
      lineHeight: sat.lineHeight ?? 1,
      textTransform: casing,
      color: isSatDiff ? "#FFFFFF" : satColor,
      WebkitTextFillColor: isSatDiff ? "#FFFFFF" : satColor,
      mixBlendMode: isSatDiff ? "difference" : undefined,
      WebkitTextStroke: isSatDiff ? "0.75px rgba(255, 255, 255, 0.75)" : undefined,
      textShadow: isSatDiff
        ? "-0.85px 0px 1px rgba(255, 0, 75, 0.75), 0.85px 0px 1px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)"
        : ((sat.shadow as string) ?? "0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
      pointerEvents: "none",
    };
    return (
      <div style={{ display: "flex", flexWrap: "nowrap", whiteSpace: "nowrap", justifyContent: "center", gap: "0.28em" }}>
        {words.map((w, wi) => {
          const startF = contentStartFrame + Math.round(((w.start_ms - chunkStartMs) / 1000) * fps);
          const p = interpolate(frame, [startF, startF + 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          return (
            <span
              key={`sat-${si}-${wi}`}
              style={{
                ...baseStyle,
                marginRight: wi < words.length - 1 ? "0.32em" : 0,
                opacity: p,
                transform: `translateY(${((1 - p) * (lane === "above" ? 14 : -14)).toFixed(1)}px)`,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    );
  };

  const mid = Math.ceil(satellites.length / 2);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.12em",
      }}
    >
      {satellites.slice(0, mid).map((sat, si) => renderSat(sat, si, "above"))}
      <KineticLayerRenderer
        layer={pivot}
        frame={frame}
        chunkStartMs={chunkStartMs}
        chunkEndMs={chunkEndMs}
        fps={fps}
        totalFrames={totalFrames}
        contentStartFrame={contentStartFrame}
        hookPlan={undefined}
        placement={undefined}
      />
      {satellites.slice(mid).map((sat, si) => renderSat(sat, si + mid, "below"))}
    </div>
  );
};

/**
 * Hierarchical Asymmetric Kinetic Typography (Documentary Lockup Captions)
 *
 * Implements the 3:1 to 4:1 scale ratio two-tier asymmetric grid:
 * - Massive Hero anchor word/phrase (~110-140px, weight 900, compact leading 0.88, tracking -0.035em)
 * - Significantly smaller Modifier context phrase (~32-38px, weight 600, leading 1.0, tracking -0.025em)
 * - Lockup Option A: Top-Tucked Modifier (modifier sits on upper-left resting above hero)
 * - Lockup Option B: Bottom-Tucked Modifier (modifier sits below hero, flush-left or flush-right)
 * - Lockup Option C: Inline Word-State (focal keyword high contrast, trailing words 45-60% grey)
 * - Motion: Hard Pop-In cut at transient, subtle 2-3 frame impact snap (94% -> 100%), anchor slam,
 *   and dynamic modifier swapping with hero rock-solid anchored on screen.
 */
const HierarchicalAsymmetricLockupComposition: React.FC<{
  chunk: CaptionChunk;
  layers: TypographyLayer[];
  frame: number;
  totalFrames: number;
  contentStartFrame: number;
  chunkStartMs: number;
  chunkEndMs: number;
  fps: number;
}> = ({ chunk, layers, frame, totalFrames, contentStartFrame, chunkStartMs, chunkEndMs, fps }) => {
  const isMultiLayer = layers.length >= 2;
  const heroLayer = layers.find((l) => l.isHero || l.role === "primary_focus_word") || layers[0];
  const modifierLayer = layers.find((l) => l !== heroLayer) || layers[1];

  const rawHeroFont = heroLayer?.fontFamily || "Apple Garamond";
  const effectiveHeroFont = `"${rawHeroFont}", "Apple Garamond", "Cormorant Garamond", "Playfair Display", serif`;
  const rawModFont = modifierLayer?.fontFamily || "Apple Garamond";
  const effectiveModFont = `"${rawModFont}", "Apple Garamond", "Inter", "Montserrat", sans-serif`;

  // Micro-stopword / connector safeguard ("of how to", "and how to", etc.)
  // When all words are <= 3 characters, avoid disproportionate 3:1 caricature scaling.
  const allChunkWords = [
    ...(heroLayer?.words?.map((w) => w.text) || (heroLayer?.text ? heroLayer.text.split(" ") : [])),
    ...(modifierLayer?.words?.map((w) => w.text) || (modifierLayer?.text ? modifierLayer.text.split(" ") : [])),
  ].filter(Boolean);
  const cleanTokens = allChunkWords.map((w) => w.replace(/[^a-zA-Z]/g, "")).filter(Boolean);
  const isMicroStopwords = cleanTokens.length > 0 && cleanTokens.every((w) => w.length <= 3);

  const baseHeroTarget = heroLayer?.fontSizePx ?? 120;
  const heroSize = isMicroStopwords
    ? Math.max(44, Math.min(54, Math.round(baseHeroTarget * 0.42)))
    : Math.max(96, Math.min(148, baseHeroTarget));
  const modifierSize = isMicroStopwords
    ? Math.max(38, Math.round(heroSize * 0.88))
    : Math.max(26, Math.round(heroSize * 0.30));

  const lockupOption = (chunk as any).lockupOption || (chunk as any).treatmentOption;

  // If we have explicit multi-layers
  if (isMultiLayer && modifierLayer) {
    const heroWords = heroLayer.words && heroLayer.words.length > 0
      ? heroLayer.words
      : [{ text: heroLayer.text ?? "", start_ms: chunkStartMs } as WordTiming];

    const modWords = modifierLayer.words && modifierLayer.words.length > 0
      ? modifierLayer.words
      : [{ text: modifierLayer.text ?? "", start_ms: chunkStartMs } as WordTiming];

    // Determine Option A vs Option B based on time or layer order
    const modStartsFirst = (modWords[0]?.start_ms ?? 0) <= (heroWords[0]?.start_ms ?? 0);
    const isTopTucked = lockupOption === "top_tucked" || (lockupOption !== "bottom_tucked" && modStartsFirst);

    // Difference-Mode Inversion (Dynamic Knockout Typography):
    // Inverts underlying video footage data (|255 - BG|) with razor-thin boundary strokes
    // and frosted glass backdrop refraction.
    const isDifference = Boolean(
      (chunk as any).blendMode === "difference" ||
      (chunk as any).blendMode === "exclusion" ||
      (chunk as any).treatmentSystem === "difference_knockout" ||
      (chunk as any).seeThrough ||
      (heroLayer as any).isSeeThrough ||
      (heroLayer as any).blendMode === "difference" ||
      (chunk as any).fxPreset === "see_through_glass_letterform"
    );

    // Dynamic 5-Archetype Animation Mode:
    // Mode 1: "spatial_push_spring" (Apple-style spatial push with shared momentum handoff & damped spring physics)
    // Mode 2: "blue_lantern_magnetic" (inward letter-by-letter compression + 90° vertical directional deblur)
    // Mode 3: "cinematic_slide_up" (weighted 36px upward rise + 90° vertical directional deblur)
    // Mode 4: "docking_modifier" (hero anchor static, modifier smoothly docks into tuck)
    // Mode 5: "kinetic_impact_snap" (crisp subtle kinetic impact snap)
    const rawMode = (chunk as any).lockupAnimationMode || (chunk as any).animationStyle;
    const animMode: "spatial_push_spring" | "blue_lantern_magnetic" | "cinematic_slide_up" | "docking_modifier" | "kinetic_impact_snap" =
      rawMode || (
        (chunk.chunkIndex ?? 0) % 5 === 0
          ? "spatial_push_spring"
          : (chunk.chunkIndex ?? 0) % 5 === 1
          ? "blue_lantern_magnetic"
          : (chunk.chunkIndex ?? 0) % 5 === 2
          ? "cinematic_slide_up"
          : (chunk.chunkIndex ?? 0) % 5 === 3
          ? "docking_modifier"
          : "kinetic_impact_snap"
      );

    const formatHeroEditorialText = (str: string): string => {
      if (!str) return "";
      if (/^[A-Z0-9]{1,3}$/.test(str) && ["K2", "USA", "UK", "NYC", "LA", "DNA", "VIP", "AI"].includes(str)) {
        return str;
      }
      return str.replace(/[A-Za-z]+('[A-Za-z]+)?/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
      });
    };

    const formatModEditorialText = (str: string): string => {
      if (!str) return "";
      const stopwords = new Set([
        "the", "a", "an", "up", "in", "on", "at", "to", "for", "of", "with", "by", "from",
        "was", "were", "is", "are", "been", "be", "only", "one", "didn't", "did", "not",
        "it", "its", "that", "this", "these", "those", "have", "has", "had", "we", "you", "they"
      ]);
      const clean = str.toLowerCase().replace(/[^\w]/g, "");
      if (stopwords.has(clean)) {
        return str.toLowerCase();
      }
      return str.charAt(0).toUpperCase() + str.substring(1).toLowerCase();
    };

    const getFlicker = (elapsedFrames: number) => {
      if (elapsedFrames === 0) return { brightness: 1.28, opacity: 0.92 };
      if (elapsedFrames === 1) return { brightness: 0.88, opacity: 0.86 };
      if (elapsedFrames === 2) return { brightness: 1.12, opacity: 0.98 };
      return { brightness: 1.0, opacity: 1.0 };
    };

    const renderWord = (w: WordTiming, idx: number, isHero: boolean, wordList: WordTiming[]) => {
      const startF = contentStartFrame + Math.round(((w.start_ms - chunkStartMs) / 1000) * fps);
      const isVisible = frame >= startF;
      if (!isVisible) {
        return (
          <span
            key={`haw-${isHero ? "h" : "m"}-${idx}`}
            style={{ opacity: 0, pointerEvents: "none", display: "inline-block", marginRight: "0.22em" }}
          >
            {w.text}
          </span>
        );
      }

      const elapsed = frame - startF;
      const flicker = getFlicker(elapsed);
      const filterId = `hak-vblur-${isHero ? "h" : "m"}-${idx}-${chunk.chunkIndex ?? 0}`;

      const rawDisplayText = isHero
        ? formatHeroEditorialText(w.text)
        : formatModEditorialText(w.text);

      const isCounterPreset = chunk.fxPreset === "metallic_chrome_counter" ||
        chunk.fxPreset === "metallic_chrome_countup_hero" ||
        heroLayer?.fxPreset === "metallic_chrome_counter" ||
        heroLayer?.fxPreset === "metallic_chrome_countup_hero";

      const displayText = (isCounterPreset && /\d/.test(w.text))
        ? resolveNumericCountUpValue({
            text: rawDisplayText,
            localFrame: elapsed,
            durationFrames: Math.max(12, Math.round(fps * 0.65)),
            floorFrames: 12,
          })
        : rawDisplayText;

      // Dynamic hero styling: adapt to chunk palette, layer color, or custom gradient
      const chunkPalette = (chunk as any).palette;
      const heroGradient = heroLayer?.gradient && heroLayer.gradient !== "none" && !isDarkGradient(heroLayer.gradient)
        ? heroLayer.gradient
        : (heroLayer?.color && heroLayer.color !== "#FFFFFF" && !isDarkColor(heroLayer.color))
        ? `linear-gradient(180deg, #FFFFFF 0%, ${heroLayer.color} 55%, ${heroLayer.color} 100%)`
        : (chunkPalette?.accent && chunkPalette.accent !== "#FFFFFF" && !isDarkColor(chunkPalette.accent))
        ? `linear-gradient(180deg, #FFFFFF 0%, ${chunkPalette.secondary || "#FAFAFA"} 45%, ${chunkPalette.accent} 100%)`
        : "linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 28%, #E0E0E0 68%, #BEBEBE 100%)";

      const isHeroItalic = heroLayer?.fontStyle === "italic" || (
        heroLayer?.fontStyle !== "normal" && !/anton|bebas|outfit|montserrat|inter|six caps|teko|oswald|amerika/i.test(effectiveHeroFont)
      );

      if (isHero) {
        if (animMode === "spatial_push_spring") {
          const nextW = wordList[idx + 1];
          const nextStartF = nextW
            ? contentStartFrame + Math.round(((nextW.start_ms - chunkStartMs) / 1000) * fps)
            : Infinity;

          // Fluid cinematic curve (power4.out) over 18 frames
          const animFrames = 18;
          const entryP = interpolate(elapsed, [0, animFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          });

          const entryY = interpolate(entryP, [0, 1], [32, 0]);
          const isPunch = idx === wordList.length - 1 || displayText.length > 4;
          const entryScale = interpolate(entryP, [0, 0.65, 1], [0.94, isPunch ? 1.04 : 1.02, 1.0]);
          const entryBlurY = interpolate(entryP, [0, 0.7, 1], [36, 2.5, 0]);

          // Shared Momentum Handoff: Incoming text acts as physical piston pushing outgoing text
          const isPushedOut = nextStartF < Infinity && frame >= nextStartF;
          const exitElapsed = isPushedOut ? frame - nextStartF : -1;
          const exitP = isPushedOut ? interpolate(exitElapsed, [0, 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          }) : 0;
          const exitY = isPushedOut ? interpolate(exitP, [0, 1], [0, -32]) : 0;
          const exitScale = isPushedOut ? interpolate(exitP, [0, 1], [1.0, 0.96]) : 1.0;
          const exitOpacity = isPushedOut ? interpolate(exitP, [0, 0.65, 1], [1.0, 0.35, 0.0]) : 1.0;
          const exitBlurY = isPushedOut ? interpolate(exitP, [0, 1], [0, 24]) : 0;

          if (isPushedOut && exitElapsed > 14) {
            return null;
          }

          const translateY = entryY + exitY;
          const scale = isPushedOut ? exitScale : entryScale;
          const wordOpacity = isPushedOut ? exitOpacity : flicker.opacity;
          const blurY = isPushedOut ? exitBlurY : entryBlurY;

          // Direct Skia/Chromium native CSS Gaussian blur filter
          const filterStyle = [
            blurY > 0.1 ? `blur(${blurY.toFixed(1)}px)` : "",
            flicker.brightness !== 1.0 && !isPushedOut ? `brightness(${flicker.brightness})` : "",
          ].filter(Boolean).join(" ") || undefined;

          return (
            <span
              key={`haw-h-${idx}`}
              style={{
                display: "inline-block",
                marginRight: "0.24em",
                paddingRight: isHeroItalic ? "0.24em" : "0.06em",
                transform: `translateY(${translateY.toFixed(2)}px) scale(${scale.toFixed(3)})`,
                transformOrigin: "center baseline",
                filter: filterStyle,
                opacity: wordOpacity,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  fontSize: `${heroSize}px`,
                  fontWeight: 700,
                  fontStyle: isHeroItalic ? "italic" : "normal",
                  letterSpacing: "-0.035em",
                  lineHeight: 0.88,
                  backgroundImage: isDifference ? "none" : heroGradient,
                  WebkitBackgroundClip: isDifference ? "border-box" : "text",
                  WebkitTextFillColor: isDifference ? "#FFFFFF" : "transparent",
                  color: isDifference ? "#FFFFFF" : undefined,
                  mixBlendMode: isDifference ? "difference" : undefined,
                  WebkitTextStroke: isDifference ? "0.85px rgba(255, 255, 255, 0.75)" : undefined,
                  textShadow: isDifference
                    ? "-0.9px 0px 1.2px rgba(255, 0, 75, 0.75), 0.9px 0px 1.2px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)"
                    : undefined,
                }}
              >
                {displayText}
              </span>
            </span>
          );
        } else if (animMode === "blue_lantern_magnetic") {
          const easeRise: [number, number, number, number] = [0.16, 1.0, 0.3, 1.0];
          const easeSqueeze: [number, number, number, number] = [0.12, 1.0, 0.22, 1.0];
          const riseFrames = Math.max(1, Math.round(fps * 0.48));
          const squeezeFrames = Math.max(1, Math.round(fps * 0.55));

          const riseP = interpolate(elapsed, [0, riseFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(...easeRise),
          });
          const translateY = interpolate(riseP, [0, 1], [36, 0]);
          const blurY = interpolate(riseP, [0, 0.7, 1], [36, 3, 0]);

          const squeezeT = Easing.bezier(...easeSqueeze)(
            interpolate(elapsed, [0, squeezeFrames], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          );

          const charSpans = Array.from(displayText).map((char, cIdx) => {
            const charOffset = cIdx - (displayText.length - 1) / 2;
            const microStartX = charOffset * 0.12;
            const microEndX = charOffset * -0.02;
            const microX = microStartX + (microEndX - microStartX) * squeezeT;
            return (
              <span
                key={`blm-char-${idx}-${cIdx}`}
                style={{
                  display: "inline-block",
                  whiteSpace: "pre",
                  transform: `translate3d(${microX.toFixed(3)}em, 0, 0)`,
                }}
              >
                {char}
              </span>
            );
          });

          const filterStyle = [
            blurY > 0.1 ? `blur(${blurY.toFixed(1)}px)` : "",
            flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : "",
          ].filter(Boolean).join(" ") || undefined;

          return (
            <span
              key={`haw-h-${idx}`}
              style={{
                display: "inline-block",
                marginRight: "0.24em",
                paddingRight: isHeroItalic ? "0.24em" : "0.06em",
                transform: `translateY(${translateY.toFixed(2)}px)`,
                filter: filterStyle,
                opacity: flicker.opacity,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  fontSize: `${heroSize}px`,
                  fontWeight: 700,
                  fontStyle: isHeroItalic ? "italic" : "normal",
                  letterSpacing: "-0.035em",
                  lineHeight: 0.88,
                  backgroundImage: isDifference ? "none" : heroGradient,
                  WebkitBackgroundClip: isDifference ? "border-box" : "text",
                  WebkitTextFillColor: isDifference ? "#FFFFFF" : "transparent",
                  color: isDifference ? "#FFFFFF" : undefined,
                  mixBlendMode: isDifference ? "difference" : undefined,
                  WebkitTextStroke: isDifference ? "0.85px rgba(255, 255, 255, 0.75)" : undefined,
                  textShadow: isDifference
                    ? "-0.9px 0px 1.2px rgba(255, 0, 75, 0.75), 0.9px 0px 1.2px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)"
                    : undefined,
                }}
              >
                {charSpans}
              </span>
            </span>
          );
        } else if (animMode === "cinematic_slide_up") {
          const riseFrames = Math.max(1, Math.round(fps * 0.48));
          const riseP = interpolate(elapsed, [0, riseFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          });
          const translateY = interpolate(riseP, [0, 1], [36, 0]);
          const blurY = interpolate(riseP, [0, 0.7, 1], [36, 3, 0]);

          const filterStyle = [
            blurY > 0.1 ? `blur(${blurY.toFixed(1)}px)` : "",
            flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : "",
          ].filter(Boolean).join(" ") || undefined;

          return (
            <span
              key={`haw-h-${idx}`}
              style={{
                display: "inline-block",
                marginRight: "0.24em",
                paddingRight: isHeroItalic ? "0.24em" : "0.06em",
                transform: `translateY(${translateY.toFixed(2)}px)`,
                filter: filterStyle,
                opacity: flicker.opacity,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  fontSize: `${heroSize}px`,
                  fontWeight: 700,
                  fontStyle: isHeroItalic ? "italic" : "normal",
                  letterSpacing: "-0.035em",
                  lineHeight: 0.88,
                  backgroundImage: isDifference ? "none" : heroGradient,
                  WebkitBackgroundClip: isDifference ? "border-box" : "text",
                  WebkitTextFillColor: isDifference ? "#FFFFFF" : "transparent",
                  color: isDifference ? "#FFFFFF" : undefined,
                  mixBlendMode: isDifference ? "difference" : undefined,
                  WebkitTextStroke: isDifference ? "0.85px rgba(255, 255, 255, 0.75)" : undefined,
                  textShadow: isDifference
                    ? "-0.9px 0px 1.2px rgba(255, 0, 75, 0.75), 0.9px 0px 1.2px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)"
                    : undefined,
                }}
              >
                {displayText}
              </span>
            </span>
          );
        } else if (animMode === "docking_modifier") {
          // Hero Anchor is stationary with subtle settling float and soft deblur
          const settleFrames = Math.max(1, Math.round(fps * 0.35));
          const settleP = interpolate(elapsed, [0, settleFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          });
          const scale = interpolate(settleP, [0, 1], [0.96, 1.0]);
          const blurY = interpolate(settleP, [0, 0.7, 1], [24, 2, 0]);
          const filterStyle = [
            blurY > 0.1 ? `blur(${blurY.toFixed(1)}px)` : "",
            flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : "",
          ].filter(Boolean).join(" ") || undefined;
          return (
            <span
              key={`haw-h-${idx}`}
              style={{
                display: "inline-block",
                marginRight: "0.24em",
                paddingRight: isHeroItalic ? "0.24em" : "0.06em",
                transform: `scale(${scale})`,
                opacity: flicker.opacity,
                filter: filterStyle,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  fontSize: `${heroSize}px`,
                  fontWeight: 700,
                  fontStyle: isHeroItalic ? "italic" : "normal",
                  letterSpacing: "-0.035em",
                  lineHeight: 0.88,
                  backgroundImage: isDifference ? "none" : heroGradient,
                  WebkitBackgroundClip: isDifference ? "border-box" : "text",
                  WebkitTextFillColor: isDifference ? "#FFFFFF" : "transparent",
                  color: isDifference ? "#FFFFFF" : undefined,
                  mixBlendMode: isDifference ? "difference" : undefined,
                  WebkitTextStroke: isDifference ? "0.85px rgba(255, 255, 255, 0.75)" : undefined,
                  textShadow: isDifference
                    ? "-0.9px 0px 1.2px rgba(255, 0, 75, 0.75), 0.9px 0px 1.2px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)"
                    : undefined,
                }}
              >
                {displayText}
              </span>
            </span>
          );
        } else {
          // Fluid Kinetic Impact: smooth 16-frame deceleration with Gaussian deblur
          const impactFrames = Math.max(1, Math.round(fps * 0.45));
          const impactP = interpolate(elapsed, [0, impactFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          });
          const scale = interpolate(impactP, [0, 0.6, 1], [0.92, 1.04, 1.0]);
          const blurY = interpolate(impactP, [0, 0.7, 1], [28, 2.5, 0]);
          const filterStyle = [
            blurY > 0.1 ? `blur(${blurY.toFixed(1)}px)` : "",
            flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : "",
          ].filter(Boolean).join(" ") || undefined;
          return (
            <span
              key={`haw-h-${idx}`}
              style={{
                display: "inline-block",
                marginRight: "0.24em",
                paddingRight: isHeroItalic ? "0.24em" : "0.06em",
                transform: `scale(${scale})`,
                transformOrigin: "center baseline",
                opacity: flicker.opacity,
                filter: filterStyle,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  fontSize: `${heroSize}px`,
                  fontWeight: 700,
                  fontStyle: isHeroItalic ? "italic" : "normal",
                  letterSpacing: "-0.035em",
                  lineHeight: 0.88,
                  backgroundImage: isDifference ? "none" : heroGradient,
                  WebkitBackgroundClip: isDifference ? "border-box" : "text",
                  WebkitTextFillColor: isDifference ? "#FFFFFF" : "transparent",
                  color: isDifference ? "#FFFFFF" : undefined,
                  mixBlendMode: isDifference ? "difference" : undefined,
                  WebkitTextStroke: isDifference ? "0.85px rgba(255, 255, 255, 0.75)" : undefined,
                  textShadow: isDifference
                    ? "-0.9px 0px 1.2px rgba(255, 0, 75, 0.75), 0.9px 0px 1.2px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)"
                    : undefined,
                }}
              >
                {displayText}
              </span>
            </span>
          );
        }
      }

      // Modifier Word Rendering
      // Tier Exit Choreography: If companion modifier enters before hero, modifier animates OUT when hero lands
      const heroStartF = modStartsFirst && heroWords[0]?.start_ms !== undefined
        ? contentStartFrame + Math.round(((heroWords[0].start_ms - chunkStartMs) / 1000) * fps)
        : Infinity;

      if (animMode === "spatial_push_spring") {
        const nextW = wordList[idx + 1];
        const wordPushF = nextW
          ? contentStartFrame + Math.round(((nextW.start_ms - chunkStartMs) / 1000) * fps)
          : Infinity;
        const triggerF = Math.min(wordPushF, heroStartF);

        const animFrames = 18;
        const entryP = interpolate(elapsed, [0, animFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
        });

        const entryY = interpolate(entryP, [0, 1], isTopTucked ? [-28, 0] : [28, 0]);
        const entryScale = interpolate(entryP, [0, 0.65, 1], [0.95, 1.02, 1.0]);
        const entryBlurY = interpolate(entryP, [0, 0.7, 1], [28, 2, 0]);

        const isPushedOut = triggerF < Infinity && frame >= triggerF;
        const exitElapsed = isPushedOut ? frame - triggerF : -1;
        const exitP = isPushedOut ? interpolate(exitElapsed, [0, 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
        }) : 0;
        const exitY = isPushedOut ? interpolate(exitP, [0, 1], [0, isTopTucked ? 28 : -28]) : 0;
        const exitScale = isPushedOut ? interpolate(exitP, [0, 1], [1.0, 0.96]) : 1.0;
        const exitOpacity = isPushedOut ? interpolate(exitP, [0, 0.65, 1], [1.0, 0.35, 0.0]) : 1.0;
        const exitBlurY = isPushedOut ? interpolate(exitP, [0, 1], [0, 20]) : 0;

        if (isPushedOut && exitElapsed > 14) {
          return null;
        }

        const translateY = entryY + exitY;
        const scale = isPushedOut ? exitScale : entryScale;
        const wordOpacity = isPushedOut ? exitOpacity : flicker.opacity;
        const blurY = isPushedOut ? exitBlurY : entryBlurY;

        const filterStyle = [
          blurY > 0.1 ? `blur(${blurY.toFixed(1)}px)` : "",
          flicker.brightness !== 1.0 && !isPushedOut ? `brightness(${flicker.brightness})` : "",
        ].filter(Boolean).join(" ") || undefined;

        return (
          <span
            key={`haw-m-${idx}`}
            style={{
              display: "inline-block",
              marginRight: "0.22em",
              paddingRight: "0.15em",
              transform: `translateY(${translateY.toFixed(2)}px) scale(${scale.toFixed(3)})`,
              transformOrigin: "center baseline",
              filter: filterStyle,
              opacity: wordOpacity,
            }}
          >
            <span
              style={{
                display: "inline-block",
                fontSize: `${modifierSize}px`,
                fontWeight: 300,
                fontStyle: "italic",
                letterSpacing: "-0.025em",
                lineHeight: 1.0,
                color: isDifference ? "#FFFFFF" : "#F2F2F2",
                WebkitTextFillColor: isDifference ? "#FFFFFF" : "#F2F2F2",
                mixBlendMode: isDifference ? "difference" : undefined,
                WebkitTextStroke: isDifference ? "0.75px rgba(255, 255, 255, 0.70)" : undefined,
                textShadow: isDifference
                  ? "-0.85px 0px 1px rgba(255, 0, 75, 0.75), 0.85px 0px 1px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)"
                  : "0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.90)",
              }}
            >
              {displayText}
            </span>
          </span>
        );
      } else if (animMode === "docking_modifier") {
        const dockFrames = Math.max(1, Math.round(fps * 0.45));
        const dockP = interpolate(elapsed, [0, dockFrames], [0, 1], {
          easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const translateY = interpolate(dockP, [0, 1], isTopTucked ? [-28, 0] : [28, 0]);
        const blurY = interpolate(dockP, [0, 0.7, 1], [24, 2, 0]);

        const filterStyle = [
          blurY > 0.1 ? `blur(${blurY.toFixed(1)}px)` : "",
          flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : "",
        ].filter(Boolean).join(" ") || undefined;

        return (
          <span
            key={`haw-m-${idx}`}
            style={{
              display: "inline-block",
              marginRight: "0.22em",
              paddingRight: "0.15em",
              transform: `translateY(${translateY.toFixed(2)}px)`,
              filter: filterStyle,
              opacity: flicker.opacity,
            }}
          >
            <span
              style={{
                display: "inline-block",
                fontSize: `${modifierSize}px`,
                fontWeight: 300,
                fontStyle: "italic",
                letterSpacing: "-0.025em",
                lineHeight: 1.0,
                color: isDifference ? "#FFFFFF" : "#F2F2F2",
                WebkitTextFillColor: isDifference ? "#FFFFFF" : "#F2F2F2",
                mixBlendMode: isDifference ? "difference" : undefined,
                WebkitTextStroke: isDifference ? "0.75px rgba(255, 255, 255, 0.70)" : undefined,
                textShadow: isDifference
                  ? "-0.85px 0px 1px rgba(255, 0, 75, 0.75), 0.85px 0px 1px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)"
                  : "0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.90)",
              }}
            >
              {displayText}
            </span>
          </span>
        );
      } else if (animMode === "kinetic_impact_snap") {
        const snapFrames = Math.max(1, Math.round(fps * 0.40));
        const snapProgress = interpolate(elapsed, [0, snapFrames], [0, 1], {
          easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const scale = interpolate(snapProgress, [0, 0.6, 1], [0.93, 1.03, 1.0]);
        const blurY = interpolate(snapProgress, [0, 0.7, 1], [22, 2, 0]);
        const filterStyle = [
          blurY > 0.1 ? `blur(${blurY.toFixed(1)}px)` : "",
          flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : "",
        ].filter(Boolean).join(" ") || undefined;
        return (
          <span
            key={`haw-m-${idx}`}
            style={{
              display: "inline-block",
              marginRight: "0.22em",
              paddingRight: "0.15em",
              transform: `scale(${scale})`,
              transformOrigin: "center baseline",
              opacity: flicker.opacity,
              filter: filterStyle,
            }}
          >
            <span
              style={{
                display: "inline-block",
                fontSize: `${modifierSize}px`,
                fontWeight: 300,
                fontStyle: "italic",
                letterSpacing: "-0.025em",
                lineHeight: 1.0,
                color: isDifference ? "#FFFFFF" : "#F2F2F2",
                WebkitTextFillColor: isDifference ? "#FFFFFF" : "#F2F2F2",
                mixBlendMode: isDifference ? "difference" : undefined,
                WebkitTextStroke: isDifference ? "0.75px rgba(255, 255, 255, 0.70)" : undefined,
                textShadow: isDifference
                  ? "-0.85px 0px 1px rgba(255, 0, 75, 0.75), 0.85px 0px 1px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)"
                  : "0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.90)",
              }}
            >
              {displayText}
            </span>
          </span>
        );
      } else {
        // Smooth slide up for cinematic and blue lantern modes
        const slideFrames = Math.max(1, Math.round(fps * 0.45));
        const slideP = interpolate(elapsed, [0, slideFrames], [0, 1], {
          easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const translateY = interpolate(slideP, [0, 1], [32, 0]);
        const blurY = interpolate(slideP, [0, 0.7, 1], [24, 2, 0]);

        const filterStyle = [
          blurY > 0.1 ? `blur(${blurY.toFixed(1)}px)` : "",
          flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : "",
        ].filter(Boolean).join(" ") || undefined;

        return (
          <span
            key={`haw-m-${idx}`}
            style={{
              display: "inline-block",
              marginRight: "0.22em",
              paddingRight: "0.15em",
              transform: `translateY(${translateY.toFixed(2)}px)`,
              filter: filterStyle,
              opacity: flicker.opacity,
            }}
          >
            <span
              style={{
                display: "inline-block",
                fontSize: `${modifierSize}px`,
                fontWeight: 300,
                fontStyle: "italic",
                letterSpacing: "-0.025em",
                lineHeight: 1.0,
                color: isDifference ? "#FFFFFF" : "#F2F2F2",
                WebkitTextFillColor: isDifference ? "#FFFFFF" : "#F2F2F2",
                mixBlendMode: isDifference ? "difference" : undefined,
                WebkitTextStroke: isDifference ? "0.75px rgba(255, 255, 255, 0.70)" : undefined,
                textShadow: isDifference
                  ? "-0.85px 0px 1px rgba(255, 0, 75, 0.75), 0.85px 0px 1px rgba(0, 225, 255, 0.75), 0 0 1px rgba(0, 0, 0, 0.85)"
                  : "0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.90)",
              }}
            >
              {displayText}
            </span>
          </span>
        );
      }
    };

    const modifierBlock = (
      <div
        style={{
          display: "flex",
          flexWrap: "nowrap",
          whiteSpace: "nowrap",
          alignItems: "center",
          alignSelf: "flex-start",
          fontFamily: effectiveModFont,
          fontStyle: "italic",
          fontSize: `${modifierSize}px`,
          fontWeight: 300,
          letterSpacing: "-0.025em",
          lineHeight: 1.0,
          color: isDifference ? "#FFFFFF" : "#F2F2F2",
          marginBottom: isTopTucked ? "0.15em" : 0,
          marginTop: isTopTucked ? 0 : "0.18em",
          paddingLeft: "0.08em",
          fontVariantLigatures: "none",
          fontFeatureSettings: '"liga" 0, "dlig" 0, "calt" 0, "hlig" 0',
        }}
      >
        {modWords.map((w, idx) => renderWord(w, idx, false, modWords))}
      </div>
    );

    const heroBlock = (
      <div
        style={{
          display: "flex",
          flexWrap: "nowrap",
          whiteSpace: "nowrap",
          alignItems: "baseline",
          alignSelf: "flex-start",
          fontFamily: effectiveHeroFont,
          fontStyle: "italic",
          fontSize: `${heroSize}px`,
          fontWeight: 700,
          letterSpacing: "-0.035em",
          lineHeight: 0.88,
          fontVariantLigatures: "none",
          fontFeatureSettings: '"liga" 0, "dlig" 0, "calt" 0, "hlig" 0',
          filter: isDifference
            ? "drop-shadow(0 0 1px rgba(0, 0, 0, 0.85))"
            : "drop-shadow(0 4px 18px rgba(0, 0, 0, 0.85))",
        }}
      >
        {heroWords.map((w, idx) => renderWord(w, idx, true, heroWords))}
      </div>
    );

    const heroCharLen = heroWords.reduce((acc, w) => acc + (w.text?.length || 0), 0) + Math.max(0, heroWords.length - 1);
    const modCharLen = modWords.reduce((acc, w) => acc + (w.text?.length || 0), 0) + Math.max(0, modWords.length - 1);
    const heroAutoFit = resolveAutoFitScale({
      charLength: heroCharLen,
      fontSizePx: heroSize,
      isUppercase: true,
      isBehindSubject: false,
    });
    const modAutoFit = resolveAutoFitScale({
      charLength: modCharLen,
      fontSizePx: modifierSize,
      isUppercase: false,
      isBehindSubject: false,
    });
    const lockupScale = Math.min(heroAutoFit, modAutoFit);

    return (
      <div
        style={{
          position: "relative",
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: 0,
          pointerEvents: "none",
          mixBlendMode: isDifference ? "difference" : undefined,
          transform: lockupScale < 1.0 ? `scale(${lockupScale})` : undefined,
          transformOrigin: "center center",
        }}
      >
        {isTopTucked && modifierBlock}
        {heroBlock}
        {!isTopTucked && modifierBlock}
      </div>
    );
  }

  // Single layer fallback: Render via KineticLayerRenderer
  return (
    <KineticLayerRenderer
      layer={heroLayer}
      frame={frame}
      chunkStartMs={chunkStartMs}
      chunkEndMs={chunkEndMs}
      fps={fps}
      totalFrames={totalFrames}
      contentStartFrame={contentStartFrame}
      hookPlan={chunk.hookPlan}
      placement={chunk.placement}
    />
  );
};

const TypographyAnnotationsOverlay: React.FC<{
  annotations?: TypographyAnnotation[];
  frame: number;
  fps: number;
}> = ({ annotations, frame, fps }) => {
  if (!annotations || annotations.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 25,
        overflow: "visible",
      }}
    >
      {annotations.map((ann, aIdx) => {
        const entryProgress = interpolate(frame, [aIdx * 3, aIdx * 3 + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });

        const annColor = ann.color || "#FFD700";
        const x = ann.xPercent ?? 50;
        const y = ann.yPercent ?? 50;
        const w = ann.widthPercent ?? 30;
        const h = ann.heightPercent ?? 15;

        const isBadgeOrBox =
          ann.type === "badge" || ann.type === "highlight_box" || (ann as any).type === "pill";
        if (isBadgeOrBox) {
          const labelText = ann.targetKeyword || (ann as any).label || "KEY POINT";
          return (
            <div
              key={`ann-pill-${aIdx}`}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) scale(${entryProgress})`,
                opacity: entryProgress,
                padding: "6px 16px",
                borderRadius: "999px",
                border: `1.5px solid ${annColor}`,
                backgroundColor: "rgba(15, 23, 42, 0.85)",
                backdropFilter: "blur(8px)",
                color: annColor,
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                boxShadow: `0 4px 20px rgba(0, 0, 0, 0.6), 0 0 12px ${annColor}44`,
                whiteSpace: "nowrap",
              }}
            >
              {labelText}
            </div>
          );
        }

        if (ann.type === "circle") {
          const loopOpen = ann.loopOpenPercent ?? 15;
          const strokeDash = 280;
          const dashOffset = interpolate(entryProgress, [0, 1], [strokeDash, strokeDash * (loopOpen / 100)]);
          const jitter = (ann.jitterAmount ?? 0.05) * 6;

          return (
            <svg
              key={`ann-circle-${aIdx}`}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: `${w}%`,
                height: `${h}%`,
                transform: `translate(-50%, -50%) scale(${entryProgress})`,
                opacity: entryProgress,
                overflow: "visible",
              }}
              viewBox="0 0 100 60"
            >
              <ellipse
                cx={50 + Math.sin(frame * 0.3) * jitter}
                cy={30 + Math.cos(frame * 0.3) * jitter}
                rx={45}
                ry={25}
                fill="none"
                stroke={annColor}
                strokeWidth={3}
                strokeDasharray={strokeDash}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                filter={`drop-shadow(0 0 6px ${annColor})`}
              />
            </svg>
          );
        }

        const isLeader =
          Boolean(ann.leaderLine) || ann.type === "leader_dot" || (ann as any).type === "leader_line";
        if (isLeader && ann.leaderLine) {
          const ll = ann.leaderLine;
          const lineLength = interpolate(entryProgress, [0, 1], [0, 1]);
          const currentEndX = ll.startXPercent + (ll.endXPercent - ll.startXPercent) * lineLength;
          const currentEndY = ll.startYPercent + (ll.endYPercent - ll.startYPercent) * lineLength;

          return (
            <svg
              key={`ann-line-${aIdx}`}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                overflow: "visible",
              }}
            >
              <line
                x1={`${ll.startXPercent}%`}
                y1={`${ll.startYPercent}%`}
                x2={`${currentEndX}%`}
                y2={`${currentEndY}%`}
                stroke={annColor}
                strokeWidth={2.5}
                strokeDasharray="4 2"
                filter={`drop-shadow(0 0 4px ${annColor})`}
              />
              {ll.dotRadiusPx && (
                <circle
                  cx={`${ll.startXPercent}%`}
                  cy={`${ll.startYPercent}%`}
                  r={ll.dotRadiusPx}
                  fill={annColor}
                />
              )}
            </svg>
          );
        }

        return null;
      })}
    </div>
  );
};

const MultiLayerTypographyCard: React.FC<{
  chunk: CaptionChunk;
  contentStartFrame: number;
  endFrame: number;
  subjectMatteAvailable: boolean;
}> = ({ chunk, contentStartFrame, endFrame, subjectMatteAvailable }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = endFrame;
  if (totalFrames <= 0) return null;

  const chunkStartMs = chunk.startMs ?? chunk.outputStartMs ?? chunk.displayStartMs ?? 0;
  const chunkEndMs = chunk.endMs ?? chunk.outputEndMs ?? chunk.displayEndMs ?? chunkStartMs + 1500;

  const layers: TypographyLayer[] =
    chunk.layers && chunk.layers.length > 0
      ? chunk.layers
      : [
          {
            layerIndex: 0,
            layerName: "hero",
            role: "primary_focus_word",
            rawText: chunk.text,
            text: chunk.text,
            fontFamily: "Playfair Display",
            accentFont: "Bodoni Moda",
            fontWeight: 800,
            fontStyle: "normal",
            fontSizePx: 120,
            color: "#FFFFFF",
            casing: "uppercase",
            letterSpacingEm: 0.02,
            lineHeight: 1.05,
            isHero: true,
            fxPreset: chunk.fxPreset || "apple_pro_display_hero_revealer",
            gradient: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 40%, #E2E8F0 100%)",
            glow: "0 0 24px rgba(255, 255, 255, 0.75)",
            shadow: "0 6px 24px rgba(0, 0, 0, 0.98)",
            textFillColor: "transparent",
            hasGradient: true,
          },
        ];
  const behindSubject = Boolean(subjectMatteAvailable && layers.some((layer) => layer.behindSubject));
  const isBehindSubject = Boolean(
    subjectMatteAvailable && (
      behindSubject ||
      chunk.placement?.safeRegionId === "upper_third" ||
      chunk.placement?.anchor === "top_headroom" ||
      layers.some((l) => l.behindSubject)
    )
  );

  // Multi-word group completion anchoring: layer entrance completes at last word's start frame
  const chunkWords = chunk.words || [];
  const lastWordStartMs = chunkWords.length > 0
    ? chunkWords[chunkWords.length - 1].start_ms
    : chunkStartMs;
  const lastWordRelativeMs = Math.max(0, lastWordStartMs - chunkStartMs);
  const lastWordStartFrame = contentStartFrame + Math.round((lastWordRelativeMs / 1000) * fps);

  // Overall chunk entrance & exit kinetic ease
  const entranceFrame = resolveChunkEntranceFrame(contentStartFrame, totalFrames, lastWordStartFrame);
  const chunkEntrance = interpolate(frame, [0, entranceFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
  });

  // Accelerated 5-frame scale/blur exit tween
  const isAcceleratedExit = Boolean(chunk.acceleratedExit);
  const exitFrames = 5;

  const exitProgress = interpolate(frame, [Math.max(0, totalFrames - exitFrames), totalFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 1, 1),
  });

  const chunkExit = 1 - exitProgress;
  const exitBlur = exitProgress * 4;
  const exitScale = interpolate(exitProgress, [0, 1], [1.0, 0.94]);

  // Full-card hook & cinematic impact transforms
  const hookFx = chunk.fxPreset || "";
  const hookPlan = chunk.hookPlan;
  const isCrashZoom = hookFx.includes("crash_zoom") || hookPlan?.zoom?.kind === "crash_zoom";
  const isWhipBlur = hookFx.includes("whip_blur") || hookPlan?.directionalBlur !== undefined;
  const isFlareOrFlash = hookFx.includes("flare_burst") || hookFx.includes("flash_cut");

  const hookScale = isCrashZoom
    ? interpolate(frame, [0, 6, 12], [1.28, 0.97, 1.0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.2, 1.8, 0.4, 1.0),
      })
    : 1.0;

  const hookTranslateX = isWhipBlur
    ? interpolate(frame, [0, 6], [28, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      })
    : 0;

  const hookBrightness = isFlareOrFlash
    ? interpolate(frame, [0, 2, 8], [1.65, 1.2, 1.0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1.0;

  const leftPosition = chunk.placement?.xPercent || "50%";
  const topPositionRaw = chunk.placement?.yPercent || (behindSubject ? "24%" : "54%");

  // Bottom safe-line guard: the placement yPercent vertically centers the
  // lockup, so tall multi-line blocks anchored low run off the viewport edge.
  // Estimate the block height from its layers and clamp the anchor upward so
  // the bottom edge never crosses the 90% viewport line.
  const estimatedBlockHeight = layers.reduce((acc, l) => {
    const fs = Number(l.fontSizePx) || 120;
    const lh = Number(l.lineHeight) || 1.0;
    const mt = Math.abs(Number((l as any).marginTopPx) || 0);
    return acc + fs * lh + mt;
  }, 0);
  const CANVAS_H = 1920;
  const bottomSafePx = CANVAS_H * 0.90;
  const blockHalfHeight = estimatedBlockHeight / 2;
  const maxTopPercent = ((bottomSafePx - blockHalfHeight) / CANVAS_H) * 100;
  const rawTopPercent = parseFloat(topPositionRaw) || 54;
  const minTopPercent = behindSubject ? 8 : 20;
  const topPosition = `${Math.max(minTopPercent, Math.min(rawTopPercent, maxTopPercent))}%`;
  const textAlign = (chunk.placement as any)?.textAlign || "center";
  const alignItems = textAlign === "left" ? "flex-start" : (textAlign === "right" ? "flex-end" : "center");
  const maxWidthPercent = Number((chunk.placement as any)?.maxWidthPercent);
  const deckMaxWidth = Number.isFinite(maxWidthPercent) && maxWidthPercent > 0
    ? `${Math.max(50, Math.min(100, maxWidthPercent))}%`
    : "980px";

  // Flanker / Satellite Layout containment:
  // When layers use asymmetric alignSelf ('flex-start' / 'flex-end', e.g. image 82 'have choose to' or image 97 'AT POINT, SOME'),
  // a full 980px flex container flings the words 500px apart across the canvas.
  // Shrink-wrapping the card container to 'fit-content' (bounded to the hero word's width) ensures flankers tightly hug the hero word.
  const hasFlankingLayers = layers.some(
    (l) => ((l as any).alignSelf === "flex-start" || (l as any).alignSelf === "flex-end")
  );
  const isLeftOrRightAlign = textAlign === "left" || textAlign === "right";
  const isFlankZone =
    (chunk.placement as any)?.safeRegionId === "flank_right_editorial_pillar" ||
    (chunk.placement as any)?.safeRegionId === "flank_left_editorial_pillar" ||
    (chunk.placement as any)?.dominantZone === "flank_right_column" ||
    (chunk.placement as any)?.dominantZone === "flank_left_column" ||
    Boolean((chunk.placement as any)?.safeRegionId?.includes("flank"));

  const resolvedCardWidth = isFlankZone
    ? "fit-content"
    : (hasFlankingLayers || isLeftOrRightAlign)
    ? "fit-content"
    : "92%";
  const resolvedMaxWidth = isFlankZone
    ? "360px"
    : (hasFlankingLayers || isLeftOrRightAlign)
    ? "720px"
    : deckMaxWidth;

  return (
    <div
      style={{
        position: "absolute",
        left: leftPosition,
        top: topPosition,
        transform: `translate(calc(-50% + ${hookTranslateX}px), -50%) scale(${interpolate(chunkEntrance, [0, 1], [0.94, 1.0]) * hookScale * exitScale})`,
        opacity: Math.min(chunkEntrance, chunkExit),
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems,
        filter: `${resolveTypographyContainerFilter(layers) || ""} ${exitBlur > 0.1 ? `blur(${exitBlur.toFixed(1)}px)` : ""} brightness(${hookBrightness})`.trim() || undefined,
        mixBlendMode: resolveTypographyContainerBlendMode(layers),
        gap: "0px",
        width: resolvedCardWidth,
        maxWidth: resolvedMaxWidth,
        textAlign,
        zIndex: resolveTypographyZIndex(behindSubject, chunk.placement?.safeRegionId),
        pointerEvents: "none",
        perspective: "1200px",
        perspectiveOrigin: "50% 50%",
        transformStyle: "preserve-3d",
      }}
    >
      {chunk.listicle?.isListicle && (
        <ListicleRenderer
          listicle={chunk.listicle}
          frame={frame}
          fps={fps}
          palette={chunk.palette}
        />
      )}

      {(() => {
        const isHierarchicalLockup = Boolean(
          (chunk as any).treatmentSystem === "hierarchical_asymmetric_lockup" ||
          (chunk as any).treatmentSystem === "documentary_lockup_captions" ||
          (chunk as any).treatmentSystem === "micro_macro_kinetic_type" ||
          chunk.fxPreset === "hierarchical_asymmetric_lockup" ||
          chunk.fxPreset === "documentary_lockup_captions" ||
          chunk.fxPreset === "micro_macro_kinetic_type" ||
          layers.some(
            (l) =>
              l.fxPreset === "hierarchical_asymmetric_lockup" ||
              l.fxPreset === "documentary_lockup_captions" ||
              l.fxPreset === "micro_macro_kinetic_type"
          )
        );
        const renderedContent = (() => {
          if (isHierarchicalLockup) {
            return (
              <HierarchicalAsymmetricLockupComposition
                chunk={chunk}
                layers={layers}
                frame={frame}
                totalFrames={totalFrames}
                contentStartFrame={contentStartFrame}
                chunkStartMs={chunkStartMs}
                chunkEndMs={chunkEndMs}
                fps={fps}
              />
            );
          }

          const pl = (chunk as any).pivotLayout;
          const wantsPivotSatellite = Boolean(
            pl?.enabled ||
            (chunk as any).treatmentSystem === "pivot_satellite" ||
            (chunk as any).treatmentOverlay === "pivot_satellite"
          );
          if (wantsPivotSatellite && pl && Array.isArray(pl.satelliteLayerIndices) && pl.satelliteLayerIndices.length > 0) {
            const pivotLayer = layers[pl.pivotLayerIndex];
            const sats = pl.satelliteLayerIndices.map((i: number) => layers[i]).filter(Boolean);
            if (pivotLayer && sats.length > 0) {
              return (
                <PivotSatelliteComposition
                  pivot={pivotLayer}
                  satellites={sats}
                  frame={frame}
                  totalFrames={totalFrames}
                  contentStartFrame={contentStartFrame}
                  chunkStartMs={chunkStartMs}
                  chunkEndMs={chunkEndMs}
                  fps={fps}
                />
              );
            }
          }
          // In 2-tier lockups, calculate companion tier exit frame when hero lands
          const heroLayerItem = layers.find((l) => l.isHero || l.role === "primary_focus_word");
          const companionLayerItem = layers.find((l) => l !== heroLayerItem);
          let companionExitFrame: number | undefined = undefined;
          if (heroLayerItem && companionLayerItem) {
            const companionStartMs = companionLayerItem.words?.[0]?.start_ms ?? chunkStartMs;
            const heroStartMs = heroLayerItem.words?.[0]?.start_ms ?? chunkStartMs;
            if (companionStartMs < heroStartMs) {
              companionExitFrame = contentStartFrame + Math.round(((heroStartMs - chunkStartMs) / 1000) * fps);
            }
          }

          return layers.map((layer, lIdx) => {
            const isCompanion = layer === companionLayerItem;
            return (
              <KineticLayerRenderer
                key={`layer-${lIdx}`}
                layer={layer}
                frame={frame}
                chunkStartMs={chunkStartMs}
                chunkEndMs={chunkEndMs}
                fps={fps}
                totalFrames={totalFrames}
                contentStartFrame={contentStartFrame}
                hookPlan={chunk.hookPlan}
                placement={chunk.placement}
                tierExitFrame={isCompanion ? companionExitFrame : undefined}
              />
            );
          });
        })();

        return renderedContent;
      })()}

      <TypographyAnnotationsOverlay
        annotations={chunk.annotations || chunk.profile?.annotations || chunk.profileV2?.annotations}
        frame={frame}
        fps={fps}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Composition Component
// ---------------------------------------------------------------------------
// Main Composition Component & Stages
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Macro Hook Visual Transformation State
// ---------------------------------------------------------------------------
export const resolveHookTransformState = (
  macroHookPlan: NonNullable<CaptionChunk["hookPlan"]> | undefined,
  frame: number,
  fps: number
) => {
  let hookScale = 1.0;
  let hookBlur = 0;
  let hookBrightness = 1.0;
  let hookContrast = 1.0;
  let hookSaturate = 1.0;
  let hookRotateX = 0;
  let hookRotateY = 0;
  let hookTranslateY = 0;

  if (macroHookPlan?.hookEnabled) {
    const hookDurationFrames = Math.max(1, Math.round(((macroHookPlan.durationMs ?? 1500) / 1000) * fps));
    if (frame <= hookDurationFrames + 6) {
      const cam = macroHookPlan.camera;
      const opt = macroHookPlan.optical;
      const hookType = macroHookPlan.hookType;

      if (cam) {
        const camP = interpolate(frame, [0, Math.max(1, Math.round(((cam.durationMs ?? 1200) / 1000) * fps))], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        hookScale = interpolate(camP, [0, 1], [cam.startScale ?? 1.15, cam.endScale ?? 1.0]);
        hookRotateX = interpolate(camP, [0, 1], [cam.rotateXDeg ?? 0, 0]);
        hookRotateY = interpolate(camP, [0, 1], [cam.rotateYDeg ?? 0, 0]);
        hookTranslateY = interpolate(camP, [0, 1], [cam.translateY ?? 0, 0]);
      } else if (macroHookPlan.zoom) {
        const z = macroHookPlan.zoom;
        const zP = interpolate(frame, [0, Math.max(1, Math.round(((z.durationMs ?? 1200) / 1000) * fps))], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        hookScale = interpolate(zP, [0, 1], [z.startScale ?? 1.25, z.endScale ?? 1.0]);
      }

      if (opt) {
        const optP = interpolate(frame, [0, Math.max(1, Math.round(((opt.durationMs ?? 1200) / 1000) * fps))], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.quad),
        });
        hookBlur = interpolate(optP, [0, 1], [opt.startBlurPx ?? 16, opt.endBlurPx ?? 0]);
        if (hookType === "hook_sharp_white_flash_cut") {
          const flashP = interpolate(frame, [0, 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          hookBrightness = 1 + flashP * 1.5;
          hookContrast = 1 + flashP * 0.3;
        } else if (hookType === "hook_luma_strobe_pulse") {
          const pulseP = interpolate(frame, [0, 5, 12], [1.35, 1.1, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          hookBrightness = pulseP;
        } else if (hookType === "hook_vintage_film_burn_strobe") {
          hookBrightness = interpolate(optP, [0, 0.4, 1], [1.25, 1.1, 1.0]);
          hookSaturate = interpolate(optP, [0, 1], [0.85, 1.0]);
        } else if (hookType === "hook_bokeh_defocus_bloom" || hookType === "hook_gaussian_lens_reveal") {
          hookBrightness = interpolate(optP, [0, 0.5, 1], [1.25, 1.1, 1.0]);
        }
      }
    }
  }

  const hookTransform = `perspective(1000px) rotateX(${hookRotateX}deg) rotateY(${hookRotateY}deg) translateY(${hookTranslateY}px) scale(${hookScale})`;
  return {
    hookScale,
    hookBlur,
    hookBrightness,
    hookContrast,
    hookSaturate,
    hookRotateX,
    hookRotateY,
    hookTranslateY,
    hookTransform,
  };
};

export const resolveSourceUri = (src?: string): string => {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return staticFile(src);
};

const MiniRunSourceStage: React.FC<{
  videoSrc: string;
  orchestration?: MiniRunOrchestration;
  hasMatte?: boolean;
  macroHookPlan?: NonNullable<CaptionChunk["hookPlan"]>;
  chunks?: CaptionChunk[];
}> = ({ videoSrc, orchestration, hasMatte, macroHookPlan, chunks }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = resolveSceneVisualState(orchestration, frame, fps);
  const mediaStyle: React.CSSProperties = resolvePanScanMediaStyle(state, state.dollyBackgroundScale ?? 1.0);
  const transitionBlur = 0; // Pure luxury clarity: zero pulsing blur across cuts

  const {
    hookBlur,
    hookBrightness,
    hookContrast,
    hookSaturate,
    hookTransform,
  } = resolveHookTransformState(macroHookPlan, frame, fps);

  const combinedBlur = Math.min(24, transitionBlur * 0.35 + hookBlur);
  const filterParts = [
    combinedBlur > 0.1 ? `blur(${combinedBlur.toFixed(1)}px)` : "",
    hookBrightness !== 1.0 ? `brightness(${hookBrightness.toFixed(2)})` : "",
    hookContrast !== 1.0 ? `contrast(${hookContrast.toFixed(2)})` : "",
    hookSaturate !== 1.0 ? `saturate(${hookSaturate.toFixed(2)})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden", zIndex: 1 }}>
      <OffthreadVideo
        src={resolveSourceUri(videoSrc)}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: mediaStyle.objectPosition || "50% 50%",
          transform: `${mediaStyle.transform || ""} ${hookTransform}`.trim(),
          transformOrigin: mediaStyle.transformOrigin || "center center",
          filter: filterParts || undefined,
          zIndex: 1,
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// MacroHookStage — Overlays for chromatic aberration and anamorphic flares
// ---------------------------------------------------------------------------
const MacroHookStage: React.FC<{
  hookPlan: NonNullable<CaptionChunk["hookPlan"]> | undefined;
  fps: number;
}> = ({ hookPlan, fps }) => {
  const frame = useCurrentFrame();
  if (!hookPlan?.hookEnabled) return null;

  const hookType = hookPlan.hookType;
  const durationMs = hookPlan.durationMs ?? 1500;
  const durationFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  if (frame > durationFrames + 4) return null;

  const art = hookPlan.artifact;
  const rgbDisplace = art?.rgbDisplacePx ?? 0;
  const artP = interpolate(frame, [0, Math.min(12, durationFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const activeDisplace =
    hookType === "hook_rgb_chromatic_split_glitch" || hookType === "hook_vhs_tape_tracking_tear"
      ? interpolate(artP, [0, 0.65, 1], [rgbDisplace > 0 ? rgbDisplace : 6, 2, 0])
      : 0;

  const chromaOverlay =
    activeDisplace > 0.5 ? (
      <>
        <AbsoluteFill
          style={{
            transform: `translateX(${-activeDisplace}px)`,
            background: "rgba(255,0,85,0.09)",
            mixBlendMode: "screen",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
        <AbsoluteFill
          style={{
            transform: `translateX(${activeDisplace}px)`,
            background: "rgba(0,255,255,0.09)",
            mixBlendMode: "screen",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
      </>
    ) : null;

  const flareP =
    hookType === "hook_anamorphic_flare_burst"
      ? interpolate(frame, [0, durationFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })
      : -1;

  const flareOverlay =
    flareP >= 0 ? (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          zIndex: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${interpolate(flareP, [0, 1], [-30, 130])}%`,
            width: "160%",
            height: "4px",
            transform: "translate(-50%, -50%)",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.7) 40%, rgba(255,255,255,0.95) 50%, rgba(255,215,0,0.7) 60%, transparent 100%)",
            filter: "blur(2px) drop-shadow(0 0 12px rgba(0,229,255,0.9))",
            opacity: interpolate(flareP, [0, 0.2, 0.8, 1], [0, 0.9, 0.9, 0]),
          }}
        />
      </AbsoluteFill>
    ) : null;

  return (
    <>
      {chromaOverlay}
      {flareOverlay}
    </>
  );
};

// ---------------------------------------------------------------------------
// BackgroundCanvasStage — Renders dynamic backgrounds behind kinetic typography
// (texture_canvas, editorial_glass, gradient_atmosphere, defocus_depth, brand_canvas)
// ---------------------------------------------------------------------------
const BackgroundCanvasStage: React.FC<{
  orchestration?: MiniRunOrchestration;
  frame: number;
  fps: number;
}> = ({ orchestration, frame, fps }) => {
  const nowMs = (frame / fps) * 1000;
  const backgrounds = (orchestration as any)?.backgrounds || [];
  if (backgrounds.length === 0) return null;

  const activeBg = backgrounds.find((bg: any) => {
    const entryStart = bg.entry?.startMs ?? 0;
    const exitEnd = bg.exit?.endMs ?? entryStart + 3000;
    return nowMs >= entryStart && nowMs <= exitEnd;
  });

  if (!activeBg) return null;

  const entryStart = activeBg.entry?.startMs ?? 0;
  const entryEnd = activeBg.entry?.endMs ?? entryStart + 300;
  const exitStart = activeBg.exit?.startMs ?? entryEnd + 1500;
  const exitEnd = activeBg.exit?.endMs ?? exitStart + 300;

  const entryP = interpolate(nowMs, [entryStart, entryEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const exitP = interpolate(nowMs, [exitStart, exitEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  const baseOpacity = Math.min(entryP, 1 - exitP);
  const scale = interpolate(nowMs, [entryStart, exitEnd], activeBg.counterScale ?? [1.02, 1.10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const transitionKind = activeBg.transition?.kind ?? "crossfade";

  // Compute transition motion kinematics
  let transformExtra = "";
  let clipPathExtra: string | undefined = undefined;
  if (transitionKind === "zoom_punch") {
    const punchScale = interpolate(entryP, [0, 1], [1.08, 1.0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    });
    transformExtra = ` scale(${punchScale})`;
  } else if (transitionKind === "directional_slide_right") {
    const slideX = interpolate(entryP, [0, 1], [-48, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    transformExtra = ` translateX(${slideX}px)`;
  } else if (transitionKind === "directional_slide_left") {
    const slideX = interpolate(entryP, [0, 1], [48, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    transformExtra = ` translateX(${slideX}px)`;
  } else if (transitionKind === "iris_wipe") {
    const radius = interpolate(entryP, [0, 1], [0, 150], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    clipPathExtra = `circle(${radius}% at 50% 50%)`;
  } else if (transitionKind === "whip_pan_transition") {
    const whipX = interpolate(entryP, [0, 0.4, 1], [120, -15, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    transformExtra = ` translateX(${whipX}px)`;
  }

  const kind = activeBg.kind ?? "texture_canvas";

  // 1. Editorial Glass Treatment (tech, screencasts, dashboards, modern UI)
  if (kind === "editorial_glass") {
    const glass = activeBg.glass || {};
    const blurPx = glass.blurPx ?? 24;
    const tint = glass.tint ?? "rgba(16, 20, 32, 0.70)";
    const borderColor = glass.borderColor ?? "rgba(255, 255, 255, 0.14)";
    const textureFile = activeBg.texture?.fileName;

    return (
      <AbsoluteFill
        style={{
          zIndex: 5,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: baseOpacity,
          transform: `scale(${scale})${transformExtra}`,
          transformOrigin: "center center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "48px 28px",
            borderRadius: 28,
            backdropFilter: `blur(${blurPx}px) saturate(180%)`,
            WebkitBackdropFilter: `blur(${blurPx}px) saturate(180%)`,
            backgroundColor: tint,
            border: `1px solid ${borderColor}`,
            boxShadow: "0 16px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
            overflow: "hidden",
          }}
        >
          {/* Specular sheen sweep */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "40%",
              background: "linear-gradient(180deg, rgba(255, 255, 255, 0.09) 0%, transparent 100%)",
            }}
          />
          {textureFile && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${staticFile(`textures/${textureFile}`)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                mixBlendMode: "overlay",
                opacity: 0.14,
              }}
            />
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // 2. Gradient Atmosphere Treatment (brand ambient glow, modern clean mood)
  if (kind === "gradient_atmosphere") {
    const atmosphere = activeBg.atmosphere || {};
    const glowRgb = atmosphere.glowRgb ?? "0, 240, 255";
    const accent = atmosphere.accent ?? "#7928CA";

    return (
      <AbsoluteFill
        style={{
          zIndex: 5,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: baseOpacity * 0.88,
          transform: `scale(${scale})${transformExtra}`,
          transformOrigin: "center center",
          background: `radial-gradient(circle at 50% 36%, rgba(${glowRgb}, 0.32) 0%, rgba(14, 16, 26, 0.82) 55%, rgba(6, 8, 14, 0.95) 100%)`,
          mixBlendMode: "screen",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 75% 65%, ${accent}33 0%, transparent 50%)`,
            mixBlendMode: "overlay",
          }}
        />
      </AbsoluteFill>
    );
  }

  // 2b. B-Roll Cutaway Treatment (Top-Notch Adobe After Effects-Grade Cinematic Suite)
  if (kind === "broll_cutaway") {
    const brollData = activeBg.broll || {};
    const treatment = brollData.treatment || {};
    const treatmentName = treatment.treatment_name || "cinematic_fullbleed";
    const brollSrc = brollData.videoFile || brollData.videoUrl;

    // Ken Burns Continuous Camera Drift
    const kbStart = treatment.ken_burns?.scale_start ?? 1.0;
    const kbEnd = treatment.ken_burns?.scale_end ?? 1.06;
    const kbScale = interpolate(nowMs, [entryStart, exitEnd], [kbStart, kbEnd], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Retinal Flash Transient (1-2 frame micro-inversion on cut boundary)
    const framesSinceEntry = Math.floor(((nowMs - entryStart) / 1000) * fps);
    const isRetinalFlash =
      (treatment.transient?.retinal_flash || treatmentName === "retinal_flash_cut") &&
      framesSinceEntry >= 0 &&
      framesSinceEntry <= 2;

    // Optical Rack-Focus Dive
    const isRackFocus = treatment.optical?.defocus_dive || treatmentName === "rack_focus_spotlight";
    const diveBlur = isRackFocus
      ? interpolate(entryP, [0, 1], [36, 0], { easing: Easing.out(Easing.cubic) })
      : 0;
    const diveScale = isRackFocus
      ? interpolate(entryP, [0, 1], [1.14, 1.0], { easing: Easing.out(Easing.cubic) })
      : 1.0;

    // 2.5D Slap-Drop with Contact Bounce (Evidentiary Dossier Card)
    const isDossier = treatmentName === "evidentiary_dossier_card" || treatment.framing?.style === "polaroid_card";
    const slapScale = isDossier
      ? interpolate(entryP, [0, 0.65, 0.85, 1.0], [0.85, 1.025, 0.985, 1.0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1.0;
    const slapY = isDossier
      ? interpolate(entryP, [0, 0.65, 1.0], [-70, 6, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
    const slapRot = isDossier
      ? interpolate(entryP, [0, 0.75, 1.0], [-2.0, 0.4, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

    // Track-Matte Asymmetric Unfurl Wipe
    const isUnfurl = treatmentName === "track_matte_unfurl" || treatment.framing?.style === "unfurl_crop";
    const unfurlW = isUnfurl
      ? interpolate(entryP, [0, 0.55], [48, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })
      : 0;
    const unfurlH = isUnfurl
      ? interpolate(entryP, [0.3, 1.0], [40, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })
      : 0;
    const unfurlClip = isUnfurl ? `inset(${unfurlH}% ${unfurlW}% ${unfurlH}% ${unfurlW}% round 16px)` : clipPathExtra;

    // 3D Off-Axis Hinged Swing
    const is3DSwing = treatmentName === "hinged_3d_swing";
    const swingDeg = is3DSwing
      ? interpolate(entryP, [0, 1], [65, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })
      : 0;

    const baseFilter = [
      diveBlur > 0 ? `blur(${diveBlur.toFixed(1)}px)` : "",
      isRetinalFlash ? "invert(1) brightness(1.4)" : "",
    ].filter(Boolean).join(" ") || undefined;

    return (
      <AbsoluteFill
        style={{
          zIndex: 5,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: baseOpacity,
          clipPath: unfurlClip,
          transform: is3DSwing
            ? `perspective(1200px) rotateY(${swingDeg}deg) scale(${scale * kbScale})${transformExtra}`
            : `scale(${scale * kbScale * diveScale * slapScale}) translateY(${slapY}px) rotate(${slapRot}deg)${transformExtra}`,
          transformOrigin: is3DSwing ? "left center" : "center center",
          filter: baseFilter,
        }}
      >
        {/* Background Defocus Spotlight Isolation */}
        {isRackFocus && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backdropFilter: "blur(28px) brightness(0.68)",
              zIndex: 1,
            }}
          />
        )}

        {/* Video Canvas Layer */}
        {isDossier ? (
          // 2.5D Evidentiary Dossier Card Container
          <div
            style={{
              position: "absolute",
              top: "14%",
              left: "7%",
              width: "86%",
              height: "72%",
              borderRadius: 20,
              backgroundColor: "#0A0D14",
              border: "2px solid rgba(255, 255, 255, 0.28)",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.85), 0 36px 72px rgba(0, 0, 0, 0.78)",
              overflow: "hidden",
              zIndex: 2,
            }}
          >
            {brollSrc ? (
              <OffthreadVideo
                src={resolveSourceUri(brollSrc)}
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "radial-gradient(circle at center, #1E293B 0%, #090D16 100%)",
                }}
              />
            )}
            {/* Archival Badge & Reticle Overlay */}
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 16,
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(0, 0, 0, 0.75)",
                border: "1px solid rgba(56, 189, 248, 0.6)",
                color: "#38BDF8",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.2,
                fontFamily: "monospace",
              }}
            >
              ARCHIVE • B-ROLL PROOF
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 14,
                right: 16,
                color: "rgba(255, 255, 255, 0.65)",
                fontSize: 10,
                fontFamily: "monospace",
              }}
            >
              {brollData.photographer ? `REC // ${String(brollData.photographer).toUpperCase()}` : "PRM-REC // 9:16"}
            </div>
          </div>
        ) : (
          // Full-Bleed / Unfurl / 3D Video Stream
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
            }}
          >
            {brollSrc ? (
              <OffthreadVideo
                src={resolveSourceUri(brollSrc)}
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "radial-gradient(circle at center, rgba(30, 41, 59, 0.9) 0%, rgba(10, 14, 24, 0.98) 100%)",
                }}
              />
            )}
            {/* Cinematic Vignette Shadow */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                boxShadow: "inset 0 0 140px rgba(0, 0, 0, 0.85)",
                pointerEvents: "none",
              }}
            />
            {/* Razor Edge Stroke on Unfurl */}
            {isUnfurl && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  border: "2px solid rgba(56, 189, 248, 0.85)",
                  borderRadius: 16,
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        )}

        {/* 35mm Subtle Organic Film Grain Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 0)",
            backgroundSize: "4px 4px",
            opacity: 0.25,
            mixBlendMode: "overlay",
            pointerEvents: "none",
            zIndex: 4,
          }}
        />
      </AbsoluteFill>
    );
  }

  // 2c. Negative Space Stencil Treatment (solid knockout canvas)
  if (kind === "negative_space_stencil") {
    return (
      <AbsoluteFill
        style={{
          zIndex: 5,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: baseOpacity,
          clipPath: clipPathExtra,
          transform: `scale(${scale})${transformExtra}`,
          transformOrigin: "center center",
          background: "rgba(10, 10, 12, 0.94)",
        }}
      />
    );
  }

  // 3. Defocus Depth Treatment (cinematic focal separation for quotes and heirlooms)
  if (kind === "defocus_depth") {
    const defocus = activeBg.defocus || {};
    const blurPx = defocus.blurPx ?? 32;
    const vignette = defocus.vignetteStrength ?? 0.65;

    return (
      <AbsoluteFill
        style={{
          zIndex: 5,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: baseOpacity,
          backdropFilter: `blur(${blurPx}px) brightness(0.72)`,
          WebkitBackdropFilter: `blur(${blurPx}px) brightness(0.72)`,
          transform: `scale(${scale})${transformExtra}`,
          transformOrigin: "center center",
          background: `radial-gradient(circle at center, transparent 20%, rgba(0, 0, 0, ${vignette}) 100%)`,
        }}
      />
    );
  }

  // 4. Texture Canvas & Brand Canvas Treatment (physical tactile paper, fabric, grunge, ink)
  const intensity = activeBg.texture?.intensity ?? 0.25;
  const opacity = baseOpacity * intensity;
  const blendMode = activeBg.texture?.blendMode ?? "soft-light";
  const textureFile = activeBg.texture?.fileName;
  const brandTint = activeBg.texture?.brandTint;

  return (
    <AbsoluteFill
      style={{
        zIndex: 5, // Above base video (1), below typography (100)
        pointerEvents: "none",
        overflow: "hidden",
        opacity,
        mixBlendMode: blendMode as any,
        backgroundImage: textureFile ? `url(${staticFile(`textures/${textureFile}`)})` : undefined,
        backgroundColor: brandTint || (textureFile ? undefined : "rgba(25, 25, 35, 0.4)"),
        backgroundSize: "cover",
        backgroundPosition: "center center",
        transform: `scale(${scale})${transformExtra}`,
        transformOrigin: "center center",
      }}
    >
      {brandTint && textureFile && (
        <AbsoluteFill
          style={{
            backgroundColor: brandTint,
            mixBlendMode: "overlay",
            opacity: 0.35,
          }}
        />
      )}
    </AbsoluteFill>
  );

  // 5. Ambient Shadow Gobo Treatment (Dynamic Environment Lighting)
  // Multi-layered low-contrast shadow overlay (window frames, swaying foliage, subtle architectural silhouettes)
  // Drifting slowly via low-frequency translational loops (0.2-0.5 Hz) with 15%-35% opacity in multiply / soft-light
  if (kind === "ambient_shadow_gobo") {
    const gobo = activeBg.shadowGobo || {};
    const freq = gobo.frequencyHz ?? 0.35;
    const baseGoboOpacity = Math.min(0.35, Math.max(0.15, (gobo.opacity ?? 0.25) * baseOpacity));
    const blendMode = (gobo.blendMode as any) ?? "multiply";
    const seconds = frame / fps;

    // Temporal procedural drift (0.2 - 0.5 Hz)
    const driftX = Math.sin(seconds * freq * Math.PI * 2) * 26;
    const driftY = Math.cos(seconds * freq * 0.75 * Math.PI * 2) * 18;
    const foliageSway = Math.sin(seconds * (freq * 1.35) * Math.PI * 2) * 16;

    return (
      <AbsoluteFill
        style={{
          zIndex: 5,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: baseGoboOpacity,
          mixBlendMode: blendMode,
          transform: `scale(${scale})${transformExtra}`,
          transformOrigin: "center center",
        }}
      >
        {/* Flat neutral canvas grid surface */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#EBE9E4",
            backgroundImage:
              "radial-gradient(#BCBAB3 1.2px, transparent 1.2px), linear-gradient(to right, rgba(0,0,0,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.035) 1px, transparent 1px)",
            backgroundSize: "40px 40px, 80px 80px, 80px 80px",
          }}
        />
        {/* Layer 1: Window frame shadow mullions */}
        <div
          style={{
            position: "absolute",
            inset: "-35%",
            transform: `translate(${driftX}px, ${driftY}px) rotate(28deg)`,
            background:
              "linear-gradient(90deg, rgba(15,18,24,0.96) 0%, rgba(15,18,24,0.96) 12%, transparent 12%, transparent 48%, rgba(15,18,24,0.96) 48%, rgba(15,18,24,0.96) 54%, transparent 54%, transparent 92%, rgba(15,18,24,0.96) 92%, rgba(15,18,24,0.96) 100%), linear-gradient(0deg, rgba(15,18,24,0.96) 0%, rgba(15,18,24,0.96) 14%, transparent 14%, transparent 50%, rgba(15,18,24,0.96) 50%, rgba(15,18,24,0.96) 56%, transparent 56%, transparent 100%)",
            filter: "blur(32px)",
          }}
        />
        {/* Layer 2: Swaying foliage organic canopy shadow */}
        <div
          style={{
            position: "absolute",
            inset: "-25%",
            transform: `translate(${driftX * 1.2 + foliageSway}px, ${driftY * 0.8}px) rotate(-14deg)`,
            background:
              "radial-gradient(circle at 22% 28%, rgba(18,22,30,0.85) 0%, transparent 45%), radial-gradient(circle at 72% 62%, rgba(18,22,30,0.78) 0%, transparent 48%), radial-gradient(circle at 45% 82%, rgba(18,22,30,0.70) 0%, transparent 42%)",
            filter: "blur(38px)",
          }}
        />
      </AbsoluteFill>
    );
  }

  // 6. Hierarchical Spatial Staging: Core vs. Peripheral Micro-Assets
  // Core Hero Anchor: Centered in primary focal quadrant, scale-down settle + continuous micro-tilt (2°-5°)
  // Peripheral Micro-Assets: Distributed along canvas periphery bounding boxes (top-left, top-right, bottom-left, bottom-right)
  if (kind === "hierarchical_spatial_staging") {
    const seconds = frame / fps;
    const heroScaleSettle = interpolate(entryP, [0, 1], [1.07, 1.0], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    // Continuous micro-tilt (2° to 5°) to reveal physical thickness & catch light
    const microTiltX = 2.0 + Math.sin(seconds * 1.8) * 2.5; // 2° to 4.5°
    const microTiltY = 2.0 + Math.cos(seconds * 1.4) * 2.5; // 2° to 4.5°
    const lightSheenP = (Math.sin(seconds * 1.5) + 1) / 2;

    return (
      <AbsoluteFill
        style={{
          zIndex: 5,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: baseOpacity,
          transform: `scale(${scale})${transformExtra}`,
          transformOrigin: "center center",
          perspective: 1200,
        }}
      >
        {/* Base architectural coordinate grid canvas */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#ECEAE4",
            backgroundImage:
              "radial-gradient(#C5C3BD 1.2px, transparent 1.2px), linear-gradient(to right, rgba(0,0,0,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.035) 1px, transparent 1px)",
            backgroundSize: "40px 40px, 80px 80px, 80px 80px",
          }}
        />

        {/* Peripheral Micro-Assets Tier: Top-Left (Fountain Pen / Tool) */}
        <div
          style={{
            position: "absolute",
            top: "4%",
            left: "4%",
            width: "32%",
            height: "28%",
            transform: "rotate(-32deg) translate3d(0, 0, 10px)",
            filter: "drop-shadow(12px 18px 16px rgba(0,0,0,0.22))",
          }}
        >
          <div
            style={{
              width: "16px",
              height: "180px",
              borderRadius: "8px 8px 3px 3px",
              background: "linear-gradient(90deg, #1C1D21 0%, #444751 35%, #1C1D21 70%, #2A2B30 100%)",
              borderTop: "6px solid #C4A252",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          />
        </div>

        {/* Peripheral Micro-Assets Tier: Top-Right (Aged Document Token) */}
        <div
          style={{
            position: "absolute",
            top: "3%",
            right: "4%",
            width: "32%",
            height: "24%",
            transform: "rotate(14deg) translate3d(0, 0, 8px)",
            background: "#DFD8C8",
            borderRadius: "4px",
            boxShadow: "8px 12px 20px rgba(0,0,0,0.18), inset 0 0 16px rgba(160,130,90,0.25)",
            border: "1px solid rgba(0,0,0,0.08)",
            opacity: 0.88,
          }}
        />

        {/* Peripheral Micro-Assets Tier: Bottom-Left (Stationery Paperclip) */}
        <div
          style={{
            position: "absolute",
            bottom: "6%",
            left: "6%",
            width: "32px",
            height: "72px",
            borderRadius: "16px",
            border: "3px solid #8C929E",
            transform: "rotate(42deg) translate3d(0, 0, 12px)",
            boxShadow: "4px 6px 10px rgba(0,0,0,0.20)",
          }}
        />

        {/* Peripheral Micro-Assets Tier: Bottom-Right (Polaroid Snapshot Frame) */}
        <div
          style={{
            position: "absolute",
            bottom: "4%",
            right: "5%",
            width: "110px",
            height: "135px",
            background: "#F8F7F4",
            borderRadius: "3px",
            boxShadow: "10px 16px 24px rgba(0,0,0,0.18)",
            transform: "rotate(-10deg) translate3d(0, 0, 10px)",
            padding: "8px 8px 24px 8px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#2B2D33",
              borderRadius: "2px",
            }}
          />
        </div>

        {/* Core Hero Anchor: Center Primary Focal Quadrant */}
        <div
          style={{
            position: "absolute",
            top: "22%",
            left: "14%",
            right: "14%",
            bottom: "24%",
            transformStyle: "preserve-3d",
            transform: `scale(${heroScaleSettle}) rotateX(${microTiltX.toFixed(2)}deg) rotateY(${microTiltY.toFixed(2)}deg)`,
            boxShadow: "0 28px 56px rgba(0,0,0,0.32), 0 8px 16px rgba(0,0,0,0.18)",
            borderRadius: "12px",
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.09)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Specular sheen sweep catching directional light */}
          <div
            style={{
              position: "absolute",
              inset: "-50%",
              transform: `rotate(35deg) translateY(${(lightSheenP - 0.5) * 200}px)`,
              background: "linear-gradient(180deg, transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%)",
              pointerEvents: "none",
            }}
          />
        </div>
      </AbsoluteFill>
    );
  }

  // 7. Dynamic Attention-Gated Bokeh (Defocus Rack)
  // Focus routing: deprioritized assets dynamically drop out of focus via optical blur (radius ramping 0px to 20-35px)
  // S-curve rack focus over 300-450 ms timed inversely to incoming subject
  if (kind === "attention_gated_bokeh") {
    const bokeh = activeBg.attentionBokeh || {};
    const rackDurationMs = bokeh.rackFocusDurationMs ?? 380;
    const rackProgress = interpolate(nowMs, [entryStart, entryStart + rackDurationMs], [0, 1], {
      easing: Easing.bezier(0.42, 0.0, 0.58, 1.0),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const currentBlur = interpolate(rackProgress, [0, 1], [0, bokeh.maxBlurRadiusPx ?? 30]);

    return (
      <AbsoluteFill
        style={{
          zIndex: 5,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: baseOpacity,
          transform: `scale(${scale})${transformExtra}`,
          transformOrigin: "center center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "-8%",
            filter: `blur(${currentBlur.toFixed(1)}px)`,
            backgroundColor: "#161922",
            backgroundImage: "radial-gradient(circle at 50% 40%, #2A3042 0%, #0E1017 80%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "10%",
              border: "2px dashed rgba(255,255,255,0.12)",
              borderRadius: 24,
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 50%, transparent 25%, rgba(5,6,10,${(rackProgress * 0.55).toFixed(2)}) 85%)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  // 8. Continuous Spatial Canvas (Vertical Descent)
  // Unified plane: continuous vertical coordinate space. Inertial handoff with damped spring easing sliding upward
  if (kind === "continuous_spatial_canvas") {
    const totalSpanMs = Math.max(1, exitEnd - entryStart);
    const normProgress = Math.max(0, Math.min(1, (nowMs - entryStart) / totalSpanMs));
    const springP = interpolate(normProgress, [0, 0.85, 1], [0, 0.96, 1.0], {
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const verticalShiftPx = springP * 720;
    const exitDefocus = interpolate(normProgress, [0.75, 1.0], [0, 20], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return (
      <AbsoluteFill
        style={{
          zIndex: 5,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: baseOpacity,
          transformOrigin: "center top",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "300%",
            transform: `translate3d(0, ${-verticalShiftPx.toFixed(1)}px, 0)`,
            filter: exitDefocus > 0 ? `blur(${exitDefocus.toFixed(1)}px)` : undefined,
            backgroundColor: "#181A20",
            backgroundImage: "linear-gradient(to bottom, #181A20 0%, #1F222B 33%, #181A20 66%, #13151A 100%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "0%",
              left: "8%",
              right: "8%",
              height: "30%",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "flex-end",
              paddingBottom: "18px",
            }}
          >
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>MODULE_01 // ACTIVE_SECTION</span>
          </div>
          <div
            style={{
              position: "absolute",
              top: "33%",
              left: "8%",
              right: "8%",
              height: "30%",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "flex-end",
              paddingBottom: "18px",
            }}
          >
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>MODULE_02 // INCOMING_REVEAL</span>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // 9. Single-Frame Retinal Inversion (Micro-Flash)
  // Hard color inversion (invert 100% / difference blend) active for strictly 1 to 2 frames (~33-66 ms)
  if (kind === "single_frame_retinal_inversion" || activeBg.retinalInversion) {
    const elapsedFrames = Math.round((nowMs - entryStart) / (1000 / fps));
    const maxFrames = activeBg.retinalInversion?.durationFrames ?? 2;
    if (elapsedFrames < maxFrames) {
      return (
        <AbsoluteFill
          style={{
            zIndex: 60,
            pointerEvents: "none",
            mixBlendMode: (activeBg.retinalInversion?.blendMode as any) ?? "difference",
            backgroundColor: "#FFFFFF",
            filter: "invert(100%)",
          }}
        />
      );
    }
  }
};

// ---------------------------------------------------------------------------
// FrameTreatmentStage — Renders background materials (paper, graph_grid, etc.)
// ---------------------------------------------------------------------------
const FrameTreatmentStage: React.FC<{
  frameTreatment?: TypographyFrameTreatment;
}> = ({ frameTreatment }) => {
  if (!frameTreatment || !frameTreatment.backgroundMaterial) {
    return null;
  }
  const mat = frameTreatment.backgroundMaterial;
  const opacity = frameTreatment.materialOpacity ?? 0.15;

  let bgPattern = "";
  if (mat === "graph_grid") {
    bgPattern = "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)";
  } else if (mat === "paper" || mat === "dark_noise") {
    bgPattern = "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 1px, transparent 1px)";
  } else if (mat === "metallic") {
    bgPattern = "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)";
  }

  if (!bgPattern) return null;

  return (
    <AbsoluteFill
      style={{
        zIndex: 6,
        pointerEvents: "none",
        opacity,
        backgroundImage: bgPattern,
        backgroundSize: mat === "graph_grid" ? "40px 40px" : "8px 8px",
        mixBlendMode: "overlay",
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// TransitionFXStage — Renders cinematic transition overlays across scenes
// (film burns, white flash cuts, bokeh defocus blends, whip pan streaks)
// ---------------------------------------------------------------------------
const TransitionFXStage: React.FC<{
  orchestration?: MiniRunOrchestration;
  frame: number;
  fps: number;
}> = ({ orchestration, frame, fps }) => {
  const nowMs = (frame / fps) * 1000;
  const transitions = (orchestration as any)?.transitions || [];
  if (transitions.length === 0) return null;

  const activeTrans = transitions.find((tr: any) => nowMs >= tr.startMs && nowMs <= tr.endMs);
  if (!activeTrans) return null;

  const dur = Math.max(1, activeTrans.endMs - activeTrans.startMs);
  const p = Math.max(0, Math.min(1, (nowMs - activeTrans.startMs) / dur));
  // Organic sinusoidal bell curve for natural rise and fall
  const peakStrength = Math.pow(Math.sin(p * Math.PI), 1.5);
  const effect = activeTrans.effect || "film_burn";

  // 1. Vintage 35mm Film Burn Transition (Multi-Variant Architectural Engine):
  // Supports distinct organic visual variants so consecutive transitions never look identical:
  // Variant 1: Amber Gate Burn (Top-Right flare, 115 deg diagonal streak, lower-left counter-leak)
  // Variant 2: Warm Bleach Burst (Flank-Left anamorphic bar, platinum core, fiery copper perimeter)
  // Variant 3: Prismatic Solar Flare (Top-Left sunburst, radiant yellow-amber corona, vertical streak)
  // Variant 4: Perforation Roll Burn (Bottom-Edge gate surge, crimson-amber bloom, lower anamorphic arc)
  if (effect === "film_burn" || effect === "film_burn_strobe" || effect === "vintage_film_burn") {
    const rawVariant = activeTrans.variant || (
      activeTrans.id
        ? (Math.abs(String(activeTrans.id).split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)) % 4) + 1
        : 1
    );
    const variant = Number(rawVariant) || 1;

    const jitter = Math.sin(frame * 3.7) * 0.08 + 0.94;
    const shiftX = Math.cos(frame * 2.5) * 14;
    const shiftY = Math.sin(frame * 4.1) * 10;
    const burnOpacity = Math.min(1.0, peakStrength * 0.92 * jitter);

    if (variant === 2) {
      // Variant 2: Flank-Left Anamorphic Bleach Burst (Horizontal flare bar + copper perimeter)
      return (
        <AbsoluteFill
          style={{
            zIndex: 45,
            pointerEvents: "none",
            overflow: "hidden",
            opacity: burnOpacity,
            mixBlendMode: "screen",
            filter: "blur(10px)",
          }}
        >
          {/* Layer 1: Left-flank brilliant golden-white core breach */}
          <div
            style={{
              position: "absolute",
              inset: "-15%",
              transform: `translate(${shiftX * 0.8}px, ${shiftY * 1.2}px)`,
              background:
                "radial-gradient(circle at 12% 48%, rgba(255, 253, 240, 1.0) 0%, rgba(255, 210, 80, 0.94) 20%, rgba(255, 120, 25, 0.82) 44%, rgba(180, 20, 15, 0.45) 68%, transparent 90%)",
            }}
          />
          {/* Layer 2: Horizontal anamorphic flare bar sweeping across the mid-frame */}
          <div
            style={{
              position: "absolute",
              inset: "-20%",
              transform: `rotate(${-8 + shiftY * 0.3}deg) translateY(${shiftX * 0.5}px)`,
              background:
                "linear-gradient(180deg, transparent 20%, rgba(255, 160, 40, 0.75) 38%, rgba(255, 255, 245, 0.98) 50%, rgba(255, 110, 20, 0.70) 62%, transparent 80%)",
            }}
          />
          {/* Layer 3: Counter-corner secondary leak (top right margin) */}
          <div
            style={{
              position: "absolute",
              inset: "-15%",
              background:
                "radial-gradient(circle at 88% 16%, rgba(255, 220, 150, 0.8) 0%, rgba(255, 130, 30, 0.65) 28%, rgba(160, 25, 10, 0.3) 55%, transparent 82%)",
            }}
          />
          {/* Layer 4: Platinum warm exposure bloom */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `rgba(255, 242, 215, ${peakStrength * 0.28})`,
            }}
          />
        </AbsoluteFill>
      );
    }

    if (variant === 3) {
      // Variant 3: Top-Left Prismatic Sunburst (Radiant solar flare + vertical streak)
      return (
        <AbsoluteFill
          style={{
            zIndex: 45,
            pointerEvents: "none",
            overflow: "hidden",
            opacity: burnOpacity,
            mixBlendMode: "screen",
            filter: "blur(11px)",
          }}
        >
          {/* Layer 1: Radiant top-left solar core */}
          <div
            style={{
              position: "absolute",
              inset: "-15%",
              transform: `translate(${shiftX * 1.1}px, ${shiftY * 0.9}px)`,
              background:
                "radial-gradient(circle at 18% 12%, rgba(255, 250, 200, 1.0) 0%, rgba(255, 185, 45, 0.95) 24%, rgba(255, 95, 20, 0.78) 48%, rgba(170, 30, 12, 0.4) 72%, transparent 92%)",
            }}
          />
          {/* Layer 2: Downward diagonal gate streak */}
          <div
            style={{
              position: "absolute",
              inset: "-20%",
              transform: `rotate(${48 + shiftX * 0.3}deg) translateY(${shiftY * 1.2}px)`,
              background:
                "linear-gradient(180deg, transparent 18%, rgba(255, 180, 50, 0.7) 36%, rgba(255, 252, 230, 0.96) 50%, rgba(255, 130, 25, 0.65) 64%, transparent 82%)",
            }}
          />
          {/* Layer 3: Counter-corner secondary leak (lower right) */}
          <div
            style={{
              position: "absolute",
              inset: "-15%",
              background:
                "radial-gradient(circle at 82% 86%, rgba(255, 205, 120, 0.8) 0%, rgba(255, 110, 20, 0.6) 30%, rgba(180, 25, 8, 0.3) 58%, transparent 85%)",
            }}
          />
          {/* Layer 4: Solar golden wash */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `rgba(255, 240, 190, ${peakStrength * 0.25})`,
            }}
          />
        </AbsoluteFill>
      );
    }

    if (variant === 4) {
      // Variant 4: Bottom Perforation Roll Burn (Rising gate surge)
      return (
        <AbsoluteFill
          style={{
            zIndex: 45,
            pointerEvents: "none",
            overflow: "hidden",
            opacity: burnOpacity,
            mixBlendMode: "screen",
            filter: "blur(12px)",
          }}
        >
          {/* Layer 1: Bottom edge gate breach */}
          <div
            style={{
              position: "absolute",
              inset: "-15%",
              transform: `translate(${shiftX * 0.7}px, ${shiftY * 1.3}px)`,
              background:
                "radial-gradient(circle at 50% 92%, rgba(255, 248, 205, 1.0) 0%, rgba(255, 170, 45, 0.94) 25%, rgba(255, 80, 15, 0.82) 50%, rgba(160, 20, 10, 0.45) 75%, transparent 92%)",
            }}
          />
          {/* Layer 2: Near-vertical rising gate leak beam */}
          <div
            style={{
              position: "absolute",
              inset: "-20%",
              transform: `rotate(${88 + shiftX * 0.2}deg) translateY(${shiftY * 0.8}px)`,
              background:
                "linear-gradient(180deg, transparent 22%, rgba(255, 150, 30, 0.72) 38%, rgba(255, 250, 225, 0.95) 50%, rgba(255, 100, 15, 0.65) 62%, transparent 78%)",
            }}
          />
          {/* Layer 3: Whole frame projector warm exposure wash */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `rgba(255, 230, 185, ${peakStrength * 0.26})`,
            }}
          />
        </AbsoluteFill>
      );
    }

    // Default Variant 1: Amber Gate Burn (Top-Right flare, 115 deg diagonal streak, lower-left counter-leak)
    return (
      <AbsoluteFill
        style={{
          zIndex: 45,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: burnOpacity,
          mixBlendMode: "screen",
          filter: "blur(12px)",
        }}
      >
        {/* Layer 1: Dominant top-right gate flare and fiery amber core */}
        <div
          style={{
            position: "absolute",
            inset: "-15%",
            transform: `translate(${shiftX}px, ${shiftY}px)`,
            background:
              "radial-gradient(circle at 85% 18%, rgba(255, 245, 190, 1.0) 0%, rgba(255, 175, 50, 0.92) 22%, rgba(255, 90, 20, 0.8) 46%, rgba(190, 25, 8, 0.45) 70%, transparent 92%)",
          }}
        />
        {/* Layer 2: Diagonal gate streak & exposure burst */}
        <div
          style={{
            position: "absolute",
            inset: "-20%",
            transform: `rotate(${115 + shiftX * 0.4}deg) translateY(${shiftY * 1.5}px)`,
            background:
              "linear-gradient(180deg, transparent 15%, rgba(255, 140, 25, 0.7) 35%, rgba(255, 250, 220, 0.95) 50%, rgba(255, 100, 15, 0.65) 65%, transparent 85%)",
          }}
        />
        {/* Layer 3: Counter-corner secondary leak (lower left) */}
        <div
          style={{
            position: "absolute",
            inset: "-15%",
            background:
              "radial-gradient(circle at 15% 82%, rgba(255, 215, 130, 0.85) 0%, rgba(255, 120, 25, 0.7) 30%, rgba(180, 30, 10, 0.35) 60%, transparent 85%)",
          }}
        />
        {/* Layer 4: Whole-frame projector warm exposure bloom */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(255, 235, 195, ${peakStrength * 0.26})`,
          }}
        />
      </AbsoluteFill>
    );
  }

  // 2. Anamorphic Light Leak Sweep:
  // Prismatic horizontal anamorphic flare sweeping across the frame
  if (effect === "light_leak_sweep") {
    const leakAngle = interpolate(p, [0, 1], [-35, -5]);
    const leakShift = interpolate(p, [0, 1], [-140, 140]);
    return (
      <AbsoluteFill
        style={{
          zIndex: 45,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: peakStrength * 0.76,
          mixBlendMode: "screen",
          filter: "blur(18px)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "-25%",
            transform: `rotate(${leakAngle}deg) translateY(${leakShift}px)`,
            background:
              "linear-gradient(180deg, transparent 0%, rgba(255, 195, 95, 0.75) 30%, rgba(255, 248, 220, 0.96) 50%, rgba(190, 150, 255, 0.55) 68%, transparent 100%)",
          }}
        />
      </AbsoluteFill>
    );
  }

  // 3. Optical Bokeh Defocus Blend:
  // Warm concentric optical bokeh spheres blooming across the center
  if (effect === "bokeh_defocus_blend") {
    return (
      <AbsoluteFill
        style={{
          zIndex: 45,
          pointerEvents: "none",
          opacity: peakStrength * 0.68,
          mixBlendMode: "screen",
          background:
            "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.75) 0%, rgba(255, 225, 170, 0.55) 32%, rgba(255, 180, 110, 0.3) 58%, transparent 80%)",
          filter: "blur(16px)",
        }}
      />
    );
  }

  // 4. Subtle exposure flash / crash snap (gentle golden exposure pop, never harsh raw white)
  if (effect === "flash_cut" || effect === "camera_crash_snap") {
    return (
      <AbsoluteFill
        style={{
          zIndex: 45,
          pointerEvents: "none",
          opacity: peakStrength * 0.42,
          mixBlendMode: "screen",
          background: "rgba(255, 248, 230, 0.9)",
          filter: "blur(8px)",
        }}
      />
    );
  }

  // 5. Single-Frame Retinal Inversion (Micro-Flash)
  // Instantaneous hard color inversion (invert(100%) or full-canvas Difference blend)
  // active for strictly 1 to 2 frames (~33-66 ms) marking audio transients or phase shifts
  if (
    effect === "single_frame_retinal_inversion" ||
    effect === "micro_flash_inversion" ||
    effect === "retinal_inversion"
  ) {
    const elapsedFrames = Math.round((nowMs - activeTrans.startMs) / (1000 / fps));
    if (elapsedFrames <= 1) {
      return (
        <AbsoluteFill
          style={{
            zIndex: 60,
            pointerEvents: "none",
            mixBlendMode: "difference",
            backgroundColor: "#FFFFFF",
            filter: "invert(100%)",
          }}
        />
      );
    }
  }

  return null;
};

// ---------------------------------------------------------------------------
// 2.5D After Effects-Style Spatial 3D Camera & Node Rig
// ---------------------------------------------------------------------------

export const computeSpatial3DCameraTransform = (
  globalFrame: number,
  fps: number,
  spatialCamera?: MiniRunOrchestration["spatialCamera3D"]
): {
  camX: number;
  camY: number;
  camZ: number;
  camPitch: number;
  camYaw: number;
  camRoll: number;
} => {
  // Rock-solid stable framing: zero camera drift, zero cross-node jitter
  return { camX: 0, camY: 0, camZ: 0, camPitch: 0, camYaw: 0, camRoll: 0 };
};

export const Spatial3DCameraRig: React.FC<{
  spatialCamera?: MiniRunOrchestration["spatialCamera3D"];
  frame: number;
  fps: number;
  children: React.ReactNode;
}> = ({ spatialCamera, frame, fps, children }) => {
  if (!spatialCamera?.enabled) {
    return <AbsoluteFill style={{ pointerEvents: "none", zIndex: 25 }}>{children}</AbsoluteFill>;
  }

  const { camX, camY, camZ, camPitch, camYaw, camRoll } = computeSpatial3DCameraTransform(
    frame,
    fps,
    spatialCamera
  );

  const perspectivePx = spatialCamera.perspectivePx || 1200;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        perspective: `${perspectivePx}px`,
        perspectiveOrigin: "50% 50%",
        transformStyle: "preserve-3d",
        zIndex: 25,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `translate3d(${-camX.toFixed(2)}px, ${-camY.toFixed(2)}px, ${-camZ.toFixed(2)}px) rotateX(${-camPitch.toFixed(2)}deg) rotateY(${-camYaw.toFixed(2)}deg) rotateZ(${-camRoll.toFixed(2)}deg)`,
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

export const PrometheusMinRun: React.FC<PrometheusMinRunProps> = ({
  videoSrc,
  matteSrc,
  chunks,
  durationMs,
  orchestration,
  audioTrackSrc,
  soundtrackSrc,
  profile,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Extract the hook plan from chunk 0 for macro video-level treatment
  const macroHookPlan = chunks?.[0]?.hookPlan;
  const bgAudio = audioTrackSrc || soundtrackSrc;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* 0. Optional Dedicated Audio / Music Soundtrack Bed */}
      {bgAudio && (
        <Audio src={resolveSourceUri(bgAudio)} />
      )}

      {/* 1. Base Video (Z: 1) with smooth cinematic pan-scan + Hook Transform */}
      <MiniRunSourceStage
        videoSrc={videoSrc}
        orchestration={orchestration}
        hasMatte={Boolean(matteSrc)}
        macroHookPlan={macroHookPlan}
        chunks={chunks}
      />

      {/* 1b. Macro Hook Overlays (Z: 2-4) */}
      <MacroHookStage hookPlan={macroHookPlan} fps={fps} />

      {/* 1c. Texture Background Canvas Stage (Z: 5) */}
      <BackgroundCanvasStage orchestration={orchestration} frame={frame} fps={fps} />

      {/* 1c2. Frame Treatment Material Stage (Z: 6) */}
      <FrameTreatmentStage frameTreatment={profile?.frameTreatment || chunks?.[0]?.frameTreatment || chunks?.[0]?.profile?.frameTreatment} />

      {/* 1d. Transition Visual Effects Stage (Z: 8) — Film Burns, Flash Cuts, Whip Streaks */}
      <TransitionFXStage orchestration={orchestration} frame={frame} fps={fps} />

      {/* 2. Multi-Layer Speech-Synchronized Kinetic Typography Chunks in Spatial 3D Camera Rig (Z: 10 / 100) */}
      <Spatial3DCameraRig
        spatialCamera={orchestration?.spatialCamera3D}
        frame={frame}
        fps={fps}
      >
        {(() => {
          return chunks.map((chunk, idx) => {
            // Frame-accurate source time synchronization (prioritize startMs from source audio)
            const startMs = chunk.startMs ?? chunk.outputStartMs ?? 0;
            const endMs = chunk.endMs ?? chunk.outputEndMs ?? startMs + 1500;
            const displayStartMs = chunk.displayStartMs ?? startMs;
            const displayEndMs = chunk.displayEndMs ?? endMs;

            const contentStartFrame = Math.round((startMs / 1000) * fps);
            const rawEndFrame = Math.round((displayEndMs / 1000) * fps);
            const layers = chunk.layers || [];
            const leadFrames = Math.max(
              0,
              ...layers.map((layer) =>
                Math.round(
                  (((layer.effectiveEntryLeadMs ?? layer.entryLeadMs) ??
                    (layer.isHero ? 100 : 60)) /
                    1000) *
                    fps
                )
              )
            );

            // Allow caption sequence temporal overlap (Zero Stacking Lock):
            // Each chunk enters at its scheduled displayStartMs or lead-in frame
            const startFrame = Math.max(
              0,
              Math.round((displayStartMs / 1000) * fps),
              contentStartFrame - leadFrames
            );
            const endFrame = Math.max(startFrame + 1, rawEndFrame);

            const relativeContentStartFrame = Math.max(0, contentStartFrame - startFrame);
            const durationFrames = Math.max(1, endFrame - startFrame);

            return (
              <Sequence
                key={`chunk-${idx}-${startMs}`}
                from={startFrame}
                durationInFrames={durationFrames}
              >
                <MultiLayerTypographyCard
                  chunk={chunk}
                  contentStartFrame={relativeContentStartFrame}
                  endFrame={durationFrames}
                  subjectMatteAvailable={Boolean(matteSrc)}
                />
              </Sequence>
            );
          });
        })()}
      </Spatial3DCameraRig>

      {/* 3. Foreground Subject Matte Cutout Layer (Z: 50) */}
      {matteSrc && (() => {
        const hasBehindSubjectLayer = (chunks || []).some((chunk) => {
          const startMs = chunk.startMs ?? chunk.outputStartMs ?? chunk.displayStartMs ?? 0;
          const endMs = chunk.endMs ?? chunk.outputEndMs ?? chunk.displayEndMs ?? (startMs + 1500);
          const s = Math.round((startMs / 1000) * fps);
          const e = Math.round((endMs / 1000) * fps);
          if (frame < s || frame >= e) return false;
          const safeRegion = (chunk.placement as any)?.safeRegionId;
          const domZone = (chunk.placement as any)?.dominantZone;
          const isActuallyBehind =
            safeRegion === "behind_subject_above_head" ||
            domZone === "cranial_crown" ||
            domZone === "flank_right_column" ||
            domZone === "flank_left_column" ||
            Boolean(safeRegion?.includes("flank")) ||
            (chunk.placement as any)?.intersectsSubject === true;
          if (!isActuallyBehind) return false;
          const layers = chunk.layers || [];
          return layers.some((layer) => layer.behindSubject);
        });
        if (!hasBehindSubjectLayer) return null;

        const state = resolveSceneVisualState(orchestration, frame, fps);
        const mediaStyle = resolvePanScanMediaStyle(state, 1.0);
        const {
          hookBlur,
          hookBrightness,
          hookContrast,
          hookSaturate,
          hookTransform,
        } = resolveHookTransformState(macroHookPlan, frame, fps);
        const combinedBlur = Math.min(24, hookBlur);
        const filterParts = [
          combinedBlur > 0.1 ? `blur(${combinedBlur.toFixed(1)}px)` : "",
          hookBrightness !== 1.0 ? `brightness(${hookBrightness.toFixed(2)})` : "",
          hookContrast !== 1.0 ? `contrast(${hookContrast.toFixed(2)})` : "",
          hookSaturate !== 1.0 ? `saturate(${hookSaturate.toFixed(2)})` : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <AbsoluteFill style={{ zIndex: 45, pointerEvents: "none", overflow: "hidden" }}>
            {/* Layer 2: Ambient Drop Shadow / Depth Occluder behind Subject (Z: 45) */}
            <OffthreadVideo
              src={resolveSourceUri(matteSrc)}
              transparent
              muted
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: mediaStyle.objectPosition || "50% 50%",
                transform: `${mediaStyle.transform || ""} ${hookTransform}`.trim(),
                transformOrigin: mediaStyle.transformOrigin || "center center",
                filter: "brightness(0) blur(18px) opacity(0.45)",
                zIndex: 45,
              }}
            />

            {/* Layer 3: Foreground Subject Matte Cutout Layer (Z: 50) */}
            <OffthreadVideo
              src={resolveSourceUri(matteSrc)}
              transparent
              muted
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: mediaStyle.objectPosition || "50% 50%",
                transform: `${mediaStyle.transform || ""} ${hookTransform}`.trim(),
                transformOrigin: mediaStyle.transformOrigin || "center center",
                filter: filterParts || undefined,
                zIndex: 50,
              }}
            />
          </AbsoluteFill>
        );
      })()}
    </AbsoluteFill>
  );
};

export default PrometheusMinRun;
