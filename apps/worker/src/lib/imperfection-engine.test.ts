import {describe, expect, it, vi} from "vitest";

import {applyImperfection} from "./imperfection-engine.js";

describe("applyImperfection", () => {
  it("keeps generated noise inside the configured bounds", () => {
    const random = vi.fn(() => 1);
    const result = applyImperfection(
      {
        timingNoiseMs: 20,
        spacingVariance: 0.1,
        easingPerturbation: 0.05,
        rotationalDrift: 0.2
      },
      "release",
      {duration: 1, x: 10, y: 20, rotation: 0},
      random
    );

    expect(result.duration).toBeCloseTo(1.012);
    expect(result.x).toBeCloseTo(12.8);
    expect(result.y).toBeCloseTo(22.8);
    expect(result.rotation).toBeCloseTo(2.8);
  });

  it("amplifies chaotic emotions more than intimate emotions", () => {
    const config = {
      timingNoiseMs: 10,
      spacingVariance: 0.1,
      easingPerturbation: 0,
      rotationalDrift: 0.1
    };
    const base = {duration: 1, x: 0, y: 0, rotation: 0};
    const maxRandom = () => 1;

    const chaos = applyImperfection(config, "chaos", base, maxRandom);
    const intimacy = applyImperfection(config, "intimacy", base, maxRandom);

    expect(chaos.x).toBeGreaterThan(intimacy.x);
    expect(chaos.duration).toBeGreaterThan(intimacy.duration);
  });
});
