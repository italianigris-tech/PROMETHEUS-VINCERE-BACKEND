import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import type {MaulPlannedTextRecord} from "../maul-short-manifest-adapter";
import {MaulProfileTypographyGroup} from "../MaulProfileTypographyGroup";

describe("MAUL profile typography renderer", () => {
  it("renders each JSON layer independently with its receipt and static color", () => {
    const selectedAsset = {
      assetId: "font_profile_test_700",
      family: "Profile Test",
      cssFamily: "MAUL Profile Test",
      weight: 700,
      style: "normal" as const,
      browserUrl: "/fonts/generated/profile-test.woff2",
      localFilePath: "/tmp/profile-test.woff2",
      localFileSha256: "b".repeat(64),
      format: "woff2" as const,
      source: "hydrated_library" as const,
      license: {status: "cleared" as const, evidence: ["Fixture receipt."]},
    };
    const record: MaulPlannedTextRecord = {
      segmentId: "segment_profile",
      outputStartMs: 0,
      outputEndMs: 1000,
      boxPx: {leftPx: 120, topPx: 300, widthPx: 720, heightPx: 240},
      family: "measured",
      variantId: "profile.typography_group_v1",
      fallbackCode: null,
      fallbackReason: null,
      alignment: "left",
      minimumLegibilityPrimitive: {kind: "none"},
      animationProgram: null,
      animationPrograms: [],
      font: {
        profileId: "profile-v1",
        metricsFingerprint: "a".repeat(64),
        family: selectedAsset.family,
        assetId: selectedAsset.assetId,
        weight: selectedAsset.weight,
        fontSizePx: 72,
        lineHeight: 1,
        hierarchyScale: 1,
        cssFamily: selectedAsset.cssFamily,
        browserUrl: selectedAsset.browserUrl,
        style: selectedAsset.style,
      },
      profileTransform: {
        uniformScale: 1.2,
        intrinsicWidthPx: 600,
        intrinsicHeightPx: 200,
        finalWidthPx: 720,
        finalHeightPx: 240,
      },
      profileRealization: {
        adaptation: "uniform_fit_9_16",
        horizontalAlignment: "left",
        maxWidthPercent: 85,
        intrinsicSizePx: {width: 600, height: 200},
        layers: [
          {
            layerName: "support",
            tokenIds: ["token_support"],
            text: "The setup",
            selectedAsset,
            fontSizePx: 42,
            measuredWidthPx: 220,
            measuredHeightPx: 48,
            lineHeight: 1.1,
            letterSpacingEm: 0.01,
            casing: "normal",
            color: "#F4E9D7",
            marginTopPx: 0,
            shadow: {xOffset: 0, yOffset: 1, blurRadius: 2, color: "#000000"},
            measurementId: "profile_measurement_support",
          },
          {
            layerName: "hero",
            tokenIds: ["token_hero"],
            text: "changes",
            selectedAsset,
            fontSizePx: 92,
            measuredWidthPx: 600,
            measuredHeightPx: 100,
            lineHeight: 0.95,
            letterSpacingEm: -0.01,
            casing: "lowercase",
            color: "#FF6B35",
            marginTopPx: -4,
            shadow: {xOffset: 0, yOffset: 2, blurRadius: 4, color: "#000000"},
            measurementId: "profile_measurement_hero",
          },
        ],
      },
      lines: [
        {lineId: "line_support", text: "The setup", tokens: [{tokenId: "token_support", text: "The setup", outputSpans: []}]},
        {lineId: "line_hero", text: "changes", tokens: [{tokenId: "token_hero", text: "changes", outputSpans: []}]},
      ],
    };
    record.profileColorResolution = {
      mode: "light_text",
      backgroundLuminance: 0.04,
      layers: [
        {
          layerName: "support",
          requestedColor: "#F4E9D7",
          resolvedColor: "#FFFFFF",
          contrastRatio: 11.667,
        },
        {
          layerName: "hero",
          requestedColor: "#FF6B35",
          resolvedColor: "#FF6B35",
          contrastRatio: 4.7,
        },
      ],
    };

    const markup = renderToStaticMarkup(
      <MaulProfileTypographyGroup
        record={record}
      />,
    );

    expect(markup).toContain('data-maul-profile-typography="true"');
    expect(markup).toContain('data-profile-color-mode="light_text"');
    expect(markup).toContain('data-maul-profile-layer="support"');
    expect(markup).toContain('data-maul-profile-layer="hero"');
    expect(markup).toContain("The setup");
    expect(markup).toContain("changes");
    expect(markup).toContain("#FFFFFF");
    expect(markup).not.toContain("color:#F4E9D7");
    expect(markup).toContain("#FF6B35");
    expect(markup).toContain(selectedAsset.browserUrl);
    expect(markup).toContain("font-size:92px");
  });
});
