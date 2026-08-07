import {createHash} from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import {afterEach, describe, expect, it} from "vitest";

import {createBlindedCompositionReviewPackage} from "../backend/src/maul/composition-review.js";
import {recordCompositionReviewFromFiles} from "./maul-composition-review.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.rm(directory, {recursive: true, force: true}),
  ));
});

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

describe("MAUL composition review CLI adapter", () => {
  it("records reviewed evidence atomically without modifying either candidate", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "maul-composition-review-"));
    temporaryDirectories.push(directory);
    const baselinePath = path.join(directory, "baseline.mp4");
    const repairPath = path.join(directory, "repair.mp4");
    const baselineBytes = Buffer.from("baseline candidate bytes");
    const repairBytes = Buffer.from("repair candidate bytes");
    await fs.writeFile(baselinePath, baselineBytes);
    await fs.writeFile(repairPath, repairBytes);

    const review = createBlindedCompositionReviewPackage({
      reviewPackageId: "scene_a_review",
      sourceGroup: "scene_a_source_group",
      sceneContext: {fixtureId: "scene_a", phrase: "MAKE IDEAS MATTER"},
      reviewSeed: "hidden-seed",
      candidates: [
        {
          candidateId: "baseline",
          declaredFingerprint: "a".repeat(64),
          observedFingerprint: "b".repeat(64),
          videoPath: baselinePath,
          stillPaths: [baselinePath],
          mutationProvenance: null,
        },
        {
          candidateId: "repair",
          declaredFingerprint: "c".repeat(64),
          observedFingerprint: "d".repeat(64),
          videoPath: repairPath,
          stillPaths: [repairPath],
          mutationProvenance: {
            parentCandidateId: "baseline",
            repairId: "repair-1",
            targetDimension: "semanticHierarchy",
          },
        },
      ],
    });
    const publicPath = path.join(directory, "public.json");
    const privatePath = path.join(directory, "private.json");
    const responsePath = path.join(directory, "response.json");
    const outputPath = path.join(directory, "reviewed-evidence.json");
    await Promise.all([
      fs.writeFile(publicPath, JSON.stringify(review.publicPackage)),
      fs.writeFile(privatePath, JSON.stringify(review.privateAssignment)),
      fs.writeFile(responsePath, JSON.stringify({
        choice: "b",
        reviewerId: "reviewer-1",
        reviewerConfidence: 0.9,
        failureDimensions: {a: ["hierarchy"], b: []},
        note: "Blinded review.",
        reviewedAt: "2026-08-07T09:00:00.000Z",
      })),
    ]);

    const evidence = await recordCompositionReviewFromFiles({
      publicPath,
      privatePath,
      responsePath,
      outputPath,
    });

    expect(JSON.parse(await fs.readFile(outputPath, "utf8"))).toEqual(evidence);
    expect(sha256(await fs.readFile(baselinePath))).toBe(sha256(baselineBytes));
    expect(sha256(await fs.readFile(repairPath))).toBe(sha256(repairBytes));
    expect(evidence.eligibility).toBe("experiment_only");
    expect(evidence.promotionEligible).toBe(false);
  });
});
