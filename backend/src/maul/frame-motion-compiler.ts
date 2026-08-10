import {
  maulFrameMotionProgramSchema,
  type MaulFrameMotionEasing,
  type MaulFrameMotionProgram,
  type MaulFrameMotionTransform,
} from "@prometheus/shared-types";

type MotionFamily =
  | "rise"
  | "blur_lift"
  | "focus_lock"
  | "split"
  | "arc"
  | "dual_rise"
  | "orbit"
  | "blade"
  | "script_glide"
  | "banner"
  | "outline"
  | "depth"
  | "chromatic"
  | "stagger"
  | "mask"
  | "impact"
  | "drop"
  | "elastic"
  | "fog"
  | "typing"
  | "underline"
  | "highlight"
  | "capsule"
  | "marker"
  | "glow"
  | "weight"
  | "handoff"
  | "bracket"
  | "rail"
  | "drift";

export type MaulMotionCapability = {
  treatmentId: string;
  executorId: string;
  unit: "word" | "letter";
  family: MotionFamily;
  envelope: {
    maxTranslateXPx: number;
    maxTranslateYPx: number;
    maxScale: number;
    maxBlurPx: number;
  };
};

export type CompileMaulWordMotionInput = {
  treatmentId: string;
  token: {
    tokenId: string;
    text: string;
    sourceStartMs: number;
    sourceEndMs: number;
  };
  outputStartMs: number;
  outputEndMs: number;
  fps: number;
  placementSegmentId: string;
};

const gsapTreatments = [
  ["agentic_split_rise", "letter", "split"],
  ["interesting_blur_lift", "letter", "blur_lift"],
  ["cinematic_focus_lock", "word", "focus_lock"],
  ["generic_single_word", "word", "rise"],
  ["two_word_cinematic_pair", "word", "split"],
  ["two_word_stagger_punch", "word", "impact"],
  ["two_word_arc_sweep", "word", "arc"],
  ["two_word_dual_rise", "word", "dual_rise"],
  ["two_word_focus_pivot", "word", "focus_lock"],
  ["three_word_serif_orbit", "word", "orbit"],
  ["three_word_tall_blade", "word", "blade"],
  ["three_word_script_glide", "word", "script_glide"],
  ["three_word_ref_lockup", "word", "focus_lock"],
  ["three_word_ref_last_punch", "word", "impact"],
  ["three_word_ref_through_column", "word", "mask"],
  ["three_word_ref_script_tag", "word", "script_glide"],
  ["three_word_ref_dream_big_now_v1", "word", "banner"],
  ["three_word_ref_your_master_mind_v1", "word", "outline"],
  ["three_word_ref_take_action_now_v1", "word", "impact"],
  ["three_word_ref_build_legacy_your_v1", "word", "depth"],
  ["four_word_banner_drift", "word", "banner"],
  ["four_word_split_stagger", "word", "stagger"],
  ["four_word_serif_pivot", "word", "script_glide"],
  ["four_word_outline_whip", "word", "outline"],
  ["six_word_quad_duo_depth", "word", "depth"],
  ["two_word_script_caption_lock", "word", "script_glide"],
] as const;

const svgTreatments = [
  ["cinematic_text_preset", "letter", "chromatic"],
  ["cinematic_text_preset_1", "letter", "stagger"],
  ["cinematic_text_preset_2", "word", "script_glide"],
  ["cinematic_text_preset_3", "letter", "mask"],
  ["cinematic_text_preset_4", "word", "mask"],
  ["cinematic_text_preset_5", "word", "impact"],
  ["cinematic_text_preset_6", "letter", "drop"],
  ["cinematic_text_preset_7", "word", "blur_lift"],
  ["cinematic_text_preset_8", "word", "elastic"],
  ["cinematic_text_preset_9", "word", "fog"],
  ["cinematic_text_preset_10", "letter", "stagger"],
  ["cinematic_text_preset_11", "letter", "typing"],
] as const;

