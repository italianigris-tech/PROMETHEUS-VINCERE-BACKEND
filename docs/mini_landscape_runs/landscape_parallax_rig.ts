/**
 * MINI LANDSCAPE RUNS — 2.5D PARALLAX RIG (MIDGROUND + FOREGROUND PLACEMENT)
 *
 * This is the animation hand's placement responsibility, per the base setup:
 *
 *   foreground / midground / background  (the three-layer foundation)
 *
 *  - `background`  → RULED by the background system (`landscape_background_catalog`
 *    `scheduleBackgroundCoverages`). The animation hand only *references* that
 *    plane (source.owner = "background_system") — it never places it.
 *  - `midground`   → PLACED here (source.owner = "animation_hand"). Concept
 *    nodes, list/chart stages, workflow canvases, metaphor props — Z:10.
 *  - `foreground`  → PLACED here (source.owner = "animation_hand"). HUD chrome,
 *    grain / vignette / callout layer — Z:30.
 *
 * Each section gets a `ParallaxRigPlan` with three planes, monotonic depth
 * ratios (bg < mid < fg) and a bound camera move. The per-frame placement math
 * (`evaluatePlanePlacement`) is a pure function of the camera plan + frame, so
 * it renders deterministically on remote/Modal hardware and in the DOM PoC.
 */

import type {
  BackgroundCoveragePlan,
  BackgroundRig,
  CameraMovePlan,
  LandscapeSection,
  MetaphorTreatmentPoint,
  ParallaxPlane,
  ParallaxPlanePlacement,
  ParallaxPlaneRect,
  ParallaxRigPlan,
  PipInsetPlan,
} from "./types.js";
import { cameraProgress, computeParallaxOffsets } from "./landscape_camera_system.js";

export const PARALLAX_RATIOS = { background: 0.35, middleGround: 1.0, foreground: 1.65 } as const;

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  anchorX = 0.5,
  anchorY = 0.5,
): ParallaxPlaneRect {
  return { x, y, width, height, anchorX, anchorY };
}

// ---------------------------------------------------------------------------
// Placement rules (deterministic per role + coverage)
// ---------------------------------------------------------------------------

function midgroundRectFor(
  sec: LandscapeSection,
  coverage: BackgroundCoveragePlan | undefined,
  speakerOffsetX: number,
): ParallaxPlaneRect {
  const role = sec.role;
  const stageKind = coverage?.stageComposite?.stageKind;
  const text = sec.text || "";

  if (stageKind === "workflow_demo" || role === "demonstrate" || /(screen|workflow|dashboard|calendar|demo|ui)/i.test(text)) {
    // Workflow canvas on the side opposite the speaker (MAT-04: chrome not the plate).
    return speakerOffsetX >= 0.1
      ? rect(0.06, 0.16, 0.5, 0.6, 0.5, 0.5)
      : rect(0.44, 0.16, 0.5, 0.6, 0.5, 0.5);
  }
  if (stageKind === "chart_graph_stage" || /(\$|%|chart|graph|revenue|profit|surge|growth|metrics|10x)/i.test(text)) {
    return rect(0.07, 0.22, 0.38, 0.5, 0.5, 0.5);
  }
  if (stageKind === "list_stack_stage" || /(first|second|third|step|steps|list|pillar|pillars|items)/i.test(text)) {
    return rect(0.1, 0.14, 0.32, 0.66, 0.5, 0.5);
  }
  if (role === "hook" || role === "payoff") {
    return rect(0.3, 0.16, 0.4, 0.56, 0.5, 0.5);
  }
  if (role === "explain") {
    return rect(0.55, 0.24, 0.34, 0.5, 0.5, 0.5);
  }
  return rect(0.56, 0.5, 0.34, 0.36, 0.5, 0.5);
}

function midgroundContentHint(
  rig: BackgroundRig | undefined,
  metaphor: MetaphorTreatmentPoint | undefined,
  sec: LandscapeSection,
): string {
  if (metaphor?.recommendedAsset?.visualDescription) {
    return `metaphor prop: ${metaphor.recommendedAsset.assetName} — ${metaphor.recommendedAsset.visualDescription}`;
  }
  if (rig?.semanticConcept) {
    return `${rig.conceptAnimation || "concept"} stage — ${rig.semanticConcept}`;
  }
  return `midground support plane for ${sec.role}`;
}


// ---------------------------------------------------------------------------
// Rig builder
// ---------------------------------------------------------------------------

