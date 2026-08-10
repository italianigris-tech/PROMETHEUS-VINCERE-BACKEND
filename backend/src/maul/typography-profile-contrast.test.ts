import {describe, expect, it} from "vitest";

import {
  resolveTypographyProfileColors,
  resolveTypographyProfileColorsAcrossSamples,
} from "./typography-profile-contrast.js";

const realization = (color: string) => ({
  adaptation: "uniform_fit_9_16" as const,
  horizontalAlignment: "left" as const,
  maxWidthPercent: 85,
  intrinsicSizePx: {width: 100, height: 40},
  layers: [{
    layerName: "hero",
    tokenIds: ["token_hero"],
    text: "Hero",
    selectedAsset: {} as any,
    fontSizePx: 48,
    measuredWidthPx: 100,
    measuredHeightPx: 40,
    lineHeight: 1,
    letterSpacingEm: 0,
    casing: "normal" as const,
    color,
    marginTopPx: 0,
    shadow: {xOffset: 0, yOffset: 1, blurRadius: 2, color: "#000000"},
    measurementId: "measurement_hero",
  }],
});

describe("MAUL profile color resolution", () => {
  it("switches dark profile text to white over a dark observed region", () => {
    const result = resolveTypographyProfileColors({
      realization: realization("#111111"),
      backgroundLuminance: 0.0065,
    });

    expect(result).toMatchObject({
      mode: "light_text",
      layers: [{requestedColor: "#111111", resolvedColor: "#FFFFFF"}],
    });
    expect(result.layers[0]!.contrastRatio).toBeGreaterThan(4.5);
  });

  it("uses a conservative opposite tone when no background sample exists", () => {
    const result = resolveTypographyProfileColors({
      realization: realization("#F4E9D7"),
      backgroundLuminance: null,
    });

    expect(result).toMatchObject({
      mode: "dark_text",
      layers: [{requestedColor: "#F4E9D7", resolvedColor: "#111111"}],
    });
  });

  it("preserves an authored accent color when a large display layer is legible", () => {
    const result = resolveTypographyProfileColors({
      realization: realization("#007AFF"),
      backgroundLuminance: 0.0217,
    });

    expect(result).toMatchObject({
      mode: "profile",
      layers: [{requestedColor: "#007AFF", resolvedColor: "#007AFF"}],
    });
    expect(result.layers[0]!.contrastRatio).toBeGreaterThan(3);
  });

  it("chooses one static readable color across every sampled dark frame", () => {
    const result = resolveTypographyProfileColorsAcrossSamples({
      realization: realization("#111111"),
      backgroundLuminances: [0.006, 0.012, 0.02],
    });

    expect(result.readable).toBe(true);
    expect(result.resolution).toMatchObject({
      mode: "light_text",
      layers: [{requestedColor: "#111111", resolvedColor: "#FFFFFF"}],
    });
    expect(result.minimumContrastRatio).toBeGreaterThanOrEqual(3);
  });

  it("reports no static color as readable across irreconcilable frames", () => {
    const result = resolveTypographyProfileColorsAcrossSamples({
      realization: realization("#111111"),
      backgroundLuminances: [0.01, 0.92],
    });

    expect(result.readable).toBe(false);
    expect(result.minimumContrastRatio).toBeLessThan(3);
  });
});
