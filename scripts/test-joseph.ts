import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {orchestrateRender} from "../backend/src/director/orchestrator";
import {ReplayLedger} from "../backend/src/ledger/replay-ledger";
import {fingerprintString, PromptRegistry} from "../backend/src/director/prompt-governance";

const report = (label: string, pass: boolean, detail: string): boolean => {
  console.log(`${pass ? "PASS" : "FAIL"} ${label}: ${detail}`);
  return pass;
};

const tempPath = (name: string): string => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "joseph-orchestrator-")), name);

const canonicalManifest = (manifest: unknown): string => JSON.stringify(manifest);
const sha256 = (value: unknown): string => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

const makeRegistry = (): PromptRegistry => new PromptRegistry(tempPath("prompt-registry.jsonl"));

const input = (overrides: Record<string, unknown> = {}) => ({
  sourceVideoPath: "file:///dev-fixtures/sample.mp4",
  transcriptPath: tempPath("missing-transcript.json"),
  audioPath: "file:///dev-fixtures/sample-audio.mp3",
  musicPath: "file:///dev-fixtures/sample-music.mp3",
  profile: "joseph_aggressive" as const,
  promptText: "high energy aggressive edit",
  evidenceDir: fs.mkdtempSync(path.join(os.tmpdir(), "joseph-evidence-")),
  ...overrides,
});

async function main() {
  const firstLedger = new ReplayLedger(":memory:");
  const result1 = await orchestrateRender(input({uploadInstanceId: "upload-a", retryIndex: 0}), firstLedger, makeRegistry());

  const result2 = await orchestrateRender(
    input({uploadInstanceId: "upload-b", retryIndex: 0}),
    new ReplayLedger(":memory:"),
    makeRegistry(),
  );

  const result3 = await orchestrateRender(
    input({uploadInstanceId: result1.variationKey.uploadInstanceId, retryIndex: result1.variationKey.retryIndex}),
    new ReplayLedger(":memory:"),
    makeRegistry(),
  );

  const ledgerEntries = firstLedger.getBySource(result1.variationKey.sourceFingerprint);
  const hash1 = fingerprintString(canonicalManifest(result1.manifest));
  const hash2 = fingerprintString(canonicalManifest(result2.manifest));
  const hash3 = fingerprintString(canonicalManifest(result3.manifest));

  const checks = [
    report("candidate count", result1.candidateCount >= 4, String(result1.candidateCount)),
    report("vertical metadata", result1.manifest.width === 1080 && result1.manifest.height === 1920, `${result1.manifest.width}x${result1.manifest.height}`),
    report("90s cap", result1.manifest.source.durationMs <= 90_000, `${result1.manifest.source.durationMs}ms`),
    report("quality floor", result1.qualityScore > 0.5, String(result1.qualityScore)),
    report("ledger write", ledgerEntries.length === 1, `${ledgerEntries.length} entries`),
    report("evidence selected", fs.existsSync(result1.evidencePaths.selectedPath), result1.evidencePaths.selectedPath),
    report("evidence verdict", fs.existsSync(result1.evidencePaths.verdictPath), result1.evidencePaths.verdictPath),
    report("variation", hash1 !== hash2, `${hash1.slice(0, 8)} vs ${hash2.slice(0, 8)}`),
    report("determinism", hash1 === hash3, `${hash1.slice(0, 8)} vs ${hash3.slice(0, 8)}`),
    report("manifest sha256", /^[a-f0-9]{64}$/.test(sha256(result1.manifest)), sha256(result1.manifest).slice(0, 16)),
  ];

  const pass = checks.every(Boolean);
  console.log(pass ? "ALL ASSERTIONS PASSED" : "ASSERTIONS FAILED");
  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
