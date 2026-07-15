import {describe, expect, it} from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  buildFixtureSpeechTranscript,
  buildPromptFallbackTranscript,
  resolveJosephTranscript,
} from "./joseph-transcript";

const tempPath = (name: string): string =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), "joseph-transcript-")), name);

describe("Joseph transcript resolution", () => {
  it("never treats prompt fallback as IRL-trainable", () => {
    const payload = buildPromptFallbackTranscript({
      durationMs: 8000,
      promptText: "Make the hook kinetic and premium",
    });
    expect(payload.source).toBe("fallback_prompt");
    expect(payload.trainableForIrl).toBe(false);
    expect(payload.warnings).toContain("irl_not_trainable_from_prompt_transcript");
  });

  it("builds timed fixture speech words for offline smoke", () => {
    const payload = buildFixtureSpeechTranscript(10_000);
    expect(payload.source).toBe("fixture_words");
    expect(payload.words.length).toBeGreaterThanOrEqual(4);
    expect(payload.words.every((word) => word.endMs > word.startMs)).toBe(true);
  });

  it("uses AssemblyAI words when API key and media resolve", async () => {
    const transcriptPath = tempPath("assembly.json");
    const mediaPath = tempPath("clip.mp4");
    fs.writeFileSync(mediaPath, Buffer.from("fake-media"));

    const result = await resolveJosephTranscript({
      transcriptPath,
      sourceMediaPath: mediaPath,
      durationMs: 5000,
      promptText: "ignored when assembly succeeds",
      assemblyAiApiKey: "test-key",
      transcribe: async () => [
        {text: "Hook", start_ms: 100, end_ms: 400, confidence: 0.99},
        {text: "line", start_ms: 450, end_ms: 800, confidence: 0.98},
        {text: "lands", start_ms: 900, end_ms: 1200, confidence: 0.97},
        {text: "hard", start_ms: 1300, end_ms: 1600, confidence: 0.96},
      ],
    });

    expect(result.payload.source).toBe("assemblyai");
    expect(result.payload.trainableForIrl).toBe(true);
    expect(result.payload.words.map((word) => word.text)).toEqual(["Hook", "line", "lands", "hard"]);
    expect(fs.existsSync(result.path)).toBe(true);
  });

  it("reuses provided transcript file words", async () => {
    const transcriptPath = tempPath("provided.json");
    fs.writeFileSync(transcriptPath, JSON.stringify({
      words: [
        {text: "Provided", startMs: 0, endMs: 300},
        {text: "speech", startMs: 350, endMs: 700},
      ],
      source: "provided_file",
      durationMs: 2000,
      trainableForIrl: true,
    }));

    const result = await resolveJosephTranscript({
      transcriptPath,
      sourceMediaPath: tempPath("missing.mp4"),
      durationMs: 2000,
      promptText: "should not replace",
    });

    expect(result.payload.source).toBe("provided_file");
    expect(result.payload.words[0]?.text).toBe("Provided");
  });

  it("fails closed when speech transcript is required and no source exists", async () => {
    await expect(resolveJosephTranscript({
      transcriptPath: tempPath("required.json"),
      sourceMediaPath: tempPath("no-media.mp4"),
      durationMs: 3000,
      promptText: "cannot invent",
      requireSpeechTranscript: true,
    })).rejects.toThrow(/Speech transcript required/i);
  });
});
