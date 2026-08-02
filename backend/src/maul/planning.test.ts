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

  it("rejects words that do not map completely onto the output timeline", () => {
    expect(() =>
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
        words: [
          {text: "straddles", startMs: 450, endMs: 550, confidence: 0.99},
        ],
      }),
    ).toThrow(/word 0.*timeline|timeline.*word 0/i);
  });

  it("rejects a word whose endpoints map but whose duration spans a cut", () => {
    expect(() =>
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
        words: [
          {text: "straddles", startMs: 450, endMs: 750, confidence: 0.99},
        ],
      }),
    ).toThrow(/word 0.*single kept|single kept.*word 0/i);
  });
});
