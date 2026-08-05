import {createHash} from "node:crypto";

import type {
  MaulNormalizedBox,
  MaulOutputCompositionInterval,
} from "@prometheus/shared-types";

import type {
  MaulPlacementObservationInterval,
  MaulPlacementShotInterval,
  MaulPlacementTimelineInterval,
} from "./shorts-text-placement.js";
import type {MaulCompositionPurpose} from "./temporal-composition.js";
import {buildCompositionCandidates} from "./composition-candidates.js";

export type SceneEvidenceVisualBeat = {
  beatId: string;
  startMs: number;
  endMs: number;
  purpose: MaulCompositionPurpose;
};

export type SceneOpportunityRegion = {
  regionId: string;
  box: MaulNormalizedBox;
  negativeSpace: number;
  readability: number;
  clutter: number;
  faceInterference: number;
  temporalStability: number;
};

export type SceneEvidenceHold = {
  beatId: string;
  sceneId: string;
  discontinuityId: string;
  outputStartMs: number;
  outputEndMs: number;
  sourceFrameIds: string[];
  subject: {
    trackingState: "tracked" | "held" | "absent_confirmed";
    box: MaulNormalizedBox | null;
  };
  existingTextRegions: MaulNormalizedBox[];
  opportunities: SceneOpportunityRegion[];
};

export type SceneEvidenceTimeline =
  | {
      status: "available";
      providerId: string;
      providerVersion: string;
      holds: SceneEvidenceHold[];
    }
  | {
      status: "unavailable";
      providerId: "unavailable";
      reason: string;
    };

export interface SceneEvidenceProvider {
  inspect(input: {
    sourcePath: string;
    beats: SceneEvidenceVisualBeat[];
  }): Promise<SceneEvidenceTimeline>;
}

export const createUnavailableSceneEvidenceProvider = (
  reason: string,
): SceneEvidenceProvider => ({
  async inspect() {
    return {status: "unavailable", providerId: "unavailable", reason};
  },
});

export type SceneEvidencePlacementInputs = {
  compositionIntervals: MaulOutputCompositionInterval[];
  observationIntervals: MaulPlacementObservationInterval[];
  shotIntervals: MaulPlacementShotInterval[];
  timelineIntervals: MaulPlacementTimelineInterval[];
  geometryResetOutputMs: number[];
};

const transformHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const envelopeFor = (box: MaulNormalizedBox): MaulNormalizedBox => ({
  x: Math.max(0.04, box.x - 0.02),
  y: Math.max(0.04, box.y - 0.02),
  width: Math.min(0.92 - Math.max(0.04, box.x - 0.02), box.width + 0.04),
  height: Math.min(0.88 - Math.max(0.04, box.y - 0.02), box.height + 0.04),
});

export const sceneEvidenceToPlacementInputs = (
  evidence: SceneEvidenceTimeline,
): SceneEvidencePlacementInputs | null => {
  if (evidence.status !== "available" || evidence.holds.length === 0) {
    return null;
  }

  const compositionIntervals = evidence.holds.flatMap((hold) =>
    hold.opportunities.flatMap((region) =>
      buildCompositionCandidates({
        subjectBox: hold.subject.box,
        opportunity: region,
        purpose: "SETUP",
      }).map((candidate) => ({
        intervalId: `${hold.beatId}.${candidate.direction}.${region.regionId}`,
        sceneId: hold.sceneId,
        discontinuityId: hold.discontinuityId,
        variantId: `scene_evidence.${candidate.direction}.${region.regionId}`,
        outputStartMs: hold.outputStartMs,
        outputEndMs: hold.outputEndMs,
        transformHash: transformHash({
          providerId: evidence.providerId,
          providerVersion: evidence.providerVersion,
          sourceFrameIds: hold.sourceFrameIds,
          region,
          candidate,
        }),
        sourceViewport: {x: 0, y: 0, width: 1, height: 1},
        sourceOccupancy: [{x: 0, y: 0, width: 1, height: 1}],
        paddedNonSourceRegions: [],
        compositionDirection: candidate.direction,
        textAnchor: {
          box: candidate.box,
          maximumEnvelope: envelopeFor(candidate.box),
          alignment: candidate.alignment,
        },
        crop: {x: 0, y: 0, width: 1, height: 1},
        scale: {x: 1, y: 1},
      })),
    ),
  );
  if (compositionIntervals.length === 0) return null;

  const observationIntervals = evidence.holds.map((hold) => ({
    evidenceId: `${evidence.providerId}.${hold.beatId}`,
    sceneId: hold.sceneId,
    outputStartMs: hold.outputStartMs,
    outputEndMs: hold.outputEndMs,
    trackingState: hold.subject.trackingState,
    subjectBox: hold.subject.box,
    cutEvidenceStatus: "known" as const,
    existingTextRegions: hold.existingTextRegions,
  }));
  const shotIntervals = evidence.holds.map((hold) => ({
    sceneId: hold.sceneId,
    discontinuityId: hold.discontinuityId,
    outputStartMs: hold.outputStartMs,
    outputEndMs: hold.outputEndMs,
  }));

  return {
    compositionIntervals,
    observationIntervals,
    shotIntervals,
    timelineIntervals: evidence.holds.map((hold) => ({
      outputStartMs: hold.outputStartMs,
      outputEndMs: hold.outputEndMs,
    })),
    geometryResetOutputMs: evidence.holds.slice(1).map((hold) => hold.outputStartMs),
  };
};
