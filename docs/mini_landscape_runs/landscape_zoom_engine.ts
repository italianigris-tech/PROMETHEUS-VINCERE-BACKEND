/**
 * MINI LANDSCAPE RUNS — CINEMATIC VELOCITY ZOOM ENGINE
 *
 * Implements the 3 Authoritative Broadcast / Premiere Velocity Curves with
 * Shutter Angle Motion Blur and Pinned Anchor Points:
 *
 * 1. THE STANDARD CINEMATIC PUSH (Smooth S-Curve)
 *    - Shape: Gentle symmetrical "S" shape (flat smooth hill in velocity graph).
 *    - Keyframes: K1 Ease Out, K2 Ease In (handles [0.42, 0.0] and [0.58, 1.0]).
 *    - Shutter Angle: 180° Motion Blur.
 *
 * 2. THE DRAMATIC "WHIPLASH" ZOOM (Fast-In, Slow-Out / Steep Ski Slope)
 *    - Shape: Steep velocity spike at start leveling into a long flat tail.
 *    - Keyframes: K1 Ease Out (dragged far right), K2 Ease In (dragged far left).
 *    - CSS Bezier: cubic-bezier(0.08, 0.95, 0.15, 1.0).
 *    - Shutter Angle: 360° High-Energy Directional Motion Blur.
 *
 * 3. THE REBOUND / SNAP ZOOM (3-Keyframe Elastic Overshoot)
 *    - Shape: Scales past target, overshoots (+15%), and bounces back to resting scale.
 *    - Keyframes: K1 (0ms, 100% Ease Out) -> K2 (180ms, 122% Continuous Bezier) -> K3 (380ms, 116% Ease In).
 *    - CSS Bezier: cubic-bezier(0.34, 1.56, 0.64, 1.0).
 *    - Shutter Angle: 360° Punch Motion Blur.
 *
 * PRO-TIPS ENFORCED:
 * - Always uses Transform Effect internal keyframing (not default Motion tab).
 * - Shutter Angle manually uncoupled from comp shutter (180° / 360°).
 * - Pinned Anchor Point crosshairs centered on host_eyes (960, 420) or host_chest.
 */

import type {
  BackgroundCoveragePlan,
  CinematicZoomCurveKind,
  EditMove,
  LandscapeSection,
  TransformEffectConfig,
  ZoomActionKind,
  ZoomCue,
  ZoomKeyframe,
  ZoomPlan,
  ZoomTriggerCategory,
} from "./types.js";
import type { TranscriptPoint } from "./section_segmenter.js";

