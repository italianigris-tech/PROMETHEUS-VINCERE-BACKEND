import {describe, expect, it} from "vitest";

import {buildMaulTransitionPlan} from "./transition-planning.js";

describe("MAUL transition planning", () => {
  it("uses transitions only for semantic state changes", () => {
    const plan = buildMaulTransitionPlan({
      treatmentId: "premium_direct_response",
      permittedTransitions: ["hard_cut", "light_flash", "whip_pan"],
      beats: [
        {beatId: "hook", role: "hook", outputStartMs: 0, outputEndMs: 2_000, protectedPause: false, intensity: 0.82},
        {beatId: "orientation", role: "orientation", outputStartMs: 2_000, outputEndMs: 4_000, protectedPause: false, intensity: 0.5},
        {beatId: "reveal", role: "reveal", outputStartMs: 4_000, outputEndMs: 6_000, protectedPause: false, intensity: 0.88},
        {beatId: "payoff", role: "payoff", outputStartMs: 6_000, outputEndMs: 8_000, protectedPause: false, intensity: 0.92},
      ],
    });

    expect(plan).toHaveLength(2);
    expect(plan.map((event) => event.outputMs)).toEqual([4_000, 6_000]);
    expect(plan.map((event) => event.kind)).toEqual(["light_flash", "whip_pan"]);
    expect(plan.every((event) => event.reason.includes("semantic"))).toBe(true);
  });

  it("uses a quiet dip for minimal themes and skips protected pauses", () => {
    expect(buildMaulTransitionPlan({
      treatmentId: "minimal_expert",
      permittedTransitions: ["hard_cut"],
      beats: [
        {beatId: "pause", role: "reveal", outputStartMs: 2_000, outputEndMs: 3_000, protectedPause: true, intensity: 0.8},
        {beatId: "payoff", role: "payoff", outputStartMs: 3_000, outputEndMs: 5_000, protectedPause: false, intensity: 0.8},
      ],
    })).toEqual([
      expect.objectContaining({kind: "dip_to_color", outputMs: 3_000}),
    ]);
  });
});
