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

  it("handles nested annotations by letting the inner color override temporarily", () => {
    expect(parseColorAnnotations("{red}hot {blue}cold{/blue} hot{/red}")).toEqual({
      plainText: "hot cold hot",
      colorRanges: [
        {start: 0, end: 4, color: "#FF0040"},
        {start: 4, end: 8, color: "#0080FF"},
        {start: 8, end: 12, color: "#FF0040"}
      ]
    });
  });

  it("preserves escaped annotation syntax as literal text", () => {
    expect(parseColorAnnotations("keep \\{red}literal\\{/red} tag")).toEqual({
      plainText: "keep {red}literal{/red} tag",
      colorRanges: []
    });
  });

  it("handles empty strings", () => {
    expect(parseColorAnnotations("")).toEqual({plainText: "", colorRanges: []});
  });

  it("strips malformed annotation syntax without emitting a broken color range", () => {
    expect(parseColorAnnotations("keep {red}motion tags readable")).toEqual({
      plainText: "keep motion tags readable",
      colorRanges: []
    });
  });

  it("strips unsupported paired tags while preserving their text", () => {
    expect(parseColorAnnotations("keep {orange}motion{/orange} readable")).toEqual({
      plainText: "keep motion readable",
      colorRanges: []
    });
  });
});
