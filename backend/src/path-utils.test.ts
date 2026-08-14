import {describe, expect, it} from "vitest";
import {basenameAnyPlatform, extnameAnyPlatform, toUncPath, rmWithRetry} from "./path-utils";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("cross-platform path helpers", () => {
  it("extracts file names from Windows paths even on POSIX runners", () => {
    const filePath = "C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING\\font-intelligence\\assets\\Satoshi-Bold.otf";

    expect(basenameAnyPlatform(filePath)).toBe("Satoshi-Bold.otf");
    expect(extnameAnyPlatform(filePath)).toBe(".otf");
  });

  it("converts Windows paths to UNC extended paths to bypass MAX_PATH limits", () => {
    if (process.platform === "win32") {
      const input = "C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING\\test";
      const unc = toUncPath(input);
      expect(unc).toContain("\\\\?\\C:\\");
    } else {
      expect(toUncPath("/tmp/test")).toBe("/tmp/test");
    }
  });

  it("safely removes temporary directories using rmWithRetry", async () => {
    const tmpDir = path.join(os.tmpdir(), `test-lock-bypass-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, "dummy.txt"), "hello");

    await rmWithRetry(tmpDir);
    const exists = await fs.stat(tmpDir).catch(() => null);
    expect(exists).toBeNull();
  });
});

