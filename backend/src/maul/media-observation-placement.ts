import type {MaulNormalizedBox} from "@prometheus/shared-types";

import type {
  MaulMediaObservationResult,
} from "./mediapipe-observation.js";
import type {
  SceneEvidenceHold,
  SceneOpportunityRegion,
  SceneEvidenceProvider,
  SceneEvidenceProviderInput,
  SceneEvidenceTimeline,
} from "./scene-evidence.js";

type ObservationFrame = MaulMediaObservationResult["frames"][number];

const FULL_FRAME: MaulNormalizedBox = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

const SAFE_REGION: MaulNormalizedBox = {
  x: 0.06,
  y: 0.08,
  width: 0.88,
  height: 0.82,
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

const rounded = (value: number): number => Number(value.toFixed(6));

const overlapArea = (
  first: MaulNormalizedBox,
  second: MaulNormalizedBox,
): number => {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
};

const mapBoxIntoCrop = (
  box: MaulNormalizedBox | null,
  crop: MaulNormalizedBox,
): MaulNormalizedBox | null => {
  if (!box) return null;
  const left = Math.max(box.x, crop.x);
  const top = Math.max(box.y, crop.y);
  const right = Math.min(box.x + box.width, crop.x + crop.width);
  const bottom = Math.min(box.y + box.height, crop.y + crop.height);
  if (right <= left || bottom <= top) return null;
  return {
    x: rounded(clamp((left - crop.x) / crop.width, 0, 1)),
    y: rounded(clamp((top - crop.y) / crop.height, 0, 1)),
    width: rounded(clamp((right - left) / crop.width, 0, 1)),
    height: rounded(clamp((bottom - top) / crop.height, 0, 1)),
  };
};

const cropLuminanceGrid = (
  grid: ObservationFrame["luminanceGrid"],
  crop: MaulNormalizedBox,
) => {
  const samples: number[] = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const sourceX = clamp(
        crop.x + ((column + 0.5) / grid.columns) * crop.width,
        0,
        1,
      );
      const sourceY = clamp(
        crop.y + ((row + 0.5) / grid.rows) * crop.height,
        0,
        1,
      );
      const sourceColumn = Math.min(
        grid.columns - 1,
        Math.max(0, Math.floor(sourceX * grid.columns)),
      );
      const sourceRow = Math.min(
        grid.rows - 1,
        Math.max(0, Math.floor(sourceY * grid.rows)),
      );
      samples.push(grid.samples[sourceRow * grid.columns + sourceColumn]!);
    }
  }
  return {
    columns: 12 as const,
    rows: 20 as const,
    samples,
  };
};

