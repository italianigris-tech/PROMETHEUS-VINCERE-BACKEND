import {describe, expect, it} from "vitest";

import {buildJosephSyntheticPacingPlan} from "./joseph-synthetic-pacing";

describe("Joseph synthetic pacing on an editorially remapped source", () => {
  it("uses the final phrase start when the phrase end equals render duration", () => {
    const plan = buildJosephSyntheticPacingPlan({
      profile: "joseph_cinematic",
      durationMs: 44_400,
      energyCurve: [0.42, 0.68, 0.78, 0.55, 0.74, 0.62],
      beats: [41_500, 42_000, 42_500, 43_000, 43_500, 44_000],
      onsets: [41_400, 42_240, 42_720, 43_160, 43_600, 44_000],
      phrases: [
        {
          startMs: 41_400,
          endMs: 42_240,
          text: "nuances to this",
          words: [
            {text: "nuances", startMs: 41_400, endMs: 41_800},
            {text: "to", startMs: 41_800, endMs: 42_000},
            {text: "this", startMs: 42_000, endMs: 42_240},
          ],
        },
        {
          startMs: 42_240,
          endMs: 44_400,
          text: "specific E2A flipping model.",
          words: [
            {text: "specific", startMs: 42_240, endMs: 42_720},
            {text: "E2A", startMs: 42_720, endMs: 43_160},
            {text: "flipping", startMs: 43_160, endMs: 43_600},
            {text: "model.", startMs: 43_600, endMs: 44_400},
          ],
        },
      ],
    });

    expect(plan.proposals.map((proposal) => proposal.atMs)).toContain(42_240);
    expect(plan.proposals.find((proposal) => proposal.atMs === 42_240)).toMatchObject({
      kind: "emphasis_cut",
      sync: "phrase",
      legalSyncWindow: true,
    });
  });
});
