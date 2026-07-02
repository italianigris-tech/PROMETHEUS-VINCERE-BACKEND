import {describe, expect, it} from "vitest";
import {generateJosephManifest, type DirectorInput} from "./joseph-director";

const inputWithWords = (words: string[]): DirectorInput => ({
  videoUrl: "/uploads/job-1/video.mp4",
  transcript: words.map((text, index) => ({
    text,
    startMs: index * 180,
    endMs: index * 180 + 140,
    confidence: 0.96,
  })),
  beats: [0, 500, 1000, 1500],
  onsets: [120, 620, 1120, 1620],
  energyCurve: [0.65, 0.82, 0.74, 0.9, 0.68],
  durationMs: 4000,
  seed: 76,
  profile: "joseph_aggressive",
});

describe("Joseph director semantic macro-rig gating", () => {
  it("adds the talking-head proof/data/exhibit rig only when the semantic trigger is valid", () => {
    const proofManifest = generateJosephManifest(
      inputWithWords(["Here", "is", "the", "proof", "data", "exhibit", "that", "changes", "the", "decision"]),
    );
    const genericManifest = generateJosephManifest(
      inputWithWords(["Move", "fast", "build", "momentum", "and", "win", "the", "day"]),
    );

    expect(proofManifest.josephMacroRig).toMatchObject({
      rigId: "talking-head-proof-data-exhibit",
      semanticTrigger: {
        valid: true,
        matchedSignals: expect.arrayContaining(["proof", "data", "exhibit"]),
      },
      renderFields: {
        pipPlan: proofManifest.josephPiP,
      },
    });
    expect(genericManifest.josephMacroRig).toBeUndefined();
  });
});
