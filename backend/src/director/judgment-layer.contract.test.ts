import {describe, expect, it} from "vitest";
import type {CutEvent, MicroAnimationSelection, SFXEvent, TextEvent, TextOverlay, TimelineEvent, UnifiedRenderManifest} from "@prometheus/shared-types";
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

const microSelection = (
  primitiveId: string,
  overrides: Partial<MicroAnimationSelection> = {},
): MicroAnimationSelection => ({
  primitiveId,
  family: primitiveId.startsWith("text-entry.")
    ? "text_entry"
    : primitiveId.startsWith("text-mutation.")
      ? "text_mutation"
      : primitiveId.startsWith("accent-motion.")
        ? "accent_motion"
        : "text_emphasis",
  role: primitiveId.startsWith("text-entry.")
    ? "entry"
    : primitiveId.startsWith("text-mutation.")
      ? "mutation"
      : primitiveId.startsWith("accent-motion.")
        ? "accent"
        : "emphasis",
  renderFallback: "pop",
  combinationGroup: primitiveId.startsWith("text-entry.")
    ? "entry"
    : primitiveId.startsWith("text-mutation.")
      ? "semantic-mutation"
      : primitiveId.startsWith("accent-motion.")
        ? "accent-guide"
        : "emphasis-mark",
  semanticRole: "hero",
  parameters: {
    intensity: 0.82,
    durationMs: 300,
    delayMs: 0,
    anchor: "word",
    direction: "right",
  },
  ...overrides,
});

