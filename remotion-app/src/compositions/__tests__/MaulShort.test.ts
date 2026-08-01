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
      {from: 0, durationInFrames: 60, trimBefore: 0, trimAfter: 60},
      {from: 60, durationInFrames: 60, trimBefore: 90, trimAfter: 150}
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
  });
});
