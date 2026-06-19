import path from "node:path";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import {describe, expect, it} from "vitest";
import {generateHyperFramesComposition} from "../composition/hyperframes-composition-generator";
import type {CreativeDecisionManifest} from "../contracts/creative-decision-manifest";

const buildManifest = (input: {primaryFontFileUrl: string}): CreativeDecisionManifest => ({
  manifestVersion: "1.0.0",
  jobId: "job_playback_1",
  sceneId: "scene_1",
  source: {
    videoUrl: "/api/test/video.mp4",
    transcriptSegment: {
      text: "Test playback reliability.",
      startMs: 0,
      endMs: 2000,
      words: [{text: "Test", startMs: 0, endMs: 500}]
    }
  },
  scene: {
    durationMs: 2000,
    aspectRatio: "16:9",
    width: 1280,
    height: 720,
    fps: 30
  },
  intent: {
    rhetoricalIntent: "premium_explain",
    emotionalTone: "cinematic",
    intensity: 0.5
  },
  typography: {
    mode: "svg_longform_typography_v1",
    primaryFont: {family: "Satoshi", source: "custom_ingested", role: "headline", fileUrl: input.primaryFontFileUrl},
    fontPairing: {graphUsed: true, reason: "test"},
    coreWords: [],
    linePlan: {lines: ["Test"], maxLines: 1, maxCharsPerLine: 20, allowWidows: false}
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
    motionIntensity: 0.5,
    avoid: []
  },
  layout: {
    region: "center",
    safeArea: {top: 20, right: 20, bottom: 20, left: 20},
    maxWidthPercent: 80,
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
    requestedStyle: "modern-authority",
    motionTier: "premium",
    captionProfileId: "longform_svg_typography_v1"
  },
  diagnostics: {
    manifestCreatedAt: new Date().toISOString(),
    milvusUsed: false,
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

describe("HyperFrames Playback Reliability (TDD)", () => {
  it("emits playback error handling and status reporting in the generated HTML", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hf-playback-"));
    try {
      const output = await generateHyperFramesComposition({
        manifest: buildManifest({
          primaryFontFileUrl: await writeTestFont(root)
        }),
        outputRootDir: root
      });
      const indexHtml = await readFile(output.indexHtmlPath, "utf8");

      // Verify that we have a status reporting variable
      expect(indexHtml).toContain("window.hyperframesStatus");
      expect(indexHtml).toContain("<base href=\"/api/edit-sessions/job_playback_1/preview/\">");

      // Verify that we handle video element errors
      expect(indexHtml).toContain("video.addEventListener(\"error\"");
      
      // Verify that we catch playback rejection and report it
      expect(indexHtml).toContain(".catch((err) => {");
      expect(indexHtml).toContain("window.hyperframesStatus = \"error\"");
      expect(indexHtml).toContain("window.hyperframesErrorMessage =");

      // Verify initial status is set to something like 'loading' or 'booting'
      expect(indexHtml).toContain("window.hyperframesStatus = \"loading\"");
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  });
});

const writeTestFont = async (root: string): Promise<string> => {
  const filePath = path.join(root, "Satoshi.woff2");
  await writeFile(filePath, Buffer.from("test-font-bytes"));
  return filePath;
};
