/**
 * MINI LANDSCAPE RUNS — LANDSCAPE CAMERA SYSTEM ("THE HAND")
 *
 * The camera + 2.5D parallax engine for the long-form / 16:9 studio. This is
 * the animation hand's motion core: it owns the cinematic camera catalog, the
 * per-frame camera pose math, the 2.5D parallax projection math, and the
 * per-section camera planner.
 *
 * Strategy (remote / Modal):
 *  - The render spine (Remotion + @react-three/fiber WebGL, baked headless on a
 *    Modal L4 GPU) is frame-synchronous. A camera move is NOT interactive — it
 *    is a pure function of `frame`. So pan / tilt / zoom / truck / pedestal /
 *    dolly / crane / roll all render deterministically on remote hardware.
 *  - This module is pure math with zero three.js / WebGL / DOM dependencies, so
 *    it can drive BOTH the WebGL spine (via the landscape-to-unified bridge)
 *    AND the self-contained DOM proof-of-concept
 *    (landscape_parallax_poc.ts → out/landscape_parallax_poc.html).
 *  - The same math is mirrored 1:1 in landscape_parallax_math_mirror.ts (plain
 *    JS, no TS types) so the PoC can run it in the browser; a test asserts the
 *    mirror and this module agree over a grid of (kind, progress, ratio).
 *
 * Parallax model (2.5D):
 *  - Velocity ratios per depth plane: background 0.35x · midground 1.0x ·
 *    foreground 1.65x. A plane's screen offset under a camera move is
 *    proportional to its ratio.
 *  - Physically-honest split:
 *      * Translation moves (truck / pedestal / dolly / crane / tracking /
 *        drift / shake) → real parallax: near planes shift more (∝ ratio).
 *      * Head rotation (pan / tilt) → the whole world shifts uniformly (a pure
 *        rotation produces no depth separation — a true coupling).
 *      * Lens zoom → magnification: near planes magnify faster (∝ ratio),
 *        the standard 2.5D "parallax zoom".
 *      * Roll / Dutch → plane counter-rotation, foreground rolls most.
 */

import type {
  CameraMoveKind,
  CameraMovePlan,
  CameraPose,
  CameraPoseEvaluation,
  EditMove,
  LandscapeSection,
} from "./types.js";

export type CameraEasing = "linear" | "easeOut" | "easeInOut";

export type CameraMoveFamily =
  | "lens"
  | "head_rotation"
  | "rig_translation"
  | "crane"
  | "handheld"
  | "composite"
  | "static";

export interface CameraMoveDefinition {
  kind: CameraMoveKind;
  label: string;
  family: CameraMoveFamily;
  defaultDurationSec: number;
  defaultEasing: CameraEasing;
  defaultIntensity: number;
  description: string;
}

/**
 * The full cinematic catalog — the union of every camera movement the studio
 * can execute. This is the "list of all possible camera movements" made real.
 */
