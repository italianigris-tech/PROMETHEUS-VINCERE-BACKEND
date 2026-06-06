import {describe, expect, it} from "vitest";

import {MOTION_ONTOLOGY, retrieveByEmotion, retrievePatterns} from "./motion-ontology.js";

describe("motion ontology", () => {
  it("contains broad coverage for the director emotion vocabulary", () => {
    const tags = new Set(Object.values(MOTION_ONTOLOGY).flatMap((pattern) => pattern.tags));

    expect(Object.keys(MOTION_ONTOLOGY).length).toBeGreaterThanOrEqual(10);
    for (const emotion of ["tension", "release", "contemplation", "explosion", "intimacy", "isolation", "chaos"]) {
      expect(tags.has(emotion)).toBe(true);
    }
  });

  it("retrieves known pattern ids in request order", () => {
    expect(retrievePatterns(["slow-drift", "aggressive-entrance"]).map((pattern) => pattern.id)).toEqual([
      "slow-drift",
      "aggressive-entrance"
    ]);
  });

  it("retrieves patterns by emotion tag", () => {
    expect(retrieveByEmotion("intimacy").some((pattern) => pattern.tags.includes("intimacy"))).toBe(true);
  });
});
