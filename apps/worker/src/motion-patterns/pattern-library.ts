import type {CameraDirective, DeformationConfig, PatternPostProcess} from "@prometheus/shared-types";

export type ReferenceMotionPatternId =
  | "word-explosion"
  | "word-morph"
  | "word-carousel"
  | "per-word-choreography"
  | "typing-cursor"
  | "orbital-carousel"
  | "spiral-fan"
  | "stacked-pills"
  | "cursor-follow"
  | "logo-pulse";

export type PatternPhase = "entrance" | "hold" | "exit";
export type CameraCoupling = CameraDirective["type"] | "none";

export type PatternTimelineContext = {
  itemIndex: number;
  itemCount: number;
  beatIntensity?: number;
};

export type PatternTimelineSegment = {
  phase: PatternPhase;
  at: number;
  duration: number;
  ease: string;
  gsap: {
    from?: Record<string, unknown>;
    to: Record<string, unknown>;
  };
};

export type RenderCostEstimate = {
  relative: number;
  glyphBudget: number;
  particleBudget: number;
  postProcessPasses: number;
};

export type ReferenceMotionPattern = {
  id: ReferenceMotionPatternId;
  aliases: readonly string[];
  entranceDuration: number;
  holdDuration: number;
  exitDuration: number;
  stagger: number;
  deformation: DeformationConfig;
  postProcess: PatternPostProcess;
  cameraCoupling: CameraCoupling;
  renderCost: RenderCostEstimate;
  timelineFactory(context: PatternTimelineContext): PatternTimelineSegment[];
};

type PatternSpec = Omit<ReferenceMotionPattern, "timelineFactory"> & {
  entrance: PatternTimelineSegment["gsap"];
  hold: PatternTimelineSegment["gsap"];
  exit: PatternTimelineSegment["gsap"];
  ease: {
    entrance: string;
    hold: string;
    exit: string;
  };
};

const clampIndex = (context: PatternTimelineContext): number =>
  Math.max(0, Math.min(context.itemIndex, Math.max(context.itemCount - 1, 0)));

const makeTimelineFactory = (spec: PatternSpec): ReferenceMotionPattern["timelineFactory"] =>
  (context) => {
    const start = clampIndex(context) * spec.stagger;
    const holdAt = start + spec.entranceDuration;
    const exitAt = holdAt + spec.holdDuration;

    return [
      {
        phase: "entrance",
        at: start,
        duration: spec.entranceDuration,
        ease: spec.ease.entrance,
        gsap: spec.entrance
      },
      {
        phase: "hold",
        at: holdAt,
        duration: spec.holdDuration,
        ease: spec.ease.hold,
        gsap: spec.hold
      },
      {
        phase: "exit",
        at: exitAt,
        duration: spec.exitDuration,
        ease: spec.ease.exit,
        gsap: spec.exit
      }
    ];
  };

const definePattern = (spec: PatternSpec): ReferenceMotionPattern => ({
  ...spec,
  timelineFactory: makeTimelineFactory(spec)
});

