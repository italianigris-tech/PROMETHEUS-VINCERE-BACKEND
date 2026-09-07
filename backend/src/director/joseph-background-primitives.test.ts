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

  it("supports ambient gobo, hierarchical staging, retinal inversion, attention bokeh, and continuous descent", () => {
    const ids = JOSEPH_BACKGROUND_PRIMITIVE_CATALOG.map((p) => p.primitiveId);
    expect(ids).toContain("gobo.ambient-shadow-drift");
    expect(ids).toContain("spatial.hierarchical-hero-quad");
    expect(ids).toContain("canvas.continuous-vertical-descent");
    expect(ids).toContain("optics.attention-gated-bokeh");
    expect(ids).toContain("retinal.micro-flash-inversion");

    const gobo = JOSEPH_BACKGROUND_PRIMITIVE_CATALOG.find((p) => p.primitiveId === "gobo.ambient-shadow-drift")!;
    expect(gobo.blendMode).toBe("multiply");
    expect(gobo.defaultParameters.opacity).toBeGreaterThanOrEqual(0.15);
    expect(gobo.defaultParameters.opacity).toBeLessThanOrEqual(0.35);

    const retinal = JOSEPH_BACKGROUND_PRIMITIVE_CATALOG.find((p) => p.primitiveId === "retinal.micro-flash-inversion")!;
    expect(retinal.layer).toBe("accent");
    expect(retinal.defaultParameters.speed).toBeGreaterThanOrEqual(0.9);

    const spatial = JOSEPH_BACKGROUND_PRIMITIVE_CATALOG.find((p) => p.primitiveId === "spatial.hierarchical-hero-quad")!;
    expect(spatial.layer).toBe("overlay_support");
    expect(spatial.blendMode).toBe("soft_light");

    const canvas = JOSEPH_BACKGROUND_PRIMITIVE_CATALOG.find((p) => p.primitiveId === "canvas.continuous-vertical-descent")!;
    expect(canvas.layer).toBe("foundation");

    const bokeh = JOSEPH_BACKGROUND_PRIMITIVE_CATALOG.find((p) => p.primitiveId === "optics.attention-gated-bokeh")!;
    expect(bokeh.family).toBe("focus_tunnel");
  });
});

