import {describe, expect, it} from "vitest";

import {adaptMaulAudioTreatmentToSoundDesignManifest} from "./audio-treatment-manifest-adapter.js";

describe("MAUL audio-treatment manifest adapter", () => {
  it("preserves governed trims, fades, gains, dialogue mapping, and SFX onset", () => {
    const result = adaptMaulAudioTreatmentToSoundDesignManifest({
      treatment: {
        schemaVersion: "maul-audio-treatment-plan/v1",
        planId: "audio_plan_1",
        outputDurationMs: 8_000,
        parentHashes: ["a".repeat(64)],
        catalogs: [
          {kind: "music", catalogId: "music", version: "v1", hash: "b".repeat(64)},
          {kind: "sfx", catalogId: "sfx", version: "v1", hash: "c".repeat(64)},
        ],
        music: {selected: [{decisionId: "music_1", asset: {assetId: "bed", assetHash: "d".repeat(64), catalogId: "music", catalogVersion: "v1", catalogHash: "b".repeat(64)}, outputStartMs: 0, outputEndMs: 8_000, sourceStartMs: 1_000, sourceEndMs: 9_000, gainDb: -19, fadeInMs: 240, fadeOutMs: 600, reason: "bed"}], rejected: [], omissions: []},
        sfx: {selected: [{eventId: "cue_1", visualEventId: "text_1", lifecycleRole: "entry", timingRelation: "on_visual", outputMs: 2_000, asset: {assetId: "click", assetHash: "e".repeat(64), catalogId: "sfx", catalogVersion: "v1", catalogHash: "c".repeat(64)}, gainDb: -12, reason: "punctuate"}], rejected: [], omissions: []},
        ducking: {enabled: true, sidechain: "dialogue", target: "music_and_sfx", attenuationDb: -12, attackMs: 30, releaseMs: 240, regions: [{outputStartMs: 0, outputEndMs: 8_000}]},
        mastering: {targetIntegratedLufs: -16, maximumTruePeakDbtp: -1.5, maximumLoudnessRangeLu: 11, sampleRateHz: 48_000, channels: 2},
        userLocks: [],
        plannerProvenance: {plannerId: "planner", plannerVersion: "v1", authority: "deterministic", configuredModel: null, inferenceReceipt: null, inputHash: "f".repeat(64), createdAt: "2026-08-03T00:00:00.000Z"},
      },
      dialogueSource: "/source.mp4",
      dialogueSpans: [{outputStartMs: 0, outputEndMs: 2_000}, {outputStartMs: 3_000, outputEndMs: 8_000}],
      musicAssets: {bed: {path: "/bed.wav", sha256: "d".repeat(64), releaseEligible: true}},
      sfxAssets: {click: {path: "/click.wav", sha256: "e".repeat(64), durationMs: 420, releaseEligible: true}},
    });

    expect(result.manifest.musicCues).toMatchObject([{id: "music_1", file: "/bed.wav", start: 0, end: 8, sourceStart: 1, sourceEnd: 9, gainDb: -19}]);
    expect(result.manifest.musicCues[0]?.transitionIn).toMatchObject({start: 0, duration: 0.24});
    expect(result.manifest.musicCues[0]?.transitionOut).toMatchObject({start: 7.4, duration: 0.6});
    expect(result.manifest.sfx).toMatchObject([{id: "cue_1", file: "/click.wav", start: 2, end: 2.42, sourceStart: 0, sourceEnd: 0.42, gainDb: -12}]);
    expect(result.manifest.dialogue).toEqual([{start: 0, end: 2, gainDb: 0, label: "editorial_timeline:0"}, {start: 3, end: 8, gainDb: 0, label: "editorial_timeline:1"}]);
    expect(result.replayKey).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed when a selected catalog asset is missing, stale, or preview-only", () => {
    const input = {treatment: {schemaVersion: "maul-audio-treatment-plan/v1", planId: "audio_plan_1", outputDurationMs: 1_000, parentHashes: ["a".repeat(64)], catalogs: [{kind: "sfx", catalogId: "sfx", version: "v1", hash: "b".repeat(64)}], music: {selected: [], rejected: [], omissions: [{decisionId: "music_none", reason: "none"}]}, sfx: {selected: [{eventId: "cue_1", visualEventId: "text_1", lifecycleRole: "entry", timingRelation: "on_visual", outputMs: 0, asset: {assetId: "click", assetHash: "c".repeat(64), catalogId: "sfx", catalogVersion: "v1", catalogHash: "b".repeat(64)}, gainDb: -12, reason: "punctuate"}], rejected: [], omissions: []}, ducking: {enabled: false, sidechain: "dialogue", target: "music", attenuationDb: -12, attackMs: 30, releaseMs: 240, regions: []}, mastering: {targetIntegratedLufs: -16, maximumTruePeakDbtp: -1.5, maximumLoudnessRangeLu: 11, sampleRateHz: 48_000, channels: 2}, userLocks: [], plannerProvenance: {plannerId: "planner", plannerVersion: "v1", authority: "deterministic", configuredModel: null, inferenceReceipt: null, inputHash: "d".repeat(64), createdAt: "2026-08-03T00:00:00.000Z"}}, dialogueSpans: [], sfxAssets: {click: {path: "/click.wav", sha256: "x".repeat(64), durationMs: 420, releaseEligible: false}}} as const;
    expect(() => adaptMaulAudioTreatmentToSoundDesignManifest(input as any)).toThrow(/hash mismatch|release eligible/i);
  });
});
