import {createHash} from "node:crypto";

import {decodeRgbaPng} from "./png-rgba.js";

export type CompositionFrameSample = {
  outputMs: number;
  bytes: Buffer;
  sha256: string;
  contentType: "image/png";
};

type ObservedMeasurement<T> =
  | {status: "observed" | "inferred"; value: T; evidenceIds: string[]}
  | {status: "unobserved"; reason: string; evidenceIds: string[]};

export type ObservedComposition = {
  schemaVersion: "maul-observed-composition/v1";
  observationId: string;
  observationSha256: string;
  declarationId: string;
  status: "observed" | "blocked";
  failures: string[];
  frameEvidenceIds: string[];
  measurements: {
    textBounds: ObservedMeasurement<{leftPx: number; topPx: number; rightPx: number; bottomPx: number}>;
    lineCount: ObservedMeasurement<number>;
    hierarchyAreaRatio: ObservedMeasurement<number>;
    subjectIntersectionRatio: ObservedMeasurement<number>;
    criticalIntersectionRatio: ObservedMeasurement<number>;
    treatmentVisibility: ObservedMeasurement<boolean>;
    temporalStability: ObservedMeasurement<number>;
    fontIdentity: ObservedMeasurement<{assetId: string; family: string; sha256: string}>;
    depthMode: ObservedMeasurement<string>;
  };
};

type SemanticRegion = {
  class: "critical" | "protected" | "flexible" | "free";
  label: string;
  box: {x: number; y: number; width: number; height: number};
};

const unobserved = <T>(reason: string): ObservedMeasurement<T> => ({
  status: "unobserved",
  reason,
  evidenceIds: [],
});

const rounded = (value: number): number => Number(value.toFixed(6));

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (Buffer.isBuffer(value)) return createHash("sha256").update(value).digest("hex");
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

const blockedObservation = ({
  observationId,
  declarationId,
  failures,
}: {
  observationId: string;
  declarationId: string;
  failures: string[];
}): ObservedComposition => {
  const body = {
    schemaVersion: "maul-observed-composition/v1" as const,
    observationId,
    declarationId,
    status: "blocked" as const,
    failures,
    frameEvidenceIds: [],
    measurements: {
      textBounds: unobserved<{leftPx: number; topPx: number; rightPx: number; bottomPx: number}>("Valid rendered and source-grounded control frames are required."),
      lineCount: unobserved<number>("Valid rendered and source-grounded control frames are required."),
      hierarchyAreaRatio: unobserved<number>("Valid rendered and source-grounded control frames are required."),
      subjectIntersectionRatio: unobserved<number>("A valid subject mask is required."),
      criticalIntersectionRatio: unobserved<number>("Valid semantic regions are required."),
      treatmentVisibility: unobserved<boolean>("Valid rendered and source-grounded control frames are required."),
      temporalStability: unobserved<number>("At least two valid samples are required."),
      fontIdentity: unobserved<{assetId: string; family: string; sha256: string}>("Independent font evidence is absent."),
      depthMode: unobserved<string>("Pixel z-order evidence is absent."),
    },
  };
  return {
    ...body,
    observationSha256: createHash("sha256")
      .update(JSON.stringify(canonicalize(body)))
      .digest("hex"),
  };
};

type FrameMeasurement = {
  evidenceIds: [string, string];
  width: number;
  height: number;
  changedCount: number;
  bounds: {leftPx: number; topPx: number; rightPx: number; bottomPx: number};
  lineAreas: number[];
  subjectChangedCount: number;
  criticalChangedCount: number;
};

