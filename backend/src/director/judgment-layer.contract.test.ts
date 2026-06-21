import {describe, expect, it} from "vitest";
import type {CutEvent, SFXEvent, TextEvent, TimelineEvent, UnifiedRenderManifest} from "@prometheus/shared-types";
import {ReplayLedger} from "../ledger/replay-ledger";
import {computeSimilarityHash, JudgmentLayer, meetsQualityFloor} from "./judgment-layer";
import type {VariationKey} from "./variation-key";
import type {GovernedPrompt} from "./prompt-governance";

const cut = (atMs: number, style: CutEvent["style"] = "hard"): CutEvent => ({
  type: "cut",
  atMs,
  toMs: atMs,
  style,
  intensity: 1,
});

const text = (startMs: number, endMs: number, style: TextEvent["style"] = "slide_up", y = 0.2): TextEvent => ({
  type: "text",
  word: `WORD-${startMs}`,
  startMs,
  endMs,
  style,
  color: style === "glitch" || style === "pop" ? "#FF0040" : "#FFFFFF",
  position: {x: 0.5, y, z: 0.1},
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

const variationKey = (retryIndex = 0): VariationKey => ({
  key: `key-${retryIndex}`,
  sourceFingerprint: "source-a",
  promptFingerprint: "prompt-a",
  uploadInstanceId: "upload-1",
  retryIndex,
  source_fingerprint: "source-a",
  prompt_fingerprint: "prompt-a",
  upload_instance_id: "upload-1",
  retry_index: retryIndex,
});

const baseTimeline = (): TimelineEvent[] => [
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

const validManifest = (jobId: string, overrides: Partial<UnifiedRenderManifest> = {}): UnifiedRenderManifest => ({
  version: "2.0",
  jobId,
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
  timeline: baseTimeline(),
  creativeProfile: {name: "joseph_aggressive", cutDensity: 1, textDensity: 0.8, sfxDensity: 1, cameraAggression: 0.9, colorIntensity: 0.8},
  output: {width: 1080, height: 1920, fps: 30, codec: "h264", crf: 18},
  ...overrides,
});

const nearbyHash = (hash: string): string => {
  const chars = hash.split("");
  for (let index = 0; index < 7; index += 1) {
    chars[index] = chars[index] === "a" ? "b" : "a";
  }
  return chars.join("");
};

describe("JudgmentLayer active contract", () => {
  it("passes candidate with all quality floor checks", () => {
    const score = meetsQualityFloor(validManifest("good"));

    expect(score.passedFloor).toBe(true);
    expect(score.floorFailures).toEqual([]);
    expect(score.qualityScore).toBeGreaterThan(0.8);
  });

  it("fails candidate with missing hook cuts", () => {
    const manifest = validManifest("bad-hook", {
      timeline: [cut(1500), cut(4200), cut(6200), cut(8200), cut(9500), text(3300, 3700), text(4800, 5200)],
    });

    const score = meetsQualityFloor(manifest);

    expect(score.passedFloor).toBe(false);
    expect(score.floorFailures).toContain("hook_cuts < 2");
  });

  it("fails candidate with text overlap > 3", () => {
    const manifest = validManifest("bad-overlap", {
      timeline: [
        ...baseTimeline(),
        text(6000, 7000),
        text(6050, 7000),
        text(6100, 7000),
        text(6150, 7000),
      ],
    });

    const score = meetsQualityFloor(manifest);

    expect(score.passedFloor).toBe(false);
    expect(score.floorFailures).toContain("text_overlap > 3");
  });

  it("fails candidate with shake + zoom_blur collision", () => {
    const manifest = validManifest("bad-collision", {
      cameraMoves: [{type: "shake", startFrame: 40, endFrame: 55}],
      transitions: [{startFrame: 45, endFrame: 60}],
    });

    const score = meetsQualityFloor(manifest);

    expect(score.passedFloor).toBe(false);
    expect(score.floorFailures).toContain("shake_zoom_blur_collision");
  });

  it("vetoes candidate too similar to replay ledger", async () => {
    const repeated = validManifest("repeat");
    const novel = validManifest("novel", {
      timeline: [cut(400), cut(2600), cut(3600), cut(5100), cut(7700), cut(9800), text(3900, 4300)],
      audio: {
        ...validManifest("novel-audio").audio,
        sfx: [sfx("novel-0", "whoosh_fast", 400), sfx("novel-1", "whoosh_fast", 2600), sfx("novel-2", "whoosh_fast", 3600), sfx("novel-3", "whoosh_fast", 5100), sfx("novel-4", "whoosh_fast", 7700), sfx("novel-5", "whoosh_fast", 9800)],
      },
      cameraMoves: [{type: "dutch", startFrame: 30, endFrame: 55}, {type: "push_in", startFrame: 210, endFrame: 235}],
      transitions: [{startFrame: 90, endFrame: 102}],
    });
    const ledger = new ReplayLedger(":memory:");
    ledger.insert({
      id: "prior",
      sourceFingerprint: "source-a",
      promptFingerprint: "prompt-a",
      uploadInstanceId: "prior-upload",
      retryIndex: 0,
      profile: "joseph_aggressive",
      chosenGenome: JSON.stringify(repeated),
      rejectedGenomes: "[]",
      plannerAudit: "{}",
      similarityHash: computeSimilarityHash(repeated),
      qualityScore: 0.95,
      failureTags: "",
      createdAt: "2026-06-20T00:00:00.000Z",
    });

    const judgment = await new JudgmentLayer(ledger).judgeCandidates([repeated, novel], variationKey(), governedPrompt());
    const repeatedScore = judgment.scores.find((score) => score.manifest.jobId === "repeat");

    expect(repeatedScore?.similarityScore).toBeGreaterThan(0.85);
    expect(judgment.selected.jobId).toBe("novel");
    expect(judgment.rejected.map((candidate) => candidate.jobId)).toContain("repeat");
    expect(judgment.verdict.failureTags).toContain("replay_similarity_veto");
  });

  it("selects by variation key deterministically", async () => {
    const candidates = [validManifest("a"), validManifest("b", {seed: 222}), validManifest("c", {seed: 333})];
    const ledger = new ReplayLedger(":memory:");
    const judgment = new JudgmentLayer(ledger);

    const left = await judgment.judgeCandidates(candidates, variationKey(5), governedPrompt());
    const right = await judgment.judgeCandidates(candidates, variationKey(5), governedPrompt());

    expect(right.selected.jobId).toBe(left.selected.jobId);
    expect(right).toEqual(left);
  });

  it("relaxes similarity threshold once if all candidates are initially vetoed", async () => {
    const candidate = validManifest("relaxed", {seed: 444});
    const ledger = new ReplayLedger(":memory:");
    ledger.insert({
      id: "prior-relaxed",
      sourceFingerprint: "source-a",
      promptFingerprint: "prompt-a",
      uploadInstanceId: "prior-upload",
      retryIndex: 0,
      profile: "joseph_aggressive",
      chosenGenome: "{}",
      rejectedGenomes: "[]",
      plannerAudit: "{}",
      similarityHash: nearbyHash(computeSimilarityHash(candidate)),
      qualityScore: 0.95,
      failureTags: "",
      createdAt: "2026-06-20T00:00:00.000Z",
    });

    const judgment = new JudgmentLayer(ledger, {similarityThresholdSamePrompt: 0.85, similarityThresholdDiffPrompt: 0.7});
    const result = await judgment.judgeCandidates([candidate], variationKey(), governedPrompt());

    expect(result.selected.jobId).toBe("relaxed");
    expect(result.scores[0]?.similarityScore).toBeGreaterThan(0.85);
    expect(result.scores[0]?.similarityScore).toBeLessThanOrEqual(0.95);
  });

  it("throws if no candidates pass quality floor", async () => {
    const judgment = new JudgmentLayer(new ReplayLedger(":memory:"));
    const bad = validManifest("bad", {
      width: 1920,
      height: 1080,
      source: {videoUrl: "file:///video.mp4", transcript: [], durationMs: 120000, width: 1920, height: 1080, fps: 30},
      timeline: [cut(4200)],
    });

    await expect(judgment.judgeCandidates([bad], variationKey(), governedPrompt())).rejects.toThrow(/No candidates passed quality floor/);
  });
});
