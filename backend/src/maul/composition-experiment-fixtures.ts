import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";

import {z} from "zod";

import {decodeRgbaPng} from "./png-rgba.js";
import type {
  SceneEvidenceProvider,
  SceneEvidenceTimeline,
} from "./scene-evidence.js";

const sha256 = (value: Buffer | string): string =>
  createHash("sha256").update(value).digest("hex");

const sha256File = async (filePath: string): Promise<string> =>
  sha256(await readFile(filePath));

export const REFERENCE_TYPOGRAPHY_PARAGRAPH =
  "In today’s market, speed is everything. But moving fast without a clear strategy is just running in circles. True business growth isn't about doing more things; it’s about doing the right things with absolute focus. You need to look at your data, understand your customer's deepest pain points, and eliminate the friction in your processes. When you align your team around a single, massive goal, momentum follows automatically. Stop guessing what works. Build a system that guarantees it.";

export const REFERENCE_TYPOGRAPHY_TRANSCRIPT_DURATION_MS = 24_000;

const referenceTypographyChunks = [
  "speed is everything",
  "clear strategy",
  "running in circles",
  "true business growth",
  "absolute focus",
  "deepest pain points",
  "eliminate the friction",
  "align your team",
  "massive goal",
  "stop guessing",
  "build a system",
  "guarantees it",
] as const;

export const buildReferenceTypographyParagraph = () => ({
  text: REFERENCE_TYPOGRAPHY_PARAGRAPH,
  chunks: referenceTypographyChunks.map((text, index) => ({
    chunkId: `reference_typography_chunk_${String(index + 1).padStart(2, "0")}`,
    text,
  })),
});

