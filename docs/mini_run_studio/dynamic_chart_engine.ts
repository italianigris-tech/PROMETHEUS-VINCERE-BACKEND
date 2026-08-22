/**
 * PROMETHEUS CORE: ANIMA #04 DYNAMIC CHART & GRAPH ENGINE (V2 PROGRESSIVE TEMPORAL REVEAL)
 * 
 * Implements high-tier, cinematic, transparent vector chart architectures with
 * 100% progressive temporal reveal physics (SVG line drawing + synchronized clip-path
 * area unmasking + sequential milestone popping + apex beacon climax).
 * 
 * Zero static charts: Every chart starts at origin t=0 and dynamically flows forward
 * into its positive or negative resolution.
 */

export type ChartArchetypeFormat =
  | "exponential_uptrend_spline"      // Positive: Parabolic climb (Screenshot 02)
  | "volatility_wave_sine"            // Negative/Wave: Oscillating drawdown (Screenshot 03)
  | "telemetry_apex_tooltip_spline"   // Declining: Apex climb & projection (Screenshot 05 & 07)
  | "segmented_peak_area_grid"        // Negative: Amber coordinate lattice (Screenshot 06)
  | "bearish_selloff_crash_grid"      // Negative: Crimson selloff slope (Screenshot 09)
  | "crimson_downtrend_vertex_arrow"  // Negative: Sequential laser vertices (Screenshot 10)
  | "neon_emerald_bullish_mountain"   // Positive: Emerald mountain ridge (Screenshot 11)
  | "candlestick_frequency_spectrum"; // Staggered individual vertical tick rise (Screenshot 08)

export interface ChartDataPoint {
  index: number;
  label?: string;          // e.g. "Q1", "23.07", "Jan"
  value: number;           // e.g. 10..100
  isApex?: boolean;        // Active focal peak
  calloutBadge?: string;   // e.g. "80만", "783 kwh", "-68.4%"
  staggerDelaySec?: number; // Timing offset for progressive reveal
}

export interface DynamicChartMetadata {
  schemaVersion: "3.0.0";
  archetypeId: 4;
  archetypeName: "Chart / Graph (Master Progressive Vector Trajectory Suite)";
  chartFormat: ChartArchetypeFormat;
  trendResolution: "positive_bullish" | "negative_bearish";
  animationDurationSec: number; // e.g. 3.2s loop
  progressiveReveal: {
    enabled: boolean;
    strokeDashArray: number;
    clipPathExpand: boolean;
    sequentialMilestones: boolean;
    apexClimaxDelaySec: number;
  };
  metricHero: {
    visible: boolean;
    value: string;
    label: string;
    deltaPercentage?: string;
    deltaPositive?: boolean;
  };
  options: {
    showGrid: boolean;
    showTooltip: boolean;
    showAreaGradient: boolean;
    showApexBeacon: boolean;
    showMilestonePills: boolean;
    blurUnderglow: boolean;
  };
  typographyPresetId: string;
  colorTheme: {
    primaryNeon: string;
    secondaryAccent: string;
    areaGradientStart: string;
    areaGradientEnd: string;
  };
  dataPoints: ChartDataPoint[];
}

/**
 * Plan and generate dynamic chart metadata from statement
 */