const microOverlay = (
  primitiveId: string,
  startFrame = 30,
  endFrame = 60,
  overrides: Partial<MicroAnimationSelection> = {},
): TextOverlay => ({
  text: "WIN",
  startFrame,
  endFrame,
  animation: "pop",
  color: "#FF0040",
  microAnimation: microSelection(primitiveId, overrides),
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

  it("does not require a whoosh on every hard cut", () => {
    const manifest = validManifest("restrained-hard-cuts", {
      audio: {
        ...validManifest("restrained-hard-cuts-audio").audio,
        sfx: [sfx("authored-impact", "impact_deep", 3300)],
      },
    });

    const score = meetsQualityFloor(manifest);

    expect(score.floorFailures).not.toContain("sfx_animation_desync");
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

  it("fails candidate with micro-animation primitive quality failures", () => {
    const manifest = validManifest("bad-micro-animation", {
      microAnimationAudit: {
        taxonomyVersion: "joseph-micro-animation-v1",
        primitiveIds: ["text-emphasis.sweep-highlight"],
        score: 0.62,
        failures: ["micro_animation_visual_chaos"],
        warnings: [],
        fixIntents: ["Lower primitive concurrency or intensity until the stack has a clear visual hierarchy."],
      },
    });

    const score = meetsQualityFloor(manifest);

    expect(score.passedFloor).toBe(false);
    expect(score.floorFailures).toContain("micro_animation_visual_chaos");
  });

  it("applies backend Negative Grammar climax-budget failures inside the Judgment Layer", () => {
    const manifest = validManifest("bad-climax-budget", {
      audio: {
        ...validManifest("bad-climax-budget-audio").audio,
        energyCurve: [0.94, 0.93, 0.91, 0.9, 0.88, 0.86],
      },
    }) as UnifiedRenderManifest & {
      _sequenceMemory: {
        highEnergy20sWindows: number;
        breatheFrames: number[];
      };
    };
    manifest._sequenceMemory = {
      highEnergy20sWindows: 2,
      breatheFrames: [],
    };

    const score = meetsQualityFloor(manifest);

    expect(score.passedFloor).toBe(false);
    expect(score.floorFailures).toContain("climax-overspend");
  });
  it("vetoes invalid primitive stacks from overlays and includes grammar fix intent", async () => {
    const safe = validManifest("safe-micro-stack");
    const invalid = validManifest("invalid-micro-stack", {
      textOverlays: [
        microOverlay("text-entry.word-riser"),
        microOverlay("text-entry.letter-riser"),
        microOverlay("text-emphasis.sweep-highlight", 30, 60, {
          semanticRole: "support",
          parameters: {
            intensity: 0.9,
            durationMs: 300,
            delayMs: 0,
            anchor: "word",
            direction: "right",
          },
        }),
        microOverlay("text-emphasis.capsule-highlight"),
        microOverlay("text-mutation.weight-escalation"),
        microOverlay("text-mutation.emphasis-handoff"),
      ],
    });

    const floorScore = meetsQualityFloor(invalid);
    expect(floorScore.passedFloor).toBe(false);
    expect(floorScore.floorFailures).toEqual(
      expect.arrayContaining([
        "micro_entry_collision",
        "micro_emphasis_collision",
        "micro_mutation_collision",
        "micro_animation_visual_chaos",
        "micro_animation_semantic_mismatch",
      ]),
    );
    expect(floorScore.microAnimationQuality.fixIntents).toContain(
      "Use one entry primitive per word or stagger entry ownership before the next readable beat.",
    );

    const judgment = await new JudgmentLayer(new ReplayLedger(":memory:")).judgeCandidates(
      [safe, invalid],
      variationKey(),
      governedPrompt(),
    );

    expect(judgment.selected.jobId).toBe("safe-micro-stack");
    expect(judgment.sequenceObjective.selection.candidatePoolIds).not.toContain("invalid-micro-stack");
    expect(judgment.verdict.failureTags).toContain("micro_entry_collision");
    expect(judgment.verdict.fixIntents).toEqual(
      expect.arrayContaining([
        "Use one entry primitive per word or stagger entry ownership before the next readable beat.",
        "Choose one emphasis mark per target word and remove competing highlight or accent primitives.",
        "Lower primitive concurrency or intensity until the stack has a clear visual hierarchy.",
      ]),
    );
  });
  it("vetoes negative evaluator failures and includes fix intent in the verdict", async () => {
    const safe = validManifest("safe-candidate");
    const overspent = validManifest("overspent-candidate", {
      audio: {
        ...validManifest("overspent-audio").audio,
        energyCurve: [0.94, 0.93, 0.91, 0.9, 0.88, 0.86],
      },
    }) as UnifiedRenderManifest & {
      _sequenceMemory: {
        highEnergy20sWindows: number;
        breatheFrames: number[];
      };
    };
    overspent._sequenceMemory = {
      highEnergy20sWindows: 2,
      breatheFrames: [],
    };

    const judgment = await new JudgmentLayer(new ReplayLedger(":memory:")).judgeCandidates(
      [safe, overspent],
      variationKey(),
      governedPrompt(),
    );

    expect(judgment.selected.jobId).toBe("safe-candidate");
    expect(judgment.sequenceObjective.selection.candidatePoolIds).not.toContain("overspent-candidate");
    expect(judgment.verdict.failureTags).toContain("climax-overspend");
    expect(judgment.verdict.negativeEvaluator?.failures).toContain("climax-overspend");
    expect(judgment.verdict.fixIntents).toContain(
      "Reserve peak energy for the strongest beat or CTA by reducing earlier high-intensity treatments.",
    );
  });

  it("keeps negative evaluator warnings visible without removing candidates from deterministic selection", async () => {
    const warningOnly = validManifest("warning-only", {
      timeline: [
        ...baseTimeline(),
        cut(2400),
        cut(2800),
        text(2100, 2400),
        text(2600, 2900),
        text(5400, 5700),
        text(7000, 7300),
      ],
      audio: {
        ...validManifest("warning-audio").audio,
        sfx: [
          ...baseSfx(),
          sfx("dense-cut-0", "whoosh_fast", 2400),
          sfx("dense-cut-1", "whoosh_fast", 2800),
          sfx("dense-0", "pop_text", 2100),
          sfx("dense-1", "pop_text", 2600),
          sfx("dense-2", "pop_text", 5400),
          sfx("dense-3", "pop_text", 7000),
        ],
      },
    });
    const clean = validManifest("clean-candidate", {seed: 222});

    const left = await new JudgmentLayer(new ReplayLedger(":memory:")).judgeCandidates(
      [warningOnly, clean],
      variationKey(3),
      governedPrompt(),
    );
    const right = await new JudgmentLayer(new ReplayLedger(":memory:")).judgeCandidates(
      [warningOnly, clean],
      variationKey(3),
      governedPrompt(),
    );

    expect(left.selected.jobId).toBe(right.selected.jobId);
    const warningScore = left.scores.find((score) => score.manifest.jobId === "warning-only");
    expect(warningScore?.passedFloor).toBe(true);
    expect(left.rejected.map((candidate) => candidate.jobId)).toContain("warning-only");
    expect(warningScore?.negativeEvaluator.warnings).toContain("visual-density-overload");
    expect(left.verdict.negativeEvaluator?.warnings).toContain("visual-density-overload");
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
      candidateScoreSummary: "{}",
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
      candidateScoreSummary: "{}",
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

  it("keeps a quality-passing upload renderable when replay novelty is exhausted", async () => {
    const repeated = validManifest("repeat-only");
    const leastRepeated = validManifest("least-repeated", {
      timeline: [cut(400), cut(2600), cut(3600), cut(5100), cut(7700), cut(9800), text(3900, 4300)],
      audio: {
        ...validManifest("least-repeated-audio").audio,
        sfx: [sfx("least-0", "whoosh_fast", 400), sfx("least-1", "whoosh_fast", 2600), sfx("least-2", "whoosh_fast", 3600), sfx("least-3", "whoosh_fast", 5100), sfx("least-4", "whoosh_fast", 7700), sfx("least-5", "whoosh_fast", 9800)],
      },
      cameraMoves: [{type: "dutch", startFrame: 30, endFrame: 55}, {type: "push_in", startFrame: 210, endFrame: 235}],
      transitions: [{startFrame: 90, endFrame: 102}],
    });
    const leastRepeatedHash = computeSimilarityHash(leastRepeated);
    const almostExactHash = `${leastRepeatedHash[0] === "a" ? "b" : "a"}${leastRepeatedHash.slice(1)}`;
    const ledger = new ReplayLedger(":memory:");
    ledger.insert({
      id: "prior-repeat-only",
      sourceFingerprint: "source-a",
      promptFingerprint: "prompt-a",
      uploadInstanceId: "prior-upload",
      retryIndex: 0,
      profile: "joseph_aggressive",
      chosenGenome: "{}",
      rejectedGenomes: "[]",
      candidateScoreSummary: "{}",
      similarityHash: computeSimilarityHash(repeated),
      qualityScore: 0.95,
      failureTags: "",
      createdAt: "2026-06-20T00:00:00.000Z",
    });
    ledger.insert({
      id: "prior-least-repeated",
      sourceFingerprint: "source-a",
      promptFingerprint: "prompt-a",
      uploadInstanceId: "prior-upload-2",
      retryIndex: 0,
      profile: "joseph_aggressive",
      chosenGenome: "{}",
      rejectedGenomes: "[]",
      candidateScoreSummary: "{}",
      similarityHash: almostExactHash,
      qualityScore: 0.95,
      failureTags: "",
      createdAt: "2026-06-20T00:01:00.000Z",
    });

    const result = await new JudgmentLayer(ledger).judgeCandidates(
      [repeated, leastRepeated],
      variationKey(),
      governedPrompt(),
    );

    expect(result.selected.jobId).toBe("least-repeated");
    expect(result.verdict.passedFloor).toBe(true);
    expect(result.verdict.failureTags).toEqual(
      expect.arrayContaining(["replay_similarity_veto", "replay_similarity_exhausted"]),
    );
    expect(result.scores.find((score) => score.manifest.jobId === "repeat-only")?.similarityScore).toBe(1);
    expect(result.scores.find((score) => score.manifest.jobId === "least-repeated")?.similarityScore).toBeCloseTo(63 / 64);
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