const outputMsForSource = (
  timestampMap: SceneEvidenceProviderInput["timestampMap"],
  sourceMs: number,
): number | null => {
  if (!timestampMap || timestampMap.length === 0) return sourceMs;
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

const cropForOutput = (
  input: SceneEvidenceProviderInput,
  outputMs: number,
): MaulNormalizedBox => {
  const crop = input.speakerCropTracks?.find(
    (candidate) =>
      candidate.outputStartMs <= outputMs && candidate.outputEndMs >= outputMs,
  )?.crop;
  return crop ?? FULL_FRAME;
};

const opportunity = ({
  regionId,
  box,
  overlapPolicy,
  faceInterference,
  temporalStability,
}: {
  regionId: string;
  box: MaulNormalizedBox;
  overlapPolicy: "avoid_subject" | "controlled_overlap";
  faceInterference: number;
  temporalStability: number;
}): SceneOpportunityRegion => ({
  regionId,
  box,
  negativeSpace: overlapPolicy === "controlled_overlap" ? 0.5 : 0.86,
  readability: 0.82,
  clutter: 0.2,
  faceInterference,
  overlapPolicy,
  temporalStability,
});

const opportunitiesForSubject = (
  subjectBox: MaulNormalizedBox | null,
  faceBox: MaulNormalizedBox | null,
  temporalStability: number,
): SceneOpportunityRegion[] => {
  const regions: SceneOpportunityRegion[] = [
    opportunity({
      regionId: "media_observed_full_frame",
      box: SAFE_REGION,
      overlapPolicy: "controlled_overlap",
      faceInterference: faceBox
        ? overlapArea(SAFE_REGION, faceBox) /
          Math.max(0.0001, SAFE_REGION.width * SAFE_REGION.height)
        : 0,
      temporalStability,
    }),
  ];
  if (!subjectBox) return regions;

  const leftWidth = Math.max(0, subjectBox.x - SAFE_REGION.x - 0.04);
  const rightStart = subjectBox.x + subjectBox.width + 0.04;
  const rightWidth = Math.max(
    0,
    SAFE_REGION.x + SAFE_REGION.width - rightStart,
  );
  if (leftWidth >= 0.16) {
    regions.push(opportunity({
      regionId: "media_observed_clear_left",
      box: {
        x: SAFE_REGION.x,
        y: clamp(subjectBox.y + subjectBox.height * 0.1, SAFE_REGION.y, 0.62),
        width: Math.min(0.42, leftWidth),
        height: 0.28,
      },
      overlapPolicy: "avoid_subject",
      faceInterference: 0,
      temporalStability,
    }));
  }
  if (rightWidth >= 0.16) {
    regions.push(opportunity({
      regionId: "media_observed_clear_right",
      box: {
        x: rightStart,
        y: clamp(subjectBox.y + subjectBox.height * 0.1, SAFE_REGION.y, 0.62),
        width: Math.min(0.42, rightWidth),
        height: 0.28,
      },
      overlapPolicy: "avoid_subject",
      faceInterference: 0,
      temporalStability,
    }));
  }
  return regions;
};

const sourceFrameId = (frame: ObservationFrame): string =>
  `mediapipe@${frame.sourceMs}`;

const holdForBeat = ({
  input,
  frames,
  beat,
  maximumInterpolationGapMs,
  beatIndex,
}: {
  input: SceneEvidenceProviderInput;
  frames: Array<ObservationFrame & {outputMs: number}>;
  beat: SceneEvidenceProviderInput["beats"][number];
  maximumInterpolationGapMs: number;
  beatIndex: number;
}): SceneEvidenceHold | null => {
  const validFrames = frames.filter(
    (frame) =>
      frame.subjectBox &&
      frame.outputMs >= beat.startMs &&
      frame.outputMs <= beat.endMs,
  );
  const midpoint = (beat.startMs + beat.endMs) / 2;
  const nearest = [...frames]
    .filter((frame) => frame.subjectBox)
    .sort(
      (left, right) =>
        Math.abs(left.outputMs - midpoint) - Math.abs(right.outputMs - midpoint),
    )[0];
  const selectedFrames = validFrames.length > 0
    ? validFrames
    : nearest && Math.abs(nearest.outputMs - midpoint) <= maximumInterpolationGapMs
      ? [nearest]
      : [];
  if (selectedFrames.length === 0) return null;
  const representative = [...selectedFrames].sort(
    (left, right) =>
      Math.abs(left.outputMs - midpoint) - Math.abs(right.outputMs - midpoint),
  )[0]!;
  const crop = cropForOutput(input, representative.outputMs);
  const subjectBox = mapBoxIntoCrop(representative.subjectBox, crop);
  const faceBox = mapBoxIntoCrop(representative.faceBox, crop);
  if (!subjectBox) return null;
  const stability = Number(
    (selectedFrames.reduce(
      (total, frame) => total + (frame.subjectBox ? 1 : 0),
      0,
    ) / selectedFrames.length).toFixed(4),
  );
  const grids = selectedFrames.map((frame) =>
    cropLuminanceGrid(frame.luminanceGrid, crop),
  );
  return {
    beatId: beat.beatId,
    purpose: beat.purpose,
    sceneId: `mediapipe_scene_${beatIndex + 1}`,
    discontinuityId: `mediapipe_geometry_${beatIndex + 1}`,
    outputStartMs: beat.startMs,
    outputEndMs: beat.endMs,
    sourceFrameIds: selectedFrames.map(sourceFrameId),
    sourceSampleMs: representative.sourceMs,
    sourceCrop: crop,
    subject: {
      trackingState: validFrames.length > 0 ? "tracked" : "held",
      box: subjectBox,
    },
    backgroundLuminanceGrid: grids[0],
    backgroundLuminanceGrids: grids,
    existingTextRegions: [],
    opportunities: opportunitiesForSubject(subjectBox, faceBox, stability),
  };
};

export const createMediaObservationSceneEvidenceProvider = ({
  observation,
  maximumInterpolationGapMs,
}: {
  observation: MaulMediaObservationResult;
  maximumInterpolationGapMs: number;
}): SceneEvidenceProvider => ({
  async inspect(input): Promise<SceneEvidenceTimeline> {
    if (!Number.isFinite(maximumInterpolationGapMs) || maximumInterpolationGapMs < 0) {
      return {
        status: "unavailable",
        providerId: "unavailable",
        reason: "MediaPipe observation interpolation gap is invalid.",
      };
    }
    const frames = observation.frames.flatMap((frame) => {
      const outputMs = outputMsForSource(input.timestampMap, frame.sourceMs);
      return outputMs === null ? [] : [{...frame, outputMs}];
    });
    const holds = input.beats.map((beat, index) =>
      holdForBeat({
        input,
        frames,
        beat,
        maximumInterpolationGapMs,
        beatIndex: index,
      }),
    );
    if (holds.some((hold) => hold === null)) {
      return {
        status: "unavailable",
        providerId: "unavailable",
        reason:
          "MediaPipe observations did not cover every visual beat within the configured interpolation gap.",
      };
    }
    return {
      status: "available",
      providerId: "mediapipe_opencv_scene_evidence",
      providerVersion: `${observation.detector.mediapipeVersion}+${observation.detector.opencvVersion}`,
      holds: holds as SceneEvidenceHold[],
    };
  },
});