export function planDynamicChart(
  rawTranscript: string,
  overrideFormat?: ChartArchetypeFormat,
  customMetric?: { value: string; label: string; delta?: string }
): DynamicChartMetadata {
  const lower = rawTranscript.toLowerCase();

  let format: ChartArchetypeFormat = overrideFormat || "exponential_uptrend_spline";
  let resolution: "positive_bullish" | "negative_bearish" = "positive_bullish";
  let primaryNeon = "#a3e635";
  let secondaryAccent = "#facc15";
  let areaStart = "rgba(163, 230, 53, 0.45)";
  let areaEnd = "rgba(163, 230, 53, 0.0)";

  if (!overrideFormat) {
    if (lower.includes("drop") || lower.includes("crash") || lower.includes("loss") || lower.includes("down") || lower.includes("plunge") || lower.includes("decrease") || lower.includes("selloff")) {
      resolution = "negative_bearish";
      if (lower.includes("laser") || lower.includes("arrow") || lower.includes("vertex")) {
        format = "crimson_downtrend_vertex_arrow";
        primaryNeon = "#ff2a4b";
        secondaryAccent = "#ff0033";
        areaStart = "rgba(255, 42, 75, 0.5)";
        areaEnd = "rgba(255, 42, 75, 0.0)";
      } else if (lower.includes("grid") || lower.includes("crash")) {
        format = "bearish_selloff_crash_grid";
        primaryNeon = "#ef4444";
        secondaryAccent = "#b91c1c";
        areaStart = "rgba(239, 68, 68, 0.6)";
        areaEnd = "rgba(239, 68, 68, 0.0)";
      } else {
        format = "segmented_peak_area_grid";
        primaryNeon = "#f97316";
        secondaryAccent = "#ea580c";
        areaStart = "rgba(249, 115, 22, 0.6)";
        areaEnd = "rgba(249, 115, 22, 0.0)";
      }
    } else if (lower.includes("wave") || lower.includes("volatility") || lower.includes("cycle")) {
      format = "volatility_wave_sine";
      resolution = "negative_bearish";
      primaryNeon = "#818cf8";
      secondaryAccent = "#6366f1";
      areaStart = "rgba(129, 140, 248, 0.5)";
      areaEnd = "rgba(129, 140, 248, 0.0)";
    } else if (lower.includes("energy") || lower.includes("kwh") || lower.includes("apex") || lower.includes("tooltip")) {
      format = "telemetry_apex_tooltip_spline";
      resolution = "negative_bearish";
      primaryNeon = "#38bdf8";
      secondaryAccent = "#0284c7";
      areaStart = "rgba(56, 189, 248, 0.4)";
      areaEnd = "rgba(56, 189, 248, 0.0)";
    } else if (lower.includes("mountain") || lower.includes("skyrocket")) {
      format = "neon_emerald_bullish_mountain";
      resolution = "positive_bullish";
      primaryNeon = "#34d399";
      secondaryAccent = "#10b981";
      areaStart = "rgba(16, 185, 129, 0.6)";
      areaEnd = "rgba(16, 185, 129, 0.0)";
    } else if (lower.includes("spectrum") || lower.includes("candlestick") || lower.includes("frequency")) {
      format = "candlestick_frequency_spectrum";
      resolution = "positive_bullish";
      primaryNeon = "#38bdf8";
      secondaryAccent = "#ffffff";
      areaStart = "rgba(56, 189, 248, 0.3)";
      areaEnd = "rgba(56, 189, 248, 0.0)";
    } else {
      format = "exponential_uptrend_spline";
      resolution = "positive_bullish";
      primaryNeon = "#a3e635";
      secondaryAccent = "#facc15";
      areaStart = "rgba(163, 230, 53, 0.45)";
      areaEnd = "rgba(163, 230, 53, 0.0)";
    }
  }

  const defaultMetric = customMetric || {
    value: resolution === "negative_bearish" ? "-68.4%" : "$80,000",
    label: resolution === "negative_bearish" ? "Drawdown Trajectory" : "Exponential Run Rate",
    delta: resolution === "negative_bearish" ? "-42.5% decrease" : "+240% velocity"
  };

  return {
    schemaVersion: "3.0.0",
    archetypeId: 4,
    archetypeName: "Chart / Graph (Master Progressive Vector Trajectory Suite)",
    chartFormat: format,
    trendResolution: resolution,
    animationDurationSec: 3.2,
    progressiveReveal: {
      enabled: true,
      strokeDashArray: 800,
      clipPathExpand: true,
      sequentialMilestones: true,
      apexClimaxDelaySec: 2.2
    },
    metricHero: {
      visible: true,
      value: defaultMetric.value,
      label: defaultMetric.label,
      deltaPercentage: defaultMetric.delta,
      deltaPositive: resolution === "positive_bullish"
    },
    options: {
      showGrid: true,
      showTooltip: true,
      showAreaGradient: true,
      showApexBeacon: true,
      showMilestonePills: true,
      blurUnderglow: true
    },
    typographyPresetId: "TYPO #02 Subpixel Gaussian Rack-Focus",
    colorTheme: {
      primaryNeon,
      secondaryAccent,
      areaGradientStart: areaStart,
      areaGradientEnd: areaEnd
    },
    dataPoints: resolution === "negative_bearish"
      ? [
          { index: 0, label: "00:00", value: 90, staggerDelaySec: 0.2 },
          { index: 1, label: "00:05", value: 65, staggerDelaySec: 0.6 },
          { index: 2, label: "00:10", value: 80, staggerDelaySec: 1.0 },
          { index: 3, label: "00:15", value: 72, staggerDelaySec: 1.4 },
          { index: 4, label: "00:20", value: 35, isApex: true, calloutBadge: "-42%", staggerDelaySec: 1.8 },
          { index: 5, label: "00:25", value: 15, isApex: true, calloutBadge: "-68.4%", staggerDelaySec: 2.4 }
        ]
      : [
          { index: 0, label: "23.01", value: 15, calloutBadge: "10k", staggerDelaySec: 0.3 },
          { index: 1, label: "23.07", value: 35, calloutBadge: "50k", staggerDelaySec: 0.9 },
          { index: 2, label: "24.02", value: 60, calloutBadge: "70k", staggerDelaySec: 1.5 },
          { index: 3, label: "24.10", value: 92, isApex: true, calloutBadge: "80만", staggerDelaySec: 2.2 }
        ]
  };
}
