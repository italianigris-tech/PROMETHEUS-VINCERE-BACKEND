import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

const baseProps = {
  sourceAsset: ".maul-renders/render-a/source.mp4",
  musicAsset: ".maul-renders/render-a/music.wav",
  sfxAssets: [{id: "hit", eventType: "resolve_hit", outputMs: 3000, asset: ".maul-renders/render-a/hit.wav"}],
  audioPlanId: "audio_plan_1",
  captions: [
    {text: "This", startMs: 0, endMs: 300, timestampMs: 0, confidence: 0.99},
    {text: "works.", startMs: 320, endMs: 800, timestampMs: 320, confidence: 0.99}
  ],
  timeline: {
    sourceAssetId: "source_1",
    analysisArtifactId: "analysis_1",
    sourceDurationMs: 5000,
    outputDurationMs: 4000,
    selectedClipWindows: [{sourceStartMs: 0, sourceEndMs: 5000}],
    cutCandidates: [{sourceStartMs: 2000, sourceEndMs: 3000, sentenceSafe: true, reason: "dead air", confidence: 1}],
    protectedRanges: [],
    timestampMap: [
      {sourceStartMs: 0, sourceEndMs: 2000, outputStartMs: 0, outputEndMs: 2000, mode: "keep"},
      {sourceStartMs: 2000, sourceEndMs: 3000, outputStartMs: 2000, outputEndMs: 2000, mode: "cut"},
      {sourceStartMs: 3000, sourceEndMs: 5000, outputStartMs: 2000, outputEndMs: 4000, mode: "keep"}
    ],
    speakerCropTracks: [{speakerId: "speaker", outputStartMs: 0, outputEndMs: 4000, crop: {x: 0.36, y: 0, width: 0.3164, height: 1}}],
    editRationale: ["Mapped"],
    qualityWarnings: []
  }
};

