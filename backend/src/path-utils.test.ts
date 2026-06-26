import {describe, expect, it} from "vitest";
import {basenameAnyPlatform, extnameAnyPlatform} from "./path-utils";

describe("cross-platform path helpers", () => {
  it("extracts file names from Windows paths even on POSIX runners", () => {
    const filePath = "C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING\\font-intelligence\\assets\\Satoshi-Bold.otf";

    expect(basenameAnyPlatform(filePath)).toBe("Satoshi-Bold.otf");
    expect(extnameAnyPlatform(filePath)).toBe(".otf");
  });
});
