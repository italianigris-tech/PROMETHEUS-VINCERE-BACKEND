import path from "node:path";
import {readFileSync} from "node:fs";

import {describe, expect, it} from "vitest";

import {
  buildProjectScopedDiagnosticWarnings,
  ProjectScopedMotionComposition,
  resolveProjectScopedCaptionChunks,
  resolveProjectScopedCaptionRuntimeDiagnostics,
  resolveProjectScopedExplicitDataState,
  resolveProjectScopedMotionLayerVisibility,
  resolveProjectScopedPlaybackVideoSrc,
  resolveProjectScopedStudioVideoBinding,
  resolveProjectScopedTypographyDiagnostics
} from "../ProjectScopedMotionComposition";
import {PROJECT_SCOPED_PREVIEW_COMPOSITION_ID} from "../ProjectScopedPreviewComposition";
import {
  getProjectScopedStudioSampleAsset,
  getProjectScopedStudioSampleIds,
  PROJECT_SCOPED_STUDIO_ASSET_BINDING_MESSAGE,
  PROJECT_SCOPED_STUDIO_DEFAULT_SAMPLE_ID,
  PROJECT_SCOPED_STUDIO_SAMPLE_ASSETS,
  PROJECT_SCOPED_STUDIO_SAMPLE_PROP_GUIDANCE,
  buildProjectScopedStudioDefaultProps,
  buildProjectScopedStudioSampleProps,
  buildProjectScopedStudioTypographySampleProps,
  projectScopedStudioPropsSchema,
  PROJECT_SCOPED_STUDIO_TYPOGRAPHY_SAMPLE_PROP_GUIDANCE,
  PROJECT_SCOPED_STUDIO_VIDEO_SRC_PROP_GUIDANCE
} from "../project-scoped-studio-defaults";
import {isSvgCaptionChunk} from "../../components/SvgCaptionOverlay";
import {getLongformCaptionRenderMode} from "../../lib/stylebooks/caption-style-profiles";

