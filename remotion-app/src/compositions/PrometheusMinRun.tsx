import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  Video,
  interpolate,
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
  gradient?: string;
  glow?: string;
  shadow?: string;
  textFillColor?: string;
  hasGradient?: boolean;
  doubleUnderline?: boolean;
};

export type CaptionChunk = {
  chunkIndex?: number;
  text: string;
  startMs?: number;
  endMs?: number;
  outputStartMs?: number;
  outputEndMs?: number;
  fontProfile?: string;
  profileFilename?: string;
  pairedImage?: string;
  fxPreset?: string;
  placement?: {
    xPercent?: string;
    yPercent?: string;
    anchor?: string;
  };
  layers?: TypographyLayer[];
  words?: WordTiming[];
};

export type PrometheusMinRunProps = {
  videoSrc: string;
  matteSrc?: string;
  chunks: CaptionChunk[];
  durationMs: number;
};

// ---------------------------------------------------------------------------
// Kinetic Motion Layer Renderer (Speech-Synchronized Word Punching)
// ---------------------------------------------------------------------------
const KineticLayerRenderer: React.FC<{
  layer: TypographyLayer;
  frame: number;
  chunkStartMs: number;
  chunkEndMs: number;
  fps: number;
  totalFrames: number;
}> = ({ layer, frame, chunkStartMs, chunkEndMs, fps, totalFrames }) => {
  const fx = layer.fxPreset || (layer.isHero ? "apple_pro_display_hero_revealer" : "subpixel_glow_mask");
  const hasGrad = layer.hasGradient && layer.gradient && layer.gradient !== "none";

  const baseTextStyle: React.CSSProperties = {
    fontFamily: `"${layer.fontFamily}", "${layer.accentFont || "sans-serif"}", sans-serif`,
    fontWeight: layer.fontWeight,
    fontStyle: layer.fontStyle as any,
    fontSize: `${layer.fontSizePx}px`,
    color: layer.color || "#FFFFFF",
    letterSpacing: `${layer.letterSpacingEm}em`,
    lineHeight: layer.lineHeight,
    maxWidth: "100%",
    borderBottom: layer.doubleUnderline ? `3px double ${layer.color}` : "none",
    paddingBottom: layer.doubleUnderline ? "6px" : "0px",
    display: "inline-flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  };

  // Build word list with exact spoken timestamps
  const rawWords = layer.text.split(" ").filter((w) => w.length > 0);
  const wordTimings: WordTiming[] =
    layer.words && layer.words.length === rawWords.length
      ? layer.words
      : rawWords.map((w, idx) => {
          const step = (chunkEndMs - chunkStartMs) / Math.max(1, rawWords.length);
          return {
            text: w,
            start_ms: chunkStartMs + idx * step,
            end_ms: chunkStartMs + (idx + 1) * step,
          };
        });

  // 1. APPLE PRO DISPLAY HERO REVEALER (Gaussian blur reveal + focal scale punch)
  if (fx === "apple_pro_display_hero_revealer") {
    return (
      <div style={{ ...baseTextStyle, overflow: "visible" }}>
        {wordTimings.map((wObj, wIdx) => {
          const wordStartFrame = Math.max(
            0,
            Math.round(((wObj.start_ms - chunkStartMs) / 1000) * fps)
          );
          if (frame < wordStartFrame) return null;

          const wordLocalFrame = frame - wordStartFrame;
          const p = interpolate(wordLocalFrame, [0, 7], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.back(1.5)),
          });

          const scale = interpolate(p, [0, 0.7, 1], [0.90, 1.03, 1.0]);
          const translateY = interpolate(p, [0, 1], [14, 0]);
          const blur = interpolate(p, [0, 0.6, 1], [16, 0, 0]);

          const wordStyle: React.CSSProperties = {
            display: "inline-block",
            opacity: p,
            transform: `translateY(${translateY}px) scale(${scale})`,
            filter: `blur(${blur}px) drop-shadow(0 6px 24px rgba(0,0,0,0.98)) drop-shadow(0 0 28px rgba(0,0,0,0.95))`,
            margin: "0 0.15em",
          };

          if (hasGrad) {
            wordStyle.background = layer.gradient;
            wordStyle.WebkitBackgroundClip = "text";
            wordStyle.WebkitTextFillColor = "transparent";
          } else {
            wordStyle.textShadow =
              "0 4px 20px rgba(0,0,0,0.98), 0 0 24px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,1)";
          }

          return (
            <span key={`apple-hero-${wIdx}`} style={wordStyle}>
              {wObj.text}
            </span>
          );
        })}
      </div>
    );
  }

  // 2. APPLE KEYNOTE HEADLINE PUNCH (Heavy keynote punch + Gaussian decay)
  if (fx === "apple_keynote_headline_punch" || fx === "keynote_punch") {
    return (
      <div style={{ ...baseTextStyle, overflow: "visible" }}>
        {wordTimings.map((wObj, wIdx) => {
          const wordStartFrame = Math.max(
            0,
            Math.round(((wObj.start_ms - chunkStartMs) / 1000) * fps)
          );
          if (frame < wordStartFrame) return null;

          const wordLocalFrame = frame - wordStartFrame;
          const p = interpolate(wordLocalFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.back(1.8)),
          });

          const scale = interpolate(p, [0, 0.6, 1], [0.82, 1.05, 1.0]);
          const blur = interpolate(p, [0, 0.5, 1], [18, 0, 0]);

          const wordStyle: React.CSSProperties = {
            display: "inline-block",
            opacity: p,
            transform: `scale(${scale})`,
            filter: `blur(${blur}px) drop-shadow(0 8px 28px rgba(0,0,0,0.98)) drop-shadow(0 0 32px rgba(0,0,0,0.95))`,
            margin: "0 0.15em",
          };

          if (hasGrad) {
            wordStyle.background = layer.gradient;
            wordStyle.WebkitBackgroundClip = "text";
            wordStyle.WebkitTextFillColor = "transparent";
          } else {
            wordStyle.textShadow =
              "0 6px 24px rgba(0,0,0,0.98), 0 0 28px rgba(0,0,0,0.95), 0 2px 8px rgba(0,0,0,1)";
          }

          return (
            <span key={`keynote-${wIdx}`} style={wordStyle}>
              {wObj.text}
            </span>
          );
        })}
      </div>
    );
  }

  // 3. CYBER ACID LIME MATRIX GLITCH
  if (fx === "cyber_acid_lime_glitch" || fx === "acid_lime_letter_glitch") {
    let charCounter = 0;
    return (
      <div style={{ ...baseTextStyle, overflow: "visible" }}>
        {wordTimings.map((wObj, wIdx) => {
          const wordStartFrame = Math.max(
            0,
            Math.round(((wObj.start_ms - chunkStartMs) / 1000) * fps)
          );
          if (frame < wordStartFrame) return null;

          const wordLocalFrame = frame - wordStartFrame;

          const charSpans = Array.from(wObj.text).map((ch) => {
            const charIdx = charCounter++;
            const charStart = charIdx * 1.2;
            const p = interpolate(wordLocalFrame - charStart, [0, 7], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            });

            const skewX = interpolate(p, [0, 0.3, 0.7, 1], [12, -8, 2, 0]);
            const translateX = interpolate(p, [0, 0.3, 1], [-8, 4, 0]);
            const translateY = interpolate(p, [0, 0.3, 1], [-4, 2, 0]);

            return (
              <span
                key={`glitch-${charIdx}`}
                style={{
                  display: "inline-block",
                  opacity: p,
                  transform: `translate(${translateX}px, ${translateY}px) skewX(${skewX}deg)`,
                  color: "#84CC16",
                  filter:
                    "drop-shadow(-3px 0 0 #00FFFF) drop-shadow(3px 0 0 #FF0055) drop-shadow(0 0 20px rgba(132, 204, 22, 0.75))",
                  padding: "0 0.03em",
                }}
              >
                {ch}
              </span>
            );
          });

          return (
            <span
              key={`glitch-word-${wIdx}`}
              style={{
                display: "inline-flex",
                whiteSpace: "nowrap",
                margin: "0 0.15em",
              }}
            >
              {charSpans}
            </span>
          );
        })}
      </div>
    );
  }

  // 4. DYNAMIC STAGGERED CHARACTER CASCADE (3D spring cascade)
  if (fx === "dynamic_staggered_character_cascade" || fx === "spring_character_cascade") {
    let charCounter = 0;
    return (
      <div style={{ ...baseTextStyle, perspective: "500px" }}>
        {wordTimings.map((wObj, wIdx) => {
          const wordStartFrame = Math.max(
            0,
            Math.round(((wObj.start_ms - chunkStartMs) / 1000) * fps)
          );
          if (frame < wordStartFrame) return null;

          const wordLocalFrame = frame - wordStartFrame;

          const charSpans = Array.from(wObj.text).map((ch) => {
            const charIdx = charCounter++;
            const charStart = charIdx * 1.2;
            const p = interpolate(wordLocalFrame - charStart, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.back(1.7)),
            });

            const translateY = interpolate(p, [0, 0.7, 1], [28, -4, 0]);
            const scale = interpolate(p, [0, 0.7, 1], [0.65, 1.05, 1.0]);
            const rotateX = interpolate(p, [0, 0.7, 1], [45, -5, 0]);
            const blur = interpolate(p, [0, 0.6, 1], [8, 0, 0]);

            return (
              <span
                key={`cascade-${charIdx}`}
                style={{
                  display: "inline-block",
                  opacity: p,
                  transform: `translateY(${translateY}px) scale(${scale}) perspective(400px) rotateX(${rotateX}deg)`,
                  filter: `blur(${blur}px) drop-shadow(0 6px 24px rgba(0,0,0,0.98))`,
                  padding: "0 0.03em",
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
              }}
            >
              {charSpans}
            </span>
          );
        })}
      </div>
    );
  }

  // 5. CINEMATIC VIEWPORT MASK SWEEP (Massive font + laser wipe)
  if (fx === "cinematic_viewport_mask_sweep" || fx === "viewport_mask_sweep") {
    const wordStartFrame = Math.max(
      0,
      Math.round(((wordTimings[0]?.start_ms - chunkStartMs) / 1000) * fps)
    );
    const localF = Math.max(0, frame - wordStartFrame);
    const p = interpolate(localF, [0, 9], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });

    return (
      <div style={{ ...baseTextStyle, position: "relative", display: "inline-block" }}>
        <div
          style={{
            clipPath: `polygon(0 0, ${p * 100}% 0, ${p * 100}% 100%, 0 100%)`,
          }}
        >
          {hasGrad ? (
            <span
              style={{
                background: layer.gradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 6px 24px rgba(0,0,0,0.98)) drop-shadow(0 0 28px rgba(0,0,0,0.95))",
              }}
            >
              {layer.text}
            </span>
          ) : (
            <span style={{ textShadow: "0 6px 24px rgba(0,0,0,0.98), 0 0 28px rgba(0,0,0,0.95)" }}>
              {layer.text}
            </span>
          )}
        </div>
        {p < 1 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: `${p * 100}%`,
              width: "4px",
              height: "100%",
              background: "#00F0FF",
              boxShadow: "0 0 16px #00F0FF, 0 0 6px #FFF",
              opacity: interpolate(p, [0.8, 1], [1, 0]),
            }}
          />
        )}
      </div>
    );
  }

  // 6. OBSIDIAN HEAVY GROTESQUE PUNCH
  if (fx === "obsidian_heavy_grotesque") {
    return (
      <div style={{ ...baseTextStyle, overflow: "visible" }}>
        {wordTimings.map((wObj, wIdx) => {
          const wordStartFrame = Math.max(
            0,
            Math.round(((wObj.start_ms - chunkStartMs) / 1000) * fps)
          );
          if (frame < wordStartFrame) return null;

          const wordLocalFrame = frame - wordStartFrame;
          const p = interpolate(wordLocalFrame, [0, 7], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.back(1.6)),
          });

          const scale = interpolate(p, [0, 0.7, 1], [0.80, 1.04, 1.0]);
          const translateY = interpolate(p, [0, 1], [16, 0]);
          const blur = interpolate(p, [0, 0.5, 1], [12, 0, 0]);

          return (
            <span
              key={`obsidian-${wIdx}`}
              style={{
                display: "inline-block",
                opacity: p,
                transform: `translateY(${translateY}px) scale(${scale})`,
                filter: `blur(${blur}px) drop-shadow(0 8px 30px rgba(0,0,0,0.98)) drop-shadow(0 0 32px rgba(0,0,0,0.95))`,
                margin: "0 0.15em",
                color: "#FFFFFF",
                textShadow: "0 6px 24px rgba(0,0,0,0.98), 0 0 28px rgba(0,0,0,0.95)",
              }}
            >
              {wObj.text}
            </span>
          );
        })}
      </div>
    );
  }

  // 7. 3D GLYPH SLOT BARREL SPIN
  if (fx === "staggered_glyph_slot") {
    let charCounter = 0;
    return (
      <div style={{ ...baseTextStyle, perspective: "400px" }}>
        {wordTimings.map((wObj, wIdx) => {
          const wordStartFrame = Math.max(
            0,
            Math.round(((wObj.start_ms - chunkStartMs) / 1000) * fps)
          );
          if (frame < wordStartFrame) return null;

          const wordLocalFrame = frame - wordStartFrame;

          const charSpans = Array.from(wObj.text).map((ch) => {
            const charIdx = charCounter++;
            const charStart = charIdx * 1.2;
            const p = interpolate(wordLocalFrame - charStart, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            });
            const translateY = interpolate(p, [0, 1], [-120, 0]);
            const rotateX = interpolate(p, [0, 1], [-90, 0]);

            return (
              <span
                key={`slot-${charIdx}`}
                style={{
                  display: "inline-block",
                  opacity: p,
                  transform: `translateY(${translateY}%) perspective(300px) rotateX(${rotateX}deg)`,
                  filter: "drop-shadow(0 6px 24px rgba(0,0,0,0.98))",
                  padding: "0 0.02em",
                }}
              >
                {ch}
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
              }}
            >
              {charSpans}
            </span>
          );
        })}
      </div>
    );
  }

  // 8. 3D CAUSTIC GLASSMORPHIC REFRACTION
  if (fx === "glassmorphic_caustic_refract") {
    const shimmer = Math.sin(frame * 0.12) * 0.5 + 0.5;
    return (
      <div style={{ ...baseTextStyle, overflow: "visible" }}>
        {wordTimings.map((wObj, wIdx) => {
          const wordStartFrame = Math.max(
            0,
            Math.round(((wObj.start_ms - chunkStartMs) / 1000) * fps)
          );
          if (frame < wordStartFrame) return null;

          const wordLocalFrame = frame - wordStartFrame;
          const p = interpolate(wordLocalFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.back(1.5)),
          });

          const scale = interpolate(p, [0, 0.7, 1], [0.75, 1.06, 1.0]);
          const translateY = interpolate(p, [0, 1], [16, 0]);

          return (
            <span
              key={`glass-${wIdx}`}
              style={{
                display: "inline-block",
                opacity: p,
                transform: `translateY(${translateY}px) scale(${scale})`,
                WebkitTextStroke: "1.5px rgba(255, 255, 255, 0.9)",
                background:
                  "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.3) 40%, rgba(255,255,255,0.9) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: `drop-shadow(0 0 ${16 + shimmer * 12}px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 ${32 + shimmer * 20}px rgba(0, 240, 255, 0.7)) drop-shadow(0 8px 24px rgba(0,0,0,0.95))`,
                margin: "0 0.15em",
              }}
            >
              {wObj.text}
            </span>
          );
        })}
      </div>
    );
  }

  // 9. VIBE CHROMATIC LUMINESCENCE PULSE
  if (fx === "vibe_chromatic_luminescence_pulse") {
    const sx = Math.sin(frame * 0.35) * 4;
    const sy = Math.cos(frame * 0.35) * 4;

    return (
      <div style={{ ...baseTextStyle, overflow: "visible" }}>
        {wordTimings.map((wObj, wIdx) => {
          const wordStartFrame = Math.max(
            0,
            Math.round(((wObj.start_ms - chunkStartMs) / 1000) * fps)
          );
          if (frame < wordStartFrame) return null;

          const wordLocalFrame = frame - wordStartFrame;
          const p = interpolate(wordLocalFrame, [0, 7], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });

          const scale = interpolate(p, [0, 1], [1.15, 1.0]);
          const translateY = interpolate(p, [0, 1], [10, 0]);

          return (
            <span
              key={`vibe-${wIdx}`}
              style={{
                display: "inline-block",
                opacity: p,
                transform: `translateY(${translateY}px) scale(${scale})`,
                color: "#FFFFFF",
                textShadow:
                  "0 0 24px rgba(140, 180, 255, 0.95), 0 0 44px rgba(255, 120, 220, 0.8), 0 0 80px rgba(0, 240, 255, 0.6)",
                filter: `drop-shadow(${-sx}px ${-sy}px 18px rgba(0, 240, 255, 0.95)) drop-shadow(${sx}px ${sy}px 18px rgba(255, 0, 128, 0.95)) drop-shadow(0 6px 24px rgba(0,0,0,0.98))`,
                margin: "0 0.15em",
              }}
            >
              {wObj.text}
            </span>
          );
        })}
      </div>
    );
  }

  // 10. HEXTA TERMINAL TYPEWRITER + ACTIVE CARET
  if (fx === "typewriter_mono_caret") {
    const totalChars = layer.text.length;
    const wordStartFrame = Math.max(
      0,
      Math.round(((wordTimings[0]?.start_ms - chunkStartMs) / 1000) * fps)
    );
    const localF = Math.max(0, frame - wordStartFrame);
    const visibleCount = Math.min(totalChars, Math.max(1, Math.floor(localF / 1.1)));
    const visibleText = layer.text.slice(0, visibleCount);
    const showCaret = Math.floor(localF / 5) % 2 === 0;

    return (
      <div style={baseTextStyle}>
        <span
          style={{
            background: "rgba(0, 240, 255, 0.12)",
            border: "2px solid #00F0FF",
            boxShadow: "0 0 24px rgba(0, 240, 255, 0.45), 0 6px 20px rgba(0,0,0,0.9)",
            borderRadius: "14px",
            padding: "6px 18px",
            display: "inline-flex",
            alignItems: "center",
            color: "#FFFFFF",
          }}
        >
          <span>{visibleText}</span>
          <span
            style={{
              color: "#00F0FF",
              fontWeight: 900,
              marginLeft: "4px",
              opacity: showCaret ? 1 : 0,
            }}
          >
            |
          </span>
        </span>
      </div>
    );
  }

  // 11. SUBPIXEL GLOW MASK (Standard high-contrast Gaussian blur reveal for companion layers)
  return (
    <div style={baseTextStyle}>
      {wordTimings.map((wObj, wIdx) => {
        const wordStartFrame = Math.max(
          0,
          Math.round(((wObj.start_ms - chunkStartMs) / 1000) * fps)
        );
        if (frame < wordStartFrame) return null;

        const wordLocalFrame = frame - wordStartFrame;
        const p = interpolate(wordLocalFrame, [0, 7], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });

        const translateY = interpolate(p, [0, 1], [14, 0]);
        const blur = interpolate(p, [0, 1], [12, 0]);
        const scale = interpolate(p, [0, 1], [0.94, 1.0]);

        return (
          <span
            key={`subpixel-word-${wIdx}`}
            style={{
              display: "inline-block",
              opacity: p,
              transform: `translateY(${translateY}px) scale(${scale})`,
              filter: `blur(${blur}px) drop-shadow(0 4px 20px rgba(0,0,0,0.98)) drop-shadow(0 0 24px rgba(0,0,0,0.95))`,
              margin: "0 0.15em",
              color: layer.color || "#F8FAFC",
              textShadow: "0 4px 18px rgba(0,0,0,0.98), 0 0 22px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,1)",
            }}
          >
            {wObj.text}
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
  startFrame: number;
  endFrame: number;
}> = ({ chunk, startFrame, endFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = endFrame - startFrame;
  if (totalFrames <= 0) return null;

  // Placement: Upper chest zone (56% Y) completely clear of chin and beautifully centered
  const topPosition = chunk.placement?.yPercent || "56%";
  const leftPosition = chunk.placement?.xPercent || "50%";

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

  // Overall chunk entrance & exit kinetic spring
  const chunkEntrance = interpolate(frame, [0, Math.min(6, totalFrames)], [0, 1], {
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
        left: leftPosition,
        top: topPosition,
        transform: `translate(-50%, -50%) scale(${interpolate(chunkEntrance, [0, 1], [0.94, 1.0])})`,
        opacity: Math.min(chunkEntrance, chunkExit),
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "6px",
        width: "94%",
        maxWidth: "1020px",
        textAlign: "center",
        zIndex: 10,
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
          />
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Composition Component
// ---------------------------------------------------------------------------
export const PrometheusMinRun: React.FC<PrometheusMinRunProps> = ({
  videoSrc,
  matteSrc,
  chunks,
  durationMs,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* 1. Base Video (Z: 1) */}
      <Video
        src={staticFile(videoSrc)}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 1,
        }}
      />

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
          }}
        />
      )}

      {/* 3. Multi-Layer Speech-Synchronized Kinetic Typography Chunks (Z: 100 - Foreground High Contrast) */}
      {chunks.map((chunk, idx) => {
        // Frame-accurate source time synchronization (prioritize startMs from source audio)
        const startMs = chunk.startMs ?? chunk.outputStartMs ?? 0;
        const endMs = chunk.endMs ?? chunk.outputEndMs ?? startMs + 1500;

        const startFrame = Math.round((startMs / 1000) * fps);
        const endFrame = Math.round((endMs / 1000) * fps);
        const durationFrames = Math.max(1, endFrame - startFrame);

        return (
          <Sequence
            key={`chunk-${idx}-${startMs}`}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <MultiLayerTypographyCard
              chunk={chunk}
              startFrame={startFrame}
              endFrame={endFrame}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export default PrometheusMinRun;
