import {describe, expect, it} from "vitest";

import {maulAudioTreatmentPlanSchema} from "./index.js";

const sha = (character: string) => character.repeat(64);

const musicAsset = {
  assetId: "music_asset_a",
  assetHash: sha("1"),
  catalogId: "music_catalog",
  catalogVersion: "1",
  catalogHash: sha("2"),
} as const;

const sfxAsset = {
  assetId: "sfx_asset_a",
  assetHash: sha("3"),
  catalogId: "sfx_catalog",
  catalogVersion: "1",
  catalogHash: sha("4"),
} as const;

const audioTreatmentPlan = {
  schemaVersion: "maul-audio-treatment-plan/v1",
  planId: "audio_treatment_a",
  outputDurationMs: 5000,
  parentHashes: [sha("a"), sha("b")],
  catalogs: [
    {
      kind: "music",
      catalogId: "music_catalog",
      version: "1",
      hash: sha("2"),
    },
    {
      kind: "sfx",
      catalogId: "sfx_catalog",
      version: "1",
      hash: sha("4"),
    },
  ],
  music: {
    selected: [
      {
        decisionId: "music_selected_a",
        asset: musicAsset,
        outputStartMs: 0,
        outputEndMs: 5000,
        sourceStartMs: 1200,
        sourceEndMs: 6200,
        gainDb: -12,
        fadeInMs: 180,
        fadeOutMs: 240,
        reason: "The licensed bed supports the full narrative arc.",
      },
    ],
    rejected: [
      {
        decisionId: "music_rejected_a",
        asset: {...musicAsset, assetId: "music_asset_b", assetHash: sha("5")},
        reason: "The rejected bed masks speech.",
      },
    ],
    omissions: [],
  },
  sfx: {
    selected: [
      {
        eventId: "sfx_selected_a",
        lifecycleRole: "entry",
        timingRelation: "on_visual",
        outputMs: 900,
        visualEventId: "animation_segment_a",
        asset: sfxAsset,
        gainDb: -10,
        reason: "One restrained entry accent supports the reveal.",
      },
    ],
    rejected: [
      {
        eventId: "sfx_rejected_a",
        lifecycleRole: "entry",
        timingRelation: "on_visual",
        outputMs: 900,
        visualEventId: "animation_segment_a",
        asset: {...sfxAsset, assetId: "sfx_asset_b", assetHash: sha("6")},
        reason: "A second impact would duplicate the cue function.",
      },
    ],
    omissions: [
      {
        eventId: "sfx_omitted_a",
        lifecycleRole: "motion_follow",
        timingRelation: "after_visual",
        outputMs: 1600,
        visualEventId: "animation_segment_a",
        reason: "Continuous text needs silence rather than repeated clicks.",
      },
    ],
  },
  ducking: {
    enabled: true,
    sidechain: "dialogue",
    target: "music_and_sfx",
    attenuationDb: -8,
    attackMs: 80,
    releaseMs: 240,
    regions: [
      {outputStartMs: 0, outputEndMs: 2200},
      {outputStartMs: 2500, outputEndMs: 5000},
    ],
  },
  mastering: {
    targetIntegratedLufs: -14,
    maximumTruePeakDbtp: -1,
    maximumLoudnessRangeLu: 12,
    sampleRateHz: 48000,
    channels: 2,
  },
  userLocks: [
    {
      lockId: "lock_music_a",
      targetType: "music_decision",
      targetId: "music_selected_a",
      lockedBy: "user_alpha",
      lockedAt: "2026-08-03T00:00:00.000Z",
      reason: "Keep the approved soundtrack on replan.",
    },
    {
      lockId: "lock_mastering_a",
      targetType: "mastering",
      targetId: null,
      lockedBy: "user_alpha",
      lockedAt: "2026-08-03T00:00:00.000Z",
      reason: "Preserve delivery loudness targets.",
    },
  ],
  plannerProvenance: {
    plannerId: "maul-audio-treatment-planner",
    plannerVersion: "1.0.0",
    authority: "deterministic",
    configuredModel: null,
    inferenceReceipt: null,
    inputHash: sha("c"),
    createdAt: "2026-08-03T00:00:00.000Z",
  },
} as const;

const clone = <Value>(value: Value): Value => structuredClone(value);