const josephTreatments = [
  ["text-entry.word-riser", "word", "rise"],
  ["text-entry.letter-riser", "letter", "rise"],
  ["text-entry.soft-letter-tracking", "letter", "stagger"],
  ["text-entry.velocity-slide-reveal", "word", "split"],
  ["text-entry.clipped-mask-reveal", "word", "mask"],
  ["text-emphasis.underline-reveal", "word", "underline"],
  ["text-emphasis.sweep-highlight", "word", "highlight"],
  ["text-emphasis.capsule-highlight", "word", "capsule"],
  ["text-emphasis.marker-stroke", "word", "marker"],
  ["text-emphasis.semantic-glow", "word", "glow"],
  ["text-mutation.weight-escalation", "word", "weight"],
  ["text-mutation.emphasis-handoff", "word", "handoff"],
  ["accent-motion.bracket-lock", "word", "bracket"],
  ["accent-motion.caption-rail", "word", "rail"],
  ["spatial-motion.anchored-drift", "word", "drift"],
] as const;

const capabilityFor = (
  treatmentId: string,
  executorPrefix: string,
  unit: "word" | "letter",
  family: MotionFamily,
): MaulMotionCapability => {
  const envelopeByFamily: Record<MotionFamily, MaulMotionCapability["envelope"]> = {
    rise: {maxTranslateXPx: 0, maxTranslateYPx: 72, maxScale: 1.04, maxBlurPx: 8},
    blur_lift: {maxTranslateXPx: 0, maxTranslateYPx: 48, maxScale: 1, maxBlurPx: 14},
    focus_lock: {maxTranslateXPx: 0, maxTranslateYPx: 0, maxScale: 1.08, maxBlurPx: 9},
    split: {maxTranslateXPx: 96, maxTranslateYPx: 72, maxScale: 1.06, maxBlurPx: 10},
    arc: {maxTranslateXPx: 128, maxTranslateYPx: 48, maxScale: 1.08, maxBlurPx: 11},
    dual_rise: {maxTranslateXPx: 64, maxTranslateYPx: 72, maxScale: 1.08, maxBlurPx: 10},
    orbit: {maxTranslateXPx: 112, maxTranslateYPx: 84, maxScale: 1.08, maxBlurPx: 11},
    blade: {maxTranslateXPx: 96, maxTranslateYPx: 74, maxScale: 1.08, maxBlurPx: 9},
    script_glide: {maxTranslateXPx: 48, maxTranslateYPx: 44, maxScale: 1.04, maxBlurPx: 9},
    banner: {maxTranslateXPx: 84, maxTranslateYPx: 32, maxScale: 1.05, maxBlurPx: 8},
    outline: {maxTranslateXPx: 112, maxTranslateYPx: 32, maxScale: 1.05, maxBlurPx: 8},
    depth: {maxTranslateXPx: 64, maxTranslateYPx: 52, maxScale: 1.12, maxBlurPx: 12},
    chromatic: {maxTranslateXPx: 0, maxTranslateYPx: 28, maxScale: 1.04, maxBlurPx: 6},
    stagger: {maxTranslateXPx: 28, maxTranslateYPx: 42, maxScale: 1.04, maxBlurPx: 8},
    mask: {maxTranslateXPx: 20, maxTranslateYPx: 28, maxScale: 1.02, maxBlurPx: 4},
    impact: {maxTranslateXPx: 132, maxTranslateYPx: 28, maxScale: 1.14, maxBlurPx: 10},
    drop: {maxTranslateXPx: 24, maxTranslateYPx: 72, maxScale: 1.05, maxBlurPx: 8},
    elastic: {maxTranslateXPx: 24, maxTranslateYPx: 24, maxScale: 1.2, maxBlurPx: 6},
    fog: {maxTranslateXPx: 0, maxTranslateYPx: 24, maxScale: 1.03, maxBlurPx: 13},
    typing: {maxTranslateXPx: 0, maxTranslateYPx: 12, maxScale: 1, maxBlurPx: 5},
    underline: {maxTranslateXPx: 0, maxTranslateYPx: 8, maxScale: 1.03, maxBlurPx: 4},
    highlight: {maxTranslateXPx: 18, maxTranslateYPx: 8, maxScale: 1.06, maxBlurPx: 4},
    capsule: {maxTranslateXPx: 16, maxTranslateYPx: 10, maxScale: 1.12, maxBlurPx: 4},
    marker: {maxTranslateXPx: 24, maxTranslateYPx: 8, maxScale: 1.08, maxBlurPx: 3},
    glow: {maxTranslateXPx: 0, maxTranslateYPx: 8, maxScale: 1.06, maxBlurPx: 10},
    weight: {maxTranslateXPx: 0, maxTranslateYPx: 0, maxScale: 1.1, maxBlurPx: 2},
    handoff: {maxTranslateXPx: 32, maxTranslateYPx: 8, maxScale: 1.08, maxBlurPx: 4},
    bracket: {maxTranslateXPx: 14, maxTranslateYPx: 8, maxScale: 1.03, maxBlurPx: 2},
    rail: {maxTranslateXPx: 18, maxTranslateYPx: 6, maxScale: 1.02, maxBlurPx: 2},
    drift: {maxTranslateXPx: 14, maxTranslateYPx: 10, maxScale: 1.02, maxBlurPx: 3},
  };
  return {
    treatmentId,
    executorId: `${executorPrefix}:${treatmentId}`,
    unit,
    family,
    envelope: envelopeByFamily[family],
  };
};

