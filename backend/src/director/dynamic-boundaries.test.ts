import {describe, expect, it} from "vitest";
import {findCutPoints, findNearest, type Phrase} from "./dynamic-boundaries";

const phrase = (startMs: number, endMs: number, text: string): Phrase => ({
  startMs,
  endMs,
  text,
  words: [{startMs, endMs, text}],
});

describe("Dynamic Boundaries", () => {
  it("finds nearest point with deterministic lower tie-break", () => {
    expect(findNearest(1050, [900, 1200, 1000, 1100])).toBe(1000);
    expect(findNearest(500, [])).toBe(500);
  });

  it("adds at least two safe hook cuts from beats or onsets", () => {
    const cuts = findCutPoints(
      [phrase(100, 400, "hook"), phrase(3400, 3800, "body")],
      [500, 1500, 2500, 3500, 7200, 8200],
      [],
      9000,
      "joseph_minimal",
    );

    expect(cuts.filter((cut) => cut <= 3000)).toEqual([500, 1500]);
  });

  it("keeps body cuts at phrase boundaries when near beat or onset", () => {
    const cuts = findCutPoints(
      [phrase(0, 900, "hook"), phrase(3300, 3900, "body one"), phrase(4300, 4900, "body two"), phrase(7600, 8200, "cta")],
      [500, 1500, 2500, 4000, 7600, 8400],
      [3900, 6100],
      9000,
      "joseph_aggressive",
    );

    expect(cuts).toContain(3900);
    expect(cuts).not.toContain(4900);
  });

  it("forces CTA cuts on profile-strided safe beats", () => {
    const phrases = [phrase(0, 400, "hook"), phrase(3600, 4200, "body"), phrase(7200, 7550, "cta")];
    const beats = [500, 1500, 2500, 6100, 7000, 7600, 8200, 8800];

    expect(findCutPoints(phrases, beats, [], 9000, "joseph_aggressive")).toEqual([500, 1500, 2500, 6100, 7000, 7600, 8200, 8800]);
    expect(findCutPoints(phrases, beats, [], 9000, "joseph_cinematic")).toEqual([500, 2500, 6100, 7600, 8800]);
    expect(findCutPoints(phrases, beats, [], 9000, "joseph_minimal")).toEqual([500, 1500, 6100, 8200]);
  });

  it("deduplicates, sorts, and avoids mid-word cuts", () => {
    const cuts = findCutPoints(
      [phrase(0, 900, "hook"), phrase(3200, 3900, "body"), phrase(7600, 8500, "cta word")],
      [500, 500, 1500, 2500, 3500, 7600, 8200, 8800],
      [500, 3900],
      9000,
      "joseph_aggressive",
    );

    expect(cuts).toEqual([...new Set(cuts)].sort((left, right) => left - right));
    expect(cuts).not.toContain(3500);
    expect(cuts).not.toContain(8200);
    expect(cuts).toContain(3900);
  });
});