const measureFrame = ({
  rendered,
  control,
  subjectMask,
  semanticRegions,
  threshold,
}: {
  rendered: CompositionFrameSample;
  control: CompositionFrameSample;
  subjectMask: {width: number; height: number; alpha: Buffer; sha256: string} | null;
  semanticRegions: SemanticRegion[];
  threshold: number;
}): FrameMeasurement => {
  if (createHash("sha256").update(rendered.bytes).digest("hex") !== rendered.sha256) {
    throw new Error(`Rendered frame ${rendered.outputMs} hash does not match retained bytes.`);
  }
  if (createHash("sha256").update(control.bytes).digest("hex") !== control.sha256) {
    throw new Error(`Typography-suppressed frame ${control.outputMs} hash does not match retained bytes.`);
  }
  const renderedPng = decodeRgbaPng(rendered.bytes);
  const controlPng = decodeRgbaPng(control.bytes);
  if (renderedPng.width !== controlPng.width || renderedPng.height !== controlPng.height) {
    throw new Error("Rendered and typography-suppressed control frame geometry differs.");
  }
  const {width, height} = renderedPng;
  if (subjectMask && (
    subjectMask.width !== width ||
    subjectMask.height !== height ||
    subjectMask.alpha.length !== width * height
  )) {
    throw new Error("Subject mask geometry differs from retained frame geometry.");
  }
  const changed = new Uint8Array(width * height);
  const rows = new Int32Array(height);
  let changedCount = 0;
  let subjectChangedCount = 0;
  let criticalChangedCount = 0;
  let leftPx = width;
  let topPx = height;
  let rightPx = -1;
  let bottomPx = -1;
  const critical = semanticRegions.filter((region) => region.class === "critical");
  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const difference = Math.max(
      Math.abs(renderedPng.pixels[offset]! - controlPng.pixels[offset]!),
      Math.abs(renderedPng.pixels[offset + 1]! - controlPng.pixels[offset + 1]!),
      Math.abs(renderedPng.pixels[offset + 2]! - controlPng.pixels[offset + 2]!),
      Math.abs(renderedPng.pixels[offset + 3]! - controlPng.pixels[offset + 3]!),
    );
    if (difference < threshold) continue;
    changed[pixelIndex] = 1;
    changedCount += 1;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    rows[y] += 1;
    leftPx = Math.min(leftPx, x);
    topPx = Math.min(topPx, y);
    rightPx = Math.max(rightPx, x);
    bottomPx = Math.max(bottomPx, y);
    if (subjectMask && subjectMask.alpha[pixelIndex]! > 8) subjectChangedCount += 1;
    if (critical.some((region) =>
      x >= region.box.x * width &&
      x < (region.box.x + region.box.width) * width &&
      y >= region.box.y * height &&
      y < (region.box.y + region.box.height) * height
    )) criticalChangedCount += 1;
  }
  if (changedCount === 0) {
    throw new Error(`Rendered frame ${rendered.outputMs} has no measurable pixel delta from its control.`);
  }
  const lineAreas: number[] = [];
  let currentArea = 0;
  let emptyGap = 0;
  for (const rowCount of rows) {
    if (rowCount > 0) {
      currentArea += rowCount;
      emptyGap = 0;
    } else if (currentArea > 0) {
      emptyGap += 1;
      if (emptyGap > 2) {
        lineAreas.push(currentArea);
        currentArea = 0;
        emptyGap = 0;
      }
    }
  }
  if (currentArea > 0) lineAreas.push(currentArea);
  return {
    evidenceIds: [
      `frame:${rendered.outputMs}:${rendered.sha256}`,
      `typography-control:${control.outputMs}:${control.sha256}`,
    ],
    width,
    height,
    changedCount,
    bounds: {leftPx, topPx, rightPx: rightPx + 1, bottomPx: bottomPx + 1},
    lineAreas,
    subjectChangedCount,
    criticalChangedCount,
  };
};

