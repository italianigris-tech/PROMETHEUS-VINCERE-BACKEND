import path from "node:path";
import {mkdtemp, rm, stat, writeFile} from "node:fs/promises";
import os from "node:os";

import {describe, expect, it} from "vitest";

import {PreviewRenderService} from "../render/preview-render-service";
import type {CreativeDecisionManifest} from "../contracts/creative-decision-manifest";
import {runFfmpegCommand} from "../sound-engine/ffmpeg";
import {resolveRequestedOrFallbackFontPair} from "../typography/font-file-resolver";

const buildManifest = (overrides?: Partial<CreativeDecisionManifest["typography"]>): CreativeDecisionManifest => ({
  manifestVersion: "1.0.0",
  jobId: "job_preview_1",
  sceneId: "scene_1",
  source: {
    videoUrl: "/api/edit-sessions/job_preview_1/source",
    transcriptSegment: {
      text: "Premium preview artifact",
      startMs: 0,
      endMs: 8000
    }
  },
  scene: {durationMs: 8000, aspectRatio: "16:9", width: 1920, height: 1080, fps: 30},
  intent: {rhetoricalIntent: "premium_explain", emotionalTone: "cinematic", intensity: 0.6},
  typography: {
    mode: "svg_longform_typography_v1",
    primaryFont: {family: "Satoshi", source: "custom_ingested", role: "headline", fileUrl: undefined},
    fontPairing: {graphUsed: true, reason: "test"},
    coreWords: [],
    linePlan: {lines: ["Premium preview", "artifact"], maxLines: 3, maxCharsPerLine: 28, allowWidows: false},
    ...overrides
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
    requestedStyle: "cinematic-premium-clean",
    motionTier: "premium",
    captionProfileId: "longform_svg_typography_v1",
    speechRateEstimate: 2.9
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
  }
});

describe("PreviewRenderService", () => {
  it("falls back to an html composition when no source media path is available", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "preview-render-"));
    try {
      const service = new PreviewRenderService();
      const fontPath = await writeTestFont(tempRoot);
      const result = await service.createPreviewArtifact({
        manifest: buildManifest({
          primaryFont: {
            family: "Satoshi",
            source: "custom_ingested",
            role: "headline",
            fileUrl: fontPath
          }
        }),
        sessionRenderDir: tempRoot,
        enableGsapMotion: true,
        enableKineticTypography: true,
        preferHtmlComposition: true
      });
      expect(result.previewUrl).toBe("/api/edit-sessions/job_preview_1/preview-artifact");
      expect(result.localPath.endsWith(path.join("composition", "index.html"))).toBe(true);
      expect(result.engine).toBe("hyperframes");
      expect(result.artifactKind).toBe("html_composition");
      expect(result.contentType).toBe("text/html; charset=utf-8");
      expect(result.diagnostics.features.gsap.activated).toBe(true);
      expect(result.diagnostics.features.gsap.evidence.length).toBeGreaterThan(0);
      expect(result.diagnostics.features.kineticTypography.activated).toBe(false);
      expect(result.diagnostics.styleAuthority.motionPreset).toBe("softSlideRight");
      expect(result.diagnostics.styleAuthority.evidence.length).toBeGreaterThan(0);
    } finally {
      await rm(tempRoot, {recursive: true, force: true});
    }
  });

  it("renders a real preview video artifact when a valid source media path is available", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "preview-render-video-"));
    const sourceVideoPath = path.join(tempRoot, "source.mp4");
    const fontPair = resolveRequestedOrFallbackFontPair("Satoshi", "Canela");
    expect(fontPair).not.toBeNull();

    await runFfmpegCommand([
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=1280x720:d=2",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      sourceVideoPath
    ]);

    try {
      const service = new PreviewRenderService();
      const result = await service.createPreviewArtifact({
        manifest: {
          ...buildManifest({
            primaryFont: {
              family: fontPair!.primary.family,
              source: "custom_ingested",
              role: "headline",
              fileUrl: fontPair!.primary.filePath
            }
          }),
          scene: {durationMs: 2000, aspectRatio: "16:9", width: 1280, height: 720, fps: 30},
          source: {
            videoUrl: sourceVideoPath,
            transcriptSegment: {
              text: "Premium preview artifact",
              startMs: 0,
              endMs: 1800
            }
          }
        },
        sessionRenderDir: tempRoot,
        sourceMediaPath: sourceVideoPath,
        enableGsapMotion: true,
        preferHtmlComposition: false
      });

      expect(result.artifactKind).toBe("video");
      expect(result.contentType).toBe("video/mp4");
      expect(result.localPath.endsWith("preview-artifact.mp4")).toBe(true);
      await expect(stat(result.localPath)).resolves.toBeDefined();
      expect(result.diagnostics.warnings).toEqual([]);
      expect(result.diagnostics.animationProof.gsapTimelineGenerated).toBe(false);
      expect(result.diagnostics.features.gsap.activated).toBe(false);
      expect(result.diagnostics.features.gsap.fallbackUsed).toBe(true);
      expect(result.diagnostics.features.gsap.fallbackReason).toContain("FFmpeg drawtext video path");
      expect(result.diagnostics.styleAuthority.styleDeviationWarnings.join(" ")).toContain("video fallback path");
    } finally {
      await rm(tempRoot, {recursive: true, force: true});
    }
  }, 15000);
});

const writeTestFont = async (root: string): Promise<string> => {
  const filePath = path.join(root, "Satoshi.woff2");
  await writeFile(filePath, Buffer.from("test-font-bytes"));
  return filePath;
};