export const MAUL_FRAME_MOTION_CAPABILITIES: readonly MaulMotionCapability[] = [
  ...gsapTreatments.map(([treatmentId, unit, family]) => capabilityFor(treatmentId, "gsap", unit, family)),
  ...svgTreatments.map(([treatmentId, unit, family]) => capabilityFor(treatmentId, "svg", unit, family)),
  ...josephTreatments.map(([treatmentId, unit, family]) => capabilityFor(treatmentId, "joseph", unit, family)),
];

const capabilitiesByTreatment = new Map(
  MAUL_FRAME_MOTION_CAPABILITIES.map((capability) => [capability.treatmentId, capability]),
);

const identity: MaulFrameMotionTransform = {
  opacity: 1,
  translateXPx: 0,
  translateYPx: 0,
  scale: 1,
  rotationDeg: 0,
  blurPx: 0,
  clipProgress: 1,
  trackingEm: 0,
};

const cubicEase = (x1: number, y1: number, x2: number, y2: number): MaulFrameMotionEasing => ({
  type: "cubic_bezier",
  x1,
  y1,
  x2,
  y2,
});

const easingFor = (family: MotionFamily): MaulFrameMotionEasing => {
  if (family === "impact" || family === "elastic") return cubicEase(0.12, 0.86, 0.18, 1);
  if (family === "mask" || family === "typing") return cubicEase(0.2, 0.9, 0.3, 1);
  if (family === "drift" || family === "rail") return cubicEase(0.4, 0, 0.2, 1);
  return cubicEase(0.16, 1, 0.3, 1);
};

const entryFromFor = (capability: MaulMotionCapability): MaulFrameMotionTransform => {
  const envelope = capability.envelope;
  const from: MaulFrameMotionTransform = {...identity};
  if (capability.family === "rise" || capability.family === "blur_lift" || capability.family === "drop") {
    from.translateYPx = capability.family === "drop" ? -envelope.maxTranslateYPx : envelope.maxTranslateYPx;
  }
  if (capability.family === "split" || capability.family === "arc" || capability.family === "outline" || capability.family === "handoff") {
    from.translateXPx = -envelope.maxTranslateXPx;
    from.rotationDeg = capability.family === "arc" ? -7 : capability.family === "split" ? -3 : 0;
  }
  if (capability.family === "dual_rise" || capability.family === "orbit" || capability.family === "blade") {
    from.translateXPx = -envelope.maxTranslateXPx;
    from.translateYPx = envelope.maxTranslateYPx;
    from.rotationDeg = capability.family === "orbit" || capability.family === "blade" ? -6 : -2;
  }
  if (capability.family === "focus_lock" || capability.family === "depth" || capability.family === "elastic") {
    from.scale = Math.max(0.82, 1 - (envelope.maxScale - 1) * 0.8);
  }
  if (capability.family === "impact" || capability.family === "capsule" || capability.family === "marker" || capability.family === "bracket") {
    from.scale = 0.86;
  }
  if (capability.family === "blur_lift" || capability.family === "focus_lock" || capability.family === "depth" || capability.family === "fog" || capability.family === "glow") {
    from.blurPx = envelope.maxBlurPx;
  }
  if (capability.family === "mask" || capability.family === "typing" || capability.family === "underline" || capability.family === "highlight") {
    from.clipProgress = capability.family === "highlight" ? 0.2 : 0;
  }
  if (capability.family === "stagger" && capability.unit === "letter") from.trackingEm = -0.08;
  from.opacity = capability.family === "rail" ? 0 : 0.02;
  return from;
};