export const CAMERA_MOVE_CATALOG: readonly CameraMoveDefinition[] = [
  // Head rotation moves (fixed point, aim changes)
  { kind: "pan_left", label: "Pan Left", family: "head_rotation", defaultDurationSec: 2.2, defaultEasing: "easeInOut", defaultIntensity: 0.5, description: "Rotate the aim left from a fixed point." },
  { kind: "pan_right", label: "Pan Right", family: "head_rotation", defaultDurationSec: 2.2, defaultEasing: "easeInOut", defaultIntensity: 0.5, description: "Rotate the aim right from a fixed point." },
  { kind: "tilt_up", label: "Tilt Up", family: "head_rotation", defaultDurationSec: 2.2, defaultEasing: "easeInOut", defaultIntensity: 0.5, description: "Rotate the aim up from a fixed point." },
  { kind: "tilt_down", label: "Tilt Down", family: "head_rotation", defaultDurationSec: 2.2, defaultEasing: "easeInOut", defaultIntensity: 0.5, description: "Rotate the aim down from a fixed point." },
  // Lens moves (focal-length driven, camera stays put)
  { kind: "zoom_in", label: "Zoom In", family: "lens", defaultDurationSec: 2.4, defaultEasing: "easeInOut", defaultIntensity: 0.7, description: "Lens zooms in — subject appears closer (fov decreases)." },
  { kind: "zoom_out", label: "Zoom Out", family: "lens", defaultDurationSec: 2.4, defaultEasing: "easeInOut", defaultIntensity: 0.7, description: "Lens zooms out — subject appears farther (fov increases)." },
  // Rig translation moves (the whole rig physically moves)
  { kind: "truck_left", label: "Truck Left", family: "rig_translation", defaultDurationSec: 2.6, defaultEasing: "easeInOut", defaultIntensity: 0.6, description: "The entire camera rig moves left." },
  { kind: "truck_right", label: "Truck Right", family: "rig_translation", defaultDurationSec: 2.6, defaultEasing: "easeInOut", defaultIntensity: 0.6, description: "The entire camera rig moves right." },
  { kind: "pedestal_up", label: "Pedestal Up", family: "rig_translation", defaultDurationSec: 2.4, defaultEasing: "easeInOut", defaultIntensity: 0.55, description: "The entire camera rig moves up." },
  { kind: "pedestal_down", label: "Pedestal Down", family: "rig_translation", defaultDurationSec: 2.4, defaultEasing: "easeInOut", defaultIntensity: 0.55, description: "The entire camera rig moves down." },
  { kind: "dolly_in", label: "Dolly In", family: "rig_translation", defaultDurationSec: 2.6, defaultEasing: "easeInOut", defaultIntensity: 0.8, description: "The entire camera rig moves forward toward the subject." },
  { kind: "dolly_out", label: "Dolly Out", family: "rig_translation", defaultDurationSec: 2.6, defaultEasing: "easeInOut", defaultIntensity: 0.6, description: "The entire camera rig moves backward away from the subject." },
  { kind: "push_in", label: "Push In", family: "rig_translation", defaultDurationSec: 2.0, defaultEasing: "easeOut", defaultIntensity: 0.8, description: "Fast emphatic dolly-in punch with a slight yaw settle." },
  // Handheld / instability
  { kind: "shake", label: "Handheld Shake", family: "handheld", defaultDurationSec: 0.6, defaultEasing: "linear", defaultIntensity: 0.6, description: "Seeded handheld instability jitter." },
  // Roll / Dutch (rotation about the lens axis)
  { kind: "dutch_tilt", label: "Dutch Tilt", family: "head_rotation", defaultDurationSec: 1.8, defaultEasing: "easeInOut", defaultIntensity: 0.6, description: "Sideways tilt conveying confusion / instability." },
  { kind: "roll_clockwise", label: "Roll Clockwise", family: "head_rotation", defaultDurationSec: 2.0, defaultEasing: "easeInOut", defaultIntensity: 0.55, description: "Roll the horizon clockwise." },
  { kind: "roll_counterclockwise", label: "Roll Counter-Clockwise", family: "head_rotation", defaultDurationSec: 2.0, defaultEasing: "easeInOut", defaultIntensity: 0.55, description: "Roll the horizon counter-clockwise." },
  // Crane / Boom (elevation + gentle depth correction)
  { kind: "crane_up", label: "Crane Up", family: "crane", defaultDurationSec: 3.0, defaultEasing: "easeInOut", defaultIntensity: 0.65, description: "Crane/boom rises while gently pulling back to preserve framing." },
  { kind: "crane_down", label: "Crane Down", family: "crane", defaultDurationSec: 3.0, defaultEasing: "easeInOut", defaultIntensity: 0.6, description: "Crane/boom descends while gently pushing in." },
  // Dynamic / composite
  { kind: "tracking_follow", label: "Tracking Follow", family: "composite", defaultDurationSec: 3.2, defaultEasing: "easeInOut", defaultIntensity: 0.5, description: "Camera tracks a moving subject; the world parallaxes behind it." },
  { kind: "cinematic_drift", label: "Cinematic Drift", family: "composite", defaultDurationSec: 3.6, defaultEasing: "easeOut", defaultIntensity: 0.4, description: "Slow continuous lateral drift across the stage plane." },
  // Static
  { kind: "static", label: "Static", family: "static", defaultDurationSec: 2.0, defaultEasing: "linear", defaultIntensity: 0.0, description: "No movement — a stable anchor (return-to-authority resting state)." },
] as const;

