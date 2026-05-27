import {describe, expect, it} from "vitest";

import {creativeDecisionManifestSchema, type CreativeDecisionManifest} from "../contracts/creative-decision-manifest";

const buildManifest = (): CreativeDecisionManifest => ({
  manifestVersion: "1.0.0",
  jobId: "job_authority",
  sceneId: "scene_authority",
  source: {
    videoUrl: "/api/test/video.mp4",
    transcriptSegment: {
      text: "Manifest owns preview truth.",
      startMs: 0,
      endMs: 1600,
      words: [{text: "Manifest", startMs: 0, endMs: 400}]
    }
  },
  scene: {
    durationMs: 1600,
    aspectRatio: "16:9",
    width: 1280,
    height: 720,
    fps: 30
  },
  intent: {
    rhetoricalIntent: "premium_explain",
    emotionalTone: "cinematic",
    intensity: 0.62
  },
  typography: {
    mode: "svg_longform_typography_v1",
    primaryFont: {family: "Fraunces", source: "fallback", role: "headline"},
    fontPairing: {graphUsed: false, reason: "test"},
    coreWords: [],
    linePlan: {lines: ["Manifest owns preview truth."], maxLines: 1, maxCharsPerLine: 32, allowWidows: false}
  },
  animation: {
    engine: "gsap",
    family: "svg_longform_typography_v1",
    retrievedFromMilvus: false,
    easing: "power3.out",
    staggerMs: 50,
    entryMs: 300,
    holdMs: 700,
    exitMs: 250,
    motionIntensity: 0.62,
    avoid: []
  },
  layout: {
    region: "center",
    safeArea: {top: 72, right: 96, bottom: 84, left: 96},
    maxWidthPercent: 72,
    alignment: "center",
    preventOverlap: true,
    zIndexPlan: [{layer: "video", zIndex: 1}, {layer: "typography", zIndex: 20}]
  },
  renderBudget: {
    previewResolution: "720p",
    previewFps: 30,
    finalResolution: "1080p",
    allowHeavyEffectsInPreview: false,
    finalOnlyEffects: []
  },
  diagnostics: {
    manifestCreatedAt: "2026-05-27T00:00:00.000Z",
    milvusUsed: false,
    fontGraphUsed: false,
    customFontsUsed: false,
    fallbackUsed: false,
    fallbackReasons: [],
    legacyOverlayUsed: false,
    remotionUsed: false,
    hyperframesUsed: true,
    warnings: [],
    degradedStages: [],
    visibleFailureCount: 0,
    cognitiveConfidence: 0.96,
    temporalConfidence: 0.91
  },
  authority: {
    authorityVersion: "prometheus-preview-authority/v1",
    solePreviewTruth: true,
    timingTruth: {durationMs: 1600, startMs: 0, endMs: 1600, fps: 30},
    typographyTruth: {mode: "svg_longform_typography_v1", primaryFamily: "Fraunces", fallbackAllowed: true},
    cameraTruth: {},
    transitionTruth: {},
    assetTruth: {requiredAssetIds: [], missingAssetIds: []},
    pacingTruth: {intensity: 0.62, rhythmContinuityScore: 0.91, pacingConfidenceScore: 0.9},
    diagnosticsTruth: {degradedStages: [], visibleFailureCount: 0, fallbackVisible: false},
    confidenceTruth: {cognitiveConfidence: 0.96, renderConfidence: 0.93, temporalConfidence: 0.91},
    temporalTruth: {sceneCount: 1},
    stageTruth: {
      currentStage: "preview-manifest",
      allowedAdapters: ["hyperframes", "remotion"],
      frontendMayPlan: false
    }
  }
});

describe("CreativeDecisionManifest authority", () => {
  it("carries preview timing, diagnostics, confidence, and frontend planning prohibition", () => {
    const manifest = creativeDecisionManifestSchema.parse(buildManifest());

    expect(manifest.authority?.solePreviewTruth).toBe(true);
    expect(manifest.authority?.timingTruth.durationMs).toBe(manifest.scene.durationMs);
    expect(manifest.authority?.stageTruth.frontendMayPlan).toBe(false);
    expect(manifest.diagnostics.visibleFailureCount).toBe(0);
  });
});
