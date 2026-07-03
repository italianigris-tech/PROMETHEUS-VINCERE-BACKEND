import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach, describe, expect, it} from "vitest";

import {
  JOSEPH_STUDY_FAILURE_TAXONOMY_VERSION,
  captureJosephStudyFrameProof,
  captureJosephStudyReview,
  loadJosephStudyReviewLedger
} from "../joseph-study-review-ledger";
import {JosephStudyStudioView} from "../JosephStudyStudio";

const storage = (() => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    clear: () => data.clear()
  };
})();

afterEach(() => {
  storage.clear();
});

describe("Joseph study review capture", () => {
  it("persists and reloads review entries in a local ledger", () => {
    const first = captureJosephStudyReview(storage, {
      candidateId: "candidate-a",
      candidateLabel: "Candidate A",
      verdict: "preferred",
      failureTags: []
    });

    const second = captureJosephStudyReview(storage, {
      candidateId: "candidate-b",
      candidateLabel: "Candidate B",
      verdict: "failed",
      failureTaxonomyVersion: JOSEPH_STUDY_FAILURE_TAXONOMY_VERSION,
      failureTags: ["boring-under-editing", "readability-sacrifice"]
    });

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
    expect(loadJosephStudyReviewLedger(storage)).toEqual(second);
    expect(second[1]).toMatchObject({
      candidateId: "candidate-b",
      verdict: "failed",
      failureTaxonomyVersion: JOSEPH_STUDY_FAILURE_TAXONOMY_VERSION,
      failureTags: ["boring-under-editing", "readability-sacrifice"]
    });
  });
  it("captures frame proof metadata and attaches it to review entries", () => {
    const proof = captureJosephStudyFrameProof({
      candidateId: "candidate-b",
      frameNumber: 42,
      manifestHash: "abc123",
      activeDiagnosticIds: ["text", "evaluator"],
      failureTags: ["readability-sacrifice"],
      screenshotDataUrl: "data:image/png;base64,proof"
    });

    const ledger = captureJosephStudyReview(storage, {
      candidateId: "candidate-b",
      candidateLabel: "Candidate B",
      verdict: "failed",
      failureTags: ["readability-sacrifice"],
      frameProofs: [proof]
    });

    expect(proof).toMatchObject({
      version: "joseph-study-frame-proof-v1",
      candidateId: "candidate-b",
      frameNumber: 42,
      manifestHash: "abc123",
      activeDiagnosticIds: ["text", "evaluator"],
      failureTags: ["readability-sacrifice"],
      screenshotDataUrl: "data:image/png;base64,proof"
    });
    expect(ledger[0].frameProofs).toEqual([proof]);
    expect(loadJosephStudyReviewLedger(storage)[0].frameProofs).toEqual([proof]);
  });

  it("renders review capture controls and the stored ledger in the study surface", () => {
    const markup = renderToStaticMarkup(
      <JosephStudyStudioView
        state={{
          mode: "comparison",
          status: "ready",
          manifestUrls: ["/joseph-study/candidate-manifest.json", "/joseph-study/candidate-b-manifest.json"],
          lanes: [
            {id: "candidate-a", label: "Candidate A", manifestUrl: "/joseph-study/candidate-manifest.json", manifest: {jobId: "a", durationFrames: 1, fps: 30, width: 1080, height: 1920, videoTracks: [], cameraMoves: [], textOverlays: [], transitions: [], source: {videoUrl: "", durationMs: 0, width: 1080, height: 1920, fps: 30}, audio: {beats: [], onsets: [], sfx: [], voiceVolumeDb: 0, musicVolumeDb: 0, targetLufs: -14}, timeline: [], creativeProfile: {name: "x", cutDensity: 0, textDensity: 0, sfxDensity: 0, cameraAggression: 0, colorIntensity: 0}, output: {width: 1080, height: 1920, fps: 30, codec: "h264", crf: 18}, seed: 1, createdAt: "2026-01-01T00:00:00.000Z", version: "2.0"} as any},
            {id: "candidate-b", label: "Candidate B", manifestUrl: "/joseph-study/candidate-b-manifest.json", manifest: {jobId: "b", durationFrames: 1, fps: 30, width: 1080, height: 1920, videoTracks: [], cameraMoves: [], textOverlays: [], transitions: [], source: {videoUrl: "", durationMs: 0, width: 1080, height: 1920, fps: 30}, audio: {beats: [], onsets: [], sfx: [], voiceVolumeDb: 0, musicVolumeDb: 0, targetLufs: -14}, timeline: [], creativeProfile: {name: "y", cutDensity: 0, textDensity: 0, sfxDensity: 0, cameraAggression: 0, colorIntensity: 0}, output: {width: 1080, height: 1920, fps: 30, codec: "h264", crf: 18}, seed: 2, createdAt: "2026-01-01T00:00:00.000Z", version: "2.0"} as any}
          ]
        } as any}
      />
    );

    expect(markup).toContain('data-joseph-study-review-ledger="true"');
    expect(markup).toContain("Mark preferred");
    expect(markup).toContain("Mark failed");
    expect(markup).toContain("Capture frame proof");
    expect(markup).toContain("Boring Under Editing");
    expect(markup).toContain("Chaotic Over Editing");
    expect(markup).toContain("Cheap Template Motion");
    expect(markup).toContain("Readability Sacrifice");
  });
});
