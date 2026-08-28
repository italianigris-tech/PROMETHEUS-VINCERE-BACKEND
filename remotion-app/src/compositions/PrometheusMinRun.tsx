import React from "react";
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  Sequence,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
// All fonts are loaded via local CSS font-face definitions in all_fonts_dynamic.css and mixfonts.css


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
  gradient?: string;
  glow?: string;
  shadow?: string;
  textFillColor?: string;
  hasGradient?: boolean;
  doubleUnderline?: boolean;
  marginTopPx?: number;
  blendMode?: "difference";
};

type TypographyPaintInput = Pick<TypographyLayer, "color"> & Partial<Pick<
  TypographyLayer,
  "blendMode" | "textFillColor" | "gradient" | "glow" | "shadow" | "hasGradient" | "behindSubject" | "isHero"
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

export const resolveTypographyPaintStyle = (layer: TypographyPaintInput): React.CSSProperties => {
  if (layer.blendMode === "difference") {
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

  const rawColor = layer.textFillColor || layer.color || (layer.isHero ? "#FF453A" : "#FFFFFF");
  // Anti-Chameleon safeguard: never render dark/black text over video scenes without difference mode
  const textColor = isDarkColor(rawColor) ? (layer.isHero ? "#FF453A" : "#FFFFFF") : rawColor;
  const hasGradient = Boolean(layer.hasGradient && layer.gradient && layer.gradient !== "none");
  return {
    color: hasGradient ? undefined : textColor,
    backgroundImage: hasGradient ? layer.gradient : undefined,
    WebkitBackgroundClip: hasGradient ? "text" : undefined,
    WebkitTextFillColor: hasGradient ? "transparent" : undefined,
    filter: hasGradient
      ? `drop-shadow(0 4px 18px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 10px ${layer.glow || "rgba(255,255,255,0.4)"})`
      : undefined,
    textShadow: hasGradient ? undefined : (layer.shadow || (layer.behindSubject
      ? "0 4px 30px rgba(0, 0, 0, 0.98), 0 2px 10px rgba(0, 0, 0, 0.92), 0 0 4px rgba(0, 0, 0, 1.0)"
      : "0 4px 20px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.90), 0 0 3px rgba(0, 0, 0, 0.95)")),
    mixBlendMode: undefined,
  };
};

export const resolveTypographyContainerFilter = (
  layers: Array<Pick<TypographyLayer, "blendMode">>,
): string | undefined => layers.some((layer) => layer.blendMode === "difference")
  ? undefined
  : "drop-shadow(0 4px 20px rgba(0, 0, 0, 0.85))";

export const resolveTypographyContainerBlendMode = (
  layers: Array<Pick<TypographyLayer, "blendMode">>,
): React.CSSProperties["mixBlendMode"] => layers.some((layer) => layer.blendMode === "difference")
  ? "difference"
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

export const resolveChunkEntranceFrame = (contentStartFrame: number, totalFrames: number): number => (
  Math.max(1, Math.min(contentStartFrame, totalFrames))
);

export type CaptionChunk = {
  chunkIndex?: number;
  text: string;
  startMs?: number;
  endMs?: number;
  outputStartMs?: number;
  outputEndMs?: number;
  displayStartMs?: number;
  displayEndMs?: number;
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
    kind: "blurred_wings";
    blurPx: number;
    brightness: number;
    counterScale: [number, number];
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
    causedByTransitionId?: string | null;
    causedBySceneId?: string | null;
  }>;
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
  const cameraProgress = camera
    ? Easing.bezier(...camera.curve)(clampedProgress(nowMs, camera.startMs, camera.endMs))
    : 0;

  // Continuous Smooth Cinematic Camera Panning (zero abrupt step jumps):
  let focalXPercent = 50;
  if (scenes.length === 1) {
    focalXPercent = scenes[0].focalPoint?.xPercent ?? 50;
  } else if (scenes.length > 1) {
    const keyframes = scenes.map((s) => ({
      timeMs: (s.startMs + s.endMs) / 2,
      x: s.focalPoint?.xPercent ?? 50,
    }));
    if (nowMs <= keyframes[0].timeMs) {
      focalXPercent = keyframes[0].x;
    } else if (nowMs >= keyframes[keyframes.length - 1].timeMs) {
      focalXPercent = keyframes[keyframes.length - 1].x;
    } else {
      let idx = 0;
      while (idx < keyframes.length - 1 && nowMs > keyframes[idx + 1].timeMs) {
        idx++;
      }
      const k1 = keyframes[idx];
      const k2 = keyframes[idx + 1];
      const t = (nowMs - k1.timeMs) / Math.max(1, k2.timeMs - k1.timeMs);
      const smoothT = (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, t)))) / 2;
      focalXPercent = k1.x + (k2.x - k1.x) * smoothT;
    }
  } else if (scene?.focalPoint?.xPercent !== undefined) {
    focalXPercent = scene.focalPoint.xPercent;
  }

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
    backgroundScale: background
      ? interpolate(sceneProgress, [0, 1], background.counterScale, {extrapolateLeft: "clamp", extrapolateRight: "clamp"})
      : 1,
    pipCornerRadiusPx: pip?.cornerRadiusPx ?? 0,
    pipScale,
    cameraScale: camera
      ? interpolate(cameraProgress, [0, 1], [camera.startScale ?? 1, camera.endScale ?? camera.overshootScale], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})
      : 1,
    transitionId: transition?.id,
    transitionProgress,
    transitionStrength,
    cameraMoveId: camera?.id,
  };
};


