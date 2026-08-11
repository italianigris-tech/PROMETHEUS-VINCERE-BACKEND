import {describe, expect, it} from "vitest";

import {
  loadExecutableTypographyFontAssets,
  resolveTypographyProfileLayer,
} from "./typography-profile-font-resolver.js";
import {loadTypographyProfileCorpus} from "./typography-profile-corpus.js";
import {compileTypographyProfileRealization} from "./typography-profile-realization.js";

describe("MAUL typography profile realization", () => {
  it("maps stable tokens to independent authoritative JSON layers", () => {
    const profile = loadTypographyProfileCorpus().find(
      (candidate) => candidate.sourceFilename === "image (31).json",
    );
    expect(profile).toBeDefined();
    if (!profile) return;

    const assets = loadExecutableTypographyFontAssets();
    const bindingsByLayerName = new Map(
      profile.layers.map((layer) => [
        layer.layerName,
        resolveTypographyProfileLayer({
          layer,
          profileMood: profile.metadata.overallMood,
          executableAssets: assets,
        }),
      ]),
    );

    const realization = compileTypographyProfileRealization({
      profile,
      tokens: [
        {tokenId: "token_1", text: "I"},
        {tokenId: "token_2", text: "hate"},
        {tokenId: "token_3", text: "being"},
        {tokenId: "token_4", text: "an"},
        {tokenId: "token_5", text: "influencer!"},
      ],
      bindingsByLayerName,
      measureToken: ({text, fontSizePx}) => ({
        widthPx: text.length * fontSizePx * 0.5,
        heightPx: fontSizePx,
      }),
    });

    expect(realization.adaptation).toBe("uniform_fit_9_16");
    expect(realization.layers.map((layer) => layer.layerName)).toEqual([
      "line_1",
      "line_2",
      "line_3",
    ]);
    expect(realization.layers.map((layer) => layer.tokenIds)).toEqual([
      ["token_1", "token_2"],
      ["token_3", "token_4"],
      ["token_5"],
    ]);
    expect(realization.layers.map((layer) => layer.text)).toEqual([
      "I hate",
      "being an",
      "influencer!",
    ]);
    expect(realization.layers[2]).toMatchObject({
      fontSizePx: 48,
      casing: "lowercase",
      color: "#111111",
      lineHeight: 1,
      marginTopPx: 2,
      selectedAsset: {
        assetId: expect.any(String),
      },
      measurementId: expect.stringMatching(/^profile_measurement_[a-f0-9]{64}$/),
    });
    expect(realization.intrinsicSizePx.width).toBe(
      Math.max(...realization.layers.map((layer) => layer.measuredWidthPx)),
    );
    expect(realization.intrinsicSizePx.height).toBeGreaterThan(0);
  });

  it("adapts a multi-layer JSON grammar to one cinematic focus word", () => {
    const profile = loadTypographyProfileCorpus().find(
      (candidate) => candidate.sourceFilename === "image (31).json",
    );
    expect(profile).toBeDefined();
    if (!profile) return;

    const assets = loadExecutableTypographyFontAssets();
    const bindingsByLayerName = new Map(
      profile.layers.map((layer) => [
        layer.layerName,
        resolveTypographyProfileLayer({
          layer,
          profileMood: profile.metadata.overallMood,
          executableAssets: assets,
        }),
      ]),
    );
    const realization = compileTypographyProfileRealization({
      profile,
      tokens: [{tokenId: "only", text: "FOCUS"}],
      bindingsByLayerName,
      measureToken: ({text, fontSizePx}) => ({
        widthPx: text.length * fontSizePx * 0.5,
        heightPx: fontSizePx,
      }),
    });

    expect(realization.layers).toHaveLength(1);
    expect(realization.layers[0]!.tokenIds).toEqual(["only"]);
    expect(realization.layers[0]!.fontSizePx).toBe(
      Math.max(
        ...profile.layers.map((layer) => layer.fontStyle.sizePxBase),
      ),
    );
  });

  it("preserves authoritative JSON layer sizes without role-based restyling", () => {
    const profile = loadTypographyProfileCorpus().find(
      (candidate) => candidate.sourceFilename === "image (7).json",
    );
    expect(profile).toBeDefined();
    if (!profile) return;

    const assets = loadExecutableTypographyFontAssets();
    const bindingsByLayerName = new Map(
      profile.layers.map((layer) => [
        layer.layerName,
        resolveTypographyProfileLayer({
          layer,
          profileMood: profile.metadata.overallMood,
          executableAssets: assets,
        }),
      ]),
    );
    const realization = compileTypographyProfileRealization({
      profile,
      tokens: [
        {tokenId: "t1", text: "editing"},
        {tokenId: "t2", text: "styles"},
        {tokenId: "t3", text: "in"},
        {tokenId: "t4", text: "long"},
        {tokenId: "t5", text: "form"},
      ],
      bindingsByLayerName,
      measureToken: ({text, fontSizePx}) => ({
        widthPx: text.length * fontSizePx * 0.5,
        heightPx: fontSizePx,
      }),
    });

    expect(realization.layers.map((layer) => layer.fontSizePx)).toEqual([
      12,
      54,
      68,
    ]);
  });
});
