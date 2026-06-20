import {describe, expect, it} from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  buildVariationKey,
  fingerprintString,
  generateVariationKey,
  hashFileFingerprint,
} from "./variation-key";

describe("Variation Key contract", () => {
  it("keeps identical upload instance and retry index stable", () => {
    const left = buildVariationKey({
      sourcePath: "file:///test.mp4",
      prompt: "Make it intense",
      uploadInstanceId: "upload-1",
      retryIndex: 0,
    });
    const right = buildVariationKey({
      sourcePath: "file:///test.mp4",
      prompt: "Make it intense",
      uploadInstanceId: "upload-1",
      retryIndex: 0,
    });

    expect(right).toEqual(left);
  });

  it("exposes the requested generateVariationKey positional helper", () => {
    const fromBuilder = buildVariationKey({
      sourcePath: "file:///test.mp4",
      prompt: "Make it intense",
      uploadInstanceId: "upload-1",
      retryIndex: 0,
    });
    const fromHelper = generateVariationKey("file:///test.mp4", "Make it intense", "upload-1", 0);

    expect(fromHelper).toEqual(fromBuilder);
  });

  it("changes when retry index changes", () => {
    const first = buildVariationKey({
      sourcePath: "file:///test.mp4",
      prompt: "Make it intense",
      uploadInstanceId: "upload-1",
      retryIndex: 0,
    });
    const retry = buildVariationKey({
      sourcePath: "file:///test.mp4",
      prompt: "Make it intense",
      uploadInstanceId: "upload-1",
      retryIndex: 1,
    });

    expect(retry).not.toEqual(first);
  });

  it("makes upload_instance_id and retry_index explicit", () => {
    const key = buildVariationKey({
      sourcePath: "file:///test.mp4",
      prompt: "Make it intense",
      uploadInstanceId: "upload-1",
      retryIndex: 2,
    });

    expect(key.uploadInstanceId ?? key.upload_instance_id).toBe("upload-1");
    expect(key.retryIndex ?? key.retry_index).toBe(2);
  });

  it("fingerprints prompt strings deterministically with sha256", () => {
    expect(fingerprintString("Make it intense")).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintString("Make it intense")).toBe(fingerprintString("Make it intense"));
    expect(fingerprintString("Make it intense")).not.toBe(fingerprintString("Make it quiet"));
  });

  it("uses file bytes for source fingerprints when the source exists", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "variation-key-"));
    const source = path.join(dir, "source.mp4");
    fs.writeFileSync(source, "first bytes");

    const first = hashFileFingerprint(source);
    fs.writeFileSync(source, "second bytes");
    const second = hashFileFingerprint(source);

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toMatch(/^[a-f0-9]{64}$/);
    expect(second).not.toBe(first);
  });
});
