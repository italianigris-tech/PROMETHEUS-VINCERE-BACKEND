import {describe, expect, it} from "vitest";
import type {CutEvent, TextEvent, TimelineEvent, UnifiedRenderManifest} from "@prometheus/shared-types";
import {
  detectPrimitiveCollisions,
  evaluateJosephNegativeGrammar,
  measureClimaxBudget,
  measureReadabilityRisk,
  measureSequenceDensity,
  measureSequenceRepetition,
} from "./joseph-negative-grammar";

const cut = (atMs: number, style: CutEvent["style"] = "hard"): CutEvent => ({
  type: "cut",
  atMs,
  toMs: atMs,
  style,
  intensity: 1,
});

const text = (startMs: number, endMs: number, style: TextEvent["style"] = "pop", y = 0.2): TextEvent => ({
  type: "text",
  word: `WORD-${startMs}`,
  startMs,
  endMs,
  style,
  color: "#FF0040",
  position: {x: 0.5, y, z: 0.1},
  scale: 1,
  cameraPush: 0,
  shake: 0,
});

const manifest = (overrides: Partial<UnifiedRenderManifest> = {}): UnifiedRenderManifest => ({
  version: "2.0",
  jobId: "11111111-1111-4111-8111-111111111111",
  seed: 12345,
  createdAt: "2026-06-20T00:00:00.000Z",
  durationFrames: 300,
  fps: 30,
  width: 1080,
  height: 1920,
  videoTracks: [{sourcePath: "file:///video.mp4", startFrame: 0, endFrame: 299}],
  cameraMoves: [{type: "shake", startFrame: 90, endFrame: 110}],
  textOverlays: [],
  transitions: [{startFrame: 45, endFrame: 55}],
  source: {videoUrl: "file:///video.mp4", transcript: [], durationMs: 10000, width: 1080, height: 1920, fps: 30},
  audio: {
    beats: [500, 1500, 2500, 3500, 4500, 5500],
    onsets: [500, 1500, 2500, 3500],
    energyCurve: [0.91, 0.92, 0.9, 0.89, 0.87, 0.5],
    sfx: [],
    voiceVolumeDb: 0,
    musicVolumeDb: -18,
    targetLufs: -14,
  },
  timeline: [
    cut(500),
    cut(1500),
    cut(2500),
    cut(3500),
    cut(4500),
    cut(5500),
    text(3000, 4200, "pop", 0.45),
    text(3050, 4300, "pop", 0.45),
    text(3100, 4400, "pop", 0.45),
    text(3150, 4500, "pop", 0.45),
  ],
  creativeProfile: {name: "joseph_aggressive", cutDensity: 1, textDensity: 0.9, sfxDensity: 1, cameraAggression: 1, colorIntensity: 0.9},
  output: {width: 1080, height: 1920, fps: 30, codec: "h264", crf: 18},
  ...overrides,
});

describe("Joseph backend Negative Grammar metrics", () => {
  it("exposes pure sequence metrics for repetition, density, climax budget, readability, and primitive collisions", () => {
    const candidate = manifest({
      textOverlays: [
        {
          text: "WIN",
          startFrame: 90,
          endFrame: 120,
          animation: "pop",
          color: "#FF0040",
          microAnimation: {
            primitiveId: "text-emphasis.sweep-highlight",
            family: "text_emphasis",
            role: "emphasis",
            renderFallback: "pop",
            combinationGroup: "emphasis-mark",
            semanticRole: "hero",
            parameters: {intensity: 0.8, durationMs: 300, delayMs: 0, anchor: "word", direction: "right"},
          },
        },
        {
          text: "NOW",
          startFrame: 95,
          endFrame: 125,
          animation: "pop",
          color: "#FF0040",
          microAnimation: {
            primitiveId: "text-emphasis.underline-reveal",
            family: "text_emphasis",
            role: "emphasis",
            renderFallback: "slide_up",
            combinationGroup: "emphasis-mark",
            semanticRole: "hero",
            parameters: {intensity: 0.75, durationMs: 280, delayMs: 0, anchor: "word", direction: "right"},
          },
        },
      ],
    } as Partial<UnifiedRenderManifest>);

    expect(measureSequenceRepetition(candidate).repeatedCutCadenceRun).toBeGreaterThanOrEqual(4);
    expect(measureSequenceDensity(candidate).visualEventsPerSecond).toBeGreaterThan(1);
    expect(measureClimaxBudget(candidate).pressure).toBeGreaterThan(0.6);
    expect(measureReadabilityRisk(candidate).riskScore).toBeGreaterThan(0.6);
    expect(detectPrimitiveCollisions(candidate).failureTags).toContain("micro_emphasis_collision");

    const evaluation = evaluateJosephNegativeGrammar(candidate);

    expect(evaluation.failures).toEqual(
      expect.arrayContaining([
        "primitive-collision",
        "readability-sacrifice",
      ]),
    );
    expect(evaluation.warnings).toEqual(
      expect.arrayContaining([
        "repetition-fatigue",
        "visual-density-overload",
      ]),
    );
    expect(evaluation.penalty).toBeGreaterThan(0);
  });
});
