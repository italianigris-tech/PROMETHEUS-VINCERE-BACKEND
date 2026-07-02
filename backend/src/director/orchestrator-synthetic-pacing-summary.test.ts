import {describe, expect, it} from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {ReplayLedger} from "../ledger/replay-ledger";
import {PromptRegistry} from "./prompt-governance";
import {orchestrateRender, type OrchestratorInput} from "./orchestrator";

const tempFile = (prefix: string, name: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return path.join(dir, name);
};

const registry = (): PromptRegistry =>
  new PromptRegistry(tempFile("orchestrator-prompts-", "registry.jsonl"));

const baseInput = (): OrchestratorInput => ({
  sourceVideoPath: "file:///test-video.mp4",
  transcriptPath: tempFile("orchestrator-synthetic-pacing-", "missing-transcript.json"),
  audioPath: "file:///test-audio.mp3",
  musicPath: "file:///test-music.mp3",
  profile: "joseph_aggressive",
  promptText: "high density short-form pacing with a protected climax",
  evidenceDir: fs.mkdtempSync(path.join(os.tmpdir(), "orchestrator-evidence-")),
});

describe("Director Orchestrator Synthetic Pacing Summary", () => {
  it("surfaces governed legal cut proposals in the candidate summary and planner diagnostics", async () => {
    const result = await orchestrateRender(baseInput(), new ReplayLedger(":memory:"), registry());
    const syntheticPacing = result.candidateScoreSummary.syntheticPacing;

    expect(syntheticPacing).toMatchObject({
      version: "joseph-synthetic-pacing-v1",
      proposals: expect.any(Array),
      rejectedCandidates: expect.any(Array),
      climaxBudget: expect.objectContaining({
        earlyImpactRejectedCount: expect.any(Number),
      }),
      studioDiagnostics: expect.objectContaining({
        visibleProposalCount: expect.any(Number),
        syncKinds: expect.any(Array),
      }),
    });
    expect(syntheticPacing.proposals.length).toBeGreaterThan(0);
    expect(syntheticPacing.proposals.every((proposal) => proposal.legalSyncWindow)).toBe(true);
    expect(syntheticPacing.proposals.map((proposal) => proposal.atMs)).toEqual(result.candidateScoreSummary.expectedCuts);
    expect(syntheticPacing.proposals.map((proposal) => proposal.sync)).toEqual(
      expect.arrayContaining(["beat"]),
    );
    expect(syntheticPacing.rejectedCandidates.map((candidate) => candidate.tag)).toContain("climax_budget_reserved");
    expect(syntheticPacing.climaxBudget.earlyImpactRejectedCount).toBeGreaterThan(0);
    expect(syntheticPacing.studioDiagnostics.visibleProposalCount).toBe(syntheticPacing.proposals.length);

    const auditPayload = JSON.parse(fs.readFileSync(result.evidencePaths.auditPath, "utf8"));
    expect(auditPayload.syntheticPacing).toEqual(syntheticPacing);

    const candidateScoreSummaryArtifact = JSON.parse(fs.readFileSync(result.evidencePaths.candidateScoreSummaryPath, "utf8"));
    expect(candidateScoreSummaryArtifact.syntheticPacing).toEqual(syntheticPacing);

    const plannerAuditArtifact = JSON.parse(fs.readFileSync(result.evidencePaths.plannerAuditPath, "utf8"));
    expect(plannerAuditArtifact.syntheticPacing).toEqual(syntheticPacing);
  });
});
