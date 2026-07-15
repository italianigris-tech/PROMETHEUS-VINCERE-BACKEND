import {describe, expect, it} from "vitest";
import {buildJosephSyntheticPacingPlan} from "./joseph-synthetic-pacing";

describe("Joseph Synthetic Pacing", () => {
  it("proposes only legal sync-window cuts while reserving early climax budget", () => {
    const plan = buildJosephSyntheticPacingPlan({
      profile: "joseph_aggressive",
      durationMs: 10_000,
      energyCurve: [0.35, 0.78, 0.86, 0.48, 0.7, 0.82, 0.44, 0.76, 0.9],
      beats: [500, 1500, 2500, 3500, 4300, 6100, 7000, 8000, 8800],
      onsets: [200, 800, 3300, 4300, 8000],
      phrases: [
        {
          startMs: 0,
          endMs: 1200,
          text: "hook phrase",
          words: [
            {text: "Listen", startMs: 200, endMs: 420},
            {text: "closely", startMs: 520, endMs: 820},
          ],
        },
        {
          startMs: 3300,
          endMs: 3900,
          text: "body phrase",
          words: [{text: "Move", startMs: 3300, endMs: 3600}],
        },
        {
          startMs: 7600,
          endMs: 8400,
          text: "cta phrase",
          words: [{text: "Now", startMs: 8000, endMs: 8300}],
        },
      ],
    });

    expect(plan.version).toBe("joseph-synthetic-pacing-v1");
    expect(plan.proposals.map((proposal) => proposal.atMs)).toEqual([200, 500, 3300, 7000, 8000, 8800]);
    expect(plan.proposals.every((proposal) => proposal.legalSyncWindow)).toBe(true);
    expect(plan.proposals.map((proposal) => proposal.sync)).toEqual(
      expect.arrayContaining(["beat", "breath"]),
    );
    expect(plan.rejectedCandidates.map((candidate) => candidate.tag)).toContain("climax_budget_reserved");
    expect(plan.climaxBudget).toMatchObject({
      earlyImpactLimit: 2,
      earlyImpactUsed: 2,
      earlyImpactRejectedCount: 2,
      remainingEarlyImpactSlots: 0,
    });
    expect(plan.studioDiagnostics).toMatchObject({
      visibleProposalCount: plan.proposals.length,
      warnings: ["climax_budget_reserved"],
    });
  });

  it("uses the terminal phrase end when the final CTA beat falls inside a word", () => {
    const plan = buildJosephSyntheticPacingPlan({
      profile: "joseph_cinematic",
      durationMs: 61_172,
      energyCurve: [0.42, 0.68, 0.78, 0.55, 0.74, 0.62],
      beats: [57_500, 58_000, 58_500, 59_000, 59_500, 60_000, 60_500],
      onsets: [59_190, 59_630, 59_750, 59_870, 60_070, 60_450],
      phrases: [
        {
          startMs: 58_110,
          endMs: 59_190,
          text: "know if they were actually being",
          words: [
            {text: "know", startMs: 58_110, endMs: 58_230},
            {text: "if they", startMs: 58_230, endMs: 58_430},
            {text: "were", startMs: 58_430, endMs: 58_630},
            {text: "actually", startMs: 58_630, endMs: 58_910},
            {text: "being", startMs: 58_910, endMs: 59_190},
          ],
        },
        {
          startMs: 59_190,
          endMs: 61_010,
          text: "delivered to my house successfully, successfully.",
          words: [
            {text: "delivered", startMs: 59_190, endMs: 59_630},
            {text: "to", startMs: 59_630, endMs: 59_750},
            {text: "my", startMs: 59_750, endMs: 59_870},
            {text: "house", startMs: 59_870, endMs: 60_070},
            {text: "successfully,", startMs: 60_070, endMs: 60_380},
            {text: "successfully.", startMs: 60_450, endMs: 61_010},
          ],
        },
      ],
    });

    expect(plan.proposals.map((proposal) => proposal.atMs)).toContain(61_010);
    expect(plan.proposals.find((proposal) => proposal.atMs === 61_010)).toMatchObject({
      sync: "phrase",
      legalSyncWindow: true,
    });
  });
});
