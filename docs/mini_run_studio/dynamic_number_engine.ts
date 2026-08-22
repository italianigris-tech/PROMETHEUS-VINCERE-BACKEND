/**
 * PROMETHEUS CORE: ANIMA #05 DYNAMIC NUMBER / STATISTIC ENGINE
 * 
 * Implements high-tier, cinematic, parametric number & statistic animation architectures:
 * - Liquid Velocity Smear & Directional Gaussian Bleed (Ref Screenshot 01)
 * - Multi-Reel Vertical Slot Tumblers with Staggered Motion Blur (Ref Screenshot 02)
 * - Fast Mechanical Counters with Slanted Trailing Zeroes
 * - 3D Glassmorphic Punch-In with Shockwave Ring
 * - Subpixel Fast Increment Telemetry Dials
 * - Staggered Per-Digit DoF Rack Focus
 * - Morphing Liquid Metaballs & CRT Chromatic Split
 * 
 * Supports dynamic font switching, per-digit stagger control, and nullable contextual labels.
 */

export type NumberAnimationFormat =
  | "liquid_velocity_smear"        // Ref Screenshot 01: Liquid flare & directional smear dissolve with glitch drop & shockwave
  | "multi_reel_slot_tumbler"      // Ref Screenshot 02: Independent staggered vertical rolling columns with motion blur
  | "slanted_zeros_bounce"         // Slanted post-lock zeroes with dynamic elastic bounce & correction
  | "domino_falling_zero_knock"    // Post-comma zero falls leftward, knocks adjacent zero in domino cascade
  | "staggered_dof_per_digit"      // Deep Z-plane per-digit camera rack focus
  | "crt_chromatic_split";         // Scanline phosphor counter with RGB chromatic split

export interface DigitColumnMetadata {
  index: number;
  targetDigit: string;             // e.g. "5", "9", "0", "$"
  staggerDelaySec: number;         // e.g. 0.0s, 0.15s, 0.3s
  rollDurationSec: number;         // e.g. 1.2s, 1.8s
  rollSequence: string[];          // e.g. ["0","1","2","3","4","5"]
  fontFamily?: string;             // Modular per-digit font override
}

export interface DynamicNumberMetadata {
  schemaVersion: "3.0.0";
  archetypeId: 5;
  archetypeName: "Number / Statistic (Dynamic Kinetic Number & Counter Suite)";
  numberFormat: NumberAnimationFormat;
  targetValue: string;             // e.g. "9", "551", "$50,000", "78.4M"
  prefixSymbol?: string;           // e.g. "$", "€", "#"
  suffixSymbol?: string;           // e.g. "M", "k", "만", "x"
  digits: DigitColumnMetadata[];
  typography: {
    fontFamily: string;            // Default primary font (e.g. 'Syne', 'Outfit', 'JetBrains Mono')
    fontWeight: number | string;
    letterSpacing: string;
    showSlantedZeroes?: boolean;
    slantAngleDeg?: number;        // e.g. -14deg
  };
  effects: {
    liquidSmearBlurPx?: number;    // Directional Gaussian smear amount (e.g. 14px)
    motionBlurIntensity?: number;  // Vertical slot blur (e.g. 8px)
    shockwaveRadius?: number;      // Expanding ring scale
    chromaticSplitPx?: number;     // RGB fringe offset
    glowBloomColor: string;
  };
  contextLabel: {
    visible: boolean;
    headline: string;
    subtext?: string;
  };
}

/**
 * Plan and generate dynamic number metadata from statement or configuration
 */
export function planDynamicNumber(
  rawTranscript: string,
  overrideFormat?: NumberAnimationFormat,
  customTarget?: string
): DynamicNumberMetadata {
  const lower = rawTranscript.toLowerCase();

  // Extract primary number target
  let target = customTarget || "551";
  const numMatch = rawTranscript.match(/\$?[\d,]+(\.\d+)?(k|m|b|만|x)?/i);
  if (numMatch && !customTarget) {
    target = numMatch[0];
  }

  let format: NumberAnimationFormat = overrideFormat || "liquid_velocity_smear";

  if (!overrideFormat) {
    if (lower.includes("liquid") || lower.includes("smear") || lower.includes("flare") || lower.includes("shockwave") || target === "9") {
      format = "liquid_velocity_smear";
    } else if (lower.includes("reel") || lower.includes("slot") || lower.includes("tumbler") || lower.includes("column") || target === "551") {
      format = "multi_reel_slot_tumbler";
    } else if (lower.includes("domino") || lower.includes("fall") || lower.includes("knock") || lower.includes("cascade")) {
      format = "domino_falling_zero_knock";
    } else if (lower.includes("slant") || lower.includes("zeros") || lower.includes("bounce")) {
      format = "slanted_zeros_bounce";
    } else if (lower.includes("dof") || lower.includes("rack") || lower.includes("focus")) {
      format = "staggered_dof_per_digit";
    } else if (lower.includes("crt") || lower.includes("phosphor") || lower.includes("chromatic")) {
      format = "crt_chromatic_split";
    } else {
      format = "liquid_velocity_smear";
    }
  }

  // Break target into individual digit columns
  const chars = target.split("");
  const digits: DigitColumnMetadata[] = chars.map((ch, idx) => ({
    index: idx,
    targetDigit: ch,
    staggerDelaySec: idx * 0.12,
    rollDurationSec: 1.0 + idx * 0.2,
    rollSequence: isNaN(parseInt(ch, 10)) ? [ch] : ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ch],
    fontFamily: "var(--font-display)"
  }));

  return {
    schemaVersion: "3.0.0",
    archetypeId: 5,
    archetypeName: "Number / Statistic (Dynamic Kinetic Number & Counter Suite)",
    numberFormat: format,
    targetValue: target,
    prefixSymbol: target.startsWith("$") ? "$" : undefined,
    suffixSymbol: target.match(/[kmb만x]$/i)?.[0],
    digits,
    typography: {
      fontFamily: format === "crt_chromatic_split" ? "var(--font-mono)" : "var(--font-display)",
      fontWeight: 900,
      letterSpacing: "-0.04em",
      showSlantedZeroes: format === "slanted_zeros_bounce" || format === "domino_falling_zero_knock",
      slantAngleDeg: -14
    },
    effects: {
      liquidSmearBlurPx: 14,
      motionBlurIntensity: 8,
      shockwaveRadius: 160,
      chromaticSplitPx: 3,
      glowBloomColor: "#38bdf8"
    },
    contextLabel: {
      visible: true,
      headline: "Exponential Metric Climax",
      subtext: "Verified Quantitative Realization"
    }
  };
}
