/**
 * PROMETHEUS CORE: ANIMA #07 DYNAMIC COMPARISON ENGINE
 * 
 * Curated 2-Pane Master Comparison Suite:
 * 1. COMP #01 — Stepped Notch Laser Split Screen (Ref Screenshot 04)
 * 2. COMP #02 — Dual Product Side-by-Side Studio Stage (Ref Screenshot 02)
 * 
 * Highly tinkerable animation pipeline parameters:
 * - Entry physics (stagger, trajectory, easing curve)
 * - Dynamic split line positioning & notch geometry
 * - Independent lighting ambience & glow intensity
 * - Product floating amplitude, tilt, and floor shadow dynamics
 * - Fully customizable keyframe & Remotion frame expressions
 */

export type ComparisonLayoutFormat =
  | "stepped_notch_split"        // Ref Screenshot 04: Non-straight zigzag / stepped laser divider
  | "dual_studio_podiums";       // Ref Screenshot 02: Side-by-side product showcases with custom lighting

export type AnimationEntryTrajectory =
  | "staggered_slide"            // Left slides from -X, Right slides from +X
  | "focal_zoom_snap"            // Elastic zoom punch into perspective
  | "subpixel_blur_rise"         // Gaussian blur-up with vertical rise
  | "curtain_laser_slice";       // Laser beam draws center seam then panes expand

export interface ComparisonAnimationKnobs {
  /** Entry animation trajectory */
  entryTrajectory: AnimationEntryTrajectory;
  /** Total intro animation duration in milliseconds */
  entryDurationMs: number;
  /** Stagger offset between left and right entities in milliseconds */
  staggerDelayMs: number;
  /** Continuous breathing/pulse cycle frequency in Hz (default: 0.3 Hz) */
  pulseRateHz: number;
  /** Center split seam position (0.0 to 1.0, default: 0.5) */
  splitNotchRatio: number;
  /** Neon glow and bloom intensity (0.0 to 2.0, default: 1.0) */
  glowIntensity: number;
  /** Floating vertical travel amplitude in pixels (for podium products, default: 6px) */
  floatingAmplitudePx: number;
  /** Floating cycle frequency in Hz (default: 0.28 Hz) */
  floatingFrequencyHz: number;
  /** Optional custom CSS easing or cubic-bezier curve */
  easingCurve: string;
  /** Optional custom CSS keyframe overrides for pipeline tuning */
  customKeyframes?: {
    leftKeyframe?: string;
    rightKeyframe?: string;
    seamKeyframe?: string;
  };
}

export interface ComparisonEntity {
  id: string;
  label: string;
  subtext?: string;
  metricBadge?: string;          // e.g. "100 Hook", "1M Hook", "$10k", "$80k"
  theme: {
    bgGradient: string;
    accentColor: string;
    glowColor: string;
    textColor: string;
  };
  assetType?: "micro_asset" | "text" | "number" | "product_card";
  assetKey?: string;             // e.g. "bottle_white", "tumbler_titanium", "eye_metric"
}

export interface DynamicComparisonMetadata {
  schemaVersion: "3.1.0";
  archetypeId: 7;
  archetypeName: "Comparison (Dynamic Contrast & Split Suite)";
  layoutFormat: ComparisonLayoutFormat;
  itemCount: 2;                  // Dedicated 2-entity contrast
  entities: [ComparisonEntity, ComparisonEntity];
  dividerSpec: {
    type: "stepped_notch" | "vertical_studio_seam";
    notchOffsetPx: number;
    hasLaserGlow: boolean;
    seamColor: string;
    seamGlowColor: string;
  };
  animation: ComparisonAnimationKnobs;
  typography: {
    fontFamily: string;
    headlineWeight: number | string;
    metricWeight: number | string;
  };
}

/**
 * Plan and generate comparison metadata from raw transcript with full pipeline tinkerability
 */
