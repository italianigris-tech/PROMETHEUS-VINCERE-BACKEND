import {describe, expect, it} from "vitest";

import {
  createAdapterIssue,
  framesToMs,
  isRecord,
  msToFrames,
  normalizeTranscriptWords,
  readFiniteNumber,
  readRecord,
  readString,
  resolveTranscriptWords,
  splitTranscriptIntoEvenWords
} from "../utils";
import type {PrometheusSchemaAdapterIssue, SpecCDM, SpecRenderManifest} from "../types";

const assertSpecCDM = (value: SpecCDM): SpecCDM => value;
const assertSpecRenderManifest = (value: SpecRenderManifest): SpecRenderManifest => value;

describe("schema-adapter utils", () => {
  it("exposes explicit Prometheus Jesus spec-facing manifest type shapes", () => {
    const cdm = assertSpecCDM({
      version: "1.0.0",
      sourceVideo: {
        url: "/media/source.mp4",
        transcript: "Build the bridge.",
        words: [{text: "Build", startMs: 0, endMs: 300}]
      },
      editPlan: {
        segments: [{id: "scene_1", startMs: 0, endMs: 1200, text: "Build the bridge."}]
      },
      pacingProfile: {
        rhetoricalIntent: "premium_explain",
        emotionalTone: "cinematic",
        intensity: 0.7
      },
      diagnostics: {issues: []}
    });

    const renderManifest = assertSpecRenderManifest({
      version: "1.0.0",
      jobId: "job_1",
      frameRate: 30,
      durationInFrames: 36,
      sourceVideo: {url: "/media/source.mp4"},
      transcript: "Build the bridge.",
      transcriptWords: [{text: "Build", startMs: 0, endMs: 300}],
      audio: {
        musicTrackUrl: "/audio/music.mp3",
        sfxEvents: [{id: "sfx_1", cueId: "whoosh", startMs: 300, visualEventId: "transition_1"}]
      },
      postProcessing: {
        passes: [{type: "bloom", enabled: true}]
      },
      diagnostics: {issues: []}
    });

    expect(cdm.version).toBe("1.0.0");
    expect(renderManifest.audio.sfxEvents[0]?.visualEventId).toBe("transition_1");
  });

  it("reads only safe record/string/number values", () => {
    const value = {
      child: {ok: true},
      list: [],
      text: "  Prometheus  ",
      blank: "   ",
      count: 42,
      nan: Number.NaN
    };

    expect(isRecord(value)).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(readRecord(value, "child")).toEqual({ok: true});
    expect(readRecord(value, "list")).toBeNull();
    expect(readString(value, "text")).toBe("Prometheus");
    expect(readString(value, "blank")).toBeNull();
    expect(readFiniteNumber(value, "count")).toBe(42);
    expect(readFiniteNumber(value, "nan")).toBeNull();
  });

  it("creates stable adapter issues", () => {
    expect(createAdapterIssue({
      code: "missing_field",
      severity: "warning",
      path: "source.transcriptSegment.text",
      message: "Missing transcript text."
    })).toEqual({
      code: "missing_field",
      severity: "warning",
      path: "source.transcriptSegment.text",
      message: "Missing transcript text."
    });
  });

  it("converts between milliseconds and frames with explicit fps", () => {
    expect(msToFrames(10_000, 30)).toBe(300);
    expect(msToFrames(1, 24)).toBe(1);
    expect(framesToMs(300, 30)).toBe(10_000);
    expect(() => msToFrames(0, 30)).toThrow(/durationMs must be a positive finite number/);
    expect(() => framesToMs(300, 0)).toThrow(/fps must be a positive finite number/);
  });

  it("normalizes explicit transcript words and reports skipped invalid entries", () => {
    const diagnostics: PrometheusSchemaAdapterIssue[] = [];
    const words = normalizeTranscriptWords([
      {text: "later", startMs: 500, endMs: 700, confidence: 0.8, semanticTag: "release"},
      {word: "first", start: 0, end: 250},
      {text: "bad-range", startMs: 900, endMs: 900},
      {text: "missing-time"},
      "not-an-object"
    ], diagnostics);

    expect(words).toEqual([
      {text: "first", startMs: 0, endMs: 250, confidence: undefined, semanticTag: undefined},
      {text: "later", startMs: 500, endMs: 700, confidence: 0.8, semanticTag: "release"}
    ]);
    expect(diagnostics.map((issue) => issue.code)).toEqual([
      "invalid_time_range",
      "missing_field",
      "invalid_type"
    ]);
  });

  it("generates deterministic even word timings when explicit words are absent", () => {
    expect(splitTranscriptIntoEvenWords({
      transcript: "build premium systems",
      durationMs: 900
    })).toEqual([
      {text: "build", startMs: 0, endMs: 300},
      {text: "premium", startMs: 300, endMs: 600},
      {text: "systems", startMs: 600, endMs: 900}
    ]);
  });

  it("prefers valid explicit words but records fallback generation when needed", () => {
    const explicitDiagnostics: PrometheusSchemaAdapterIssue[] = [];
    expect(resolveTranscriptWords({
      explicitWords: [{text: "kept", startMs: 0, endMs: 100}],
      transcript: "ignored fallback",
      durationMs: 1_000,
      diagnostics: explicitDiagnostics
    })).toEqual([{text: "kept", startMs: 0, endMs: 100, confidence: undefined, semanticTag: undefined}]);
    expect(explicitDiagnostics).toEqual([]);

    const fallbackDiagnostics: PrometheusSchemaAdapterIssue[] = [];
    expect(resolveTranscriptWords({
      explicitWords: [{text: "invalid", startMs: 10, endMs: 10}],
      transcript: "fallback words",
      durationMs: 1_000,
      diagnostics: fallbackDiagnostics
    })).toEqual([
      {text: "fallback", startMs: 0, endMs: 500},
      {text: "words", startMs: 500, endMs: 1000}
    ]);
    expect(fallbackDiagnostics.map((issue) => issue.code)).toEqual([
      "invalid_time_range",
      "normalization_applied"
    ]);
  });
});