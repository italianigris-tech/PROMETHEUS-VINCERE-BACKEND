import {describe, expect, it} from "vitest";
import {
  JOSEPH_BACKGROUND_PRIMITIVE_CATALOG,
  buildJosephBackgroundPrimitivePlan,
} from "./joseph-background-primitives";

describe("Joseph background primitive system", () => {
  it("exposes a curated primitive catalog for premium scene building", () => {
    expect(JOSEPH_BACKGROUND_PRIMITIVE_CATALOG.length).toBeGreaterThanOrEqual(8);

    const families = new Set(JOSEPH_BACKGROUND_PRIMITIVE_CATALOG.map((primitive) => primitive.family));
    expect([...families]).toEqual(
      expect.arrayContaining([
        "shader_background",
        "abstract_light_field",
        "particle_atmosphere",
        "editorial_backplate",
        "vignette_surface",
        "focus_tunnel",
        "accent_geometry",
      ]),
    );

    const ids = JOSEPH_BACKGROUND_PRIMITIVE_CATALOG.map((primitive) => primitive.primitiveId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("governs primitive parameters through safe inspectable controls", () => {
    const plan = buildJosephBackgroundPrimitivePlan({
      seed: 9123,
      profile: "joseph_aggressive",
      doctrineId: "kinetic-pulse",
      visualDensityPlan: "high",
      hasPiP: true,
      durationFrames: 270,
    });

    expect(plan.version).toBe("joseph-background-v1");
    expect(plan.parameterAudit.governed).toBe(true);
    expect(plan.primitives.length).toBeGreaterThanOrEqual(3);
    expect(plan.primitives.length).toBeLessThanOrEqual(plan.layeringRules.maxActivePrimitives);
    for (const primitive of plan.primitives) {
      expect(primitive.parameters.speed).toBeGreaterThanOrEqual(0);
      expect(primitive.parameters.speed).toBeLessThanOrEqual(1);
      expect(primitive.parameters.noiseIntensity).toBeGreaterThanOrEqual(0);
      expect(primitive.parameters.noiseIntensity).toBeLessThanOrEqual(1);
      expect(primitive.parameters.bloomIntensity).toBeGreaterThanOrEqual(0);
      expect(primitive.parameters.bloomIntensity).toBeLessThanOrEqual(1);
      expect(primitive.parameters.distortionAmount).toBeGreaterThanOrEqual(0);
      expect(primitive.parameters.distortionAmount).toBeLessThanOrEqual(1);
      expect(primitive.parameters.opacity).toBeGreaterThanOrEqual(0);
      expect(primitive.parameters.opacity).toBeLessThanOrEqual(1);
    }
  });

  it("declares layering rules for text, PiP, source footage, and overlays", () => {
    const plan = buildJosephBackgroundPrimitivePlan({
      seed: 334,
      profile: "joseph_cinematic",
      doctrineId: "restrained-cinematic",
      visualDensityPlan: "medium",
      hasPiP: true,
      durationFrames: 420,
    });

    expect(plan.layeringRules.sourceFootageMode).toBe("pip_protected");
    expect(plan.layeringRules.textProtection).toMatch(/contrast|clearance/);
    expect(plan.layeringRules.pipProtection).toBe("reserved_safe_zone");
    expect(plan.layeringRules.overlayInteraction).toBe("accent_below_text");
    expect(plan.primitives.map((primitive) => primitive.layer)).toEqual(
      expect.arrayContaining(["foundation", "atmosphere", "accent"]),
    );
  });

  it("produces materially different premium scenes without one-off components", () => {
    const aggressive = buildJosephBackgroundPrimitivePlan({
      seed: 100,
      profile: "joseph_aggressive",
      doctrineId: "kinetic-pulse",
      visualDensityPlan: "high",
      hasPiP: true,
      durationFrames: 300,
    });
    const cinematic = buildJosephBackgroundPrimitivePlan({
      seed: 100,
      profile: "joseph_cinematic",
      doctrineId: "restrained-cinematic",
      visualDensityPlan: "medium",
      hasPiP: true,
      durationFrames: 300,
    });

    expect(aggressive.selectedPrimitiveIds).not.toEqual(cinematic.selectedPrimitiveIds);
    expect(
      aggressive.primitives.every((primitive) => primitive.renderStrategy === "curated_mesh"),
    ).toBe(true);
    expect(
      cinematic.primitives.every((primitive) => primitive.renderStrategy === "curated_mesh"),
    ).toBe(true);
  });
});
