import {describe, expect, it} from "vitest";

import {maulEditorialLockupSchema} from "./maul-editorial-lockup.js";

const base = {
  schemaVersion: "maul-editorial-lockup/v1",
  mode: "script_tag_overlap",
  primaryTokenIds: ["token_make"],
  accentTokenIds: ["token_it"],
  tokenStyles: [
    {
      tokenId: "token_make",
      role: "primary",
      fontAssetId: "font_google_dm_sans_700",
      fontFamily: "DM Sans",
      fontStyle: "normal",
      fontWeight: 700,
      offsetXPx: 0,
      offsetYPx: 0,
      fontSizeScale: 1,
      rotationDeg: 0,
      zIndex: 1,
      opacity: 1,
    },
    {
      tokenId: "token_it",
      role: "accent",
      fontAssetId: "font_google_playfair_display_italic_700",
      fontFamily: "Playfair Display",
      fontStyle: "italic",
      fontWeight: 700,
      offsetXPx: -18,
      offsetYPx: 5,
      fontSizeScale: 0.82,
      rotationDeg: -3,
      zIndex: 2,
      opacity: 1,
    },
  ],
  overlap: {
    enabled: true,
    ratio: 0.22,
    direction: "accent_over_primary",
    rationale: "The accent hinge crosses the primary word to create a readable lockup.",
  },
  choreography: {
    mode: "forward_word_reveal",
    tokenOrder: ["token_make", "token_it"],
    staggerMs: 72,
    entryDurationMs: 150,
  },
  rationale: "A display word carries the phrase while the italic hinge arrives forward by word.",
} as const;

describe("MAUL editorial lockup contract", () => {
  it("accepts an intentional script/display overlap with a forward word reveal", () => {
    expect(maulEditorialLockupSchema.parse(base)).toEqual(base);
  });

  it("rejects choreography that omits a styled token", () => {
    expect(() => maulEditorialLockupSchema.parse({
      ...base,
      choreography: {...base.choreography, tokenOrder: ["token_make"]},
    })).toThrow(/tokenOrder|token/i);
  });

  it("rejects an overlap that is declared without visual justification", () => {
    expect(() => maulEditorialLockupSchema.parse({
      ...base,
      overlap: {...base.overlap, rationale: ""},
    })).toThrow(/rationale/i);
  });

  it("rejects a token style whose role contradicts its assigned layer", () => {
    expect(() => maulEditorialLockupSchema.parse({
      ...base,
      tokenStyles: [
        {...base.tokenStyles[0], role: "accent"},
        base.tokenStyles[1],
      ],
    })).toThrow(/role.*layer|layer.*role/i);
  });
});
