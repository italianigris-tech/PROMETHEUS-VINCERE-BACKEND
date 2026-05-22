import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";

import {HyperframesPreview} from "../HyperframesPreview";
import {
  seekHyperframesTimelineToFrame
} from "../hyperframes/timeline.worker";
import {loadManifestFontsForManifest} from "../hyperframes/manifest-typography";
import type {HyperframesPreviewManifest} from "../hyperframes/manifest-schema";

const remotionMocks = vi.hoisted(() => ({
  continueRender: vi.fn(),
  delayRender: vi.fn((label?: string) => `handle:${label ?? "default"}`),
  staticFile: vi.fn((assetPath: string) => `/static/${assetPath}`),
  useCurrentFrame: vi.fn(() => 45),
  useVideoConfig: vi.fn(() => ({fps: 30}))
}));

vi.mock("remotion", () => remotionMocks);
vi.mock("../NativePreviewStage", () => ({
  NativePreviewOverlayStage: () => null
}));

const buildManifest = (): HyperframesPreviewManifest => ({
  schemaVersion: "hyperframes-preview-manifest/v1",
  sessionId: "session-font-obedience",
  captionProfileId: "longform_svg_typography_v1",
  motionTier: "premium",
  lanes: {
    defaultInteractive: "hyperframes",
    interactive: ["hyperframes"],
    export: "remotion"
  },
  routes: {
    status: "/api/edit-sessions/session-font-obedience/status",
    preview: "/api/edit-sessions/session-font-obedience/preview",
    render: "/api/edit-sessions/session-font-obedience/render",
    renderStatus: "/api/edit-sessions/session-font-obedience/render-status",
    sourceMedia: "/api/edit-sessions/session-font-obedience/source"
  },
  baseVideo: {
    src: "/api/edit-sessions/session-font-obedience/source",
    sourceKind: "session_source_stream",
    sourceLabel: "obedience.mp4",
    hasVideo: true,
    width: 1920,
    height: 1080,
    fps: 30,
    durationMs: 12000
  },
  audio: {
    src: null,
    source: "video-element"
  },
  session: {
    id: "session-font-obedience",
    status: "preview_text_ready",
    previewStatus: "preview_text_ready",
    transcriptStatus: "full_transcript_ready",
    analysisStatus: "analysis_ready",
    motionGraphicsStatus: "motion_graphics_ready",
    renderStatus: "idle",
    previewText: "Luxury fonts only",
    previewLines: ["Luxury fonts only"],
    previewMotionSequence: [
      {
        cueId: "cue-1",
        text: "Luxury fonts only",
        startMs: 0,
        durationMs: 900,
        lineIndex: 0
      }
    ],
    transcriptWords: [
      {
        text: "Luxury",
        start_ms: 0,
        end_ms: 200
      }
    ],
    errorMessage: null,
    sourceFilename: "obedience.mp4",
    sourceDurationMs: 12000,
    sourceAspectRatio: "16:9",
    sourceWidth: 1920,
    sourceHeight: 1080,
    sourceFps: 30,
    sourceHasVideo: true,
    lastEventType: "preview_text_ready",
    previewPlaceholder: {
      active: false,
      styleId: "longform_svg_typography_v1",
      copy: "Luxury fonts only",
      reason: "waiting_for_audio",
      line1: "Luxury fonts only",
      line2: null
    },
    renderOutputUrl: null,
    renderOutputPath: null
  },
  overlayPlan: {
    previewText: "Luxury fonts only",
    previewLines: ["Luxury fonts only"],
    previewMotionSequence: [
      {
        cueId: "cue-1",
        text: "Luxury fonts only",
        startMs: 0,
        durationMs: 900,
        lineIndex: 0
      }
    ],
    transcriptWords: [
      {
        text: "Luxury",
        start_ms: 0,
        end_ms: 200
      }
    ],
    placeholder: {
      active: false,
      styleId: "longform_svg_typography_v1",
      copy: "Luxury fonts only",
      reason: "waiting_for_audio",
      line1: "Luxury fonts only",
      line2: null
    }
  },
  typography: {
    primaryFont: {
      family: "Aesthetic",
      sources: [
        {
          publicPath: "fonts/library/aesthetic/aesthetic-regular-b3500383bd34.woff2",
          format: "woff2",
          weight: 400,
          style: "normal"
        }
      ]
    },
    secondaryFont: {
      family: "Almera",
      sources: [
        {
          publicPath: "fonts/library/almera/almera-baa51ed42a1d.woff2",
          format: "woff2",
          weight: 400,
          style: "normal"
        }
      ]
    }
  },
  export: {
    remotion: {
      available: true,
      renderStatus: "idle",
      outputUrl: null,
      outputPath: null
    }
  }
}) as HyperframesPreviewManifest;

