/**
 * Pre-IRL Joseph capacity harness.
 * Usage: npx tsx scripts/joseph-capacity-benchmark.ts
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {fileURLToPath} from "node:url";

import {orchestrateRender} from "../backend/src/director/orchestrator";
import {ReplayLedger} from "../backend/src/ledger/replay-ledger";
import {PromptRegistry} from "../backend/src/director/prompt-governance";
import {evaluateJosephAnnotationHealth} from "../backend/src/irl/joseph-annotation-health";
import {evaluateJosephCapacityBenchmark} from "../backend/src/irl/joseph-capacity-benchmark";
import {JOSEPH_AUDIO_SPINE_STATUS} from "../backend/src/music/audio-spine-status";
import {buildFixtureSpeechTranscript} from "../backend/src/upload/joseph-transcript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempFile = (name: string): string =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), "joseph-capacity-cli-")), name);

const reportLine = (ok: boolean, label: string, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${detail}`);
  return ok;
};

async function main() {
  const annotation = evaluateJosephAnnotationHealth(repoRoot);
  const annotationOk = reportLine(
    annotation.overallGoodNature,
    "annotation_health",
    annotation.summary,
  );
  for (const packet of annotation.packets) {
    reportLine(
      packet.goodNature,
      `annotation:${packet.referenceId}`,
      `events=${packet.eventCount} timed=${packet.timedEventCount} trainTagged=${packet.trainingSafeEventCount}`,
    );
  }

  console.log(`INFO audio_spine: ${JOSEPH_AUDIO_SPINE_STATUS.productionRule}`);
  for (const lane of JOSEPH_AUDIO_SPINE_STATUS.livePath) {
    console.log(`INFO live_audio: ${lane.module}`);
  }
  for (const lane of JOSEPH_AUDIO_SPINE_STATUS.dryRunOnly) {
    console.log(`INFO dry_run_only: ${lane.module}`);
  }

  const transcript = buildFixtureSpeechTranscript(10_000);
  const transcriptPath = tempFile("speech.json");
  fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2));

  const result = await orchestrateRender(
    {
      sourceVideoPath: "file:///dev-fixtures/sample.mp4",
      transcriptPath,
      audioPath: "file:///dev-fixtures/sample-audio.mp3",
      musicPath: "file:///dev-fixtures/sample-music.mp3",
      profile: "joseph_aggressive",
      promptText: "joseph capacity benchmark",
      evidenceDir: fs.mkdtempSync(path.join(os.tmpdir(), "joseph-capacity-evidence-")),
      uploadInstanceId: "capacity-cli",
      retryIndex: 0,
    },
    new ReplayLedger(":memory:"),
    new PromptRegistry(tempFile("prompt-registry.jsonl")),
  );

  const capacity = evaluateJosephCapacityBenchmark({
    manifest: result.manifest,
    transcript,
    compilerMode: result.candidateScoreSummary.manifestCompilerAudit.mode,
    scaffoldInjections: {
      forcedCuts: result.scaffoldDiagnostics.forcedCuts > result.candidateCount ? result.scaffoldDiagnostics.forcedCuts : 0,
      forcedSfx: result.scaffoldDiagnostics.forcedSfx,
    },
  });

  for (const check of capacity.checks) {
    reportLine(check.passed, check.id, check.detail);
  }
  reportLine(capacity.passed, "capacity_benchmark", capacity.summary);
  reportLine(
    result.scaffoldDiagnostics.forcedSfx === 0,
    "scaffold_no_sfx_spam",
    JSON.stringify(result.scaffoldDiagnostics),
  );
  reportLine(
    result.candidateScoreSummary.manifestCompilerAudit.mode === "compile_manifest",
    "compiler_mode",
    result.candidateScoreSummary.manifestCompilerAudit.mode,
  );

  const ok = annotationOk && capacity.passed && result.scaffoldDiagnostics.forcedSfx === 0;
  console.log(ok ? "ALL JOSEPH PRE-IRL CHECKS PASSED" : "JOSEPH PRE-IRL CHECKS FAILED");
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