export const REFERENCE_MOTION_PATTERNS: Readonly<Record<ReferenceMotionPatternId, ReferenceMotionPattern>> = {
  "word-explosion": definePattern({
    id: "word-explosion",
    aliases: ["word explosion", "radial scatter", "particle scatter"],
    entranceDuration: 0.18,
    holdDuration: 0.08,
    exitDuration: 0.42,
    stagger: 0.018,
    deformation: {type: "shatter", intensity: 0.9, frequency: 1.3, speed: 1.8, seed: 709},
    postProcess: {bloom: true, chromaticAberration: true, motionBlur: true},
    cameraCoupling: "snap",
    renderCost: {relative: 7, glyphBudget: 40, particleBudget: 120, postProcessPasses: 3},
    ease: {entrance: "back.out(1.8)", hold: "none", exit: "circ.out"},
    entrance: {from: {opacity: 0, scale: 0.8}, to: {opacity: 1, scale: 1}},
    hold: {to: {opacity: 1, scale: 1.05}},
    exit: {to: {opacity: 0, scale: 2.2, rotation: "random(-180, 180)", x: "radial", y: "radial"}}
  }),
  "word-morph": definePattern({
    id: "word-morph",
    aliases: ["word morph", "reassemble", "convergence"],
    entranceDuration: 0.32,
    holdDuration: 0.18,
    exitDuration: 0.28,
    stagger: 0.012,
    deformation: {type: "ripple", intensity: 0.45, frequency: 2.1, speed: 1.2, seed: 733},
    postProcess: {bloom: true, chromaticAberration: false, motionBlur: true},
    cameraCoupling: "push-in",
    renderCost: {relative: 6, glyphBudget: 50, particleBudget: 0, postProcessPasses: 2},
    ease: {entrance: "power4.out", hold: "none", exit: "power2.inOut"},
    entrance: {from: {opacity: 0, scale: 1.35, blur: 18}, to: {opacity: 1, scale: 1, blur: 0}},
    hold: {to: {opacity: 1}},
    exit: {to: {opacity: 0, scale: 0.92, blur: 12}}
  }),
  "word-carousel": definePattern({
    id: "word-carousel",
    aliases: ["word carousel", "cycling words", "directional blur"],
    entranceDuration: 0.24,
    holdDuration: 0.36,
    exitDuration: 0.2,
    stagger: 0.04,
    deformation: {type: "wave", intensity: 0.25, frequency: 1.8, speed: 1, seed: 751},
    postProcess: {bloom: false, chromaticAberration: true, motionBlur: true},
    cameraCoupling: "hold",
    renderCost: {relative: 4, glyphBudget: 18, particleBudget: 0, postProcessPasses: 2},
    ease: {entrance: "expo.out", hold: "none", exit: "power3.in"},
    entrance: {from: {opacity: 0, y: 32}, to: {opacity: 1, y: 0}},
    hold: {to: {opacity: 1, y: 0}},
    exit: {to: {opacity: 0, y: -32}}
  }),
  "per-word-choreography": definePattern({
    id: "per-word-choreography",
    aliases: ["per word choreography", "different pattern per word"],
    entranceDuration: 0.28,
    holdDuration: 0.18,
    exitDuration: 0.24,
    stagger: 0.035,
    deformation: {type: "wave", intensity: 0.2, frequency: 1.4, speed: 1.1, seed: 761},
    postProcess: {bloom: true, chromaticAberration: false, motionBlur: false},
    cameraCoupling: "drift",
    renderCost: {relative: 5, glyphBudget: 60, particleBudget: 30, postProcessPasses: 1},
    ease: {entrance: "back.out(1.3)", hold: "none", exit: "power2.in"},
    entrance: {from: {opacity: 0, y: "patterned", rotation: "patterned"}, to: {opacity: 1, y: 0, rotation: 0}},
    hold: {to: {opacity: 1}},
    exit: {to: {opacity: 0, y: -18}}
  }),
  "typing-cursor": definePattern({
    id: "typing-cursor",
    aliases: ["typing cursor", "character by character", "blink cursor"],
    entranceDuration: 0.08,
    holdDuration: 0.5,
    exitDuration: 0.16,
    stagger: 0.025,
    deformation: {type: "none", intensity: 0, frequency: 1, speed: 1, seed: 0},
    postProcess: {bloom: false, chromaticAberration: false, motionBlur: false},
    cameraCoupling: "hold",
    renderCost: {relative: 2, glyphBudget: 80, particleBudget: 0, postProcessPasses: 0},
    ease: {entrance: "steps(1)", hold: "none", exit: "power1.in"},
    entrance: {from: {opacity: 0}, to: {opacity: 1}},
    hold: {to: {cursorBlink: true}},
    exit: {to: {opacity: 0}}
  }),
  "orbital-carousel": definePattern({
    id: "orbital-carousel",
    aliases: ["orbital carousel", "3d product orbit", "logo orbit"],
    entranceDuration: 0.42,
    holdDuration: 0.9,
    exitDuration: 0.32,
    stagger: 0.06,
    deformation: {type: "ripple", intensity: 0.12, frequency: 0.8, speed: 0.7, seed: 809},
    postProcess: {bloom: true, chromaticAberration: false, motionBlur: true},
    cameraCoupling: "orbit",
    renderCost: {relative: 8, glyphBudget: 24, particleBudget: 40, postProcessPasses: 2},
    ease: {entrance: "power3.out", hold: "none", exit: "power2.inOut"},
    entrance: {from: {opacity: 0, z: -80, rotationY: -45}, to: {opacity: 1, z: 0, rotationY: 0}},
    hold: {to: {rotationY: 360}},
    exit: {to: {opacity: 0, z: 80}}
  }),
  "spiral-fan": definePattern({
    id: "spiral-fan",
    aliases: ["spiral fan", "card spiral", "3d card spiral gallery"],
    entranceDuration: 0.5,
    holdDuration: 0.4,
    exitDuration: 0.3,
    stagger: 0.045,
    deformation: {type: "none", intensity: 0, frequency: 1, speed: 1, seed: 0},
    postProcess: {bloom: true, chromaticAberration: false, motionBlur: true},
    cameraCoupling: "drift",
    renderCost: {relative: 8, glyphBudget: 8, particleBudget: 80, postProcessPasses: 2},
    ease: {entrance: "expo.out", hold: "none", exit: "power3.in"},
    entrance: {from: {opacity: 0, scale: 0.8, z: -120, rotationZ: -30}, to: {opacity: 1, scale: 1, z: "spiral", rotationZ: "fan"}},
    hold: {to: {opacity: 1}},
    exit: {to: {opacity: 0, scale: 0.86, z: 120}}
  }),
  "stacked-pills": definePattern({
    id: "stacked-pills",
    aliases: ["stacked pills", "z depth pills", "badge stack"],
    entranceDuration: 0.26,
    holdDuration: 0.48,
    exitDuration: 0.22,
    stagger: 0.032,
    deformation: {type: "wave", intensity: 0.08, frequency: 1.2, speed: 0.6, seed: 829},
    postProcess: {bloom: true, chromaticAberration: false, motionBlur: false},
    cameraCoupling: "push-in",
    renderCost: {relative: 4, glyphBudget: 20, particleBudget: 0, postProcessPasses: 1},
    ease: {entrance: "back.out(1.4)", hold: "none", exit: "power2.in"},
    entrance: {from: {opacity: 0, y: 20, z: -20}, to: {opacity: 1, y: 0, z: "stacked"}},
    hold: {to: {shadowAccumulation: true}},
    exit: {to: {opacity: 0, y: -16}}
  }),
  "cursor-follow": definePattern({
    id: "cursor-follow",
    aliases: ["cursor follow", "hand cursor", "click target"],
    entranceDuration: 0.2,
    holdDuration: 0.34,
    exitDuration: 0.18,
    stagger: 0,
    deformation: {type: "none", intensity: 0, frequency: 1, speed: 1, seed: 0},
    postProcess: {bloom: false, chromaticAberration: false, motionBlur: true},
    cameraCoupling: "hold",
    renderCost: {relative: 3, glyphBudget: 2, particleBudget: 20, postProcessPasses: 1},
    ease: {entrance: "power3.out", hold: "none", exit: "power2.in"},
    entrance: {from: {opacity: 0, x: -24, y: 24}, to: {opacity: 1, x: 0, y: 0}},
    hold: {to: {pressScale: 0.94, ripple: true}},
    exit: {to: {opacity: 0}}
  }),
  "logo-pulse": definePattern({
    id: "logo-pulse",
    aliases: ["logo pulse", "glow pulse", "logo outro"],
    entranceDuration: 0.32,
    holdDuration: 0.7,
    exitDuration: 0.28,
    stagger: 0,
    deformation: {type: "ripple", intensity: 0.16, frequency: 1, speed: 0.9, seed: 857},
    postProcess: {bloom: true, chromaticAberration: false, motionBlur: false},
    cameraCoupling: "pull-out",
    renderCost: {relative: 4, glyphBudget: 12, particleBudget: 24, postProcessPasses: 1},
    ease: {entrance: "back.out(1.2)", hold: "sine.inOut", exit: "power2.inOut"},
    entrance: {from: {opacity: 0, scale: 0.88}, to: {opacity: 1, scale: 1}},
    hold: {to: {scale: 1.04, glow: 1}},
    exit: {to: {opacity: 0, scale: 1.12}}
  })
} as const;

export const getMotionPattern = (id: ReferenceMotionPatternId): ReferenceMotionPattern =>
  REFERENCE_MOTION_PATTERNS[id];

export const composePatternTimeline = (
  pattern: ReferenceMotionPattern,
  context: PatternTimelineContext
): PatternTimelineSegment[] => pattern.timelineFactory(context);

export const selectPatternForTechnique = (technique: string): ReferenceMotionPattern | null => {
  const normalized = technique.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const pattern of Object.values(REFERENCE_MOTION_PATTERNS)) {
    if (pattern.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
      return pattern;
    }
  }

  return null;
};
