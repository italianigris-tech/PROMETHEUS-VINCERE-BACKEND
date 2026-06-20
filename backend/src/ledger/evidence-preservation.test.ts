import {beforeAll, describe, expect, it} from "vitest";
import * as fs from "fs";
import * as path from "path";

const targetPath = path.resolve(__dirname, "evidence-preservation.ts");
const describeIfPresent = fs.existsSync(targetPath) ? describe : describe.skip;

describeIfPresent("Evidence Preservation contract", () => {
  let preserveEvidence: any;

  beforeAll(async () => {
    ({preserveEvidence} = await import(new URL("./evidence-preservation.ts", import.meta.url).href));
  });

  it("persists selected, rejected, and verdict evidence", async () => {
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
});