export const resolvePanScanMediaStyle = (state: SceneVisualState) => ({
  objectPosition: `${state.focalXPercent}% 50%`,
  transform: `scale(${state.cameraScale})`,
  transformOrigin: "center",
});

export type PrometheusMinRunProps = {
  videoSrc: string;
  matteSrc?: string;
  chunks: CaptionChunk[];
  durationMs: number;
  orchestration?: MiniRunOrchestration;
};

export const RUNTIME_TREATMENT_IDS = new Set([
  "subpixel_glow_mask",
  "focus_hunting_bokeh_shimmer",
  "gaussian_blur_reveal_sweep",
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
  "hook_rgb_chromatic_split_glitch",
  "hook_crt_scanline_matrix_decode",
  "hook_vhs_tape_tracking_tear",
  "hook_metallic_chrome_reflection",
  "hook_liquid_ink_metaball_reveal",
  "hook_zora_aperture_mask_bloom",
  "hook_motion_blur_word",
  "hook_camera_lens_blur_reveal",
  "hook_directional_blur_sweep",
  "zora_mask_reveal",
]);

export const normalizeRuntimePreset = (preset: string | undefined): string => (
  preset && RUNTIME_TREATMENT_IDS.has(preset) ? preset : "subpixel_glow_mask"
);

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
  "hook_smooth_zoom_in", "hook_full_zoom_up", "hook_rgb_chromatic_split_glitch",
  "hook_crt_scanline_matrix_decode", "hook_vhs_tape_tracking_tear", "hook_metallic_chrome_reflection",
  "hook_liquid_ink_metaball_reveal", "hook_zora_aperture_mask_bloom", "hook_motion_blur_word",
  "hook_camera_lens_blur_reveal", "hook_directional_blur_sweep", "zora_mask_reveal",
  ...EXTENDED_ANIMA_TREATMENTS,
]);

