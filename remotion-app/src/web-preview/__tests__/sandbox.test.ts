import path from "node:path";
import {readFileSync} from "node:fs";

import {describe, expect, it} from "vitest";

import {
  SANDBOX_ASSET_URLS,
  SANDBOX_WORDS,
  buildSandboxCaptionChunks,
  buildSandboxMotionModel,
  resolveSandboxDurationInFrames,
  resolveSandboxMatteTime,
  resolveWebPreviewRootRoute
} from "../Sandbox";

describe("strict hardcoded sandbox", () => {
  it("routes only /sandbox to the isolated sandbox root", () => {
    expect(resolveWebPreviewRootRoute("/sandbox")).toBe("sandbox");
    expect(resolveWebPreviewRootRoute("/sandbox/")).toBe("sandbox");
    expect(resolveWebPreviewRootRoute("/")).toBe("preview-app");
    expect(resolveWebPreviewRootRoute("/?previewLane=hyperframes")).toBe("preview-app");
  });

  it("keeps the bootstrap from statically importing the preview app on sandbox loads", () => {
    const bootstrap = readFileSync(path.resolve("src/web-preview/main.tsx"), "utf8");

    expect(bootstrap).not.toMatch(/import\s+\{PreviewApp\}\s+from\s+"\.\/PreviewApp"/);
    expect(bootstrap).toContain("import(\"./PreviewApp\")");
    expect(bootstrap).toContain("import(\"./Sandbox\")");
  });

  it("keeps sandbox and preview app behind the preview font preload bootstrap", () => {
    const bootstrap = readFileSync(path.resolve("src/web-preview/main.tsx"), "utf8");

    expect(bootstrap).not.toMatch(/import\s+\{preloadFontSystem\}\s+from\s+"\.\/font-preload-bootstrap"/);
    expect(bootstrap).toContain("import(\"./font-preload-bootstrap\")");
    expect(bootstrap).toContain("preloadFontSystem()");
    expect(bootstrap).toContain("shouldPreloadWebPreviewFonts(route)");
    expect(bootstrap).not.toMatch(/if\s*\(\s*route\s*===\s*"sandbox"\s*\)/);
    expect(bootstrap.indexOf("preloadFontSystem()")).toBeLessThan(bootstrap.indexOf("renderRootApp(route)"));
  });

  it("uses hardcoded local video, matte, and transcript data", () => {
    expect(SANDBOX_ASSET_URLS.videoSrc).toBe("/test-video.mp4");
    expect(SANDBOX_ASSET_URLS.matteSrc).toBe("/test-matte.mp4");
    expect(SANDBOX_WORDS.length).toBeGreaterThan(8);

    const chunks = buildSandboxCaptionChunks(SANDBOX_WORDS);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.at(0)?.profileId).toBe("longform_svg_typography_v1");
    expect(Math.max(...chunks.map((chunk) => chunk.endMs))).toBeGreaterThan(1000);
  });

  it("builds a premium matte-enabled motion model without backend input", () => {
    const chunks = buildSandboxCaptionChunks(SANDBOX_WORDS);
    const model = buildSandboxMotionModel(chunks);

    expect(model.tier).toBe("premium");
    expect(model.matteEnabled).toBe(true);
    expect(model.chunks).toEqual(chunks);
  }, 20000);

  it("keeps sandbox duration above a one-frame broken preview", () => {
    const chunks = buildSandboxCaptionChunks(SANDBOX_WORDS);

    expect(resolveSandboxDurationInFrames(chunks, 30)).toBeGreaterThan(30);
    expect(resolveSandboxDurationInFrames([], 30)).toBe(300);
  });

  it("maps source playback time to matte playback time by normalized progress", () => {
    expect(resolveSandboxMatteTime({
      sourceCurrentTime: 2.5,
      sourceDuration: 10,
      matteDuration: 5
    })).toBe(1.25);

    expect(resolveSandboxMatteTime({
      sourceCurrentTime: 14,
      sourceDuration: 10,
      matteDuration: 5
    })).toBe(5);

    expect(resolveSandboxMatteTime({
      sourceCurrentTime: 2,
      sourceDuration: 0,
      matteDuration: 5
    })).toBe(2);
  });

  it("does not smuggle backend or browser ML segmentation into the sandbox source", () => {
    const source = readFileSync(path.resolve("src/web-preview/Sandbox.tsx"), "utf8");

    expect(source).not.toContain("/health");
    expect(source).not.toContain("/api/edit-sessions");
    expect(source).not.toMatch(/mediapipe/i);
    expect(source).not.toMatch(/tasks-vision/i);
    expect(source).not.toMatch(/\.tflite/i);
  });

  it("passes the premium matte model into the real composition surface", () => {
    const source = readFileSync(path.resolve("src/web-preview/Sandbox.tsx"), "utf8");

    expect(source).toContain("buildSandboxMotionModel(captionChunks)");
    expect(source).toContain("motionModelOverride={motionModel}");
    expect(source).toContain("motionTier={SANDBOX_MOTION_TIER}");
    expect(source).toContain("matteMode=\"prefer-matte\"");
    expect(source).not.toContain("matteMode=\"off\"");
  });

  it("keeps the matte foreground drawable with anonymous media and a continuous frame loop", () => {
    const source = readFileSync(path.resolve("src/web-preview/Sandbox.tsx"), "utf8");

    expect(source.match(/crossOrigin="anonymous"/g)?.length).toBe(2);
    expect(source).toContain("window.requestAnimationFrame(loop)");
    expect(source).toContain("cancelAnimationFrame(animationFrameId)");
    expect(source).not.toContain("addEventListener(\"seeked\"");
    expect(source).not.toContain("removeEventListener(\"seeked\"");
    expect(source).toContain("onError={markMediaError}");
    expect(source).toContain("sandbox-matte-debug-outline");
  });
});
