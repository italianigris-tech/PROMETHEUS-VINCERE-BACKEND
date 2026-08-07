import {describe, expect, it} from "vitest";

import {buildMaulVisualTrack} from "./visual-track.js";

const asset = (overrides: Record<string, unknown> = {}) => ({
  assetId: "asset_source",
  projectId: "project_a",
  rootSourceAssetId: "asset_source",
  mediaKind: "video",
  storagePath: "uploads/source.mp4",
  sha256: "a".repeat(64),
  width: 1920,
  height: 1080,
  durationMs: 20_000,
  rights: {verified: true, receiptId: "receipt_source"},
  provenance: {kind: "source", provenanceReceiptId: null},
  permittedRoles: ["speaker_hero", "quiet_hold", "split_proof"],
  ...overrides,
});

const input = (assets: any[]) => ({
  projectId: "project_a",
  rootSourceAssetId: "asset_source",
  sourceAssetId: "asset_source",
  outputDurationMs: 10_000,
  beats: [
    {beatId: "beat_1", outputStartMs: 0, outputEndMs: 3_000, sourceStartMs: 0, sourceEndMs: 3_000, role: "hook", spokenIdea: "Open"},
    {beatId: "beat_2", outputStartMs: 3_000, outputEndMs: 7_000, sourceStartMs: 3_000, sourceEndMs: 7_000, role: "proof", spokenIdea: "Show proof", visualMode: "b_roll"},
    {beatId: "beat_3", outputStartMs: 7_000, outputEndMs: 10_000, sourceStartMs: 7_000, sourceEndMs: 10_000, role: "payoff", spokenIdea: "Close", visualMode: "evidence_image"},
  ] as const,
  assets,
  treatment: {maxInsertsPerMinute: 12},
});

describe("MAUL governed visual track selector", () => {
  it("selects approved B-roll and evidence while preserving source fallback", () => {
    const result = buildMaulVisualTrack(input([asset(),
      asset({assetId: "b_roll", storagePath: "approved/b-roll.mp4", sha256: "b".repeat(64), width: 1080, height: 1920, provenance: {kind: "licensed", provenanceReceiptId: "receipt_broll"}, permittedRoles: ["b_roll"]}),
      asset({assetId: "evidence", mediaKind: "image", storagePath: "approved/proof.png", sha256: "c".repeat(64), width: 1600, height: 900, durationMs: null, provenance: {kind: "licensed", provenanceReceiptId: "receipt_evidence"}, permittedRoles: ["evidence_image", "split_proof"]}),
    ]));

    expect(result.intervals.map((interval) => interval.mode)).toEqual(["speaker_hero", "b_roll", "evidence_image"]);
    expect(result.intervals[1]).toMatchObject({assetId: "b_roll", purpose: "Show proof"});
  });

  it("carries canonical-source timing through source-backed intervals", () => {
    const result = buildMaulVisualTrack({
      ...input([asset()]),
      beats: [
        {
          beatId: "hook",
          outputStartMs: 0,
          outputEndMs: 3_000,
          sourceStartMs: 10_000,
          sourceEndMs: 13_000,
          role: "hook",
          spokenIdea: "Open",
        },
        {
          beatId: "hold",
          outputStartMs: 3_000,
          outputEndMs: 10_000,
          sourceStartMs: 13_000,
          sourceEndMs: 20_000,
          role: "payoff",
          spokenIdea: "Close",
          protectedPause: true,
        },
      ],
    });

    expect(result.intervals).toMatchObject([
      {mode: "speaker_hero", sourceStartMs: 10_000, sourceEndMs: 13_000},
      {mode: "quiet_hold", sourceStartMs: 13_000, sourceEndMs: 20_000},
    ]);
  });

  it("falls back to speaker-only when no approved asset can clarify a beat", () => {
    const result = buildMaulVisualTrack(input([asset()]));
    expect(result.intervals.every((interval) => interval.mode === "speaker_hero")).toBe(true);
  });

  it("permits one governed insert in a short output window", () => {
    const result = buildMaulVisualTrack({
      ...input([
        asset(),
        asset({assetId: "b_roll", storagePath: "approved/b-roll.mp4", sha256: "b".repeat(64), width: 1080, height: 1920, provenance: {kind: "licensed", provenanceReceiptId: "receipt_broll"}, permittedRoles: ["b_roll"]}),
      ]),
      outputDurationMs: 3_000,
      beats: [{beatId: "proof", outputStartMs: 0, outputEndMs: 3_000, role: "proof", spokenIdea: "Show proof", visualMode: "b_roll"}],
      treatment: {maxInsertsPerMinute: 8},
    });
    expect(result.intervals[0]?.mode).toBe("b_roll");
  });

  it("rejects unverified rights, reference media, incompatible roles, and unsafe crops", () => {
    expect(() => buildMaulVisualTrack(input([
      asset(),
      asset({assetId: "bad", rights: {verified: false, receiptId: null}, permittedRoles: ["b_roll"], provenance: {kind: "licensed", provenanceReceiptId: "bad_receipt"}}),
    ]))).toThrow(/rights/i);
    expect(() => buildMaulVisualTrack(input([
      asset(),
      asset({assetId: "reference", provenance: {kind: "reference_corpus", provenanceReceiptId: "reference_1"}, permittedRoles: ["b_roll"]}),
    ]))).toThrow(/reference/i);
    expect(() => buildMaulVisualTrack({...input([
      asset(),
      asset({assetId: "image", mediaKind: "image", durationMs: null, permittedRoles: ["b_roll"], provenance: {kind: "licensed", provenanceReceiptId: "receipt_image"}}),
    ]), beats: input([asset()]).beats.map((beat, index) => index === 1 ? {...beat, visualMode: "b_roll"} : beat)})).toThrow(/media|role/i);
    expect(() => buildMaulVisualTrack({...input([asset()]), crop: {x: 0, y: 0, width: 1.2, height: 1}} as any)).toThrow(/crop|bounds/i);
  });
});