// ---------------------------------------------------------------------------
// Behind-Subject Typography Metrics Resolver
// ---------------------------------------------------------------------------
export const resolveBehindSubjectTypographyMetrics = ({
  charLength,
  availableHeightRatio = 0.16,
}: {
  charLength: number;
  availableHeightRatio?: number;
}): {
  fontSize: number;
  scaleX: number;
  scaleY: number;
  letterSpacing: string;
} => {
  const len = Math.max(1, charLength);
  
  if (availableHeightRatio >= 0.22) {
    // Generous headroom (e.g. low head framing) — expanded 1/3 larger for bold stature
    const fontSize = len <= 4 ? 345 : len <= 7 ? 290 : len <= 10 ? 245 : 205;
    const scaleY = len <= 5 ? 1.45 : 1.36;
    const scaleX = len <= 5 ? 1.22 : 1.14;
    const letterSpacing = len <= 5 ? "0.10em" : "0.06em";
    return { fontSize, scaleX, scaleY, letterSpacing };
  } else if (availableHeightRatio >= 0.13) {
    // Standard headroom (e.g. medium framing)
    const fontSize = len <= 4 ? 290 : len <= 7 ? 250 : len <= 10 ? 210 : 180;
    const scaleY = len <= 5 ? 1.38 : 1.30;
    const scaleX = len <= 5 ? 1.20 : 1.12;
    const letterSpacing = len <= 5 ? "0.09em" : "0.05em";
    return { fontSize, scaleX, scaleY, letterSpacing };
  } else {
    // Constrained headroom (e.g. tight top framing / high head)
    const fontSize = len <= 4 ? 240 : len <= 7 ? 205 : len <= 10 ? 175 : 155;
    const scaleY = 1.28;
    const scaleX = 1.15;
    const letterSpacing = len <= 5 ? "0.08em" : "0.05em";
    return { fontSize, scaleX, scaleY, letterSpacing };
  }
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
}> = ({ layer, frame, chunkStartMs, chunkEndMs, fps, totalFrames, contentStartFrame, hookPlan, placement }) => {
  const fx = normalizeRuntimePreset(layer.fxPreset || (layer.isHero ? "focus_hunting_bokeh_shimmer" : "subpixel_glow_mask"));
  const words = layer.text.split(" ").filter((word) => word.length > 0);
  const leadFrames = Math.round((((layer.effectiveEntryLeadMs ?? layer.entryLeadMs) ?? (layer.isHero ? 280 : 160)) / 1000) * fps);
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
  const rawString = words.join(" ");
  const charLength = Math.max(1, rawString.length);
  const behindMetrics = resolveBehindSubjectTypographyMetrics({
    charLength,
    availableHeightRatio: placement?.availableHeightRatio,
  });
  const behindSubjectFontSize = behindMetrics.fontSize;
  const behindSubjectScaleX = behindMetrics.scaleX;
  const behindSubjectScaleY = behindMetrics.scaleY;

  const rawColor = layer.textFillColor || layer.color || (layer.isHero ? "#FF453A" : "#FFFFFF");
  const textColor = isDarkColor(rawColor) ? (layer.isHero ? "#FF453A" : "#FFFFFF") : rawColor;
  const hasGrad = Boolean(layer.hasGradient && layer.gradient && layer.gradient !== "none");

  const wordPaintStyle: React.CSSProperties = layer.blendMode === "difference"
    ? {
        color: "#FFFFFF",
        WebkitTextFillColor: "#FFFFFF",
        mixBlendMode: "difference",
      }
    : hasGrad
    ? {
        backgroundImage: layer.gradient,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        WebkitTextStroke: "1.2px rgba(255, 255, 255, 0.75)",
        filter: `drop-shadow(0 4px 18px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 14px ${layer.glow || "rgba(255, 69, 58, 0.5)"})`,
      }
    : {
        color: textColor,
        WebkitTextFillColor: textColor,
        WebkitTextStroke: isBehindSubject ? "1.5px rgba(0, 0, 0, 0.9)" : "1.2px rgba(0, 0, 0, 0.85)",
      };

  const kineticTextShadow = (value?: string): string | undefined => {
    if (layer.blendMode === "difference" || hasGrad) return undefined;
    return value || (isBehindSubject
      ? "0 4px 30px rgba(0, 0, 0, 0.98), 0 2px 10px rgba(0, 0, 0, 0.92), 0 0 4px rgba(0, 0, 0, 1.0)"
      : "0 4px 20px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.90), 0 0 3px rgba(0, 0, 0, 0.95)");
  };

  // Continuous subtle kinetic life during resting phase
  const restingTrackingOffset = isBehindSubject
    ? 0
    : interpolate(frame, [0, Math.max(1, totalFrames)], [0, 0.025], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const currentLetterSpacing = isBehindSubject
    ? behindMetrics.letterSpacing
    : `${(layer.letterSpacingEm || 0) + restingTrackingOffset}em`;
  const restingFloatY = Math.sin((frame + (layer.layerIndex || 0) * 3) * 0.1) * 1.5;

  const baseTextStyle: React.CSSProperties = {
    fontFamily: `"${layer.fontFamily}", "${layer.accentFont || "sans-serif"}", sans-serif`,
    fontWeight: isBehindSubject ? 900 : layer.fontWeight,
    fontStyle: layer.fontStyle as any,
    fontSize: isBehindSubject ? `${behindSubjectFontSize}px` : `${layer.fontSizePx}px`,
    letterSpacing: currentLetterSpacing,
    lineHeight: isBehindSubject ? 0.85 : layer.lineHeight,
    marginTop: layer.marginTopPx !== undefined ? `${layer.marginTopPx}px` : undefined,
    position: "relative",
    zIndex: (layer.marginTopPx && layer.marginTopPx < 0) ? 2 : 1,
    maxWidth: isBehindSubject ? "1020px" : "100%",
    borderBottom: layer.doubleUnderline ? `3px double ${textColor}` : "none",
    paddingBottom: layer.doubleUnderline ? "6px" : "0px",
    display: "inline-flex",
    flexWrap: isBehindSubject ? "nowrap" : "wrap",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    overflow: "visible",
    color: hasGrad ? undefined : textColor,
    WebkitTextFillColor: hasGrad ? undefined : textColor,
    transform: isBehindSubject
      ? `scaleY(${behindSubjectScaleY}) scaleX(${behindSubjectScaleX})`
      : `translateY(${restingFloatY}px)`,
    clipPath: layer.treatmentOverlay === "cinematic_viewport_mask_sweep"
      ? `polygon(0 0, ${overlayProgress * 100}% 0, ${overlayProgress * 100}% 100%, 0 100%)`
      : undefined,
  };

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
    return (
      <div
        style={{
          ...baseTextStyle,
          fontSize: `${Math.max(160, layer.fontSizePx)}px`,
          fontWeight: 900,
          backgroundImage: "linear-gradient(135deg, rgba(255, 255, 255, 0.50) 0%, rgba(255, 255, 255, 0.15) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          WebkitTextStroke: "2.5px rgba(255, 255, 255, 0.95)",
          filter: "drop-shadow(0 6px 24px rgba(0, 0, 0, 0.90)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.95))",
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
          display: "inline-block",
        }}
      >
        {layer.text}
      </div>
    );
  }




  // Canva Tall Glyph Stack: Colossal, towering vertical display typography behind the subject
  if (fx === "canva_tall_glyph_stack" || isBehindSubject) {
    const entranceP = interpolate(frame, [0, 5], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.back(1.2)),
    });
    return (
      <div
        style={{
          ...baseTextStyle,
          fontSize: `${behindSubjectFontSize}px`,
          transform: `scaleY(${behindSubjectScaleY}) scaleX(${behindSubjectScaleX}) scale(${interpolate(entranceP, [0, 1], [0.94, 1.0])})`,
          letterSpacing: behindMetrics.letterSpacing,
          lineHeight: 0.85,
          flexDirection: "row",
          flexWrap: "nowrap",
          opacity: entranceP,
          position: "relative",
          maxWidth: "1020px",
          width: "100%",
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
              margin: "0 0.08em",
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
    const p = interpolate(frame, [0, 13], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
    });
    return <div style={{...baseTextStyle, opacity: p, letterSpacing: `${interpolate(p, [0, 1], [0.3, layer.letterSpacingEm])}em`, transform: `scale(${interpolate(p, [0, 1], [1.12, 1])})`, filter: `blur(${interpolate(p, [0, 1], [20, 0])}px)`}}>{layer.text}</div>;
  }

  // -------------------------------------------------------------------------
  // HOOKS — Full Cinematic Hook Lingua Library (21 forms across 5 families)
  // Dynamic parameters are read from chunk.hookPlan (never hardcoded).
  // -------------------------------------------------------------------------
  const hookZoom = hookPlan?.zoom || hookPlan?.camera;
  const hookLensBlur = hookPlan?.lensBlur || hookPlan?.optical;
  const hookDirBlur = hookPlan?.directionalBlur;
  const hookOptical = hookPlan?.optical;
  const hookArtifact = hookPlan?.artifact;
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
        transform: `scale(${scale})`,
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
        transform: `scale(${scale})`,
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
        transform: `translateX(${tx}px) skewX(${skewX}deg)`,
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
        transform: `scale(${scale})`,
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
      <div style={{...baseTextStyle, transform: `scale(${scale})`, filter: `blur(${blurPx}px)`, textShadow: kineticTextShadow(`0 0 20px rgba(${hookGlow}, ${interpolate(zoomProgress, [0, 0.4, 1], [0.6, 0.25, 0.12])})`)}}>
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
  if (fx === "hook_rgb_chromatic_split_glitch") {
    const p = interpolate(frame, [0, 12], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
    });
    const displace = interpolate(p, [0, 0.7, 1], [hookArtifact?.rgbDisplacePx ?? 16, 3, 0]);
    const jitterY = (frame % 3 === 0 && p < 0.7) ? (Math.sin(frame * 4) * 3) : 0;
    return (
      <div style={{...baseTextStyle, position: "relative", transform: `translateY(${jitterY}px)`}}>
        {/* Red Channel Split */}
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          color: "#FF0055", transform: `translateX(${-displace}px)`, opacity: p * 0.8,
          mixBlendMode: "screen", pointerEvents: "none",
        }}>
          {layer.text}
        </div>
        {/* Cyan Channel Split */}
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          color: "#00FFFF", transform: `translateX(${displace}px)`, opacity: p * 0.8,
          mixBlendMode: "screen", pointerEvents: "none",
        }}>
          {layer.text}
        </div>
        {/* Main Text */}
        <div style={{opacity: p, ...wordPaintStyle}}>
          {layer.text}
        </div>
      </div>
    );
  }

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

  // Dedicated A: Hand-Drawn Kinetic Underline & Vector Sparkle
  if (fx === "hand_drawn_kinetic_underline" || fx === "vector_stroke_sparkle") {
    return (
      <div style={{...baseTextStyle, display: "inline-flex", flexDirection: "column", alignItems: "center"}}>
        <div style={{display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center"}}>
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
                key={`underline-word-${wIdx}`}
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
        <svg
          viewBox="0 0 240 24"
          style={{
            width: "100%",
            maxWidth: "340px",
            height: "18px",
            marginTop: "-2px",
            overflow: "visible",
          }}
        >
          <path
            d="M 4 14 C 50 18, 120 8, 236 12 C 180 17, 80 18, 20 18"
            fill="none"
            stroke={layer.color || "#FF453A"}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="260"
            strokeDashoffset={interpolate(frame, [2, 14], [260, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            })}
            style={{
              filter: `drop-shadow(0 0 8px ${layer.glow || "rgba(255, 69, 58, 0.6)"})`,
            }}
          />
        </svg>
      </div>
    );
  }

  // Dedicated B: Metallic Chrome Counter & Countup Hero
  if (fx === "metallic_chrome_countup_hero" || fx === "metallic_chrome_counter" || fx === "apple_gaussian_chrome") {
    const sweepPercent = interpolate(frame, [0, 16], [-50, 150], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
          const p = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.3)),
          });
          const scale = interpolate(p, [0, 0.7, 1], [0.85, 1.06, 1.0]);
          const translateY = interpolate(p, [0, 1], [16, 0]);
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
                filter: `drop-shadow(0 4px 18px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 16px ${layer.glow || "rgba(255, 69, 58, 0.6)"})`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Dedicated C: Electric Neon Line Revealer & Horizontal Gradient Sweep
  if (fx === "electric_blue_emoji_line_revealer" || fx === "horizontal_gradient_sweep_fade" || fx === "sandstorm_grain_dissolve") {
    const p = interpolate(frame, [0, 10], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    const sweepMask = `linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${p * 100}%, rgba(0,0,0,0) ${Math.min(100, p * 100 + 20)}%)`;
    return (
      <div
        style={{
          ...baseTextStyle,
          maskImage: sweepMask,
          WebkitMaskImage: sweepMask,
          transform: `scale(${interpolate(p, [0, 1], [0.96, 1.0])})`,
          filter: `drop-shadow(0 0 ${interpolate(p, [0, 0.5, 1], [18, 8, 0])}px rgba(0, 240, 255, 0.7))`,
        }}
      >
        {words.map((word, wIdx) => (
          <span
            key={`electric-word-${wIdx}`}
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              margin: "0 0.15em",
              ...wordPaintStyle,
              textShadow: kineticTextShadow(),
            }}
          >
            {word}
          </span>
        ))}
      </div>
    );
  }

  // Dedicated D: Cinematic Apple Word Bounce
  if (fx === "cinematic_apple_word_bounce") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
          const p = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.8)),
          });
          const scale = interpolate(p, [0, 0.7, 1], [0.65, 1.12, 1.0]);
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
    const p = interpolate(frame, [0, 10], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.4)),
    });
    const rotX = interpolate(p, [0, 1], [28, 0]);
    const rotY = interpolate(p, [0, 1], [-16, 0]);
    const tz = interpolate(p, [0, 1], [60, 0]);
    return (
      <div
        style={{
          ...baseTextStyle,
          perspective: "800px",
          transform: `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(${tz}px)`,
          textShadow: kineticTextShadow(
            "1px 1px 0px rgba(255,255,255,0.4), 2px 2px 0px rgba(180,180,180,0.3), 3px 3px 0px rgba(120,120,120,0.2), 0 8px 24px rgba(0,0,0,0.95)"
          ),
        }}
      >
        {words.map((w, wIdx) => (
          <span key={`iso-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>
            {w}
          </span>
        ))}
      </div>
    );
  }

  // Dedicated F: Textrotate Kinetic Word Cycler
  if (fx === "textrotate_kinetic_word_cycler") {
    return (
      <div style={{...baseTextStyle, perspective: "600px"}}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
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
                transform: `perspective(600px) rotateX(${rotateX}deg)`,
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
    const p = interpolate(frame, [0, 11], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.5)),
    });
    const scale = interpolate(p, [0, 0.6, 1], [0.72, 1.08, 1.0]);
    const blur = interpolate(p, [0, 0.5, 1], [16, 3, 0]);
    const letterSpacing = interpolate(p, [0, 1], [0.25, layer.letterSpacingEm || 0]);
    return (
      <div
        style={{
          ...baseTextStyle,
          letterSpacing: `${letterSpacing}em`,
          transform: `scale(${scale})`,
          filter: `blur(${blur}px)`,
        }}
      >
        {words.map((word, wIdx) => (
          <span
            key={`gooey-${wIdx}`}
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              margin: "0 0.15em",
              ...wordPaintStyle,
              textShadow: kineticTextShadow(`0 0 20px ${layer.glow || "rgba(255, 69, 58, 0.7)"}, 0 4px 18px rgba(0,0,0,0.95)`),
            }}
          >
            {word}
          </span>
        ))}
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
        {words.map((w, wIdx) => (
          <span key={`figma-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>
            {w}
          </span>
        ))}
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
        {words.map((w, wIdx) => (
          <span key={`caret-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.12em", ...wordPaintStyle}}>
            {w}
          </span>
        ))}
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
          const localFrame = Math.max(0, frame - wordStart);
          const p = interpolate(localFrame, [0, 9], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.5)),
          });
          const scale = interpolate(p, [0, 0.7, 1], [0.80, 1.05, 1.0]);
          const translateY = interpolate(p, [0, 1], [24, 0]);
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
    const p = interpolate(frame, [0, 10], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
    });
    return (
      <div
        style={{
          ...baseTextStyle,
          clipPath: `circle(${p * 75}% at 50% 50%)`,
          transform: `scale(${interpolate(p, [0, 1], [0.88, 1.0])})`,
        }}
      >
        {words.map((w, wIdx) => (
          <span key={`circle-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>
            {w}
          </span>
        ))}
      </div>
    );
  }

  // Dedicated L: High-Tech Chromatic Brands & Phrase Expansion
  if (fx === "hightech_chromatic_brands" || fx === "kinetic_cyber_phrase_expansion") {
    const p = interpolate(frame, [0, 8], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
    });
    const rgbOffset = interpolate(p, [0, 0.7, 1], [6, 1, 0]);
    return (
      <div
        style={{
          ...baseTextStyle,
          opacity: p,
          transform: `scale(${interpolate(p, [0, 1], [0.92, 1.0])})`,
          textShadow: kineticTextShadow(
            `-${rgbOffset}px 0px rgba(255, 0, 50, 0.8), ${rgbOffset}px 0px rgba(0, 240, 255, 0.8), 0 4px 18px rgba(0,0,0,0.95)`
          ),
        }}
      >
        {words.map((w, wIdx) => (
          <span key={`hightech-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>
            {w}
          </span>
        ))}
      </div>
    );
  }

  // Dedicated M: Kinetic Dynamic Slant
  if (fx === "kinetic_dynamic_slant") {
    const p = interpolate(frame, [0, 8], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.4)),
    });
    const skewX = interpolate(p, [0, 1], [-18, 0]);
    return (
      <div
        style={{
          ...baseTextStyle,
          opacity: p,
          transform: `skewX(${skewX}deg) scale(${interpolate(p, [0, 1], [0.90, 1.0])})`,
        }}
      >
        {words.map((w, wIdx) => (
          <span key={`slant-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>
            {w}
          </span>
        ))}
      </div>
    );
  }

  // Dedicated N: Kinetic Glow Sweep & Word Fast Pulse
  if (fx === "kinetic_glow_sweep" || fx === "kinetic_word_fast_pulse") {
    const p = interpolate(frame, [0, 6], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.6)),
    });
    const pulse = 1.0 + Math.sin(frame * 0.4) * 0.04;
    return (
      <div
        style={{
          ...baseTextStyle,
          opacity: p,
          transform: `scale(${interpolate(p, [0, 1], [0.82, 1.0]) * pulse})`,
          textShadow: kineticTextShadow(`0 0 24px ${layer.glow || "rgba(255, 69, 58, 0.85)"}, 0 4px 18px rgba(0,0,0,0.95)`),
        }}
      >
        {words.map((w, wIdx) => (
          <span key={`pulse-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", ...wordPaintStyle}}>
            {w}
          </span>
        ))}
      </div>
    );
  }

  // Dedicated O: LED Dot Matrix Scanline
  if (fx === "led_dot_matrix_scanline") {
    const p = interpolate(frame, [0, 8], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
    return (
      <div
        style={{
          ...baseTextStyle,
          opacity: p,
          letterSpacing: "0.08em",
          textShadow: kineticTextShadow("0 0 12px rgba(0, 255, 120, 0.85), 0 4px 18px rgba(0,0,0,0.95)"),
          filter: "contrast(1.2) brightness(1.1)",
        }}
      >
        {words.map((w, wIdx) => (
          <span key={`led-${wIdx}`} style={{display: "inline-block", whiteSpace: "nowrap", margin: "0 0.15em", color: layer.color || "#00FF78"}}>
            {w}
          </span>
        ))}
      </div>
    );
  }

  // Dedicated P: Lavender & Vercel Highlight Selection Badges
  if (fx === "lavender_highlight_selection" || fx === "vercel_kinetic_highlight_box") {
    const isVercel = fx === "vercel_kinetic_highlight_box";
    const p = interpolate(frame, [0, 7], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
    });
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => (
          <span
            key={`highlight-${wIdx}`}
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              margin: "0 0.15em",
              opacity: p,
              backgroundColor: isVercel ? "rgba(255, 255, 255, 0.15)" : "rgba(216, 180, 254, 0.38)",
              border: isVercel ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid rgba(216, 180, 254, 0.6)",
              borderRadius: "6px",
              padding: "2px 8px",
              boxShadow: isVercel ? "0 4px 12px rgba(0,0,0,0.5)" : "0 0 16px rgba(216, 180, 254, 0.4)",
              ...wordPaintStyle,
              WebkitBackgroundClip: undefined,
              WebkitTextFillColor: undefined,
              color: "#FFFFFF",
            }}
          >
            {word}
          </span>
        ))}
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
          
          const blur = interpolate(localFrame, [0, 2, 5, 8], [14, 4, 1.5, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const scale = interpolate(localFrame, [0, 3, 6, 8], [1.08, 0.98, 1.02, 1.0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const opacity = interpolate(localFrame, [0, 1, 4, 7], [0, 0.85, 0.92, 1.0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
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
                transform: `scale(${scale})`,
                filter: `blur(${blur}px)`,
                ...wordPaintStyle,
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

  // 2. GAUSSIAN BLUR LETTER-BY-LETTER SWEEP (Per-character staggered Gaussian blur decay)
  if (
    fx === "gaussian_blur_reveal_sweep" ||
    fx === "blur_reveal_sweep" ||
    fx === "gaussian_blur_letter_reveal" ||
    fx === "letter_gaussian_blur_sweep" ||
    fx === "royal_gaussian_blur_letter_sweep" ||
    fx === "royal_behind_subject_sweep"
  ) {
    const isRoyal = fx.includes("royal") || Boolean(layer.behindSubject);
    let globalCharIndex = 0;
    return (
      <div style={{ ...baseTextStyle, display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const letters = word.split("");
          const wordCharStartIndex = globalCharIndex;
          globalCharIndex += letters.length + 1;

          return (
            <span
              key={`blur-word-${wIdx}`}
              style={{
                display: "inline-flex",
                whiteSpace: "nowrap",
                margin: "0 0.18em",
              }}
            >
              {letters.map((char, cIdx) => {
                const charStagger = (wordCharStartIndex + cIdx) * (isRoyal ? 1.6 : 1.2);
                // Pre-roll lead-in: start 5 frames earlier for buttery smooth royal anticipation
                const localFrame = Math.max(0, (frame + 5) - (wordStart + charStagger));
                const animDuration = isRoyal ? 13 : 9;
                const p = interpolate(localFrame, [0, animDuration], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.cubic),
                });
                const startBlur = isRoyal ? 28 : 22;
                const translateY = interpolate(p, [0, 1], [isRoyal ? 22 : 18, 0]);
                const blur = interpolate(p, [0, 0.75, 1], [startBlur, 2, 0]);
                const opacity = interpolate(p, [0, 0.35, 1], [0, 0.9, 1]);
                const scale = interpolate(p, [0, 1], [isRoyal ? 0.92 : 0.90, 1.0]);

                return (
                  <span
                    key={`char-${wIdx}-${cIdx}`}
                    style={{
                      display: "inline-block",
                      opacity,
                      transform: `translateY(${translateY}px) scale(${scale})`,
                      filter: `blur(${blur}px)`,
                      letterSpacing: isRoyal ? "0.08em" : undefined,
                      ...wordPaintStyle,
                      textShadow: kineticTextShadow(
                        isRoyal
                          ? "0 6px 28px rgba(0, 0, 0, 0.98), 0 2px 10px rgba(0, 0, 0, 0.92)"
                          : "0 4px 20px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.90)"
                      ),
                    }}
                  >
                    {char}
                  </span>
                );
              })}
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
                filter: `blur(${blur}px)`,
                ...wordPaintStyle,
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
                filter: `blur(${interpolate(p, [0, 1], [12, 0])}px)`,
                ...wordPaintStyle,
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
                    filter: `blur(${blur}px)`,
                    padding: "0 0.01em",
                    ...wordPaintStyle,
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
                filter: `blur(${blur}px)`,
                ...wordPaintStyle,
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

  // 6. APPLE PRO DISPLAY HERO REVEALER (Per-word vertical glide + blur decay)
  if (fx === "apple_pro_display_hero_revealer" || fx === "pro_revealer") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
          const p = interpolate(localFrame, [0, 7], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const translateY = interpolate(p, [0, 1], [14, 0]);
          const blur = interpolate(p, [0, 0.7, 1], [12, 0, 0]);
          const opacity = interpolate(p, [0, 0.4, 1], [0, 0.9, 1]);

          return (
            <span
              key={`pro-word-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity,
                transform: `translateY(${translateY}px)`,
                filter: `blur(${blur}px)`,
                ...wordPaintStyle,
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
                  filter: `blur(${blur}px)`,
                  padding: "0 0.02em",
                  ...wordPaintStyle,
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

  // 8. CINEMATIC VIEWPORT MASK SWEEP (Clean horizontal clip reveal)
  if (fx === "cinematic_viewport_mask_sweep" || fx === "viewport_mask_sweep") {
    const p = interpolate(frame, [0, 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });

    return (
      <div
        style={{
          ...baseTextStyle,
          clipPath: `polygon(0 0, ${p * 100}% 0, ${p * 100}% 100%, 0 100%)`,
          textShadow: kineticTextShadow("0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
        }}
      >
        <span style={wordPaintStyle}>{layer.text}</span>
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
                filter: `blur(${interpolate(p, [0, 0.65, 1], [20, 3, 0])}px)`,
                ...wordPaintStyle,
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
    const p = interpolate(frame, [0, 7], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.back(1.4)),
    });
    const scale = interpolate(p, [0, 0.7, 1], [0.88, 1.03, 1.0]);
    const blur = interpolate(p, [0, 0.5, 1], [8, 0, 0]);

    return (
      <div
        style={{
          ...baseTextStyle,
          opacity: p,
          transform: `scale(${scale})`,
          filter: `blur(${blur}px)`,
          textShadow: kineticTextShadow("0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"),
        }}
      >
        <span style={wordPaintStyle}>{layer.text}</span>
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
          const p = interpolate(localFrame, [0, 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const translateY = interpolate(p, [0, 1], [8, 0]);
          const blur = interpolate(p, [0, 1], [8, 0]);
          const opacity = interpolate(p, [0, 0.5, 1], [0, 0.9, 1]);

          return (
            <span
              key={`subpixel-word-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity,
                transform: `translateY(${translateY}px)`,
                filter: `blur(${blur}px)`,
                ...wordPaintStyle,
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

  // Universal Fallback Return
  return (
    <div style={baseTextStyle}>
      {words.map((word, wIdx) => (
        <span
          key={`default-word-${wIdx}`}
          style={{
            display: "inline-block",
            whiteSpace: "nowrap",
            margin: "0 0.15em",
            ...wordPaintStyle,
            textShadow: kineticTextShadow(),
          }}
        >
          {word}
        </span>
      ))}
    </div>
  );

};

// ---------------------------------------------------------------------------
// Multi-Layer Editorial Graphic Typography Component
// ---------------------------------------------------------------------------
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

  const chunkStartMs = chunk.startMs ?? chunk.outputStartMs ?? 0;
  const chunkEndMs = chunk.endMs ?? chunk.outputEndMs ?? chunkStartMs + 1500;

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
  const behindSubject = subjectMatteAvailable && layers.some((layer) => layer.behindSubject);
  const isBehindSubject = Boolean(
    behindSubject ||
    chunk.placement?.safeRegionId === "upper_third" ||
    chunk.placement?.anchor === "top_headroom" ||
    layers.some((l) => l.behindSubject)
  );
  const topPosition = chunk.placement?.yPercent || (behindSubject ? "10%" : "68%");

  // Overall chunk entrance & exit kinetic spring
  const chunkEntrance = interpolate(frame, [0, resolveChunkEntranceFrame(contentStartFrame, totalFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.2)),
  });

  const exitFrames = isBehindSubject ? 12 : 3;
  const exitBlur = isBehindSubject
    ? interpolate(frame, [Math.max(0, totalFrames - exitFrames), totalFrames], [0, 24], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.in(Easing.cubic),
      })
    : 0;

  const exitScale = isBehindSubject
    ? interpolate(frame, [Math.max(0, totalFrames - exitFrames), totalFrames], [1.0, 1.04], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1.0;

  const chunkExit = interpolate(frame, [Math.max(0, totalFrames - exitFrames), totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: isBehindSubject ? Easing.in(Easing.quad) : undefined,
  });

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

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: topPosition,
        transform: `translate(calc(-50% + ${hookTranslateX}px), -50%) scale(${interpolate(chunkEntrance, [0, 1], [0.94, 1.0]) * hookScale * exitScale})`,
        opacity: Math.min(chunkEntrance, chunkExit),
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        filter: `${resolveTypographyContainerFilter(layers) || ""} ${exitBlur > 0.1 ? `blur(${exitBlur.toFixed(1)}px)` : ""} brightness(${hookBrightness})`.trim() || undefined,
        mixBlendMode: resolveTypographyContainerBlendMode(layers),
        gap: "0px",
        width: "92%",
        maxWidth: "980px",
        textAlign: "center",
        zIndex: resolveTypographyZIndex(behindSubject, chunk.placement?.safeRegionId),
        pointerEvents: "none",
      }}
    >

      {layers.map((layer, lIdx) => {
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
          />
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Composition Component
// ---------------------------------------------------------------------------
// Main Composition Component & Stages
// ---------------------------------------------------------------------------
const MiniRunSourceStage: React.FC<{
  videoSrc: string;
  orchestration?: MiniRunOrchestration;
  hasMatte?: boolean;
  macroHookPlan?: NonNullable<CaptionChunk["hookPlan"]>;
}> = ({ videoSrc, orchestration, hasMatte, macroHookPlan }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = resolveSceneVisualState(orchestration, frame, fps);
  const mediaStyle: React.CSSProperties = hasMatte ? {} : resolvePanScanMediaStyle(state);
  const transitionBlur = state.transitionStrength * 8;

  // Macro Hook visual transformation directly applied to the video
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

  const combinedBlur = Math.min(24, transitionBlur * 0.35 + hookBlur);
  const filterParts = [
    combinedBlur > 0.1 ? `blur(${combinedBlur.toFixed(1)}px)` : "",
    hookBrightness !== 1.0 ? `brightness(${hookBrightness.toFixed(2)})` : "",
    hookContrast !== 1.0 ? `contrast(${hookContrast.toFixed(2)})` : "",
    hookSaturate !== 1.0 ? `saturate(${hookSaturate.toFixed(2)})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const hookTransform = `perspective(1000px) rotateX(${hookRotateX}deg) rotateY(${hookRotateY}deg) translateY(${hookTranslateY}px) scale(${hookScale})`;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden", zIndex: 1 }}>
      <Video
        src={staticFile(videoSrc)}
        muted
        pauseWhenBuffering
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: mediaStyle.objectPosition || "50% 50%",
          transform: `${mediaStyle.transform || ""} ${hookTransform}`.trim(),
          transformOrigin: "center center",
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
// BackgroundCanvasStage — Renders texture canvases behind kinetic typography
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

  const intensity = activeBg.texture?.intensity ?? 0.25;
  const opacity = Math.min(entryP, 1 - exitP) * intensity;
  const scale = interpolate(nowMs, [entryStart, exitEnd], activeBg.counterScale ?? [1.02, 1.10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blendMode = activeBg.texture?.blendMode ?? "soft-light";
  const textureFile = activeBg.texture?.fileName;

  return (
    <AbsoluteFill
      style={{
        zIndex: 5, // Above base video (1), below typography (100)
        pointerEvents: "none",
        overflow: "hidden",
        opacity,
        mixBlendMode: blendMode as any,
        backgroundImage: textureFile ? `url(${staticFile(`textures/${textureFile}`)})` : undefined,
        backgroundColor: textureFile ? undefined : "rgba(25, 25, 35, 0.4)",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        transform: `scale(${scale})`,
        transformOrigin: "center center",
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
  const p = (nowMs - activeTrans.startMs) / dur;
  const strength = 1 - Math.abs(p - 0.5) * 2; // 0 -> 1 -> 0
  const effect = activeTrans.effect || "bokeh_defocus_blend";

  if (effect === "film_burn_strobe") {
    const burnP = interpolate(strength, [0, 1], [0, 0.75]);
    return (
      <AbsoluteFill
        style={{
          zIndex: 8,
          pointerEvents: "none",
          overflow: "hidden",
          mixBlendMode: "screen",
          opacity: burnP,
          background:
            "radial-gradient(ellipse at 80% 20%, rgba(255,180,50,0.9) 0%, rgba(255,90,0,0.7) 40%, rgba(180,20,0,0.3) 70%, transparent 100%)",
          filter: "blur(6px)",
        }}
      />
    );
  }

  if (effect === "flash_cut") {
    const flashP = interpolate(strength, [0, 1], [0, 0.70], { easing: Easing.out(Easing.quad) });
    return (
      <AbsoluteFill
        style={{
          zIndex: 8,
          pointerEvents: "none",
          backgroundColor: "#FFFFFF",
          opacity: flashP,
          mixBlendMode: "screen",
        }}
      />
    );
  }

  if (effect === "whip_pan_blur") {
    const whipOffset = interpolate(p, [0, 0.5, 1], [-60, 0, 60]);
    return (
      <AbsoluteFill
        style={{
          zIndex: 8,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: strength * 0.45,
          mixBlendMode: "screen",
          transform: `translateX(${whipOffset}px)`,
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
          filter: "blur(8px)",
        }}
      />
    );
  }

  return null;
};

export const PrometheusMinRun: React.FC<PrometheusMinRunProps> = ({
  videoSrc,
  matteSrc,
  chunks,
  durationMs,
  orchestration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Extract the hook plan from chunk 0 for macro video-level treatment
  const macroHookPlan = chunks?.[0]?.hookPlan;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* 1. Base Video (Z: 1) with smooth cinematic pan-scan + Hook Transform */}
      <MiniRunSourceStage
        videoSrc={videoSrc}
        orchestration={orchestration}
        hasMatte={Boolean(matteSrc)}
        macroHookPlan={macroHookPlan}
      />

      {/* 1b. Macro Hook Overlays (Z: 2-4) */}
      <MacroHookStage hookPlan={macroHookPlan} fps={fps} />

      {/* 1c. Texture Background Canvas Stage (Z: 5) */}
      <BackgroundCanvasStage orchestration={orchestration} frame={frame} fps={fps} />

      {/* 1d. Transition Visual Effects Stage (Z: 8) — Film Burns, Flash Cuts, Whip Streaks */}
      <TransitionFXStage orchestration={orchestration} frame={frame} fps={fps} />

      {/* 2. Multi-Layer Speech-Synchronized Kinetic Typography Chunks (Z: 10 / 100) */}
      {(() => {
        let runningEndFrame = 0;
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
                  (layer.isHero ? 280 : 160)) /
                  1000) *
                  fps
              )
            )
          );

          // Invariant: startFrame must NEVER precede previous chunk's endFrame (Zero Temporal Overlap)
          const requestedStartFrame = Math.max(
            0,
            Math.round((displayStartMs / 1000) * fps),
            contentStartFrame - leadFrames
          );
          const startFrame = Math.max(runningEndFrame, requestedStartFrame);
          const endFrame = Math.max(startFrame + 1, rawEndFrame);
          runningEndFrame = endFrame;

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

      {/* 3. Foreground Subject Matte Cutout Layer (Z: 50) */}
      {matteSrc && (
        <AbsoluteFill style={{ zIndex: 50, pointerEvents: "none", overflow: "hidden" }}>
          <Video
            src={staticFile(matteSrc)}
            muted
            pauseWhenBuffering
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              zIndex: 50,
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export default PrometheusMinRun;
