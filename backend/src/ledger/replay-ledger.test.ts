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
  it("queries anti-fatigue dimensions across rendered entries", () => {
    const ledger = new ReplayLedger(":memory:");
    const kineticManifest = {
      jobId: "chosen-kinetic",
      textOverlays: [
        {microAnimation: {primitiveFamily: "kinetic-type", primitiveId: "kinetic-type.pop-word"}},
      ],
      josephPiP: {layoutSignature: "pip-left-caption-right"},
    };
    const calmManifest = {
      jobId: "chosen-calm",
      textOverlays: [
        {microAnimation: {primitiveFamily: "caption-fade", primitiveId: "caption-fade.soft"}},
      ],
      josephPiP: {layoutSignature: "centered-proof-card"},
    };

    ledger.insert({
      ...entry,
      id: "entry-kinetic-1",
      uploadInstanceId: "upload-kinetic-1",
      chosenGenome: JSON.stringify(kineticManifest),
      similarityHash: "aaaabbbb",
      failureTags: "replay_similarity_veto, climax_overspend",
      createdAt: "2026-06-20T00:00:00.000Z",
    });
    ledger.insert({
      ...entry,
      id: "entry-kinetic-2",
      uploadInstanceId: "upload-kinetic-2",
      chosenGenome: JSON.stringify(kineticManifest),
      similarityHash: "aaaaaaab",
      failureTags: "replay_similarity_veto",
      createdAt: "2026-06-21T00:00:00.000Z",
    });
    ledger.insert({
      ...entry,
      id: "entry-calm",
      sourceFingerprint: "source-b",
      uploadInstanceId: "upload-calm",
      chosenGenome: JSON.stringify(calmManifest),
      similarityHash: "bbbbbbbb",
      failureTags: "readability_sacrifice",
      createdAt: "2026-06-22T00:00:00.000Z",
    });

    expect(ledger.getByPrimitiveFamily("kinetic-type").map((row: any) => row.id)).toEqual([
      "entry-kinetic-1",
      "entry-kinetic-2",
    ]);
    expect(ledger.getByLayoutSignature("pip-left-caption-right").map((row: any) => row.id)).toEqual([
      "entry-kinetic-1",
      "entry-kinetic-2",
    ]);
    expect(ledger.getByFailureTag("replay_similarity_veto").map((row: any) => row.id)).toEqual([
      "entry-kinetic-1",
      "entry-kinetic-2",
    ]);

    const similar = ledger.querySimilarity({similarityHash: "aaaaaaac", threshold: 0.5});
    expect(similar.map((match: any) => match.entry.id)).toEqual(["entry-kinetic-2", "entry-kinetic-1"]);
    expect(similar[0].similarityScore).toBeGreaterThan(similar[1].similarityScore);

    expect(ledger.getFatigueSignals({primitiveFamily: "kinetic-type", layoutSignature: "pip-left-caption-right"})).toMatchObject({
      totalMatches: 2,
      primitiveFamilyCount: 2,
      layoutSignatureCount: 2,
      failureTagCounts: {
        replay_similarity_veto: 2,
        climax_overspend: 1,
      },
      latestEntryId: "entry-kinetic-2",
    });
  });
});
