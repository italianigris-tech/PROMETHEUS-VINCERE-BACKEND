import {describe, expect, it} from "vitest";

import {isCompatibleFontPath} from "../zilliz-font-resolver";

describe("zilliz resolver filter", () => {
  it("accepts zip archives from remote font storage", () => {
    expect(isCompatibleFontPath("https://r2.example.com/fonts/aesthetic-pack.zip")).toBe(true);
  });

  it("continues accepting raw browser font assets", () => {
    expect(isCompatibleFontPath("https://r2.example.com/fonts/Ageya-Regular.woff2")).toBe(true);
    expect(isCompatibleFontPath("https://r2.example.com/fonts/Ageya-Regular.otf")).toBe(true);
  });
});
