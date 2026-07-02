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
});
