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
    const result = await orchestrateRender(baseInput(), new ReplayLedger(":memory:"), registry());

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
  });
});
