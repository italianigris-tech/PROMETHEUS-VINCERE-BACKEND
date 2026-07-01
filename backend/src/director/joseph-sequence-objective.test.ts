import {describe, expect, it} from "vitest";
import type {CutEvent, SFXEvent, TextEvent, TimelineEvent, UnifiedRenderManifest} from "@prometheus/shared-types";
import type {CandidateScore} from "./judgment-layer";
import {rankJosephSequenceObjective} from "./joseph-sequence-objective";
import type {VariationKey} from "./variation-key";

type CandidateManifest = UnifiedRenderManifest & {
  _doctrineBranch?: string;
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

const baseManifest = (
  jobId: string,
  doctrineBranch: string,
  overrides: Partial<CandidateManifest> = {},
): CandidateManifest => ({
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
    sfx: [
      sfx("cut-0", "whoosh_fast", 500),
      sfx("cut-2", "whoosh_fast", 4200),
      sfx("cut-3", "whoosh_fast", 6200),
      sfx("cut-4", "whoosh_fast", 8200),
      sfx("cut-5", "whoosh_fast", 9500),
    ],
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

const scoreFor = (
  manifest: CandidateManifest,
  qualityScore: number,
  sequencePenalty: number,
  metricOverrides: Partial<CandidateScore["sequenceDiscipline"]["metrics"]> = {},
): CandidateScore => ({
  manifest,
  qualityScore,
  similarityScore: 0,
  passedFloor: true,
  floorFailures: [],
  sequenceDiscipline: {
    enabled: true,
    penalty: sequencePenalty,
    violations: sequencePenalty > 0 ? [{
      ruleId: "avoid-repeating-motion-signature",
      message: "Repeated motion should be ranked below a cleaner candidate.",
      severity: "high",
      blocking: false,
      penalty: sequencePenalty,
    }] : [],
    metrics: {
      maxTypographyRun: 1,
      maxMotionRun: 1,
      highEnergyRun: 1,
      repeatedCutCadenceRun: 1,
      breatheFrameCount: 4,
      blockedEffectFrames: 0,
      finalSequenceState: "cooldown",
      ...metricOverrides,
    },
  },
});

const variationKey = (retryIndex: number): VariationKey => ({
  key: `source:prompt:upload:${retryIndex}`,
  sourceFingerprint: "source-sequence-objective",
  promptFingerprint: "prompt-sequence-objective",
  uploadInstanceId: "upload-sequence-objective",
  retryIndex,
  source_fingerprint: "source-sequence-objective",
  prompt_fingerprint: "prompt-sequence-objective",
  upload_instance_id: "upload-sequence-objective",
  retry_index: retryIndex,
});
describe("Joseph Sequence Objective", () => {
  it("ranks live candidate genomes by sequence objective instead of seed-only choice", () => {
    const noisyKinetic = scoreFor(
      baseManifest("kinetic", "kinetic-pulse", {
        cameraMoves: [
          {type: "shake", startFrame: 90, endFrame: 110},
          {type: "shake", startFrame: 130, endFrame: 150},
          {type: "shake", startFrame: 170, endFrame: 190},
        ],
      }),
      0.96,
      0.36,
      {
        maxTypographyRun: 4,
        maxMotionRun: 4,
        highEnergyRun: 5,
        repeatedCutCadenceRun: 4,
        breatheFrameCount: 0,
        blockedEffectFrames: 2,
      },
    );
    const cleanerRestrained = scoreFor(
      baseManifest("restrained", "restrained-cinematic", {
        creativeProfile: {name: "joseph_cinematic", cutDensity: 0.6, textDensity: 0.45, sfxDensity: 0.5, cameraAggression: 0.45, colorIntensity: 0.5},
      }),
      0.9,
      0,
    );

    const ranking = rankJosephSequenceObjective({
      scores: [noisyKinetic, cleanerRestrained],
    });

    expect(ranking.selectedCandidateId).toBe("restrained");
    expect(ranking.candidates[0]).toMatchObject({
      candidateId: "restrained",
      doctrineBranchId: "restrained-cinematic",
      selected: true,
    });
    expect(ranking.candidates[0]?.scoreBreakdown.sequenceConsequence).toBeGreaterThan(
      ranking.candidates[1]?.scoreBreakdown.sequenceConsequence ?? 1,
    );
    expect(ranking.candidates[0]?.reasons.join(" ")).toContain("Sequence Objective");
  });

  it("builds backend diversity cells that preserve the strongest candidate per behavior cell", () => {
    const kineticWeak = scoreFor(baseManifest("kinetic-weak", "kinetic-pulse"), 0.78, 0.12);
    const kineticStrong = scoreFor(baseManifest("kinetic-strong", "kinetic-pulse"), 0.92, 0.02);
    const spotlight = scoreFor(
      baseManifest("spotlight", "spotlight-swap", {
        creativeProfile: {name: "joseph_cinematic", cutDensity: 0.6, textDensity: 0.45, sfxDensity: 0.5, cameraAggression: 0.6, colorIntensity: 0.7},
        cameraMoves: [{type: "dutch", startFrame: 120, endFrame: 150}],
      }),
      0.86,
      0.03,
    );

    const ranking = rankJosephSequenceObjective({
      scores: [kineticWeak, kineticStrong, spotlight],
    });

    expect(new Set(ranking.archiveEntries.map((entry) => entry.archiveCell.key)).size).toBe(
      ranking.archiveEntries.length,
    );
    expect(ranking.archiveEntries.map((entry) => entry.candidateId)).toContain("kinetic-strong");
    expect(ranking.archiveEntries.map((entry) => entry.candidateId)).not.toContain("kinetic-weak");
    expect(
      ranking.candidates.find((candidate) => candidate.candidateId === "kinetic-strong")
        ?.scoreBreakdown.qdDiversityPressure,
    ).toBeGreaterThan(0);
  });
  it("uses the variation key to choose deterministic QD/surprise alternatives instead of always argmax", () => {
    const kinetic = scoreFor(baseManifest("kinetic", "kinetic-pulse"), 0.93, 0.02);
    const spotlight = scoreFor(
      baseManifest("spotlight", "spotlight-swap", {
        creativeProfile: {name: "joseph_cinematic", cutDensity: 0.45, textDensity: 0.35, sfxDensity: 0.5, cameraAggression: 0.6, colorIntensity: 0.7},
        cameraMoves: [{type: "dutch", startFrame: 120, endFrame: 150}],
      }),
      0.92,
      0.02,
    );

    const argmax = rankJosephSequenceObjective({scores: [kinetic, spotlight]});
    const retryZero = rankJosephSequenceObjective({scores: [kinetic, spotlight], variationKey: variationKey(0)});
    const retryOne = rankJosephSequenceObjective({scores: [kinetic, spotlight], variationKey: variationKey(1)});
    const retryOneAgain = rankJosephSequenceObjective({scores: [kinetic, spotlight], variationKey: variationKey(1)});

    expect(argmax.selection.mode).toBe("objective-argmax");
    expect(retryOne.selection.mode).toBe("variation-key-qd-surprise");
    expect(retryOne.selection.candidatePoolIds).toEqual(
      expect.arrayContaining([argmax.candidates[0]?.candidateId, argmax.candidates[1]?.candidateId]),
    );
    expect(retryOne.selectedCandidateId).toBe(retryOne.selection.candidatePoolIds[1]);
    expect(retryOne.selectedCandidateId).not.toBe(argmax.candidates[0]?.candidateId);
    expect(retryOneAgain.selectedCandidateId).toBe(retryOne.selectedCandidateId);
    expect(retryZero.selectedCandidateId).not.toBe(retryOne.selectedCandidateId);
  });
});