const buildDisplayTimeline = () => ({
  id: "display-god-obedience",
  jobId: "session-font-obedience",
  renderMode: "overlay-preview",
  durationMs: 12000,
  captionProfileId: "longform_svg_typography_v1",
  baseVideo: {
    src: "/api/edit-sessions/session-font-obedience/source",
    width: 1920,
    height: 1080,
    fps: 30,
    durationMs: 12000,
    sourceLabel: "obedience.mp4"
  },
  audio: {
    src: null,
    source: "video-element"
  },
  captions: [],
  layers: [
    {
      id: "track-1",
      kind: "creative-track",
      mediaKind: "none",
      label: "text:track-1",
      startMs: 0,
      endMs: 900,
      zIndex: 20,
      visual: true,
      opacity: 1,
      placement: {
        leftPercent: 50,
        topPercent: 50,
        widthPercent: 50,
        heightPercent: 20,
        anchor: "center"
      },
      transform: {
        translateX: 0,
        translateY: 0,
        scale: 1,
        rotateDeg: 0
      },
      easing: {
        enter: "power3.out",
        exit: "power2.in"
      },
      styleMetadata: {
        trackType: "text",
        title: "Luxury fonts only",
        text: "No frontend guessing.",
        backgroundStyle: "glass-gradient"
      },
      syncQuality: "not-applicable"
    }
  ],
  creativeTimeline: {
    id: "creative-timeline-obedience",
    sourceJobId: "session-font-obedience",
    durationMs: 12000,
    moments: [],
    decisions: [],
    tracks: [],
    diagnostics: {
      proposalCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      renderCost: "low",
      mattingWindows: [],
      warnings: []
    }
  },
  motionModel: {
    tier: "premium",
    motion3DPlan: {
      enabled: false
    },
    backgroundOverlayPlan: {
      cues: []
    },
    transitionOverlayPlan: {
      cues: []
    },
    showcasePlan: {
      cues: []
    },
    soundDesignPlan: {
      musicCues: [],
      cues: []
    },
    scenes: [],
    motionGraphicsPlan: {
      enabled: false,
      sceneMap: {},
      disableLegacyBackgroundOverlay: false
    },
    captionBias: "auto"
  },
  exportMetadata: {
    creativeTimelineId: "creative-timeline-obedience",
    sourceJobId: "session-font-obedience",
    renderMode: "overlay-preview",
    trackCount: 0,
    momentCount: 0
  }
}) as any;

describe("frontend obedience", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("Remotion stage triggers delayRender and waits for document.fonts.ready before continuing", async () => {
    let resolveReady!: () => void;
    const fontsReady = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const mockDocument = {
      fonts: {
        add: vi.fn(),
        check: vi.fn(() => false),
        ready: fontsReady
      }
    };
    class MockFontFace {
      public constructor(
        public readonly family: string,
        public readonly source: string
      ) {}

      public load = vi.fn(async () => this);
    }

    vi.stubGlobal("document", mockDocument);
    vi.stubGlobal("FontFace", MockFontFace as unknown as typeof FontFace);

    const loadPromise = loadManifestFontsForManifest(buildManifest());

    expect(remotionMocks.delayRender).toHaveBeenCalled();
    expect(remotionMocks.continueRender).not.toHaveBeenCalled();

    resolveReady();
    await loadPromise;

    expect(mockDocument.fonts.add).toHaveBeenCalledTimes(2);
    expect(remotionMocks.continueRender).toHaveBeenCalledTimes(1);
  });

  test("gsap-executor does not auto-play; it strictly seeks timeline based on currentFrame / fps", () => {
    const mockTimeline = {
      seek: vi.fn(),
      play: vi.fn(),
      kill: vi.fn()
    };

    seekHyperframesTimelineToFrame({
      timeline: mockTimeline as any,
      currentFrame: 45,
      fps: 30
    });

    expect(mockTimeline.play).not.toHaveBeenCalled();
    expect(mockTimeline.seek).toHaveBeenCalledWith(1.5, false);
  });

  test("HyperframesPreview injects dynamic font-family from manifest, strictly rejecting DM Serif defaults", () => {
    const markup = renderToStaticMarkup(
      <HyperframesPreview
        displayTimeline={buildDisplayTimeline()}
        manifest={buildManifest()}
        previewPerformanceMode="balanced"
      />
    );

    expect(markup).toContain("Aesthetic");
    expect(markup).not.toContain("DM Serif Display");
    expect(markup).not.toContain("Playfair Display");
  });
});
