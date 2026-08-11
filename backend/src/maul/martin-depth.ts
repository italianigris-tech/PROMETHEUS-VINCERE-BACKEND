export type MartinNormalizedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MartinDepthCandidate = {
  segmentId: string;
  tokenId: string;
  outputStartMs: number;
  outputEndMs: number;
  sourceStartMs: number;
  sourceEndMs: number;
  fontWeight: number;
  visualWeightClass?: "bold";
  tokenBox: MartinNormalizedBox;
  subjectBox: MartinNormalizedBox;
};

export type MartinDepthSelection = {
  segmentId: string;
  tokenId: string;
  outputStartMs: number;
  outputEndMs: number;
  sourceStartMs: number;
  sourceEndMs: number;
  fontWeight: number;
  boldEvidence: "css_weight" | "profile_visual_weight";
  overlapRatio: number;
  reason: "bold_subject_overlap";
};

export type MartinMatteWindow = {
  windowId: string;
  sourceStartMs: number;
  sourceEndMs: number;
  outputStartMs: number;
  outputEndMs: number;
};

export type MartinMatteBatchRequest = {
  schemaVersion: "maul-martin-matte-request/v1";
  requestKind: "martin_matte_batch";
  jobId: string;
  source: {inputUrl: string; sha256: string; durationMs: number};
  selections: MartinDepthSelection[];
  windows: MartinMatteWindow[];
};

export const martinMatteBatchRequestSchema = z.object({
  schemaVersion: z.literal("maul-martin-matte-request/v1"),
  requestKind: z.literal("martin_matte_batch"),
  jobId: z.string().trim().min(1),
  source: z.object({
    inputUrl: z.string().trim().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    durationMs: z.number().int().positive(),
  }),
  selections: z.array(z.object({
    segmentId: z.string().trim().min(1), tokenId: z.string().trim().min(1),
    outputStartMs: z.number().int().nonnegative(), outputEndMs: z.number().int().positive(),
    sourceStartMs: z.number().int().nonnegative(), sourceEndMs: z.number().int().positive(),
    fontWeight: z.number().int().min(100), overlapRatio: z.number().min(0.12).max(1),
    boldEvidence: z.enum(["css_weight", "profile_visual_weight"]),
    reason: z.literal("bold_subject_overlap"),
  })),
  windows: z.array(z.object({
    windowId: z.string().trim().min(1),
    sourceStartMs: z.number().int().nonnegative(), sourceEndMs: z.number().int().positive(),
    outputStartMs: z.number().int().nonnegative(), outputEndMs: z.number().int().positive(),
  })).min(1),
});

const intersectionArea = (a: MartinNormalizedBox, b: MartinNormalizedBox): number => {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
};

export const martinSubjectOverlapRatio = (
  tokenBox: MartinNormalizedBox,
  subjectBox: MartinNormalizedBox,
): number => {
  const tokenArea = tokenBox.width * tokenBox.height;
  return tokenArea > 0 ? intersectionArea(tokenBox, subjectBox) / tokenArea : 0;
};

export const buildMartinDepthRequest = ({
  jobId,
  source,
  candidates,
  minimumBoldWeight = 700,
  minimumOverlapRatio = 0.12,
  bufferMs = 1_000,
  mergeGapMs = 250,
}: {
  jobId: string;
  source: MartinMatteBatchRequest["source"];
  candidates: MartinDepthCandidate[];
  minimumBoldWeight?: number;
  minimumOverlapRatio?: number;
  bufferMs?: number;
  mergeGapMs?: number;
}): MartinMatteBatchRequest => {
  const selections = candidates.flatMap((candidate): MartinDepthSelection[] => {
    const overlapRatio = martinSubjectOverlapRatio(candidate.tokenBox, candidate.subjectBox);
    const profileProvesBold = candidate.visualWeightClass === "bold";
    if ((!profileProvesBold && candidate.fontWeight < minimumBoldWeight) || overlapRatio < minimumOverlapRatio) return [];
    return [{
      segmentId: candidate.segmentId,
      tokenId: candidate.tokenId,
      outputStartMs: candidate.outputStartMs,
      outputEndMs: candidate.outputEndMs,
      sourceStartMs: candidate.sourceStartMs,
      sourceEndMs: candidate.sourceEndMs,
      fontWeight: candidate.fontWeight,
      boldEvidence: profileProvesBold ? "profile_visual_weight" : "css_weight",
      overlapRatio,
      reason: "bold_subject_overlap",
    }];
  });

  const buffered = selections
    .map((selection) => ({
      sourceStartMs: Math.max(0, selection.sourceStartMs - bufferMs),
      sourceEndMs: Math.min(source.durationMs, selection.sourceEndMs + bufferMs),
      outputStartMs: Math.max(0, selection.outputStartMs - bufferMs),
      outputEndMs: Math.min(source.durationMs, selection.outputEndMs + bufferMs),
    }))
    .sort((a, b) => a.sourceStartMs - b.sourceStartMs);
  const merged: Omit<MartinMatteWindow, "windowId">[] = [];
  for (const window of buffered) {
    const prior = merged.at(-1);
    if (prior && window.sourceStartMs <= prior.sourceEndMs + mergeGapMs) {
      prior.sourceEndMs = Math.max(prior.sourceEndMs, window.sourceEndMs);
      prior.outputEndMs = Math.max(prior.outputEndMs, window.outputEndMs);
    } else {
      merged.push({...window});
    }
  }

  return {
    schemaVersion: "maul-martin-matte-request/v1",
    requestKind: "martin_matte_batch",
    jobId,
    source,
    selections,
    windows: merged.map((window, index) => ({...window, windowId: `martin-window-${index + 1}`})),
  };
};
import {z} from "zod";
