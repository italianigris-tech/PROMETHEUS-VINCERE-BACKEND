/**
 * MINI LANDSCAPE RUNS — PARALLAX MATH MIRROR (BROWSER SAFE)
 *
 * 1:1 plain-JS mirror of the camera + parallax math in `landscape_camera_system.ts`.
 * Deliberately contains ZERO TypeScript type syntax so it can be inlined verbatim
 * into the self-contained proof-of-concept HTML (`landscape_parallax_poc.ts`) and
 * executed by the browser.
 *
 * Drift guard: `tests/test_landscape_camera_and_parallax.ts` evaluates both this
 * mirror and the TS module over a grid of (kind × progress × ratio × intensity)
 * and fails the suite if any value differs. When you change the TS math you MUST
 * change this file identically.
 *
 * Public API:
 *   mirrorApplyEasing(easing, t)
 *   mirrorProgress(plan, fps, frame, specs)
 *   mirrorPose(plan, fps, frame, seed, specs)      -> { pose:{position,rotation,fov}, progress, rawProgress }
 *   mirrorOffsets(plan, progress, depthRatio, seed)-> { dx, dy, scale, rotationDeg }
 *   mirrorSpecsFromCatalog(catalog)                -> { kind: { easing, durationSec } }
 */

// @ts-nocheck

function mirrorClamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function mirrorEaseOutCubic(t) {
  return 1 - Math.pow(1 - mirrorClamp01(t), 3);
}

function mirrorEaseInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function mirrorApplyEasing(easing, t) {
  switch (easing) {
    case "easeOut":
      return mirrorEaseOutCubic(t);
    case "easeInOut":
      return mirrorEaseInOutCubic(t);
    default:
      return mirrorClamp01(t);
  }
}

function mirrorHashSeed(seed, salt) {
  let h = (seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function mirrorUnitNoise(seed, salt) {
  return (mirrorHashSeed(seed, salt) / 0xffffffff) * 2 - 1;
}

function mirrorProgress(plan, fps, frame, specs) {
  const span = Math.max(1, (plan.endSec - plan.startSec) * fps);
  const linear = mirrorClamp01((frame - plan.startSec * fps) / span);
  const spec = (specs || {})[plan.kind];
  return mirrorApplyEasing((spec && spec.easing) || "easeInOut", linear);
}

function mirrorPose(plan, fps, frame, seed, specs) {
  const progress = mirrorProgress(plan, fps, frame, specs);
  const rawProgress = mirrorClamp01(
    (frame - plan.startSec * fps) / Math.max(1, (plan.endSec - plan.startSec) * fps),
  );
  const pose = { position: [0, 0, 5], rotation: [0, 0, 0], fov: 45 };
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
      pose.position[0] = mirrorUnitNoise(seed, frame) * a;
      pose.position[1] = mirrorUnitNoise(seed, frame + 1013) * a * 0.7;
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

function mirrorOffsets(plan, progress, depthRatio, seed) {
  const i = plan.intensity;
  const p = progress;
  const r = depthRatio;
  const out = { dx: 0, dy: 0, scale: 1, rotationDeg: 0 };

  switch (plan.kind) {
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
    case "zoom_in":
      out.scale = 1 + 0.16 * i * p * r;
      break;
    case "zoom_out":
      out.scale = 1 - 0.12 * i * p * r;
      break;
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
    case "dutch_tilt":
      out.rotationDeg = -8 * i * p * (0.35 + 0.65 * (r / 1.65));
      break;
    case "roll_clockwise":
      out.rotationDeg = -14 * i * p * (0.35 + 0.65 * (r / 1.65));
      break;
    case "roll_counterclockwise":
      out.rotationDeg = 14 * i * p * (0.35 + 0.65 * (r / 1.65));
      break;
    case "crane_up":
      out.dy = 0.06 * i * p * r;
      out.scale = 1 + 0.05 * i * p * r;
      break;
    case "crane_down":
      out.dy = -0.06 * i * p * r;
      out.scale = 1 - 0.04 * i * p * r;
      break;
    case "tracking_follow":
      out.dx = -0.05 * i * Math.sin(p * Math.PI) * r;
      out.scale = 1 + 0.05 * i * p * r;
      break;
    case "shake": {
      const jx = mirrorUnitNoise(seed, 7);
      const jy = mirrorUnitNoise(seed, 23);
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

function mirrorSpecsFromCatalog(catalog) {
  const specs = {};
  catalog.forEach((def) => {
    specs[def.kind] = { easing: def.defaultEasing, durationSec: def.defaultDurationSec };
  });
  return specs;
}

// MIRROR_EXPORT_BOUNDARY — the PoC builder inlines everything above this line
// verbatim into the browser demo (this export line is stripped).
export const PARALLAX_MATH_MIRROR = {
  mirrorApplyEasing,
  mirrorProgress,
  mirrorPose,
  mirrorOffsets,
  mirrorSpecsFromCatalog,
};

