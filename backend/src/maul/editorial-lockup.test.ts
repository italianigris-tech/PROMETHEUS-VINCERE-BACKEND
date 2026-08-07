import {describe, expect, it} from "vitest";

import {
  applyMaulEditorialLockups,
  buildMaulEditorialFontPair,
  buildMaulEditorialLockup,
} from "./editorial-lockup.js";

const primaryFont = {
  assetId: "font_primary",
  family: "Sora",
  weight: 700,
  style: "normal" as const,
};

const accentFont = {
  assetId: "font_script_live",
  family: "Brittany Signature",
  weight: 400,
  style: "italic" as const,
};

describe("MAUL editorial lockup planner", () => {
  it("plans a measured script/display hinge with sanctioned overlap and locked word order", () => {
    const lockup = buildMaulEditorialLockup({
      segment: {
        segmentId: "segment_hero",
        tokenIds: ["token_build", "token_your", "token_legacy"],
        outputStartMs: 1000,
        outputEndMs: 2600,
        semanticRole: "hero",
        emphasisLevel: "hero",
        holdAcrossProtectedPause: false,
      },
      primaryFont,
      accentFont,
      selectionSeed: "seed_a",
      referenceTraits: ["phrase hierarchy", "editorial serif hinge", "semantic hinge emphasis"],
    });

    expect(lockup).toMatchObject({
      mode: "script_tag_overlap",
      overlap: {enabled: true, direction: "accent_over_primary"},
      choreography: {
        mode: "position_locked_word_reveal",
        tokenOrder: ["token_build", "token_your", "token_legacy"],
      },
    });
    expect(lockup.accentTokenIds).toEqual(["token_legacy"]);
    expect(lockup.tokenStyles.find((style) => style.tokenId === "token_legacy")).toMatchObject({
      fontAssetId: "font_script_live",
      fontFamily: "Brittany Signature",
      fontStyle: "italic",
      fontSizeScale: expect.any(Number),
      offsetYPx: expect.any(Number),
      zIndex: 2,
    });
    const accentStyle = lockup.tokenStyles.find((style) => style.tokenId === "token_legacy")!;
    const primaryStyle = lockup.tokenStyles.find((style) => style.tokenId === "token_build")!;
    expect(accentStyle.fontSizeScale).toBeGreaterThan(1);
    expect(accentStyle.fontSizeScale).toBeLessThanOrEqual(1.18);
    expect(accentStyle.fontSizeScale).toBeGreaterThan(primaryStyle.fontSizeScale);
    expect(primaryStyle.fontSizeScale).toBe(1);
    expect(accentStyle.rotationDeg).toBe(0);
    expect(lockup.overlap.ratio).toBeLessThanOrEqual(0.14);
    expect(lockup.choreography.localRevealEnvelope?.annotationPaddingPx)
      .toBeGreaterThanOrEqual(8);
  });

  it("keeps a missing accent receipt from creating an unreceipted lockup layer", () => {
    const pair = buildMaulEditorialFontPair({
      fontResolution: {
        selectedAssetId: primaryFont.assetId,
        selectedFamily: primaryFont.family,
        accentAsset: null,
      },
      fallbackPrimary: primaryFont,
    });

    expect(pair.primary).toEqual(primaryFont);
    expect(pair.accent).toBeNull();
  });

  it("uses the semantic emphasis token as the accent hinge instead of the last word", () => {
    const lockup = buildMaulEditorialLockup({
      segment: {
        segmentId: "segment_semantic_hinge",
        tokenIds: ["token_build", "token_your", "token_legacy"],
        emphasisTokenIds: ["token_your"],
        outputStartMs: 1000,
        outputEndMs: 2600,
        semanticRole: "hero",
        emphasisLevel: "hero",
        holdAcrossProtectedPause: false,
      },
      primaryFont,
      accentFont,
      selectionSeed: "seed_semantic",
      referenceTraits: ["semantic hinge emphasis", "editorial serif hinge"],
    });

    expect(lockup.accentTokenIds).toEqual(["token_your"]);
    expect(lockup.primaryTokenIds).toEqual(["token_build", "token_legacy"]);
  });

  it("uses explicit semantic hierarchy roles ahead of emphasis ordering", () => {
    const lockup = buildMaulEditorialLockup({
      segment: {
        segmentId: "segment_explicit_hierarchy",
        tokenIds: ["token_move", "token_now", "token_gently"],
        emphasisTokenIds: ["token_gently"],
        semanticHierarchyRoles: {
          token_move: "support",
          token_now: "hero",
          token_gently: "tail",
        },
        outputStartMs: 1000,
        outputEndMs: 2600,
        semanticRole: "hero",
        emphasisLevel: "hero",
        holdAcrossProtectedPause: false,
      },
      primaryFont,
      accentFont,
      selectionSeed: "seed_explicit_hierarchy",
      referenceTraits: ["semantic hinge emphasis", "editorial serif hinge"],
    });

    expect(lockup.accentTokenIds).toEqual(["token_now"]);
    expect(lockup.primaryTokenIds).toEqual(["token_move", "token_gently"]);
  });

  it("disables overlap when a segment is too short to compose safely", () => {
    const lockup = buildMaulEditorialLockup({
      segment: {
        segmentId: "segment_short",
        tokenIds: ["token_now", "token"],
        outputStartMs: 0,
        outputEndMs: 180,
        semanticRole: "support",
        emphasisLevel: "support",
        holdAcrossProtectedPause: false,
      },
      primaryFont,
      accentFont,
      selectionSeed: "seed_b",
      referenceTraits: [],
    });

    expect(lockup.overlap).toMatchObject({enabled: false, ratio: 0, direction: "none"});
    expect(lockup.choreography.staggerMs).toBe(0);
  });

  it("attaches the planned lockup to the authoritative placement segment", () => {
    const placement = {
      segments: [{
        segmentId: "segment_hero",
        chunkId: "chunk_hero",
        tokenIds: ["token_build", "token_legacy"],
        lines: [{lineId: "line_hero", tokenIds: ["token_build", "token_legacy"], text: "Build legacy"}],
        box: {x: 0.2, y: 0.6, width: 0.6, height: 0.12},
        maximumEnvelope: {x: 0.18, y: 0.58, width: 0.64, height: 0.16},
        alignment: "center",
        compatibility: {nominalFontSizePx: 72, hierarchyScale: 1, lineHeight: 1.1},
        outputStartMs: 0,
        outputEndMs: 1200,
      }],
    } as never;
    const chunks = {
      tokens: [
        {tokenId: "token_build", text: "Build"},
        {tokenId: "token_legacy", text: "legacy"},
      ],
      chunks: [{
        chunkId: "chunk_hero",
        tokenIds: ["token_build", "token_legacy"],
        semanticRole: "hero",
        emphasis: {level: "hero"},
        holdAcrossProtectedPause: false,
        outputStartMs: 0,
        outputEndMs: 1200,
      }],
    } as never;

    const result = applyMaulEditorialLockups({
      placementPlan: placement,
      textChunkPlan: chunks,
      rhythm: {
        segments: [{
          segmentId: "segment_hero",
          treatment: "three_word_script_glide",
          preserveReadableHold: false,
        }],
      } as never,
      primaryFont,
      accentFont,
      referenceTraits: ["editorial serif hinge"],
      selectionSeed: "seed_c",
      output: {widthPx: 1080, heightPx: 1920},
      measureToken: ({font}) => font.assetId === accentFont.assetId
        ? {widthPx: 560, heightPx: 90}
        : {widthPx: 180, heightPx: 84},
    });

    expect(result.segments[0]?.editorialLockup).toMatchObject({
      mode: "script_tag_overlap",
      choreography: {
        mode: "position_locked_word_reveal",
        tokenOrder: ["token_build", "token_legacy"],
      },
    });
    expect(result.segments[0]!.maximumEnvelope.width)
      .toBeGreaterThan(result.segments[0]!.box.width);
    expect(result.segments[0]!.maximumEnvelope.x)
      .toBeLessThan(result.segments[0]!.box.x);
  });
});
