import {describe, expect, it} from "vitest";
import {generateJosephManifest} from "./joseph-director";
import type {DirectorInput} from "./joseph-director";

const BASE_INPUT: DirectorInput = {
  videoUrl: "file:///test.mp4",
  musicTrackUrl: "file:///test.mp3",
  transcript: [
    {text: "Listen", startMs: 200, endMs: 420, confidence: 0.98},
    {text: "if", startMs: 430, endMs: 520, confidence: 0.95},
    {text: "you", startMs: 530, endMs: 620, confidence: 0.96},
    {text: "want", startMs: 630, endMs: 780, confidence: 0.97},
    {text: "to", startMs: 790, endMs: 860, confidence: 0.94},
    {text: "win", startMs: 870, endMs: 1080, confidence: 0.99},
    {text: "bigger", startMs: 1090, endMs: 1320, confidence: 0.97},
    {text: "today", startMs: 1330, endMs: 1580, confidence: 0.96},
  ],
  beats: [300, 620, 940, 1260, 1580],
  onsets: [200, 870, 1330],
  energyCurve: [0.25, 0.35, 0.82, 0.45, 0.68, 0.88],
  durationMs: 2000,
  seed: 12345,
  profile: "joseph_aggressive",
};

const canonicalizeManifest = (manifest: ReturnType<typeof generateJosephManifest>) => ({
  ...manifest,
  jobId: "<job-id>",
  createdAt: "<created-at>",
});

describe("generateJosephManifest v8.1 contract", () => {
  it("emits vertical 1080x1920 render metadata", () => {
    const manifest = generateJosephManifest(BASE_INPUT);

    expect(manifest.width).toBe(1080);
    expect(manifest.height).toBe(1920);
    expect(manifest.output.width).toBe(1080);
    expect(manifest.output.height).toBe(1920);
    expect(manifest.source.width).toBe(1080);
    expect(manifest.source.height).toBe(1920);
  });

  it("enforces the 90 second duration cap at manifest level", () => {
    const manifest = generateJosephManifest({
      ...BASE_INPUT,
      durationMs: 120_000,
      transcript: [
        {...BASE_INPUT.transcript[0], startMs: 0, endMs: 500},
        {...BASE_INPUT.transcript[1], startMs: 119_000, endMs: 119_500},
      ],
      beats: [0, 30_000, 60_000, 90_000, 119_000],
      onsets: [0, 119_000],
    });

    expect(manifest.durationFrames).toBeLessThanOrEqual(90 * 30);
    expect(manifest.source.durationMs).toBeLessThanOrEqual(90_000);
  });

  it("keeps render-affecting fields deterministic for the same seed", () => {
    const left = canonicalizeManifest(generateJosephManifest(BASE_INPUT));
    const right = canonicalizeManifest(generateJosephManifest(BASE_INPUT));

    expect(right).toEqual(left);
  });

  it("changes render-affecting fields when the seed changes", () => {
    const left = canonicalizeManifest(generateJosephManifest(BASE_INPUT));
    const right = canonicalizeManifest(generateJosephManifest({...BASE_INPUT, seed: 99999}));

    expect(right).not.toEqual(left);
  });

  it("exposes the candidate Treatment Genome generator required by v8.1", async () => {
    const directorModule = await import("./joseph-director");

    expect(typeof (directorModule as Record<string, unknown>).generateCandidateGenomes).toBe("function");
  });
});
