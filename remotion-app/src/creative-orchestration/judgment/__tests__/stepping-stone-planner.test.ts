import {describe, expect, it} from "vitest";

import {CoreJudgmentEngine} from "..";
import {buildJudgmentInput} from "./test-helpers";

describe("stepping-stone planner", () => {
  it("emits a planner audit with bounded doctrine branches and a shortlist", async () => {
    const engine = new CoreJudgmentEngine();
    const plan = await engine.plan(buildJudgmentInput({
      transcriptSegment: "This changes everything for the brand",
      moment: {
        transcriptText: "This changes everything for the brand",
        momentType: "hook",
        importance: 0.97,
        energy: 0.9
      }
    }));

    expect(plan.plannerAudit).toBeTruthy();
    expect(plan.plannerAudit?.observationSnapshot.version).toBe("observation-snapshot-v1");
    expect(plan.plannerAudit?.observationSnapshot.facts.scene).toMatchObject({
      segmentId: "segment-1",
      momentId: "segment-1",
      durationMs: 1800,
      momentType: "hook"
    });
    expect(plan.plannerAudit?.observationSnapshot.facts.transcript).toMatchObject({
      text: "This changes everything for the brand",
      wordCount: 6
    });
    expect(plan.plannerAudit?.observationSnapshot.facts.audio.energy).toBe(0.9);
    expect(plan.plannerAudit?.observationSnapshot.facts.visual.safeZones).toEqual(["center", "top-safe", "bottom-safe"]);
    expect(plan.plannerAudit?.observationSnapshot.facts.production.assetFingerprintCount).toBe(0);
    expect(plan.plannerAudit?.observationSnapshot.facts.constraints.behindSubjectTextLegal).toBe(true);
    expect(Object.isFrozen(plan.plannerAudit?.observationSnapshot)).toBe(true);
    expect(Object.isFrozen(plan.plannerAudit?.observationSnapshot.facts.scene)).toBe(true);

    const replay = await engine.plan(buildJudgmentInput({
      transcriptSegment: "This changes everything for the brand",
      moment: {
        transcriptText: "This changes everything for the brand",
        momentType: "hook",
        importance: 0.97,
        energy: 0.9
      }
    }));
    expect(replay.plannerAudit?.observationSnapshot.fingerprint).toBe(plan.plannerAudit?.observationSnapshot.fingerprint);
    expect(plan.plannerAudit?.planningSnapshot.doctrineBranches.length).toBeGreaterThan(0);
    expect(plan.plannerAudit?.planningSnapshot.doctrineBranches.length).toBeLessThanOrEqual(3);
    expect(plan.plannerAudit?.shortlist.length).toBeGreaterThan(0);
    expect(plan.plannerAudit?.selectedPath.genomeIds.length).toBeGreaterThan(0);
  });

  it("records retrieval and GOD intents on planner genomes", async () => {
    const engine = new CoreJudgmentEngine();
    const plan = await engine.plan(buildJudgmentInput({
      transcriptSegment: "Show the product and the proof cleanly",
      retrievalResults: [
        {
          assetId: "asset-hero-1",
          library: "asset-memory-library",
          score: 0.91,
          why: "Strong semantic fit"
        }
      ],
      moment: {
        transcriptText: "Show the product and the proof cleanly",
        momentType: "payoff",
        importance: 0.95,
        energy: 0.76
      }
    }));

    expect(plan.plannerAudit?.shortlist.every((genome) => Boolean(genome.retrievalIntent))).toBe(true);
    expect(plan.plannerAudit?.shortlist.every((genome) => Boolean(genome.godEscalationIntent))).toBe(true);
  });

  it("adds planner trace entries while keeping the current judgment path operational", async () => {
    const engine = new CoreJudgmentEngine();
    const plan = await engine.plan(buildJudgmentInput({
      creatorStyleProfile: {
        noveltyPreference: 0.88,
        consistencyPreference: 0.24,
        premiumBias: 0.84,
        eleganceBias: 0.8,
        reducedMotionPreference: 0.2,
        humanMadeFeelBias: 0.86,
        avoidCliches: true,
        preferredTreatmentFamilies: [],
        forbiddenTreatmentFamilies: []
      }
    }));

    expect(plan.trace.some((entry) => entry.step === "observation-snapshot")).toBe(true);
    expect(plan.trace.some((entry) => entry.step === "planning-snapshot")).toBe(true);
    expect(plan.trace.some((entry) => entry.step === "beam-search")).toBe(true);
    expect(plan.candidateTreatments.some((candidate) => candidate.id === plan.selectedTreatment.id)).toBe(true);
  });
});
