import type {IntensityCurve} from "@prometheus/shared-types";

/**
 * Ease Selection Result
 * Contains the selected GSAP ease and timing modifiers.
 */
export interface EaseSelection {
  readonly ease: string;
  readonly durationMultiplier: number;
  readonly perturbation: number;
}

/**
 * Default ease when no curve is provided or curve is malformed.
 */
const DEFAULT_EASE = "power2.out";

/**
 * Maps intensity values to GSAP ease strings.
 * @param intensity - The intensity value (0-1)
 * @returns The corresponding GSAP ease string
 */
function intensityToEase(intensity: number): string {
  const clampedIntensity = Math.max(0, Math.min(1, intensity));
  
  if (clampedIntensity < 0.25) {
    return "power2.out";
  }
  if (clampedIntensity < 0.45) {
    return "power3.out";
  }
  if (clampedIntensity < 0.65) {
    return "back.out(1.2)";
  }
  if (clampedIntensity < 0.82) {
    return "expo.out";
  }
  if (clampedIntensity < 0.95) {
    return "circ.in";
  }
  return "circ.inOut";
}

/**
 * Calculates the duration multiplier based on the derivative.
 * Higher derivative = sharper change = shorter duration for snappiness.
 * @param derivative - The derivative value
 * @returns The duration multiplier
 */
function derivativeToDurationMultiplier(derivative: number): number {
  const absDerivative = Math.abs(derivative);
  // Clamp derivative between 0.2 and 3.0, then invert
  const clampedDerivative = Math.max(0.2, Math.min(3.0, absDerivative));
  return 1.0 / clampedDerivative;
}

/**
 * Finds the intensity segment containing time t by linear interpolation.
 * @param t - Current time in seconds
 * @param curve - The temporal intensity curve
 * @returns The interpolated intensity and derivative at time t
 */
function interpolateAtTimestamp(
  t: number,
  curve: IntensityCurve
): {intensity: number; derivative: number} {
  const {points} = curve;
  
  // Handle empty curve
  if (!points || points.length === 0) {
    return {intensity: 0.5, derivative: 0};
  }
  
  // Handle single point
  if (points.length === 1) {
    const singlePoint = points[0];
    if (!singlePoint) {
      return {intensity: 0.5, derivative: 0};
    }
    return {intensity: singlePoint.intensity, derivative: singlePoint.derivative};
  }
  
  // Handle t before first point
  const firstPoint = points[0];
  if (firstPoint && t <= firstPoint.t) {
    return {intensity: firstPoint.intensity, derivative: firstPoint.derivative};
  }
  
  // Handle t after last point
  const lastPoint = points[points.length - 1];
  if (lastPoint && t >= lastPoint.t) {
    return {intensity: lastPoint.intensity, derivative: lastPoint.derivative};
  }
  
  // Find the segment containing t
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    
    if (!p0 || !p1) {
      continue;
    }
    
    if (t >= p0.t && t < p1.t) {
      // Linear interpolation
      const segmentDuration = p1.t - p0.t;
      const alpha = segmentDuration > 0 ? (t - p0.t) / segmentDuration : 0;
      
      const intensity = p0.intensity + alpha * (p1.intensity - p0.intensity);
      
      // Use average derivative across the segment
      const derivative = (p0.derivative + p1.derivative) / 2;
      
      return {intensity, derivative};
    }
  }
  
  // Fallback (should not reach here)
  return {intensity: 0.5, derivative: 0};
}

/**
 * Selects a GSAP ease and timing modifiers based on the intensity at time t.
 * @param t - Current time in SECONDS
 * @param curve - The temporal intensity curve from Director's Notes
 * @param baseEase - Fallback ease if curve is empty or malformed
 * @returns EaseSelection containing ease, durationMultiplier, and perturbation
 */
export function selectEaseForTimestamp(
  t: number,
  curve: IntensityCurve,
  baseEase?: string
): EaseSelection {
  // Handle NaN or negative t
  const safeT = Number.isFinite(t) ? Math.max(0, t) : 0;
  
  // Handle null/undefined curve
  if (!curve) {
    return {
      ease: baseEase ?? DEFAULT_EASE,
      durationMultiplier: 1,
      perturbation: 0
    };
  }
  
  // Get interpolated values at timestamp
  const {intensity, derivative} = interpolateAtTimestamp(safeT, curve);
  
  // Map intensity to ease
  const ease = intensityToEase(intensity);
  
  // Calculate duration multiplier from derivative
  // Handle derivative of 0 (should not produce Infinity)
  const durationMultiplier = derivative === 0 ? 1.0 : derivativeToDurationMultiplier(derivative);
  
  // Calculate perturbation (capped at 0.15)
  const perturbation = Math.min(0.15, intensity * 0.15);
  
  return {
    ease,
    durationMultiplier,
    perturbation
  };
}