import {readFileSync} from "node:fs";

import {describe, expect, it} from "vitest";

import {
  KINETIC_TRAIT_REGISTRY,
  assertKineticTraitCompatibility,
  getExecutableKineticTrait,
  getKineticTrait,
  parseNumericKineticEvidence,
  validateKineticTraitRegistry,
} from "./kinetic-trait-registry.js";

describe("kinetic trait registry", () => {
  it("validates shipped traits as machine-readable contracts", () => {
    expect(validateKineticTraitRegistry(KINETIC_TRAIT_REGISTRY)).toEqual([]);
    expect(KINETIC_TRAIT_REGISTRY.traits.flatMap((trait) => trait.conflictsWith))
      .toEqual(expect.arrayContaining(["trait_liquid_gooey_morph"]));
    expect(KINETIC_TRAIT_REGISTRY.traits.flatMap((trait) => trait.conflictsWith))
      .not.toContain("gooey_metaball_filter");
  });

  it("rejects conflicting channel owners before manifest compilation", () => {
    expect(() => assertKineticTraitCompatibility([
      "trait_blur_up_reveal",
      "trait_keynote_punch",
    ])).toThrow(/filter\.blur|transform\.scale/i);
  });

  it("rejects registry references to unknown trait IDs", () => {
    const broken = structuredClone(KINETIC_TRAIT_REGISTRY);
    broken.traits[0]!.conflictsWith = ["trait_missing"];
    expect(validateKineticTraitRegistry(broken)).toContainEqual(
      expect.objectContaining({code: "unknown_conflict_reference"}),
    );
  });

  it("binds source-grounded currency evidence to an executable count-up trait", () => {
    expect(parseNumericKineticEvidence("$10,000")).toEqual({
      kind: "currency",
      sourceText: "$10,000",
      parsedValue: 10_000,
      format: "currency_usd",
    });
    expect(getKineticTrait("trait_number_count_up")).toEqual(
      expect.objectContaining({
        targetScope: "word",
        renderMode: "frame-deterministic",
        ownsChannels: ["text.numericValue"],
      }),
    );
    expect(getExecutableKineticTrait("trait_number_count_up").execution)
      .toEqual({
        status: "typed_adapter",
        executorId: "maul-kinetic-number-count-up-v1",
      });
  });

  it("keeps Glow Search exact and contract-only until a typed adapter exists", () => {
    const reference = readFileSync(
      new URL(
        "../../../Yuan Prometheus Screenshots/prometheus_animations_preview/typography.html",
        import.meta.url,
      ),
      "utf8",
    );
    expect(getKineticTrait("trait_glow_search_caret")).toMatchObject({
      sourcePhenotype: "TYPO #23 (glow-search-input)",
      targetScope: "word",
      ownsChannels: ["background.glow", "opacity", "caret.blink"],
      execution: {status: "contract_only"},
    });
    expect(reference).toContain("background: #3b82f6");
    expect(reference).toContain("box-shadow: 0 0 12px #3b82f6");
    expect(reference).toContain("font-size: 30px");
    expect(() => getExecutableKineticTrait("trait_glow_search_caret"))
      .toThrow(/contract-only.*typed renderer adapter/i);
  });
});
