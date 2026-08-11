import {createHash} from "node:crypto";

import type {MaulTextAnimationTreatment} from "@prometheus/shared-types";

import {
  MAUL_FRAME_MOTION_CAPABILITIES,
  type MotionFamily,
} from "./frame-motion-compiler.js";

export type MaulWordMotionTier = "supporting_motion" | "cinematic_emphasis";

const CINEMATIC_EMPHASIS_FAMILIES = new Set<MotionFamily>([
  "focus_lock",
  "orbit",
  "blade",
  "banner",
  "outline",
  "depth",
  "impact",
  "elastic",
  "underline",
  "highlight",
  "capsule",
  "marker",
  "glow",
  "weight",
  "handoff",
  "bracket",
]);

const stableIndex = (seed: string, length: number): number =>
  Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) % length;

export const wordMotionCandidatesFor = ({
  emphasisLevel,
  isEmphasized,
}: {
  emphasisLevel: "support" | "key" | "hero";
  isEmphasized: boolean;
}): MaulTextAnimationTreatment[] => {
  const needsCinematicEmphasis = isEmphasized && emphasisLevel !== "support";
  return MAUL_FRAME_MOTION_CAPABILITIES
    .filter((capability) =>
      needsCinematicEmphasis
        ? CINEMATIC_EMPHASIS_FAMILIES.has(capability.family)
        : !CINEMATIC_EMPHASIS_FAMILIES.has(capability.family),
    )
    .map((capability) => capability.treatmentId as MaulTextAnimationTreatment);
};

export const routeMaulWordMotion = ({
  seed,
  emphasisLevel,
  isEmphasized,
  previousTreatment,
  previousFamily,
  usedTreatments,
}: {
  seed: string;
  emphasisLevel: "support" | "key" | "hero";
  isEmphasized: boolean;
  previousTreatment: MaulTextAnimationTreatment | null;
  previousFamily: MotionFamily | null;
  usedTreatments: ReadonlySet<MaulTextAnimationTreatment>;
}): {
  treatmentId: MaulTextAnimationTreatment;
  family: MotionFamily;
  tier: MaulWordMotionTier;
} => {
  const candidates = wordMotionCandidatesFor({emphasisLevel, isEmphasized});
  const capabilities = candidates.map((treatmentId) =>
    MAUL_FRAME_MOTION_CAPABILITIES.find(
      (capability) => capability.treatmentId === treatmentId,
    )!,
  );
  const freshFamily = capabilities.filter(
    (capability) =>
      capability.treatmentId !== previousTreatment &&
      capability.family !== previousFamily &&
      !usedTreatments.has(capability.treatmentId as MaulTextAnimationTreatment),
  );
  const differentFamily = capabilities.filter(
    (capability) =>
      capability.treatmentId !== previousTreatment && capability.family !== previousFamily,
  );
  const nonRepeating = capabilities.filter(
    (capability) => capability.treatmentId !== previousTreatment,
  );
  const pool = freshFamily.length > 0
    ? freshFamily
    : differentFamily.length > 0
      ? differentFamily
      : nonRepeating.length > 0
        ? nonRepeating
        : capabilities;
  if (pool.length === 0) {
    throw new Error("MAUL word motion routing has no executable candidates.");
  }
  const selected = pool[stableIndex(seed, pool.length)]!;
  return {
    treatmentId: selected.treatmentId as MaulTextAnimationTreatment,
    family: selected.family,
    tier: isEmphasized && emphasisLevel !== "support"
      ? "cinematic_emphasis"
      : "supporting_motion",
  };
};
