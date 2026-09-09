import React from "react";
import { Easing, interpolate, spring } from "remotion";

export type ArchetypeProps = {
  frame: number;
  fps: number;
  text: string;
  words: string[];
  color: string;
  accentColor: string;
  fontFamily: string;
  fontSizePx: number;
  fontWeight: number;
  letterSpacingEm: number;
  gradient?: string;
  glow?: string;
  durationFrames: number;
  wordEntranceFrames?: number[];
  casing?: string;
  fontStyle?: string;
  blendMode?: string;
  isSeeThrough?: boolean;
};

export const resolveArchetypeTextTransform = (
  casing?: string,
  fontFamily?: string,
  fontStyle?: string,
  defaultTransform: "uppercase" | "none" = "uppercase"
): React.CSSProperties["textTransform"] => {
  const isScript = fontStyle === "italic" || Boolean(fontFamily && /script|brush|vibes|pinyon|alex|brotherhood|bromello|exmouth|champignon|bucklane|formale|cavas/i.test(fontFamily));
  if (isScript) {
    return casing === "lowercase" ? "lowercase" : "none";
  }
  if (casing === "uppercase") return "uppercase";
  if (casing === "lowercase") return "lowercase";
  if (casing === "title" || casing === "capitalize") return "capitalize";
  return defaultTransform === "uppercase" ? "uppercase" : undefined;
};

export const ALL_ARCHETYPE_FX_NAMES = [
  "gold_gradient_scale_blur",
  "refraction_shimmer_mask",
  "stagger_blur_word_reveal",
  "keyword_highlight_sweep",
  "crossout_red_streak",
  "cursor_selection_reveal",
  "quote_glow_reveal",
  "cyan_swoosh_underline",
  "circle_orbit_reveal",
  "typewriter_cursor",
  "neon_wrong_choice_pill",
  "chromatic_aberration_wipe",
  "gold_selection_box_reveal",
  "glass_pill_three_words",
  "cta_glass_dual_color_pill",
  "blue_blur_underline_reveal",
  "floating_glass_word_trio",
  "dramatic_scale_entry",
  "word_by_word_3d_flip",
  "text_highlight_scan_box",
  "air_frontal_optical_bloom",
  "hierarchical_asymmetric_lockup",
  "documentary_lockup_captions",
  "micro_macro_kinetic_type",
  "spatial_push_spring",
  "difference_knockout",
  "chiseled_prism_metallic",
  "prism_chisel_hard_bevel",
  "vj_kinetic_typography",
  "vjkt",
  "real_estate_luxury_curve",
  "viral_3d_compound_tilt",
  "split_mask_duotone_gradient",
  "multi_word_slide_up_stagger",
  "apple_variable_curve_pop",
  "smooth_pop_opacity_sync",
  "animated_split_highlighter",
  "film_strip_specular_shine",
  "strobe_flicker_ignition",
  "premium_circular_caption_stack",
] as const;

export type ArchetypeFxName = typeof ALL_ARCHETYPE_FX_NAMES[number];

/**
 * 2. GOLD GRADIENT SCALE BLUR
 * Source: "STRUCTURED ANIMATION/text gradient animation.html"
 * Single dominating hero word with matte bronze/gold vertical gradient,
 * scale lock-in overshoot, and idle subtle specular glow pulsing.
 */
