import {describe, expect, it} from "vitest";

import {isCompatibleFontPath} from "../zilliz-font-resolver";

describe("zilliz resolver filter", () => {
  it("accepts zip archives from remote font storage", () => {
    expect(isCompatibleFontPath("https://r2.example.com/fonts/aesthetic-pack.zip")).toBe(true);
  });

  it("accepts only raw font assets the worker can render", () => {
    expect(isCompatibleFontPath("https://r2.example.com/fonts/Ageya-Regular.ttf")).toBe(true);
    expect(isCompatibleFontPath("https://r2.example.com/fonts/Ageya-Regular.woff")).toBe(true);
    expect(isCompatibleFontPath("https://r2.example.com/fonts/Ageya-Regular.woff2")).toBe(false);
    expect(isCompatibleFontPath("https://r2.example.com/fonts/Ageya-Regular.otf")).toBe(false);
  });
});
