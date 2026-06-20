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
    };

    const paths = preserveEvidence(pkg, baseDir);

    expect(JSON.parse(fs.readFileSync(paths.candidatesPath, "utf8"))).toHaveLength(2);
    expect(JSON.parse(fs.readFileSync(paths.selectedPath, "utf8"))).toMatchObject({jobId: "chosen"});
    expect(JSON.parse(fs.readFileSync(paths.verdictPath, "utf8"))).toMatchObject({passedFloor: true});
    expect(JSON.parse(fs.readFileSync(paths.auditPath, "utf8"))).toMatchObject({jobId: "job-1"});
    expect(fs.readFileSync(paths.logPath, "utf8").trim().split("\n")).toHaveLength(1);
    expect(fs.readdirSync(paths.jobDir).some((file) => file.endsWith(".tmp"))).toBe(false);
  });
});
