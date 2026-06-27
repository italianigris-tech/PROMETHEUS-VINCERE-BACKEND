import {describe, expect, it} from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {ReplayLedger} from "../ledger/replay-ledger";
import {orchestrateRender, type OrchestratorInput} from "./orchestrator";
import {PromptRegistry} from "./prompt-governance";

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

describe("Director Orchestrator Sequence Objective summary", () => {
  it("records selected path, score breakdown, and QD archive evidence in Candidate Score Summary", async () => {
    const result = await orchestrateRender(baseInput(), new ReplayLedger(":memory:"), registry());

    expect(result.candidateScoreSummary.sequenceObjective).toMatchObject({
      version: "joseph-sequence-objective-v1",
      selectedCandidateId: result.manifest.jobId,
      selectedDoctrineBranchId: expect.any(String),
      candidates: expect.any(Array),
      archiveEntries: expect.any(Array),
      selectedPath: expect.objectContaining({
        candidateIds: [result.manifest.jobId],
        doctrineBranchIds: expect.any(Array),
        finalScore: expect.any(Number),
      }),
    });
    expect(result.candidateScoreSummary.sequenceObjective.candidates[0]).toMatchObject({
      selected: true,
      scoreBreakdown: expect.objectContaining({
        sequenceConsequence: expect.any(Number),
        repetitionAvoidance: expect.any(Number),
        doctrineCoherence: expect.any(Number),
        surprisePreservation: expect.any(Number),
        climaxBudgetPreservation: expect.any(Number),
        retrievalPracticality: expect.any(Number),
        qdDiversityPressure: expect.any(Number),
        finalScore: expect.any(Number),
      }),
      reasons: expect.arrayContaining([expect.stringContaining("Sequence Objective")]),
    });

    const auditPayload = JSON.parse(fs.readFileSync(result.evidencePaths.auditPath, "utf8"));
    expect(auditPayload.sequenceObjective).toEqual(result.candidateScoreSummary.sequenceObjective);
  });
});
