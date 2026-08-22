/**
 * PROMETHEUS CORE: ANIMA #06 DYNAMIC PERCENTAGE ENGINE
 * 
 * Implements precision percentage architectures:
 * - 48-Tick Radial Dynamic Sweep Dials (Proportional active tick mapping)
 * - Polar Arc Neon Vector Progress Gauges with Specular Apex Pips
 * - Kinetic Percentage Number Punch with Shockwave Ring & Tandem Number Physics
 * - Luminescent Sphere Orb Gauge with Specular Ray Needle (Ref Screenshot 01)
 * - Celestial Atmospheric Horizon Glow with Hairline Eclipse Numerals (Ref Screenshot 02)
 * 
 * Fully interoperable with ANIMA #05 Number Kinetic Engine. Zero redundant labels.
 */

import { NumberAnimationFormat } from "./dynamic_number_engine";

export type PercentageGaugeFormat =
  | "radial_multi_tick_dial"       // 48-tick proportional coral/orange sweep
  | "polar_arc_neon_gauge"         // 270-deg cyan polar arc with leading pip
  | "kinetic_punch_percentage"     // Rapid ticker + shockwave ring (tandem number physics)
  | "luminescent_sphere_orb"       // Ref Screenshot 01: 3D orb, violet fluid fold & ray needle
  | "celestial_horizon_eclipse";   // Ref Screenshot 02: Planetary curved horizon & hairline numerals

export interface DynamicPercentageMetadata {
  schemaVersion: "3.0.0";
  archetypeId: 6;
  archetypeName: "Percentage (Radial Tick Dial & Polar Gauge Suite)";
  percentageFormat: PercentageGaugeFormat;
  percentageValue: number;         // Numeric value e.g. 20, 50, 68, 87, 300
  displayString: string;           // e.g. "20%", "+68%", "87%", "300%"
  prefixSymbol?: string;           // e.g. "+", "-"
  tickCount: number;               // Default 48 for radial dial
  activeTickCount: number;         // Math.round((value / 100) * 48)
  arcDegrees: number;              // Math.min(360, (value / 100) * 270)
  gaugeColor: {
    primaryGradStart: string;
    primaryGradEnd: string;
    glowBloomColor: string;
    trackColor: string;
  };
  tandemNumberEffect?: NumberAnimationFormat; // Inherits ANIMA #05 motion physics
  typography: {
    fontFamily: string;
    fontWeight: number | string;
    letterSpacing: string;
  };
}

/**
 * Generate 48 radial tick SVG lines dynamically with active highlight based on percent
 */
export function generateDynamicRadialTicks(percent: number, totalTicks = 48, radius = 70, cx = 100, cy = 100): string {
  const activeCount = Math.round((Math.min(100, Math.max(0, percent)) / 100) * totalTicks);
  let ticksSvg = "";

  for (let i = 0; i < totalTicks; i++) {
    // Start from top (-90 deg) and rotate clockwise
    const angleDeg = (i / totalTicks) * 360 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    
    const x1 = cx + (radius - 12) * Math.cos(angleRad);
    const y1 = cy + (radius - 12) * Math.sin(angleRad);
    const x2 = cx + radius * Math.cos(angleRad);
    const y2 = cy + radius * Math.sin(angleRad);

    const isActive = i < activeCount;
    const strokeColor = isActive ? "url(#tickOrangeGrad)" : "rgba(255,255,255,0.12)";
    const strokeWidth = isActive ? "2.6" : "1.6";
    const opacity = isActive ? "1" : "0.35";

    ticksSvg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="${opacity}" class="tick-line ${isActive ? 'tick-active' : ''}"/>`;
  }

  return ticksSvg;
}

/**
 * Plan and generate dynamic percentage metadata
 */
export function planDynamicPercentage(
  rawTranscript: string,
  overrideFormat?: PercentageGaugeFormat,
  customPercent?: number
): DynamicPercentageMetadata {
  const lower = rawTranscript.toLowerCase();

  // Extract percentage value
  let pctVal = customPercent !== undefined ? customPercent : 50;
  const pctMatch = rawTranscript.match(/([+-]?\d+(\.\d+)?)%/);
  if (pctMatch && customPercent === undefined) {
    pctVal = parseFloat(pctMatch[1]);
  }

  let format: PercentageGaugeFormat = overrideFormat || "radial_multi_tick_dial";

  if (!overrideFormat) {
    if (lower.includes("horizon") || lower.includes("eclipse") || lower.includes("celestial") || pctVal >= 200) {
      format = "celestial_horizon_eclipse";
    } else if (lower.includes("sphere") || lower.includes("orb") || lower.includes("speedometer") || lower.includes("needle") || pctVal === 87) {
      format = "luminescent_sphere_orb";
    } else if (lower.includes("polar") || lower.includes("arc") || lower.includes("circle")) {
      format = "polar_arc_neon_gauge";
    } else if (lower.includes("punch") || lower.includes("shockwave") || lower.includes("glitch")) {
      format = "kinetic_punch_percentage";
    } else {
      format = "radial_multi_tick_dial";
    }
  }

  const prefix = pctVal > 0 && rawTranscript.includes("+") ? "+" : undefined;
  const displayStr = `${prefix ? prefix : ""}${pctVal}%`;

  return {
    schemaVersion: "3.0.0",
    archetypeId: 6,
    archetypeName: "Percentage (Radial Tick Dial & Polar Gauge Suite)",
    percentageFormat: format,
    percentageValue: pctVal,
    displayString: displayStr,
    prefixSymbol: prefix,
    tickCount: 48,
    activeTickCount: Math.round((Math.min(100, Math.max(0, pctVal)) / 100) * 48),
    arcDegrees: Math.min(360, (Math.min(100, Math.max(0, pctVal)) / 100) * 270),
    gaugeColor: {
      primaryGradStart: format === "luminescent_sphere_orb" ? "#a855f7" : (format === "celestial_horizon_eclipse" ? "#38bdf8" : "#f97316"),
      primaryGradEnd: format === "luminescent_sphere_orb" ? "#6366f1" : (format === "celestial_horizon_eclipse" ? "#0284c7" : "#ef4444"),
      glowBloomColor: format === "celestial_horizon_eclipse" ? "#38bdf8" : "#f97316",
      trackColor: "rgba(255,255,255,0.12)"
    },
    tandemNumberEffect: "liquid_velocity_smear",
    typography: {
      fontFamily: format === "celestial_horizon_eclipse" ? "var(--font-display)" : "var(--font-display)",
      fontWeight: format === "celestial_horizon_eclipse" ? 200 : 900,
      letterSpacing: format === "celestial_horizon_eclipse" ? "0.02em" : "-0.04em"
    }
  };
}
