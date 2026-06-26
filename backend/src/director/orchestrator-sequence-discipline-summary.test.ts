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

describe("Director Orchestrator sequence discipline summary", () => {
  it("records live sequence discipline signals in Candidate Score Summary", async () => {
    const result = await orchestrateRender(baseInput(), new ReplayLedger(":memory:"), registry());

    expect(result.candidateScoreSummary.sequenceDiscipline).toHaveLength(result.candidateCount);
    expect(result.candidateScoreSummary.sequenceDiscipline[0]).toMatchObject({
      enabled: true,
      penalty: expect.any(Number),
      violationRuleIds: expect.any(Array),
      metrics: expect.objectContaining({
        maxTypographyRun: expect.any(Number),
        maxMotionRun: expect.any(Number),
        highEnergyRun: expect.any(Number),
      }),
    });

    const auditPayload = JSON.parse(fs.readFileSync(result.evidencePaths.auditPath, "utf8"));
    expect(auditPayload.sequenceDiscipline).toEqual(result.candidateScoreSummary.sequenceDiscipline);
  });
});
