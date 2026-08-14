import {describe, expect, it} from "vitest";

import {
  assertTypographyProfileManifestLineage,
  assertTypographyProfileProvenance,
} from "./typography-profile-manifest-contract.js";

describe("MAUL typography profile manifest contract", () => {
  const binding = {
    chunkId: "chunk_a",
    realization: {
      intrinsicSizePx: {width: 600, height: 180},
      layers: [
        {layerName: "support", tokenIds: ["token_a"]},
        {layerName: "hero", tokenIds: ["token_b"]},
      ],
    },
  } as any;
  const segment = {
    chunkId: "chunk_a",
    tokenIds: ["token_a", "token_b"],
    profileTransform: {
      uniformScale: 1.2,
      intrinsicWidthPx: 600,
      intrinsicHeightPx: 180,
      finalWidthPx: 720,
      finalHeightPx: 216,
    },
  } as any;

  it("accepts a matching realization and transform lineage", () => {
    expect(() => assertTypographyProfileManifestLineage({binding, segment})).not.toThrow();
  });

  it("rejects missing transform, token drift, and geometry drift", () => {
    expect(() => assertTypographyProfileManifestLineage({
      binding,
      segment: {...segment, profileTransform: undefined},
    })).toThrow(/transform/i);
    expect(() => assertTypographyProfileManifestLineage({
      binding,
      segment: {...segment, tokenIds: ["token_b", "token_a"]},
    })).toThrow(/token/i);
    expect(() => assertTypographyProfileManifestLineage({
      binding,
      segment: {
        ...segment,
        profileTransform: {...segment.profileTransform, intrinsicWidthPx: 601},
      },
    })).toThrow(/dimension|geometry/i);
  });

  it("rejects self-declared typography metadata without compiler provenance", () => {
    expect(() => assertTypographyProfileProvenance(binding)).toThrow(
      /provenance receipt/i,
    );
  });
});
