import {beforeAll, describe, expect, it} from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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
    candidateScoreSummary: "{\"candidateScores\":[]}",
    similarityHash: "similarity-a",
    qualityScore: 0.9,
    failureTags: "",
    createdAt: "2026-06-20T00:00:00.000Z",
  };

  it("inserts and retrieves entries by source fingerprint", () => {
    const ledger = new ReplayLedger(":memory:");

    ledger.insert(entry);

    const [stored] = ledger.getBySource("source-a");
    expect(stored).toMatchObject(entry);
    expect(stored).not.toHaveProperty("plannerAudit");
  });

  it("retrieves entries by upload instance", () => {
    const ledger = new ReplayLedger(":memory:");

    ledger.insert(entry);

    const stored = ledger.getByUploadInstance("upload-1");
    expect(stored).toMatchObject(entry);
    expect(stored).not.toHaveProperty("plannerAudit");
  });

  it("persists JSONL entries across ledger instances", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmp-replay-ledger-"));
    const ledgerPath = path.join(dir, "replay-ledger.jsonl");

    new ReplayLedger(ledgerPath).insert(entry);
    const reloaded = new ReplayLedger(ledgerPath);

    const [stored] = reloaded.getBySource("source-a");
    expect(stored).toMatchObject(entry);
    expect(stored).not.toHaveProperty("plannerAudit");
    expect(reloaded.getSimilarityHash("source-a")).toBe("similarity-a");
  });

  it("normalizes legacy plannerAudit rows to Candidate Score Summary", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmp-replay-ledger-legacy-"));
    const ledgerPath = path.join(dir, "replay-ledger.jsonl");
    const legacyEntry = {
      ...entry,
      candidateScoreSummary: undefined,
      plannerAudit: "{\"legacy\":true}",
    };
    fs.writeFileSync(ledgerPath, `${JSON.stringify(legacyEntry)}\n`, "utf8");

    const reloaded = new ReplayLedger(ledgerPath);
    const [stored] = reloaded.getBySource("source-a");

    expect(stored).toMatchObject({
      ...entry,
      candidateScoreSummary: "{\"legacy\":true}",
    });
    expect(stored).not.toHaveProperty("plannerAudit");
  });
});
