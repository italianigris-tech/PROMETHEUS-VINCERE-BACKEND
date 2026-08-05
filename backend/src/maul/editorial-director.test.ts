import {describe, expect, it} from "vitest";

import {createJosephEditorialDirector} from "./editorial-director.js";

describe("MAUL Joseph Editorial Director", () => {
  it("turns MAUL source facts into receipt-backed visual direction", async () => {
    const director = createJosephEditorialDirector();

    const direction = await director.plan({
      sourcePath: "source/example.mp4",
      durationMs: 4_000,
      seed: 42,
      profile: "joseph_cinematic",
      transcript: [
        {text: "Most", startMs: 0, endMs: 500},
        {text: "caption", startMs: 500, endMs: 1_000},
        {text: "systems", startMs: 1_000, endMs: 1_500},
        {text: "fake", startMs: 1_500, endMs: 2_000},
        {text: "quality.", startMs: 2_000, endMs: 2_500},
      ],
    });

    expect(direction.receipt).toMatchObject({
      directorId: "joseph",
      version: "maul-joseph-editorial-director/v1",
      doctrineId: expect.any(String),
      inputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(direction.visualBeats).toEqual(expect.arrayContaining([
      expect.objectContaining({startMs: 0, endMs: expect.any(Number)}),
    ]));
    expect(direction.visualBeats.at(-1)?.endMs).toBe(4_000);
    expect(direction.artDirection.typeRoles.length).toBeGreaterThanOrEqual(2);
  });
});