describe("MAUL Remotion short composition", () => {
  it("leaves V3 audio to the backend master mux", async () => {
    const module = await import("../MaulShort").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    expect(module.shouldMaulRemotionRenderAudio({schemaVersion: "maul-unified-short-render-manifest/v3"} as any)).toBe(false);
    expect(module.shouldMaulRemotionRenderAudio({schemaVersion: "maul-unified-short-render-manifest/v2"} as any)).toBe(true);
  });

  it("suppresses only typography for canonical observation controls", async () => {
    const module = await import("../MaulShort").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    expect(module.shouldRenderMaulTypography("creative")).toBe(true);
    expect(module.shouldRenderMaulTypography("typography_suppressed")).toBe(false);
    expect(module.shouldRenderMaulTypography(undefined)).toBe(true);
  });

  it("renders governed padded non-source regions", async () => {
    const module = await import("../MaulShort").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    const markup = renderToStaticMarkup(
      React.createElement(module.MaulPaddedSourceRegions, {
        regions: [{x: 0, y: 0.75, width: 1, height: 0.25}],
        background: "#091218",
      }),
    );

    expect(markup).toContain('data-maul-padded-source-region="0"');
    expect(markup).toContain("left:0%");
    expect(markup).toContain("top:75%");
    expect(markup).toContain("width:100%");
    expect(markup).toContain("height:25%");
  });

  it("executes the full governed crop box", async () => {
    const module = await import("../MaulShort").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    expect(
      module.buildMaulPlannedSourceVideoStyle({
        crop: {x: 0.2, y: 0.1, width: 0.5, height: 0.8},
        scale: {x: 1.1, y: 1.2},
      }),
    ).toEqual({
      left: "-40%",
      top: "-12.5%",
      width: "200%",
      height: "125%",
      objectFit: "fill",
      objectPosition: "center",
      transform: "scale(1.1, 1.2)",
      transformOrigin: "45% 50%",
    });
  });

  it("keeps governed camera scale continuous across a source Sequence boundary", async () => {
    const module = await import("../MaulShort").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    const event = {
      outputStartMs: 0,
      outputEndMs: 1000,
      startScale: 1,
      endScale: 1.12,
    };
    const priorGlobalFrame = module.toMaulManifestGlobalFrame({
      sequenceFrom: 0,
      sequenceFrame: 14,
    });
    const nextGlobalFrame = module.toMaulManifestGlobalFrame({
      sequenceFrom: 15,
      sequenceFrame: 0,
    });
    const before = module.resolveMaulCameraScale({
      events: [event],
      outputFrame: priorGlobalFrame,
      fps: 30,
    });
    const after = module.resolveMaulCameraScale({
      events: [event],
      outputFrame: nextGlobalFrame,
      fps: 30,
    });

    expect(nextGlobalFrame).toBe(15);
    expect(after).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(
      module.resolveMaulCameraScale({events: [event], outputFrame: 0, fps: 30}),
    );
  });

  it("holds the preceding camera scale between governed events", async () => {
    const module = await import("../MaulShort").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    expect(
      module.resolveMaulCameraScale({
        events: [
          {
            outputStartMs: 0,
            outputEndMs: 1000,
            startScale: 1,
            endScale: 1.1,
          },
          {
            outputStartMs: 2000,
            outputEndMs: 3000,
            startScale: 1.2,
            endScale: 1.3,
          },
        ],
        outputFrame: 45,
        fps: 30,
      }),
    ).toBe(1.1);
  });

  it("uses dynamic 9:16 metadata and omits cut segments", async () => {
    const module = await import("../MaulShort").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    expect(Object.keys(module.MAUL_SHORT_DEFAULT_PROPS)).toEqual(["manifest"]);
    expect(module.calculateMaulShortMetadata({
      props: {
        manifest: {...module.MAUL_SHORT_DEFAULT_PROPS.manifest, timeline: baseProps.timeline}
      } as any
    })).toEqual(
      expect.objectContaining({durationInFrames: 120, width: 1080, height: 1920, fps: 30})
    );
    expect(module.buildMaulSourceSequences(baseProps.timeline as any, 30)).toEqual([
      {from: 0, durationInFrames: 60, trimBefore: 0, trimAfter: 60, playbackRate: 1},
      {from: 60, durationInFrames: 60, trimBefore: 90, trimAfter: 150, playbackRate: 1}
    ]);
    expect(module.buildMaulSourceSequences({
      ...baseProps.timeline,
      timestampMap: [
        {sourceStartMs: 0, sourceEndMs: 1000, outputStartMs: 0, outputEndMs: 500, mode: "keep"}
      ]
    } as any, 30)).toEqual([
      {from: 0, durationInFrames: 15, trimBefore: 0, trimAfter: 30, playbackRate: 2}
    ]);
  });

  it("compiles visibly distinct motion and caption styles for all three treatments", async () => {
    const module = await import("../MaulShort").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    const styles = ["founder_podcast", "premium_direct_response", "minimal_expert"]
      .map((treatmentId) => module.buildMaulVisualStyle(treatmentId));
    expect(new Set(styles.map((style) => style.captionAccent)).size).toBe(3);
    expect(new Set(styles.map((style) => style.motionAmplitude)).size).toBe(3);
    expect(styles.every((style) => style.safeBottomPx >= 280)).toBe(true);
  });

  it("keeps caption words separated when Remotion supplies punctuation as a separate token", async () => {
    const module = await import("../MaulShort").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    expect(module.joinMaulCaptionTokens([
      {text: "Last", fromMs: 0, toMs: 220},
      {text: "week", fromMs: 220, toMs: 480},
      {text: ".", fromMs: 480, toMs: 510},
      {text: "We", fromMs: 560, toMs: 700},
      {text: "tested", fromMs: 700, toMs: 990}
    ])).toBe("Last week. We tested");
    expect(module.joinMaulCaptionTokens([
      {text: "(", fromMs: 0, toMs: 20},
      {text: "hello", fromMs: 20, toMs: 200},
      {text: ")", fromMs: 200, toMs: 220}
    ])).toBe("(hello)");
  });

  it("falls back to ungoverned empty caption groups for the Studio fixture", async () => {
    const module = await import("../MaulShort").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    expect(
      module.resolveMaulCaptionPlans(module.MAUL_SHORT_DEFAULT_PROPS.manifest),
    ).toEqual({captionGroups: [], captionGroupsAreGoverned: false});
  });

  it("uses governed semantic chunk groups as caption page boundaries", async () => {
    const module = await import("../MaulShort").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    const pages = module.buildMaulCaptionPages({
      captions: [
        {text: "This", startMs: 0, endMs: 250, timestampMs: 0, confidence: 0.99},
        {text: "claim", startMs: 270, endMs: 600, timestampMs: 270, confidence: 0.99},
        {text: "matters.", startMs: 620, endMs: 1050, timestampMs: 620, confidence: 0.99},
        {text: "Start", startMs: 1070, endMs: 1400, timestampMs: 1070, confidence: 0.99},
        {text: "now.", startMs: 1420, endMs: 1800, timestampMs: 1420, confidence: 0.99}
      ],
      captionGroups: [
        {
          text: "This claim matters.",
          outputStartMs: 0,
          outputEndMs: 1050,
          sourceGrounded: true,
          role: "dialogue_caption"
        },
        {
          text: "Start now.",
          outputStartMs: 1070,
          outputEndMs: 1800,
          sourceGrounded: true,
          role: "dialogue_caption"
        }
      ],
      captionGroupsAreGoverned: true,
      combineTokensWithinMilliseconds: 1450
    });

    expect(pages.map((page) => ({
      text: module.joinMaulCaptionTokens(page.tokens),
      startMs: page.startMs,
      endMs: page.plannedEndMs
    }))).toEqual([
      {text: "This claim matters.", startMs: 0, endMs: 1050},
      {text: "Start now.", startMs: 1070, endMs: 1800}
    ]);
  });

  it("keeps legacy beat groups on the original caption pagination path", async () => {
    const module = await import("../MaulShort").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    const pages = module.buildMaulCaptionPages({
      captions: [
        {text: "First", startMs: 0, endMs: 200, timestampMs: 0, confidence: 0.99},
        {text: "thought.", startMs: 220, endMs: 450, timestampMs: 220, confidence: 0.99},
        {text: "Second", startMs: 1700, endMs: 1900, timestampMs: 1700, confidence: 0.99},
        {text: "thought.", startMs: 1920, endMs: 2200, timestampMs: 1920, confidence: 0.99}
      ],
      captionGroups: [
        {
          text: "First thought. Second thought.",
          outputStartMs: 0,
          outputEndMs: 2200,
          sourceGrounded: true,
          role: "dialogue_caption"
        }
      ],
      captionGroupsAreGoverned: false,
      combineTokensWithinMilliseconds: 500
    });
    const originalPagination = module.buildMaulCaptionPages({
      captions: [
        {text: "First", startMs: 0, endMs: 200, timestampMs: 0, confidence: 0.99},
        {text: "thought.", startMs: 220, endMs: 450, timestampMs: 220, confidence: 0.99},
        {text: "Second", startMs: 1700, endMs: 1900, timestampMs: 1700, confidence: 0.99},
        {text: "thought.", startMs: 1920, endMs: 2200, timestampMs: 1920, confidence: 0.99}
      ],
      captionGroups: [],
      captionGroupsAreGoverned: false,
      combineTokensWithinMilliseconds: 500
    });

    expect(pages).toEqual(originalPagination);
    expect(pages.every((page) => page.plannedEndMs === null)).toBe(true);
  });
});
