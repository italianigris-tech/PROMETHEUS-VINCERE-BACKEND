import {describe, expect, it} from "vitest";

import {selectEaseForTimestamp} from "./easing-modulator.js";

describe("selectEaseForTimestamp", () => {
  it("maps low intensity to a gentle ease", () => {
    const result = selectEaseForTimestamp(0.2, {
      points: [{t: 0.2, intensity: 0.1, derivative: 0}]
    });

    expect(result.ease).toBe("power2.out");
  });

  it("maps high intensity to an aggressive ease and shorter duration", () => {
    const result = selectEaseForTimestamp(0.8, {
      points: [{t: 0.8, intensity: 0.9, derivative: 2}]
    });

    expect(result.ease).toBe("circ.in");
    expect(result.durationMultiplier).toBe(0.5);
  });
});
