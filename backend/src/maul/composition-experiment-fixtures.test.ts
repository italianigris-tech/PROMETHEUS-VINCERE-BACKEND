import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";

import {
  COMPOSITION_EXPERIMENT_FIXTURES,
  assertEligibleExperimentSceneEvidence,
  createCompositionExperimentSceneEvidenceProvider,
  deriveSceneAAlphaEvidence,
  loadCompositionExperimentFixtureEvidence,
  validateSceneBSceneMap,
} from "./composition-experiment-fixtures.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const sceneMapPath = path.join(
  repoRoot,
  "backend",
  "src",
  "maul",
  "fixtures",
  "composition-experiment-scenes.json",
);

describe("composition experiment fixtures", () => {
  it("binds both experiment scenes to immutable source facts", async () => {
    expect(COMPOSITION_EXPERIMENT_FIXTURES.sceneA).toMatchObject({
      fixtureId: "scene_a_matted_lady_hierarchy_v1",
      sourceGroup: "matted_lady_static_5951e646",
      sourceSha256:
        "5951e646c36a284751a7b1f9f4d04c694c1d2bcd9487e24147a7631de5b5be7b",
      phrase: "MAKE IDEAS MATTER",
      output: {width: 1080, height: 1920, fps: 30, durationMs: 4000},
    });
    expect(COMPOSITION_EXPERIMENT_FIXTURES.sceneB).toMatchObject({
      fixtureId: "scene_b_joseph_open_field_v1",
      sourceGroup: "joseph_raw_b6f0210e",
      sourceSha256:
        "b6f0210efc00a3696ac259db528be6160aaa4441dd327bb193a488cfd00eb6d4",
      sourceIntervalMs: {startMs: 7000, endMs: 11000},
      crop: {x: 625, y: 0, width: 405, height: 720},
      cropSha256:
        "f90ecbe47f04b7a5bfd6c7252056611e6c875638aef46ea9cb38b5d46ea73572",
      phrase: "BUILD LASTING AUTHORITY",
    });

    const evidence = await loadCompositionExperimentFixtureEvidence({repoRoot});
    expect(evidence.sceneA.sourceValidated).toBe(true);
    expect(evidence.sceneB.sourceValidated).toBe(true);
    expect(evidence.sceneB.sceneMap.annotations.map((entry) => entry.sourceMs)).toEqual([
      7000,
      9000,
      11000,
    ]);
  });

  it("rejects the known static false matte regardless of caller labels", async () => {
    await expect(
      assertEligibleExperimentSceneEvidence({
        filePath: path.join(repoRoot, "remotion-app", "public", "test-matte.mp4"),
        claimedStatus: "verified",
      }),
    ).rejects.toThrow(/ineligible.*static false matte/i);
  });

  it("rejects incomplete, unreviewed, or crop-mismatched Scene B maps", async () => {
    const validMap = JSON.parse(await readFile(sceneMapPath, "utf8"));

    const missingSample = structuredClone(validMap);
    missingSample.annotations = missingSample.annotations.filter(
      (entry: {sourceMs: number}) => entry.sourceMs !== 9000,
    );
    expect(() => validateSceneBSceneMap(missingSample)).toThrow(/7, 9, and 11 seconds/i);

    const unreviewed = structuredClone(validMap);
    unreviewed.annotations[0].review.status = "pending";
    expect(() => validateSceneBSceneMap(unreviewed)).toThrow(/independently reviewed/i);

    const cropMismatch = structuredClone(validMap);
    cropMismatch.cropSha256 = "0".repeat(64);
    expect(() => validateSceneBSceneMap(cropMismatch)).toThrow(/crop hash/i);
  });

  it("derives Scene A subject geometry from immutable PNG alpha pixels", async () => {
    const evidence = await deriveSceneAAlphaEvidence({repoRoot});

    expect(evidence).toMatchObject({
      sourceSha256:
        "5951e646c36a284751a7b1f9f4d04c694c1d2bcd9487e24147a7631de5b5be7b",
      width: 375,
      height: 666,
      provenance: {
        kind: "immutable_source_alpha",
        channel: "alpha",
      },
    });
    expect(evidence.occupancyRatio).toBeGreaterThan(0.1);
    expect(evidence.occupancyRatio).toBeLessThan(0.9);
    expect(evidence.occupancyRatio).toBe(0.721325);
    expect(evidence.subjectBox.x).toBeGreaterThanOrEqual(0);
    expect(evidence.subjectBox.y).toBeGreaterThanOrEqual(0);
    expect(evidence.subjectBox.x + evidence.subjectBox.width).toBeLessThanOrEqual(1);
    expect(evidence.subjectBox.y + evidence.subjectBox.height).toBeLessThanOrEqual(1);
    expect(evidence.alphaSha256).toBe(
      "440b5718f9d14c6ccbaca39ba4053215bd1ce771427bfd5bbb7e22a83acec796",
    );
  });

  it("adapts immutable fixture evidence through the existing scene provider seam", async () => {
    const sceneAProvider = createCompositionExperimentSceneEvidenceProvider({
      fixtureId: "scene_a_matted_lady_hierarchy_v1",
      repoRoot,
    });
    const sceneA = await sceneAProvider.inspect({
      sourcePath: "carrier-is-transport-only.mp4",
      beats: [{beatId: "beat_a", startMs: 0, endMs: 4000, purpose: "SETUP"}],
    });
    expect(sceneA).toMatchObject({
      status: "available",
      providerId: "maul_fixture_scene_a_alpha",
      providerVersion: "1",
      holds: [{
        beatId: "scene_a_static_hold",
        sourceFrameIds: [
          "alpha:440b5718f9d14c6ccbaca39ba4053215bd1ce771427bfd5bbb7e22a83acec796",
        ],
      }],
    });

    const sceneBProvider = createCompositionExperimentSceneEvidenceProvider({
      fixtureId: "scene_b_joseph_open_field_v1",
      repoRoot,
    });
    const sceneB = await sceneBProvider.inspect({
      sourcePath: COMPOSITION_EXPERIMENT_FIXTURES.sceneB.sourceRelativePath,
      beats: [{beatId: "beat_b", startMs: 0, endMs: 4000, purpose: "SETUP"}],
    });
    expect(sceneB).toMatchObject({
      status: "available",
      providerId: "maul_fixture_scene_b_reviewed_map",
      providerVersion: "1",
    });
    if (sceneB.status !== "available") throw new Error("Expected Scene B evidence.");
    expect(sceneB.holds[0]?.sourceFrameIds).toHaveLength(3);
    expect(sceneB.holds[0]?.opportunities[0]?.box.x).toBeGreaterThan(0.3);
  });

  it("keeps the static Scene A evidence continuous across editorial beats", async () => {
    const provider = createCompositionExperimentSceneEvidenceProvider({
      fixtureId: "scene_a_matted_lady_hierarchy_v1",
      repoRoot,
    });

    const evidence = await provider.inspect({
      sourcePath: "carrier-is-transport-only.mp4",
      beats: [
        {beatId: "hook", startMs: 0, endMs: 2_000, purpose: "HOOK"},
        {beatId: "payoff", startMs: 2_000, endMs: 4_000, purpose: "PAYOFF"},
      ],
    });

    expect(evidence).toMatchObject({
      status: "available",
      holds: [
        {
          beatId: "scene_a_static_hold",
          sceneId: "scene_a_static",
          discontinuityId: "scene_a_static_alpha",
          outputStartMs: 0,
          outputEndMs: 4_000,
        },
      ],
    });
    if (evidence.status !== "available") throw new Error("Expected Scene A evidence.");
    expect(evidence.holds).toHaveLength(1);
  });
});
