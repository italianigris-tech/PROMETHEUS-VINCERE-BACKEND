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
  transcriptPath: tempFile("orchestrator-transcript-", "missing-transcript.json"),
  audioPath: "file:///test-audio.mp3",
  musicPath: "file:///test-music.mp3",
  profile: "joseph_aggressive",
  promptText: "high energy edit with clear hook",
  evidenceDir: fs.mkdtempSync(path.join(os.tmpdir(), "orchestrator-evidence-")),
});

describe("Director Orchestrator Candidate Score Summary", () => {
  it("exposes the flat backend scoring record without using the PlannerAudit surface", async () => {
    const ledger = new ReplayLedger(":memory:");
    const result = await orchestrateRender(baseInput(), ledger, registry());

    expect(result.candidateScoreSummary).toMatchObject({
      candidateScores: expect.any(Array),
      expectedCuts: expect.any(Array),
      sequenceMemory: expect.any(Array),
    });
    expect("plannerAudit" in result).toBe(false);
    expect(result.evidence).toHaveProperty("candidateScoreSummary", result.candidateScoreSummary);
    expect(result.evidence).not.toHaveProperty("plannerAudit");

    const auditPayload = JSON.parse(fs.readFileSync(result.evidencePaths.auditPath, "utf8"));
    expect(auditPayload).toMatchObject({
      expectedCuts: result.candidateScoreSummary.expectedCuts,
      sequenceMemory: result.candidateScoreSummary.sequenceMemory,
    });

    const evidenceRecord = JSON.parse(fs.readFileSync(result.evidencePaths.evidenceRecordPath, "utf8"));
    expect(evidenceRecord).toMatchObject({
      version: "prometheus-evidence-record-v1",
      compilerArtifactHash: expect.any(String),
      compilerArtifactPointer: "compiler-artifact.json",
      plannerAuditPointer: "planner-audit.json",
      candidateScoreSummaryPointer: "candidate-score-summary.json",
      rejectedCandidates: expect.any(Array),
    });
    expect(evidenceRecord.compilerArtifactHash).toMatch(/^[a-f0-9]{64}$/);

    const compilerArtifact = JSON.parse(fs.readFileSync(result.evidencePaths.compilerArtifactPath, "utf8"));
    expect(compilerArtifact).toMatchObject({
      artifactHash: evidenceRecord.compilerArtifactHash,
      mode: "phase0_read_only",
    });
    const plannerAuditArtifact = JSON.parse(fs.readFileSync(result.evidencePaths.plannerAuditPath, "utf8"));
    expect(plannerAuditArtifact).toMatchObject({
      version: "planner-audit-pointer-v1",
      source: "candidate-score-summary.sequenceObjective",
      sequenceObjective: result.candidateScoreSummary.sequenceObjective,
    });
    const candidateScoreSummaryArtifact = JSON.parse(fs.readFileSync(result.evidencePaths.candidateScoreSummaryPath, "utf8"));
    expect(candidateScoreSummaryArtifact).toMatchObject({
      sequenceObjective: result.candidateScoreSummary.sequenceObjective,
      manifestCompilerAudit: result.candidateScoreSummary.manifestCompilerAudit,
    });
    expect(evidenceRecord.rejectedCandidates.length).toBe(result.rejectedCount);
    for (const rejected of evidenceRecord.rejectedCandidates) {
      expect(rejected).toMatchObject({
        compilerWarnings: expect.any(Array),
        failureTags: expect.any(Array),
      });
    }
  });
});
