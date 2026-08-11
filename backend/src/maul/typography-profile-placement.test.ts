import {describe, expect, it} from "vitest";

import {loadTypographyProfileCorpus} from "./typography-profile-corpus.js";
import {compileTypographyProfileRealization} from "./typography-profile-realization.js";
import {loadExecutableTypographyFontAssets, resolveTypographyProfileLayer} from "./typography-profile-font-resolver.js";
import {selectTypographyProfilePlacement} from "./typography-profile-placement.js";

describe("MAUL typography profile placement", () => {
  it("selects a full-size 9:16 anchor and records one uniform transform", () => {
    const profile = loadTypographyProfileCorpus().find(
      (candidate) => candidate.sourceFilename === "image (21).json",
    );
    expect(profile).toBeDefined();
    if (!profile) return;
    const assets = loadExecutableTypographyFontAssets();
    const bindings = new Map(
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
        {tokenId: "t1", text: "She's"},
        {tokenId: "t2", text: "got"},
        {tokenId: "t3", text: "the"},
        {tokenId: "t4", text: "LOOK"},
      ],
      bindingsByLayerName: bindings,
      measureToken: ({text, fontSizePx}) => ({
        widthPx: text.length * fontSizePx * 0.5,
        heightPx: fontSizePx,
      }),
    });

    const placement = selectTypographyProfilePlacement({
      realization,
      subjectBox: {x: 0.42, y: 0.18, width: 0.22, height: 0.58},
      existingTextRegions: [],
    });

    expect(placement.transform.uniformScale).toBeGreaterThan(0.8);
    expect(placement.transform.finalWidthPx).toBeCloseTo(
      realization.intrinsicSizePx.width * placement.transform.uniformScale,
      2,
    );
    expect(placement.box.x).toBeGreaterThanOrEqual(0.04);
    expect(placement.box.x + placement.box.width).toBeLessThanOrEqual(0.96);
    expect(placement.box.y).toBeGreaterThanOrEqual(0.04);
    expect(placement.box.y + placement.box.height).toBeLessThanOrEqual(0.92);
    expect(placement.box.width).toBeGreaterThan(0.25);
  });

  it("does not default every profile to the lower-right quadrant", () => {
    const profile = loadTypographyProfileCorpus().find(
      (candidate) => candidate.sourceFilename === "image (21).json",
    );
    expect(profile).toBeDefined();
    if (!profile) return;
    const realization = {
      adaptation: "uniform_fit_9_16" as const,
      horizontalAlignment: "left" as const,
      maxWidthPercent: 85,
      intrinsicSizePx: {width: 720, height: 340},
      layers: [{
        layerName: "line",
        tokenIds: ["t1"],
        text: "A statement",
        selectedAsset: loadExecutableTypographyFontAssets()[0]!,
        fontSizePx: 72,
        measuredWidthPx: 720,
        measuredHeightPx: 80,
        lineHeight: 1,
        letterSpacingEm: 0,
        casing: "normal" as const,
        color: "#111111",
        marginTopPx: 0,
        shadow: {xOffset: 0, yOffset: 0, blurRadius: 0, color: "#000"},
        measurementId: "profile_measurement_test",
      }],
    };
    const placement = selectTypographyProfilePlacement({
      realization,
      subjectBox: {x: 0.05, y: 0.05, width: 0.3, height: 0.3},
      existingTextRegions: [],
    });
    expect(placement.box.x).toBeLessThan(0.5);
    expect(placement.box.y).toBeLessThan(0.7);
  });

  it("scales compact profile geometry to an editorially present frame width", () => {
    const selectedAsset = loadExecutableTypographyFontAssets()[0]!;
    const placement = selectTypographyProfilePlacement({
      realization: {
        adaptation: "uniform_fit_9_16",
        horizontalAlignment: "left",
        maxWidthPercent: 85,
        intrinsicSizePx: {width: 100, height: 120},
        layers: [{
          layerName: "hero",
          tokenIds: ["t1"],
          text: "Here",
          selectedAsset,
          fontSizePx: 68,
          measuredWidthPx: 100,
          measuredHeightPx: 120,
          lineHeight: 1,
          letterSpacingEm: 0,
          casing: "normal",
          color: "#111111",
          marginTopPx: 0,
          shadow: {xOffset: 0, yOffset: 0, blurRadius: 0, color: "#000000"},
          measurementId: "profile_measurement_compact",
        }],
      },
      subjectBox: null,
      existingTextRegions: [],
    });

    expect(placement.transform.finalWidthPx).toBeGreaterThanOrEqual(756);
    expect(placement.box.width).toBeGreaterThanOrEqual(0.7);
    expect(68 * placement.transform.uniformScale).toBeGreaterThanOrEqual(72);
  });

  it("honors a measured center intent with controlled subject overlap", () => {
    const selectedAsset = loadExecutableTypographyFontAssets()[0]!;
    const subjectBox = {x: 0.3, y: 0.18, width: 0.4, height: 0.58};
    const placement = selectTypographyProfilePlacement({
      realization: {
        adaptation: "uniform_fit_9_16",
        horizontalAlignment: "center",
        maxWidthPercent: 85,
        intrinsicSizePx: {width: 640, height: 260},
        layers: [{
          layerName: "hero",
          tokenIds: ["t1"],
          text: "Occupy the frame",
          selectedAsset,
          fontSizePx: 84,
          measuredWidthPx: 640,
          measuredHeightPx: 260,
          lineHeight: 1,
          letterSpacingEm: 0,
          casing: "normal",
          color: "#FFFFFF",
          marginTopPx: 0,
          shadow: {xOffset: 0, yOffset: 2, blurRadius: 6, color: "#000000"},
          measurementId: "profile_measurement_center",
        }],
      },
      subjectBox,
      existingTextRegions: [],
      intent: {
        preferredBox: {x: 0.18, y: 0.34, width: 0.64, height: 0.28},
        overlapPolicy: "controlled_overlap",
      },
    });

    expect(placement.anchorId).toBe("center");
    expect(placement.box.x).toBeLessThan(subjectBox.x + subjectBox.width);
    expect(placement.box.x + placement.box.width).toBeGreaterThan(subjectBox.x);
  });
});
