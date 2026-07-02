import {describe, expect, it} from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {UnifiedRenderManifestSchema} from "@prometheus/shared-types";
import {ReplayLedger} from "../ledger/replay-ledger";
import {PromptRegistry} from "./prompt-governance";
import {orchestrateRender, type OrchestratorInput} from "./orchestrator";

const tempFile = (prefix: string, name: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return path.join(dir, name);
};

const baseInput = (profile: OrchestratorInput["profile"], overrides: Partial<OrchestratorInput> = {}): OrchestratorInput => ({
  sourceVideoPath: "file:///test-video.mp4",
  transcriptPath: tempFile("orchestrator-transcript-", "missing-transcript.json"),
  audioPath: "file:///test-audio.mp3",
  musicPath: "file:///test-music.mp3",
  profile,
  promptText: "high energy edit with clear hook",
  evidenceDir: fs.mkdtempSync(path.join(os.tmpdir(), "orchestrator-evidence-")),
  ...overrides,
});

const registry = (): PromptRegistry =>
  new PromptRegistry(tempFile("orchestrator-prompts-", "registry.jsonl"));

const canonical = (value: unknown): string => JSON.stringify(value);

describe("Director Orchestrator", () => {
  it("orchestrates aggressive profile end-to-end", async () => {
    const ledger = new ReplayLedger(":memory:");
    const result = await orchestrateRender(baseInput("joseph_aggressive"), ledger, registry());

    expect(() => UnifiedRenderManifestSchema.parse(result.manifest)).not.toThrow();
    expect(result.manifest.jobId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(result.manifest.height).toBe(1920);
    expect(result.manifest.width).toBe(1080);
    expect(result.candidateCount).toBe(6);
    expect(result.rejectedCount).toBe(5);
    expect(result.qualityScore).toBeGreaterThan(0.5);
    expect(fs.existsSync(result.evidencePaths.selectedPath)).toBe(true);
  });


  it("preserves matte references through the production orchestrator path", async () => {
    const result = await orchestrateRender(
      baseInput("joseph_aggressive", {
        matteUrl: "/uploads/job-1/rvm-matte.webm",
        matteFilePath: "C:/prometheus/jobs/job-1/rvm-matte.webm",
      }),
      new ReplayLedger(":memory:"),
      registry(),
    );

    const evidenceSelected = result.evidence.selected as typeof result.manifest;

    expect(result.manifest.source.matteUrl).toBe("/uploads/job-1/rvm-matte.webm");
    expect(result.manifest.matte?.filePath).toBe("C:/prometheus/jobs/job-1/rvm-matte.webm");
    expect(evidenceSelected.source.matteUrl).toBe(result.manifest.source.matteUrl);
  });
  it("orchestrates cinematic profile end-to-end", async () => {
    const result = await orchestrateRender(baseInput("joseph_cinematic"), new ReplayLedger(":memory:"), registry());

    expect(result.candidateCount).toBe(4);
    expect(result.manifest.creativeProfile.name).toBe("joseph_cinematic");
  });

  it("orchestrates minimal profile end-to-end", async () => {
    const result = await orchestrateRender(baseInput("joseph_minimal"), new ReplayLedger(":memory:"), registry());

    expect(result.candidateCount).toBe(3);
    expect(result.manifest.audio.sfx).toHaveLength(0);
  });

  it("writes to replay ledger", async () => {
    const ledger = new ReplayLedger(":memory:");
    const result = await orchestrateRender(baseInput("joseph_aggressive"), ledger, registry());

    const entries = ledger.getBySource(result.variationKey.sourceFingerprint);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.uploadInstanceId).toBe(result.variationKey.uploadInstanceId);
    expect(entries[0]?.similarityHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("preserves evidence to filesystem", async () => {
    const result = await orchestrateRender(baseInput("joseph_aggressive"), new ReplayLedger(":memory:"), registry());

    expect(fs.existsSync(result.evidencePaths.jobDir)).toBe(true);
    expect(JSON.parse(fs.readFileSync(result.evidencePaths.selectedPath, "utf8")).jobId).toBe(result.manifest.jobId);
    expect(JSON.parse(fs.readFileSync(result.evidencePaths.verdictPath, "utf8")).passedFloor).toBe(true);

    const reviewArtifact = JSON.parse(fs.readFileSync(result.evidencePaths.reviewArtifactPath, "utf8"));
    expect(reviewArtifact).toMatchObject({
      version: "joseph-oversight-review-v1",
      jobId: result.evidence.jobId,
      selectedJobId: result.manifest.jobId,
    });
    expect(reviewArtifact.candidateJobIds).toHaveLength(result.candidateCount);
    expect(reviewArtifact.rejectedJobIds).toHaveLength(result.rejectedCount);
    expect(reviewArtifact.reviewVerdict.notes.length).toBeGreaterThan(0);
    expect(fs.readFileSync(result.evidencePaths.reviewLedgerPath, "utf8")).toContain(result.evidence.jobId);
    expect(JSON.parse(fs.readFileSync(result.evidencePaths.regressionGalleryPath, "utf8")).version).toBe("joseph-oversight-review-v1");
  });

  it("preserves a JosephEdit render proof for the selected planner seam", async () => {
    const ledger = new ReplayLedger(":memory:");
    const first = await orchestrateRender(
      baseInput("joseph_aggressive", {uploadInstanceId: "render-proof-a", retryIndex: 0}),
      ledger,
      registry(),
    );
    const second = await orchestrateRender(
      baseInput("joseph_aggressive", {uploadInstanceId: "render-proof-b", retryIndex: 0}),
      new ReplayLedger(":memory:"),
      registry(),
    );

    expect(fs.existsSync(first.evidencePaths.renderProofPath)).toBe(true);

    const proof = JSON.parse(fs.readFileSync(first.evidencePaths.renderProofPath, "utf8"));
    const secondProof = JSON.parse(fs.readFileSync(second.evidencePaths.renderProofPath, "utf8"));
    const evidenceRecord = JSON.parse(fs.readFileSync(first.evidencePaths.evidenceRecordPath, "utf8"));
    const ledgerEntries = ledger.getBySource(first.variationKey.sourceFingerprint);

    expect(proof).toMatchObject({
      version: "joseph-render-proof-v1",
      renderer: {
        compositionId: "JosephEdit",
        contentType: "video/mp4",
        width: 1080,
        height: 1920,
      },
      selectedCandidateId: first.manifest.jobId,
      manifestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      visibleBehaviorSignature: expect.stringMatching(/^[a-f0-9]{64}$/),
      frameProofs: expect.any(Array),
      fallbackTags: expect.any(Array),
    });
    expect(proof.frameProofs.length).toBeGreaterThanOrEqual(3);
    expect(proof.frameProofs[0]).toMatchObject({
      compositionId: "JosephEdit",
      manifestHash: proof.manifestHash,
      frame: expect.any(Number),
      signature: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(evidenceRecord).toMatchObject({
      renderProofPointer: "render-proof.json",
      frameProofCount: proof.frameProofs.length,
    });
    expect(ledgerEntries[0]?.chosenGenome).toContain(first.manifest.jobId);
    expect(secondProof.visibleBehaviorSignature).not.toBe(proof.visibleBehaviorSignature);
  });
  it("determinism: same key = same manifest", async () => {
    const first = await orchestrateRender(
      baseInput("joseph_aggressive", {uploadInstanceId: "upload-stable", retryIndex: 2}),
      new ReplayLedger(":memory:"),
      registry(),
    );
    const second = await orchestrateRender(
      baseInput("joseph_aggressive", {uploadInstanceId: "upload-stable", retryIndex: 2}),
      new ReplayLedger(":memory:"),
      registry(),
    );

    expect(canonical(second.manifest)).toBe(canonical(first.manifest));
  });

  it("variation: different key = different manifest", async () => {
    const first = await orchestrateRender(
      baseInput("joseph_aggressive", {uploadInstanceId: "upload-a", retryIndex: 0}),
      new ReplayLedger(":memory:"),
      registry(),
    );
    const second = await orchestrateRender(
      baseInput("joseph_aggressive", {uploadInstanceId: "upload-b", retryIndex: 0}),
      new ReplayLedger(":memory:"),
      registry(),
    );

    expect(canonical(second.manifest)).not.toBe(canonical(first.manifest));
  });
});
