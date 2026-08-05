import {createHash} from "node:crypto";

import type {
  MaulEditorialTimelinePayload,
  MaulNormalizedBox,
  MaulOutputCompositionInterval,
} from "@prometheus/shared-types";

import type {
  MaulPlacementObservationInterval,
  MaulPlacementShotInterval,
  MaulPlacementTimelineInterval,
} from "./shorts-text-placement.js";
import type {MaulCompositionPurpose} from "./temporal-composition.js";
import {
  buildCompositionCandidates,
  type MaulCompositionDirection,
} from "./composition-candidates.js";

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
  sourceCrop: MaulNormalizedBox;
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

export type SceneEvidenceSpeakerTrack = {
  speakerId: string;
  samples: Array<{
    sourceMs: number;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
};

export type SceneEvidenceProviderInput = {
  sourcePath: string;
  beats: SceneEvidenceVisualBeat[];
  speakerTracks?: readonly SceneEvidenceSpeakerTrack[];
  timestampMap?: MaulEditorialTimelinePayload["timestampMap"];
  speakerCropTracks?: MaulEditorialTimelinePayload["speakerCropTracks"];
};

export interface SceneEvidenceProvider {
  inspect(input: SceneEvidenceProviderInput): Promise<SceneEvidenceTimeline>;
}

export const createUnavailableSceneEvidenceProvider = (
  reason: string,
): SceneEvidenceProvider => ({
  async inspect() {
    return {status: "unavailable", providerId: "unavailable", reason};
  },
});

type SpeakerTrackSceneEvidenceInput = SceneEvidenceProviderInput & {
  speakerTracks: readonly SceneEvidenceSpeakerTrack[];
  timestampMap: MaulEditorialTimelinePayload["timestampMap"];
  speakerCropTracks: MaulEditorialTimelinePayload["speakerCropTracks"];
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const rounded = (value: number) => Number(value.toFixed(6));

const outputMsForSource = (
  timestampMap: MaulEditorialTimelinePayload["timestampMap"],
  sourceMs: number,
): number | null => {
  const segment = timestampMap.find(
    (candidate) =>
      candidate.mode !== "cut" &&
      sourceMs >= candidate.sourceStartMs &&
      sourceMs <= candidate.sourceEndMs,
  );
  if (!segment) return null;
  const sourceDurationMs = segment.sourceEndMs - segment.sourceStartMs;
  if (sourceDurationMs <= 0) return null;
  return Math.round(
    segment.outputStartMs +
      (sourceMs - segment.sourceStartMs) *
        ((segment.outputEndMs - segment.outputStartMs) / sourceDurationMs),
  );
};

const subjectInsideCrop = (
  sample: SceneEvidenceSpeakerTrack["samples"][number],
  crop: MaulNormalizedBox,
): MaulNormalizedBox | null => {
  const left = Math.max(sample.x, crop.x);
  const top = Math.max(sample.y, crop.y);
  const right = Math.min(sample.x + sample.width, crop.x + crop.width);
  const bottom = Math.min(sample.y + sample.height, crop.y + crop.height);
  if (right <= left || bottom <= top) return null;
  return {
    x: rounded(clamp((left - crop.x) / crop.width, 0, 1)),
    y: rounded(clamp((top - crop.y) / crop.height, 0, 1)),
    width: rounded(clamp((right - left) / crop.width, 0, 1)),
    height: rounded(clamp((bottom - top) / crop.height, 0, 1)),
  };
};

const opportunityForSubject = (
  subject: MaulNormalizedBox,
  confidence: number,
): SceneOpportunityRegion | null => {
  const safeLeft = 0.06;
  const safeRight = 0.94;
  const safeTop = 0.08;
  const safeBottom = 0.9;
  const gutter = 0.04;
  const rightX = Math.min(safeRight, subject.x + subject.width + gutter);
  const rightWidth = Math.max(0, safeRight - rightX);
  const leftWidth = Math.max(0, subject.x - gutter - safeLeft);
  const useRight = rightWidth >= leftWidth;
  const sideWidth = useRight ? rightWidth : leftWidth;

  if (sideWidth >= 0.24) {
    return {
      regionId: useRight ? "speaker_clear_right" : "speaker_clear_left",
      box: {
        x: rounded(useRight ? rightX : safeLeft),
        y: rounded(clamp(subject.y + subject.height * 0.12, 0.12, 0.58)),
        width: rounded(Math.min(0.42, sideWidth)),
        height: 0.28,
      },
      negativeSpace: 0.68,
      readability: 0.72,
      clutter: 0.38,
      faceInterference: 0,
      temporalStability: rounded(clamp(confidence, 0.5, 0.98)),
    };
  }

  const topHeight = Math.max(0, subject.y - gutter - safeTop);
  const bottomY = Math.min(safeBottom, subject.y + subject.height + gutter);
  const bottomHeight = Math.max(0, safeBottom - bottomY);
  const useBottom = bottomHeight >= topHeight;
  const verticalHeight = useBottom ? bottomHeight : topHeight;
  if (verticalHeight < 0.14) return null;
  return {
    regionId: useBottom ? "speaker_clear_bottom" : "speaker_clear_top",
    box: {
      x: 0.1,
      y: rounded(useBottom ? bottomY : safeTop),
      width: 0.8,
      height: rounded(Math.min(0.22, verticalHeight)),
    },
    negativeSpace: 0.6,
    readability: 0.68,
    clutter: 0.42,
    faceInterference: 0,
    temporalStability: rounded(clamp(confidence, 0.5, 0.98)),
  };
};

export const buildSpeakerTrackSceneEvidence = (
  input: SpeakerTrackSceneEvidenceInput,
): SceneEvidenceTimeline => {
  const mappedSamples = input.speakerTracks.flatMap((track) =>
    track.samples.flatMap((sample) => {
      const outputMs = outputMsForSource(input.timestampMap, sample.sourceMs);
      return outputMs === null
        ? []
        : [{...sample, speakerId: track.speakerId, outputMs}];
    }),
  );

  const holds = input.beats.flatMap((beat, beatIndex) => {
    const beatMidpointMs = (beat.startMs + beat.endMs) / 2;
    const selected = mappedSamples
      .flatMap((sample) => {
        if (sample.outputMs < beat.startMs || sample.outputMs > beat.endMs) {
          return [];
        }
        const cropTrack = input.speakerCropTracks.find(
          (candidate) =>
            candidate.speakerId === sample.speakerId &&
            candidate.outputStartMs <= sample.outputMs &&
            candidate.outputEndMs >= sample.outputMs,
        );
        if (!cropTrack) return [];
        const subject = subjectInsideCrop(sample, cropTrack.crop);
        if (!subject) return [];
        return [{sample, cropTrack, subject}];
      })
      .sort(
        (left, right) =>
          right.sample.confidence - left.sample.confidence ||
          Math.abs(left.sample.outputMs - beatMidpointMs) -
            Math.abs(right.sample.outputMs - beatMidpointMs) ||
          left.sample.sourceMs - right.sample.sourceMs,
      )[0];
    if (!selected) return [];
    const opportunity = opportunityForSubject(
      selected.subject,
      selected.sample.confidence,
    );
    if (!opportunity) return [];
    return [
      {
        beatId: beat.beatId,
        sceneId: "speaker_scene_" + (beatIndex + 1),
        discontinuityId: "speaker_geometry_" + (beatIndex + 1),
        outputStartMs: beat.startMs,
        outputEndMs: beat.endMs,
        sourceFrameIds: [
          selected.sample.speakerId + "@" + selected.sample.sourceMs,
        ],
        sourceCrop: selected.cropTrack.crop,
        subject: {
          trackingState: "tracked" as const,
          box: selected.subject,
        },
        existingTextRegions: [],
        opportunities: [opportunity],
      },
    ];
  });

  return holds.length > 0 && holds.length === input.beats.length
    ? {
        status: "available",
        providerId: "maul_speaker_track_geometry",
        providerVersion: "1",
        holds,
      }
    : {
        status: "unavailable",
        providerId: "unavailable",
        reason:
          "Authoritative speaker geometry did not cover every renderable visual beat and portrait crop.",
      };
};

export const createSpeakerTrackSceneEvidenceProvider =
  (): SceneEvidenceProvider => ({
    async inspect(input) {
      if (
        !input.speakerTracks ||
        !input.timestampMap ||
        !input.speakerCropTracks
      ) {
        return {
          status: "unavailable",
          providerId: "unavailable",
          reason:
            "Speaker-track scene evidence requires analysis tracks, timestamp mapping, and portrait crop tracks.",
        };
      }
      return buildSpeakerTrackSceneEvidence({
        ...input,
        speakerTracks: input.speakerTracks,
        timestampMap: input.timestampMap,
        speakerCropTracks: input.speakerCropTracks,
      });
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
  preferredDirection?: MaulCompositionDirection,
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
        variantId: `scene_evidence.${candidate.direction}.${region.regionId}${
          candidate.direction === preferredDirection ? ".creative_preferred" : ""
        }`,
        outputStartMs: hold.outputStartMs,
        outputEndMs: hold.outputEndMs,
        transformHash: transformHash({
          providerId: evidence.providerId,
          providerVersion: evidence.providerVersion,
          sourceFrameIds: hold.sourceFrameIds,
          sourceCrop: hold.sourceCrop,
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
        crop: hold.sourceCrop,
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