export const CAMERA_MOVE_DEFINITION: Readonly<Record<CameraMoveKind, CameraMoveDefinition>> = Object.fromEntries(
  CAMERA_MOVE_CATALOG.map((def) => [def.kind, def]),
) as Record<CameraMoveKind, CameraMoveDefinition>;

export const CAMERA_KINDS: readonly CameraMoveKind[] = CAMERA_MOVE_CATALOG.map((def) => def.kind);



// ---------------------------------------------------------------------------
// Math utilities
// ---------------------------------------------------------------------------

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const BASE_CAMERA: CameraPose = { position: [0, 0, 5], rotation: [0, 0, 0], fov: 45 };

export function applyEasing(easing: CameraEasing, t: number): number {
  switch (easing) {
    case "easeOut":
      return easeOutCubic(t);
    case "easeInOut":
      return easeInOutCubic(t);
    default:
      return clamp01(t);
  }
}

function hashSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

const unitNoise = (seed: number, salt: number): number =>
  (hashSeed(seed, salt) / 0xffffffff) * 2 - 1;

// ---------------------------------------------------------------------------
// Per-frame evaluation
// ---------------------------------------------------------------------------

export function cameraProgress(plan: CameraMovePlan, fps: number, frame: number): number {
  const span = Math.max(1, (plan.endSec - plan.startSec) * fps);
  const linear = clamp01((frame - plan.startSec * fps) / span);
  const spec = CAMERA_MOVE_DEFINITION[plan.kind];
  return applyEasing(spec?.defaultEasing ?? "easeInOut", linear);
}

/**
 * Resolves the full 3D camera pose at `frame` for a camera move plan. Purely
 * deterministic — same plan + fps + frame + seed always produces the same pose,
 * which is what makes camera movement safe to run on remote/Modal rendering.
 */
export function evaluateCameraPose(
  plan: CameraMovePlan,
  fps: number,
  frame: number,
  seed: number,
): CameraPoseEvaluation {
  const progress = cameraProgress(plan, fps, frame);
  const rawProgress = clamp01(
    (frame - plan.startSec * fps) / Math.max(1, (plan.endSec - plan.startSec) * fps),
  );
  const pose: CameraPose = {
    position: [0, 0, 5],
    rotation: [0, 0, 0],
    fov: 45,
  };
  const i = plan.intensity;
  const p = progress;

  switch (plan.kind) {
    case "pan_left":
      pose.rotation[1] = 0.45 * i * p;
      break;
    case "pan_right":
      pose.rotation[1] = -0.45 * i * p;
      break;
    case "tilt_up":
      pose.rotation[0] = 0.32 * i * p;
      break;
    case "tilt_down":
      pose.rotation[0] = -0.32 * i * p;
      break;
    case "zoom_in":
      pose.fov = 45 - 16 * i * p;
      break;
    case "zoom_out":
      pose.fov = 45 + 18 * i * p;
      break;
    case "truck_left":
      pose.position[0] = -0.9 * i * p;
      break;
    case "truck_right":
      pose.position[0] = 0.9 * i * p;
      break;
    case "pedestal_up":
      pose.position[1] = 0.55 * i * p;
      break;
    case "pedestal_down":
      pose.position[1] = -0.55 * i * p;
      break;
    case "dolly_in":
      pose.position[2] = 5 - 2.8 * i * p;
      break;
    case "dolly_out":
      pose.position[2] = 5 + 2.6 * i * p;
      break;
    case "push_in":
      pose.position[2] = 5 - 3.4 * i * p;
      pose.rotation[1] = 0.04 * i * p;
      break;
    case "shake": {
      const a = 0.05 + 0.1 * i * p;
      pose.position[0] = unitNoise(seed, frame) * a;
      pose.position[1] = unitNoise(seed, frame + 1013) * a * 0.7;
      break;
    }
    case "dutch_tilt":
      pose.rotation[2] = 0.22 * i * p;
      break;
    case "roll_clockwise":
      pose.rotation[2] = 0.32 * i * p;
      break;
    case "roll_counterclockwise":
      pose.rotation[2] = -0.32 * i * p;
      break;
    case "crane_up":
      pose.position[1] = 1.7 * i * p;
      pose.position[2] = 5 + 0.5 * i * p;
      break;
    case "crane_down":
      pose.position[1] = -1.7 * i * p;
      pose.position[2] = 5 - 0.4 * i * p;
      break;
    case "tracking_follow":
      pose.position[0] = Math.sin(p * Math.PI) * 0.85 * i;
      pose.position[2] = 5 - 0.5 * i * p;
      break;
    case "cinematic_drift":
      pose.position[0] = 0.35 * i * p;
      pose.position[1] = -0.08 * i * p;
      break;
    case "static":
    case "none":
      break;
  }

  return { pose, progress, rawProgress };
}

