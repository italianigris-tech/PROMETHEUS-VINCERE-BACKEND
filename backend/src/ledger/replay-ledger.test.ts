import {beforeAll, describe, expect, it} from "vitest";
import * as fs from "fs";
import * as path from "path";

const targetPath = path.resolve(__dirname, "replay-ledger.ts");
const describeIfPresent = fs.existsSync(targetPath) ? describe : describe.skip;

describeIfPresent("Replay Ledger contract", () => {
  let ReplayLedger: any;

  beforeAll(async () => {
    ({ReplayLedger} = await import(new URL("./replay-ledger.ts", import.meta.url).href));
  });

  const entry = {
    id: "entry-1",
    sourceFingerprint: "source-a",
    promptFingerprint: "prompt-a",
    uploadInstanceId: "upload-1",
    retryIndex: 0,
    profile: "joseph_aggressive",
    chosenGenome: "{}",
    rejectedGenomes: "[]",
    plannerAudit: "",
    similarityHash: "similarity-a",
    qualityScore: 0.9,
    failureTags: "",
    createdAt: "2026-06-20T00:00:00.000Z",
  };

  it("inserts and retrieves entries by source fingerprint", () => {
    const ledger = new ReplayLedger(":memory:");

    ledger.insert(entry);

    expect(ledger.getBySource("source-a")).toMatchObject([entry]);
  });

  it("retrieves entries by upload instance", () => {
    const ledger = new ReplayLedger(":memory:");

    ledger.insert(entry);

    expect(ledger.getByUploadInstance("upload-1")).toMatchObject(entry);
  });
});