export const observeRenderedComposition = ({
  observationId,
  declarationId,
  renderedFrames,
  typographySuppressedFrames,
  subjectMask,
  semanticRegions,
  fontCapabilityEvidence,
  differenceThreshold = 32,
}: {
  observationId: string;
  declarationId: string;
  renderedFrames: CompositionFrameSample[];
  typographySuppressedFrames: CompositionFrameSample[];
  subjectMask: {width: number; height: number; alpha: Buffer; sha256: string} | null;
  semanticRegions: SemanticRegion[];
  fontCapabilityEvidence: {
    status: "verified";
    assetId: string;
    family: string;
    sha256: string;
    evidenceId: string;
  } | null;
  differenceThreshold?: number;
}): ObservedComposition => {
  const controlByTime = new Map(
    typographySuppressedFrames.map((frame) => [frame.outputMs, frame]),
  );
  if (renderedFrames.length === 0 || typographySuppressedFrames.length === 0) {
    return blockedObservation({
      observationId,
      declarationId,
      failures: ["Rendered observation requires timestamp-matched typography-suppressed control frames."],
    });
  }
  let frames: FrameMeasurement[];
  try {
    frames = renderedFrames.map((rendered) => {
      const control = controlByTime.get(rendered.outputMs);
      if (!control) {
        throw new Error(`No typography-suppressed control exists at ${rendered.outputMs} ms.`);
      }
      return measureFrame({
        rendered,
        control,
        subjectMask,
        semanticRegions,
        threshold: differenceThreshold,
      });
    });
  } catch (error) {
    return blockedObservation({
      observationId,
      declarationId,
      failures: [error instanceof Error ? error.message : String(error)],
    });
  }
  const first = frames[0]!;
  const allEvidenceIds = frames.flatMap((frame) => frame.evidenceIds);
  const firstEvidenceIds = [...first.evidenceIds];
  const lineAreas = [...first.lineAreas].sort((left, right) => right - left);
  const centers = frames.map((frame) => ({
    x: (frame.bounds.leftPx + frame.bounds.rightPx) / 2 / frame.width,
    y: (frame.bounds.topPx + frame.bounds.bottomPx) / 2 / frame.height,
  }));
  const movement = centers.slice(1).reduce((sum, center, index) => {
    const previous = centers[index]!;
    return sum + Math.hypot(center.x - previous.x, center.y - previous.y);
  }, 0);
  const temporalStability = centers.length >= 2
    ? rounded(Math.max(0, 1 - movement / (centers.length - 1)))
    : null;
  const subjectIntersection = subjectMask
    ? rounded(frames.reduce((sum, frame) => sum + frame.subjectChangedCount, 0) /
      frames.reduce((sum, frame) => sum + frame.changedCount, 0))
    : null;
  const criticalIntersection = semanticRegions.some((region) => region.class === "critical")
    ? rounded(frames.reduce((sum, frame) => sum + frame.criticalChangedCount, 0) /
      frames.reduce((sum, frame) => sum + frame.changedCount, 0))
    : null;
  const measurements: ObservedComposition["measurements"] = {
    textBounds: {status: "observed", value: first.bounds, evidenceIds: firstEvidenceIds},
    lineCount: {status: "observed", value: first.lineAreas.length, evidenceIds: firstEvidenceIds},
    hierarchyAreaRatio: {
      status: "observed",
      value: rounded(lineAreas.length >= 2 ? lineAreas[0]! / lineAreas[1]! : 1),
      evidenceIds: firstEvidenceIds,
    },
    subjectIntersectionRatio: subjectIntersection === null
      ? unobserved("No source-grounded subject mask was supplied.")
      : {status: "observed", value: subjectIntersection, evidenceIds: [...firstEvidenceIds, `mask:${subjectMask!.sha256}`]},
    criticalIntersectionRatio: criticalIntersection === null
      ? unobserved("No critical semantic regions were supplied.")
      : {status: "observed", value: criticalIntersection, evidenceIds: firstEvidenceIds},
    treatmentVisibility: {status: "observed", value: first.changedCount > 0, evidenceIds: firstEvidenceIds},
    temporalStability: temporalStability === null
      ? unobserved("At least two retained frames are required for temporal stability.")
      : {status: "observed", value: temporalStability, evidenceIds: allEvidenceIds},
    fontIdentity: fontCapabilityEvidence
      ? {
          status: "inferred",
          value: {
            assetId: fontCapabilityEvidence.assetId,
            family: fontCapabilityEvidence.family,
            sha256: fontCapabilityEvidence.sha256,
          },
          evidenceIds: [fontCapabilityEvidence.evidenceId, ...firstEvidenceIds],
        }
      : unobserved("No independent font capability evidence was supplied."),
    depthMode: unobserved("Rendered RGB pixels do not independently prove layer z-order."),
  };
  const body = {
    schemaVersion: "maul-observed-composition/v1" as const,
    observationId,
    declarationId,
    status: "observed" as const,
    failures: [],
    frameEvidenceIds: allEvidenceIds,
    measurements,
  };
  return {
    ...body,
    observationSha256: createHash("sha256")
      .update(JSON.stringify(canonicalize(body)))
      .digest("hex"),
  };
};
