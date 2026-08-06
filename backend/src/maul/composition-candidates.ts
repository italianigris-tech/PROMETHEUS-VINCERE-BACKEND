import type {MaulNormalizedBox} from "@prometheus/shared-types";

import type {SceneOpportunityRegion} from "./scene-evidence.js";
import type {MaulCompositionPurpose} from "./temporal-composition.js";

export type MaulCompositionDirection =
  | "editorial_asymmetry"
  | "poster_hero"
  | "subject_integrated"
  | "restrained_minimal";

export type CompositionCandidate = {
  direction: MaulCompositionDirection;
  box: MaulNormalizedBox;
  alignment: "left" | "center" | "right";
  hierarchy: "CAPTION" | "EDITORIAL" | "POSTER" | "HERO";
  cropIntent: "NONE" | "EDGE_CROP" | "AGGRESSIVE_CROP";
  depthIntent: "FRONT";
  score: number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const safeBox = (box: MaulNormalizedBox): MaulNormalizedBox => {
  const width = clamp(box.width, 0.08, 0.92);
  const height = clamp(box.height, 0.07, 0.82);
  return {
    x: clamp(box.x, 0.04, 0.96 - width),
    y: clamp(box.y, 0.04, 0.92 - height),
    width,
    height,
  };
};

const candidateScore = ({
  opportunity,
  purpose,
  novelty,
}: {
  opportunity: SceneOpportunityRegion;
  purpose: MaulCompositionPurpose;
  novelty: number;
}) => {
  const purposeBoost = purpose === "HOOK" || purpose === "PAYOFF" ? 0.08 : 0;
  return Number((
    opportunity.negativeSpace * 0.3 +
    opportunity.readability * 0.28 +
    (1 - opportunity.clutter) * 0.18 +
    (1 - opportunity.faceInterference) * 0.16 +
    opportunity.temporalStability * 0.08 +
    purposeBoost +
    novelty
  ).toFixed(4));
};

export const buildCompositionCandidates = ({
  subjectBox: _subjectBox,
  opportunity,
  purpose,
}: {
  subjectBox: MaulNormalizedBox | null;
  opportunity: SceneOpportunityRegion;
  purpose: MaulCompositionPurpose;
}): CompositionCandidate[] => {
  const {box} = opportunity;
  const align = box.x + box.width / 2 < 0.5 ? "left" : "right";
  const directions: Array<Omit<CompositionCandidate, "score"> & {novelty: number}> = [
    {
      direction: "editorial_asymmetry",
      box: safeBox({x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 0.3)}),
      alignment: align,
      hierarchy: "EDITORIAL",
      cropIntent: "NONE",
      depthIntent: "FRONT",
      novelty: 0.02,
    },
    {
      direction: "poster_hero",
      box: safeBox({
        x: box.x - box.width * 0.08,
        y: Math.max(0.08, box.y - 0.08),
        width: Math.min(0.84, box.width * 1.16),
        height: Math.min(0.4, Math.max(0.22, box.height * 0.72)),
      }),
      alignment: align,
      hierarchy: "HERO",
      cropIntent: "EDGE_CROP",
      depthIntent: "FRONT",
      novelty: 0.06,
    },
    {
      direction: "subject_integrated",
      box: safeBox({
        x: box.x + box.width * 0.04,
        y: box.y + box.height * 0.46,
        width: Math.max(0.18, box.width * 0.92),
        height: Math.max(0.18, box.height * 0.38),
      }),
      alignment: align,
      hierarchy: "EDITORIAL",
      cropIntent: "NONE",
      depthIntent: "FRONT",
      novelty: 0.04,
    },
    {
      direction: "restrained_minimal",
      box: safeBox({
        x: box.x + box.width * 0.22,
        y: box.y + box.height * 0.18,
        width: Math.max(0.16, box.width * 0.54),
        height: Math.max(0.1, box.height * 0.2),
      }),
      alignment: align,
      hierarchy: "CAPTION",
      cropIntent: "NONE",
      depthIntent: "FRONT",
      novelty: 0,
    },
  ];
  return directions.map(({novelty, ...candidate}) => ({
    ...candidate,
    score: candidateScore({opportunity, purpose, novelty}),
  }));
};
