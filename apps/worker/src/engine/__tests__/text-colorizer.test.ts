import {describe, expect, it} from "vitest";

import {parseColorAnnotations} from "../text-colorizer.js";

describe("parseColorAnnotations", () => {
  it("parses named color annotations", () => {
    expect(parseColorAnnotations("hello {red}world{/red}")).toEqual({
      plainText: "hello world",
      colorRanges: [{start: 6, end: 11, color: "#FF0040"}]
    });
  });

  it("parses hex color annotations", () => {
    expect(parseColorAnnotations("{#ff00ff}hot{/#ff00ff} take")).toEqual({
      plainText: "hot take",
      colorRanges: [{start: 0, end: 3, color: "#FF00FF"}]
    });
  });

  it("handles empty strings", () => {
    expect(parseColorAnnotations("")).toEqual({plainText: "", colorRanges: []});
  });
});
