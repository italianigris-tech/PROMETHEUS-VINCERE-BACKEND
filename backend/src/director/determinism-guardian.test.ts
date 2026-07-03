import {describe, expect, it} from "vitest";
import {createJosephDeterminismProof} from "./determinism-guardian";

const input = {
  videoUrl: "file:///video.mp4",
  musicTrackUrl: "file:///music.mp3",
  transcript: [
    {text: "Listen", startMs: 420, endMs: 680, confidence: 0.98},
    {text: "if", startMs: 700, endMs: 800, confidence: 0.95},
    {text: "you", startMs: 820, endMs: 900, confidence: 0.96},
    {text: "want", startMs: 920, endMs: 1100, confidence: 0.97},
    {text: "to", startMs: 1120, endMs: 1200, confidence: 0.94},
    {text: "win", startMs: 1220, endMs: 1500, confidence: 0.99},
  ],
  beats: [500, 900, 1300, 1800, 2200, 2700, 3200, 3600],
  onsets: [420, 1220],
  energyCurve: [0.25, 0.32, 0.78, 0.41, 0.86, 0.44, 0.72, 0.91],
  durationMs: 4000,
  seed: 12345,
  profile: "joseph_aggressive" as const,
};

const selectedPlannerCandidate = {
  plannerPathId: "path-hook-payoff",
  selectedCandidateId: "candidate-kinetic-pulse",
  genomeIds: ["genome-hook", "genome-payoff"],
  doctrineBranchIds: ["kinetic-pulse"],
  archiveCellKeys: ["expressive:dense:active:payoff"],
  treatmentFamily: "expressive-premium",
  finalTreatment: "background-overlay",
  retrievalIntent: "search-deeper",
  godEscalationIntent: "allowed-if-no-fit",
};

describe("Joseph Determinism Guardian", () => {
  it("proves compiler and render-frame determinism for identical inputs and governed variation differences", () => {
    const proof = createJosephDeterminismProof({
      input,
      selectedPlannerCandidate,
      variationKey: "variation-key-compile-v1",
      changedVariationKey: "variation-key-compile-v2",
    });

    expect(proof).toMatchObject({
      version: "joseph-determinism-guardian-v1",
      sameInput: {
        passed: true,
        selectedCandidateId: "candidate-kinetic-pulse",
        manifestHashStable: true,
        compiledManifestHashStable: true,
        renderFrameSignaturesStable: true,
        pixelTolerance: 0,
      },
      changedVariation: {
        passed: true,
        compiledManifestHashChanged: true,
        renderManifestHashChanged: true,
        governedDifferencePaths: [
          "plannerHandoff.variationKey",
          "plannerHandoff.compiledManifestHash",
        ],
      },
    });
    expect(proof.sameInput.frameProofSignatures.length).toBeGreaterThanOrEqual(3);
    expect(proof.sameInput.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(proof.sameInput.compiledManifestHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
