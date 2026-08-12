import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import type {MaulPlannedTextRecord} from "../maul-short-manifest-adapter";
import {MaulProfileTypographyGroup} from "../MaulProfileTypographyGroup";

const letterFrameMotion = {
  schemaVersion: "maul-frame-motion/v1" as const,
  executorId: "joseph:text-entry.letter-riser",
  sourceTreatment: "text-entry.letter-riser",
  unit: "letter" as const,
  tokenId: "token_hero",
  placementSegmentId: "segment_profile",
  fps: 30,
  sourceIntervalMs: {startMs: 0, endMs: 300},
  phases: {
    entry: {
      startFrame: 0,
      endFrame: 5,
      easing: {type: "linear" as const},
      from: {opacity: 0, translateXPx: 0, translateYPx: 36, scale: 0.9, rotationDeg: 0, blurPx: 4, clipProgress: 0.2, trackingEm: -0.04},
      to: {opacity: 1, translateXPx: 0, translateYPx: 0, scale: 1, rotationDeg: 0, blurPx: 0, clipProgress: 1, trackingEm: 0},
    },
    hold: {
      startFrame: 5,
      endFrame: 20,
      easing: {type: "linear" as const},
      from: {opacity: 1, translateXPx: 0, translateYPx: 0, scale: 1, rotationDeg: 0, blurPx: 0, clipProgress: 1, trackingEm: 0},
      to: {opacity: 1, translateXPx: 0, translateYPx: 0, scale: 1, rotationDeg: 0, blurPx: 0, clipProgress: 1, trackingEm: 0},
    },
    exit: {
      startFrame: 20,
      endFrame: 25,
      easing: {type: "linear" as const},
      from: {opacity: 1, translateXPx: 0, translateYPx: 0, scale: 1, rotationDeg: 0, blurPx: 0, clipProgress: 1, trackingEm: 0},
      to: {opacity: 0, translateXPx: 0, translateYPx: -24, scale: 1, rotationDeg: 0, blurPx: 4, clipProgress: 1, trackingEm: 0},
    },
  },
  envelope: {maxTranslateXPx: 0, maxTranslateYPx: 36, maxScale: 1, maxBlurPx: 4},
};

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
    expect(markup).toContain("color:#F4E9D7");
    expect(markup).not.toContain("color:#FFFFFF");
    expect(markup).toContain("#FF6B35");
    expect(markup).toContain(selectedAsset.browserUrl);
    expect(markup).toContain("font-size:92px");
  });

  it("keeps profile geometry while selectively hiding tokens on a depth pass", () => {
    const selectedAsset = {
      assetId: "font_profile_test_800", family: "Profile Test", cssFamily: "MAUL Profile Test",
      weight: 800, style: "normal" as const, browserUrl: "/fonts/generated/profile-test.woff2",
      localFilePath: "/tmp/profile-test.woff2", localFileSha256: "b".repeat(64), format: "woff2" as const,
      source: "hydrated_library" as const, license: {status: "cleared" as const, evidence: ["Fixture receipt."]},
    };
    const record = {
      segmentId: "segment_depth", outputStartMs: 0, outputEndMs: 1000,
      boxPx: {leftPx: 120, topPx: 300, widthPx: 720, heightPx: 240}, family: "measured" as const,
      variantId: "profile.typography_group_v1", fallbackCode: null, fallbackReason: null, alignment: "left" as const,
      minimumLegibilityPrimitive: {kind: "none" as const}, animationProgram: null, animationPrograms: [],
      font: {profileId: "profile-v1", metricsFingerprint: "a".repeat(64), family: selectedAsset.family,
        assetId: selectedAsset.assetId, weight: 800, fontSizePx: 72, lineHeight: 1, hierarchyScale: 1},
      profileTransform: {uniformScale: 1, intrinsicWidthPx: 600, intrinsicHeightPx: 200, finalWidthPx: 600, finalHeightPx: 200},
      profileRealization: {adaptation: "uniform_fit_9_16" as const, horizontalAlignment: "left" as const,
        maxWidthPercent: 85, intrinsicSizePx: {width: 600, height: 200}, layers: [{layerName: "hero",
          tokenIds: ["token_ive", "token_done"], text: "I've done", selectedAsset, fontSizePx: 92,
          measuredWidthPx: 600, measuredHeightPx: 100, lineHeight: 1, letterSpacingEm: 0, casing: "normal" as const,
          color: "#FFFFFF", marginTopPx: 0, shadow: {xOffset: 0, yOffset: 0, blurRadius: 0, color: "#000000"},
          measurementId: "profile_measurement_depth"}]},
      lines: [{lineId: "line", text: "I've done", tokens: [
        {tokenId: "token_ive", text: "I've", outputSpans: []},
        {tokenId: "token_done", text: "done", outputSpans: []},
      ]}],
    } satisfies MaulPlannedTextRecord;

    const markup = renderToStaticMarkup(<MaulProfileTypographyGroup record={record} visibleTokenIds={new Set(["token_ive"])} />);
    expect(markup).toContain('data-maul-depth-token="token_ive"');
    expect(markup).toContain('data-maul-depth-hidden-token="token_done"');
    expect(markup).toContain("visibility:hidden");
  });

  it("renders letter-source word motion inside Font JSON text without adding a treatment", () => {
    const selectedAsset = {
      assetId: "font_profile_motion_700", family: "Profile Motion", cssFamily: "MAUL Profile Motion",
      weight: 700, style: "normal" as const, browserUrl: "/fonts/generated/profile-motion.woff2",
      localFilePath: "/tmp/profile-motion.woff2", localFileSha256: "c".repeat(64), format: "woff2" as const,
      source: "hydrated_library" as const, license: {status: "cleared" as const, evidence: ["Fixture receipt."]},
    };
    const record = {
      segmentId: "segment_profile", outputStartMs: 0, outputEndMs: 1000,
      boxPx: {leftPx: 120, topPx: 300, widthPx: 720, heightPx: 240}, family: "measured" as const,
      variantId: "profile.typography_group_v1", fallbackCode: null, fallbackReason: null, alignment: "left" as const,
      minimumLegibilityPrimitive: {kind: "none" as const}, animationProgram: null,
      animationPrograms: [{
        animationId: "letter_riser", treatment: "text-entry.letter-riser", executorId: letterFrameMotion.executorId,
        frameMotion: letterFrameMotion, target: {scope: "tokens" as const, placementSegmentId: "segment_profile", tokenIds: ["token_hero"]},
        phases: {
          entry: {outputStartMs: 0, outputEndMs: 167, easing: {type: "linear" as const}, from: letterFrameMotion.phases.entry.from, to: letterFrameMotion.phases.entry.to},
          hold: {outputStartMs: 167, outputEndMs: 667, easing: {type: "linear" as const}, from: letterFrameMotion.phases.hold.from, to: letterFrameMotion.phases.hold.to},
          exit: {outputStartMs: 667, outputEndMs: 833, easing: {type: "linear" as const}, from: letterFrameMotion.phases.exit.from, to: letterFrameMotion.phases.exit.to},
        },
        rationale: "Fixture.",
      }],
      font: {profileId: "profile-v1", metricsFingerprint: "a".repeat(64), family: selectedAsset.family, assetId: selectedAsset.assetId, weight: 700, fontSizePx: 72, lineHeight: 1, hierarchyScale: 1},
      profileTransform: {uniformScale: 1, intrinsicWidthPx: 600, intrinsicHeightPx: 200, finalWidthPx: 600, finalHeightPx: 200},
      profileRealization: {adaptation: "uniform_fit_9_16" as const, horizontalAlignment: "left" as const, maxWidthPercent: 85, intrinsicSizePx: {width: 600, height: 200}, layers: [{layerName: "hero", tokenIds: ["token_hero"], text: "Luxury", selectedAsset, fontSizePx: 92, measuredWidthPx: 600, measuredHeightPx: 100, lineHeight: 1, letterSpacingEm: 0, casing: "normal" as const, color: "#FF6B35", marginTopPx: 0, shadow: {xOffset: 0, yOffset: 0, blurRadius: 0, color: "#000000"}, measurementId: "profile_motion"}]},
      lines: [{lineId: "line", text: "Luxury", tokens: [{tokenId: "token_hero", text: "Luxury", outputSpans: []}]}],
    } satisfies MaulPlannedTextRecord;

    const markup = renderToStaticMarkup(<MaulProfileTypographyGroup record={record} outputFrame={1} />);
    expect(markup).toContain('data-maul-letter-index="0"');
    expect(markup).toContain('data-maul-letter-index="5"');
    expect(markup).toContain("translate3d(0px, 36px, 0)");
    expect(markup).toContain("color:#FF6B35");
    expect(markup).not.toContain("background-color:");
    expect(markup).not.toContain("border-radius:");
  });
});
