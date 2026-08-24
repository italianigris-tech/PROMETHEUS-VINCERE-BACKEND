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
// Kinetic Motion Layer Renderer (Word-by-Word & Character-Level Motion Engines)
// ---------------------------------------------------------------------------
const KineticLayerRenderer: React.FC<{
  layer: TypographyLayer;
  frame: number;
  chunkStartMs: number;
  chunkEndMs: number;
  fps: number;
  totalFrames: number;
}> = ({ layer, frame, chunkStartMs, chunkEndMs, fps, totalFrames }) => {
  const fx = layer.fxPreset || (layer.isHero ? "focus_hunting_bokeh_shimmer" : "subpixel_glow_mask");

  const baseTextStyle: React.CSSProperties = {
    fontFamily: `"${layer.fontFamily}", "${layer.accentFont || "sans-serif"}", sans-serif`,
    fontWeight: layer.fontWeight,
    fontStyle: layer.fontStyle as any,
    fontSize: `${layer.fontSizePx}px`,
    color: layer.color || (layer.isHero ? "#F5E6C4" : "#FFFFFF"),
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
    overflow: "visible",
  };

  const words = layer.text.split(" ").filter((w) => w.length > 0);

  // 1. FOCUS HUNTING BOKEH SHIMMER (Soft optical defocus hunt & crisp lock)
  if (fx === "focus_hunting_bokeh_shimmer" || fx === "camera_rack_focus_hunt") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wIdx * 2.0;
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
          const wordStart = wIdx * 2.2;
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
  if (fx === "spring_blur_physics_engine" || fx === "spring_physics") {
    return (
      <div style={baseTextStyle}>
        {words.map((word, wIdx) => {
          const wordStart = wIdx * 2.0;
          const localFrame = Math.max(0, frame - wordStart);
          const spr = spring({
            fps,
            frame: localFrame,
            config: { mass: 0.7, damping: 12, stiffness: 170 },
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
          const wordStart = wIdx * 2.0;
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
          const wordStart = wIdx * 2.0;
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
        const wordStart = wIdx * 1.8;
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
        zIndex: 100,
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
