import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

vi.mock("@remotion/media", async () => {
  const ReactModule = await import("react");
  return {
    Video: ({src, trimBefore, trimAfter, playbackRate, ...props}: any) => ReactModule.createElement("video", {
      src,
      "data-trim-before": trimBefore,
      "data-trim-after": trimAfter,
      "data-playback-rate": playbackRate,
      ...props,
    }),
  };
});

vi.mock("remotion", async () => {
  const actual = await vi.importActual<any>("remotion");
  const ReactModule = await import("react");
  return {
    ...actual,
    Img: ({src, ...props}: any) => ReactModule.createElement("img", {src, ...props}),
  };
});

import {
  MaulVisualInterval,
  buildMaulVisualSequenceDurations,
} from "../MaulVisualTrack";

const track = {
  schemaVersion: "maul-visual-track/v1",
  projectId: "project_a",
  rootSourceAssetId: "source",
  sourceAssetId: "source",
  outputDurationMs: 10_000,
  assets: [
    {assetId: "source", mediaKind: "video", storagePath: "source.mp4"},
    {assetId: "broll", mediaKind: "video", storagePath: "b-roll.mp4"},
    {assetId: "evidence", mediaKind: "image", storagePath: "evidence.png"},
  ],
  intervals: [
    {intervalId: "hero", outputStartMs: 0, outputEndMs: 2_000, sourceStartMs: 10_000, sourceEndMs: 13_000, mode: "speaker_hero", assetId: "source", secondaryAssetId: null, crop: {x: 0, y: 0, width: 1, height: 1}, purpose: "Speaker", evidenceRationale: "Source", transition: {type: "hard_cut", durationMs: 0}},
    {intervalId: "broll", outputStartMs: 2_000, outputEndMs: 5_000, mode: "b_roll", assetId: "broll", secondaryAssetId: null, crop: {x: 0, y: 0, width: 1, height: 1}, purpose: "Coverage", evidenceRationale: "Approved", transition: {type: "fade", durationMs: 180}},
    {intervalId: "split", outputStartMs: 5_000, outputEndMs: 8_000, mode: "split_proof", assetId: "source", secondaryAssetId: "evidence", crop: {x: 0, y: 0, width: 1, height: 1}, purpose: "Proof", evidenceRationale: "Approved", transition: {type: "hard_cut", durationMs: 0}},
    {intervalId: "hold", outputStartMs: 8_000, outputEndMs: 10_000, mode: "quiet_hold", assetId: "source", secondaryAssetId: null, crop: {x: 0, y: 0, width: 1, height: 1}, purpose: "Hold", evidenceRationale: "Pause", transition: {type: "hard_cut", durationMs: 0}},
  ],
} as any;

describe("MAUL visual track renderer", () => {
  it("renders declared video and still assets through the correct media primitives", () => {
    const brollMarkup = renderToStaticMarkup(<MaulVisualInterval track={track} interval={track.intervals[1]} outputFrame={0} fps={30} />);
    const evidenceMarkup = renderToStaticMarkup(<MaulVisualInterval track={track} interval={{...track.intervals[2], mode: "evidence_image", assetId: "evidence", secondaryAssetId: null}} outputFrame={0} fps={30} />);
    expect(brollMarkup).toContain('data-maul-visual-media="video"');
    expect(brollMarkup).toContain("b-roll.mp4");
    expect(evidenceMarkup).toContain('data-maul-visual-media="image"');
    expect(evidenceMarkup).toContain("evidence.png");
  });

  it("trims source-backed intervals to their governed source range", () => {
    const markup = renderToStaticMarkup(<MaulVisualInterval track={track} interval={track.intervals[0]} outputFrame={0} fps={30} />);
    expect(markup).toContain('data-trim-before="300"');
    expect(markup).toContain('data-trim-after="390"');
    expect(markup).toContain('data-playback-rate="1.5"');
  });

  it("keeps split proof in fixed portrait-safe regions and preserves quiet timing", () => {
    const markup = renderToStaticMarkup(<MaulVisualInterval track={track} interval={track.intervals[2]} outputFrame={0} fps={30} />);
    expect(markup).toContain('data-maul-split-region="speaker"');
    expect(markup).toContain('data-maul-split-region="evidence"');
    expect(markup).toContain("width:58%");
    expect(buildMaulVisualSequenceDurations(track, 30).at(-1)).toEqual({from: 240, durationInFrames: 60});
  });
});
