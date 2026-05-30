import {describe, expect, it} from "vitest";

import {
  getSvgVariantCatalogByWordBucket,
  getSvgVariantCandidates,
  getSvgVariantExitProfile,
  getSvgVariantMotionProfile,
  getSvgSlotSchemaForWordCount,
  getSvgVariantsForSlotSchema,
  getSvgTypographyVariantFamily,
  getSvgTypographyVariant,
  getSvgTypographyVariantFromStyleKey,
  getSvgTypographyVariantIdFromStyleKey,
  selectSvgTypographyVariant,
  svgTypographyVariantsV1,
  toSvgTypographyStyleKey
} from "../stylebooks/svg-typography-v1";

describe("svg typography stylebook", () => {
  it("contains exactly 12 variants with required metadata", () => {
    expect(svgTypographyVariantsV1.length).toBe(12);

    svgTypographyVariantsV1.forEach((variant) => {
      expect(variant.id.length).toBeGreaterThan(0);
      expect(variant.sourcePresetId.length).toBeGreaterThan(0);
      expect(variant.animationType.length).toBeGreaterThan(0);
      expect(variant.effects.length).toBeGreaterThan(0);
      expect(variant.slotDefinitions.length).toBeGreaterThan(0);
      expect(variant.timingProfile.entry_seconds).toBeGreaterThan(0);
      expect(variant.timingProfile.total_seconds).toBeGreaterThan(0);
    });
  });

  it("normalizes variants into the supported slot schemas", () => {
    const supported = new Set([
      "primary",
      "script+primary",
      "script+primary+secondary",
      "script_1+script_2+script_3+primary"
    ]);

    svgTypographyVariantsV1.forEach((variant) => {
      expect(supported.has(variant.slotSchema)).toBe(true);
    });
  });

  it("groups variants into reusable 1-4 word registration buckets", () => {
    const catalog = getSvgVariantCatalogByWordBucket();

    expect(catalog["one-word"].length).toBeGreaterThan(0);
    expect(catalog["two-word"].length).toBeGreaterThan(0);
    expect(catalog["three-word"].length).toBeGreaterThan(0);
    expect(catalog["four-word"].length).toBeGreaterThan(0);
  });

  it("selects variants deterministically for the same chunk seed", () => {
    const a = selectSvgTypographyVariant({
      words: ["but", "who", "cares"],
      chunkIndex: 14,
      intent: "default"
    });
    const b = selectSvgTypographyVariant({
      words: ["but", "who", "cares"],
      chunkIndex: 14,
      intent: "default"
    });

    expect(a.id).toBe(b.id);
  });

  it("keeps three-word selections on the exact three-word slot schema", () => {
    const selected = selectSvgTypographyVariant({
      words: ["those", "videos", "are"],
      chunkIndex: 5,
      intent: "default"
    });

    expect(selected.slotSchema).toBe(getSvgSlotSchemaForWordCount(3));
    expect(selected.slotSchema).toBe("script+primary+secondary");
  });

  it("keeps three-word svg selections out of impact-pop hierarchy families", () => {
    const selected = selectSvgTypographyVariant({
      words: ["see", "yourself", "as"],
      chunkIndex: 8,
      intent: "default"
    });

    expect(getSvgTypographyVariantFamily(selected)).not.toBe("impact-pop");
  });

  it("routes different slot-shapes to compatible candidate sets", () => {
    const primaryOnly = getSvgVariantsForSlotSchema("primary");
    const dualSlot = getSvgVariantsForSlotSchema("script+primary");
    const tripleSlot = getSvgVariantsForSlotSchema("script+primary+secondary");
    const fourSlot = getSvgVariantsForSlotSchema("script_1+script_2+script_3+primary");

    expect(primaryOnly.length).toBeGreaterThan(0);
    expect(dualSlot.length).toBeGreaterThan(0);
    expect(tripleSlot.length).toBeGreaterThan(0);
    expect(fourSlot.length).toBeGreaterThan(0);
  });

  it("applies char-range compatibility before deterministic selection", () => {
    const longPrimary = getSvgVariantCandidates({
      words: ["extraordinarymindsetarchitecture"],
      slotSchema: "primary",
      intent: "default"
    });
    const selected = selectSvgTypographyVariant({
      words: ["extraordinarymindsetarchitecture"],
      chunkIndex: 3,
      intent: "default"
    });

    expect(longPrimary.length).toBeGreaterThan(0);
    expect(longPrimary.some((variant) => variant.id === "cinematic_text_preset_1")).toBe(true);
    expect(selected.id).toBe("cinematic_text_preset_1");
  });

  it("filters by intent tags before hashing within candidate pool", () => {
    const nameCalloutTwoSlot = getSvgVariantCandidates({
      words: ["dan", "martell"],
      slotSchema: "script+primary",
      intent: "name-callout"
    });

    expect(nameCalloutTwoSlot.length).toBeGreaterThan(0);
    expect(nameCalloutTwoSlot.every((variant) => variant.slotSchema === "script+primary")).toBe(true);
    expect(nameCalloutTwoSlot.every((variant) => variant.compatibility.intents.includes("name-callout"))).toBe(true);
  });

  it("falls back to a valid candidate when slot schema is unsupported", () => {
    const fallback = getSvgVariantCandidates({
      slotSchema: "unsupported-shape",
      intent: "default"
    });

    expect(fallback.length).toBeGreaterThan(0);
    expect(getSvgTypographyVariant(fallback[0].id)).not.toBeNull();
  });

  it("resolves variants from generated style keys", () => {
    const chosen = svgTypographyVariantsV1[4];
    const styleKey = toSvgTypographyStyleKey(chosen.id);

    expect(getSvgTypographyVariantIdFromStyleKey(styleKey)).toBe(chosen.id);
    expect(getSvgTypographyVariantFromStyleKey(styleKey)?.id).toBe(chosen.id);
  });

  it("exposes motion and exit profiles for selector tuning", () => {
    const cleanVariant = svgTypographyVariantsV1.find((variant) => variant.id === "cinematic_text_preset_2");
    const sweepVariant = svgTypographyVariantsV1.find((variant) => variant.id === "cinematic_text_preset_4");

    expect(cleanVariant).toBeTruthy();
    expect(sweepVariant).toBeTruthy();
    expect(getSvgVariantMotionProfile(cleanVariant!)).toBe("clean");
    expect(getSvgVariantExitProfile(cleanVariant!)).toBe("fade-soft");
    expect(getSvgVariantMotionProfile(sweepVariant!)).toBe("sweep-heavy");
    expect(getSvgVariantExitProfile(sweepVariant!)).toBe("integrated-sweep");
  });

  it("marks the phase-two focus presets with high-end impact and blur treatment metadata", () => {
    const impactVariant = getSvgTypographyVariant("cinematic_text_preset_5");
    const hierarchyVariant = getSvgTypographyVariant("cinematic_text_preset_7");

    expect(impactVariant).toBeTruthy();
    expect(hierarchyVariant).toBeTruthy();
    expect(getSvgVariantMotionProfile(impactVariant!)).toBe("impact");
    expect(impactVariant!.easingProfile).toEqual(expect.arrayContaining(["expo.inOut", "back.out(2.5)"]));
    expect(impactVariant!.effects).toEqual(
      expect.arrayContaining(["chromatic-aberration", "impact-camera-shake", "blur-sweep"])
    );
    expect(hierarchyVariant!.easingProfile).toEqual(expect.arrayContaining(["expo.out", "back.out(2.2)"]));
    expect(hierarchyVariant!.effects).toEqual(
      expect.arrayContaining(["layered-glow", "delicate-script-glow", "blur-sweep"])
    );
  });
});
