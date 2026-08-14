import {describe, expect, it} from "vitest";

import {buildMaulTransitionPlan} from "./maul-transition-planning.js";

describe("MAUL transition planning", () => {
  it("spends transitions only on semantic state changes", () => {
    const plan = buildMaulTransitionPlan({
      treatmentId: "premium_direct_response",
      permittedTransitions: ["hard_cut", "directional_wipe"],
      beats: [
        {beatId: "hook", role: "hook", outputStartMs: 0, outputEndMs: 2_000, protectedPause: false, intensity: 0.82},
        {beatId: "claim", role: "claim", outputStartMs: 2_000, outputEndMs: 4_000, protectedPause: false, intensity: 0.5},
        {beatId: "contrast", role: "contrast", outputStartMs: 4_000, outputEndMs: 6_000, protectedPause: false, intensity: 0.88},
        {beatId: "payoff", role: "payoff", outputStartMs: 6_000, outputEndMs: 8_000, protectedPause: false, intensity: 0.92},
      ],
    });

    expect(plan.map((event) => event.outputMs)).toEqual([4_000, 6_000]);
    expect(plan.map((event) => event.kind)).toEqual(["light_flash", "whip_pan"]);
  });

  it("fails closed when theme forbids transitions", () => {
    expect(buildMaulTransitionPlan({
      treatmentId: "minimal_expert",
      permittedTransitions: ["none"],
      beats: [
        {beatId: "payoff", role: "payoff", outputStartMs: 3_000, outputEndMs: 5_000, protectedPause: false, intensity: 0.8},
      ],
    })).toEqual([]);
  });
});