export const buildReferenceTypographyTranscript = ({
  durationMs = REFERENCE_TYPOGRAPHY_TRANSCRIPT_DURATION_MS,
}: {
  durationMs?: number;
} = {}) => {
  const text = REFERENCE_TYPOGRAPHY_PARAGRAPH;
  const tokens = text.split(/\s+/u).filter(Boolean);
  if (!Number.isInteger(durationMs) || durationMs < tokens.length) {
    throw new Error(
      `Reference typography transcript duration must be an integer of at least ${tokens.length}ms.`,
    );
  }
  const weights = tokens.map((token) => Math.max(1, [...token].filter((character) => /[\p{L}\p{N}]/u.test(character)).length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let accumulatedWeight = 0;
  let startMs = 0;
  const words = tokens.map((word, index) => {
    accumulatedWeight += weights[index]!;
    const endMs = index === tokens.length - 1
      ? durationMs
      : Math.max(startMs + 1, Math.round((accumulatedWeight / totalWeight) * durationMs));
    const timedWord = {text: word, startMs, endMs, confidence: 1};
    startMs = endMs;
    return timedWord;
  });
  return {
    text,
    durationMs,
    transcript: {
      language: "en" as const,
      text,
      words,
    },
  };
};

export const COMPOSITION_EXPERIMENT_FIXTURES = {
  sceneA: {
    fixtureId: "scene_a_matted_lady_hierarchy_v1",
    sourceGroup: "matted_lady_static_5951e646",
    sourceRelativePath: "THE matted LADY TALKING HEAD MAUL TESTING.png",
    sourceSha256:
      "5951e646c36a284751a7b1f9f4d04c694c1d2bcd9487e24147a7631de5b5be7b",
    sourceGeometry: {width: 375, height: 666},
    phrase: "MAKE IDEAS MATTER",
    carrierBackground: "#08070b",
    output: {width: 1080, height: 1920, fps: 30, durationMs: 4000},
  },
  sceneB: {
    fixtureId: "scene_b_joseph_open_field_v1",
    sourceGroup: "joseph_raw_b6f0210e",
    sourceRelativePath:
      "remotion-app/public/uploads/raw_male_joseph_proof_v1/MALE-Head-Video-Raw.mp4",
    sourceSha256:
      "b6f0210efc00a3696ac259db528be6160aaa4441dd327bb193a488cfd00eb6d4",
    sourceGeometry: {width: 1280, height: 720},
    sourceIntervalMs: {startMs: 7000, endMs: 11000},
    crop: {x: 625, y: 0, width: 405, height: 720},
    cropSha256:
      "f90ecbe47f04b7a5bfd6c7252056611e6c875638aef46ea9cb38b5d46ea73572",
    phrase: "BUILD LASTING AUTHORITY",
    output: {width: 1080, height: 1920, fps: 30, durationMs: 4000},
  },
  ineligibleFalseMatte: {
    relativePath: "remotion-app/public/test-matte.mp4",
    sha256:
      "039f7e6ccbf97b769e06e70a6b24f9a5c4800094fbdb1e5f1af498a3096cf805",
  },
} as const;

const normalizedRegionSchema = z
  .object({
    label: z.string().min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .superRefine((region, context) => {
    if (region.x + region.width > 1 || region.y + region.height > 1) {
      context.addIssue({
        code: "custom",
        message: "Normalized semantic region leaves frame bounds.",
      });
    }
  });

const sceneBMapSchema = z
  .object({
    schemaVersion: z.literal("maul-composition-experiment-scene-map/v1"),
    fixtureId: z.literal("scene_b_joseph_open_field_v1"),
    sourceSha256: z.literal(COMPOSITION_EXPERIMENT_FIXTURES.sceneB.sourceSha256),
    crop: z.object({
      x: z.literal(625),
      y: z.literal(0),
      width: z.literal(405),
      height: z.literal(720),
    }).strict(),
    cropSha256: z.string().regex(/^[a-f0-9]{64}$/),
    annotations: z.array(
      z.object({
        sourceMs: z.number().int(),
        frameSha256: z.string().regex(/^[a-f0-9]{64}$/),
        provenance: z.object({
          kind: z.literal("immutable_source_crop_frame"),
          extractor: z.literal("remotion_bundled_ffmpeg"),
          outputGeometry: z.object({
            width: z.literal(540),
            height: z.literal(960),
          }).strict(),
        }).strict(),
        review: z.object({
          status: z.enum(["approved", "pending"]),
          reviewerKind: z.enum(["independent_visual_review", "generator"]),
          reviewerId: z.string().min(1),
          reviewedAt: z.string().datetime(),
        }).strict(),
        regions: z.object({
          critical: z.array(normalizedRegionSchema).min(1),
          protected: z.array(normalizedRegionSchema).min(1),
          flexible: z.array(normalizedRegionSchema).min(1),
          free: z.array(normalizedRegionSchema).min(1),
        }).strict(),
      }).strict(),
    ).length(3),
  })
  .strict();

export type SceneBSceneMap = z.infer<typeof sceneBMapSchema>;

export const validateSceneBSceneMap = (input: unknown): SceneBSceneMap => {
  const sampleTimes = Array.isArray((input as {annotations?: unknown})?.annotations)
    ? [...new Set((input as {annotations: Array<{sourceMs?: unknown}>}).annotations
        .map((entry) => entry.sourceMs)
        .filter((sourceMs): sourceMs is number => typeof sourceMs === "number"))]
        .sort((left, right) => left - right)
    : [];
  if (JSON.stringify(sampleTimes) !== JSON.stringify([7000, 9000, 11000])) {
    throw new Error("Scene B scene map must contain exactly 7, 9, and 11 seconds.");
  }
  const parsed = sceneBMapSchema.parse(input);
  if (parsed.cropSha256 !== COMPOSITION_EXPERIMENT_FIXTURES.sceneB.cropSha256) {
    throw new Error("Scene B crop hash does not match the bound experiment crop.");
  }
  if (parsed.annotations.some(
    (entry) =>
      entry.review.status !== "approved" ||
      entry.review.reviewerKind !== "independent_visual_review",
  )) {
    throw new Error("Every Scene B sample must be independently reviewed.");
  }
  return parsed;
};

export const assertEligibleExperimentSceneEvidence = async ({
  filePath,
  claimedStatus: _claimedStatus,
}: {
  filePath: string;
  claimedStatus?: string;
}): Promise<{sha256: string}> => {
  const fileSha256 = await sha256File(filePath);
  if (fileSha256 === COMPOSITION_EXPERIMENT_FIXTURES.ineligibleFalseMatte.sha256) {
    throw new Error(
      "Experiment scene evidence is ineligible: source is the quarantined static false matte.",
    );
  }
  return {sha256: fileSha256};
};

export const deriveSceneAAlphaEvidence = async ({
  repoRoot,
}: {
  repoRoot: string;
}) => {
  const fixture = COMPOSITION_EXPERIMENT_FIXTURES.sceneA;
  const sourcePath = path.join(repoRoot, fixture.sourceRelativePath);
  const sourceSha256 = await sha256File(sourcePath);
  if (sourceSha256 !== fixture.sourceSha256) {
    throw new Error("Scene A source hash does not match the bound fixture.");
  }
  const decoded = decodeRgbaPng(await readFile(sourcePath));
  const {width, height} = fixture.sourceGeometry;
  if (decoded.width !== width || decoded.height !== height) {
    throw new Error(
      `Scene A PNG geometry ${decoded.width}x${decoded.height} does not match ${width}x${height}.`,
    );
  }
  const alpha = Buffer.alloc(width * height);
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = decoded.pixels[index * 4 + 3]!;
  }
  let occupied = 0;
  let minX: number = width;
  let minY: number = height;
  let maxX: number = -1;
  let maxY: number = -1;
  for (let index = 0; index < alpha.length; index += 1) {
    if (alpha[index]! <= 8) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    occupied += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (occupied === 0) {
    throw new Error("Scene A immutable PNG contains no nontransparent subject pixels.");
  }
  const round = (value: number): number => Number(value.toFixed(6));
  return {
    sourceSha256,
    alphaSha256: sha256(alpha),
    width,
    height,
    occupancyRatio: round(occupied / alpha.length),
    subjectBox: {
      x: round(minX / width),
      y: round(minY / height),
      width: round((maxX - minX + 1) / width),
      height: round((maxY - minY + 1) / height),
    },
    provenance: {
      kind: "immutable_source_alpha" as const,
      channel: "alpha" as const,
      extractor: "node_png_rgba_decoder/v1" as const,
    },
  };
};

export const loadCompositionExperimentFixtureEvidence = async ({
  repoRoot,
}: {
  repoRoot: string;
}) => {
  const sceneAPath = path.join(
    repoRoot,
    COMPOSITION_EXPERIMENT_FIXTURES.sceneA.sourceRelativePath,
  );
  const sceneBPath = path.join(
    repoRoot,
    COMPOSITION_EXPERIMENT_FIXTURES.sceneB.sourceRelativePath,
  );
  const sceneMapPath = path.join(
    repoRoot,
    "backend/src/maul/fixtures/composition-experiment-scenes.json",
  );
  const [sceneASha256, sceneBSha256, rawSceneMap] = await Promise.all([
    sha256File(sceneAPath),
    sha256File(sceneBPath),
    readFile(sceneMapPath, "utf8"),
  ]);
  if (sceneASha256 !== COMPOSITION_EXPERIMENT_FIXTURES.sceneA.sourceSha256) {
    throw new Error("Scene A source hash does not match the bound fixture.");
  }
  if (sceneBSha256 !== COMPOSITION_EXPERIMENT_FIXTURES.sceneB.sourceSha256) {
    throw new Error("Scene B source hash does not match the bound fixture.");
  }
  return {
    sceneA: {sourcePath: sceneAPath, sourceSha256: sceneASha256, sourceValidated: true},
    sceneB: {
      sourcePath: sceneBPath,
      sourceSha256: sceneBSha256,
      sourceValidated: true,
      sceneMap: validateSceneBSceneMap(JSON.parse(rawSceneMap)),
    },
  };
};

type CompositionExperimentFixtureId =
  | typeof COMPOSITION_EXPERIMENT_FIXTURES.sceneA.fixtureId
  | typeof COMPOSITION_EXPERIMENT_FIXTURES.sceneB.fixtureId;

const round = (value: number): number => Number(value.toFixed(6));

const mapSceneASubjectBoxToOutput = (
  box: Awaited<ReturnType<typeof deriveSceneAAlphaEvidence>>["subjectBox"],
) => {
  const source = COMPOSITION_EXPERIMENT_FIXTURES.sceneA.sourceGeometry;
  const output = COMPOSITION_EXPERIMENT_FIXTURES.sceneA.output;
  const scale = Math.min(output.width / source.width, output.height / source.height);
  const renderedWidth = source.width * scale;
  const renderedHeight = source.height * scale;
  const offsetX = (output.width - renderedWidth) / 2;
  const offsetY = output.height - renderedHeight;
  return {
    x: round((offsetX + box.x * renderedWidth) / output.width),
    y: round((offsetY + box.y * renderedHeight) / output.height),
    width: round((box.width * renderedWidth) / output.width),
    height: round((box.height * renderedHeight) / output.height),
  };
};

const sceneAProvider = (repoRoot: string): SceneEvidenceProvider => ({
  async inspect(input): Promise<SceneEvidenceTimeline> {
    const alpha = await deriveSceneAAlphaEvidence({repoRoot});
    const subjectBox = mapSceneASubjectBoxToOutput(alpha.subjectBox);
    const startMs = Math.min(...input.beats.map((beat) => beat.startMs));
    const endMs = Math.max(...input.beats.map((beat) => beat.endMs));
    return {
      status: "available",
      providerId: "maul_fixture_scene_a_alpha",
      providerVersion: "1",
      holds: [{
        beatId: "scene_a_static_hold",
        sceneId: "scene_a_static",
        discontinuityId: "scene_a_static_alpha",
        outputStartMs: startMs,
        outputEndMs: endMs,
        sourceFrameIds: [`alpha:${alpha.alphaSha256}`],
        sourceCrop: {x: 0, y: 0, width: 1, height: 1},
        subject: {trackingState: "tracked", box: subjectBox},
        existingTextRegions: [],
        opportunities: [
          {
            regionId: "alpha_integrated_upper_right",
            box: {x: 0.68, y: 0.14, width: 0.27, height: 0.28},
            negativeSpace: 0.55,
            readability: 0.72,
            clutter: 0.22,
            faceInterference: 0,
            overlapPolicy: "controlled_overlap",
            temporalStability: 1,
          },
          {
            regionId: "alpha_integrated_upper_left",
            box: {x: 0.04, y: 0.16, width: 0.28, height: 0.25},
            negativeSpace: 0.48,
            readability: 0.68,
            clutter: 0.24,
            faceInterference: 0,
            overlapPolicy: "controlled_overlap",
            temporalStability: 1,
          },
        ],
      }],
    };
  },
});

const sceneBProvider = (repoRoot: string): SceneEvidenceProvider => ({
  async inspect(input): Promise<SceneEvidenceTimeline> {
    const evidence = await loadCompositionExperimentFixtureEvidence({repoRoot});
    const annotations = evidence.sceneB.sceneMap.annotations;
    const freeRegions = annotations.flatMap((annotation) => annotation.regions.free);
    const free = freeRegions.reduce(
      (accumulator, region) => ({
        x: accumulator.x + region.x,
        y: accumulator.y + region.y,
        width: accumulator.width + region.width,
        height: accumulator.height + region.height,
      }),
      {x: 0, y: 0, width: 0, height: 0},
    );
    const count = freeRegions.length;
    const opportunity = {
      x: round(free.x / count),
      y: round(free.y / count),
      width: round(free.width / count),
      height: round(free.height / count),
    };
    return {
      status: "available",
      providerId: "maul_fixture_scene_b_reviewed_map",
      providerVersion: "1",
      holds: input.beats.map((beat, index) => ({
        beatId: beat.beatId,
        sceneId: `scene_b_${index + 1}`,
        discontinuityId: "scene_b_reviewed_crop",
        outputStartMs: beat.startMs,
        outputEndMs: beat.endMs,
        sourceFrameIds: annotations.map(
          (annotation) => `frame:${annotation.sourceMs}:${annotation.frameSha256}`,
        ),
        sourceCrop: {
          x: COMPOSITION_EXPERIMENT_FIXTURES.sceneB.crop.x /
            COMPOSITION_EXPERIMENT_FIXTURES.sceneB.sourceGeometry.width,
          y: 0,
          width: COMPOSITION_EXPERIMENT_FIXTURES.sceneB.crop.width /
            COMPOSITION_EXPERIMENT_FIXTURES.sceneB.sourceGeometry.width,
          height: 1,
        },
        subject: {
          trackingState: "tracked",
          box: {x: 0, y: 0.1, width: 0.79, height: 0.86},
        },
        existingTextRegions: [],
        opportunities: [{
          regionId: "reviewed_open_right_field",
          box: opportunity,
          negativeSpace: 0.72,
          readability: 0.76,
          clutter: 0.3,
          faceInterference: 0,
          temporalStability: 0.94,
        }],
      })),
    };
  },
});

export const createCompositionExperimentSceneEvidenceProvider = ({
  fixtureId,
  repoRoot,
}: {
  fixtureId: CompositionExperimentFixtureId;
  repoRoot: string;
}): SceneEvidenceProvider => fixtureId === COMPOSITION_EXPERIMENT_FIXTURES.sceneA.fixtureId
  ? sceneAProvider(repoRoot)
  : sceneBProvider(repoRoot);
