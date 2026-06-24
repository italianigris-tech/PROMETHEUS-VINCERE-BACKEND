import {describe, expect, it} from "vitest";

import {
  createRuntimeFontRegistry,
  getRuntimeFontCssFamily
} from "../font-intelligence/font-runtime-registry";

describe("font intelligence runtime registry", () => {
  it("accepts the legacy hydrated manifest shape shipped to the browser", () => {
    const registry = createRuntimeFontRegistry([
      {
        fontId: "font_ramashinta-regular_2b5e1ea0e4d3",
        familyName: " Ramashinta",
        publicUrl: "/fonts/library/ramashinta/ramashinta-regular-9b60e9c5ace4.ttf",
        localPublicPath: "public/fonts/library/ramashinta/ramashinta-regular-9b60e9c5ace4.ttf",
        format: "ttf",
        renderable: true
      }
    ]);

    const record = registry.records[0];

    expect(record).toMatchObject({
      fontId: "font_ramashinta-regular_2b5e1ea0e4d3",
      familyId: "family_ramashinta",
      familyName: "Ramashinta",
      fileName: "ramashinta-regular-9b60e9c5ace4.ttf",
      originalFileName: null,
      weight: null,
      style: "normal"
    });
    expect(registry.byFamilyId.get("family_ramashinta")).toHaveLength(1);
    expect(getRuntimeFontCssFamily(record!)).toBe("__prometheus_font_family_ramashinta");
  });
});
