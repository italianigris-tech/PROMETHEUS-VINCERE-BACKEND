import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadGoogleFont } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBodoni } from "@remotion/google-fonts/BodoniModa";
import { loadFont as loadDancing } from "@remotion/google-fonts/DancingScript";
import { loadFont as loadGreatVibes } from "@remotion/google-fonts/GreatVibes";
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";

// Load Google Fonts
loadGoogleFont();
loadPlayfair();
loadBodoni();
loadDancing();
loadGreatVibes();
loadBebas();
loadAnton();
loadOswald();
loadMontserrat();
loadCormorant();
loadCaveat();

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
};

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
  placement?: {
    xPercent?: string;
    yPercent?: string;
    anchor?: string;
    safeRegionId?: string;
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
    causedByTransitionId?: string;
    causedBySceneId?: string;
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
  const scene = orchestration?.scenes.find((candidate) => nowMs >= candidate.startMs && nowMs < candidate.endMs)
    ?? orchestration?.scenes.at(-1);
  const background = orchestration?.backgrounds.find((candidate) => candidate.sceneId === scene?.id);
  const pip = orchestration?.pip.find((candidate) => candidate.sceneId === scene?.id);
  const transition = orchestration?.transitions.find((candidate) => nowMs >= candidate.startMs && nowMs <= candidate.endMs);
  const camera = orchestration?.cameraMoves.find((candidate) => nowMs >= candidate.startMs && nowMs <= candidate.endMs);
  const sceneProgress = scene ? clampedProgress(nowMs, scene.startMs, scene.endMs) : 0;
  const transitionProgress = transition ? clampedProgress(nowMs, transition.startMs, transition.endMs) : 0;
  const transitionStrength = transition ? Math.sin(transitionProgress * Math.PI) : 0;
  const cameraProgress = camera
    ? Easing.bezier(...camera.curve)(clampedProgress(nowMs, camera.startMs, camera.endMs))
    : 0;

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
    focalXPercent: scene?.focalPoint?.xPercent ?? 50,
    backgroundBlurPx: background?.blurPx ?? 0,
    backgroundBrightness: background?.brightness ?? 1,
    backgroundScale: background
      ? interpolate(sceneProgress, [0, 1], background.counterScale, {extrapolateLeft: "clamp", extrapolateRight: "clamp"})
      : 1,
    pipCornerRadiusPx: pip?.cornerRadiusPx ?? 0,
    pipScale,
    cameraScale: camera ? interpolate(cameraProgress, [0, 1], [1, camera.overshootScale], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}) : 1,
    transitionId: transition?.id,
    transitionProgress,
    transitionStrength,
    cameraMoveId: camera?.id,
  };
};

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
  "canva_tall_glyph_stack", "cinematic_distance_convergence", ...EXTENDED_ANIMA_TREATMENTS,
]);

