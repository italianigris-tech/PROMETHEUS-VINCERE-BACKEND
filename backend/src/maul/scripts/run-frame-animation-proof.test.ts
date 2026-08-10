import {mkdtemp, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {afterEach, describe, expect, it, vi} from "vitest";

import {
  assertFrameAnimationProofPlan,
  resolveFrameAnimationProofTranscript,
} from "./run-frame-animation-proof";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, {recursive: true, force: true})
  ));
});

const fixtureWords = [
  {text: "Make", startMs: 0, endMs: 300, confidence: 1},
  {text: "ideas", startMs: 300, endMs: 700, confidence: 0.99},
  {text: "matter", startMs: 700, endMs: 1_100, confidence: 0.98},
];

describe("MAUL frame-animation proof runner", () => {
  it("uses AssemblyAI when a key is supplied and preserves timed words", async () => {
    const transcribe = vi.fn(async () => fixtureWords.map((word) => ({
      text: word.text,
      start_ms: word.startMs,
      end_ms: word.endMs,
      confidence: word.confidence,
    })));

    const result = await resolveFrameAnimationProofTranscript({
      mediaPath: "/tmp/source.mp4",
      assemblyAiApiKey: "test-key",
      transcribe,
    });

    expect(transcribe).toHaveBeenCalledWith(expect.objectContaining({
      filePath: "/tmp/source.mp4",
      apiKey: "test-key",
    }));
    expect(result.source).toBe("assemblyai");
    expect(result.words).toEqual(fixtureWords);
  });

  it("uses an explicit persisted transcript when AssemblyAI is unavailable", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "maul-frame-proof-"));
    temporaryDirectories.push(directory);
    const transcriptPath = path.join(directory, "transcript.json");
    await writeFile(transcriptPath, JSON.stringify({
      schemaVersion: "maul-frame-animation-proof-transcript/v1",
      source: "offline_fixture",
      language: "en",
      text: "Make ideas matter",
      words: fixtureWords,
    }));

    const result = await resolveFrameAnimationProofTranscript({
      mediaPath: "/tmp/source.mp4",
      transcriptPath,
      assemblyAiApiKey: "",
    });

    expect(result.source).toBe("offline_fixture");
    expect(result.text).toBe("Make ideas matter");
    expect(result.words).toHaveLength(3);
  });

  it("fails when neither AssemblyAI nor a persisted transcript is available", async () => {
    await expect(resolveFrameAnimationProofTranscript({
      mediaPath: "/tmp/source.mp4",
      assemblyAiApiKey: "",
      transcriptPath: "/tmp/does-not-exist.json",
    })).rejects.toThrow(/AssemblyAI.*persisted timed transcript|persisted timed transcript.*AssemblyAI/i);
  });

  it("requires one non-overlapping compiled frame program per placed token", () => {
    const plan = {
      tokens: fixtureWords.map((word, index) => ({tokenId: `token_${index}`, text: word.text})),
      segments: [{
        segmentId: "segment_a",
        tokenIds: ["token_0", "token_1", "token_2"],
      }],
      programs: fixtureWords.map((_word, index) => ({
        animationId: `animation_${index}`,
        executorId: "gsap:generic_single_word",
        target: {placementSegmentId: "segment_a", tokenIds: [`token_${index}`]},
        frameMotion: {
          executorId: "gsap:generic_single_word",
          tokenId: `token_${index}`,
          phases: {
            entry: {startFrame: index * 10, endFrame: index * 10 + 2},
            hold: {startFrame: index * 10 + 2, endFrame: index * 10 + 7},
            exit: {startFrame: index * 10 + 7, endFrame: index * 10 + 10},
          },
        },
      })),
    };

    expect(assertFrameAnimationProofPlan(plan)).toEqual({
      tokenCount: 3,
      segmentCount: 1,
      programCount: 3,
      executorIds: ["gsap:generic_single_word"],
    });
    expect(() => assertFrameAnimationProofPlan({
      ...plan,
      programs: plan.programs.slice(0, 2),
    })).toThrow(/every.*token|token.*program/i);
    expect(() => assertFrameAnimationProofPlan({
      ...plan,
      programs: [...plan.programs, plan.programs[0]],
    })).toThrow(/overlap|duplicate/i);
  });
});

