import React from "react";
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from "remotion";

import type {MaulPlannedTextRecord} from "./maul-short-manifest-adapter";
import {MaulPlannedTextCard} from "./MaulPlannedTextLayer";

const PROFILE_ID = "prometheus-proof-editorial-v1";
const METRICS_FINGERPRINT = "e".repeat(64);
const selectedAsset = {
  assetId: "font_google_playfair_display_700",
  family: "Playfair Display",
  cssFamily: "Playfair Display",
  weight: 700,
  style: "normal" as const,
  browserUrl: "/fonts/maul/playfair-display-700.woff2",
  localFilePath: "public/fonts/maul/playfair-display-700.woff2",
  localFileSha256: "f".repeat(64),
  format: "woff2" as const,
  source: "hydrated_library" as const,
  license: {status: "cleared" as const, evidence: ["Bundled Prometheus proof font."]},
};
const hidden = {
  opacity: 0,
  translateXPx: 0,
  translateYPx: 48,
  scale: 0.92,
  rotationDeg: 0,
  blurPx: 8,
  clipProgress: 0,
  trackingEm: 0.02,
};
const visible = {
  opacity: 1,
  translateXPx: 0,
  translateYPx: 0,
  scale: 1,
  rotationDeg: 0,
  blurPx: 0,
  clipProgress: 1,
  trackingEm: 0,
};

export const KINETIC_CAUSAL_PROOF_TRACE = [
  "semantic:currency",
  "typography:font-json",
  "placement:lower_or_center_9x16",
  "kinetic:trait_number_count_up",
  "renderer:maul-kinetic-number-count-up-v1",
] as const;

export const KINETIC_CAUSAL_PROOF_RECORD: MaulPlannedTextRecord = {
  segmentId: "proof_segment_currency",
  outputStartMs: 0,
  outputEndMs: 4000,
  boxPx: {leftPx: 108, topPx: 1120, widthPx: 864, heightPx: 420},
  family: "measured",
  variantId: "profile.typography_group_v1",
  fallbackCode: null,
  fallbackReason: null,
  alignment: "left",
  minimumLegibilityPrimitive: {kind: "none"},
  animationProgram: null,
  animationPrograms: [{
    animationId: "proof_currency_count_up",
    treatment: "number-for-steps-counting-animation",
    executorId: "maul-kinetic-number-count-up-v1",
    target: {
      scope: "tokens",
      placementSegmentId: "proof_segment_currency",
      tokenIds: ["proof_token_amount"],
    },
    frameMotion: {
      schemaVersion: "maul-frame-motion/v1",
      executorId: "maul-kinetic-number-count-up-v1",
      sourceTreatment: "number-for-steps-counting-animation",
      unit: "word",
      tokenId: "proof_token_amount",
      placementSegmentId: "proof_segment_currency",
      fps: 30,
      sourceIntervalMs: {startMs: 0, endMs: 4000},
      phases: {
        entry: {startFrame: 0, endFrame: 30, easing: {type: "linear"}, from: hidden, to: visible},
        hold: {startFrame: 30, endFrame: 90, easing: {type: "linear"}, from: visible, to: visible},
        exit: {startFrame: 90, endFrame: 120, easing: {type: "linear"}, from: visible, to: {...hidden, translateYPx: -36}},
      },
      envelope: {maxTranslateXPx: 0, maxTranslateYPx: 48, maxScale: 1, maxBlurPx: 8},
    },
    kineticTreatment: {
      registryVersion: "1.1.0",
      traitId: "trait_number_count_up",
      sourcePhenotype: "TYPO #17",
      selectionMode: "semantic_bias",
      targetScope: "word",
      targetRole: "hero",
      evidence: {
        kind: "currency",
        sourceText: "$10,000",
        parsedValue: 10000,
        tokenIds: ["proof_token_amount"],
      },
      typographyAuthority: {
        kind: "chunk_typography_binding",
        chunkId: "proof_chunk_currency",
        profileId: PROFILE_ID,
        metricsFingerprint: METRICS_FINGERPRINT,
      },
      placementIntent: "lower_or_center_9x16",
      renderContract: {
        executorId: "maul-kinetic-number-count-up-v1",
        frameDeterministic: true,
        startValue: 0,
        endValue: 10000,
        format: "currency_usd",
      },
    },
    phases: {
      entry: {outputStartMs: 0, outputEndMs: 1000, easing: {type: "linear"}, from: {opacity: 0, translateXPx: 0, translateYPx: 48, scale: 0.92}, to: {opacity: 1, translateXPx: 0, translateYPx: 0, scale: 1}},
      hold: {outputStartMs: 1000, outputEndMs: 3000, easing: {type: "linear"}, from: {opacity: 1, translateXPx: 0, translateYPx: 0, scale: 1}, to: {opacity: 1, translateXPx: 0, translateYPx: 0, scale: 1}},
      exit: {outputStartMs: 3000, outputEndMs: 4000, easing: {type: "linear"}, from: {opacity: 1, translateXPx: 0, translateYPx: 0, scale: 1}, to: {opacity: 0, translateXPx: 0, translateYPx: -36, scale: 0.92}},
    },
    rationale: "Source-grounded currency evidence biases the deterministic numeric trait.",
  }],
  font: {
    profileId: PROFILE_ID,
    metricsFingerprint: METRICS_FINGERPRINT,
    family: selectedAsset.family,
    assetId: selectedAsset.assetId,
    weight: selectedAsset.weight,
    fontSizePx: 154,
    lineHeight: 0.9,
    hierarchyScale: 1,
    cssFamily: selectedAsset.cssFamily,
    browserUrl: selectedAsset.browserUrl,
    localFileSha256: selectedAsset.localFileSha256,
    format: selectedAsset.format,
    source: selectedAsset.source,
    style: selectedAsset.style,
    license: selectedAsset.license,
  },
  profileTransform: {
    uniformScale: 1,
    intrinsicWidthPx: 864,
    intrinsicHeightPx: 420,
    finalWidthPx: 864,
    finalHeightPx: 420,
  },
  profileRealization: {
    adaptation: "uniform_fit_9_16",
    horizontalAlignment: "left",
    maxWidthPercent: 80,
    intrinsicSizePx: {width: 864, height: 420},
    layers: [
      {
        layerName: "support",
        tokenIds: ["proof_token_support"],
        text: "A single client generated",
        selectedAsset: {...selectedAsset, assetId: "font_google_dm_sans_700", family: "DM Sans", cssFamily: "DM Sans", browserUrl: "/fonts/maul/dm-sans-700.woff2"},
        fontSizePx: 52,
        measuredWidthPx: 670,
        measuredHeightPx: 62,
        lineHeight: 1.1,
        letterSpacingEm: 0.01,
        casing: "normal",
        color: "#FFFFFF",
        marginTopPx: 0,
        shadow: {xOffset: 0, yOffset: 2, blurRadius: 8, color: "#000000"},
        measurementId: "proof_measurement_support",
      },
      {
        layerName: "hero",
        tokenIds: ["proof_token_amount"],
        text: "$10,000",
        selectedAsset,
        fontSizePx: 154,
        measuredWidthPx: 720,
        measuredHeightPx: 164,
        lineHeight: 0.9,
        letterSpacingEm: 0,
        casing: "normal",
        color: "#FFD34E",
        marginTopPx: 20,
        shadow: {xOffset: 0, yOffset: 4, blurRadius: 14, color: "#000000"},
        measurementId: "proof_measurement_amount",
      },
    ],
  },
  lines: [
    {lineId: "proof_line_support", text: "A single client generated", tokens: [{tokenId: "proof_token_support", text: "A single client generated", outputSpans: []}]},
    {lineId: "proof_line_amount", text: "$10,000", tokens: [{tokenId: "proof_token_amount", text: "$10,000", outputSpans: []}]},
  ],
};

