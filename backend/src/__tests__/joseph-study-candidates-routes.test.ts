import {existsSync} from "node:fs";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

describe("Joseph study candidate routes", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("generates synchronized Studio lanes from real Joseph manifests", async () => {
    const context = await createTestApp({storageDir: tempDir});

    const response = await context.app.inject({
      method: "POST",
      url: "/api/joseph-study/candidates",
      payload: {
        candidateCount: 2,
        sourceVideoPath: "/dev-fixtures/test-video.mp4",
        promptText: "Make two distinct Joseph study lanes.",
        profile: "joseph_aggressive",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.version).toBe("joseph-study-candidates-v1");
    expect(body.requestedCount).toBe(2);
    expect(body.lanes).toHaveLength(2);
    expect(body.failures).toEqual([]);

    for (const lane of body.lanes) {
      expect(lane.status).toBe("ready");
      expect(lane.candidateId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(lane.doctrineBranch).toEqual(expect.any(String));
      expect(lane.manifestHash).toMatch(/^[a-f0-9]{64}$/);
      expect(existsSync(lane.evidencePointer)).toBe(true);
      expect(lane.manifest.width).toBe(1080);
      expect(lane.manifest.height).toBe(1920);
    }

    expect(body.lanes[0].manifestHash).not.toBe(body.lanes[1].manifestHash);

    await context.app.close();
  }, 20_000);

  it("returns visible failed lanes with captured evidence", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        josephStudyCandidateGenerator: async (input) => ({
          version: "joseph-study-candidates-v1",
          requestedCount: input.candidateCount,
          lanes: [
            {
              id: "candidate-1",
              label: "Candidate A",
              status: "failed",
              candidateId: null,
              doctrineBranch: null,
              manifestHash: null,
              evidencePointer: `${tempDir}/failed-lane`,
              errorMessage: "fixture generation failed",
              failureTags: ["candidate_generation_failed"],
            },
          ],
          failures: [
            {
              id: "candidate-1",
              label: "Candidate A",
              status: "failed",
              candidateId: null,
              doctrineBranch: null,
              manifestHash: null,
              evidencePointer: `${tempDir}/failed-lane`,
              errorMessage: "fixture generation failed",
              failureTags: ["candidate_generation_failed"],
            },
          ],
        }),
      },
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/api/joseph-study/candidates",
      payload: {candidateCount: 2},
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.lanes[0]).toMatchObject({
      status: "failed",
      errorMessage: "fixture generation failed",
      failureTags: ["candidate_generation_failed"],
      evidencePointer: `${tempDir}/failed-lane`,
    });
    expect(body.failures).toHaveLength(1);

    await context.app.close();
  });

  it("rejects candidate counts outside the Studio lane bounds", async () => {
    const context = await createTestApp({storageDir: tempDir});

    const response = await context.app.inject({
      method: "POST",
      url: "/api/joseph-study/candidates",
      payload: {candidateCount: 7},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("Invalid Joseph study candidate request.");

    await context.app.close();
  });
});