export interface ParallaxRigInputs {
  sections: LandscapeSection[];
  backgroundCoverages: BackgroundCoveragePlan[];
  backgroundRigs: BackgroundRig[];
  cameraMoves: CameraMovePlan[];
  pipInsets: PipInsetPlan[];
  metaphorTreatments?: MetaphorTreatmentPoint[];
}

/**
 * Builds one `ParallaxRigPlan` per section. Background is referenced from the
 * background system's coverage output; midground + foreground are placed by
 * this hand. Every plane carries a monotonic parallax ratio and a causal ref.
 */
export function buildParallaxRig(inputs: ParallaxRigInputs): ParallaxRigPlan[] {
  const { sections, backgroundCoverages, backgroundRigs, cameraMoves, pipInsets, metaphorTreatments } = inputs;

  return sections.map((sec) => {
    const coverage = backgroundCoverages.find((c) => c.sectionId === sec.sectionId);
    const rig = backgroundRigs.find((r) => r.sectionId === sec.sectionId);
    const cam = cameraMoves.find((c) => c.sectionId === sec.sectionId);
    const pip = pipInsets.find((p) => p.sectionId === sec.sectionId);
    const metaphor = metaphorTreatments?.find((m) => m.sectionId === sec.sectionId);
    const ratios = rig?.depthRatios ?? PARALLAX_RATIOS;
    const speakerOffsetX = coverage?.stageComposite?.speakerOffsetX ?? 0;

    const backgroundPlane: ParallaxPlane = {
      kind: "background",
      zDepth: 5,
      parallaxRatio: ratios.background,
      baseRect: rect(0, 0, 1, 1, 0.5, 0.5),
      contentHint: coverage ? `${coverage.coverageType} coverage plate` : "clean anchor plate",
      opacity: 1,
      source: { owner: "background_system", coverageId: coverage?.coverageId, rigId: rig?.rigId },
    };

    const midgroundPlane: ParallaxPlane = {
      kind: "midground",
      zDepth: 10,
      parallaxRatio: ratios.middleGround,
      baseRect: midgroundRectFor(sec, coverage, speakerOffsetX),
      contentHint: midgroundContentHint(rig, metaphor, sec),
      opacity: 1,
      source: { owner: "animation_hand", rigId: rig?.rigId, metaphorId: metaphor?.pointId },
    };

    const foregroundPlane: ParallaxPlane = {
      kind: "foreground",
      zDepth: 30,
      parallaxRatio: ratios.foreground,
      baseRect: rect(0, 0, 1, 1, 0.5, 0.5),
      contentHint: pip
        ? "foreground HUD chrome + grain; PiP inset rides this plane (MAT-04)"
        : "foreground grain / vignette / HUD callout layer",
      opacity: pip ? 0.7 : 0.5,
      source: { owner: "animation_hand", pipId: pip?.pipId },
    };

    return {
      rigId: `parallax_${sec.sectionId}`,
      sectionId: sec.sectionId,
      startSec: sec.startSec,
      endSec: sec.endSec,
      backgroundPlane,
      midgroundPlane,
      foregroundPlane,
      parallaxDepthRatios: { ...ratios },
      cameraMoveId: cam?.moveId,
      cause: {
        gate: "camera_move_trigger",
        reason: `2.5D parallax rig bound for ${sec.role}: bg plate (owned by background system) + midground + foreground planes.`,
        sectionId: sec.sectionId,
        timeSec: sec.startSec,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Per-frame placement (renderer-facing)
// ---------------------------------------------------------------------------

export function evaluatePlanePlacement(opts: {
  plane: ParallaxPlane;
  cameraPlan: CameraMovePlan;
  fps: number;
  frame: number;
  seed?: number;
}): ParallaxPlanePlacement {
  const { plane, cameraPlan, fps, frame, seed = 0 } = opts;
  const progress = cameraProgress(cameraPlan, fps, frame);
  const off = computeParallaxOffsets({
    plan: cameraPlan,
    progress,
    depthRatio: plane.parallaxRatio,
    seed,
  });

  const { x, y, width, height, anchorX, anchorY } = plane.baseRect;
  const w2 = width * off.scale;
  const h2 = height * off.scale;
  // Anchor-preserving scale + translate (percent-based).
  const x2 = x + anchorX * width - anchorX * w2 + off.dx;
  const y2 = y + anchorY * height - anchorY * h2 + off.dy;

  return {
    plane,
    rect: { x: x2, y: y2, width: w2, height: h2, anchorX, anchorY },
    translateX: off.dx,
    translateY: off.dy,
    scale: off.scale,
    rotationDeg: off.rotationDeg,
    opacity: plane.opacity,
  };
}