// ---------------------------------------------------------------------------
// Kinetic Motion Layer Renderer (Word-by-Word & Character-Level Motion Engines)
// ---------------------------------------------------------------------------
const KineticLayerRenderer: React.FC<{
  layer: TypographyLayer;
  frame: number;
  chunkStartMs: number;
  chunkEndMs: number;
  fps: number;
  totalFrames: number;
  contentStartFrame: number;
}> = ({ layer, frame, chunkStartMs, chunkEndMs, fps, totalFrames, contentStartFrame }) => {
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
  const textColor = layer.color || (layer.isHero ? "#FF334B" : "#FFFFFF");
  const baseTextStyle: React.CSSProperties = {
    fontFamily: `"${layer.fontFamily}", "${layer.accentFont || "sans-serif"}", sans-serif`,
    fontWeight: isBehindSubject ? 900 : layer.fontWeight,
    fontStyle: layer.fontStyle as any,
    fontSize: isBehindSubject ? `${Math.max(140, layer.fontSizePx * 1.35)}px` : `${layer.fontSizePx}px`,
    color: textColor,
    letterSpacing: isBehindSubject ? "0.02em" : `${layer.letterSpacingEm}em`,
    lineHeight: isBehindSubject ? 0.88 : layer.lineHeight,
    maxWidth: "100%",
    borderBottom: layer.doubleUnderline ? `3px double ${textColor}` : "none",
    paddingBottom: layer.doubleUnderline ? "6px" : "0px",
    display: "inline-flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    overflow: "visible",
    transform: isBehindSubject ? "scaleY(1.35) scaleX(0.92)" : undefined,
    textShadow: isBehindSubject
      ? "0 4px 24px rgba(0, 0, 0, 0.95), 0 2px 10px rgba(0, 0, 0, 0.85)"
      : (layer.isHero
          ? "0 4px 18px rgba(0, 0, 0, 0.85), 0 0 20px rgba(255, 51, 75, 0.45)"
          : "0 4px 18px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.7)"),
    clipPath: layer.treatmentOverlay === "cinematic_viewport_mask_sweep"
      ? `polygon(0 0, ${overlayProgress * 100}% 0, ${overlayProgress * 100}% 100%, 0 100%)`
      : undefined,
  };



  // Martin's background plane is deliberately narrow and vertically paced so
  // the foreground matte can keep the speaker visually dominant.
  // Each word is strictly wrapped with whiteSpace: nowrap so characters NEVER split across lines.
  if (fx === "canva_tall_glyph_stack") {
    let globalCharIndex = 0;
    return (
      <div style={{...baseTextStyle, transform: "scaleX(0.76)", letterSpacing: "0.02em", flexWrap: "wrap"}}>
        {words.map((w, wIdx) => {
          const charSpans = Array.from(w).map((ch) => {
            const charIdx = globalCharIndex++;
            const localFrame = Math.max(0, frame - charIdx * 2.1);
            const p = interpolate(localFrame, [0, 11], [0, 1], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
            });
            return (
              <span
                key={`tall-${charIdx}`}
                style={{
                  display: "inline-block",
                  opacity: p,
                  transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px) rotate(${interpolate(p, [0, 1], [-4, 0])}deg) scaleY(${interpolate(p, [0, 1], [1.16, 1])})`,
                  filter: `blur(${interpolate(p, [0, 1], [10, 0])}px)`,
                }}
              >
                {ch}
              </span>
            );
          });

          return (
            <span
              key={`tall-word-${wIdx}`}
              style={{
                display: "inline-flex",
                whiteSpace: "nowrap",
                margin: "0 0.18em",
                wordBreak: "keep-all",
              }}
            >
              {charSpans}
            </span>
          );
        })}
      </div>
    );
  }

  if (fx === "cinematic_distance_convergence") {
    const p = interpolate(frame, [0, 13], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
    });
    return <div style={{...baseTextStyle, opacity: p, letterSpacing: `${interpolate(p, [0, 1], [0.3, layer.letterSpacingEm])}em`, transform: `scale(${interpolate(p, [0, 1], [1.12, 1])})`, filter: `blur(${interpolate(p, [0, 1], [20, 0])}px)`}}>{layer.text}</div>;
  }

  if (EXTENDED_ANIMA_TREATMENTS.has(fx)) {
    const dynamic = fx.includes("kinetic") || fx.includes("cyber") || fx.includes("top_down");
    const chromatic = fx.includes("chromatic") || fx.includes("hightech") || fx.includes("electric");
    const material = fx.includes("metallic") || fx.includes("glow") || fx.includes("gradient") || fx.includes("led");
    return <div style={baseTextStyle}>{words.map((word, wordIndex) => {
      const localFrame = Math.max(0, frame - (wordEntranceFrames[wordIndex] ?? 0));
      const p = interpolate(localFrame, [0, dynamic ? 8 : 12], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(dynamic ? Easing.back(1.15) : Easing.cubic),
      });
      const drift = dynamic ? Math.sin(localFrame * 0.42 + wordIndex) * (1 - p) * 16 : 0;
      return <span key={`anima-${fx}-${wordIndex}`} style={{
        display: "inline-block", whiteSpace: "nowrap", margin: "0 0.14em", opacity: p,
        transform: `translate(${chromatic ? (1 - p) * (wordIndex % 2 ? 7 : -7) : 0}px, ${interpolate(p, [0, 1], [dynamic ? 32 : 15, drift])}px) scale(${interpolate(p, [0, 1], [dynamic ? 0.84 : 0.94, 1])})`,
        filter: `blur(${interpolate(p, [0, 1], [material ? 15 : 9, 0])}px)`,
        textShadow: material ? "0 0 18px rgba(160, 220, 255, 0.5), 0 2px 10px rgba(0,0,0,0.45)" : "0 2px 10px rgba(0,0,0,0.45)",
        background: fx.includes("highlight") ? "rgba(216, 180, 254, 0.42)" : undefined,
      }}>{word}</span>;
    })}</div>;
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
                textShadow: `0 2px 10px rgba(0,0,0,0.45), 0 0 16px rgba(245,230,196,${shimmerGlow})`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // 2. GAUSSIAN BLUR REVEAL SWEEP (Word-by-word staggered Gaussian blur decay)
  if (fx === "gaussian_blur_reveal_sweep" || fx === "blur_reveal_sweep") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wordEntranceFrames[wIdx] ?? 0;
          const localFrame = Math.max(0, frame - wordStart);
          const p = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const translateY = interpolate(p, [0, 1], [14, 0]);
          const blur = interpolate(p, [0, 0.75, 1], [18, 2, 0]);
          const opacity = interpolate(p, [0, 0.4, 1], [0, 0.85, 1]);

          return (
            <span
              key={`blur-sweep-${wIdx}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
                opacity,
                transform: `translateY(${translateY}px)`,
                filter: `blur(${blur}px)`,
                textShadow: "0 2px 10px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)",
              }}
            >
              {word}
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
                textShadow: "0 2px 10px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)",
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
                textShadow: "0 2px 10px rgba(0,0,0,0.45)",
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
                textShadow: "0 2px 10px rgba(0,0,0,0.45)",
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
                textShadow: "0 2px 10px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)",
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
                textShadow: "0 2px 10px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)",
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
                textShadow: "0 2px 10px rgba(0,0,0,0.45)",
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
          textShadow: "0 2px 10px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)",
        }}
      >
        <span>{layer.text}</span>
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
                textShadow: `0 0 ${interpolate(p, [0, 1], [30, 8])}px rgba(245,230,196,${interpolate(p, [0, 1], [0.85, 0.28])})`,
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
          textShadow: "0 2px 10px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)",
        }}
      >
        <span>{layer.text}</span>
      </div>
    );
  }

  // 10. SUBPIXEL GLOW MASK (Companion layer clean per-word entrance)
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
              textShadow: "0 2px 8px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.25)",
            }}
          >
            {word}
          </span>
        );
      })}
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
  const topPosition = chunk.placement?.yPercent || (behindSubject ? "34%" : "68%");

  // Overall chunk entrance & exit kinetic spring
  const chunkEntrance = interpolate(frame, [0, resolveChunkEntranceFrame(contentStartFrame, totalFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.2)),
  });

  const chunkExit = interpolate(frame, [Math.max(0, totalFrames - 3), totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: topPosition,
        transform: `translate(-50%, -50%) scale(${interpolate(chunkEntrance, [0, 1], [0.94, 1.0])})`,
        opacity: Math.min(chunkEntrance, chunkExit),
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        filter: "drop-shadow(0 4px 20px rgba(0, 0, 0, 0.85))",
        gap: behindSubject ? "2px" : "8px",
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
          />
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Composition Component
// ---------------------------------------------------------------------------
const MiniRunSourceStage: React.FC<{
  videoSrc: string;
  orchestration?: MiniRunOrchestration;
}> = ({videoSrc, orchestration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const state = resolveSceneVisualState(orchestration, frame, fps);
  const transitionBlur = state.transitionStrength * 8;

  if (state.layout === "floating_pip") {
    return (
      <AbsoluteFill style={{backgroundColor: "#050505", overflow: "hidden", zIndex: 1}}>
        <Video
          src={staticFile(videoSrc)}
          muted
          style={{
            position: "absolute",
            inset: "-5%",
            width: "110%",
            height: "110%",
            objectFit: "cover",
            filter: `blur(${state.backgroundBlurPx + transitionBlur}px) brightness(${state.backgroundBrightness})`,
            transform: `scale(${state.backgroundScale})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "48%",
            width: "92%",
            aspectRatio: "16 / 9",
            overflow: "hidden",
            borderRadius: state.pipCornerRadiusPx,
            boxShadow: "-10px 17px 45px rgba(0, 0, 0, 0.35)",
            transform: `translate(-50%, -50%) scale(${state.pipScale * state.cameraScale})`,
            transformOrigin: "center",
            zIndex: 10,
          }}
        >
          <Video
            src={staticFile(videoSrc)}
            muted
            style={{width: "100%", height: "100%", objectFit: "cover", filter: `blur(${transitionBlur * 0.22}px)`}}
          />
        </div>
        {state.transitionId ? (
          <AbsoluteFill style={{backgroundColor: `rgba(255,255,255,${state.transitionStrength * 0.08})`, zIndex: 12}} />
        ) : null}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{backgroundColor: "#000", overflow: "hidden", zIndex: 1}}>
      <Video
        src={staticFile(videoSrc)}
        muted
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `${state.focalXPercent}% 50%`,
          transform: `scale(${state.cameraScale})`,
          filter: `blur(${transitionBlur * 0.35}px) brightness(${1 + state.transitionStrength * 0.04})`,
          zIndex: 1,
        }}
      />
    </AbsoluteFill>
  );
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
  const visualState = resolveSceneVisualState(orchestration, frame, fps);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* 1. Base Video (Z: 1) */}
      <MiniRunSourceStage videoSrc={videoSrc} orchestration={orchestration} />

      {/* 2. RVM Matte Alpha Layer (Z: 50 - Speaker mid-ground) */}
      {matteSrc && (
        <Video
          src={staticFile(matteSrc)}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            pointerEvents: "none",
            zIndex: 50,
            opacity: visualState.layout === "floating_pip" ? 0 : 1,
          }}
        />
      )}

      {/* 3. Multi-Layer Speech-Synchronized Kinetic Typography Chunks (Z: 100 - Foreground High Contrast) */}
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
    </AbsoluteFill>
  );
};

export default PrometheusMinRun;