export const GoldGradientScaleBlur: React.FC<ArchetypeProps> = ({
  frame,
  text,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
}) => {
  const p = interpolate(frame, [0, 8, 14], [0, 0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const scale = interpolate(frame, [0, 10, 16], [0.94, 1.03, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const blur = interpolate(frame, [0, 10], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Idle specular breathing
  const idleGlow = Math.sin(frame * 0.08) * 0.15 + 0.35;
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");

  return (
    <div
      style={{
        display: "inline-block",
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontStyle: fontStyle as any,
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        textTransform: transform,
        letterSpacing: `${letterSpacingEm || -0.04}em`,
        lineHeight: 0.95,
        textAlign: "center",
        backgroundImage: "linear-gradient(to bottom, #d6b379 0%, #8c6a2e 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        opacity: p,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px) drop-shadow(0 4px 14px rgba(0,0,0,0.85)) drop-shadow(0 0 20px rgba(214,179,121,${idleGlow}))`,
      }}
    >
      {text}
    </div>
  );
};

/**
 * 3. REFRACTION SHIMMER MASK
 * Source: "STRUCTURED ANIMATION/text mask animation.html"
 * Core cyan refractive mask with high-frequency travelling specular highlight across the glyphs.
 */
export const RefractionShimmerMask: React.FC<ArchetypeProps> = ({
  frame,
  text,
  fontSizePx,
  accentColor,
  fontFamily,
  fontStyle,
  casing,
}) => {
  const p = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const translateY = interpolate(p, [0, 1], [24, 0]);
  const blur = interpolate(p, [0, 0.7, 1], [14, 2, 0]);
  const scale = interpolate(p, [0, 1], [0.92, 1.0]);

  // Traveling specular shimmer
  const shimmerPos = ((frame * 3) % 200) - 50;
  const cyan = accentColor || "#00E5FF";
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");

  return (
    <div
      style={{
        display: "inline-block",
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontStyle: fontStyle as any,
        fontSize: `${fontSizePx}px`,
        fontWeight: 900,
        textTransform: transform,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.85) 0%, ${cyan} 35%, #FFFFFF 50%, ${cyan} 65%, rgba(255,255,255,0.85) 100%)`,
        backgroundSize: "200% auto",
        backgroundPosition: `${shimmerPos}% center`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        opacity: p,
        transform: `translateY(${translateY}px) scale(${scale})`,
        filter: `blur(${blur}px) drop-shadow(0 0 24px ${cyan}88) drop-shadow(0 4px 20px rgba(0,0,0,0.95))`,
      }}
    >
      {text}
    </div>
  );
};

/**
 * 4. STAGGER BLUR WORD REVEAL
 * Source: "STRUCTURED ANIMATION/blur-reveal.html"
 * Smooth per-word blur dissolution with trailing subtitle cadence.
 */
export const StaggerBlurWordReveal: React.FC<ArchetypeProps> = ({
  frame,
  words,
  color,
  fontSizePx,
  fontWeight,
  fontFamily,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "0.22em",
        fontFamily: `"${fontFamily}", serif`,
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 600,
        color: color || "#FFFFFF",
      }}
    >
      {words.map((w, idx) => {
        const startFrame = idx * 3;
        const localFrame = Math.max(0, frame - startFrame);
        const p = interpolate(localFrame, [0, 9], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const blur = interpolate(p, [0, 0.7, 1], [14, 2, 0]);
        const scale = interpolate(p, [0, 1], [1.06, 1.0]);

        return (
          <span
            key={`stagger-word-${idx}`}
            style={{
              display: "inline-block",
              opacity: p,
              transform: `scale(${scale})`,
              filter: `blur(${blur}px)`,
              textShadow: "0 4px 18px rgba(0,0,0,0.9)",
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/**
 * 5. KEYWORD HIGHLIGHT SWEEP
 * Source: "STRUCTURED ANIMATION/highlight-word.html"
 * Text blur dissolves in, followed by a vivid marker highlighter block sweeping horizontally behind.
 */
export const KeywordHighlightSweep: React.FC<ArchetypeProps> = ({
  frame,
  text,
  color,
  accentColor,
  fontSizePx,
  fontWeight,
}) => {
  const textP = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const blur = interpolate(textP, [0, 0.7, 1], [14, 2, 0]);
  const sweepP = interpolate(frame, [9, 17], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const highlightColor = accentColor || "#F5C842";
  const textColor = sweepP > 0.4 ? "#0D0D11" : (color || "#FFFFFF");

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        padding: "4px 14px",
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        letterSpacing: "0.02em",
        opacity: textP,
        filter: `blur(${blur}px)`,
        color: textColor,
        transition: "color 0.15s ease",
        textShadow: sweepP > 0.4 ? "none" : "0 4px 20px rgba(0,0,0,0.95)",
      }}
    >
      {/* Sweeping Highlight Marker */}
      <div
        style={{
          position: "absolute",
          inset: "2px -4px",
          backgroundColor: highlightColor,
          borderRadius: "4px",
          transformOrigin: "left center",
          transform: `scaleX(${sweepP})`,
          zIndex: -1,
          boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 16px ${highlightColor}88`,
        }}
      />
      {text}
    </div>
  );
};

/**
 * 6. CROSSOUT RED STREAK
 * Source: "STRUCTURED ANIMATION/word cross out.html"
 * Text reveals with bloom, followed by a tapered cinematic red laser crossout strike.
 */
export const CrossoutRedStreak: React.FC<ArchetypeProps> = ({
  frame,
  text,
  color,
  fontSizePx,
  fontWeight,
  fontFamily,
  fontStyle,
  casing,
}) => {
  const p = interpolate(frame, [0, 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const streakP = interpolate(frame, [10, 17], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.19, 1, 0.22, 1),
  });
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 16px",
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 900,
        textTransform: transform,
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontStyle: fontStyle as any,
        letterSpacing: "-0.02em",
        color: color || "#FFFFFF",
        opacity: p,
        filter: `blur(${interpolate(p, [0, 1], [10, 0])}px)`,
        textShadow: "0 0 14px rgba(255,255,255,0.2), 0 4px 20px rgba(0,0,0,0.95)",
      }}
    >
      {text}

      {/* Red Motion Streak */}
      <div
        style={{
          position: "absolute",
          top: "54%",
          left: 0,
          width: "100%",
          height: "6px",
          backgroundColor: "#E60000",
          boxShadow: "0 0 12px rgba(230,0,0,0.9), 0 0 24px rgba(255,50,50,0.6)",
          transformOrigin: "left center",
          transform: `scaleX(${streakP})`,
          borderRadius: "3px",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

/**
 * 7. CURSOR SELECTION REVEAL
 * Source: "STRUCTURED ANIMATION/cursor highlight text animation.html"
 * Animated macOS/Figma style cursor dragging an active blue selection box over the text.
 */
export const CursorSelectionReveal: React.FC<ArchetypeProps> = ({
  frame,
  text,
  color,
  fontSizePx,
  fontWeight,
}) => {
  const dragP = interpolate(frame, [4, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const cursorX = interpolate(dragP, [0, 1], [0, 100]);
  const cursorY = interpolate(dragP, [0, 1], [0, 100]);

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        padding: "16px 28px",
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        color: color || "#FFFFFF",
        textShadow: "0 4px 20px rgba(0,0,0,0.95)",
      }}
    >
      {text}

      {/* Selection Box */}
      {frame >= 4 && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "8px",
            width: `calc(${dragP} * (100% - 16px))`,
            height: `calc(${dragP} * (100% - 16px))`,
            backgroundColor: "rgba(0, 102, 255, 0.22)",
            border: "1.5px dashed #0066FF",
            boxShadow: "0 0 15px rgba(0, 102, 255, 0.4)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* OS Pointer Cursor */}
      {frame >= 2 && frame <= 28 && (
        <svg
          viewBox="0 0 24 24"
          style={{
            position: "absolute",
            top: `${cursorY}%`,
            left: `${cursorX}%`,
            width: "24px",
            height: "24px",
            transform: "translate(-2px, -2px)",
            pointerEvents: "none",
            zIndex: 10,
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))",
          }}
        >
          <path
            d="M2 2 L2 20 L7 15 L12 24 L15 22 L10 14 L17 14 Z"
            fill="#FFFFFF"
            stroke="#000000"
            strokeWidth="1.5"
          />
        </svg>
      )}
    </div>
  );
};

/**
 * 8. QUOTE GLOW REVEAL
 * Source: "STRUCTURED ANIMATION/animated_quote_reveal.html"
 * Editorial quote presentation with luminous oversized quotation mark, per-word blur cascade,
 * and high-prestige violet/amethyst glow blooming on entrance.
 */
export const QuoteGlowReveal: React.FC<ArchetypeProps> = ({
  frame,
  words,
  color,
  fontSizePx,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        padding: "20px",
        maxWidth: "880px",
      }}
    >
      {/* Words Cascade */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0.22em",
          fontFamily: '"Playfair Display", "Bodoni Moda", serif',
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: `${fontSizePx}px`,
          lineHeight: 1.3,
          color: color || "#FFFFFF",
        }}
      >
        {words.map((w, idx) => {
          const localFrame = Math.max(0, frame - idx * 2.5);
          const p = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const translateY = interpolate(p, [0, 1], [14, 0]);
          const blur = interpolate(p, [0, 0.7, 1], [12, 1, 0]);

          return (
            <span
              key={`quote-word-${idx}`}
              style={{
                display: "inline-block",
                opacity: p,
                transform: `translateY(${translateY}px)`,
                filter: `blur(${blur}px)`,
                textShadow: "0 0 16px rgba(192, 132, 252, 0.75), 0 4px 20px rgba(0,0,0,0.9)",
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 9. CYAN SWOOSH UNDERLINE
 * Source: "STRUCTURED ANIMATION/text underline.html"
 * Dynamic curved vector underline swoosh with dual-core cyan gradients and traveling shimmer.
 */
export const CyanSwooshUnderline: React.FC<ArchetypeProps> = ({
  frame,
  text,
  color,
  accentColor,
  fontSizePx,
  fontWeight,
}) => {
  const textP = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const swooshP = interpolate(frame, [6, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.9, 0.24, 1),
  });

  const cyan = accentColor || "#00BFFF";

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: `${fontSizePx}px`,
          fontWeight: fontWeight || 800,
          letterSpacing: "-0.04em",
          color: color || "#FFFFFF",
          opacity: textP,
          transform: `translateY(${interpolate(textP, [0, 1], [14, 0])}px)`,
          filter: `blur(${interpolate(textP, [0, 1], [8, 0])}px)`,
          textShadow: "0 0 12px rgba(255,255,255,0.4), 0 4px 20px rgba(0,0,0,0.95)",
        }}
      >
        {text}
      </div>

    </div>
  );
};

/**
 * 10. CIRCLE ORBIT REVEAL
 * Source: "STRUCTURED ANIMATION/circle-reveal.html"
 * Word blurs in, followed by a hand-drawn circle SVG tracing cleanly around the glyphs.
 */
export const CircleOrbitReveal: React.FC<ArchetypeProps> = ({
  frame,
  text,
  color,
  accentColor,
  fontSizePx,
  fontWeight,
}) => {
  const textP = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const circleP = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const strokeColor = accentColor || "#00F0FF";
  const pathLength = 600;
  const dashOffset = (1 - circleP) * pathLength;

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        padding: "16px 28px",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: `${fontSizePx}px`,
          fontWeight: fontWeight || 900,
          letterSpacing: "0.04em",
          color: color || "#FFFFFF",
          opacity: textP,
          transform: `scale(${interpolate(textP, [0, 1], [1.08, 1.0])})`,
          filter: `blur(${interpolate(textP, [0, 1], [12, 0])}px)`,
          textShadow: "0 4px 20px rgba(0,0,0,0.95)",
        }}
      >
        {text}
      </span>
    </div>
  );
};

/**
 * 11. TYPEWRITER CURSOR
 * Source: "STRUCTURED ANIMATION/typewriter.html"
 * Character-by-character mechanical reveal with blinking console cursor.
 */
export const TypewriterCursor: React.FC<ArchetypeProps> = ({
  frame,
  text,
  color,
  fontSizePx,
  fontFamily,
}) => {
  const charsPerFrame = 0.55;
  const charsVisible = Math.min(text.length, Math.floor(frame * charsPerFrame));
  const isBlinking = Math.floor(frame / 6) % 2 === 0;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: `"${fontFamily}", "Courier Prime", monospace, sans-serif`,
        fontSize: `${fontSizePx}px`,
        fontWeight: 600,
        color: color || "#FFFFFF",
        textShadow: "0 4px 20px rgba(0,0,0,0.95)",
      }}
    >
      <span>{text.slice(0, charsVisible)}</span>
      <span
        style={{
          display: "inline-block",
          width: "4px",
          height: "1.15em",
          backgroundColor: color || "#FFFFFF",
          marginLeft: "4px",
          opacity: isBlinking ? 1 : 0,
          boxShadow: "0 0 8px rgba(255,255,255,0.8)",
        }}
      />
    </div>
  );
};

/**
 * 12. NEON WRONG CHOICE PILL
 * Source: "STRUCTURED ANIMATION/wrong choice with text.html"
 * Deep carbon pill with magenta/purple neon edge border, animated X-mark container, and breathing glow.
 */
export const NeonWrongChoicePill: React.FC<ArchetypeProps> = ({
  frame,
  fps,
  text,
  fontSizePx,
}) => {
  const pillSpring = spring({
    fps,
    frame,
    config: { mass: 0.8, damping: 14, stiffness: 150 },
  });

  const iconSpring = spring({
    fps,
    frame: Math.max(0, frame - 5),
    config: { mass: 0.5, damping: 10, stiffness: 200 },
  });

  const glowPulse = Math.sin(frame * 0.1) * 0.15 + 0.35;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "10px 24px 10px 12px",
        background: "linear-gradient(180deg, #1E1E21 0%, #121214 100%)",
        borderRadius: "999px",
        border: "1.5px solid transparent",
        backgroundImage: "linear-gradient(#121214, #121214), linear-gradient(90deg, #FF2D7D, #9D50BB)",
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
        boxShadow: `0 8px 30px rgba(0,0,0,0.8), 0 0 20px rgba(255,45,125,${glowPulse})`,
        transform: `scale(${pillSpring})`,
        opacity: pillSpring,
      }}
    >
      {/* Red Icon Box */}
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          background: "linear-gradient(135deg, #2A2A2E 0%, #1A1A1C 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginRight: "14px",
          transform: `scale(${iconSpring})`,
          boxShadow: "0 0 10px rgba(255,77,77,0.4)",
          position: "relative",
        }}
      >
        {/* X Symbol */}
        <div style={{ position: "relative", width: "16px", height: "16px" }}>
          <div
            style={{
              position: "absolute",
              top: "7px",
              left: 0,
              width: "16px",
              height: "2.5px",
              backgroundColor: "#FF4D4D",
              borderRadius: "2px",
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "7px",
              left: 0,
              width: "16px",
              height: "2.5px",
              backgroundColor: "#FF4D4D",
              borderRadius: "2px",
              transform: "rotate(-45deg)",
            }}
          />
        </div>
      </div>

      {/* Pill Text */}
      <span
        style={{
          fontSize: `${Math.max(18, Math.round(fontSizePx * 0.45))}px`,
          fontWeight: 600,
          color: "#F5F5F7",
          letterSpacing: "-0.01em",
        }}
      >
        {text}
      </span>
    </div>
  );
};

/**
 * 13. CHROMATIC ABERRATION WIPE
 * Source: "TEXT SVG ANIMATIONS/cinematic-text-preset.html"
 * High-velocity chromatic RGB channel separation split with SVG glow and horizontal wipe clip.
 */
export const ChromaticAberrationWipe: React.FC<ArchetypeProps> = ({
  frame,
  text,
  color,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
}) => {
  const p = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const chromaticOffset = interpolate(frame, [0, 6, 14], [8, 4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 900,
        textTransform: transform,
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontStyle: fontStyle as any,
        letterSpacing: `${letterSpacingEm || 0.04}em`,
        clipPath: `polygon(0 0, ${p * 100}% 0, ${p * 100}% 100%, 0 100%)`,
        lineHeight: 1,
      }}
    >
      {/* Red Ghost */}
      {chromaticOffset > 0 && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            color: "#FF0055",
            transform: `translate(${chromaticOffset}px, -1px)`,
            opacity: 0.75,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        >
          {text}
        </span>
      )}

      {/* Cyan Ghost */}
      {chromaticOffset > 0 && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            color: "#00F0FF",
            transform: `translate(-${chromaticOffset}px, 1px)`,
            opacity: 0.75,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        >
          {text}
        </span>
      )}

      {/* Main Core Layer */}
      <span
        style={{
          position: "relative",
          color: color || "#FFFFFF",
          textShadow: "0 0 18px rgba(255,255,255,0.6), 0 4px 20px rgba(0,0,0,0.95)",
        }}
      >
        {text}
      </span>
    </div>
  );
};

/**
 * 14. GOLD SELECTION BOX REVEAL
 * Source: "STRUCTURED ANIMATION/text highlight animation.html"
 * Architectural box stroke animation with 4 AI corner dots popping in around focal words.
 */
export const GoldSelectionBoxReveal: React.FC<ArchetypeProps> = ({
  frame,
  text,
  color,
  accentColor,
  fontSizePx,
  fontWeight,
}) => {
  const textP = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const boxP = interpolate(frame, [6, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const dotP = interpolate(frame, [14, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const gold = accentColor || "#FFC107";
  const pathLen = 600;

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 36px",
      }}
    >
      <span
        style={{
          fontSize: `${fontSizePx}px`,
          fontWeight: fontWeight || 700,
          letterSpacing: "-0.03em",
          color: color || "#FFFFFF",
          opacity: textP,
          transform: `translateY(${interpolate(textP, [0, 1], [10, 0])}px)`,
          filter: `blur(${interpolate(textP, [0, 1], [8, 0])}px)`,
          textShadow: "0 4px 20px rgba(0,0,0,0.9)",
          zIndex: 2,
        }}
      >
        {text}
      </span>
    </div>
  );
};

/**
 * 15. GLASS PILL THREE WORDS
 * Source: "STRUCTURED ANIMATION/THREE MAIN WORDS...ANIMATION.html"
 * Frosted 3D glassmorphism capsule with top sheen, depth lip, and staggered per-item entrance.
 */
export const GlassPillThreeWords: React.FC<ArchetypeProps> = ({
  frame,
  words,
  color,
  fontSizePx,
}) => {
  const floatY = Math.sin(frame * 0.05) * 8;
  const floatRotX = Math.sin(frame * 0.05) * 3;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "space-around",
        gap: "28px",
        padding: "16px 40px",
        borderRadius: "100px",
        background: "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.3) 100%)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        border: "1px solid rgba(255,255,255,0.22)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.7)",
        transform: `translateY(${floatY}px) rotateX(${floatRotX}deg)`,
      }}
    >
      {words.map((w, idx) => {
        const p = interpolate(frame - idx * 3, [0, 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });

        return (
          <span
            key={`glass-w-${idx}`}
            style={{
              fontSize: `${Math.max(20, Math.round(fontSizePx * 0.65))}px`,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: color || "#FFFFFF",
              opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [16, 0])}px)`,
              filter: `blur(${interpolate(p, [0, 1], [10, 0])}px)`,
              textShadow: "0 2px 12px rgba(0,0,0,0.5), 0 0 14px rgba(255,255,255,0.4)",
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/**
 * 16. CTA GLASS DUAL COLOR PILL
 * Source: "STRUCTURED ANIMATION/call to action and important words.html"
 * Glass capsule featuring a two-tone layout: white prefix + radiant cyan hook callout.
 */
export const CtaGlassDualColorPill: React.FC<ArchetypeProps> = ({
  frame,
  words,
  color,
  accentColor,
  fontSizePx,
}) => {
  const splitIndex = Math.max(1, Math.floor(words.length / 2));
  const firstHalf = words.slice(0, splitIndex).join(" ");
  const secondHalf = words.slice(splitIndex).join(" ");

  const p1 = interpolate(frame, [0, 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const p2 = interpolate(frame, [4, 13], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const cyan = accentColor || "#00C2FF";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        padding: "14px 34px",
        borderRadius: "100px",
        background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 60%, rgba(0,0,0,0.2) 100%)",
        border: "1px solid rgba(255,255,255,0.2)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 16px 40px rgba(0,0,0,0.5)",
      }}
    >
      <span
        style={{
          fontSize: `${Math.max(18, Math.round(fontSizePx * 0.5))}px`,
          fontWeight: 700,
          color: color || "#FFFFFF",
          opacity: p1,
          transform: `translateY(${interpolate(p1, [0, 1], [12, 0])}px)`,
          filter: `blur(${interpolate(p1, [0, 1], [8, 0])}px)`,
        }}
      >
        {firstHalf}
      </span>
      <span
        style={{
          fontSize: `${Math.max(18, Math.round(fontSizePx * 0.5))}px`,
          fontWeight: 800,
          color: cyan,
          opacity: p2,
          transform: `translateY(${interpolate(p2, [0, 1], [12, 0])}px)`,
          filter: `blur(${interpolate(p2, [0, 1], [8, 0])}px)`,
          textShadow: `0 0 16px ${cyan}aa, 0 0 30px ${cyan}55`,
        }}
      >
        {secondHalf}
      </span>
    </div>
  );
};

/**
 * 17. BLUE BLUR UNDERLINE REVEAL
 * Source: "STRUCTURED ANIMATION/blur-underline.html"
 * Minimalist high-contrast word reveal with an electric cobalt underline tracking across.
 */
export const BlueBlurUnderlineReveal: React.FC<ArchetypeProps> = ({
  frame,
  text,
  color,
  fontSizePx,
  fontWeight,
}) => {
  const textP = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const lineP = interpolate(frame, [8, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.77, 0, 0.18, 1),
  });

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        paddingBottom: "8px",
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        color: color || "#FFFFFF",
        opacity: textP,
        filter: `blur(${interpolate(textP, [0, 1], [12, 0])}px)`,
        textShadow: "0 4px 20px rgba(0,0,0,0.95)",
      }}
    >
      {text}
    </div>
  );
};

/**
 * 18. DRAMATIC SCALE ENTRY
 * Punchy scale bounce with specular bloom emphasis.
 */
export const DramaticScaleEntry: React.FC<ArchetypeProps> = ({
  frame,
  text,
  color,
  accentColor,
  fontSizePx,
  fontWeight,
}) => {
  const p = interpolate(frame, [0, 6, 12], [0.65, 1.05, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const opacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const blur = interpolate(frame, [0, 7], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "inline-block",
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 900,
        textTransform: "uppercase",
        letterSpacing: "-0.03em",
        color: color || "#FFFFFF",
        transform: `scale(${p})`,
        opacity,
        filter: `blur(${blur}px) drop-shadow(0 0 20px ${accentColor || "#00F0FF"}88)`,
        textShadow: "0 4px 24px rgba(0,0,0,0.95)",
      }}
    >
      {text}
    </div>
  );
};

/**
 * 19. WORD BY WORD 3D FLIP
 * 3D perspective rotational flip upward per word.
 */
export const WordByWord3dFlip: React.FC<ArchetypeProps> = ({
  frame,
  words,
  color,
  fontSizePx,
  fontWeight,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0.22em",
        perspective: "800px",
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        color: color || "#FFFFFF",
      }}
    >
      {words.map((w, idx) => {
        const localFrame = Math.max(0, frame - idx * 3.5);
        const p = interpolate(localFrame, [0, 9], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });

        const rotX = interpolate(p, [0, 1], [-85, 0]);
        const blur = interpolate(p, [0, 0.7, 1], [10, 1, 0]);

        return (
          <span
            key={`flip-w-${idx}`}
            style={{
              display: "inline-block",
              opacity: p,
              transform: `perspective(600px) rotateX(${rotX}deg)`,
              transformOrigin: "center bottom",
              filter: `blur(${blur}px)`,
              textShadow: "0 6px 20px rgba(0,0,0,0.95)",
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/**
 * 20. AIR FRONTAL OPTICAL BLOOM
 * Multi-layer in-the-air frontal typography treatment:
 * 1. Diffusion & Optical Bloom: soft blur clone layer spilling high-luminance light beyond vector boundary.
 * 2. Non-Uniform Vertical Micro-Gradient: pure white on top, ambient warm mid-tones at bottom (#FFFFFF -> #DCD7CD).
 * 3. Subtle Edge Feathering / Anti-Aliasing Bleed: 0.35px micro-feather producing optical fringe tinting.
 * 4. Soft Dark Underlay (Backplate Shadow): omnidirectional diffuse ambient occlusion halo (blur 8px, low opacity).
 * 5. Atmospheric Blend / Screen Interaction: screen blend interaction sampling underlying video frame luminance.
 */
export const AirFrontalOpticalBloom: React.FC<ArchetypeProps> = ({
  frame,
  text,
  words,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
}) => {
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "none");
  const p = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const bloomPulse = 0.58 + Math.sin(frame * 0.08) * 0.08;
  const displayText = words && words.length > 0 ? words.join(" ") : text;

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        fontFamily: `"${fontFamily}", sans-serif`,
        fontSize: `${fontSizePx}px`,
        fontWeight,
        fontStyle: fontStyle as any,
        letterSpacing: `${letterSpacingEm}em`,
        textTransform: transform,
        textAlign: "center",
        lineHeight: 1.05,
        opacity: p,
      }}
    >
      {/* 4. Soft Dark Underlay (Backplate Shadow / Ambient Occlusion Halo) */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          color: "#000000",
          WebkitTextFillColor: "#000000",
          filter: "blur(8px)",
          opacity: 0.42,
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 1,
        }}
      >
        {displayText}
      </span>

      {/* 1 & 5. Diffusion & Optical Bloom with Atmospheric Screen Blend */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          color: "#FFFFFF",
          WebkitTextFillColor: "#FFFFFF",
          filter: "blur(6px) drop-shadow(0 0 16px rgba(255, 255, 255, 0.75)) drop-shadow(0 0 32px rgba(255, 250, 240, 0.35))",
          mixBlendMode: "screen",
          opacity: bloomPulse,
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 2,
        }}
      >
        {displayText}
      </span>

      {/* 2 & 3. Lit Core Glyph: Vertical Micro-Gradient + Subtle Edge Feathering */}
      <span
        style={{
          position: "relative",
          zIndex: 3,
          display: "inline-block",
          backgroundImage: "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: "blur(0.35px)", // 3. Subpixel edge feathering producing optical fringe
        }}
      >
        {displayText}
      </span>
    </div>
  );
};

/**
 * 21. HIERARCHICAL ASYMMETRIC KINETIC TYPOGRAPHY
 * (Documentary Lockup Captions / Micro-Macro Kinetic Type)
 *
 * Visual Format & Architecture:
 * Blends editorial print design with fast-paced motion graphics.
 * Rather than standard centered subtitles, pairs a massive "Hero" anchor word/phrase
 * with a significantly smaller "Modifier/Context" phrase in a tight, asymmetric 3:1 to 4:1 grid.
 *
 * Typography & Styling:
 * - Typeface: Clean geometric/neo-grotesque sans ("Inter", "Montserrat", "Neue Haas Grotesk", "Helvetica Now", "Futura Bold")
 * - Hero Layer: Heavy/Black/Ultra-Bold (weight 900), compact leading (0.88), very tight kerning (-0.035em)
 * - Modifier Layer: Medium/Semi-Bold (weight 600, 1/3 scale ~32-38px), tight kerning (-0.025em)
 * - Casing: Lowercase dominance for modifiers, Sentence Case for proper nouns, Full Uppercase for milestones
 *
 * Lockups:
 * - Option A (Top-Tucked Modifier): Small phrase rests top-left above first letters of hero
 * - Option B (Bottom-Tucked Modifier): Small phrase rests below base text, flush-left or flush-right
 * - Option C (Inline Word-State): Keyword high contrast, trailing words 45-60% grey opacity
 *
 * Motion & Dynamics:
 * - Word-by-word sync with spoken cadence
 * - Hard Pop-In (0-frame cut) or Subtle Impact Snap (scale 94% -> 100% over 2-3 frames, zero overshoot)
 * - Sequential Layering: Modifier first, then Anchor Slam, dynamic modifier swapping while hero stays anchored
 * - Soft linear vertical gradient (pure white top to 15% darker grey baseline) & subtle dark contrast shadow
 */
export const HierarchicalAsymmetricLockup: React.FC<ArchetypeProps> = ({
  frame,
  fps,
  text,
  words: rawWords,
  color,
  fontFamily: rawFontFamily,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  durationFrames,
  wordEntranceFrames,
  casing,
  fontStyle,
  blendMode,
  isSeeThrough,
}) => {
  const allWords = rawWords && rawWords.length > 0 ? rawWords : text.trim().split(/\s+/);
  const totalWordCount = allWords.length;

  // Clean neo-grotesque / geometric sans & editorial Apple Garamond suite
  const rawHeroFont = rawFontFamily || "Apple Garamond";
  const effectiveHeroFont = `"${rawHeroFont}", "Apple Garamond", "Cormorant Garamond", "Playfair Display", serif`;
  const effectiveModFont = `"Apple Garamond", "Inter", "Montserrat", sans-serif`;

  const heroSize = Math.max(96, Math.min(148, fontSizePx || 120));
  const modifierSize = Math.max(26, Math.round(heroSize * 0.30)); // 3:1 to 4:1 scale ratio

  // Partitioning words into Hero Anchor vs Modifier Context
  // Stopwords / functional connectors that naturally form modifier context
  const modifierStopwords = new Set([
    "the", "a", "an", "up", "in", "on", "at", "to", "for", "of", "with", "by", "from",
    "was", "were", "is", "are", "been", "be", "only", "one", "didn't", "did", "not",
    "it", "its", "that", "this", "these", "those", "have", "has", "had", "we", "you", "they"
  ]);

  let lockupMode: "top_tucked" | "bottom_tucked" | "inline_state" = "top_tucked";
  let heroTokens: string[] = [];
  let modifierTokens: string[] = [];
  let heroWordIndices: number[] = [];
  let modifierWordIndices: number[] = [];

  if (totalWordCount <= 1) {
    heroTokens = allWords;
    heroWordIndices = [0];
    lockupMode = "bottom_tucked";
  } else if (totalWordCount === 2) {
    const w0Clean = allWords[0].replace(/[^\w]/g, "").toLowerCase();
    const w1Clean = allWords[1].replace(/[^\w]/g, "").toLowerCase();
    if (modifierStopwords.has(w0Clean) && !modifierStopwords.has(w1Clean)) {
      // Option A: "the first", "up in" -> modifier top, hero bottom
      modifierTokens = [allWords[0]];
      modifierWordIndices = [0];
      heroTokens = [allWords[1]];
      heroWordIndices = [1];
      lockupMode = "top_tucked";
    } else {
      // Option B: "Mark Dowdle", "From Managing" -> hero top, modifier bottom
      heroTokens = [allWords[0], allWords[1]];
      heroWordIndices = [0, 1];
      lockupMode = "bottom_tucked";
    }
  } else {
    // 3+ words: check whether modifier precedes or follows hero
    const firstWordClean = allWords[0].replace(/[^\w]/g, "").toLowerCase();
    const secondWordClean = allWords[1].replace(/[^\w]/g, "").toLowerCase();
    const lastWordClean = allWords[totalWordCount - 1].replace(/[^\w]/g, "").toLowerCase();

    // Check if leading words are modifiers (e.g. "up in the mountains", "the first winter ascent")
    const leadingModifiers = modifierStopwords.has(firstWordClean) && (totalWordCount <= 3 || modifierStopwords.has(secondWordClean));
    // Check if trailing words are modifiers (e.g. "Mark Dowdle was the only one", "Harvey Lewis didn't make")
    const trailingModifiers = modifierStopwords.has(lastWordClean) || (totalWordCount >= 4 && modifierStopwords.has(allWords[2].replace(/[^\w]/g, "").toLowerCase()));

    // Check for inline metric pattern (e.g. "43-8000 METER PEAKS")
    const hasInlineMetric = allWords.some((w) => /\d/.test(w) || /meter|k|m|mph|sec|km/i.test(w));

    if (hasInlineMetric && totalWordCount <= 4) {
      lockupMode = "inline_state";
      heroTokens = allWords.slice(0, totalWordCount - 1);
      heroWordIndices = heroTokens.map((_, i) => i);
      modifierTokens = [allWords[totalWordCount - 1]];
      modifierWordIndices = [totalWordCount - 1];
    } else if (leadingModifiers) {
      lockupMode = "top_tucked";
      // Split: leading modifier words, trailing hero words
      let splitIdx = 1;
      while (splitIdx < totalWordCount - 1 && modifierStopwords.has(allWords[splitIdx].replace(/[^\w]/g, "").toLowerCase())) {
        splitIdx++;
      }
      modifierTokens = allWords.slice(0, splitIdx);
      modifierWordIndices = modifierTokens.map((_, i) => i);
      heroTokens = allWords.slice(splitIdx);
      heroWordIndices = heroTokens.map((_, i) => splitIdx + i);
    } else if (trailingModifiers) {
      lockupMode = "bottom_tucked";
      // Split: leading hero words, trailing modifier words
      let splitIdx = Math.min(2, Math.max(1, totalWordCount - 2));
      while (splitIdx < totalWordCount && !modifierStopwords.has(allWords[splitIdx].replace(/[^\w]/g, "").toLowerCase())) {
        splitIdx++;
      }
      heroTokens = allWords.slice(0, splitIdx);
      heroWordIndices = heroTokens.map((_, i) => i);
      modifierTokens = allWords.slice(splitIdx);
      modifierWordIndices = modifierTokens.map((_, i) => splitIdx + i);
    } else {
      // Default: Top-Tucked Lockup Option A
      lockupMode = "top_tucked";
      modifierTokens = allWords.slice(0, 1);
      modifierWordIndices = [0];
      heroTokens = allWords.slice(1);
      heroWordIndices = heroTokens.map((_, i) => i + 1);
    }
  }

  // Format token casing according to editorial design specs:
  // - Flowing modifier text: Lowercase dominance for stopwords, title-cased proper nouns
  // - High-impact hero: Elegant calligraphic Title Case (Apple Garamond Bold Italic)
  const formatModifierText = (tok: string): string => {
    if (!tok) return "";
    const clean = tok.toLowerCase().replace(/[^\w]/g, "");
    if (modifierStopwords.has(clean)) {
      return tok.toLowerCase();
    }
    return tok.charAt(0).toUpperCase() + tok.substring(1).toLowerCase();
  };

  const formatHeroText = (tok: string): string => {
    if (!tok) return "";
    if (/^[A-Z0-9]{1,3}$/.test(tok) && ["K2", "USA", "UK", "NYC", "LA", "DNA", "VIP", "AI"].includes(tok)) {
      return tok;
    }
    return tok.replace(/[A-Za-z]+('[A-Za-z]+)?/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
    });
  };

  const getFlicker = (elapsedFrames: number) => {
    if (elapsedFrames === 0) return { brightness: 1.28, opacity: 0.92 };
    if (elapsedFrames === 1) return { brightness: 0.88, opacity: 0.86 };
    if (elapsedFrames === 2) return { brightness: 1.12, opacity: 0.98 };
    return { brightness: 1.0, opacity: 1.0 };
  };

  // Difference-Mode Inversion (Dynamic Knockout Typography):
  const isDifference = Boolean(
    blendMode === "difference" ||
    blendMode === "exclusion" ||
    isSeeThrough
  );

  // Dynamic 5-Archetype Animation Mode:
  // Mode 1: "spatial_push_spring" (Apple-style spatial push with shared momentum handoff & damped spring physics)
  // Mode 2: "blue_lantern_magnetic" (inward letter-by-letter compression + 90° vertical directional deblur)
  // Mode 3: "cinematic_slide_up" (weighted 36px upward rise + 90° vertical directional deblur)
  // Mode 4: "docking_modifier" (hero anchor static, modifier smoothly docks into tuck)
  // Mode 5: "kinetic_impact_snap" (crisp subtle kinetic impact snap)
  const animMode: "spatial_push_spring" | "blue_lantern_magnetic" | "cinematic_slide_up" | "docking_modifier" | "kinetic_impact_snap" =
    totalWordCount % 5 === 0
      ? "spatial_push_spring"
      : totalWordCount % 5 === 1
      ? "blue_lantern_magnetic"
      : totalWordCount % 5 === 2
      ? "cinematic_slide_up"
      : totalWordCount % 5 === 3
      ? "docking_modifier"
      : "kinetic_impact_snap";

  // Render individual word with the chosen kinetic animation archetype
  const renderWordSpan = (
    tok: string,
    globalIdx: number,
    fontSize: number,
    weight: number,
    letterSpacing: string,
    isHeroWord: boolean,
    isTrailingFaded: boolean = false
  ) => {
    const startF = wordEntranceFrames && wordEntranceFrames.length > globalIdx
      ? wordEntranceFrames[globalIdx]
      : Math.round(globalIdx * (fps / Math.max(totalWordCount, 1)));

    const isVisible = frame >= startF;
    if (!isVisible) {
      return (
        <span
          key={`word-${globalIdx}`}
          style={{ opacity: 0, pointerEvents: "none", display: "inline-block", marginRight: "0.22em" }}
        >
          {tok}
        </span>
      );
    }

    const elapsed = frame - startF;
    const flicker = getFlicker(elapsed);
    const filterId = `aa-vblur-${isHeroWord ? "h" : "m"}-${globalIdx}`;
    const heroGradient = "linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 28%, #E0E0E0 68%, #BEBEBE 100%)";

    if (isHeroWord) {
      if (animMode === "spatial_push_spring") {
        const nextStartF = wordEntranceFrames && wordEntranceFrames.length > globalIdx + 1
          ? wordEntranceFrames[globalIdx + 1]
          : Math.round((globalIdx + 1) * (fps / Math.max(totalWordCount, 1)));

        // Damped spring physics: k ≈ 340, m ≈ 0.9, zeta ≈ 0.75
        const springCfg = { damping: 26, mass: 0.9, stiffness: 340 };
        const entryP = spring({ frame: elapsed, fps, config: springCfg });

        // Velocity front-loading (70% in first 3 frames) & 4% inertial overshoot:
        const entryY = interpolate(entryP, [0, 1], [36, 0]);
        const isPunch = globalIdx === totalWordCount - 1 || tok.length > 4;
        const entryScale = interpolate(entryP, [0, 0.65, 1], [0.95, isPunch ? 1.06 : 1.04, isPunch ? 1.03 : 1.0]);
        const entryBlurY = interpolate(entryP, [0, 1], [28, 0]);
        const entryBlurX = interpolate(entryP, [0, 1], [1.2, 0]);

        // Shared Momentum Handoff: Incoming text acts as physical piston pushing outgoing text
        const isPushedOut = globalIdx < totalWordCount - 1 && frame >= nextStartF;
        const exitElapsed = isPushedOut ? frame - nextStartF : -1;
        const exitP = isPushedOut ? spring({ frame: exitElapsed, fps, config: springCfg }) : 0;
        const exitY = isPushedOut ? interpolate(exitP, [0, 1], [0, -36]) : 0;
        const exitScale = isPushedOut ? interpolate(exitP, [0, 1], [isPunch ? 1.03 : 1.0, 0.96]) : 1.0;
        const exitOpacity = isPushedOut ? interpolate(exitP, [0, 0.65, 1], [1.0, 0.35, 0.0]) : 1.0;
        const exitBlurY = isPushedOut ? interpolate(exitP, [0, 1], [0, 24]) : 0;
        const exitBlurX = isPushedOut ? interpolate(exitP, [0, 1], [0, 1.0]) : 0;

        if (isPushedOut && exitElapsed > 9) {
          return null;
        }

        const translateY = entryY + exitY;
        const scale = isPushedOut ? exitScale : entryScale;
        const wordOpacity = isPushedOut ? exitOpacity : flicker.opacity;
        const blurY = isPushedOut ? exitBlurY : entryBlurY;
        const blurX = isPushedOut ? exitBlurX : entryBlurX;
        const hasBlur = blurY > 0.2;

        const filterStyle = [
          hasBlur ? `url(#${filterId})` : "",
          flicker.brightness !== 1.0 && !isPushedOut ? `brightness(${flicker.brightness})` : "",
        ].filter(Boolean).join(" ") || undefined;

        return (
          <span
            key={`word-${globalIdx}`}
            style={{
              display: "inline-block",
              marginRight: "0.24em",
              transform: `translateY(${translateY.toFixed(2)}px) scale(${scale.toFixed(3)})`,
              transformOrigin: "center baseline",
              filter: filterStyle,
              opacity: wordOpacity,
            }}
          >
            {hasBlur && (
              <svg
                style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none", opacity: 0 }}
                aria-hidden="true"
              >
                <defs>
                  <filter id={filterId} x="-20%" y="-100%" width="140%" height="300%">
                    <feGaussianBlur stdDeviation={`${blurX.toFixed(2)} ${blurY.toFixed(2)}`} />
                  </filter>
                </defs>
              </svg>
            )}
            <span
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                fontStyle: "italic",
                letterSpacing,
                lineHeight: 0.88,
                backgroundImage: isDifference ? "none" : heroGradient,
                WebkitBackgroundClip: isDifference ? "border-box" : "text",
                WebkitTextFillColor: isDifference ? "#FFFFFF" : "transparent",
                color: isDifference ? "#FFFFFF" : undefined,
                mixBlendMode: isDifference ? "difference" : undefined,
                WebkitTextStroke: isDifference ? "1.2px rgba(255, 255, 255, 0.85)" : undefined,
                textShadow: isDifference
                  ? "0 0 1px rgba(0, 0, 0, 0.90), 0 0 8px rgba(255, 255, 255, 0.40)"
                  : undefined,
              }}
            >
              {tok}
            </span>
          </span>
        );
      } else if (animMode === "blue_lantern_magnetic") {
        const easeRise: [number, number, number, number] = [0.16, 1.0, 0.3, 1.0];
        const easeSqueeze: [number, number, number, number] = [0.12, 1.0, 0.22, 1.0];
        const riseFrames = Math.max(1, Math.round(fps * 0.38));
        const squeezeFrames = Math.max(1, Math.round(fps * 0.45));

        const riseP = interpolate(elapsed, [0, riseFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(...easeRise),
        });
        const translateY = interpolate(riseP, [0, 1], [36, 0]);
        const blurY = interpolate(riseP, [0, 1], [32, 0]);
        const blurX = interpolate(riseP, [0, 1], [1.5, 0]);
        const hasBlur = blurY > 0.2;

        const squeezeT = Easing.bezier(...easeSqueeze)(
          interpolate(elapsed, [0, squeezeFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        );

        const charSpans = Array.from(tok).map((char, cIdx) => {
          const charOffset = cIdx - (tok.length - 1) / 2;
          const microStartX = charOffset * 0.12;
          const microEndX = charOffset * -0.02;
          const microX = microStartX + (microEndX - microStartX) * squeezeT;
          return (
            <span
              key={`blm-c-${globalIdx}-${cIdx}`}
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
          hasBlur ? `url(#${filterId})` : "",
          flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : "",
        ].filter(Boolean).join(" ") || undefined;

        return (
          <span
            key={`word-${globalIdx}`}
            style={{
              display: "inline-block",
              marginRight: "0.24em",
              transform: `translateY(${translateY.toFixed(2)}px)`,
              filter: filterStyle,
              opacity: flicker.opacity,
            }}
          >
            {hasBlur && (
              <svg
                style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none", opacity: 0 }}
                aria-hidden="true"
              >
                <defs>
                  <filter id={filterId} x="-20%" y="-100%" width="140%" height="300%">
                    <feGaussianBlur stdDeviation={`${blurX.toFixed(2)} ${blurY.toFixed(2)}`} />
                  </filter>
                </defs>
              </svg>
            )}
            <span
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                fontStyle: "italic",
                letterSpacing,
                lineHeight: 0.88,
                backgroundImage: isDifference ? "none" : heroGradient,
                WebkitBackgroundClip: isDifference ? "border-box" : "text",
                WebkitTextFillColor: isDifference ? "#FFFFFF" : "transparent",
                color: isDifference ? "#FFFFFF" : undefined,
                mixBlendMode: isDifference ? "difference" : undefined,
                WebkitTextStroke: isDifference ? "1.2px rgba(255, 255, 255, 0.85)" : undefined,
                textShadow: isDifference
                  ? "0 0 1px rgba(0, 0, 0, 0.90), 0 0 8px rgba(255, 255, 255, 0.40)"
                  : undefined,
              }}
            >
              {charSpans}
            </span>
          </span>
        );
      } else if (animMode === "cinematic_slide_up") {
        const riseFrames = Math.max(1, Math.round(fps * 0.38));
        const riseP = interpolate(elapsed, [0, riseFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
        });
        const translateY = interpolate(riseP, [0, 1], [36, 0]);
        const blurY = interpolate(riseP, [0, 1], [32, 0]);
        const blurX = interpolate(riseP, [0, 1], [1.5, 0]);
        const hasBlur = blurY > 0.2;

        const filterStyle = [
          hasBlur ? `url(#${filterId})` : "",
          flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : "",
        ].filter(Boolean).join(" ") || undefined;

        return (
          <span
            key={`word-${globalIdx}`}
            style={{
              display: "inline-block",
              marginRight: "0.24em",
              transform: `translateY(${translateY.toFixed(2)}px)`,
              filter: filterStyle,
              opacity: flicker.opacity,
            }}
          >
            {hasBlur && (
              <svg
                style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none", opacity: 0 }}
                aria-hidden="true"
              >
                <defs>
                  <filter id={filterId} x="-20%" y="-100%" width="140%" height="300%">
                    <feGaussianBlur stdDeviation={`${blurX.toFixed(2)} ${blurY.toFixed(2)}`} />
                  </filter>
                </defs>
              </svg>
            )}
            <span
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                fontStyle: "italic",
                letterSpacing,
                lineHeight: 0.88,
                backgroundImage: isDifference ? "none" : heroGradient,
                WebkitBackgroundClip: isDifference ? "border-box" : "text",
                WebkitTextFillColor: isDifference ? "#FFFFFF" : "transparent",
                color: isDifference ? "#FFFFFF" : undefined,
                mixBlendMode: isDifference ? "difference" : undefined,
                WebkitTextStroke: isDifference ? "1.2px rgba(255, 255, 255, 0.85)" : undefined,
                textShadow: isDifference
                  ? "0 0 1px rgba(0, 0, 0, 0.90), 0 0 8px rgba(255, 255, 255, 0.40)"
                  : undefined,
              }}
            >
              {tok}
            </span>
          </span>
        );
      } else if (animMode === "docking_modifier") {
        const settleFrames = Math.max(1, Math.round(fps * 0.12));
        const settleP = interpolate(elapsed, [0, settleFrames], [0.97, 1.0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <span
            key={`word-${globalIdx}`}
            style={{
              display: "inline-block",
              marginRight: "0.24em",
              transform: `scale(${settleP})`,
              opacity: flicker.opacity,
              filter: flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : undefined,
            }}
          >
            <span
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                fontStyle: "italic",
                letterSpacing,
                lineHeight: 0.88,
                backgroundImage: isDifference ? "none" : heroGradient,
                WebkitBackgroundClip: isDifference ? "border-box" : "text",
                WebkitTextFillColor: isDifference ? "#FFFFFF" : "transparent",
                color: isDifference ? "#FFFFFF" : undefined,
                mixBlendMode: isDifference ? "difference" : undefined,
                WebkitTextStroke: isDifference ? "1.2px rgba(255, 255, 255, 0.85)" : undefined,
                textShadow: isDifference
                  ? "0 0 1px rgba(0, 0, 0, 0.90), 0 0 8px rgba(255, 255, 255, 0.40)"
                  : undefined,
              }}
            >
              {tok}
            </span>
          </span>
        );
      } else {
        const snapProgress = Math.min(1, elapsed / 2.5);
        const scale = 0.96 + 0.04 * snapProgress;
        return (
          <span
            key={`word-${globalIdx}`}
            style={{
              display: "inline-block",
              marginRight: "0.24em",
              transform: `scale(${scale})`,
              transformOrigin: "center baseline",
              opacity: flicker.opacity,
              filter: flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : undefined,
            }}
          >
            <span
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                fontStyle: "italic",
                letterSpacing,
                lineHeight: 0.88,
                backgroundImage: isDifference ? "none" : heroGradient,
                WebkitBackgroundClip: isDifference ? "border-box" : "text",
                WebkitTextFillColor: isDifference ? "#FFFFFF" : "transparent",
                color: isDifference ? "#FFFFFF" : undefined,
                mixBlendMode: isDifference ? "difference" : undefined,
                WebkitTextStroke: isDifference ? "1.2px rgba(255, 255, 255, 0.85)" : undefined,
                textShadow: isDifference
                  ? "0 0 1px rgba(0, 0, 0, 0.90), 0 0 8px rgba(255, 255, 255, 0.40)"
                  : undefined,
              }}
            >
              {tok}
            </span>
          </span>
        );
      }
    }

    // Modifier Word Rendering
    if (animMode === "spatial_push_spring") {
      const nextStartF = wordEntranceFrames && wordEntranceFrames.length > globalIdx + 1
        ? wordEntranceFrames[globalIdx + 1]
        : Math.round((globalIdx + 1) * (fps / Math.max(totalWordCount, 1)));

      const springCfg = { damping: 26, mass: 0.9, stiffness: 340 };
      const entryP = spring({ frame: elapsed, fps, config: springCfg });

      const entryY = interpolate(entryP, [0, 1], lockupMode === "top_tucked" ? [-28, 0] : [28, 0]);
      const entryScale = interpolate(entryP, [0, 0.65, 1], [0.95, 1.03, 1.0]);
      const entryBlurY = interpolate(entryP, [0, 1], [24, 0]);
      const entryBlurX = interpolate(entryP, [0, 1], [1.0, 0]);

      const isPushedOut = globalIdx < totalWordCount - 1 && frame >= nextStartF;
      const exitElapsed = isPushedOut ? frame - nextStartF : -1;
      const exitP = isPushedOut ? spring({ frame: exitElapsed, fps, config: springCfg }) : 0;
      const exitY = isPushedOut ? interpolate(exitP, [0, 1], [0, lockupMode === "top_tucked" ? 28 : -28]) : 0;
      const exitScale = isPushedOut ? interpolate(exitP, [0, 1], [1.0, 0.96]) : 1.0;
      const exitOpacity = isPushedOut ? interpolate(exitP, [0, 0.65, 1], [1.0, 0.35, 0.0]) : 1.0;

      if (isPushedOut && exitElapsed > 9) {
        return null;
      }

      const translateY = entryY + exitY;
      const scale = isPushedOut ? exitScale : entryScale;
      const wordOpacity = isPushedOut ? exitOpacity : flicker.opacity;
      const blurY = isPushedOut ? interpolate(exitP, [0, 1], [0, 20]) : entryBlurY;
      const blurX = isPushedOut ? interpolate(exitP, [0, 1], [0, 0.8]) : entryBlurX;
      const hasBlur = blurY > 0.2;

      const filterStyle = [
        hasBlur ? `url(#${filterId})` : "",
        flicker.brightness !== 1.0 && !isPushedOut ? `brightness(${flicker.brightness})` : "",
      ].filter(Boolean).join(" ") || undefined;

      return (
        <span
          key={`word-${globalIdx}`}
          style={{
            display: "inline-block",
            marginRight: "0.22em",
            transform: `translateY(${translateY.toFixed(2)}px) scale(${scale.toFixed(3)})`,
            transformOrigin: "center baseline",
            filter: filterStyle,
            opacity: wordOpacity,
          }}
        >
          {hasBlur && (
            <svg
              style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none", opacity: 0 }}
              aria-hidden="true"
            >
              <defs>
                <filter id={filterId} x="-20%" y="-100%" width="140%" height="300%">
                  <feGaussianBlur stdDeviation={`${blurX.toFixed(2)} ${blurY.toFixed(2)}`} />
                </filter>
              </defs>
            </svg>
          )}
          <span
            style={{
              display: "inline-block",
              fontSize: `${fontSize}px`,
              fontWeight: 300,
              fontStyle: "italic",
              letterSpacing,
              lineHeight: 1.0,
              color: isDifference ? "#FFFFFF" : (isTrailingFaded ? "rgba(255, 255, 255, 0.48)" : (color || "#F2F2F2")),
              WebkitTextFillColor: isDifference ? "#FFFFFF" : (isTrailingFaded ? "rgba(255, 255, 255, 0.48)" : (color || "#F2F2F2")),
              mixBlendMode: isDifference ? "difference" : undefined,
              WebkitTextStroke: isDifference ? "0.8px rgba(255, 255, 255, 0.70)" : undefined,
              textShadow: isDifference
                ? "0 0 1px rgba(0, 0, 0, 0.85), 0 0 6px rgba(255, 255, 255, 0.30)"
                : "0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.90)",
            }}
          >
            {tok}
          </span>
        </span>
      );
    } else if (animMode === "docking_modifier") {
      const dockFrames = Math.max(1, Math.round(fps * 0.38));
      const dockP = interpolate(elapsed, [0, dockFrames], [0, 1], {
        easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const translateY = interpolate(dockP, [0, 1], lockupMode === "top_tucked" ? [-28, 0] : [28, 0]);
      const blurY = interpolate(dockP, [0, 1], [24, 0]);
      const blurX = interpolate(dockP, [0, 1], [1.2, 0]);
      const hasBlur = blurY > 0.2;

      const filterStyle = [
        hasBlur ? `url(#${filterId})` : "",
        flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : "",
      ].filter(Boolean).join(" ") || undefined;

      return (
        <span
          key={`word-${globalIdx}`}
          style={{
            display: "inline-block",
            marginRight: "0.22em",
            transform: `translateY(${translateY.toFixed(2)}px)`,
            filter: filterStyle,
            opacity: flicker.opacity,
          }}
        >
          {hasBlur && (
            <svg
              style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none", opacity: 0 }}
              aria-hidden="true"
            >
              <defs>
                <filter id={filterId} x="-20%" y="-100%" width="140%" height="300%">
                  <feGaussianBlur stdDeviation={`${blurX.toFixed(2)} ${blurY.toFixed(2)}`} />
                </filter>
              </defs>
            </svg>
          )}
          <span
            style={{
              display: "inline-block",
              fontSize: `${fontSize}px`,
              fontWeight: 300,
              fontStyle: "italic",
              letterSpacing,
              lineHeight: 1.0,
              color: isDifference ? "#FFFFFF" : (isTrailingFaded ? "rgba(255, 255, 255, 0.48)" : (color || "#F2F2F2")),
              WebkitTextFillColor: isDifference ? "#FFFFFF" : (isTrailingFaded ? "rgba(255, 255, 255, 0.48)" : (color || "#F2F2F2")),
              mixBlendMode: isDifference ? "difference" : undefined,
              WebkitTextStroke: isDifference ? "0.8px rgba(255, 255, 255, 0.70)" : undefined,
              textShadow: isDifference
                ? "0 0 1px rgba(0, 0, 0, 0.85), 0 0 6px rgba(255, 255, 255, 0.30)"
                : "0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.90)",
            }}
          >
            {tok}
          </span>
        </span>
      );
    } else if (animMode === "kinetic_impact_snap") {
      const snapProgress = Math.min(1, elapsed / 2.5);
      const scale = 0.96 + 0.04 * snapProgress;
      return (
        <span
          key={`word-${globalIdx}`}
          style={{
            display: "inline-block",
            marginRight: "0.22em",
            transform: `scale(${scale})`,
            transformOrigin: "center baseline",
            opacity: flicker.opacity,
            filter: flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : undefined,
          }}
        >
          <span
            style={{
              display: "inline-block",
              fontSize: `${fontSize}px`,
              fontWeight: 300,
              fontStyle: "italic",
              letterSpacing,
              lineHeight: 1.0,
              color: isDifference ? "#FFFFFF" : (isTrailingFaded ? "rgba(255, 255, 255, 0.48)" : (color || "#F2F2F2")),
              WebkitTextFillColor: isDifference ? "#FFFFFF" : (isTrailingFaded ? "rgba(255, 255, 255, 0.48)" : (color || "#F2F2F2")),
              mixBlendMode: isDifference ? "difference" : undefined,
              WebkitTextStroke: isDifference ? "0.8px rgba(255, 255, 255, 0.70)" : undefined,
              textShadow: isDifference
                ? "0 0 1px rgba(0, 0, 0, 0.85), 0 0 6px rgba(255, 255, 255, 0.30)"
                : "0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.90)",
            }}
          >
            {tok}
          </span>
        </span>
      );
    } else {
      const slideFrames = Math.max(1, Math.round(fps * 0.38));
      const slideP = interpolate(elapsed, [0, slideFrames], [0, 1], {
        easing: Easing.bezier(0.16, 1.0, 0.3, 1.0),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const translateY = interpolate(slideP, [0, 1], [36, 0]);
      const blurY = interpolate(slideP, [0, 1], [24, 0]);
      const blurX = interpolate(slideP, [0, 1], [1.2, 0]);
      const hasBlur = blurY > 0.2;

      const filterStyle = [
        hasBlur ? `url(#${filterId})` : "",
        flicker.brightness !== 1.0 ? `brightness(${flicker.brightness})` : "",
      ].filter(Boolean).join(" ") || undefined;

      return (
        <span
          key={`word-${globalIdx}`}
          style={{
            display: "inline-block",
            marginRight: "0.22em",
            transform: `translateY(${translateY.toFixed(2)}px)`,
            filter: filterStyle,
            opacity: flicker.opacity,
          }}
        >
          {hasBlur && (
            <svg
              style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none", opacity: 0 }}
              aria-hidden="true"
            >
              <defs>
                <filter id={filterId} x="-20%" y="-100%" width="140%" height="300%">
                  <feGaussianBlur stdDeviation={`${blurX.toFixed(2)} ${blurY.toFixed(2)}`} />
                </filter>
              </defs>
            </svg>
          )}
          <span
            style={{
              display: "inline-block",
              fontSize: `${fontSize}px`,
              fontWeight: 300,
              fontStyle: "italic",
              letterSpacing,
              lineHeight: 1.0,
              color: isDifference ? "#FFFFFF" : (isTrailingFaded ? "rgba(255, 255, 255, 0.48)" : (color || "#F2F2F2")),
              WebkitTextFillColor: isDifference ? "#FFFFFF" : (isTrailingFaded ? "rgba(255, 255, 255, 0.48)" : (color || "#F2F2F2")),
              mixBlendMode: isDifference ? "difference" : undefined,
              WebkitTextStroke: isDifference ? "0.8px rgba(255, 255, 255, 0.70)" : undefined,
              textShadow: isDifference
                ? "0 0 1px rgba(0, 0, 0, 0.85), 0 0 6px rgba(255, 255, 255, 0.30)"
                : "0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.90)",
            }}
          >
            {tok}
          </span>
        </span>
      );
    }
  };

  // Option C: Inline Word-State (Same line, keyword high contrast, trailing words 45-60% grey)
  if (lockupMode === "inline_state") {
    return (
      <div
        style={{
          display: "inline-flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "flex-start",
          fontFamily: effectiveHeroFont,
          fontStyle: "italic",
          filter: isDifference
            ? undefined
            : "drop-shadow(0 0 24px rgba(255, 255, 255, 0.45)) drop-shadow(0 0 45px rgba(255, 255, 255, 0.18)) drop-shadow(0 4px 18px rgba(0, 0, 0, 0.95)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.90))",
          pointerEvents: "none",
        }}
      >
        {heroTokens.map((tok, i) =>
          renderWordSpan(formatHeroText(tok), heroWordIndices[i], heroSize, 700, `${letterSpacingEm || -0.035}em`, true)
        )}
        {modifierTokens.map((tok, i) =>
          renderWordSpan(formatModifierText(tok), modifierWordIndices[i], Math.round(heroSize * 0.85), 300, "-0.02em", false, true)
        )}
      </div>
    );
  }

  // Two-Tier Asymmetric Grid Block
  // Option A: Top-Tucked Modifier (modifier sits on upper-left resting above first letters of hero)
  // Option B: Bottom-Tucked Modifier (modifier sits below base text, flush-left or flush-right)
  const isBottomTucked = lockupMode === "bottom_tucked";

  const modifierBlock = modifierTokens.length > 0 && (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        alignSelf: "flex-start", // Asymmetric flush-left lockup
        fontFamily: effectiveModFont,
        fontStyle: "italic",
        fontSize: `${modifierSize}px`,
        fontWeight: 300,
        letterSpacing: "-0.025em",
        lineHeight: 1.0,
        color: isDifference ? "#FFFFFF" : "#F2F2F2",
        marginBottom: isBottomTucked ? 0 : "0.15em",
        marginTop: isBottomTucked ? "0.18em" : 0,
        paddingLeft: "0.08em",
        textShadow: isDifference ? undefined : "0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.90)",
      }}
    >
      {modifierTokens.map((tok, i) =>
        renderWordSpan(formatModifierText(tok), modifierWordIndices[i], modifierSize, 300, "-0.025em", false)
      )}
    </div>
  );

  const heroBlock = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        alignSelf: "flex-start",
        fontFamily: effectiveHeroFont,
        fontStyle: "italic",
        fontSize: `${heroSize}px`,
        fontWeight: 700,
        letterSpacing: `${letterSpacingEm || -0.035}em`,
        lineHeight: 0.88, // Compact leading tucking tightly against modifier
        filter: isDifference
          ? undefined
          : "drop-shadow(0 0 24px rgba(255, 255, 255, 0.45)) drop-shadow(0 0 45px rgba(255, 255, 255, 0.18)) drop-shadow(0 6px 24px rgba(0, 0, 0, 0.95)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.90))",
      }}
    >
      {heroTokens.map((tok, i) =>
        renderWordSpan(formatHeroText(tok), heroWordIndices[i], heroSize, 700, `${letterSpacingEm || -0.035}em`, true)
      )}
    </div>
  );

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start", // Lockup Option A & B tight asymmetric left-aligned anchor
        justifyContent: "center",
        maxWidth: "920px",
        padding: 0,
        pointerEvents: "none",
      }}
    >
      {!isBottomTucked && modifierBlock}
      {heroBlock}
      {isBottomTucked && modifierBlock}
    </div>
  );
};