export interface ParallaxPlaneOffset {
  /** Fraction of canvas width (positive = right). */
  dx: number;
  /** Fraction of canvas height (positive = down). */
  dy: number;
  /** Scale multiplier (1 = identity). */
  scale: number;
  /** Rotation in degrees (positive = clockwise). */
  rotationDeg: number;
}

/**
 * 2.5D parallax projection for one depth plane under a camera move.
 *
 * Physically-honest rules:
 *  - Rig translation (truck/pedestal/dolly/crane/tracking/drift/shake):
 *    near planes shift more — offset ∝ depth ratio. This is REAL parallax.
 *  - Head rotation (pan/tilt): the whole world shifts uniformly (a pure
 *    rotation produces no depth separation). Ratio is ignored on purpose.
 *  - Lens zoom: near planes magnify faster (∝ ratio) — 2.5D "parallax zoom".
 *  - Roll/Dutch: planes counter-rotate; the foreground rolls the most.
 */
export function computeParallaxOffsets(opts: {
  plan: CameraMovePlan;
  progress: number;
  depthRatio: number;
  seed?: number;
}): ParallaxPlaneOffset {
  const { plan, progress, depthRatio, seed = 0 } = opts;
  const i = plan.intensity;
  const p = progress;
  const r = depthRatio;
  const out: ParallaxPlaneOffset = { dx: 0, dy: 0, scale: 1, rotationDeg: 0 };

  switch (plan.kind) {
    // Head rotations → uniform world shift, opposite the yaw/pitch direction.
    case "pan_left":
      out.dx = 0.05 * i * p;
      break;
    case "pan_right":
      out.dx = -0.05 * i * p;
      break;
    case "tilt_up":
      out.dy = 0.05 * i * p;
      break;
    case "tilt_down":
      out.dy = -0.05 * i * p;
      break;
    // Lens zoom → ratio-scaled magnification.
    case "zoom_in":
      out.scale = 1 + 0.16 * i * p * r;
      break;
    case "zoom_out":
      out.scale = 1 - 0.12 * i * p * r;
      break;
    // Rig translation → real parallax, ∝ ratio, opposite the rig direction.
    case "truck_left":
      out.dx = 0.055 * i * p * r;
      break;
    case "truck_right":
      out.dx = -0.055 * i * p * r;
      break;
    case "pedestal_up":
      out.dy = -0.055 * i * p * r;
      break;
    case "pedestal_down":
      out.dy = 0.055 * i * p * r;
      break;
    // Dolly → near planes grow faster + gentle outward drift.
    case "dolly_in":
      out.scale = 1 + 0.18 * i * p * r;
      out.dx = -0.01 * i * p * r;
      break;
    case "dolly_out":
      out.scale = 1 - 0.12 * i * p * r;
      out.dx = 0.01 * i * p * r;
      break;
    case "push_in":
      out.scale = 1 + 0.22 * i * p * r;
      break;
    // Roll / Dutch → counter-rotation, foreground rolls most.
    case "dutch_tilt":
      out.rotationDeg = -8 * i * p * (0.35 + 0.65 * (r / 1.65));
      break;
    case "roll_clockwise":
      out.rotationDeg = -14 * i * p * (0.35 + 0.65 * (r / 1.65));
      break;
    case "roll_counterclockwise":
      out.rotationDeg = 14 * i * p * (0.35 + 0.65 * (r / 1.65));
      break;
    // Crane → vertical drift + gentle scale, ∝ ratio.
    case "crane_up":
      out.dy = 0.06 * i * p * r;
      out.scale = 1 + 0.05 * i * p * r;
      break;
    case "crane_down":
      out.dy = -0.06 * i * p * r;
      out.scale = 1 - 0.04 * i * p * r;
      break;
    // Tracking → horizontal drift opposite the follow, ∝ ratio.
    case "tracking_follow":
      out.dx = -0.05 * i * Math.sin(p * Math.PI) * r;
      out.scale = 1 + 0.05 * i * p * r;
      break;
    // Shake → seeded jitter, near planes shake most.
    case "shake": {
      const jx = unitNoise(seed, 7);
      const jy = unitNoise(seed, 23);
      out.dx = jx * 0.012 * r * (0.5 + i * p);
      out.dy = jy * 0.008 * r * (0.5 + i * p);
      break;
    }
    case "cinematic_drift":
      out.dx = -0.025 * i * p * r;
      out.dy = 0.012 * i * p * r;
      break;
    case "static":
    case "none":
      break;
  }

  return out;
}


