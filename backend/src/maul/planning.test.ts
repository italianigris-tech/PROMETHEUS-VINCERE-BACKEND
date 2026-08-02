import {describe, expect, it} from "vitest";

import {
  mapMaulSourceMsToOutput,
  mapMaulTranscriptWordsToOutput,
} from "./planning.js";

describe("MAUL planning timestamp mapping", () => {
  it("applies the timestamp-map scale for non-1x kept segments", () => {
    expect(
      mapMaulSourceMsToOutput(
        [
          {
            sourceStartMs: 0,
            sourceEndMs: 1000,
            outputStartMs: 0,
            outputEndMs: 500,
            mode: "keep",
          },
        ],
        750,
      ),
    ).toBe(375);
  });

  it("does not map source time inside a cut", () => {
    expect(
      mapMaulSourceMsToOutput(
        [
          {
            sourceStartMs: 1000,
            sourceEndMs: 1500,
            outputStartMs: 500,
            outputEndMs: 500,
            mode: "cut",
          },
        ],
        1200,
      ),
    ).toBeNull();
  });

  it("rejects malformed legacy transcript words instead of silently dropping them", () => {
    expect(() =>
      mapMaulTranscriptWordsToOutput({
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 1000,
            outputStartMs: 0,
            outputEndMs: 1000,
            mode: "keep",
          },
        ],
        words: [
          {text: "Valid", startMs: 0, endMs: 300, confidence: 0.99},
          {text: "", startMs: 320, endMs: 500, confidence: 0.99},
        ],
      }),
    ).toThrow(/word 1.*empty|empty.*word 1/i);
  });

  it("preserves a word portion that remains before a source cut", () => {
    expect(
      mapMaulTranscriptWordsToOutput({
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 500,
            outputStartMs: 0,
            outputEndMs: 500,
            mode: "keep",
          },
          {
            sourceStartMs: 500,
            sourceEndMs: 700,
            outputStartMs: 500,
            outputEndMs: 500,
            mode: "cut",
          },
          {
            sourceStartMs: 700,
            sourceEndMs: 1000,
            outputStartMs: 500,
            outputEndMs: 800,
            mode: "keep",
          },
        ],
        words: [{
          transcriptWordIndex: 11,
          text: "straddles",
          startMs: 450,
          endMs: 550,
          confidence: 0.99,
        }],
      }),
    ).toEqual([
      expect.objectContaining({
        transcriptWordIndex: 11,
        sourceStartMs: 450,
        sourceEndMs: 550,
        startMs: 450,
        endMs: 500,
        outputSpans: [{outputStartMs: 450, outputEndMs: 500}],
      }),
    ]);
  });

  it("keeps one logical word with multiple output spans when a cut crosses it", () => {
    const mapped = mapMaulTranscriptWordsToOutput({
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 500,
            outputStartMs: 0,
            outputEndMs: 500,
            mode: "keep",
          },
          {
            sourceStartMs: 500,
            sourceEndMs: 700,
            outputStartMs: 500,
            outputEndMs: 500,
            mode: "cut",
          },
          {
            sourceStartMs: 700,
            sourceEndMs: 1000,
            outputStartMs: 500,
            outputEndMs: 800,
            mode: "keep",
          },
        ],
        words: [{
          transcriptWordIndex: 12,
          text: "straddles",
          startMs: 450,
          endMs: 750,
          confidence: 0.99,
        }],
      });

    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toEqual(
      expect.objectContaining({
        transcriptWordIndex: 12,
        sourceStartMs: 450,
        sourceEndMs: 750,
        startMs: 450,
        endMs: 550,
        outputSpans: [
          {outputStartMs: 450, outputEndMs: 500},
          {outputStartMs: 500, outputEndMs: 550},
        ],
      }),
    );
  });
});
