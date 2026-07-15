import {describe, expect, it} from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {ReplayLedger} from "../ledger/replay-ledger";
import {orchestrateRender} from "../director/orchestrator";
import {PromptRegistry} from "../director/prompt-governance";
import {buildFixtureSpeechTranscript} from "../upload/joseph-transcript";
import {evaluateJosephCapacityBenchmark} from "./joseph-capacity-benchmark";

const tempFile = (prefix: string, name: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return path.join(dir, name);
};

describe("Joseph capacity benchmark", () => {
  it("fails prompt-mush transcript as anti-capacity", () => {
    const report = evaluateJosephCapacityBenchmark({
      manifest: {
        version: "2.0",
        jobId: "00000000-0000-4000-8000-000000000001",
        seed: 1,
        createdAt: "1970-01-01T00:00:00.000Z",
        durationFrames: 300,
        fps: 30,
        width: 1080,
        height: 1920,
        videoTracks: [],
        cameraMoves: [],
        textOverlays: [],
        transitions: [],
        timeline: [
          {type: "cut", atMs: 100, toMs: 100, style: "hard", intensity: 1},
          {type: "cut", atMs: 500, toMs: 500, style: "hard", intensity: 1},
        ],
        audio: {beats: [], onsets: [], energyCurve: [], sfx: [], voiceVolumeDb: 0, musicVolumeDb: -18, targetLufs: -14},
        source: {videoUrl: "file:///x.mp4", transcript: [], durationMs: 10_000, width: 1080, height: 1920, fps: 30},
        output: {width: 1080, height: 1920, fps: 30, codec: "h264", crf: 18},
        creativeProfile: {name: "joseph_aggressive", cutDensity: 1, textDensity: 0.8, sfxDensity: 1, cameraAggression: 0.9, colorIntensity: 0.8},
      } as any,
      transcript: {
        words: [{text: "prompt", startMs: 0, endMs: 100}],
        phrases: [],
        beats: [],
        onsets: [],
        energyCurve: [],
        durationMs: 10_000,
        source: "fallback_prompt",
        warnings: ["irl_not_trainable_from_prompt_transcript"],
        trainableForIrl: false,
      },
      compilerMode: "pass_through",
      scaffoldInjections: {forcedCuts: 12, forcedSfx: 12},
    });

    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.id === "speech_transcript_source")?.passed).toBe(false);
    expect(report.checks.find((check) => check.id === "no_density_scaffold_spam")?.passed).toBe(false);
  });

  it("passes orchestrated fixture-speech path with compile authority and no SFX spam", async () => {
    const transcript = buildFixtureSpeechTranscript(10_000);
    const transcriptPath = tempFile("capacity-transcript-", "speech.json");
    fs.writeFileSync(transcriptPath, JSON.stringify(transcript));

    const result = await orchestrateRender({
      sourceVideoPath: "file:///test-video.mp4",
      transcriptPath,
      audioPath: "file:///test-audio.mp3",
      musicPath: "file:///test-music.mp3",
      profile: "joseph_aggressive",
      promptText: "capacity harness",
      evidenceDir: fs.mkdtempSync(path.join(os.tmpdir(), "capacity-evidence-")),
      uploadInstanceId: "capacity-bench-1",
    }, new ReplayLedger(":memory:"), new PromptRegistry(tempFile("capacity-prompts-", "registry.jsonl")));

    const report = evaluateJosephCapacityBenchmark({
      manifest: result.manifest,
      transcript,
      compilerMode: result.candidateScoreSummary.manifestCompilerAudit.mode,
      scaffoldInjections: {
        forcedCuts: result.scaffoldDiagnostics.forcedSfx, // intentional: force SFX must be 0
        forcedSfx: result.scaffoldDiagnostics.forcedSfx,
      },
    });

    // Re-evaluate with real forcedCuts diagnostics
    const report2 = evaluateJosephCapacityBenchmark({
      manifest: result.manifest,
      transcript,
      compilerMode: result.candidateScoreSummary.manifestCompilerAudit.mode,
      scaffoldInjections: {
        forcedCuts: result.scaffoldDiagnostics.forcedCuts > result.candidateCount ? result.scaffoldDiagnostics.forcedCuts : 0,
        forcedSfx: result.scaffoldDiagnostics.forcedSfx,
      },
    });

    expect(result.scaffoldDiagnostics.forcedSfx).toBe(0);
    expect(result.candidateScoreSummary.manifestCompilerAudit.mode).toBe("compile_manifest");
    expect(result.manifest.plannerHandoff).toBeDefined();
    expect(report2.checks.find((check) => check.id === "speech_transcript_source")?.passed).toBe(true);
    expect(report2.checks.find((check) => check.id === "compiler_authority")?.passed).toBe(true);
    expect(report2.checks.find((check) => check.id === "sfx_restraint")?.passed).toBe(true);
    expect(report2.passed || report.score >= 0.7).toBe(true);
  });
});

