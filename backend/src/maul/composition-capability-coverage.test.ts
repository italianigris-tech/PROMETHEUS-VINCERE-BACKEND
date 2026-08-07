import {describe, expect, it} from "vitest";

import {buildCompositionExperimentCapabilityCoverage} from "./composition-capability-coverage.js";

describe("composition experiment capability coverage", () => {
  it("accounts for every required capability category and every plausible provider", () => {
    const report = buildCompositionExperimentCapabilityCoverage({
      fixtureId: "scene_a_matted_lady_hierarchy_v1",
      generatedAt: "2026-08-07T08:00:00.000Z",
    });

    expect(new Set(report.entries.map((entry) => entry.category))).toEqual(new Set([
      "typography",
      "svg_treatment",
      "animation",
      "placement",
      "joseph_transfer",
      "scene",
      "font",
      "renderer",
      "policy",
      "prompt",
      "dataset",
      "reference",
      "fixture",
      "test",
    ]));
    expect(report.entries.every((entry) => entry.reason.length > 0)).toBe(true);
    expect(report.entries.every((entry) => entry.owner.length > 0)).toBe(true);
    expect(report.entries.every((entry) => entry.evidence.length > 0)).toBe(true);
    expect(report.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capabilityId: "canonical_maul_short_renderer",
        disposition: "selected",
        owner: "remotion-app/src/compositions/MaulShort.tsx",
      }),
      expect.objectContaining({
        capabilityId: "test_matte_mp4",
        disposition: "rejected",
      }),
      expect.objectContaining({
        capabilityId: "legacy_static_image_demo_proof",
        disposition: "rejected",
      }),
    ]));
    expect(report.duplicateAuthorities).toEqual([]);
    expect(report.coverageSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