const AUDIENCE_ADDRESS_REGEX = /\b(you|your|you're|yours|customer|client|buyer|audience|listener)\b/i;
const HIGH_EMPHASIS_REGEX = /\b(prove|scale|changes|completely|never|always|secret|crucial|core|truth|reality|fatal|fail|machine)\b/i;

const MIN_ZOOM_GAP_SEC = 3.0;
const MAX_ZOOM_SCALE = 1.25;

const ANCHOR_EYES = { x: 960, y: 420, targetLabel: "host_eyes" as const };
const ANCHOR_CHEST = { x: 960, y: 560, targetLabel: "host_chest" as const };
const ANCHOR_SPLIT_RIGHT = { x: 1248, y: 420, targetLabel: "split_stage_right" as const };

/**
 * Builds the complete, broadcast-grade Cinematic Zoom Plan with exact velocity curves.
 */
export function buildZoomPlan(
  sections: LandscapeSection[],
  backgroundCoverages: BackgroundCoveragePlan[] = [],
  editMoves: EditMove[] = [],
  transcript: TranscriptPoint[] = [],
): ZoomPlan {
  const cues: ZoomCue[] = [];
  let lastZoomEndSec = -MIN_ZOOM_GAP_SEC;

  // Identify active background coverages to trigger Return-to-Authority on exhaustion
  const activeCoverages = backgroundCoverages.filter(
    (c) => c.coverageType !== "clean_anchor",
  );

  sections.forEach((sec, idx) => {
    const text = (sec.text || "").toLowerCase();
    const duration = sec.durationSec || sec.endSec - sec.startSec;

    // Check if previous section was an active background coverage that just finished
    const prevCoverage = activeCoverages.find(
      (c) => Math.abs(c.endSec - sec.startSec) <= 0.2,
    );

    // =========================================================================
    // TRIGGER 1: Return-to-Authority Whiplash Punch (Post-Background Exhaustion)
    // Uses Curve 2: Dramatic Whiplash Zoom (360° Shutter Motion Blur)
    // =========================================================================
    if (prevCoverage && sec.startSec - lastZoomEndSec >= MIN_ZOOM_GAP_SEC) {
      const punchDuration = Math.min(4.0, duration * 0.6);
      const keyframes: ZoomKeyframe[] = [
        { timeOffsetMs: 0, scale: 1.0, interpolation: "ease_out", velocityHandleOut: [0.08, 0.95] },
        { timeOffsetMs: Math.round(punchDuration * 1000), scale: 1.18, interpolation: "ease_in", velocityHandleIn: [0.15, 1.0] },
      ];

      cues.push({
        zoomId: `zoom_${sec.sectionId}_return_to_authority`,
        sectionId: sec.sectionId,
        startSec: sec.startSec,
        endSec: sec.startSec + punchDuration,
        durationSec: punchDuration,
        kind: "return_to_authority_punch",
        curveKind: "whiplash_zoom",
        triggerCategory: "return_from_background",
        startScale: 1.0,
        endScale: 1.18,
        keyframes,
        transformEffect: {
          effectName: "Transform",
          uncheckCompShutter: true,
          shutterAngleDeg: 360,
          motionBlur: true,
          anchorPointCrosshair: ANCHOR_EYES,
        },
        cssBezier: "cubic-bezier(0.08, 0.95, 0.15, 1.0)",
        pairedSpokenSnippet: text.slice(0, 45),
        causalReason: `Curve 2: Dramatic Whiplash Zoom (360° Shutter Angle Motion Blur) snaps to 1.18x on host_eyes crosshair after ${prevCoverage.coverageId} background coverage exhausted.`,
        cause: {
          gate: "edit_move",
          reason: "return_to_authority post background coverage",
          sectionId: sec.sectionId,
          timeSec: sec.startSec,
        },
      });
      lastZoomEndSec = sec.startSec + punchDuration;
      return;
    }

    // =========================================================================
    // TRIGGER 2: High Emphasis Climax / Rebound Snap Zoom
    // Uses Curve 3: 3-Keyframe Elastic Overshoot + Spring Settle
    // =========================================================================
    if (
      (sec.role === "payoff" || /(prove it|scale|machine|completely)/i.test(text)) &&
      sec.startSec - lastZoomEndSec >= MIN_ZOOM_GAP_SEC
    ) {
      const zoomDuration = Math.min(5.0, duration * 0.7);
      const targetScale = 1.18;
      const overshootScale = 1.23;

      const keyframes: ZoomKeyframe[] = [
        { timeOffsetMs: 0, scale: 1.0, interpolation: "ease_out", velocityHandleOut: [0.2, 0.0] },
        { timeOffsetMs: 180, scale: overshootScale, interpolation: "continuous_bezier", velocityHandleIn: [0.4, 1.15] },
        { timeOffsetMs: 380, scale: targetScale, interpolation: "ease_in", velocityHandleIn: [0.6, 1.0] },
      ];

      cues.push({
        zoomId: `zoom_${sec.sectionId}_climax_rebound`,
        sectionId: sec.sectionId,
        startSec: sec.startSec,
        endSec: sec.startSec + zoomDuration,
        durationSec: zoomDuration,
        kind: "emphasis_punch_in",
        curveKind: "rebound_snap_zoom",
        triggerCategory: "high_emphasis",
        startScale: 1.0,
        endScale: targetScale,
        overshootScale,
        keyframes,
        transformEffect: {
          effectName: "Transform",
          uncheckCompShutter: true,
          shutterAngleDeg: 360,
          motionBlur: true,
          anchorPointCrosshair: ANCHOR_EYES,
        },
        cssBezier: "cubic-bezier(0.34, 1.56, 0.64, 1.0)",
        pairedSpokenSnippet: text.slice(0, 45),
        causalReason: `Curve 3: Rebound Snap Zoom with 3 keyframes (1.0x -> 1.23x overshoot -> 1.18x settle) on pivotal conviction statement.`,
        cause: {
          gate: "edit_move",
          reason: "high emphasis climax rebound",
          sectionId: sec.sectionId,
          timeSec: sec.startSec,
        },
      });
      lastZoomEndSec = sec.startSec + zoomDuration;
      return;
    }

    // =========================================================================
    // TRIGGER 3: Building Argument Standard Push (Smooth S-Curve)
    // Uses Curve 1: The Standard Cinematic Push (180° Shutter Motion Blur)
    // =========================================================================
    if (
      sec.role === "explain" &&
      duration >= 8.0 &&
      sec.startSec - lastZoomEndSec >= MIN_ZOOM_GAP_SEC
    ) {
      const creepDuration = Math.min(8.0, duration * 0.8);
      const keyframes: ZoomKeyframe[] = [
        { timeOffsetMs: 0, scale: 1.0, interpolation: "ease_out", velocityHandleOut: [0.42, 0.0] },
        { timeOffsetMs: Math.round(creepDuration * 1000), scale: 1.09, interpolation: "ease_in", velocityHandleIn: [0.58, 1.0] },
      ];

      cues.push({
        zoomId: `zoom_${sec.sectionId}_standard_s_curve`,
        sectionId: sec.sectionId,
        startSec: sec.startSec,
        endSec: sec.startSec + creepDuration,
        durationSec: creepDuration,
        kind: "slow_creep_in",
        curveKind: "standard_cinematic_push",
        triggerCategory: "building_argument",
        startScale: 1.0,
        endScale: 1.09,
        keyframes,
        transformEffect: {
          effectName: "Transform",
          uncheckCompShutter: true,
          shutterAngleDeg: 180,
          motionBlur: true,
          anchorPointCrosshair: ANCHOR_CHEST,
        },
        cssBezier: "cubic-bezier(0.42, 0.0, 0.58, 1.0)",
        pairedSpokenSnippet: text.slice(0, 45),
        causalReason: "Curve 1: Standard Cinematic Push (Smooth S-Curve with flat velocity hill) building argumentative tension.",
        cause: {
          gate: "edit_move",
          reason: "standard push building argument",
          sectionId: sec.sectionId,
          timeSec: sec.startSec,
        },
      });
      lastZoomEndSec = sec.startSec + creepDuration;
      return;
    }

    // =========================================================================
    // TRIGGER 4: Audience Direct Address Punch
    // Uses Curve 2: Whiplash Fast-In, Slow-Out (180° Shutter Motion Blur)
    // =========================================================================
    if (
      AUDIENCE_ADDRESS_REGEX.test(text) &&
      sec.startSec - lastZoomEndSec >= MIN_ZOOM_GAP_SEC
    ) {
      const zoomDuration = Math.min(4.5, duration * 0.6);
      const keyframes: ZoomKeyframe[] = [
        { timeOffsetMs: 0, scale: 1.0, interpolation: "ease_out", velocityHandleOut: [0.12, 0.9] },
        { timeOffsetMs: Math.round(zoomDuration * 1000), scale: 1.14, interpolation: "ease_in", velocityHandleIn: [0.2, 1.0] },
      ];

      cues.push({
        zoomId: `zoom_${sec.sectionId}_audience_address`,
        sectionId: sec.sectionId,
        startSec: sec.startSec,
        endSec: sec.startSec + zoomDuration,
        durationSec: zoomDuration,
        kind: "audience_direct_address",
        curveKind: "whiplash_zoom",
        triggerCategory: "audience_address",
        startScale: 1.0,
        endScale: 1.14,
        keyframes,
        transformEffect: {
          effectName: "Transform",
          uncheckCompShutter: true,
          shutterAngleDeg: 180,
          motionBlur: true,
          anchorPointCrosshair: ANCHOR_EYES,
        },
        cssBezier: "cubic-bezier(0.12, 0.9, 0.2, 1.0)",
        pairedSpokenSnippet: text.slice(0, 45),
        causalReason: "Curve 2: Fast-In, Slow-Out Whiplash Zoom (1.14x) establishing intimate direct eye contact on viewer address.",
        cause: {
          gate: "edit_move",
          reason: "audience direct address",
          sectionId: sec.sectionId,
          timeSec: sec.startSec,
        },
      });
      lastZoomEndSec = sec.startSec + zoomDuration;
      return;
    }
  });

  const totalVideoDurationSec =
    sections.length > 0
      ? Math.max(...sections.map((s) => s.endSec))
      : 0;

  return {
    totalVideoDurationSec,
    cues,
    governance: {
      antiFatigueEnforced: true,
      minGapSec: MIN_ZOOM_GAP_SEC,
      maxZoomFactor: MAX_ZOOM_SCALE,
      returnToAuthorityMatched: cues.some(
        (c) => c.kind === "return_to_authority_punch",
      ),
      motionBlurValidated: cues.every(
        (c) =>
          c.transformEffect.motionBlur &&
          (c.transformEffect.shutterAngleDeg === 180 ||
            c.transformEffect.shutterAngleDeg === 360),
      ),
    },
  };
}