describe("MAUL standalone audio treatment contract", () => {
  it("accepts selected and rejected assets, omissions, mix policy, locks, provenance, and parent hashes", () => {
    const parsed = maulAudioTreatmentPlanSchema.parse(audioTreatmentPlan);

    expect(parsed.music.selected[0]?.asset.assetId).toBe("music_asset_a");
    expect(parsed.music.rejected).toHaveLength(1);
    expect(parsed.sfx.omissions[0]?.eventId).toBe("sfx_omitted_a");
    expect(parsed.parentHashes).toEqual([sha("a"), sha("b")]);
  });

  it("requires an explicit music omission when no track is selected", () => {
    const invalid = clone(audioTreatmentPlan);
    invalid.music.selected = [];

    expect(() => maulAudioTreatmentPlanSchema.parse(invalid)).toThrow(
      /music.*selection.*omission|omission.*music.*selection/i,
    );
  });

  it("rejects an explicit music omission when a track is selected", () => {
    const invalid = clone(audioTreatmentPlan) as any;
    invalid.music.omissions = [
      {
        decisionId: "music_omitted_a",
        reason: "No bed should be present.",
      },
    ];

    expect(() => maulAudioTreatmentPlanSchema.parse(invalid)).toThrow(
      /music.*selection.*omission|omission.*music.*selection/i,
    );
  });

  it("keeps selected, rejected, and omitted SFX event IDs disjoint", () => {
    const invalid = clone(audioTreatmentPlan);
    invalid.sfx.rejected[0].eventId = "sfx_selected_a";

    expect(() => maulAudioTreatmentPlanSchema.parse(invalid)).toThrow(
      /SFX event IDs.*decision.*once|once.*SFX event IDs/i,
    );
  });

  it("requires an explicit SFX omission when no event is selected", () => {
    const invalid = clone(audioTreatmentPlan);
    invalid.sfx.selected = [];
    invalid.sfx.omissions = [];

    expect(() => maulAudioTreatmentPlanSchema.parse(invalid)).toThrow(
      /SFX.*selection.*omission|omission.*SFX.*selection/i,
    );
  });

  it("rejects asset references outside the declared catalog version and hash", () => {
    const invalid = clone(audioTreatmentPlan);
    invalid.sfx.selected[0].asset.catalogHash = sha("9");

    expect(() => maulAudioTreatmentPlanSchema.parse(invalid)).toThrow(
      /catalog reference.*declared catalog|declared catalog.*reference/i,
    );
  });

  it("rejects duplicate catalog identities with conflicting hashes", () => {
    const invalid = clone(audioTreatmentPlan) as any;
    invalid.catalogs.push({...invalid.catalogs[0], hash: sha("9")});

    expect(() => maulAudioTreatmentPlanSchema.parse(invalid)).toThrow(
      /catalog identit.*unique|unique.*catalog identit/i,
    );
  });

  it("requires consistent hashes for each versioned asset identity", () => {
    const invalid = clone(audioTreatmentPlan) as any;
    invalid.music.selected.push({
      ...invalid.music.selected[0],
      decisionId: "music_selected_b",
      asset: {...invalid.music.selected[0].asset, assetHash: sha("9")},
    });

    expect(() => maulAudioTreatmentPlanSchema.parse(invalid)).toThrow(
      /asset identit.*consistent.*hash|hash.*consistent.*asset identit/i,
    );
  });

  it("distinguishes the same local asset ID across versioned catalogs", () => {
    const valid = clone(audioTreatmentPlan) as any;
    valid.catalogs.push({
      kind: "music",
      catalogId: "music_catalog_archive",
      version: "1",
      hash: sha("7"),
    });
    valid.music.rejected[0].asset = {
      assetId: "music_asset_a",
      assetHash: sha("5"),
      catalogId: "music_catalog_archive",
      catalogVersion: "1",
      catalogHash: sha("7"),
    };

    expect(() => maulAudioTreatmentPlanSchema.parse(valid)).not.toThrow();
  });

  it("rejects locks that do not resolve to a governed decision", () => {
    const invalid = clone(audioTreatmentPlan);
    invalid.userLocks[0].targetId = "missing_decision";

    expect(() => maulAudioTreatmentPlanSchema.parse(invalid)).toThrow(
      /lock.*known.*decision|decision.*known.*lock/i,
    );
  });

  it("requires a resolved lock when planner authority is user-locked", () => {
    const invalid = clone(audioTreatmentPlan);
    invalid.plannerProvenance.authority = "user_locked";
    invalid.userLocks = [];

    expect(() => maulAudioTreatmentPlanSchema.parse(invalid)).toThrow(
      /user-locked.*requires.*user lock|user lock.*requires.*user-locked/i,
    );
  });

  it("rejects overlapping or out-of-range ducking regions", () => {
    const overlap = clone(audioTreatmentPlan);
    overlap.ducking.regions[1].outputStartMs = 2100;
    expect(() => maulAudioTreatmentPlanSchema.parse(overlap)).toThrow(
      /ducking regions.*non-overlapping/i,
    );

    const outside = clone(audioTreatmentPlan);
    outside.ducking.regions[1].outputEndMs = 5001;
    expect(() => maulAudioTreatmentPlanSchema.parse(outside)).toThrow(
      /ducking region.*output duration/i,
    );
  });

  it("requires non-empty unique parent hashes", () => {
    const invalid = clone(audioTreatmentPlan);
    invalid.parentHashes = [sha("a"), sha("a")];

    expect(() => maulAudioTreatmentPlanSchema.parse(invalid)).toThrow(
      /parent hashes.*unique/i,
    );
  });

  it("requires truthful planner-model provenance", () => {
    const invalid = clone(audioTreatmentPlan);
    invalid.plannerProvenance.configuredModel = "gpt-audio";

    expect(() => maulAudioTreatmentPlanSchema.parse(invalid)).toThrow(
      /deterministic.*model|model.*deterministic/i,
    );
  });
});