describe("Remotion Studio root", () => {
  it("adds the dedicated Studio command and keeps the Vite preview shell script unchanged", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.studio).toBe("remotion studio src/index.ts --port 3011");
    expect(packageJson.scripts.dev).toBe("vite --configLoader native --port 3010");
  });

  it("registers the canonical project-scoped Studio composition with the expected slug id", () => {
    const source = readFileSync(path.resolve("src/Root.tsx"), "utf8");

    expect(PROJECT_SCOPED_PREVIEW_COMPOSITION_ID).toBe("project-scoped-preview");
    expect(source).toMatch(
      /id=\{PROJECT_SCOPED_PREVIEW_COMPOSITION_ID\}[\s\S]*?component=\{ProjectScopedMotionComposition\}[\s\S]*?schema=\{projectScopedStudioPropsSchema\}/
    );
  });

  it("keeps the active Studio composition implemented directly in ProjectScopedMotionComposition", () => {
    const projectScopedSource = readFileSync(
      path.resolve("src/compositions/ProjectScopedMotionComposition.tsx"),
      "utf8"
    );
    const femaleCoachSource = readFileSync(
      path.resolve("src/compositions/FemaleCoachDeanGraziosi.tsx"),
      "utf8"
    );

    expect(projectScopedSource).not.toContain("./FemaleCoachDeanGraziosi");
    expect(ProjectScopedMotionComposition.displayName).toBe("ProjectScopedMotionComposition");
    expect(femaleCoachSource).toContain("./ProjectScopedMotionComposition");
  });

  it("builds clean Studio default props from the current project-scoped runtime", () => {
    const props = buildProjectScopedStudioDefaultProps("longform_svg_typography_v1");
    const serialized = JSON.stringify(props).toUpperCase();

    expect(props.videoSrc).toBeNull();
    expect(props.videoMetadata?.width).toBe(1920);
    expect(props.captionChunksOverride).toEqual([]);
    expect(props.motionModelOverride).toBeNull();
    expect(props.livePreviewSession).toBeNull();
    expect(props.debugMotionArtifacts).toBe(false);
    expect(PROJECT_SCOPED_STUDIO_VIDEO_SRC_PROP_GUIDANCE).toContain("http://127.0.0.1:8000/api/edit-sessions/<SESSION_ID>/source");
    expect(PROJECT_SCOPED_STUDIO_SAMPLE_PROP_GUIDANCE).toContain(PROJECT_SCOPED_STUDIO_DEFAULT_SAMPLE_ID);
    expect(projectScopedStudioPropsSchema.safeParse(props).success).toBe(true);
    expect(serialized).not.toContain("ACHIEVING");
    expect(serialized).not.toContain("\"ACH\"");
    expect(serialized).not.toContain("\"IEV\"");
    expect(serialized).not.toContain("\"ING\"");
    expect(serialized).not.toContain("SOCIAL");
    expect(serialized).not.toContain("TITLE KEYWORD");
  });

  it("keeps Studio defaults away from stale preview proxies and static bundle artifact paths", () => {
    const props = buildProjectScopedStudioDefaultProps("longform_svg_typography_v1");
    const serialized = JSON.stringify(props);

    expect(serialized).not.toContain(".preview.mp4");
    expect(serialized).not.toContain("/static-");
    expect(serialized).not.toContain("input-video-landscape");
  });

  it("keeps demo/showcase overlays off by default and enables them only with explicit debug props", () => {
    expect(
      resolveProjectScopedMotionLayerVisibility({
        debugMotionArtifacts: false,
        pipMode: "off",
        previewPerformanceMode: "balanced"
      })
    ).toMatchObject({
      showBackgroundOverlay: false,
      showMotionAssetOverlay: false,
      showShowcaseOverlay: false,
      showTransitionOverlay: false
    });

    expect(
      resolveProjectScopedMotionLayerVisibility({
        debugMotionArtifacts: true,
        pipMode: "off",
        previewPerformanceMode: "balanced"
      })
    ).toMatchObject({
      showBackgroundOverlay: true,
      showMotionAssetOverlay: true,
      showShowcaseOverlay: true,
      showTransitionOverlay: true
    });
  });

  it("keeps the default Studio composition in a diagnostic-only empty state until explicit data is provided", () => {
    const props = buildProjectScopedStudioDefaultProps("longform_svg_typography_v1");
    const captionChunks = props.captionChunksOverride ?? [];
    const longformCaptionRenderMode = getLongformCaptionRenderMode(
      props.captionProfileId as "longform_svg_typography_v1"
    );
    const explicitDataState = resolveProjectScopedExplicitDataState({
      captionChunksOverride: props.captionChunksOverride,
      motionModelOverride: props.motionModelOverride
    });
    const diagnosticWarnings = buildProjectScopedDiagnosticWarnings({
      videoSrc: null,
      studioSampleId: null,
      invalidStudioSampleId: null,
      videoValidationState: "missing",
      videoValidationMessage: null,
      captionChunks,
      fontRuntimeWarning: null
    });

    expect(explicitDataState).toEqual({
      captionChunksCount: 0,
      motionChunksCount: 0,
      hasExplicitCaptions: false,
      hasExplicitMotion: false
    });
    expect(
      resolveProjectScopedCaptionRuntimeDiagnostics({
        presentationMode: "long-form",
        hideCaptionOverlays: false,
        longformCaptionRenderMode,
        captionChunks,
        cinematicCaptionChunks: [],
        svgCaptionChunks: []
      })
    ).toEqual({
      activeCaptionRenderer: "svg",
      captionDomNodesExpected: false
    });
    expect(diagnosticWarnings).toContain(PROJECT_SCOPED_STUDIO_ASSET_BINDING_MESSAGE);
    expect(diagnosticWarnings).toContain(
      "No video source provided. Provide videoSrc or studioSampleId in props to preview project-scoped composition."
    );
    expect(diagnosticWarnings).toContain("No caption chunks are loaded. Paste real caption data into the Studio props panel.");
  });

  it("does not derive a fallback playback src when videoSrc is missing and exposes a clean empty-state warning", () => {
    expect(
      resolveProjectScopedPlaybackVideoSrc({
        videoSrc: undefined,
        isRendering: false,
        usePreviewProxyForVideoSrc: false
      })
    ).toBeNull();

    expect(
      buildProjectScopedDiagnosticWarnings({
        videoSrc: null,
        studioSampleId: null,
        invalidStudioSampleId: null,
        videoValidationState: "missing",
        videoValidationMessage: null,
        captionChunks: [],
        fontRuntimeWarning: null
      })
    ).toContain("No video source provided. Provide videoSrc or studioSampleId in props to preview project-scoped composition.");
  });

  it("publishes only curated Studio sample assets that exist on disk", () => {
    const sampleIds = getProjectScopedStudioSampleIds();

    expect(sampleIds).toEqual(PROJECT_SCOPED_STUDIO_SAMPLE_ASSETS.map((asset) => asset.id));

    for (const asset of PROJECT_SCOPED_STUDIO_SAMPLE_ASSETS) {
      expect(getProjectScopedStudioSampleAsset(asset.id)).toEqual(asset);
      expect(asset.videoSrc).toContain(asset.publicPath.replace(/\\/g, "/"));
      expect(
        readFileSync(path.resolve("public", ...asset.publicPath.split("/"))).byteLength
      ).toBeGreaterThan(0);
    }
  });

  it("keeps sample props explicit and inactive unless a studio sample id is requested", () => {
    const defaultProps = buildProjectScopedStudioDefaultProps("longform_svg_typography_v1");
    const sampleProps = buildProjectScopedStudioSampleProps("patrick-bet-david-part-01", "longform_svg_typography_v1");

    expect(defaultProps.studioSampleId).toBeUndefined();
    expect(sampleProps.studioSampleId).toBe("patrick-bet-david-part-01");
    expect(sampleProps.videoSrc).toBeNull();
    expect(sampleProps.captionChunksOverride).toEqual([]);
    expect(sampleProps.motionModelOverride).toBeNull();
    expect(sampleProps.livePreviewSession).toBeNull();
  });

  it("accepts each curated Studio sample id through the Remotion schema", () => {
    for (const sampleId of getProjectScopedStudioSampleIds()) {
      expect(projectScopedStudioPropsSchema.safeParse({studioSampleId: sampleId}).success).toBe(true);
      expect(
        projectScopedStudioPropsSchema.safeParse({
          studioSampleId: sampleId,
          studioTypographySample: true
        }).success
      ).toBe(true);
    }
  });

  it("creates visible caption chunks only when the explicit Studio typography sample is requested", () => {
    const sampleProps = buildProjectScopedStudioTypographySampleProps(
      "male-head-longform-dataset",
      "longform_svg_typography_v1"
    );
    const captionChunks = resolveProjectScopedCaptionChunks({
      captionChunksOverride: sampleProps.captionChunksOverride,
      livePreviewSession: sampleProps.livePreviewSession,
      captionProfileId: "longform_svg_typography_v1",
      studioTypographySample: sampleProps.studioTypographySample
    });

    expect(sampleProps.studioTypographySample).toBe(true);
    expect(PROJECT_SCOPED_STUDIO_TYPOGRAPHY_SAMPLE_PROP_GUIDANCE).toContain("\"studioTypographySample\": true");
    expect(PROJECT_SCOPED_STUDIO_TYPOGRAPHY_SAMPLE_PROP_GUIDANCE).toContain("\"captionProfileId\": \"longform_svg_typography_v1\"");
    expect(PROJECT_SCOPED_STUDIO_TYPOGRAPHY_SAMPLE_PROP_GUIDANCE).toContain("\"motionTier\": \"premium\"");
    expect(captionChunks.map((chunk) => chunk.text)).toEqual([
      "PROMETHEUS PREVIEW",
      "TYPOGRAPHY SYSTEM ONLINE",
      "CLIENT DATA ONLY"
    ]);
    expect(captionChunks.every((chunk) => isSvgCaptionChunk(chunk))).toBe(true);
  });

  it("resolves a known studioSampleId to a curated public video asset", () => {
    const resolved = resolveProjectScopedStudioVideoBinding({
      videoSrc: null,
      studioSampleId: "male-head-longform-dataset"
    });

    expect(resolved.normalizedVideoSrc).toBeNull();
    expect(resolved.invalidStudioSampleId).toBeNull();
    expect(resolved.resolvedStudioSample?.id).toBe("male-head-longform-dataset");
    expect(resolved.resolvedVideoSrc).toContain("datasets/male-head-raw-longform/input-video-landscape.mp4");
  });

  it("still derives real caption chunks from explicit live session data when no override is passed", () => {
    const captionChunks = resolveProjectScopedCaptionChunks({
      captionChunksOverride: [],
      captionProfileId: "longform_svg_typography_v1",
      livePreviewSession: {
        sessionId: "project-a",
        status: "preview_text_ready",
        previewStatus: "preview_text_ready",
        transcriptStatus: "full_transcript_ready",
        analysisStatus: "analysis_ready",
        motionGraphicsStatus: "motion_graphics_ready",
        renderStatus: "idle",
        sourceLabel: "Project A",
        sourceFilename: "project-a.mp4",
        sourceHasVideo: true,
        sourceWidth: 1920,
        sourceHeight: 1080,
        sourceFps: 30,
        sourceDurationMs: 12000,
        previewLines: ["Project A live preview"],
        previewMotionSequence: [],
        transcriptWords: [
          {text: "Project", start_ms: 0, end_ms: 160},
          {text: "A", start_ms: 160, end_ms: 260},
          {text: "live", start_ms: 260, end_ms: 460},
          {text: "preview", start_ms: 460, end_ms: 860}
        ]
      }
    });

    expect(captionChunks.length).toBeGreaterThan(0);
    expect(captionChunks.map((chunk) => chunk.text).join(" ")).toContain("Project");
  });

  it("keeps captions visible and reports typography diagnostics without ghost house-font warnings", () => {
    const sampleProps = buildProjectScopedStudioTypographySampleProps(
      "male-head-longform-dataset",
      "longform_svg_typography_v1"
    );
    const captionChunks = resolveProjectScopedCaptionChunks({
      captionChunksOverride: sampleProps.captionChunksOverride,
      livePreviewSession: sampleProps.livePreviewSession,
      captionProfileId: "longform_svg_typography_v1",
      studioTypographySample: sampleProps.studioTypographySample
    });
    const captionRuntime = resolveProjectScopedCaptionRuntimeDiagnostics({
      presentationMode: "long-form",
      hideCaptionOverlays: false,
      longformCaptionRenderMode: getLongformCaptionRenderMode("longform_svg_typography_v1"),
      captionChunks,
      cinematicCaptionChunks: [],
      svgCaptionChunks: captionChunks.filter((chunk) => isSvgCaptionChunk(chunk))
    });
    const typographyDiagnostics = resolveProjectScopedTypographyDiagnostics({
      captionChunks,
      activeCaptionRenderer: captionRuntime.activeCaptionRenderer,
      fontRuntimeLoaded: true,
      fontRuntimeWarning: null,
      requestedFontFamilies: ["Great Vibes", "Bebas Neue"]
    });

    expect(captionRuntime).toEqual({
      activeCaptionRenderer: "svg",
      captionDomNodesExpected: true
    });
    expect(typographyDiagnostics.activeFallbackFamily).toBe("Great Vibes");
    expect(typographyDiagnostics.fontRuntimeLoaded).toBe(true);
    expect(typographyDiagnostics.warning).toBeNull();
    expect(
      buildProjectScopedDiagnosticWarnings({
        videoSrc: "/sample.mp4",
        studioSampleId: "male-head-longform-dataset",
        invalidStudioSampleId: null,
        videoValidationState: "ready",
        videoValidationMessage: null,
        captionChunks,
        fontRuntimeWarning: typographyDiagnostics.warning
      })
    ).not.toContain("House fonts unavailable — using fallback typography.");
  });

  it("uses a live-preview-specific warning when no session caption data is ready yet", () => {
    expect(
      buildProjectScopedDiagnosticWarnings({
        videoSrc: "http://127.0.0.1:8000/api/edit-sessions/project-a/source",
        studioSampleId: null,
        invalidStudioSampleId: null,
        videoValidationState: "ready",
        videoValidationMessage: null,
        captionChunks: [],
        fontRuntimeWarning: null,
        diagnosticSurface: "live-preview"
      })
    ).toContain(
      "No caption chunks are available yet. Waiting for session.transcriptWords, previewMotionSequence, or previewLines before rendering typography."
    );
  });

  it("keeps the project-scoped video treatment mounted through the cinematic backdrop and vignette layers", () => {
    const source = readFileSync(path.resolve("src/compositions/ProjectScopedMotionComposition.tsx"), "utf8");

    expect(source).toContain("<MotionVideoBackdrop");
    expect(source).toContain("<CaptionFocusVignette");
  });

  it("surfaces a non-fatal invalid-video diagnostic without relying on polluted Studio defaults", () => {
    const sampleProps = buildProjectScopedStudioSampleProps("patrick-bet-david-part-01", "longform_svg_typography_v1");

    expect(
      buildProjectScopedDiagnosticWarnings({
        videoSrc: "/bad/stale.mp4",
        studioSampleId: sampleProps.studioSampleId,
        invalidStudioSampleId: null,
        videoValidationState: "error",
        videoValidationMessage: "Video source failed to load: /bad/stale.mp4 (Code 4)",
        captionChunks: sampleProps.captionChunksOverride ?? [],
        fontRuntimeWarning: null
      })
    ).toContain("Video source failed to load: /bad/stale.mp4 (Code 4)");
  });

  it("falls back safely when studioSampleId is invalid instead of crashing", () => {
    const resolved = resolveProjectScopedStudioVideoBinding({
      videoSrc: null,
      studioSampleId: "unknown-sample"
    });

    expect(resolved.resolvedVideoSrc).toBeNull();
    expect(resolved.invalidStudioSampleId).toBe("unknown-sample");
    expect(
      buildProjectScopedDiagnosticWarnings({
        videoSrc: resolved.resolvedVideoSrc,
        studioSampleId: resolved.normalizedStudioSampleId,
        invalidStudioSampleId: resolved.invalidStudioSampleId,
        videoValidationState: "missing",
        videoValidationMessage: null,
        captionChunks: [],
        fontRuntimeWarning: null
      })
    ).toContain(
      `Unknown studioSampleId "unknown-sample". Valid sample ids: ${getProjectScopedStudioSampleIds().join(", ")}.`
    );
  });

  it("lets explicit videoSrc override studioSampleId", () => {
    const resolved = resolveProjectScopedStudioVideoBinding({
      videoSrc: "http://127.0.0.1:8000/api/edit-sessions/project-a/source",
      studioSampleId: "unknown-sample"
    });

    expect(resolved.normalizedVideoSrc).toBe("http://127.0.0.1:8000/api/edit-sessions/project-a/source");
    expect(resolved.resolvedVideoSrc).toBe("http://127.0.0.1:8000/api/edit-sessions/project-a/source");
    expect(resolved.resolvedStudioSample).toBeNull();
    expect(resolved.invalidStudioSampleId).toBeNull();
  });
});

