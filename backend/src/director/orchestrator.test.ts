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

const denseTalkingHeadTranscriptPath = (): string => {
  const transcriptPath = tempFile("orchestrator-talking-head-", "transcript.json");
  const tuples: Array<[string, number, number]> = [
    ["Over", 800, 920], ["the", 920, 1080], ["last", 1080, 1320], ["12", 1320, 1640],
    ["months,", 1640, 2000], ["I've", 2000, 2360], ["purchased", 2360, 2800], ["more", 2800, 3000],
    ["than", 3000, 3240], ["12,000", 3240, 3920], ["physical", 4000, 4560], ["products", 4560, 4920],
    ["from", 4920, 5200], ["eBay.com", 5200, 6080], ["that", 6240, 6520], ["I've", 6520, 6760],
    ["then", 6760, 6960], ["resold", 6960, 7440], ["on", 7440, 7640], ["Amazon", 7640, 8120],
    ["for", 8120, 8320], ["more", 8320, 8440], ["than", 8440, 8680], ["six", 8680, 9000],
    ["figures", 9000, 9360], ["in", 9360, 9560], ["Pure.", 9560, 9920],
  ];
  const words = tuples.map(([text, startMs, endMs]) => ({text, startMs, endMs, confidence: 0.99}));
  const phraseRanges: Array<[number, number]> = [[0, 8], [8, 16], [16, 24], [24, 27]];
  const phrases = phraseRanges.map(([start, end]) => {
    const phraseWords = words.slice(start, end);
    return {
      startMs: phraseWords[0]?.startMs ?? 0,
      endMs: phraseWords.at(-1)?.endMs ?? 0,
      text: phraseWords.map((word) => word.text).join(" "),
      words: phraseWords,
    };
  });

  fs.writeFileSync(transcriptPath, JSON.stringify({
    words,
    phrases,
    beats: Array.from({length: 20}, (_, index) => index * 500),
    onsets: words.map((word) => word.startMs),
    energyCurve: [0.42, 0.68, 0.78, 0.55, 0.74, 0.62],
    durationMs: 10_000,
  }), "utf8");
  return transcriptPath;
};

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

  it("keeps dense real talking-head typography inside the quality floor", async () => {
    const result = await orchestrateRender(
      baseInput("joseph_cinematic", {
        transcriptPath: denseTalkingHeadTranscriptPath(),
        uploadInstanceId: "dense-real-talking-head",
      }),
      new ReplayLedger(":memory:"),
      registry(),
    );
    const overlayStarts = result.manifest.textOverlays
      .map((overlay) => overlay.startFrame)
      .sort((left, right) => left - right);
    const selectedScore = result.candidateScoreSummary.candidateScores.find(
      (score) => score.manifest.jobId === result.manifest.jobId,
    );

    expect(selectedScore?.floorFailures).toEqual([]);
    expect(result.manifest.microAnimationAudit?.failures).toEqual([]);
    expect(result.manifest.textOverlays.length).toBeLessThanOrEqual(result.manifest.josephTypography?.lines.length ?? 4);
    expect(overlayStarts.every((start, index) => index === 0 || start - (overlayStarts[index - 1] ?? start) >= 6)).toBe(true);
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
