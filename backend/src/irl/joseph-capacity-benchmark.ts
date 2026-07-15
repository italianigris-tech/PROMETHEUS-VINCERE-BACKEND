import type {UnifiedRenderManifest} from "@prometheus/shared-types";

import type {JosephTranscriptPayload} from "../upload/joseph-transcript";

/**
 * Capacity benchmark: proves the director+compiler path is speech-driven and
 * not density-theater. This is the pre-IRL pass/fail signal for edit capacity.
 */

export type JosephCapacityBenchmarkInput = {
  manifest: UnifiedRenderManifest;
  transcript: JosephTranscriptPayload;
  compilerMode?: string;
  scaffoldInjections?: {
    forcedCuts: number;
    forcedSfx: number;
  };
};

export type JosephCapacityCheck = {
  id: string;
  passed: boolean;
  detail: string;
  weight: number;
};

export type JosephCapacityBenchmarkReport = {
  version: "joseph-capacity-benchmark-v1";
  passed: boolean;
  score: number;
  checks: JosephCapacityCheck[];
  summary: string;
};

const wordWindows = (transcript: JosephTranscriptPayload): Array<{startMs: number; endMs: number}> =>
  transcript.words.map((word) => ({startMs: word.startMs, endMs: word.endMs}));

const nearWordEdge = (atMs: number, windows: Array<{startMs: number; endMs: number}>, tolMs = 120): boolean =>
  windows.some((window) =>
    Math.abs(window.startMs - atMs) <= tolMs
    || Math.abs(window.endMs - atMs) <= tolMs
    || (atMs >= window.startMs - tolMs && atMs <= window.endMs + tolMs),
  );

const cutsOf = (manifest: UnifiedRenderManifest): number[] =>
  manifest.timeline
    .filter((event): event is Extract<typeof event, {type: "cut"}> => event.type === "cut")
    .map((cut) => cut.atMs);

export const evaluateJosephCapacityBenchmark = (
  input: JosephCapacityBenchmarkInput,
): JosephCapacityBenchmarkReport => {
  const checks: JosephCapacityCheck[] = [];
  const push = (id: string, passed: boolean, detail: string, weight: number) => {
    checks.push({id, passed, detail, weight});
  };

  const words = input.transcript.words;
  const speechSourceOk = input.transcript.source === "assemblyai"
    || input.transcript.source === "provided_file"
    || input.transcript.source === "fixture_words";
  push(
    "speech_transcript_source",
    speechSourceOk && input.transcript.source !== "fallback_prompt",
    `source=${input.transcript.source} words=${words.length}`,
    10,
  );

  push(
    "word_timings_present",
    words.length >= 4 && words.every((word) => word.endMs > word.startMs),
    `wordCount=${words.length}`,
    9,
  );

  const cuts = cutsOf(input.manifest);
  const windows = wordWindows(input.transcript);
  const speechAlignedCuts = cuts.filter((atMs) => nearWordEdge(atMs, windows, 180));
  const alignmentRatio = cuts.length === 0 ? 1 : speechAlignedCuts.length / cuts.length;
  push(
    "cut_speech_alignment",
    cuts.length === 0 || alignmentRatio >= 0.55,
    `aligned=${speechAlignedCuts.length}/${cuts.length} ratio=${alignmentRatio.toFixed(2)}`,
    9,
  );

  const forcedCuts = input.scaffoldInjections?.forcedCuts ?? 0;
  const forcedSfx = input.scaffoldInjections?.forcedSfx ?? 0;
  push(
    "no_density_scaffold_spam",
    forcedCuts === 0 && forcedSfx === 0,
    `forcedCuts=${forcedCuts} forcedSfx=${forcedSfx}`,
    9,
  );

  const sfxCount = input.manifest.audio.sfx.length;
  const cutCount = Math.max(1, cuts.length);
  const sfxPerCut = sfxCount / cutCount;
  // Joseph restraint: not every cut needs a whoosh.
  push(
    "sfx_restraint",
    sfxPerCut <= 1.15,
    `sfx=${sfxCount} cuts=${cuts.length} sfxPerCut=${sfxPerCut.toFixed(2)}`,
    7,
  );

  push(
    "compiler_authority",
    input.compilerMode === "compile_manifest" || Boolean(input.manifest.plannerHandoff),
    `compilerMode=${input.compilerMode ?? "unknown"} handoff=${Boolean(input.manifest.plannerHandoff)}`,
    8,
  );

  push(
    "micro_animation_contract",
    input.manifest.textOverlays.some((overlay) => Boolean(overlay.microAnimation))
      || (input.manifest.textOverlays.length === 0),
    `overlays=${input.manifest.textOverlays.length} withMicro=${input.manifest.textOverlays.filter((o) => o.microAnimation).length}`,
    6,
  );

  push(
    "vertical_authority",
    input.manifest.width === 1080 && input.manifest.height === 1920,
    `${input.manifest.width}x${input.manifest.height}`,
    5,
  );

  const trainableBlockedOnPrompt = input.transcript.source !== "fallback_prompt";
  push(
    "irl_transcript_not_prompt_mush",
    trainableBlockedOnPrompt,
    `trainableForIrl=${input.transcript.trainableForIrl} source=${input.transcript.source}`,
    8,
  );

  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
  const score = totalWeight === 0 ? 0 : earned / totalWeight;
  const criticalFailed = checks.some((check) => check.weight >= 9 && !check.passed);
  const passed = !criticalFailed && score >= 0.75;

  return {
    version: "joseph-capacity-benchmark-v1",
    passed,
    score,
    checks,
    summary: passed
      ? `Joseph capacity benchmark PASSED (score=${score.toFixed(2)})`
      : `Joseph capacity benchmark FAILED (score=${score.toFixed(2)}; critical=${criticalFailed})`,
  };
};
