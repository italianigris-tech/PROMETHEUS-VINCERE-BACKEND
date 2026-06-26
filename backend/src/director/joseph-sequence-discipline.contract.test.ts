import {describe, expect, it} from "vitest";
import type {CutEvent, SFXEvent, TextEvent, TimelineEvent, UnifiedRenderManifest} from "@prometheus/shared-types";
import {ReplayLedger} from "../ledger/replay-ledger";
import {JudgmentLayer, meetsQualityFloor} from "./judgment-layer";
import type {GovernedPrompt} from "./prompt-governance";
import type {VariationKey} from "./variation-key";

const cut = (atMs: number, style: CutEvent["style"] = "hard"): CutEvent => ({
  type: "cut",
  atMs,
  toMs: atMs,
  style,
  intensity: 1,
});

const text = (startMs: number, style: TextEvent["style"] = "pop"): TextEvent => ({
  type: "text",
  word: `WORD-${startMs}`,
  startMs,
  endMs: startMs + 360,
  style,
  color: style === "pop" || style === "glitch" ? "#FF0040" : "#FFFFFF",
  position: {x: 0.5, y: 0.2, z: 0.1},
  scale: 1,
  cameraPush: 0,
  shake: style === "glitch" ? 0.5 : 0,
});

const sfx = (id: string, cue: SFXEvent["cue"], triggerMs: number): SFXEvent => ({
  id,
  cue,
  triggerMs,
  durationMs: 250,
  volumeDb: -12,
  duckMusicDb: -6,
});

const governedPrompt = (): GovernedPrompt => ({
  id: "prompt-1",
  version: 1,
  text: "high energy edit",
  fingerprint: "prompt-a",
  doctrine: {tone: "aggressive"},
  infrastructureFlags: {
    mayOverrideDeterminism: false,
    mayOverrideVariationKey: false,
    mayOverrideRenderPipeline: false,
  },
  createdAt: "2026-06-20T00:00:00.000Z",
});

const variationKey = (): VariationKey => ({
  key: "key-sequence-discipline",
  sourceFingerprint: "source-a",
  promptFingerprint: "prompt-a",
  uploadInstanceId: "upload-1",
  retryIndex: 0,
  source_fingerprint: "source-a",
  prompt_fingerprint: "prompt-a",
  upload_instance_id: "upload-1",
  retry_index: 0,
});

const cutTimes = [500, 1500, 3500, 4500, 5500, 8500];

const repetitiveTimeline = (): TimelineEvent[] => [
  ...cutTimes.map((time) => cut(time)),
  text(3200, "pop"),
  text(4000, "pop"),
  text(4800, "pop"),
  text(5600, "pop"),
];

const repetitiveSfx = (): SFXEvent[] => [
  ...cutTimes.map((time, index) => sfx(`cut-${index}`, "whoosh_fast", time)),
  sfx("pop-0", "pop_text", 3200),
  sfx("pop-1", "pop_text", 4000),
  sfx("pop-2", "pop_text", 4800),
  sfx("pop-3", "pop_text", 5600),
];

const repetitiveManifest = (overrides: Partial<UnifiedRenderManifest> = {}): UnifiedRenderManifest => ({
  version: "2.0",
  jobId: "11111111-1111-4111-8111-111111111111",
  seed: 12345,
  createdAt: "2026-06-20T00:00:00.000Z",
  durationFrames: 300,
  fps: 30,
  width: 1080,
  height: 1920,
  videoTracks: [{sourcePath: "file:///video.mp4", startFrame: 0, endFrame: 299}],
  cameraMoves: [
    {type: "shake", startFrame: 96, endFrame: 108},
    {type: "shake", startFrame: 132, endFrame: 144},
    {type: "shake", startFrame: 168, endFrame: 180},
  ],
  textOverlays: [
    {text: "ONE", startFrame: 96, endFrame: 108, animation: "pop", color: "#FF0040"},
    {text: "TWO", startFrame: 120, endFrame: 132, animation: "pop", color: "#FF0040"},
    {text: "THREE", startFrame: 144, endFrame: 156, animation: "pop", color: "#FF0040"},
    {text: "FOUR", startFrame: 168, endFrame: 180, animation: "pop", color: "#FF0040"},
  ],
  transitions: [],
  source: {videoUrl: "file:///video.mp4", transcript: [], durationMs: 10000, width: 1080, height: 1920, fps: 30},
  audio: {
    beats: cutTimes,
    onsets: [3200, 4000, 4800, 5600],
    energyCurve: [0.86, 0.9, 0.88, 0.91, 0.74, 0.62],
    sfx: repetitiveSfx(),
    voiceVolumeDb: 0,
    musicVolumeDb: -18,
    targetLufs: -14,
  },
  timeline: repetitiveTimeline(),
  creativeProfile: {name: "joseph_aggressive", cutDensity: 1, textDensity: 0.8, sfxDensity: 1, cameraAggression: 0.9, colorIntensity: 0.8},
  output: {width: 1080, height: 1920, fps: 30, codec: "h264", crf: 18},
  ...overrides,
});

describe("Joseph live sequence discipline", () => {
  it("adds live Negative Grammar and sequence-memory penalty signals to quality scoring", () => {
    const score = meetsQualityFloor(repetitiveManifest());

    expect(score.passedFloor).toBe(true);
    expect(score.sequenceDiscipline.enabled).toBe(true);
    expect(score.sequenceDiscipline.penalty).toBeGreaterThan(0);
    expect(score.sequenceDiscipline.violations.map((violation) => violation.ruleId)).toEqual(
      expect.arrayContaining([
        "avoid-repeating-typography-signature",
        "avoid-repeating-motion-signature",
        "prefer-restraint-after-loud-run",
        "avoid-flattening-pacing-rhythm",
      ]),
    );
    expect(score.qualityScore).toBeLessThan(0.95);
  });

  it("keeps a deterministic kill switch for compatibility rollout", async () => {
    const result = await new JudgmentLayer(new ReplayLedger(":memory:"), {
      sequenceDisciplineEnabled: false,
    }).judgeCandidates([repetitiveManifest()], variationKey(), governedPrompt());

    expect(result.scores[0]?.sequenceDiscipline.enabled).toBe(false);
    expect(result.scores[0]?.sequenceDiscipline.penalty).toBe(0);
    expect(result.scores[0]?.sequenceDiscipline.violations).toEqual([]);
  });
});