const exitToFor = (capability: MaulMotionCapability): MaulFrameMotionTransform => {
  const to: MaulFrameMotionTransform = {...identity, opacity: 0};
  if (capability.family === "rise" || capability.family === "blur_lift" || capability.family === "drop" || capability.family === "fog") {
    to.translateYPx = capability.family === "drop" ? envelopeValue(capability, "y") : -envelopeValue(capability, "y");
  }
  if (capability.family === "split" || capability.family === "arc" || capability.family === "outline" || capability.family === "handoff") {
    to.translateXPx = envelopeValue(capability, "x");
  }
  if (capability.family === "impact" || capability.family === "elastic" || capability.family === "capsule") {
    to.scale = capability.envelope.maxScale;
  }
  if (capability.family === "blur_lift" || capability.family === "focus_lock" || capability.family === "depth" || capability.family === "fog" || capability.family === "glow") {
    to.blurPx = Math.min(12, capability.envelope.maxBlurPx);
  }
  if (capability.family === "mask" || capability.family === "typing" || capability.family === "underline" || capability.family === "highlight") {
    to.clipProgress = 0;
  }
  return to;
};

const envelopeValue = (capability: MaulMotionCapability, axis: "x" | "y"): number => (
  axis === "x" ? capability.envelope.maxTranslateXPx : capability.envelope.maxTranslateYPx
);

export const getMaulMotionCapability = (treatmentId: string): MaulMotionCapability | null =>
  capabilitiesByTreatment.get(treatmentId) ?? null;

const toStartFrame = (milliseconds: number, fps: number): number =>
  Math.floor((milliseconds / 1000) * fps);

const toEndFrame = (milliseconds: number, fps: number): number =>
  Math.ceil((milliseconds / 1000) * fps);

export const compileMaulWordMotion = ({
  treatmentId,
  token,
  outputStartMs,
  outputEndMs,
  fps,
  placementSegmentId,
}: CompileMaulWordMotionInput): MaulFrameMotionProgram => {
  const capability = getMaulMotionCapability(treatmentId);
  if (!capability) throw new Error(`Unsupported MAUL frame motion treatment: ${treatmentId}`);
  if (!Number.isFinite(fps) || fps <= 0 || fps > 240) throw new Error(`Invalid frame rate for MAUL motion: ${fps}`);
  if (token.sourceEndMs <= token.sourceStartMs) throw new Error(`Invalid source interval for token ${token.tokenId}.`);
  if (outputEndMs <= outputStartMs) throw new Error(`Invalid output interval for token ${token.tokenId}.`);

  // Conservative boundaries keep short but real spoken words visible for every
  // frame touched by their interval; the source interval remains unchanged.
  const startFrame = toStartFrame(outputStartMs, fps);
  const endFrame = toEndFrame(outputEndMs, fps);
  const totalFrames = endFrame - startFrame;
  if (totalFrames < 3) throw new Error(`MAUL word interval is too short for positive animation phases: ${token.tokenId}.`);

  const entryFrames = Math.max(1, Math.floor(totalFrames * 0.25));
  const exitFrames = Math.max(1, Math.floor(totalFrames * 0.2));
  const holdFrames = totalFrames - entryFrames - exitFrames;
  if (holdFrames < 1) throw new Error(`MAUL word interval has no readable hold: ${token.tokenId}.`);

  const entryFrom = entryFromFor(capability);
  const entryTo = identity;
  const holdEnd = startFrame + entryFrames + holdFrames;
  const exitTo = exitToFor(capability);
  return maulFrameMotionProgramSchema.parse({
    schemaVersion: "maul-frame-motion/v1",
    executorId: capability.executorId,
    sourceTreatment: treatmentId,
    unit: capability.unit,
    tokenId: token.tokenId,
    placementSegmentId,
    fps,
    sourceIntervalMs: {startMs: token.sourceStartMs, endMs: token.sourceEndMs},
    phases: {
      entry: {
        startFrame,
        endFrame: startFrame + entryFrames,
        easing: easingFor(capability.family),
        from: entryFrom,
        to: entryTo,
      },
      hold: {
        startFrame: startFrame + entryFrames,
        endFrame: holdEnd,
        easing: {type: "linear"},
        from: identity,
        to: identity,
      },
      exit: {
        startFrame: holdEnd,
        endFrame,
        easing: easingFor(capability.family),
        from: identity,
        to: exitTo,
      },
    },
    envelope: capability.envelope,
  });
};