export function planDynamicComparison(
  rawTranscript: string,
  overrideFormat?: ComparisonLayoutFormat,
  customKnobs?: Partial<ComparisonAnimationKnobs>
): DynamicComparisonMetadata {
  const lower = rawTranscript.toLowerCase();

  let format: ComparisonLayoutFormat = overrideFormat || "stepped_notch_split";

  if (!overrideFormat) {
    if (lower.includes("product") || lower.includes("bottle") || lower.includes("podium") || lower.includes("side by side") || lower.includes("tumbler")) {
      format = "dual_studio_podiums";
    } else {
      format = "stepped_notch_split";
    }
  }

  // Default Tinkerable Animation Knobs
  const animation: ComparisonAnimationKnobs = {
    entryTrajectory: format === "stepped_notch_split" ? "curtain_laser_slice" : "staggered_slide",
    entryDurationMs: 650,
    staggerDelayMs: 150,
    pulseRateHz: 0.32,
    splitNotchRatio: 0.5,
    glowIntensity: 1.0,
    floatingAmplitudePx: format === "dual_studio_podiums" ? 6 : 0,
    floatingFrequencyHz: 0.28,
    easingCurve: "cubic-bezier(0.16, 1, 0.3, 1)",
    ...customKnobs
  };

  let entities: [ComparisonEntity, ComparisonEntity];

  if (format === "dual_studio_podiums") {
    entities = [
      {
        id: "entity_left",
        label: "Standard Model",
        subtext: "HydroPro Stainless",
        metricBadge: "Standard",
        theme: {
          bgGradient: "radial-gradient(circle at 50% 50%, #f5f5f4 0%, #d6d3d1 100%)",
          accentColor: "#1c1917",
          glowColor: "rgba(0,0,0,0.15)",
          textColor: "#1c1917"
        },
        assetType: "product_card",
        assetKey: "bottle_white"
      },
      {
        id: "entity_right",
        label: "Pro Engine",
        subtext: "HydroPro ACTIVITY",
        metricBadge: "Pro Edition",
        theme: {
          bgGradient: "radial-gradient(circle at 50% 50%, #44403c 0%, #1c1917 100%)",
          accentColor: "#ffffff",
          glowColor: "rgba(255,255,255,0.25)",
          textColor: "#ffffff"
        },
        assetType: "product_card",
        assetKey: "tumbler_titanium"
      }
    ];
  } else {
    // Stepped Notch Laser Split (Screenshot 04)
    entities = [
      {
        id: "entity_left",
        label: "Low Efficiency",
        subtext: "Amateur Retention",
        metricBadge: "100 HOOK",
        theme: {
          bgGradient: "radial-gradient(circle at 35% 50%, #7f1d1d 0%, #450a0a 60%, #0c0404 100%)",
          accentColor: "#f87171",
          glowColor: "rgba(239,68,68,0.8)",
          textColor: "#ffffff"
        },
        assetType: "text",
        assetKey: "eye_red_metric"
      },
      {
        id: "entity_right",
        label: "Alpha Scaling",
        subtext: "Compound Velocity",
        metricBadge: "1M HOOK",
        theme: {
          bgGradient: "radial-gradient(circle at 65% 50%, #0369a1 0%, #082f49 60%, #020617 100%)",
          accentColor: "#38bdf8",
          glowColor: "rgba(56,189,248,0.9)",
          textColor: "#ffffff"
        },
        assetType: "text",
        assetKey: "eye_cyan_metric"
      }
    ];
  }

  return {
    schemaVersion: "3.1.0",
    archetypeId: 7,
    archetypeName: "Comparison (Dynamic Contrast & Split Suite)",
    layoutFormat: format,
    itemCount: 2,
    entities,
    dividerSpec: {
      type: format === "stepped_notch_split" ? "stepped_notch" : "vertical_studio_seam",
      notchOffsetPx: 16,
      hasLaserGlow: format === "stepped_notch_split",
      seamColor: format === "stepped_notch_split" ? "#ffffff" : "rgba(0,0,0,0.15)",
      seamGlowColor: format === "stepped_notch_split" ? "#38bdf8" : "transparent"
    },
    animation,
    typography: {
      fontFamily: "var(--font-display)",
      headlineWeight: 900,
      metricWeight: 900
    }
  };
}
