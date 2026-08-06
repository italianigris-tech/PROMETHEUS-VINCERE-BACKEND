import {describe, expect, it} from "vitest";

import {buildCompositionCandidates} from "./composition-candidates.js";

describe("MAUL composition candidates", () => {
  it("generates four materially distinct directions from measured negative space", () => {
    const candidates = buildCompositionCandidates({
      subjectBox: {x: 0.06, y: 0.1, width: 0.3, height: 0.7},
      opportunity: {
        regionId: "right_negative_space",
        box: {x: 0.56, y: 0.16, width: 0.36, height: 0.5},
        negativeSpace: 0.95,
        readability: 0.92,
        clutter: 0.08,
        faceInterference: 0,
        temporalStability: 0.94,
      },
      purpose: "HOOK",
    });

    expect(candidates.map((candidate) => candidate.direction)).toEqual([
      "editorial_asymmetry",
      "poster_hero",
      "subject_integrated",
      "restrained_minimal",
    ]);
    expect(new Set(candidates.map((candidate) => JSON.stringify(candidate.box))).size)
      .toBeGreaterThanOrEqual(3);
    expect(candidates.every((candidate) => candidate.box.x >= 0.04)).toBe(true);
    expect(candidates.every((candidate) => candidate.box.x + candidate.box.width <= 0.96)).toBe(true);
  });

  it("gives the subject-integrated editorial direction enough width and vertical rhythm for a phrase lockup", () => {
    const candidate = buildCompositionCandidates({
      subjectBox: {x: 0.08, y: 0.1, width: 0.32, height: 0.72},
      opportunity: {
        regionId: "negative_space_right",
        box: {x: 0.52, y: 0.18, width: 0.38, height: 0.22},
        negativeSpace: 0.92,
        readability: 0.9,
        clutter: 0.08,
        faceInterference: 0,
        temporalStability: 0.94,
      },
      purpose: "HOOK",
    }).find((entry) => entry.direction === "subject_integrated");

    expect(candidate?.box.width).toBeGreaterThanOrEqual(0.34);
    expect(candidate?.box.height).toBeGreaterThanOrEqual(0.16);
  });
});
