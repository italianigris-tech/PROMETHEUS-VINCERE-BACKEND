import {createHash} from "node:crypto";

import {
  buildJosephOrchestrationPlan,
  type DirectorInput,
} from "../director/joseph-director.js";
import {MIN_COMPOSITION_HOLD_MS, type MaulCompositionPurpose} from "./temporal-composition.js";

export type EditorialDirectionInput = {
  sourcePath: string;
  durationMs: number;
  seed: number;
  profile: DirectorInput["profile"];
  transcript: Array<{
    text: string;
    startMs: number;
    endMs: number;
    confidence?: number;
  }>;
};

export type EditorialDirection = {
  receipt: {
    directorId: "joseph";
    version: "maul-joseph-editorial-director/v1";
    doctrineId: string;
    inputHash: string;
  };
  visualBeats: Array<{
    beatId: string;
    startMs: number;
    endMs: number;
    purpose: MaulCompositionPurpose;
  }>;
  artDirection: {
    audienceIntent: string;
    emotionalTemperature: "warm_intimate" | "urgent_confident" | "calm_authoritative";
    sourceRespectStance: string;
    theme: string;
    paletteIntent: string[];
    typeRoles: Array<{role: string; intent: string}>;
    layoutAndNegativeSpaceLogic: string;
    imageryAndBackgroundLanguage: string;
    cameraBehavior: string;
    motionPhysics: string;
    annotationGrammar: string;
    soundWorld: string;
    motifArc: {introduction: string; development: string; recall: string};
    treatmentVariation: string;
    explicitProhibitions: string[];
  };
  rationale: string[];
};

export interface EditorialDirector {
  plan(input: EditorialDirectionInput): Promise<EditorialDirection>;
}

const hashInput = (input: EditorialDirectionInput): string =>
  createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");

const visualBeatsFor = ({
  durationMs,
  doctrineId,
}: {
  durationMs: number;
  doctrineId: string;
}): EditorialDirection["visualBeats"] => {
  if (durationMs < MIN_COMPOSITION_HOLD_MS * 2) {
    return [{
      beatId: `joseph_${doctrineId}_hook`,
      startMs: 0,
      endMs: durationMs,
      purpose: "HOOK",
    }];
  }
  const splitMs = Math.max(
    MIN_COMPOSITION_HOLD_MS,
    Math.min(durationMs - MIN_COMPOSITION_HOLD_MS, Math.round(durationMs / 2)),
  );
  return [
    {
      beatId: `joseph_${doctrineId}_hook`,
      startMs: 0,
      endMs: splitMs,
      purpose: "HOOK",
    },
    {
      beatId: `joseph_${doctrineId}_payoff`,
      startMs: splitMs,
      endMs: durationMs,
      purpose: "PAYOFF",
    },
  ];
};

const emotionalTemperatureFor = (
  profile: DirectorInput["profile"],
): EditorialDirection["artDirection"]["emotionalTemperature"] => {
  if (profile === "joseph_aggressive") return "urgent_confident";
  if (profile === "joseph_minimal") return "calm_authoritative";
  return "warm_intimate";
};

export const createJosephEditorialDirector = (): EditorialDirector => ({
  async plan(input) {
    const orchestration = buildJosephOrchestrationPlan({
      videoUrl: input.sourcePath,
      transcript: input.transcript,
      beats: input.transcript.map((word) => word.startMs),
      onsets: input.transcript.map((word) => word.startMs),
      energyCurve: Array.from(
        {length: Math.max(1, Math.ceil(input.durationMs / 500))},
        () => 0.5,
      ),
      durationMs: input.durationMs,
      seed: input.seed,
      profile: input.profile,
    });
    const doctrineId = orchestration.doctrineBranch.id;

    return {
      receipt: {
        directorId: "joseph",
        version: "maul-joseph-editorial-director/v1",
        doctrineId,
        inputHash: hashInput(input),
      },
      visualBeats: visualBeatsFor({durationMs: input.durationMs, doctrineId}),
      artDirection: {
        audienceIntent: orchestration.semanticSummary.intent,
        emotionalTemperature: emotionalTemperatureFor(input.profile),
        sourceRespectStance:
          "Use the governed source as the visual anchor; do not manufacture claims, source events, or evidence.",
        theme: orchestration.semanticSummary.rhetoricalArc,
        paletteIntent: [
          "Sample source palette before selecting typography color.",
          "Reserve a single high-contrast accent for semantic emphasis.",
        ],
        typeRoles: [
          {
            role: "EDITORIAL_DISPLAY",
            intent: orchestration.visualPlan.typographyHierarchy.join("; "),
          },
          {
            role: "NEUTRAL_GROTESK",
            intent: "Keep spoken source language subordinate to the editorial hierarchy.",
          },
        ],
        layoutAndNegativeSpaceLogic:
          "Select a stable composition hold from measured scene opportunity, then animate words inside that hold.",
        imageryAndBackgroundLanguage: orchestration.visualPlan.primitiveComposition.join("; "),
        cameraBehavior: orchestration.temporalChoreography.cameraMoves.join("; "),
        motionPhysics: orchestration.visualPlan.microAnimationPrimitives.join("; "),
        annotationGrammar: "Withhold annotations unless source-supported evidence is available.",
        soundWorld: orchestration.temporalChoreography.sfx.join("; ") || "Dialogue-first licensed sound.",
        motifArc: {
          introduction: orchestration.visualPlan.attentionAnchors[0] ?? "Source-led hook.",
          development: orchestration.visualPlan.visualDensityPlan,
          recall: orchestration.semanticSummary.rhetoricalArc,
        },
        treatmentVariation: orchestration.doctrineBranch.label,
        explicitProhibitions: [
          "No fallback caption band may be labeled art directed.",
          "No source-pixel placement without temporal visual evidence.",
          "No imperceptibly short composition or animation state.",
        ],
      },
      rationale: [
        orchestration.semanticSummary.intent,
        orchestration.doctrineBranch.motionDoctrine,
        ...orchestration.visualPlan.typographyRules,
      ],
    };
  },
});
