import {describe, expect, it} from "vitest";
import type {CutEvent, SFXEvent, TextEvent, TimelineEvent, UnifiedRenderManifest} from "@prometheus/shared-types";
import {meetsQualityFloor} from "./judgment-layer";

const cut = (atMs: number, style: CutEvent["style"] = "hard"): CutEvent => ({
  type: "cut",
  atMs,
  toMs: atMs,
  style,
  intensity: 1,
});

const text = (startMs: number, endMs: number): TextEvent => ({
  type: "text",
  word: `WORD-${startMs}`,
  startMs,
  endMs,
  style: "slide_up",
  color: "#FFFFFF",
  position: {x: 0.5, y: 0.2, z: 0.1},
  scale: 1,
  cameraPush: 0,
  shake: 0,
});

const sfx = (id: string, cue: SFXEvent["cue"], triggerMs: number): SFXEvent => ({
  id,
  cue,
  triggerMs,
  durationMs: 250,
  volumeDb: -12,
  duckMusicDb: -6,
});

const timeline = (): TimelineEvent[] => [
  cut(500),
  cut(1500, "zoom_blur"),
  cut(4200),
  cut(6200),
  cut(8200),
  cut(9500),
  text(3300, 3700),
  text(4800, 5200),
];

const baseSfx = (): SFXEvent[] => [
  sfx("cut-0", "whoosh_fast", 500),
  sfx("cut-2", "whoosh_fast", 4200),
  sfx("cut-3", "whoosh_fast", 6200),
  sfx("cut-4", "whoosh_fast", 8200),
  sfx("cut-5", "whoosh_fast", 9500),
];

const manifest = (overrides: Partial<UnifiedRenderManifest> = {}): UnifiedRenderManifest => ({
  version: "2.0",
  jobId: "typography-quality",
  seed: 12345,
  createdAt: "2026-06-20T00:00:00.000Z",
  durationFrames: 300,
  fps: 30,
  width: 1080,
  height: 1920,
  videoTracks: [{sourcePath: "file:///video.mp4", startFrame: 0, endFrame: 299}],
  cameraMoves: [{type: "push_in", startFrame: 120, endFrame: 150}],
  textOverlays: [],
  transitions: [],
  source: {videoUrl: "file:///video.mp4", transcript: [], durationMs: 10000, width: 1080, height: 1920, fps: 30},
  audio: {
    beats: [500, 1500, 4200, 6200, 8200, 9500],
    onsets: [750, 1750],
    energyCurve: [0.7, 0.8, 0.5, 0.6],
    sfx: baseSfx(),
    voiceVolumeDb: 0,
    musicVolumeDb: -18,
    targetLufs: -14,
  },
  timeline: timeline(),
  creativeProfile: {name: "joseph_aggressive", cutDensity: 1, textDensity: 0.8, sfxDensity: 1, cameraAggression: 0.9, colorIntensity: 0.8},
  output: {width: 1080, height: 1920, fps: 30, codec: "h264", crf: 18},
  ...overrides,
});

describe("Judgment Layer Joseph typography quality", () => {
  it("fails candidates with typography intelligence quality failures", () => {
    const score = meetsQualityFloor(manifest({
      josephTypography: {
        version: "joseph-typography-v1",
        stylebookId: "aggressive_authority",
        lexicalWeights: [
          {text: "the", normalized: "the", startFrame: 0, endFrame: 8, role: "filler", score: 0.05, reasons: ["common_filler_word"]},
          {text: "win", normalized: "win", startFrame: 17, endFrame: 26, role: "hero", score: 0.91, reasons: ["high_energy"]},
        ],
        compositionRules: {
          caseStrategy: "all_caps",
          lineBreakStrategy: "phrase_stack",
          contrastMode: "single_color",
          hierarchyScale: 1.04,
          fillerTreatment: "show_dimmed",
          maxWordsPerLine: 7,
        },
        lines: [
          {
            text: "THE WIN EVERYTHING NOW TODAY",
            role: "hero",
            caseTreatment: "uppercase",
            startFrame: 0,
            endFrame: 60,
            maxCharacters: 16,
            contrastColor: "#FFFFFF",
            hierarchyLevel: 1,
          },
        ],
        qualityAudit: {
          score: 0.52,
          failures: ["typography_cheap_emphasis", "typography_broken_line_rhythm"],
          warnings: [],
        },
      },
    }));

    expect(score.passedFloor).toBe(false);
    expect(score.floorFailures).toEqual(
      expect.arrayContaining(["typography_cheap_emphasis", "typography_broken_line_rhythm"]),
    );
    expect(score.qualityScore).toBeLessThan(0.9);
  });
});