// ---------------------------------------------------------------------------
// Per-section camera planner
// ---------------------------------------------------------------------------

export interface CameraPlannerOptions {
  /** 0..1 — scales intensity + duration of every move (creativeProfile.cameraAggression). */
  cameraAggression?: number;
  hasMattedPrincipalSpeaker?: boolean;
}

const NEGATIVE_REGEX = /(broke|broken|fail|failure|collapse|lost|losing|drop|down|ruin|emergency|crisis|awful|worst|risk|scared|missed|gave out)/i;
const LIST_REGEX = /(first|second|third|step|steps|list|pillar|pillars|items|one|two|three)/i;
const GRAPH_REGEX = /(\$|%|chart|graph|revenue|profit|surge|growth|metrics|10x|double|scale)/i;

/**
 * Allocates one camera move per section from the full catalog — budgeted by
 * camera aggression, role intent, semantic content and fatigue (Joseph policy).
 * Every section receives a plan (even `static`), so the manifest stays 1:1 with
 * the section graph (BUD-04 spirit).
 */
export function decideLandscapeCameraMoves(
  sections: LandscapeSection[],
  editMoves: EditMove[],
  typographyMoveIds: string[],
  opts: CameraPlannerOptions = {},
): CameraMovePlan[] {
  const aggression = clamp01(opts.cameraAggression ?? 0.4);
  const plans: CameraMovePlan[] = [];

  sections.forEach((sec, idx) => {
    const moves = editMoves.filter((m) => m.sectionId === sec.sectionId);
    const text = sec.text || "";
    const hasValue = moves.some((m) => m.moveId === "value_contrast");
    const hasThesis = moves.some((m) => m.moveId === "thesis_punctuation");
    const hasKeyword = moves.some((m) => m.moveId === "emphasize_keyword");
    const hasCta = moves.some((m) => m.moveId === "cta_pressure");
    const hasReturn = moves.some((m) => m.moveId === "return_to_authority");
    const hasWorkflow = moves.some((m) => m.moveId === "explain_workflow");
    const isNegative = NEGATIVE_REGEX.test(text);
    const isList = LIST_REGEX.test(text);
    const isGraph = GRAPH_REGEX.test(text);
    const pairedWithText = moves.some((m) => typographyMoveIds.includes(m.moveId));

    let kind: CameraMoveKind = "cinematic_drift";
    let intensity = 0.35;
    let intent = "Gentle continuous cinematic drift across the stage plane.";

    if (sec.role === "hook") {
      kind = "dolly_in";
      intensity = 0.85;
      intent = "Fast dolly-in creates narrative gravity and depth on hook entry.";
    } else if (isNegative) {
      kind = "dutch_tilt";
      intensity = 0.6;
      intent = "Dutch tilt destabilizes the frame for the negative / crisis beat.";
    } else if (hasThesis) {
      kind = "push_in";
      intensity = 0.8;
      intent = "Push-in punch into the thesis with 2.5D parallax separation.";
    } else if (hasValue || isGraph) {
      kind = "zoom_in";
      intensity = 0.72;
      intent = "Lens zoom concentrates attention on the metric; near planes magnify faster.";
    } else if (hasWorkflow || sec.role === "demonstrate" || isList) {
      kind = "truck_right";
      intensity = 0.6;
      intent = "Horizontal truck reveals stage components left-to-right with depth separation.";
    } else if (sec.role === "payoff") {
      kind = "crane_up";
      intensity = 0.65;
      intent = "Closing crane-up lifts the frame and opens the payoff.";
    } else if (hasCta || sec.role === "outro") {
      kind = "dolly_in";
      intensity = 0.55;
      intent = "Subtle dolly-in applies CTA pressure.";
    } else if (hasReturn) {
      kind = "dolly_out";
      intensity = 0.5;
      intent = "Pull back to re-anchor attention on the host (return to authority).";
    } else if (hasKeyword) {
      kind = "push_in";
      intensity = 0.55;
      intent = "Emphasis push synchronized with the typography keyframe.";
    } else if (sec.fatigueRisk >= 0.65) {
      kind = "cinematic_drift";
      intensity = 0.45;
      intent = "Slow cinematic drift breaks visual fatigue across a long analytical beat.";
    } else if (sec.role === "setup") {
      kind = "tracking_follow";
      intensity = 0.5;
      intent = "Tracking follow keeps the host anchored while the world parallaxes behind.";
    } else if (idx % 5 === 1) {
      kind = "pan_right";
      intensity = 0.5;
      intent = "Authority pan surveys the stage plane.";
    } else if (idx % 7 === 3) {
      kind = "pedestal_up";
      intensity = 0.5;
      intent = "Pedestal rise reveals the upper field for the concept stack.";
    } else {
      kind = "cinematic_drift";
      intensity = 0.35;
      intent = "Restrained cinematic drift keeps the frame alive without stealing focus.";
    }

    // Budget: camera aggression scales spend (0.6x..1.15x) but never exceeds 1.
    intensity = Math.min(1, intensity * (0.6 + 0.55 * aggression));
    const spec = CAMERA_MOVE_DEFINITION[kind];
    const duration = Math.min(
      sec.durationSec,
      Math.max(1.2, spec.defaultDurationSec * (0.8 + 0.4 * aggression)),
    );

    plans.push({
      moveId: `cam_${sec.sectionId}_${kind}`,
      sectionId: sec.sectionId,
      startSec: sec.startSec,
      endSec: Math.min(sec.endSec, sec.startSec + duration),
      kind,
      intensity: Math.round(intensity * 100) / 100,
      parallaxDepthRatios: { background: 0.35, middleGround: 1.0, foreground: 1.65 },
      pairedWithText,
      pairedTextSnippet: pairedWithText && sec.text ? sec.text.slice(0, 36) : undefined,
      causalIntent: intent,
      cause: {
        gate: "camera_move_trigger",
        reason: `${intent} [${kind} @ ${Math.round(intensity * 100)}%]`,
        sectionId: sec.sectionId,
        timeSec: sec.startSec,
      },
    });
  });

  return plans;
}