export const KineticCausalChainProof: React.FC = () => {
  const frame = useCurrentFrame();
  const backgroundScale = interpolate(frame, [0, 120], [1.02, 1.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const accentProgress = interpolate(frame, [6, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill data-prometheus-causal-trace={KINETIC_CAUSAL_PROOF_TRACE.join("|")} style={{backgroundColor: "#10100F", overflow: "hidden"}}>
      <Img
        src={staticFile("showcase-assets/home-luxury-driveway.png")}
        style={{width: "100%", height: "100%", objectFit: "cover", transform: `scale(${backgroundScale})`}}
      />
      <AbsoluteFill style={{backgroundColor: "rgba(8, 9, 9, 0.52)"}} />
      <div style={{position: "absolute", left: 108, top: 1064, width: 160 * accentProgress, height: 7, backgroundColor: "#E7342D"}} />
      <Img
        src={staticFile("showcase-assets/coin-hand.svg")}
        style={{position: "absolute", right: 82, top: 988, width: 176, height: 176, objectFit: "contain", opacity: 0.92 * accentProgress, transform: `translateY(${(1 - accentProgress) * 24}px)`}}
      />
      <MaulPlannedTextCard
        record={KINETIC_CAUSAL_PROOF_RECORD}
        absoluteTimeMs={(frame / 30) * 1000}
        outputFrame={frame}
        fps={30}
        textColor="#FFFFFF"
        accentColor="#FFD34E"
      />
      <div style={{position: "absolute", inset: 38, border: "1px solid rgba(255, 255, 255, 0.28)", pointerEvents: "none"}} />
    </AbsoluteFill>
  );
};
