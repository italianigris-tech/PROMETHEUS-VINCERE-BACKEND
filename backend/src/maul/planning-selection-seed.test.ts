import {describe, expect, it} from "vitest";

import {buildMaulPlanningSelectionSeed} from "./planning-selection-seed.js";

describe("MAUL planning selection seed", () => {
  it("is stable for the same source and candidate words despite new runtime artifact IDs", () => {
    const input = {
      sourceSha256: "a".repeat(64),
      treatmentId: "premium_direct_response",
      candidateWords: [
        {text: "But", startMs: 1884, endMs: 2066},
        {text: "moving", startMs: 2066, endMs: 2430},
        {text: "fast", startMs: 2430, endMs: 2673},
      ],
    };

    expect(buildMaulPlanningSelectionSeed(input)).toBe(
      buildMaulPlanningSelectionSeed({...input}),
    );
    expect(buildMaulPlanningSelectionSeed(input)).toMatch(/^[a-f0-9]{64}$/);
  });
});
