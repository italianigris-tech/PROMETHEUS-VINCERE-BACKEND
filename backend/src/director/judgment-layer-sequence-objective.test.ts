import {describe, expect, it} from "vitest";
import type {CutEvent, SFXEvent, TextEvent, TimelineEvent, UnifiedRenderManifest} from "@prometheus/shared-types";
import {ReplayLedger} from "../ledger/replay-ledger";
import {JudgmentLayer} from "./judgment-layer";
import type {VariationKey} from "./variation-key";
import type {GovernedPrompt} from "./prompt-governance";

type ManifestWithPlannerFields = UnifiedRenderManifest & {
  _doctrineBranch?: string;
  _sequenceMemory?: {
    finalState?: string;
    breatheFrames?: number[];
    blockedEffectFrames?: number;
  };
};

const cut = (atMs: number, style: CutEvent["style"] = "hard"): CutEvent => ({
  type: "cut",
  atMs,
  toMs: atMs,
  style,
  intensity: 1,
});

const text = (startMs: number, endMs: number, style: TextEvent["style"] = "slide_up"): TextEvent => ({
  type: "text",
  word: `WORD-${startMs}`,
  startMs,
  endMs,
  style,
  color: style === "glitch" || style === "pop" ? "#FF0040" : "#FFFFFF",
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

const variationKeyForRetry = (retryIndex: number): VariationKey => ({
  key: `key-${retryIndex}`,
  sourceFingerprint: "source-sequence-objective",
  promptFingerprint: "prompt-sequence-objective",
  uploadInstanceId: "upload-sequence-objective",
  retryIndex,
  source_fingerprint: "source-sequence-objective",
  prompt_fingerprint: "prompt-sequence-objective",
  upload_instance_id: "upload-sequence-objective",
  retry_index: retryIndex,
});

const variationKey = (): VariationKey => variationKeyForRetry(5);

const governedPrompt = (): GovernedPrompt => ({
  id: "prompt-1",
  version: 1,
  text: "rank by sequence objective",
  fingerprint: "prompt-sequence-objective",
  doctrine: {tone: "aggressive"},
  infrastructureFlags: {
    mayOverrideDeterminism: false,
    mayOverrideVariationKey: false,
    mayOverrideRenderPipeline: false,
  },
  createdAt: "2026-06-20T00:00:00.000Z",
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

const manifest = (
  jobId: string,
  doctrineBranch: string,
  overrides: Partial<ManifestWithPlannerFields> = {},
): ManifestWithPlannerFields => ({
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
  _doctrineBranch: doctrineBranch,
  ...overrides,
});

describe("Judgment Layer Sequence Objective ranking", () => {
  it("selects the highest live Sequence Objective candidate and exposes the ranking", async () => {
    const noisyKinetic = manifest("noisy-kinetic", "kinetic-pulse", {
      cameraMoves: [
        {type: "shake", startFrame: 90, endFrame: 110},
        {type: "shake", startFrame: 130, endFrame: 150},
        {type: "shake", startFrame: 170, endFrame: 190},
      ],
      timeline: [
        cut(500),
        cut(1500, "zoom_blur"),
        cut(2500, "zoom_blur"),
        cut(3500, "zoom_blur"),
        cut(4500, "zoom_blur"),
        cut(5500),
        cut(8500),
        cut(9500),
        text(3200, 3500, "pop"),
      ],
      audio: {
        ...manifest("noisy-audio", "kinetic-pulse").audio,
        energyCurve: [0.91, 0.92, 0.93, 0.94, 0.88, 0.87],
        sfx: [
          sfx("cut-0", "whoosh_fast", 500),
          sfx("cut-5", "whoosh_fast", 5500),
          sfx("cut-6", "whoosh_fast", 8500),
          sfx("cut-7", "whoosh_fast", 9500),
          sfx("text-0", "pop_text", 3200),
        ],
      },
      _sequenceMemory: {
        finalState: "loud",
        breatheFrames: [],
        blockedEffectFrames: 2,
      },
    });
    const restrained = manifest("restrained", "restrained-cinematic", {
      creativeProfile: {name: "joseph_cinematic", cutDensity: 0.6, textDensity: 0.45, sfxDensity: 0.5, cameraAggression: 0.45, colorIntensity: 0.5},
      _sequenceMemory: {
        finalState: "cooldown",
        breatheFrames: [60, 140],
        blockedEffectFrames: 0,
      },
    });

    const result = await new JudgmentLayer(new ReplayLedger(":memory:")).judgeCandidates(
      [noisyKinetic, restrained],
      variationKey(),
      governedPrompt(),
    );

    expect(result.selected.jobId).toBe("restrained");
    expect(result.sequenceObjective).toMatchObject({
      version: "joseph-sequence-objective-v1",
      selectedCandidateId: "restrained",
      selectedDoctrineBranchId: "restrained-cinematic",
    });
    expect(result.sequenceObjective.candidates[0]).toMatchObject({
      candidateId: "restrained",
      selected: true,
    });
  });
  it("uses the variation key for deterministic QD/surprise selection after judgment vetoes", async () => {
    const kinetic = manifest("kinetic", "kinetic-pulse", {
      creativeProfile: {name: "joseph_aggressive", cutDensity: 1, textDensity: 0.8, sfxDensity: 1, cameraAggression: 0.9, colorIntensity: 0.8},
    });
    const spotlight = manifest("spotlight", "spotlight-swap", {
      creativeProfile: {name: "joseph_cinematic", cutDensity: 0.45, textDensity: 0.35, sfxDensity: 0.5, cameraAggression: 0.6, colorIntensity: 0.7},
      cameraMoves: [{type: "dutch", startFrame: 120, endFrame: 150}],
    });
    const vetoed = manifest("vetoed", "kinetic-pulse", {
      timeline: [cut(500)],
    });

    const judgment = new JudgmentLayer(new ReplayLedger(":memory:"));
    const retryZero = await judgment.judgeCandidates([kinetic, spotlight, vetoed], variationKeyForRetry(0), governedPrompt());
    const retryOne = await judgment.judgeCandidates([kinetic, spotlight, vetoed], variationKeyForRetry(1), governedPrompt());
    const retryOneAgain = await judgment.judgeCandidates([kinetic, spotlight, vetoed], variationKeyForRetry(1), governedPrompt());

    expect(retryOne.sequenceObjective.selection.mode).toBe("variation-key-qd-surprise");
    expect(retryOne.selected.jobId).toBe(retryOne.sequenceObjective.selection.candidatePoolIds[1]);
    expect(retryOneAgain.selected.jobId).toBe(retryOne.selected.jobId);
    expect(retryZero.selected.jobId).not.toBe(retryOne.selected.jobId);
    expect(retryOne.sequenceObjective.selection.candidatePoolIds).not.toContain("vetoed");
    expect(retryOne.rejected.map((candidate) => candidate.jobId)).toContain("vetoed");
  });
});