/**
 * 23. SPATIAL PUSH SPRING TYPOGRAPHY
 * Apple-style spatial push kinetic typography where the core mechanism is a
 * shared momentum handoff governed by damped spring physics (k ≈ 340, m ≈ 0.9, zeta ≈ 0.75).
 * Incoming text acts as a physical piston displacing outgoing text (+36px -> 0 entry, 0 -> -36px exit)
 * with 4% inertial overshoot and velocity front-loading.
 */
export const SpatialPushSpringTypography: React.FC<ArchetypeProps> = ({
  frame,
  fps,
  text,
  words: rawWords,
  color,
  fontFamily,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  durationFrames,
  wordEntranceFrames,
  casing,
  fontStyle,
  blendMode,
  isSeeThrough,
}) => {
  const allWords = rawWords && rawWords.length > 0 ? rawWords : text.trim().split(/\s+/);
  const totalCount = allWords.length;
  const effectiveFont = fontFamily ? `"${fontFamily}", "Apple Garamond", serif` : '"Apple Garamond", serif';
  const size = fontSizePx || 108;
  const isDifference = Boolean(blendMode === "difference" || blendMode === "exclusion" || isSeeThrough);

  const springCfg = { damping: 26, mass: 0.9, stiffness: 340 };

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        justifyContent: "center",
        maxWidth: "960px",
        fontFamily: effectiveFont,
        fontStyle: (fontStyle as any) || "italic",
        pointerEvents: "none",
      }}
    >
      {allWords.map((word, idx) => {
        const startF = wordEntranceFrames && wordEntranceFrames.length > idx
          ? wordEntranceFrames[idx]
          : Math.round(idx * (fps / Math.max(totalCount, 1)));

        const nextStartF = wordEntranceFrames && wordEntranceFrames.length > idx + 1
          ? wordEntranceFrames[idx + 1]
          : Math.round((idx + 1) * (fps / Math.max(totalCount, 1)));

        if (frame < startF) {
          return (
            <span
              key={`sps-w-${idx}`}
              style={{ opacity: 0, pointerEvents: "none", display: "inline-block", marginRight: "0.24em" }}
            >
              {word}
            </span>
          );
        }

        const elapsed = frame - startF;
        const entryP = spring({ frame: elapsed, fps, config: springCfg });
        const entryY = interpolate(entryP, [0, 1], [36, 0]);
        const isPunch = idx === totalCount - 1 || word.length > 4;
        const entryScale = interpolate(entryP, [0, 0.65, 1], [0.95, isPunch ? 1.06 : 1.04, isPunch ? 1.03 : 1.0]);
        const entryBlurY = interpolate(entryP, [0, 1], [28, 0]);
        const entryBlurX = interpolate(entryP, [0, 1], [1.2, 0]);

        // Shared Momentum Handoff
        const isPushedOut = idx < totalCount - 1 && frame >= nextStartF;
        const exitElapsed = isPushedOut ? frame - nextStartF : -1;
        const exitP = isPushedOut ? spring({ frame: exitElapsed, fps, config: springCfg }) : 0;
        const exitY = isPushedOut ? interpolate(exitP, [0, 1], [0, -36]) : 0;
        const exitScale = isPushedOut ? interpolate(exitP, [0, 1], [isPunch ? 1.03 : 1.0, 0.96]) : 1.0;
        const exitOpacity = isPushedOut ? interpolate(exitP, [0, 0.65, 1], [1.0, 0.35, 0.0]) : 1.0;
        const exitBlurY = isPushedOut ? interpolate(exitP, [0, 1], [0, 24]) : 0;
        const exitBlurX = isPushedOut ? interpolate(exitP, [0, 1], [0, 1.0]) : 0;

        if (isPushedOut && exitElapsed > 9) {
          return null;
        }

        const translateY = entryY + exitY;
        const scale = isPushedOut ? exitScale : entryScale;
        const wordOpacity = isPushedOut ? exitOpacity : 1.0;
        const blurY = isPushedOut ? exitBlurY : entryBlurY;
        const blurX = isPushedOut ? exitBlurX : entryBlurX;
        const hasBlur = blurY > 0.2;
        const filterId = `sps-vblur-${idx}`;

        return (
          <span
            key={`sps-w-${idx}`}
            style={{
              display: "inline-block",
              marginRight: "0.24em",
              transform: `translateY(${translateY.toFixed(2)}px) scale(${scale.toFixed(3)})`,
              transformOrigin: "center baseline",
              opacity: wordOpacity,
              filter: hasBlur ? `url(#${filterId})` : undefined,
            }}
          >
            {hasBlur && (
              <svg
                style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none", opacity: 0 }}
                aria-hidden="true"
              >
                <defs>
                  <filter id={filterId} x="-20%" y="-100%" width="140%" height="300%">
                    <feGaussianBlur stdDeviation={`${blurX.toFixed(2)} ${blurY.toFixed(2)}`} />
                  </filter>
                </defs>
              </svg>
            )}
            <span
              style={{
                display: "inline-block",
                fontSize: `${size}px`,
                fontWeight: fontWeight || 700,
                letterSpacing: `${letterSpacingEm || -0.035}em`,
                lineHeight: 0.92,
                backgroundImage: isDifference ? "none" : "linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 28%, #E0E0E0 68%, #BEBEBE 100%)",
                WebkitBackgroundClip: isDifference ? "border-box" : "text",
                WebkitTextFillColor: isDifference ? "#FFFFFF" : "transparent",
                color: isDifference ? "#FFFFFF" : (color || "#FFFFFF"),
                mixBlendMode: isDifference ? "difference" : undefined,
                WebkitTextStroke: isDifference ? "1.2px rgba(255, 255, 255, 0.85)" : undefined,
                textShadow: isDifference
                  ? "0 0 1px rgba(0, 0, 0, 0.90), 0 0 8px rgba(255, 255, 255, 0.40)"
                  : "0 4px 20px rgba(0,0,0,0.95), 0 0 24px rgba(255,255,255,0.25)",
              }}
            >
              {word}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/**
 * 24. DIFFERENCE KNOCKOUT TYPOGRAPHY
 * Cinematic See-Through / Difference-Mode Inversion typography.
 * Inverts underlying visual footage pixels (|255 - BG|) using mixBlendMode: "difference"
 * with razor-thin 1.2px semi-opaque boundary stroke ensuring 100% legibility across 50% luminance midtones,
 * and subtle frosted glass backdrop refraction.
 */
export const DifferenceKnockoutTypography: React.FC<ArchetypeProps> = ({
  frame,
  fps,
  text,
  words: rawWords,
  fontFamily,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  wordEntranceFrames,
  casing,
  fontStyle,
}) => {
  const allWords = rawWords && rawWords.length > 0 ? rawWords : text.trim().split(/\s+/);
  const totalCount = allWords.length;
  const effectiveFont = fontFamily ? `"${fontFamily}", "Apple Garamond", serif` : '"Apple Garamond", serif';
  const size = fontSizePx || 116;

  // Spring entrance for high-impact knockout arrival
  const springCfg = { damping: 26, mass: 0.9, stiffness: 340 };

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        justifyContent: "center",
        maxWidth: "960px",
        padding: 0,
        fontFamily: effectiveFont,
        fontStyle: (fontStyle as any) || "italic",
        pointerEvents: "none",
      }}
    >
      {allWords.map((word, idx) => {
        const startF = wordEntranceFrames && wordEntranceFrames.length > idx
          ? wordEntranceFrames[idx]
          : Math.round(idx * (fps / Math.max(totalCount, 1)));

        if (frame < startF) {
          return (
            <span
              key={`dkt-w-${idx}`}
              style={{ opacity: 0, pointerEvents: "none", display: "inline-block", marginRight: "0.24em" }}
            >
              {word}
            </span>
          );
        }

        const elapsed = frame - startF;
        const p = spring({ frame: elapsed, fps, config: springCfg });
        const translateY = interpolate(p, [0, 1], [32, 0]);
        const scale = interpolate(p, [0, 0.7, 1], [0.94, 1.04, 1.0]);
        const opacity = interpolate(p, [0, 0.4, 1], [0, 0.9, 1.0]);

        return (
          <span
            key={`dkt-w-${idx}`}
            style={{
              display: "inline-block",
              marginRight: "0.24em",
              transform: `translateY(${translateY.toFixed(2)}px) scale(${scale.toFixed(3)})`,
              transformOrigin: "center baseline",
              opacity,
            }}
          >
            <span
              style={{
                display: "inline-block",
                fontSize: `${size}px`,
                fontWeight: fontWeight || 800,
                letterSpacing: `${letterSpacingEm || -0.035}em`,
                lineHeight: 0.9,
                color: "#FFFFFF",
                WebkitTextFillColor: "#FFFFFF",
                mixBlendMode: "difference",
                WebkitTextStroke: "1.2px rgba(255, 255, 255, 0.85)",
                textShadow: "0 0 1px rgba(0, 0, 0, 0.90), 0 0 8px rgba(255, 255, 255, 0.40)",
              }}
            >
              {word}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/**
 * 24. CHISELED PRISM BEVEL & SPLIT METALLIC GRADIENT (SPECIAL OPS)
 * Hard-edge bevel + two-tone split specular horizon split at 48%-50% baseline.
 * Upper half reflects direct overhead light (#FFFFFF to bright specular);
 * Lower half drops into deep shadowed ambient metal (#334155 / #1E293B).
 * Inset ridge chamfer + high-contrast dark barrier stroke guaranteeing WCAG readability.
 */
export const ChiseledPrismMetallic: React.FC<ArchetypeProps> = ({
  frame,
  fps,
  text,
  words: rawWords,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  blendMode,
  isSeeThrough,
  wordEntranceFrames,
}) => {
  const allWords = rawWords && rawWords.length > 0 ? rawWords : text.trim().split(/\s+/);
  const totalCount = allWords.length;
  const size = fontSizePx || 124;
  const effectiveFont = fontFamily ? `"${fontFamily}", "Montserrat", "Bebas Neue", sans-serif` : '"Montserrat", "Bebas Neue", sans-serif';
  const isDifference = Boolean(blendMode === "difference" || blendMode === "exclusion" || isSeeThrough);

  const springCfg = { damping: 24, mass: 1.2, stiffness: 280 };

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        justifyContent: "center",
        maxWidth: "960px",
        fontFamily: effectiveFont,
        fontStyle: (fontStyle as any) || "normal",
        pointerEvents: "none",
      }}
    >
      {allWords.map((word, idx) => {
        const startF = wordEntranceFrames && wordEntranceFrames.length > idx
          ? wordEntranceFrames[idx]
          : Math.round(idx * (fps / Math.max(totalCount, 1)));

        if (frame < startF) {
          return (
            <span
              key={`cpm-w-${idx}`}
              style={{ opacity: 0, pointerEvents: "none", display: "inline-block", marginRight: "0.22em" }}
            >
              {word.toUpperCase()}
            </span>
          );
        }

        const elapsed = frame - startF;
        const p = spring({ frame: elapsed, fps, config: springCfg });
        const scale = interpolate(p, [0, 0.6, 1], [1.14, 0.97, 1.0]);
        const opacity = interpolate(p, [0, 0.3, 1], [0, 0.95, 1.0]);

        return (
          <span
            key={`cpm-w-${idx}`}
            style={{
              display: "inline-block",
              marginRight: "0.22em",
              transform: `scale(${scale.toFixed(3)})`,
              transformOrigin: "center baseline",
              opacity,
            }}
          >
            <span
              style={{
                position: "relative",
                display: "inline-block",
                fontSize: `${size}px`,
                fontWeight: Math.max(700, fontWeight || 900),
                letterSpacing: `${letterSpacingEm || -0.035}em`,
                lineHeight: 0.90,
                textTransform: "uppercase",
                backgroundImage: isDifference
                  ? "none"
                  : "linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 47%, #334155 49%, #1E293B 100%)",
                WebkitBackgroundClip: isDifference ? "border-box" : "text",
                WebkitTextFillColor: isDifference ? "#FFFFFF" : "transparent",
                color: isDifference ? "#FFFFFF" : undefined,
                mixBlendMode: isDifference ? "difference" : undefined,
                WebkitTextStroke: isDifference ? "1.2px rgba(255,255,255,0.85)" : "2.5px rgba(0, 0, 0, 0.95)",
                textShadow: isDifference
                  ? "0 0 1px rgba(0, 0, 0, 0.90), 0 0 8px rgba(255, 255, 255, 0.40)"
                  : "0 1px 0 #CBD5E1, 0 -1px 0 #0F172A, 0 8px 24px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.90)",
                filter: isDifference ? undefined : "drop-shadow(0 4px 16px rgba(0,0,0,0.85))",
              }}
            >
              {word.toUpperCase()}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/**
 * 25. VJKT (VIDEO JOCKEY KINETIC TYPOGRAPHY - SPECIAL OPS)
 * Electronic, concert & glitch high-energy kinetic typography.
 * 1. Stroboscopic luminance modulation (multi-frame micro-flashes locked to beat transients).
 * 2. RGB chromatic aberration split (-2px 0 #FF0055, 2px 0 #00FFFF).
 * 3. CRT scanline & raster displacement.
 * 4. Sub-frame beat snap within 2-4 frames.
 */
export const VJKineticTypography: React.FC<ArchetypeProps> = ({
  frame,
  fps,
  text,
  words: rawWords,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  blendMode,
  isSeeThrough,
  wordEntranceFrames,
}) => {
  const allWords = rawWords && rawWords.length > 0 ? rawWords : text.trim().split(/\s+/);
  const totalCount = allWords.length;
  const size = fontSizePx || 118;
  const effectiveFont = fontFamily ? `"${fontFamily}", "Inter", "Teko", sans-serif` : '"Inter", "Teko", sans-serif';
  const isDifference = Boolean(blendMode === "difference" || blendMode === "exclusion" || isSeeThrough);

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        justifyContent: "center",
        maxWidth: "960px",
        fontFamily: effectiveFont,
        fontStyle: (fontStyle as any) || "normal",
        pointerEvents: "none",
      }}
    >
      {allWords.map((word, idx) => {
        const startF = wordEntranceFrames && wordEntranceFrames.length > idx
          ? wordEntranceFrames[idx]
          : Math.round(idx * (fps / Math.max(totalCount, 1)));

        if (frame < startF) {
          return (
            <span
              key={`vjkt-w-${idx}`}
              style={{ opacity: 0, pointerEvents: "none", display: "inline-block", marginRight: "0.20em" }}
            >
              {word.toUpperCase()}
            </span>
          );
        }

        const elapsed = frame - startF;
        const snapP = Math.min(1.0, elapsed / 3.0);
        const scale = interpolate(snapP, [0, 0.4, 1], [1.22, 0.96, 1.0]);
        const isStrobeInvert = elapsed < 6 && elapsed % 2 === 1;
        const chromaOffset = interpolate(elapsed, [0, 4, 12], [3.2, 1.5, 0.4], { extrapolateRight: "clamp" });
        const glitchX = elapsed < 4 && elapsed % 2 === 1 ? (Math.sin(elapsed * 17) * 2.5) : 0;

        return (
          <span
            key={`vjkt-w-${idx}`}
            style={{
              display: "inline-block",
              marginRight: "0.20em",
              transform: `translate(${glitchX.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`,
              transformOrigin: "center baseline",
            }}
          >
            <span
              style={{
                display: "inline-block",
                fontSize: `${size}px`,
                fontWeight: Math.max(700, fontWeight || 900),
                letterSpacing: `${letterSpacingEm || -0.02}em`,
                lineHeight: 0.90,
                textTransform: "uppercase",
                color: isStrobeInvert ? "#000000" : "#FFFFFF",
                WebkitTextFillColor: isStrobeInvert ? "#000000" : "#FFFFFF",
                backgroundColor: isStrobeInvert ? "#FFFFFF" : "transparent",
                mixBlendMode: isDifference ? "difference" : undefined,
                WebkitTextStroke: isDifference
                  ? "1.0px rgba(255,255,255,0.85)"
                  : (isStrobeInvert ? "1.5px #FFFFFF" : "1.5px rgba(0, 0, 0, 0.95)"),
                textShadow: isDifference
                  ? "0 0 1px rgba(0, 0, 0, 0.90), 0 0 8px rgba(255, 255, 255, 0.40)"
                  : `-${chromaOffset.toFixed(1)}px 0 0 rgba(255, 0, 85, 0.85), ${chromaOffset.toFixed(1)}px 0 0 rgba(0, 240, 255, 0.85), 0 2px 12px rgba(0, 0, 0, 0.95)`,
              }}
            >
              {word.toUpperCase()}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/**
 * 23. REAL ESTATE CAPTIONS (Patrik Key Style 01)
 * High-end architectural typography with warm champagne/gold power-word gradient mask
 * and smooth adjustment curve easing.
 */
export const RealEstateLuxuryCurve: React.FC<ArchetypeProps> = ({
  frame,
  words,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
}) => {
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");
  const p = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
  });
  const translateY = interpolate(p, [0, 1], [14, 0]);
  const opacity = interpolate(p, [0, 0.4, 1], [0, 0.8, 1]);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 700,
        textTransform: transform,
        letterSpacing: `${letterSpacingEm || 0.02}em`,
        transform: `translateY(${translateY}px)`,
        opacity,
      }}
    >
      {words.map((w, idx) => {
        const isPowerWord = idx === words.length - 1 || w.length > 5;
        return (
          <span
            key={`re-word-${idx}`}
            style={{
              display: "inline-block",
              margin: "0 0.14em",
              whiteSpace: "nowrap",
              backgroundImage: isPowerWord
                ? "linear-gradient(135deg, #FFFFFF 0%, #F5E6C4 45%, #D4AF37 100%)"
                : undefined,
              WebkitBackgroundClip: isPowerWord ? "text" : undefined,
              WebkitTextFillColor: isPowerWord ? "transparent" : "#FFFFFF",
              color: isPowerWord ? undefined : "#FFFFFF",
              filter: isPowerWord ? "drop-shadow(0 0 16px rgba(212, 175, 55, 0.50))" : undefined,
              textShadow: isPowerWord ? undefined : "0 3px 14px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.9)",
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/**
 * 24. VIRAL 3D CAPTIONS (Patrik Key Style 02)
 * Compound clip split with custom 3D perspective rotation (Player 3 effect)
 * and deep extrusion chamfer shadow.
 */
export const Viral3dCompoundTilt: React.FC<ArchetypeProps> = ({
  frame,
  words,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
  accentColor,
}) => {
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");
  const p = interpolate(frame, [0, 9, 15], [0, 1.08, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.5)),
  });
  const rotX = interpolate(p, [0, 1], [-16, 0]);
  const rotY = interpolate(p, [0, 1], [14, 0]);
  const scale = interpolate(p, [0, 1], [0.85, 1.0]);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        perspective: "800px",
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        textTransform: transform,
        letterSpacing: `${letterSpacingEm || -0.02}em`,
      }}
    >
      {words.map((w, idx) => {
        const isHero = idx === words.length - 1;
        return (
          <span
            key={`v3d-word-${idx}`}
            style={{
              display: "inline-block",
              margin: "0 0.16em",
              whiteSpace: "nowrap",
              transform: `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${scale})`,
              transformOrigin: "center center",
              color: isHero ? (accentColor || "#00E5FF") : "#FFFFFF",
              textShadow: "0 1px 0 #000, 0 2px 0 #000, 0 3px 0 #000, 0 4px 0 #000, 0 6px 16px rgba(0,0,0,0.9)",
              WebkitTextStroke: "1px rgba(0,0,0,0.85)",
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/**
 * 25. GRADIENT TEXT WITH SPLIT MASK (Patrik Key Style 03)
 * Dual-tone layered face with a sharp horizontal/diagonal split mask.
 */
export const SplitMaskDuotoneGradient: React.FC<ArchetypeProps> = ({
  frame,
  words,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
  accentColor,
}) => {
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");
  const p = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const heroHue = accentColor || "#00E5FF";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        textTransform: transform,
        letterSpacing: `${letterSpacingEm || -0.02}em`,
        opacity: p,
      }}
    >
      {words.map((w, idx) => (
        <span
          key={`split-grad-${idx}`}
          style={{
            display: "inline-block",
            margin: "0 0.15em",
            whiteSpace: "nowrap",
            backgroundImage: `linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 48%, ${heroHue} 51%, ${heroHue} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.92))",
            WebkitTextStroke: "0.5px rgba(255,255,255,0.4)",
          }}
        >
          {w}
        </span>
      ))}
    </div>
  );
};

/**
 * 26. MULTIPLE WORD SLIDE UP (Patrik Key Style 04)
 * Masked per-word upward slide reveal from beneath baseline with 2-frame stagger.
 */
export const MultiWordSlideUpStagger: React.FC<ArchetypeProps> = ({
  frame,
  words,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
  color,
}) => {
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        textTransform: transform,
        letterSpacing: `${letterSpacingEm || 0.01}em`,
      }}
    >
      {words.map((w, idx) => {
        const wordDelay = idx * 2.2;
        const localFrame = Math.max(0, frame - wordDelay);
        const p = interpolate(localFrame, [0, 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const translateY = interpolate(p, [0, 1], [115, 0]);
        const opacity = interpolate(p, [0, 0.3, 1], [0, 0.8, 1]);

        return (
          <span
            key={`slide-up-wrap-${idx}`}
            style={{
              display: "inline-block",
              overflow: "hidden",
              margin: "0 0.12em",
              verticalAlign: "bottom",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${translateY}%)`,
                opacity,
                color: color || "#FFFFFF",
                textShadow: "0 3px 14px rgba(0,0,0,0.85)",
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/**
 * 27. APPLE STYLE CAPTIONS (Patrik Key Style 05)
 * 4-keyframe variable speed transform curve with subtle hydraulic settle and crisp typography.
 */
export const AppleVariableCurvePop: React.FC<ArchetypeProps> = ({
  frame,
  words,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
}) => {
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");
  const scale = interpolate(frame, [0, 4, 7, 10], [0.82, 1.08, 0.98, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.2, 1.0),
  });
  const blur = interpolate(frame, [0, 4, 8], [10, 2, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 700,
        textTransform: transform,
        letterSpacing: `${letterSpacingEm || -0.01}em`,
        transform: `scale(${scale})`,
        opacity,
        filter: blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : undefined,
        color: "#FFFFFF",
        textShadow: "0 2px 14px rgba(0, 0, 0, 0.65), 0 0 4px rgba(0,0,0,0.5)",
      }}
    >
      {words.map((w, idx) => (
        <span key={`apple-pop-${idx}`} style={{ display: "inline-block", margin: "0 0.14em" }}>
          {w}
        </span>
      ))}
    </div>
  );
};

/**
 * 28. POP ANIMATED CAPTIONS (Patrik Key Style 06)
 * Scale pop harmonized with an exponential opacity ramp to prevent harsh visual snaps.
 */
export const SmoothPopOpacitySync: React.FC<ArchetypeProps> = ({
  frame,
  words,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
  accentColor,
}) => {
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");
  const p = interpolate(frame, [0, 7, 13], [0, 1.06, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(frame, [0, 6, 11], [0, 0.75, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        textTransform: transform,
        letterSpacing: `${letterSpacingEm || 0}em`,
        transform: `scale(${p})`,
        opacity,
        color: "#FFFFFF",
        textShadow: "0 4px 18px rgba(0, 0, 0, 0.90)",
      }}
    >
      {words.map((w, idx) => (
        <span
          key={`pop-sync-${idx}`}
          style={{
            display: "inline-block",
            margin: "0 0.15em",
            color: idx === words.length - 1 ? (accentColor || "#FFCC00") : "#FFFFFF",
          }}
        >
          {w}
        </span>
      ))}
    </div>
  );
};

/**
 * 29. TEXT HIGHLIGHTER (Patrik Key Style 07)
 * Animated colored shape (box/pill) behind power word with masked split/wipe expansion.
 */
export const AnimatedSplitHighlighter: React.FC<ArchetypeProps> = ({
  frame,
  words,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
  accentColor,
}) => {
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");
  const highlightProgress = interpolate(frame, [2, 10], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const highlightColor = accentColor || "#FFDD00";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        textTransform: transform,
        letterSpacing: `${letterSpacingEm || 0.01}em`,
      }}
    >
      {words.map((w, idx) => {
        const isHighlight = idx === words.length - 1;
        return (
          <span
            key={`highlighter-${idx}`}
            style={{
              position: "relative",
              display: "inline-block",
              margin: "0 0.16em",
              padding: isHighlight ? "0 0.22em" : undefined,
            }}
          >
            {isHighlight && (
              <span
                style={{
                  position: "absolute",
                  inset: "4% -4%",
                  borderRadius: "6px",
                  background: `${highlightColor}44`,
                  border: `2px solid ${highlightColor}`,
                  clipPath: `polygon(0 0, ${highlightProgress}% 0, ${highlightProgress}% 100%, 0 100%)`,
                  zIndex: -1,
                }}
              />
            )}
            <span
              style={{
                color: isHighlight ? "#FFFFFF" : "#FFFFFF",
                textShadow: isHighlight
                  ? `0 0 12px ${highlightColor}88, 0 3px 12px rgba(0,0,0,0.95)`
                  : "0 3px 14px rgba(0,0,0,0.9)",
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/**
 * 30. SHINE EFFECT (Patrik Key Style 08)
 * Angled 45° specular film-strip light sweep traveling across the text face.
 */
export const FilmStripSpecularShine: React.FC<ArchetypeProps> = ({
  frame,
  words,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
  accentColor,
}) => {
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");
  const shinePos = interpolate(frame, [0, 22], [-100, 220], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const baseColor = accentColor || "#FFFFFF";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        textTransform: transform,
        letterSpacing: `${letterSpacingEm || 0}em`,
      }}
    >
      {words.map((w, idx) => (
        <span
          key={`shine-word-${idx}`}
          style={{
            position: "relative",
            display: "inline-block",
            margin: "0 0.15em",
            backgroundImage: `linear-gradient(115deg, ${baseColor} 0%, ${baseColor} ${Math.max(0, shinePos - 25)}%, #FFFFFF ${shinePos}%, ${baseColor} ${Math.min(100, shinePos + 25)}%, ${baseColor} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 4px 18px rgba(0,0,0,0.95))",
          }}
        >
          {w}
        </span>
      ))}
    </div>
  );
};

/**
 * 31. FLICKER EFFECT (Patrik Key Style 09)
 * Multi-frame blend opacity ignition flicker (camera flash / fluorescent strobe).
 */
export const StrobeFlickerIgnition: React.FC<ArchetypeProps> = ({
  frame,
  words,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
  accentColor,
}) => {
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");
  const flickerKeyframes = [0.0, 0.95, 0.15, 1.0, 0.40, 0.90, 1.0];
  const opacity = frame < flickerKeyframes.length ? flickerKeyframes[frame] : 1.0;
  const scale = frame < flickerKeyframes.length ? 1.04 : 1.0;
  const flashGlow = frame === 1 || frame === 3 ? "0 0 26px rgba(255,255,255,0.9)" : "0 4px 16px rgba(0,0,0,0.9)";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        textTransform: transform,
        letterSpacing: `${letterSpacingEm || 0}em`,
        opacity,
        transform: `scale(${scale})`,
        textShadow: flashGlow,
        color: accentColor || "#FFFFFF",
      }}
    >
      {words.map((w, idx) => (
        <span key={`flicker-word-${idx}`} style={{ display: "inline-block", margin: "0 0.15em" }}>
          {w}
        </span>
      ))}
    </div>
  );
};

/**
 * 32. PREMIUM CAPTION STACK (Patrik Key Style 10)
 * Multi-deck stack with white shadow ambient glow, subtle dynamic slant, and circular spotlight gradient.
 */
export const PremiumCircularCaptionStack: React.FC<ArchetypeProps> = ({
  frame,
  words,
  fontSizePx,
  fontWeight,
  letterSpacingEm,
  fontFamily,
  fontStyle,
  casing,
}) => {
  const transform = resolveArchetypeTextTransform(casing, fontFamily, fontStyle, "uppercase");
  const p = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        fontSize: `${fontSizePx}px`,
        fontWeight: fontWeight || 800,
        textTransform: transform,
        letterSpacing: `${letterSpacingEm || -0.01}em`,
        transform: `rotate(-1.8deg) scale(${interpolate(p, [0, 1], [0.94, 1.0])})`,
        opacity: p,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "120%",
          height: "140%",
          background: "radial-gradient(circle at center, rgba(255, 255, 255, 0.22) 0%, transparent 68%)",
          pointerEvents: "none",
          zIndex: -1,
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
        {words.map((w, idx) => (
          <span
            key={`prem-stack-${idx}`}
            style={{
              display: "inline-block",
              margin: "0 0.14em",
              color: "#FFFFFF",
              textShadow: "0 0 25px rgba(255, 255, 255, 0.50), 0 4px 20px rgba(0, 0, 0, 0.95)",
            }}
          >
            {w}
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * Universal dispatcher for all transpiled animation archetypes.
 */
export const renderAnimationArchetype = (
  fx: string,
  props: ArchetypeProps,
): React.ReactElement | null => {
  switch (fx) {
    // syllabic_split_word / syllabic_break / syllabic_word_split removed:
    // two-coloration split-word treatment is banned from mini-run output.
    // Legacy names fall through to the default null path and the renderer's
    // own fallback entrance.

    case "gold_gradient_scale_blur":
    case "text_gradient_animation":
      return <GoldGradientScaleBlur {...props} />;

    case "refraction_shimmer_mask":
    case "text_mask_animation":
    case "refraction_mask":
      return <RefractionShimmerMask {...props} />;

    case "stagger_blur_word_reveal":
    case "blur_reveal":
      return <StaggerBlurWordReveal {...props} />;

    case "keyword_highlight_sweep":
    case "highlight_word":
      return <KeywordHighlightSweep {...props} />;

    case "crossout_red_streak":
    case "word_cross_out":
      return <CrossoutRedStreak {...props} />;

    case "cursor_selection_reveal":
    case "cursor_highlight":
      return <CursorSelectionReveal {...props} />;

    case "quote_glow_reveal":
    case "animated_quote_reveal":
      return <QuoteGlowReveal {...props} />;

    case "cyan_swoosh_underline":
    case "text_underline":
      return <CyanSwooshUnderline {...props} />;

    case "circle_orbit_reveal":
    case "circle_reveal":
      return <CircleOrbitReveal {...props} />;

    case "typewriter_cursor":
    case "typewriter":
      return <TypewriterCursor {...props} />;

    case "neon_wrong_choice_pill":
    case "wrong_choice_pill":
      return <NeonWrongChoicePill {...props} />;

    case "chromatic_aberration_wipe":
    case "chromatic_wipe":
      return <ChromaticAberrationWipe {...props} />;

    case "gold_selection_box_reveal":
    case "text_highlight_animation":
    case "text_highlight_scan_box":
      return <GoldSelectionBoxReveal {...props} />;

    case "glass_pill_three_words":
    case "floating_glass_word_trio":
      return <GlassPillThreeWords {...props} />;

    case "cta_glass_dual_color_pill":
      return <CtaGlassDualColorPill {...props} />;

    case "blue_blur_underline_reveal":
    case "blur_underline":
      return <BlueBlurUnderlineReveal {...props} />;

    case "dramatic_scale_entry":
      return <DramaticScaleEntry {...props} />;

    case "word_by_word_3d_flip":
      return <WordByWord3dFlip {...props} />;

    case "air_frontal_optical_bloom":
    case "in_the_air_diffusion_bloom":
    case "atmospheric_optical_bloom":
    case "frontal_air_bloom":
      return <AirFrontalOpticalBloom {...props} />;

    case "hierarchical_asymmetric_lockup":
    case "documentary_lockup_captions":
    case "micro_macro_kinetic_type":
      return <HierarchicalAsymmetricLockup {...props} />;

    case "spatial_push_spring":
    case "spatial_push":
    case "apple_spatial_push":
      return <SpatialPushSpringTypography {...props} />;

    case "difference_knockout":
    case "see_through_glass_letterform":
    case "difference_mode_inversion":
      return <DifferenceKnockoutTypography {...props} />;

    case "chiseled_prism_metallic":
    case "prism_chisel_hard_bevel":
      return <ChiseledPrismMetallic {...props} />;

    case "vj_kinetic_typography":
    case "vjkt":
    case "vj_kinetic":
      return <VJKineticTypography {...props} />;

    case "real_estate_luxury_curve":
    case "real_estate_captions":
    case "luxury_power_word_curve":
      return <RealEstateLuxuryCurve {...props} />;

    case "viral_3d_compound_tilt":
    case "viral_3d_captions":
    case "player3_compound_tilt":
      return <Viral3dCompoundTilt {...props} />;

    case "split_mask_duotone_gradient":
    case "gradient_text_split_mask":
    case "split_mask_gradient":
      return <SplitMaskDuotoneGradient {...props} />;

    case "multi_word_slide_up_stagger":
    case "multiple_word_slide_up":
    case "stagger_slide_up":
      return <MultiWordSlideUpStagger {...props} />;

    case "apple_variable_curve_pop":
    case "apple_style_captions":
    case "variable_speed_pop":
      return <AppleVariableCurvePop {...props} />;

    case "smooth_pop_opacity_sync":
    case "pop_animated_captions":
    case "smooth_opacity_pop":
      return <SmoothPopOpacitySync {...props} />;

    case "animated_split_highlighter":
    case "text_highlighter":
    case "masked_split_highlighter":
      return <AnimatedSplitHighlighter {...props} />;

    case "film_strip_specular_shine":
    case "shine_effect":
    case "film_strip_shine":
      return <FilmStripSpecularShine {...props} />;

    case "strobe_flicker_ignition":
    case "flicker_effect":
    case "rapid_strobe_flicker":
      return <StrobeFlickerIgnition {...props} />;

    case "premium_circular_caption_stack":
    case "premium_caption_stack":
    case "circle_mask_gradient_stack":
      return <PremiumCircularCaptionStack {...props} />;

    default:
      return null;
  }
};

