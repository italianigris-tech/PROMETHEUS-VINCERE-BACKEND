/**
 * MINI LANDSCAPE RUNS — TEST: SILENCE CUTTER PLAN INVARIANTS
 *
 * Pure-planning tests (no encoding) plus an optional end-to-end check against
 * a synthetic FFmpeg tone video when ffmpeg is available.
 *
 * Run: npx tsx docs/mini_landscape_runs/tests/test_silence_cutter_plan.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { buildSilenceCutPlan, detectSilences, executeSilenceCut, parseSilencedetectLog } from "../silence_cutter.js";

let passedChecks = 0;
let totalChecks = 0;
function assert(condition: boolean, message: string) {
  totalChecks++;
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedChecks++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

function probeDurationSec(filePath: string): number {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", filePath], { encoding: "utf8" });
  const m = (r.stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

const HEADER = [
  "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'sample.mp4':",
  "  Duration: 00:00:12.00, start: 0.000000, bitrate: 1000 kb/s",
  "    Stream #0:0(und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1920x1080",
  "    Stream #0:1(und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo",
  "",
].join("\n");

console.log("=============================================");
console.log("SILENCE CUTTER PLAN INVARIANT TESTS");
console.log("=============================================");

// 1. Parser: canned silencedetect log (12.0s, two cuttable silences).
const canned = HEADER + [
  "[silencedetect @ 0x55a1] silence_start: 2.5",
  "[silencedetect @ 0x55a1] silence_end: 3.5 | silence_duration: 1",
  "[silencedetect @ 0x55a1] silence_start: 7.2",
  "[silencedetect @ 0x55a1] silence_end: 8.4 | silence_duration: 1.2",
].join("\n");
const detection = parseSilencedetectLog(canned);
assert(detection.durationSec === 12.0, `Duration parsed as 12.0s (got ${detection.durationSec})`);
assert(detection.silences.length === 2, `Two silences parsed (got ${detection.silences.length})`);
assert(detection.silences[0].startSec === 2.5 && detection.silences[0].durationSec === 1.0, "Silence 1 is 2.5–3.5 (1.0s)");
assert(detection.silences[1].durationSec === 1.2, "Silence 2 is 7.2–8.4 (1.2s)");

// 2. Plan: padding + keep-segment contiguity + totals (SIL-03, SIL-04).
const plan = buildSilenceCutPlan("/v/sample.mp4", detection, { hasAudio: true });
assert(plan.outputDurationSec === 8.9, `Output 8.9s after 3.1s removal (got ${plan.outputDurationSec})`);
assert(plan.removedSec === 3.1, `Removed exactly 3.1s (got ${plan.removedSec})`);
assert(plan.keepSegments.length === 3, `Three keep segments (got ${plan.keepSegments.length})`);
assert(plan.keepSegments[0].srcStartSec === 0.15, "First keep starts at 0.15s padding (SIL-03)");
assert(
  plan.keepSegments.every((k, i) => i === 0 || k.dstStartSec === plan.keepSegments[i - 1].dstEndSec),
  "Keep segments are contiguous on the destination timeline",
);
assert(
  plan.keepSegments.every((k, i) => (i === 0 ? true : k.srcStartSec > plan.keepSegments[i - 1].srcEndSec)),
  "Keep segments are ordered on the source timeline",
);

// 3. SIL-02: a 0.4s pause is protected pacing, never a cut.
const protectedCanned = HEADER + [
  "[silencedetect @ 0x55a1] silence_start: 2.5",
  "[silencedetect @ 0x55a1] silence_end: 3.5 | silence_duration: 1",
  "[silencedetect @ 0x55a1] silence_start: 7.2",
  "[silencedetect @ 0x55a1] silence_end: 7.6 | silence_duration: 0.4",
].join("\n");
const det2 = parseSilencedetectLog(protectedCanned);
const plan2 = buildSilenceCutPlan("/v/sample.mp4", det2, { hasAudio: true });
assert(plan2.detectedSilences[1].kind === "protected_pause", "0.4s pause classified as protected_pause (SIL-02)");
assert(plan2.keepSegments.length === 2, "Protected pause stays inside a keep segment (got " + plan2.keepSegments.length + ")");
assert(
  !plan2.keepSegments.some((k) => Math.abs(k.srcStartSec - 7.2) < 0.01 || Math.abs(k.srcEndSec - 7.2) < 0.01),
  "No keep-segment boundary lands at the protected pause",
);

// 4. SIL-04: two cuts 0.2s apart fold the sliver into the cut.
const mergeCanned = HEADER + [
  "[silencedetect @ 0x55a1] silence_start: 2.5",
  "[silencedetect @ 0x55a1] silence_end: 3.5 | silence_duration: 1",
  "[silencedetect @ 0x55a1] silence_start: 3.7",
  "[silencedetect @ 0x55a1] silence_end: 4.7 | silence_duration: 1",
].join("\n");
const plan3 = buildSilenceCutPlan("/v/sample.mp4", parseSilencedetectLog(mergeCanned), { hasAudio: true });
assert(plan3.keepSegments.length === 2, "0.2s sliver folded into the cut (SIL-04)");
assert(
  !plan3.keepSegments.some((k) => k.srcStartSec >= 3.5 && k.srcEndSec <= 3.8),
  "No keep segment survives inside the 3.5–3.7 sliver",
);

// 5. End-to-end (optional): synthetic tone video through detect → plan → execute.
console.log("\n[E2E] synthetic ffmpeg tone video:");
const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status === 0;
if (!hasFfmpeg) {
  console.log("  ⚠ SKIP: ffmpeg not available for the end-to-end check.");
} else {
  const workDir = path.join(__dirname, "..", "out", "test_silence_e2e");
  fs.mkdirSync(workDir, { recursive: true });
  try {
    // 3 bursts of 0.8s tone, 1.5s gaps → ~5.4s audio-only feed (podcast-style).
    const tone = path.join(workDir, "tone.wav");
    const gap = path.join(workDir, "gap.wav");
    const list = path.join(workDir, "concat.txt");
    const audio = path.join(workDir, "audio.wav");
    const source = path.join(workDir, "src_audio_only.mp4");
    spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.8", "-c:a", "pcm_s16le", tone], { encoding: "utf8" });
    spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "1.5", "-c:a", "pcm_s16le", gap], { encoding: "utf8" });
    fs.writeFileSync(list, ["file '" + tone + "'", "file '" + gap + "'", "file '" + tone + "'", "file '" + gap + "'", "file '" + tone + "'"].join("\n"), "utf8");
    spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "pcm_s16le", audio], { encoding: "utf8" });
    spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", audio, "-c:a", "aac", "-b:a", "128k", source], { encoding: "utf8" });

    const detE2e = detectSilences(source, { noiseDb: -45, minSilenceSec: 0.6 });
    assert(detE2e.silences.length >= 2, `E2E: silencedetect found ${detE2e.silences.length} dead-air gaps`);

    const planE2e = buildSilenceCutPlan(source, detE2e, { hasAudio: true });
    assert(planE2e.outputDurationSec > 1.0 && planE2e.outputDurationSec < 2.6, `E2E: cut lands near ~1.5s of speech (got ${planE2e.outputDurationSec}s)`);
    const { outputPath, exitCode } = executeSilenceCut(planE2e, workDir);
    assert(exitCode === 0 && fs.existsSync(outputPath), "E2E: concat cut produced an output file");
    const outDuration = probeDurationSec(outputPath);
    assert(outDuration > 0 && outDuration < detE2e.durationSec, `E2E: output ${outDuration.toFixed(2)}s is shorter than source (dead air removed)`);
  } catch (e) {
    assert(false, "E2E threw: " + (e as Error).message);
  }
}

console.log("\n=============================================");
if (passedChecks === totalChecks) {
  console.log(`🎉 SILENCE CUTTER TESTS PASSED: ${passedChecks}/${totalChecks}`);
} else {
  console.error(`💥 SILENCE CUTTER TESTS FAILED: ${totalChecks - passedChecks} failures.`);
}
console.log("=============================================");

