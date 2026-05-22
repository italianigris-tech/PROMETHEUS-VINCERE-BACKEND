import path from "node:path";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import os from "node:os";

import {describe, expect, it} from "vitest";

import {generateHyperFramesComposition} from "../composition/hyperframes-composition-generator";
import type {CreativeDecisionManifest} from "../contracts/creative-decision-manifest";

const buildManifest = (): CreativeDecisionManifest => ({
  manifestVersion: "1.0.0",
  jobId: "job_hf_1",
  sceneId: "scene_1",
  source: {
    videoUrl: "/api/edit-sessions/job_hf_1/source",
    transcriptSegment: {
      text: "Build cinematic output now.",
      startMs: 0,
      endMs: 8000,
      words: [
        {text: "Build", startMs: 0, endMs: 400},
        {text: "cinematic", startMs: 420, endMs: 980},
        {text: "output", startMs: 1100, endMs: 1500},
        {text: "now.", startMs: 1520, endMs: 1820}
      ]
    }
  },
  scene: {
    durationMs: 8000,
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    fps: 30
  },
  intent: {
    rhetoricalIntent: "premium_explain",
    emotionalTone: "cinematic",
    intensity: 0.6
  },
  typography: {
    mode: "svg_longform_typography_v1",
    primaryFont: {family: "Satoshi", source: "custom_ingested", role: "headline"},
    fontPairing: {graphUsed: true, reason: "test"},
    coreWords: [],
    linePlan: {lines: ["Build cinematic", "output now."], maxLines: 3, maxCharsPerLine: 28, allowWidows: false}
  },
  animation: {
    engine: "gsap",
    family: "svg_longform_typography_v1",
    retrievedFromMilvus: true,
    easing: "power3.out",
    staggerMs: 50,
    entryMs: 300,
    holdMs: 700,
    exitMs: 250,
    motionIntensity: 0.5,
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
  style: {
    requestedStyle: "aggressive-high-contrast",
    motionTier: "premium",
    captionProfileId: "longform_svg_typography_v1",
    speechRateEstimate: 3.8
  },
  diagnostics: {
    manifestCreatedAt: new Date().toISOString(),
    milvusUsed: true,
    fontGraphUsed: true,
    customFontsUsed: true,
    fallbackUsed: false,
    fallbackReasons: [],
    legacyOverlayUsed: false,
    remotionUsed: false,
    hyperframesUsed: true,
    warnings: []
  },
  motionDialect: {
    sceneRestraintApplied: false,
    segments: [
      {
        label: "segment_1",
        moment: "Pause/Restraint",
        startMs: 0,
        endMs: 1800,
        intensity: 0.24,
        highIntensityDensity: 0.12,
        text: "Build cinematic output now.",
        dialect: {
          motionPreset: "pauseRestraint",
          axis: "y",
          yDriftPx: 18,
          opacityRange: [0.92, 1],
          whip: false,
          heavyWeight: false,
          durationScale: 1.2,
          staggerMs: 42,
          intensity: 0.24
        }
      }
    ]
  }
});

describe("HyperFramesCompositionGenerator", () => {
  it("generates a GSAP-backed composition with timed word spans when enabled", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hf-comp-"));
    try {
      const output = await generateHyperFramesComposition({
        manifest: buildManifest(),
        outputRootDir: root,
        enableGsapMotion: true,
        enableKineticTypography: true
      });
      const indexHtml = await readFile(output.indexHtmlPath, "utf8");
      expect(indexHtml).toContain("typography-layer");
      expect(indexHtml).toContain("id=\"viewport\"");
      expect(indexHtml).toContain("copy-block");
      expect(indexHtml).toContain("assets/vendor/gsap.min.js");
      expect(indexHtml).toContain("assets/vendor/motion-presets.js");
      expect(indexHtml).toContain("assets/vendor/offscreen-rules.js");
      expect(indexHtml).toContain("gsap.timeline");
      expect(indexHtml).toContain("data-motion-preset=\"whipIn\"");
      expect(indexHtml).toContain("\"moment\":\"Pause/Restraint\"");
      expect(indexHtml).toContain("\"motionPreset\":\"pauseRestraint\"");
      expect(indexHtml).toContain("const motionDialect =");
      expect(indexHtml).toContain("data-word-start-ms");
      expect(indexHtml).toContain("data-word-end-ms");
      expect(indexHtml).not.toContain("C:\\");
      expect(output.renderCommand).toContain("hyperframes render");
      expect(output.compositionGenerationTimeMs).toBeGreaterThanOrEqual(0);
      expect(output.diagnostics.features.gsap.activated).toBe(true);
      expect(output.diagnostics.features.gsap.evidence.length).toBeGreaterThan(0);
      expect(output.diagnostics.features.kineticTypography.activated).toBe(true);
      expect(output.diagnostics.styleAuthority.appliedStyle).toBe("aggressive-high-contrast");
      expect(output.diagnostics.styleAuthority.motionPreset).toBe("whipIn");
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  });

  it("throws when GSAP cannot initialize for a cinematic motion manifest", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hf-comp-css-"));
    try {
      await expect(generateHyperFramesComposition({
        manifest: buildManifest(),
        outputRootDir: root,
        enableGsapMotion: false,
        enableKineticTypography: true
      })).rejects.toThrow(/GSAP|cinematic motion|initialize/i);
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  });

  it("marks premium style authority as deviated when custom fonts are declared but not embeddable", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hf-comp-font-dev-"));
    try {
      const output = await generateHyperFramesComposition({
        manifest: buildManifest(),
        outputRootDir: root,
        enableGsapMotion: true,
        enableKineticTypography: true
      });

      expect(output.diagnostics.styleAuthority.materialChangesVerified).toBe(false);
      expect(output.diagnostics.styleAuthority.deviations.some((entry) => entry.includes("premium typography"))).toBe(true);
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  });
});
