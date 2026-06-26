import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {UnifiedRenderManifestSchema} from "@prometheus/shared-types";
import {describe, expect, it} from "vitest";
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

describe("Director Orchestrator Manifest Compiler", () => {
  it("compiles the selected manifest as a deterministic pass-through before evidence persistence", async () => {
    const result = await orchestrateRender(baseInput(), new ReplayLedger(":memory:"), registry());

    expect(UnifiedRenderManifestSchema.parse(result.manifest)).toMatchObject({
      version: "2.0",
      createdAt: "1970-01-01T00:00:00.000Z",
    });
    expect(result.candidateScoreSummary.manifestCompilerAudit).toMatchObject({
      version: "joseph-manifest-compiler-v1",
      mode: "pass_through",
      deterministic: true,
      schemaVersion: "2.0",
      auditReferences: {
        candidateScoreSummary: true,
        candidateScoreCount: result.candidateScoreSummary.candidateScores.length,
        expectedCutCount: result.candidateScoreSummary.expectedCuts.length,
      },
    });
    expect(result.candidateScoreSummary.manifestCompilerAudit.presentFieldPaths).toEqual(
      expect.arrayContaining([
        "textOverlays",
        "textOverlays.microAnimation",
        "microAnimationAudit",
        "josephPiP",
        "josephBackground",
        "josephTypography",
        "cameraMoves",
        "timeline",
      ]),
    );

    const auditPayload = JSON.parse(fs.readFileSync(result.evidencePaths.auditPath, "utf8"));
    expect(auditPayload.manifestCompilerAudit).toEqual(
      result.candidateScoreSummary.manifestCompilerAudit,
    );
    expect(result.evidence.selected).toEqual(result.manifest);
  });
});
