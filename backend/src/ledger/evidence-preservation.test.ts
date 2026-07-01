import {beforeAll, describe, expect, it} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const targetPath = path.resolve(__dirname, "evidence-preservation.ts");
const describeIfPresent = fs.existsSync(targetPath) ? describe : describe.skip;

describeIfPresent("Evidence Preservation contract", () => {
  let preserveEvidence: any;

  beforeAll(async () => {
    ({preserveEvidence} = await import(new URL("./evidence-preservation.ts", import.meta.url).href));
  });

  it("persists selected, rejected, and verdict evidence through the legacy ledger contract", async () => {
    const ledger = {insert: (entry: unknown) => entry};
    const result = await preserveEvidence(ledger, {
      variationKey: {
        sourceFingerprint: "source-a",
        promptFingerprint: "prompt-a",
        uploadInstanceId: "upload-1",
        retryIndex: 0,
      },
      selected: {jobId: "chosen"},
      rejected: [{jobId: "rejected"}],
      verdict: {qualityScore: 0.9, failureTags: []},
    });

    expect(JSON.stringify(result)).toContain("chosen");
    expect(JSON.stringify(result)).toContain("rejected");
  });

  it("writes inspectable artifacts and an append-only evidence log", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "prometheus-evidence-"));
    const compilerArtifactHash = "a".repeat(64);
    const pkg = {
      jobId: "job-1",
      variationKey: {
        sourceFingerprint: "source-a",
        promptFingerprint: "prompt-a",
        uploadInstanceId: "upload-1",
        retryIndex: 0,
      },
      candidates: [{jobId: "chosen"}, {jobId: "rejected"}],
      selected: {jobId: "chosen"},
      rejected: [{jobId: "rejected"}],
      verdict: {
        qualityScore: 0.9,
        similarityScore: 0.1,
        passedFloor: true,
        failureTags: [],
      },
      timestamp: "2026-06-20T00:00:00.000Z",
      candidateScoreSummary: {
        version: "candidate-score-summary-v1",
        expectedCuts: [12],
        sequenceMemory: [],
      },
      compilerArtifact: {
        version: "joseph-manifest-compiler-v1",
        mode: "phase0_read_only",
        deterministic: true,
        artifactHash: compilerArtifactHash,
        manifestHash: "b".repeat(64),
        warnings: ["Phase 0 compiler artifact only; manifest output was not mutated."],
        fallbacks: [
          {
            field: "josephBackground",
            tag: "compiler_background_missing",
            reason: "Planner-selected background intent had no Joseph background plan.",
          },
        ],
      },
      plannerAudit: {
        version: "planner-audit-v1",
        plannerPathId: "path-hook-payoff",
        selectedCandidateId: "chosen",
      },
      rejectedCandidateEvidence: [
        {
          jobId: "rejected",
          compilerWarnings: ["Compiled manifest contains governed fallbacks; renderer must not invent omitted planner intent."],
          failureTags: ["compiler_background_missing"],
        },
      ],
    };

    const paths = preserveEvidence(pkg, baseDir);

    expect(JSON.parse(fs.readFileSync(paths.candidatesPath, "utf8"))).toHaveLength(2);
    expect(JSON.parse(fs.readFileSync(paths.selectedPath, "utf8"))).toMatchObject({jobId: "chosen"});
    expect(JSON.parse(fs.readFileSync(paths.verdictPath, "utf8"))).toMatchObject({passedFloor: true});
    expect(JSON.parse(fs.readFileSync(paths.auditPath, "utf8"))).toMatchObject({version: "candidate-score-summary-v1"});
    expect(JSON.parse(fs.readFileSync(paths.candidateScoreSummaryPath, "utf8"))).toMatchObject({
      version: "candidate-score-summary-v1",
      expectedCuts: [12],
    });
    expect(JSON.parse(fs.readFileSync(paths.compilerArtifactPath, "utf8"))).toMatchObject({
      artifactHash: compilerArtifactHash,
      warnings: ["Phase 0 compiler artifact only; manifest output was not mutated."],
    });
    expect(JSON.parse(fs.readFileSync(paths.plannerAuditPath, "utf8"))).toMatchObject({
      plannerPathId: "path-hook-payoff",
      selectedCandidateId: "chosen",
    });
    expect(JSON.parse(fs.readFileSync(paths.evidenceRecordPath, "utf8"))).toMatchObject({
      version: "prometheus-evidence-record-v1",
      jobId: "job-1",
      compilerArtifactHash,
      plannerAuditPointer: "planner-audit.json",
      candidateScoreSummaryPointer: "candidate-score-summary.json",
      rejectedCandidates: [
        {
          jobId: "rejected",
          compilerWarnings: ["Compiled manifest contains governed fallbacks; renderer must not invent omitted planner intent."],
          failureTags: ["compiler_background_missing"],
        },
      ],
    });
    expect(JSON.parse(fs.readFileSync(paths.reviewArtifactPath, "utf8"))).toMatchObject({
      version: "joseph-oversight-review-v1",
      jobId: "job-1",
      completionEvidence: {
        candidateManifestCount: 2,
        rejectedManifestCount: 1,
        hasReviewNotes: true,
      },
    });
    expect(fs.readFileSync(paths.reviewLedgerPath, "utf8").trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(paths.regressionGalleryPath, "utf8"))).toMatchObject({
      version: "joseph-oversight-review-v1",
    });
    expect(fs.readFileSync(paths.logPath, "utf8").trim().split("\n")).toHaveLength(1);
    expect(fs.readdirSync(paths.jobDir).some((file) => file.endsWith(".tmp"))).toBe(false);
  });
});
